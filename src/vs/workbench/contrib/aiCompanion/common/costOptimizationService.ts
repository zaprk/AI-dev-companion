/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export const ICostOptimizationService = createDecorator<ICostOptimizationService>('costOptimizationService');

export interface ICostOptimizationService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Optimize prompt for minimal token usage while maintaining quality
	 */
	optimizePrompt(prompt: string, targetLength: number): string;
	
	/**
	 * Build efficient prompt for specific task
	 */
	buildEfficientPrompt(task: PromptTask, context: any): IOptimizedPrompt;
	
	/**
	 * Estimate token cost for a request
	 */
	estimateTokenCost(prompt: string, maxTokens: number): ICostEstimate;
	
	/**
	 * Cache response for reuse
	 */
	cacheResponse(promptHash: string, response: string): void;
	
	/**
	 * Get cached response if available
	 */
	getCachedResponse(promptHash: string): string | undefined;
	
	/**
	 * Generate hash for prompt deduplication
	 */
	generatePromptHash(prompt: string, context?: any): string;
}

export type PromptTask = 'requirements' | 'design' | 'tasks' | 'code' | 'chat';

export interface IOptimizedPrompt {
	prompt: string;
	maxTokens: number;
	temperature: number;
	estimatedCost: number;
	cacheKey: string;
}

export interface ICostEstimate {
	inputTokens: number;
	maxOutputTokens: number;
	estimatedCost: number; // in USD
	costLevel: 'low' | 'medium' | 'high';
}

export class CostOptimizationService implements ICostOptimizationService {
	readonly _serviceBrand: undefined;
	
	private responseCache = new Map<string, { response: string; timestamp: number }>();
	
	// Token cost estimates (approximate, based on GPT-4 pricing)
	private static readonly TOKEN_COSTS = {
		input: 0.00003,  // $0.03 per 1K tokens
		output: 0.00006, // $0.06 per 1K tokens
	};
	
	private static readonly CACHE_DURATION = 1000 * 60 * 30; // 30 minutes
	
	// Optimized prompt templates for cost efficiency
	private static readonly EFFICIENT_PROMPTS = {
		requirements: {
			template: `Generate software requirements JSON for: {input}
Output: {"functional":["req1","req2"],"nonFunctional":["req1"],"constraints":["con1"]}
Max 8 functional, 4 non-functional, 3 constraints. Concise phrases only.`,
			maxTokens: 400,
			temperature: 0.2
		},
		
		design: {
			template: `Design for requirements: {requirements}
Output JSON: {"folderStructure":{"src":{"components":[]}},"techStack":["tech1"],"architecture":"pattern"}
Essential structure only. Max 15 folders, 8 tech items.`,
			maxTokens: 600,
			temperature: 0.1
		},
		
		tasks: {
			template: `Tasks for design: {design}
Output: {"tasks":[{"title":"","description":"","filePath":"","estimatedTime":""}]}
Max 8 tasks. 1 sentence descriptions. Essential tasks only.`,
			maxTokens: 500,
			temperature: 0.1
		},
		
		code: {
			template: `Generate code for: {task}
Project conventions: {conventions}
Output: {"files":[{"path":"","content":"","description":""}]}
Essential code only. Max 200 lines per file. Production ready.`,
			maxTokens: 1500,
			temperature: 0.05
		},
		
		chat: {
			template: `Q: {question}
Context: {context}
A: Concise answer. Code examples if needed. Max 3 sentences.`,
			maxTokens: 200,
			temperature: 0.3
		}
	};
	
	constructor(
		@ILogService private readonly logService: ILogService
	) {
		// Clean cache every hour
		setInterval(() => this.cleanCache(), 1000 * 60 * 60);
	}
	
	optimizePrompt(prompt: string, targetLength: number): string {
		if (prompt.length <= targetLength) {
			return prompt;
		}
		
		// Remove redundant words
		let optimized = prompt
			.replace(/\b(please|kindly|could you)\b/gi, '')
			.replace(/\b(very|really|quite|pretty)\b/gi, '')
			.replace(/\b(that is|which is|it is)\b/gi, '')
			.replace(/\s+/g, ' ')
			.trim();
		
		// Abbreviate common phrases
		optimized = optimized
			.replace(/for example/gi, 'e.g.')
			.replace(/such as/gi, 'e.g.')
			.replace(/and so on/gi, 'etc.')
			.replace(/TypeScript/gi, 'TS')
			.replace(/JavaScript/gi, 'JS')
			.replace(/React component/gi, 'React comp')
			.replace(/function/gi, 'fn')
			.replace(/interface/gi, 'type');
		
		// If still too long, truncate intelligently
		if (optimized.length > targetLength) {
			const sentences = optimized.split(/[.!?]+/);
			optimized = '';
			for (const sentence of sentences) {
				if ((optimized + sentence).length <= targetLength - 3) {
					optimized += sentence + '. ';
				} else {
					break;
				}
			}
			optimized = optimized.trim();
		}
		
		this.logService.info(`📝 Optimized prompt: ${prompt.length} → ${optimized.length} chars`);
		return optimized;
	}
	
