import { IStateManager, IAICompanionState, IAIConversation, ConversationState, IUIState } from '../../common/aiCompanionServiceTokens.js';
import { IPerformanceMonitor } from '../../common/aiCompanionServiceTokens.js';
import { IErrorHandler } from '../../common/aiCompanionServiceTokens.js';


import { Event, Emitter } from '../../../../../base/common/event.js';

export class StateManager implements IStateManager {
    readonly _serviceBrand: undefined;

    private _onStateChange = new Emitter<IAICompanionState>();
    readonly onStateChange: Event<IAICompanionState> = this._onStateChange.event;

    private _onConversationChange = new Emitter<IAIConversation>();
    readonly onConversationChange: Event<IAIConversation> = this._onConversationChange.event;

    private _onUIStateChange = new Emitter<IUIState>();
    readonly onUIStateChange: Event<IUIState> = this._onUIStateChange.event;

    private state: IAICompanionState = {
        conversations: [],
        conversationOrder: [],
        currentConversationId: null,
        maxConversations: 50,
        ui: {
            isTyping: false,
            isInitializing: false,
            isConnected: false
        },
        performance: {
            lastRequestTime: 0,
            averageResponseTime: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0
        },
        connectionStatus: {
            isConnected: false,
            isHealthy: false,
            lastHealthCheck: 0,
            connectionId: '',
            errorCount: 0,
            latency: 0,
            health: 'unknown'
        }
    };

    constructor(
        @IPerformanceMonitor private readonly performanceMonitor: IPerformanceMonitor,
        @IErrorHandler private readonly errorHandler: IErrorHandler
    ) {
        this.loadStateFromStorage();
    }

    getState(): IAICompanionState {
        return { ...this.state };
    }

