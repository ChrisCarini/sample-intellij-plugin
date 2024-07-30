import org.gradle.plugins.ide.idea.model.IdeaLanguageLevel
import org.jetbrains.changelog.Changelog
import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.models.ProductRelease
import org.jetbrains.intellij.platform.gradle.tasks.VerifyPluginTask
import java.util.EnumSet

fun properties(key: String): Provider<String> = providers.gradleProperty(key)
fun environment(key: String): Provider<String> = providers.environmentVariable(key)
fun extra(key: String): String = project.ext.get(key) as String

plugins {
    id("java")
    id("idea")
    id("org.jetbrains.intellij.platform") version "2.0.0-rc1"
    id("org.jetbrains.intellij.platform.migration") version "2.0.0-rc2"
    id("org.jetbrains.changelog") version "2.2.0"
    id("com.dorongold.task-tree") version "3.0.0" // provides `taskTree` task (e.g. `./gradlew build taskTree`; docs: https://github.com/dorongold/gradle-task-tree)
}

group = properties("pluginGroup").get()
version = properties("pluginVersion").get()

repositories {
    mavenCentral()

    // https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-repositories-extension.html
    intellijPlatform {
        defaultRepositories()
        // `jetbrainsRuntime()` is necessary mostly for EAP/SNAPSHOT releases of IJ so that the IDE pulls the correct JBR
        //      - https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-jetbrains-runtime.html#obtained-with-intellij-platform-from-maven
        jetbrainsRuntime()
    }
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

val isNotCI = System.getenv("CI") != "true"
if (isNotCI) {
    // The below file (jetbrainsCredentials.gradle) should contain the below:
    //     project.ext.set("intellijSignPluginCertificateChain", new File("./chain.crt").getText("UTF-8"))
    //     project.ext.set("intellijSignPluginPrivateKey", new File("./private.pem").getText("UTF-8"))
    //     project.ext.set("intellijSignPluginPassword", "YOUR_PRIV_KEY_PASSWORD_HERE")
    //     project.ext.set("intellijPluginPublishToken", "YOUR_TOKEN_HERE")
    //
    // Because this contains credentials, this file is also included in .gitignore file.
    apply(from = "jetbrainsCredentials.gradle")
}
fun resolve(extraKey: String, environmentKey: String): String = if (isNotCI) extra(extraKey) else environment(environmentKey).get()
val signPluginCertificateChain = resolve("intellijSignPluginCertificateChain", "CERTIFICATE_CHAIN")
val signPluginPrivateKey = resolve("intellijSignPluginPrivateKey", "PRIVATE_KEY")
val signPluginPassword = resolve("intellijSignPluginPassword", "PRIVATE_KEY_PASSWORD")
val publishPluginToken = resolve("intellijPluginPublishToken", "PUBLISH_TOKEN")

// https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-extension.html
intellijPlatform {
    pluginConfiguration {
        name = properties("pluginName").get()
        version = properties("pluginVersion").get()

        // Extract the <!-- Plugin description --> section from README.md and provide for the plugin's manifest
        description = providers.fileContents(layout.projectDirectory.file("README.md")).asText.map {
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

        ideaVersion {
            sinceBuild = properties("pluginSinceBuild")
            untilBuild = properties("pluginUntilBuild")
        }

        // Vendor information -> https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-extension.html#intellijPlatform-pluginConfiguration-vendor
        vendor {
            name = "Chris Carini"
            email = "jetbrains@chriscarini.com"
            url = "https://jetbrains.chriscarini.com"
        }
    }

    publishing {
        token = publishPluginToken

        // pluginVersion is based on the SemVer (https://semver.org) and supports pre-release labels, like 2.1.7-alpha.3
        // Specify pre-release label to publish the plugin in a custom Release Channel automatically. Read more:
        // https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html#specifying-a-release-channel
        channels = properties("pluginVersion")
            .map {
                listOf(
                    it
                        .substringAfter('-', "")
                        .substringBefore('.')
                        .lowercase()
                        .ifEmpty { "default" }
                )
            }
    }

    signing {
        certificateChain = signPluginCertificateChain
        privateKey = signPluginPrivateKey
        password = signPluginPassword
    }

//    TODO(ChrisCarini) - Change `verifyPlugin` to `pluginVerification` when the IJ gradle plugin 2.0 is released.
//     See below for details:
//          - https://jetbrains-platform.slack.com/archives/C05C80200LS/p1722273893215199
//    pluginVerification {
    verifyPlugin {
        freeArgs = listOf("-mute", "ForbiddenPluginIdPrefix,TemplateWordInPluginId,TemplateWordInPluginName")
        val failureLevels = getFailureLevels()
        logger.debug("Using ${failureLevels.size} Failure Levels: $failureLevels")
        failureLevel.set(failureLevels)
        ides {
            val version = properties("platformVersion").get()
            val type = properties("platformType").get()
            logger.lifecycle("Verifying against IntelliJ Platform $type $version")
            ide(IntelliJPlatformType.fromCode(type), version)

            recommended()
        }
    }
}

// Configure CHANGELOG.md - https://github.com/JetBrains/gradle-changelog-plugin
changelog {
    repositoryUrl = properties("pluginRepositoryUrl")
}

fun getFailureLevels(): EnumSet<VerifyPluginTask.FailureLevel> {
    val includeFailureLevels = EnumSet.allOf(VerifyPluginTask.FailureLevel::class.java)
    val desiredFailureLevels = properties("pluginVerifierExcludeFailureLevels").get()
        .split(",")
        .map(String::trim)
        .filter(String::isNotEmpty) // Remove empty strings; this happens when user sets nothing (ie, `pluginVerifierExcludeFailureLevels =`)

    desiredFailureLevels.forEach { failureLevel ->
        when (failureLevel) {
            "ALL" -> return EnumSet.allOf(VerifyPluginTask.FailureLevel::class.java)
            "NONE" -> return EnumSet.noneOf(VerifyPluginTask.FailureLevel::class.java)
            else -> {
                try {
                    val enumFailureLevel = VerifyPluginTask.FailureLevel.valueOf(failureLevel)
                    includeFailureLevels.remove(enumFailureLevel)
                } catch (ignored: Exception) {
                    val msg = "Failure Level \"$failureLevel\" is *NOT* valid. Please select from: ${EnumSet.allOf(VerifyPluginTask.FailureLevel::class.java)}."
                    logger.error(msg)
                    throw Exception(msg)
                }
            }
        }
    }

    return includeFailureLevels
}

tasks {
    printProductsReleases {
//        // In addition to `IC` (from `platformType`), we also want to verify against `IU`.
//        types.set(Arrays.asList(properties("platformType"), "IU"))
        // Contrary to above, we want to speed up CI, so skip verification of `IU`.
        val type = properties("platformType").get()
        types = listOf(IntelliJPlatformType.fromCode(type))

        // Only get the released versions if we are not targeting an EAP.
        val isEAP = properties("pluginVersion").get().uppercase().endsWith("-EAP")
        channels = listOf(if (isEAP) ProductRelease.Channel.EAP else ProductRelease.Channel.RELEASE)

        // Verify against the most recent patch release of the `platformVersion` version
        // (ie, if `platformVersion` = 2022.2, and the latest patch release is `2022.2.2`,
        // then the `sinceVersion` will be set to `2022.2.2` and *NOT* `2022.2`.
        sinceBuild.set(properties("platformVersion"))
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

    // In "IntelliJ Platform Gradle Plugin 2.*", the `listProductsReleases` task no longer exists, but
    // instead the `printProductReleases` task does. This task is necessary to take the output of
    // `printProductReleases` and write it to a file for use in the `generateIdeVersionsList` task below.
    val listProductReleasesTaskName = "listProductsReleases"
    register(listProductReleasesTaskName) {
        dependsOn(printProductsReleases)
        val outputF = layout.buildDirectory.file("listProductsReleases.txt").also {
            outputs.file(it)
        }
        val content = printProductsReleases.flatMap { it.productsReleases }.map { it.joinToString("\n") }

        doLast {
            outputF.orNull?.asFile?.writeText(content.get())
        }
    }

    // Task to generate the necessary format for `ChrisCarini/intellij-platform-plugin-verifier-action` GitHub Action.
    register("generateIdeVersionsList") {
        dependsOn(project.tasks.named(listProductReleasesTaskName))
        doLast {
            val ideVersionsList = mutableListOf<String>()

            // Include the versions produced from the `listProductsReleases` task.
            project.tasks.named(listProductReleasesTaskName).get().outputs.files.singleFile.forEachLine { line ->
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
}

dependencies {
    // https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-dependencies-extension.html
    intellijPlatform {
        val version = properties("platformVersion").get()
        val type = properties("platformType").get()
        val useInstaller = !version.endsWith("-SNAPSHOT")
        create(type=IntelliJPlatformType.fromCode(type), version=version, useInstaller=useInstaller)

        // Plugin Dependencies. Uses `platformPlugins` property from the gradle.properties file.
        plugins(providers.gradleProperty("platformPlugins").map { it.split(',') })
        // Bundled plugin Dependencies. Uses `platformBundledPlugins` property from the gradle.properties file.
        bundledPlugins(providers.gradleProperty("platformBundledPlugins").map { it.split(',') })

        instrumentationTools()

        // `jetbrainsRuntime()` is necessary mostly for EAP/SNAPSHOT releases of IJ so that the IDE pulls the correct JBR
        //      - https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-jetbrains-runtime.html#obtained-with-intellij-platform-from-maven
        jetbrainsRuntime()
        pluginVerifier()
        zipSigner()
    }

    testImplementation(group = "junit", name = "junit", version = "4.13.2")
    testImplementation("org.testng:testng:7.10.2")
    testImplementation("org.mockito:mockito-core:5.12.0")
}