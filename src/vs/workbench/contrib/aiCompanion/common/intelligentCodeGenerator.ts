/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProjectMemoryService, IProjectMemory } from './projectMemoryService.js';

export const IIntelligentCodeGenerator = createDecorator<IIntelligentCodeGenerator>('intelligentCodeGenerator');

export interface IIntelligentCodeGenerator {
	readonly _serviceBrand: undefined;
	
	/**
	 * Generate intelligent imports based on project memory and file content
	 */
	generateImports(filePath: string, codeContent: string): Promise<string[]>;
	
	/**
	 * Apply project conventions to generated code
	 */
	applyConventions(code: string, fileType: string): Promise<string>;
	
	/**
	 * Get intelligent file path suggestions based on project structure
	 */
	suggestFilePath(fileName: string, contentType: 'component' | 'service' | 'utility' | 'test'): string;
	
	/**
	 * Generate context-aware code template
	 */
	generateTemplate(templateType: string, context: any): Promise<string>;
}

export interface ICodeTemplate {
	imports: string[];
	content: string;
	conventions: {
		indentation: string;
		quotes: string;
		semicolons: boolean;
	};
}

export class IntelligentCodeGenerator implements IIntelligentCodeGenerator {
	readonly _serviceBrand: undefined;
	
	constructor(
		@IProjectMemoryService private readonly projectMemoryService: IProjectMemoryService,
		@ILogService private readonly logService: ILogService
	) {}
	
	async generateImports(filePath: string, codeContent: string): Promise<string[]> {
		const memory = await this.projectMemoryService.loadMemory();
		if (!memory) {
			return [];
		}
		
		const imports: string[] = [];
		
		// Add common imports for the project
		imports.push(...memory.dependencies.commonImports);
		
		// Detect framework-specific imports
		if (memory.project.framework.frontend?.includes('React')) {
			if (codeContent.includes('useState') || codeContent.includes('useEffect')) {
				imports.push("import React, { useState, useEffect } from 'react';");
			} else if (codeContent.includes('Component') || codeContent.includes('JSX')) {
				imports.push("import React from 'react';");
			}
		}
		
		if (memory.project.framework.frontend?.includes('Vue')) {
			if (codeContent.includes('ref') || codeContent.includes('reactive')) {
				imports.push("import { ref, reactive } from 'vue';");
			}
		}
		
		// Add database imports if using Prisma
		if (memory.project.framework.database?.includes('Prisma')) {
			if (codeContent.includes('prisma') || codeContent.includes('PrismaClient')) {
				imports.push("import { PrismaClient } from '@prisma/client';");
			}
		}
		
		// Add TypeScript types if needed
		if (memory.project.languages.includes('TypeScript')) {
			if (codeContent.includes('interface') && filePath.endsWith('.ts')) {
				// TypeScript file with interfaces might need type imports
			}
		}
		
		this.logService.info(`🔗 Generated ${imports.length} intelligent imports for ${filePath}`);
		return this.removeDuplicateImports(imports);
	}
	
	async applyConventions(code: string, fileType: string): Promise<string> {
		const memory = await this.projectMemoryService.loadMemory();
		if (!memory) {
			return code;
		}
		
		let formattedCode = code;
		
		// Apply indentation
		if (memory.conventions.indentation === 'tabs') {
			formattedCode = this.convertToTabs(formattedCode);
		} else {
			const spaces = memory.conventions.indentation === '4-spaces' ? 4 : 2;
			formattedCode = this.convertToSpaces(formattedCode, spaces);
		}
		
		// Apply quote style
		if (memory.conventions.quotes === 'single') {
			formattedCode = this.convertToSingleQuotes(formattedCode);
		} else {
			formattedCode = this.convertToDoubleQuotes(formattedCode);
		}
		
		// Apply semicolon conventions
		if (memory.conventions.semicolons) {
			formattedCode = this.addSemicolons(formattedCode);
		} else {
			formattedCode = this.removeSemicolons(formattedCode);
		}
		
		// Apply naming conventions
		if (fileType === 'component' && memory.conventions.componentNaming === 'PascalCase') {
			// Ensure component names are PascalCase
			formattedCode = this.applyComponentNaming(formattedCode, 'PascalCase');
		}
		
		this.logService.info(`🎨 Applied project conventions to ${fileType} code`);
		return formattedCode;
	}
	
	suggestFilePath(fileName: string, contentType: 'component' | 'service' | 'utility' | 'test'): string {
		// This is a simplified implementation - in practice, would analyze project structure
		const suggestions: Record<string, string> = {
			component: `src/components/${fileName}`,
			service: `src/services/${fileName}`,
			utility: `src/utils/${fileName}`,
			test: `src/__tests__/${fileName}`
		};
		
		return suggestions[contentType] || `src/${fileName}`;
	}
	
