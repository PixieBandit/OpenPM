import React, { useState } from 'react';
import { getStoredTokens, getStoredUser } from '../services/auth';

interface TestResult {
    name: string;
    status: 'pending' | 'success' | 'error';
    response?: string;
    time?: number;
}

const DebugPanel: React.FC = () => {
    const [results, setResults] = useState<TestResult[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const addResult = (result: TestResult) => {
        setResults(prev => [...prev, result]);
    };

    const updateResult = (name: string, update: Partial<TestResult>) => {
        setResults(prev => prev.map(r => r.name === name ? { ...r, ...update } : r));
    };

    const runTests = async () => {
        setResults([]);
        setIsRunning(true);

        const tokens = getStoredTokens();
        const user = getStoredUser();

        // Test 1: Check stored credentials
        addResult({
            name: 'Stored Credentials',
            status: tokens?.accessToken ? 'success' : 'error',
            response: tokens?.accessToken
                ? `Token: ${tokens.accessToken.substring(0, 20)}...\nExpires: ${new Date(tokens.expiresAt).toLocaleString()}\nUser: ${user?.email || 'N/A'}\nProject: ${user?.projectId || 'N/A'}`
                : 'No tokens found - please authenticate first'
        });

        if (!tokens?.accessToken) {
            setIsRunning(false);
            return;
        }

        // Test 2: Backend health check
        addResult({ name: 'Backend Health', status: 'pending' });
        try {
            const start = Date.now();
            const res = await fetch('http://localhost:3001/api/health');
            const data = await res.json();
            updateResult('Backend Health', {
                status: res.ok ? 'success' : 'error',
                response: JSON.stringify(data, null, 2),
                time: Date.now() - start
            });
        } catch (e: any) {
            updateResult('Backend Health', { status: 'error', response: e.message });
        }

        // Test 2.5: Account limits and subscription info
        addResult({ name: 'Account Limits & Subscription', status: 'pending' });
        try {
            const start = Date.now();
            const res = await fetch('http://localhost:3001/api/debug/account-limits', {
                headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
            });
            const data = await res.json();
            updateResult('Account Limits & Subscription', {
                status: res.ok ? 'success' : 'error',
                response: JSON.stringify(data, null, 2),
                time: Date.now() - start
            });
        } catch (e: any) {
            updateResult('Account Limits & Subscription', { status: 'error', response: e.message });
        }

        // Test 2.6: Extract token from Antigravity IDE (Pro subscription)
        addResult({ name: 'IDE Token Extraction (Pro)', status: 'pending' });
        try {
            const start = Date.now();
            const res = await fetch('http://localhost:3001/api/debug/extract-ide-token');
            const data = await res.json();
            updateResult('IDE Token Extraction (Pro)', {
                status: res.ok && data.foundKeys?.length > 0 ? 'success' : 'error',
                response: JSON.stringify(data, null, 2),
                time: Date.now() - start
            });
        } catch (e: any) {
            updateResult('IDE Token Extraction (Pro)', { status: 'error', response: e.message });
        }

        // Test 3: List models via Cloud AI Companion
        addResult({ name: 'Cloud AI Companion - List Models', status: 'pending' });
        try {
            const start = Date.now();
            const res = await fetch('http://localhost:3001/api/models', {
                headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
            });
            const data = await res.json();
            updateResult('Cloud AI Companion - List Models', {
                status: res.ok ? 'success' : 'error',
                response: res.ok
                    ? `Found ${data.models?.length || 0} models:\n${(data.models || []).slice(0, 5).map((m: any) => `- ${m.name || m.id}`).join('\n')}${data.models?.length > 5 ? `\n... and ${data.models.length - 5} more` : ''}`
                    : JSON.stringify(data, null, 2),
                time: Date.now() - start
            });
        } catch (e: any) {
            updateResult('Cloud AI Companion - List Models', { status: 'error', response: e.message });
        }

        // Test 4: Direct Cloud AI Companion endpoint
        addResult({ name: 'Direct cloudcode-pa.googleapis.com', status: 'pending' });
        try {
            const start = Date.now();
            const res = await fetch('https://cloudcode-pa.googleapis.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`,
                    'User-Agent': 'antigravity/1.104.0 (VSCode/1.96.0)',
                    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1'
                }
            });
            const text = await res.text();
            updateResult('Direct cloudcode-pa.googleapis.com', {
                status: res.ok ? 'success' : 'error',
                response: `Status: ${res.status}\n${text.substring(0, 500)}`,
                time: Date.now() - start
            });
        } catch (e: any) {
            updateResult('Direct cloudcode-pa.googleapis.com', { status: 'error', response: `CORS or network error: ${e.message}` });
        }

        // Test 5: Direct Antigravity API test (no fallback) - MOST IMPORTANT
        const antigravityModels = [
            { model: 'gemini-3-flash', desc: 'Gemini 3 Flash' },
            { model: 'gemini-3-pro-low', desc: 'Gemini 3 Pro Low' },
            { model: 'gemini-3-pro-high', desc: 'Gemini 3 Pro High' },
            { model: 'claude-sonnet-4-5', desc: 'Claude Sonnet 4.5' },
            { model: 'claude-sonnet-4-5-thinking', desc: 'Claude Sonnet 4.5 Thinking' },
            { model: 'claude-opus-4-5-thinking', desc: 'Claude Opus 4.5 Thinking' },
        ];

        for (const { model, desc } of antigravityModels) {
            addResult({ name: `[Antigravity Direct] ${desc}`, status: 'pending' });
            try {
                const start = Date.now();
                const res = await fetch('http://localhost:3001/api/debug/test-antigravity', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokens.accessToken}`,
                        'X-Project-ID': user?.projectId || ''
                    },
                    body: JSON.stringify({ model })
                });
                const data = await res.json();
                updateResult(`[Antigravity Direct] ${desc}`, {
                    status: data.success ? 'success' : 'error',
                    response: JSON.stringify(data, null, 2),
                    time: Date.now() - start
                });
            } catch (e: any) {
                updateResult(`[Antigravity Direct] ${desc}`, { status: 'error', response: e.message });
            }
        }

        // Test 6: Test different model name formats via backend (with fallback)
        const modelTests = [
            { model: 'gemini-3-pro-preview', desc: 'Gemini 3.0 Pro Preview (Personal Key)' },
            { model: 'gemini-2.0-flash', desc: 'Gemini 2.0 Flash (Fallback Test)' },
        ];

        // Test 7: List Public Models (Discovery)
        addResult({ name: 'Public API Models Discovery', status: 'pending' });
        try {
            const start = Date.now();
            const res = await fetch('http://localhost:3001/api/debug/list-public-models');
            const data = await res.json();

            let responseText = '';
            if (data.success && data.models) {
                responseText = `Found ${data.models.length} public models:\n` +
                    data.models.map((m: any) => `- ${m.name} (${m.displayName})`).join('\n');
            } else {
                responseText = JSON.stringify(data, null, 2);
            }

            updateResult('Public API Models Discovery', {
                status: res.ok ? 'success' : 'error',
                response: responseText,
                time: Date.now() - start
            });
        } catch (e: any) {
            updateResult('Public API Models Discovery', { status: 'error', response: e.message });
        }

        for (const { model, desc } of modelTests) {
            addResult({ name: `Generate: ${desc}`, status: 'pending' });
            try {
                const start = Date.now();
                const res = await fetch('http://localhost:3001/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokens.accessToken}`,
                        'X-Project-ID': user?.projectId || ''
                    },
                    body: JSON.stringify({
                        model,
                        contents: [{ parts: [{ text: 'Say hello in exactly 5 words.' }] }]
                    })
                });
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || data.error || JSON.stringify(data);
                updateResult(`Generate: ${desc}`, {
                    status: res.ok ? 'success' : 'error',
                    response: `Status: ${res.status}\nSource: ${data.source || 'unknown'}\n${text.substring(0, 300)}`,
                    time: Date.now() - start
                });
            } catch (e: any) {
                updateResult(`Generate: ${desc}`, { status: 'error', response: e.message });
            }
        }

        setIsRunning(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-auto p-6 font-mono">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-white">🔧 Antigravity Debug Panel</h1>
                    <button
                        onClick={runTests}
                        disabled={isRunning}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        {isRunning ? 'Running...' : 'Run All Tests'}
                    </button>
                </div>

                <div className="space-y-4">
                    {results.map((result, i) => (
                        <div
                            key={i}
                            className={`p-4 rounded-lg border ${result.status === 'success' ? 'bg-emerald-900/20 border-emerald-500/30' :
                                result.status === 'error' ? 'bg-rose-900/20 border-rose-500/30' :
                                    'bg-slate-800/50 border-slate-700'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-white">{result.name}</span>
                                <span className={`text-sm ${result.status === 'success' ? 'text-emerald-400' :
                                    result.status === 'error' ? 'text-rose-400' :
                                        'text-yellow-400'
                                    }`}>
                                    {result.status.toUpperCase()}
                                    {result.time && ` (${result.time}ms)`}
                                </span>
                            </div>
                            {result.response && (
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900/50 p-3 rounded overflow-auto max-h-48">
                                    {result.response}
                                </pre>
                            )}
                        </div>
                    ))}

                    {results.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <p>Click "Run All Tests" to diagnose the API connection</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h2 className="text-lg font-semibold text-white mb-3">Quick Info</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500">Backend URL:</span>
                            <code className="ml-2 text-indigo-400">http://localhost:3001</code>
                        </div>
                        <div>
                            <span className="text-slate-500">Cloud AI Companion:</span>
                            <code className="ml-2 text-indigo-400">daily-cloudcode-pa.sandbox</code>
                        </div>
                        <div>
                            <span className="text-slate-500">Callback Port:</span>
                            <code className="ml-2 text-indigo-400">51121</code>
                        </div>
                        <div>
                            <span className="text-slate-500">Expected Model Prefix:</span>
                            <code className="ml-2 text-indigo-400">google-antigravity/</code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugPanel;
