// Updated aiCompanionServices.ts with proper dependencies

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';

// Import all service interfaces from tokens
import { 
    IAICompanionConfigurationService,
    IErrorHandler,
    IPerformanceMonitor,
    IMessageFormatter,
    IAIBackendService,
    IStreamProcessor,
    IWorkflowDetector,
    IConnectionManager,
    IStateManager
} from '../common/aiCompanionServiceTokens.js';

// Import IAICompanionService from the main service file
import { IAICompanionService } from '../common/aiCompanionService.js';

// Import all service implementations
import { AICompanionService } from '../common/aiCompanionService.impl.js';
import { AICompanionConfigurationService } from './services/aiCompanionConfigurationService.js';
import { AICompanionErrorHandler } from './services/aiCompanionErrorHandler.js';
import { AICompanionPerformanceMonitor } from './services/aiCompanionPerformanceMonitor.js';
import { AICompanionMessageFormatter } from './services/aiCompanionMessageFormatter.js';
import { AIBackendService } from './services/aiBackendService.js';
import { StreamProcessor } from './services/streamProcessor.js';
import { WorkflowDetector } from './services/workflowDetector.js';
import { ConnectionManager } from './services/connectionManager.js';
import { StateManager } from './services/stateManager.js';

// Register all AI Companion services
export function registerAICompanionServices(): void {
    // Core service - register first as others depend on it
    registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Delayed);
    
    // Configuration service - needed by many others
    registerSingleton(IAICompanionConfigurationService, AICompanionConfigurationService, InstantiationType.Delayed);
    
    // Utility services - no dependencies
    registerSingleton(IErrorHandler, AICompanionErrorHandler, InstantiationType.Delayed);
    registerSingleton(IPerformanceMonitor, AICompanionPerformanceMonitor, InstantiationType.Delayed);
    registerSingleton(IMessageFormatter, AICompanionMessageFormatter, InstantiationType.Delayed);
    
    // Backend service - now with proper session management
    // Depends on: IConfigurationService, IStorageService, IWorkspaceContextService, ILogService
    registerSingleton(IAIBackendService, AIBackendService, InstantiationType.Delayed);
    
    // Stream processor - depends on message formatter
    registerSingleton(IStreamProcessor, StreamProcessor, InstantiationType.Delayed);
    
    // Connection manager - depends on configuration
    registerSingleton(IConnectionManager, ConnectionManager, InstantiationType.Delayed);
    
    // Workflow detector - depends on workspace and file services
    registerSingleton(IWorkflowDetector, WorkflowDetector, InstantiationType.Delayed);
    
    // State manager - depends on performance monitor and error handler
    registerSingleton(IStateManager, StateManager, InstantiationType.Delayed);
}

/**
 * Session Management Summary:
 * 
 * ✅ Fixed Issues:
 * - Sessions now persist across VS Code restarts
 * - Consistent workspace-based session IDs  
 * - Session validation before use
 * - Automatic session recreation when invalid
 * - Proper error handling for session-related issues
 * - Debug commands for troubleshooting
 * 
 * 🔧 How it works:
 * 1. On startup, check VS Code storage for existing session
 * 2. Validate session with backend before using
 * 3. Create new session only if needed
 * 4. Store session info in VS Code workspace storage
 * 5. Handle session expiration gracefully with recreation
 * 
 * 📊 Storage Strategy:
 * - SessionID: Stored in workspace storage (persists per workspace)
 * - WorkspaceID: Derived from workspace folder URI (consistent)
 * - Session validation: Backend call to verify session exists
 * 
 * 🎯 User Experience:
 * - Seamless session continuity across VS Code restarts
 * - No unnecessary session creation
 * - Automatic recovery from session issues
 * - Debug commands for troubleshooting
 */ 