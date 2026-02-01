/**
 * Task Router
 *
 * Decides whether to route code tasks to Spark (local AI) or Antigravity (IDE agent)
 * based on configuration and task characteristics.
 */

import { Task, ProjectDoc, WorkflowConfig } from '../types';
import { suggestNewTasks } from './gemini';
import { antigravityBridge, TaskResult } from './antigravityBridge';

export type ExecutorType = 'SPARK' | 'ANTIGRAVITY';
export type ExecutionMode = 'SPARK' | 'ANTIGRAVITY' | 'HYBRID';

interface RouteResult {
    executor: ExecutorType;
    result: any;
    success: boolean;
    error?: string;
}

// Keywords that indicate a task requires actual file manipulation
const FILE_EDIT_KEYWORDS = [
    'implement', 'create', 'add', 'fix', 'refactor', 'update', 'modify',
    'delete', 'remove', 'rename', 'move', 'write', 'edit', 'change'
];

// Keywords that indicate a task is planning/design only
const PLANNING_KEYWORDS = [
    'plan', 'design', 'architect', 'propose', 'suggest', 'analyze',
    'review', 'evaluate', 'research', 'investigate', 'document'
];

/**
 * Determine if a task requires actual file editing
 */
function isFileEditTask(task: Task): boolean {
    const text = `${task.title} ${task.description}`.toLowerCase();

    // Check for explicit file references
    const hasFileReference = /\.(ts|tsx|js|jsx|css|json|md|html)/.test(text);

    // Check for edit keywords
    const hasEditKeyword = FILE_EDIT_KEYWORDS.some(kw => text.includes(kw));

    // Check it's not just planning
    const isPlanningOnly = PLANNING_KEYWORDS.some(kw => text.startsWith(kw));

    return (hasFileReference || hasEditKeyword) && !isPlanningOnly;
}

/**
 * Determine if Antigravity should be used based on config and task
 */
function shouldUseAntigravity(task: Task, config: WorkflowConfig): boolean {
    // Check if Antigravity is configured
    const antigravityEnabled = config.codeExecutor === 'ANTIGRAVITY' ||
        config.codeExecutor === 'HYBRID';

    if (!antigravityEnabled) return false;

    // Check if bridge is connected
    if (!antigravityBridge.isConnected()) return false;

    // In HYBRID mode, use Antigravity only for file edit tasks
    if (config.codeExecutor === 'HYBRID') {
        return isFileEditTask(task);
    }

    // In ANTIGRAVITY mode, always use it
    return true;
}

/**
 * Route a task to the appropriate executor
 */
export async function routeTask(
    task: Task,
    novaOutput: string,
    docs: ProjectDoc[],
    config: WorkflowConfig
): Promise<RouteResult> {
    const useAntigravity = shouldUseAntigravity(task, config);

    if (useAntigravity) {
        try {
            console.log(`[TaskRouter] Routing task "${task.title}" to Antigravity`);

            const result = await antigravityBridge.executeTask(task, docs);

            return {
                executor: 'ANTIGRAVITY',
                result,
                success: result.success
            };
        } catch (error: any) {
            console.warn(`[TaskRouter] Antigravity failed: ${error.message}, falling back to Spark`);

            // Fall through to Spark
        }
    }

    // Use Spark (local AI)
    console.log(`[TaskRouter] Routing task "${task.title}" to Spark`);

    try {
        const result = await suggestNewTasks(task.title, novaOutput, docs, config);

        return {
            executor: 'SPARK',
            result,
            success: result.status === 'SUCCESS'
        };
    } catch (error: any) {
        return {
            executor: 'SPARK',
            result: null,
            success: false,
            error: error.message
        };
    }
}

/**
 * Execute multiple tasks, routing each appropriately
 */
export async function routeTasks(
    tasks: Task[],
    novaOutput: string,
    docs: ProjectDoc[],
    config: WorkflowConfig,
    onProgress?: (completed: number, total: number, result: RouteResult) => void
): Promise<RouteResult[]> {
    const results: RouteResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const result = await routeTask(task, novaOutput, docs, config);
        results.push(result);

        if (onProgress) {
            onProgress(i + 1, tasks.length, result);
        }

        // Small delay between tasks to avoid overwhelming the system
        if (i < tasks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
}

/**
 * Get the preferred executor for a task (without executing)
 */
export function getPreferredExecutor(task: Task, config: WorkflowConfig): ExecutorType {
    if (shouldUseAntigravity(task, config)) {
        return 'ANTIGRAVITY';
    }
    return 'SPARK';
}

/**
 * Validate that the required executor is available
 */
export async function validateExecutor(executor: ExecutorType): Promise<{
    available: boolean;
    reason?: string;
}> {
    if (executor === 'SPARK') {
        // Spark is always available (it's the local AI)
        return { available: true };
    }

    if (executor === 'ANTIGRAVITY') {
        if (antigravityBridge.isConnected()) {
            return { available: true };
        }

        // Try to connect
        const connected = await antigravityBridge.connect();
        if (connected) {
            return { available: true };
        }

        return {
            available: false,
            reason: 'Antigravity IDE not connected. Please open Antigravity and ensure the OpenPM Bridge extension is running.'
        };
    }

    return { available: false, reason: 'Unknown executor' };
}
