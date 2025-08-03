// src/vs/workbench/contrib/aiCompanion/browser/services/messageService.ts

import { append, $ } from '../../../../../base/browser/dom.js';
import { IAIMessage, MessageType } from '../../common/aiCompanionService.js';
import { generateUuid } from '../../../../../base/common/uuid.js';

export class MessageService {
	private messages: IAIMessage[] = [];

	addMessage(message: IAIMessage): void {
		console.log(`📝 Adding message: ${message.type} - ${message.content.substring(0, 50)}...`);
		this.messages.push(message);
	}

	getMessages(): IAIMessage[] {
		return [...this.messages];
	}

	clearMessages(): void {
		this.messages = [];
	}

	createUserMessage(content: string): IAIMessage {
		return {
			id: generateUuid(),
			type: MessageType.User,
			content: content,
			timestamp: Date.now()
		};
	}

	createAssistantMessage(content: string, metadata?: any): IAIMessage {
		return {
			id: generateUuid(),
			type: MessageType.Assistant,
			content: content,
			timestamp: Date.now(),
			metadata: metadata
		};
	}

	createSystemMessage(content: string): IAIMessage {
		return {
			id: generateUuid(),
			type: MessageType.System,
			content: content,
			timestamp: Date.now()
		};
	}

	createErrorMessage(error: string): IAIMessage {
		return {
			id: generateUuid(),
			type: MessageType.Assistant,
			content: `❌ ${error}`,
			timestamp: Date.now()
		};
	}

	renderMessage(message: IAIMessage, messageList: HTMLElement, renderMarkdown: (content: string) => HTMLElement): void {
		const messageElement = append(messageList, $('.ai-message'));
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
		
		// Use the provided markdown renderer which returns an HTMLElement
		const renderedElement = renderMarkdown(message.content);
		
		// Append the rendered element directly
		content.appendChild(renderedElement);

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



	renderAllMessages(messageList: HTMLElement, renderMarkdown: (content: string) => HTMLElement): void {
		// Clear existing messages except welcome and typing indicator
		const children = Array.from(messageList.children);
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
				this.renderMessage(message, messageList, renderMarkdown);
			}
		});
	}

	// Utility method to create streaming message placeholder
	createStreamingMessage(workflowType: string): IAIMessage {
		return {
			id: generateUuid(),
			type: MessageType.Assistant,
			content: `🔄 **Generating ${workflowType}...**\n\n▋`,
			timestamp: Date.now()
		};
	}

	// Get error message based on error type
	getErrorMessage(error: any): string {
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
		if (error?.message?.includes('401')) {
			return 'Session expired. Please try again.';
		}
		if (error?.message?.includes('403')) {
			return 'Access denied. Please check your permissions.';
		}
		if (error?.message?.includes('404')) {
			return 'Resource not found. Please check the request.';
		}
		
		// Generic error handling
		if (typeof error === 'string') {
			return error;
		}
		if (error && typeof error === 'object') {
			const errorObj = error as any;
			return errorObj.message || errorObj.toString() || 'Unknown error occurred';
		}
		
		return 'An unexpected error occurred';
	}
}