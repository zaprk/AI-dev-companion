import { generateUuid } from '../../../../../base/common/uuid.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';

export interface BackendAIResponse {
	content: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	finishReason: string;
	sessionId: string;
	requestId: string;
}

export interface IBackendCommunicationService {
	initialize(): Promise<void>;
	callAPI(type: string, prompt: string, currentMode: any): Promise<BackendAIResponse>;
	checkStreamingEndpoint(): Promise<boolean>;
	createStreamingRequest(type: string, content: string, context: any): Promise<Response>;
	getSessionId(): string;
	isSessionConnected(): boolean;
	dispose(): void;
}

export class BackendCommunicationService implements IBackendCommunicationService {
	private sessionId: string = '';
	private backendUrl: string = '';
	private isConnected = false;
	private sessionMonitoringInterval: any = null;

	constructor(
		private readonly workspaceService: IWorkspaceContextService,
		private readonly configurationService: IConfigurationService
	) {
		this.backendUrl = this.configurationService.getValue<string>('aiCompanion.backend.url') || 'http://localhost:3000/api/v1';
	}

	async initialize(): Promise<void> {
		try {
			const isHealthy = await this.checkBackendHealth();
			if (!isHealthy) {
				this.updateConnectionStatus(false, 'Backend not reachable');
				return;
			}

			const workspace = this.workspaceService.getWorkspace();
			const workspaceId = workspace.folders[0]?.uri.toString() || 'unknown';
			
			console.log('🔄 Creating session with workspace:', workspaceId);
			
			const response = await fetch(`${this.backendUrl}/sessions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					workspaceId: workspaceId,
					vscodeVersion: '1.90.0'
				})
			});

			if (response.ok) {
				const data = await response.json();
				this.sessionId = data.sessionId;
				this.updateConnectionStatus(true, 'Connected');
				console.log('✅ Session created successfully:', this.sessionId);
				
				await this.validateSession();
				this.startSessionMonitoring();
			} else {
				const errorText = await response.text();
				console.error('❌ Session creation failed:', response.status, errorText);
				this.updateConnectionStatus(false, 'Failed to create session');
				this.sessionId = generateUuid();
			}
		} catch (error) {
			console.error('❌ Session initialization error:', error);
			this.updateConnectionStatus(false, 'Connection failed');
			this.sessionId = generateUuid();
		}
	}

	async callAPI(type: string, prompt: string, currentMode: any): Promise<BackendAIResponse> {
		const workspace = this.workspaceService.getWorkspace();
		const workspaceInfo = {
			name: workspace.folders[0]?.name || 'Unknown',
			rootPath: workspace.folders[0]?.uri.fsPath || '',
			files: [],
			gitBranch: undefined
		};

		const requestBody = {
			type: type,
			prompt: prompt,
			context: {
				workspace: workspaceInfo,
				memory: null,
				files: { files: [], directories: [], totalFiles: 0, totalSize: 0 },
				currentMode: currentMode,
				techStack: [],
				architecture: '',
				goals: []
			},
			sessionId: this.sessionId,
			messages: [
				{ role: 'user', content: prompt }
			],
			maxTokens: 2048,
			temperature: 0.7
		};

		console.log(`🚀 Sending ${type} request:`, {
			sessionId: this.sessionId,
			url: `${this.backendUrl}/completions`,
			type: type
		});

		const timeout = this.configurationService.getValue<number>('aiCompanion.backend.timeout') || 30000;

		try {
			const response = await fetch(`${this.backendUrl}/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify(requestBody),
				signal: AbortSignal.timeout(timeout)
			});

			if (response.status === 401) {
				console.warn('⚠️ Session expired during API call, recreating...');
				await this.recreateSession();
				
				if (this.sessionId) {
					requestBody.sessionId = this.sessionId;
					
					const retryResponse = await fetch(`${this.backendUrl}/completions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Session-ID': this.sessionId
						},
						body: JSON.stringify(requestBody),
						signal: AbortSignal.timeout(timeout)
					});
					
					if (!retryResponse.ok) {
						const errorData = await retryResponse.text();
						throw new Error(`Backend API error (retry): ${retryResponse.status} ${errorData}`);
					}
					
					const retryData = await retryResponse.json();
					return retryData;
				}
			}

			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(`Backend API error: ${response.status} ${errorData}`);
			}

			const data = await response.json();
			return data;

		} catch (error: any) {
			if (error.name === 'AbortError') {
				throw new Error('Request timeout');
			}
			throw error;
		}
	}

	async checkStreamingEndpoint(): Promise<boolean> {
		try {
			// Try a POST request with minimal data to test if endpoint exists
			const testBody = {
				type: 'chat',
				prompt: 'test',
				context: {},
				sessionId: this.sessionId || 'test-session'
			};
			
			const response = await fetch(`${this.backendUrl}/completions-stream`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(testBody),
				signal: AbortSignal.timeout(3000)
			});

			console.log(`🌊 Streaming endpoint check: ${response.status} ${response.statusText}`);
			
			// If it returns 404, the endpoint doesn't exist
			if (response.status === 404) {
				console.log('❌ Streaming endpoint does not exist');
				return false;
			}
			
			// If it returns 400 (Bad Request), the endpoint exists but validation failed (expected)
			if (response.status === 400) {
				console.log('✅ Streaming endpoint exists (400 Bad Request is expected for test data)');
				return true;
			}
			
			// If it returns 405 (Method Not Allowed), the endpoint exists but doesn't support POST
			if (response.status === 405) {
				console.log('❌ Streaming endpoint exists but doesn\'t support POST');
				return false;
			}
			
			const isAvailable = response.ok;
			console.log(`🌊 Streaming endpoint ${isAvailable ? 'available' : 'not available'}`);
			return isAvailable;
		} catch (error) {
			console.log('🌊 Streaming endpoint not available:', error.message);
			return false;
		}
	}

	async createStreamingRequest(type: string, content: string, context: any): Promise<Response> {
		console.log('🚀 Attempting streaming request...');
		
		// Use the same format as the regular API call
		const workspace = this.workspaceService.getWorkspace();
		const workspaceInfo = {
			name: workspace.folders[0]?.name || 'Unknown',
			rootPath: workspace.folders[0]?.uri.fsPath || '',
			files: [],
			gitBranch: undefined
		};

		const requestBody = {
			type: type,
			prompt: content,
			context: {
				workspace: workspaceInfo,
				memory: null,
				files: { files: [], directories: [], totalFiles: 0, totalSize: 0 },
				currentMode: context?.currentMode || 'builder',
				techStack: [],
				architecture: '',
				goals: []
			},
			sessionId: this.sessionId,
			messages: [
				{ role: 'user', content: content }
			],
			maxTokens: 2048,
			temperature: 0.7,
			stream: true
		};
		
		console.log('📤 Streaming request body:', JSON.stringify(requestBody, null, 2));
		console.log('🔗 Streaming URL:', `${this.backendUrl}/completions-stream`);
		console.log('🆔 Session ID:', this.sessionId);
		console.log('🔍 Session ID valid:', !!this.sessionId && this.sessionId.length > 0);
		console.log('🔍 Context valid:', !!requestBody.context && typeof requestBody.context === 'object');
		
		const response = await fetch(`${this.backendUrl}/completions-stream`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Session-ID': this.sessionId
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`❌ Streaming request failed (${response.status}):`, errorText);
		}

		return response;
	}

	getSessionId(): string {
		return this.sessionId;
	}

	isSessionConnected(): boolean {
		return this.isConnected;
	}

	dispose(): void {
		this.stopSessionMonitoring();
	}

	// Private methods
	private async checkBackendHealth(): Promise<boolean> {
		try {
			const healthUrl = this.backendUrl.replace('/api/v1', '') + '/health';
			console.log('🔍 Checking backend health at:', healthUrl);
			
			const response = await fetch(healthUrl, {
				method: 'GET',
				signal: AbortSignal.timeout(5000)
			});
			
			console.log('✅ Backend health check response:', response.status);
			return response.ok;
		} catch (error) {
			console.error('❌ Backend health check failed:', error);
			
			if (error instanceof TypeError && error.message.includes('Content Security Policy')) {
				console.warn('⚠️ CSP blocked connection, trying alternative approach...');
				return true;
			}
			
			return false;
		}
	}

	private async validateSession(): Promise<void> {
		if (!this.sessionId) {
			console.warn('⚠️ No session ID to validate');
			return;
		}
		
		try {
			console.log('🔍 Validating session:', this.sessionId);
			
			const response = await fetch(`${this.backendUrl}/usage/${this.sessionId}`, {
				method: 'GET',
				headers: {
					'X-Session-ID': this.sessionId
				}
			});
			
			if (response.ok) {
				const usageData = await response.json();
				console.log('✅ Session validation successful:', usageData);
			} else {
				const errorText = await response.text();
				console.error('❌ Session validation failed:', response.status, errorText);
				
				if (response.status === 401) {
					console.log('🔄 Session invalid, recreating...');
					await this.recreateSession();
				}
			}
		} catch (error) {
			console.error('❌ Session validation error:', error);
		}
	}

	private async recreateSession(): Promise<void> {
		console.log('🔄 Recreating session...');
		this.sessionId = '';
		this.isConnected = false;
		await this.initialize();
	}

	private startSessionMonitoring(): void {
		this.sessionMonitoringInterval = setInterval(async () => {
			if (this.sessionId && this.isConnected) {
				await this.validateSession();
			}
		}, 5 * 60 * 1000); // 5 minutes
	}

	private stopSessionMonitoring(): void {
		if (this.sessionMonitoringInterval) {
			clearInterval(this.sessionMonitoringInterval);
			this.sessionMonitoringInterval = null;
		}
	}

	private updateConnectionStatus(connected: boolean, message: string): void {
		this.isConnected = connected;
		// Emit event for UI updates
		console.log(`🔗 Connection status: ${connected ? 'Connected' : 'Disconnected'} - ${message}`);
	}
}