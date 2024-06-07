import org.gradle.plugins.ide.idea.model.IdeaLanguageLevel
import org.jetbrains.changelog.Changelog
import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.tasks.ListProductsReleasesTask.Channel
import org.jetbrains.intellij.tasks.RunPluginVerifierTask.FailureLevel
import java.util.EnumSet

fun properties(key: String): Provider<String> = providers.gradleProperty(key)
fun environment(key: String): Provider<String> = providers.environmentVariable(key)
fun extra(key: String): String = project.ext.get(key) as String

plugins {
    id("java")
    id("idea")
    id("org.jetbrains.intellij") version "1.17.3"
    id("org.jetbrains.changelog") version "2.2.0"
    id("com.dorongold.task-tree") version "3.0.0" // provides `taskTree` task (e.g. `./gradlew build taskTree`; docs: https://github.com/dorongold/gradle-task-tree)
}

group = properties("pluginGroup").get()
version = properties("pluginVersion").get()

repositories {
    mavenCentral()
}

idea {
    project {
        // Set default IntelliJ SDK & language level to the version specified in `gradle.properties`
        jdkName = properties("javaVersion").get()
        languageLevel = IdeaLanguageLevel(properties("javaVersion").get())
    }
}

java {
    sourceCompatibility = JavaVersion.toVersion(properties("javaVersion").get())
    targetCompatibility = JavaVersion.toVersion(properties("javaVersion").get())
}

intellij {
    pluginName = properties("pluginName")
    version = properties("platformVersion")
    type = properties("platformType")
    downloadSources = properties("platformDownloadSources").get().toBoolean()

    // Plugin Dependencies. Uses `platformPlugins` property from the gradle.properties file.
    plugins = properties("platformPlugins").map { it.split(',').map(String::trim).filter(String::isNotEmpty) }
}

// Configure CHANGELOG.md - https://github.com/JetBrains/gradle-changelog-plugin
changelog {
    repositoryUrl = properties("pluginRepositoryUrl")
}

fun getFailureLevels(): EnumSet<FailureLevel> {
    val includeFailureLevels = EnumSet.allOf(FailureLevel::class.java)
    val desiredFailureLevels = properties("pluginVerifierExcludeFailureLevels").get()
        .split(",")
        .map(String::trim)
        .filter(String::isNotEmpty) // Remove empty strings; this happens when user sets nothing (ie, `pluginVerifierExcludeFailureLevels =`)

    desiredFailureLevels.forEach { failureLevel ->
        when (failureLevel) {
            "ALL" -> return EnumSet.allOf(FailureLevel::class.java)
            "NONE" -> return EnumSet.noneOf(FailureLevel::class.java)
            else -> {
                try {
                    val enumFailureLevel = FailureLevel.valueOf(failureLevel)
                    includeFailureLevels.remove(enumFailureLevel)
                } catch (ignored: Exception) {
                    val msg = "Failure Level \"$failureLevel\" is *NOT* valid. Please select from: ${EnumSet.allOf(FailureLevel::class.java)}."
                    logger.error(msg)
                    throw Exception(msg)
                }
            }
        }
    }

    return includeFailureLevels
}

