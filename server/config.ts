/**
 * Server-side configuration for OpenPM
 * All sensitive values should be loaded from environment variables
 */

// OAuth Configuration - MUST be set via environment variables in production
export const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || '';
export const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || '';
export const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:51121/oauth-callback';

// API Endpoints
export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Cloud Code Endpoints (production first, then daily)
export const CODE_ASSIST_ENDPOINTS = [
    'https://cloudcode-pa.googleapis.com',
    'https://daily-cloudcode-pa.googleapis.com',
];

// Default Project ID for fallback
export const DEFAULT_PROJECT_ID = process.env.DEFAULT_PROJECT_ID || 'rising-fact-p41fc';

// OAuth Scopes
export const OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs',
];

// Server Configuration
export const CALLBACK_PORT = parseInt(process.env.OAUTH_CALLBACK_PORT || '51121', 10);
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Validate required OAuth credentials on startup
export function validateOAuthConfig(): boolean {
    if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
        console.warn('[Config] OAuth credentials not configured. Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables.');
        return false;
    }
    return true;
}
