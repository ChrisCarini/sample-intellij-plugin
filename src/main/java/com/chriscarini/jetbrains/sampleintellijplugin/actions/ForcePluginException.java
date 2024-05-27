package com.chriscarini.jetbrains.sampleintellijplugin.actions;

import com.intellij.icons.AllIcons;
import com.intellij.openapi.actionSystem.ActionUpdateThread;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.project.DumbAwareAction;
import com.intellij.openapi.project.Project;
import org.jetbrains.annotations.NonNls;
import org.jetbrains.annotations.NotNull;


/**
 * Force an Exception from within this plugin code. This action is only used for testing the plugin
 * {ErrorReportSubmitter} extension point found in the `com.chriscarini.jetbrains:jetbrains-error-utils`
 * lib: {@link com.chriscarini.jetbrains.diagnostic.reporter.GitHubErrorReportSubmitter}.
 * <p>
 * This can be enabled by setting the below in "Help -> Diagnostic Tools -> Debug Log Settings...":
 * #com.chriscarini.jetbrains.locchangecountdetector.errorhandler.ForcePluginException
 */
public class ForcePluginException extends DumbAwareAction {
    private static final Logger LOG = Logger.getInstance(ForcePluginException.class);

    @NonNls
    private static final String DESCRIPTION = "Throws a StringIndexOutOfBoundsException or ClassCastException, because.";
    @NonNls
    private static final String FORCE_EXCEPTION = "FORCE sample-intellij-plugin EXCEPTION!";

    public ForcePluginException() {
        super(FORCE_EXCEPTION, DESCRIPTION, AllIcons.Debugger.Db_exception_breakpoint);
    }

    @Override
    public @NotNull ActionUpdateThread getActionUpdateThread() {
        return ActionUpdateThread.BGT;
    }

    @Override
    public void actionPerformed(@NotNull final AnActionEvent e) {
        if (Math.random() < 0.5) {
            throw new StringIndexOutOfBoundsException("String Index Out Of Bounds! Yikes!");
        } else {
            throw new ClassCastException("Class Cast Exception! Oh Boy!");
        }
    }

    @Override
    public void update(@NotNull final AnActionEvent e) {
        super.update(e);
        final Project project = e.getProject();
        if (project == null) {
            return;
        }

        e.getPresentation().setEnabledAndVisible(true);
    }
}