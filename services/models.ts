
// Models Service - Fetches available models via backend proxy
import { getAccessToken } from './auth';
import { API_BASE_URL, GEMINI_API_BASE } from '../config';
import { hasApiKey } from './apiKeys';

export type ModelProvider = 'google' | 'anthropic' | 'openai' | 'antigravity';

export interface GeminiModel {
    id: string;           // e.g., "gemini-2.0-flash"
    name: string;         // Full name e.g., "models/gemini-2.0-flash"
    displayName: string;  // Human readable e.g., "Gemini 2.0 Flash"
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportsGeneration: boolean;
    provider: ModelProvider;
    requiresApiKey?: boolean; // True if needs user's API key (not Antigravity)
}

/**
 * Fetch available models - returns models filtered by available API keys
 */
export const fetchAvailableModels = async (): Promise<GeminiModel[]> => {
    // Don't cache - recompute based on current API key status
    const models = getAvailableModels();
    console.log(`Loaded ${models.length} available models (filtered by API keys)`);
    return models;
};

/**
 * Get default/fallback models if API fetch fails
 */
export const getDefaultModels = (): GeminiModel[] => [
    // === GEMINI MODELS (Google) ===
    // Gemini 3 Flash - WORKING via API key
    { id: 'gemini-2.0-flash', name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', description: 'Fast, reliable (RECOMMENDED)', inputTokenLimit: 1000000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'google', requiresApiKey: true },
    { id: 'gemini-2.5-flash-preview-05-20', name: 'models/gemini-2.5-flash-preview-05-20', displayName: 'Gemini 2.5 Flash Preview', description: 'Latest Flash preview', inputTokenLimit: 1000000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'google', requiresApiKey: true },
    { id: 'gemini-2.5-pro-preview-05-06', name: 'models/gemini-2.5-pro-preview-05-06', displayName: 'Gemini 2.5 Pro Preview', description: 'Most capable Gemini', inputTokenLimit: 1000000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'google', requiresApiKey: true },

    // === ANTHROPIC CLAUDE MODELS (Direct API) ===
    { id: 'claude-sonnet-4-20250514', name: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', description: 'Latest Sonnet - balanced', inputTokenLimit: 200000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'anthropic', requiresApiKey: true },
    { id: 'claude-opus-4-20250514', name: 'claude-opus-4-20250514', displayName: 'Claude Opus 4', description: 'Most capable Claude', inputTokenLimit: 200000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'anthropic', requiresApiKey: true },
    { id: 'claude-3-5-haiku-20241022', name: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku', description: 'Fast and affordable', inputTokenLimit: 200000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'anthropic', requiresApiKey: true },

    // === ANTIGRAVITY MODELS (via Cloud Code) ===
    { id: 'gemini-3-flash-preview', name: 'models/gemini-3-flash-preview', displayName: '[AG] Gemini 3 Flash', description: 'Via Antigravity', inputTokenLimit: 1000000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'antigravity' },
    { id: 'claude-sonnet-4-5', name: 'models/claude-sonnet-4-5', displayName: '[AG] Claude Sonnet 4.5', description: 'Via Antigravity', inputTokenLimit: 200000, outputTokenLimit: 8192, supportsGeneration: true, provider: 'antigravity' },
];

/**
 * Get models filtered by available API keys
 */
export const getAvailableModels = (): GeminiModel[] => {
    const allModels = getDefaultModels();
    const hasGeminiKey = hasApiKey('gemini');
    const hasAnthropicKey = hasApiKey('anthropic');

    return allModels.filter(model => {
        // Antigravity models are always shown (require OAuth, not API key)
        if (model.provider === 'antigravity') return true;

        // Google models need Gemini API key
        if (model.provider === 'google' && model.requiresApiKey) {
            return hasGeminiKey;
        }

        // Anthropic models need Anthropic API key
        if (model.provider === 'anthropic' && model.requiresApiKey) {
            return hasAnthropicKey;
        }

        return true;
    });
};

/**
 * Clear the cached models (useful for refreshing)
 * Note: Models are no longer cached, this is kept for API compatibility
 */
export const clearModelCache = () => {
    // No-op - models are now dynamically computed based on API key status
};

/**
 * Format token limit for display (e.g., 1000000 -> "1M")
 */
export const formatTokenLimit = (limit: number): string => {
    if (limit >= 1000000) {
        return `${(limit / 1000000).toFixed(1)}M`;
    }
    if (limit >= 1000) {
        return `${(limit / 1000).toFixed(0)}K`;
    }
    return limit.toString();
};
