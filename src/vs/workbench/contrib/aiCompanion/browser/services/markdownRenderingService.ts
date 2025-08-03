// src/vs/workbench/contrib/aiCompanion/browser/services/markdownRenderingService.ts

export class MarkdownRenderingService {
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

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	// Utility method for clean text rendering (no HTML)
	renderPlainText(content: string): string {
		return content
			.replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
			.replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
			.replace(/`(.*?)`/g, '$1')       // Remove code formatting
			.replace(/~~(.*?)~~/g, '$1')     // Remove strikethrough
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep only link text
			.trim();
	}
}