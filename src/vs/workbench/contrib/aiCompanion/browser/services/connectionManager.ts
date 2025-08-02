import { IConnectionManager, IConnectionStatus, IConnectionPool, IAICompanionConfigurationService, IPerformanceMonitor, IErrorHandler } from '../../common/aiCompanionServiceTokens.js';


import { Event, Emitter } from '../../../../../base/common/event.js';

export class ConnectionManager implements IConnectionManager {
    readonly _serviceBrand: undefined;

    private _onConnectionStatusChanged = new Emitter<IConnectionStatus>();
    readonly onConnectionStatusChanged: Event<IConnectionStatus> = this._onConnectionStatusChanged.event;

    private connectionStatus: IConnectionStatus = {
        isConnected: false,
        isHealthy: false,
        lastHealthCheck: 0,
        connectionId: '',
        errorCount: 0,
        latency: 0,
        health: 'unknown'
    };

    private connectionPool: IConnectionPool = {
        maxConnections: 3,
        activeConnections: 0,
        availableConnections: 3,
        connectionIds: []
    };

    private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    private retryAttempts = 0;
    private maxRetryAttempts = 3;

    constructor(
        @IAICompanionConfigurationService private readonly configService: typeof IAICompanionConfigurationService extends { type: infer T } ? T : never,
        @IPerformanceMonitor private readonly performanceMonitor: IPerformanceMonitor,
        @IErrorHandler private readonly errorHandler: IErrorHandler
    ) {
        this.startHealthCheck();
    }

