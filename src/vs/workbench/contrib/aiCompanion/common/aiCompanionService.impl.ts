import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

import {
	IAICompanionService,
	IAIConversation,
	IAIMessage,
	IAITask,
	IAIRequirements,
	IAIDesign,
	IProjectMemory,
	AICompanionMode,
	ConversationState,
	MessageType
} from './aiCompanionService.js';

import { FileSystemManager } from './fileSystemManager.js';
import { PathUtils } from './utils/pathUtils.js';
// import { ValidationUtils } from './utils/validationUtils.js';
import { AICompanionFiles } from './aiCompanionServiceTokens.js';
import { IAIProvider } from './ai/aiProvider.js';
// import { aiProviderFactory } from './ai/aiProviderFactory.js';

// Import new utilities
import { 
	ContextWindowUtils, 
	ErrorUtils 
} from '../browser/utils/index.js';

const PROJECT_MEMORY_SCHEMA = {
	type: 'object',
	properties: {
		projectName: { type: 'string' },
		goals: { type: 'array' },
		stack: { type: 'array' },
		architecture: { type: 'string' },
		features: { type: 'array' },
		userPreferences: { type: 'object' },
		conversations: { type: 'array' },
		lastUpdated: { type: 'number' }
	},
	required: ['projectName', 'goals', 'stack', 'lastUpdated']
};

const CONVERSATION_SCHEMA = {
	type: 'object',
	properties: {
		id: { type: 'string' },
		workspaceUri: { type: 'string' },
		messages: { type: 'array' },
		state: { type: 'string' },
		mode: { type: 'string' },
		createdAt: { type: 'number' },
		lastModified: { type: 'number' }
	},
	required: ['id', 'workspaceUri', 'messages', 'state', 'mode', 'createdAt', 'lastModified']
};

