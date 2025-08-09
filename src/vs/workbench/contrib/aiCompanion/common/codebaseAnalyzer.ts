/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProjectMemory } from './projectMemoryService.js';
import { URI } from '../../../../base/common/uri.js';
// Remove unused import

export const ICodebaseAnalyzer = createDecorator<ICodebaseAnalyzer>('codebaseAnalyzer');

export interface ICodebaseAnalyzer {
	readonly _serviceBrand: undefined;
	
	/**
	 * Analyze the entire codebase and generate project memory
	 */
	analyzeCodebase(): Promise<IProjectMemory>;
	
	/**
	 * Analyze specific files for incremental updates
	 */
	analyzeFiles(filePaths: string[]): Promise<Partial<IProjectMemory>>;
	
	/**
	 * Detect project type and framework
	 */
	detectProjectFramework(): Promise<{
		frontend?: string;
		backend?: string;
		database?: string;
		testing?: string;
		bundler?: string;
	}>;
	
	/**
	 * Extract coding conventions from existing files
	 */
	extractCodingConventions(filePaths: string[]): Promise<{
		indentation: string;
		quotes: string;
		semicolons: boolean;
		fileNaming: string;
		componentNaming: string;
	}>;
}

export class CodebaseAnalyzer implements ICodebaseAnalyzer {
	readonly _serviceBrand: undefined;
	
	private static readonly SUPPORTED_EXTENSIONS = [
		'.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
		'.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs',
		'.json', '.yaml', '.yml', '.toml', '.md',
		'.css', '.scss', '.less', '.html'
	];
	
