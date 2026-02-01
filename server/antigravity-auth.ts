import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import fetch from "node-fetch";

// OAuth constants - using Antigravity's official credentials (from antigravity-claude-proxy)
// These credentials have Cloud Code Private API access enabled
const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = "http://localhost:51121/oauth-callback";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_PROJECT_ID = "rising-fact-p41fc";

const SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
];

// Endpoints for loadCodeAssist project discovery (prod first, then daily)
const CODE_ASSIST_ENDPOINTS = [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.googleapis.com",
];

const RESPONSE_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>OpenClaw Antigravity OAuth</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { background: #2a2a2a; padding: 2rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
      h1 { margin-top: 0; color: #4ade80; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Authentication complete</h1>
      <p>You can close this tab and return to the application.</p>
    </div>
    <script>setTimeout(() => window.close(), 2000);</script>
  </body>
</html>`;

interface AuthState {
    verifier: string;
    state: string;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timer: NodeJS.Timeout;
}

// Store active auth requests
const pendingAuths = new Map<string, AuthState>();

function generatePkce() {
    const verifier = randomBytes(32).toString("hex");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
}

function buildAuthUrl(params: { challenge: string; state: string }): string {
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", SCOPES.join(" "));
    url.searchParams.set("code_challenge", params.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", params.state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
}

async function exchangeCode(params: {
    code: string;
    verifier: string;
}): Promise<{ access: string; refresh: string; expires: number }> {
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: params.code,
            grant_type: "authorization_code",
            redirect_uri: REDIRECT_URI,
            code_verifier: params.verifier,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token exchange failed: ${text}`);
    }

    const data = (await response.json()) as any;
    const access = data.access_token?.trim();
    const refresh = data.refresh_token?.trim();
    const expiresIn = data.expires_in ?? 0;

    if (!access) throw new Error("Token exchange returned no access_token");
    if (!refresh) throw new Error("Token exchange returned no refresh_token");

    const expires = Date.now() + expiresIn * 1000 - 5 * 60 * 1000;
    return { access, refresh, expires };
}

async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
    try {
        const response = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) return undefined;
        const data = (await response.json()) as any;
        return data.email;
    } catch {
        return undefined;
    }
}

async function fetchProjectId(accessToken: string): Promise<string> {
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "google-api-nodejs-client/9.15.1",
        "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
        "Client-Metadata": JSON.stringify({
            ideType: "IDE_UNSPECIFIED",
            platform: "PLATFORM_UNSPECIFIED",
            pluginType: "GEMINI",
        }),
    };

    for (const endpoint of CODE_ASSIST_ENDPOINTS) {
        try {
            const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    metadata: {
                        ideType: "IDE_UNSPECIFIED",
                        platform: "PLATFORM_UNSPECIFIED",
                        pluginType: "GEMINI",
                    },
                }),
            });

            if (!response.ok) continue;
            const data = (await response.json()) as any;

            if (typeof data.cloudaicompanionProject === "string") {
                return data.cloudaicompanionProject;
            }
            if (data.cloudaicompanionProject?.id) {
                return data.cloudaicompanionProject.id;
            }
        } catch {
            // ignore
        }
    }

    return DEFAULT_PROJECT_ID;
}

// Singleton server instance
let callbackServer: ReturnType<typeof createServer> | null = null;

function ensureCallbackServer() {
    if (callbackServer) return;

    const url = new URL(REDIRECT_URI);
    const port = Number(url.port) || 51121;

    callbackServer = createServer(async (req, res) => {
        if (!req.url) return;

        const reqUrl = new URL(req.url, `http://localhost:${port}`);
        if (reqUrl.pathname !== "/oauth-callback") {
            res.writeHead(404);
            res.end();
            return;
        }

        const code = reqUrl.searchParams.get("code");
        const state = reqUrl.searchParams.get("state");
        const error = reqUrl.searchParams.get("error");

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(RESPONSE_PAGE);

        if (!state || !pendingAuths.has(state)) return;

        const auth = pendingAuths.get(state)!;
        pendingAuths.delete(state);
        clearTimeout(auth.timer);

        if (error) {
            auth.reject(new Error(error));
            return;
        }

        if (!code) {
            auth.reject(new Error("No code received"));
            return;
        }

        try {
            const tokens = await exchangeCode({ code, verifier: auth.verifier });
            const email = await fetchUserEmail(tokens.access);
            const projectId = await fetchProjectId(tokens.access);
            auth.resolve({ ...tokens, email, projectId });
        } catch (err) {
            auth.reject(err);
        }
    });

    callbackServer.listen(port, () => {
        console.log(`OAuth callback server listening on port ${port}`);
    });

    callbackServer.on('error', (err) => {
        console.error('OAuth callback server error:', err);
    });
}

// Start auth flow
export async function startAuth() {
    ensureCallbackServer();
    const { verifier, challenge } = generatePkce();
    const state = randomBytes(16).toString("hex");
    const authUrl = buildAuthUrl({ challenge, state });

    // Create a promise that resolves when the callback is hit
    const resultPromise = new Promise((resolve, reject) => {
        // Timeout after 5 minutes
        const timer = setTimeout(() => {
            if (pendingAuths.has(state)) {
                pendingAuths.delete(state);
                reject(new Error("Auth timed out"));
            }
        }, 5 * 60 * 1000);

        pendingAuths.set(state, { verifier, state, resolve, reject, timer });
    });

    return {
        authUrl,
        resultPromise
    };
}
