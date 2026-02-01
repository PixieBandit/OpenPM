# OpenPM Improvements & Antigravity IDE Bridge Design

## Part 1: Additional Improvements

### Performance Optimizations

1. **Memoize expensive computations**
   - `AIAgent.tsx:43-58` - FormattedMessage regex runs every render
   - `TaskBoard.tsx` - getBugCountForTask is O(n*m), should use a Map lookup

2. **Virtualize long lists**
   - Message history in AIAgent can grow large
   - Log lists in Spark/Quartz panels
   - Consider `react-window` or `@tanstack/virtual`

3. **Debounce autosave**
   - Currently saves on every keystroke in docs
   - Add 500ms debounce to reduce disk writes

### Code Quality

4. **Remove unused props**
   ```tsx
   // Dashboard.tsx - remove 'report' prop (never used)
   // AIAgent.tsx - remove 'testerState' prop (never used)
   // ProjectDocs.tsx - remove 'onRevertDoc' prop (never invoked)
   ```

5. **Type safety improvements**
   ```typescript
   // App.tsx:25 - Replace any[] with proper Risk interface
   risks: Risk[]

   // AIAgent.tsx:13 - Type the suggested tasks
   onSuggestTasks: (suggested: Task[]) => void
   ```

6. **Add error boundaries**
   - Wrap each major component (AIAgent, TaskBoard, ProjectDocs)
   - Prevent full app crash on component errors

### UX Improvements

7. **Add loading states**
   - Show skeleton loaders while fetching models
   - Progress indicator for long-running operations

8. **Keyboard shortcuts**
   - Ctrl+Enter to send message
   - Ctrl+K for command palette
   - Esc to close modals

9. **Offline support**
   - Queue messages when offline
   - Show connection status indicator

---

## Part 2: Antigravity IDE Bridge Architecture

### Overview

Create a bridge that allows Nova to delegate code tasks to Antigravity's built-in AI agent as an alternative to Spark. This enables:
- Real file editing in the IDE
- Access to Antigravity's code context
- Actual code execution and testing

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenPM (Browser)                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │  Nova   │───▶│ Router  │───▶│  Spark  │    │ Quartz  │      │
│  │   PM    │    │         │    │ (Local) │    │   QA    │      │
│  └─────────┘    │         │    └─────────┘    └─────────┘      │
│                 │         │           │                         │
│                 │         │    ┌──────▼──────┐                  │
│                 │         │───▶│  Antigravity │                  │
│                 │         │    │   Bridge    │                  │
│                 └─────────┘    └──────┬──────┘                  │
└────────────────────────────────────────│────────────────────────┘
                                         │ WebSocket/HTTP
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Antigravity IDE (VS Code Fork)                │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  OpenPM Bridge  │◀──▶│  Antigravity AI │                     │
│  │   Extension     │    │     Agent       │                     │
│  └─────────────────┘    └─────────────────┘                     │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────────────────────────────┐                    │
│  │              Active Project              │                    │
│  │         (Real Files & Context)           │                    │
│  └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Components

#### 1. Antigravity Extension (VS Code Extension)

Create a VS Code extension that runs inside Antigravity IDE:

```typescript
// extension/src/extension.ts
import * as vscode from 'vscode';
import { WebSocketServer } from 'ws';

const PORT = 51200;
let wss: WebSocketServer;

export function activate(context: vscode.ExtensionContext) {
    // Start WebSocket server for OpenPM communication
    wss = new WebSocketServer({ port: PORT });

    wss.on('connection', (ws) => {
        console.log('[OpenPM Bridge] Connected');

        ws.on('message', async (data) => {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'EXECUTE_TASK':
                    await handleExecuteTask(message.payload, ws);
                    break;
                case 'GET_CONTEXT':
                    await handleGetContext(ws);
                    break;
                case 'APPLY_EDIT':
                    await handleApplyEdit(message.payload, ws);
                    break;
                case 'RUN_COMMAND':
                    await handleRunCommand(message.payload, ws);
                    break;
            }
        });
    });

    vscode.window.showInformationMessage('OpenPM Bridge Active on port ' + PORT);
}

async function handleExecuteTask(payload: any, ws: WebSocket) {
    const { task, context } = payload;

    // Use Antigravity's built-in AI to process the task
    // This leverages the IDE's code understanding
    const result = await vscode.commands.executeCommand(
        'antigravity.processTask',
        {
            instruction: task.description,
            context: context,
            mode: 'code-generation'
        }
    );

    ws.send(JSON.stringify({
        type: 'TASK_RESULT',
        payload: result
    }));
}

async function handleGetContext(ws: WebSocket) {
    // Get current workspace context
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const activeEditor = vscode.window.activeTextEditor;

    const context = {
        workspace: workspaceFolders?.[0]?.uri.fsPath,
        activeFile: activeEditor?.document.uri.fsPath,
        activeSelection: activeEditor?.selection,
        openFiles: vscode.window.tabGroups.all
            .flatMap(g => g.tabs)
            .map(t => (t.input as any)?.uri?.fsPath)
            .filter(Boolean)
    };

    ws.send(JSON.stringify({
        type: 'CONTEXT',
        payload: context
    }));
}

async function handleApplyEdit(payload: any, ws: WebSocket) {
    const { filePath, edits } = payload;

    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    await editor.edit(editBuilder => {
        for (const edit of edits) {
            const range = new vscode.Range(
                edit.startLine, edit.startCol,
                edit.endLine, edit.endCol
            );
            editBuilder.replace(range, edit.newText);
        }
    });

    await document.save();

    ws.send(JSON.stringify({
        type: 'EDIT_APPLIED',
        payload: { success: true, filePath }
    }));
}
```

