import { IAIBackendService, IAIRequest, IAIResponse, IAIStreamChunk, ISessionInfo, IAICompanionConfigurationService } from '../../common/aiCompanionServiceTokens.js';
import { IErrorHandler } from '../../common/aiCompanionServiceTokens.js';
import { IPerformanceMonitor } from '../../common/aiCompanionServiceTokens.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { BaseService } from '../utils/baseService.js';
import { MapFactory } from '../utils/mapFactories.js';

type IAICompanionConfigurationServiceType = typeof IAICompanionConfigurationService extends { type: infer T } ? T : never;

import { generateUuid } from '../../../../../base/common/uuid.js';

export class AIBackendService extends BaseService implements IAIBackendService {
    private sessionInfo: ISessionInfo | null = null;
    private cache = MapFactory.createCacheMap();
    private activeRequests = MapFactory.createAbortControllerMap();

    // Session storage keys
    private static readonly SESSION_ID_KEY = 'aiCompanion.sessionId';
    private static readonly SESSION_INFO_KEY = 'aiCompanion.sessionInfo';
    private static readonly SESSION_WORKSPACE_KEY = 'aiCompanion.sessionWorkspace';

    constructor(
        @IAICompanionConfigurationService private readonly configService: IAICompanionConfigurationServiceType,
        @IErrorHandler errorHandler: IErrorHandler,
        @IPerformanceMonitor performanceMonitor: IPerformanceMonitor,
        @IStorageService private readonly storageService: IStorageService,
        @IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
        @ILogService private readonly logService: ILogService
    ) {
        super(errorHandler, performanceMonitor);
        this.initializeFromStorage();
    }

    /**
     * Initialize session from stored data or create new one
     */
    private async initializeFromStorage(): Promise<void> {
        try {
            const storedSessionId = this.storageService.get(AIBackendService.SESSION_ID_KEY, StorageScope.WORKSPACE);
            const storedSessionInfo = this.storageService.get(AIBackendService.SESSION_INFO_KEY, StorageScope.WORKSPACE);
            const storedWorkspaceId = this.storageService.get(AIBackendService.SESSION_WORKSPACE_KEY, StorageScope.WORKSPACE);

            if (storedSessionId && storedSessionInfo && storedWorkspaceId) {
                // Check if this is the same workspace
                const currentWorkspaceId = this.getWorkspaceId();
                if (storedWorkspaceId === currentWorkspaceId) {
                    // Try to validate the existing session
                    const sessionInfo = JSON.parse(storedSessionInfo);
                    const isValid = await this.validateExistingSession(storedSessionId);
                    
                    if (isValid) {
                        this.sessionInfo = sessionInfo;
                        this.logService.info(`[AI Companion] Restored existing session: ${storedSessionId}`);
                        return;
                    } else {
                        this.logService.info(`[AI Companion] Stored session ${storedSessionId} is invalid, will create new one`);
                    }
                } else {
                    this.logService.info(`[AI Companion] Workspace changed, will create new session`);
                }
            }

            // Clear invalid stored data
            this.clearStoredSession();
        } catch (error) {
            this.logService.warn(`[AI Companion] Error initializing from storage:`, error);
            this.clearStoredSession();
        }
    }

