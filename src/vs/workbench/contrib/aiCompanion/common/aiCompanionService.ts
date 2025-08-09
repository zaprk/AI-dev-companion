import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../base/common/uri.js';

export const IAICompanionService = createDecorator<IAICompanionService>('aiCompanionService');

export enum AICompanionMode {
	Helper = 'helper',
	Builder = 'builder'
}

export enum ConversationState {
	Idle = 'idle',
	GeneratingRequirements = 'generating-requirements',
	GeneratingDesign = 'generating-design',
	GeneratingTasks = 'generating-tasks',
	GeneratingCode = 'generating-code',
	Waiting = 'waiting'
}

export enum MessageType {
	User = 'user',
	Assistant = 'assistant',
	System = 'system'
}

export interface IAIMessage {
	id: string;
	type: MessageType;
	content: string;
	timestamp: number;
	metadata?: {
		files?: string[];
		tasks?: string[];
		requirements?: string[];
		usage?: {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		};
		requestId?: string;
		model?: string;
		finishReason?: string;
	};
}

export interface IAIConversation {
	id: string;
	workspaceUri: URI;
	messages: IAIMessage[];
	state: ConversationState;
	mode: AICompanionMode;
	createdAt: number;
	lastModified: number;
}

// IProjectMemory is now imported from projectMemoryService.ts
export interface IProjectMemory {
	version: string;
	lastUpdated: string;
	lastAnalyzed: string;
	project: {
		name: string;
		type: string;
		framework: Record<string, string>;
		languages: string[];
		packageManager?: 'npm' | 'yarn' | 'pnpm';
	};
	architecture: {
		pattern: string;
		folderStructure: Record<string, any>;
		layering: string[];
		designPatterns: string[];
	};
	conventions: {
		fileNaming: 'camelCase' | 'PascalCase' | 'kebab-case' | 'snake_case';
		componentNaming: 'camelCase' | 'PascalCase';
		functionNaming: 'camelCase' | 'PascalCase';
		variableNaming: 'camelCase' | 'snake_case';
		indentation: '2-spaces' | '4-spaces' | 'tabs';
		quotes: 'single' | 'double';
		semicolons: boolean;
		trailingCommas: boolean;
	};
	patterns: {
		componentStructure: string;
		stateManagement: string;
		styling: string;
		apiPattern: string;
		errorHandling: string;
		testingApproach: string;
	};
	dependencies: {
		commonImports: string[];
		frequentlyUsed: string[];
		coreLibraries: string[];
		devDependencies: string[];
	};
	codebase: {
		totalFiles: number;
		fileTypes: Record<string, number>;
		linesOfCode: number;
		complexity: 'low' | 'medium' | 'high';
		maintainability: 'low' | 'medium' | 'high';
	};
	intelligence: {
		generatedFiles: number;
		userCorrections: number;
		preferredPatterns: string[];
		learningConfidence: number;
		successfulGenerations: number;
		failedGenerations: number;
	};
	fileRelationships: Record<string, any>;
}

export interface IAITask {
	id: string;
	title: string;
	description: string;
	completed: boolean;
	filePath?: string;
	dependencies?: string[];
	createdAt: number;
}

export interface IAIRequirements {
	functional: string[];
	nonFunctional: string[];
	constraints: string[];
	assumptions: string[];
}

export interface IAIDesign {
	folderStructure: Record<string, any>;
	components: string[];
	architecture: string;
	techStack: string[];
	dependencies: string[];
}

export interface IAICompanionService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeConversation: Event<IAIConversation>;
	readonly onDidChangeMode: Event<AICompanionMode>;
	readonly onDidChangeState: Event<ConversationState>;
	readonly onDidUpdateProjectMemory: Event<IProjectMemory>;

	readonly currentConversation: IAIConversation | undefined;
	readonly currentMode: AICompanionMode;
	readonly currentState: ConversationState;
	readonly projectMemory: IProjectMemory | undefined;

	initialize(workspaceUri: URI): Promise<void>;
	dispose(): void;

	startNewConversation(mode: AICompanionMode): Promise<IAIConversation>;
	getConversation(id: string): Promise<IAIConversation | undefined>;
	getAllConversations(): Promise<IAIConversation[]>;
	deleteConversation(id: string): Promise<void>;
	setActiveConversation(id: string): Promise<void>;

	sendMessage(content: string, files?: URI[]): Promise<IAIMessage>;
	getMessages(conversationId?: string): Promise<IAIMessage[]>;
	clearMessages(conversationId?: string): Promise<void>;

	generateRequirements(prompt: string): Promise<IAIRequirements>;
	generateDesign(requirements: IAIRequirements): Promise<IAIDesign>;
	generateTasks(requirements: IAIRequirements, design: IAIDesign): Promise<IAITask[]>;
	generateCode(tasks: IAITask[], selectedTasks?: string[]): Promise<void>;

	// Workflow context management
	clearWorkflowContext(): void;
	getStoredRequirements(): IAIRequirements | undefined;
	getStoredDesign(): IAIDesign | undefined;
	getStoredTasks(): IAITask[] | undefined;

	getTasks(conversationId?: string): Promise<IAITask[]>;
	updateTask(taskId: string, updates: Partial<IAITask>): Promise<void>;
	completeTask(taskId: string): Promise<void>;
	deleteTask(taskId: string): Promise<void>;

	loadProjectMemory(): Promise<IProjectMemory | undefined>;
	saveProjectMemory(memory: IProjectMemory): Promise<void>;
	updateProjectMemory(updates: Partial<IProjectMemory>): Promise<void>;
	clearProjectMemory(): Promise<void>;

	analyzeCodebase(): Promise<IProjectMemory>;
	getProjectMemoryContext(): string;

	setMode(mode: AICompanionMode): Promise<void>;
	getMode(): AICompanionMode;

	setState(state: ConversationState): void;
	getState(): ConversationState;

	revertChanges(files: URI[]): Promise<void>;
	getModifiedFiles(): Promise<URI[]>;
	createTasksFile(tasks: IAITask[]): Promise<URI>;

	isWorkspaceCompatible(): boolean;
	getWorkspaceInfo(): Promise<{
		name: string;
		rootPath: string;
		files: string[];
		gitBranch?: string;
	}>;

	// Code search methods
	searchCode(query: string, options?: any): Promise<any>;
	findCodeReferences(symbol: string): Promise<any>;
	findCodeDefinitions(symbol: string): Promise<any>;
	analyzeCodebase(): Promise<any>;
	getCodeContext(filePath: string, lineNumber: number, contextLines?: number): Promise<string>;
}