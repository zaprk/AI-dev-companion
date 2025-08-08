import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';

// Import our service interface and implementation
import { IAICompanionService } from './aiCompanionService.js';
import { AICompanionService } from './aiCompanionService.impl.js';
import { IWorkspaceEditService } from './workspaceEditService.js';
import { WorkspaceEditService } from './workspaceEditService.js';
import { ICodeSearchService } from './codeSearchService.js';
import { CodeSearchService } from './codeSearchService.js';
import { IAINotificationService } from './aiNotificationService.js';
import { AINotificationService } from './aiNotificationService.js';

// Import our view components
import { AI_COMPANION_CONTAINER } from '../browser/aiCompanionViewContainer.js';
import { AIChatView } from '../browser/views/aiChatView.js';
import { AICompanionViewIds } from './aiCompanionServiceTokens.js';

// Register the AI Companion service as a singleton
registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Eager);

// Register the WorkspaceEdit service as a singleton
registerSingleton(IWorkspaceEditService, WorkspaceEditService, InstantiationType.Eager);

// Register the CodeSearch service as a singleton
registerSingleton(ICodeSearchService, CodeSearchService, InstantiationType.Eager);

// Register the AI Notification service as a singleton
registerSingleton(IAINotificationService, AINotificationService, InstantiationType.Eager);

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