    /**
     * Validate if an existing session is still valid on the backend
     */
    private async validateExistingSession(sessionId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.configService.backendUrl}/sessions/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId
                },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            return response.ok;
        } catch (error) {
            this.logService.warn(`[AI Companion] Session validation failed:`, error);
            return false;
        }
    }

    /**
     * Get consistent workspace identifier
     */
    private getWorkspaceId(): string {
        const workspace = this.workspaceService.getWorkspace();
        if (workspace.folders && workspace.folders.length > 0) {
            // Use the first workspace folder URI as the identifier
            return workspace.folders[0].uri.toString();
        }
        return 'no-workspace';
    }

    /**
     * Initialize session - now with proper persistence
     */
    async initializeSession(): Promise<ISessionInfo> {
        return this.withMonitoringAndErrorHandling('session-initialization', async () => {
            // If we already have a valid session, return it
            if (this.sessionInfo) {
                return this.sessionInfo;
            }

            // Check stored session first
            await this.initializeFromStorage();
            if (this.sessionInfo) {
                return this.sessionInfo;
            }

            // Create new session
            const workspaceId = this.getWorkspaceId();
            const response = await fetch(`${this.configService.backendUrl}/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    workspaceId: workspaceId,
                    vscodeVersion: '1.103.0'
                })
            });

            if (!response.ok) {
                throw new Error(`Session initialization failed: ${response.status} ${response.statusText}`);
            }

            const sessionData = await response.json();
            this.sessionInfo = {
                sessionId: sessionData.sessionId,
                workspaceId: workspaceId,
                createdAt: new Date(sessionData.createdAt || Date.now())
            };

            // Store session for persistence
            this.storeSession();

            this.logService.info(`[AI Companion] Created new session: ${this.sessionInfo.sessionId}`);
            return this.sessionInfo;
        });
    }

    /**
     * Store session information for persistence
     */
    private storeSession(): void {
        if (!this.sessionInfo) return;

        try {
            this.storageService.store(
                AIBackendService.SESSION_ID_KEY, 
                this.sessionInfo.sessionId, 
                StorageScope.WORKSPACE,
                StorageTarget.USER
            );
            
            this.storageService.store(
                AIBackendService.SESSION_INFO_KEY, 
                JSON.stringify(this.sessionInfo), 
                StorageScope.WORKSPACE,
                StorageTarget.USER
            );
            
            this.storageService.store(
                AIBackendService.SESSION_WORKSPACE_KEY, 
                this.sessionInfo.workspaceId, 
                StorageScope.WORKSPACE,
                StorageTarget.USER
            );

            this.logService.debug(`[AI Companion] Session stored for persistence`);
        } catch (error) {
            this.logService.warn(`[AI Companion] Failed to store session:`, error);
        }
    }

    /**
     * Clear stored session data
     */
    private clearStoredSession(): void {
        this.storageService.remove(AIBackendService.SESSION_ID_KEY, StorageScope.WORKSPACE);
        this.storageService.remove(AIBackendService.SESSION_INFO_KEY, StorageScope.WORKSPACE);
        this.storageService.remove(AIBackendService.SESSION_WORKSPACE_KEY, StorageScope.WORKSPACE);
    }

    /**
     * Enhanced send request with better session handling
     */
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

            // Ensure session is initialized - but don't create new one if we have one
            if (!this.sessionInfo) {
                await this.initializeSession();
            }

            // Make the request with session ID
            const response = await fetch(`${this.configService.backendUrl}/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionInfo!.sessionId
                },
                body: JSON.stringify({
                    type: request.type || request.mode || 'chat',
                    prompt: request.prompt || request.content,
                    context: request.context || {},
                    sessionId: this.sessionInfo!.sessionId,
                    messages: request.messages || [],
                    maxTokens: request.maxTokens || 1000,
                    temperature: request.temperature || 0.7
                }),
                signal: controller.signal
            });

            // Handle session-related errors
            if (response.status === 401 || response.status === 403) {
                this.logService.warn(`[AI Companion] Session expired or invalid, creating new session`);
                await this.recreateSession();
                // Retry the request with new session
                return await this.sendRequest(request);
            }

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
            
            // Handle network errors that might indicate session issues
            if (error instanceof Error && error.message.includes('401')) {
                this.logService.warn(`[AI Companion] Authentication error, recreating session`);
                await this.recreateSession();
            }
            
            this.errorHandler.handleError(error as Error, 'Backend request');
            throw error;
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Recreate session when the current one is invalid
     */
    private async recreateSession(): Promise<void> {
        this.logService.info(`[AI Companion] Recreating session...`);
        
        // Clear current session
        this.sessionInfo = null;
        this.clearStoredSession();
        
        // Create new session
        await this.initializeSession();
    }

    /**
     * Enhanced streaming with better session handling
     */
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
                    'Accept': 'text/event-stream',
                    'X-Session-ID': this.sessionInfo!.sessionId
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

            // Handle session-related errors
            if (response.status === 401 || response.status === 403) {
                this.logService.warn(`[AI Companion] Session expired during streaming, creating new session`);
                await this.recreateSession();
                // Retry the streaming request
                return await this.sendStreamingRequest(request, onChunk, onComplete, onError);
            }

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
                            const parsedChunk = JSON.parse(data);
                            accumulatedContent += parsedChunk.content || '';
                            onChunk({
                                content: parsedChunk.content || '',
                                isComplete: false
                            });
                        } catch (parseError) {
                            this.logService.warn(`[AI Companion] Failed to parse streaming chunk:`, data);
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

    // ... rest of the methods remain the same ...

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
            const response = await fetch(`${this.configService.backendUrl}/completions-stream`, {
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
        this.logService.info(`[AI Companion] Clearing session manually`);
        this.sessionInfo = null;
        this.clearStoredSession();
        this.cache.clear();
        this.cancelAllRequests();
    }

    // Cache management methods - unchanged
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

    /**
     * Get session status for debugging
     */
    getSessionStatus(): {
        hasSession: boolean;
        sessionId?: string;
        workspaceId?: string;
        createdAt?: Date;
        isStored: boolean;
    } {
        const storedSessionId = this.storageService.get(AIBackendService.SESSION_ID_KEY, StorageScope.WORKSPACE);
        
        return {
            hasSession: !!this.sessionInfo,
            sessionId: this.sessionInfo?.sessionId,
            workspaceId: this.sessionInfo?.workspaceId,
            createdAt: this.sessionInfo?.createdAt,
            isStored: !!storedSessionId
        };
    }
}