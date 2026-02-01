import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import fetch from "node-fetch";
import {
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_REDIRECT_URI,
    AUTH_URL,
    TOKEN_URL,
    DEFAULT_PROJECT_ID,
    OAUTH_SCOPES,
    CODE_ASSIST_ENDPOINTS,
    CALLBACK_PORT,
    AUTH_TIMEOUT_MS,
    validateOAuthConfig
} from "./config";

// Validate OAuth config on module load
if (!validateOAuthConfig()) {
    console.error('[Auth] WARNING: OAuth credentials not configured. Authentication will fail.');
}

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
    url.searchParams.set("client_id", OAUTH_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", OAUTH_REDIRECT_URI);
    url.searchParams.set("scope", OAUTH_SCOPES.join(" "));
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
            client_id: OAUTH_CLIENT_ID,
            client_secret: OAUTH_CLIENT_SECRET,
            code: params.code,
            grant_type: "authorization_code",
            redirect_uri: OAUTH_REDIRECT_URI,
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

    const port = CALLBACK_PORT;

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
        // Timeout after configured duration
        const timer = setTimeout(() => {
            if (pendingAuths.has(state)) {
                pendingAuths.delete(state);
                reject(new Error("Auth timed out"));
            }
        }, AUTH_TIMEOUT_MS);

        pendingAuths.set(state, { verifier, state, resolve, reject, timer });
    });

    return {
        authUrl,
        resultPromise
    };
}