tasks {
    patchPluginXml {
        version = properties("pluginVersion")
        sinceBuild = properties("pluginSinceBuild")
        untilBuild = properties("pluginUntilBuild")

        // Extract the <!-- Plugin description --> section from README.md and provide for the plugin's manifest
        pluginDescription = providers.fileContents(layout.projectDirectory.file("README.md")).asText.map {
            val start = "<!-- Plugin description -->"
            val end = "<!-- Plugin description end -->"

            with(it.lines()) {
                if (!containsAll(listOf(start, end))) {
                    throw GradleException("Plugin description section not found in README.md:\n$start ... $end")
                }
                subList(indexOf(start) + 1, indexOf(end)).joinToString("\n").let(::markdownToHTML)
            }
        }

        val changelog = project.changelog // local variable for configuration cache compatibility
        // Get the latest available change notes from the changelog file
        changeNotes = properties("pluginVersion").map { pluginVersion ->
            with(changelog) {
                renderItem(
                    (getOrNull(pluginVersion) ?: getUnreleased())
                        .withHeader(false)
                        .withEmptySections(false),
                    Changelog.OutputType.HTML,
                )
            }
        }
    }

    listProductsReleases {
//        // In addition to `IC` (from `platformType`), we also want to verify against `IU`.
//        types.set(Arrays.asList(properties("platformType"), "IU"))
        // Contrary to above, we want to speed up CI, so skip verification of `IU`.
        types = listOf(properties("platformType").get())

        // Only get the released versions if we are not targeting an EAP.
        val isEAP = properties("pluginVersion").get().endsWith("-EAP")
        releaseChannels = listOf(if (isEAP) Channel.EAP else Channel.RELEASE)

        // Verify against the most recent patch release of the `platformVersion` version
        // (ie, if `platformVersion` = 2022.2, and the latest patch release is `2022.2.2`,
        // then the `sinceVersion` will be set to `2022.2.2` and *NOT* `2022.2`.
        sinceVersion.set(properties("platformVersion"))
    }

    // Task to generate the necessary format for `ChrisCarini/intellij-platform-plugin-verifier-action` GitHub Action.
    register("generateIdeVersionsList") {
        dependsOn(project.tasks.named("listProductsReleases"))
        doLast {
            val ideVersionsList = mutableListOf<String>()

            // Include the versions produced from the `listProductsReleases` task.
            project.tasks.named("listProductsReleases").get().outputs.files.singleFile.forEachLine { line ->
                ideVersionsList.add("idea" + line.replace("-", ":"))
            }

            // Include the versions specified in `gradle.properties` `pluginVerifierIdeVersions` property.
            val pluginVerifierIdeVersions = project.findProperty("pluginVerifierIdeVersions") as? String ?: ""
            pluginVerifierIdeVersions.split(",").map { it.trim() }.forEach { version ->
                listOf("IC", "IU").forEach { type ->
                    ideVersionsList.add("idea$type:$version")
                }
            }

            // Write out file with unique pairs of type + version
            val outFileWriter = File(layout.buildDirectory.get().toString(), "intellij-platform-plugin-verifier-action-ide-versions-file.txt").printWriter()
            ideVersionsList.distinct().forEach { version ->
                outFileWriter.println(version)
            }
            outFileWriter.close()
        }
    }

    runPluginVerifier {
        // Leave `ideVersions` commented out so that the `listProductsReleases` task will execute.
        // If no `ideVersions` is specified, the output from the `listProductsReleases` will be used.
        //
        // NOTE: I use the `listProductsReleases` task and `generateIdeVersionsList` task for the
        // `ChrisCarini/intellij-platform-plugin-verifier-action` GitHub Action to verify on CI.
        // ideVersions = Arrays.asList(properties("pluginVerifierIdeVersions").split(","))

        val failureLevels = getFailureLevels()
        logger.debug("Using ${failureLevels.size} Failure Levels: $failureLevels")
        failureLevel.set(failureLevels)
    }

    withType<JavaCompile> {
        options.compilerArgs.addAll(
            listOf(
                "-Xlint:all",
                "-Xlint:-options",
                "-Xlint:-rawtypes",
                "-Xlint:-processing",
                "-Xlint:-path", // Ignore JBR SDK manifest element warnings
                "-proc:none",
                "-Werror",
                "-Xlint:-classfile"
            )
        )
    }

    if (System.getenv("CI") != "true") {
        // The below file (jetbrainsCredentials.gradle) should contain the below:
        //     project.ext.set("intellijSignPluginCertificateChain", new File("./chain.crt").getText("UTF-8"))
        //     project.ext.set("intellijSignPluginPrivateKey", new File("./private.pem").getText("UTF-8"))
        //     project.ext.set("intellijSignPluginPassword", "YOUR_PRIV_KEY_PASSWORD_HERE")
        //     project.ext.set("intellijPluginPublishToken", "YOUR_TOKEN_HERE")
        //
        // Because this contains credentials, this file is also included in .gitignore file.
        apply(from = "jetbrainsCredentials.gradle")
    }

    val isNotCI = System.getenv("CI") != "true"
    fun resolve(extraKey: String, environmentKey: String): String = if (isNotCI) extra(extraKey) else environment(environmentKey).get()
    val signPluginCertificateChain = resolve("intellijSignPluginCertificateChain", "CERTIFICATE_CHAIN")
    val signPluginPrivateKey = resolve("intellijSignPluginPrivateKey", "PRIVATE_KEY")
    val signPluginPassword = resolve("intellijSignPluginPassword", "PRIVATE_KEY_PASSWORD")
    val publishPluginToken = resolve("intellijPluginPublishToken", "PUBLISH_TOKEN")

    signPlugin {
        dependsOn("checkJetBrainsSecrets")
        certificateChain = signPluginCertificateChain
        privateKey = signPluginPrivateKey
        password = signPluginPassword
    }

    publishPlugin {
        // TODO(ChrisCarini - 2021-10-12) - The `patchChangelog` dependency is not needed,
        //  because it is taken care of in the `release.yml` file. Follow up with the IJ
        //  plugin template to see if this is removed / modified in a month or so.
//    dependsOn("patchChangelog")
        dependsOn("checkJetBrainsSecrets")
        token = publishPluginToken

        // pluginVersion is based on the SemVer (https://semver.org) and supports pre-release labels, like 2.1.7-alpha.3
        // Specify pre-release label to publish the plugin in a custom Release Channel automatically. Read more:
        // https://plugins.jetbrains.com/docs/intellij/deployment.html#specifying-a-release-channel
        channels = properties("pluginVersion").map { listOf(it.substringAfter('-', "").substringBefore('.').ifEmpty { "default" }) }
    }

    // Sanity check task to ensure necessary variables are set.
    register("checkJetBrainsSecrets") {
        doLast {
            println("signPluginCertificateChain: ${if (signPluginCertificateChain.isNotEmpty()) "IS" else "is NOT"} set.")
            println("signPluginPrivateKey:       ${if (signPluginPrivateKey.isNotEmpty()) "IS" else "is NOT"} set.")
            println("signPluginPassword:         ${if (signPluginPassword.isNotEmpty()) "IS" else "is NOT"} set.")
            println("publishPluginToken:         ${if (publishPluginToken.isNotEmpty()) "IS" else "is NOT"} set.")
        }
    }
}

dependencies {
    testImplementation(group = "junit", name = "junit", version = "4.13.2")
    testImplementation("org.testng:testng:7.10.2")
    testImplementation("org.mockito:mockito-core:5.12.0")
}