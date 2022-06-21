import * as core from '@actions/core'
import {
  updateChangelog,
  updateGithubWorkflow,
  updateGradleProperties
} from './jetbrains/files'
import {getLatestIntellijRelease} from './jetbrains/versions'
import * as semver from 'semver'
import {wait} from './wait'
import simpleGit, {StatusResult} from 'simple-git'

async function checkFileChangeCount(): Promise<number> {
  const statusResult: StatusResult = await simpleGit().status()

  core.debug(`Files created:  ${statusResult.created.length}`)
  core.debug(`Files modified: ${statusResult.modified.length}`)
  core.debug(`Files deleted:  ${statusResult.deleted.length}`)

  statusResult.created.forEach(value => {
    core.debug(`C --> ${value}`)
  })
  statusResult.modified.forEach(value => {
    core.debug(`M --> ${value}`)
  })
  statusResult.deleted.forEach(value => {
    core.debug(`D --> ${value}`)
  })
  return statusResult.modified.length
}

async function run(): Promise<void> {
  try {
    // const ms: string = core.getInput('milliseconds')
    // core.debug(`Waiting ${ms} milliseconds ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    // core.debug(`Waiting ${parseInt(ms) / 1000} seconds ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    //
    // core.debug(new Date().toTimeString())
    // await wait(parseInt(ms, 10))
    // core.debug(new Date().toTimeString())
    //
    // core.setOutput('time', new Date().toTimeString())

    // get the latest intellij release
    const latestVersion: semver.SemVer = await getLatestIntellijRelease()
    core.debug(`Latest IntelliJ Version: ${latestVersion}`)

    // update gradle.properties file
    const currentPlatformVersion = await updateGradleProperties(latestVersion)
    core.debug(`Current Platform Version: ${currentPlatformVersion}`)

    // update CHANGELOG.md
    await updateChangelog(latestVersion)

    // update github workflows
    await updateGithubWorkflow(currentPlatformVersion, latestVersion)

    // check if there are files that are changed
    const filesChanged: number = await checkFileChangeCount()

    // If there are *NO* files that have changed, exit; we are done.
    if (filesChanged == 0) {
      core.info('No files have changed, must be on latest version!')
      return
    }

    // // Commit the outstanding files
    // git.commit(`Upgrading IntelliJ to ${latestVersion}`)

    // wait a few seconds to wrap things up, I was seeing the above call not print anything
    await wait(10)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
