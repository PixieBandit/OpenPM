import express from 'express';
import cors from 'cors';
import fetch, { Response } from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
    tasks: path.join(DATA_DIR, 'tasks.json'),
    docs: path.join(DATA_DIR, 'docs.json'),
    logs: path.join(DATA_DIR, 'logs.json'),
    config: path.join(DATA_DIR, 'config.json'),
    chats: path.join(DATA_DIR, 'chats.json'),
    projects: path.join(DATA_DIR, 'projects.json')
};

// Try to read API Key from .env.local
let LOCAL_API_KEY: string | null = null;
const loadEnvLocal = async () => {
    try {
        const envPath = path.join(__dirname, '..', '.env.local'); // Assuming server/index.ts is in server/
        const content = await fs.readFile(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('GOOGLE_API_KEY=') || trimmed.startsWith('GEMINI_API_KEY=') || trimmed.startsWith('NEXT_PUBLIC_GEMINI_API_KEY=')) {
                LOCAL_API_KEY = trimmed.split('=')[1].trim();
                break;
            }
        }
        if (LOCAL_API_KEY) console.log('[Config] Loaded API Key from .env.local');
    } catch (e) {
        // .env.local might not exist or be readable
    }
};
loadEnvLocal();


// Cloud AI Companion (Antigravity) endpoints - uses v1internal API
// Source: https://github.com/badrisnarayanan/antigravity-claude-proxy
const ANTIGRAVITY_DAILY_URL = 'https://daily-cloudcode-pa.googleapis.com';
const ANTIGRAVITY_PROD_URL = 'https://cloudcode-pa.googleapis.com';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// AntiGravity-compatible headers (from antigravity-claude-proxy constants.js)
const ANTIGRAVITY_HEADERS = {
    'User-Agent': 'antigravity/1.15.8 win32/x64',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': JSON.stringify({
        ideType: 'VSCODE',
        platform: 'WINDOWS',
        pluginType: 'GEMINI'
    })
};

// Middleware (Order is critical: CORS first, then JSON, then custom logging)
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Goog-Api-Client', 'Client-Metadata', 'X-Project-ID', 'x-goog-user-project', 'x-goog-api-key']
}));
app.options('*', cors()); // Enable pre-flight for all routes

app.use(express.json({ limit: '50mb' }));

// Debug logging middleware to trace request flow
app.use((req, res, next) => {
    console.log(`[R] ${req.method} ${req.url} (Origin: ${req.headers.origin})`);
    next();
});

const ensureStorageExists = async () => {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });

        const defaults: any = {
            tasks: [],
            docs: [],
            logs: [],
            config: {},
            chats: [],
            projects: []
        };

        for (const [key, filepath] of Object.entries(FILES)) {
            try {
                await fs.access(filepath);
            } catch {
                await fs.writeFile(filepath, JSON.stringify(defaults[key], null, 2));
            }
        }
    } catch (err) {
        console.error('Storage Init Error:', err);
    }
};
ensureStorageExists();

