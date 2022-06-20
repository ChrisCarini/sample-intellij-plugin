import * as core from '@actions/core'
import {
  updateChangelog,
  updateGithubWorkflow,
  updateGradleProperties
} from './jetbrains/files'
import {getLatestIntellijRelease} from './jetbrains/versions'
import * as semver from 'semver'
import {wait} from './wait'

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



    // // TODO(ChrisCarini) - REMOVE; FOR TESTING TO SEE IF FILES CHANGED IN DOCKER
    // await wait(3 * 60 * 1000)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
