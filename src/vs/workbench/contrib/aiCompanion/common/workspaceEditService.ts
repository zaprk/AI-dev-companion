/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IBulkEditService, ResourceTextEdit, ResourceFileEdit } from '../../../../editor/browser/services/bulkEditService.js';
import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IWorkspaceEditService = createDecorator<IWorkspaceEditService>('workspaceEditService');

export interface IWorkspaceEditService {
    readonly _serviceBrand: undefined;
    
    /**
     * Create a new file with content
     */
    createFile(relativePath: string, content: string, options?: { overwrite?: boolean }): Promise<void>;
    
    /**
     * Write content to an existing file
     */
    writeFile(relativePath: string, content: string): Promise<void>;
    
    /**
     * Delete a file
     */
    deleteFile(relativePath: string): Promise<void>;
    
    /**
     * Create a directory
     */
    createDirectory(relativePath: string): Promise<void>;
    
    /**
     * Apply multiple file operations atomically
     */
    applyEdits(edits: Array<{ type: 'create' | 'write' | 'delete'; path: string; content?: string; options?: any }>): Promise<void>;
}

export class WorkspaceEditService implements IWorkspaceEditService {
    declare readonly _serviceBrand: undefined;

    constructor(
        @IBulkEditService private readonly bulkEditService: IBulkEditService,
        @ILogService private readonly logService: ILogService,
        @IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
    ) {}

    /**
     * Create a new file with content
     */
    async createFile(relativePath: string, content: string, options: { overwrite?: boolean } = {}): Promise<void> {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error('No workspace root found');
            }

            const fileUri = URI.file(this.resolvePath(workspaceRoot, relativePath));
            
            // Create the file edit
            const fileEdit = new ResourceFileEdit(undefined, fileUri, {
                overwrite: options.overwrite || false
            });

            // Create the text edit to insert content
            const textEdit = new ResourceTextEdit(fileUri, {
                range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                text: content
            });

            // Apply the edits
            const result = await this.bulkEditService.apply([fileEdit, textEdit], {
                code: 'aiCompanion.createFile',
                quotableLabel: `Create file ${relativePath}`
            });

            if (!result.isApplied) {
                throw new Error(`Failed to create file ${relativePath}: ${result.ariaSummary}`);
            }

