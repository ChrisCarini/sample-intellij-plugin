const core = require('@actions/core');
const github = require('@actions/github');
const http = require('http');
const https = require('https');
const fs = require('fs');
const fetch = require('node-fetch');

////
//  Functions
////
function release_type_for(version) {
  // # release_type_for "2019.3-EAP-SNAPSHOT" -> 'snapshots'
  // # release_type_for "2019.3-SNAPSHOT" -> 'nightly'
  // # release_type_for "2019.3" -> 'releases'
  if (version.endsWith('-EAP-SNAPSHOT') || version.endsWith('-EAP-CANDIDATE-SNAPSHOT') || version.endsWith(
      '-CUSTOM-SNAPSHOT')) {
    return 'snapshots'
  } else if (version.endsWith('-SNAPSHOT')) {
    return 'nightly'
  } else {
    return 'releases'
  }
}

// most @actions toolkit packages have async methods
async function run() {
  try {
    // ##
    // # Input Variables
    // ##

    // verifier-version: '1.231'
    const input_verifier_version = core.getInput('verifier-version');

    // plugin-location: 'build/distributions/sample-intellij-plugin-*'
    const input_plugin_location = core.getInput('plugin-location');

    // # Found from: https://www.jetbrains.com/intellij-repository/releases/
    //
    //  ideaIU:2019.3.4    -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/idea/ideaIU/2019.3.4/ideaIU-2019.3.4.zip
    //  ideaIC:2019.3.4    -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/idea/ideaIC/2019.3.4/ideaIC-2019.3.4.zip
    //  pycharmPC:2019.3.4 -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/pycharm/pycharmPC/2019.3.4/pycharmPC-2019.3.4.zip
    //  goland:2019.3.3    -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/goland/goland/2019.3.3/goland-2019.3.3.zip
    //  clion:2019.3.4     -> https://www.jetbrains.com/intellij-repository/releases/com/jetbrains/intellij/clion/clion/2019.3.4/clion-2019.3.4.zip
    //
    // ide-versions: ['ideaIU:2019.3.4','ideaIC:2019.3.4','pycharmPC:2019.3.4','goland:2019.3.3','clion:2019.3.4']
    const input_ide_versions = core.getInput('ide-versions');

    core.debug('verifier-version = ' + input_verifier_version);
    core.debug('plugin-location = ' + input_plugin_location);
    core.debug('ide-versions = ' + input_ide_versions);
    core.debug('typeof ide-versions = ' + typeof input_ide_versions);

    // ##
    // # Resolve verifier values
    // ##
    let VERIFIER_VERSION, VERIFIER_DOWNLOAD_URL, VERIFIER_JAR_FILENAME;
    if (input_verifier_version === "LATEST") {
      core.debug('LATEST verifier version found, resolving version...');
      fetch("https://api.github.com/repos/JetBrains/intellij-plugin-verifier/releases/latest").then((response) => {
        core.debug('response:');
        core.debug(response);
        return response.json();
      }).then((data) => {
        core.debug('data:');
        core.debug(data);
        VERIFIER_VERSION = data.tag_name.replace(/[^[:digit:.]]*/, '');
        VERIFIER_DOWNLOAD_URL = data.assets[0].browser_download_url;
        VERIFIER_JAR_FILENAME = data.assets[0].name;
      });
    } else {
      core.debug('Using verifier version [$INPUT_VERIFIER_VERSION]...');
      VERIFIER_VERSION = input_verifier_version;
      VERIFIER_DOWNLOAD_URL = `https://dl.bintray.com/jetbrains/intellij-plugin-service/org/jetbrains/intellij/plugins/verifier-cli/${input_verifier_version}/${v_jar_filename}`;
      // The filename of the `verifier-cli-*-all.jar` file
      VERIFIER_JAR_FILENAME = `verifier-cli-${input_verifier_version}-all.jar`;
    }

    // The full path of the `verifier-cli-*-all.jar` file
    const VERIFIER_JAR_LOCATION = `$HOME/${VERIFIER_JAR_FILENAME}`;

    core.debug(`VERIFIER_VERSION => ${VERIFIER_VERSION}`);
    core.debug(`VERIFIER_DOWNLOAD_URL => ${VERIFIER_DOWNLOAD_URL}`);
    core.debug(`VERIFIER_JAR_FILENAME => ${VERIFIER_JAR_FILENAME}`);
    core.debug(`VERIFIER_JAR_LOCATION => ${VERIFIER_JAR_LOCATION}`);

    // ##
    // # Other Variables
    // ##

    // // Set the correct JAVA_HOME path for the container because this is overwritten by the setup-java action.
    // // We use the docker image `openjdk:8-jdk-alpine` - https://hub.docker.com/layers/openjdk/library/openjdk/8-jdk-alpine/images/sha256-210ecd2595991799526a62a7099718b149e3bbefdb49764cc2a450048e0dd4c0?context=explore
    // //  and pull the `JAVA_HOME` property from it's image (ie, its definition has `ENV JAVA_HOME=/usr/lib/jvm/java-1.8-openjdk`).
    // JAVA_HOME = "/usr/lib/jvm/java-1.8-openjdk";

    // The location of the plugin
    PLUGIN_LOCATION = `$GITHUB_WORKSPACE/${input_plugin_location}`;

    core.debug(`PLUGIN_LOCATION => ${PLUGIN_LOCATION}`);

    // Variable to store the string of IDE tmp_ide_directories we're going to use for verification.
    IDE_DIRECTORIES = "";

    // ##
    // # Setup
    // ##
    console.info(
        `Downloading plugin verifier [version '${input_verifier_version}'] from [${VERIFIER_DOWNLOAD_URL}] to [${VERIFIER_JAR_LOCATION}]...`);

    const file = fs.createWriteStream(`${VERIFIER_JAR_LOCATION}`);
    const request = https.get(`${VERIFIER_DOWNLOAD_URL}`, function (response) {
      response.pipe(file);
    });

    core.info(`Hello ${nameToGreet}!`);
    const time = (new Date()).toTimeString();
    core.setOutput("time", time);
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2);
    core.info(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run()