import { generateUuid } from '../../../../../base/common/uuid.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ICodeSearchService } from '../../common/codeSearchService.js';
import { IAINotificationService } from '../../common/aiNotificationService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { MockAIService } from './mockAiService.js';
import { IBackendCommunicationService, BackendAIResponse } from './backendCommunicationService.js';

export class MockBackendCommunicationService implements IBackendCommunicationService {
	private sessionId: string = '';
	private isConnected = false;
	private mockAI: MockAIService;

	constructor(
		private readonly _workspaceService: IWorkspaceContextService,
		private readonly _configurationService: IConfigurationService,
		private readonly _codeSearchService?: ICodeSearchService,
		private readonly _aiNotificationService?: IAINotificationService,
		private readonly _logService?: ILogService
	) {
		this.mockAI = new MockAIService(
			undefined, // sessionId
			this._codeSearchService,
			this._aiNotificationService,
			this._logService
		);
		this.sessionId = generateUuid();
		this.isConnected = true;
		console.log('🎭 Mock Backend Service initialized with session:', this.sessionId);
	}

	async initialize(): Promise<void> {
		// Simulate initialization delay
		await this.delay(500);
		
		this.sessionId = generateUuid();
		this.isConnected = true;
		this.updateConnectionStatus(true, 'Connected (Mock Mode)');
		
		console.log('✅ Mock session created successfully:', this.sessionId);
	}

	async callAPI(type: string, prompt: string, currentMode: any): Promise<BackendAIResponse> {
		console.log(`🎭 Mock API call: ${type} - "${prompt.substring(0, 50)}..."`);
		
		// Simulate network delay
		await this.delay(800 + Math.random() * 1200);
		
		const mockResponse = await this.mockAI.generateMockResponse(type, prompt);
		
		return {
			content: mockResponse.content,
			usage: mockResponse.usage,
			model: mockResponse.model,
			finishReason: mockResponse.finishReason,
			sessionId: this.sessionId,
			requestId: mockResponse.requestId
		};
	}

	async checkStreamingEndpoint(): Promise<boolean> {
		console.log('🌊 Mock streaming endpoint check - always available');
		return true;
	}

	async createStreamingRequest(type: string, content: string, context: any): Promise<Response> {
		console.log(`🌊 Mock streaming request: ${type}`);
		
		// Create a mock streaming response
		const mockResponse = await this.mockAI.generateMockResponse(type, content);
		
		// Create readable stream for SSE simulation
		const chunks = this.mockAI.createStreamingChunks(mockResponse.content);
		
		// Create a custom Response object that simulates SSE
		const stream = new ReadableStream({
			start(controller) {
				let chunkIndex = 0;
				
				const sendNextChunk = () => {
					if (chunkIndex < chunks.length) {
						const chunk = chunks[chunkIndex];
						const sseData = `data: ${JSON.stringify({
							content: chunk,
							accumulated: chunks.slice(0, chunkIndex + 1).join(' '),
							tokens: chunkIndex + 1,
							requestId: mockResponse.requestId
						})}\n\n`;
						
						controller.enqueue(new TextEncoder().encode(sseData));
						chunkIndex++;
						
						// Realistic streaming delay
						setTimeout(sendNextChunk, 100 + Math.random() * 200);
					} else {
						// Send completion signal
						controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
						controller.close();
					}
				};
				
				// Start streaming after a brief delay
				setTimeout(sendNextChunk, 200);
			}
		});

		return new Response(stream, {
			status: 200,
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive'
			}
		});
	}

	getSessionId(): string {
		return this.sessionId;
	}

	isSessionConnected(): boolean {
		return this.isConnected;
	}

	dispose(): void {
		console.log('🎭 Mock backend service disposed');
	}

	// Optional: Add methods to actually use the injected services
	getWorkspaceInfo(): any {
		// Example usage of workspace service
		return this._workspaceService.getWorkspace();
	}

	getConfiguration(section: string): any {
		// Example usage of configuration service
		return this._configurationService.getValue(section);
	}

	// Mock implementations of other methods
	private async delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private updateConnectionStatus(connected: boolean, message: string): void {
		this.isConnected = connected;
		console.log(`🔗 Mock connection status: ${connected ? 'Connected' : 'Disconnected'} - ${message}`);
	}
}

// Example usage with realistic ecommerce simulation
export class EcommerceMockDemo {
	private mockService: MockBackendCommunicationService;

	constructor() {
		// Mock workspace and config services for demo
		const mockWorkspaceService = {} as IWorkspaceContextService;
		const mockConfigService = {} as IConfigurationService;
		
		this.mockService = new MockBackendCommunicationService(mockWorkspaceService, mockConfigService);
	}

	async runEcommerceDemo(): Promise<void> {
		console.log('🚀 Starting E-commerce Platform Demo');
		
		await this.mockService.initialize();
		
		// Simulate the full workflow
		console.log('\n📋 Step 1: Generating Requirements...');
		const requirements = await this.mockService.callAPI('requirements', 'I want to build an ecommerce platform', 'builder');
		console.log('✅ Requirements generated:', requirements.usage.totalTokens, 'tokens');
		
		console.log('\n🏗️ Step 2: Generating Design...');
		const design = await this.mockService.callAPI('design', 'Create design for ecommerce platform based on requirements', 'builder');
		console.log('✅ Design generated:', design.usage.totalTokens, 'tokens');
		
		console.log('\n📝 Step 3: Generating Tasks...');
		const tasks = await this.mockService.callAPI('tasks', 'Break down ecommerce platform into implementation tasks', 'builder');
		console.log('✅ Tasks generated:', tasks.usage.totalTokens, 'tokens');
		
		console.log('\n💻 Step 4: Generating Code...');
		const code = await this.mockService.callAPI('code', 'Generate code for ecommerce platform components', 'builder');
		console.log('✅ Code generated:', code.usage.totalTokens, 'tokens');
		
		console.log('\n🎉 E-commerce Platform Demo Complete!');
		console.log('Total tokens used:', 
			requirements.usage.totalTokens + 
			design.usage.totalTokens + 
			tasks.usage.totalTokens + 
			code.usage.totalTokens
		);
	}

	async demonstrateStreaming(): Promise<void> {
		console.log('\n🌊 Demonstrating Streaming Response...');
		
		const streamResponse = await this.mockService.createStreamingRequest(
			'requirements', 
			'I want to build an ecommerce platform', 
			{}
		);
		
		const reader = streamResponse.body?.getReader();
		const decoder = new TextDecoder();
		
		if (reader) {
			let accumulatedContent = '';
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split('\n');
				
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						
						if (data === '[DONE]') {
							console.log('\n🌊 Streaming complete!');
							console.log('Final content length:', accumulatedContent.length);
							return;
						}
						
						try {
							const parsed = JSON.parse(data);
							if (parsed.content) {
								accumulatedContent += parsed.content;
								process.stdout.write(parsed.content); // Show streaming effect
							}
						} catch (e) {
							// Skip non-JSON lines
						}
					}
				}
			}
		}
	}
}