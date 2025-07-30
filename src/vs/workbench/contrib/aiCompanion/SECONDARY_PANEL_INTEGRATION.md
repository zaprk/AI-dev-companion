# VS Code Secondary Side Panel Integration Guide

## Overview

This guide explains how to integrate custom UI into VS Code's secondary side panel (the right-side panel that appears when you have multiple panels open). The AI Companion extension demonstrates a complete implementation of this pattern.

## Secondary Side Panel Architecture

### What is the Secondary Side Panel?

The secondary side panel is VS Code's right-side panel system that allows extensions to create additional UI containers alongside the primary activity bar. It's different from the main activity bar (left side) and provides a dedicated space for extension-specific interfaces.

### Key Components

1. **View Container** - The main container that holds multiple views
2. **Views** - Individual UI components within the container
3. **View Pane Container** - The class that manages the container's behavior
4. **View Pane** - The base class for individual views

## Implementation Steps

### Step 1: Create the View Container

```typescript
// aiCompanionViewContainer.ts
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { ViewContainer, ViewContainerLocation } from '../../../common/views.js';
import { Codicon } from '../../../../base/common/codicons.js';

export class AICompanionViewPaneContainer extends ViewPaneContainer {
    static readonly ID = 'workbench.view.aiCompanion';

    constructor(
        layoutService: any,
        telemetryService: any,
        contextService: any,
        storageService: any,
        configurationService: any,
        instantiationService: any,
        themeService: any,
        contextMenuService: any,
        extensionService: any,
        contextKeyService: any,
        viewDescriptorService: any,
        logService: any
    ) {
        super(
            'workbench.view.aiCompanion',
            {
                mergeViewWithContainerWhenSingleView: false,
            },
            instantiationService,
            configurationService,
            layoutService,
            contextMenuService,
            telemetryService,
            extensionService,
            themeService,
            storageService,
            contextService,
            viewDescriptorService,
            logService
        );
    }

    override getTitle(): string {
        return localize('aiCompanion', 'AI Companion');
    }

    override getOptimalWidth(): number {
        return 400;
    }
}

export const AI_COMPANION_CONTAINER: ViewContainer = {
    id: 'workbench.view.aiCompanion',
    title: { value: localize('aiCompanion', 'AI Companion'), original: 'AI Companion' },
    ctorDescriptor: new SyncDescriptor(AICompanionViewPaneContainer),
    icon: Codicon.robot,
    order: 100,
    requestedIndex: 100,
    hideIfEmpty: false,
    storageId: 'workbench.view.aiCompanion.state'
};
```

### Step 2: Register the View Container

```typescript
// aiCompanion.contribution.ts
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, Extensions as ViewContainerExtensions } from '../../../common/views.js';
import { ViewContainerLocation } from '../../../common/views.js';

// Register the view container in the AUXILIARY BAR (secondary side panel)
Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
    .registerViewContainer(AI_COMPANION_CONTAINER, ViewContainerLocation.AuxiliaryBar, {
        isDefault: false // Users can enable/disable it
    });
```

### Step 3: Create Individual Views

```typescript
// aiChatView.ts
import { ViewPane, IViewPaneOptions } from '../../../../browser/parts/views/viewPane.js';
import { append, $ } from '../../../../../base/browser/dom.js';

export class AIChatView extends ViewPane {
    static readonly ID = 'aiCompanion.chatView';

    constructor(
        options: IViewPaneOptions,
        keybindingService: IKeybindingService,
        contextMenuService: IContextMenuService,
        configurationService: IConfigurationService,
        contextKeyService: IContextKeyService,
        viewDescriptorService: IViewDescriptorService,
        instantiationService: IInstantiationService,
        openerService: IOpenerService,
        themeService: IThemeService,
        hoverService: IHoverService
    ) {
        super(options, keybindingService, contextMenuService, configurationService, 
              contextKeyService, viewDescriptorService, instantiationService, 
              openerService, themeService, hoverService);
    }

    protected override renderBody(container: HTMLElement): void {
        super.renderBody(container);
        
        // Create your UI here
        const chatContainer = append(container, $('.ai-chat-container'));
        
        // Add your custom UI elements
        const messagesContainer = append(chatContainer, $('.ai-messages-container'));
        const inputContainer = append(chatContainer, $('.ai-input-container'));
        
        // Style your elements
        messagesContainer.style.height = '200px';
        messagesContainer.style.overflow = 'auto';
        messagesContainer.style.border = '1px solid var(--vscode-panel-border)';
        messagesContainer.style.padding = '8px';
        messagesContainer.style.marginBottom = '8px';
    }

    override focus(): void {
        super.focus();
        // Focus on your input element
        const input = this.inputContainer?.querySelector('input') as HTMLInputElement;
        if (input) {
            input.focus();
        }
    }

    getTitle(): string {
        return 'AI Chat';
    }
}
```

