import { IAIProvider, IAIProviderConfig, IAIRequest, IAIResponse, IAIRequirementsResult, IAIDesignResult, IAITaskResult, IAICodeResult } from '../aiProvider.js';

/**
 * OpenAI API Response Types
 */
interface OpenAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider implements IAIProvider {
    constructor(public readonly config: IAIProviderConfig) {
        if (!config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
    }

    async complete(request: IAIRequest): Promise<IAIResponse> {
        const url = this.config.baseUrl || 'https://api.openai.com/v1/chat/completions';
        
        const body = {
            model: this.config.model,
            messages: request.messages,
            max_tokens: request.maxTokens || this.config.maxTokens,
            temperature: request.temperature ?? this.config.temperature,
            stream: false
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
            }

            const data: OpenAIResponse = await response.json();
            
            return {
                content: data.choices[0]?.message?.content || '',
                usage: {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens
                },
                model: data.model,
                finishReason: this.mapFinishReason(data.choices[0]?.finish_reason)
            };

        } catch (error: any) {
            throw new Error(`OpenAI request failed: ${error.message}`);
        }
    }

    async generateRequirements(prompt: string, context?: string): Promise<IAIRequirementsResult> {
        const systemPrompt = `You are an expert software architect. Generate detailed, actionable requirements for the following request.

Return your response as a JSON object with this exact structure:
{
    "functional": ["requirement 1", "requirement 2", ...],
    "nonFunctional": ["performance requirement", "security requirement", ...],
    "constraints": ["technical constraint", "business constraint", ...],
    "assumptions": ["assumption 1", "assumption 2", ...],
    "reasoning": "explanation of your analysis and decisions"
}

Be specific and actionable. Each requirement should be implementable.`;

        const userPrompt = `${context ? `Project Context: ${context}\n\n` : ''}Request: ${prompt}`;

        const response = await this.complete({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });

        try {
            return JSON.parse(response.content);
        } catch (error) {
            throw new Error('Failed to parse requirements response as JSON');
        }
    }

    async generateDesign(requirements: IAIRequirementsResult, context?: string): Promise<IAIDesignResult> {
        const systemPrompt = `You are an expert software architect. Based on the provided requirements, create a detailed technical design.

Return your response as a JSON object with this exact structure:
{
    "folderStructure": {
        "src/": {
            "components/": {},
            "services/": {},
            "utils/": {}
        }
    },
    "components": ["Component1", "Component2", ...],
    "architecture": "description of overall architecture pattern",
    "techStack": ["technology1", "technology2", ...],
    "dependencies": ["package1", "package2", ...],
    "reasoning": "explanation of design decisions"
}

Focus on practical, implementable design decisions.`;

        const userPrompt = `${context ? `Project Context: ${context}\n\n` : ''}Requirements to implement:

Functional Requirements:
${requirements.functional.map(req => `- ${req}`).join('\n')}

Non-Functional Requirements:
${requirements.nonFunctional.map(req => `- ${req}`).join('\n')}

Constraints:
${requirements.constraints.map(constraint => `- ${constraint}`).join('\n')}`;

        const response = await this.complete({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });

        try {
            return JSON.parse(response.content);
        } catch (error) {
            throw new Error('Failed to parse design response as JSON');
        }
    }

    async generateTasks(requirements: IAIRequirementsResult, design: IAIDesignResult, context?: string): Promise<IAITaskResult> {
        const systemPrompt = `You are an expert project manager and developer. Break down the requirements and design into specific, actionable development tasks.

Return your response as a JSON object with this exact structure:
{
    "tasks": [
        {
            "title": "Task title",
            "description": "Detailed description of what to implement",
            "filePath": "relative/path/to/file.ts",
            "dependencies": ["task1", "task2"],
            "estimatedTime": "2 hours",
            "complexity": "low|medium|high"
        }
    ],
    "reasoning": "explanation of task breakdown strategy"
}

Order tasks by dependency and logical implementation sequence.`;

        const userPrompt = `${context ? `Project Context: ${context}\n\n` : ''}Create tasks for:

REQUIREMENTS:
${requirements.functional.map(req => `- ${req}`).join('\n')}

DESIGN:
Architecture: ${design.architecture}
Tech Stack: ${design.techStack.join(', ')}
Components: ${design.components.join(', ')}

Folder Structure:
${JSON.stringify(design.folderStructure, null, 2)}`;

        const response = await this.complete({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });

        try {
            return JSON.parse(response.content);
        } catch (error) {
            throw new Error('Failed to parse tasks response as JSON');
        }
    }

    async generateCode(tasks: IAITaskResult, selectedTasks?: string[], context?: string): Promise<IAICodeResult> {
        const systemPrompt = `You are an expert developer. Generate production-ready code for the specified tasks.

Return your response as a JSON object with this exact structure:
{
    "files": [
        {
            "path": "relative/path/to/file.ts",
            "content": "complete file content",
            "description": "what this file does"
        }
    ],
    "reasoning": "explanation of implementation approach"
}

Generate complete, working code with proper error handling, typing, and documentation.`;

        const tasksToImplement = selectedTasks 
            ? tasks.tasks.filter(task => selectedTasks.includes(task.title))
            : tasks.tasks;

        const userPrompt = `${context ? `Project Context: ${context}\n\n` : ''}Generate code for these tasks:

${tasksToImplement.map(task => `
TASK: ${task.title}
Description: ${task.description}
File: ${task.filePath}
Complexity: ${task.complexity}
`).join('\n')}`;

        const response = await this.complete({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });

        try {
            return JSON.parse(response.content);
        } catch (error) {
            throw new Error('Failed to parse code response as JSON');
        }
    }

    validateResponse(response: IAIResponse): boolean {
        return response.content.length > 0 && 
               response.finishReason === 'stop' &&
               response.usage.totalTokens > 0;
    }

    estimateTokens(text: string): number {
        // Rough estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    }

    isConfigured(): boolean {
        return !!this.config.apiKey && !!this.config.model;
    }

    private mapFinishReason(reason: string): 'stop' | 'length' | 'content_filter' | 'error' {
        switch (reason) {
            case 'stop': return 'stop';
            case 'length': return 'length';
            case 'content_filter': return 'content_filter';
            default: return 'error';
        }
    }
}