// Helper to get the IDE token (Pro subscription) directly from state.vscdb
const getIdeToken = async (): Promise<string | null> => {
    const dbPath = path.join(homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
    try {
        await fs.access(dbPath);
        const db = new Database(dbPath, { readonly: true });
        try {
            const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'antigravityAuthStatus'").get() as any;
            if (row && row.value) {
                // The value might be the token directly or a JSON string containing it
                const match = row.value.match(/ya29\.[a-zA-Z0-9_\-\.]+/);
                if (match) {
                    return match[0];
                }
            }
        } finally {
            db.close();
        }
    } catch (error) {
        // Silently fail if not found, fallback to standard auth
    }
    return null;
};

// Persistence Endpoints
app.get('/api/data', async (req, res) => {
    try {
        const [tasks, docs, logs, config, chats, projects] = await Promise.all([
            fs.readFile(FILES.tasks, 'utf-8').then(JSON.parse).catch(() => []),
            fs.readFile(FILES.docs, 'utf-8').then(JSON.parse).catch(() => []),
            fs.readFile(FILES.logs, 'utf-8').then(JSON.parse).catch(() => []),
            fs.readFile(FILES.config, 'utf-8').then(JSON.parse).catch(() => ({})),
            fs.readFile(FILES.chats, 'utf-8').then(JSON.parse).catch(() => []),
            fs.readFile(FILES.projects, 'utf-8').then(JSON.parse).catch(() => [])
        ]);

        res.json({ tasks, docs, logs, config, chats, projects });
    } catch (error) {
        console.error('Read Data Error:', error);
        res.status(500).json({ error: 'Failed to read data systems' });
    }
});

app.post('/api/data', async (req, res) => {
    try {
        const { tasks, docs, logs, config, chats, projects } = req.body;

        const writes = [];
        if (tasks) writes.push(fs.writeFile(FILES.tasks, JSON.stringify(tasks, null, 2)));
        if (docs) writes.push(fs.writeFile(FILES.docs, JSON.stringify(docs, null, 2)));
        if (logs) writes.push(fs.writeFile(FILES.logs, JSON.stringify(logs, null, 2)));
        if (config) writes.push(fs.writeFile(FILES.config, JSON.stringify(config, null, 2)));
        if (chats) writes.push(fs.writeFile(FILES.chats, JSON.stringify(chats, null, 2)));
        if (projects) writes.push(fs.writeFile(FILES.projects, JSON.stringify(projects, null, 2)));

        await Promise.all(writes);
        res.json({ status: 'saved', systems: Object.keys(req.body) });
    } catch (error) {
        console.error('Write Data Error:', error);
        res.status(500).json({ error: 'Failed to save data systems' });
    }
});

// Directory Scan Endpoint for Project Cataloging
app.post('/api/scan-dir', async (req, res) => {
    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'Path is required' });

    try {
        await fs.access(dirPath);
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) return res.status(400).json({ error: 'Path is not a directory' });

        const files = await fs.readdir(dirPath, { withFileTypes: true });

        // Basic scan: list interesting files, maybe read README or package.json
        const summary = [];
        let readmeContent = '';
        let packageJson = '';

        for (const file of files) {
            const name = file.name;
            if (file.isDirectory() && name !== 'node_modules' && !name.startsWith('.')) {
                summary.push(`DIR: ${name}`);
            } else if (file.isFile()) {
                summary.push(`FILE: ${name}`);
                if (name.toLowerCase() === 'readme.md') {
                    try { readmeContent = await fs.readFile(path.join(dirPath, name), 'utf-8'); } catch { }
                }
                if (name === 'package.json') {
                    try { packageJson = await fs.readFile(path.join(dirPath, name), 'utf-8'); } catch { }
                }
            }
        }

        // Limit readme content to avoid huge payloads
        if (readmeContent.length > 5000) readmeContent = readmeContent.substring(0, 5000) + '...[TRUNCATED]';

        res.json({
            exists: true,
            files: summary,
            readme: readmeContent,
            packageJson: packageJson ? JSON.parse(packageJson) : null
        });

    } catch (error: any) {
        console.error('Scan Error:', error);
        res.status(500).json({ error: error.message, exists: false });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List models endpoint
app.get('/api/models', async (req, res) => {
    const clientAuth = req.headers.authorization;
    // Prefer IDE token if available to ensure Pro tier access
    const ideToken = await getIdeToken();

    // Construct the effective token (add Bearer if needed)
    let authToken = clientAuth;
    if (ideToken) {
        authToken = `Bearer ${ideToken}`;
    }

    if (!authToken) {
        return res.status(401).json({ error: 'No authorization header and no IDE token found' });
    }

    try {
        // Try Cloud AI Companion first (using loadCodeAssist endpoint for model discovery)
        let response = await fetch(`${ANTIGRAVITY_DAILY_URL}/v1/models`, {
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                ...ANTIGRAVITY_HEADERS
            }
        });

        // Fallback to standard Gemini API if Cloud AI Companion fails
        if (!response.ok) {
            console.log('Cloud AI Companion unavailable, using standard Gemini API');
            response = await fetch(`${GEMINI_API_BASE}/models`, {
                headers: {
                    'Authorization': authToken,
                    'Content-Type': 'application/json'
                }
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error('Models fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Extract token from Antigravity IDE database (has Pro subscription context)
app.get('/api/debug/extract-ide-token', async (req, res) => {
    const userDir = path.join(homedir(), 'AppData', 'Roaming', 'Antigravity', 'User');
    const globalDbPath = path.join(userDir, 'globalStorage', 'state.vscdb');
    const workspaceStorageDir = path.join(userDir, 'workspaceStorage');

    const results: any[] = [];
    const errors: any[] = [];

    // Helper to scan a DB for tokens
    const scanDb = (dbPath: string, context: string) => {
        try {
            const db = new Database(dbPath, { readonly: true });
            try {
                // Get all items
                const rows = db.prepare("SELECT key, value FROM ItemTable").all() as any[];

                for (const row of rows) {
                    if (typeof row.value === 'string') {
                        // Check for Google OAuth tokens (ya29...) AND Refresh tokens (1//...)
                        const hasAccessToken = row.value.includes('ya29.');
                        const hasRefreshToken = row.value.includes('1//');

                        if (hasAccessToken || hasRefreshToken) {
                            let tokenType = 'unknown';
                            let foundToken = null;

                            // NAIVE PARSING: Just grab the regex match
                            if (hasAccessToken) {
                                const match = row.value.match(/ya29\.[a-zA-Z0-9_\-\.]+/);
                                if (match) {
                                    foundToken = match[0];
                                    tokenType = 'access_token';
                                }
                            }
                            // Only look for refresh token if we didn't find access token or to verify
                            if (!foundToken && hasRefreshToken) {
                                const match = row.value.match(/1\/\/[a-zA-Z0-9_\-\.]+/);
                                if (match) {
                                    foundToken = match[0];
                                    tokenType = 'refresh_token';
                                }
                            }

                            if (foundToken) {
                                results.push({
                                    source: context,
                                    key: row.key,
                                    type: tokenType,
                                    token: foundToken,
                                    dbPath: dbPath
                                });
                            }
                        }
                    }
                }
            } finally {
                db.close();
            }
        } catch (e: any) {
            // Ignore file not found or lock errors usually, but log for debug
            if (e.code !== 'ENOENT') errors.push({ path: dbPath, error: e.message });
        }
    };

    try {
        // 1. Scan Global Storage
        scanDb(globalDbPath, 'Global Storage');

        // 2. Scan Workspace Storage (iterate all folders)
        try {
            const workspaces = await fs.readdir(workspaceStorageDir);
            for (const ws of workspaces) {
                const wsDbPath = path.join(workspaceStorageDir, ws, 'state.vscdb');
                scanDb(wsDbPath, `Workspace: ${ws}`);
            }
        } catch (e) {
            // Workspace dir might not exist
        }

        res.json({
            success: true,
            foundTokens: results,
            count: results.length,
            errors: errors,
            hint: results.length > 0 ? "Found tokens! Check if 'refresh_token' is present." : "No tokens found."
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint - check account subscription and quota via loadCodeAssist
app.get('/api/debug/account-limits', async (req, res) => {
    const clientAuth = req.headers.authorization;
    // Prefer IDE token if available to ensure Pro tier access
    const ideToken = await getIdeToken();

    // Construct the effective token (add Bearer if needed)
    let authToken = clientAuth;
    if (ideToken) {
        authToken = `Bearer ${ideToken}`;
    }

    if (!authToken) {
        return res.status(401).json({ error: 'No authorization header and no IDE token found' });
    }

    const headers = {
        'Authorization': authToken,
        'Content-Type': 'application/json',
        ...ANTIGRAVITY_HEADERS
    };

    const results: any = {
        endpoints: {},
        subscription: null,
        projectId: null,
        tokenSource: ideToken ? 'IDE (Pro)' : 'Client (Unknown)'
    };

    // Try loadCodeAssist on both endpoints
    for (const baseUrl of [ANTIGRAVITY_DAILY_URL, ANTIGRAVITY_PROD_URL]) {
        const url = `${baseUrl}/v1internal:loadCodeAssist`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    metadata: {
                        ideType: 'IDE_UNSPECIFIED',
                        platform: 'PLATFORM_UNSPECIFIED',
                        pluginType: 'GEMINI'
                    }
                })
            });
            const data = await response.json() as any;
            results.endpoints[baseUrl] = {
                status: response.status,
                ok: response.ok,
                data: data
            };

            if (response.ok && data?.cloudaicompanionProject) {
                results.projectId = typeof data.cloudaicompanionProject === 'string'
                    ? data.cloudaicompanionProject
                    : data.cloudaicompanionProject?.id;
                results.subscription = data.subscription || data;
            }
        } catch (error: any) {
            results.endpoints[baseUrl] = { error: error.message };
        }
    }

    res.json(results);
});

// Debug endpoint - test Cloud AI Companion without fallback using v1internal API
app.post('/api/debug/test-antigravity', async (req, res) => {
    const clientAuth = req.headers.authorization;
    const projectId = req.headers['x-project-id'] as string | undefined;
    const { model } = req.body;

    const ideToken = await getIdeToken();
    let authToken = clientAuth;
    if (ideToken) authToken = `Bearer ${ideToken}`;

    const apiKey = LOCAL_API_KEY || req.headers['x-goog-api-key'] as string;

    const modelToTest = model || 'gemini-2.0-flash';
    const project = projectId || 'rising-fact-p41fc';

    // Headers setup
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...ANTIGRAVITY_HEADERS
    };
    if (authToken) headers['Authorization'] = authToken;

    const tests: any = {};

    try {
        // Test 1: Antigravity Prod (Cloud Code API)
        if (authToken) {
            const agUrl = `${ANTIGRAVITY_PROD_URL}/v1internal:generateContent`;
            const agWrappedPayload = {
                project: project,
                model: modelToTest,
                userAgent: 'antigravity',
                requestType: 'agent',
                requestId: 'agent-' + Date.now(),
                request: {
                    contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
                }
            };
            try {
                const agResp = await fetch(agUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(agWrappedPayload)
                });
                let agData: any = {};
                try { agData = await agResp.json(); } catch { }
                tests['AntigravityProd'] = {
                    status: agResp.status,
                    ok: agResp.ok,
                    statusText: agResp.statusText,
                    error: !agResp.ok ? agData?.error?.message : undefined
                };
            } catch (e: any) {
                tests['AntigravityProd'] = { error: e.message };
            }
        } else {
            tests['AntigravityProd'] = { skipped: 'No Auth Token' };
        }

        // Test 2: Standard Gemini API with API KEY (if available)
        if (apiKey) {
            // Map model for public API
            let mappedModel = modelToTest;
            const modelMap: Record<string, string> = {
                'gemini-3-flash-preview': 'gemini-2.5-flash',
                'gemini-3-flash': 'gemini-2.5-flash',
                'gemini-3-pro-preview': 'gemini-2.5-pro',
                'gemini-3-pro-low': 'gemini-2.5-pro',
                'gemini-3-pro-high': 'gemini-2.5-pro',
                'gemini-2.0-flash-exp': 'gemini-2.5-flash',
                'gemini-2.0-flash': 'gemini-2.0-flash'
            };
            if (modelMap[modelToTest]) {
                mappedModel = modelMap[modelToTest];
            }

            const stdUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mappedModel}:generateContent?key=${apiKey}`;
            try {
                const stdResp = await fetch(stdUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
                    })
                });
                let stdData: any = {};
                try { stdData = await stdResp.json(); } catch { }
                tests['StandardGeminiAPIKey'] = {
                    status: stdResp.status,
                    ok: stdResp.ok,
                    statusText: stdResp.statusText,
                    error: !stdResp.ok ? stdData?.error?.message : undefined,
                    usedKey: apiKey.substring(0, 10) + '...'
                };
            } catch (e: any) {
                tests['StandardGeminiAPIKey'] = { error: e.message };
            }
        } else {
            tests['StandardGeminiAPIKey'] = { skipped: 'No API Key Found' };
        }

        res.json({
            success: true,
            model: modelToTest,
            projectId: project,
            usingIdeToken: !!ideToken,
            hasApiKey: !!apiKey,
            tests: tests
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint - list models from public API using API Key
app.get('/api/debug/list-public-models', async (req, res) => {
    const apiKey = LOCAL_API_KEY || req.headers['x-goog-api-key'] as string;

    if (!apiKey) {
        return res.status(401).json({ error: 'No API Key found in environment or headers' });
    }

    try {
        const response = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json({
            success: true,
            source: 'public-api',
            models: (data as any).models || []
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Generate content endpoint
app.post('/api/generate', async (req, res) => {
    const clientAuth = req.headers.authorization;
    const projectId = req.headers['x-project-id'] as string | undefined;
    const { model, stream, ...requestBody } = req.body;

    const ideToken = await getIdeToken();
    let authToken = clientAuth;
    if (ideToken) {
        authToken = `Bearer ${ideToken}`;
    }

    const apiKey = LOCAL_API_KEY || req.headers['x-goog-api-key'] as string;

    if (!authToken && !apiKey) {
        return res.status(401).json({ error: 'No authorization header and no API Key found' });
    }

    if (!model) {
        return res.status(400).json({ error: 'Model is required' });
    }

    // Determine streaming method
    const method = stream ? 'streamGenerateContent' : 'generateContent';
    const alt = stream ? '?alt=sse' : '';

    // -- STRATEGY: Try API Key (Standard API) -> Fallback to Antigravity (IDE Token) --

    let finalResponse = null;
    let finalSource = 'unknown';

    // 1. Attempt Standard Gemini API (Preferred if Key exists)
    if (apiKey) {
        try {
            // Map Antigravity Internal Models to Public API Models
            let mappedModel = model;
            const modelMap: Record<string, string> = {
                'gemini-3-flash-preview': 'gemini-2.5-flash',
                'gemini-3-flash': 'gemini-2.5-flash',
                'gemini-3-pro-preview': 'gemini-2.5-pro',
                'gemini-3-pro-low': 'gemini-2.5-pro',
                'gemini-3-pro-high': 'gemini-2.5-pro',
                'gemini-2.0-flash-exp': 'gemini-2.5-flash',
                'gemini-2.0-flash': 'gemini-2.0-flash'
            };

            if (modelMap[model]) {
                mappedModel = modelMap[model];
                console.log(`[Proxy] Mapping internal model ${model} to public model ${mappedModel}`);
            }

            console.log(`[Proxy] Using Standard Gemini API with Key (Model: ${mappedModel})`);
            const separator = stream ? '&' : '?';
            const fallbackUrl = `${GEMINI_API_BASE}/models/${mappedModel}:${method}${alt}${separator}key=${apiKey}`;

            const response = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody) // Send original body, not wrapped
            });

            if (response.ok || response.status === 400) {
                // Return 400s (User error) directly, or 200s
                finalResponse = response;
                finalSource = 'gemini-api-key-direct';
            } else {
                console.log(`[Proxy] API Key attempt failed (${response.status}). Trying fallback to Antigravity...`);
                // Consume error stream to release handle
                try { await response.text(); } catch (e) { }
            }
        } catch (e: any) {
            console.error('API Key request error:', e);
            console.log('[Proxy] API Key network error, trying fallback to Antigravity...');
        }
    }

    // 2. Attempt Antigravity/Cloud Code Proxy (Fallback or Primary if no Key)
    if (!finalResponse && authToken) {
        const project = projectId || 'nodal-zodiac-7f3h4';
        try {
            // THE CRACKED PATTERN: v1internal often expects model INSIDE the request object
            // and uses the full resource path for Antigravity models.
            let internalModel = model;
            if (model.includes('gemini-3')) {
                internalModel = `projects/${project}/locations/us-central1/publishers/google/models/${model}`;
                if (!internalModel.endsWith('-preview') && !model.includes('flash')) {
                    // Force -preview for gemini-3-pro if not specified? 
                    // Cracked scripts used gemini-3-pro-preview
                }
            }

            const wrappedPayload = {
                request: {
                    model: internalModel,
                    contents: requestBody.contents,
                    generationConfig: requestBody.generationConfig,
                    systemInstruction: requestBody.systemInstruction
                }
            };

            const upstreamUrl = `${ANTIGRAVITY_PROD_URL}/v1internal:${method}${alt}`;
            console.log(`[Proxy] Antigravity Target: ${upstreamUrl} (Project: ${project})`);

            const upstreamHeaders: Record<string, string> = {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                ...ANTIGRAVITY_HEADERS,
                'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1'
            };

            const response = await fetch(upstreamUrl, {
                method: 'POST',
                headers: upstreamHeaders,
                body: JSON.stringify(wrappedPayload)
            });

            if (response.ok) {
                finalResponse = response;
                finalSource = 'cloud-ai-companion-cracked';
            } else {
                const status = response.status;
                const errorText = await response.text();
                console.log(`[Proxy] Antigravity failed (${status}). Error: ${errorText.substring(0, 150)}`);

                // If we haven't tried API key yet (e.g. invalid key? actually logic above prevents this order, 
                // but strictly speaking if we are here it's because API Key failed or didn't exist)
                if (!finalResponse) {
                    // Reconstruct response since body was consumed
                    finalResponse = new Response(errorText, {
                        status: status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                    finalSource = 'cloud-ai-companion-failed';
                }
            }
        } catch (e) {
            console.log('[Proxy] Antigravity network error.');
        }
    }

    // 3. Send Response
    if (finalResponse) {
        if (!finalResponse.ok) {
            const err = await finalResponse.text();
            return res.status(finalResponse.status).send(err);
        }

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            finalResponse.body.pipe(res);
        } else {
            const data = await finalResponse.json() as any;
            res.json({ ...data, source: finalSource });
        }
    } else {
        // No success and no fallback possible
        res.status(503).json({ error: 'All attempts failed. Check quota (Antigravity) or API Key.' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AetherSync Backend running on http://localhost:${PORT}`);
    console.log(`   Proxying to Cloud AI Companion (AntiGravity compatible)`);
    console.log(`   Persistence enabled at: ${DATA_DIR} (tasks, docs, logs, config)`);
});

import { startAuth } from './antigravity-auth';

// Auth Request Storage
const pendingAuthRequests = new Map<string, Promise<any>>();

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
    try {
        const { authUrl, resultPromise } = await startAuth();
        const requestId = crypto.randomUUID();

        pendingAuthRequests.set(requestId, resultPromise);

        // Clean up after completion or timeout
        resultPromise
            .finally(() => {
                setTimeout(() => pendingAuthRequests.delete(requestId), 60000); // Keep result for 1 min after completion
            });

        res.json({ authUrl, requestId });
    } catch (error: any) {
        console.error('Auth Start Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/status/:requestId', async (req, res) => {
    const { requestId } = req.params;
    const authPromise = pendingAuthRequests.get(requestId);

    if (!authPromise) {
        return res.status(404).json({ error: 'Request not found or expired' });
    }

    try {
        // Wait for the auth to complete (long-polling)
        // We race against a timeout so the HTTP request doesn't hang forever
        const result = await Promise.race([
            authPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000))
        ]);

        res.json(result);
    } catch (error: any) {
        if (error.message === 'TIMEOUT') {
            // Client should retry
            res.status(202).json({ status: 'pending' });
        } else {
            console.error('Auth Status Error:', error);
            res.status(500).json({ error: error.message });
        }
    }
});

export default app;
