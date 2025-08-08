/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotificationService, Severity, INotificationHandle, IStatusHandle, INotification } from '../../../../platform/notification/common/notification.js';
import { IAction } from '../../../../base/common/actions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Action } from '../../../../base/common/actions.js';

export const IAINotificationService = createDecorator<IAINotificationService>('aiNotificationService');

export interface AIProgressOptions {
    title: string;
    message: string;
    total?: number;
    infinite?: boolean;
}

export interface AIErrorOptions {
    title?: string;
    message: string;
    error?: Error;
    actions?: string[];
    onAction?: (action: string) => void;
}

export interface AISuccessOptions {
    title?: string;
    message: string;
    actions?: string[];
    onAction?: (action: string) => void;
    autoClose?: boolean;
}

export interface IAINotificationService {
    readonly _serviceBrand: undefined;

    // Progress notifications
    showProgress(options: AIProgressOptions): INotificationHandle;
    
    // Error notifications
    showError(options: AIErrorOptions): INotificationHandle;
    
    // Success notifications
    showSuccess(options: AISuccessOptions): INotificationHandle;
    
    // Info notifications
    showInfo(message: string, title?: string): void;
    
    // Warning notifications
    showWarning(message: string, title?: string): void;
    
    // Status messages
    showStatus(message: string, timeout?: number): IStatusHandle;
    
    // AI-specific notifications
    showAIThinking(): INotificationHandle;
    showAIGenerating(step: string): INotificationHandle;
    showAICodeGenerated(fileCount: number): INotificationHandle;
    showAISearchComplete(resultCount: number): INotificationHandle;
    showAIAnalysisComplete(insights: string): INotificationHandle;
    
    // Workflow notifications
    showWorkflowStarted(workflowType: string): INotificationHandle;
    showWorkflowStepCompleted(step: string): void;
    showWorkflowCompleted(workflowType: string, duration: number): INotificationHandle;
    showWorkflowError(workflowType: string, error: string): INotificationHandle;
}

export class AINotificationService implements IAINotificationService {
    declare readonly _serviceBrand: undefined;

    private readonly source = { id: 'aiCompanion', label: 'AI Companion' };

    constructor(
        @INotificationService private readonly notificationService: INotificationService,
        @ILogService private readonly logService: ILogService
    ) {}

    // Progress notifications
    showProgress(options: AIProgressOptions): INotificationHandle {
        const notification: INotification = {
            severity: Severity.Info,
            message: options.message,
            source: this.source,
            progress: {
                infinite: options.infinite || false,
                total: options.total,
                worked: 0
            },
            sticky: true
        };

        const handle = this.notificationService.notify(notification);
        this.logService.info(`AI Companion: Progress started - ${options.title}`);
        return handle;
    }

    // Error notifications
    showError(options: AIErrorOptions): INotificationHandle {
        const actions: IAction[] = [];
        
        if (options.actions && options.onAction) {
            for (const actionLabel of options.actions) {
                actions.push(new Action(
                    `aiCompanion.${actionLabel.toLowerCase()}`,
                    actionLabel,
                    undefined,
                    true,
                    () => {
                        options.onAction!(actionLabel);
                    }
                ));
            }
        }

        const notification: INotification = {
            severity: Severity.Error,
            message: options.message,
            source: this.source,
            actions: actions.length > 0 ? { primary: actions } : undefined,
            sticky: true
        };

        const handle = this.notificationService.notify(notification);
        
        if (options.error) {
            this.logService.error(`AI Companion: ${options.title || 'Error'} - ${options.message}`, options.error);
        } else {
            this.logService.error(`AI Companion: ${options.title || 'Error'} - ${options.message}`);
        }
        
        return handle;
    }

    // Success notifications
    showSuccess(options: AISuccessOptions): INotificationHandle {
        const actions: IAction[] = [];
        
        if (options.actions && options.onAction) {
            for (const actionLabel of options.actions) {
                actions.push(new Action(
                    `aiCompanion.${actionLabel.toLowerCase()}`,
                    actionLabel,
                    undefined,
                    true,
                    () => {
                        options.onAction!(actionLabel);
                    }
                ));
            }
        }

        const notification: INotification = {
            severity: Severity.Info,
            message: options.message,
            source: this.source,
            actions: actions.length > 0 ? { primary: actions } : undefined,
            sticky: !options.autoClose
        };

        const handle = this.notificationService.notify(notification);
        this.logService.info(`AI Companion: ${options.title || 'Success'} - ${options.message}`);
        
        if (options.autoClose) {
            setTimeout(() => handle.close(), 3000);
        }
        
        return handle;
    }

    // Info notifications
    showInfo(message: string, title?: string): void {
        const fullMessage = title ? `${title}: ${message}` : message;
        this.notificationService.info(fullMessage);
        this.logService.info(`AI Companion: ${fullMessage}`);
    }

    // Warning notifications
    showWarning(message: string, title?: string): void {
        const fullMessage = title ? `${title}: ${message}` : message;
        this.notificationService.warn(fullMessage);
        this.logService.warn(`AI Companion: ${fullMessage}`);
    }

    // Status messages
    showStatus(message: string, timeout: number = 3000): IStatusHandle {
        const handle = this.notificationService.status(message, { hideAfter: timeout });
        this.logService.info(`AI Companion Status: ${message}`);
        return handle;
    }

    // AI-specific notifications

    showAIThinking(): INotificationHandle {
        return this.showProgress({
            title: 'AI Thinking',
            message: '🤔 AI is analyzing your request...',
            infinite: true
        });
    }

    showAIGenerating(step: string): INotificationHandle {
        return this.showProgress({
            title: 'AI Generating',
            message: `🚀 AI is generating ${step}...`,
            infinite: true
        });
    }

    showAICodeGenerated(fileCount: number): INotificationHandle {
        return this.showSuccess({
            title: 'Code Generated',
            message: `✅ Successfully generated ${fileCount} file${fileCount !== 1 ? 's' : ''}`,
            actions: ['View Files', 'Open in Editor'],
            autoClose: false
        });
    }

    showAISearchComplete(resultCount: number): INotificationHandle {
        return this.showSuccess({
            title: 'Search Complete',
            message: `🔍 Found ${resultCount} result${resultCount !== 1 ? 's' : ''} in codebase`,
            autoClose: true
        });
    }

    showAIAnalysisComplete(insights: string): INotificationHandle {
        return this.showSuccess({
            title: 'Analysis Complete',
            message: `📊 ${insights}`,
            autoClose: true
        });
    }

    // Workflow notifications

    showWorkflowStarted(workflowType: string): INotificationHandle {
        return this.showProgress({
            title: 'Workflow Started',
            message: `🔄 Starting ${workflowType} workflow...`,
            infinite: true
        });
    }

    showWorkflowStepCompleted(step: string): void {
        this.showInfo(`${step} completed`, 'Workflow Progress');
    }

    showWorkflowCompleted(workflowType: string, duration: number): INotificationHandle {
        const durationText = duration > 1000 ? `${Math.round(duration / 1000)}s` : `${duration}ms`;
        return this.showSuccess({
            title: 'Workflow Complete',
            message: `✅ ${workflowType} workflow completed in ${durationText}`,
            actions: ['View Results', 'Start New'],
            autoClose: false
        });
    }

    showWorkflowError(workflowType: string, error: string): INotificationHandle {
        return this.showError({
            title: 'Workflow Error',
            message: `❌ ${workflowType} workflow failed: ${error}`,
            actions: ['Retry', 'View Details']
        });
    }
}
