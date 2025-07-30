# AI Companion Extension - Quick Reference

## File Structure Overview

```
aiCompanion/
├── browser/                    # UI Layer
│   ├── aiCompanionCommands.ts  # Command registrations
│   ├── aiCompanionViewContainer.ts # Secondary panel container
│   └── views/
│       └── aiChatView.ts       # Main chat interface
├── common/                     # Service Layer
│   ├── aiCompanion.contribution.ts # Extension registration
│   ├── aiCompanionService.ts   # Service interface
│   ├── aiCompanionService.impl.ts # Service implementation
│   ├── aiCompanionServiceTokens.ts # Constants & tokens
│   ├── fileSystemManager.ts    # File operations
│   ├── utils/
│   │   ├── pathUtils.ts        # Path utilities
│   │   └── validationUtils.ts  # Validation utilities
│   └── types/
│       └── fileSystemTypes.ts  # Type definitions
└── README.md                   # Main documentation
```

## Key Classes & Interfaces

### Service Layer
- **`IAICompanionService`** - Main service interface
- **`AICompanionService`** - Service implementation
- **`FileSystemManager`** - File operations manager
- **`PathUtils`** - Path resolution utilities
- **`ValidationUtils`** - JSON validation utilities

### UI Layer
- **`AICompanionViewPaneContainer`** - Secondary panel container
- **`AIChatView`** - Main chat interface
- **`ViewPane`** - Base class for views

### Data Types
- **`IAIConversation`** - Conversation data structure
- **`IAIMessage`** - Message data structure
- **`IAITask`** - Task data structure
- **`IProjectMemory`** - Project memory data structure

## Quick Start Commands

### Basic Service Usage
```typescript
// Get service
const aiService = instantiationService.get(IAICompanionService);

// Start conversation
const conversation = await aiService.startNewConversation(AICompanionMode.Helper);

// Send message
const message = await aiService.sendMessage("Hello AI!");

// Generate requirements
const requirements = await aiService.generateRequirements("Build a todo app");

// Generate design
const design = await aiService.generateDesign(requirements);

// Generate tasks
const tasks = await aiService.generateTasks(requirements, design);

// Generate code
await aiService.generateCode(tasks);
```

### Event Handling
```typescript
// Listen for changes
aiService.onDidChangeConversation((conversation) => {
    console.log('Conversation updated:', conversation.id);
});

aiService.onDidChangeMode((mode) => {
    console.log('Mode changed:', mode);
});

aiService.onDidChangeState((state) => {
    console.log('State changed:', state);
});
```

## Secondary Panel Integration

### Essential Code Snippets

#### 1. View Container Registration
```typescript
Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
    .registerViewContainer(AI_COMPANION_CONTAINER, ViewContainerLocation.AuxiliaryBar, {
        isDefault: false
    });
```

#### 2. View Registration
```typescript
viewsRegistry.registerViews([{
    id: 'aiCompanion.chatView',
    name: { value: 'Chat', original: 'Chat' },
    ctorDescriptor: new SyncDescriptor(AIChatView),
    canToggleVisibility: false,
    canMoveView: false,
    order: 1
}], AI_COMPANION_CONTAINER);
```

#### 3. Service Registration
```typescript
registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Delayed);
```

#### 4. Command Registration
```typescript
CommandsRegistry.registerCommand({
    id: 'aiCompanion.focus',
    handler: async (accessor) => {
        const viewsService = accessor.get(IViewsService);
        await viewsService.openView('aiCompanion.chatView', true);
    }
});
```

## Configuration Keys

### Context Keys
- `aiCompanion.enabled` - Extension enabled
- `aiCompanion.panelVisible` - Panel visible
- `aiCompanion.hasActiveConversation` - Active conversation exists
- `aiCompanion.isHelperMode` - Helper mode active
- `aiCompanion.isBuilderMode` - Builder mode active
- `aiCompanion.isGenerating` - AI generating content
- `aiCompanion.hasTasks` - Tasks exist
- `aiCompanion.hasProjectMemory` - Project memory exists
- `aiCompanion.isWorkspaceCompatible` - Workspace compatible
- `aiCompanion.hasGitRepository` - Git repository exists

### Settings
- `aiCompanion.enabled` - Enable/disable extension
- `aiCompanion.defaultMode` - Default AI mode
- `aiCompanion.autoSaveGeneratedFiles` - Auto-save generated files
- `aiCompanion.memoryRetentionDays` - Memory retention period
- `aiCompanion.maxConversationHistory` - Max conversation history
- `aiCompanion.showTaskProgress` - Show task progress
- `aiCompanion.autoCreateTasksFile` - Auto-create tasks file
- `aiCompanion.enableCodeLens` - Enable code lens
- `aiCompanion.enableInlineSuggestions` - Enable inline suggestions

