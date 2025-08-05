export class StreamingErrorUtils {
    private static activeStreams = new Map<string, {
        controller: AbortController;
        retryCount: number;
        lastError: Error | null;
    }>();

    static async createResilientStream(
        streamId: string,
        streamFactory: () => Promise<Response>,
        options: {
            maxRetries?: number;
            retryDelay?: number;
            onError?: (error: Error, retryCount: number) => void;
            onRecovery?: (retryCount: number) => void;
        } = {}
    ): Promise<ReadableStream<Uint8Array>> {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            onError,
            onRecovery
        } = options;

        const controller = new AbortController();
        this.activeStreams.set(streamId, {
            controller,
            retryCount: 0,
            lastError: null
        });

        const createStreamWithRetry = async (): Promise<ReadableStream<Uint8Array>> => {
            try {
                const response = await streamFactory();
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                if (!response.body) {
                    throw new Error('No response body available');
                }

                // Reset retry count on success
                const streamInfo = this.activeStreams.get(streamId);
                if (streamInfo) {
                    streamInfo.retryCount = 0;
                    streamInfo.lastError = null;
                }

                return response.body;

            } catch (error) {
                const streamInfo = this.activeStreams.get(streamId);
                if (!streamInfo) {
                    throw error;
                }

                streamInfo.retryCount++;
                streamInfo.lastError = error as Error;

                onError?.(error as Error, streamInfo.retryCount);

                if (streamInfo.retryCount <= maxRetries && !controller.signal.aborted) {
                    console.warn(`Stream ${streamId} failed, retrying (${streamInfo.retryCount}/${maxRetries})...`);
                    
                    await RetryUtils.delay(retryDelay * streamInfo.retryCount);
                    
                    onRecovery?.(streamInfo.retryCount);
                    return createStreamWithRetry();
                } else {
                    throw new Error(`Stream ${streamId} failed after ${maxRetries} retries: ${error.message}`);
                }
            }
        };

        return createStreamWithRetry();
    }

    static cancelStream(streamId: string): void {
        const streamInfo = this.activeStreams.get(streamId);
        if (streamInfo) {
            streamInfo.controller.abort();
            this.activeStreams.delete(streamId);
        }
    }

    static getStreamStatus(streamId: string): {
        active: boolean;
        retryCount: number;
        lastError: Error | null;
    } | null {
        const streamInfo = this.activeStreams.get(streamId);
        if (!streamInfo) return null;

        return {
            active: !streamInfo.controller.signal.aborted,
            retryCount: streamInfo.retryCount,
            lastError: streamInfo.lastError
        };
    }

    static cleanupStreams(): void {
        for (const [streamId, streamInfo] of this.activeStreams.entries()) {
            if (streamInfo.controller.signal.aborted) {
                this.activeStreams.delete(streamId);
            }
        }
    }
}

export class RetryUtils {
    static async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async retryWithExponentialBackoff<T>(
        operation: () => Promise<T>,
        options: {
            maxRetries?: number;
            baseDelay?: number;
            maxDelay?: number;
            shouldRetry?: (error: Error) => boolean;
        } = {}
    ): Promise<T> {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            shouldRetry = () => true
        } = options;

        let lastError: Error;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔍 DEBUG retryWithExponentialBackoff attempt ${attempt + 1}/${maxRetries + 1}`);
                const result = await operation();
                console.log(`🔍 DEBUG retryWithExponentialBackoff attempt ${attempt + 1} succeeded`);
                return result;
            } catch (error) {
                console.log(`🔍 DEBUG retryWithExponentialBackoff attempt ${attempt + 1} failed:`, {
                    error: error,
                    errorType: typeof error,
                    errorConstructor: error?.constructor?.name,
                    errorMessage: error?.message,
                    errorName: error?.name
                });
                lastError = error as Error;
                
                if (attempt === maxRetries || !shouldRetry(lastError)) {
                    console.log(`🔍 DEBUG retryWithExponentialBackoff giving up after ${attempt + 1} attempts`);
                    throw lastError;
                }

                const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                console.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await this.delay(delay);
            }
        }

        throw lastError!;
    }

    static createRetryableStreamReader(
        reader: ReadableStreamDefaultReader<Uint8Array>,
        onRetry?: (attempt: number) => void
    ): {
        read: () => Promise<{ done: boolean; value?: Uint8Array }>;
        cancel: () => void;
    } {
        let retryCount = 0;
        const maxRetries = 3;

        const readWithRetry = async (): Promise<{ done: boolean; value?: Uint8Array }> => {
            try {
                const result = await reader.read();
                retryCount = 0; // Reset on success
                return result;
            } catch (error) {
                retryCount++;
                if (retryCount <= maxRetries) {
                    onRetry?.(retryCount);
                    await this.delay(1000 * retryCount);
                    return readWithRetry();
                } else {
                    throw error;
                }
            }
        };

        return {
            read: readWithRetry,
            cancel: () => reader.cancel()
        };
    }
} 