#### 2. OpenPM Bridge Service

Add to the OpenPM services:

```typescript
// services/antigravityBridge.ts
import { Task, ProjectDoc } from '../types';

const BRIDGE_URL = 'ws://localhost:51200';

class AntigravityBridge {
    private ws: WebSocket | null = null;
    private connected = false;
    private pendingRequests = new Map<string, {
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }>();

    async connect(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                this.ws = new WebSocket(BRIDGE_URL);

                this.ws.onopen = () => {
                    this.connected = true;
                    console.log('[Bridge] Connected to Antigravity IDE');
                    resolve(true);
                };

                this.ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                };

                this.ws.onerror = () => {
                    this.connected = false;
                    resolve(false);
                };

                this.ws.onclose = () => {
                    this.connected = false;
                };
            } catch (e) {
                resolve(false);
            }
        });
    }

    isConnected(): boolean {
        return this.connected;
    }

    async executeTask(task: Task, docs: ProjectDoc[]): Promise<any> {
        const requestId = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            this.ws?.send(JSON.stringify({
                type: 'EXECUTE_TASK',
                requestId,
                payload: {
                    task: {
                        id: task.id,
                        title: task.title,
                        description: task.description,
                        category: task.category
                    },
                    context: docs.map(d => ({
                        title: d.title,
                        content: d.content,
                        category: d.category
                    }))
                }
            }));

            // Timeout after 5 minutes
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Task execution timeout'));
                }
            }, 300000);
        });
    }

    async getIdeContext(): Promise<any> {
        const requestId = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            this.ws?.send(JSON.stringify({
                type: 'GET_CONTEXT',
                requestId
            }));
        });
    }

    async applyEdit(filePath: string, edits: any[]): Promise<boolean> {
        const requestId = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            this.ws?.send(JSON.stringify({
                type: 'APPLY_EDIT',
                requestId,
                payload: { filePath, edits }
            }));
        });
    }

    private handleMessage(message: any) {
        const { requestId, type, payload } = message;

        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            this.pendingRequests.delete(requestId);

            if (type.includes('ERROR')) {
                pending.reject(new Error(payload.error));
            } else {
                pending.resolve(payload);
            }
        }
    }
}

export const antigravityBridge = new AntigravityBridge();
```

#### 3. Update WorkflowConfig

Add Antigravity as an execution target:

```typescript
// types.ts - Add to WorkflowConfig
interface WorkflowConfig {
    // ... existing fields

    // Code execution target
    codeExecutor: 'SPARK' | 'ANTIGRAVITY' | 'HYBRID';

    // Antigravity-specific settings
    antigravitySettings: {
        enabled: boolean;
        autoConnect: boolean;
        preferForFileEdits: boolean;  // Use Antigravity for actual file changes
        syncProjectContext: boolean;  // Sync docs with IDE workspace
    };
}
```

#### 4. Router Component

Add routing logic to decide where to send tasks:

