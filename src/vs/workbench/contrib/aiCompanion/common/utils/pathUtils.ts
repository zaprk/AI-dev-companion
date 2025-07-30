import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';

import { FileSystemError } from '../types/fileSystemTypes.js';

// Conditionally import fs only in Node.js context
let fs: any = null;
let path: any = null;
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
        fs = require('fs');
    } catch (error) {
        // fs not available
    }
}

export class PathUtils {
    private readonly workspaceService: IWorkspaceContextService;
    // private cachedWorkspaceRoot: string | null;
    // private lastCacheTime: Date | null;

    constructor(workspaceService: IWorkspaceContextService) {
        this.workspaceService = workspaceService;
        // this.cachedWorkspaceRoot = null;
        // this.lastCacheTime = null;
    }

    detectWorkspaceRoot(): string | null {
        const workspace = this.workspaceService.getWorkspace();
        if (workspace.folders && workspace.folders.length > 0) {
            return workspace.folders[0].uri.fsPath;
        }
        
        // In browser context, we can't use fs operations
        if (!fs) {
            return null;
        }
        
        let currentDir = process.cwd();
        const rootDir = path.parse(currentDir).root;
        while (currentDir !== rootDir) {
            try {
                const vscodeDir = path.join(currentDir, '.vscode');
                if (fs.existsSync(vscodeDir) && fs.statSync(vscodeDir).isDirectory()) {
                    return currentDir;
                }
                const gitDir = path.join(currentDir, '.git');
                if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
                    return currentDir;
                }
                const packageJson = path.join(currentDir, 'package.json');
                if (fs.existsSync(packageJson) && fs.statSync(packageJson).isFile()) {
                    return currentDir;
                }
                
                currentDir = path.dirname(currentDir);
            } catch (error) {
                currentDir = path.dirname(currentDir);
            }
        }
    
        return null;
    }

    resolveProjectPath(relativePath: string): string {
        if (!relativePath || relativePath === "") {
            throw new FileSystemError(
                'Invalid path',
                'EINVAL',
                'resolveProjectPath',
                relativePath
            );
        }

        const workspaceRoot = this.detectWorkspaceRoot();
        if (workspaceRoot === null) {
            throw new FileSystemError(
                'Workspace not found',
                'ENOWORKSPACE',
                'resolveProjectPath',
                relativePath
            );
        } 

        const absolutePath = path.resolve(workspaceRoot, relativePath);

        if (!this.validatePathSecurity(absolutePath, workspaceRoot)) {
            throw new FileSystemError(
                'Security violation',
                'ESECURITY',
                'resolveProjectPath',
                absolutePath
            );
        }

        return absolutePath;
    }

    validatePathSecurity(targetPath: string, workspaceRoot: string) {
        try {
            const normalizedTarget = path.resolve(targetPath);
            const normalizedRoot = path.resolve(workspaceRoot);
            
            return normalizedTarget.startsWith(normalizedRoot);
        } catch (error) {
            return false;
        }
    }

    generateTempPath(originalPath: string) {
        const timeStamp = Date.now();
        let randomNum = Math.random();
        let tempPath = originalPath + '.tmp.' + timeStamp;

        // In browser context, we can't check if file exists
        if (!fs) {
            return tempPath;
        }

        let attempts = 0;
        while (fs.existsSync(tempPath) && attempts < 100) {
            attempts += 1;
            randomNum = Math.random();
            tempPath = originalPath + '.tmp.' + timeStamp + '.' + randomNum + '.' + attempts;
        }

        if (attempts >= 100) {
            throw new Error("Cannot create temp path after 100 attempts!");
        }

        return tempPath;
    }

    getLockedPath(filePath: string) {
        return filePath + '.lock';
    }

    isValidPath(inputPath: string) {
        if (!inputPath || typeof inputPath !== 'string') {
            return false;
        }
 
        if (inputPath.trim().length === 0) {
            return false;
        }
        
        if (process.platform === 'win32') {
            const windowsInvalidChars = /[<>:"|?*\x00-\x1f]/;
            if (windowsInvalidChars.test(inputPath)) {
                return false;
            }
            
            const windowsReservedNames = [
                'CON', 'PRN', 'AUX', 'NUL',
                'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
                'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
            ];
            
            const basename = path.basename(inputPath);
            const nameWithoutExt = basename.split('.')[0].toUpperCase();
            if (windowsReservedNames.includes(nameWithoutExt)) {
                return false;
            }
            
            if (inputPath.length > 260) {
                return false;
            }
            
            if (basename.length > 255) {
                return false;
            }
            
        } else {
            if (inputPath.includes('\x00')) {
                return false;
            }
            
            const basename = path.basename(inputPath);
            if (Buffer.byteLength(basename, 'utf8') > 255) {
                return false;
            }
            
            if (Buffer.byteLength(inputPath, 'utf8') > 4096) {
                return false;
            }
        }

        if (process.platform === 'win32') {
            const basename = path.basename(inputPath);
            if (basename.endsWith(' ') || basename.endsWith('.')) {
                return false;
            }
        }

        if (inputPath.includes('//') && !(process.platform === 'win32' && inputPath.startsWith('//'))) {
            return false;
        }
        
        return true;
    }
}

