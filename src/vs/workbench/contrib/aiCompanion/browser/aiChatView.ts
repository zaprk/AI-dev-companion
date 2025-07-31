import './media/aiCompanion.css';

import { Emitter, Event } from '../../../../base/common/event.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IAICompanionService, IAIMessage, MessageType, AICompanionMode } from '../common/aiCompanionService.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { DomScrollableElement } from '../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { ScrollbarVisibility } from '../../../../base/common/scrollable.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';

export class AIChatView extends ViewPane {
    private readonly _onDidChangeInput = this._register(new Emitter<string>());
    readonly onDidChangeInput: Event<string> = this._onDidChangeInput.event;

    private readonly aiCompanionService: IAICompanionService;
    private readonly workspaceService: IWorkspaceContextService;

    private chatContainer!: HTMLElement;
    private messageList!: HTMLElement;
    private inputContainer!: HTMLElement;
    private inputBox!: InputBox;
    private sendButton!: Button;
    private scrollableElement!: DomScrollableElement;
    private typingIndicator!: HTMLElement;

    private messages: IAIMessage[] = [];
    private isTyping = false;
    private isInitializing = false;
    private currentMode: AICompanionMode = AICompanionMode.Helper;

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

        this._register(this.aiCompanionService.onDidChangeConversation(this.onConversationChanged, this));
        this._register(this.aiCompanionService.onDidChangeState(this.onStateChanged, this));
        this._register(this.aiCompanionService.onDidChangeMode(this.onModeChanged, this));
    }

    protected override renderBody(container: HTMLElement): void {
        super.renderBody(container);

        // Apply modern styling
        container.classList.add('ai-companion-chat-view');
        this.applyThemeStyles(container);

        // Create main layout
        this.createLayout(container);

        // Initialize conversation
        this.initializeConversation();
    }

    private createLayout(container: HTMLElement): void {
        // Header with mode selector
        const header = document.createElement('div');
        header.className = 'ai-chat-header';
        container.appendChild(header);

        this.createModeSelector(header);

        // Chat container with messages
        this.chatContainer = document.createElement('div');
        this.chatContainer.className = 'ai-chat-container';
        container.appendChild(this.chatContainer);

        // Message list with smooth scrolling
        this.messageList = document.createElement('div');
        this.messageList.className = 'ai-message-list';
        
        this.scrollableElement = new DomScrollableElement(this.messageList, {
            horizontal: ScrollbarVisibility.Hidden,
            vertical: ScrollbarVisibility.Auto
        });
        this.chatContainer.appendChild(this.scrollableElement.getDomNode());
        
        // Ensure the scrollable element takes full height and is scrollable
        this.scrollableElement.getDomNode().style.height = '100%';
        this.scrollableElement.getDomNode().style.overflow = 'auto';
        this.scrollableElement.getDomNode().style.flex = '1';

        // Typing indicator
        this.createTypingIndicator();

        // Input container
        this.createInputContainer(container);
    }

    private createModeSelector(header: HTMLElement): void {
        const modeContainer = document.createElement('div');
        modeContainer.className = 'ai-mode-selector';

        const modes = [
            { mode: AICompanionMode.Helper, label: 'Helper', icon: 'lightbulb' },
        ];

        modes.forEach(({ mode, label, icon }) => {
            const button = document.createElement('button');
            button.className = 'ai-mode-button';
            
            // Create elements safely instead of using innerHTML
            const iconSpan = document.createElement('span');
            iconSpan.className = `codicon codicon-${icon}`;
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'ai-mode-label';
            labelSpan.textContent = label;
            
            button.appendChild(iconSpan);
            button.appendChild(labelSpan);
            
            if (mode === this.currentMode) {
                button.classList.add('active');
            }

            const clickHandler = () => this.setMode(mode);
            button.addEventListener('click', clickHandler);
            this._register({ dispose: () => button.removeEventListener('click', clickHandler) });
            modeContainer.appendChild(button);
        });

        header.appendChild(modeContainer);
    }

    private createTypingIndicator(): void {
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'ai-typing-indicator';
        
        // Create elements safely instead of using innerHTML
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'ai-typing-dots';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dotsContainer.appendChild(dot);
        }
        
        const textSpan = document.createElement('span');
        textSpan.className = 'ai-typing-text';
        textSpan.textContent = 'AI is thinking...';
        
        this.typingIndicator.appendChild(dotsContainer);
        this.typingIndicator.appendChild(textSpan);
        this.typingIndicator.style.display = 'none';
        this.messageList.appendChild(this.typingIndicator);
    }

    private createInputContainer(container: HTMLElement): void {
        this.inputContainer = document.createElement('div');
        this.inputContainer.className = 'ai-input-container';

        // Input box with placeholder
        this.inputBox = new InputBox(this.inputContainer, undefined, {
            placeholder: 'Ask me anything about your code...',
            ariaLabel: localize('aiCompanion.input.placeholder', 'AI Companion Input'),
            inputBoxStyles: defaultInputBoxStyles
        });

        // Send button
        this.sendButton = new Button(this.inputContainer, { title: 'Send' });
        this.sendButton.label = '';
        this.sendButton.icon = Codicon.send;

        // Event listeners
        this._register(this.inputBox.onDidChange(value => {
            this._onDidChangeInput.fire(value);
            this.updateSendButton();
        }));

        this._register(this.sendButton.onDidClick(() => {
            this.sendMessage();
        }));

        container.appendChild(this.inputContainer);
    }

    private async sendMessage(): Promise<void> {
        const content = this.inputBox.value.trim();
        if (!content || this.isTyping || this.isInitializing) {
            return;
        }

        // Clear input and show typing indicator
        this.inputBox.value = '';
        this.showTypingIndicator();

        try {
            // Ensure service is initialized before sending message
            await this.ensureServiceInitialized();
            
            // Send message to AI service
            const message = await this.aiCompanionService.sendMessage(content);
            
            // Add message to UI
            this.addMessage(message);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
        } catch (error) {
            console.error('Failed to send message:', error);
            this.hideTypingIndicator();
            this.showError('Failed to send message. Please try again.');
        }
    }

    private async ensureServiceInitialized(): Promise<void> {
        if (this.isInitializing) {
            return; // Already initializing
        }

        try {
            this.isInitializing = true;
            this.updateSendButton(); // Disable send button during initialization
            
            // Check if service is already initialized
            const workspaceUri = this.workspaceService.getWorkspace().folders[0]?.uri;
            if (workspaceUri) {
                console.log('🔧 Initializing service with workspace:', workspaceUri.toString());
                
                // Try to initialize if not already done
                await this.aiCompanionService.initialize(workspaceUri);
                console.log('✅ Service initialized successfully');
                
                // Start conversation if none exists
                if (!this.aiCompanionService.currentConversation) {
                    console.log('🔧 Starting new conversation...');
                    await this.aiCompanionService.startNewConversation(this.currentMode);
                    console.log('✅ New conversation started');
                }
            } else {
                console.warn('⚠️ No workspace URI found');
                throw new Error('No workspace found. Please open a folder in VS Code.');
            }
        } catch (error: any) {
            const errorMessage = (error && error.message) ? error.message : 'Unknown error occurred';
            console.error('❌ Failed to ensure service initialization:', errorMessage);
            throw new Error(`Service initialization failed: ${errorMessage}`);
        } finally {
            this.isInitializing = false;
            this.updateSendButton(); // Re-enable send button
        }
    }

    private addMessage(message: IAIMessage): void {
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }

    private renderMessage(message: IAIMessage): void {
        const messageElement = document.createElement('div');
        messageElement.className = `ai-message ai-message-${message.type}`;
        
        // Add animation class
        messageElement.classList.add('ai-message-enter');

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'ai-message-avatar';
        
        const avatarIcon = document.createElement('span');
        avatarIcon.className = `codicon codicon-${message.type === MessageType.User ? 'account' : 'lightbulb'}`;
        avatar.appendChild(avatarIcon);
        
        messageElement.appendChild(avatar);

        // Content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'ai-message-content';

        // Message content with proper text selection support
        const content = document.createElement('div');
        content.className = 'ai-message-text';
        content.style.userSelect = 'text';
        content.style.webkitUserSelect = 'text';
        
        // Use textContent for safety, but format the text properly
        const formattedContent = this.formatMessageContent(message.content);
        content.textContent = formattedContent;
        contentContainer.appendChild(content);

        // Timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'ai-message-timestamp';
        timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
        contentContainer.appendChild(timestamp);

        messageElement.appendChild(contentContainer);
        this.messageList.appendChild(messageElement);

        // Trigger animation
        requestAnimationFrame(() => {
            messageElement.classList.remove('ai-message-enter');
        });
    }

    private formatMessageContent(text: string): string {
        // Format text for display without using HTML
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markers but keep text
            .replace(/\*(.*?)\*/g, '$1') // Remove italic markers but keep text
            .replace(/`(.*?)`/g, '$1') // Remove code markers but keep text
            .trim();
    }

    private showTypingIndicator(): void {
        this.isTyping = true;
        this.typingIndicator.style.display = 'flex';
        this.typingIndicator.classList.add('ai-typing-enter');
        this.scrollToBottom();
    }

    private hideTypingIndicator(): void {
        this.isTyping = false;
        this.typingIndicator.classList.remove('ai-typing-enter');
        setTimeout(() => {
            this.typingIndicator.style.display = 'none';
        }, 300);
    }

    private scrollToBottom(): void {
        requestAnimationFrame(() => {
            const scrollElement = this.scrollableElement.getDomNode();
            scrollElement.scrollTop = scrollElement.scrollHeight;
        });
    }

    private updateSendButton(): void {
        const hasContent = this.inputBox.value.trim().length > 0;
        this.sendButton.enabled = hasContent && !this.isTyping && !this.isInitializing;
    }

    private async setMode(mode: AICompanionMode): Promise<void> {
        this.currentMode = mode;
        await this.aiCompanionService.setMode(mode);
        
        // Update UI
        const buttons = this.element?.querySelectorAll('.ai-mode-button');
        buttons?.forEach(button => {
            button.classList.remove('active');
        });
        
        const activeButton = this.element?.querySelector(`[data-mode="${mode}"]`);
        activeButton?.classList.add('active');
    }

    private onConversationChanged(conversation: any): void {
        // Handle conversation changes
        this.messages = conversation?.messages || [];
        this.renderMessages();
    }

    private onStateChanged(state: any): void {
        // Handle state changes
        if (state === 'thinking') {
            this.showTypingIndicator();
        } else {
            this.hideTypingIndicator();
        }
    }

    private onModeChanged(mode: AICompanionMode): void {
        this.currentMode = mode;
    }

    private renderMessages(): void {
        // Clear existing messages
        while (this.messageList.firstChild) {
            this.messageList.removeChild(this.messageList.firstChild);
        }
        this.createTypingIndicator();

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

    private async initializeConversation(): Promise<void> {
        try {
            const workspaceUri = this.workspaceService.getWorkspace().folders[0]?.uri;
            if (workspaceUri) {
                await this.aiCompanionService.initialize(workspaceUri);
                await this.aiCompanionService.startNewConversation(this.currentMode);
            }
        } catch (error) {
            console.error('Failed to initialize conversation:', error);
        }
    }

    private showError(message: string): void {
        // Show error message in UI
        const errorElement = document.createElement('div');
        errorElement.className = 'ai-error-message';
        errorElement.textContent = message;
        this.messageList.appendChild(errorElement);

        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    private applyThemeStyles(container: HTMLElement): void {
        // Apply theme-aware styles
        const theme = this.themeService.getColorTheme();
        
        // Add CSS variables for theming
        container.style.setProperty('--ai-primary-color', theme.getColor('button.background')?.toString() || '#007acc');
        container.style.setProperty('--ai-text-color', theme.getColor('foreground')?.toString() || '#cccccc');
        container.style.setProperty('--ai-background-color', theme.getColor('editor.background')?.toString() || '#1e1e1e');
        container.style.setProperty('--ai-border-color', theme.getColor('panel.border')?.toString() || '#3c3c3c');
    }

    override dispose(): void {
        // Dispose UI components
        if (this.inputBox) {
            this.inputBox.dispose();
        }
        if (this.sendButton) {
            this.sendButton.dispose();
        }
        if (this.scrollableElement) {
            this.scrollableElement.dispose();
        }
        
        super.dispose();
    }
} 