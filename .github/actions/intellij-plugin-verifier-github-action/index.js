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
function release_type_for(version) {
  // # release_type_for "2019.3-EAP-SNAPSHOT" -> 'snapshots'
  // # release_type_for "2019.3-SNAPSHOT" -> 'nightly'
  // # release_type_for "2019.3" -> 'releases'
  if (version.endsWith('-EAP-SNAPSHOT') || version.endsWith('-EAP-CANDIDATE-SNAPSHOT') || version.endsWith('-CUSTOM-SNAPSHOT')) {
    return 'snapshots'
  } else if (version.endsWith('-SNAPSHOT')) {
    return 'nightly'
  } else {
    return 'releases'
  }
}

function download(downloadUrl, destinationPath) {
  core.debug(`Downloading [${downloadUrl}] into [${destinationPath}]...`);
  return childProcess.execFileSync('curl', ['-L', '--output', destinationPath, '--url', downloadUrl], {encoding: 'utf8'});
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
        let stdErr = standardError.trim();
        console.error(stdErr);
        reject(stdErr);
        return;
      }
      let stdOut = standardOutput.trim();
      console.log(stdOut);
      resolve(stdOut);
    });
  });
}

function failBanner() {
  core.setFailed("==============================================");
  core.setFailed("==============================================");
  core.setFailed("===                                        ===");
  core.setFailed("===    PLUGIN FAILED VERIFICATION CHECK    ===");
  core.setFailed("===                                        ===");
  core.setFailed("==============================================");
  core.setFailed("==============================================");
}

