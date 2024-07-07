package com.chriscarini.jetbrains.sampleintellijplugin.actions;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Properties;
import org.jetbrains.annotations.NonNls;
import org.jetbrains.annotations.NotNull;


public interface Constants {

  @NonNls
  @NotNull
  String PLUGIN_ID = "com.chriscarini.jetbrains.sample-intellij-plugin";

  @NonNls
  @NotNull
  String GITHUB_REPO_URL_PROD = getGradleProperty("pluginRepositoryUrl");
  @NonNls
  @NotNull
  String GITHUB_REPO_URL_STAG = "https://github.com/CariniBot/IJ_ISSUE_TEST";
  @NonNls
  @NotNull
  List<String> GITHUB_ASSIGNEES = List.of("ChrisCarini");
  @NonNls
  @NotNull
  List<String> GITHUB_BUGS = List.of("bug");

  static String getGradleProperty(final String key) {
    InputStream in = Constants.class.getClassLoader().getResourceAsStream("gradle.properties");
    final Properties props = new Properties();
    try {
      props.load(in);
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    return String.valueOf(props.get(key));
  }
}