	buildEfficientPrompt(task: PromptTask, context: any): IOptimizedPrompt {
		const template = CostOptimizationService.EFFICIENT_PROMPTS[task];
		
		// Build minimal prompt
		let prompt = template.template;
		
		// Inject context efficiently
		switch (task) {
			case 'requirements':
				prompt = prompt.replace('{input}', this.optimizePrompt(context.input, 200));
				break;
				
			case 'design':
				const reqSummary = this.summarizeRequirements(context.requirements);
				prompt = prompt.replace('{requirements}', reqSummary);
				break;
				
			case 'tasks':
				const designSummary = this.summarizeDesign(context.design);
				prompt = prompt.replace('{design}', designSummary);
				break;
				
			case 'code':
				prompt = prompt.replace('{task}', context.task.title + ': ' + context.task.description);
				prompt = prompt.replace('{conventions}', this.summarizeConventions(context.conventions));
				break;
				
			case 'chat':
				prompt = prompt.replace('{question}', this.optimizePrompt(context.question, 150));
				prompt = prompt.replace('{context}', this.summarizeContext(context.projectContext));
				break;
		}
		
		const cacheKey = this.generatePromptHash(prompt, context);
		const estimatedCost = this.estimateTokenCost(prompt, template.maxTokens).estimatedCost;
		
		return {
			prompt,
			maxTokens: template.maxTokens,
			temperature: template.temperature,
			estimatedCost,
			cacheKey
		};
	}
	
	estimateTokenCost(prompt: string, maxTokens: number): ICostEstimate {
		// Rough token estimation: ~4 chars per token for English
		const inputTokens = Math.ceil(prompt.length / 4);
		
		const inputCost = inputTokens * CostOptimizationService.TOKEN_COSTS.input;
		const outputCost = maxTokens * CostOptimizationService.TOKEN_COSTS.output;
		const totalCost = inputCost + outputCost;
		
		let costLevel: 'low' | 'medium' | 'high' = 'low';
		if (totalCost > 0.10) costLevel = 'high';
		else if (totalCost > 0.05) costLevel = 'medium';
		
		return {
			inputTokens,
			maxOutputTokens: maxTokens,
			estimatedCost: totalCost,
			costLevel
		};
	}
	
	cacheResponse(promptHash: string, response: string): void {
		this.responseCache.set(promptHash, {
			response,
			timestamp: Date.now()
		});
		
		this.logService.info(`💾 Cached response for prompt hash: ${promptHash.substring(0, 8)}`);
	}
	
	getCachedResponse(promptHash: string): string | undefined {
		const cached = this.responseCache.get(promptHash);
		
		if (cached && (Date.now() - cached.timestamp) < CostOptimizationService.CACHE_DURATION) {
			this.logService.info(`⚡ Using cached response for: ${promptHash.substring(0, 8)}`);
			return cached.response;
		}
		
		if (cached) {
			this.responseCache.delete(promptHash); // Remove expired
		}
		
		return undefined;
	}
	
	generatePromptHash(prompt: string, context?: any): string {
		// Simple hash for caching
		const combined = prompt + JSON.stringify(context || {});
		let hash = 0;
		for (let i = 0; i < combined.length; i++) {
			const char = combined.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}
	
	private summarizeRequirements(requirements: any): string {
		if (!requirements) return '';
		
		const functional = requirements.functional?.slice(0, 5).join(', ') || '';
		const nonFunctional = requirements.nonFunctional?.slice(0, 2).join(', ') || '';
		
		return `Functional: ${functional}. NonFunc: ${nonFunctional}`.substring(0, 200);
	}
	
	private summarizeDesign(design: any): string {
		if (!design) return '';
		
		const components = design.components?.slice(0, 5).join(', ') || '';
		const tech = design.techStack?.slice(0, 3).join(', ') || '';
		
		return `Components: ${components}. Tech: ${tech}`.substring(0, 200);
	}
	
	private summarizeConventions(conventions: any): string {
		if (!conventions) return 'Standard conventions';
		
		return `${conventions.indentation || 'spaces'}, ${conventions.quotes || 'single'}, ${conventions.fileNaming || 'camelCase'}`;
	}
	
	private summarizeContext(context: any): string {
		if (!context) return '';
		
		const type = context.project?.type || '';
		const framework = context.project?.framework?.frontend || '';
		
		return `${type} ${framework}`.trim().substring(0, 50);
	}
	
	private cleanCache(): void {
		const now = Date.now();
		let cleaned = 0;
		
		for (const [key, value] of this.responseCache.entries()) {
			if (now - value.timestamp > CostOptimizationService.CACHE_DURATION) {
				this.responseCache.delete(key);
				cleaned++;
			}
		}
		
		if (cleaned > 0) {
			this.logService.info(`🧹 Cleaned ${cleaned} expired cache entries`);
		}
	}
}

/**
 * How Cursor maintains low costs:
 * 1. Smart caching - identical requests use cached responses
 * 2. Context truncation - only relevant code context included
 * 3. Incremental suggestions - small, focused prompts
 * 4. Local preprocessing - analyze code locally before AI
 * 5. Prompt engineering - optimized templates for specific tasks
 * 6. Response streaming - stop generation when enough context
 * 7. Model selection - use cheaper models for simple tasks
 */
export const CURSOR_COST_STRATEGIES = {
	SMART_CACHING: 'Cache responses for 30min+ to avoid duplicate requests',
	CONTEXT_TRUNCATION: 'Only include relevant code context, not entire files',
	INCREMENTAL_SUGGESTIONS: 'Generate small focused changes vs full rewrites',
	LOCAL_PREPROCESSING: 'Parse AST and analyze locally before AI requests',
	PROMPT_ENGINEERING: 'Use optimized templates that generate precise outputs',
	RESPONSE_STREAMING: 'Stop generation early when sufficient context received',
	MODEL_SELECTION: 'Use GPT-3.5 for simple tasks, GPT-4 only when needed',
	BATCH_PROCESSING: 'Combine multiple small requests into single call',
	COMPRESSION: 'Use abbreviations and compact formats for context',
	DEDUPLICATION: 'Hash prompts to detect and skip duplicate requests'
} as const;