	async generateTemplate(templateType: string, context: any): Promise<string> {
		const memory = await this.projectMemoryService.loadMemory();
		
		switch (templateType) {
			case 'react-component':
				return this.generateReactComponentTemplate(context, memory);
			case 'api-endpoint':
				return this.generateApiEndpointTemplate(context, memory);
			case 'utility-function':
				return this.generateUtilityTemplate(context, memory);
			default:
				return this.generateGenericTemplate(context, memory);
		}
	}
	
	private generateReactComponentTemplate(context: any, memory?: IProjectMemory): string {
		const componentName = context.name || 'MyComponent';
		const useTypeScript = memory?.project.languages.includes('TypeScript');
		
		const imports = memory?.project.framework.frontend?.includes('React') 
			? "import React from 'react';" 
			: "";
		
		const propsInterface = useTypeScript ? `
interface ${componentName}Props {
  // Add your props here
}

` : '';
		
		const component = useTypeScript 
			? `const ${componentName}: React.FC<${componentName}Props> = (props) => {
  return (
    <div>
      <h1>Hello from ${componentName}!</h1>
    </div>
  );
};`
			: `const ${componentName} = (props) => {
  return (
    <div>
      <h1>Hello from ${componentName}!</h1>
    </div>
  );
};`;
		
		const exportStatement = `export default ${componentName};`;
		
		return `${imports}

${propsInterface}${component}

${exportStatement}`;
	}
	
	private generateApiEndpointTemplate(context: any, memory?: IProjectMemory): string {
		const useTypeScript = memory?.project.languages.includes('TypeScript');
		const framework = memory?.project.framework.backend;
		
		if (framework?.includes('Express')) {
			return this.generateExpressEndpoint(context, useTypeScript || false);
		}
		
		return this.generateGenericApiEndpoint(context, useTypeScript || false);
	}
	
	private generateExpressEndpoint(context: any, useTypeScript: boolean): string {
		const imports = useTypeScript 
			? "import { Request, Response } from 'express';"
			: "const express = require('express');";
		
		const handler = useTypeScript
			? `export const ${context.name || 'handler'} = async (req: Request, res: Response) => {
  try {
    // Your endpoint logic here
    res.json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};`
			: `const ${context.name || 'handler'} = async (req, res) => {
  try {
    // Your endpoint logic here
    res.json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { ${context.name || 'handler'} };`;
		
		return `${imports}

${handler}`;
	}
	
	private generateGenericApiEndpoint(context: any, useTypeScript: boolean): string {
		return `// Generic API endpoint
export const ${context.name || 'apiHandler'} = async (request: any) => {
  return { message: 'Hello from API' };
};`;
	}
	
	private generateUtilityTemplate(context: any, memory?: IProjectMemory): string {
		const useTypeScript = memory?.project.languages.includes('TypeScript');
		const functionName = context.name || 'utilityFunction';
		
		return useTypeScript
			? `/**
 * ${context.description || 'Utility function'}
 */
export const ${functionName} = (input: any): any => {
  // Your utility logic here
  return input;
};`
			: `/**
 * ${context.description || 'Utility function'}
 */
export const ${functionName} = (input) => {
  // Your utility logic here
  return input;
};`;
	}
	
	private generateGenericTemplate(context: any, memory?: IProjectMemory): string {
		return `// Generated code template
// Context: ${JSON.stringify(context, null, 2)}`;
	}
	
	private removeDuplicateImports(imports: string[]): string[] {
		return [...new Set(imports)];
	}
	
	private convertToTabs(code: string): string {
		return code.replace(/^  +/gm, (match) => '\t'.repeat(match.length / 2));
	}
	
	private convertToSpaces(code: string, spaceCount: number): string {
		const spaces = ' '.repeat(spaceCount);
		return code.replace(/^\t+/gm, (match) => spaces.repeat(match.length));
	}
	
	private convertToSingleQuotes(code: string): string {
		return code.replace(/"/g, "'");
	}
	
	private convertToDoubleQuotes(code: string): string {
		return code.replace(/'/g, '"');
	}
	
	private addSemicolons(code: string): string {
		return code.replace(/([^;{}\s])$/gm, '$1;');
	}
	
	private removeSemicolons(code: string): string {
		return code.replace(/;$/gm, '');
	}
	
	private applyComponentNaming(code: string, style: 'PascalCase' | 'camelCase'): string {
		// This is a simplified implementation
		if (style === 'PascalCase') {
			return code.replace(/\bconst ([a-z][a-zA-Z]*)/g, (match, name) => {
				const pascalName = name.charAt(0).toUpperCase() + name.slice(1);
				return match.replace(name, pascalName);
			});
		}
		return code;
	}
}
