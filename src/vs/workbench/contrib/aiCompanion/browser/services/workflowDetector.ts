import { IWorkflowDetector } from '../../common/aiCompanionServiceTokens.js';
import { IPerformanceMonitor } from '../../common/aiCompanionServiceTokens.js';
import { IErrorHandler } from '../../common/aiCompanionServiceTokens.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../../platform/files/common/files.js';


import { URI } from '../../../../../base/common/uri.js';

export interface IWorkflowContext {
    workspaceRoot: string;
    techStack: string[];
    architecture: string;
    gitBranch?: string;
    fileStructure: string;
    detectedWorkflow: string;
    confidence: number;
}

export class WorkflowDetector implements IWorkflowDetector {
    readonly _serviceBrand: undefined;

    private workflowPatterns = {
        requirements: [
            /requirements?/i,
            /specifications?/i,
            /user stories?/i,
            /functional requirements?/i,
            /non-functional requirements?/i,
            /acceptance criteria/i,
            /project scope/i,
            /business requirements?/i
        ],
        design: [
            /design/i,
            /architecture/i,
            /system design/i,
            /component design/i,
            /ui design/i,
            /ux design/i,
            /wireframe/i,
            /mockup/i,
            /prototype/i,
            /diagram/i
        ],
        tasks: [
            /tasks?/i,
            /todo/i,
            /implementation/i,
            /development plan/i,
            /sprint planning/i,
            /work breakdown/i,
            /milestones?/i,
            /deliverables?/i
        ],
        code: [
            /code/i,
            /implementation/i,
            /function/i,
            /class/i,
            /module/i,
            /component/i,
            /api/i,
            /endpoint/i,
            /database/i,
            /query/i,
            /algorithm/i
        ]
    };



    constructor(
        @IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
        @IFileService private readonly fileService: IFileService,
        @IPerformanceMonitor private readonly performanceMonitor: IPerformanceMonitor,
        @IErrorHandler private readonly errorHandler: IErrorHandler
    ) {}

    detectWorkflowType(content: string): string {
        const timer = this.performanceMonitor.startTimer('workflow-detection');
        
        try {
            const scores = {
                requirements: 0,
                design: 0,
                tasks: 0,
                code: 0
            };

            // Check for workflow-specific patterns
            for (const [workflow, patterns] of Object.entries(this.workflowPatterns)) {
                for (const pattern of patterns) {
                    if (pattern.test(content)) {
                        scores[workflow as keyof typeof scores]++;
                    }
                }
            }

            // Check for code-specific indicators
            if (content.includes('```') || content.includes('function') || content.includes('class')) {
                scores.code += 2;
            }

            // Check for structured content indicators
            if (content.includes('{') && content.includes('}') && content.includes('"')) {
                scores.code += 1;
            }

            // Find the workflow with the highest score
            let maxScore = 0;
            let detectedWorkflow = 'chat';

            for (const [workflow, score] of Object.entries(scores)) {
                if (score > maxScore) {
                    maxScore = score;
                    detectedWorkflow = workflow;
                }
            }

            timer();
            return detectedWorkflow;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Workflow detection');
            return 'chat';
        }
    }

    async analyzeContext(): Promise<IWorkflowContext> {
        const timer = this.performanceMonitor.startTimer('context-analysis');
        
        try {
            const workspaceRoot = this.workspaceService.getWorkspace().folders[0]?.uri.fsPath || '';
            
            const [techStack, architecture, gitBranch, fileStructure] = await Promise.all([
                this.detectTechStack(workspaceRoot),
                this.detectArchitecture(workspaceRoot),
                this.detectGitBranch(workspaceRoot),
                this.getFileStructureFast(workspaceRoot)
            ]);

            const context: IWorkflowContext = {
                workspaceRoot,
                techStack,
                architecture,
                gitBranch,
                fileStructure,
                detectedWorkflow: 'chat',
                confidence: 0.8
            };

            timer();
            return context;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Context analysis');
            return {
                workspaceRoot: '',
                techStack: [],
                architecture: 'unknown',
                fileStructure: '',
                detectedWorkflow: 'chat',
                confidence: 0.0
            };
        }
    }

    async detectTechStack(workspaceRoot: string): Promise<string[]> {
        const timer = this.performanceMonitor.startTimer('tech-stack-detection');
        
        try {
            const techStack: string[] = [];
            const files = await this.getKeyFiles(workspaceRoot);

            // Check package.json for Node.js projects
            if (files.includes('package.json')) {
                techStack.push('Node.js');
                try {
                    const packageJson = await this.readFile(workspaceRoot, 'package.json');
                    const dependencies = JSON.parse(packageJson);
                    
                    // Check for frontend frameworks
                    if (dependencies.dependencies?.react || dependencies.devDependencies?.react) {
                        techStack.push('React');
                    }
                    if (dependencies.dependencies?.vue || dependencies.devDependencies?.vue) {
                        techStack.push('Vue');
                    }
                    if (dependencies.dependencies?.angular || dependencies.devDependencies?.angular) {
                        techStack.push('Angular');
                    }
                    if (dependencies.dependencies?.next || dependencies.devDependencies?.next) {
                        techStack.push('Next.js');
                    }
                    if (dependencies.dependencies?.express || dependencies.devDependencies?.express) {
                        techStack.push('Express');
                    }
                } catch (error) {
                    // Ignore JSON parsing errors
                }
            }

            // Check for Python projects
            if (files.includes('requirements.txt') || files.includes('pyproject.toml') || files.includes('Pipfile')) {
                techStack.push('Python');
            }

            // Check for Java projects
            if (files.includes('pom.xml') || files.includes('build.gradle')) {
                techStack.push('Java');
            }

            // Check for C# projects
            if (files.includes('.csproj') || files.includes('.sln')) {
                techStack.push('C#');
            }

            // Check for Go projects
            if (files.includes('go.mod')) {
                techStack.push('Go');
            }

            // Check for Rust projects
            if (files.includes('Cargo.toml')) {
                techStack.push('Rust');
            }

            // Check for Docker
            if (files.includes('Dockerfile') || files.includes('docker-compose.yml')) {
                techStack.push('Docker');
            }

            // Check for database files
            if (files.includes('schema.sql') || files.includes('migrations/')) {
                techStack.push('SQL');
            }

            timer();
            return techStack;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Tech stack detection');
            return [];
        }
    }

