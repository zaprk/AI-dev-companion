import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { MenuRegistry, MenuId } from '../../../../platform/actions/common/actions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { AICompanionCommands, AICompanionViewIds, AICompanionContext } from '../common/aiCompanionServiceTokens.js';

CommandsRegistry.registerCommand({
	id: AICompanionCommands.Focus,
	handler: async (accessor) => {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(AICompanionViewIds.CHAT_VIEW_ID, true);
	}
});

CommandsRegistry.registerCommand({
	id: AICompanionCommands.Toggle,
	handler: async (accessor) => {
		const viewsService = accessor.get(IViewsService);
		const view = viewsService.getActiveViewWithId(AICompanionViewIds.CHAT_VIEW_ID);
		
		if (view) {
			await viewsService.closeView(AICompanionViewIds.CHAT_VIEW_ID);
		} else {
			await viewsService.openView(AICompanionViewIds.CHAT_VIEW_ID, true);
		}
	}
});

CommandsRegistry.registerCommand({
	id: AICompanionCommands.NewConversation,
	handler: async (accessor) => {
	}
});

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: AICompanionCommands.Focus,
		title: localize('aiCompanion.focus', 'AI Companion: Focus'),
		category: localize('aiCompanion.category', 'AI Companion')
	},
	when: AICompanionContext.Enabled
});

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: AICompanionCommands.Toggle,
		title: localize('aiCompanion.toggle', 'AI Companion: Toggle Panel'),
		category: localize('aiCompanion.category', 'AI Companion')
	}
});

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: AICompanionCommands.NewConversation,
		title: localize('aiCompanion.newConversation', 'AI Companion: New Conversation'),
		category: localize('aiCompanion.category', 'AI Companion')
	},
	when: AICompanionContext.Enabled
});