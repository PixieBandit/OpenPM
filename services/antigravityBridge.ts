/**
 * Antigravity IDE Bridge
 *
 * Connects OpenPM to Antigravity IDE via WebSocket, allowing Nova to delegate
 * code tasks to the IDE's built-in AI agent for real file editing and testing.
 */

import { Task, ProjectDoc } from '../types';

const BRIDGE_PORT = 51200;
const BRIDGE_URL = `ws://localhost:${BRIDGE_PORT}`;
const CONNECTION_TIMEOUT = 5000;
const TASK_TIMEOUT = 300000; // 5 minutes

// Message types for bridge protocol
export type BridgeMessageType =
    | 'EXECUTE_TASK'
    | 'GET_CONTEXT'
    | 'APPLY_EDIT'
    | 'RUN_COMMAND'
    | 'OPEN_FILE'
    | 'GET_DIAGNOSTICS'
    | 'TASK_RESULT'
    | 'CONTEXT'
    | 'EDIT_APPLIED'
    | 'COMMAND_OUTPUT'
    | 'DIAGNOSTICS'
    | 'ERROR';

interface BridgeMessage {
    type: BridgeMessageType;
    requestId: string;
    payload: any;
}

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

interface IdeContext {
    workspace: string | null;
    activeFile: string | null;
    openFiles: string[];
    gitBranch?: string;
}

interface TaskResult {
    success: boolean;
    output?: string;
    filesChanged?: string[];
    errors?: string[];
}

interface Diagnostic {
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    source?: string;
}

class AntigravityBridge {
    private ws: WebSocket | null = null;
    private connected = false;
    private connecting = false;
    private pendingRequests = new Map<string, PendingRequest>();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();

    /**
     * Connect to Antigravity IDE
     */
    async connect(): Promise<boolean> {
        if (this.connected) return true;
        if (this.connecting) return false;

        this.connecting = true;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.connecting = false;
                resolve(false);
            }, CONNECTION_TIMEOUT);

            try {
                this.ws = new WebSocket(BRIDGE_URL);

                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    this.connected = true;
                    this.connecting = false;
                    this.reconnectAttempts = 0;
                    console.log('[AntigravityBridge] Connected to IDE');
                    this.emit('connected', {});
                    resolve(true);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: BridgeMessage = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (e) {
                        console.error('[AntigravityBridge] Failed to parse message:', e);
                    }
                };

                this.ws.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('[AntigravityBridge] Connection error:', error);
                    this.connected = false;
                    this.connecting = false;
                    resolve(false);
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    this.connecting = false;
                    console.log('[AntigravityBridge] Disconnected from IDE');
                    this.emit('disconnected', {});
                    this.rejectAllPending('Connection closed');
                };
            } catch (e) {
                clearTimeout(timeout);
                this.connecting = false;
                resolve(false);
            }
        });
    }

    /**
     * Disconnect from Antigravity IDE
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.rejectAllPending('Disconnected');
    }

    /**
     * Check if connected to IDE
     */
    isConnected(): boolean {
        return this.connected && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Execute a task using Antigravity's AI agent
     */
    async executeTask(task: Task, docs: ProjectDoc[]): Promise<TaskResult> {
        if (!this.isConnected()) {
            throw new Error('Not connected to Antigravity IDE');
        }

        return this.sendRequest('EXECUTE_TASK', {
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                category: task.category,
                priority: task.priority
            },
            context: docs.slice(0, 10).map(d => ({
                title: d.title,
                content: d.content.substring(0, 5000), // Limit context size
                category: d.category
            }))
        }, TASK_TIMEOUT);
    }

    /**
     * Get current IDE workspace context
     */
    async getIdeContext(): Promise<IdeContext> {
        if (!this.isConnected()) {
            throw new Error('Not connected to Antigravity IDE');
        }

        return this.sendRequest('GET_CONTEXT', {});
    }

    /**
     * Apply code edits to a file in the IDE
     */
    async applyEdit(filePath: string, edits: Array<{
        startLine: number;
        startCol: number;
        endLine: number;
        endCol: number;
        newText: string;
    }>): Promise<{ success: boolean; filePath: string }> {
        if (!this.isConnected()) {
            throw new Error('Not connected to Antigravity IDE');
        }

        return this.sendRequest('APPLY_EDIT', { filePath, edits });
    }

    /**
     * Run a terminal command in the IDE
     */
    async runCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
        if (!this.isConnected()) {
            throw new Error('Not connected to Antigravity IDE');
        }

        return this.sendRequest('RUN_COMMAND', { command, cwd }, 60000);
    }

    /**
     * Open a file in the IDE editor
     */
    async openFile(filePath: string, line?: number): Promise<boolean> {
        if (!this.isConnected()) {
            throw new Error('Not connected to Antigravity IDE');
        }

        const result = await this.sendRequest('OPEN_FILE', { filePath, line });
        return result.success;
    }

    /**
     * Get diagnostics (errors/warnings) from the IDE
     */
    async getDiagnostics(filePath?: string): Promise<Diagnostic[]> {
        if (!this.isConnected()) {
            throw new Error('Not connected to Antigravity IDE');
        }

        const result = await this.sendRequest('GET_DIAGNOSTICS', { filePath });
        return result.diagnostics || [];
    }

    /**
     * Subscribe to bridge events
     */
    on(event: string, callback: (data: any) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    /**
     * Emit an event to listeners
     */
    private emit(event: string, data: any): void {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error('[AntigravityBridge] Event handler error:', e);
            }
        });
    }

    /**
     * Send a request and wait for response
     */
    private sendRequest<T>(type: BridgeMessageType, payload: any, timeout = 30000): Promise<T> {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();

            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request ${type} timed out`));
            }, timeout);

            this.pendingRequests.set(requestId, {
                resolve: resolve as (value: any) => void,
                reject,
                timeout: timeoutHandle
            });

            const message: BridgeMessage = {
                type,
                requestId,
                payload
            };

            this.ws?.send(JSON.stringify(message));
        });
    }

    /**
     * Handle incoming messages from IDE
     */
    private handleMessage(message: BridgeMessage): void {
        const { requestId, type, payload } = message;

        // Check for pending request
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(requestId);

            if (type === 'ERROR') {
                pending.reject(new Error(payload.error || 'Unknown error'));
            } else {
                pending.resolve(payload);
            }
            return;
        }

        // Handle unsolicited messages (events from IDE)
        switch (type) {
            case 'DIAGNOSTICS':
                this.emit('diagnostics', payload);
                break;
            default:
                console.log('[AntigravityBridge] Unhandled message:', type);
        }
    }

    /**
     * Reject all pending requests
     */
    private rejectAllPending(reason: string): void {
        this.pendingRequests.forEach((pending, id) => {
            clearTimeout(pending.timeout);
            pending.reject(new Error(reason));
        });
        this.pendingRequests.clear();
    }
}

// Export singleton instance
export const antigravityBridge = new AntigravityBridge();

// Export types for consumers
export type { IdeContext, TaskResult, Diagnostic };
