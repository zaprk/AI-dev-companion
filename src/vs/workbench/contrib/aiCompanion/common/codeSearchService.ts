/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISearchService, ITextQuery, IFileQuery, IFileMatch, QueryType, IPatternInfo } from '../../../services/search/common/search.js';
import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';

export const ICodeSearchService = createDecorator<ICodeSearchService>('codeSearchService');

export interface SearchResult {
    filePath: string;
    matches: CodeMatch[];
    relevance: number; // 0-1 score for relevance
}

export interface CodeMatch {
    lineNumber: number;
    column: number;
    length: number;
    text: string;
    context: string; // Surrounding code for context
}

export interface SearchOptions {
    maxResults?: number;
    includePattern?: string[];
    excludePattern?: string[];
    caseSensitive?: boolean;
    useRegex?: boolean;
    wholeWord?: boolean;
    multiline?: boolean;
}

export interface ICodeSearchService {
    readonly _serviceBrand: undefined;
    
    /**
     * Search for text in the codebase
     */
    searchText(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    
    /**
     * Search for files by name/pattern
     */
    searchFiles(pattern: string, options?: SearchOptions): Promise<string[]>;
    
    /**
     * Find all references to a symbol
     */
    findReferences(symbol: string, options?: SearchOptions): Promise<SearchResult[]>;
    
    /**
     * Find definitions of a symbol
     */
    findDefinitions(symbol: string, options?: SearchOptions): Promise<SearchResult[]>;
    
    /**
     * Find implementations of an interface/class
     */
    findImplementations(interfaceName: string, options?: SearchOptions): Promise<SearchResult[]>;
    
    /**
     * Search for code patterns (e.g., function definitions, class declarations)
     */
    searchCodePatterns(pattern: string, options?: SearchOptions): Promise<SearchResult[]>;
    
    /**
     * Get context around a specific line in a file
     */
    getContext(filePath: string, lineNumber: number, contextLines?: number): Promise<string>;
    
    /**
     * Analyze codebase structure and return insights
     */
    analyzeCodebase(): Promise<CodebaseAnalysis>;
}

export interface CodebaseAnalysis {
    totalFiles: number;
    languages: { [language: string]: number };
    frameworks: string[];
    patterns: {
        functions: number;
        classes: number;
        interfaces: number;
        imports: number;
    };
    structure: {
        directories: string[];
        mainFiles: string[];
    };
}

export class CodeSearchService implements ICodeSearchService {
    declare readonly _serviceBrand: undefined;

    constructor(
        @ISearchService private readonly searchService: ISearchService,
        @ILogService private readonly logService: ILogService,
        @IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
    ) {}

    /**
     * Search for text in the codebase
     */
    async searchText(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error('No workspace root found');
            }

            const patternInfo: IPatternInfo = {
                pattern: query,
                isRegExp: options.useRegex || false,
                isWordMatch: options.wholeWord || false,
                isCaseSensitive: options.caseSensitive || false,
                isMultiline: options.multiline || false
            };

            const textQuery: ITextQuery = {
                type: QueryType.Text,
                contentPattern: patternInfo,
                folderQueries: [{
                    folder: URI.file(workspaceRoot)
                }],
                includePattern: options.includePattern ? this.buildGlobPattern(options.includePattern) : undefined,
                excludePattern: options.excludePattern ? this.buildGlobPattern(options.excludePattern) : undefined,
                maxResults: options.maxResults || 1000,
                _reason: 'aiCompanion.textSearch'
            };

            const result = await this.searchService.textSearch(textQuery, CancellationToken.None);
            
