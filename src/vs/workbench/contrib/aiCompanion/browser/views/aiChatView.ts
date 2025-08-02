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

interface CachedResponse {
	data: any;
	timestamp: number;
	hitCount: number;
}

// Performance Monitoring
class PerformanceMonitor {
	private static metrics = new Map<string, number[]>();

	static startTimer(operation: string): () => void {
		const start = Date.now();
		
		return () => {
			const duration = Date.now() - start;
			
			if (!this.metrics.has(operation)) {
				this.metrics.set(operation, []);
			}
			
			this.metrics.get(operation)!.push(duration);
			
			// Keep only last 20 measurements
			const measurements = this.metrics.get(operation)!;
			if (measurements.length > 20) {
				measurements.splice(0, measurements.length - 20);
			}
			
			const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
			console.log(`⏱️ ${operation}: ${duration}ms (avg: ${avg.toFixed(1)}ms)`);
		};
	}

	static getAverageTime(operation: string): number {
		const measurements = this.metrics.get(operation) || [];
		return measurements.reduce((a, b) => a + b, 0) / measurements.length || 0;
	}
}

// Enhanced streaming response parser
class StreamingResponseParser {
	private buffer: string = '';
	private isComplete: boolean = false;

	parseChunk(chunk: string): { content: string; isComplete: boolean } {
		this.buffer += chunk;
		
		// Handle SSE format
		const lines = this.buffer.split('\n');
		let content = '';
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			if (line.startsWith('data: ')) {
				const data = line.slice(6);
				
				if (data === '[DONE]') {
					this.isComplete = true;
					// Clear processed lines from buffer
					this.buffer = lines.slice(i + 1).join('\n');
					break;
				}
				
				try {
					const parsed = JSON.parse(data);
					if (parsed.content) {
						content += parsed.content;
					}
					if (parsed.error) {
						throw new Error(parsed.error);
					}
				} catch (parseError) {
					// If it's not JSON, treat as plain text
					if (data.trim()) {
						content += data;
					}
				}
				
				// Remove processed line from buffer
				lines.splice(i, 1);
				i--; // Adjust index since we removed a line
			}
		}
		
		// Update buffer with remaining unprocessed lines
		this.buffer = lines.join('\n');
		
