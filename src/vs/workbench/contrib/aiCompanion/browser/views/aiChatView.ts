import { Emitter, Event } from '../../../../../base/common/event.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IAICompanionService, IAIMessage, AICompanionMode } from '../../common/aiCompanionService.js';
import { ViewPane, IViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { localize } from '../../../../../nls.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { MarkdownRenderer } from '../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';

// Import our new services
import { BackendCommunicationService, IBackendCommunicationService } from '../services/backendCommunicationService.js';
import { StreamingResponseService } from '../services/streamingResponseService.js';
import { WorkflowDetectionService, WorkflowFormattingService, WorkflowType } from '../services/workflowService.js';
import { ResponseCachingService } from '../services/cachingService.js';
import { PerformanceMonitoringService } from '../services/performanceMonitoringService.js';
import { ContextService } from '../services/contextService.js';
import { ConnectionPoolService } from '../services/connectionPoolService.js';
import { UIService } from '../services/uiService.js';
import { MessageService } from '../services/messageService.js';

/**
 * AIChatView - Clean separation of concerns
 * 
 * This view is focused ONLY on orchestrating services and handling user interactions.
 * All business logic is delegated to specialized services.
 */
export class AIChatView extends ViewPane {
	static readonly ID = 'aiCompanion.chatView';

	private readonly _onDidChangeInput = this._register(new Emitter<string>());
	readonly onDidChangeInput: Event<string> = this._onDidChangeInput.event;

	// UI Elements
	private messageList!: HTMLElement;
	private inputContainer!: HTMLElement;
	private inputBox!: HTMLInputElement;
	private sendButton!: HTMLButtonElement;

	// Core services
	private readonly aiCompanionService: IAICompanionService;

	// Specialized services
	private readonly backendService: IBackendCommunicationService;
	private readonly streamingService: StreamingResponseService;
	private readonly workflowDetector: WorkflowDetectionService;
	private readonly workflowFormatter: WorkflowFormattingService;
	private readonly cachingService: ResponseCachingService;
	private readonly contextService: ContextService;
	private readonly connectionPool: ConnectionPoolService;
	private readonly markdownRenderer: MarkdownRenderer;
	private readonly uiService: UIService;
	private readonly messageService: MessageService;

	// State
	private currentMode: AICompanionMode = AICompanionMode.Builder;
	private streamingEnabled: boolean = true;

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

		// Initialize core services
		this.aiCompanionService = aiCompanionService;

		// Initialize specialized services
		this.backendService = new BackendCommunicationService(workspaceService, configurationService);
		this.streamingService = new StreamingResponseService();
		this.workflowDetector = new WorkflowDetectionService();
		this.workflowFormatter = new WorkflowFormattingService();
		this.cachingService = new ResponseCachingService();
		this.contextService = new ContextService(workspaceService);
		this.connectionPool = new ConnectionPoolService();
		this.markdownRenderer = instantiationService.createInstance(MarkdownRenderer, {});
		this.uiService = new UIService();
		this.messageService = new MessageService();

		this.streamingEnabled = this.configurationService.getValue<boolean>('aiCompanion.backend.streaming') ?? true;

		// Initialize services
		this.initializeServices();

		// Listen to events
		this._register(this.aiCompanionService.onDidChangeConversation(this.onConversationChanged, this));
		this._register(this.aiCompanionService.onDidChangeState(this.onStateChanged, this));
		this._register(this.aiCompanionService.onDidChangeMode(this.onModeChanged, this));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		// Add modern styles and theme
		this.uiService.addModernStyles();
		container.classList.add('ai-companion-chat-view');
		this.uiService.applyBeautifulTheme(container);

		// Create layout using UI service
		const layout = this.uiService.createLayout(container);
		this.messageList = layout.messageList;
		this.inputContainer = layout.inputContainer;

		// Create mode selector
		this.uiService.createModeSelector(
			container.querySelector('.ai-chat-header')!,
			this.currentMode,
			(mode) => this.setMode(mode)
		);

		// Create input controls
		const inputControls = this.uiService.createInputContainer(
			this.inputContainer,
			() => this.sendMessage(),
			(value) => {
				this._onDidChangeInput.fire(value);
				this.updateSendButton();
			}
		);
		this.inputBox = inputControls.inputBox;
		this.sendButton = inputControls.sendButton;

		// Show welcome message
		this.uiService.showWelcomeMessage(this.messageList);

		// Initial UI update
		this.updateSendButton();
	}

	private async initializeServices(): Promise<void> {
		try {
			// Initialize backend service
			await this.backendService.initialize();

			// Check streaming endpoint
			const streamingAvailable = await this.backendService.checkStreamingEndpoint();
			if (this.streamingEnabled && !streamingAvailable) {
				console.warn('⚠️ Streaming endpoint does not exist, disabling streaming');
				this.streamingEnabled = false;
			} else if (streamingAvailable) {
				console.log('✅ Streaming endpoint available, streaming enabled');
			}

			// Preload context in background
			this.contextService.preloadWorkspaceContext().catch(console.error);

			// Update UI connection status
			this.uiService.updateConnectionStatus(
				this.backendService.isSessionConnected(),
				this.backendService.isSessionConnected() ? 'Connected' : 'Disconnected'
			);

		} catch (error) {
			console.error('❌ Service initialization error:', error);
		}
	}

	private async sendMessage(): Promise<void> {
		const content = this.inputBox.value.trim();
		if (!content || !this.backendService.isSessionConnected()) {
			console.log('❌ Cannot send message:', {
				hasContent: !!content,
				isConnected: this.backendService.isSessionConnected(),
				sessionId: this.backendService.getSessionId()
			});
			return;
		}

		// Clear input and add user message
		this.inputBox.value = '';
		this.updateSendButton();
		
		const userMessage = this.messageService.createUserMessage(content);
		this.addMessage(userMessage);

		// Detect workflow type
		const workflowType: WorkflowType = this.workflowDetector.detectWorkflowType(content);
		console.log('🔍 Detected workflow type:', workflowType);
		
		if (workflowType !== 'chat') {
			await this.handleStructuredWorkflow(workflowType, content);
		} else {
			await this.handleChatMessage(content);
		}
	}

	private async handleStructuredWorkflow(workflowType: WorkflowType, content: string): Promise<void> {
		console.log(`🚀 Starting structured workflow: ${workflowType}`);
		
		// For Builder mode, automatically continue through all steps
		if (this.currentMode === AICompanionMode.Builder && workflowType === 'requirements') {
			await this.handleFullBuilderWorkflow(content);
		} else {
			// Use streaming for better user experience
			await this.handleStreamingWorkflow(workflowType, content);
		}
	}

	private async handleFullBuilderWorkflow(content: string): Promise<void> {
		console.log('🔨 Builder mode - starting sequential workflow');
		
		try {
			// Step 1: Generate requirements
			console.log('📋 Step 1: Generating requirements...');
			const requirementsResponse = await this.handleStreamingWorkflow('requirements', content);
			
			if (!requirementsResponse) {
				console.error('❌ Requirements generation failed, stopping workflow');
				return;
			}
			
			// Step 2: Generate design
			console.log('🏗️ Step 2: Generating design...');
			const designResponse = await this.handleStreamingWorkflow('design', 
				`Based on these requirements:\n${requirementsResponse}\n\nGenerate the design for: ${content}`);
			
			if (!designResponse) {
				console.error('❌ Design generation failed, stopping workflow');
				return;
			}
			
			// Step 3: Generate tasks
			console.log('📝 Step 3: Generating tasks...');
			const tasksResponse = await this.handleStreamingWorkflow('tasks', 
				`Requirements:\n${requirementsResponse}\n\nDesign:\n${designResponse}\n\nGenerate tasks for: ${content}`);
			
			if (!tasksResponse) {
				console.error('❌ Tasks generation failed, stopping workflow');
				return;
			}
			
			// Step 4: Generate code
			console.log('💻 Step 4: Generating code...');
			await this.handleStreamingWorkflow('code', 
				`Requirements:\n${requirementsResponse}\n\nDesign:\n${designResponse}\n\nTasks:\n${tasksResponse}\n\nGenerate code for: ${content}`);
			
			console.log('✅ Full workflow complete');
			
		} catch (error) {
			console.error('Full workflow failed:', error);
			this.showError(`Workflow failed: ${this.messageService.getErrorMessage(error)}`);
		}
	}

	private async handleStreamingWorkflow(workflowType: WorkflowType, content: string): Promise<any> {
		const endTimer = PerformanceMonitoringService.startTimer(`${workflowType}-workflow`);
		
		try {
			// Check cache first
			const cacheKey = this.cachingService.getCacheKey(workflowType, content);
			const cached = await this.cachingService.getFromCache(cacheKey);
			if (cached) {
				const cachedMessage = this.messageService.createAssistantMessage(
					`🧠 **Generated ${workflowType}** (Cached)\n\n${cached.content}`
				);
				this.addMessage(cachedMessage);
				endTimer();
				return cached.content;
			}

			// Check connection pool
			if (!this.connectionPool.canMakeRequest()) {
				this.showError('Too many concurrent requests. Please wait a moment.');
				endTimer();
				return null;
			}

			// Create streaming message
			const streamingMessage = this.messageService.createStreamingMessage(workflowType);
			this.addMessage(streamingMessage);
			const messageElement = this.uiService.getMessageElement(this.messageList, streamingMessage.id);
			const contentElement = messageElement?.querySelector('.ai-message-text') as HTMLElement;

			// Get connection and context
			const connectionId = this.connectionPool.getConnectionId(workflowType);
			this.connectionPool.createConnection(connectionId);
			const context = await this.contextService.getPreloadedContext();

			try {
				// Try streaming if enabled
				if (this.streamingEnabled) {
					console.log('🚀 Attempting streaming request...');
					const response = await this.backendService.createStreamingRequest(workflowType, content, context);

					if (response.ok) {
						// Process streaming response
						await this.streamingService.processStreamingResponse(
							response,
							contentElement,
							workflowType,
							(content, type, isFinal) => this.workflowFormatter.formatStreamingContent(content, type as WorkflowType, isFinal),
							(content) => this.renderMarkdownContent(content)
						);
						
						// Cache the content
						const finalContent = contentElement?.textContent || contentElement?.innerHTML || '';
						this.cachingService.setCache(cacheKey, { content: finalContent });
						endTimer();
						return finalContent;
					} else {
						console.log(`⚠️ Streaming failed (${response.status}), falling back to regular API`);
					}
				}

				// Fallback to regular API
				const fallbackResult = await this.handleStreamingFallback(workflowType, content, contentElement);
				endTimer();
				return fallbackResult;

			} catch (error: any) {
				if (error.name === 'AbortError') {
					console.log('Request was aborted');
				} else {
					console.log(`⚠️ Streaming error: ${error.message}, falling back to regular API`);
					const fallbackResult = await this.handleStreamingFallback(workflowType, content, contentElement);
					endTimer();
					return fallbackResult;
				}
			} finally {
				this.connectionPool.removeConnection(connectionId);
			}

		} catch (error) {
			endTimer();
			throw error;
		}
	}

	private async handleStreamingFallback(workflowType: WorkflowType, content: string, contentElement: HTMLElement): Promise<any> {
		try {
			console.log(`🔄 Starting fallback for ${workflowType}`);
			
			// Check cache first
			const cacheKey = this.cachingService.getCacheKey(workflowType, content);
			const cached = await this.cachingService.getFromCache(cacheKey);
			
			if (cached) {
				console.log(`✅ Using cached content for ${workflowType}`);
				const finalContent = `🧠 **Generated ${workflowType}** (Cached)\n\n${cached.content}`;
				this.updateStreamingContent(contentElement, this.renderMarkdownContent(finalContent));
				return cached.content;
			}

			// Use regular API as fallback
			console.log(`🚀 Making API call for ${workflowType}...`);
			const response = await this.backendService.callAPI(workflowType, content, this.currentMode);
			console.log(`✅ API response received for ${workflowType}`);
			
			// Format the response
			let formattedContent: string;
			try {
				const parsedContent = JSON.parse(response.content);
				formattedContent = this.workflowFormatter.formatWorkflowResponse(parsedContent, workflowType);
			} catch (e) {
				// If it's not JSON, use content as-is
				formattedContent = response.content;
			}
			
			const finalContent = `🧠 **Generated ${workflowType}**\n\n${formattedContent}`;
			
			// Update the content element
			this.updateStreamingContent(contentElement, this.renderMarkdownContent(finalContent));
			
			// Cache the result
			this.cachingService.setCache(cacheKey, { content: formattedContent });
			
			return formattedContent;
			
		} catch (error) {
			console.error(`Fallback API call failed for ${workflowType}:`, error);
			// Show fallback content
			const fallbackContent = this.workflowDetector.getFallbackContent(workflowType, content);
			this.updateStreamingContent(contentElement, this.renderMarkdownContent(fallbackContent));
			return fallbackContent;
		}
	}

	private async handleChatMessage(content: string): Promise<void> {
		this.uiService.showTypingIndicator();
		
		try {
			const response = await this.backendService.callAPI('chat', content, this.currentMode);
			
			const aiMessage = this.messageService.createAssistantMessage(
				response.content,
				{
					usage: response.usage,
					requestId: response.requestId,
					model: response.model,
					finishReason: response.finishReason
				}
			);
			
			this.addMessage(aiMessage);
		} catch (error) {
			console.error('Failed to send message:', error);
			this.showError(this.messageService.getErrorMessage(error));
		} finally {
			this.uiService.hideTypingIndicator();
		}
	}

	private addMessage(message: IAIMessage): void {
		this.messageService.addMessage(message);
		this.messageService.renderMessage(
			message, 
			this.messageList, 
			(content) => this.renderMarkdownContent(content)
		);
		this.uiService.scrollToBottom(this.messageList);
	}

	private showError(message: string): void {
		const errorMessage = this.messageService.createErrorMessage(message);
		this.addMessage(errorMessage);
	}

	private updateSendButton(): void {
		const hasContent = this.inputBox.value.trim().length > 0;
		const isConnected = this.backendService.isSessionConnected();
		
		this.uiService.updateSendButton(this.sendButton, hasContent, isConnected);
	}

	private async setMode(mode: AICompanionMode): Promise<void> {
		this.currentMode = mode;
		await this.aiCompanionService.setMode(mode);
		
		// Update UI
		this.uiService.updateModeButtons(this.element!, mode);

		// Show mode change message
		const modeMessage = this.messageService.createSystemMessage(
			`🔄 **Mode Changed to ${mode}**\n\n${mode === AICompanionMode.Builder 
				? '🔨 **Builder Mode**: I will automatically generate requirements → design → tasks → code when you request to build something.'
				: '🧠 **Helper Mode**: I will assist and guide you step by step.'
			}`
		);
		
		this.addMessage(modeMessage);
	}

	private updateStreamingContent(element: HTMLElement, content: HTMLElement): void {
		if (element) {
			element.style.opacity = '0.9';
			element.style.transform = 'translateY(1px)';
			
			// Clear existing content safely
			while (element.firstChild) {
				element.removeChild(element.firstChild);
			}
			
			// Append new content
			element.appendChild(content);
			element.style.opacity = '1';
			element.style.transform = 'translateY(0)';
			element.style.transition = 'all 0.2s ease-out';
			
			this.uiService.scrollToBottom(this.messageList);
			
			setTimeout(() => {
				element.style.transition = '';
			}, 200);
		}
	}

	// Helper method to render markdown content using VS Code's trusted renderer
	private renderMarkdownContent(content: string): HTMLElement {
		try {
			const markdownString = new MarkdownString(content, { isTrusted: true });
			const result = this.markdownRenderer.render(markdownString);
			
			// Register the disposable for cleanup
			this._register(result);
			
			return result.element;
		} catch (error) {
			console.warn('Markdown rendering failed, falling back to plain text:', error);
			const fallbackElement = document.createElement('span');
			fallbackElement.textContent = content;
			return fallbackElement;
		}
	}

	// Event handlers
	private onConversationChanged(conversation: any): void {
		if (conversation?.messages) {
			// Update message service and re-render
			this.messageService.clearMessages();
			conversation.messages.forEach((msg: IAIMessage) => {
				this.messageService.addMessage(msg);
			});
			this.messageService.renderAllMessages(
				this.messageList, 
				(content) => this.renderMarkdownContent(content)
			);
		}
	}

	private onStateChanged(state: any): void {
		if (state === 'generating' || state === 'thinking') {
			this.uiService.showTypingIndicator();
		} else {
			this.uiService.hideTypingIndicator();
		}
	}

	private onModeChanged(mode: AICompanionMode): void {
		this.currentMode = mode;
		this.uiService.updateModeButtons(this.element!, mode);
	}

	// ViewPane overrides
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
		// Cleanup services
		this.cachingService.clearCache();
		this.connectionPool.dispose();
		this.backendService.dispose();
		super.dispose();
	}
}