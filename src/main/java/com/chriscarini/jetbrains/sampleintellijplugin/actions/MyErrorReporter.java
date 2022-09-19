package com.chriscarini.jetbrains.sampleintellijplugin.actions;

import com.chriscarini.jetbrains.diagnostic.reporter.GitHubErrorReportSubmitter;
import org.jetbrains.annotations.NotNull;

public class MyErrorReporter extends GitHubErrorReportSubmitter {

    @Override
    public @NotNull String gitHubRepoUrl() {
        return "https://github.com/chriscarini/sample-intellij-plugin";
    }
}