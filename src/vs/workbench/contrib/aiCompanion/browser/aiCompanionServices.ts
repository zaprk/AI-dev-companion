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
	// Core service
	registerSingleton(IAICompanionService, AICompanionService, InstantiationType.Delayed);
	
	// Configuration service
	registerSingleton(IAICompanionConfigurationService, AICompanionConfigurationService, InstantiationType.Delayed);
	
	// Utility services
	registerSingleton(IErrorHandler, AICompanionErrorHandler, InstantiationType.Delayed);
	registerSingleton(IPerformanceMonitor, AICompanionPerformanceMonitor, InstantiationType.Delayed);
	registerSingleton(IMessageFormatter, AICompanionMessageFormatter, InstantiationType.Delayed);
	
	// Backend and communication services
	registerSingleton(IAIBackendService, AIBackendService, InstantiationType.Delayed);
	registerSingleton(IStreamProcessor, StreamProcessor, InstantiationType.Delayed);
	registerSingleton(IConnectionManager, ConnectionManager, InstantiationType.Delayed);
	
	// Workflow and state services
	registerSingleton(IWorkflowDetector, WorkflowDetector, InstantiationType.Delayed);
	registerSingleton(IStateManager, StateManager, InstantiationType.Delayed);
} 