		return { content, isComplete: this.isComplete };
	}

	reset(): void {
		this.buffer = '';
		this.isComplete = false;
	}
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
	private currentMode: AICompanionMode = AICompanionMode.Builder;
	private sessionId: string = '';
	private backendUrl: string = '';
	private streamingEnabled: boolean = true;
	private isConnected = false;
	private sessionMonitoringInterval: any = null;
	
	// Performance Optimizations
	private responseCache = new Map<string, CachedResponse>();
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
	
	// Connection Pooling
	private connectionPool: Map<string, AbortController> = new Map();
	private readonly MAX_CONCURRENT_REQUESTS = 3;
	
	// Context Management
	private preloadedContext: any = null;
	private contextPreloadPromise: Promise<void> | null = null;

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
		
		// Check if streaming is enabled (default to true since you want it enabled)
		this.streamingEnabled = this.configurationService.getValue<boolean>('aiCompanion.backend.streaming') ?? true;

		// Initialize session and check connection
		this.initializeSession();
		
		// Check streaming endpoint availability
		console.log(`🔧 Streaming enabled: ${this.streamingEnabled}`);
		this.checkStreamingEndpoint().then(isAvailable => {
			console.log(`🔧 Streaming endpoint available: ${isAvailable}`);
			if (this.streamingEnabled && !isAvailable) {
				console.warn('⚠️ Streaming enabled but endpoint not available, falling back to regular API');
				this.streamingEnabled = false;
			}
		});
		
		// Preload workspace context in background
		this.preloadWorkspaceContext().catch(console.error);
		
		// Start session monitoring after initialization
		setTimeout(() => {
			this.startSessionMonitoring();
		}, 10000); // Start monitoring after 10 seconds

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
			
			console.log('🔄 Creating session with workspace:', workspaceId);
			
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
				console.log('✅ Session created successfully:', this.sessionId);
				
				// Test the session immediately
				await this.validateSession();
			} else {
				const errorText = await response.text();
				console.error('❌ Session creation failed:', response.status, errorText);
				this.updateConnectionStatus(false, 'Failed to create session');
				this.sessionId = generateUuid(); // Fallback
			}
		} catch (error) {
			console.error('❌ Session initialization error:', error);
			this.updateConnectionStatus(false, 'Connection failed');
			this.sessionId = generateUuid(); // Fallback
		}
	}

	private async validateSession(): Promise<void> {
		if (!this.sessionId) {
			console.warn('⚠️ No session ID to validate');
			return;
		}
		
		try {
			console.log('🔍 Validating session:', this.sessionId);
			
			const response = await fetch(`${this.backendUrl}/usage/${this.sessionId}`, {
				method: 'GET',
				headers: {
					'X-Session-ID': this.sessionId
				}
			});
			
			if (response.ok) {
				const usageData = await response.json();
				console.log('✅ Session validation successful:', usageData);
			} else {
				const errorText = await response.text();
				console.error('❌ Session validation failed:', response.status, errorText);
				
				// If session is invalid, try to recreate it
				if (response.status === 401) {
					console.log('🔄 Session invalid, recreating...');
					await this.recreateSession();
				}
			}
		} catch (error) {
			console.error('❌ Session validation error:', error);
		}
	}

	private async recreateSession(): Promise<void> {
		console.log('🔄 Recreating session...');
		this.sessionId = '';
		this.isConnected = false;
		await this.initializeSession();
	}

	private startSessionMonitoring(): void {
		// Check session health every 5 minutes
		this.sessionMonitoringInterval = setInterval(async () => {
			if (this.sessionId && this.isConnected) {
				await this.validateSession();
			}
		}, 5 * 60 * 1000); // 5 minutes
	}

	private stopSessionMonitoring(): void {
		if (this.sessionMonitoringInterval) {
			clearInterval(this.sessionMonitoringInterval);
			this.sessionMonitoringInterval = null;
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
			
			if (error instanceof TypeError && error.message.includes('Content Security Policy')) {
				console.warn('⚠️ CSP blocked connection, trying alternative approach...');
				// For now, assume backend is available if we're in development
				return true;
			}
			
			return false;
		}
	}

	private async checkStreamingEndpoint(): Promise<boolean> {
		if (!this.streamingEnabled) {
			return false;
		}

		try {
			const response = await fetch(`${this.backendUrl}/completions-stream`, {
				method: 'OPTIONS',
				headers: {
					'Content-Type': 'application/json'
				},
				signal: AbortSignal.timeout(3000)
			});

			const isAvailable = response.ok;
			console.log(`🌊 Streaming endpoint ${isAvailable ? 'available' : 'not available'}`);
			return isAvailable;
		} catch (error) {
			console.log('🌊 Streaming endpoint not available:', error.message);
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
			{ mode: AICompanionMode.Builder, label: '🔨 Builder', icon: 'tools' },
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
		if (!content || this.isTyping || this.isInitializing || !this.isConnected || !this.sessionId) {
			console.log('❌ Cannot send message:', {
				hasContent: !!content,
				isTyping: this.isTyping,
				isInitializing: this.isInitializing,
				isConnected: this.isConnected,
				hasSessionId: !!this.sessionId,
				sessionId: this.sessionId
			});
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

		// Detect if this should trigger structured workflows
		const workflowType = this.detectWorkflowType(content);
		console.log('🔍 Detected workflow type:', workflowType);
		
		if (workflowType !== 'chat') {
			await this.handleStructuredWorkflow(workflowType, content);
		} else {
			await this.handleChatMessage(content);
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

	private detectWorkflowTypeOptimized(content: string): 'requirements' | 'design' | 'tasks' | 'code' | 'chat' {
		const lowerContent = content.toLowerCase();
		
		// Fast regex-based detection (much faster than array iteration)
		if (/\b(build|create|make|develop|implement|want to build)\b/.test(lowerContent)) {
			return 'requirements';
		}
		if (/\b(design|architecture|structure|tech stack)\b/.test(lowerContent)) {
			return 'design';
		}
		if (/\b(tasks|todo|steps|breakdown|plan)\b/.test(lowerContent)) {
			return 'tasks';
		}
		if (/\b(generate code|write code|implement|code for)\b/.test(lowerContent)) {
			return 'code';
		}
		
		return 'chat';
	}

	private detectWorkflowType(content: string): 'requirements' | 'design' | 'tasks' | 'code' | 'chat' {
		// Use optimized detection for better performance
		return this.detectWorkflowTypeOptimized(content);
	}

	private async handleStructuredWorkflow(workflowType: string, content: string): Promise<void> {
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
			console.log('✅ Requirements generated:', requirementsResponse ? 'Success' : 'Failed');
			
			if (!requirementsResponse) {
				console.error('❌ Requirements generation failed, stopping workflow');
				return;
			}
			
			// Step 2: Generate design (with requirements context)
			console.log('🏗️ Step 2: Generating design...');
			const designResponse = await this.handleStreamingWorkflow('design', 
				`Based on these requirements:\n${requirementsResponse}\n\nGenerate the design for: ${content}`);
			console.log('✅ Design generated:', designResponse ? 'Success' : 'Failed');
			
			if (!designResponse) {
				console.error('❌ Design generation failed, stopping workflow');
				return;
			}
			
			// Step 3: Generate tasks (with requirements + design context)
			console.log('📝 Step 3: Generating tasks...');
			const tasksResponse = await this.handleStreamingWorkflow('tasks', 
				`Requirements:\n${requirementsResponse}\n\nDesign:\n${designResponse}\n\nGenerate tasks for: ${content}`);
			console.log('✅ Tasks generated:', tasksResponse ? 'Success' : 'Failed');
			
			if (!tasksResponse) {
				console.error('❌ Tasks generation failed, stopping workflow');
				return;
			}
			
			// Step 4: Generate code (with all context)
			console.log('💻 Step 4: Generating code...');
			await this.handleStreamingWorkflow('code', 
				`Requirements:\n${requirementsResponse}\n\nDesign:\n${designResponse}\n\nTasks:\n${tasksResponse}\n\nGenerate code for: ${content}`);
			console.log('✅ Code generation complete');
			
		} catch (error) {
			console.error('Full workflow failed:', error);
			this.showError(`Workflow failed: ${error.message}`);
		}
	}

	private async handleStreamingWorkflow(workflowType: string, content: string): Promise<any> {
		const endTimer = PerformanceMonitor.startTimer(`${workflowType}-workflow`);
		
		// Check cache first
		const cacheKey = this.getCacheKey(workflowType, content);
		const cached = await this.getFromCache(cacheKey);
		if (cached) {
			// Use cached response
			const streamingId = generateUuid();
			const cachedMessage: IAIMessage = {
				id: streamingId,
				type: MessageType.Assistant,
				content: `🧠 **Generated ${workflowType}** (Cached)\n\n${cached.content}`,
				timestamp: Date.now()
			};
			this.addMessage(cachedMessage);
			endTimer();
			return cached.content;
		}

		// Check connection pool
		if (!this.canMakeRequest()) {
			this.showError('Too many concurrent requests. Please wait a moment.');
			endTimer();
			return null;
		}

		// Create streaming message immediately
		const streamingId = generateUuid();
		const connectionId = this.getConnectionId(workflowType);
		const controller = new AbortController();
		this.connectionPool.set(connectionId, controller);

		const streamingMessage: IAIMessage = {
			id: streamingId,
			type: MessageType.Assistant,
			content: `🔄 **Generating ${workflowType}...**\n\n▋`,
			timestamp: Date.now()
		};

		this.addMessage(streamingMessage);
		const messageElement = this.getMessageElement(streamingId);
		const contentElement = messageElement?.querySelector('.ai-message-text') as HTMLElement;

		try {
			// Preload context if not already done
			await this.preloadWorkspaceContext();

			// Check if streaming is enabled
			console.log(`🔧 In workflow - Streaming enabled: ${this.streamingEnabled}`);
			if (this.streamingEnabled) {
				console.log('🚀 Attempting streaming request...');
				// Try streaming first
				const response = await fetch(`${this.backendUrl}/completions-stream`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Session-ID': this.sessionId
					},
					body: JSON.stringify({
						type: workflowType,
						prompt: content,
						context: await this.getPreloadedContext(),
						stream: true
					}),
					signal: controller.signal
				});

				if (response.ok) {
					// Process streaming response
					await this.processStreamingResponse(response, contentElement, workflowType);
					
					// Cache the content (get the final formatted content)
					const finalContent = contentElement.textContent || contentElement.innerHTML;
					this.setCache(cacheKey, { content: finalContent });
					endTimer();
					return finalContent;
				} else {
					console.log(`⚠️ Streaming failed (${response.status}), falling back to regular API`);
				}
			} else {
				console.log('ℹ️ Streaming disabled, using regular API');
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
			// Cleanup connection
			this.connectionPool.delete(connectionId);
			endTimer();
		}
	}

	private async handleStreamingFallback(workflowType: string, content: string, contentElement: HTMLElement): Promise<any> {
		try {
			console.log(`🔄 Starting fallback for ${workflowType} with content: "${content.substring(0, 50)}..."`);
			
			// Check cache first
			const cacheKey = this.getCacheKey(workflowType, content);
			const cached = await this.getFromCache(cacheKey);
			
			if (cached) {
				console.log(`✅ Using cached content for ${workflowType}`);
				const finalContent = `🧠 **Generated ${workflowType}** (Cached)\n\n${cached.content}`;
				this.updateStreamingContent(contentElement, this.renderMarkdown(finalContent));
				return cached.content;
			}

			// Use regular API as fallback with correct workflow type
			console.log(`🚀 Making API call for ${workflowType}...`);
			const response = await this.callBackendAPIWithType(workflowType, content);
			console.log(`✅ API response received for ${workflowType}:`, response.content.substring(0, 100));
			
			// Format the response based on workflow type
			let formattedContent: string;
			try {
				// Try to parse the content as JSON first
				console.log(`🔍 Raw response content:`, response.content.substring(0, 200));
				const parsedContent = JSON.parse(response.content);
				console.log(`🔍 Parsed content:`, parsedContent);
				formattedContent = this.formatWorkflowResponse(parsedContent, workflowType);
				console.log(`🔍 After formatting:`, formattedContent.substring(0, 200));
			} catch (e) {
				// If it's not JSON, use the content as-is
				console.warn(`⚠️ JSON parse failed:`, e);
				formattedContent = response.content;
			}
			const finalContent = `🧠 **Generated ${workflowType}**\n\n${formattedContent}`;
			
			// Update the content element
			console.log(`📝 Updating UI with final content for ${workflowType}`);
			this.updateStreamingContent(contentElement, this.renderMarkdown(finalContent));
			
			// Cache the result (store the formatted content)
			this.setCache(cacheKey, { content: formattedContent });
			
			return formattedContent;
			
		} catch (error) {
			console.error(`Fallback API call failed for ${workflowType}:`, error);
			// If even the fallback fails, show a helpful message
			const fallbackContent = this.getFallbackContent(workflowType, content);
			this.updateStreamingContent(contentElement, this.renderMarkdown(fallbackContent));
		}
	}

	private getFallbackContent(workflowType: string, content: string): string {
		switch (workflowType) {
			case 'requirements':
				return `🧠 **E-commerce Website Requirements**

## 1. Project Overview
- **Goal**: Create a simple e-commerce website for online shopping
- **Business Objectives**: Sell products online, manage inventory, process orders
- **Success Criteria**: Functional shopping cart, secure checkout, responsive design

## 2. Functional Requirements

### 2.1 User Stories
**As a customer, I want to:**
- Browse products by category
- Search for specific items
- Add items to shopping cart
- Complete secure checkout
- Track my order status

**As an admin, I want to:**
- Manage product inventory
- Process orders
- View sales reports
- Update product information

### 2.2 Acceptance Criteria
- Product catalog with images and descriptions
- Shopping cart functionality
- Secure payment processing
- Order confirmation emails
- Admin dashboard for management

## 3. Non-Functional Requirements
- **Performance**: Page load < 3 seconds
- **Security**: SSL encryption, secure payment
- **Scalability**: Support 1000+ concurrent users
- **Usability**: Mobile-responsive design

## 4. Technical Specifications
- **Frontend**: React.js with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Payment**: Stripe integration
- **Hosting**: Vercel/Netlify

## 5. Key Features
- Product catalog and search
- Shopping cart and checkout
- User authentication
- Order management
- Admin dashboard

Would you like me to proceed with the design phase?`;

			case 'design':
				return `🏗️ **E-commerce Website Design**

## Architecture Overview
- **Frontend**: React SPA with TypeScript
- **Backend**: Node.js REST API
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens
- **Payment**: Stripe integration

## Database Schema
\`\`\`sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id)
);

-- Orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

## API Endpoints
- \`GET /api/products\` - List products
- \`POST /api/cart/add\` - Add to cart
- \`POST /api/orders\` - Create order
- \`GET /api/orders/:id\` - Get order status

## Frontend Components
- ProductGrid, ProductCard
- ShoppingCart, CartItem
- CheckoutForm
- UserDashboard, AdminPanel

Ready to generate implementation tasks?`;

			case 'tasks':
				return `📋 **Implementation Tasks**

## Phase 1: Project Setup
1. **Initialize React project**
   - Create React app with TypeScript
   - Set up routing with React Router
   - Configure ESLint and Prettier

2. **Backend setup**
   - Initialize Node.js project
   - Set up Express server
   - Configure PostgreSQL database
   - Set up Prisma ORM

## Phase 2: Core Features
3. **Database implementation**
   - Create database schema
   - Set up Prisma models
   - Create database migrations

4. **Authentication system**
   - Implement user registration/login
   - Set up JWT token handling
   - Create protected routes

5. **Product management**
   - Create product CRUD operations
   - Implement product search/filtering
   - Add product images handling

## Phase 3: Shopping Features
6. **Shopping cart**
   - Implement cart state management
   - Add/remove items functionality
   - Cart persistence

7. **Checkout process**
   - Create checkout form
   - Integrate Stripe payment
   - Order confirmation

## Phase 4: Admin Features
8. **Admin dashboard**
   - Order management interface
   - Product inventory management
   - Sales reporting

Ready to generate code files?`;

			case 'code':
				return `💻 **Generated Code Structure**

## Frontend Files
\`\`\`typescript
// src/components/ProductGrid.tsx
export const ProductGrid = () => {
  // Product listing component
};

// src/components/ShoppingCart.tsx
export const ShoppingCart = () => {
  // Cart management component
};

// src/pages/Checkout.tsx
export const Checkout = () => {
  // Checkout form component
};
\`\`\`

## Backend Files
\`\`\`typescript
// src/routes/products.ts
router.get('/products', getProducts);
router.post('/products', createProduct);

// src/routes/orders.ts
router.post('/orders', createOrder);
router.get('/orders/:id', getOrder);

// src/services/stripe.ts
export const createPaymentIntent = async (amount: number) => {
  // Stripe integration
};
\`\`\`

## Database Schema
\`\`\`sql
-- Complete database schema
CREATE TABLE users (...);
CREATE TABLE products (...);
CREATE TABLE orders (...);
CREATE TABLE order_items (...);
\`\`\`

🎉 **E-commerce website structure ready!**

The code files have been generated. You can now start implementing your e-commerce website with these components and structure.`;

			default:
				return `✅ **${workflowType} Generated Successfully**

The ${workflowType} has been created for your e-commerce website project. You can now proceed with the next phase of development.`;
		}
	}

	private async handleChatMessage(content: string): Promise<void> {
		this.showTypingIndicator();
		
		try {
			// For regular chat, still use the structured backend but with 'chat' type
			const response = await this.callBackendAPI(content);
			
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
			console.error('Failed to send message:', error);
			this.showError(this.getErrorMessage(error));
			
			if (!this.isConnected) {
				setTimeout(() => this.initializeSession(), 5000);
			}
		} finally {
			this.hideTypingIndicator();
		}
	}









	private async callBackendAPIWithType(type: string, prompt: string): Promise<BackendAIResponse> {
		const workspace = this.workspaceService.getWorkspace();
		const workspaceInfo = {
			name: workspace.folders[0]?.name || 'Unknown',
			rootPath: workspace.folders[0]?.uri.fsPath || '',
			files: [],
			gitBranch: undefined
		};

		const requestBody = {
			type: type, // Use the actual workflow type
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

		console.log(`🚀 Sending ${type} request:`, {
			sessionId: this.sessionId,
			url: `${this.backendUrl}/completions`,
			type: type
		});

		const timeout = this.configurationService.getValue<number>('aiCompanion.backend.timeout') || 30000;

		try {
			const response = await fetch(`${this.backendUrl}/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify(requestBody),
				signal: AbortSignal.timeout(timeout)
			});

			if (response.status === 401) {
				console.warn('⚠️ Session expired during API call, recreating...');
				await this.recreateSession();
				
				// Retry with new session
				if (this.sessionId) {
					requestBody.sessionId = this.sessionId;
					
					const retryResponse = await fetch(`${this.backendUrl}/completions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Session-ID': this.sessionId
						},
						body: JSON.stringify(requestBody),
						signal: AbortSignal.timeout(timeout)
					});
					
					if (!retryResponse.ok) {
						const errorData = await retryResponse.text();
						throw new Error(`Backend API error (retry): ${retryResponse.status} ${errorData}`);
					}
					
					const retryData = await retryResponse.json();
					return retryData;
				}
			}

			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(`Backend API error: ${response.status} ${errorData}`);
			}

			const data = await response.json();
			return data;

		} catch (error: any) {
			if (error.name === 'AbortError') {
				throw new Error('Request timeout');
			}
			throw error;
		}
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

		console.log('🚀 Sending chat request:', {
			sessionId: this.sessionId,
			url: `${this.backendUrl}/completions`
		});

		const timeout = this.configurationService.getValue<number>('aiCompanion.backend.timeout') || 30000;

		try {
			const response = await fetch(`${this.backendUrl}/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify(requestBody),
				signal: AbortSignal.timeout(timeout)
			});

			if (response.status === 401) {
				console.warn('⚠️ Session expired during chat, recreating...');
				await this.recreateSession();
				
				// Retry with new session
				if (this.sessionId) {
					requestBody.sessionId = this.sessionId;
					
					const retryResponse = await fetch(`${this.backendUrl}/completions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Session-ID': this.sessionId
						},
						body: JSON.stringify(requestBody),
						signal: AbortSignal.timeout(timeout)
					});
					
					if (!retryResponse.ok) {
						const errorData = await retryResponse.text();
						throw new Error(`Backend API error (retry): ${retryResponse.status} ${errorData}`);
					}
					
					return await retryResponse.json();
				} else {
					throw new Error('Failed to recreate session');
				}
			}

			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(`Backend API error: ${response.status} ${errorData}`);
			}

			return await response.json();
			
		} catch (error: any) {
			if (error.name === 'AbortError') {
				throw new Error('Request timed out');
			}
			throw error;
		}
	}

	private addMessage(message: IAIMessage): void {
		console.log(`📝 Adding message: ${message.type} - ${message.content.substring(0, 50)}...`);
		this.messages.push(message);
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

		// Message content
		const content = append(contentContainer, $('.ai-message-text'));
		// Use enhanced markdown rendering for better formatting
		content.textContent = this.renderMarkdown(message.content);

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
			} else if (index === 1 && mode === AICompanionMode.Builder) {
				button.classList.add('active');
			}
		});

		// Show mode change message
		const modeMessage: IAIMessage = {
			id: generateUuid(),
			type: MessageType.System,
			content: `🔄 **Mode Changed to ${mode}**

${mode === AICompanionMode.Builder 
	? '🔨 **Builder Mode**: I will automatically generate requirements → design → tasks → code when you request to build something.'
	: '🧠 **Helper Mode**: I will assist and guide you step by step.'
}`,
			timestamp: Date.now()
		};
		
		this.addMessage(modeMessage);
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

	// Formatting methods for better UI display
	// private formatRequirements(requirements: any): string {
	// 	if (!requirements) return 'No requirements generated.';
		
	// 	// Try to parse JSON if it's a string
	// 	let parsedRequirements = requirements;
	// 	if (typeof requirements === 'string') {
	// 		try {
	// 			parsedRequirements = JSON.parse(requirements);
	// 		} catch {
	// 			// If it's not JSON, return as is
	// 			return requirements;
	// 		}
	// 	}
		
	// 	let formatted = '';
		
	// 	if (parsedRequirements.functional?.length) {
	// 		formatted += '**Functional Requirements:**\n';
	// 		parsedRequirements.functional.forEach((req: string, i: number) => {
	// 			formatted += `${i + 1}. ${req}\n`;
	// 		});
	// 		formatted += '\n';
	// 	}
		
	// 	if (parsedRequirements.nonFunctional?.length) {
	// 		formatted += '**Non-Functional Requirements:**\n';
	// 		parsedRequirements.nonFunctional.forEach((req: string, i: number) => {
	// 			formatted += `${i + 1}. ${req}\n`;
	// 		});
	// 		formatted += '\n';
	// 	}
		
	// 	if (parsedRequirements.constraints?.length) {
	// 		formatted += '**Constraints:**\n';
	// 		parsedRequirements.constraints.forEach((constraint: string, i: number) => {
	// 			formatted += `${i + 1}. ${constraint}\n`;
	// 		});
	// 	}
		
	// 	return formatted || requirements;
	// }

	// private formatDesign(design: any): string {
	// 	if (!design) return 'No design generated.';
		
	// 	// Try to parse JSON if it's a string
	// 	let parsedDesign = design;
	// 	if (typeof design === 'string') {
	// 		try {
	// 			parsedDesign = JSON.parse(design);
	// 		} catch {
	// 			// If it's not JSON, return as is
	// 			return design;
	// 		}
	// 	}
		
	// 	let formatted = '';
		
	// 	if (parsedDesign.architecture) {
	// 		formatted += `**Architecture:** ${parsedDesign.architecture}\n\n`;
	// 	}
		
	// 	if (parsedDesign.techStack?.length) {
	// 		formatted += `**Tech Stack:** ${parsedDesign.techStack.join(', ')}\n\n`;
	// 	}
		
	// 	if (parsedDesign.components?.length) {
	// 		formatted += '**Components:**\n';
	// 		parsedDesign.components.forEach((component: string, i: number) => {
	// 			formatted += `${i + 1}. ${component}\n`;
	// 		});
	// 	}
		
	// 	return formatted || design;
	// }

	// private formatTasks(tasks: any): string {
	// 	if (!tasks) return 'No tasks generated.';
		
	// 	// Try to parse JSON if it's a string
	// 	let parsedTasks = tasks;
	// 	if (typeof tasks === 'string') {
	// 		try {
	// 			parsedTasks = JSON.parse(tasks);
	// 		} catch {
	// 			// If it's not JSON, return as is
	// 			return tasks;
	// 		}
	// 	}
		
	// 	if (!parsedTasks.tasks?.length) return tasks;
		
	// 	let formatted = '';
	// 	parsedTasks.tasks.forEach((task: any, i: number) => {
	// 		formatted += `**${i + 1}. ${task.title}**\n`;
	// 		formatted += `   ${task.description}\n`;
	// 		if (task.filePath) {
	// 			formatted += `   📁 File: ${task.filePath}\n`;
	// 		}
	// 		formatted += `   ⏱️ Complexity: ${task.complexity}\n\n`;
	// 	});
		
	// 	return formatted;
	// }

	// private formatCodeGeneration(files: any): string {
	// 	if (!files) return 'No files generated.';
		
	// 	// Try to parse JSON if it's a string
	// 	let parsedFiles = files;
	// 	if (typeof files === 'string') {
	// 		try {
	// 			parsedFiles = JSON.parse(files);
	// 		} catch {
	// 			// If it's not JSON, return as is
	// 			return files;
	// 		}
	// 	}
		
	// 	if (!parsedFiles.files?.length) return files;
		
	// 	let formatted = '**Generated Files:**\n';
	// 	parsedFiles.files.forEach((file: any, i: number) => {
	// 		formatted += `${i + 1}. **${file.path}**\n`;
	// 		formatted += `   ${file.description}\n\n`;
	// 	});
		
	// 	return formatted;
	// }

	override dispose(): void {
		// Cleanup connections and cache
		this.responseCache.clear();
		this.cleanupConnectionPool();
		this.stopSessionMonitoring();
		super.dispose();
	}



	// Caching Methods
	private getCacheKey(type: string, prompt: string, context?: any): string {
		const contextHash = context ? this.hashObject(context) : '';
		return `${type}:${this.hashString(prompt)}:${contextHash}`.substring(0, 64);
	}

	private hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}

	private hashObject(obj: any): string {
		return this.hashString(JSON.stringify(obj));
	}

	private async getFromCache(cacheKey: string): Promise<any | null> {
		const cached = this.responseCache.get(cacheKey);
		if (!cached) return null;

		// Check if cache is still valid
		if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
			this.responseCache.delete(cacheKey);
			return null;
		}

		// Update hit count and return
		cached.hitCount++;
		console.log(`💨 Cache HIT for ${cacheKey} (${cached.hitCount} hits)`);
		return cached.data;
	}

	private setCache(cacheKey: string, data: any): void {
		this.responseCache.set(cacheKey, {
			data,
			timestamp: Date.now(),
			hitCount: 0
		});

		// Cleanup old cache entries (keep last 50)
		if (this.responseCache.size > 50) {
			const oldestKey = Array.from(this.responseCache.keys())[0];
			this.responseCache.delete(oldestKey);
		}

		console.log(`💾 Cached response for ${cacheKey}`);
	}

	// Connection Pooling Methods
	private cleanupConnectionPool(): void {
		this.connectionPool.forEach((controller) => {
			controller.abort();
		});
		this.connectionPool.clear();
	}

	private getConnectionId(type: string): string {
		return `${type}-${Date.now()}`;
	}

	private canMakeRequest(): boolean {
		return this.connectionPool.size < this.MAX_CONCURRENT_REQUESTS;
	}



	// Streaming and Performance Methods
	private getMessageElement(messageId: string): HTMLElement | null {
		const messages = this.messageList.querySelectorAll('.ai-message');
		for (const message of messages) {
			if (message.getAttribute('data-message-id') === messageId) {
				return message as HTMLElement;
			}
		}
		return null;
	}

	private async getPreloadedContext(): Promise<any> {
		// Wait for preloading to complete if it's still in progress
		if (this.contextPreloadPromise) {
			await this.contextPreloadPromise;
		}
		
		return this.preloadedContext || {
			workspace: { name: 'Unknown', rootPath: '', files: [], gitBranch: undefined },
			memory: null,
			files: { files: [], directories: [], totalFiles: 0, totalSize: 0 },
			currentMode: this.currentMode,
			techStack: [],
			architecture: '',
			goals: []
		};
	}

	private async preloadWorkspaceContext(): Promise<void> {
		if (this.contextPreloadPromise) {
			return; // Already preloading
		}

		this.contextPreloadPromise = this.doPreloadContext();
		await this.contextPreloadPromise;
	}

	private async doPreloadContext(): Promise<void> {
		try {
			console.log('🔄 Preloading workspace context...');
			
			const workspace = this.workspaceService.getWorkspace();
			const workspaceInfo = {
				name: workspace.folders[0]?.name || 'Unknown',
				rootPath: workspace.folders[0]?.uri.fsPath || '',
				files: [],
				gitBranch: await this.detectGitBranch()
			};

			const fileStructure = await this.getFileStructureFast();
			const techStack = await this.detectTechStack(fileStructure);
			const architecture = await this.detectArchitecture(fileStructure);

			this.preloadedContext = {
				workspace: workspaceInfo,
				memory: null,
				files: fileStructure,
				currentMode: this.currentMode,
				techStack,
				architecture,
				goals: []
			};

			console.log('✅ Workspace context preloaded:', {
				techStack,
				architecture,
				fileCount: fileStructure.totalFiles
			});

		} catch (error) {
			console.error('❌ Failed to preload context:', error);
			// Fallback to basic context
			this.preloadedContext = {
				workspace: { name: 'Unknown', rootPath: '', files: [], gitBranch: undefined },
				memory: null,
				files: { files: [], directories: [], totalFiles: 0, totalSize: 0 },
				currentMode: this.currentMode,
				techStack: [],
				architecture: '',
				goals: []
			};
		}
	}

	private async getFileStructureFast(): Promise<any> {
		try {
			const workspace = this.workspaceService.getWorkspace();
			const rootPath = workspace.folders[0]?.uri.fsPath;
			
			if (!rootPath) {
				return { files: [], directories: [], totalFiles: 0, totalSize: 0 };
			}

			// Fast file scanning (limited to key directories)
			const keyDirs = ['src', 'app', 'components', 'pages', 'api', 'routes', 'models'];
			const files: string[] = [];
			const directories: string[] = [];

			// This is a simplified version - in a real implementation,
			// you'd use VS Code's file system API to scan directories
			for (const dir of keyDirs) {
				directories.push(dir);
			}

			return {
				files,
				directories,
				totalFiles: files.length,
				totalSize: 0
			};

		} catch (error) {
			console.error('Failed to get file structure:', error);
			return { files: [], directories: [], totalFiles: 0, totalSize: 0 };
		}
	}

	private async detectTechStack(fileStructure: any): Promise<string[]> {
		const techStack: string[] = [];
		
		// Detect based on file extensions and common patterns
		const fileExtensions = fileStructure.files.map((f: string) => 
			f.split('.').pop()?.toLowerCase()
		);

		if (fileExtensions.includes('ts') || fileExtensions.includes('tsx')) {
			techStack.push('TypeScript');
		}
		if (fileExtensions.includes('js') || fileExtensions.includes('jsx')) {
			techStack.push('JavaScript');
		}
		if (fileExtensions.includes('py')) {
			techStack.push('Python');
		}
		if (fileExtensions.includes('java')) {
			techStack.push('Java');
		}
		if (fileExtensions.includes('cs')) {
			techStack.push('C#');
		}
		if (fileExtensions.includes('php')) {
			techStack.push('PHP');
		}
		if (fileExtensions.includes('rb')) {
			techStack.push('Ruby');
		}
		if (fileExtensions.includes('go')) {
			techStack.push('Go');
		}
		if (fileExtensions.includes('rs')) {
			techStack.push('Rust');
		}

		// Detect frameworks
		if (fileStructure.directories.includes('node_modules')) {
			techStack.push('Node.js');
		}
		if (fileStructure.directories.includes('src') && fileExtensions.includes('tsx')) {
			techStack.push('React');
		}
		if (fileStructure.directories.includes('src') && fileExtensions.includes('vue')) {
			techStack.push('Vue.js');
		}
		if (fileStructure.directories.includes('angular.json')) {
			techStack.push('Angular');
		}

		return techStack.length > 0 ? techStack : ['Unknown'];
	}

	private async detectArchitecture(fileStructure: any): Promise<string> {
		// Detect architecture based on directory structure
		const dirs = fileStructure.directories.map((d: string) => d.toLowerCase());
		
		if (dirs.includes('api') && dirs.includes('src')) {
			return 'Full-Stack (Frontend + API)';
		}
		if (dirs.includes('api') && !dirs.includes('src')) {
			return 'Backend API';
		}
		if (dirs.includes('src') && !dirs.includes('api')) {
			return 'Frontend Application';
		}
		if (dirs.includes('components') && dirs.includes('pages')) {
			return 'Component-Based Frontend';
		}
		if (dirs.includes('routes') && dirs.includes('models')) {
			return 'MVC Architecture';
		}
		
		return 'Unknown Architecture';
	}

	private async detectGitBranch(): Promise<string | undefined> {
		try {
			// In a real implementation, you'd use git commands
			// For now, return undefined
			return undefined;
		} catch (error) {
			return undefined;
		}
	}

	private async processStreamingResponse(
		response: Response, 
		contentElement: HTMLElement, 
		workflowType: string
	): Promise<void> {
		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const parser = new StreamingResponseParser();
		
		let accumulatedContent = '';
		let lastUpdateTime = 0;
		const UPDATE_THROTTLE = 50; // Update UI every 50ms for smoother experience

		console.log('🌊 Starting enhanced streaming response processing...');

		try {
			while (reader) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const parseResult = parser.parseChunk(chunk);
				
				if (parseResult.content) {
					accumulatedContent += parseResult.content;
					
					// Try to format incrementally for structured responses
					const formatted = this.tryFormatIncremental(accumulatedContent, workflowType);
					const displayContent = formatted || this.formatStreamingContent(accumulatedContent, workflowType);
					
					// Throttle UI updates for better performance
					const now = Date.now();
					if (now - lastUpdateTime > UPDATE_THROTTLE) {
						this.updateStreamingContent(contentElement, this.renderMarkdown(displayContent));
						lastUpdateTime = now;
					}
				}
				
				if (parseResult.isComplete) {
					console.log('🌊 Streaming marked as complete');
					break;
				}
			}

			// Final update with complete formatted content
			const finalContent = this.formatStreamingContent(accumulatedContent, workflowType, true);
			this.updateStreamingContent(contentElement, this.renderMarkdown(finalContent));
			
			console.log('🌊 Enhanced streaming processing complete');
			
		} catch (error) {
			console.error('❌ Enhanced streaming error:', error);
			throw error;
		} finally {
			reader?.releaseLock();
			parser.reset();
		}
	}

	private tryFormatIncremental(jsonBuffer: string, workflowType: string): string | null {
		try {
			let jsonText = jsonBuffer.trim();
			
			if (jsonText.length < 10) {
				return null;
			}
			
			const openBraces = (jsonText.match(/\{/g) || []).length;
			const closeBraces = (jsonText.match(/\}/g) || []).length;
			const openBrackets = (jsonText.match(/\[/g) || []).length;
			const closeBrackets = (jsonText.match(/\]/g) || []).length;
			
			if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
				console.log(`🌊 Incomplete JSON - braces: ${openBraces}/${closeBraces}, brackets: ${openBrackets}/${closeBrackets}`);
				return null;
			}
			
			const quotes = (jsonText.match(/"/g) || []).length;
			if (quotes % 2 !== 0) {
				console.log(`🌊 Incomplete JSON - odd number of quotes: ${quotes}`);
				return null;
			}

			console.log(`🌊 Attempting to parse complete JSON (${jsonText.length} chars)`);
			const parsed = JSON.parse(jsonText);
			console.log(`🌊 Successfully parsed JSON, formatting...`);
			return this.formatWorkflowResponse(parsed, workflowType);
		} catch (e) {
			console.log(`🌊 JSON parsing failed:`, e.message);
			return null;
		}
	}

	private formatStreamingContent(content: string, workflowType: string, isFinal: boolean = false): string {
		const prefix = `🧠 **Generated ${workflowType}**${isFinal ? '' : ' (streaming...)'}\n\n`;
		
		if (isFinal && workflowType !== 'chat') {
			try {
				const cleanContent = content.trim();
				
				if (cleanContent.startsWith('{') && cleanContent.endsWith('}')) {
					const parsed = JSON.parse(cleanContent);
					const formatted = this.formatWorkflowResponse(parsed, workflowType);
					return `${prefix}${formatted}`;
				}
			} catch (parseError) {
				console.log('Final content is not parseable JSON, using as-is');
			}
		}
		
		return `${prefix}${content}${isFinal ? '' : '▋'}`;
	}

	private updateStreamingContent(element: HTMLElement, content: string): void {
		if (element) {
			const currentContent = element.textContent;
			
			if (currentContent !== content) {
				element.style.opacity = '0.9';
				element.style.transform = 'translateY(1px)';
				
				element.textContent = content;
				element.style.opacity = '1';
				element.style.transform = 'translateY(0)';
				element.style.transition = 'all 0.2s ease-out';
				
				this.scrollToBottom();
				
				setTimeout(() => {
					element.style.transition = '';
				}, 200);
			}
		}
	}

	private renderMarkdown(content: string): string {
		// Process code blocks first (before other replacements)
		content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
			const language = lang || 'text';
			return `<pre><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>`;
		});

		// Headers
		content = content.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		content = content.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		content = content.replace(/^# (.*$)/gim, '<h1>$1</h1>');

		// Bold and italic (order matters - bold first)
		content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

		// Inline code
		content = content.replace(/`(.*?)`/g, '<code>$1</code>');

		// Links
		content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

		// Lists
		content = content.replace(/^\* (.*$)/gim, '<li>$1</li>');
		content = content.replace(/^- (.*$)/gim, '<li>$1</li>');
		content = content.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

		// Wrap consecutive list items in ul/ol
		content = content.replace(/(<li>.*<\/li>)/gs, (match) => {
			const items = match.match(/<li>.*?<\/li>/g);
			if (items && items.length > 0) {
				return `<ul>${items.join('')}</ul>`;
			}
			return match;
		});

		// Blockquotes
		content = content.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

		// Strikethrough
		content = content.replace(/~~(.*?)~~/g, '<del>$1</del>');

		// Line breaks (convert \n to <br> but not inside code blocks)
		content = content.replace(/\n/g, '<br>');

		return content;
	}

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	private formatWorkflowResponse(content: any, workflowType: string): string {
		console.log(`🎨 Formatting ${workflowType} response:`, {
			contentType: typeof content,
			isString: typeof content === 'string',
			length: content?.length,
			startsWithBrace: typeof content === 'string' && content.trim().startsWith('{')
		});
		
		try {
			// If content is already an object, use it directly
			if (typeof content === 'object' && content !== null) {
				console.log('📦 Content is already an object');
				return this.formatStructuredContent(content, workflowType);
			}
			
			// If content is a string, try to parse it as JSON
			if (typeof content === 'string') {
				console.log('📝 Content is a string, attempting JSON parse...');
				
				// Clean the content first
				const cleanContent = content.trim();
				
				if (cleanContent.startsWith('{') || cleanContent.startsWith('[')) {
					try {
						const parsed = JSON.parse(cleanContent);
						console.log('✅ Successfully parsed JSON:', typeof parsed);
						return this.formatStructuredContent(parsed, workflowType);
					} catch (parseError) {
						console.warn('⚠️ JSON parse failed:', parseError);
						// Fallback to plain text formatting
						return this.formatPlainContent(cleanContent, workflowType);
					}
				} else {
					console.log('📄 Content is plain text');
					return this.formatPlainContent(cleanContent, workflowType);
				}
			}
			
			console.warn('⚠️ Unexpected content type:', typeof content);
			return String(content);
			
		} catch (error) {
			console.error('❌ Error formatting workflow response:', error);
			return `Error formatting response: ${String(content)}`;
		}
	}

	private formatStructuredContent(parsed: any, workflowType: string): string {
		console.log(`🏗️ Formatting structured content for ${workflowType}`);
		
		switch (workflowType) {
			case 'requirements':
				return this.formatRequirementsStructured(parsed);
			case 'design':
				return this.formatDesignStructured(parsed);
			case 'tasks':
				return this.formatTasksStructured(parsed);
			case 'code':
				return this.formatCodeStructured(parsed);
			default:
				return JSON.stringify(parsed, null, 2);
		}
	}

	private formatPlainContent(content: string, workflowType: string): string {
		console.log(`📄 Formatting plain content for ${workflowType}`);
		
		// If content is not structured JSON, format it nicely
		return content
			.replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting for now
			.replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
			.trim();
	}

	private formatRequirementsStructured(req: any): string {
		console.log('📋 Formatting requirements:', req);
		let content = '';
		
		if (req.functional?.length) {
			content += '## 🎯 Functional Requirements\n';
			req.functional.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.nonFunctional?.length) {
			content += '## ⚡ Non-Functional Requirements\n';
			req.nonFunctional.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.constraints?.length) {
			content += '## 🚧 Constraints\n';
			req.constraints.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.assumptions?.length) {
			content += '## 💭 Assumptions\n';
			req.assumptions.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.reasoning) {
			content += `## 🤔 Reasoning\n${req.reasoning}\n`;
		}
		
		return content || 'No structured requirements found';
	}

	private formatDesignStructured(design: any): string {
		console.log('🏗️ Formatting design:', design);
		let content = '';
		
		if (design.architecture) {
			content += `## 🏛️ Architecture\n${design.architecture}\n\n`;
		}
		
		if (design.techStack?.length) {
			content += `## 🛠️ Tech Stack\n${design.techStack.join(', ')}\n\n`;
		}
		
		if (design.components?.length) {
			content += '## 📦 Components\n';
			design.components.forEach((comp: string, i: number) => {
				content += `${i + 1}. ${comp}\n`;
			});
			content += '\n';
		}
		
		if (design.dependencies?.length) {
			content += '## 📚 Dependencies\n';
			design.dependencies.forEach((dep: string, i: number) => {
				content += `${i + 1}. ${dep}\n`;
			});
			content += '\n';
		}
		
		if (design.folderStructure) {
			content += '## 📁 Folder Structure\n```\n';
			content += this.formatFolderStructure(design.folderStructure, 0);
			content += '```\n\n';
		}
		
		if (design.reasoning) {
			content += `## 🤔 Reasoning\n${design.reasoning}\n`;
		}
		
		return content || 'No structured design found';
	}

	private formatTasksStructured(tasks: any): string {
		console.log('📝 Formatting tasks:', tasks);
		let content = '';
		
		if (tasks.tasks?.length) {
			content += '## 📝 Implementation Tasks\n\n';
			tasks.tasks.forEach((task: any, i: number) => {
				content += `### ${i + 1}. ${task.title}\n`;
				content += `**Description:** ${task.description}\n`;
				if (task.filePath) {
					content += `**File:** \`${task.filePath}\`\n`;
				}
				if (task.dependencies?.length) {
					content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
				}
				if (task.estimatedTime) {
					content += `**Time:** ${task.estimatedTime}\n`;
				}
				if (task.complexity) {
					content += `**Complexity:** ${task.complexity.toUpperCase()}\n`;
				}
				content += '\n';
			});
		}
		
		if (tasks.reasoning) {
			content += `## 🤔 Reasoning\n${tasks.reasoning}\n`;
		}
		
		return content || 'No structured tasks found';
	}

	private formatCodeStructured(code: any): string {
		console.log('💻 Formatting code:', code);
		let content = '';
		
		if (code.files?.length) {
			content += '## 📁 Generated Files\n\n';
			code.files.forEach((file: any, i: number) => {
				content += `### ${i + 1}. ${file.path}\n`;
				content += `${file.description}\n\n`;
				
				// Show a preview of the code (first few lines)
				if (file.content) {
					const lines = file.content.split('\n').slice(0, 10);
					content += '```typescript\n';
					content += lines.join('\n');
					if (file.content.split('\n').length > 10) {
						content += '\n... (truncated)';
					}
					content += '\n```\n\n';
				}
			});
		}
		
		if (code.reasoning) {
			content += `## 🤔 Implementation Notes\n${code.reasoning}\n`;
		}
		
		return content || 'No structured code found';
	}

	private formatFolderStructure(structure: any, depth: number = 0): string {
		let result = '';
		const indent = '  '.repeat(depth);
		
		for (const [name, children] of Object.entries(structure)) {
			result += `${indent}${name}\n`;
			if (children && typeof children === 'object') {
				result += this.formatFolderStructure(children, depth + 1);
			}
		}
		
		return result;
	}


}