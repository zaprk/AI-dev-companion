import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { PathUtils } from './utils/pathUtils.js';
import { ValidationUtils } from './utils/validationUtils.js';
import { ILockHandle, IFileSystemConfig, IFileCacheEntry, IWatcherState } from './types/fileSystemTypes.js';

const defaultConfig: IFileSystemConfig = {
    maxLockTimeOut: 5000,
    retryBaseDelay: 1000,
    maxRetries: 3,
    cacheMaxSize: 1000,
    cacheTil: 30000,
    debounceDelay: 100
};

class FileSystemManager {
    // private workspaceService: IWorkspaceContextService;
    private fileService: IFileService;
    private logService: ILogService;
    // private instantiationService: IInstantiationService;
    
    private pathUtils: PathUtils;
    private validationUtils: ValidationUtils;
    
    private activeLocks: Map<string, ILockHandle>;
    private fileWatchers: Map<string, IWatcherState>;
    private fileCache: Map<string, IFileCacheEntry>;
    private config: IFileSystemConfig;
    private isInitialized: boolean;
    private maintenanceInterval: NodeJS.Timeout | null;

    constructor(
        workspaceService: IWorkspaceContextService,
        fileService: IFileService,
        logService: ILogService,
        instantiationService: IInstantiationService,
        config?: Partial<IFileSystemConfig>
    ) {
        // this.workspaceService = workspaceService;
        this.fileService = fileService;
        this.logService = logService;
        // this.instantiationService = instantiationService;
        
        this.pathUtils = new PathUtils(workspaceService);
        this.validationUtils = new ValidationUtils(fileService);
        
        this.activeLocks = new Map();
        this.fileWatchers = new Map();
        this.fileCache = new Map();
        this.config = { ...defaultConfig, ...config };
        this.isInitialized = false;
        this.maintenanceInterval = null;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        const workspaceRoot = this.pathUtils.detectWorkspaceRoot();
        if (!workspaceRoot) {
            this.logService.warn('No workspace detected');
        }

        await this.cleanupStaleLocks();

        this.maintenanceInterval = setInterval(() => {
            this.performMaintenance();
        }, 60000) as any;

        this.isInitialized = true;
        this.logService.debug('FileSystemManager initialized');
    }

    dispose(): void {
        this.activeLocks.forEach(lock => {
            this.releaseLock(lock);
        });

        this.fileWatchers.forEach(watcher => {
            this.stopWatching(watcher.filePath);
        });

        this.fileCache.clear();

        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
            this.maintenanceInterval = null;
        }

