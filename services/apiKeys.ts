/**
 * API Keys Service
 *
 * Manages user-provided API keys for different AI providers.
 * Keys are stored in localStorage (consider encryption for production).
 */

export type ApiProvider = 'gemini' | 'anthropic' | 'openai';

interface StoredApiKeys {
    gemini?: string;
    anthropic?: string;
    openai?: string;
}

const API_KEYS_STORAGE_KEY = 'openpm_api_keys';

/**
 * Get all stored API keys
 */
export function getStoredApiKeys(): StoredApiKeys {
    try {
        const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('[ApiKeys] Failed to parse stored keys:', e);
    }
    return {};
}

/**
 * Get a specific API key
 */
export function getApiKey(provider: ApiProvider): string | null {
    const keys = getStoredApiKeys();
    return keys[provider] || null;
}

/**
 * Set an API key for a provider
 */
export function setApiKey(provider: ApiProvider, key: string): void {
    const keys = getStoredApiKeys();
    keys[provider] = key;
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

/**
 * Remove an API key
 */
export function removeApiKey(provider: ApiProvider): void {
    const keys = getStoredApiKeys();
    delete keys[provider];
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

/**
 * Check if a provider has a valid API key set
 */
export function hasApiKey(provider: ApiProvider): boolean {
    const key = getApiKey(provider);
    return !!key && key.length > 10;
}

/**
 * Validate an API key format (basic validation)
 */
export function validateApiKeyFormat(provider: ApiProvider, key: string): { valid: boolean; error?: string } {
    if (!key || key.trim().length === 0) {
        return { valid: false, error: 'API key cannot be empty' };
    }

    switch (provider) {
        case 'gemini':
            // Gemini keys typically start with 'AIza'
            if (!key.startsWith('AIza') || key.length < 30) {
                return { valid: false, error: 'Invalid Gemini API key format. Should start with AIza...' };
            }
            break;
        case 'anthropic':
            // Anthropic keys start with 'sk-ant-'
            if (!key.startsWith('sk-ant-') || key.length < 40) {
                return { valid: false, error: 'Invalid Anthropic API key format. Should start with sk-ant-...' };
            }
            break;
        case 'openai':
            // OpenAI keys start with 'sk-'
            if (!key.startsWith('sk-') || key.length < 40) {
                return { valid: false, error: 'Invalid OpenAI API key format. Should start with sk-...' };
            }
            break;
    }

    return { valid: true };
}

/**
 * Mask an API key for display (show first 8 and last 4 chars)
 */
export function maskApiKey(key: string): string {
    if (key.length <= 12) {
        return '••••••••••••';
    }
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
}

/**
 * Get status of all API keys
 */
export function getApiKeyStatus(): Record<ApiProvider, { set: boolean; masked?: string }> {
    const keys = getStoredApiKeys();
    return {
        gemini: {
            set: !!keys.gemini,
            masked: keys.gemini ? maskApiKey(keys.gemini) : undefined
        },
        anthropic: {
            set: !!keys.anthropic,
            masked: keys.anthropic ? maskApiKey(keys.anthropic) : undefined
        },
        openai: {
            set: !!keys.openai,
            masked: keys.openai ? maskApiKey(keys.openai) : undefined
        }
    };
}