### Step 4: Register Views

```typescript
// aiCompanion.contribution.ts
import { IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

viewsRegistry.registerViews([{
    id: 'aiCompanion.chatView',
    name: { value: 'Chat', original: 'Chat' },
    ctorDescriptor: new SyncDescriptor(AIChatView),
    canToggleVisibility: false, // Always visible in the container
    canMoveView: false, // Fixed position
    containerIcon: AI_COMPANION_CONTAINER.icon,
    order: 1 // First view in the container
}], AI_COMPANION_CONTAINER);
```

### Step 5: Add Commands

```typescript
// aiCompanionCommands.ts
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { MenuRegistry, MenuId } from '../../../../platform/actions/common/actions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';

// Register commands to control the panel
CommandsRegistry.registerCommand({
    id: 'aiCompanion.focus',
    handler: async (accessor) => {
        const viewsService = accessor.get(IViewsService);
        await viewsService.openView('aiCompanion.chatView', true);
    }
});

CommandsRegistry.registerCommand({
    id: 'aiCompanion.toggle',
    handler: async (accessor) => {
        const viewsService = accessor.get(IViewsService);
        const view = viewsService.getActiveViewWithId('aiCompanion.chatView');
        
        if (view) {
            await viewsService.closeView('aiCompanion.chatView');
        } else {
            await viewsService.openView('aiCompanion.chatView', true);
        }
    }
});

// Add commands to the command palette
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
        id: 'aiCompanion.focus',
        title: localize('aiCompanion.focus', 'AI Companion: Focus'),
        category: localize('aiCompanion.category', 'AI Companion')
    }
});
```

## Package.json Configuration

Add the following to your extension's `package.json`:

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
      },
      {
        "command": "aiCompanion.toggle",
        "title": "AI Companion: Toggle Panel",
        "category": "AI Companion"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "aiCompanion.focus",
          "when": "aiCompanion.enabled"
        },
        {
          "command": "aiCompanion.toggle"
        }
      ]
    }
  }
}
```

## Key Concepts

### ViewContainerLocation.AuxiliaryBar

This is the key enum value that places your container in the secondary side panel:

```typescript
ViewContainerLocation.AuxiliaryBar // Secondary side panel (right side)
ViewContainerLocation.Panel        // Bottom panel
ViewContainerLocation.Sidebar      // Primary sidebar (left side)
```

### View Container Properties

- **`id`**: Unique identifier for the container
- **`title`**: Display name with localization support
- **`ctorDescriptor`**: Reference to the container class
- **`icon`**: VS Code icon (using Codicon)
- **`order`**: Position in the activity bar
- **`requestedIndex`**: Preferred position
- **`hideIfEmpty`**: Whether to hide when no views are visible
- **`storageId`**: For persisting container state

### View Properties

- **`id`**: Unique identifier for the view
- **`name`**: Display name with localization
- **`ctorDescriptor`**: Reference to the view class
- **`canToggleVisibility`**: Whether users can hide/show the view
- **`canMoveView`**: Whether users can reorder the view
- **`containerIcon`**: Icon to show in the container
- **`order`**: Position within the container
- **`when`**: Context key for conditional visibility

## Styling and Theming

### Using VS Code's Theme Variables

```typescript
// Use VS Code's CSS variables for consistent theming
messagesContainer.style.border = '1px solid var(--vscode-panel-border)';
messagesContainer.style.backgroundColor = 'var(--vscode-editor-background)';
messagesContainer.style.color = 'var(--vscode-editor-foreground)';
```

### CSS Classes

```css
/* Add to your extension's CSS */
.ai-chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px;
}

.ai-messages-container {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
}

.ai-input-container {
    display: flex;
    gap: 8px;
}

.ai-input-container input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
}

.ai-input-container button {
    padding: 4px 12px;
    border: 1px solid var(--vscode-button-border);
    border-radius: 4px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    cursor: pointer;
}

