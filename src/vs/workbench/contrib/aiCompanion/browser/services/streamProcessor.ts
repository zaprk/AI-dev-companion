import { IStreamProcessor, IAIStreamChunk, IAIResponse, IMessageFormatter, IPerformanceMonitor, IErrorHandler } from '../../common/aiCompanionServiceTokens.js';
import { BaseService } from '../utils/baseService.js';
import { MapFactory } from '../utils/mapFactories.js';

export interface IStreamingState {
    isStreaming: boolean;
    accumulatedContent: string;
    lastUpdateTime: number;
    chunkCount: number;
    currentWorkflowType?: string;
}

export class StreamProcessor extends BaseService implements IStreamProcessor {
    private streamingStates = MapFactory.createStreamingStateMap();

    constructor(
        @IMessageFormatter private readonly messageFormatter: IMessageFormatter,
        @IPerformanceMonitor performanceMonitor: IPerformanceMonitor,
        @IErrorHandler errorHandler: IErrorHandler
    ) {
        super(errorHandler, performanceMonitor);
    }

    startStreaming(requestId: string, workflowType?: string): void {
        this.withPerformanceMonitoring('stream-start', async () => {
            this.streamingStates.set(requestId, {
                isStreaming: true,
                accumulatedContent: '',
                lastUpdateTime: Date.now(),
                chunkCount: 0,
                currentWorkflowType: workflowType
            });
        });
    }

    processChunk(requestId: string, chunk: IAIStreamChunk): string {
        const timer = this.performanceMonitor.startTimer('chunk-processing');
        
        try {
            const state = this.streamingStates.get(requestId);
            if (!state) {
                throw new Error(`No streaming state found for request ${requestId}`);
            }

            state.chunkCount++;
            state.lastUpdateTime = Date.now();

            // Accumulate content
            const newContent = chunk.content || '';
            state.accumulatedContent += newContent;

            // Try to format incrementally if it's a structured workflow
            let formattedContent = state.accumulatedContent;
            if (state.currentWorkflowType && state.currentWorkflowType !== 'chat') {
                formattedContent = this.tryFormatIncremental(state.accumulatedContent, state.currentWorkflowType);
            }

            timer();
            return formattedContent;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Chunk processing');
            return chunk.content || '';
        }
    }

    completeStreaming(requestId: string): IAIResponse | null {
        const timer = this.performanceMonitor.startTimer('stream-completion');
        
        try {
            const state = this.streamingStates.get(requestId);
            if (!state) {
                return null;
            }

            // Final formatting
            let finalContent = state.accumulatedContent;
            if (state.currentWorkflowType && state.currentWorkflowType !== 'chat') {
                finalContent = this.formatStreamingContent(state.accumulatedContent, state.currentWorkflowType);
            }

            const response: IAIResponse = {
                id: requestId,
                content: finalContent,
                metadata: {
                    streaming: true,
                    chunkCount: state.chunkCount,
                    duration: Date.now() - state.lastUpdateTime
                },
                timestamp: Date.now(),
                sessionId: '' // We'll need to pass sessionId as parameter
            };

            // Clean up state
            this.streamingStates.delete(requestId);
            
            timer();
            return response;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Stream completion');
            return null;
        }
    }

    cancelStreaming(requestId: string): void {
        const timer = this.performanceMonitor.startTimer('stream-cancellation');
        
        this.streamingStates.delete(requestId);
        timer();
    }

    getStreamingState(requestId: string): IStreamingState | null {
        return this.streamingStates.get(requestId) || null;
    }

    isStreaming(requestId: string): boolean {
        const state = this.streamingStates.get(requestId);
        return state?.isStreaming || false;
    }

    getActiveStreamCount(): number {
        return this.streamingStates.size;
    }

    // Content formatting methods
    private tryFormatIncremental(content: string, workflowType: string): string {
        try {
            // For incremental formatting, we try to parse and format what we have so far
            // This is more conservative than final formatting to avoid breaking partial content
            
            if (workflowType === 'requirements') {
                return this.formatRequirementsIncremental(content);
            } else if (workflowType === 'design') {
                return this.formatDesignIncremental(content);
            } else if (workflowType === 'tasks') {
                return this.formatTasksIncremental(content);
            } else if (workflowType === 'code') {
                return this.formatCodeIncremental(content);
            }
            
            return content;
        } catch (error) {
            // If incremental formatting fails, return raw content
            return content;
        }
    }

