import { IPerformanceMonitor } from '../../common/aiCompanionServiceTokens.js';
import { IErrorHandler } from '../../common/aiCompanionServiceTokens.js';

/**
 * Decorator for automatic performance monitoring
 */
export function withPerformanceMonitoring(operation: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const performanceMonitor = (this as any).performanceMonitor as IPerformanceMonitor;
            if (!performanceMonitor) {
                return method.apply(this, args);
            }

            const timer = performanceMonitor.startTimer(operation);
            try {
                const result = await method.apply(this, args);
                timer();
                return result;
            } catch (error) {
                timer();
                throw error;
            }
        };
    };
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(context: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const errorHandler = (this as any).errorHandler as IErrorHandler;
            if (!errorHandler) {
                return method.apply(this, args);
            }

            try {
                return await method.apply(this, args);
            } catch (error) {
                errorHandler.handleError(error as Error, context);
                throw error;
            }
        };
    };
}

/**
 * Decorator for automatic performance monitoring and error handling
 */
export function withMonitoringAndErrorHandling(operation: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const performanceMonitor = (this as any).performanceMonitor as IPerformanceMonitor;
            const errorHandler = (this as any).errorHandler as IErrorHandler;
            
            if (!performanceMonitor || !errorHandler) {
                return method.apply(this, args);
            }

            const timer = performanceMonitor.startTimer(operation);
            try {
                const result = await method.apply(this, args);
                timer();
                return result;
            } catch (error) {
                timer();
                errorHandler.handleError(error as Error, operation);
                throw error;
            }
        };
    };
}

/**
 * Decorator for caching method results
 */
export function cached(ttl: number = 300000) { // Default 5 minutes
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        const cache = new Map<string, { data: any; timestamp: number }>();
        
        descriptor.value = async function (...args: any[]) {
            const cacheKey = `${propertyName}:${JSON.stringify(args)}`;
            const now = Date.now();
            
            // Check cache
            const cached = cache.get(cacheKey);
            if (cached && (now - cached.timestamp) < ttl) {
                return cached.data;
            }
            
            // Execute method
            const result = await method.apply(this, args);
            
            // Cache result
            cache.set(cacheKey, { data: result, timestamp: now });
            
            return result;
        };
    };
}

/**
 * Decorator for retry logic
 */
export function withRetry(attempts: number = 3, delay: number = 1000) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            let lastError: Error;
            
            for (let attempt = 1; attempt <= attempts; attempt++) {
                try {
                    return await method.apply(this, args);
                } catch (error) {
                    lastError = error as Error;
                    
                    if (attempt === attempts) {
                        throw lastError;
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        };
    };
}

/**
 * Decorator for validation
 */
export function validate(validator: (args: any[]) => boolean | string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const validationResult = validator(args);
            
            if (validationResult === false) {
                throw new Error(`Validation failed for ${propertyName}`);
            }
            
            if (typeof validationResult === 'string') {
                throw new Error(validationResult);
            }
            
            return method.apply(this, args);
        };
    };
}

/**
 * Decorator for logging method calls
 */
export function logged(level: 'info' | 'debug' | 'warn' = 'debug') {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const logService = (this as any).logService;
            if (logService) {
                logService[level](`[AI Companion] Calling ${propertyName}`, { args });
            }
            
            const result = await method.apply(this, args);
            
            if (logService) {
                logService[level](`[AI Companion] Completed ${propertyName}`, { result });
            }
            
            return result;
        };
    };
} 