import { ILogService } from '../../../../../platform/log/common/log.js';

/**
 * Utility class for standardized logging across AI Companion services
 */
export class LoggingUtility {
    constructor(private readonly logService: ILogService) {}

    /**
     * Log informational messages
     */
    info(message: string, ...args: any[]): void {
        this.logService.info(`[AI Companion] ${message}`, ...args);
    }

    /**
     * Log warning messages
     */
    warn(message: string, ...args: any[]): void {
        this.logService.warn(`[AI Companion] ${message}`, ...args);
    }

    /**
     * Log error messages
     */
    error(message: string, ...args: any[]): void {
        this.logService.error(`[AI Companion] ${message}`, ...args);
    }

    /**
     * Log debug messages (only in development)
     */
    debug(message: string, ...args: any[]): void {
        this.logService.debug(`[AI Companion] ${message}`, ...args);
    }

    /**
     * Log performance metrics
     */
    performance(operation: string, duration: number, additionalInfo?: any): void {
        this.info(`Performance: ${operation} took ${duration}ms`, additionalInfo);
    }

    /**
     * Log service lifecycle events
     */
    lifecycle(event: string, service: string, details?: any): void {
        this.info(`Service ${service}: ${event}`, details);
    }

    /**
     * Log workflow detection results
     */
    workflowDetection(content: string, detectedType: string, confidence: number): void {
        this.debug(`Workflow detected: ${detectedType} (confidence: ${confidence})`, { contentLength: content.length });
    }

    /**
     * Log streaming events
     */
    streaming(event: string, requestId: string, details?: any): void {
        this.debug(`Streaming ${event} for request ${requestId}`, details);
    }

    /**
     * Log session events
     */
    session(event: string, sessionId: string, details?: any): void {
        this.info(`Session ${event}: ${sessionId}`, details);
    }

    /**
     * Log backend communication
     */
    backend(operation: string, endpoint: string, details?: any): void {
        this.debug(`Backend ${operation}: ${endpoint}`, details);
    }
} 