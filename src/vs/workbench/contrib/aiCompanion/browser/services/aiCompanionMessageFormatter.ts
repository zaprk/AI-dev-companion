import { IMessageFormatter } from '../../common/aiCompanionServiceTokens.js';



export class AICompanionMessageFormatter implements IMessageFormatter {
	readonly _serviceBrand: undefined;

	renderMarkdown(content: string): string {
		// Process code blocks first (before other replacements)
		content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
			const language = lang || 'text';
			return `<pre><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>`;
		});

		// Headers
		content = content.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		content = content.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		content = content.replace(/^# (.*$)/gim, '<h1>$1</h1>');

		// Bold and italic (order matters - bold first)
		content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

		// Inline code
		content = content.replace(/`(.*?)`/g, '<code>$1</code>');

		// Links
		content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

		// Lists
		content = content.replace(/^\* (.*$)/gim, '<li>$1</li>');
		content = content.replace(/^- (.*$)/gim, '<li>$1</li>');
		content = content.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

		// Wrap consecutive list items in ul/ol
		content = content.replace(/(<li>.*<\/li>)/gs, (match) => {
			const items = match.match(/<li>.*?<\/li>/g);
			if (items && items.length > 0) {
				return `<ul>${items.join('')}</ul>`;
			}
			return match;
		});

		// Blockquotes
		content = content.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

		// Strikethrough
		content = content.replace(/~~(.*?)~~/g, '<del>$1</del>');

		// Line breaks (convert \n to <br> but not inside code blocks)
		content = content.replace(/\n/g, '<br>');

		return content;
	}

	formatWorkflowResponse(content: any, workflowType: string): string {
		console.log(`🎨 Formatting ${workflowType} response:`, {
			contentType: typeof content,
			isString: typeof content === 'string',
			length: content?.length,
			startsWithBrace: typeof content === 'string' && content.trim().startsWith('{')
		});
		
		try {
			// If content is already an object, use it directly
			if (typeof content === 'object' && content !== null) {
				console.log('📦 Content is already an object');
				return this.formatStructuredContent(content, workflowType);
			}
			
			// If content is a string, try to parse it as JSON
			if (typeof content === 'string') {
				console.log('📝 Content is a string, attempting JSON parse...');
				
				// Clean the content first
				const cleanContent = content.trim();
				
				if (cleanContent.startsWith('{') || cleanContent.startsWith('[')) {
					try {
						const parsed = JSON.parse(cleanContent);
						console.log('✅ Successfully parsed JSON:', typeof parsed);
						return this.formatStructuredContent(parsed, workflowType);
					} catch (parseError) {
						console.warn('⚠️ JSON parse failed:', parseError);
						// Fallback to plain text formatting
						return this.formatPlainContent(cleanContent, workflowType);
					}
				} else {
					console.log('📄 Content is plain text');
					return this.formatPlainContent(cleanContent, workflowType);
				}
			}
			
			console.warn('⚠️ Unexpected content type:', typeof content);
			return String(content);
			
		} catch (error) {
			console.error('❌ Error formatting workflow response:', error);
			return `Error formatting response: ${String(content)}`;
		}
	}

	formatStructuredContent(parsed: any, workflowType: string): string {
		console.log(`🏗️ Formatting structured content for ${workflowType}`);
		
		switch (workflowType) {
			case 'requirements':
				return this.formatRequirementsStructured(parsed);
			case 'design':
				return this.formatDesignStructured(parsed);
			case 'tasks':
				return this.formatTasksStructured(parsed);
			case 'code':
				return this.formatCodeStructured(parsed);
			default:
				return JSON.stringify(parsed, null, 2);
		}
	}

	private formatPlainContent(content: string, workflowType: string): string {
		console.log(`📄 Formatting plain content for ${workflowType}`);
		
		// If content is not structured JSON, format it nicely
		return content
			.replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting for now
			.replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
			.trim();
	}

	private formatRequirementsStructured(req: any): string {
		console.log('📋 Formatting requirements:', req);
		let content = '';
		
		if (req.functional?.length) {
			content += '## 🎯 Functional Requirements\n';
			req.functional.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.nonFunctional?.length) {
			content += '## ⚡ Non-Functional Requirements\n';
			req.nonFunctional.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.constraints?.length) {
			content += '## 🚧 Constraints\n';
			req.constraints.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.assumptions?.length) {
			content += '## 💭 Assumptions\n';
			req.assumptions.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.reasoning) {
			content += `## 🤔 Reasoning\n${req.reasoning}\n`;
		}
		
		return content || 'No structured requirements found';
	}

	private formatDesignStructured(design: any): string {
		console.log('🏗️ Formatting design:', design);
		let content = '';
		
		if (design.architecture) {
			content += `## 🏛️ Architecture\n${design.architecture}\n\n`;
		}
		
		if (design.techStack?.length) {
			content += `## 🛠️ Tech Stack\n${design.techStack.join(', ')}\n\n`;
		}
		
		if (design.components?.length) {
			content += '## 📦 Components\n';
			design.components.forEach((comp: string, i: number) => {
				content += `${i + 1}. ${comp}\n`;
			});
			content += '\n';
		}
		
		if (design.dependencies?.length) {
			content += '## 📚 Dependencies\n';
			design.dependencies.forEach((dep: string, i: number) => {
				content += `${i + 1}. ${dep}\n`;
			});
			content += '\n';
		}
		
		if (design.folderStructure) {
			content += '## 📁 Folder Structure\n```\n';
			content += this.formatFolderStructure(design.folderStructure, 0);
			content += '```\n\n';
		}
		
		if (design.reasoning) {
			content += `## 🤔 Reasoning\n${design.reasoning}\n`;
		}
		
		return content || 'No structured design found';
	}

	private formatTasksStructured(tasks: any): string {
		console.log('📝 Formatting tasks:', tasks);
		let content = '';
		
		if (tasks.tasks?.length) {
			content += '## 📝 Implementation Tasks\n\n';
			tasks.tasks.forEach((task: any, i: number) => {
				content += `### ${i + 1}. ${task.title}\n`;
				content += `**Description:** ${task.description}\n`;
				if (task.filePath) {
					content += `**File:** \`${task.filePath}\`\n`;
				}
				if (task.dependencies?.length) {
					content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
				}
				if (task.estimatedTime) {
					content += `**Time:** ${task.estimatedTime}\n`;
				}
				if (task.complexity) {
					content += `**Complexity:** ${task.complexity.toUpperCase()}\n`;
				}
				content += '\n';
			});
		}
		
		if (tasks.reasoning) {
			content += `## 🤔 Reasoning\n${tasks.reasoning}\n`;
		}
		
		return content || 'No structured tasks found';
	}

	private formatCodeStructured(code: any): string {
		console.log('💻 Formatting code:', code);
		let content = '';
		
		if (code.files?.length) {
			content += '## 📁 Generated Files\n\n';
			code.files.forEach((file: any, i: number) => {
				content += `### ${i + 1}. ${file.path}\n`;
				content += `${file.description}\n\n`;
				
				// Show a preview of the code (first few lines)
				if (file.content) {
					const lines = file.content.split('\n').slice(0, 10);
					content += '```typescript\n';
					content += lines.join('\n');
					if (file.content.split('\n').length > 10) {
						content += '\n... (truncated)';
					}
					content += '\n```\n\n';
				}
			});
		}
		
		if (code.reasoning) {
			content += `## 🤔 Implementation Notes\n${code.reasoning}\n`;
		}
		
		return content || 'No structured code found';
	}

	private formatFolderStructure(structure: any, depth: number = 0): string {
		let result = '';
		const indent = '  '.repeat(depth);
		
		for (const [name, children] of Object.entries(structure)) {
			result += `${indent}${name}\n`;
			if (children && typeof children === 'object') {
				result += this.formatFolderStructure(children, depth + 1);
			}
		}
		
		return result;
	}

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

 