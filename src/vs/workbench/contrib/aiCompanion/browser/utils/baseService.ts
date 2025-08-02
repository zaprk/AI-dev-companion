import { IErrorHandler, IPerformanceMonitor } from '../../common/aiCompanionServiceTokens.js';

/**
 * Base class for AI Companion services to eliminate code repetition
 */
export abstract class BaseService {
    readonly _serviceBrand: undefined;

    constructor(
        protected readonly errorHandler: IErrorHandler,
        protected readonly performanceMonitor: IPerformanceMonitor
    ) {}

    /**
     * Execute a function with automatic performance monitoring and error handling
     */
    protected async withPerformanceMonitoring<T>(
        operation: string,
        fn: () => Promise<T>
    ): Promise<T> {
        const timer = this.performanceMonitor.startTimer(operation);
        try {
            const result = await fn();
            timer();
            return result;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, operation);
            throw error;
        }
    }

    /**
     * Execute a function with automatic error handling only
     */
    protected async withErrorHandling<T>(
        context: string,
        fn: () => Promise<T>
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.errorHandler.handleError(error as Error, context);
            throw error;
        }
    }

    /**
     * Execute a function with both performance monitoring and error handling
     */
    protected async withMonitoringAndErrorHandling<T>(
        operation: string,
        fn: () => Promise<T>
    ): Promise<T> {
        return this.withPerformanceMonitoring(operation, () => 
            this.withErrorHandling(operation, fn)
        );
    }
} 