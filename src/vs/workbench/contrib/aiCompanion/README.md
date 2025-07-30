# AI Companion Extension for VS Code

## Overview

The AI Companion extension provides an intelligent assistant interface integrated directly into VS Code's secondary side panel. It offers a structured approach to AI-assisted development with features like conversation management, task generation, and code assistance.

## Architecture

### Core Components

#### 1. Service Layer (`common/`)
- **`aiCompanionService.ts`** - Main service interface defining the contract
- **`aiCompanionService.impl.ts`** - Service implementation with business logic
- **`aiCompanionServiceTokens.ts`** - Constants, commands, and context keys
- **`aiCompanion.contribution.ts`** - Extension registration and contribution points

#### 2. UI Layer (`browser/`)
- **`aiCompanionViewContainer.ts`** - Secondary side panel container
- **`aiCompanionCommands.ts`** - Command registrations
- **`views/aiChatView.ts`** - Main chat interface

#### 3. File System Management (`common/`)
- **`fileSystemManager.ts`** - Atomic file operations, caching, and watching
- **`utils/pathUtils.ts`** - Path resolution and validation
- **`utils/validationUtils.ts`** - JSON validation and file integrity
- **`types/fileSystemTypes.ts`** - Type definitions

## Secondary Side Panel Integration

### 1. View Container Setup

The extension creates a view container in the secondary side panel (right side) using VS Code's view system:

```typescript
// aiCompanionViewContainer.ts
export const AI_COMPANION_CONTAINER: ViewContainer = {
    id: AICompanionViewIds.VIEWLET_ID,
    title: { value: localize('aiCompanion', 'AI Companion'), original: 'AI Companion' },
    ctorDescriptor: new SyncDescriptor(AICompanionViewPaneContainer),
    icon: Codicon.robot,
    order: 100,
    requestedIndex: 100,
    hideIfEmpty: false,
    storageId: 'workbench.view.aiCompanion.state'
};

// Register in AUXILIARY BAR (secondary side panel)
Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
    .registerViewContainer(AI_COMPANION_CONTAINER, ViewContainerLocation.AuxiliaryBar, {
        isDefault: false
    });
```

### 2. View Registration

Views are registered within the container:

```typescript
// aiCompanion.contribution.ts
viewsRegistry.registerViews([{
    id: AICompanionViewIds.CHAT_VIEW_ID,
    name: { value: 'Chat', original: 'Chat' },
    ctorDescriptor: new SyncDescriptor(AIChatView),
    canToggleVisibility: false,
    canMoveView: false,
    containerIcon: AI_COMPANION_CONTAINER.icon,
    order: 1
}], AI_COMPANION_CONTAINER);
```

### 3. Service Registration

The service is registered as a singleton:

```typescript
// aiCompanion.contribution.ts
registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Delayed);
```

## Key Features

### 1. Conversation Management
- **Multiple Conversations**: Support for multiple AI conversations per workspace
- **Persistent Storage**: Conversations are saved to disk and restored on reload
- **State Management**: Track conversation states (idle, generating, etc.)

### 2. AI Modes
- **Helper Mode**: AI suggests changes but doesn't write code directly
- **Builder Mode**: AI writes code directly to files

### 3. Structured Development Flow
- **Requirements Generation**: Convert prompts into structured requirements
- **Design Generation**: Create system architecture and component design
- **Task Generation**: Break down requirements into actionable tasks
- **Code Generation**: Generate code based on tasks and design

### 4. Project Memory
- **Persistent Context**: Remember project goals, tech stack, and preferences
- **Conversation History**: Track all AI interactions
- **User Preferences**: Store user-specific settings and preferences

### 5. File System Integration
- **Atomic Operations**: Safe file writing with backup and verification
- **File Watching**: Monitor file changes with debouncing
- **Caching**: Intelligent file content caching for performance
- **Lock Management**: Prevent concurrent file access conflicts

## Integration Guide

### 1. Adding to VS Code

#### Step 1: Register the Extension
Add to `package.json`:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "workbench.view.aiCompanion",
          "title": "AI Companion",
          "icon": "resources/ai-companion.svg"
        }
      ]
    },
    "views": {
      "workbench.view.aiCompanion": [
        {
          "id": "aiCompanion.chatView",
          "name": "Chat",
          "when": "aiCompanion.enabled"
        }
      ]
    },
    "commands": [
      {
        "command": "aiCompanion.focus",
        "title": "AI Companion: Focus",
        "category": "AI Companion"
      }
    ]
  }
}
```

#### Step 2: Initialize the Service
In your extension's main file:

```typescript
import { AICompanionService } from './aiCompanionService.impl';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

// Register the service
registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Delayed);

// Initialize when workspace opens
workspaceService.onDidChangeWorkspaceFolders(() => {
    const aiService = instantiationService.get(IAICompanionService);
    if (workspaceService.getWorkspace().folders.length > 0) {
        aiService.initialize(workspaceService.getWorkspace().folders[0].uri);
    }
});
```

### 2. Using the Service

#### Basic Usage
```typescript
// Get the service
const aiService = instantiationService.get(IAICompanionService);

// Start a new conversation
const conversation = await aiService.startNewConversation(AICompanionMode.Helper);

// Send a message
const message = await aiService.sendMessage("Help me create a React component");

// Generate requirements
const requirements = await aiService.generateRequirements("Build a todo app");

// Generate design
const design = await aiService.generateDesign(requirements);

// Generate tasks
const tasks = await aiService.generateTasks(requirements, design);

// Generate code
await aiService.generateCode(tasks);
```

#### Event Handling
```typescript
// Listen for conversation changes
aiService.onDidChangeConversation((conversation) => {
    console.log('Conversation updated:', conversation.id);
});

