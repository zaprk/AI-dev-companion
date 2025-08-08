import { 
	StreamingErrorUtils, 
	ErrorUtils 
} from '../utils/index.js';

export class StreamingResponseParser {
	private buffer: string = '';
	private isComplete: boolean = false;

	parseChunk(chunk: string): { content: string; isComplete: boolean; progress: number } {
		this.buffer += chunk;
		
		// Handle SSE format
		const lines = this.buffer.split('\n');
		let content = '';
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			if (line.startsWith('data: ')) {
				const data = line.slice(6);
				
				if (data === '[DONE]') {
					this.isComplete = true;
					// Clear processed lines from buffer
					this.buffer = lines.slice(i + 1).join('\n');
					break;
				}
				
				try {
					const parsed = JSON.parse(data);
					if (parsed && typeof parsed === 'object' && parsed.content) {
						content += parsed.content;
					}
				} catch (parseError) {
					// If it's not JSON, treat as plain text
					if (data.trim()) {
						content += data;
					}
				}
				
				// Remove processed line from buffer
				lines.splice(i, 1);
				i--; // Adjust index since we removed a line
			}
		}
		
		// Update buffer with remaining unprocessed lines
		this.buffer = lines.join('\n');
		
		// Calculate progress based on content accumulation
		const estimatedTotalLength = 2000; // Rough estimate
		const currentLength = this.buffer.length + content.length;
		const progress = Math.min((currentLength / estimatedTotalLength) * 100, 95);
		
		return { content, isComplete: this.isComplete, progress };
	}

	reset(): void {
		this.buffer = '';
		this.isComplete = false;
	}
}

export class StreamingResponseService {
	private readonly UPDATE_THROTTLE = 16; // 60fps updates for ultra-smooth streaming
	private progressSmoother: ProgressSmoother = new ProgressSmoother();

