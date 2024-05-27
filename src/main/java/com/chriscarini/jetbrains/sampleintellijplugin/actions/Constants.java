package com.chriscarini.jetbrains.sampleintellijplugin.actions;

import java.util.List;
import org.jetbrains.annotations.NonNls;
import org.jetbrains.annotations.NotNull;


public interface Constants {

  @NonNls
  @NotNull
  String PLUGIN_ID = "com.chriscarini.jetbrains.sample-intellij-plugin";

  @NonNls
  @NotNull
  String GITHUB_REPO_URL_PROD = "https://github.com/ChrisCarini/sample-intellij-plugin";
  @NonNls
  @NotNull
  String GITHUB_REPO_URL_STAG = "https://github.com/CariniBot/IJ_ISSUE_TEST";
  @NonNls
  @NotNull
  List<String> GITHUB_ASSIGNEES = List.of("ChrisCarini");
  @NonNls
  @NotNull
  List<String> GITHUB_BUGS = List.of("bug");
}