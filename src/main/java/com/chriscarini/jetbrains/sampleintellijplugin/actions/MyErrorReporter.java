package com.chriscarini.jetbrains.sampleintellijplugin.actions;

import com.chriscarini.jetbrains.diagnostic.reporter.multi.submitter.GitHubAndJetBrainsMarketplaceSubmitter;

import static com.chriscarini.jetbrains.sampleintellijplugin.actions.Constants.*;

import static com.chriscarini.jetbrains.sampleintellijplugin.actions.Constants.*;


public class MyErrorReporter extends GitHubAndJetBrainsMarketplaceSubmitter {

  public MyErrorReporter() {
    super(PLUGIN_ID, GITHUB_REPO_URL_PROD, GITHUB_REPO_URL_STAG, GITHUB_ASSIGNEES, GITHUB_BUGS, "\uD83D\uDC1B " + "Report to ChrisCarini");
  }
}