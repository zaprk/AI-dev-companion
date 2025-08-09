/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMarkerService, IMarkerData, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { URI } from '../../../../base/common/uri.js';

export const ICodeValidationService = createDecorator<ICodeValidationService>('codeValidationService');

export interface ICodeValidationService {
	readonly _serviceBrand: undefined;
	
	/**
	 * Validate code content and return markers for issues
	 */
	validateCode(filePath: string, content: string, languageId: string): Promise<IMarkerData[]>;
	
	/**
	 * Apply validation markers to a file
	 */
	applyValidationMarkers(uri: URI, markers: IMarkerData[]): void;
	
	/**
	 * Clear validation markers for a file
	 */
	clearValidationMarkers(uri: URI): void;
	
	/**
	 * Validate generated files and apply markers
	 */
	validateGeneratedFiles(files: Array<{ path: string; content: string }>): Promise<void>;
}

export class CodeValidationService implements ICodeValidationService {
	readonly _serviceBrand: undefined;
	
	private static readonly VALIDATION_OWNER = 'ai-companion-validation';
	
	constructor(
		@IMarkerService private readonly markerService: IMarkerService,
		@ILogService private readonly logService: ILogService
	) {}
	
	async validateCode(filePath: string, content: string, languageId: string): Promise<IMarkerData[]> {
		const markers: IMarkerData[] = [];
		
		try {
			// Basic syntax validation based on language
			switch (languageId) {
				case 'typescript':
				case 'javascript':
					markers.push(...this.validateTypeScript(content, filePath));
					break;
				case 'json':
					markers.push(...this.validateJSON(content, filePath));
					break;
				case 'prisma':
					markers.push(...this.validatePrisma(content, filePath));
					break;
				default:
					// Basic validation for unknown languages
					markers.push(...this.validateBasic(content, filePath));
					break;
			}
			
			this.logService.info(`🔍 CodeValidationService: Found ${markers.length} issues in ${filePath}`);
			
		} catch (error) {
			this.logService.error('❌ CodeValidationService: Validation failed:', error);
			markers.push({
				severity: MarkerSeverity.Error,
				message: `Validation failed: ${error}`,
				source: 'AI Companion',
				startLineNumber: 1,
				startColumn: 1,
				endLineNumber: 1,
				endColumn: 1
			});
		}
		
		return markers;
	}
	
	applyValidationMarkers(uri: URI, markers: IMarkerData[]): void {
		try {
			this.markerService.changeOne(CodeValidationService.VALIDATION_OWNER, uri, markers);
			
			if (markers.length > 0) {
				const errorCount = markers.filter(m => m.severity === MarkerSeverity.Error).length;
				const warningCount = markers.filter(m => m.severity === MarkerSeverity.Warning).length;
				this.logService.info(`📋 Applied ${errorCount} errors, ${warningCount} warnings to ${uri.path}`);
			}
		} catch (error) {
			this.logService.error('❌ Failed to apply validation markers:', error);
		}
	}
	
	clearValidationMarkers(uri: URI): void {
		this.markerService.changeOne(CodeValidationService.VALIDATION_OWNER, uri, []);
	}
	
	async validateGeneratedFiles(files: Array<{ path: string; content: string }>): Promise<void> {
		this.logService.info(`🔍 CodeValidationService: Validating ${files.length} generated files...`);
		
		for (const file of files) {
			try {
				const uri = URI.file(file.path);
				const languageId = this.getLanguageIdFromPath(file.path);
				
				// Clear existing markers first
				this.clearValidationMarkers(uri);
				
				// Validate the file content
				const markers = await this.validateCode(file.path, file.content, languageId);
				
				// Apply validation markers
				this.applyValidationMarkers(uri, markers);
				
			} catch (error) {
				this.logService.error(`❌ Failed to validate file ${file.path}:`, error);
			}
		}
		
		this.logService.info('✅ CodeValidationService: File validation completed');
	}
	
