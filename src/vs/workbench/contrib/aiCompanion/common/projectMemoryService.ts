/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export const IProjectMemoryService = createDecorator<IProjectMemoryService>('projectMemoryService');

export interface IProjectMemoryService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Load project memory from .ai.memory file
	 */
	loadMemory(): Promise<IProjectMemory | undefined>;
	
	/**
	 * Save project memory to .ai.memory file
	 */
	saveMemory(memory: IProjectMemory): Promise<void>;
	
	/**
	 * Update specific aspects of project memory
	 */
	updateMemory(updates: Partial<IProjectMemory>): Promise<void>;
	
	/**
	 * Clear all project memory
	 */
	clearMemory(): Promise<void>;
	
	/**
	 * Get memory file URI
	 */
	getMemoryFileUri(): URI | undefined;
}

export interface IProjectMemory {
	version: string;
	lastUpdated: string;
	lastAnalyzed: string;
	project: {
		name: string;
		type: string;
		framework: {
			frontend?: string;
			backend?: string;
			database?: string;
			testing?: string;
			bundler?: string;
		};
		languages: string[];
		packageManager?: 'npm' | 'yarn' | 'pnpm';
	};
	architecture: {
		pattern: string;
		folderStructure: Record<string, any>;
		layering: string[];
		designPatterns: string[];
	};
	conventions: {
		fileNaming: 'camelCase' | 'PascalCase' | 'kebab-case' | 'snake_case';
		componentNaming: 'camelCase' | 'PascalCase';
		functionNaming: 'camelCase' | 'PascalCase';
		variableNaming: 'camelCase' | 'snake_case';
		indentation: '2-spaces' | '4-spaces' | 'tabs';
		quotes: 'single' | 'double';
		semicolons: boolean;
		trailingCommas: boolean;
	};
	patterns: {
		componentStructure: string;
		stateManagement: string;
		styling: string;
		apiPattern: string;
		errorHandling: string;
		testingApproach: string;
	};
	dependencies: {
		commonImports: string[];
		frequentlyUsed: string[];
		coreLibraries: string[];
		devDependencies: string[];
	};
	codebase: {
		totalFiles: number;
		fileTypes: Record<string, number>;
		linesOfCode: number;
		complexity: 'low' | 'medium' | 'high';
		maintainability: 'low' | 'medium' | 'high';
	};
	intelligence: {
		generatedFiles: number;
		userCorrections: number;
		preferredPatterns: string[];
		learningConfidence: number; // 0-1 scale
		successfulGenerations: number;
		failedGenerations: number;
	};
	fileRelationships: {
		[filePath: string]: {
			imports: string[];
			exports: string[];
			dependencies: string[];
			dependents: string[];
		};
	};
}

export class ProjectMemoryService implements IProjectMemoryService {
	readonly _serviceBrand: undefined;
	
