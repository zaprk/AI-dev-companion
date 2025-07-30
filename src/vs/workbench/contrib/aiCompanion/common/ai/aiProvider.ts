
/**
 * AI Provider Configuration
 */
export interface IAIProviderConfig {
    provider: 'openai' | 'claude' | 'azure' | 'local';
    apiKey?: string;
    baseUrl?: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
}

/**
 * AI Request Types
 */
export interface IAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    files?: string[]; // File contents for context
}

export interface IAIRequest {
    messages: IAIMessage[];
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface IAIResponse {
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * Structured Generation Results
 */
export interface IAIRequirementsResult {
    functional: string[];
    nonFunctional: string[];
    constraints: string[];
    assumptions: string[];
    reasoning: string;
}

export interface IAIDesignResult {
    folderStructure: Record<string, any>;
    components: string[];
    architecture: string;
    techStack: string[];
    dependencies: string[];
    reasoning: string;
}

export interface IAITaskResult {
    tasks: Array<{
        title: string;
        description: string;
        filePath?: string;
        dependencies?: string[];
        estimatedTime?: string;
        complexity: 'low' | 'medium' | 'high';
    }>;
    reasoning: string;
}

export interface IAICodeResult {
    files: Array<{
        path: string;
        content: string;
        description: string;
    }>;
    reasoning: string;
}

/**
 * AI Provider Interface
 */
export interface IAIProvider {
    readonly config: IAIProviderConfig;
    
    // Basic completion
    complete(request: IAIRequest): Promise<IAIResponse>;
    
    // Structured generation methods
    generateRequirements(prompt: string, context?: string): Promise<IAIRequirementsResult>;
    generateDesign(requirements: IAIRequirementsResult, context?: string): Promise<IAIDesignResult>;
    generateTasks(requirements: IAIRequirementsResult, design: IAIDesignResult, context?: string): Promise<IAITaskResult>;
    generateCode(tasks: IAITaskResult, selectedTasks?: string[], context?: string): Promise<IAICodeResult>;
    
    // Utility methods
    validateResponse(response: IAIResponse): boolean;
    estimateTokens(text: string): number;
    isConfigured(): boolean;
}

/**
 * AI Provider Factory
 */
export interface IAIProviderFactory {
    createProvider(config: IAIProviderConfig): IAIProvider;
    getSupportedProviders(): string[];
}