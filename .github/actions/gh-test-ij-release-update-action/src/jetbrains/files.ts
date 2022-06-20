import * as core from '@actions/core'
import * as semver from 'semver'
import * as glob from '@actions/glob'
import * as properties from 'properties'
import {readFileSync} from 'fs'
import * as fs from 'fs'

function parseSemver(input: string | undefined): semver.SemVer {
  if (input === undefined) {
    core.setFailed(`Input to parse SemVer is undefined.`)
  }
  const parsed = semver.parse(input)
  if (parsed == null) {
    core.setFailed(`Failed to parse ${input} to Semantic Versioning`)
    return new semver.SemVer('0.0.0')
  }
  return parsed
}

function _inc_version(
  version: semver.SemVer,
  release: semver.ReleaseType
): semver.SemVer {
  const incrementedVersion: string | null = semver.inc(version, release)
  if (version === null) {
    core.setFailed(`Failed to increment ${release} version of ${version}`)
    return new semver.SemVer('0.0.0')
  }
  // TODO(ChrisCarini) - Ask Steve
  // @ts-ignore
  return new semver.SemVer(incrementedVersion)
}

function _next_plugin_version(
  plugin_version: semver.SemVer,
  current_platform_version: semver.SemVer,
  new_platform_version: semver.SemVer
): semver.SemVer {
  // # Platform: 2022.3.2 -> 2023.1.0
  // # Plugin  :    0.2.6 ->    1.0.0
  if (new_platform_version.major > current_platform_version.major) {
    return _inc_version(plugin_version, 'major')
  }

  // # Platform: 2022.1.1 -> 2023.2.0
  // # Plugin  :    0.2.6 ->    0.3.0
  if (new_platform_version.minor > current_platform_version.minor) {
    return _inc_version(plugin_version, 'minor')
  }

  // # Platform: 2022.3.2 -> 2023.3.3
  // # Plugin  :    0.2.6 ->    0.2.7
  if (new_platform_version.patch > current_platform_version.patch) {
    return _inc_version(plugin_version, 'patch')
  }

  return plugin_version
}

export async function updateGradleProperties(
  new_version: semver.SemVer
): Promise<semver.SemVer> {
  try {
    core.debug('Updating  [gradle.properties] file...')
    core.debug(new_version.version)

    const globber = await glob.create('./gradle.properties')
    const files = await globber.glob()
    core.debug(`Found ${files.length} files`)
    if (files.length !== 1) {
      core.setFailed('Too many .properties files found. Exiting.')
    }
    const gradle_file = files[0]

    interface JBGradlePropertiesFile {
      pluginVersion?: string
      pluginVerifierIdeVersions?: string
      platformVersion?: string
    }

    const obj: JBGradlePropertiesFile = properties.parse(
      readFileSync(gradle_file, 'utf-8'),
      {
        namespaces: true,
        sections: true,
        variables: true
      }
    )
    core.debug(`properties:`)
    // @ts-ignore
    core.debug(obj)
    const current_plugin_version = parseSemver(obj?.pluginVersion)
    const current_plugin_verifier_ide_versions = parseSemver(
      obj?.pluginVerifierIdeVersions
    )
    const current_platform_version = parseSemver(obj?.platformVersion)
    core.debug(
      `current_plugin_verifier_ide_versions: ${current_plugin_verifier_ide_versions}`
    )
    core.debug(
      `current_platform_version:             ${current_platform_version}`
    )
    core.debug(
      `current_plugin_version:               ${current_plugin_version}`
    )

    if (semver.eq(current_platform_version, new_version)) {
      core.info(
        `Skipping [gradle.properties] file, versions same (${current_platform_version} == ${new_version}).`
      )
      return current_platform_version
    }

    const next_plugin_version: semver.SemVer = _next_plugin_version(
      current_plugin_version,
      current_platform_version,
      new_version
    )
    core.debug('')
    core.debug(`next_plugin_version:                  ${next_plugin_version}`)

    fs.readFile(gradle_file, 'utf8', (err, data) => {
      if (err) {
        return core.setFailed(`Error reading ${gradle_file}: ${err}`)
      }
      core.debug('File contents:')
      core.debug(data)

      const result = data
        .replace(
          new RegExp(`^pluginVersion = ${current_plugin_version}$`, 'gm'),
          `pluginVersion = ${next_plugin_version}`
        )
        .replace(
          new RegExp(
            `^pluginVerifierIdeVersions = ${current_plugin_verifier_ide_versions}$`,
            'gm'
          ),
          `pluginVerifierIdeVersions = ${new_version}`
        )
        .replace(
          new RegExp(`^platformVersion = ${current_platform_version}$`, 'gm'),
          `platformVersion = ${new_version}`
        )

      core.debug('Updated file contents:')
      core.debug(result)

      fs.writeFile(gradle_file, result, 'utf8', function (err) {
        if (err) return core.setFailed(`Error writing ${gradle_file}: ${err}`)
      })
    })

    core.debug('Completed [gradle.properties] file.')

    return current_platform_version
      ? current_platform_version
      : new semver.SemVer('0.0.0')
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
    return new semver.SemVer('0.0.0')
  }
}

