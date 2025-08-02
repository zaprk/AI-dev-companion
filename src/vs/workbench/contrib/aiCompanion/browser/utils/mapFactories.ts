import { IAIResponse } from '../../common/aiCompanionServiceTokens.js';

/**
 * Factory class for creating commonly used Map types
 */
export class MapFactory {
    /**
     * Create a cache map for storing AI responses with timestamps
     */
    static createCacheMap(): Map<string, { data: IAIResponse; timestamp: number }> {
        return new Map<string, { data: IAIResponse; timestamp: number }>();
    }

    /**
     * Create a map for storing AbortController instances
     */
    static createAbortControllerMap(): Map<string, AbortController> {
        return new Map<string, AbortController>();
    }

    /**
     * Create a map for storing streaming states
     */
    static createStreamingStateMap(): Map<string, any> {
        return new Map<string, any>();
    }

    /**
     * Create a map for storing performance metrics
     */
    static createMetricsMap(): Map<string, number[]> {
        return new Map<string, number[]>();
    }

    /**
     * Create a map for storing active connections
     */
    static createConnectionMap(): Map<string, any> {
        return new Map<string, any>();
    }
} 