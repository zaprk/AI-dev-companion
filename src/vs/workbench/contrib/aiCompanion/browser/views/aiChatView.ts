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

// Import our new services
import { 
	IAIBackendService, 
	IMessageFormatter, 
	IWorkflowDetector,
	IConnectionManager,
	IPerformanceMonitor,
	IErrorHandler,
	IStateManager,
	IAIRequest,
	IAICompanionState,
	IAIConversation
} from '../../common/aiCompanionServiceTokens.js';



/**
 * Refactored AIChatView - Clean separation of concerns
 * 
 * This view is now focused ONLY on UI rendering and user interaction.
 * All business logic is delegated to specialized services.
 */
export class AIChatViewRefactored extends ViewPane {
	static readonly ID = 'aiCompanion.chatView';

	private readonly _onDidChangeInput = this._register(new Emitter<string>());
	readonly onDidChangeInput: Event<string> = this._onDidChangeInput.event;

	// UI Elements
	private chatContainer!: HTMLElement;
	private messageList!: HTMLElement;
	private inputContainer!: HTMLElement;
	private inputBox!: HTMLInputElement;
	private sendButton!: HTMLButtonElement;
	private typingIndicator!: HTMLElement;
	private statusIndicator!: HTMLElement;

	// Services (injected)
	private readonly aiCompanionService: IAICompanionService;
	private readonly backendService: IAIBackendService;
	private readonly messageFormatter: IMessageFormatter;
	private readonly workflowDetector: IWorkflowDetector;
	private readonly connectionManager: IConnectionManager;
	private readonly performanceMonitor: IPerformanceMonitor;
	private readonly errorHandler: IErrorHandler;
	private readonly stateManager: IStateManager;
	private readonly workspaceService: IWorkspaceContextService;

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
		@IWorkspaceContextService workspaceService: IWorkspaceContextService,
		@IAIBackendService backendService: IAIBackendService,
		@IMessageFormatter messageFormatter: IMessageFormatter,
		@IWorkflowDetector workflowDetector: IWorkflowDetector,
		@IConnectionManager connectionManager: IConnectionManager,
		@IPerformanceMonitor performanceMonitor: IPerformanceMonitor,
		@IErrorHandler errorHandler: IErrorHandler,
		@IStateManager stateManager: IStateManager
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		// Initialize services
		this.aiCompanionService = aiCompanionService;
		this.backendService = backendService;
		this.messageFormatter = messageFormatter;
		this.workflowDetector = workflowDetector;
		this.connectionManager = connectionManager;
		this.performanceMonitor = performanceMonitor;
		this.errorHandler = errorHandler;
		this.stateManager = stateManager;
		this.workspaceService = workspaceService;

		// Initialize connection
		this.initializeConnection();

		// Listen to state changes
		this._register(this.stateManager.onStateChange(this.onStateChanged, this));
		this._register(this.stateManager.onConversationChange(this.onConversationChanged, this));
		this._register(this.aiCompanionService.onDidChangeMode(this.onModeChanged, this));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		// Add modern styles
		this.addModernStyles();

		// Apply theme
		container.classList.add('ai-companion-chat-view');
		this.applyBeautifulTheme(container);

		// Create layout
		this.createLayout(container);

