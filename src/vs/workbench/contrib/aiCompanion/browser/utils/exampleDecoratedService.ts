import { BaseService } from './baseService.js';
import { 
    withPerformanceMonitoring, 
    withErrorHandling, 
    withMonitoringAndErrorHandling,
    cached,
    withRetry,
    validate,
    logged
} from './decorators.js';
import { TypeAssertions, ValidationUtils } from './typeGuards.js';
import { IAIRequest, IAIResponse } from '../../common/aiCompanionServiceTokens.js';

/**
 * Example service demonstrating decorator usage
 * This shows how to use all the new decorators for common patterns
 */
export class ExampleDecoratedService extends BaseService {
    
    /**
     * Method with performance monitoring only
     */
    @withPerformanceMonitoring('data-processing')
    async processData(data: any[]): Promise<any[]> {
        // Simulate data processing
        await new Promise(resolve => setTimeout(resolve, 100));
        return data.map(item => ({ ...item, processed: true }));
    }

    /**
     * Method with error handling only
     */
    @withErrorHandling('api-call')
    async callExternalAPI(endpoint: string): Promise<any> {
        // Simulate API call
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }
        return response.json();
    }

    /**
     * Method with both performance monitoring and error handling
     */
    @withMonitoringAndErrorHandling('complex-operation')
    async performComplexOperation(input: any): Promise<any> {
        // Simulate complex operation
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!input) {
            throw new Error('Input is required');
        }
        
        return { result: 'success', input };
    }

    /**
     * Method with caching (5 minutes TTL)
     */
    @cached(300000)
    async getCachedData(key: string): Promise<any> {
        // Simulate expensive operation
        await new Promise(resolve => setTimeout(resolve, 500));
        return { data: `cached-data-for-${key}`, timestamp: Date.now() };
    }

    /**
     * Method with retry logic (3 attempts, 1 second delay)
     */
    @withRetry(3, 1000)
    async unreliableOperation(): Promise<string> {
        // Simulate unreliable operation
        if (Math.random() < 0.7) {
            throw new Error('Random failure');
        }
        return 'success after retries';
    }

    /**
     * Method with validation
     */
    @validate((args) => {
        const [request] = args;
        const validation = ValidationUtils.validateAIRequest(request);
        return validation.isValid ? true : validation.errors.join(', ');
    })
    async processAIRequest(request: IAIRequest): Promise<IAIResponse> {
        // Type assertion to ensure type safety
        TypeAssertions.assertAIRequest(request);
        
        // Process the request
        return {
            id: 'response-id',
            content: 'Processed response',
            timestamp: Date.now(),
            sessionId: request.sessionId
        };
    }

    /**
     * Method with logging
     */
    @logged('info')
    async loggableOperation(operation: string, data: any): Promise<any> {
        // Simulate operation
        await new Promise(resolve => setTimeout(resolve, 50));
        return { operation, result: 'completed', data };
    }

    /**
     * Method combining multiple decorators
     */
    @withMonitoringAndErrorHandling('multi-decorator-operation')
    @cached(60000) // 1 minute cache
    @validate((args) => {
        const [url] = args;
        return typeof url === 'string' && url.startsWith('http') ? true : 'Invalid URL';
    })
    @logged('debug')
    async multiDecoratorExample(url: string): Promise<any> {
        // Simulate operation with multiple decorators
        await new Promise(resolve => setTimeout(resolve, 100));
        return { url, processed: true, timestamp: Date.now() };
    }

    /**
     * Method demonstrating error severity classification
     */
    @withErrorHandling('error-classification')
    async demonstrateErrorClassification(errorType: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
        const errors = {
            low: new Error('Minor validation issue'),
            medium: new Error('Format error in data'),
            high: new Error('Network timeout occurred'),
            critical: new Error('Authentication failed')
        };

        throw errors[errorType];
    }

    /**
     * Method demonstrating type guards
     */
    async demonstrateTypeGuards(data: any): Promise<string> {
        // Use type guards for runtime type checking
        if (typeof data === 'string') {
            return `String data: ${data}`;
        }
        
        if (Array.isArray(data)) {
            return `Array data with ${data.length} items`;
        }
        
        if (data && typeof data === 'object') {
            return `Object data with keys: ${Object.keys(data).join(', ')}`;
        }
        
        return 'Unknown data type';
    }
} 