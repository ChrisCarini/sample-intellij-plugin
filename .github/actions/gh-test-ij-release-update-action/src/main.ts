import * as core from '@actions/core'
import {exec} from '@actions/exec'
import * as github from '@actions/github'
import {GitHub, getOctokitOptions} from '@actions/github/lib/utils'
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
  core.debug('BEFORE: simpleGit().status()')
  const statusResult: StatusResult = await simpleGit().status()
  core.debug('AFTER: simpleGit().status()')

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

    core.debug('BEFORE: check file change count')
    // check if there are files that are changed
    const filesChanged: number = await checkFileChangeCount()
    core.debug('AFTER: check file change count')

    // If there are *NO* files that have changed, exit; we are done.
    if (filesChanged == 0) {
      core.info('No files have changed, must be on latest version!')
      return
    }

    // Commit the outstanding files
    core.debug('ABOUT TO COMMIT')
    const newBranchName = `ChrisCarini/upgradeIntelliJ-${latestVersion}`

    // const githubToken = core.getInput('MY_GITHUB_TOKEN')
    // core.setSecret(githubToken)

    // const githubUrl = github.context.serverUrl.split('//', 1)[1].trim()
    const [githubUrlProtocol, githubUrl] = github.context.serverUrl.split('//')
    const {owner, repo} = github.context.repo
    // const remoteRepo = `"https://${githubToken}@github.com/${owner}/${repo}.git"`
    // core.debug(`ORIGIN STR: ${remoteRepo}`)
    // core.debug(`SHOULD BE RUNNING: [git push ${remoteRepo} ${newBranchName}]`)
    await simpleGit()
      .exec(() => core.debug(`Starting [git checkout ${newBranchName}]...`))
      .checkoutLocalBranch(newBranchName)
      .exec(() => core.debug(`Starting [git config] configurations...`))
      .addConfig('http.sslVerify', 'false')
      .addConfig('user.name', 'ChrisCarini')
      .addConfig('user.email', '6374067+chriscarini@users.noreply.github.com')
      // .addConfig(
      //   'credential.https://github.com/.helper',
      //   '! f() { echo username=x-access-token; echo password=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; };f'
      // )
      .exec(() =>
        core.debug(
          `Starting [git commit -m "Upgrading IntelliJ to ${latestVersion}"]...`
        )
      )
      .commit(`Upgrading IntelliJ to ${latestVersion}`)
      .exec(() =>
        core.debug(
          `Finished [git commit -m "Upgrading IntelliJ to ${latestVersion}"]...`
        )
      )
    // , async (err, data) => {
    //   core.debug(data.commit)
    //
    //   const octokit = github.getOctokit(githubToken)
    //
    //   await octokit.rest.git.createCommit({
    //     owner: github.context.repo.owner,
    //     repo: github.context.repo.repo,
    //     message: `Upgrading IntelliJ to ${latestVersion}`,
    //     tree: data.commit,
    //     parents: ['master']
    //   })
    // })
    // .push([remoteRepo, `${newBranchName}`], (err, data) => {
    //   if (err) {
    //     console.debug(err.message)
    //     return
    //   }
    //
    //   data?.remoteMessages.all.forEach(value => {
    //     core.debug(value)
    //   })
    // })

    // TODO(ChrisCarini) - WHAT THE ACTUAL F. This does *NOT* work from code;
    //  but the printed command runs totally fine w/in the docker container. F.
    //  Perhaps all my other attempts would work too - perhaps try pushing this
    //  action and depending upon it like a normal action and using it outside of
    //  the `act` CLI.........FFFFFFFFFFFFFAK
    core.debug(
      `SHOULD BE RUNNING: [git push --set-upstream origin ${newBranchName}]`
    )
    await exec(`git push --set-upstream origin ${newBranchName}`)

    core.debug('COMMITTED!!!')

    // const octokit = github.getOctokit(githubToken)
    //
    // await octokit.rest.git.createCommit({
    //   owner: github.context.repo.owner,
    //   repo: github.context.repo.repo,
    //   message: `Upgrading IntelliJ to ${latestVersion}`,
    //   tree: newBranchName,
    //   parents: ['master']
    // })
    //
    // await octokit.rest.pulls.create({
    //   owner: github.context.repo.owner,
    //   repo: github.context.repo.repo,
    //   title: `Upgrading IntelliJ to ${latestVersion}`,
    //   body: `Please pull these awesome changes in! We are upgrading IntelliJ to ${latestVersion}`,
    //   head: newBranchName,
    //   base: 'master'
    // })
    //
    // // // wait a few seconds to wrap things up, I was seeing the above call not print anything
    // // await wait(10)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
  .then(() => {})
  .catch(err => {
    core.setFailed(err.message)
    core.debug(err)
  })
