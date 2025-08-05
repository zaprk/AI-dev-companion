import { IAIMessage, MessageType } from '../../common/aiCompanionService.js';

export class ContextWindowUtils {
    private static readonly CHARS_PER_TOKEN = 4; // Rough estimate
    private static readonly SAFETY_MARGIN = 0.1; // 10% safety margin

    static estimateTokenCount(text: string): number {
        return Math.ceil(text.length / this.CHARS_PER_TOKEN);
    }

    static pruneContextToFitWindow(
        messages: IAIMessage[],
        maxTokens: number,
        systemPrompt?: string
    ): IAIMessage[] {
        const safeMaxTokens = Math.floor(maxTokens * (1 - this.SAFETY_MARGIN));
        let totalTokens = systemPrompt ? this.estimateTokenCount(systemPrompt) : 0;
        
        // Sort by priority (high priority = recent messages, user messages, important content)
        const prioritizedMessages = messages.map((msg, index) => ({
            ...msg,
            priority: this.calculateMessagePriority(msg, index, messages.length)
        })).sort((a, b) => b.priority - a.priority);

        const selectedMessages: IAIMessage[] = [];
        
        for (const message of prioritizedMessages) {
            const messageTokens = this.estimateTokenCount(message.content);
            
            if (totalTokens + messageTokens <= safeMaxTokens) {
                selectedMessages.push(message);
                totalTokens += messageTokens;
            } else {
                // Try to truncate the message if it's too long
                const remainingTokens = safeMaxTokens - totalTokens;
                if (remainingTokens > 100) { // Only if we have significant space left
                    const truncatedMessage = this.truncateMessageToTokens(message, remainingTokens);
                    selectedMessages.push(truncatedMessage);
                }
                break;
            }
        }

        // Restore original order
        return selectedMessages.sort((a, b) => {
            const aIndex = messages.findIndex(m => m.id === a.id);
            const bIndex = messages.findIndex(m => m.id === b.id);
            return aIndex - bIndex;
        });
    }

    private static calculateMessagePriority(message: IAIMessage, index: number, totalMessages: number): number {
        let priority = 0;
        
        // Recent messages get higher priority
        priority += (index / totalMessages) * 50;
        
        // User messages get higher priority than AI responses
        if (message.type === MessageType.User) {
            priority += 30;
        }
        
        // Messages with code blocks get higher priority
        if (message.content.includes('```')) {
            priority += 20;
        }
        
        // Messages with file references get higher priority
        if (message.content.includes('file://') || message.content.includes('workspace://')) {
            priority += 15;
        }
        
        // System messages get lower priority
        if (message.type === MessageType.System) {
            priority -= 10;
        }
        
        return priority;
    }

    private static truncateMessageToTokens(message: IAIMessage, maxTokens: number): IAIMessage {
        const estimatedChars = maxTokens * this.CHARS_PER_TOKEN;
        
        if (message.content.length <= estimatedChars) {
            return message;
        }
        
        // Try to truncate at a word boundary
        const truncatedContent = message.content.substring(0, estimatedChars);
        const lastSpaceIndex = truncatedContent.lastIndexOf(' ');
        
        const finalContent = lastSpaceIndex > estimatedChars * 0.8 
            ? truncatedContent.substring(0, lastSpaceIndex) + '...'
            : truncatedContent + '...';
        
        return {
            ...message,
            content: finalContent
        };
    }

    static detectTokenBoundaries(currentTokens: number): {
        approaching4K: boolean;
        approaching8K: boolean;
        approaching32K: boolean;
        recommendedAction: 'continue' | 'prune' | 'warn';
    } {
        const boundaries: {
            approaching4K: boolean;
            approaching8K: boolean;
            approaching32K: boolean;
            recommendedAction: 'continue' | 'prune' | 'warn';
        } = {
            approaching4K: currentTokens > 3500,
            approaching8K: currentTokens > 7000,
            approaching32K: currentTokens > 28000,
            recommendedAction: 'continue'
        };

        if (currentTokens > 32000) {
            boundaries.recommendedAction = 'prune';
        } else if (currentTokens > 28000) {
            boundaries.recommendedAction = 'warn';
        }

        return boundaries;
    }

    static getModelTokenLimits(modelName?: string): {
        maxTokens: number;
        maxInputTokens: number;
        maxOutputTokens: number;
    } {
        // Default to GPT-4 limits
        const limits = {
            maxTokens: 8192,
            maxInputTokens: 6144,
            maxOutputTokens: 2048
        };

        if (!modelName) return limits;

        // Model-specific limits
        const modelLimits: Record<string, typeof limits> = {
            'gpt-4': { maxTokens: 8192, maxInputTokens: 6144, maxOutputTokens: 2048 },
            'gpt-4-32k': { maxTokens: 32768, maxInputTokens: 24576, maxOutputTokens: 8192 },
            'gpt-3.5-turbo': { maxTokens: 4096, maxInputTokens: 3072, maxOutputTokens: 1024 },
            'claude-3': { maxTokens: 200000, maxInputTokens: 150000, maxOutputTokens: 50000 },
            'claude-3-sonnet': { maxTokens: 200000, maxInputTokens: 150000, maxOutputTokens: 50000 },
            'claude-3-haiku': { maxTokens: 200000, maxInputTokens: 150000, maxOutputTokens: 50000 }
        };

        return modelLimits[modelName.toLowerCase()] || limits;
    }

    static createContextSummary(messages: IAIMessage[]): string {
        if (messages.length === 0) return 'No context available.';
        
        const userMessages = messages.filter(m => m.type === MessageType.User);
        const aiMessages = messages.filter(m => m.type === MessageType.Assistant);
        
        const summary = [
            `Conversation Summary:`,
            `- Total messages: ${messages.length}`,
            `- User messages: ${userMessages.length}`,
            `- AI responses: ${aiMessages.length}`,
            `- Estimated tokens: ${this.estimateTokenCount(messages.map(m => m.content).join(' '))}`,
            `- Last user message: "${userMessages[userMessages.length - 1]?.content.substring(0, 100)}..."`
        ].join('\n');
        
        return summary;
    }
} 