// Listen for mode changes
aiService.onDidChangeMode((mode) => {
    console.log('AI mode changed to:', mode);
});

// Listen for state changes
aiService.onDidChangeState((state) => {
    console.log('Conversation state:', state);
});
```

### 3. Customizing the UI

#### Adding New Views
```typescript
// Create a new view
export class AITasksView extends ViewPane {
    static readonly ID = 'aiCompanion.tasksView';
    
    protected override renderBody(container: HTMLElement): void {
        // Render your tasks UI
    }
}

// Register the view
viewsRegistry.registerViews([{
    id: 'aiCompanion.tasksView',
    name: { value: 'Tasks', original: 'Tasks' },
    ctorDescriptor: new SyncDescriptor(AITasksView),
    canToggleVisibility: true,
    containerIcon: AI_COMPANION_CONTAINER.icon,
    order: 2
}], AI_COMPANION_CONTAINER);
```

#### Adding Commands
```typescript
// Register commands
CommandsRegistry.registerCommand({
    id: 'aiCompanion.customCommand',
    handler: async (accessor) => {
        const aiService = accessor.get(IAICompanionService);
        // Your command logic
    }
});

// Add to command palette
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
        id: 'aiCompanion.customCommand',
        title: 'AI Companion: Custom Action',
        category: 'AI Companion'
    }
});
```

## Configuration

### Settings
```json
{
  "aiCompanion.enabled": true,
  "aiCompanion.defaultMode": "helper",
  "aiCompanion.autoSaveGeneratedFiles": true,
  "aiCompanion.memoryRetentionDays": 30,
  "aiCompanion.maxConversationHistory": 100,
  "aiCompanion.showTaskProgress": true,
  "aiCompanion.autoCreateTasksFile": true,
  "aiCompanion.enableCodeLens": true,
  "aiCompanion.enableInlineSuggestions": true
}
```

### Context Keys
The extension provides several context keys for conditional UI:

- `aiCompanion.enabled` - Whether AI Companion is enabled
- `aiCompanion.panelVisible` - Whether the panel is visible
- `aiCompanion.hasActiveConversation` - Whether there's an active conversation
- `aiCompanion.isHelperMode` - Whether AI is in helper mode
- `aiCompanion.isBuilderMode` - Whether AI is in builder mode
- `aiCompanion.isGenerating` - Whether AI is currently generating content
- `aiCompanion.hasTasks` - Whether there are active tasks
- `aiCompanion.hasProjectMemory` - Whether project memory exists
- `aiCompanion.isWorkspaceCompatible` - Whether workspace is compatible
- `aiCompanion.hasGitRepository` - Whether workspace has Git repository

## File Structure

```
aiCompanion/
├── browser/
│   ├── aiCompanionCommands.ts      # Command registrations
│   ├── aiCompanionViewContainer.ts # Secondary panel container
│   └── views/
│       └── aiChatView.ts           # Main chat interface
├── common/
│   ├── aiCompanion.contribution.ts # Extension registration
│   ├── aiCompanionService.ts       # Service interface
│   ├── aiCompanionService.impl.ts  # Service implementation
│   ├── aiCompanionServiceTokens.ts # Constants and tokens
│   ├── fileSystemManager.ts        # File system operations
│   ├── utils/
│   │   ├── pathUtils.ts            # Path utilities
│   │   └── validationUtils.ts      # Validation utilities
│   └── types/
│       └── fileSystemTypes.ts      # Type definitions
└── README.md                       # This documentation
```

## Best Practices

### 1. Service Usage
- Always check if the service is initialized before use
- Handle errors gracefully with proper logging
- Use the event system for reactive updates
- Dispose of resources properly

### 2. UI Development
- Follow VS Code's design patterns and conventions
- Use the theming system for consistent appearance
- Implement proper focus management
- Handle keyboard shortcuts appropriately

### 3. File Operations
- Use atomic operations for file writes
- Implement proper error handling and recovery
- Use file watching for real-time updates
- Cache frequently accessed data

### 4. Performance
- Implement proper cleanup in dispose methods
- Use debouncing for file watchers
- Cache expensive operations
- Limit memory usage with proper data structures

## Troubleshooting

### Common Issues

1. **Service not initialized**
   - Ensure the service is registered as a singleton
   - Check that workspace is properly detected
   - Verify initialization is called after workspace opens

2. **Views not appearing**
   - Check view container registration
   - Verify view registration in the correct container
   - Ensure context keys are properly set

3. **File operations failing**
   - Check file permissions
   - Verify workspace root detection
   - Ensure proper error handling

4. **Performance issues**
   - Monitor file cache usage
   - Check for memory leaks in event listeners
   - Verify proper disposal of resources

### Debugging

Enable debug logging by setting the log level:

```typescript
// In your extension
const logService = instantiationService.get(ILogService);
logService.setLevel(LogLevel.Debug);
```

## Future Enhancements

1. **AI Integration**: Connect to actual AI services (OpenAI, Claude, etc.)
2. **Code Analysis**: Integrate with VS Code's language services
3. **Git Integration**: Better integration with source control
4. **Multi-language Support**: Support for more programming languages
5. **Plugin System**: Allow third-party extensions to extend functionality
6. **Advanced UI**: More sophisticated chat interface with markdown support
7. **Collaboration**: Multi-user collaboration features
8. **Analytics**: Usage analytics and insights

## Contributing

When contributing to the AI Companion extension:

1. Follow VS Code's coding standards
2. Add proper TypeScript types
3. Include comprehensive tests
4. Update documentation
5. Follow the existing architecture patterns
6. Use proper error handling
7. Implement proper resource cleanup

## License

This extension follows the same license as VS Code itself. 