export async function updateChangelog(
  new_version: semver.SemVer
): Promise<void> {
  try {
    core.debug('Updating  [CHANGELOG.md] file...')
    core.debug(new_version.version)

    const upgrade_line = `- Upgrading IntelliJ to ${new_version}`

    const globber = await glob.create('./CHANGELOG.md')
    const files = await globber.glob()
    core.debug(`Found ${files.length} files`)
    if (files.length !== 1) {
      core.setFailed('Too many .properties files found. Exiting.')
    }
    const changelog_file = files[0]

    fs.readFile(changelog_file, 'utf8', (err, data) => {
      if (err) {
        return core.setFailed(`Error reading ${changelog_file}: ${err}`)
      }
      core.debug('File contents:')
      core.debug(data)

      if (new RegExp(`^${upgrade_line}$`, 'gm').test(data)) {
        core.info(
          `Skipping  [CHANGELOG.md] file, already found "${upgrade_line}" in file.`
        )
        return
      }

      const result = data.replace(
        // We do *NOT* want the `g` flag, as we only want to replace the first instance
        // (which should be in the `Unreleased` section) of this section.
        new RegExp(`^### Changed$`, 'm'),
        `### Changed\n${upgrade_line}`
      )

      core.debug('Updated file contents:')
      core.debug(result)

      fs.writeFile(changelog_file, result, 'utf8', function (err) {
        if (err)
          return core.setFailed(`Error writing ${changelog_file}: ${err}`)
      })
    })

    core.debug('Completed [CHANGELOG.md] file.')
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

function _fileContains(file: string, search: string): boolean {
  const fileData = fs.readFileSync(file, 'utf8')

  core.debug(`[${file}] File contents:`)
  core.debug(fileData)

  return new RegExp(`${search}`, 'gm').test(fileData)
}

export async function updateGithubWorkflow(
  current_platform_version: semver.SemVer,
  new_version: semver.SemVer
): Promise<void> {
  try {
    core.debug('Updating GitHub workflow files...')
    core.debug(`current_platform_version: ${current_platform_version.version}`)
    core.debug(`new_version:              ${new_version.version}`)

    const globber = await glob.create('./.github/workflows/*')
    const files = await globber.glob()
    core.debug(`Found ${files.length} files...`)

    const filesToUpdate = files.filter(file => {
      return _fileContains(
        file,
        'uses: ChrisCarini/intellij-platform-plugin-verifier-action'
      )
    })

    core.debug(
      `Found ${filesToUpdate.length} files containing [ChrisCarini/intellij-platform-plugin-verifier-action]...`
    )

    filesToUpdate.forEach(file => {
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
          return core.setFailed(`Error reading ${file}: ${err}`)
        }
        core.debug('File contents:')
        core.debug(data)

        const result = data
          .replace(
            new RegExp(`ideaIC:${current_platform_version}`, 'gm'),
            `ideaIC:${new_version}`
          )
          .replace(
            new RegExp(`ideaIU:${current_platform_version}`, 'gm'),
            `ideaIU:${new_version}`
          )

        core.debug('Updated file contents:')
        core.debug(result)

        fs.writeFile(file, result, 'utf8', function (err) {
          if (err) return core.setFailed(`Error writing ${file}: ${err}`)
        })
      })
      core.debug(`Completed [${file}] file.`)
    })

    core.debug(
      `Completed updating ${filesToUpdate.length} GitHub workflow files.`
    )
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}