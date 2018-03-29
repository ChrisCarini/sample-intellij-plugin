package com.chriscarini.sampleintellijplugin.actions;

import com.intellij.icons.AllIcons;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.DumbAwareAction;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;

public class HelloAction extends DumbAwareAction {
    public HelloAction() {
        super("Hello!");
        getTemplatePresentation().setIcon(AllIcons.Icon_CEsmall);
        getTemplatePresentation().setDescription("A simple hello.");
    }

    @Override
    public void actionPerformed(AnActionEvent e) {
        final Project project = e.getProject();
        Messages.showMessageDialog(project, "How are you?", "Hello World!", Messages.getInformationIcon());
    }
}