    async connect(): Promise<boolean> {
        const timer = this.performanceMonitor.startTimer('connection-establishment');
        
        try {
            if (this.connectionStatus.isConnected) {
                timer();
                return true;
            }

            // Check if we have available connections
            if (this.connectionPool.availableConnections <= 0) {
                throw new Error('No available connections in pool');
            }

            // Test connection to backend
            const isHealthy = await this.checkHealth();
            if (!isHealthy) {
                throw new Error('Backend health check failed');
            }

            // Generate connection ID
            const connectionId = this.generateConnectionId();
            
            // Update connection status
            this.connectionStatus = {
                isConnected: true,
                isHealthy: true,
                lastHealthCheck: Date.now(),
                connectionId,
                errorCount: 0,
                latency: 0,
                health: 'healthy'
            };

            // Update connection pool
            this.connectionPool.activeConnections++;
            this.connectionPool.availableConnections--;
            this.connectionPool.connectionIds.push(connectionId);

            // Emit status change
            this._onConnectionStatusChanged.fire(this.connectionStatus);
            
            timer();
            return true;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Connection establishment');
            this.connectionStatus.errorCount++;
            this._onConnectionStatusChanged.fire(this.connectionStatus);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        const timer = this.performanceMonitor.startTimer('connection-disconnection');
        
        try {
            // Clear all connections
            this.connectionStatus = {
                isConnected: false,
                isHealthy: false,
                lastHealthCheck: 0,
                connectionId: '',
                errorCount: 0,
                latency: 0,
                health: 'unknown'
            };

            this.connectionPool = {
                maxConnections: this.configService.maxConcurrentRequests,
                activeConnections: 0,
                availableConnections: this.configService.maxConcurrentRequests,
                connectionIds: []
            };

            // Stop health check
            this.stopHealthCheck();

            // Emit status change
            this._onConnectionStatusChanged.fire(this.connectionStatus);
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Connection disconnection');
        }
    }

    async checkHealth(): Promise<boolean> {
        const timer = this.performanceMonitor.startTimer('health-check');
        
        try {
            const startTime = Date.now();
            const response = await fetch(`${this.configService.backendUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(this.configService.timeout)
            });

            const latency = Date.now() - startTime;
            const isHealthy = response.ok;

            // Update connection status
            this.connectionStatus.isHealthy = isHealthy;
            this.connectionStatus.lastHealthCheck = Date.now();
            this.connectionStatus.latency = latency;

            if (isHealthy) {
                this.connectionStatus.errorCount = 0;
                this.retryAttempts = 0;
            } else {
                this.connectionStatus.errorCount++;
            }

            // Emit status change
            this._onConnectionStatusChanged.fire(this.connectionStatus);
            
            timer();
            return isHealthy;
        } catch (error) {
            timer();
            this.connectionStatus.isHealthy = false;
            this.connectionStatus.errorCount++;
            this._onConnectionStatusChanged.fire(this.connectionStatus);
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
                },
                signal: AbortSignal.timeout(this.configService.timeout)
            });

            const supportsStreaming = response.ok;
            timer();
            return supportsStreaming;
        } catch (error) {
            timer();
            return false;
        }
    }

    isConnected(): boolean {
        return this.connectionStatus.isConnected && this.connectionStatus.isHealthy;
    }

    getConnectionStatus(): IConnectionStatus {
        return { ...this.connectionStatus };
    }

    getConnectionPool(): IConnectionPool {
        return { ...this.connectionPool };
    }

    getConnectionId(): string {
        return this.connectionStatus.connectionId;
    }

    canMakeRequest(): boolean {
        return this.isConnected() && this.connectionPool.availableConnections > 0;
    }

    acquireConnection(): string | null {
        if (!this.canMakeRequest()) {
            return null;
        }

        const connectionId = this.generateConnectionId();
        this.connectionPool.activeConnections++;
        this.connectionPool.availableConnections--;
        this.connectionPool.connectionIds.push(connectionId);

        return connectionId;
    }

    releaseConnection(connectionId: string): void {
        const index = this.connectionPool.connectionIds.indexOf(connectionId);
        if (index > -1) {
            this.connectionPool.connectionIds.splice(index, 1);
            this.connectionPool.activeConnections--;
            this.connectionPool.availableConnections++;
        }
    }

    cleanupConnectionPool(): void {
        const timer = this.performanceMonitor.startTimer('connection-pool-cleanup');
        
        try {
            // Reset connection pool
            this.connectionPool = {
                maxConnections: this.configService.maxConcurrentRequests,
                activeConnections: 0,
                availableConnections: this.configService.maxConcurrentRequests,
                connectionIds: []
            };
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Connection pool cleanup');
        }
    }

    // Health check management
    private startHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000); // Check every 30 seconds
    }

    private stopHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    private async performHealthCheck(): Promise<void> {
        const isHealthy = await this.checkHealth();
        
        if (!isHealthy && this.connectionStatus.isConnected) {
            this.retryAttempts++;
            
            if (this.retryAttempts >= this.maxRetryAttempts) {
                // Mark as disconnected after max retries
                this.connectionStatus.isConnected = false;
                this._onConnectionStatusChanged.fire(this.connectionStatus);
            } else {
                // Try to reconnect
                await this.attemptReconnection();
            }
        }
    }

    private async attemptReconnection(): Promise<void> {
        const timer = this.performanceMonitor.startTimer('reconnection-attempt');
        
        try {
            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));

            const success = await this.connect();
            if (success) {
                this.retryAttempts = 0;
            }
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Reconnection attempt');
        }
    }

    // Utility methods
    private generateConnectionId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateConnectionStatus(status: Partial<IConnectionStatus>): void {
        this.connectionStatus = { ...this.connectionStatus, ...status };
        this._onConnectionStatusChanged.fire(this.connectionStatus);
    }

    getConnectionStats(): {
        totalConnections: number;
        activeConnections: number;
        availableConnections: number;
        errorCount: number;
        averageLatency: number;
    } {
        return {
            totalConnections: this.connectionPool.maxConnections,
            activeConnections: this.connectionPool.activeConnections,
            availableConnections: this.connectionPool.availableConnections,
            errorCount: this.connectionStatus.errorCount,
            averageLatency: this.connectionStatus.latency
        };
    }

    dispose(): void {
        this.stopHealthCheck();
        this._onConnectionStatusChanged.dispose();
    }
}

 