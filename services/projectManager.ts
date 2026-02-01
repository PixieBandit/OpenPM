import { Project, ProjectDoc } from '../types';

const BACKEND_URL = 'http://localhost:3001/api';

export const scanProjectDirectory = async (path: string): Promise<{ exists: boolean; files: string[]; readme: string; packageJson: any, error?: string }> => {
    try {
        const res = await fetch(`${BACKEND_URL}/scan-dir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });

        if (!res.ok) {
            const err = await res.json();
            return { exists: false, files: [], readme: '', packageJson: null, error: err.error || 'Scan failed' };
        }

        return await res.json();
    } catch (e: any) {
        return { exists: false, files: [], readme: '', packageJson: null, error: e.message };
    }
};

export const createProjectContext = (name: string, scanResult: { files: string[], readme: string, packageJson: any }): string => {
    return `
Project: ${name}
Structure:
${scanResult.files.slice(0, 50).join('\n')}${scanResult.files.length > 50 ? '\n...(truncated)' : ''}

Key Dependencies:
${scanResult.packageJson ? JSON.stringify(scanResult.packageJson.dependencies || {}, null, 2) : 'None detected'}

README Summary:
${scanResult.readme.substring(0, 1000)}...
`;
};

// Helper for 'Create New' or 'Add Existing' to generate initial docs
export const generateProjectSummaryDoc = (projectId: string, name: string, context: string): ProjectDoc => {
    return {
        id: `doc-proj-${projectId}-${Date.now()}`,
        title: `Project Context: ${name}`,
        content: context,
        category: 'LOG',
        author: 'NOVA',
        lastUpdated: new Date().toISOString().split('T')[0],
        isRead: false,
        auditStatus: 'PASSED' // Auto-pass context docs
    };
};
