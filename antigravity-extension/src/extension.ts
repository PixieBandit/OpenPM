/**
 * OpenPM Bridge Extension for Antigravity IDE
 *
 * Creates a WebSocket server on port 51200 that allows OpenPM
 * to communicate with the IDE for task execution, file operations,
 * and terminal commands.
 */

import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';

const BRIDGE_PORT = 51200;

interface BridgeMessage {
    type: string;
    requestId: string;
    payload: any;
}

let wss: WebSocketServer | null = null;
let statusBarItem: vscode.StatusBarItem;
let connectedClients = 0;

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('[OpenPM Bridge] Activating extension...');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'openpm-bridge.status';
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('openpm-bridge.start', startServer),
        vscode.commands.registerCommand('openpm-bridge.stop', stopServer),
        vscode.commands.registerCommand('openpm-bridge.status', showStatus)
    );

    // Auto-start server
    startServer();
}

/**
 * Start the WebSocket server
 */
function startServer() {
    if (wss) {
        vscode.window.showInformationMessage('OpenPM Bridge is already running');
        return;
    }

    try {
        wss = new WebSocketServer({ port: BRIDGE_PORT });

        wss.on('connection', (ws: WebSocket) => {
            connectedClients++;
            updateStatusBar();
            console.log('[OpenPM Bridge] Client connected');

            ws.on('message', async (data: Buffer) => {
                try {
                    const msg: BridgeMessage = JSON.parse(data.toString());
                    console.log(`[OpenPM Bridge] Received: ${msg.type}`);
                    const response = await handleMessage(msg);
                    ws.send(JSON.stringify(response));
                } catch (e) {
                    console.error('[OpenPM Bridge] Message error:', e);
                    ws.send(JSON.stringify({
                        type: 'ERROR',
                        requestId: 'unknown',
                        payload: { error: String(e) }
                    }));
                }
            });

            ws.on('close', () => {
                connectedClients--;
                updateStatusBar();
                console.log('[OpenPM Bridge] Client disconnected');
            });

            ws.on('error', (err) => {
                console.error('[OpenPM Bridge] WebSocket error:', err);
            });
        });

        wss.on('error', (err) => {
            console.error('[OpenPM Bridge] Server error:', err);
            vscode.window.showErrorMessage(`OpenPM Bridge error: ${err.message}`);
        });

        updateStatusBar();
        vscode.window.showInformationMessage(`OpenPM Bridge active on port ${BRIDGE_PORT}`);
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to start OpenPM Bridge: ${e}`);
    }
}

/**
 * Stop the WebSocket server
 */
function stopServer() {
    if (wss) {
        wss.close();
        wss = null;
        connectedClients = 0;
        updateStatusBar();
        vscode.window.showInformationMessage('OpenPM Bridge stopped');
    }
}

/**
 * Show current status
 */
function showStatus() {
    const status = wss ? `Running on port ${BRIDGE_PORT} (${connectedClients} clients)` : 'Stopped';
    vscode.window.showInformationMessage(`OpenPM Bridge: ${status}`);
}

/**
 * Update status bar
 */
function updateStatusBar() {
    if (wss) {
        statusBarItem.text = `$(plug) OpenPM: ${connectedClients}`;
        statusBarItem.tooltip = `OpenPM Bridge running on port ${BRIDGE_PORT}\n${connectedClients} connected client(s)`;
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(debug-disconnect) OpenPM: Off';
        statusBarItem.tooltip = 'OpenPM Bridge is not running';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    statusBarItem.show();
}

/**
 * Handle incoming messages from OpenPM
 */
async function handleMessage(msg: BridgeMessage): Promise<BridgeMessage> {
    const { type, requestId, payload } = msg;

    try {
        switch (type) {
            case 'GET_CONTEXT':
                return {
                    type: 'CONTEXT',
                    requestId,
                    payload: await getWorkspaceContext()
                };

            case 'EXECUTE_TASK':
                return {
                    type: 'TASK_RESULT',
                    requestId,
                    payload: await executeTask(payload)
                };

            case 'RUN_COMMAND':
                return {
                    type: 'COMMAND_OUTPUT',
                    requestId,
                    payload: await runTerminalCommand(payload.command, payload.cwd)
                };

            case 'OPEN_FILE':
                return {
                    type: 'EDIT_APPLIED',
                    requestId,
                    payload: await openFile(payload.filePath, payload.line)
                };

            case 'APPLY_EDIT':
                return {
                    type: 'EDIT_APPLIED',
                    requestId,
                    payload: await applyEdit(payload.filePath, payload.edits)
                };

            case 'GET_DIAGNOSTICS':
                return {
                    type: 'DIAGNOSTICS',
                    requestId,
                    payload: await getDiagnostics(payload.filePath)
                };

            default:
                return {
                    type: 'ERROR',
                    requestId,
                    payload: { error: `Unknown message type: ${type}` }
                };
        }
    } catch (e) {
        return {
            type: 'ERROR',
            requestId,
            payload: { error: String(e) }
        };
    }
}

/**
 * Get current workspace context
 */
async function getWorkspaceContext() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const activeEditor = vscode.window.activeTextEditor;

    return {
        workspace: workspaceFolders?.[0]?.uri.fsPath || null,
        activeFile: activeEditor?.document.uri.fsPath || null,
        openFiles: vscode.workspace.textDocuments
            .filter(doc => doc.uri.scheme === 'file')
            .map(doc => doc.uri.fsPath),
        gitBranch: await getGitBranch()
    };
}

/**
 * Get current git branch
 */
async function getGitBranch(): Promise<string | undefined> {
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension) {
            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories[0];
            return repo?.state?.HEAD?.name;
        }
    } catch (e) {
        console.error('[OpenPM Bridge] Git error:', e);
    }
    return undefined;
}

/**
 * Execute a task (placeholder for Antigravity AI integration)
 */
async function executeTask(payload: { task: any; context: any[] }) {
    const { task } = payload;

    // Log the task for now
    console.log('[OpenPM Bridge] Task received:', task.title);

    // TODO: Integrate with Antigravity's AI agent
    // For now, return acknowledgment
    return {
        success: true,
        output: `Task "${task.title}" received by Antigravity IDE.\nCategory: ${task.category}\nPriority: ${task.priority}`,
        filesChanged: [],
        errors: []
    };
}

/**
 * Run a terminal command
 */
async function runTerminalCommand(command: string, cwd?: string): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve) => {
        const cp = require('child_process');
        const workDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        cp.exec(command, { cwd: workDir, maxBuffer: 1024 * 1024 }, (error: any, stdout: string, stderr: string) => {
            resolve({
                output: stdout + stderr,
                exitCode: error ? error.code || 1 : 0
            });
        });
    });
}

/**
 * Open a file in the editor
 */
async function openFile(filePath: string, line?: number): Promise<{ success: boolean; filePath: string }> {
    try {
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);

        if (line !== undefined && line > 0) {
            const position = new vscode.Position(line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
        }

        return { success: true, filePath };
    } catch (e) {
        return { success: false, filePath };
    }
}

/**
 * Apply edits to a file
 */
async function applyEdit(filePath: string, edits: Array<{
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
    newText: string;
}>): Promise<{ success: boolean; filePath: string }> {
    try {
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);

        const success = await editor.edit(editBuilder => {
            for (const edit of edits) {
                const range = new vscode.Range(
                    edit.startLine - 1, edit.startCol,
                    edit.endLine - 1, edit.endCol
                );
                editBuilder.replace(range, edit.newText);
            }
        });

        if (success) {
            await doc.save();
        }

        return { success, filePath };
    } catch (e) {
        console.error('[OpenPM Bridge] Apply edit error:', e);
        return { success: false, filePath };
    }
}

/**
 * Get diagnostics (errors/warnings) from the IDE
 */
async function getDiagnostics(filePath?: string): Promise<{ diagnostics: any[] }> {
    const diagnostics: any[] = [];

    const collections = filePath
        ? [vscode.Uri.file(filePath)]
        : vscode.workspace.textDocuments.map(doc => doc.uri);

    for (const uri of collections) {
        const diags = vscode.languages.getDiagnostics(uri);
        for (const diag of diags) {
            diagnostics.push({
                file: uri.fsPath,
                line: diag.range.start.line + 1,
                column: diag.range.start.character,
                severity: getSeverityString(diag.severity),
                message: diag.message,
                source: diag.source
            });
        }
    }

    return { diagnostics };
}

/**
 * Convert severity enum to string
 */
function getSeverityString(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
        case vscode.DiagnosticSeverity.Error: return 'error';
        case vscode.DiagnosticSeverity.Warning: return 'warning';
        case vscode.DiagnosticSeverity.Information: return 'info';
        case vscode.DiagnosticSeverity.Hint: return 'info';
        default: return 'info';
    }
}

/**
 * Deactivate the extension
 */
export function deactivate() {
    stopServer();
}