    async detectArchitecture(workspaceRoot: string): Promise<string> {
        const timer = this.performanceMonitor.startTimer('architecture-detection');
        
        try {
            const files = await this.getKeyFiles(workspaceRoot);
            const content = await this.getKeyFileContents(workspaceRoot, files);

            // Check for microservices indicators
            if (files.includes('docker-compose.yml') || content.includes('microservice') || content.includes('service-discovery')) {
                timer();
                return 'microservices';
            }

            // Check for serverless indicators
            if (files.includes('serverless.yml') || files.includes('functions/') || content.includes('lambda')) {
                timer();
                return 'serverless';
            }

            // Check for monolithic indicators
            if (files.includes('app.js') || files.includes('main.py') || files.includes('Program.cs')) {
                timer();
                return 'monolithic';
            }

            timer();
            return 'unknown';
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Architecture detection');
            return 'unknown';
        }
    }

    async detectGitBranch(workspaceRoot: string): Promise<string | undefined> {
        const timer = this.performanceMonitor.startTimer('git-branch-detection');
        
        try {
            const files = await this.getKeyFiles(workspaceRoot);
            if (files.includes('.git/HEAD')) {
                const headContent = await this.readFile(workspaceRoot, '.git/HEAD');
                const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/);
                if (branchMatch) {
                    timer();
                    return branchMatch[1];
                }
            }
            
            timer();
            return undefined;
        } catch (error) {
            timer();
            return undefined;
        }
    }

    async getFileStructureFast(workspaceRoot: string): Promise<string> {
        const timer = this.performanceMonitor.startTimer('file-structure-analysis');
        
        try {
            const structure = await this.buildFileStructure(workspaceRoot, 3); // Limit depth to 3 levels
            timer();
            return structure;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'File structure analysis');
            return '';
        }
    }

    // Helper methods
    private async getKeyFiles(workspaceRoot: string): Promise<string[]> {
        try {
            const files = await this.fileService.resolve(URI.file(workspaceRoot));
            return files.children?.map(child => child.name) || [];
        } catch (error) {
            return [];
        }
    }

    private async readFile(workspaceRoot: string, filename: string): Promise<string> {
        try {
            const content = await this.fileService.readFile(URI.file(`${workspaceRoot}/${filename}`));
            return content.value.toString();
        } catch (error) {
            return '';
        }
    }

    private async getKeyFileContents(workspaceRoot: string, files: string[]): Promise<string> {
        const keyFiles = ['README.md', 'package.json', 'docker-compose.yml', 'serverless.yml'];
        let content = '';
        
        for (const file of keyFiles) {
            if (files.includes(file)) {
                content += await this.readFile(workspaceRoot, file);
            }
        }
        
        return content;
    }

    private async buildFileStructure(workspaceRoot: string, maxDepth: number, currentDepth: number = 0): Promise<string> {
        if (currentDepth >= maxDepth) {
            return '';
        }

        try {
            const files = await this.fileService.resolve(URI.file(workspaceRoot));
            let structure = '';

            for (const child of files.children || []) {
                const indent = '  '.repeat(currentDepth);
                const isDirectory = child.isDirectory;
                const icon = isDirectory ? '📁' : '📄';
                
                structure += `${indent}${icon} ${child.name}\n`;

                if (isDirectory && currentDepth < maxDepth - 1) {
                    const subStructure = await this.buildFileStructure(
                        `${workspaceRoot}/${child.name}`,
                        maxDepth,
                        currentDepth + 1
                    );
                    structure += subStructure;
                }
            }

            return structure;
        } catch (error) {
            return '';
        }
    }

    // Utility methods
    getWorkflowConfidence(content: string, detectedWorkflow: string): number {
        const timer = this.performanceMonitor.startTimer('confidence-calculation');
        
        try {
            const patterns = this.workflowPatterns[detectedWorkflow as keyof typeof this.workflowPatterns] || [];
            let matches = 0;

            for (const pattern of patterns) {
                if (pattern.test(content)) {
                    matches++;
                }
            }

            const confidence = Math.min(matches / patterns.length, 1.0);
            timer();
            return confidence;
        } catch (error) {
            timer();
            return 0.0;
        }
    }

    getSupportedWorkflows(): string[] {
        return Object.keys(this.workflowPatterns);
    }
}

 