// most @actions toolkit packages have async methods
async function run() {
  try {
    ////
    // Input Variables
    ////

    // verifier-version: '1.231'
    const input_verifier_version = core.getInput('verifier-version') || 'LATEST';

    // plugin-location: 'build/distributions/sample-intellij-plugin-*'
    const input_plugin_location = core.getInput('plugin-location') || 'build/distributions/sample-intellij-plugin-*';

    // Found from: https://www.jetbrains.com/intellij-repository/releases/
    //
    //  ideaIU:2019.3.4    -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/idea/ideaIU/2019.3.4/ideaIU-2019.3.4.zip
    //  ideaIC:2019.3.4    -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/idea/ideaIC/2019.3.4/ideaIC-2019.3.4.zip
    //  pycharmPC:2019.3.4 -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/pycharm/pycharmPC/2019.3.4/pycharmPC-2019.3.4.zip
    //  goland:2019.3.3    -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/goland/goland/2019.3.3/goland-2019.3.3.zip
    //  clion:2019.3.4     -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/clion/clion/2019.3.4/clion-2019.3.4.zip
    //
    // ide-versions: ['ideaIU:2019.3.4','ideaIC:2019.3.4','pycharmPC:2019.3.4','goland:2019.3.3','clion:2019.3.4']
    // const input_ide_versions = core.getInput('ide-versions') || 'ideaIU:2019.3.4\nideaIC:2019.3.4';
    const input_ide_versions = (core.getInput('ide-versions') || 'ideaIU:2019.3.4').split("\n");

    core.startGroup("Input parameters");
    core.debug('verifier-version = ' + input_verifier_version);
    core.debug('plugin-location = ' + input_plugin_location);
    core.debug('ide-versions = ');
    for (const ide_version of input_ide_versions) {
      core.debug('    ' + ide_version);
    }
    core.endGroup(); // "Input parameters"

    ////
    // Other Variables
    ////

    // The filename for the output of the verifier to be saved to
    const VERIFICATION_OUTPUT_LOG = `${os.homedir()}/verification_result.log`

    // Resolve verifier values
    let VERIFIER_VERSION, VERIFIER_DOWNLOAD_URL, VERIFIER_JAR_FILENAME;
    if (input_verifier_version === "LATEST") {
      core.debug('LATEST verifier version found, resolving version...');
      await fetch("https://api.github.com/repos/JetBrains/intellij-plugin-verifier/releases/latest")
          .then((response) => {
            return response.json();
          })
          .then((data) => {
            VERIFIER_VERSION = data.tag_name.replace(/[^[:digit:.]]*/, '');
            VERIFIER_JAR_FILENAME = data.assets[0].name;
            VERIFIER_DOWNLOAD_URL = data.assets[0].browser_download_url;
          });
      core.debug('LATEST verifier version found, resolving version...done.');
    } else {
      core.debug('Using verifier version [$INPUT_VERIFIER_VERSION]...');
      VERIFIER_VERSION = input_verifier_version;
      // The filename of the `verifier-cli-*-all.jar` file
      VERIFIER_JAR_FILENAME = `verifier-cli-${input_verifier_version}-all.jar`;
      VERIFIER_DOWNLOAD_URL = `https://dl.bintray.com/jetbrains/intellij-plugin-service/org/jetbrains/intellij/plugins/verifier-cli/${input_verifier_version}/${VERIFIER_JAR_FILENAME}`;
    }

    // The full path of the `verifier-cli-*-all.jar` file
    const VERIFIER_JAR_LOCATION = `${os.homedir()}/${VERIFIER_JAR_FILENAME}`;

    // The value for JAVA_HOME does not need to manually be set, as it will already be set from the `actions/setup-java` action needed
    // by gradle to build the plugin.
    // JAVA_HOME = "/usr/lib/jvm/java-1.8-openjdk";

    // The location of the plugin
    const PLUGIN_LOCATION = `$GITHUB_WORKSPACE/${input_plugin_location}`;

    core.startGroup('VERIFIER variables');
    core.debug(`VERIFICATION_OUTPUT_LOG => ${VERIFICATION_OUTPUT_LOG}`);
    core.debug(`VERIFIER_VERSION ========> ${VERIFIER_VERSION}`);
    core.debug(`VERIFIER_DOWNLOAD_URL ===> ${VERIFIER_DOWNLOAD_URL}`);
    core.debug(`VERIFIER_JAR_FILENAME ===> ${VERIFIER_JAR_FILENAME}`);
    core.debug(`VERIFIER_JAR_LOCATION ===> ${VERIFIER_JAR_LOCATION}`);
    core.debug(`PLUGIN_LOCATION =========> ${PLUGIN_LOCATION}`);
    core.endGroup(); // 'VERIFIER variables'

    ////
    // Setup
    ////
    core.info(`Downloading plugin verifier [version '${input_verifier_version}'] from [${VERIFIER_DOWNLOAD_URL}] to [${VERIFIER_JAR_LOCATION}]...`);

    download(VERIFIER_DOWNLOAD_URL, VERIFIER_JAR_LOCATION);

    // Variable to store the string of IDE tmp_ide_directories we're going to use for verification.
    const ide_directories = [];

    core.info("Processing all IDE versions...");
    for (const ide_version of input_ide_versions) {
      core.startGroup(`Processing ${ide_version} ...`);

      let ide = ide_version.split(":")[0];              // `ideaIU:2020.1.1` -> `ideaIU`
      let version = ide_version.split(":")[1];          // `ideaIU:2020.1.1` -> `2020.1.1`
      let ide_dir = ide.match(new RegExp("^[a-z]+"))[0]; // `ideaIU` -> `idea`
      let release_type = release_type_for(version);
      let ide_download_url = `https://www.jetbrains.com/intellij-repository/${release_type}/com/jetbrains/intellij/${ide_dir}/${ide}/${version}/${ide}-${version}.zip`
      let ide_zip_file_path = `${os.homedir()}/${ide}-${version}.zip`;
      let ide_extract_location = `${os.homedir()}/ides/${ide}-${version}`;

      core.debug(`ide                  : ${ide}`);
      core.debug(`version              : ${version}`);
      core.debug(`ide_dir              : ${ide_dir}`);
      core.debug(`release_type         : ${release_type}`);
      core.debug(`ide_download_url     : ${ide_download_url}`);
      core.debug(`ide_zip_file_path    : ${ide_zip_file_path}`);
      core.debug(`ide_extract_location : ${ide_extract_location}`);

      download(ide_download_url, ide_zip_file_path);

      core.info(`Extracting [${ide_zip_file_path}] into [${ide_extract_location}]...`);
      if (!fs.existsSync(ide_extract_location)) {
        core.debug(`Directory [${ide_extract_location}] does not exist, recursivly creating...`);
        fs.mkdirSync(ide_extract_location, {recursive: true});
      }

      core.info(`Extracting [${ide_zip_file_path}] into [${ide_extract_location}]...`);
      try {
        await extract(ide_zip_file_path, {dir: ide_extract_location})
        core.debug(`Extraction of [${ide_zip_file_path}] into [${ide_extract_location}] complete.`);
      } catch (err) {
        core.setFailed(`Error extracting ${ide_zip_file_path}: ` + err.message);
      }

      core.info(`Removing [${ide_zip_file_path}] to save storage space...`);
      fs.unlink(ide_zip_file_path, (err) => {
        if (err) {
          core.setFailed(err)
        }
        core.debug(`Removed [${ide_zip_file_path}] successfully.`);
      });

      core.debug(`Adding ${ide_extract_location} to '${ide_directories}'...`);
      ide_directories.push(ide_extract_location);

      core.endGroup(); // `Processing ${ide_version} ...`
    }

    ////
    // Print ENVVARs for debugging.
    ////
    core.startGroup("Debug output - env vars and path contents.");
    core.debug("==========================================================");
    core.debug(`IDE_DIRECTORIES => [${ide_directories}]`);
    core.debug("==========================================================");
    core.debug(`which java: ${await execute("which java")}`)
    core.debug(`JAVA_HOME: ${process.env.JAVA_HOME}`)
    core.debug("==========================================================");
    core.debug(`Contents of $HOME => [${process.env.HOME}] :`);
    for (const line of (await execute("ls -lash $HOME")).split("\n")) {
      core.debug(line);
    }
    core.debug("==========================================================");
    core.debug(`Contents of $HOME/ides => [${process.env.HOME}/ides] :`);
    for (const line of (await execute("ls -lash $HOME/ides")).split("\n")) {
      core.debug(line);
    }
    core.debug("==========================================================");
    core.debug(`Contents of $GITHUB_WORKSPACE => [${process.env.GITHUB_WORKSPACE}] :`);
    for (const line of (await execute("ls -lash $GITHUB_WORKSPACE")).split("\n")) {
      core.debug(line);
    }
    core.debug("==========================================================");
    core.debug(`Contents of $PLUGIN_LOCATION => [${PLUGIN_LOCATION}] :`);
    for (const line of (await execute(`ls -lash ${PLUGIN_LOCATION}`)).split("\n")) {
      core.debug(line);
    }
    core.debug("==========================================================");
    core.debug(`Contents of the current directory => [${process.cwd()}] :`);
    for (const line of (await execute(`ls -lash ${process.cwd()}`)).split("\n")) {
      core.debug(line);
    }
    core.debug("==========================================================");
    core.endGroup(); // "Debug output - env vars and path contents."

    ////
    // Run the verification
    ////
    core.info(`Running verification on ${PLUGIN_LOCATION} for ${ide_directories}...`);

    let commandToRun = [
      'java -jar', VERIFIER_JAR_LOCATION, "check-plugin", PLUGIN_LOCATION, ide_directories.join(" "), `| tee ${VERIFICATION_OUTPUT_LOG}`,
    ].join(" ");
    core.debug(`RUNNING COMMAND: ${commandToRun}`);
    await execute(commandToRun);

    // Set the output log filename, in case a subsequent action wants to make use of it.
    core.setOutput('verification-output-log-filename', VERIFICATION_OUTPUT_LOG);

    core.info("=================== FILE OUTPUT ===================")
    await execute(`cat ${VERIFICATION_OUTPUT_LOG}`);
    core.info("================= END FILE OUTPUT =================")

    // Validate the log; fail if we find compatibility problems.
    fs.readFile(VERIFICATION_OUTPUT_LOG, 'utf8', function (err, data) {
      if (err) {
        throw err;
      }
      const pluginCompatibilityProblems = new RegExp("^Plugin (.*) against .*: .* compatibility problems?$");
      // const invalidPluginFiles = new RegExp("^The following files specified for the verification are not valid plugins:$");
      for (const line of data.split('\n')) {
        if (line.match(pluginCompatibilityProblems)) {
          // if (line.match(pluginCompatibilityProblems) || line.match(invalidPluginFiles)) {
          failBanner();
          return;
        }
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