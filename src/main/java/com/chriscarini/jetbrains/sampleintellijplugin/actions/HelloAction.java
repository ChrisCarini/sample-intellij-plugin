package com.chriscarini.jetbrains.sampleintellijplugin.actions;

import com.intellij.ide.ui.ProductIcons;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.DumbAwareAction;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;

final public class HelloAction extends DumbAwareAction {
    public HelloAction() {
        super("Hello!");
        getTemplatePresentation().setIcon(ProductIcons.getInstance().getProductIcon());
        getTemplatePresentation().setDescription("A simple hello.");
    }

    @Override
    public void actionPerformed(AnActionEvent e) {
        final Project project = e.getProject();
        Messages.showMessageDialog(project, "How are you?", "Hello World!", Messages.getInformationIcon());
    }
}
