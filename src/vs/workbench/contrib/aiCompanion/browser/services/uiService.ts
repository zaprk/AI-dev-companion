import { append, $ } from '../../../../../base/browser/dom.js';
import { AICompanionMode } from '../../common/aiCompanionService.js';

export class UIService {
	private isTyping = false;
	private statusIndicator!: HTMLElement;
	private typingIndicator!: HTMLElement;

	createLayout(container: HTMLElement): { 
		messageList: HTMLElement; 
		inputContainer: HTMLElement; 
	} {
		// Header with mode selector and status
		const header = append(container, $('.ai-chat-header'));
		this.createStatusIndicator(header);

		// Chat container with messages
		const chatContainer = append(container, $('.ai-chat-container'));

		// Message list with scrolling
		const messageList = append(chatContainer, $('.ai-message-list'));

		// Typing indicator
		this.createTypingIndicator(messageList);

		// Input container
		const inputContainer = append(chatContainer, $('.ai-input-container'));

		return { messageList, inputContainer };
	}

	createModeSelector(header: HTMLElement, currentMode: AICompanionMode, onModeChange: (mode: AICompanionMode) => void): void {
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
			
			if (mode === currentMode) {
				button.classList.add('active');
			}

			button.addEventListener('click', () => onModeChange(mode));
		});
	}

	createStatusIndicator(header: HTMLElement): void {
		this.statusIndicator = append(header, $('.ai-status-indicator'));

		const statusIcon = append(this.statusIndicator, $('.status-icon'));
		statusIcon.style.background = 'var(--vscode-charts-orange)';

		const statusText = append(this.statusIndicator, $('.status-text'));
		statusText.textContent = 'Connecting...';
	}

	createInputContainer(container: HTMLElement, onSend: () => void, onInputChange: (value: string) => void): { 
		inputBox: HTMLInputElement; 
		sendButton: HTMLButtonElement; 
	} {
		// Input box
		const inputBox = append(container, $('input')) as HTMLInputElement;
		inputBox.placeholder = '💬 Ask me anything about your code...';

		// Send button
		const sendButton = append(container, $('button')) as HTMLButtonElement;
		
		append(sendButton, $('span.codicon.codicon-send'));
		const sendLabel = append(sendButton, $('span'));
		sendLabel.textContent = 'Send';

		// Event listeners
		inputBox.addEventListener('input', () => {
			onInputChange(inputBox.value);
		});

		inputBox.addEventListener('keypress', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				onSend();
			}
		});

		sendButton.addEventListener('click', onSend);

		return { inputBox, sendButton };
	}

	createTypingIndicator(messageList: HTMLElement): void {
		this.typingIndicator = append(messageList, $('.ai-typing-indicator'));
		this.typingIndicator.style.display = 'none';
		
		const dotsContainer = append(this.typingIndicator, $('.ai-typing-dots'));
		
		for (let i = 0; i < 3; i++) {
			append(dotsContainer, $('span'));
		}
		
		const textSpan = append(this.typingIndicator, $('.ai-typing-text'));
		textSpan.textContent = 'AI is thinking...';
	}

	showWelcomeMessage(messageList: HTMLElement): void {
		const welcomeDiv = append(messageList, $('.welcome-message'));
		
		const title = append(welcomeDiv, $('h3'));
		title.textContent = '🤖 AI Companion';
		
		const description = append(welcomeDiv, $('p'));
		description.textContent = `I'm here to help you build complete projects from scratch!

🔨 **Builder Mode** (Current): I'll automatically generate requirements → design → tasks → code when you ask me to build something.

🧠 **Helper Mode**: I'll guide you step by step and wait for your approval at each stage.

Try saying: "I want to build a user auth system"`;
	}

	showTypingIndicator(): void {
		this.isTyping = true;
		this.typingIndicator.style.display = 'flex';
	}

	hideTypingIndicator(): void {
		this.isTyping = false;
		this.typingIndicator.style.display = 'none';
	}

	updateConnectionStatus(connected: boolean, message: string): void {
		if (this.statusIndicator) {
			const statusIcon = this.statusIndicator.querySelector('.status-icon') as HTMLElement;
			const statusText = this.statusIndicator.querySelector('.status-text') as HTMLElement;
			
			if (statusIcon && statusText) {
				statusIcon.style.background = connected ? 'var(--vscode-charts-green)' : 'var(--vscode-charts-red)';
				statusText.textContent = message;
			}
		}
	}

	updateSendButton(sendButton: HTMLButtonElement, hasContent: boolean, isConnected: boolean): void {
		const isEnabled = hasContent && !this.isTyping && isConnected;
		
		sendButton.disabled = !isEnabled;
		
		// Update button text based on connection status
		const sendLabel = sendButton.querySelector('span:not(.codicon)') as HTMLElement;
		if (sendLabel) {
			if (!isConnected) {
				sendLabel.textContent = 'Disconnected';
			} else if (this.isTyping) {
				sendLabel.textContent = 'Thinking...';
			} else {
				sendLabel.textContent = 'Send';
			}
		}
	}

	updateModeButtons(element: HTMLElement, activeMode: AICompanionMode): void {
		const buttons = element.querySelectorAll('.ai-mode-button');
		buttons.forEach(button => {
			button.classList.remove('active');
		});
		
		// Find and activate the correct button
		const modeButtons = element.querySelectorAll('.ai-mode-button');
		modeButtons.forEach((button, index) => {
			if (index === 0 && activeMode === AICompanionMode.Helper) {
				button.classList.add('active');
			} else if (index === 1 && activeMode === AICompanionMode.Builder) {
				button.classList.add('active');
			}
		});
	}

	scrollToBottom(messageList: HTMLElement): void {
		setTimeout(() => {
			messageList.scrollTop = messageList.scrollHeight;
		}, 100);
	}

	getMessageElement(messageList: HTMLElement, messageId: string): HTMLElement | null {
		const messages = messageList.querySelectorAll('.ai-message');
		for (const message of messages) {
			if (message.getAttribute('data-message-id') === messageId) {
				return message as HTMLElement;
			}
		}
		return null;
	}

	addModernStyles(): void {
		if (document.getElementById('ai-companion-modern-styles')) return;

		const styles = document.createElement('style');
		styles.id = 'ai-companion-modern-styles';
		styles.textContent = this.getModernStylesheet();
		document.head.appendChild(styles);
	}

	applyBeautifulTheme(container: HTMLElement): void {
		// Apply modern gradient background
		container.style.background = 'linear-gradient(135deg, var(--vscode-sideBar-background) 0%, var(--vscode-editor-background) 100%)';
		container.style.minHeight = '100%';
	}

	private getModernStylesheet(): string {
		return `
			/* Modern AI Chat Styles */
			.ai-companion-chat-view {
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
				background: var(--vscode-sideBar-background);
				color: var(--vscode-sideBar-foreground);
				height: 100vh;
				display: flex;
				flex-direction: column;
				overflow: hidden;
			}

			.ai-chat-header {
				background: linear-gradient(135deg, var(--vscode-button-background) 0%, var(--vscode-button-hoverBackground) 100%);
				border-bottom: 1px solid var(--vscode-panel-border);
				padding: 12px;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
				flex-shrink: 0;
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
				min-height: 0;
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
				min-height: 0;
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

			/* Proper HTML rendering for markdown content */
			.ai-message-text strong {
				font-weight: bold;
			}

			.ai-message-text em {
				font-style: italic;
			}

			.ai-message-text h1,
			.ai-message-text h2,
			.ai-message-text h3,
			.ai-message-text h4,
			.ai-message-text h5,
			.ai-message-text h6 {
				margin: 16px 0 8px 0;
				font-weight: 600;
				color: var(--vscode-editor-foreground);
			}

			.ai-message-text h1 { font-size: 20px; }
			.ai-message-text h2 { font-size: 18px; }
			.ai-message-text h3 { font-size: 16px; }
			.ai-message-text h4 { font-size: 15px; }
			.ai-message-text h5 { font-size: 14px; }
			.ai-message-text h6 { font-size: 13px; }

			.ai-message-text p {
				margin: 8px 0;
			}

			.ai-message-text ul,
			.ai-message-text ol {
				margin: 8px 0;
				padding-left: 24px;
			}

			.ai-message-text li {
				margin: 4px 0;
			}

			.ai-message-text code {
				background: var(--vscode-textCodeBlock-background);
				padding: 2px 6px;
				border-radius: 4px;
				font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
				font-size: 13px;
			}

			.ai-message-text pre {
				background: var(--vscode-textCodeBlock-background);
				padding: 12px;
				border-radius: 8px;
				overflow-x: auto;
				margin: 12px 0;
				border: 1px solid var(--vscode-panel-border);
			}

			.ai-message-text pre code {
				background: none;
				padding: 0;
				border-radius: 0;
			}

			.ai-message-text blockquote {
				border-left: 4px solid var(--vscode-charts-blue);
				padding-left: 12px;
				margin: 12px 0;
				color: var(--vscode-descriptionForeground);
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
				font-family: inherit;
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
	}
}