    updateState(updates: Partial<IAICompanionState>): void {
        const timer = this.performanceMonitor.startTimer('state-update');
        
        try {
            // Deep merge the updates
            this.state = this.deepMerge(this.state, updates);
            
            // Emit state change event
            this._onStateChange.fire(this.state);
            
            // Save to storage
            this.saveStateToStorage();
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'State update');
        }
    }

    updateUIState(updates: Partial<IUIState>): void {
        const timer = this.performanceMonitor.startTimer('ui-state-update');
        
        try {
            this.state.ui = { ...this.state.ui, ...updates };
            
            // Emit UI state change event
            this._onUIStateChange.fire(this.state.ui);
            
            // Emit general state change event
            this._onStateChange.fire(this.state);
            
            // Save to storage
            this.saveStateToStorage();
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'UI state update');
        }
    }

    // Conversation management
    createConversation(id: string): IAIConversation {
        const timer = this.performanceMonitor.startTimer('conversation-creation');
        
        try {
            const conversation: IAIConversation = {
                id,
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                state: ConversationState.Idle
            };

            this.state.conversations.push(conversation);
            this.state.conversationOrder.unshift(id); // Add to beginning
            this.state.currentConversationId = id;

            // Limit number of conversations
            if (this.state.conversationOrder.length > this.state.maxConversations) {
                const oldestId = this.state.conversationOrder.pop();
                if (oldestId) {
                    const index = this.state.conversations.findIndex(c => c.id === oldestId);
                    if (index !== -1) {
                        this.state.conversations.splice(index, 1);
                    }
                }
            }

            this._onConversationChange.fire(conversation);
            this._onStateChange.fire(this.state);
            this.saveStateToStorage();
            
            timer();
            return conversation;
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Conversation creation');
            throw error;
        }
    }

    getConversation(id: string): IAIConversation | null {
        const conversation = this.state.conversations.find(c => c.id === id);
        return conversation || null;
    }

    getCurrentConversation(): IAIConversation | null {
        if (!this.state.currentConversationId) {
            return null;
        }
        const conversation = this.state.conversations.find(c => c.id === this.state.currentConversationId);
        return conversation || null;
    }

    getAllConversations(): IAIConversation[] {
        return [...this.state.conversations]
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    updateConversation(id: string, updates: Partial<IAIConversation>): void {
        const timer = this.performanceMonitor.startTimer('conversation-update');
        
        try {
            const index = this.state.conversations.findIndex(c => c.id === id);
            if (index === -1) {
                throw new Error(`Conversation ${id} not found`);
            }

            const conversation = this.state.conversations[index];
            const updatedConversation = { ...conversation, ...updates, updatedAt: Date.now() };
            this.state.conversations[index] = updatedConversation;

            // Move to front of order
            const orderIndex = this.state.conversationOrder.indexOf(id);
            if (orderIndex > -1) {
                this.state.conversationOrder.splice(orderIndex, 1);
            }
            this.state.conversationOrder.unshift(id);

            this._onConversationChange.fire(updatedConversation);
            this._onStateChange.fire(this.state);
            this.saveStateToStorage();
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Conversation update');
        }
    }

    deleteConversation(id: string): void {
        const timer = this.performanceMonitor.startTimer('conversation-deletion');
        
        try {
            // Remove from conversations array
            const index = this.state.conversations.findIndex(c => c.id === id);
            if (index !== -1) {
                this.state.conversations.splice(index, 1);
            }
            
            // Remove from order
            const orderIndex = this.state.conversationOrder.indexOf(id);
            if (orderIndex > -1) {
                this.state.conversationOrder.splice(orderIndex, 1);
            }

            // If this was the current conversation, clear it
            if (this.state.currentConversationId === id) {
                this.state.currentConversationId = this.state.conversationOrder[0] || null;
            }

            this._onStateChange.fire(this.state);
            this.saveStateToStorage();
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Conversation deletion');
        }
    }

    setCurrentConversation(id: string): void {
        const timer = this.performanceMonitor.startTimer('current-conversation-set');
        
        try {
            const conversation = this.state.conversations.find(c => c.id === id);
            if (!conversation) {
                throw new Error(`Conversation ${id} not found`);
            }

            this.state.currentConversationId = id;
            
            // Move to front of order
            const orderIndex = this.state.conversationOrder.indexOf(id);
            if (orderIndex > -1) {
                this.state.conversationOrder.splice(orderIndex, 1);
            }
            this.state.conversationOrder.unshift(id);

            this._onStateChange.fire(this.state);
            this.saveStateToStorage();
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Current conversation set');
        }
    }

    clearAllConversations(): void {
        const timer = this.performanceMonitor.startTimer('conversations-clear');
        
        try {
            this.state.conversations = [];
            this.state.conversationOrder = [];
            this.state.currentConversationId = null;

            this._onStateChange.fire(this.state);
            this.saveStateToStorage();
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Conversations clear');
        }
    }

    // Performance tracking
    updatePerformanceMetrics(metrics: Partial<IAICompanionState['performance']>): void {
        const timer = this.performanceMonitor.startTimer('performance-metrics-update');
        
        try {
            this.state.performance = { ...this.state.performance, ...metrics };
            this._onStateChange.fire(this.state);
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Performance metrics update');
        }
    }

    // Connection status
    updateConnectionStatus(status: Partial<IAICompanionState['connectionStatus']>): void {
        const timer = this.performanceMonitor.startTimer('connection-status-update');
        
        try {
            this.state.connectionStatus = { ...this.state.connectionStatus, ...status };
            this.state.ui.isConnected = status.isConnected ?? this.state.ui.isConnected;
            
            this._onStateChange.fire(this.state);
            this._onUIStateChange.fire(this.state.ui);
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'Connection status update');
        }
    }

    // Storage management
    private saveStateToStorage(): void {
        try {
            const stateToSave = {
                conversations: this.state.conversations,
                conversationOrder: this.state.conversationOrder,
                currentConversationId: this.state.currentConversationId,
                ui: this.state.ui,
                performance: this.state.performance
            };

            localStorage.setItem('aiCompanionState', JSON.stringify(stateToSave));
        } catch (error) {
            this.errorHandler.handleError(error as Error, 'State save to storage');
        }
    }

    private loadStateFromStorage(): void {
        try {
            const savedState = localStorage.getItem('aiCompanionState');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                
                // Restore conversations (handle both old Map format and new array format)
                if (parsed.conversations) {
                    if (Array.isArray(parsed.conversations)) {
                        // New format: array of conversations
                        this.state.conversations = parsed.conversations;
                    } else if (Array.isArray(parsed.conversations) && parsed.conversations.length > 0 && Array.isArray(parsed.conversations[0])) {
                        // Old format: array of [key, value] pairs from Map
                        this.state.conversations = parsed.conversations.map(([_, conversation]: [string, any]) => conversation);
                    } else {
                        // Fallback: empty array
                        this.state.conversations = [];
                    }
                }
                
                // Restore other state
                this.state.conversationOrder = parsed.conversationOrder || [];
                this.state.currentConversationId = parsed.currentConversationId || null;
                this.state.ui = { ...this.state.ui, ...parsed.ui };
                this.state.performance = { ...this.state.performance, ...parsed.performance };
            }
        } catch (error) {
            this.errorHandler.handleError(error as Error, 'State load from storage');
        }
    }

    // Utility methods
    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    getStateSnapshot(): {
        totalConversations: number;
        currentConversationId?: string;
        isConnected: boolean;
        isTyping: boolean;
        performance: IAICompanionState['performance'];
    } {
        return {
            totalConversations: this.state.conversations.length,
            currentConversationId: this.state.currentConversationId || undefined,
            isConnected: this.state.ui.isConnected,
            isTyping: this.state.ui.isTyping,
            performance: this.state.performance
        };
    }

    resetState(): void {
        const timer = this.performanceMonitor.startTimer('state-reset');
        
        try {
            this.state = {
                conversations: [],
                conversationOrder: [],
                currentConversationId: null,
                maxConversations: 50,
                ui: {
                    isTyping: false,
                    isInitializing: false,
                    isConnected: false
                },
                performance: {
                    lastRequestTime: 0,
                    averageResponseTime: 0,
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0
                },
                connectionStatus: {
                    isConnected: false,
                    isHealthy: false,
                    lastHealthCheck: 0,
                    connectionId: '',
                    errorCount: 0,
                    latency: 0,
                    health: 'unknown'
                }
            };

            this._onStateChange.fire(this.state);
            this._onUIStateChange.fire(this.state.ui);
            this.saveStateToStorage();
            
            timer();
        } catch (error) {
            timer();
            this.errorHandler.handleError(error as Error, 'State reset');
        }
    }

    dispose(): void {
        this._onStateChange.dispose();
        this._onConversationChange.dispose();
        this._onUIStateChange.dispose();
    }
}

 