.ai-input-container button:hover {
    background: var(--vscode-button-hoverBackground);
}
```

## Event Handling

### View Lifecycle Events

```typescript
export class AIChatView extends ViewPane {
    protected override renderBody(container: HTMLElement): void {
        // Called when the view is first rendered
    }

    override focus(): void {
        // Called when the view receives focus
    }

    override layout(height: number, width: number): void {
        // Called when the view is resized
    }

    override dispose(): void {
        // Called when the view is disposed
        super.dispose();
    }
}
```

### Service Integration

```typescript
// In your view, integrate with your service
export class AIChatView extends ViewPane {
    private readonly aiService: IAICompanionService;

    constructor(/* ... */) {
        super(/* ... */);
        this.aiService = instantiationService.get(IAICompanionService);
        
        // Listen for service events
        this._register(this.aiService.onDidChangeConversation((conversation) => {
            this.updateUI(conversation);
        }));
    }

    private updateUI(conversation: IAIConversation): void {
        // Update your UI based on conversation changes
    }
}
```

## Best Practices

### 1. Performance
- Use `requestAnimationFrame` for smooth animations
- Implement proper cleanup in `dispose()` methods
- Use event delegation for large lists
- Debounce user input when appropriate

### 2. Accessibility
- Provide proper ARIA labels
- Support keyboard navigation
- Use semantic HTML elements
- Test with screen readers

### 3. Responsive Design
- Handle different container sizes
- Use flexbox for layout
- Test with different VS Code window sizes
- Consider mobile/tablet layouts

### 4. Error Handling
- Gracefully handle service failures
- Show user-friendly error messages
- Implement retry mechanisms
- Log errors for debugging

## Troubleshooting

### Common Issues

1. **View not appearing**
   - Check view container registration
   - Verify view registration in correct container
   - Ensure context keys are properly set
   - Check for TypeScript compilation errors

2. **Styling issues**
   - Use VS Code theme variables
   - Check CSS specificity
   - Verify CSS is loaded
   - Test in different themes

3. **Service integration problems**
   - Ensure service is properly registered
   - Check service initialization
   - Verify dependency injection
   - Handle async operations properly

4. **Performance issues**
   - Monitor memory usage
   - Implement proper cleanup
   - Use efficient DOM operations
   - Avoid blocking the main thread

### Debugging Tips

```typescript
// Enable debug logging
const logService = instantiationService.get(ILogService);
logService.setLevel(LogLevel.Debug);

// Check view registration
console.log('Registered views:', viewsRegistry.getViews(AI_COMPANION_CONTAINER));

// Monitor service state
aiService.onDidChangeState((state) => {
    console.log('Service state changed:', state);
});
```

## Advanced Features

### Multiple Views

```typescript
// Register multiple views in the same container
viewsRegistry.registerViews([
    {
        id: 'aiCompanion.chatView',
        name: { value: 'Chat', original: 'Chat' },
        ctorDescriptor: new SyncDescriptor(AIChatView),
        order: 1
    },
    {
        id: 'aiCompanion.tasksView',
        name: { value: 'Tasks', original: 'Tasks' },
        ctorDescriptor: new SyncDescriptor(AITasksView),
        order: 2
    },
    {
        id: 'aiCompanion.settingsView',
        name: { value: 'Settings', original: 'Settings' },
        ctorDescriptor: new SyncDescriptor(AISettingsView),
        order: 3
    }
], AI_COMPANION_CONTAINER);
```

### Context-Aware Views

```typescript
// Views that appear conditionally
{
    id: 'aiCompanion.debugView',
    name: { value: 'Debug', original: 'Debug' },
    ctorDescriptor: new SyncDescriptor(AIDebugView),
    when: 'inDebugMode', // Only show when debugging
    order: 4
}
```

### Dynamic View Registration

```typescript
// Register views dynamically based on conditions
if (someCondition) {
    viewsRegistry.registerViews([{
        id: 'aiCompanion.dynamicView',
        name: { value: 'Dynamic', original: 'Dynamic' },
        ctorDescriptor: new SyncDescriptor(AIDynamicView),
        order: 5
    }], AI_COMPANION_CONTAINER);
}
```

This comprehensive guide should help you successfully integrate custom UI into VS Code's secondary side panel, following the patterns established by the AI Companion extension. 