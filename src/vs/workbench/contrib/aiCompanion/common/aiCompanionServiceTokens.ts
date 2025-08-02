import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

// Core service interfaces
export interface IAIBackendService {
	readonly _serviceBrand: undefined;
	initializeSession(workspaceId: string): Promise<ISessionInfo>;
	sendRequest(request: IAIRequest): Promise<IAIResponse>;
	sendStreamingRequest(
		request: IAIRequest,
		onChunk: (chunk: IAIStreamChunk) => void,
		onComplete: (response: IAIResponse) => void,
		onError: (error: Error) => void
	): Promise<void>;
	checkHealth(): Promise<boolean>;
	checkStreamingEndpoint(): Promise<boolean>;
	cancelRequest(requestId: string): void;
	cancelAllRequests(): void;
	getSessionInfo(): ISessionInfo | null;
	clearSession(): void;
	getCacheKey(request: IAIRequest): string;
	getFromCache(key: string): IAIResponse | null;
	setCache(key: string, response: IAIResponse): void;
	cleanupCache(): void;
}

export interface IStreamProcessor {
	readonly _serviceBrand: undefined;
	startStreaming(requestId: string, workflowType?: string): void;
	processChunk(requestId: string, chunk: IAIStreamChunk): string;
	completeStreaming(requestId: string): IAIResponse | null;
	cancelStreaming(requestId: string): void;
	getStreamingState(requestId: string): IStreamingState | null;
	isStreaming(requestId: string): boolean;
	getActiveStreamCount(): number;
}

export interface IMessageFormatter {
	readonly _serviceBrand: undefined;
	renderMarkdown(content: string): string;
	formatWorkflowResponse(content: any, workflowType: string): string;
	formatStructuredContent(parsed: any, workflowType: string): string;
}

export interface IWorkflowDetector {
	readonly _serviceBrand: undefined;
	detectWorkflowType(content: string): string;
	analyzeContext(workspaceRoot: string): Promise<IWorkflowContext>;
	detectTechStack(workspaceRoot: string): Promise<string[]>;
	detectArchitecture(workspaceRoot: string): Promise<string>;
	detectGitBranch(workspaceRoot: string): Promise<string | undefined>;
	getFileStructureFast(workspaceRoot: string, maxDepth?: number): Promise<string>;
}

export interface IConnectionManager {
	readonly _serviceBrand: undefined;
	connect(): Promise<boolean>;
	disconnect(): void;
	checkHealth(): Promise<boolean>;
	checkStreamingEndpoint(): Promise<boolean>;
	isConnected(): boolean;
	getConnectionStatus(): IConnectionStatus;
	getConnectionPool(): IConnectionPool;
	getConnectionId(): string;
	canMakeRequest(): boolean;
	acquireConnection(): string | null;
	releaseConnection(connectionId: string): void;
	cleanupConnectionPool(): void;
	updateConnectionStatus(status: Partial<IConnectionStatus>): void;
	getConnectionStats(): {
		totalConnections: number;
		activeConnections: number;
		availableConnections: number;
		errorCount: number;
		averageLatency: number;
	};
	dispose(): void;
	readonly onConnectionStatusChanged: Event<IConnectionStatus>;
}

export interface IPerformanceMonitor {
	readonly _serviceBrand: undefined;
	startTimer(operation: string): () => void;
	getAverageTime(operation: string): number;
}

export interface IErrorHandler {
	readonly _serviceBrand: undefined;
	handleError(error: Error, context: string, severity?: 'info' | 'warning' | 'error'): void;
	getErrorMessage(error: any): string;
}

export interface IStateManager {
	readonly _serviceBrand: undefined;
	getState(): IAICompanionState;
	updateState(partial: Partial<IAICompanionState>): void;
	updateUIState(partial: Partial<IUIState>): void;
	createConversation(id: string): IAIConversation;
	getConversation(id: string): IAIConversation | null;
	getCurrentConversation(): IAIConversation | null;
	getAllConversations(): IAIConversation[];
	updateConversation(id: string, partial: Partial<IAIConversation>): void;
	deleteConversation(id: string): void;
	setCurrentConversation(id: string): void;
	clearAllConversations(): void;
	updatePerformanceMetrics(metrics: Partial<IAICompanionStatePerformance>): void;
	updateConnectionStatus(status: Partial<IConnectionStatus>): void;
	getStateSnapshot(): {
		totalConversations: number;
		currentConversationId?: string;
		isConnected: boolean;
		isTyping: boolean;
		performance: IAICompanionStatePerformance;
	};
	resetState(): void;
	dispose(): void;
	readonly onStateChange: Event<IAICompanionState>;
	readonly onConversationChange: Event<IAIConversation>;
	readonly onUIStateChange: Event<IUIState>;
}

