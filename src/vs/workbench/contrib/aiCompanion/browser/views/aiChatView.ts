import { Emitter, Event } from '../../../../../base/common/event.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IAICompanionService, IAIMessage, MessageType, AICompanionMode } from '../../common/aiCompanionService.js';
import { ViewPane, IViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { localize } from '../../../../../nls.js';
import { append, $ } from '../../../../../base/browser/dom.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { generateUuid } from '../../../../../base/common/uuid.js';

interface BackendAIResponse {
	content: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	finishReason: string;
	sessionId: string;
	requestId: string;
}

export class AIChatView extends ViewPane {
	static readonly ID = 'aiCompanion.chatView';

	private readonly _onDidChangeInput = this._register(new Emitter<string>());
	readonly onDidChangeInput: Event<string> = this._onDidChangeInput.event;

	private readonly aiCompanionService: IAICompanionService;
	private readonly workspaceService: IWorkspaceContextService;

	private chatContainer!: HTMLElement;
	private messageList!: HTMLElement;
	private inputContainer!: HTMLElement;
	private inputBox!: HTMLInputElement;
	private sendButton!: HTMLButtonElement;
	private typingIndicator!: HTMLElement;
	private statusIndicator!: HTMLElement;

	private messages: IAIMessage[] = [];
	private isTyping = false;
	private isInitializing = false;
	private currentMode: AICompanionMode = AICompanionMode.Helper;
	private sessionId: string = '';
	private backendUrl: string = '';
	private isConnected = false;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IAICompanionService aiCompanionService: IAICompanionService,
		@IWorkspaceContextService workspaceService: IWorkspaceContextService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.aiCompanionService = aiCompanionService;
		this.workspaceService = workspaceService;

		// Get backend URL from configuration
		this.backendUrl = this.configurationService.getValue<string>('aiCompanion.backend.url') || 'http://localhost:3000/api/v1';

		// Initialize session and check connection
		this.initializeSession();

		this._register(this.aiCompanionService.onDidChangeConversation(this.onConversationChanged, this));
		this._register(this.aiCompanionService.onDidChangeState(this.onStateChanged, this));
		this._register(this.aiCompanionService.onDidChangeMode(this.onModeChanged, this));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		// Add beautiful modern styles
		this.addModernStyles();

		// Apply modern styling
		container.classList.add('ai-companion-chat-view');
		this.applyBeautifulTheme(container);

		// Create main layout
		this.createLayout(container);

		// Show welcome message
		this.showWelcomeMessage();
	}

	private addModernStyles(): void {
		if (document.getElementById('ai-companion-modern-styles')) return;

		const styles = document.createElement('style');
		styles.id = 'ai-companion-modern-styles';
		styles.textContent = `
			.ai-companion-chat-view {
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
				background: var(--vscode-sideBar-background);
				color: var(--vscode-sideBar-foreground);
				height: 100%;
				display: flex;
				flex-direction: column;
			}

			.ai-chat-header {
				background: linear-gradient(135deg, var(--vscode-button-background) 0%, var(--vscode-button-hoverBackground) 100%);
				border-bottom: 1px solid var(--vscode-panel-border);
				padding: 12px;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			}

			.ai-mode-selector {
				display: flex;
				gap: 8px;
				justify-content: center;
				margin-bottom: 8px;
			}

			.ai-mode-button {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 8px 16px;
				border: 1px solid var(--vscode-button-border);
				border-radius: 20px;
				background: rgba(255, 255, 255, 0.1);
				color: var(--vscode-button-foreground);
				cursor: pointer;
				font-size: 13px;
				font-weight: 500;
				transition: all 0.2s ease;
				backdrop-filter: blur(10px);
			}

			.ai-mode-button:hover {
				background: rgba(255, 255, 255, 0.2);
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			}

			.ai-mode-button.active {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
			}

			.ai-status-indicator {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 6px;
				font-size: 12px;
				color: var(--vscode-descriptionForeground);
				padding: 4px 12px;
				border-radius: 12px;
				background: rgba(255, 255, 255, 0.05);
				backdrop-filter: blur(5px);
			}

			.status-icon {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				animation: pulse 2s infinite;
			}

			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.5; }
			}

			.ai-chat-container {
				flex: 1;
				display: flex;
				flex-direction: column;
				padding: 16px;
				background: var(--vscode-editor-background);
			}

			.ai-message-list {
				flex: 1;
				overflow-y: auto;
				padding: 16px;
				background: var(--vscode-editor-background);
				border-radius: 12px;
				margin-bottom: 16px;
				border: 1px solid var(--vscode-panel-border);
				box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
				max-height: 500px;
			}

			.ai-message-list::-webkit-scrollbar {
				width: 8px;
			}

			.ai-message-list::-webkit-scrollbar-track {
				background: var(--vscode-scrollbarSlider-background);
				border-radius: 4px;
			}

			.ai-message-list::-webkit-scrollbar-thumb {
				background: var(--vscode-scrollbarSlider-hoverBackground);
				border-radius: 4px;
			}

			.ai-message {
				display: flex;
				gap: 12px;
				margin: 16px 0;
				padding: 16px;
				border-radius: 16px;
				background: var(--vscode-editor-inactiveSelectionBackground);
				border: 1px solid var(--vscode-panel-border);
				animation: slideInMessage 0.3s ease-out;
				position: relative;
				overflow: hidden;
			}

			.ai-message::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				height: 3px;
				background: linear-gradient(90deg, var(--vscode-charts-blue), var(--vscode-charts-green));
				border-radius: 16px 16px 0 0;
			}

			.ai-message.ai-message-user {
				background: var(--vscode-editor-selectionBackground);
				margin-left: 20px;
			}

			.ai-message.ai-message-user::before {
				background: linear-gradient(90deg, var(--vscode-charts-blue), var(--vscode-charts-purple));
			}

			.ai-message-avatar {
				width: 36px;
				height: 36px;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				background: linear-gradient(135deg, var(--vscode-charts-blue), var(--vscode-charts-green));
				color: white;
				font-size: 18px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			}

			.ai-message-user .ai-message-avatar {
				background: linear-gradient(135deg, var(--vscode-charts-blue), var(--vscode-charts-purple));
			}

			.ai-message-content {
				flex: 1;
				min-width: 0;
			}

			.ai-message-text {
				user-select: text;
				-webkit-user-select: text;
				line-height: 1.6;
				word-wrap: break-word;
				white-space: pre-wrap;
				font-family: inherit;
				font-size: 14px;
				color: var(--vscode-editor-foreground);
				margin-bottom: 8px;
			}

			.ai-message-footer {
				display: flex;
				justify-content: space-between;
				align-items: center;
				font-size: 11px;
				color: var(--vscode-descriptionForeground);
				opacity: 0.8;
			}

			.ai-message-usage {
				background: var(--vscode-badge-background);
				color: var(--vscode-badge-foreground);
				padding: 2px 8px;
				border-radius: 10px;
				font-size: 10px;
				font-weight: 500;
			}

			.ai-typing-indicator {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 16px;
				margin: 8px 0;
				background: var(--vscode-editor-inactiveSelectionBackground);
				border-radius: 16px;
				border: 1px solid var(--vscode-panel-border);
				animation: slideInMessage 0.3s ease-out;
			}

			.ai-typing-dots {
				display: flex;
				gap: 4px;
			}

			.ai-typing-dots span {
				width: 6px;
				height: 6px;
				background: var(--vscode-charts-green);
				border-radius: 50%;
				animation: typingDot 1.4s infinite ease-in-out;
			}

			.ai-typing-dots span:nth-child(1) { animation-delay: 0s; }
			.ai-typing-dots span:nth-child(2) { animation-delay: 0.16s; }
			.ai-typing-dots span:nth-child(3) { animation-delay: 0.32s; }

			@keyframes typingDot {
				0%, 80%, 100% {
					opacity: 0.3;
					transform: scale(0.8);
				}
				40% {
					opacity: 1;
					transform: scale(1.2);
				}
			}

			@keyframes slideInMessage {
				from {
					opacity: 0;
					transform: translateY(20px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.ai-input-container {
				display: flex;
				gap: 12px;
				padding: 16px;
				background: var(--vscode-input-background);
				border: 1px solid var(--vscode-input-border);
				border-radius: 24px;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
				transition: all 0.2s ease;
			}

			.ai-input-container:focus-within {
				border-color: var(--vscode-focusBorder);
				box-shadow: 0 4px 16px rgba(0, 122, 255, 0.2);
				transform: translateY(-2px);
			}

			.ai-input-container input {
				flex: 1;
				padding: 12px 16px;
				border: none;
				border-radius: 20px;
				background: transparent;
				color: var(--vscode-input-foreground);
				font-family: inherit;
				font-size: 14px;
				outline: none;
			}

			.ai-input-container input::placeholder {
				color: var(--vscode-input-placeholderForeground);
				opacity: 0.7;
			}

			.ai-input-container button {
				padding: 12px 20px;
				border: none;
				border-radius: 20px;
				background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
				color: var(--vscode-button-foreground);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 14px;
				font-weight: 500;
				transition: all 0.2s ease;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
			}

			.ai-input-container button:hover:not(:disabled) {
				transform: translateY(-2px);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
			}

			.ai-input-container button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
				transform: none;
			}

			.welcome-message {
				text-align: center;
				padding: 24px;
				color: var(--vscode-descriptionForeground);
				background: var(--vscode-editor-inactiveSelectionBackground);
				border-radius: 16px;
				border: 1px solid var(--vscode-panel-border);
				margin: 16px 0;
			}

			.welcome-message h3 {
				margin: 0 0 12px 0;
				color: var(--vscode-editor-foreground);
				font-size: 18px;
				font-weight: 600;
			}
		`;
		document.head.appendChild(styles);
	}

	private async initializeSession(): Promise<void> {
		try {
			// First check if backend is reachable
			const isHealthy = await this.checkBackendHealth();
			if (!isHealthy) {
				this.updateConnectionStatus(false, 'Backend not reachable');
				return;
			}

			const workspace = this.workspaceService.getWorkspace();
			const workspaceId = workspace.folders[0]?.uri.toString() || 'unknown';
			
			const response = await fetch(`${this.backendUrl}/sessions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					workspaceId: workspaceId,
					vscodeVersion: '1.90.0'
				})
			});

			if (response.ok) {
				const data = await response.json();
				this.sessionId = data.sessionId;
				this.updateConnectionStatus(true, 'Connected');
				console.log('✅ Session created:', this.sessionId);
			} else {
				this.updateConnectionStatus(false, 'Failed to create session');
				this.sessionId = generateUuid(); // Fallback
			}
		} catch (error) {
			console.error('❌ Session initialization error:', error);
			this.updateConnectionStatus(false, 'Connection failed');
			this.sessionId = generateUuid(); // Fallback
		}
	}

	private async checkBackendHealth(): Promise<boolean> {
		try {
			// Try with explicit localhost URL first
			const healthUrl = this.backendUrl.replace('/api/v1', '') + '/health';
			console.log('🔍 Checking backend health at:', healthUrl);
			
			const response = await fetch(healthUrl, {
				method: 'GET',
				signal: AbortSignal.timeout(5000)
			});
			
			console.log('✅ Backend health check response:', response.status);
			return response.ok;
		} catch (error) {
			console.error('❌ Backend health check failed:', error);
			
			// If it's a CSP error, try alternative approach
			if (error instanceof TypeError && error.message.includes('Content Security Policy')) {
				console.warn('⚠️ CSP blocked connection, trying alternative approach...');
				// For now, assume backend is available if we're in development
				return true;
			}
			
			return false;
		}
	}

	private updateConnectionStatus(connected: boolean, message: string): void {
		this.isConnected = connected;
		if (this.statusIndicator) {
			const statusIcon = this.statusIndicator.querySelector('.status-icon') as HTMLElement;
			const statusText = this.statusIndicator.querySelector('.status-text') as HTMLElement;
			
			if (statusIcon && statusText) {
				statusIcon.style.background = connected ? 'var(--vscode-charts-green)' : 'var(--vscode-charts-red)';
				statusText.textContent = message;
			}
		}
	}

	private createLayout(container: HTMLElement): void {
		// Header with mode selector and status
		const header = append(container, $('.ai-chat-header'));

		this.createModeSelector(header);
		this.createStatusIndicator(header);

		// Chat container with messages
		this.chatContainer = append(container, $('.ai-chat-container'));

		// Message list with scrolling
		this.messageList = append(this.chatContainer, $('.ai-message-list'));

		// Typing indicator
		this.createTypingIndicator();

		// Input container
		this.createInputContainer(this.chatContainer);
	}

	private createStatusIndicator(header: HTMLElement): void {
		this.statusIndicator = append(header, $('.ai-status-indicator'));

		const statusIcon = append(this.statusIndicator, $('.status-icon'));
		statusIcon.style.background = 'var(--vscode-charts-orange)';

		const statusText = append(this.statusIndicator, $('.status-text'));
		statusText.textContent = 'Connecting...';
	}

	private createModeSelector(header: HTMLElement): void {
		const modeContainer = append(header, $('.ai-mode-selector'));

		const modes = [
			{ mode: AICompanionMode.Helper, label: '🧠 Helper', icon: 'lightbulb' },
		];

		modes.forEach(({ mode, label, icon }) => {
			const button = append(modeContainer, $('button.ai-mode-button')) as HTMLButtonElement;
			
			append(button, $('span.codicon.codicon-' + icon));
			const labelSpan = append(button, $('span.ai-mode-label'));
			labelSpan.textContent = label;
			
			if (mode === this.currentMode) {
				button.classList.add('active');
			}

			const clickHandler = () => this.setMode(mode);
			button.addEventListener('click', clickHandler);
			this._register({ dispose: () => button.removeEventListener('click', clickHandler) });
		});
	}

	private createTypingIndicator(): void {
		this.typingIndicator = append(this.messageList, $('.ai-typing-indicator'));
		this.typingIndicator.style.display = 'none';
		
		const dotsContainer = append(this.typingIndicator, $('.ai-typing-dots'));
		
		for (let i = 0; i < 3; i++) {
			append(dotsContainer, $('span'));
		}
		
		const textSpan = append(this.typingIndicator, $('.ai-typing-text'));
		textSpan.textContent = 'AI is thinking...';
	}

	private createInputContainer(container: HTMLElement): void {
		this.inputContainer = append(container, $('.ai-input-container'));

		// Input box
		this.inputBox = append(this.inputContainer, $('input')) as HTMLInputElement;
		this.inputBox.placeholder = '💬 Ask me anything about your code...';

		// Send button
		this.sendButton = append(this.inputContainer, $('button')) as HTMLButtonElement;
		
		append(this.sendButton, $('span.codicon.codicon-send'));
		const sendLabel = append(this.sendButton, $('span'));
		sendLabel.textContent = 'Send';

		// Event listeners
		this.inputBox.addEventListener('input', () => {
			this._onDidChangeInput.fire(this.inputBox.value);
			this.updateSendButton();
		});

		this.inputBox.addEventListener('keypress', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.sendMessage();
			}
		});

		this.sendButton.addEventListener('click', () => {
			this.sendMessage();
		});

		this.updateSendButton();
	}

	private async sendMessage(): Promise<void> {
		const content = this.inputBox.value.trim();
		if (!content || this.isTyping || this.isInitializing || !this.isConnected) {
			return;
		}

		// Clear input and show typing indicator
		this.inputBox.value = '';
		this.updateSendButton();
		
		// Add user message to UI
		const userMessage: IAIMessage = {
			id: generateUuid(),
			type: MessageType.User,
			content: content,
			timestamp: Date.now()
		};
		this.addMessage(userMessage);

		this.showTypingIndicator();

		try {
			// Send to backend
			const response = await this.callBackendAPI(content);
			
			// Add AI response to UI
			const aiMessage: IAIMessage = {
				id: generateUuid(),
				type: MessageType.Assistant,
				content: response.content,
				timestamp: Date.now(),
				metadata: {
					usage: response.usage,
					requestId: response.requestId,
					model: response.model,
					finishReason: response.finishReason
				}
			};
			
			this.addMessage(aiMessage);
			this.hideTypingIndicator();
			
		} catch (error) {
			console.error('Failed to send message:', error);
			this.hideTypingIndicator();
			
			const errorMessage = this.getErrorMessage(error);
			this.showError(errorMessage);
			
			if (!this.isConnected) {
				setTimeout(() => this.initializeSession(), 5000);
			}
		}
	}

	private getErrorMessage(error: any): string {
		if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
			return 'Request timed out. The backend may be slow or unavailable.';
		}
		if (error?.message?.includes('fetch')) {
			return 'Failed to connect to AI backend. Please check if the backend is running on localhost:3000';
		}
		if (error?.message?.includes('500')) {
			return 'Backend server error. Please check the backend logs.';
		}
		if (error?.message?.includes('429')) {
			return 'Rate limit exceeded. Please wait a moment before trying again.';
		}
		return `Error: ${error?.message || 'Unknown error occurred'}`;
	}

	private async callBackendAPI(prompt: string): Promise<BackendAIResponse> {
		const workspace = this.workspaceService.getWorkspace();
		const workspaceInfo = {
			name: workspace.folders[0]?.name || 'Unknown',
			rootPath: workspace.folders[0]?.uri.fsPath || '',
			files: [],
			gitBranch: undefined
		};

		const requestBody = {
			type: 'chat',
			prompt: prompt,
			context: {
				workspace: workspaceInfo,
				memory: null,
				files: { files: [], directories: [], totalFiles: 0, totalSize: 0 },
				currentMode: this.currentMode,
				techStack: [],
				architecture: '',
				goals: []
			},
			sessionId: this.sessionId,
			messages: [
				{ role: 'user', content: prompt }
			],
			maxTokens: 2048,
			temperature: 0.7
		};

		const timeout = this.configurationService.getValue<number>('aiCompanion.backend.timeout') || 30000;

		const response = await fetch(`${this.backendUrl}/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Session-ID': this.sessionId
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(timeout)
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(`Backend API error: ${response.status} ${errorData}`);
		}

		return await response.json();
	}

	private addMessage(message: IAIMessage): void {
		this.messages.push(message);
		this.renderMessage(message);
		this.scrollToBottom();
	}

	private renderMessage(message: IAIMessage): void {
		const messageElement = append(this.messageList, $('.ai-message'));
		messageElement.classList.add(`ai-message-${message.type}`);

		// Avatar
		const avatar = append(messageElement, $('.ai-message-avatar'));
		const avatarIcon = append(avatar, $('span.codicon'));
		avatarIcon.className = `codicon codicon-${message.type === MessageType.User ? 'account' : 'lightbulb'}`;

		// Content container
		const contentContainer = append(messageElement, $('.ai-message-content'));

		// Message content
		const content = append(contentContainer, $('.ai-message-text'));
		content.textContent = this.formatMessageContent(message.content);

		// Footer with timestamp and usage
		const footer = append(contentContainer, $('.ai-message-footer'));

		const timestamp = append(footer, $('.ai-message-timestamp'));
		timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();

		// Show usage info for AI messages
		if (message.type === MessageType.Assistant && message.metadata?.usage) {
			const usageInfo = append(footer, $('.ai-message-usage'));
			usageInfo.textContent = `${message.metadata.usage.totalTokens} tokens`;
		}
	}

	private formatMessageContent(text: string): string {
		return text
			.replace(/\*\*(.*?)\*\*/g, '$1')
			.replace(/\*(.*?)\*/g, '$1')
			.replace(/`(.*?)`/g, '$1')
			.trim();
	}

	private showWelcomeMessage(): void {
		const welcomeDiv = append(this.messageList, $('.welcome-message'));
		
		const title = append(welcomeDiv, $('h3'));
		title.textContent = '🤖 AI Companion';
		
		const description = append(welcomeDiv, $('p'));
		description.textContent = 'I\'m here to help you with your coding projects. Ask me anything about your code, request features, or get help with development tasks!';
	}

	private showTypingIndicator(): void {
		this.isTyping = true;
		this.typingIndicator.style.display = 'flex';
		this.scrollToBottom();
	}

	private hideTypingIndicator(): void {
		this.isTyping = false;
		this.typingIndicator.style.display = 'none';
	}

	private scrollToBottom(): void {
				setTimeout(() => {
			this.messageList.scrollTop = this.messageList.scrollHeight;
		}, 100);
	}

	private updateSendButton(): void {
		const hasContent = this.inputBox.value.trim().length > 0;
		const isEnabled = hasContent && !this.isTyping && !this.isInitializing && this.isConnected;
		
		this.sendButton.disabled = !isEnabled;
		
		// Update button text based on connection status
		const sendLabel = this.sendButton.querySelector('span:not(.codicon)') as HTMLElement;
		if (sendLabel) {
			if (!this.isConnected) {
				sendLabel.textContent = 'Disconnected';
			} else if (this.isTyping) {
				sendLabel.textContent = 'Thinking...';
			} else {
				sendLabel.textContent = 'Send';
			}
		}
	}

	private async setMode(mode: AICompanionMode): Promise<void> {
		this.currentMode = mode;
		await this.aiCompanionService.setMode(mode);
		
		// Update UI
		const buttons = this.element?.querySelectorAll('.ai-mode-button');
		buttons?.forEach(button => {
			button.classList.remove('active');
		});
		
		// Find and activate the correct button
		const modeButtons = this.element?.querySelectorAll('.ai-mode-button');
		modeButtons?.forEach((button, index) => {
			if (index === 0 && mode === AICompanionMode.Helper) {
				button.classList.add('active');
			}
		});
	}

	private onConversationChanged(conversation: any): void {
		if (conversation?.messages) {
			this.messages = conversation.messages;
			this.renderAllMessages();
		}
	}

	private onStateChanged(state: any): void {
		if (state === 'generating' || state === 'thinking') {
			this.showTypingIndicator();
		} else {
			this.hideTypingIndicator();
		}
	}

	private onModeChanged(mode: AICompanionMode): void {
		this.currentMode = mode;
	}

	private renderAllMessages(): void {
		// Clear existing messages except welcome and typing indicator
		const children = Array.from(this.messageList.children);
		children.forEach(child => {
			if (!child.classList.contains('welcome-message') && !child.classList.contains('ai-typing-indicator')) {
				child.remove();
			}
		});

		// Render all messages with deduplication
		const seenMessages = new Set<string>();
		this.messages.forEach(message => {
			const messageKey = `${message.id || message.timestamp}-${message.content.substring(0, 50)}`;
			if (!seenMessages.has(messageKey)) {
				seenMessages.add(messageKey);
				this.renderMessage(message);
			}
		});
	}

	private showError(message: string): void {
		const errorMessage: IAIMessage = {
			id: generateUuid(),
			type: MessageType.Assistant,
			content: `❌ ${message}`,
			timestamp: Date.now()
		};
		this.addMessage(errorMessage);
	}

	private applyBeautifulTheme(container: HTMLElement): void {
		// Apply modern gradient background
		container.style.background = 'linear-gradient(135deg, var(--vscode-sideBar-background) 0%, var(--vscode-editor-background) 100%)';
		container.style.minHeight = '100%';
	}

	override focus(): void {
		super.focus();
		if (this.inputBox) {
			this.inputBox.focus();
		}
	}

	getTitle(): string {
		return localize('aiCompanion.chat', 'AI Chat');
	}

	override dispose(): void {
		super.dispose();
	}
}