	private static readonly IGNORE_PATTERNS = [
		'node_modules', '.git', 'dist', 'build', '.next',
		'coverage', '.nyc_output', 'temp', 'tmp', '.cache',
		'vscode/out', 'vscode/node_modules'  // Only ignore VS Code specific build outputs
	];
	
	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService
	) {
		// Note: projectMemoryService is available for future incremental analysis features
	}
	
	async analyzeCodebase(): Promise<IProjectMemory> {
		this.logService.info('🔍 Starting codebase analysis...');
		
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			throw new Error('No workspace found for analysis');
		}
		
		const workspaceRoot = workspace.folders[0].uri;
		
		try {
			// Scan all files
			this.logService.info(`🔍 Scanning workspace: ${workspaceRoot.path}`);
			const allFiles = await this.scanDirectory(workspaceRoot);
			this.logService.info(`📁 Found ${allFiles.length} total files`);
			
			// Debug: log first few files found
			if (allFiles.length > 0) {
				this.logService.info(`📂 Sample files: ${allFiles.slice(0, 5).map(f => f.path).join(', ')}`);
			}
			
			// Filter supported files
			const codeFiles = allFiles.filter(file => 
				this.isSupportedFile(file) && !this.isIgnoredFile(file)
			);
			
			this.logService.info(`📄 Code files after filtering: ${codeFiles.length}`);
			
			// Debug: log filtering results
			if (codeFiles.length === 0 && allFiles.length > 0) {
				const supportedCount = allFiles.filter(f => this.isSupportedFile(f)).length;
				const ignoredCount = allFiles.filter(f => this.isIgnoredFile(f)).length;
				this.logService.warn(`⚠️ No code files found: ${supportedCount} supported, ${ignoredCount} ignored of ${allFiles.length} total`);
			}
			
			// Analyze different aspects
			const [
				projectInfo,
				framework,
				conventions,
				patterns,
				dependencies,
				fileStats,
				relationships
			] = await Promise.all([
				this.analyzeProjectInfo(workspaceRoot),
				this.detectProjectFramework(),
				this.extractCodingConventions(codeFiles.map(f => f.path)),
				this.extractCodePatterns(codeFiles),
				this.extractDependencies(workspaceRoot),
				this.analyzeFileStatistics(codeFiles),
				this.analyzeFileRelationships(codeFiles)
			]);
			
			// Calculate learning confidence
			const confidence = this.calculateLearningConfidence(codeFiles.length, framework);
			
			const memory: IProjectMemory = {
				version: '1.0',
				lastUpdated: new Date().toISOString(),
				lastAnalyzed: new Date().toISOString(),
				project: {
					name: projectInfo.name,
					type: projectInfo.type,
					framework,
					languages: this.detectLanguages(codeFiles),
					packageManager: projectInfo.packageManager,
				},
				architecture: {
					pattern: patterns.architecturePattern,
					folderStructure: await this.analyzeFolderStructure(workspaceRoot),
					layering: patterns.layering,
					designPatterns: patterns.designPatterns,
				},
				conventions,
				patterns: {
					componentStructure: patterns.componentStructure,
					stateManagement: patterns.stateManagement,
					styling: patterns.styling,
					apiPattern: patterns.apiPattern,
					errorHandling: patterns.errorHandling,
					testingApproach: patterns.testingApproach,
				},
				dependencies,
				codebase: fileStats,
				intelligence: {
					generatedFiles: 0,
					userCorrections: 0,
					preferredPatterns: patterns.preferred,
					learningConfidence: confidence,
					successfulGenerations: 0,
					failedGenerations: 0,
				},
				fileRelationships: relationships,
			};
			
			this.logService.info(`✅ Codebase analysis complete (confidence: ${Math.round(confidence * 100)}%)`);
			return memory;
			
		} catch (error) {
			this.logService.error('❌ Codebase analysis failed:', error);
			throw error;
		}
	}
	
	async analyzeFiles(filePaths: string[]): Promise<Partial<IProjectMemory>> {
		// Incremental analysis for specific files
		const conventions = await this.extractCodingConventions(filePaths);
		const codeFiles = filePaths.map(path => ({ path, uri: URI.file(path) }));
		const patterns = await this.extractCodePatterns(codeFiles);
		
		return {
			conventions,
			patterns: {
				componentStructure: patterns.componentStructure,
				stateManagement: patterns.stateManagement,
				styling: patterns.styling,
				apiPattern: patterns.apiPattern,
				errorHandling: patterns.errorHandling,
				testingApproach: patterns.testingApproach,
			},
			lastAnalyzed: new Date().toISOString(),
		};
	}
	
	async detectProjectFramework() {
		const workspace = this.workspaceService.getWorkspace();
		if (!workspace.folders.length) {
			return {};
		}
		
		const workspaceRoot = workspace.folders[0].uri;
		const framework: any = {};
		
		try {
			// Check package.json for dependencies
			const packageJsonUri = URI.joinPath(workspaceRoot, 'package.json');
			const packageJsonExists = await this.fileService.exists(packageJsonUri);
			
			if (packageJsonExists) {
				const content = await this.fileService.readFile(packageJsonUri);
				const packageJson = JSON.parse(content.value.toString());
				const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
				
				// Frontend frameworks
				if (deps.react) framework.frontend = `React ${deps.react}`;
				else if (deps.vue) framework.frontend = `Vue ${deps.vue}`;
				else if (deps.angular || deps['@angular/core']) framework.frontend = `Angular ${deps['@angular/core'] || deps.angular}`;
				else if (deps.svelte) framework.frontend = `Svelte ${deps.svelte}`;
				else if (deps.next) framework.frontend = `Next.js ${deps.next}`;
				else if (deps.nuxt) framework.frontend = `Nuxt.js ${deps.nuxt}`;
				
				// Backend frameworks
				if (deps.express) framework.backend = `Express ${deps.express}`;
				else if (deps.fastify) framework.backend = `Fastify ${deps.fastify}`;
				else if (deps.koa) framework.backend = `Koa ${deps.koa}`;
				else if (deps.nestjs || deps['@nestjs/core']) framework.backend = `NestJS ${deps['@nestjs/core'] || deps.nestjs}`;
				
				// Database
				if (deps.prisma) framework.database = `Prisma ${deps.prisma}`;
				else if (deps.mongoose) framework.database = `MongoDB/Mongoose ${deps.mongoose}`;
				else if (deps.typeorm) framework.database = `TypeORM ${deps.typeorm}`;
				else if (deps.sequelize) framework.database = `Sequelize ${deps.sequelize}`;
				
				// Testing
				if (deps.jest) framework.testing = `Jest ${deps.jest}`;
				else if (deps.vitest) framework.testing = `Vitest ${deps.vitest}`;
				else if (deps.mocha) framework.testing = `Mocha ${deps.mocha}`;
				else if (deps.cypress) framework.testing = `Cypress ${deps.cypress}`;
				
				// Bundler
				if (deps.webpack) framework.bundler = `Webpack ${deps.webpack}`;
				else if (deps.vite) framework.bundler = `Vite ${deps.vite}`;
				else if (deps.rollup) framework.bundler = `Rollup ${deps.rollup}`;
				else if (deps.parcel) framework.bundler = `Parcel ${deps.parcel}`;
			}
			
			// Check for other config files
			const configFiles = ['vite.config.ts', 'webpack.config.js', 'next.config.js', 'nuxt.config.js'];
			for (const configFile of configFiles) {
				const exists = await this.fileService.exists(URI.joinPath(workspaceRoot, configFile));
				if (exists && !framework.bundler) {
					if (configFile.includes('vite')) framework.bundler = 'Vite';
					else if (configFile.includes('webpack')) framework.bundler = 'Webpack';
					else if (configFile.includes('next')) framework.frontend = 'Next.js';
					else if (configFile.includes('nuxt')) framework.frontend = 'Nuxt.js';
				}
			}
			
		} catch (error) {
			this.logService.warn('⚠️ Failed to detect some framework info:', error);
		}
		
		return framework;
	}
	
	async extractCodingConventions(filePaths: string[]) {
		let spaceIndent = 0, tabIndent = 0;
		let singleQuotes = 0, doubleQuotes = 0;
		let withSemicolons = 0, withoutSemicolons = 0;
		let camelCaseFiles = 0, kebabCaseFiles = 0, pascalCaseFiles = 0;
		let camelCaseComponents = 0, pascalCaseComponents = 0;
		
		const sampleSize = Math.min(filePaths.length, 20); // Analyze up to 20 files for performance
		
		for (let i = 0; i < sampleSize; i++) {
			try {
				const fileUri = URI.file(filePaths[i]);
				const content = await this.fileService.readFile(fileUri);
				const text = content.value.toString();
				const lines = text.split('\n').slice(0, 50); // First 50 lines
				
				// Analyze indentation
				for (const line of lines) {
					if (line.match(/^  [^ ]/)) spaceIndent++;
					if (line.match(/^\t/)) tabIndent++;
				}
				
				// Analyze quotes (in TypeScript/JavaScript files)
				if (filePaths[i].match(/\.(ts|tsx|js|jsx)$/)) {
					const singleQuoteMatches = text.match(/'/g)?.length || 0;
					const doubleQuoteMatches = text.match(/"/g)?.length || 0;
					if (singleQuoteMatches > doubleQuoteMatches) singleQuotes++;
					else if (doubleQuoteMatches > singleQuoteMatches) doubleQuotes++;
					
					// Analyze semicolons
					const statements = text.match(/[;}]\s*\n/g)?.length || 0;
					const noSemiStatements = text.match(/[^;}]\s*\n/g)?.length || 0;
					if (statements > noSemiStatements) withSemicolons++;
					else withoutSemicolons++;
				}
				
				// Analyze file naming
				const fileName = filePaths[i].split('/').pop()?.split('.')[0] || '';
				if (fileName.match(/^[a-z][a-zA-Z0-9]*$/)) camelCaseFiles++;
				else if (fileName.match(/^[a-z][a-z0-9-]*$/)) kebabCaseFiles++;
				else if (fileName.match(/^[A-Z][a-zA-Z0-9]*$/)) pascalCaseFiles++;
				
				// Analyze component naming (React/Vue files)
				if (filePaths[i].match(/\.(tsx|vue)$/)) {
					if (fileName.match(/^[A-Z]/)) pascalCaseComponents++;
					else camelCaseComponents++;
				}
				
			} catch (error) {
				// Skip files that can't be read
				continue;
			}
		}
		
		return {
			indentation: spaceIndent > tabIndent ? '2-spaces' as const : 'tabs' as const,
			quotes: singleQuotes > doubleQuotes ? 'single' as const : 'double' as const,
			semicolons: withSemicolons > withoutSemicolons,
			fileNaming: kebabCaseFiles > camelCaseFiles && kebabCaseFiles > pascalCaseFiles 
				? 'kebab-case' as const
				: camelCaseFiles > pascalCaseFiles ? 'camelCase' as const : 'PascalCase' as const,
			componentNaming: pascalCaseComponents > camelCaseComponents ? 'PascalCase' as const : 'camelCase' as const,
			functionNaming: 'camelCase' as const, // Default assumption
			variableNaming: 'camelCase' as const, // Default assumption
			trailingCommas: true, // Default assumption
		};
	}
	
	private async scanDirectory(uri: URI): Promise<Array<{ path: string; uri: URI }>> {
		const files: Array<{ path: string; uri: URI }> = [];
		
		try {
			const entries = await this.fileService.resolve(uri);
			
			if (entries.children) {
				for (const entry of entries.children) {
					if (entry.isDirectory) {
						if (!this.isIgnoredDirectory(entry.name)) {
							const subFiles = await this.scanDirectory(entry.resource);
							files.push(...subFiles);
						}
					} else {
						files.push({
							path: entry.resource.path,
							uri: entry.resource
						});
					}
				}
			}
		} catch (error) {
			// Log scan errors for debugging
			this.logService.warn(`⚠️ Error scanning directory ${uri.path}:`, error);
		}
		
		return files;
	}
	
	private isSupportedFile(file: { path: string }): boolean {
		return CodebaseAnalyzer.SUPPORTED_EXTENSIONS.some(ext => 
			file.path.toLowerCase().endsWith(ext)
		);
	}
	
	private isIgnoredFile(file: { path: string }): boolean {
		return CodebaseAnalyzer.IGNORE_PATTERNS.some(pattern => 
			file.path.includes(pattern)
		);
	}
	
	private isIgnoredDirectory(name: string): boolean {
		return CodebaseAnalyzer.IGNORE_PATTERNS.includes(name);
	}
	
	private async analyzeProjectInfo(workspaceRoot: URI) {
		let name = 'Unknown Project';
		let type = 'unknown';
		let packageManager: 'npm' | 'yarn' | 'pnpm' | undefined;
		
		try {
			// Check package.json for project name
			const packageJsonUri = URI.joinPath(workspaceRoot, 'package.json');
			if (await this.fileService.exists(packageJsonUri)) {
				const content = await this.fileService.readFile(packageJsonUri);
				const packageJson = JSON.parse(content.value.toString());
				name = packageJson.name || name;
				
				// Determine project type from dependencies
				const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
				if (allDeps.react || allDeps.vue || allDeps.angular) {
					type = allDeps.express || allDeps.fastify ? 'full-stack-web-app' : 'frontend-web-app';
				} else if (allDeps.express || allDeps.fastify || allDeps.koa) {
					type = 'backend-api';
				} else if (packageJson.main || packageJson.bin) {
					type = 'node-application';
				}
			}
			
			// Detect package manager
			if (await this.fileService.exists(URI.joinPath(workspaceRoot, 'yarn.lock'))) {
				packageManager = 'yarn';
			} else if (await this.fileService.exists(URI.joinPath(workspaceRoot, 'pnpm-lock.yaml'))) {
				packageManager = 'pnpm';
			} else if (await this.fileService.exists(URI.joinPath(workspaceRoot, 'package-lock.json'))) {
				packageManager = 'npm';
			}
			
		} catch (error) {
			// Use defaults
		}
		
		return { name, type, packageManager };
	}
	
	private async extractCodePatterns(codeFiles: Array<{ path: string; uri: URI }>) {
		// Simplified pattern detection - in a real implementation, this would be much more sophisticated
		return {
			componentStructure: 'functional-components',
			stateManagement: 'hooks',
			styling: 'css-modules',
			apiPattern: 'restful',
			errorHandling: 'try-catch',
			testingApproach: 'unit-tests',
			architecturePattern: 'mvc',
			layering: ['presentation', 'business', 'data'],
			designPatterns: ['factory', 'observer'],
			preferred: ['typescript', 'functional-programming'],
		};
	}
	
	private async extractDependencies(workspaceRoot: URI) {
		const dependencies = {
			commonImports: [] as string[],
			frequentlyUsed: [] as string[],
			coreLibraries: [] as string[],
			devDependencies: [] as string[],
		};
		
		try {
			const packageJsonUri = URI.joinPath(workspaceRoot, 'package.json');
			if (await this.fileService.exists(packageJsonUri)) {
				const content = await this.fileService.readFile(packageJsonUri);
				const packageJson = JSON.parse(content.value.toString());
				
				dependencies.coreLibraries = Object.keys(packageJson.dependencies || {});
				dependencies.devDependencies = Object.keys(packageJson.devDependencies || {});
				dependencies.frequentlyUsed = [...dependencies.coreLibraries.slice(0, 10)];
				
				// Common imports based on detected libraries
				if (dependencies.coreLibraries.includes('react')) {
					dependencies.commonImports.push("import React from 'react'");
				}
				if (dependencies.coreLibraries.includes('@prisma/client')) {
					dependencies.commonImports.push("import { PrismaClient } from '@prisma/client'");
				}
				if (dependencies.coreLibraries.includes('express')) {
					dependencies.commonImports.push("import express from 'express'");
				}
			}
		} catch (error) {
			// Use empty dependencies
		}
		
		return dependencies;
	}
	
	private async analyzeFileStatistics(codeFiles: Array<{ path: string; uri: URI }>) {
		const fileTypes: Record<string, number> = {};
		let totalLines = 0;
		
		for (const file of codeFiles.slice(0, 100)) { // Limit for performance
			const ext = file.path.split('.').pop() || 'unknown';
			fileTypes[ext] = (fileTypes[ext] || 0) + 1;
			
			try {
				const content = await this.fileService.readFile(file.uri);
				const lines = content.value.toString().split('\n').length;
				totalLines += lines;
			} catch (error) {
				// Skip files that can't be read
			}
		}
		
		return {
			totalFiles: codeFiles.length,
			fileTypes,
			linesOfCode: totalLines,
			complexity: totalLines > 10000 ? 'high' as const : totalLines > 5000 ? 'medium' as const : 'low' as const,
			maintainability: 'medium' as const, // Would need more sophisticated analysis
		};
	}
	
	private async analyzeFileRelationships(codeFiles: Array<{ path: string; uri: URI }>) {
		// Simplified relationship analysis
		const relationships: Record<string, any> = {};
		
		// In a real implementation, this would parse imports/exports and build a dependency graph
		for (const file of codeFiles.slice(0, 50)) { // Limit for performance
			relationships[file.path] = {
				imports: [],
				exports: [],
				dependencies: [],
				dependents: [],
			};
		}
		
		return relationships;
	}
	
	private detectLanguages(codeFiles: Array<{ path: string }>) {
		const languages = new Set<string>();
		
		for (const file of codeFiles) {
			const ext = file.path.split('.').pop()?.toLowerCase();
			switch (ext) {
				case 'ts':
				case 'tsx':
					languages.add('TypeScript');
					break;
				case 'js':
				case 'jsx':
					languages.add('JavaScript');
					break;
				case 'py':
					languages.add('Python');
					break;
				case 'java':
					languages.add('Java');
					break;
				case 'go':
					languages.add('Go');
					break;
				case 'rs':
					languages.add('Rust');
					break;
				case 'cpp':
				case 'cc':
				case 'cxx':
					languages.add('C++');
					break;
				case 'c':
					languages.add('C');
					break;
				case 'cs':
					languages.add('C#');
					break;
				case 'vue':
					languages.add('Vue');
					break;
			}
		}
		
		return Array.from(languages);
	}
	
	private async analyzeFolderStructure(workspaceRoot: URI) {
		const structure: Record<string, any> = {};
		
		try {
			const entries = await this.fileService.resolve(workspaceRoot);
			if (entries.children) {
				for (const entry of entries.children) {
					if (entry.isDirectory && !this.isIgnoredDirectory(entry.name)) {
						structure[entry.name] = 'directory';
					}
				}
			}
		} catch (error) {
			// Use empty structure
		}
		
		return structure;
	}
	
	private calculateLearningConfidence(fileCount: number, framework: any): number {
		let confidence = 0;
		
		// Base confidence from file count
		if (fileCount > 50) confidence += 0.4;
		else if (fileCount > 20) confidence += 0.3;
		else if (fileCount > 10) confidence += 0.2;
		else confidence += 0.1;
		
		// Bonus for detected frameworks
		const frameworkCount = Object.keys(framework).length;
		confidence += frameworkCount * 0.15;
		
		// Cap at 1.0
		return Math.min(confidence, 1.0);
	}
}
