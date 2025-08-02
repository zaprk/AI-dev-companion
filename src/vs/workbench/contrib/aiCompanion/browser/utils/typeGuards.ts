import { IAIRequest, IAIResponse, IAIStreamChunk, ISessionInfo } from '../../common/aiCompanionServiceTokens.js';

/**
 * Type guards for AI Companion types
 */
export class TypeGuards {
    /**
     * Check if object is a valid AI request
     */
    static isAIRequest(obj: any): obj is IAIRequest {
        return obj &&
            typeof obj.type === 'string' &&
            typeof obj.prompt === 'string' &&
            typeof obj.context === 'object' &&
            typeof obj.sessionId === 'string';
    }

    /**
     * Check if object is a valid AI response
     */
    static isAIResponse(obj: any): obj is IAIResponse {
        return obj &&
            typeof obj.id === 'string' &&
            typeof obj.content === 'string' &&
            typeof obj.timestamp === 'number' &&
            typeof obj.sessionId === 'string';
    }

    /**
     * Check if object is a valid AI stream chunk
     */
    static isAIStreamChunk(obj: any): obj is IAIStreamChunk {
        return obj &&
            typeof obj.content === 'string' &&
            typeof obj.isComplete === 'boolean';
    }

    /**
     * Check if object is a valid session info
     */
    static isSessionInfo(obj: any): obj is ISessionInfo {
        return obj &&
            typeof obj.sessionId === 'string' &&
            typeof obj.workspaceId === 'string' &&
            obj.createdAt instanceof Date;
    }

    /**
     * Check if object is a valid error
     */
    static isError(obj: any): obj is Error {
        return obj instanceof Error || (obj && typeof obj.message === 'string');
    }

    /**
     * Check if object is a valid configuration
     */
    static isConfiguration(obj: any): obj is {
        backendUrl: string;
        apiKey: string;
        maxTokens: number;
        temperature: number;
    } {
        return obj &&
            typeof obj.backendUrl === 'string' &&
            typeof obj.apiKey === 'string' &&
            typeof obj.maxTokens === 'number' &&
            typeof obj.temperature === 'number';
    }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
    /**
     * Validate AI request parameters
     */
    static validateAIRequest(request: any): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!request) {
            errors.push('Request is required');
            return { isValid: false, errors };
        }

        if (!TypeGuards.isAIRequest(request)) {
            errors.push('Invalid request format');
        }

        if (request.prompt && request.prompt.length === 0) {
            errors.push('Prompt cannot be empty');
        }

        if (request.maxTokens && (request.maxTokens < 1 || request.maxTokens > 4000)) {
            errors.push('Max tokens must be between 1 and 4000');
        }

        if (request.temperature && (request.temperature < 0 || request.temperature > 2)) {
            errors.push('Temperature must be between 0 and 2');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate session info
     */
    static validateSessionInfo(session: any): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!session) {
            errors.push('Session is required');
            return { isValid: false, errors };
        }

        if (!TypeGuards.isSessionInfo(session)) {
            errors.push('Invalid session format');
        }

        if (session.sessionId && session.sessionId.length === 0) {
            errors.push('Session ID cannot be empty');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate configuration
     */
    static validateConfiguration(config: any): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!config) {
            errors.push('Configuration is required');
            return { isValid: false, errors };
        }

        if (!TypeGuards.isConfiguration(config)) {
            errors.push('Invalid configuration format');
        }

        if (config.backendUrl && !this.isValidUrl(config.backendUrl)) {
            errors.push('Invalid backend URL');
        }

        if (config.apiKey && config.apiKey.length === 0) {
            errors.push('API key cannot be empty');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if string is a valid URL
     */
    static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if string is a valid UUID
     */
    static isValidUUID(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}

/**
 * Error utilities
 */
export class ErrorUtils {
    /**
     * Create a standardized error
     */
    static createError(message: string, code?: string, details?: any): Error {
        const error = new Error(message) as any;
        error.code = code;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    }

    /**
     * Check if error is retryable
     */
    static isRetryableError(error: Error): boolean {
        const retryableCodes = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];
        const retryableMessages = ['timeout', 'network', 'connection'];
        
        const errorMessage = error.message.toLowerCase();
        const errorCode = (error as any).code;
        
        return retryableCodes.includes(errorCode) || 
               retryableMessages.some(msg => errorMessage.includes(msg));
    }

    /**
     * Get error severity level
     */
    static getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
        const criticalErrors = ['authentication', 'authorization', 'invalid_token'];
        const highErrors = ['network', 'timeout', 'connection'];
        const mediumErrors = ['validation', 'format', 'parse'];
        
        const errorMessage = error.message.toLowerCase();
        
        if (criticalErrors.some(err => errorMessage.includes(err))) {
            return 'critical';
        }
        
        if (highErrors.some(err => errorMessage.includes(err))) {
            return 'high';
        }
        
        if (mediumErrors.some(err => errorMessage.includes(err))) {
            return 'medium';
        }
        
        return 'low';
    }

    /**
     * Format error for logging
     */
    static formatError(error: Error, context?: string): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` [${context}]` : '';
        const code = (error as any).code ? ` (${(error as any).code})` : '';
        
        return `${timestamp}${contextStr}${code}: ${error.message}`;
    }
}

/**
 * Type assertion utilities
 */
export class TypeAssertions {
    /**
     * Assert that object is an AI request
     */
    static assertAIRequest(obj: any, context?: string): asserts obj is IAIRequest {
        if (!TypeGuards.isAIRequest(obj)) {
            throw ErrorUtils.createError(
                'Invalid AI request format',
                'INVALID_REQUEST',
                { context, object: obj }
            );
        }
    }

    /**
     * Assert that object is an AI response
     */
    static assertAIResponse(obj: any, context?: string): asserts obj is IAIResponse {
        if (!TypeGuards.isAIResponse(obj)) {
            throw ErrorUtils.createError(
                'Invalid AI response format',
                'INVALID_RESPONSE',
                { context, object: obj }
            );
        }
    }

    /**
     * Assert that object is a session info
     */
    static assertSessionInfo(obj: any, context?: string): asserts obj is ISessionInfo {
        if (!TypeGuards.isSessionInfo(obj)) {
            throw ErrorUtils.createError(
                'Invalid session info format',
                'INVALID_SESSION',
                { context, object: obj }
            );
        }
    }
} 