		// Show welcome message
		this.showWelcomeMessage();
	}

	private async initializeConnection(): Promise<void> {
		try {
			await this.connectionManager.connect();
		} catch (error) {
			this.errorHandler.handleError(error as Error, 'Connection initialization', 'error');
		}
	}

	private async sendMessage(): Promise<void> {
		const content = this.inputBox.value.trim();
		const state = this.stateManager.getState();
		if (!content || state.ui.isTyping || !this.connectionManager.isConnected()) {
			return;
		}

		// Clear input
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

		// Update state
		this.stateManager.updateUIState({ isTyping: true });

		try {
			// Detect workflow type
			const workflowType = this.workflowDetector.detectWorkflowType(content);
			
			if (workflowType !== 'chat') {
				await this.handleStructuredWorkflow(workflowType, content);
			} else {
				await this.handleChatMessage(content);
			}
		} catch (error) {
			this.errorHandler.handleError(error as Error, 'Message sending', 'error');
		} finally {
			// Update state
			this.stateManager.updateUIState({ isTyping: false });
		}
	}

	private async handleStructuredWorkflow(workflowType: string, content: string): Promise<void> {
		const endTimer = this.performanceMonitor.startTimer(`${workflowType}-workflow`);

		try {
			// Analyze context for structured workflows
			const context = await this.workflowDetector.analyzeContext(this.workspaceService.getWorkspace().folders[0]?.uri.fsPath || '');
			
			// Create request for structured workflow
			const request: IAIRequest = {
				type: workflowType,
				prompt: content,
				context: context,
				sessionId: '', // Will be set by backend service
				messages: [{ role: 'user', content }],
				mode: workflowType,
				content: content
			};

			const response = await this.backendService.sendRequest(request);
			
			// Add AI response
			const aiMessage: IAIMessage = {
				id: generateUuid(),
				type: MessageType.Assistant,
				content: this.messageFormatter.formatWorkflowResponse(response.content, workflowType),
				timestamp: Date.now()
			};
			this.addMessage(aiMessage);
		} catch (error) {
			this.errorHandler.handleError(error as Error, `${workflowType} workflow`, 'error');
		} finally {
			endTimer();
		}
	}

	private async handleChatMessage(content: string): Promise<void> {
		const endTimer = this.performanceMonitor.startTimer('chat-message');

		try {
			const request: IAIRequest = {
				type: 'chat',
				prompt: content,
				context: await this.getWorkspaceContext(),
				sessionId: '', // Will be set by backend service
				messages: [{ role: 'user', content }],
				mode: 'chat',
				content: content
			};

			const response = await this.backendService.sendRequest(request);
			
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
		} catch (error) {
			this.errorHandler.handleError(error as Error, 'Chat message', 'error');
		} finally {
			endTimer();
		}
	}

	private async getWorkspaceContext(): Promise<any> {
		const workspace = this.workspaceService.getWorkspace();
		return {
			name: workspace.folders[0]?.name || 'Unknown',
			rootPath: workspace.folders[0]?.uri.fsPath || '',
			files: [],
			gitBranch: undefined
		};
	}

	private addMessage(message: IAIMessage): void {
		console.log(`📝 Adding message: ${message.type} - ${message.content.substring(0, 50)}...`);
		
		// Get current conversation and add message
		const currentConversation = this.stateManager.getCurrentConversation();
		if (currentConversation) {
			const updatedConversation = {
				...currentConversation,
				messages: [...currentConversation.messages, message],
				updatedAt: Date.now()
			};
			this.stateManager.updateConversation(currentConversation.id, updatedConversation);
		}
		
		// Render message
		this.renderMessage(message);
		this.scrollToBottom();
	}

	private renderMessage(message: IAIMessage): void {
		const messageElement = append(this.messageList, $('.ai-message'));
		messageElement.classList.add(`ai-message-${message.type}`);
		messageElement.setAttribute('data-message-id', message.id);

		// Avatar
		const avatar = append(messageElement, $('.ai-message-avatar'));
		const avatarIcon = append(avatar, $('span.codicon'));
		avatarIcon.className = `codicon codicon-${message.type === MessageType.User ? 'account' : 'lightbulb'}`;

		// Content container
		const contentContainer = append(messageElement, $('.ai-message-content'));

		// Message content with markdown rendering
		const content = append(contentContainer, $('.ai-message-text'));
		content.textContent = this.messageFormatter.renderMarkdown(message.content);

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

	private createLayout(container: HTMLElement): void {
		// Header with mode selector and status
		const header = append(container, $('.ai-chat-header'));
		this.createModeSelector(header);
		this.createStatusIndicator(header);

		// Chat container
		this.chatContainer = append(container, $('.ai-chat-container'));
		this.messageList = append(this.chatContainer, $('.ai-message-list'));
		this.createTypingIndicator();
		this.createInputContainer(this.chatContainer);
	}

	private createStatusIndicator(header: HTMLElement): void {
		this.statusIndicator = append(header, $('.ai-status-indicator'));
		append(this.statusIndicator, $('.status-icon'));
		const statusText = append(this.statusIndicator, $('.status-text'));
		statusText.textContent = 'Connecting...';
	}

	private createModeSelector(header: HTMLElement): void {
		const modeContainer = append(header, $('.ai-mode-selector'));
		const modes = [
			{ mode: AICompanionMode.Helper, label: '🧠 Helper', icon: 'lightbulb' },
			{ mode: AICompanionMode.Builder, label: '🔨 Builder', icon: 'tools' },
		];

		modes.forEach(({ mode, label, icon }) => {
			const button = append(modeContainer, $('button.ai-mode-button')) as HTMLButtonElement;
			append(button, $('span.codicon.codicon-' + icon));
			const labelSpan = append(button, $('span.ai-mode-label'));
			labelSpan.textContent = label;
			
			// Note: Mode is not part of the state interface, so we'll handle this differently
			// For now, we'll use a simple class-based approach
			if (mode === AICompanionMode.Helper) {
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
		this.inputBox = append(this.inputContainer, $('input')) as HTMLInputElement;
		this.inputBox.placeholder = '💬 Ask me anything about your code...';

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

	private updateSendButton(): void {
		const hasContent = this.inputBox.value.trim().length > 0;
		const state = this.stateManager.getState();
		const isEnabled = hasContent && !state.ui.isTyping && this.connectionManager.isConnected();
		
		this.sendButton.disabled = !isEnabled;
		
		const sendLabel = this.sendButton.querySelector('span:not(.codicon)') as HTMLElement;
		if (sendLabel) {
			if (!this.connectionManager.isConnected()) {
				sendLabel.textContent = 'Disconnected';
			} else if (state.ui.isTyping) {
				sendLabel.textContent = 'Thinking...';
			} else {
				sendLabel.textContent = 'Send';
			}
		}
	}

	private async setMode(mode: AICompanionMode): Promise<void> {
		const timer = this.performanceMonitor.startTimer('mode-change');
		
		try {
			// Update UI to reflect mode change
			const buttons = this.element?.querySelectorAll('.ai-mode-button');
			buttons?.forEach(button => button.classList.remove('active'));
			
			const activeButton = this.element?.querySelector(`[data-mode="${mode}"]`);
			activeButton?.classList.add('active');
			
			// Emit mode change event
			this.onModeChanged(mode);
			
			timer();
		} catch (error) {
			timer();
			this.errorHandler.handleError(error as Error, 'Mode change');
		}
	}

	private onStateChanged(state: IAICompanionState): void {
		// Update UI based on state changes
		const currentState = this.stateManager.getState();
		if (state.ui.isTyping !== currentState.ui.isTyping) {
			if (state.ui.isTyping) {
				this.showTypingIndicator();
			} else {
				this.hideTypingIndicator();
			}
		}

		// Update connection status
		if (state.connectionStatus.isConnected !== currentState.connectionStatus.isConnected) {
			this.updateConnectionStatus();
		}

		// Re-render messages if conversation changed
		const currentConversation = this.stateManager.getCurrentConversation();
		if (currentConversation && currentConversation.messages.length !== currentState.conversations.length) {
			this.renderAllMessages();
		}
	}

	private onConversationChanged(conversation: IAIConversation): void {
		// Re-render all messages when conversation changes
		this.renderAllMessages();
	}

	private onModeChanged(mode: AICompanionMode): void {
		// Handle mode change - could update UI or trigger specific behaviors
		console.log(`Mode changed to: ${mode}`);
	}

	private showTypingIndicator(): void {
		this.typingIndicator.style.display = 'flex';
		this.scrollToBottom();
	}

	private hideTypingIndicator(): void {
		this.typingIndicator.style.display = 'none';
	}

	private scrollToBottom(): void {
		setTimeout(() => {
			this.messageList.scrollTop = this.messageList.scrollHeight;
		}, 100);
	}

	private updateConnectionStatus(): void {
		if (this.statusIndicator) {
			const statusIcon = this.statusIndicator.querySelector('.status-icon') as HTMLElement;
			const statusText = this.statusIndicator.querySelector('.status-text') as HTMLElement;
			
			if (statusIcon && statusText) {
				const isConnected = this.connectionManager.isConnected();
				statusIcon.style.background = isConnected ? 'var(--vscode-charts-green)' : 'var(--vscode-charts-red)';
				statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
			}
		}
	}

	private renderAllMessages(): void {
		// Clear existing messages
		this.messageList.textContent = '';
		
		// Get current conversation
		const currentConversation = this.stateManager.getCurrentConversation();
		if (currentConversation) {
			// Render all messages in the conversation
			currentConversation.messages.forEach((message: IAIMessage) => {
				this.renderMessage(message);
			});
		}
		
		this.scrollToBottom();
	}

	private showWelcomeMessage(): void {
		const welcomeDiv = append(this.messageList, $('.welcome-message'));
		const title = append(welcomeDiv, $('h3'));
		title.textContent = '🤖 AI Companion';
		
		const description = append(welcomeDiv, $('p'));
		description.textContent = `I'm here to help you build complete projects from scratch!

🔨 **Builder Mode** (Current): I'll automatically generate requirements → design → tasks → code when you ask me to build something.

🧠 **Helper Mode**: I'll guide you step by step and wait for your approval at each stage.

Try saying: "I want to build a user auth system"`;
	}

	private addModernStyles(): void {
		if (document.getElementById('ai-companion-modern-styles')) return;

		const styles = document.createElement('style');
		styles.id = 'ai-companion-modern-styles';
		styles.textContent = `
			/* Modern AI Chat Styles */
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

			/* Enhanced Markdown Styles */
			.ai-message-text h1 {
				font-size: 24px;
				font-weight: 700;
				margin: 16px 0 12px 0;
				color: var(--vscode-editor-foreground);
				border-bottom: 2px solid var(--vscode-panel-border);
				padding-bottom: 8px;
			}

			.ai-message-text h2 {
				font-size: 20px;
				font-weight: 600;
				margin: 14px 0 10px 0;
				color: var(--vscode-editor-foreground);
				border-bottom: 1px solid var(--vscode-panel-border);
				padding-bottom: 6px;
			}

			.ai-message-text h3 {
				font-size: 16px;
				font-weight: 600;
				margin: 12px 0 8px 0;
				color: var(--vscode-editor-foreground);
			}

			.ai-message-text code {
				background: var(--vscode-textCodeBlock-background);
				color: var(--vscode-textCodeBlock-foreground);
				padding: 2px 6px;
				border-radius: 4px;
				font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
				font-size: 13px;
				border: 1px solid var(--vscode-panel-border);
			}

			.ai-message-text pre {
				background: var(--vscode-textCodeBlock-background);
				border: 1px solid var(--vscode-panel-border);
				border-radius: 8px;
				padding: 16px;
				margin: 12px 0;
				overflow-x: auto;
				position: relative;
			}

			.ai-message-text pre code {
				background: none;
				border: none;
				padding: 0;
				font-size: 13px;
				line-height: 1.5;
			}

			.ai-message-text ul, .ai-message-text ol {
				margin: 8px 0;
				padding-left: 24px;
			}

			.ai-message-text li {
				margin: 4px 0;
				line-height: 1.5;
			}

			.ai-message-text blockquote {
				border-left: 4px solid var(--vscode-charts-blue);
				margin: 12px 0;
				padding: 8px 16px;
				background: var(--vscode-editor-inactiveSelectionBackground);
				border-radius: 0 8px 8px 0;
				font-style: italic;
			}

			.ai-message-text a {
				color: var(--vscode-textLink-foreground);
				text-decoration: none;
				border-bottom: 1px solid transparent;
				transition: border-bottom-color 0.2s ease;
			}

			.ai-message-text a:hover {
				border-bottom-color: var(--vscode-textLink-foreground);
			}

			.ai-message-text del {
				text-decoration: line-through;
				opacity: 0.7;
			}

			.ai-message-text strong {
				font-weight: 600;
				color: var(--vscode-editor-foreground);
			}

			.ai-message-text em {
				font-style: italic;
				color: var(--vscode-editor-foreground);
			}
		`;
		document.head.appendChild(styles);
	}

	private applyBeautifulTheme(container: HTMLElement): void {
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