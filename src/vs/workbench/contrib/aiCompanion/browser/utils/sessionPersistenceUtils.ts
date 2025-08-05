import * as vscode from 'vscode';
import { IAIConversation, IAIMessage } from '../../common/aiCompanionService.js';

export class SessionPersistenceUtils {
    private static readonly STORAGE_KEY_PREFIX = 'ai_companion_';
    private static readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

    static async saveSessionState(
        sessionId: string,
        conversation: IAIConversation,
        context: vscode.ExtensionContext
    ): Promise<void> {
        try {
            const storageKey = `${this.STORAGE_KEY_PREFIX}session_${sessionId}`;
            const serializedState = JSON.stringify({
                conversation,
                timestamp: Date.now(),
                version: '1.0'
            });

            // Check storage size
            if (serializedState.length > this.MAX_STORAGE_SIZE) {
                console.warn('Session state too large, pruning...');
                const prunedState = this.pruneStateForStorage(conversation);
                await context.globalState.update(storageKey, prunedState);
            } else {
                await context.globalState.update(storageKey, serializedState);
            }

            console.log(`✅ Session ${sessionId} state saved`);

        } catch (error) {
            console.error(`Failed to save session ${sessionId}:`, error);
            throw new Error(`Session persistence failed: ${error.message}`);
        }
    }

    static async restoreSessionState(
        sessionId: string,
        context: vscode.ExtensionContext
    ): Promise<IAIConversation | null> {
        try {
            const storageKey = `${this.STORAGE_KEY_PREFIX}session_${sessionId}`;
            const serializedState = context.globalState.get<string>(storageKey);

            if (!serializedState) return null;

            const state = JSON.parse(serializedState);
            
            // Validate state version and freshness
            if (this.isStateValid(state)) {
                console.log(`✅ Session ${sessionId} state restored`);
                return state.conversation;
            } else {
                console.warn(`❌ Session ${sessionId} state invalid, clearing`);
                await context.globalState.update(storageKey, undefined);
                return null;
            }

        } catch (error) {
            console.error(`Failed to restore session ${sessionId}:`, error);
            return null;
        }
    }

    static async saveWorkspaceState(
        workspaceUri: string,
        state: any,
        context: vscode.ExtensionContext
    ): Promise<void> {
        const workspaceKey = this.getWorkspaceKey(workspaceUri);
        const storageKey = `${this.STORAGE_KEY_PREFIX}workspace_${workspaceKey}`;

        await context.workspaceState.update(storageKey, {
            ...state,
            workspaceUri,
            lastUpdated: Date.now()
        });
    }

    static async restoreWorkspaceState(
        workspaceUri: string,
        context: vscode.ExtensionContext
    ): Promise<any | null> {
        const workspaceKey = this.getWorkspaceKey(workspaceUri);
        const storageKey = `${this.STORAGE_KEY_PREFIX}workspace_${workspaceKey}`;
        return context.workspaceState.get<any>(storageKey);
    }

    static async handleConflictResolution(
        localState: any,
        remoteState: any
    ): Promise<any> {
        // Simple last-write-wins with merge
        const mergedState = {
            ...localState,
            ...remoteState,
            messages: [
                ...(localState.messages || []),
                ...(remoteState.messages || [])
            ].sort((a: IAIMessage, b: IAIMessage) => a.timestamp - b.timestamp),
            mergedAt: Date.now()
        };

        return mergedState;
    }

    private static isStateValid(state: any): boolean {
        // Check version compatibility
        if (state.version !== '1.0') return false;
        
        // Check age (1 week max)
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 1 week
        if (Date.now() - state.timestamp > maxAge) return false;

        // Check required fields
        return state.conversation && state.conversation.messages;
    }

    private static pruneStateForStorage(conversation: IAIConversation): any {
        return {
            conversation: {
                ...conversation,
                messages: conversation.messages?.slice(-20), // Keep last 20 messages
            },
            timestamp: Date.now(),
            version: '1.0'
        };
    }

    private static getWorkspaceKey(workspaceUri: string): string {
        // Create stable key from workspace path
        return Buffer.from(workspaceUri).toString('base64').substring(0, 32);
    }
} 