import { IAIBackendService, IAIRequest, IAIResponse, IAIStreamChunk, ISessionInfo, IAICompanionConfigurationService } from '../../common/aiCompanionServiceTokens.js';
import { IErrorHandler } from '../../common/aiCompanionServiceTokens.js';
import { IPerformanceMonitor } from '../../common/aiCompanionServiceTokens.js';

type IAICompanionConfigurationServiceType = typeof IAICompanionConfigurationService extends { type: infer T } ? T : never;

import { generateUuid } from '../../../../../base/common/uuid.js';

export class AIBackendService implements IAIBackendService {
    readonly _serviceBrand: undefined;

    private sessionInfo: ISessionInfo | null = null;
    private cache = new Map<string, { data: any; timestamp: number }>();
    private activeRequests = new Map<string, AbortController>();

    constructor(
        @IAICompanionConfigurationService private readonly configService: IAICompanionConfigurationServiceType,
        @IErrorHandler private readonly errorHandler: IErrorHandler,
        @IPerformanceMonitor private readonly performanceMonitor: IPerformanceMonitor
    ) {}

    async initializeSession(): Promise<ISessionInfo> {
        const timer = this.performanceMonitor.startTimer('session-initialization');
        
        try {
            const response = await fetch(`${this.configService.backendUrl}/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    workspaceId: generateUuid(),
                    vscodeVersion: '1.103.0'
                })
            });

            if (!response.ok) {
                throw new Error(`Session initialization failed: ${response.status} ${response.statusText}`);
            }

            const sessionData = await response.json();
            this.sessionInfo = sessionData;
            timer();
            return sessionData;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Session initialization');
            throw error;
        }
    }

    async sendRequest(request: IAIRequest): Promise<IAIResponse> {
        const timer = this.performanceMonitor.startTimer('backend-request');
        const requestId = generateUuid();
        const controller = new AbortController();
        
        this.activeRequests.set(requestId, controller);

        try {
            // Check cache first
            const cacheKey = this.getCacheKey(request);
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                timer();
                return cached;
            }

            // Ensure session is initialized
            if (!this.sessionInfo) {
                await this.initializeSession();
            }

            const response = await fetch(`${this.configService.backendUrl}/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: request.mode || 'chat',
                    prompt: request.content,
                    context: request.context || {},
                    sessionId: this.sessionInfo!.sessionId,
                    messages: request.messages || [],
                    maxTokens: request.maxTokens || 1000,
                    temperature: request.temperature || 0.7
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const aiResponse: IAIResponse = {
                id: requestId,
                content: data.content,
                metadata: data.metadata || {},
                timestamp: Date.now(),
                sessionId: this.sessionInfo!.sessionId
            };

            // Cache the response
            this.setCache(cacheKey, aiResponse);
            
            timer();
            return aiResponse;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Backend request');
            throw error;
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    async sendStreamingRequest(
        request: IAIRequest,
        onChunk: (chunk: IAIStreamChunk) => void,
        onComplete: (response: IAIResponse) => void,
        onError: (error: Error) => void
    ): Promise<void> {
        const timer = this.performanceMonitor.startTimer('streaming-request');
        const requestId = generateUuid();
        const controller = new AbortController();
        
        this.activeRequests.set(requestId, controller);

        try {
            // Ensure session is initialized
            if (!this.sessionInfo) {
                await this.initializeSession();
            }

            const response = await fetch(`${this.configService.backendUrl}/completions-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    type: request.mode || 'chat',
                    prompt: request.content,
                    context: request.context || {},
                    sessionId: this.sessionInfo!.sessionId,
                    messages: request.messages || [],
                    maxTokens: request.maxTokens || 1000,
                    temperature: request.temperature || 0.7,
                    stream: true
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Streaming request failed: ${response.status} ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body available for streaming');
            }

            let accumulatedContent = '';
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            // Stream complete
                            const finalResponse: IAIResponse = {
                                id: requestId,
                                content: accumulatedContent,
                                metadata: { streaming: true },
                                timestamp: Date.now(),
                                sessionId: this.sessionInfo!.sessionId
                            };
                            
                            timer();
                            onComplete(finalResponse);
                            return;
                        }

                        try {
                            const parsedChunk: IAIStreamChunk = JSON.parse(data);
                            accumulatedContent += parsedChunk.content || '';
                            onChunk(parsedChunk);
                        } catch (parseError) {
                            console.warn('Failed to parse streaming chunk:', data);
                        }
                    }
                }
            }
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Streaming request');
            onError(error as Error);
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    async checkHealth(): Promise<boolean> {
        const timer = this.performanceMonitor.startTimer('health-check');
        
        try {
            const response = await fetch(`${this.configService.backendUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const isHealthy = response.ok;
            timer();
            return isHealthy;
        } catch (error) {
            timer();
            return false;
        }
    }

    async checkStreamingEndpoint(): Promise<boolean> {
        const timer = this.performanceMonitor.startTimer('streaming-endpoint-check');
        
        try {
            const response = await fetch(`${this.configService.backendUrl}/chat/stream`, {
                method: 'OPTIONS',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const supportsStreaming = response.ok;
            timer();
            return supportsStreaming;
        } catch (error) {
            timer();
            return false;
        }
    }

    cancelRequest(requestId: string): void {
        const controller = this.activeRequests.get(requestId);
        if (controller) {
            controller.abort();
            this.activeRequests.delete(requestId);
        }
    }

    cancelAllRequests(): void {
        for (const controller of this.activeRequests.values()) {
            controller.abort();
        }
        this.activeRequests.clear();
    }

    getSessionInfo(): ISessionInfo | null {
        return this.sessionInfo;
    }

    clearSession(): void {
        this.sessionInfo = null;
        this.cache.clear();
        this.cancelAllRequests();
    }

    // Cache management methods
    getCacheKey(request: IAIRequest): string {
        return `${request.mode}-${request.content}-${request.context?.workspaceRoot || ''}`;
    }

    getFromCache(key: string): IAIResponse | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.configService.cacheDuration) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key: string, data: IAIResponse): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        this.cleanupCache();
    }

    cleanupCache(): void {
        const now = Date.now();
        const maxAge = this.configService.cacheDuration;

        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > maxAge) {
                this.cache.delete(key);
            }
        }
    }

    // Utility methods
    getActiveRequestCount(): number {
        return this.activeRequests.size;
    }

    getCacheSize(): number {
        return this.cache.size;
    }

    clearCache(): void {
        this.cache.clear();
    }
}

 