            return this.processSearchResults(result.results, query);
        } catch (error) {
            this.logService.error(`AI Companion: Failed to search text "${query}"`, error);
            throw error;
        }
    }

    /**
     * Search for files by name/pattern
     */
    async searchFiles(pattern: string, options: SearchOptions = {}): Promise<string[]> {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error('No workspace root found');
            }

            const fileQuery: IFileQuery = {
                type: QueryType.File,
                filePattern: pattern,
                folderQueries: [{
                    folder: URI.file(workspaceRoot)
                }],
                includePattern: options.includePattern ? this.buildGlobPattern(options.includePattern) : undefined,
                excludePattern: options.excludePattern ? this.buildGlobPattern(options.excludePattern) : undefined,
                maxResults: options.maxResults || 1000,
                _reason: 'aiCompanion.fileSearch'
            };

            const result = await this.searchService.fileSearch(fileQuery, CancellationToken.None);
            
            return result.results.map(match => match.resource.fsPath);
        } catch (error) {
            this.logService.error(`AI Companion: Failed to search files "${pattern}"`, error);
            throw error;
        }
    }

    /**
     * Find all references to a symbol
     */
    async findReferences(symbol: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        // Search for symbol usage (not definitions)
        const symbolPattern = `\\b${this.escapeRegex(symbol)}\\b`;
        
        return this.searchText(symbolPattern, {
            ...options,
            useRegex: true,
            wholeWord: true,
            excludePattern: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
        });
    }

    /**
     * Find definitions of a symbol
     */
    async findDefinitions(symbol: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        // Search for function/class/interface definitions
        const definitionPatterns = [
            `(function|class|interface|const|let|var)\\s+${this.escapeRegex(symbol)}\\b`,
            `export\\s+(function|class|interface|const|let|var)\\s+${this.escapeRegex(symbol)}\\b`,
            `export\\s+default\\s+${this.escapeRegex(symbol)}\\b`
        ];

        const results: SearchResult[] = [];
        
        for (const pattern of definitionPatterns) {
            const patternResults = await this.searchText(pattern, {
                ...options,
                useRegex: true,
                excludePattern: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
            });
            results.push(...patternResults);
        }

        return results;
    }

    /**
     * Find implementations of an interface/class
     */
    async findImplementations(interfaceName: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        // Search for classes that implement or extend the interface
        const implementationPatterns = [
            `class\\s+\\w+\\s+implements\\s+${this.escapeRegex(interfaceName)}\\b`,
            `class\\s+\\w+\\s+extends\\s+${this.escapeRegex(interfaceName)}\\b`,
            `implements\\s+${this.escapeRegex(interfaceName)}\\b`,
            `extends\\s+${this.escapeRegex(interfaceName)}\\b`
        ];

        const results: SearchResult[] = [];
        
        for (const pattern of implementationPatterns) {
            const patternResults = await this.searchText(pattern, {
                ...options,
                useRegex: true,
                excludePattern: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
            });
            results.push(...patternResults);
        }

        return results;
    }

    /**
     * Search for code patterns (e.g., function definitions, class declarations)
     */
    async searchCodePatterns(pattern: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const commonPatterns: { [key: string]: string } = {
            'function': 'function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{',
            'class': 'class\\s+\\w+\\s*\\{?',
            'interface': 'interface\\s+\\w+\\s*\\{?',
            'import': 'import\\s+.*from\\s+[\'"][^\'"]+[\'"]',
            'export': 'export\\s+(function|class|interface|const|let|var)',
            'async': 'async\\s+function\\s+\\w+\\s*\\([^)]*\\)',
            'arrow': 'const\\s+\\w+\\s*=\\s*\\([^)]*\\)\\s*=>',
            'component': '(function|const)\\s+\\w+\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{',
            'hook': 'const\\s+use\\w+\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{'
        };

        const searchPattern = commonPatterns[pattern] || pattern;
        
        return this.searchText(searchPattern, {
            ...options,
            useRegex: true,
            excludePattern: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
        });
    }

    /**
     * Get context around a specific line in a file
     */
    async getContext(filePath: string, lineNumber: number, contextLines: number = 5): Promise<string> {
        try {
            // Search for the specific line with surrounding context
            const linePattern = `.{0,100}`; // Get some context around the line
            
            const results = await this.searchText(linePattern, {
                includePattern: [filePath],
                maxResults: 1
            });

            if (results.length > 0 && results[0].matches.length > 0) {
                const match = results[0].matches.find(m => 
                    m.lineNumber >= lineNumber - contextLines && 
                    m.lineNumber <= lineNumber + contextLines
                );
                
                if (match) {
                    return match.context;
                }
            }

            return `Context not found for line ${lineNumber} in ${filePath}`;
        } catch (error) {
            this.logService.error(`AI Companion: Failed to get context for ${filePath}:${lineNumber}`, error);
            return `Error getting context: ${error}`;
        }
    }

    /**
     * Analyze codebase structure and return insights
     */
    async analyzeCodebase(): Promise<CodebaseAnalysis> {
        try {
            const analysis: CodebaseAnalysis = {
                totalFiles: 0,
                languages: {},
                frameworks: [],
                patterns: {
                    functions: 0,
                    classes: 0,
                    interfaces: 0,
                    imports: 0
                },
                structure: {
                    directories: [],
                    mainFiles: []
                }
            };

            // Get all files
            const allFiles = await this.searchFiles('*', { maxResults: 10000 });
            analysis.totalFiles = allFiles.length;

            // Analyze file extensions to determine languages
            for (const file of allFiles) {
                const ext = file.split('.').pop()?.toLowerCase();
                if (ext) {
                    analysis.languages[ext] = (analysis.languages[ext] || 0) + 1;
                }
            }

            // Search for common patterns
            const functionResults = await this.searchCodePatterns('function');
            analysis.patterns.functions = functionResults.length;

            const classResults = await this.searchCodePatterns('class');
            analysis.patterns.classes = classResults.length;

            const interfaceResults = await this.searchCodePatterns('interface');
            analysis.patterns.interfaces = interfaceResults.length;

            const importResults = await this.searchCodePatterns('import');
            analysis.patterns.imports = importResults.length;

            // Detect frameworks
            const frameworkPatterns = [
                { name: 'React', pattern: 'react' },
                { name: 'Vue', pattern: 'vue' },
                { name: 'Angular', pattern: 'angular' },
                { name: 'Node.js', pattern: 'node' },
                { name: 'TypeScript', pattern: 'typescript' },
                { name: 'Express', pattern: 'express' },
                { name: 'Next.js', pattern: 'next' },
                { name: 'Vite', pattern: 'vite' }
            ];

            for (const framework of frameworkPatterns) {
                const results = await this.searchText(framework.pattern, { 
                    caseSensitive: false,
                    maxResults: 10 
                });
                if (results.length > 0) {
                    analysis.frameworks.push(framework.name);
                }
            }

            // Get directory structure
            const directories = new Set<string>();
            for (const file of allFiles) {
                const dir = file.substring(0, file.lastIndexOf('/'));
                if (dir) {
                    directories.add(dir);
                }
            }
            analysis.structure.directories = Array.from(directories).sort();

            // Identify main files
            const mainFilePatterns = ['index', 'main', 'app', 'package.json', 'tsconfig.json'];
            for (const pattern of mainFilePatterns) {
                const results = await this.searchFiles(pattern);
                analysis.structure.mainFiles.push(...results);
            }

            this.logService.info(`AI Companion: Codebase analysis complete - ${analysis.totalFiles} files, ${Object.keys(analysis.languages).length} languages`);
            
            return analysis;
        } catch (error) {
            this.logService.error('AI Companion: Failed to analyze codebase', error);
            throw error;
        }
    }

    private processSearchResults(fileMatches: IFileMatch[], query: string): SearchResult[] {
        const results: SearchResult[] = [];

        for (const fileMatch of fileMatches) {
            const matches: CodeMatch[] = [];
            
            if (fileMatch.results) {
                for (const result of fileMatch.results) {
                    if ('rangeLocations' in result) {
                        for (const rangeLocation of result.rangeLocations) {
                            matches.push({
                                lineNumber: rangeLocation.source.startLineNumber,
                                column: rangeLocation.source.startColumn,
                                length: rangeLocation.source.endColumn - rangeLocation.source.startColumn,
                                text: result.previewText,
                                context: result.previewText
                            });
                        }
                    }
                }
            }

            if (matches.length > 0) {
                results.push({
                    filePath: fileMatch.resource.fsPath,
                    matches,
                    relevance: this.calculateRelevance(query, matches)
                });
            }
        }

        // Sort by relevance
        return results.sort((a, b) => b.relevance - a.relevance);
    }

    private calculateRelevance(query: string, matches: CodeMatch[]): number {
        // Simple relevance scoring based on match count and query length
        const matchCount = matches.length;
        const queryLength = query.length;
        
        // Higher score for more matches and longer queries
        return Math.min(1.0, (matchCount * 0.3) + (queryLength * 0.01));
    }

    private buildGlobPattern(patterns: string[]): { [key: string]: boolean } {
        const globPattern: { [key: string]: boolean } = {};
        for (const pattern of patterns) {
            globPattern[pattern] = true;
        }
        return globPattern;
    }

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private getWorkspaceRoot(): string | null {
        const workspace = this.workspaceService.getWorkspace();
        if (!workspace || !workspace.folders.length) {
            return null;
        }
        return workspace.folders[0].uri.fsPath;
    }
}
