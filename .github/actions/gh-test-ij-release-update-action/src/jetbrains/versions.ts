import * as core from '@actions/core';
import * as httpClient from '@actions/http-client';
import * as semver from 'semver';

// noinspection JSUnusedLocalSymbols
interface IdeType {
  name: string;
  code: string;
  releases: object;
}

export async function getLatestIntellijRelease(): Promise<semver.SemVer> {
  try {
    // get the latest intellij release
    const client = new httpClient.HttpClient();
    const response: httpClient.HttpClientResponse = await client.get(
      'https://data.services.jetbrains.com/products?code=IIU&release.type=release'
    );
    const body: string = await response.readBody();
    const ides = JSON.parse(body);

    const versions: semver.SemVer[] = [];
    for (const ide of ides) {
      core.debug(`IDE Name: ${ide.name}`);
      core.debug(`IDE Code: ${ide.code}`);
      for (const release of ide.releases) {
        const semVersion: semver.SemVer | null = semver.parse(release.version);
        if (semVersion) {
          versions.push(semVersion);
          // core.debug(`Version: ${semVersion}`)
        }
      }
    }
    core.debug(`IDE Versions: ${versions.join(', ')}`);

    // Compute the greatest Semantic Version in the array
    const maxVersion: semver.SemVer = versions.reduce((previousValue, currentValue) => {
      if (semver.gt(previousValue, currentValue)) {
        return previousValue;
      }
      return currentValue;
    });
    core.debug(`Max IDE Versions: ${maxVersion}`);
    return maxVersion;
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
    return new semver.SemVer('0.0.0');
  }
}