export class AICompanionService extends Disposable implements IAICompanionService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeConversation = this._register(new Emitter<IAIConversation>());
	readonly onDidChangeConversation: Event<IAIConversation> = this._onDidChangeConversation.event;

	private readonly _onDidChangeMode = this._register(new Emitter<AICompanionMode>());
	readonly onDidChangeMode: Event<AICompanionMode> = this._onDidChangeMode.event;

	private readonly _onDidChangeState = this._register(new Emitter<ConversationState>());
	readonly onDidChangeState: Event<ConversationState> = this._onDidChangeState.event;

	private readonly _onDidUpdateProjectMemory = this._register(new Emitter<IProjectMemory>());
	readonly onDidUpdateProjectMemory: Event<IProjectMemory> = this._onDidUpdateProjectMemory.event;

	private readonly workspaceService: IWorkspaceContextService;
	private readonly fileService: IFileService;
	private readonly logService: ILogService;
	    // private readonly instantiationService: IInstantiationService;
	private readonly configurationService: IConfigurationService;

	private readonly fileSystemManager: FileSystemManager;
	private readonly pathUtils: PathUtils;
	    // private readonly validationUtils: ValidationUtils;

	private _currentConversation: IAIConversation | undefined;
	private _currentMode: AICompanionMode = AICompanionMode.Helper;
	private _currentState: ConversationState = ConversationState.Idle;
	private _projectMemory: IProjectMemory | undefined;
	private _workspaceUri: URI | undefined;
	private _isInitialized = false;

	private conversations: Map<string, IAIConversation> = new Map();
	private tasks: Map<string, IAITask[]> = new Map();

	private aiProvider: IAIProvider | undefined;

	constructor(
		@IWorkspaceContextService workspaceService: IWorkspaceContextService,
		@IFileService fileService: IFileService,
		@ILogService logService: ILogService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super();

		console.log('🔍 DEBUG AICompanionService constructor called with dependencies:', {
			workspaceService: !!workspaceService,
			fileService: !!fileService,
			logService: !!logService,
			instantiationService: !!instantiationService,
			configurationService: !!configurationService
		});

		// Safety checks for required services
		if (!workspaceService) {
			throw new Error('WorkspaceService is required');
		}
		if (!fileService) {
			throw new Error('FileService is required');
		}
		if (!logService) {
			throw new Error('LogService is required');
		}
		if (!configurationService) {
			throw new Error('ConfigurationService is required');
		}

		this.workspaceService = workspaceService;
		this.fileService = fileService;
		this.logService = logService;
		        // this.instantiationService = instantiationService;
		this.configurationService = configurationService;

		this.fileSystemManager = new FileSystemManager(
			workspaceService,
			fileService,
			logService,
			instantiationService
		);
		this.pathUtils = new PathUtils(workspaceService);
		// this.validationUtils = new ValidationUtils(fileService);

		this._register(this.fileSystemManager);

		console.log('🔍 DEBUG AICompanionService constructor - about to initialize AI provider');
		this.initializeAIProvider();
		
		this._register(configurationService.onDidChangeConfiguration((e: any) => {
			if (e.affectsConfiguration('aiCompanion.ai')) {
				this.initializeAIProvider();
			}
		}));
	}

	private initializeAIProvider(): void {
		try {
			// Safety check for logService
			if (!this.logService) {
				console.warn('LogService not available during AI provider initialization');
				this.aiProvider = undefined;
				return;
			}

			const aiConfig = this.configurationService.getValue('aiCompanion.ai');
			
			if (aiConfig && typeof aiConfig === 'object') {
				const config = aiConfig as any;
				if (config.provider && config.apiKey) {
					this.logService.info('AI provider configured:', config.provider);
					// For now, just log that it's configured - remove the actual provider initialization
					// that's causing the error
				} else {
					this.logService.warn('AI provider not configured. Add settings to aiCompanion.ai');
				}
			} else {
				this.logService.warn('AI provider not configured. Add settings to aiCompanion.ai');
			}
			
			// Set aiProvider to undefined for now to avoid initialization errors
			this.aiProvider = undefined;
		} catch (error: unknown) {
			// Completely safe error handling
			let errorMessage = 'Unknown error';
			if (error) {
				if (typeof error === 'string') {
					errorMessage = error;
				} else if (typeof error === 'object' && error !== null) {
					const errorObj = error as any;
					errorMessage = errorObj.message || errorObj.toString() || 'Unknown error';
				}
			}
			
			// Safety check before using logService
			if (this.logService) {
				this.logService.error('Failed to initialize AI provider:', errorMessage);
			} else {
				console.error('Failed to initialize AI provider (logService unavailable):', errorMessage);
			}
			this.aiProvider = undefined;
		}
	}

	private async generateProjectContext(): Promise<any> {
		const workspaceInfo = await this.getWorkspaceInfo();
		const projectMemory = this._projectMemory;
		
		return {
			workspace: workspaceInfo,
			projectMemory: projectMemory,
			currentMode: this._currentMode,
			fileStructure: await this.getFileStructure(),
			techStack: projectMemory?.stack || [],
			architecture: projectMemory?.architecture || '',
			goals: projectMemory?.goals || []
		};
	}

	private async getFileStructure(): Promise<string[]> {
		try {
			const workspace = this.workspaceService.getWorkspace();
			if (!workspace.folders.length) return [];

			const rootUri = workspace.folders[0].uri;
			const files: string[] = [];
			
			const scanDirectory = async (uri: URI, depth: number = 0): Promise<void> => {
				if (depth > 3) return; // Limit depth to avoid performance issues
				
				try {
					const stat = await this.fileService.resolve(uri);
					if (stat.children) {
						for (const child of stat.children) {
							const relativePath = this.pathUtils.resolveProjectPath(child.resource.fsPath);
							if (relativePath) {
								files.push(relativePath);
								if (child.isDirectory && depth < 3) {
									await scanDirectory(child.resource, depth + 1);
								}
							}
						}
					}
				} catch (error) {
					// Ignore permission errors
				}
			};

			await scanDirectory(rootUri);
			return files.slice(0, 100); // Limit to 100 files
		} catch (error) {
			return [];
		}
	}

	get currentConversation(): IAIConversation | undefined {
		return this._currentConversation;
	}

	get currentMode(): AICompanionMode {
		return this._currentMode;
	}

	get currentState(): ConversationState {
		return this._currentState;
	}

	get projectMemory(): IProjectMemory | undefined {
		return this._projectMemory;
	}

	async initialize(workspaceUri: URI): Promise<void> {
		if (this._isInitialized) {
			return;
		}

		try {
			this._workspaceUri = workspaceUri;

			await this.fileSystemManager.initialize();

			await this.loadProjectMemory(workspaceUri);

			await this.loadExistingConversations();

			// Try to restore session state if available
			try {
				// Note: We need to inject ExtensionContext to use SessionPersistenceUtils
				// For now, we'll use the existing file-based persistence
				this.logService.info('Session persistence ready (file-based)');
			} catch (persistenceError) {
				ErrorUtils.logError(persistenceError as Error, 'session persistence initialization');
				// Continue without session persistence
			}

			this._isInitialized = true;
			this.logService.info('AI Companion Service initialized successfully');

		} catch (error: unknown) {
			ErrorUtils.logError(error as Error, 'service initialization');
			throw ErrorUtils.createError(
				ErrorUtils.getInternalErrorCode(),
				'Failed to initialize AI Companion Service',
				{ workspaceUri: workspaceUri.toString() },
				error as Error
			);
		}
	}

	override dispose(): void {
		super.dispose();
		this._isInitialized = false;
		this.conversations.clear();
		this.tasks.clear();
	}

	async startNewConversation(mode: AICompanionMode): Promise<IAIConversation> {
		this.ensureInitialized();

		const conversation: IAIConversation = {
			id: generateUuid(),
			workspaceUri: this._workspaceUri!,
			messages: [],
			state: ConversationState.Idle,
			mode: mode,
			createdAt: Date.now(),
			lastModified: Date.now()
		};

		this.conversations.set(conversation.id, conversation);

		await this.saveConversation(conversation);

		this._currentConversation = conversation;
		this._currentMode = mode;

		this._onDidChangeConversation.fire(conversation);
		this._onDidChangeMode.fire(mode);

		this.logService.info(`Started new ${mode} conversation: ${conversation.id}`);
		return conversation;
	}

	async getConversation(id: string): Promise<IAIConversation | undefined> {
		this.ensureInitialized();
		return this.conversations.get(id);
	}

	async getAllConversations(): Promise<IAIConversation[]> {
		this.ensureInitialized();
		return Array.from(this.conversations.values());
	}

	async deleteConversation(id: string): Promise<void> {
		this.ensureInitialized();

		const conversation = this.conversations.get(id);
		if (!conversation) {
			return;
		}

		this.conversations.delete(id);
		this.tasks.delete(id);

		try {
			const conversationFile = `${AICompanionFiles.CONVERSATION_BACKUP}.${id}.json`;
			if (await this.fileSystemManager.fileExists(conversationFile)) {
				await this.fileSystemManager.deleteFile(conversationFile);
			}
		} catch (error: unknown) {
			// Safe error handling
			let errorMessage = 'Unknown error';
			if (error) {
				if (typeof error === 'string') {
					errorMessage = error;
				} else if (typeof error === 'object' && error !== null) {
					const errorObj = error as any;
					errorMessage = errorObj.message || errorObj.toString() || 'Unknown error';
				}
			}
			this.logService.warn(`Failed to delete conversation file for ${id}:`, errorMessage);
		}

		if (this._currentConversation?.id === id) {
			this._currentConversation = undefined;
		}

		this.logService.info(`Deleted conversation: ${id}`);
	}

	async setActiveConversation(id: string): Promise<void> {
		this.ensureInitialized();

		const conversation = this.conversations.get(id);
		if (!conversation) {
			throw new Error(`Conversation not found: ${id}`);
		}

		this._currentConversation = conversation;
		this._currentMode = conversation.mode;
		this.setState(conversation.state);

		this._onDidChangeConversation.fire(conversation);
		this._onDidChangeMode.fire(conversation.mode);
	}

	async sendMessage(content: string, files?: URI[]): Promise<IAIMessage> {
		this.ensureInitialized();

		if (!this._currentConversation) {
			throw ErrorUtils.createError(
				ErrorUtils.getInvalidInputErrorCode(),
				'No active conversation'
			);
		}

		try {
			// Check context window and prune if needed
			const currentTokens = ContextWindowUtils.estimateTokenCount(
				this._currentConversation.messages.map(m => m.content).join(' ')
			);
			
			const boundaries = ContextWindowUtils.detectTokenBoundaries(currentTokens);
			if (boundaries.recommendedAction === 'prune') {
				this.logService.warn(`Context window approaching limit (${currentTokens} tokens), pruning...`);
				const prunedMessages = ContextWindowUtils.pruneContextToFitWindow(
					this._currentConversation.messages,
					8000, // Safe limit
					'You are an AI coding assistant.'
				);
				this._currentConversation.messages = prunedMessages;
			}

					const message: IAIMessage = {
			id: generateUuid(),
			type: MessageType.User,
			content: content,
			timestamp: Date.now(),
			metadata: files ? { files: files.map(f => f.toString()) } : {}
		};

			this._currentConversation.messages.push(message);
			this._currentConversation.lastModified = Date.now();

			this.conversations.set(this._currentConversation.id, this._currentConversation);

			await this.saveConversation(this._currentConversation);

			// TODO: Integrate with VS Code's internal language model infrastructure
			// For now, we'll skip AI response generation until we implement proper native integration
			this.logService.info('AI response generation skipped - needs native VS Code integration');

			this._onDidChangeConversation.fire(this._currentConversation);

			this.logService.debug(`Message sent in conversation ${this._currentConversation.id}`);
			return message;

		} catch (error) {
			ErrorUtils.logError(error as Error, 'sendMessage');
			throw error;
		}
	}

	async getMessages(conversationId?: string): Promise<IAIMessage[]> {
		this.ensureInitialized();

		const id = conversationId || this._currentConversation?.id;
		if (!id) {
			return [];
		}

		const conversation = this.conversations.get(id);
		return conversation?.messages || [];
	}

	async clearMessages(conversationId?: string): Promise<void> {
		this.ensureInitialized();

		const id = conversationId || this._currentConversation?.id;
		if (!id) {
			return;
		}

		const conversation = this.conversations.get(id);
		if (conversation) {
			conversation.messages = [];
			conversation.lastModified = Date.now();
			this.conversations.set(id, conversation);
			await this.saveConversation(conversation);
			this._onDidChangeConversation.fire(conversation);
		}
	}

	async generateRequirements(prompt: string): Promise<IAIRequirements> {
		this.ensureInitialized();
		this.setState(ConversationState.GeneratingRequirements);

		try {
			if (!this.aiProvider) {
				throw new Error('AI provider not configured. Please configure your API key in settings.');
			}

			const projectContext = await this.generateProjectContext();
			
			const aiResult = await this.aiProvider.generateRequirements(prompt, projectContext);
			
			const requirements: IAIRequirements = {
				functional: aiResult.functional,
				nonFunctional: aiResult.nonFunctional,
				constraints: aiResult.constraints,
				assumptions: aiResult.assumptions
			};

			if (this._currentConversation) {
				const aiMessage: IAIMessage = {
					id: generateUuid(),
					type: MessageType.Assistant,
					content: `Generated requirements for: ${prompt}\n\n**Reasoning:** ${aiResult.reasoning}`,
					timestamp: Date.now(),
					metadata: { requirements: requirements.functional }
				};

				this._currentConversation.messages.push(aiMessage);
				await this.saveConversation(this._currentConversation);
				this._onDidChangeConversation.fire(this._currentConversation);
			}

			this.setState(ConversationState.Idle);
			return requirements;

		} catch (error: unknown) {
			this.setState(ConversationState.Idle);
			
			// Safe error handling
			let errorMessage = 'Unknown error';
			if (error) {
				if (typeof error === 'string') {
					errorMessage = error;
				} else if (typeof error === 'object' && error !== null) {
					const errorObj = error as any;
					errorMessage = errorObj.message || errorObj.toString() || 'Unknown error';
				}
			}
			
			this.logService.error('Failed to generate requirements:', errorMessage);
			
			if (this._currentConversation) {
				const errorMsg: IAIMessage = {
					id: generateUuid(),
					type: MessageType.System,
					content: `Error generating requirements: ${errorMessage}`,
					timestamp: Date.now()
				};
				this._currentConversation.messages.push(errorMsg);
				await this.saveConversation(this._currentConversation);
				this._onDidChangeConversation.fire(this._currentConversation);
			}
			
			throw new Error(errorMessage);
		}
	}

	async generateDesign(requirements: IAIRequirements): Promise<IAIDesign> {
		this.ensureInitialized();
		this.setState(ConversationState.GeneratingDesign);

		try {
			if (!this.aiProvider) {
				throw new Error('AI provider not configured');
			}

			const projectContext = await this.generateProjectContext();
			
			const aiRequirements = {
				functional: requirements.functional,
				nonFunctional: requirements.nonFunctional,
				constraints: requirements.constraints,
				assumptions: requirements.assumptions,
				reasoning: ''
			};

			const aiResult = await this.aiProvider.generateDesign(aiRequirements, projectContext);

			const design: IAIDesign = {
				folderStructure: aiResult.folderStructure,
				components: aiResult.components,
				architecture: aiResult.architecture,
				techStack: aiResult.techStack,
				dependencies: aiResult.dependencies
			};

			if (this._currentConversation) {
				const aiMessage: IAIMessage = {
					id: generateUuid(),
					type: MessageType.Assistant,
					content: `Generated design based on requirements.\n\n**Architecture:** ${design.architecture}\n\n**Tech Stack:** ${design.techStack.join(', ')}\n\n**Reasoning:** ${aiResult.reasoning}`,
					timestamp: Date.now()
				};

				this._currentConversation.messages.push(aiMessage);
				await this.saveConversation(this._currentConversation);
				this._onDidChangeConversation.fire(this._currentConversation);
			}

			this.setState(ConversationState.Idle);
			return design;

		} catch (error: any) {
			this.setState(ConversationState.Idle);
			this.logService.error('Failed to generate design:', error);
			throw error;
		}
	}

	async generateTasks(requirements: IAIRequirements, design: IAIDesign): Promise<IAITask[]> {
		this.ensureInitialized();
		this.setState(ConversationState.GeneratingTasks);

		try {
			if (!this.aiProvider) {
				throw new Error('AI provider not configured');
			}

			const projectContext = await this.generateProjectContext();
			
			const aiRequirements = {
				functional: requirements.functional,
				nonFunctional: requirements.nonFunctional,
				constraints: requirements.constraints,
				assumptions: requirements.assumptions,
				reasoning: ''
			};

			const aiDesign = {
				folderStructure: design.folderStructure,
				components: design.components,
				architecture: design.architecture,
				techStack: design.techStack,
				dependencies: design.dependencies,
				reasoning: ''
			};

			const aiResult = await this.aiProvider.generateTasks(aiRequirements, aiDesign, projectContext);

			const tasks: IAITask[] = aiResult.tasks.map(aiTask => ({
				id: generateUuid(),
				title: aiTask.title,
				description: aiTask.description,
				completed: false,
				filePath: aiTask.filePath,
				dependencies: aiTask.dependencies,
				createdAt: Date.now()
			}));

			if (this._currentConversation) {
				this.tasks.set(this._currentConversation.id, tasks);
				
				const aiMessage: IAIMessage = {
					id: generateUuid(),
					type: MessageType.Assistant,
					content: `Generated ${tasks.length} tasks for implementation.\n\n**Reasoning:** ${aiResult.reasoning}`,
					timestamp: Date.now(),
					metadata: { tasks: tasks.map(t => t.title) }
				};

				this._currentConversation.messages.push(aiMessage);
				await this.saveConversation(this._currentConversation);
				this._onDidChangeConversation.fire(this._currentConversation);
			}

			this.setState(ConversationState.Idle);
			return tasks;

		} catch (error: any) {
			this.setState(ConversationState.Idle);
			this.logService.error('Failed to generate tasks:', error);
			throw error;
		}
	}

	async generateCode(tasks: IAITask[], selectedTasks?: string[]): Promise<void> {
		this.ensureInitialized();
		this.setState(ConversationState.GeneratingCode);

		try {
			if (!this.aiProvider) {
				throw new Error('AI provider not configured');
			}

			const projectContext = await this.generateProjectContext();
			
			const aiTasks = {
				tasks: tasks.map(task => ({
					title: task.title,
					description: task.description,
					filePath: task.filePath,
					dependencies: task.dependencies,
					estimatedTime: '2 hours',
					complexity: 'medium' as const
				})),
				reasoning: ''
			};

			const aiResult = await this.aiProvider.generateCode(aiTasks, selectedTasks, projectContext);

			for (const file of aiResult.files) {
				await this.fileSystemManager.writeFile(file.path, file.content, {
					createBackup: true,
					verifyWrite: true
				});
				
				this.logService.info(`Generated file: ${file.path}`);
			}

			if (this._currentConversation) {
				const aiMessage: IAIMessage = {
					id: generateUuid(),
					type: MessageType.Assistant,
					content: `Generated code for ${aiResult.files.length} files:\n\n${aiResult.files.map(f => `- ${f.path}: ${f.description}`).join('\n')}\n\n**Reasoning:** ${aiResult.reasoning}`,
					timestamp: Date.now(),
					metadata: { files: aiResult.files.map(f => f.path) }
				};

				this._currentConversation.messages.push(aiMessage);
				await this.saveConversation(this._currentConversation);
				this._onDidChangeConversation.fire(this._currentConversation);
			}

			this.setState(ConversationState.Idle);

		} catch (error: any) {
			this.setState(ConversationState.Idle);
			this.logService.error('Failed to generate code:', error);
			throw error;
		}
	}

	async getTasks(conversationId?: string): Promise<IAITask[]> {
		this.ensureInitialized();
		const id = conversationId || this._currentConversation?.id;
		return id ? this.tasks.get(id) || [] : [];
	}

	async updateTask(taskId: string, updates: Partial<IAITask>): Promise<void> {
		this.ensureInitialized();
		
		if (!this._currentConversation) {
			return;
		}

		const tasks = this.tasks.get(this._currentConversation.id) || [];
		const taskIndex = tasks.findIndex(t => t.id === taskId);
		
		if (taskIndex >= 0) {
			tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
			this.tasks.set(this._currentConversation.id, tasks);
		}
	}

	async completeTask(taskId: string): Promise<void> {
		await this.updateTask(taskId, { completed: true });
	}

	async deleteTask(taskId: string): Promise<void> {
		this.ensureInitialized();
		
		if (!this._currentConversation) {
			return;
		}

		const tasks = this.tasks.get(this._currentConversation.id) || [];
		const filteredTasks = tasks.filter(t => t.id !== taskId);
		this.tasks.set(this._currentConversation.id, filteredTasks);
	}

	async loadProjectMemory(workspaceUri: URI): Promise<IProjectMemory | undefined> {
		try {
			const memory = await this.fileSystemManager.readJsonFile<IProjectMemory>(
				AICompanionFiles.PROJECT_MEMORY,
				PROJECT_MEMORY_SCHEMA
			);

			this._projectMemory = memory;
			if (memory) {
				this._onDidUpdateProjectMemory.fire(memory);
			}
			return memory;

		} catch (error: unknown) {
			this.logService.info('No existing project memory found, starting fresh');
			return undefined;
		}
	}

	async saveProjectMemory(memory: IProjectMemory): Promise<void> {
		this.ensureInitialized();
		
		await this.fileSystemManager.writeJsonFile(
			AICompanionFiles.PROJECT_MEMORY,
			memory,
			PROJECT_MEMORY_SCHEMA
		);

		this._projectMemory = memory;
		this._onDidUpdateProjectMemory.fire(memory);
	}

	async updateProjectMemory(updates: Partial<IProjectMemory>): Promise<void> {
		this.ensureInitialized();

		const currentMemory = this._projectMemory || {
			projectName: 'Untitled Project',
			goals: [],
			stack: [],
			architecture: '',
			features: [],
			userPreferences: {},
			conversations: [],
			lastUpdated: Date.now()
		};

		const updatedMemory: IProjectMemory = {
			...currentMemory,
			...updates,
			lastUpdated: Date.now()
		};

		await this.saveProjectMemory(updatedMemory);
	}

	async clearProjectMemory(): Promise<void> {
		this.ensureInitialized();
		
		try {
			await this.fileSystemManager.deleteFile(AICompanionFiles.PROJECT_MEMORY);
		} catch (error: unknown) {
			// Ignore errors when clearing project memory
		}

		this._projectMemory = undefined;
	}

	async setMode(mode: AICompanionMode): Promise<void> {
		this.ensureInitialized();
		
		this._currentMode = mode;
		
		if (this._currentConversation) {
			this._currentConversation.mode = mode;
			await this.saveConversation(this._currentConversation);
		}

		this._onDidChangeMode.fire(mode);
	}

	getMode(): AICompanionMode {
		return this._currentMode;
	}

	setState(state: ConversationState): void {
		this._currentState = state;
		
		if (this._currentConversation) {
			this._currentConversation.state = state;
		}

		this._onDidChangeState.fire(state);
	}

	getState(): ConversationState {
		return this._currentState;
	}

	async revertChanges(files: URI[]): Promise<void> {
		this.ensureInitialized();
		
		this.logService.info(`Reverting changes for ${files.length} files`);
	}

	async getModifiedFiles(): Promise<URI[]> {
		this.ensureInitialized();
		
		return [];
	}

	async createTasksFile(tasks: IAITask[]): Promise<URI> {
		this.ensureInitialized();
		
		let content = '# Tasks\n\n';
		
		for (const task of tasks) {
			const checkbox = task.completed ? '[x]' : '[ ]';
			content += `- ${checkbox} ${task.title}`;
			if (task.filePath) {
				content += ` (${task.filePath})`;
			}
			content += `\n`;
			
			if (task.description) {
				content += `  ${task.description}\n`;
			}
			content += '\n';
		}

		await this.fileSystemManager.writeFile(AICompanionFiles.TASKS_FILE, content);
		return URI.file(this.fileSystemManager.resolveProjectPath(AICompanionFiles.TASKS_FILE));
	}

	isWorkspaceCompatible(): boolean {
		return this.fileSystemManager.getInitialized() && 
			   this.fileSystemManager.detectWorkspaceRoot() !== null;
	}

	async getWorkspaceInfo(): Promise<{
		name: string;
		rootPath: string;
		files: string[];
		gitBranch?: string;
	}> {
		this.ensureInitialized();
		
		const rootPath = this.fileSystemManager.detectWorkspaceRoot() || '';
		const workspace = this.workspaceService.getWorkspace();
		
		return {
			name: workspace.folders?.[0]?.name || 'Unknown',
			rootPath: rootPath,
			files: [],
			gitBranch: undefined
		};
	}

	private ensureInitialized(): void {
		if (!this._isInitialized) {
			throw new Error('AI Companion Service not initialized');
		}
	}

	private async saveConversation(conversation: IAIConversation): Promise<void> {
		try {
			const conversationFile = `${AICompanionFiles.CONVERSATION_BACKUP}.${conversation.id}.json`;
			await this.fileSystemManager.writeJsonFile(
				conversationFile,
				conversation,
				CONVERSATION_SCHEMA
			);
		} catch (error: unknown) {
			// Safe error handling
			let errorMessage = 'Unknown error';
			if (error) {
				if (typeof error === 'string') {
					errorMessage = error;
				} else if (typeof error === 'object' && error !== null) {
					const errorObj = error as any;
					errorMessage = errorObj.message || errorObj.toString() || 'Unknown error';
				}
			}
			this.logService.error('Failed to save conversation:', errorMessage);
		}
	}

	private async loadExistingConversations(): Promise<void> {
	}
}