            this.logService.info(`AI Companion: Created file ${relativePath}`);
        } catch (error) {
            this.logService.error(`AI Companion: Failed to create file ${relativePath}`, error);
            throw error;
        }
    }

    /**
     * Write content to an existing file
     */
    async writeFile(relativePath: string, content: string): Promise<void> {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error('No workspace root found');
            }

            const fileUri = URI.file(this.resolvePath(workspaceRoot, relativePath));
            
            // Create a text edit that replaces the entire file content
            const textEdit = new ResourceTextEdit(fileUri, {
                range: { startLineNumber: 1, startColumn: 1, endLineNumber: Number.MAX_SAFE_INTEGER, endColumn: Number.MAX_SAFE_INTEGER },
                text: content
            });

            // Apply the edit
            const result = await this.bulkEditService.apply([textEdit], {
                code: 'aiCompanion.writeFile',
                quotableLabel: `Write to file ${relativePath}`
            });

            if (!result.isApplied) {
                throw new Error(`Failed to write to file ${relativePath}: ${result.ariaSummary}`);
            }

            this.logService.info(`AI Companion: Wrote to file ${relativePath}`);
        } catch (error) {
            this.logService.error(`AI Companion: Failed to write to file ${relativePath}`, error);
            throw error;
        }
    }

    /**
     * Delete a file
     */
    async deleteFile(relativePath: string): Promise<void> {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error('No workspace root found');
            }

            const fileUri = URI.file(this.resolvePath(workspaceRoot, relativePath));
            
            // Create a file edit to delete the file
            const fileEdit = new ResourceFileEdit(fileUri, undefined, {
                ignoreIfNotExists: true
            });

            // Apply the edit
            const result = await this.bulkEditService.apply([fileEdit], {
                code: 'aiCompanion.deleteFile',
                quotableLabel: `Delete file ${relativePath}`
            });

            if (!result.isApplied) {
                throw new Error(`Failed to delete file ${relativePath}: ${result.ariaSummary}`);
            }

            this.logService.info(`AI Companion: Deleted file ${relativePath}`);
        } catch (error) {
            this.logService.error(`AI Companion: Failed to delete file ${relativePath}`, error);
            throw error;
        }
    }

    /**
     * Create a directory
     */
    async createDirectory(relativePath: string): Promise<void> {
        try {
            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error('No workspace root found');
            }

            const dirUri = URI.file(this.resolvePath(workspaceRoot, relativePath));
            
            // Create a file edit to create the directory
            const fileEdit = new ResourceFileEdit(undefined, dirUri, {
                folder: true,
                overwrite: false
            });

            // Apply the edit
            const result = await this.bulkEditService.apply([fileEdit], {
                code: 'aiCompanion.createDirectory',
                quotableLabel: `Create directory ${relativePath}`
            });

            if (!result.isApplied) {
                throw new Error(`Failed to create directory ${relativePath}: ${result.ariaSummary}`);
            }

            this.logService.info(`AI Companion: Created directory ${relativePath}`);
        } catch (error) {
            this.logService.error(`AI Companion: Failed to create directory ${relativePath}`, error);
            throw error;
        }
    }

    /**
     * Apply multiple file operations atomically
     */
    async applyEdits(edits: Array<{ type: 'create' | 'write' | 'delete'; path: string; content?: string; options?: any }>): Promise<void> {
        try {
            console.log('🔍 DEBUG WorkspaceEditService.applyEdits called with:', {
                editCount: edits.length,
                edits: edits.map(e => ({ type: e.type, path: e.path, hasContent: !!e.content }))
            });

            const workspaceRoot = this.getWorkspaceRoot();
            if (!workspaceRoot) {
                throw new Error('No workspace root found');
            }

            console.log('🔍 DEBUG Workspace root:', workspaceRoot);

            const resourceEdits: Array<ResourceTextEdit | ResourceFileEdit> = [];

            for (const edit of edits) {
                const fileUri = URI.file(this.resolvePath(workspaceRoot, edit.path));
                console.log('🔍 DEBUG Processing edit:', {
                    type: edit.type,
                    path: edit.path,
                    resolvedPath: this.resolvePath(workspaceRoot, edit.path),
                    fileUri: fileUri.toString()
                });

                switch (edit.type) {
                    case 'create':
                        if (edit.content) {
                            // Create file with content
                            resourceEdits.push(
                                new ResourceFileEdit(undefined, fileUri, {
                                    overwrite: edit.options?.overwrite || false
                                }),
                                new ResourceTextEdit(fileUri, {
                                    range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                                    text: edit.content
                                })
                            );
                            console.log('🔍 DEBUG Added create file edit for:', edit.path);
                        } else {
                            // Create directory
                            resourceEdits.push(
                                new ResourceFileEdit(undefined, fileUri, {
                                    folder: true,
                                    overwrite: false
                                })
                            );
                            console.log('🔍 DEBUG Added create directory edit for:', edit.path);
                        }
                        break;

                    case 'write':
                        if (!edit.content) {
                            throw new Error(`Content is required for write operation: ${edit.path}`);
                        }
                        resourceEdits.push(
                            new ResourceTextEdit(fileUri, {
                                range: { startLineNumber: 1, startColumn: 1, endLineNumber: Number.MAX_SAFE_INTEGER, endColumn: Number.MAX_SAFE_INTEGER },
                                text: edit.content
                            })
                        );
                        console.log('🔍 DEBUG Added write file edit for:', edit.path);
                        break;

                    case 'delete':
                        resourceEdits.push(
                            new ResourceFileEdit(fileUri, undefined, {
                                ignoreIfNotExists: true
                            })
                        );
                        console.log('🔍 DEBUG Added delete file edit for:', edit.path);
                        break;
                }
            }

            console.log('🔍 DEBUG About to apply', resourceEdits.length, 'resource edits');

            // Apply all edits atomically
            const result = await this.bulkEditService.apply(resourceEdits, {
                code: 'aiCompanion.applyEdits',
                quotableLabel: `Apply ${edits.length} file operations`
            });

            console.log('🔍 DEBUG BulkEditService result:', {
                isApplied: result.isApplied,
                ariaSummary: result.ariaSummary
            });

            if (!result.isApplied) {
                throw new Error(`Failed to apply edits: ${result.ariaSummary}`);
            }

            this.logService.info(`AI Companion: Applied ${edits.length} file operations`);
            console.log('✅ Successfully applied', edits.length, 'file operations');
        } catch (error) {
            this.logService.error(`AI Companion: Failed to apply edits`, error);
            console.error('❌ WorkspaceEditService.applyEdits failed:', error);
            throw error;
        }
    }

    private getWorkspaceRoot(): string | null {
        const workspace = this.workspaceService.getWorkspace();
        if (!workspace || !workspace.folders.length) {
            return null;
        }
        return workspace.folders[0].uri.fsPath;
    }

    private resolvePath(workspaceRoot: string, relativePath: string): string {
        // Normalize path separators
        const normalizedPath = relativePath.replace(/[\/\\]/g, '/');
        return `${workspaceRoot}/${normalizedPath}`;
    }
}
