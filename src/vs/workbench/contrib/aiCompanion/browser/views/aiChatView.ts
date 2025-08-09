import { Emitter, Event } from '../../../../../base/common/event.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IAICompanionService, AICompanionMode, IAITask } from '../../common/aiCompanionService.js';
import { ViewPane, IViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { localize } from '../../../../../nls.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ICodeSearchService } from '../../common/codeSearchService.js';
import { IAINotificationService } from '../../common/aiNotificationService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
// Removed markdown renderer imports to avoid disposal issues
import { append, $ } from '../../../../../base/browser/dom.js';
import { safeSetInnerHtml } from '../../../../../base/browser/domSanitize.js';
import { MarkdownRenderer } from '../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js';
import { IMarkdownString } from '../../../../../base/common/htmlContent.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';

// Import our services
import { IBackendCommunicationService } from '../services/backendCommunicationService.js';
import { MockBackendCommunicationService } from '../services/mockBackendCommunicationService.js';
import { StreamingResponseService } from '../services/streamingResponseService.js';
import { WorkflowDetectionService, WorkflowFormattingService, WorkflowType } from '../services/workflowService.js';
import { ResponseCachingService } from '../services/cachingService.js';
import { PerformanceMonitoringService } from '../services/performanceMonitoringService.js';
import { ContextService } from '../services/contextService.js';
import { ConnectionPoolService } from '../services/connectionPoolService.js';
import { UIService } from '../services/uiService.js';
import { MessageService } from '../services/messageService.js';

// Import utilities
import { 
	ContextWindowUtils, 
	ErrorUtils 
} from '../utils/index.js';

/**
 * Modern AIChatView - Rune/Cursor Style Interface
 * 
 * This view creates a modern chat interface similar to Cursor AI or Claude,
 * with floating input, workflow indicators, and clean messaging.
 */
export class AIChatView extends ViewPane {
	static readonly ID = 'aiCompanion.chatView';

	private readonly _onDidChangeInput = this._register(new Emitter<string>());
	readonly onDidChangeInput: Event<string> = this._onDidChangeInput.event;

	// UI Elements
	private messageList!: HTMLElement;
	private inputContainer!: HTMLElement;
	private inputBox!: HTMLTextAreaElement;
	private sendButton!: HTMLButtonElement;
	private welcomeScreen!: HTMLElement;

	// Core services
	private readonly aiCompanionService: IAICompanionService;
	private readonly workspaceService: IWorkspaceContextService;
	private readonly markdownRenderer: MarkdownRenderer;

	// Specialized services
	private readonly backendService: IBackendCommunicationService;
	private readonly streamingService: StreamingResponseService;
	private readonly workflowDetector: WorkflowDetectionService;
	private readonly workflowFormatter: WorkflowFormattingService;
	private readonly cachingService: ResponseCachingService;
	private readonly contextService: ContextService;
	private readonly connectionPool: ConnectionPoolService;
	// Removed markdownRenderer property to avoid disposal issues
	private readonly uiService: UIService;
	private readonly messageService: MessageService;

	// State
	private currentMode: AICompanionMode = AICompanionMode.Builder;
	private streamingEnabled: boolean = true;
	private isGenerating: boolean = false;

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
		@ICodeSearchService codeSearchService: ICodeSearchService,
		@IAINotificationService aiNotificationService: IAINotificationService,
		@ILogService logService: ILogService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		// Initialize core services
		this.aiCompanionService = aiCompanionService;
		this.workspaceService = workspaceService;

		// Initialize specialized services
		this.backendService = new MockBackendCommunicationService(
			workspaceService, 
			configurationService,
			codeSearchService,
			aiNotificationService,
			logService
		);
		this.streamingService = new StreamingResponseService();
		this.workflowDetector = new WorkflowDetectionService();
		
		// Initialize markdown renderer
		this.markdownRenderer = new MarkdownRenderer({}, instantiationService.invokeFunction(accessor => accessor.get(ILanguageService)), openerService);
		this.workflowFormatter = new WorkflowFormattingService();
		this.cachingService = new ResponseCachingService();
		this.contextService = new ContextService(workspaceService);
		this.connectionPool = new ConnectionPoolService();
		// Removed markdown renderer initialization to avoid disposal issues
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

		// Show welcome message first
		this.uiService.showWelcomeMessage(this.messageList);
		this.welcomeScreen = this.messageList.querySelector('.welcome-screen') as HTMLElement;

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

		// Connect suggestion cards to the input system
		this.connectSuggestionCards();

		// Initial UI update
		this.updateSendButton();
	}

	private connectSuggestionCards(): void {
		// Find all suggestion cards and connect them to the input
		const suggestionCards = this.messageList.querySelectorAll('.suggestion-card');
		suggestionCards.forEach((card, index) => {
			const suggestions = [
				'Build a user authentication system',
				'Create a REST API for a blog',
				'Build a React dashboard', 
				'Set up CI/CD pipeline'
			];
			
			card.addEventListener('click', () => {
				this.sendSuggestion(suggestions[index]);
			});
		});
	}

	private sendSuggestion(text: string): void {
		this.inputBox.value = text;
		this.inputBox.style.height = 'auto';
		this.inputBox.style.height = Math.min(this.inputBox.scrollHeight, 120) + 'px';
		this.updateSendButton();
		this.inputBox.focus();
		
		// Trigger the send
		setTimeout(() => this.sendMessage(), 100);
	}

	private async initializeServices(): Promise<void> {
		try {
			// Initialize AI Companion service first
			const workspace = this.workspaceService.getWorkspace();
			if (workspace.folders.length > 0) {
				const workspaceUri = workspace.folders[0].uri;
				console.log('🔍 DEBUG Initializing AI Companion service with workspace:', workspaceUri.toString());
				await this.aiCompanionService.initialize(workspaceUri);
				console.log('✅ AI Companion service initialized successfully');
			} else {
				console.warn('⚠️ No workspace folders found, cannot initialize AI Companion service');
			}

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

		try {
			// Hide welcome screen on first message
			if (this.welcomeScreen && this.welcomeScreen.style.display !== 'none') {
				this.welcomeScreen.style.display = 'none';
			}

			// Check context window before sending
			const messages = await this.aiCompanionService.getMessages();
			const currentTokens = ContextWindowUtils.estimateTokenCount(
				messages.map(m => m.content).join(' ')
			);
			
			const boundaries = ContextWindowUtils.detectTokenBoundaries(currentTokens);
			if (boundaries.recommendedAction === 'prune') {
				console.warn(`⚠️ Context window approaching limit (${currentTokens} tokens)`);
				this.showError('Conversation is getting long. Consider starting a new chat for better performance.');
		}

		// Clear input and add user message
		this.inputBox.value = '';
			this.inputBox.style.height = 'auto';
		this.updateSendButton();
		
			// Add user message with modern styling
			this.addUserMessage(content);

		// Detect workflow type
		const workflowType: WorkflowType = this.workflowDetector.detectWorkflowType(content);
		console.log('🔍 Detected workflow type:', workflowType);
		
			// Set generating state
			this.isGenerating = true;
			this.updateSendButton();

			if (workflowType !== 'chat' && this.isWorkflowRequest(content)) {
			await this.handleStructuredWorkflow(workflowType, content);
		} else {
			await this.handleChatMessage(content);
		}

		} catch (error) {
			console.log('🔍 DEBUG sendMessage caught error:', error);
			ErrorUtils.logError(error as Error, 'sendMessage');
			const errorMessage = ErrorUtils.getErrorMessage(error as Error);
			this.showError(errorMessage);
		} finally {
			this.isGenerating = false;
			this.updateSendButton();
		}
	}

	private isWorkflowRequest(content: string): boolean {
		const lowerContent = content.toLowerCase();
		return (
			lowerContent.includes('build') || 
			lowerContent.includes('create') || 
			lowerContent.includes('auth') || 
			lowerContent.includes('api') || 
			lowerContent.includes('dashboard') ||
			lowerContent.includes('pipeline')
		);
	}

	private async handleStructuredWorkflow(workflowType: WorkflowType, content: string): Promise<void> {
		console.log(`🚀 Starting structured workflow: ${workflowType}`);
		
		// Show workflow progress
		this.uiService.showWorkflowProgress(this.messageList);
		
		// For Builder mode, automatically continue through all steps
		if (this.currentMode === AICompanionMode.Builder && workflowType === 'requirements') {
			await this.handleFullBuilderWorkflow(content);
		} else {
			// Use streaming for better user experience
			const response = await this.handleStreamingWorkflow(workflowType, content);
			
			// If this is a code generation workflow, actually create the files
			if (workflowType === 'code' && response) {
				try {
					console.log('📁 Creating files for code generation...');
					
					// Create basic tasks for code generation
					const mockTasks: IAITask[] = [
						{
							id: 'standalone-task-1',
							title: 'Generate Project Files',
							description: 'Generate the requested project files',
							filePath: 'package.json',
							completed: false,
							createdAt: Date.now()
						}
					];
					
					// Call the AICompanionService to actually generate files
					await this.aiCompanionService.generateCode(mockTasks);
					console.log('✅ Files created successfully!');
					
				} catch (error) {
					console.error('❌ Failed to create files:', error);
					this.addAssistantMessage(`❌ Failed to create files: ${error}`);
				}
			}
		}
		

	}

	private async handleFullBuilderWorkflow(content: string): Promise<void> {
		console.log('🔨 Builder mode - starting sequential workflow');
		
		// Show workflow progress at the start
		this.uiService.showWorkflowProgress(this.messageList);
		this.uiService.resetWorkflowProgress();
		
		// Clear any previous workflow context for fresh start
		this.aiCompanionService.clearWorkflowContext();
		
		try {
			// Step 1: Generate requirements with smooth progress
			console.log('📋 Step 1: Generating requirements...');
			const requirementsResponse = await this.handleStreamingWorkflow('requirements', content);
			
			if (!requirementsResponse) {
				console.error('❌ Requirements generation failed, stopping workflow');
				return;
			}
			
			// Call AI service to generate and store requirements
			try {
				await this.aiCompanionService.generateRequirements(content);
				console.log('✅ Requirements stored successfully');
			} catch (error) {
				console.error('❌ Failed to store requirements:', error);
			}
			
			// Brief pause between steps for visual clarity
			await this.delay(500);
			
			// Step 2: Generate design
			console.log('🏗️ Step 2: Generating design...');
			const designResponse = await this.handleStreamingWorkflow('design', 
				`Based on these requirements:\n${requirementsResponse}\n\nGenerate the design for: ${content}`);
			
			if (!designResponse) {
				console.error('❌ Design generation failed, stopping workflow');
				return;
			}
			
			// Call AI service to generate and store design
			try {
				const storedRequirements = this.aiCompanionService.getStoredRequirements();
				if (storedRequirements) {
					await this.aiCompanionService.generateDesign(storedRequirements);
					console.log('✅ Design stored successfully using stored requirements');
				} else {
					console.error('❌ No stored requirements found for design generation');
				}
			} catch (error) {
				console.error('❌ Failed to store design:', error);
			}
			
			await this.delay(500);
			
			// Step 3: Generate tasks
			console.log('📝 Step 3: Generating tasks...');
			const tasksResponse = await this.handleStreamingWorkflow('tasks', 
				`Requirements:\n${requirementsResponse}\n\nDesign:\n${designResponse}\n\nGenerate tasks for: ${content}`);
			
			if (!tasksResponse) {
				console.error('❌ Tasks generation failed, stopping workflow');
				return;
			}
			
			// Call AI service to generate and store tasks
			try {
				const storedRequirements = this.aiCompanionService.getStoredRequirements();
				const storedDesign = this.aiCompanionService.getStoredDesign();
				if (storedRequirements && storedDesign) {
					await this.aiCompanionService.generateTasks(storedRequirements, storedDesign);
					console.log('✅ Tasks stored successfully using stored requirements and design');
				} else {
					console.error('❌ No stored requirements or design found for task generation');
				}
			} catch (error) {
				console.error('❌ Failed to store tasks:', error);
			}
			
			await this.delay(500);
			
			// Step 4: Generate code
			console.log('💻 Step 4: Generating code...');
			const codeResponse = await this.handleStreamingWorkflow('code', 
				`Requirements:\n${requirementsResponse}\n\nDesign:\n${designResponse}\n\nTasks:\n${tasksResponse}\n\nGenerate code for: ${content}`);
			
			// Step 5: Actually create the files using AICompanionService
			if (codeResponse && tasksResponse) {
				try {
					console.log('📁 Step 5: Creating files on disk...');
					
					// Parse the tasks response to create mock tasks
					const mockTasks: IAITask[] = [
						{
							id: 'task-1',
							title: 'Project Setup and Configuration',
							description: 'Initialize the project structure and configuration',
							filePath: 'package.json',
							completed: false,
							createdAt: Date.now()
						},
						{
							id: 'task-2', 
							title: 'Database Schema and Models',
							description: 'Design and implement database schema with Prisma',
							filePath: 'prisma/schema.prisma',
							completed: false,
							createdAt: Date.now()
						},
						{
							id: 'task-3',
							title: 'Authentication System Backend', 
							description: 'Implement JWT-based authentication',
							filePath: 'server/controllers/auth.ts',
							completed: false,
							createdAt: Date.now()
						}
					];
					
					// Call the AICompanionService to actually generate files
					await this.aiCompanionService.generateCode(mockTasks);
					console.log('✅ Files created successfully!');
					
				} catch (error) {
					console.error('❌ Failed to create files:', error);
					this.addAssistantMessage(`❌ Failed to create files: ${error}`);
				}
			}
			
			console.log('✅ Full workflow complete');
			
			// Optional: Hide workflow progress after completion with delay
			setTimeout(() => {
				this.uiService.hideWorkflowProgress();
			}, 3000);
			
		} catch (error) {
			console.error('Full workflow failed:', error);
			this.showError(`Workflow failed: ${this.messageService.getErrorMessage(error)}`);
		}
	}
	// Removed generateMockResponse as it's not being used

	private async handleStreamingWorkflow(workflowType: WorkflowType, content: string): Promise<any> {
		this.isGenerating = true;
		this.updateSendButton();
		
		const endTimer = PerformanceMonitoringService.startTimer(`${workflowType}-workflow`);
		
		try {
			// Show workflow progress and reset for smooth animation
			if (workflowType === 'requirements' && this.currentMode === AICompanionMode.Builder) {
				this.uiService.showWorkflowProgress(this.messageList);
				this.uiService.resetWorkflowProgress();
			}
			console.log(`🔍 DEBUG handleStreamingWorkflow called with:`, {
				workflowType,
				contentLength: content.length,
				streamingEnabled: this.streamingEnabled,
				isConnected: this.backendService.isSessionConnected()
			});

			// Check cache first
			const cacheKey = this.cachingService.getCacheKey(workflowType, content);
			const cached = await this.cachingService.getFromCache(cacheKey);
			if (cached) {
				console.log(`✅ Using cached content for ${workflowType}`);
				const cachedMessage = this.messageService.createAssistantMessage(
					`🧠 **Generated ${workflowType}** (Cached)\n\n${cached.content}`
				);
				this.addMessage(cachedMessage);
				endTimer();
				return cached.content;
			}

			// Check connection pool
			if (!this.connectionPool.canMakeRequest()) {
				console.log('❌ Connection pool limit reached');
				this.showError('Too many concurrent requests. Please wait a moment.');
				endTimer();
				return null;
			}


			
			// Hide thinking indicator since we're starting streaming
			this.uiService.hideThinkingIndicator();

			// Create streaming message
			console.log('📝 Creating streaming message...');
			const streamingMessage = this.messageService.createStreamingMessage(workflowType);
			console.log('🔍 DEBUG Streaming message created:', {
				id: streamingMessage.id,
				type: streamingMessage.type,
				content: streamingMessage.content?.substring(0, 50)
			});
			
			this.addMessage(streamingMessage);
			
			// Wait a bit for DOM to update
			await new Promise(resolve => setTimeout(resolve, 10));
			
			const messageElement = this.getMessageElement(this.messageList, streamingMessage.id);
			const contentElement = messageElement?.querySelector('.message-content') as HTMLElement;
			
			console.log('🔍 DEBUG Message element found:', {
				messageElement: !!messageElement,
				contentElement: !!contentElement,
				messageId: streamingMessage.id,
				messageListChildren: this.messageList.children.length
			});
			
			// If we can't find the element, try to find it by class
			if (!contentElement) {
				console.log('🔍 DEBUG Trying alternative element search...');
				const allMessages = this.messageList.querySelectorAll('.message.assistant');
				console.log('🔍 DEBUG Found assistant messages:', allMessages.length);
				
				if (allMessages.length > 0) {
					const lastMessage = allMessages[allMessages.length - 1] as HTMLElement;
					const altContentElement = lastMessage.querySelector('.message-content') as HTMLElement;
					console.log('🔍 DEBUG Alternative content element:', !!altContentElement);
					
					if (altContentElement) {
						// Use the alternative element
						console.log('✅ Using alternative content element');
						return this.handleStreamingWorkflowWithElement(workflowType, content, altContentElement, endTimer, cacheKey);
					}
				}
			}

			// Get connection and context
			const connectionId = this.connectionPool.getConnectionId(workflowType);
			this.connectionPool.createConnection(connectionId);
			const context = await this.contextService.getPreloadedContext();

			try {
				// Try streaming if enabled
				if (this.streamingEnabled) {
					console.log('🚀 Attempting streaming request...');
					const response = await this.backendService.createStreamingRequest(workflowType, content, context);

					console.log('🔍 DEBUG Streaming response received:', {
						ok: response.ok,
						status: response.status,
						statusText: response.statusText,
						headers: Object.fromEntries(response.headers.entries())
					});

					if (response.ok) {
					console.log('✅ Streaming response OK, processing...');
					
					// Start independent progress animation
					const stepIndex = this.getStepIndex(workflowType);
					this.uiService.startIndependentProgress(stepIndex); // Use default 25 second duration
					
						// Process streaming response
						await this.streamingService.processStreamingResponse(
							response,
							contentElement,
							workflowType,
						(content, type, isFinal) => {
							// For code generation, format as file content
							if (workflowType === 'code') {
								return this.formatCodeGeneration(content, type as WorkflowType, isFinal);
							}
							return this.workflowFormatter.formatStreamingContent(content, type as WorkflowType, isFinal);
						},
							(content) => this.renderMarkdownContent(content)
						);
					
					// Complete the progress when streaming ends
					this.uiService.completeProgress(stepIndex);
						
						// Cache the content
						const finalContent = contentElement?.textContent || contentElement?.innerHTML || '';
						console.log('💾 Caching final content, length:', finalContent.length);
						console.log('🔍 DEBUG Final content preview:', finalContent.substring(0, 100));
						
						if (!finalContent || finalContent.trim().length === 0) {
							console.error('❌ Final content is empty, this indicates a streaming processing issue');
							throw new Error('Streaming response produced empty content');
						}
						
						this.cachingService.setCache(cacheKey, { content: finalContent });
						endTimer();
						return finalContent;
					} else {
						console.log(`⚠️ Streaming failed (${response.status}), falling back to regular API`);
					}
				}

				// Fallback to regular API
				console.log('🔄 Falling back to regular API...');
				const fallbackResult = await this.handleStreamingFallback(workflowType, content, contentElement);
				console.log('🔍 DEBUG Fallback result:', {
					hasResult: !!fallbackResult,
					resultType: typeof fallbackResult,
					resultLength: fallbackResult ? fallbackResult.length : 0
				});
				endTimer();
				return fallbackResult;

			} catch (error: any) {
				console.log('🔍 DEBUG Streaming error caught:', {
					errorName: error.name,
					errorMessage: error.message,
					errorStack: error.stack
				});
				
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
			console.log('🔍 DEBUG Main workflow error caught:', {
				errorName: error.name,
				errorMessage: error.message,
				errorStack: error.stack
			});
			endTimer();
			this.isGenerating = false;
			this.updateSendButton();
			throw error;
		} finally {
			this.isGenerating = false;
			this.updateSendButton();
		}
	}

	private async handleStreamingFallback(workflowType: WorkflowType, content: string, contentElement?: HTMLElement): Promise<any> {
		try {
			console.log(`🔄 Starting fallback for ${workflowType}`);
			
			// Check cache first
			const cacheKey = this.cachingService.getCacheKey(workflowType, content);
			const cached = await this.cachingService.getFromCache(cacheKey);
			
			if (cached) {
				console.log(`✅ Using cached content for ${workflowType}`);
				const finalContent = `🧠 **Generated ${workflowType}** (Cached)\n\n${cached.content}`;
				if (contentElement) {
				this.updateStreamingContent(contentElement, this.renderMarkdownContent(finalContent));
				} else {
					this.addAssistantMessage(finalContent);
				}
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
			
			// Update the content element or add new message
			if (contentElement) {
			this.updateStreamingContent(contentElement, this.renderMarkdownContent(finalContent));
			} else {
				this.addAssistantMessage(finalContent);
			}
			
			// Cache the result
			this.cachingService.setCache(cacheKey, { content: formattedContent });
			
			return formattedContent;
			
		} catch (error) {
			console.error(`Fallback API call failed for ${workflowType}:`, error);
			// Show fallback content
			const fallbackContent = this.workflowDetector.getFallbackContent(workflowType, content);
			if (contentElement) {
			this.updateStreamingContent(contentElement, this.renderMarkdownContent(fallbackContent));
			} else {
				this.addAssistantMessage(fallbackContent);
			}
			return fallbackContent;
		}
	}

	private async handleChatMessage(content: string): Promise<void> {
		// Show thinking indicator
		this.uiService.showThinkingIndicator();
		
		try {
			const response = await this.backendService.callAPI('chat', content, this.currentMode);
			this.addAssistantMessage(response.content);
		} catch (error) {
			console.error('Failed to send message:', error);
			this.showError(this.messageService.getErrorMessage(error));
		} finally {
			this.uiService.hideThinkingIndicator();
		}
	}

	private addUserMessage(content: string): void {
		const messageDiv = append(this.messageList, $('.message.user'));
		messageDiv.setAttribute('data-message-id', this.generateMessageId());
		
		const messageContent = append(messageDiv, $('.message-content'));
		messageContent.textContent = content;
		
		// Add expand functionality for long messages
		if (content.length > 100) {
			messageDiv.classList.add('has-overflow');
			const expandIndicator = append(messageDiv, $('.expand-indicator'));
			expandIndicator.textContent = 'Click to expand';
			
			messageDiv.addEventListener('click', () => {
				messageDiv.classList.toggle('expanded');
				expandIndicator.textContent = messageDiv.classList.contains('expanded') ? 'Click to collapse' : 'Click to expand';
			});
		}
		
		this.uiService.scrollToBottom(this.messageList);
	}

	private addAssistantMessage(content: string): void {
		const messageDiv = append(this.messageList, $('.message.assistant'));
		messageDiv.setAttribute('data-message-id', this.generateMessageId());
		
		const messageContent = append(messageDiv, $('.message-content'));
		
		// Use VS Code's safe HTML rendering instead of innerHTML
		const renderedContent = this.renderMarkdownContent(content);
		messageContent.appendChild(renderedContent);
		
		this.uiService.scrollToBottom(this.messageList);
	}

	private showError(message: string): void {
		const errorDiv = append(this.messageList, $('.message.assistant'));
		errorDiv.setAttribute('data-message-id', this.generateMessageId());
		
		const messageContent = append(errorDiv, $('.message-content'));
		
		// Use safeSetInnerHtml for error messages
		safeSetInnerHtml(messageContent, `<span style="color: #f87171;">❌ ${message}</span>`);
		
		this.uiService.scrollToBottom(this.messageList);
	}

	private updateSendButton(): void {
		if (this.sendButton) {
			if (this.isGenerating) {
				this.sendButton.classList.add('stop-mode');
				this.sendButton.textContent = '■';
			} else {
				this.sendButton.classList.remove('stop-mode');
				this.sendButton.textContent = '↗';
			}
		}
	}

	private generateMessageId(): string {
		return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// Add missing methods that are being called in the code
	private addMessage(message: any): void {
		if (message.type === 'user') {
			this.addUserMessage(message.content);
		} else if (message.type === 'assistant') {
			this.addAssistantMessage(message.content);
		}
	}

	private getMessageElement(container: HTMLElement, messageId: string): HTMLElement | null {
		return container.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
	}

	private renderMarkdownContent(content: string): HTMLElement {
		try {
			// Use VS Code's built-in markdown renderer
			const markdownString: IMarkdownString = {
				value: content,
				isTrusted: true,
				supportThemeIcons: true
			};
			
			const result = this.markdownRenderer.render(markdownString);
			const container = result.element;
			container.className = 'message-content';
			
			// Store the result for proper disposal
			this._register(result);
			
			return container;
		} catch (error) {
			console.error('Error rendering markdown content:', error);
			// Fallback to plain text
			const fallbackContainer = document.createElement('div');
			fallbackContainer.className = 'message-content';
			fallbackContainer.textContent = content;
			return fallbackContainer;
		}
	}
	


	private updateStreamingContent(contentElement: HTMLElement, newContent: HTMLElement): void {
		try {
			// Clear existing content
			contentElement.innerHTML = '';
			
			// Append the new content
			contentElement.appendChild(newContent);
			
			// Scroll to bottom
			this.uiService.scrollToBottom(this.messageList);
		} catch (error) {
			console.error('Error updating streaming content:', error);
			// Fallback to text content
			contentElement.textContent = newContent.textContent || 'Error updating content';
		}
	}

	private formatCodeGeneration(content: string, workflowType: WorkflowType, isFinal?: boolean): string {
		// For code generation, format as a file with syntax highlighting
		const fileName = this.extractFileName(content) || 'generated-file';
		const fileExtension = this.getFileExtension(fileName);
		
		// Show notification for file generation
		if (isFinal) {
			this.showFileGenerationNotification(fileName, 'completed');
		}
		
		return `📁 **Generated File: ${fileName}** ${isFinal ? '(Complete)' : '(Generating...)'}\n\n\`\`\`${fileExtension}\n${content}\n\`\`\``;
	}

	private extractFileName(content: string): string | null {
		// Try to extract filename from content patterns
		const patterns = [
			/^#\s*(.+\.(ts|js|tsx|jsx|py|java|cpp|c|h|html|css|json|md|txt))$/m,
			/^\/\/\s*File:\s*(.+\.(ts|js|tsx|jsx|py|java|cpp|c|h|html|css|json|md|txt))$/m,
			/^\/\*\s*File:\s*(.+\.(ts|js|tsx|jsx|py|java|cpp|c|h|html|css|json|md|txt))\s*\*\/$/m
		];
		
		for (const pattern of patterns) {
			const match = content.match(pattern);
			if (match) {
				return match[1];
			}
		}
		
		return null;
	}

	private getFileExtension(fileName: string): string {
		const extension = fileName.split('.').pop()?.toLowerCase();
		const extensionMap: Record<string, string> = {
			'ts': 'typescript',
			'js': 'javascript',
			'tsx': 'typescript',
			'jsx': 'javascript',
			'py': 'python',
			'java': 'java',
			'cpp': 'cpp',
			'c': 'c',
			'h': 'c',
			'html': 'html',
			'css': 'css',
			'json': 'json',
			'md': 'markdown',
			'txt': 'text'
		};
		
		return extensionMap[extension || ''] || 'text';
	}

	private showFileGenerationNotification(fileName: string, status: 'started' | 'completed' | 'failed'): void {
		const statusEmoji = {
			started: '🚀',
			completed: '✅',
			failed: '❌'
		};
		
		const statusText = {
			started: 'File generation started',
			completed: 'File generation completed',
			failed: 'File generation failed'
		};
		
		const notification = `${statusEmoji[status]} **${statusText[status]}**: ${fileName}`;
		this.addAssistantMessage(notification);
	}

	// Helper method to map workflow types to step indices
	private getStepIndex(workflowType: string): number {
		const stepMap: Record<string, number> = {
			'requirements': 0,
			'design': 1,
			'tasks': 2,
			'code': 3
		};
		return stepMap[workflowType] || 0;
	}

	// Smooth progress update with requestAnimationFrame for extra smoothness
	// private smoothProgressUpdate(stepIndex: number, progressPercent: number): void {
	// 	requestAnimationFrame(() => {
	// 		this.uiService.updateWorkflowStepProgress(stepIndex, progressPercent);
	// 	});
	// }

	// Helper delay method for smooth transitions between workflow steps
	private async delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// Helper method to handle streaming workflow with a specific content element
	private async handleStreamingWorkflowWithElement(
		workflowType: WorkflowType, 
		content: string, 
		contentElement: HTMLElement, 
		endTimer: () => void, 
		cacheKey: string
	): Promise<any> {
		// Get connection and context
		const connectionId = this.connectionPool.getConnectionId(workflowType);
		this.connectionPool.createConnection(connectionId);
		const context = await this.contextService.getPreloadedContext();

		try {
			// Try streaming if enabled
			if (this.streamingEnabled) {
				console.log('🚀 Attempting streaming request...');
				const response = await this.backendService.createStreamingRequest(workflowType, content, context);

				console.log('🔍 DEBUG Streaming response received:', {
					ok: response.ok,
					status: response.status,
					statusText: response.statusText,
					headers: Object.fromEntries(response.headers.entries())
				});

				if (response.ok) {
					console.log('✅ Streaming response OK, processing...');
					
					// Start independent progress animation
					const stepIndex = this.getStepIndex(workflowType);
					this.uiService.startIndependentProgress(stepIndex); // Use default 25 second duration
					
					// Process streaming response
					await this.streamingService.processStreamingResponse(
						response,
						contentElement,
						workflowType,
						(content, type, isFinal) => {
							// For code generation, format as file content
							if (workflowType === 'code') {
								return this.formatCodeGeneration(content, type as WorkflowType, isFinal);
							}
							return this.workflowFormatter.formatStreamingContent(content, type as WorkflowType, isFinal);
						},
						(content) => this.renderMarkdownContent(content)
					);
					
					// Complete the progress when streaming ends
					this.uiService.completeProgress(stepIndex);
					
					// Cache the content
					const finalContent = contentElement?.textContent || contentElement?.innerHTML || '';
					console.log('💾 Caching final content, length:', finalContent.length);
					console.log('🔍 DEBUG Final content preview:', finalContent.substring(0, 100));
					
					if (!finalContent || finalContent.trim().length === 0) {
						console.error('❌ Final content is empty, this indicates a streaming processing issue');
						throw new Error('Streaming response produced empty content');
					}
					
					// For code generation, the MockAIProvider will handle file creation directly
					// No need to parse response here as files are created during the AI provider call
					
					this.cachingService.setCache(cacheKey, { content: finalContent });
					endTimer();
					return finalContent;
				} else {
					console.log(`⚠️ Streaming failed (${response.status}), falling back to regular API`);
				}
			}

			// Fallback to regular API
			console.log('🔄 Falling back to regular API...');
			const fallbackResult = await this.handleStreamingFallback(workflowType, content, contentElement);
			console.log('🔍 DEBUG Fallback result:', {
				hasResult: !!fallbackResult,
				resultType: typeof fallbackResult,
				resultLength: fallbackResult ? fallbackResult.length : 0
			});
			endTimer();
			return fallbackResult;

		} catch (error: any) {
			console.log('🔍 DEBUG Streaming error caught:', {
				errorName: error.name,
				errorMessage: error.message,
				errorStack: error.stack
			});
			
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
	}

	// Event handlers
	private onConversationChanged(conversation: any): void {
		// Handle conversation changes
	}

	private onStateChanged(state: any): void {
		// Only show thinking indicator for non-streaming states
		// Streaming has its own visual feedback
		if ((state === 'generating' || state === 'thinking') && !this.isGenerating) {
			this.uiService.showThinkingIndicator();
		} else {
			this.uiService.hideThinkingIndicator();
		}
	}

	private onModeChanged(mode: AICompanionMode): void {
		this.currentMode = mode;
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