	private validateTypeScript(content: string, filePath: string): IMarkerData[] {
		const markers: IMarkerData[] = [];
		const lines = content.split('\n');
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;
			
			// Check for common TypeScript/JavaScript issues
			
			// Missing semicolons (basic check)
			if (this.shouldHaveSemicolon(line) && !line.trim().endsWith(';') && !line.trim().endsWith('{') && !line.trim().endsWith('}')) {
				markers.push({
					severity: MarkerSeverity.Warning,
					message: 'Missing semicolon',
					source: 'AI Companion',
					startLineNumber: lineNumber,
					startColumn: line.length,
					endLineNumber: lineNumber,
					endColumn: line.length + 1
				});
			}
			
			// Unused imports (basic detection)
			const importMatch = line.match(/import\s+.*?\s+from\s+['"`](.+?)['"`]/);
			if (importMatch) {
				const importName = importMatch[1];
				if (!content.includes(importName.replace(/['"]/g, '')) && !content.includes(importName)) {
					markers.push({
						severity: MarkerSeverity.Warning,
						message: `Unused import: ${importName}`,
						source: 'AI Companion',
						startLineNumber: lineNumber,
						startColumn: 1,
						endLineNumber: lineNumber,
						endColumn: line.length + 1
					});
				}
			}
			
			// Missing return type annotations
			const functionMatch = line.match(/function\s+\w+\s*\([^)]*\)\s*\{/);
			if (functionMatch && !line.includes(':') && !line.includes('void') && !line.includes('Promise')) {
				markers.push({
					severity: MarkerSeverity.Info,
					message: 'Consider adding return type annotation',
					source: 'AI Companion',
					startLineNumber: lineNumber,
					startColumn: 1,
					endLineNumber: lineNumber,
					endColumn: line.length + 1
				});
			}
		}
		
		// Check for unmatched braces
		const openBraces = (content.match(/\{/g) || []).length;
		const closeBraces = (content.match(/\}/g) || []).length;
		if (openBraces !== closeBraces) {
			markers.push({
				severity: MarkerSeverity.Error,
				message: `Unmatched braces: ${openBraces} opening, ${closeBraces} closing`,
				source: 'AI Companion',
				startLineNumber: lines.length,
				startColumn: 1,
				endLineNumber: lines.length,
				endColumn: 1
			});
		}
		
		return markers;
	}
	
	private validateJSON(content: string, filePath: string): IMarkerData[] {
		const markers: IMarkerData[] = [];
		
		try {
			JSON.parse(content);
		} catch (error: any) {
			// Extract line and column from JSON parse error
			const match = error.message.match(/at position (\d+)/);
			let lineNumber = 1;
			let column = 1;
			
			if (match) {
				const position = parseInt(match[1], 10);
				const lines = content.substring(0, position).split('\n');
				lineNumber = lines.length;
				column = lines[lines.length - 1].length + 1;
			}
			
			markers.push({
				severity: MarkerSeverity.Error,
				message: `JSON Parse Error: ${error.message}`,
				source: 'AI Companion',
				startLineNumber: lineNumber,
				startColumn: column,
				endLineNumber: lineNumber,
				endColumn: column + 1
			});
		}
		
		return markers;
	}
	
	private validatePrisma(content: string, filePath: string): IMarkerData[] {
		const markers: IMarkerData[] = [];
		const lines = content.split('\n');
		
		// Basic Prisma schema validation
		let hasGenerator = false;
		let hasDatasource = false;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const lineNumber = i + 1;
			
			if (line.startsWith('generator')) {
				hasGenerator = true;
			}
			
			if (line.startsWith('datasource')) {
				hasDatasource = true;
			}
			
			// Check for model syntax issues
			if (line.startsWith('model') && !line.includes('{')) {
				markers.push({
					severity: MarkerSeverity.Error,
					message: 'Model declaration must have opening brace',
					source: 'AI Companion',
					startLineNumber: lineNumber,
					startColumn: 1,
					endLineNumber: lineNumber,
					endColumn: line.length + 1
				});
			}
		}
		
		if (!hasGenerator) {
			markers.push({
				severity: MarkerSeverity.Warning,
				message: 'Prisma schema should have a generator block',
				source: 'AI Companion',
				startLineNumber: 1,
				startColumn: 1,
				endLineNumber: 1,
				endColumn: 1
			});
		}
		
		if (!hasDatasource) {
			markers.push({
				severity: MarkerSeverity.Warning,
				message: 'Prisma schema should have a datasource block',
				source: 'AI Companion',
				startLineNumber: 1,
				startColumn: 1,
				endLineNumber: 1,
				endColumn: 1
			});
		}
		
		return markers;
	}
	
	private validateBasic(content: string, filePath: string): IMarkerData[] {
		const markers: IMarkerData[] = [];
		
		// Check for extremely long lines
		const lines = content.split('\n');
		const maxLineLength = 120;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.length > maxLineLength) {
				markers.push({
					severity: MarkerSeverity.Info,
					message: `Line too long (${line.length} > ${maxLineLength} characters)`,
					source: 'AI Companion',
					startLineNumber: i + 1,
					startColumn: maxLineLength,
					endLineNumber: i + 1,
					endColumn: line.length
				});
			}
		}
		
		return markers;
	}
	
	private shouldHaveSemicolon(line: string): boolean {
		const trimmed = line.trim();
		
		// Skip empty lines, comments, and control structures
		if (!trimmed || 
			trimmed.startsWith('//') || 
			trimmed.startsWith('/*') || 
			trimmed.startsWith('*') ||
			trimmed.startsWith('if') ||
			trimmed.startsWith('for') ||
			trimmed.startsWith('while') ||
			trimmed.startsWith('switch') ||
			trimmed.startsWith('try') ||
			trimmed.startsWith('catch') ||
			trimmed.startsWith('finally') ||
			trimmed.startsWith('else') ||
			trimmed.includes('=>')) {
			return false;
		}
		
		// Should have semicolon for statements
		return trimmed.includes('=') || 
			   trimmed.includes('return') || 
			   trimmed.includes('import') || 
			   trimmed.includes('export') ||
			   trimmed.includes('const') ||
			   trimmed.includes('let') ||
			   trimmed.includes('var');
	}
	
	private getLanguageIdFromPath(filePath: string): string {
		const extension = filePath.split('.').pop()?.toLowerCase();
		
		switch (extension) {
			case 'ts': return 'typescript';
			case 'js': return 'javascript';
			case 'json': return 'json';
			case 'prisma': return 'prisma';
			case 'md': return 'markdown';
			case 'py': return 'python';
			case 'go': return 'go';
			case 'rs': return 'rust';
			case 'java': return 'java';
			case 'cpp': case 'cc': case 'cxx': return 'cpp';
			case 'c': return 'c';
			case 'cs': return 'csharp';
			case 'php': return 'php';
			case 'rb': return 'ruby';
			case 'swift': return 'swift';
			case 'kt': return 'kotlin';
			case 'scala': return 'scala';
			case 'sql': return 'sql';
			case 'html': return 'html';
			case 'css': return 'css';
			case 'scss': return 'scss';
			case 'less': return 'less';
			case 'xml': return 'xml';
			case 'yaml': case 'yml': return 'yaml';
			case 'toml': return 'toml';
			default: return 'plaintext';
		}
	}
}