## File System Operations

### Basic File Operations
```typescript
// Write file
await fileSystemManager.writeFile('path/to/file.txt', 'content');

// Read file
const content = await fileSystemManager.readFile('path/to/file.txt');

// Read JSON file
const data = await fileSystemManager.readJsonFile('config.json', schema);

// Write JSON file
await fileSystemManager.writeJsonFile('config.json', data, schema);

// Check if file exists
const exists = await fileSystemManager.fileExists('path/to/file.txt');

// Delete file
await fileSystemManager.deleteFile('path/to/file.txt');
```

### File Watching
```typescript
// Watch file for changes
await fileSystemManager.watchFile('path/to/file.txt', (changeType, content) => {
    console.log('File changed:', changeType, content);
});

// Stop watching
fileSystemManager.stopWatching('path/to/file.txt');
```

### Atomic Operations
```typescript
// Atomic write with backup
await fileSystemManager.atomicWrite('path/to/file.txt', 'content', {
    createBackup: true,
    verifyWrite: true
});
```

## Error Handling Patterns

### Service Error Handling
```typescript
try {
    await aiService.initialize(workspaceUri);
} catch (error) {
    logService.error('Failed to initialize AI service:', error);
    // Handle gracefully
}
```

### File Operation Error Handling
```typescript
try {
    await fileSystemManager.writeFile('path/to/file.txt', content);
} catch (error) {
    if (error instanceof FileSystemError) {
        logService.warn(`File operation failed: ${error.message}`);
    } else {
        logService.error('Unexpected error:', error);
    }
}
```

## Performance Tips

### Memory Management
```typescript
// Proper disposal
export class MyView extends ViewPane {
    private disposables = new DisposableStore();

    constructor() {
        super();
        this.disposables.add(this.aiService.onDidChangeConversation(this.updateUI));
    }

    override dispose(): void {
        this.disposables.dispose();
        super.dispose();
    }
}
```

### Caching
```typescript
// Use file system caching
const content = await fileSystemManager.readFile('large-file.txt', true); // useCache = true

// Clear cache when needed
validationUtils.clearHashCache();
```

## Debugging

### Enable Debug Logging
```typescript
const logService = instantiationService.get(ILogService);
logService.setLevel(LogLevel.Debug);
```

### Check Service Status
```typescript
const status = fileSystemManager.getStatus();
console.log('File system status:', status);

const isInitialized = aiService.currentConversation !== undefined;
console.log('AI service initialized:', isInitialized);
```

### Monitor Events
```typescript
// Monitor all service events
aiService.onDidChangeConversation(console.log);
aiService.onDidChangeMode(console.log);
aiService.onDidChangeState(console.log);
aiService.onDidUpdateProjectMemory(console.log);
```

## Common Patterns

### View with Service Integration
```typescript
export class MyView extends ViewPane {
    private readonly aiService: IAICompanionService;
    private readonly disposables = new DisposableStore();

    constructor(options: IViewPaneOptions, ...services) {
        super(options, ...services);
        this.aiService = instantiationService.get(IAICompanionService);
        
        // Listen for service events
        this.disposables.add(this.aiService.onDidChangeConversation(this.updateUI));
    }

    protected override renderBody(container: HTMLElement): void {
        // Render UI
        this.updateUI(this.aiService.currentConversation);
    }

    private updateUI = (conversation?: IAIConversation): void => {
        // Update UI based on conversation
    };

    override dispose(): void {
        this.disposables.dispose();
        super.dispose();
    }
}
```

### Command with Service Access
```typescript
CommandsRegistry.registerCommand({
    id: 'myExtension.command',
    handler: async (accessor) => {
        const aiService = accessor.get(IAICompanionService);
        const viewsService = accessor.get(IViewsService);
        
        // Command logic
        await aiService.startNewConversation(AICompanionMode.Helper);
        await viewsService.openView('myExtension.view', true);
    }
});
```

### File Operation with Validation
```typescript
const schema = {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name']
};

try {
    const data = await fileSystemManager.readJsonFile('config.json', schema);
    console.log('Valid data:', data);
} catch (error) {
    console.error('Invalid data or file error:', error);
}
```

## Troubleshooting Checklist

- [ ] Service registered as singleton
- [ ] View container registered in AuxiliaryBar
- [ ] Views registered in correct container
- [ ] Commands registered and accessible
- [ ] Context keys properly set
- [ ] File permissions correct
- [ ] Workspace root detected
- [ ] Service initialized after workspace opens
- [ ] Proper error handling implemented
- [ ] Resources disposed correctly
- [ ] CSS variables used for theming
- [ ] Event listeners properly managed

This quick reference should help you get started with the AI Companion extension and understand the key patterns for VS Code secondary panel integration. 