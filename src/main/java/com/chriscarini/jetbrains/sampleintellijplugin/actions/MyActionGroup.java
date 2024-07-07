package com.chriscarini.jetbrains.sampleintellijplugin.actions;

import com.intellij.openapi.actionSystem.DefaultActionGroup;


public class MyActionGroup extends DefaultActionGroup {
    public MyActionGroup() {
        super("MY SAMPLE-INTELLIJ-PLUGIN ACTION GROUP", true);
//        super();
//        getTemplatePresentation().setText("MY SAMPLE-INTELLIJ-PLUGIN ACTION GROUP"); //NON-NLS - This is for developer debugging only.
    }
}