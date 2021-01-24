const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const os = require('os');
const fetch = require('node-fetch');
const extract = require('extract-zip');
const childProcess = require('child_process');

////
//  Functions
////
function failBanner() {
  core.setFailed("==============================================");
  core.setFailed("==============================================");
  core.setFailed("===                                        ===");
  core.setFailed("===    PLUGIN FAILED VERIFICATION CHECK    ===");
  core.setFailed("===                                        ===");
  core.setFailed("==============================================");
  core.setFailed("==============================================");
}

function execute(command) {
  /**
   * @param {Function} resolve A function that resolves the promise
   * @param {Function} reject A function that fails the promise
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
   */
  return new Promise(function (resolve, reject) {
    /**
     * @param {Error} error An error triggered during the execution of the childProcess.exec command
     * @param {string|Buffer} standardOutput The result of the shell command execution
     * @param {string|Buffer} standardError The error resulting of the shell command execution
     * @see https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
     */
    childProcess.exec(command, {encoding: 'utf8'}, function (error, standardOutput, standardError) {
      if (error) {
        reject();
        return;
      }
      if (standardError) {
        reject(standardError.trim());
        console.error()
        return;
      }
      let output = standardOutput.trim();
      console.warn('warn: ', output);
      resolve(output);
    });
  });
}

async function run() {
  try {
    ////
    // Run the verification
    ////
    VERIFICATION_OUTPUT_LOG = "/Users/ccarini/GitHub/sample-intellij-plugin/.github/actions/intellij-plugin-verifier-github-action/ttt.out"

    // let commandToRun = `echo "FOOBAR" | tee ${VERIFICATION_OUTPUT_LOG}`;
    // core.debug(`RUNNING COMMAND: ${commandToRun}`);
    // await execute(commandToRun);

    core.info("=================== FILE OUTPUT ===================")
    await execute(`cat ${VERIFICATION_OUTPUT_LOG}`);
    core.info("================= END FILE OUTPUT =================")

    // Validate the log; fail if we find compatibility problems.
    fs.readFile(VERIFICATION_OUTPUT_LOG, 'utf8', function (err, data) {
      if (err) {
        throw err;
      }
      for (const line of data.split('\n')) {
        console.log("===================================================================")
        console.log(line);
        if (line.match(new RegExp("^Plugin (.*) against .*: .* compatibility problems?$"))) {
          failBanner();
        }
        // if ((data.match(/^Plugin \(.*\) against .*: .* compatibility problems\?$/)) || (data.match(
        //     /^The following files specified for the verification are not valid plugins:$/))) {
        //   failBanner(data);
        // }
      }
    });

    // Everything verified ok.
    //   exit 0
  } catch (error) {
    core.warning("WARNING! Blanket catch exception hit! Please open a bug report for the development team!");
    core.setFailed(error.message);
  }
}

run()