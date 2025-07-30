
export interface IFileOperation {
    type: 'read' | 'write' | 'delete' | 'watch',
    path: string,
    timeStamp: Date,
    retryCount: number,
    lockId: string
}

export interface ILockHandle {
    filePath: string,
    lockFilePath: string,
    processedId: number,
    acquiredAt: Date,
    isExclusive: boolean
}

export interface IFileWatcherState {
    filePath: string,
    lastHash: string,
    lastModified: Date,
    debounceTimer: any,
    callback: void
}

export interface IFileCacheEntry {
    content: string;
    hash: string;
    timestamp: number;
}

export interface IWatcherState {
    filePath: string;
    lastHash: string;
    lastModified: number;
    debounceTimer: any | null;
    callback: (changeType: string, content?: string) => void;
    watcher: any;
}

export interface IAtomicWriteOptions {
    createBackup: boolean,
    verifyWrite: boolean,
    maxRetries: number,
    encoding: string
} 

export interface IFileSystemConfig {
    maxLockTimeOut: number,
    retryBaseDelay: number,
    maxRetries: number,
    cacheMaxSize: number,
    cacheTil: number,
    debounceDelay: number
}

export class FileSystemError extends Error {
    public readonly code: string;
    public readonly operation: string;
    public readonly filePath: string;
    public readonly originalError?: Error;

    constructor(
        message: string,
        code: string,
        operation: string,
        filePath: string,
        originalError?: Error
    ) {
        super(message);
        this.name = 'FileSystemError';
        this.code = code;
        this.operation = operation;
        this.filePath = filePath;
        this.originalError = originalError;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FileSystemError);
        }
    }
}

export interface ValidationResult {
    isValid: boolean,
    errors: string[],
    data: any
}

