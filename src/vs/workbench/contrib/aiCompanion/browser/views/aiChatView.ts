import { append, $ } from '../../../../../base/browser/dom.js';
import { ViewPane, IViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { AICompanionViewIds } from '../../common/aiCompanionServiceTokens.js';

export class AIChatView extends ViewPane {
	static readonly ID = AICompanionViewIds.CHAT_VIEW_ID;

	private messagesContainer!: HTMLElement;
	private inputContainer!: HTMLElement;

	constructor(
		options: IViewPaneOptions,
		keybindingService: IKeybindingService,
		contextMenuService: IContextMenuService,
		configurationService: IConfigurationService,
		contextKeyService: IContextKeyService,
		viewDescriptorService: IViewDescriptorService,
		instantiationService: IInstantiationService,
		openerService: IOpenerService,
		themeService: IThemeService,
		hoverService: IHoverService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const chatContainer = append(container, $('.ai-chat-container'));
		
		this.messagesContainer = append(chatContainer, $('.ai-messages-container'));
		this.messagesContainer.style.height = '200px';
		this.messagesContainer.style.overflow = 'auto';
		this.messagesContainer.style.border = '1px solid var(--vscode-panel-border)';
		this.messagesContainer.style.padding = '8px';
		this.messagesContainer.style.marginBottom = '8px';
		
		const welcomeMessage = append(this.messagesContainer, $('.welcome-message'));
		welcomeMessage.textContent = '🤖 Welcome to AI Companion! This is a simplified chat interface.';
		welcomeMessage.style.color = 'var(--vscode-descriptionForeground)';
		
		this.inputContainer = append(chatContainer, $('.ai-input-container'));
		const inputField = append(this.inputContainer, $('input')) as HTMLInputElement;
		inputField.placeholder = 'Type a message...';
		inputField.style.width = '100%';
		inputField.style.padding = '4px';
		inputField.style.marginBottom = '4px';
		
		const sendButton = append(this.inputContainer, $('button')) as HTMLButtonElement;
		sendButton.textContent = 'Send';
		sendButton.style.width = '100%';
		sendButton.style.padding = '4px';
		
		sendButton.addEventListener('click', () => {
			if (inputField.value.trim()) {
				const messageDiv = append(this.messagesContainer, $('.user-message'));
				messageDiv.textContent = `You: ${inputField.value}`;
				messageDiv.style.marginBottom = '4px';
				inputField.value = '';
				
				setTimeout(() => {
					const responseDiv = append(this.messagesContainer, $('.ai-message'));
					responseDiv.textContent = '🤖 AI: Thanks for your message! This is a placeholder response.';
					responseDiv.style.marginBottom = '4px';
					responseDiv.style.color = 'var(--vscode-textLink-foreground)';
					this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
				}, 1000);
			}
		});
	}

	override focus(): void {
		super.focus();
		const input = this.inputContainer?.querySelector('input') as HTMLInputElement;
		if (input) {
			input.focus();
		}
	}

	getTitle(): string {
		return 'AI Chat';
	}
}