    private formatStreamingContent(content: string, workflowType: string): string {
        try {
            // Final formatting - more aggressive parsing and formatting
            if (workflowType === 'requirements') {
                return this.formatRequirementsFinal(content);
            } else if (workflowType === 'design') {
                return this.formatDesignFinal(content);
            } else if (workflowType === 'tasks') {
                return this.formatTasksFinal(content);
            } else if (workflowType === 'code') {
                return this.formatCodeFinal(content);
            }
            
            return this.messageFormatter.renderMarkdown(content);
        } catch (error) {
            this.errorHandler.handleError(error as Error, 'Streaming content formatting');
            return this.messageFormatter.renderMarkdown(content);
        }
    }

    // private updateStreamingContent(requestId: string, newContent: string): void {
    //     const state = this.streamingStates.get(requestId);
    //     if (state) {
    //         state.accumulatedContent = newContent;
    //         state.lastUpdateTime = Date.now();
    //     }
    // }

    // Incremental formatting methods (conservative)
    private formatRequirementsIncremental(content: string): string {
        // Simple incremental formatting - just basic markdown
        return this.messageFormatter.renderMarkdown(content);
    }

    private formatDesignIncremental(content: string): string {
        // Simple incremental formatting - just basic markdown
        return this.messageFormatter.renderMarkdown(content);
    }

    private formatTasksIncremental(content: string): string {
        // Simple incremental formatting - just basic markdown
        return this.messageFormatter.renderMarkdown(content);
    }

    private formatCodeIncremental(content: string): string {
        // For code, we can be more aggressive with incremental formatting
        // since code blocks are usually well-defined
        return this.messageFormatter.renderMarkdown(content);
    }

    // Final formatting methods (aggressive)
    private formatRequirementsFinal(content: string): string {
        try {
            // Try to parse as structured content first
            const parsed = this.tryParseStructuredContent(content);
            if (parsed) {
                return this.messageFormatter.formatStructuredContent(parsed, 'requirements');
            }
        } catch (error) {
            // Fall back to plain markdown
        }
        
        return this.messageFormatter.renderMarkdown(content);
    }

    private formatDesignFinal(content: string): string {
        try {
            // Try to parse as structured content first
            const parsed = this.tryParseStructuredContent(content);
            if (parsed) {
                return this.messageFormatter.formatStructuredContent(parsed, 'design');
            }
        } catch (error) {
            // Fall back to plain markdown
        }
        
        return this.messageFormatter.renderMarkdown(content);
    }

    private formatTasksFinal(content: string): string {
        try {
            // Try to parse as structured content first
            const parsed = this.tryParseStructuredContent(content);
            if (parsed) {
                return this.messageFormatter.formatStructuredContent(parsed, 'tasks');
            }
        } catch (error) {
            // Fall back to plain markdown
        }
        
        return this.messageFormatter.renderMarkdown(content);
    }

    private formatCodeFinal(content: string): string {
        try {
            // Try to parse as structured content first
            const parsed = this.tryParseStructuredContent(content);
            if (parsed) {
                return this.messageFormatter.formatStructuredContent(parsed, 'code');
            }
        } catch (error) {
            // Fall back to plain markdown
        }
        
        return this.messageFormatter.renderMarkdown(content);
    }

    private tryParseStructuredContent(content: string): any {
        try {
            // Look for JSON-like structures in the content
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Look for YAML-like structures
            const yamlMatch = content.match(/---\s*\n([\s\S]*?)\n---/);
            if (yamlMatch) {
                // Simple YAML parsing (basic implementation)
                return this.parseSimpleYaml(yamlMatch[1]);
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    private parseSimpleYaml(yamlContent: string): any {
        // Very basic YAML parsing for common structures
        const result: any = {};
        const lines = yamlContent.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                result[key.trim()] = value.trim();
            }
        }
        
        return result;
    }

    // Utility methods
    getStreamingStats(): { activeStreams: number; totalChunks: number } {
        let totalChunks = 0;
        for (const state of this.streamingStates.values()) {
            totalChunks += state.chunkCount;
        }
        
        return {
            activeStreams: this.streamingStates.size,
            totalChunks
        };
    }

    clearAllStreams(): void {
        this.streamingStates.clear();
    }
}

 