// src/vs/workbench/contrib/aiCompanion/browser/services/messageService.ts

import { append, $ } from '../../../../../base/browser/dom.js';
import { IAIMessage, MessageType } from '../../common/aiCompanionService.js';
import { generateUuid } from '../../../../../base/common/uuid.js';

export class MessageService {
	private messages: IAIMessage[] = [];

	addMessage(message: IAIMessage): void {
		// DEBUGGING: Log the raw message object
		console.log('🔍 DEBUG addMessage called with:', {
			message: message,
			messageType: typeof message,
			messageKeys: message && typeof message === 'object' ? Object.keys(message) : 'N/A',
			messageId: message?.id,
			messageTypeEnum: message?.type,
			messageContent: message?.content,
			messageContentType: typeof message?.content,
			messageTimestamp: message?.timestamp
		});

		const contentPreview = message.content ? message.content.substring(0, 50) : '(no content)';
		console.log(`📝 Adding message: ${message.type} - ${contentPreview}...`);
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
		const safeContent = message.content || '(no content)';
		const renderedElement = renderMarkdown(safeContent);
		
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
			const contentPreview = message.content ? message.content.substring(0, 50) : '(no content)';
			const messageKey = `${message.id || message.timestamp}-${contentPreview}`;
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
		// Completely safe error handling - no property access without checks
		try {
			if (!error) {
				return 'An unexpected error occurred';
			}
			
			// Handle string errors
			if (typeof error === 'string') {
				return error;
			}
			
			// Handle object errors with safe property access
			if (typeof error === 'object') {
				const errorObj = error as any;
				
				// Safe property access with explicit checks
				const name = errorObj && typeof errorObj.name === 'string' ? errorObj.name : '';
				const message = errorObj && typeof errorObj.message === 'string' ? errorObj.message : '';
				
				// Check specific error types
				if (name === 'AbortError' || (message && message.includes('timeout'))) {
					return 'Request timed out. The backend may be slow or unavailable.';
				}
				if (message && message.includes('fetch')) {
					return 'Failed to connect to AI backend. Please check if the backend is running on localhost:3000';
				}
				if (message && message.includes('500')) {
					return 'Backend server error. Please check the backend logs.';
				}
				if (message && message.includes('429')) {
					return 'Rate limit exceeded. Please wait a moment before trying again.';
				}
				if (message && message.includes('401')) {
					return 'Session expired. Please try again.';
				}
				if (message && message.includes('403')) {
					return 'Access denied. Please check your permissions.';
				}
				if (message && message.includes('404')) {
					return 'Resource not found. Please check the request.';
				}
				
				// Return message or fallback
				return message || errorObj.toString() || 'Unknown error occurred';
			}
			
			// Handle other types
			return String(error);
		} catch (parseError) {
			// If even error parsing fails, return a safe message
			return 'An unexpected error occurred';
		}
	}
}