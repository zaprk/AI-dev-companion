import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';

// Import our service interface and implementation
import { IAICompanionService } from './aiCompanionService.js';
import { AICompanionService } from './aiCompanionService.impl.js';

// Import our view components
import { AI_COMPANION_CONTAINER } from '../browser/aiCompanionViewContainer.js';
import { AIChatViewRefactored } from '../browser/views/aiChatView.js';
import { AICompanionViewIds } from './aiCompanionServiceTokens.js';

// Register the AI Companion service as a singleton
registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Delayed);

// Register the chat view in the AI Companion container
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

viewsRegistry.registerViews([{
	id: AICompanionViewIds.CHAT_VIEW_ID,
	name: { value: 'Chat', original: 'Chat' }, // ILocalizedString format
	ctorDescriptor: new SyncDescriptor(AIChatViewRefactored),
	canToggleVisibility: false, // Always visible in the container
	canMoveView: false, // Fixed position
	containerIcon: AI_COMPANION_CONTAINER.icon,
	// when: AICompanionContext.Enabled, // Remove conditional for now - always visible
	order: 1 // First view in the container
}], AI_COMPANION_CONTAINER);