	async processStreamingResponse(
		response: Response, 
		contentElement: HTMLElement, 
		workflowType: string,
		formatCallback: (content: string, workflowType: string, isFinal?: boolean) => string,
		renderCallback: (content: string) => HTMLElement,
		progressCallback?: (progressPercent: number) => void
	): Promise<void> {
		const streamId = `stream-${Date.now()}`;
		
		try {
			// Create resilient stream
			const resilientStream = await StreamingErrorUtils.createResilientStream(
				streamId,
				() => Promise.resolve(response),
				{
					maxRetries: 3,
					onError: (error, retryCount) => {
						console.warn(`Stream error (attempt ${retryCount}):`, error);
						const errorMessage = ErrorUtils.getErrorMessage(error);
						this.updateStreamingContent(contentElement, renderCallback(`⚠️ ${errorMessage}`));
					},
					onRecovery: (retryCount) => {
						console.log(`Stream recovered after ${retryCount} retries`);
						this.updateStreamingContent(contentElement, renderCallback(`🔄 Recovered after ${retryCount} retries...`));
					}
				}
			);

			const reader = resilientStream.getReader();
			const decoder = new TextDecoder();
			const parser = new StreamingResponseParser();
			
			let accumulatedContent = '';
			let lastUpdateTime = 0;
			let lastProgressUpdate = 0;
			let isFirstChunk = true;
			let receivedChunks = 0;
			let expectedContentLength = 2000; // Dynamic estimation

			console.log('🌊 Starting ultra-smooth streaming response processing...');

			// Start progress smoothing
			this.progressSmoother.start();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const parseResult = parser.parseChunk(chunk);
				
				receivedChunks++;
				
				if (parseResult.content) {
					accumulatedContent += parseResult.content;
					
					// Dynamically adjust expected content length based on type
					expectedContentLength = this.estimateContentLength(workflowType, accumulatedContent.length);
					
					// Calculate smooth progress
					const rawProgress = Math.min((accumulatedContent.length / expectedContentLength) * 100, 95);
					const smoothProgress = this.progressSmoother.updateProgress(rawProgress);
					
					// Only try to format if the content looks like it might be JSON
					const formatted = this.tryFormatIncremental(accumulatedContent, workflowType, formatCallback);
					const displayContent = formatted || formatCallback(accumulatedContent, workflowType);
					
					// Update progress with smooth interpolation
					const now = Date.now();
					if (progressCallback && now - lastProgressUpdate > this.UPDATE_THROTTLE) {
						progressCallback(smoothProgress);
						lastProgressUpdate = now;
					}
					
					// Update UI with high frequency for smooth streaming
					if (isFirstChunk || now - lastUpdateTime > this.UPDATE_THROTTLE) {
						this.updateStreamingContent(contentElement, renderCallback(displayContent));
						lastUpdateTime = now;
						isFirstChunk = false;
					}
				}
				
				if (parseResult.isComplete) {
					break;
				}
			}

			// Final update with complete content
			const finalFormatted = formatCallback(accumulatedContent, workflowType, true);
			this.updateStreamingContent(contentElement, renderCallback(finalFormatted));
			
			// Complete progress with smooth animation to 100%
			if (progressCallback) {
				await this.progressSmoother.smoothFinish(progressCallback);
			}
			
			console.log('✅ Ultra-smooth streaming response completed successfully');

		} catch (error) {
			ErrorUtils.logError(error as Error, 'streaming response processing');
			const errorMessage = ErrorUtils.getErrorMessage(error);
			this.updateStreamingContent(contentElement, renderCallback(`❌ ${errorMessage}`));
		} finally {
			// Clean up
			this.progressSmoother.stop();
			StreamingErrorUtils.cancelStream(streamId);
		}
	}

	private estimateContentLength(workflowType: string, currentLength: number): number {
		// Dynamic content length estimation based on workflow type
		const baseLengths: Record<string, number> = {
			'requirements': 1500,
			'design': 2000,
			'tasks': 1800,
			'code': 3000,
			'chat': 800
		};
		
		const baseLength = baseLengths[workflowType] || 1500;
		
		// If we're already past the base estimate, increase it dynamically
		if (currentLength > baseLength * 0.8) {
			return Math.max(baseLength, currentLength * 1.2);
		}
		
		return baseLength;
	}

	private tryFormatIncremental(
		content: string, 
		workflowType: string,
		formatCallback: (content: any, workflowType: string) => string
	): string | null {
		try {
			let jsonText = content.trim();
			
			// Only attempt JSON parsing if the content actually looks like JSON
			if (!this.looksLikeJSON(jsonText)) {
				return null;
			}
			
			if (jsonText.length < 20) {
				return null;
			}
			
			// More sophisticated JSON completeness check
			if (!this.isCompleteJSON(jsonText)) {
				return null;
			}

			const parsed = JSON.parse(jsonText);
			return formatCallback(parsed, workflowType);
		} catch (e) {
			return null;
		}
	}

	private isCompleteJSON(text: string): boolean {
		const openBraces = (text.match(/\{/g) || []).length;
		const closeBraces = (text.match(/\}/g) || []).length;
		const openBrackets = (text.match(/\[/g) || []).length;
		const closeBrackets = (text.match(/\]/g) || []).length;
		
		// Check balanced brackets and braces
		if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
			return false;
		}
		
		// Check quotes are balanced (even number)
		const quotes = (text.match(/"/g) || []).length;
		if (quotes % 2 !== 0) {
			return false;
		}
		
		// Check for common JSON structure completeness
		const hasProperEnding = text.trim().endsWith('}') || text.trim().endsWith(']');
		
		return hasProperEnding;
	}

	private looksLikeJSON(text: string): boolean {
		const trimmed = text.trim();
		
		// Check if it starts and ends with JSON delimiters
		const startsWithJson = trimmed.startsWith('{') || trimmed.startsWith('[');
		const endsWithJson = trimmed.endsWith('}') || trimmed.endsWith(']');
		
		// Check if it contains JSON-like structure
		const hasJsonStructure = trimmed.includes('"') && (trimmed.includes(':') || trimmed.includes(','));
		
		// Check for specific workflow JSON patterns
		const hasWorkflowPattern = trimmed.includes('"functional"') || 
								  trimmed.includes('"nonFunctional"') ||
								  trimmed.includes('"constraints"') ||
								  trimmed.includes('"folderStructure"') ||
								  trimmed.includes('"tasks"') ||
								  trimmed.includes('"files"');
		
		return startsWithJson && endsWithJson && (hasJsonStructure || hasWorkflowPattern);
	}

	private updateStreamingContent(element: HTMLElement, content: HTMLElement): void {
		if (!element) {
			console.error('🌊 ERROR updateStreamingContent: element is null');
			return;
		}
		
		// Use requestAnimationFrame for smooth updates
		requestAnimationFrame(() => {
			// Clear existing content safely
			while (element.firstChild) {
				element.removeChild(element.firstChild);
			}
			
			// Append new content
			element.appendChild(content);
			
			// Ensure the element is visible
			element.style.display = 'block';
			
			// Smart scrolling - only auto-scroll if user is near bottom
			const messageList = element.closest('.chat-messages');
			if (messageList) {
				const scrollThreshold = 100; // pixels from bottom
				const isNearBottom = messageList.scrollTop + messageList.clientHeight >= 
									messageList.scrollHeight - scrollThreshold;
				
				if (isNearBottom) {
					// Use smooth scrolling
					messageList.scrollTo({
						top: messageList.scrollHeight,
						behavior: 'smooth'
					});
				}
			}
		});
	}
}

// Smooth progress interpolation class
class ProgressSmoother {
	private currentProgress: number = 0;
	private targetProgress: number = 0;
	private animationId: number | null = null;
	private isRunning: boolean = false;
	private smoothingFactor: number = 0.15; // Lower = smoother, higher = more responsive

	start(): void {
		this.isRunning = true;
		this.animate();
	}

	stop(): void {
		this.isRunning = false;
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}

	updateProgress(newTarget: number): number {
		this.targetProgress = Math.max(newTarget, this.targetProgress); // Never go backwards
		return this.currentProgress;
	}

	async smoothFinish(progressCallback: (progress: number) => void): Promise<void> {
		this.targetProgress = 100;
		
		return new Promise((resolve) => {
			const finishAnimation = () => {
				if (this.currentProgress < 99.9) {
					this.animate();
					requestAnimationFrame(finishAnimation);
				} else {
					this.currentProgress = 100;
					progressCallback(100);
					resolve();
				}
			};
			finishAnimation();
		});
	}

	private animate(): void {
		if (!this.isRunning) return;
		
		// Smooth interpolation using exponential easing
		const diff = this.targetProgress - this.currentProgress;
		if (Math.abs(diff) > 0.1) {
			this.currentProgress += diff * this.smoothingFactor;
		} else {
			this.currentProgress = this.targetProgress;
		}
		
		// Continue animation
		if (this.isRunning) {
			this.animationId = requestAnimationFrame(() => this.animate());
		}
	}
}