        this.isInitialized = false;
        this.logService.debug('FileSystemManager disposed');
    }

    detectWorkspaceRoot(): string | null {
        return this.pathUtils.detectWorkspaceRoot();
    }

    resolveProjectPath(relativePath: string): string {
        return this.pathUtils.resolveProjectPath(relativePath);
    }

    async writeFile(relativePath: string, content: string, options?: { createBackup?: boolean; verifyWrite?: boolean }): Promise<void> {
        const absolutePath = this.resolveProjectPath(relativePath);
        await this.atomicWrite(absolutePath, content, options || {});
    }

    async readJsonFile<T>(relativePath: string, schema?: any, defaultValue?: T): Promise<T> {
        const content = await this.readFile(relativePath);
        if (!content) {
            return defaultValue as T;
        }

        try {
            const data = JSON.parse(content);
            
            if (schema) {
                const validation = this.validationUtils.validateJsonSchema(data, schema);
                if (!validation.isValid) {
                    throw new Error(`JSON validation failed: ${validation.errors.join(', ')}`);
                }
                return validation.data as T;
            }

            return data as T;
        } catch (error) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw error;
        }
    }

    async writeJsonFile(relativePath: string, data: any, schema?: any): Promise<void> {
        if (schema) {
            const validation = this.validationUtils.validateJsonSchema(data, schema);
            if (!validation.isValid) {
                throw new Error(`JSON validation failed: ${validation.errors.join(', ')}`);
            }
        }

        const content = JSON.stringify(data, null, 2);
        await this.writeFile(relativePath, content);
    }

    async fileExists(relativePath: string): Promise<boolean> {
        const absolutePath = this.resolveProjectPath(relativePath);
        try {
            const stat = await this.fileService.stat(URI.file(absolutePath));
            return stat.isFile;
        } catch {
            return false;
        }
    }

    async deleteFile(relativePath: string): Promise<void> {
        const absolutePath = this.resolveProjectPath(relativePath);
        await this.fileService.del(URI.file(absolutePath));
    }

    getStatus(): {
        isInitialized: boolean;
        workspaceRoot: string | null;
        activeLocks: number;
        activeWatchers: number;
        cacheSize: number;
        lastError?: string;
    } {
        return {
            isInitialized: this.isInitialized,
            workspaceRoot: this.detectWorkspaceRoot(),
            activeLocks: this.activeLocks.size,
            activeWatchers: this.fileWatchers.size,
            cacheSize: this.fileCache.size,
            lastError: undefined
        };
    }

    getInitialized(): boolean {
        return this.isInitialized;
    }

    async acquireLock(filePath: string, lockType: 'exclusive' | 'shared' = 'exclusive', timeout: number = 5000): Promise<ILockHandle> {
        const absolutePath = this.pathUtils.resolveProjectPath(filePath);
        const lockFilePath = this.pathUtils.getLockedPath(absolutePath);

        if (this.activeLocks.has(absolutePath)) {
            return this.activeLocks.get(absolutePath)!;
        }

        const startTime = Date.now();
        let attempt = 0;

        while ((Date.now() - startTime) < timeout) {
            try {
                const lockInfo = {
                    processId: process.pid,
                    acquiredAt: Date.now(),
                    lockType: lockType
                };

                const lockUri = URI.file(lockFilePath);
                await this.fileService.writeFile(lockUri, VSBuffer.fromString(JSON.stringify(lockInfo)));

                const lockHandle: ILockHandle = {
                    filePath: absolutePath,
                    lockFilePath: lockFilePath,
                    processedId: process.pid,
                    acquiredAt: new Date(),
                    isExclusive: lockType === 'exclusive'
                };

                this.activeLocks.set(absolutePath, lockHandle);
                this.logService.debug(`Acquired ${lockType} lock for: ${absolutePath}`);
                return lockHandle;

            } catch (error: any) {
                try {
                    const lockUri = URI.file(lockFilePath);
                    const existingLockContent = await this.fileService.readFile(lockUri);
                    const existingLockInfo = JSON.parse(existingLockContent.value.toString());

                    if (!this.isProcessAlive(existingLockInfo.processId)) {
                        await this.fileService.del(lockUri);
                        continue;
                    } else {
                        const delay = this.exponentialBackoff(attempt);
                        await this.sleep(delay);
                        attempt++;
                    }
                } catch (readError) {
                    try {
                        const lockUri = URI.file(lockFilePath);
                        await this.fileService.del(lockUri);
                    } catch (delError) {
                    }
                    continue;
                }
            }
        }

        throw new Error(`Could not acquire lock within timeout for: ${absolutePath}`);
    }

    async releaseLock(lockHandle: ILockHandle): Promise<void> {
        try {
            const lockUri = URI.file(lockHandle.lockFilePath);
            await this.fileService.del(lockUri);
            this.activeLocks.delete(lockHandle.filePath);
            this.logService.debug(`Released lock for: ${lockHandle.filePath}`);
        } catch (error: any) {
            this.logService.warn(`Error releasing lock: ${error.message}`);
        }
    }

    async atomicWrite(filePath: string, content: string, options: { createBackup?: boolean; verifyWrite?: boolean } = {}): Promise<void> {
        const absolutePath = this.pathUtils.resolveProjectPath(filePath);
        const fileUri = URI.file(absolutePath);

        const lockHandle = await this.acquireLock(filePath, 'exclusive');

        try {
            if (options.createBackup) {
                try {
                    await this.fileService.stat(fileUri);
                    const backupPath = `${absolutePath}.backup.${Date.now()}`;
                    const backupUri = URI.file(backupPath);
                    await this.fileService.copy(fileUri, backupUri);
                } catch (error) {
                }
            }

            const tempPath = this.pathUtils.generateTempPath(absolutePath);
            const tempUri = URI.file(tempPath);

            await this.fileService.writeFile(tempUri, VSBuffer.fromString(content));

            if (options.verifyWrite) {
                const readBack = await this.fileService.readFile(tempUri);
                if (readBack.value.toString() !== content) {
                    throw new Error('Write verification failed');
                }
            }

            await this.fileService.move(tempUri, fileUri);

            const hash = this.validationUtils.generateFileHash(content);
            this.fileCache.set(absolutePath, {
                content: content,
                hash: hash,
                timestamp: Date.now()
            });

            this.logService.debug(`Atomic write completed: ${absolutePath}`);

        } finally {
            await this.releaseLock(lockHandle);

            try {
                const tempPath = this.pathUtils.generateTempPath(absolutePath);
                const tempUri = URI.file(tempPath);
                await this.fileService.del(tempUri);
            } catch (error) {
            }
        }
    }

    async readFile(filePath: string, useCache: boolean = true): Promise<string> {
        const absolutePath = this.pathUtils.resolveProjectPath(filePath);
        const fileUri = URI.file(absolutePath);

        if (useCache && this.fileCache.has(absolutePath)) {
            const cacheEntry = this.fileCache.get(absolutePath)!;

            if ((Date.now() - cacheEntry.timestamp) < this.config.cacheTil) {
                try {
                    const stats = await this.fileService.stat(fileUri);
                    if (stats.mtime <= cacheEntry.timestamp) {
                        return cacheEntry.content;
                    }
                } catch (error) {
                    this.fileCache.delete(absolutePath);
                }
            }
        }

        try {
            const content = await this.fileService.readFile(fileUri);
            const contentString = content.value.toString();

            const hash = this.validationUtils.generateFileHash(contentString);
            this.fileCache.set(absolutePath, {
                content: contentString,
                hash: hash,
                timestamp: Date.now()
            });

            return contentString;

        } catch (error: any) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    async watchFile(filePath: string, callback: (changeType: string, content?: string) => void): Promise<void> {
        const absolutePath = this.pathUtils.resolveProjectPath(filePath);

        if (this.fileWatchers.has(absolutePath)) {
            throw new Error('File is already being watched');
        }

        let initialHash = '';
        try {
            const content = await this.readFile(filePath, false);
            initialHash = this.validationUtils.generateFileHash(content);
        } catch (error) {
        }

        const watcher = this.fileService.onDidFilesChange((event: any) => {
            const fileUri = URI.file(absolutePath);
            const changes = event.changes.filter((change: any) => change.resource.fsPath === fileUri.fsPath);
            
            if (changes.length > 0) {
                const changeType = changes[0].type === 1 ? 'created' : 
                                 changes[0].type === 2 ? 'updated' : 'deleted';
                this.handleFileChange(absolutePath, changeType);
            }
        });

        const watcherState: IWatcherState = {
            filePath: absolutePath,
            lastHash: initialHash,
            lastModified: Date.now(),
            debounceTimer: null,
            callback: callback,
            watcher: watcher
        };

        this.fileWatchers.set(absolutePath, watcherState);
        this.logService.debug(`Started watching file: ${absolutePath}`);
    }

    stopWatching(filePath: string): void {
        const absolutePath = this.pathUtils.resolveProjectPath(filePath);
        const watcherState = this.fileWatchers.get(absolutePath);

        if (watcherState) {
            if (watcherState.debounceTimer) {
                clearTimeout(watcherState.debounceTimer);
            }
            if (watcherState.watcher && watcherState.watcher.dispose) {
                watcherState.watcher.dispose();
            }
            this.fileWatchers.delete(absolutePath);
            this.logService.debug(`Stopped watching file: ${absolutePath}`);
        }
    }

    private async handleFileChange(filePath: string, changeType: string): Promise<void> {
        const watcherState = this.fileWatchers.get(filePath);
        if (!watcherState) {
            return;
        }

        if (watcherState.debounceTimer) {
            clearTimeout(watcherState.debounceTimer);
        }

        watcherState.debounceTimer = setTimeout(async () => {
            try {
                if (changeType === 'deleted') {
                    watcherState.callback('deleted');
                    return;
                }

                const content = await this.readFile(filePath, false);
                const currentHash = this.validationUtils.generateFileHash(content);

                if (currentHash !== watcherState.lastHash) {
                    watcherState.lastHash = currentHash;
                    watcherState.lastModified = Date.now();
                    watcherState.callback(changeType, content);
                }

            } catch (error: any) {
                this.logService.error(`Error handling file change: ${error.message}`);
            }
        }, this.config.debounceDelay);
    }

    async retryOperation<T>(operation: () => Promise<T>, maxRetries: number = this.config.maxRetries): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                return result;
            } catch (error: any) {
                if (attempt === maxRetries) {
                    throw error;
                }

                if (!this.isRetryableError(error)) {
                    throw error;
                }

                const delay = this.config.retryBaseDelay * Math.pow(2, attempt - 1);
                const jitter = Math.random() * delay * 0.1;
                const totalDelay = delay + jitter;

                this.logService.warn(`Operation failed, retrying in ${totalDelay}ms: ${error.message}`);
                await this.sleep(totalDelay);
            }
        }

        throw new Error('Max retries exceeded');
    }

    private isRetryableError(error: any): boolean {
        const retryableCodes = ['EBUSY', 'EMFILE', 'ENFILE', 'ENOENT', 'EAGAIN'];
        return retryableCodes.includes(error.code);
    }

    private async cleanupStaleLocks(): Promise<void> {
        this.logService.debug('Cleaning up stale locks');
    }

    private performMaintenance(): void {
        const now = Date.now();
        this.fileCache.forEach((entry, path) => {
            if ((now - entry.timestamp) > this.config.cacheTil) {
                this.fileCache.delete(path);
            }
        });

        this.logService.debug('Performed maintenance cleanup');
    }

    private isProcessAlive(processId: number): boolean {
        try {
            process.kill(processId, 0);
            return true;
        } catch {
            return false;
        }
    }

    private exponentialBackoff(attempt: number): number {
        return Math.min(1000 * Math.pow(2, attempt), 10000);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export { FileSystemManager }; 