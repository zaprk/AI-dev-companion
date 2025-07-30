import { ValidationResult } from '../types/fileSystemTypes.js';
import { IFileService, FileOperationError } from '../../../../../platform/files/common/files.js';
import { URI } from '../../../../../base/common/uri.js';

// Conditionally import crypto only in Node.js context
let crypto: any = null;
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
        crypto = require('crypto');
    } catch (error) {
        // crypto not available
    }
}

interface JsonSchema {
    type?: string;
    properties?: { [key: string]: any };
    required?: string[];
}

class ValidationUtils {
    private fileService: IFileService;
    private hashCache: Map<string, string>;

    constructor(fileService: IFileService) {
        this.fileService = fileService;
        this.hashCache = new Map();
    }

    validateJsonSchema(data: any, schema: JsonSchema): ValidationResult {
        const errors: string[] = [];

        if (data === null || data === undefined) {
            errors.push('Data is null or undefined');
            return { isValid: false, errors, data: null };
        }

        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in data)) {
                    errors.push(`Missing required field: ${field}`);
                }
            }
        }

        if (schema.properties) {
            for (const property in schema.properties) {
                if (property in data) {
                    const expectedType = schema.properties[property].type;
                    const actualType = typeof data[property];
                    if (actualType !== expectedType) {
                        errors.push(`Field ${property} should be ${expectedType}`);
                    }
                }
            }
        }

        const isValid = errors.length === 0;
        return { isValid, errors, data: isValid ? data : null };
    }

    generateFileHash(content: string): string {
        // In browser context, use a simple hash function
        if (!crypto) {
            return this.simpleHash(content);
        }
        
        const hash = crypto.createHash('sha256');
        hash.update(content, 'utf8');
        return hash.digest('hex');
    }

    // Simple hash function for browser context
    private simpleHash(str: string): string {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16);
    }

    async isFileCorrupted(filePath: string): Promise<boolean> {
        try {
            const uri = URI.file(filePath);
            const stats = await this.fileService.stat(uri);
            if (stats.size === 0) {
                return true;
            }

            const content = await this.fileService.readFile(uri);

            if (filePath.endsWith('.json') || filePath.endsWith('.ai.memory')) {
                try {
                    JSON.parse(content.value.toString());
                } catch (parseError) {
                    return true;
                }

                const trimmed = content.value.toString().trim();
                if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            return true;
        }
    }

    async backupCorruptedFile(filePath: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.corrupted.${timestamp}`;

        try {
            const sourceUri = URI.file(filePath);
            const targetUri = URI.file(backupPath);
            await this.fileService.copy(sourceUri, targetUri);
            console.log(`Backed up corrupted file to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            throw new FileOperationError(`Failed to backup corrupted file: ${error}`, 0);
        }
    }

    sanitizeFilename(filename: string): string {
        let sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');

        const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        if (reserved.includes(sanitized.toUpperCase())) {
            sanitized = '_' + sanitized;
        }

        if (sanitized.length > 255) {
            sanitized = sanitized.substring(0, 255);
        }

        if (sanitized === '') {
            sanitized = 'unnamed_file';
        }

        return sanitized;
    }

    async getFileHash(filePath: string): Promise<string> {
        if (this.hashCache.has(filePath)) {
            return this.hashCache.get(filePath)!;
        }

        try {
            const uri = URI.file(filePath);
            const content = await this.fileService.readFile(uri);
            const hash = this.generateFileHash(content.value.toString());
            this.hashCache.set(filePath, hash);
            return hash;
        } catch (error) {
            throw new FileOperationError(`Failed to generate hash for file: ${error}`, 0);
        }
    }

    clearHashCache(): void {
        this.hashCache.clear();
    }

    removeFromHashCache(filePath: string): void {
        this.hashCache.delete(filePath);
    }
}

export { ValidationUtils };
export type { ValidationResult, JsonSchema };