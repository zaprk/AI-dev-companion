import { IAIProvider, IAIProviderConfig, IAIProviderFactory } from './aiProvider.js';
import { OpenAIProvider } from './providers/openaiProvider.js';

/**
 * Default AI Provider Configurations
 */
export const DEFAULT_AI_CONFIGS: Record<string, Partial<IAIProviderConfig>> = {
    openai: {
        provider: 'openai',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        baseUrl: 'https://api.openai.com/v1/chat/completions'
    },
    'openai-3.5': {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        baseUrl: 'https://api.openai.com/v1/chat/completions'
    },
    claude: {
        provider: 'claude',
        model: 'claude-3-sonnet-20240229',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        baseUrl: 'https://api.anthropic.com/v1/messages'
    },
    azure: {
        provider: 'azure',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000
    },
    local: {
        provider: 'local',
        model: 'llama2',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000,
        baseUrl: 'http://localhost:11434/api/generate'
    }
};

/**
 * AI Provider Factory Implementation
 */
export class AIProviderFactory implements IAIProviderFactory {
    
    createProvider(config: IAIProviderConfig): IAIProvider {
        switch (config.provider) {
            case 'openai':
                return new OpenAIProvider(config);
            
            case 'claude':
                // TODO: Implement ClaudeProvider
                throw new Error('Claude provider not yet implemented');
            
            case 'azure':
                // TODO: Implement AzureProvider  
                throw new Error('Azure provider not yet implemented');
            
            case 'local':
                // TODO: Implement LocalProvider (Ollama, etc.)
                throw new Error('Local provider not yet implemented');
            
            default:
                throw new Error(`Unsupported AI provider: ${config.provider}`);
        }
    }

    getSupportedProviders(): string[] {
        return ['openai']; // Add more as they're implemented
    }

    /**
     * Create provider with default configuration merged with user config
     */
    createProviderWithDefaults(provider: string, userConfig: Partial<IAIProviderConfig> = {}): IAIProvider {
        const defaultConfig = DEFAULT_AI_CONFIGS[provider];
        if (!defaultConfig) {
            throw new Error(`No default configuration found for provider: ${provider}`);
        }

        const config: IAIProviderConfig = {
            ...defaultConfig,
            ...userConfig
        } as IAIProviderConfig;

        return this.createProvider(config);
    }

    /**
     * Validate provider configuration
     */
    validateConfig(config: IAIProviderConfig): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!config.provider) {
            errors.push('Provider is required');
        }

        if (!config.model) {
            errors.push('Model is required');
        }

        if (config.maxTokens <= 0) {
            errors.push('Max tokens must be greater than 0');
        }

        if (config.temperature < 0 || config.temperature > 2) {
            errors.push('Temperature must be between 0 and 2');
        }

        // Provider-specific validation
        switch (config.provider) {
            case 'openai':
            case 'azure':
                if (!config.apiKey) {
                    errors.push('API key is required for OpenAI/Azure');
                }
                break;
            
            case 'claude':
                if (!config.apiKey) {
                    errors.push('API key is required for Claude');
                }
                break;
            
            case 'local':
                if (!config.baseUrl) {
                    errors.push('Base URL is required for local provider');
                }
                break;
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Test provider connectivity
     */
    async testProvider(provider: IAIProvider): Promise<{ success: boolean; error?: string; latency?: number }> {
        const startTime = Date.now();
        
        try {
            const response = await provider.complete({
                messages: [
                    { role: 'user', content: 'Test connection. Reply with "OK".' }
                ]
            });

            const latency = Date.now() - startTime;
            
            if (response.content.toLowerCase().includes('ok')) {
                return { success: true, latency };
            } else {
                return { success: false, error: 'Unexpected response from provider' };
            }

        } catch (error: any) {
            return { 
                success: false, 
                error: error.message,
                latency: Date.now() - startTime
            };
        }
    }
}

/**
 * Singleton factory instance
 */
export const aiProviderFactory = new AIProviderFactory();