export interface IConfigurationService {
	readonly _serviceBrand: undefined;
	readonly backendUrl: string;
	readonly streamingEnabled: boolean;
	readonly cacheDuration: number;
	readonly maxConcurrentRequests: number;
	readonly timeout: number;
}

// Service tokens
export const IAIBackendService = createDecorator<IAIBackendService>('aiBackendService');
export const IStreamProcessor = createDecorator<IStreamProcessor>('streamProcessor');
export const IMessageFormatter = createDecorator<IMessageFormatter>('messageFormatter');
export const IWorkflowDetector = createDecorator<IWorkflowDetector>('workflowDetector');
export const IConnectionManager = createDecorator<IConnectionManager>('connectionManager');
export const IPerformanceMonitor = createDecorator<IPerformanceMonitor>('performanceMonitor');
export const IErrorHandler = createDecorator<IErrorHandler>('errorHandler');
export const IStateManager = createDecorator<IStateManager>('stateManager');
export const IAICompanionConfigurationService = createDecorator<IConfigurationService>('aiCompanionConfigurationService');

// Types
export interface IAIRequest {
	type: string;
	prompt: string;
	context: any;
	sessionId: string;
	messages: Array<{ role: string; content: string }>;
	maxTokens?: number;
	temperature?: number;
	mode: string;
	content: string;
}

export interface IAIResponse {
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model?: string;
	finishReason?: string;
	sessionId: string;
	requestId?: string;
	id: string;
	metadata?: any;
	timestamp: number;
}

export interface IAIStreamChunk {
	content: string;
	isComplete: boolean;
	error?: string;
}

export interface ISessionInfo {
	sessionId: string;
	workspaceId: string;
	createdAt: Date;
}

export interface IStreamingState {
	isStreaming: boolean;
	accumulatedContent: string;
	lastUpdateTime: number;
	chunkCount: number;
	currentWorkflowType?: string;
}

export interface IWorkflowContext {
	techStack: string[];
	architecture: string;
	gitBranch?: string;
	fileStructure: string;
	workspaceRoot: string;
}

export interface IConnectionStatus {
	isConnected: boolean;
	isHealthy: boolean;
	lastHealthCheck: number;
	connectionId: string;
	sessionId?: string;
	errorCount: number;
	latency: number;
	health: 'healthy' | 'unhealthy' | 'unknown';
	error?: string;
}

export interface IConnectionPool {
	maxConnections: number;
	activeConnections: number;
	availableConnections: number;
	connectionIds: string[];
}

export interface IUIState {
	isTyping: boolean;
	isInitializing: boolean;
	isConnected: boolean;
}

export interface IAICompanionStatePerformance {
	lastRequestTime: number;
	averageResponseTime: number;
	totalRequests: number;
	successfulRequests: number;
	failedRequests: number;
}

export interface IAICompanionState {
	conversations: IAIConversation[];
	conversationOrder: string[];
	currentConversationId: string | null;
	maxConversations: number;
	ui: IUIState;
	performance: IAICompanionStatePerformance;
	connectionStatus: IConnectionStatus;
}

// Import existing types
import { IAIMessage } from './aiCompanionService.js';
import { Event } from '../../../../base/common/event.js';

// Add missing types
export interface IAIConversation {
	id: string;
	messages: IAIMessage[];
	createdAt: number;
	updatedAt: number;
	state: ConversationState;
}

export enum ConversationState {
	Idle = 'idle',
	Typing = 'typing',
	Generating = 'generating',
	Error = 'error',
	Active = 'active'
}

// Command constants
export const AICompanionCommands = {
	Focus: 'aiCompanion.focus',
	Toggle: 'aiCompanion.toggle',
	NewConversation: 'aiCompanion.newConversation'
} as const;

// View ID constants
export const AICompanionViewIds = {
	CHAT_VIEW_ID: 'aiCompanion.chatView',
	VIEWLET_ID: 'aiCompanion.viewlet'
} as const;

// Context constants
export const AICompanionContext = {
	Enabled: 'aiCompanion.enabled'
} as const;

// File constants
export const AICompanionFiles = {
	PROJECT_MEMORY: '.ai-companion/project-memory.json',
	CONVERSATION_BACKUP: '.ai-companion/conversations/conversation',
	TASKS_FILE: '.ai-companion/tasks.md'
} as const;