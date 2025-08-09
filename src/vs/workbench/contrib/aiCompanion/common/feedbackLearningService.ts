/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProjectMemoryService, IProjectMemory } from './projectMemoryService.js';

export const IFeedbackLearningService = createDecorator<IFeedbackLearningService>('feedbackLearningService');

export interface IFeedbackLearningService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Record that user accepted generated content
	 */
	recordAcceptance(contentType: 'code' | 'requirements' | 'design' | 'tasks', context: IFeedbackContext): Promise<void>;
	
	/**
	 * Record that user rejected/modified generated content
	 */
	recordRejection(contentType: 'code' | 'requirements' | 'design' | 'tasks', context: IFeedbackContext, userModification?: string): Promise<void>;
	
	/**
	 * Record user corrections to learn patterns
	 */
	recordCorrection(originalCode: string, correctedCode: string, fileType: string): Promise<void>;
	
	/**
	 * Get learning insights for debugging
	 */
	getLearningInsights(): Promise<ILearningInsights>;
	
	/**
	 * Update confidence scores based on success rate
	 */
	updateLearningConfidence(): Promise<void>;
}

export interface IFeedbackContext {
	fileName?: string;
	fileType?: string;
	framework?: string;
	generatedContent: string;
	userPrompt?: string;
	timestamp: string;
}

export interface ILearningInsights {
	totalGenerations: number;
	acceptanceRate: number;
	rejectionRate: number;
	commonCorrections: Array<{
		pattern: string;
		frequency: number;
		suggestion: string;
	}>;
	preferredPatterns: string[];
	confidence: number;
}

export class FeedbackLearningService implements IFeedbackLearningService {
	readonly _serviceBrand: undefined;
	
	constructor(
		@IProjectMemoryService private readonly projectMemoryService: IProjectMemoryService,
		@ILogService private readonly logService: ILogService
	) {}
	
	async recordAcceptance(contentType: 'code' | 'requirements' | 'design' | 'tasks', context: IFeedbackContext): Promise<void> {
		this.logService.info(`✅ User accepted ${contentType}: ${context.fileName || 'content'}`);
		
		const memory = await this.projectMemoryService.loadMemory();
		if (!memory) {
			return;
		}
		
		// Update success metrics
		memory.intelligence.successfulGenerations++;
		
		// Extract and learn from accepted patterns
		await this.learnFromAcceptance(memory, contentType, context);
		
		// Update confidence
		memory.intelligence.learningConfidence = this.calculateNewConfidence(memory);
		
		await this.projectMemoryService.saveMemory(memory);
	}
	
	async recordRejection(contentType: 'code' | 'requirements' | 'design' | 'tasks', context: IFeedbackContext, userModification?: string): Promise<void> {
		this.logService.info(`❌ User rejected ${contentType}: ${context.fileName || 'content'}`);
		
		const memory = await this.projectMemoryService.loadMemory();
		if (!memory) {
			return;
		}
		
		// Update failure metrics
		memory.intelligence.failedGenerations++;
		
		// Learn from rejection patterns
		if (userModification) {
			await this.learnFromRejection(memory, context, userModification);
		}
		
		// Update confidence (decrease)
		memory.intelligence.learningConfidence = this.calculateNewConfidence(memory);
		
		await this.projectMemoryService.saveMemory(memory);
	}
	
	async recordCorrection(originalCode: string, correctedCode: string, fileType: string): Promise<void> {
		this.logService.info(`🔧 User corrected ${fileType} code`);
		
		const memory = await this.projectMemoryService.loadMemory();
		if (!memory) {
			return;
		}
		
		memory.intelligence.userCorrections++;
		
		// Analyze the correction to learn patterns
		const correction = this.analyzeCorrection(originalCode, correctedCode, fileType);
		if (correction) {
			// Store the learned pattern
			await this.storeLearnedPattern(memory, correction);
		}
		
		await this.projectMemoryService.saveMemory(memory);
	}
	
	async getLearningInsights(): Promise<ILearningInsights> {
		const memory = await this.projectMemoryService.loadMemory();
		if (!memory) {
			return {
				totalGenerations: 0,
				acceptanceRate: 0,
				rejectionRate: 0,
				commonCorrections: [],
				preferredPatterns: [],
				confidence: 0
			};
		}
		
		const total = memory.intelligence.successfulGenerations + memory.intelligence.failedGenerations;
		
		return {
			totalGenerations: total,
			acceptanceRate: total > 0 ? memory.intelligence.successfulGenerations / total : 0,
			rejectionRate: total > 0 ? memory.intelligence.failedGenerations / total : 0,
			commonCorrections: [], // Would be populated from stored corrections
			preferredPatterns: memory.intelligence.preferredPatterns,
			confidence: memory.intelligence.learningConfidence
		};
	}
	
