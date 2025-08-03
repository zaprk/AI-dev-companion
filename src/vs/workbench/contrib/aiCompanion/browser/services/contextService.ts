// src/vs/workbench/contrib/aiCompanion/browser/services/contextService.ts

import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';

export class ContextService {
	private preloadedContext: any = null;
	private contextPreloadPromise: Promise<void> | null = null;

	constructor(private readonly workspaceService: IWorkspaceContextService) {}

	async getPreloadedContext(): Promise<any> {
		// Wait for preloading to complete if it's still in progress
		if (this.contextPreloadPromise) {
			await this.contextPreloadPromise;
		}
		
		return this.preloadedContext || {
			workspace: { name: 'Unknown', rootPath: '', files: [], gitBranch: undefined },
			memory: null,
			files: { files: [], directories: [], totalFiles: 0, totalSize: 0 },
			techStack: [],
			architecture: '',
			goals: []
		};
	}

	async preloadWorkspaceContext(): Promise<void> {
		if (this.contextPreloadPromise) {
			return; // Already preloading
		}

		this.contextPreloadPromise = this.doPreloadContext();
		await this.contextPreloadPromise;
	}

	private async doPreloadContext(): Promise<void> {
		try {
			console.log('🔄 Preloading workspace context...');
			
			const workspace = this.workspaceService.getWorkspace();
			const workspaceInfo = {
				name: workspace.folders[0]?.name || 'Unknown',
				rootPath: workspace.folders[0]?.uri.fsPath || '',
				files: [],
				gitBranch: await this.detectGitBranch()
			};

			const fileStructure = await this.getFileStructureFast();
			const techStack = await this.detectTechStack(fileStructure);
			const architecture = await this.detectArchitecture(fileStructure);

			this.preloadedContext = {
				workspace: workspaceInfo,
				memory: null,
				files: fileStructure,
				techStack,
				architecture,
				goals: []
			};

			console.log('✅ Workspace context preloaded:', {
				techStack,
				architecture,
				fileCount: fileStructure.totalFiles
			});

		} catch (error) {
			console.error('❌ Failed to preload context:', error);
			// Fallback to basic context
			this.preloadedContext = {
				workspace: { name: 'Unknown', rootPath: '', files: [], gitBranch: undefined },
				memory: null,
				files: { files: [], directories: [], totalFiles: 0, totalSize: 0 },
				techStack: [],
				architecture: '',
				goals: []
			};
		}
	}

	private async getFileStructureFast(): Promise<any> {
		try {
			const workspace = this.workspaceService.getWorkspace();
			const rootPath = workspace.folders[0]?.uri.fsPath;
			
			if (!rootPath) {
				return { files: [], directories: [], totalFiles: 0, totalSize: 0 };
			}

			// Fast file scanning (limited to key directories)
			const keyDirs = ['src', 'app', 'components', 'pages', 'api', 'routes', 'models'];
			const files: string[] = [];
			const directories: string[] = [];

			// This is a simplified version - in a real implementation,
			// you'd use VS Code's file system API to scan directories
			for (const dir of keyDirs) {
				directories.push(dir);
			}

			return {
				files,
				directories,
				totalFiles: files.length,
				totalSize: 0
			};

		} catch (error) {
			console.error('Failed to get file structure:', error);
			return { files: [], directories: [], totalFiles: 0, totalSize: 0 };
		}
	}

	private async detectTechStack(fileStructure: any): Promise<string[]> {
		const techStack: string[] = [];
		
		// Detect based on file extensions and common patterns
		const fileExtensions = fileStructure.files.map((f: string) => 
			f.split('.').pop()?.toLowerCase()
		);

		if (fileExtensions.includes('ts') || fileExtensions.includes('tsx')) {
			techStack.push('TypeScript');
		}
		if (fileExtensions.includes('js') || fileExtensions.includes('jsx')) {
			techStack.push('JavaScript');
		}
		if (fileExtensions.includes('py')) {
			techStack.push('Python');
		}
		if (fileExtensions.includes('java')) {
			techStack.push('Java');
		}
		if (fileExtensions.includes('cs')) {
			techStack.push('C#');
		}
		if (fileExtensions.includes('php')) {
			techStack.push('PHP');
		}
		if (fileExtensions.includes('rb')) {
			techStack.push('Ruby');
		}
		if (fileExtensions.includes('go')) {
			techStack.push('Go');
		}
		if (fileExtensions.includes('rs')) {
			techStack.push('Rust');
		}

		// Detect frameworks
		if (fileStructure.directories.includes('node_modules')) {
			techStack.push('Node.js');
		}
		if (fileStructure.directories.includes('src') && fileExtensions.includes('tsx')) {
			techStack.push('React');
		}
		if (fileStructure.directories.includes('src') && fileExtensions.includes('vue')) {
			techStack.push('Vue.js');
		}
		if (fileStructure.directories.includes('angular.json')) {
			techStack.push('Angular');
		}

		return techStack.length > 0 ? techStack : ['Unknown'];
	}

	private async detectArchitecture(fileStructure: any): Promise<string> {
		// Detect architecture based on directory structure
		const dirs = fileStructure.directories.map((d: string) => d.toLowerCase());
		
		if (dirs.includes('api') && dirs.includes('src')) {
			return 'Full-Stack (Frontend + API)';
		}
		if (dirs.includes('api') && !dirs.includes('src')) {
			return 'Backend API';
		}
		if (dirs.includes('src') && !dirs.includes('api')) {
			return 'Frontend Application';
		}
		if (dirs.includes('components') && dirs.includes('pages')) {
			return 'Component-Based Frontend';
		}
		if (dirs.includes('routes') && dirs.includes('models')) {
			return 'MVC Architecture';
		}
		
		return 'Unknown Architecture';
	}

	private async detectGitBranch(): Promise<string | undefined> {
		try {
			// In a real implementation, you'd use git commands
			// For now, return undefined
			return undefined;
		} catch (error) {
			return undefined;
		}
	}
}