	private static readonly MEMORY_FILE_NAME = '.ai.memory';
	private memoryCache: IProjectMemory | undefined;
	
	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService
	) {}
	
	async loadMemory(): Promise<IProjectMemory | undefined> {
		try {
			const memoryUri = this.getMemoryFileUri();
			if (!memoryUri) {
				this.logService.info('📄 No workspace found for memory file');
				return undefined;
			}
			
			const exists = await this.fileService.exists(memoryUri);
			if (!exists) {
				this.logService.info('📄 No existing .ai.memory file found');
				return undefined;
			}
			
			const content = await this.fileService.readFile(memoryUri);
			const memoryData = JSON.parse(content.value.toString()) as IProjectMemory;
			
			this.memoryCache = memoryData;
			this.logService.info(`📄 Loaded project memory (version ${memoryData.version}, ${memoryData.codebase.totalFiles} files analyzed)`);
			
			return memoryData;
			
		} catch (error) {
			this.logService.error('❌ Failed to load project memory:', error);
			return undefined;
		}
	}
	
	async saveMemory(memory: IProjectMemory): Promise<void> {
		try {
			const memoryUri = this.getMemoryFileUri();
			if (!memoryUri) {
				throw new Error('No workspace found for saving memory');
			}
			
			// Update metadata
			memory.lastUpdated = new Date().toISOString();
			memory.version = '1.0';
			
			const memoryJson = JSON.stringify(memory, null, 2);
			const buffer = VSBuffer.fromString(memoryJson);
			
			await this.fileService.writeFile(memoryUri, buffer);
			this.memoryCache = memory;
			
			this.logService.info(`💾 Saved project memory (${memory.codebase.totalFiles} files, confidence: ${memory.intelligence.learningConfidence})`);
			
		} catch (error) {
			this.logService.error('❌ Failed to save project memory:', error);
			throw error;
		}
	}
	
	async updateMemory(updates: Partial<IProjectMemory>): Promise<void> {
		try {
			let currentMemory = this.memoryCache || await this.loadMemory();
			
			if (!currentMemory) {
				// Create new memory if none exists
				currentMemory = this.createDefaultMemory();
			}
			
			// Deep merge updates
			const updatedMemory = this.deepMerge(currentMemory, updates);
			await this.saveMemory(updatedMemory);
			
		} catch (error) {
			this.logService.error('❌ Failed to update project memory:', error);
			throw error;
		}
	}
	
	async clearMemory(): Promise<void> {
		try {
			const memoryUri = this.getMemoryFileUri();
			if (!memoryUri) {
				return;
			}
			
			const exists = await this.fileService.exists(memoryUri);
			if (exists) {
				await this.fileService.del(memoryUri);
				this.logService.info('🗑️ Cleared project memory');
			}
			
			this.memoryCache = undefined;
			
		} catch (error) {
			this.logService.error('❌ Failed to clear project memory:', error);
			throw error;
		}
	}
	
	getMemoryFileUri(): URI | undefined {
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			return undefined;
		}
		
		// Use first workspace folder for memory file
		const workspaceRoot = workspace.folders[0].uri;
		return URI.joinPath(workspaceRoot, ProjectMemoryService.MEMORY_FILE_NAME);
	}
	
	private createDefaultMemory(): IProjectMemory {
		return {
			version: '1.0',
			lastUpdated: new Date().toISOString(),
			lastAnalyzed: new Date().toISOString(),
			project: {
				name: 'Unknown Project',
				type: 'unknown',
				framework: {},
				languages: [],
			},
			architecture: {
				pattern: 'unknown',
				folderStructure: {},
				layering: [],
				designPatterns: [],
			},
			conventions: {
				fileNaming: 'kebab-case',
				componentNaming: 'PascalCase',
				functionNaming: 'camelCase',
				variableNaming: 'camelCase',
				indentation: '2-spaces',
				quotes: 'single',
				semicolons: true,
				trailingCommas: true,
			},
			patterns: {
				componentStructure: 'unknown',
				stateManagement: 'unknown',
				styling: 'unknown',
				apiPattern: 'unknown',
				errorHandling: 'unknown',
				testingApproach: 'unknown',
			},
			dependencies: {
				commonImports: [],
				frequentlyUsed: [],
				coreLibraries: [],
				devDependencies: [],
			},
			codebase: {
				totalFiles: 0,
				fileTypes: {},
				linesOfCode: 0,
				complexity: 'low',
				maintainability: 'medium',
			},
			intelligence: {
				generatedFiles: 0,
				userCorrections: 0,
				preferredPatterns: [],
				learningConfidence: 0.0,
				successfulGenerations: 0,
				failedGenerations: 0,
			},
			fileRelationships: {},
		};
	}
	
	private deepMerge(target: any, source: any): any {
		const result = { ...target };
		
		for (const key in source) {
			if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(target[key] || {}, source[key]);
			} else {
				result[key] = source[key];
			}
		}
		
		return result;
	}
}