	async updateLearningConfidence(): Promise<void> {
		const memory = await this.projectMemoryService.loadMemory();
		if (!memory) {
			return;
		}
		
		memory.intelligence.learningConfidence = this.calculateNewConfidence(memory);
		await this.projectMemoryService.saveMemory(memory);
	}
	
	private async learnFromAcceptance(memory: IProjectMemory, contentType: string, context: IFeedbackContext): Promise<void> {
		// Extract successful patterns from accepted content
		if (contentType === 'code' && context.fileType) {
			// Learn from successful code patterns
			const patterns = this.extractCodePatterns(context.generatedContent, context.fileType);
			for (const pattern of patterns) {
				if (!memory.intelligence.preferredPatterns.includes(pattern)) {
					memory.intelligence.preferredPatterns.push(pattern);
				}
			}
		}
		
		// Update framework confidence if framework was detected correctly
		if (context.framework && memory.project.framework) {
			// Framework detection was successful
		}
	}
	
	private async learnFromRejection(memory: IProjectMemory, context: IFeedbackContext, userModification: string): Promise<void> {
		// Compare original vs user modification to learn what went wrong
		// const differences = this.findDifferences(context.generatedContent, userModification);
		
		// // Learn from what user changed
		// for (const diff of differences) {
		// 	// Store patterns to avoid in the future
		// 	// This would be more sophisticated in a real implementation
		// }
	}
	
	private calculateNewConfidence(memory: IProjectMemory): number {
		const total = memory.intelligence.successfulGenerations + memory.intelligence.failedGenerations;
		if (total === 0) {
			return memory.intelligence.learningConfidence;
		}
		
		// Base confidence on success rate, but with learning curve
		const successRate = memory.intelligence.successfulGenerations / total;
		
		// Factor in number of files analyzed and user corrections
		const dataQuality = Math.min(memory.codebase.totalFiles / 100, 1.0); // More files = better analysis
		const correctionPenalty = Math.max(0.1, 1.0 - (memory.intelligence.userCorrections * 0.05)); // More corrections = lower confidence
		
		const newConfidence = successRate * dataQuality * correctionPenalty;
		
		// Ensure confidence is between 0 and 1
		return Math.max(0.1, Math.min(1.0, newConfidence));
	}
	
	private extractCodePatterns(code: string, fileType: string): string[] {
		const patterns: string[] = [];
		
		// Extract basic patterns
		if (code.includes('useState')) patterns.push('react-hooks');
		if (code.includes('interface ')) patterns.push('typescript-interfaces');
		if (code.includes('const ') && code.includes('=>')) patterns.push('arrow-functions');
		if (code.includes('async ') && code.includes('await ')) patterns.push('async-await');
		if (code.includes('try {') && code.includes('catch ')) patterns.push('error-handling');
		
		// File type specific patterns
		if (fileType === 'component') {
			if (code.includes('export default')) patterns.push('default-exports');
			if (code.includes('Props')) patterns.push('typed-props');
		}
		
		return patterns;
	}
	
	// private findDifferences(original: string, modified: string): Array<{ type: string; original: string; modified: string }> {
	// 	// Simplified difference detection
	// 	const differences: Array<{ type: string; original: string; modified: string }> = [];
		
	// 	// This would use a proper diff algorithm in practice
	// 	if (original !== modified) {
	// 		differences.push({
	// 			type: 'content-change',
	// 			original: original.substring(0, 100), // First 100 chars
	// 			modified: modified.substring(0, 100)
	// 		});
	// 	}
		
	// 	return differences;
	// }
	
	private analyzeCorrection(originalCode: string, correctedCode: string, fileType: string): { pattern: string; correction: string } | null {
		// Analyze what the user changed to learn correction patterns
		
		// Check for common corrections
		if (originalCode.includes('var ') && correctedCode.includes('const ')) {
			return { pattern: 'prefer-const-over-var', correction: 'Use const instead of var' };
		}
		
		if (originalCode.includes('function ') && correctedCode.includes('=>')) {
			return { pattern: 'prefer-arrow-functions', correction: 'Use arrow functions instead of function declarations' };
		}
		
		if (originalCode.includes('== ') && correctedCode.includes('=== ')) {
			return { pattern: 'prefer-strict-equality', correction: 'Use === instead of ==' };
		}
		
		// More sophisticated pattern analysis would go here
		return null;
	}
	
	private async storeLearnedPattern(memory: IProjectMemory, correction: { pattern: string; correction: string }): Promise<void> {
		// Store learned patterns for future reference
		// In a real implementation, this would update the memory with learned preferences
		
		if (!memory.intelligence.preferredPatterns.includes(correction.pattern)) {
			memory.intelligence.preferredPatterns.push(correction.pattern);
		}
	}
}
