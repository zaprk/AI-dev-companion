import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

/**
 * AI Companion configuration interface
 */
interface IAIConfiguration {
    backendUrl?: string;
    apiKey?: string;
    maxTokens?: number;
    temperature?: number;
    enableStreaming?: boolean;
    cacheEnabled?: boolean;
    cacheTTL?: number;
    retryAttempts?: number;
    timeout?: number;
}

/**
 * AI Companion feature flags interface
 */
interface IAIFeatureFlags {
    advancedWorkflowDetection?: boolean;
    contextAnalysis?: boolean;
    performanceMonitoring?: boolean;
    errorReporting?: boolean;
}

/**
 * Utility class for type-safe configuration access
 */
export class ConfigurationUtility {
    constructor(private readonly configService: IConfigurationService) {}

    /**
     * Get AI Companion configuration with type safety
     */
    getAIConfiguration(): {
        backendUrl: string;
        apiKey: string;
        maxTokens: number;
        temperature: number;
        enableStreaming: boolean;
        cacheEnabled: boolean;
        cacheTTL: number;
        retryAttempts: number;
        timeout: number;
    } {
        const config = this.configService.getValue('aiCompanion') as IAIConfiguration;
        
        return {
            backendUrl: config?.backendUrl || 'http://localhost:3000',
            apiKey: config?.apiKey || '',
            maxTokens: config?.maxTokens || 2000,
            temperature: config?.temperature || 0.7,
            enableStreaming: config?.enableStreaming !== false,
            cacheEnabled: config?.cacheEnabled !== false,
            cacheTTL: config?.cacheTTL || 300000, // 5 minutes
            retryAttempts: config?.retryAttempts || 3,
            timeout: config?.timeout || 30000 // 30 seconds
        };
    }

    /**
     * Get backend URL with validation
     */
    getBackendUrl(): string {
        const url = this.getAIConfiguration().backendUrl;
        if (!url) {
            throw new Error('Backend URL not configured');
        }
        return url;
    }

    /**
     * Get API key with validation
     */
    getApiKey(): string {
        const apiKey = this.getAIConfiguration().apiKey;
        if (!apiKey) {
            throw new Error('API key not configured');
        }
        return apiKey;
    }

    /**
     * Check if streaming is enabled
     */
    isStreamingEnabled(): boolean {
        return this.getAIConfiguration().enableStreaming;
    }

    /**
     * Check if caching is enabled
     */
    isCachingEnabled(): boolean {
        return this.getAIConfiguration().cacheEnabled;
    }

    /**
     * Get cache TTL in milliseconds
     */
    getCacheTTL(): number {
        return this.getAIConfiguration().cacheTTL;
    }

    /**
     * Get request timeout in milliseconds
     */
    getRequestTimeout(): number {
        return this.getAIConfiguration().timeout;
    }

    /**
     * Get retry configuration
     */
    getRetryConfig(): {
        attempts: number;
        backoffMultiplier: number;
        maxDelay: number;
    } {
        const config = this.getAIConfiguration();
        return {
            attempts: config.retryAttempts,
            backoffMultiplier: 2,
            maxDelay: 10000 // 10 seconds
        };
    }

    /**
     * Validate configuration
     */
    validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        const config = this.getAIConfiguration();

        if (!config.backendUrl) {
            errors.push('Backend URL is required');
        }

        if (!config.apiKey) {
            errors.push('API key is required');
        }

        if (config.maxTokens < 1 || config.maxTokens > 4000) {
            errors.push('Max tokens must be between 1 and 4000');
        }

        if (config.temperature < 0 || config.temperature > 2) {
            errors.push('Temperature must be between 0 and 2');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get feature flags
     */
    getFeatureFlags(): {
        enableAdvancedWorkflowDetection: boolean;
        enableContextAnalysis: boolean;
        enablePerformanceMonitoring: boolean;
        enableErrorReporting: boolean;
    } {
        const config = this.configService.getValue('aiCompanion.features') as IAIFeatureFlags;
        
        return {
            enableAdvancedWorkflowDetection: config?.advancedWorkflowDetection !== false,
            enableContextAnalysis: config?.contextAnalysis !== false,
            enablePerformanceMonitoring: config?.performanceMonitoring !== false,
            enableErrorReporting: config?.errorReporting !== false
        };
    }
} 