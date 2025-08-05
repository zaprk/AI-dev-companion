// Import new utilities
import { 
	StreamingErrorUtils, 
	ErrorUtils 
} from '../utils/index.js';

export class StreamingResponseParser {
	private buffer: string = '';
	private isComplete: boolean = false;

	parseChunk(chunk: string): { content: string; isComplete: boolean } {
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
		
		return { content, isComplete: this.isComplete };
	}

	reset(): void {
		this.buffer = '';
		this.isComplete = false;
	}
}

export class StreamingResponseService {
	private readonly UPDATE_THROTTLE = 50; // Update UI every 50ms

	async processStreamingResponse(
		response: Response, 
		contentElement: HTMLElement, 
		workflowType: string,
		formatCallback: (content: string, workflowType: string, isFinal?: boolean) => string,
		renderCallback: (content: string) => HTMLElement
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

			console.log('🌊 Starting enhanced streaming response processing...');

			while (reader) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const parseResult = parser.parseChunk(chunk);
				
				if (parseResult.content) {
					accumulatedContent += parseResult.content;
					
					// Only try to format if the content looks like it might be JSON
					const formatted = this.tryFormatIncremental(accumulatedContent, workflowType, formatCallback);
					const displayContent = formatted || formatCallback(accumulatedContent, workflowType);
					
					// Throttle UI updates for better performance
					const now = Date.now();
					if (now - lastUpdateTime > this.UPDATE_THROTTLE) {
						this.updateStreamingContent(contentElement, renderCallback(displayContent));
						lastUpdateTime = now;
					}
				}
				
				if (parseResult.isComplete) {
					break;
				}
			}

			// Final update with complete content
			const finalFormatted = formatCallback(accumulatedContent, workflowType, true);
			this.updateStreamingContent(contentElement, renderCallback(finalFormatted));
			
			console.log('✅ Streaming response completed successfully');

		} catch (error) {
			ErrorUtils.logError(error as Error, 'streaming response processing');
			const errorMessage = ErrorUtils.getErrorMessage(error);
			this.updateStreamingContent(contentElement, renderCallback(`❌ ${errorMessage}`));
		} finally {
			// Clean up stream
			StreamingErrorUtils.cancelStream(streamId);
		}
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
			
			if (jsonText.length < 10) {
				return null;
			}
			
			const openBraces = (jsonText.match(/\{/g) || []).length;
			const closeBraces = (jsonText.match(/\}/g) || []).length;
			const openBrackets = (jsonText.match(/\[/g) || []).length;
			const closeBrackets = (jsonText.match(/\]/g) || []).length;
			
			if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
				console.log(`🌊 Incomplete JSON - braces: ${openBraces}/${closeBraces}, brackets: ${openBrackets}/${closeBrackets}`);
				return null;
			}
			
			const quotes = (jsonText.match(/"/g) || []).length;
			if (quotes % 2 !== 0) {
				console.log(`🌊 Incomplete JSON - odd number of quotes: ${quotes}`);
				return null;
			}

			console.log(`🌊 Attempting to parse complete JSON (${jsonText.length} chars)`);
			const parsed = JSON.parse(jsonText);
			console.log(`🌊 Successfully parsed JSON, formatting...`);
			return formatCallback(parsed, workflowType);
		} catch (e) {
			console.log(`🌊 JSON parsing failed:`, e.message);
			return null;
		}
	}

	private looksLikeJSON(text: string): boolean {
		const trimmed = text.trim();
		
		// Check if it starts and ends with JSON delimiters
		const startsWithJson = trimmed.startsWith('{') || trimmed.startsWith('[');
		const endsWithJson = trimmed.endsWith('}') || trimmed.endsWith(']');
		
		// Check if it contains JSON-like structure
		const hasJsonStructure = trimmed.includes('"') && (trimmed.includes(':') || trimmed.includes(','));
		
		// Check if it has JSON structure but ignore emojis and markdown in the content
		// Look for JSON structure within the content, not just at the surface level
		const hasJsonContent = trimmed.includes('"functional"') || 
							  trimmed.includes('"nonFunctional"') ||
							  trimmed.includes('"constraints"') ||
							  trimmed.includes('"assumptions"') ||
							  (trimmed.includes('"') && trimmed.includes(':') && trimmed.includes(','));
		
		// Only reject if it's clearly not JSON (no JSON structure at all)
		const isPlainText = !hasJsonContent && !hasJsonStructure;
		
		return startsWithJson && endsWithJson && hasJsonStructure && !isPlainText;
	}

	private updateStreamingContent(element: HTMLElement, content: HTMLElement): void {
		if (element) {
			element.style.opacity = '0.9';
			element.style.transform = 'translateY(1px)';
			
			// Clear existing content safely
			while (element.firstChild) {
				element.removeChild(element.firstChild);
			}
			element.appendChild(content); // Append new content
			element.style.opacity = '1';
			element.style.transform = 'translateY(0)';
			element.style.transition = 'all 0.2s ease-out';
			
			setTimeout(() => {
				element.style.transition = '';
			}, 200);
		}
	}
}