```typescript
// services/taskRouter.ts
import { Task, ProjectDoc, WorkflowConfig } from '../types';
import { suggestNewTasks } from './gemini';
import { antigravityBridge } from './antigravityBridge';

export async function routeTask(
    task: Task,
    docs: ProjectDoc[],
    config: WorkflowConfig
): Promise<{ executor: string; result: any }> {

    // Determine best executor based on task type and config
    const shouldUseAntigravity =
        config.codeExecutor === 'ANTIGRAVITY' ||
        (config.codeExecutor === 'HYBRID' && isFileEditTask(task));

    if (shouldUseAntigravity && antigravityBridge.isConnected()) {
        try {
            const result = await antigravityBridge.executeTask(task, docs);
            return { executor: 'ANTIGRAVITY', result };
        } catch (e) {
            console.warn('[Router] Antigravity failed, falling back to Spark');
        }
    }

    // Fallback to Spark
    const result = await suggestNewTasks(task.title, task.description, docs, config);
    return { executor: 'SPARK', result };
}

function isFileEditTask(task: Task): boolean {
    const editKeywords = ['implement', 'create', 'add', 'fix', 'refactor', 'update'];
    const title = task.title.toLowerCase();
    return editKeywords.some(kw => title.includes(kw));
}
```

#### 5. UI Integration

Add Antigravity status to the BIOS settings:

```tsx
// In AIAgent.tsx BIOS panel, add new section:

<Section id="antigravity" title="Antigravity IDE Bridge">
    <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                    antigravityConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'
                }`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    IDE Connection
                </span>
            </div>
            <button
                onClick={handleConnectAntigravity}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase rounded-lg"
            >
                {antigravityConnected ? 'Connected' : 'Connect'}
            </button>
        </div>

        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Code Execution Target
            </label>
            <div className="grid grid-cols-3 gap-2">
                {['SPARK', 'ANTIGRAVITY', 'HYBRID'].map(mode => (
                    <button
                        key={mode}
                        onClick={() => setConfig({ ...config, codeExecutor: mode })}
                        disabled={mode !== 'SPARK' && !antigravityConnected}
                        className={`p-3 rounded-xl border text-[10px] font-bold uppercase ${
                            config.codeExecutor === mode
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                        } disabled:opacity-50`}
                    >
                        {mode}
                    </button>
                ))}
            </div>
            <p className="text-[9px] text-slate-600 mt-2">
                SPARK: Local AI generation | ANTIGRAVITY: IDE agent | HYBRID: Auto-select
            </p>
        </div>
    </div>
</Section>
```

### Message Protocol

```typescript
// Shared types for bridge communication
interface BridgeMessage {
    type: MessageType;
    requestId: string;
    payload: any;
}

type MessageType =
    // Requests (OpenPM → Antigravity)
    | 'EXECUTE_TASK'      // Run a task using IDE's AI
    | 'GET_CONTEXT'       // Get current workspace context
    | 'APPLY_EDIT'        // Apply code changes to files
    | 'RUN_COMMAND'       // Run terminal command
    | 'OPEN_FILE'         // Open file in editor
    | 'GET_DIAGNOSTICS'   // Get linting/type errors

    // Responses (Antigravity → OpenPM)
    | 'TASK_RESULT'       // Task execution result
    | 'CONTEXT'           // Workspace context
    | 'EDIT_APPLIED'      // Edit confirmation
    | 'COMMAND_OUTPUT'    // Terminal output
    | 'DIAGNOSTICS'       // Error/warning list
    | 'ERROR';            // Error response

interface TaskPayload {
    task: {
        id: string;
        title: string;
        description: string;
        category: string;
    };
    context: Array<{
        title: string;
        content: string;
        category: string;
    }>;
}

interface EditPayload {
    filePath: string;
    edits: Array<{
        startLine: number;
        startCol: number;
        endLine: number;
        endCol: number;
        newText: string;
    }>;
}
```

### Benefits of This Architecture

1. **Real Code Execution**: Antigravity can actually edit files, run tests, and see real errors
2. **Better Context**: IDE has full project understanding, imports, types, etc.
3. **Fallback Safety**: If IDE disconnects, Spark continues to work
4. **Hybrid Mode**: Nova decides best executor based on task type
5. **Bidirectional Sync**: Project docs can sync with IDE workspace
6. **Live Diagnostics**: Get real TypeScript/linting errors back to Quartz

### Implementation Priority

1. Create the VS Code extension package structure
2. Implement WebSocket bridge in OpenPM
3. Add connection status to UI
4. Implement basic EXECUTE_TASK flow
5. Add APPLY_EDIT for real file changes
6. Integrate with Quartz for diagnostics feedback
