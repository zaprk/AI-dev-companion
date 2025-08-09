import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';

// Import our service interface and implementation
import { IAICompanionService } from './aiCompanionService.js';
import { AICompanionService } from './aiCompanionService.impl.js';
import { IWorkspaceEditService } from './workspaceEditService.js';
import { WorkspaceEditService } from './workspaceEditService.js';
import { ICodeValidationService } from './codeValidationService.js';
import { CodeValidationService } from './codeValidationService.js';
import { ICodeSearchService } from './codeSearchService.js';
import { CodeSearchService } from './codeSearchService.js';
import { IAINotificationService } from './aiNotificationService.js';
import { AINotificationService } from './aiNotificationService.js';
import { IProjectMemoryService } from './projectMemoryService.js';
import { ProjectMemoryService } from './projectMemoryService.js';
import { ICodebaseAnalyzer } from './codebaseAnalyzer.js';
import { CodebaseAnalyzer } from './codebaseAnalyzer.js';
import { IIntelligentCodeGenerator } from './intelligentCodeGenerator.js';
import { IntelligentCodeGenerator } from './intelligentCodeGenerator.js';
import { IFeedbackLearningService } from './feedbackLearningService.js';
import { FeedbackLearningService } from './feedbackLearningService.js';
import { IPromptSecurityService } from './promptSecurityService.js';
import { PromptSecurityService } from './promptSecurityService.js';
import { ICostOptimizationService } from './costOptimizationService.js';
import { CostOptimizationService } from './costOptimizationService.js';

// Import our view components
import { AI_COMPANION_CONTAINER } from '../browser/aiCompanionViewContainer.js';
import { AIChatView } from '../browser/views/aiChatView.js';
import { AICompanionViewIds } from './aiCompanionServiceTokens.js';

// Register the AI Companion service as a singleton
registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Eager);

// Register the WorkspaceEdit service as a singleton
registerSingleton(IWorkspaceEditService, WorkspaceEditService, InstantiationType.Eager);

// Register the CodeValidation service as a singleton
registerSingleton(ICodeValidationService, CodeValidationService, InstantiationType.Eager);

// Register the CodeSearch service as a singleton
registerSingleton(ICodeSearchService, CodeSearchService, InstantiationType.Eager);

// Register the AI Notification service as a singleton
registerSingleton(IAINotificationService, AINotificationService, InstantiationType.Eager);

// Register the ProjectMemory service as a singleton
registerSingleton(IProjectMemoryService, ProjectMemoryService, InstantiationType.Eager);

// Register the CodebaseAnalyzer service as a singleton
registerSingleton(ICodebaseAnalyzer, CodebaseAnalyzer, InstantiationType.Eager);

// Register the IntelligentCodeGenerator service as a singleton
registerSingleton(IIntelligentCodeGenerator, IntelligentCodeGenerator, InstantiationType.Eager);

// Register the FeedbackLearning service as a singleton
registerSingleton(IFeedbackLearningService, FeedbackLearningService, InstantiationType.Eager);

// Register the PromptSecurity service as a singleton
registerSingleton(IPromptSecurityService, PromptSecurityService, InstantiationType.Eager);

// Register the CostOptimization service as a singleton
registerSingleton(ICostOptimizationService, CostOptimizationService, InstantiationType.Eager);

// Register the chat view in the AI Companion container
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

viewsRegistry.registerViews([{
	id: AICompanionViewIds.CHAT_VIEW_ID,
	name: { value: 'Chat', original: 'Chat' }, // ILocalizedString format
	ctorDescriptor: new SyncDescriptor(AIChatView),
	canToggleVisibility: false, // Always visible in the container
	canMoveView: false, // Fixed position
	containerIcon: AI_COMPANION_CONTAINER.icon,
	// when: AICompanionContext.Enabled, // Remove conditional for now - always visible
	order: 1 // First view in the container
}], AI_COMPANION_CONTAINER);