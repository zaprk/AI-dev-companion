import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

export const AICompanionContext = {
	Enabled: new RawContextKey<boolean>('aiCompanion.enabled', false, { type: 'boolean', description: 'Whether AI Companion is enabled' }),
	PanelVisible: new RawContextKey<boolean>('aiCompanion.panelVisible', false, { type: 'boolean', description: 'Whether AI Companion panel is visible' }),
	HasActiveConversation: new RawContextKey<boolean>('aiCompanion.hasActiveConversation', false, { type: 'boolean', description: 'Whether there is an active AI conversation' }),
	
	IsHelperMode: new RawContextKey<boolean>('aiCompanion.isHelperMode', true, { type: 'boolean', description: 'Whether AI is in Helper mode' }),
	IsBuilderMode: new RawContextKey<boolean>('aiCompanion.isBuilderMode', false, { type: 'boolean', description: 'Whether AI is in Builder mode' }),
	
	IsGenerating: new RawContextKey<boolean>('aiCompanion.isGenerating', false, { type: 'boolean', description: 'Whether AI is currently generating content' }),
	HasTasks: new RawContextKey<boolean>('aiCompanion.hasTasks', false, { type: 'boolean', description: 'Whether there are active tasks' }),
	HasProjectMemory: new RawContextKey<boolean>('aiCompanion.hasProjectMemory', false, { type: 'boolean', description: 'Whether project memory exists' }),
	
	IsWorkspaceCompatible: new RawContextKey<boolean>('aiCompanion.isWorkspaceCompatible', false, { type: 'boolean', description: 'Whether current workspace is compatible with AI Companion' }),
	HasGitRepository: new RawContextKey<boolean>('aiCompanion.hasGitRepository', false, { type: 'boolean', description: 'Whether workspace has Git repository' })
};

export const AICompanionCommands = {
	Focus: 'aiCompanion.focus',
	Toggle: 'aiCompanion.toggle',
	Hide: 'aiCompanion.hide',
	
	NewConversation: 'aiCompanion.newConversation',
	DeleteConversation: 'aiCompanion.deleteConversation',
	SwitchConversation: 'aiCompanion.switchConversation',
	ClearMessages: 'aiCompanion.clearMessages',
	
	GenerateRequirements: 'aiCompanion.generateRequirements',
	GenerateDesign: 'aiCompanion.generateDesign',
	GenerateTasks: 'aiCompanion.generateTasks',
	GenerateCode: 'aiCompanion.generateCode',
	
	SetHelperMode: 'aiCompanion.setHelperMode',
	SetBuilderMode: 'aiCompanion.setBuilderMode',
	ToggleMode: 'aiCompanion.toggleMode',
	
	CompleteTask: 'aiCompanion.completeTask',
	DeleteTask: 'aiCompanion.deleteTask',
	EditTask: 'aiCompanion.editTask',
	CreateTasksFile: 'aiCompanion.createTasksFile',
	
	RevertChanges: 'aiCompanion.revertChanges',
	ShowModifiedFiles: 'aiCompanion.showModifiedFiles',
	
	ClearProjectMemory: 'aiCompanion.clearProjectMemory',
	ExportProjectMemory: 'aiCompanion.exportProjectMemory',
	ImportProjectMemory: 'aiCompanion.importProjectMemory'
};

export const AICompanionViewIds = {
	VIEWLET_ID: 'workbench.view.aiCompanion',
	
	CHAT_VIEW_ID: 'aiCompanion.chatView',
	TASKS_VIEW_ID: 'aiCompanion.tasksView',
	REQUIREMENTS_VIEW_ID: 'aiCompanion.requirementsView',
	DESIGN_VIEW_ID: 'aiCompanion.designView',
	MEMORY_VIEW_ID: 'aiCompanion.memoryView'
};

export const AICompanionConfiguration = {
	SECTION: 'aiCompanion',
	
	ENABLED: 'aiCompanion.enabled',
	DEFAULT_MODE: 'aiCompanion.defaultMode',
	AUTO_SAVE_GENERATED_FILES: 'aiCompanion.autoSaveGeneratedFiles',
	MEMORY_RETENTION_DAYS: 'aiCompanion.memoryRetentionDays',
	MAX_CONVERSATION_HISTORY: 'aiCompanion.maxConversationHistory',
	SHOW_TASK_PROGRESS: 'aiCompanion.showTaskProgress',
	AUTO_CREATE_TASKS_FILE: 'aiCompanion.autoCreateTasksFile',
	ENABLE_CODE_LENS: 'aiCompanion.enableCodeLens',
	ENABLE_INLINE_SUGGESTIONS: 'aiCompanion.enableInlineSuggestions'
};

export const AICompanionActivityBarPosition = {
	ORDER: 4,
	ID: 'workbench.view.aiCompanion'
};

export const AICompanionFiles = {
	PROJECT_MEMORY: '.ai.memory',
	TASKS_FILE: 'tasks.md',
	REQUIREMENTS_FILE: 'requirements.md',
	DESIGN_FILE: 'design.md',
	CONVERSATION_BACKUP: '.ai.conversations'
};