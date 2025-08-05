export class ErrorUtils {
    private static readonly ERROR_CODES = {
        // Authentication errors
        AUTH_FAILED: 'AUTH_001',
        SESSION_EXPIRED: 'AUTH_002',
        INVALID_TOKEN: 'AUTH_003',
        
        // Rate limiting errors
        RATE_LIMIT_EXCEEDED: 'RATE_001',
        QUOTA_EXCEEDED: 'RATE_002',
        
        // AI service errors
        AI_SERVICE_UNAVAILABLE: 'AI_001',
        MODEL_ERROR: 'AI_002',
        CONTEXT_TOO_LARGE: 'AI_003',
        STREAMING_ERROR: 'AI_004',
        
        // Validation errors
        INVALID_INPUT: 'VAL_001',
        SCHEMA_VALIDATION_FAILED: 'VAL_002',
        
        // System errors
        INTERNAL_ERROR: 'SYS_001',
        NETWORK_ERROR: 'SYS_002',
        TIMEOUT_ERROR: 'SYS_003'
    };

    // Public methods to access error codes
    static getErrorCodes() {
        return this.ERROR_CODES;
    }

    static getInternalErrorCode(): string {
        return this.ERROR_CODES.INTERNAL_ERROR;
    }

    static getInvalidInputErrorCode(): string {
        return this.ERROR_CODES.INVALID_INPUT;
    }

    static createError(
        code: string,
        message: string,
        details?: any,
        originalError?: Error
    ): Error & { code: string; details?: any; originalError?: Error } {
        const error = new Error(message) as Error & { 
            code: string; 
            details?: any; 
            originalError?: Error 
        };
        error.code = code;
        error.details = details;
        error.originalError = originalError;
        return error;
    }

    static getErrorMessage(error: Error | any): string {
        // DEBUGGING: Log the raw error object first
        console.log('🔍 DEBUG getErrorMessage called with:', {
            error: error,
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            errorKeys: error && typeof error === 'object' ? Object.keys(error) : 'N/A',
            errorMessage: error?.message,
            errorName: error?.name,
            errorCode: error?.code
        });

        // Handle different types of errors gracefully
        let errorCode: string | undefined;
        let errorMessage: string | undefined;

        if (error instanceof Error) {
            console.log('🔍 DEBUG getErrorMessage: Error is instanceof Error');
            errorCode = (error as any).code;
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            console.log('🔍 DEBUG getErrorMessage: Error is string');
            errorMessage = error;
        } else if (error && typeof error === 'object') {
            console.log('🔍 DEBUG getErrorMessage: Error is object but not Error instance');
            errorCode = error.code;
            errorMessage = error.message || error.toString();
        } else {
            console.log('🔍 DEBUG getErrorMessage: Error is primitive or null/undefined');
            errorMessage = String(error);
        }
        
        const userMessages: Record<string, string> = {
            [this.ERROR_CODES.AUTH_FAILED]: 'Authentication failed. Please check your credentials and try again.',
            [this.ERROR_CODES.SESSION_EXPIRED]: 'Your session has expired. Please refresh the page and try again.',
            [this.ERROR_CODES.INVALID_TOKEN]: 'Invalid authentication token. Please sign in again.',
            [this.ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please wait a moment before trying again.',
            [this.ERROR_CODES.QUOTA_EXCEEDED]: 'Usage quota exceeded. Please upgrade your plan or wait until next billing cycle.',
            [this.ERROR_CODES.AI_SERVICE_UNAVAILABLE]: 'AI service is temporarily unavailable. Please try again later.',
            [this.ERROR_CODES.MODEL_ERROR]: 'AI model encountered an error. Please try again with a different approach.',
            [this.ERROR_CODES.CONTEXT_TOO_LARGE]: 'The conversation is too long. Please start a new conversation or summarize the context.',
            [this.ERROR_CODES.STREAMING_ERROR]: 'Streaming response was interrupted. Please try again.',
            [this.ERROR_CODES.INVALID_INPUT]: 'Invalid input provided. Please check your request and try again.',
            [this.ERROR_CODES.SCHEMA_VALIDATION_FAILED]: 'Request format is invalid. Please check your input.',
            [this.ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred. Please try again or contact support.',
            [this.ERROR_CODES.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection.',
            [this.ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out. Please try again.'
        };

        // Check for specific error types
        if (errorCode && userMessages[errorCode]) {
            return userMessages[errorCode];
        }

        // Check for common error patterns
        if (errorMessage) {
            if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
                return 'Failed to connect to AI backend. Please check if the backend is running on localhost:3000';
            }
            if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
                return 'Request timed out. The backend may be slow or unavailable.';
            }
            if (errorMessage.includes('500')) {
                return 'Backend server error. Please check the backend logs.';
            }
            if (errorMessage.includes('429')) {
                return 'Rate limit exceeded. Please wait a moment before trying again.';
            }
            if (errorMessage.includes('401')) {
                return 'Session expired. Please try again.';
            }
            if (errorMessage.includes('403')) {
                return 'Access denied. Please check your permissions.';
            }
            if (errorMessage.includes('404')) {
                return 'Resource not found. Please check the request.';
            }
        }

        return errorMessage || 'An unexpected error occurred.';
    }

    static isRetryableError(error: Error | any): boolean {
        const retryableCodes = [
            this.ERROR_CODES.NETWORK_ERROR,
            this.ERROR_CODES.TIMEOUT_ERROR,
            this.ERROR_CODES.AI_SERVICE_UNAVAILABLE,
            this.ERROR_CODES.RATE_LIMIT_EXCEEDED
        ];

        let errorCode: string | undefined;
        if (error instanceof Error) {
            errorCode = (error as any).code;
        } else if (error && typeof error === 'object') {
            errorCode = error.code;
        }

        return errorCode ? retryableCodes.includes(errorCode) : false;
    }

    static isUserError(error: Error | any): boolean {
        const userErrorCodes = [
            this.ERROR_CODES.INVALID_INPUT,
            this.ERROR_CODES.SCHEMA_VALIDATION_FAILED,
            this.ERROR_CODES.CONTEXT_TOO_LARGE
        ];

        let errorCode: string | undefined;
        if (error instanceof Error) {
            errorCode = (error as any).code;
        } else if (error && typeof error === 'object') {
            errorCode = error.code;
        }

        return errorCode ? userErrorCodes.includes(errorCode) : false;
    }

    static logError(error: Error | any, context?: string): void {
        // DEBUGGING: Log the raw error object first
        console.log('🔍 DEBUG logError called with:', {
            error: error,
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            context: context,
            errorKeys: error && typeof error === 'object' ? Object.keys(error) : 'N/A',
            errorMessage: error?.message,
            errorName: error?.name,
            errorStack: error?.stack?.substring(0, 200) + '...'
        });

        // Handle different types of errors gracefully
        let errorInfo: any = {
            context,
            timestamp: new Date().toISOString()
        };

        if (error instanceof Error) {
            console.log('🔍 DEBUG: Error is instanceof Error');
            errorInfo = {
                message: error.message,
                code: (error as any).code,
                stack: error.stack,
                name: error.name,
                ...errorInfo
            };
        } else if (typeof error === 'string') {
            console.log('🔍 DEBUG: Error is string');
            errorInfo.message = error;
        } else if (error && typeof error === 'object') {
            console.log('🔍 DEBUG: Error is object but not Error instance');
            errorInfo = {
                message: error.message || error.toString(),
                code: error.code,
                stack: error.stack,
                name: error.name,
                ...errorInfo
            };
        } else {
            console.log('🔍 DEBUG: Error is primitive or null/undefined');
            errorInfo.message = String(error);
        }

        console.error('AI Companion Error:', errorInfo);
        
        // In a real implementation, you might want to send this to a logging service
        // this.sendToLoggingService(errorInfo);
    }

    static handleStreamingError(error: Error | any): {
        shouldRetry: boolean;
        retryDelay: number;
        userMessage: string;
    } {
        let errorCode: string | undefined;
        if (error instanceof Error) {
            errorCode = (error as any).code;
        } else if (error && typeof error === 'object') {
            errorCode = error.code;
        }
        
        switch (errorCode) {
            case this.ERROR_CODES.NETWORK_ERROR:
                return {
                    shouldRetry: true,
                    retryDelay: 2000,
                    userMessage: 'Connection lost. Retrying...'
                };
                
            case this.ERROR_CODES.TIMEOUT_ERROR:
                return {
                    shouldRetry: true,
                    retryDelay: 1000,
                    userMessage: 'Request timed out. Retrying...'
                };
                
            case this.ERROR_CODES.RATE_LIMIT_EXCEEDED:
                return {
                    shouldRetry: true,
                    retryDelay: 5000,
                    userMessage: 'Rate limit hit. Waiting before retry...'
                };
                
            case this.ERROR_CODES.CONTEXT_TOO_LARGE:
                return {
                    shouldRetry: false,
                    retryDelay: 0,
                    userMessage: 'Conversation too long. Please start a new chat.'
                };
                
            default:
                return {
                    shouldRetry: false,
                    retryDelay: 0,
                    userMessage: this.getErrorMessage(error)
                };
        }
    }

    static createTimeoutError(operation: string, timeoutMs: number): Error {
        return this.createError(
            this.ERROR_CODES.TIMEOUT_ERROR,
            `Operation "${operation}" timed out after ${timeoutMs}ms`,
            { operation, timeoutMs }
        );
    }

    static createNetworkError(operation: string, status?: number): Error {
        return this.createError(
            this.ERROR_CODES.NETWORK_ERROR,
            `Network error during "${operation}"${status ? ` (HTTP ${status})` : ''}`,
            { operation, status }
        );
    }

    static createContextTooLargeError(currentTokens: number, maxTokens: number): Error {
        return this.createError(
            this.ERROR_CODES.CONTEXT_TOO_LARGE,
            `Context window exceeded: ${currentTokens}/${maxTokens} tokens`,
            { currentTokens, maxTokens }
        );
    }
} 