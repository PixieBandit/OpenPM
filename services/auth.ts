
// Google OAuth Service for AetherSync
// Uses Google Identity Services (GIS) OAuth2 for access tokens
// Configured for Cloud AI Companion (AntiGravity) access

export interface GoogleUser {
    id: string;
    name: string;
    email: string;
    picture: string;
    projectId?: string;
}

export interface AuthTokens {
    accessToken: string;
    expiresAt: number;
}

const USER_STORAGE_KEY = 'aethersync_user';
const TOKEN_STORAGE_KEY = 'aethersync_tokens';

// Scopes required for Cloud AI Companion (AntiGravity) access
// Uses cloud-platform scope to access user's personal AI quota
const GEMINI_SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

// Use centralized config - fallback for safety
const API_URL = 'http://localhost:3001/api'; // TODO: Import from config when circular deps resolved

// Request access token using the backend Antigravity flow
export const requestAccessToken = async (): Promise<AuthTokens> => {
    // 1. Start the auth flow
    const startResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST'
    });

    if (!startResponse.ok) {
        throw new Error('Failed to start authentication');
    }

    const { authUrl, requestId } = await startResponse.json();

    // 2. Open the auth URL in a new window/tab
    window.open(authUrl, '_blank');

    // 3. Poll for the result
    return pollForAuthResult(requestId);
};

// Poll the status endpoint until success or timeout
const pollForAuthResult = async (requestId: string): Promise<AuthTokens> => {
    const maxAttempts = 30; // 30 attempts * ~2s = ~60s total (backend waits 25s, so effectively much longer)
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(`${API_URL}/auth/status/${requestId}`);

            if (response.status === 200) {
                // Success!
                const data = await response.json();
                const tokens: AuthTokens = {
                    accessToken: data.access,
                    expiresAt: data.expires
                };

                // Store tokens and user info
                localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));

                const user: GoogleUser = {
                    id: data.email, // Use email as ID since we don't strictly need the GAIA ID
                    email: data.email,
                    name: data.email.split('@')[0], // Fallback name
                    picture: '', // No picture in this flow
                    projectId: data.projectId
                };

                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
                return tokens;
            } else if (response.status === 202) {
                // Still pending, continue polling
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                throw new Error(`Auth failed with status: ${response.status}`);
            }
        } catch (error: any) {
            console.warn('Auth polling error:', error);
            // If it's a network error or 500, we might want to retry a bit, but for now just continue
        }
        attempts++;
    }

    throw new Error('Authentication timed out');
};

// ... keep existing helper functions ...

// Initialize on load - check for existing session validity
export const initOAuthClient = () => {
    // No-op for backend flow, but we can check if tokens are still valid
    const stored = getStoredTokens();
    if (stored) {
        console.log('Found stored Antigravity session');
    }
};

/**
 * Get the current access token (refreshes if needed)
 */
export const getAccessToken = async (): Promise<string | null> => {
    const stored = getStoredTokens();

    if (stored && stored.expiresAt > Date.now() + 60000) {
        return stored.accessToken;
    }

    // Token expired or missing - user needs to sign in again
    return null;
};

/**
 * Get stored tokens
 */
export const getStoredTokens = (): AuthTokens | null => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }
    return null;
};

/**
 * Get stored user
 */
export const getStoredUser = (): GoogleUser | null => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }
    return null;
};

/**
 * Check if user is authenticated with valid token
 */
export const isAuthenticated = (): boolean => {
    const tokens = getStoredTokens();
    const user = getStoredUser();
    return user !== null && tokens !== null && tokens.expiresAt > Date.now();
};

/**
 * Sign out - clear all stored data
 */
export const signOut = () => {
    const google = (window as any).google;

    if (google?.accounts?.oauth2) {
        // Try to revoke if we have an old token, though backend-based tokens might not work here
        // It's fine, access token expiration handles security mostly.
        const tokens = getStoredTokens();
    }

    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);

    // Force reload to clear state
    window.location.reload();
};

// Legacy function for compatibility
export const initGoogleAuth = (onSuccess: (user: GoogleUser) => void, onError?: (error: string) => void) => {
    initOAuthClient();

    // Check for existing valid session
    const user = getStoredUser();
    const tokens = getStoredTokens();

    if (user && tokens && tokens.expiresAt > Date.now()) {
        onSuccess(user);
        return;
    }
};

