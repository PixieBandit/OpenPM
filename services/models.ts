
// Models Service - Fetches available models via backend proxy
import { getAccessToken } from './auth';

// Backend proxy server (bypasses CORS, uses Cloud AI Companion)
const BACKEND_URL = 'http://localhost:3001/api';
// Fallback for API key
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiModel {
    id: string;           // e.g., "gemini-2.0-flash"
    name: string;         // Full name e.g., "models/gemini-2.0-flash"
    displayName: string;  // Human readable e.g., "Gemini 2.0 Flash"
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportsGeneration: boolean;
}

// Cache for models
let cachedModels: GeminiModel[] | null = null;

/**
 * Fetch available models - returns curated list for Antigravity
 * These models are available via Google Cloud Code Assist
 */
export const fetchAvailableModels = async (): Promise<GeminiModel[]> => {
    // Return cached if available
    if (cachedModels) {
        return cachedModels;
    }

    // Use curated list of Antigravity-compatible models only
    cachedModels = getDefaultModels();
    console.log(`Loaded ${cachedModels.length} curated models`);
    return cachedModels;
};

/**
 * Get default/fallback models if API fetch fails
 */
export const getDefaultModels = (): GeminiModel[] => [
    // Gemini 3 models - use correct Antigravity model IDs
    { id: 'gemini-3-pro-preview', name: 'models/gemini-3-pro-preview', displayName: 'Gemini 3 Pro Preview', description: 'Next-gen pro model (Preview)', inputTokenLimit: 2000000, outputTokenLimit: 8192, supportsGeneration: true },
    { id: 'gemini-3-flash-preview', name: 'models/gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', description: 'Fast next-gen model (Preview)', inputTokenLimit: 1000000, outputTokenLimit: 8192, supportsGeneration: true },
    // Claude models via Antigravity
    { id: 'claude-sonnet-4-5', name: 'models/claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', description: 'Anthropic Sonnet via Antigravity', inputTokenLimit: 200000, outputTokenLimit: 8192, supportsGeneration: true },
    { id: 'claude-sonnet-4-5-thinking', name: 'models/claude-sonnet-4-5-thinking', displayName: 'Claude Sonnet 4.5 (Thinking)', description: 'Sonnet with extended thinking', inputTokenLimit: 200000, outputTokenLimit: 8192, supportsGeneration: true },
    { id: 'claude-opus-4-5-thinking', name: 'models/claude-opus-4-5-thinking', displayName: 'Claude Opus 4.5 (Thinking)', description: 'Most capable Claude model', inputTokenLimit: 200000, outputTokenLimit: 8192, supportsGeneration: true },
    // GPT via Antigravity
    { id: 'gpt-oss-120b-medium', name: 'models/gpt-oss-120b-medium', displayName: 'GPT-OSS 120B (Medium)', description: 'OpenAI-style model', inputTokenLimit: 128000, outputTokenLimit: 8192, supportsGeneration: true },
    // Fallback Gemini 2.5 models (standard Gemini API compatible)
    { id: 'gemini-2.5-pro', name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Stable Gemini 2.5 Pro', inputTokenLimit: 1000000, outputTokenLimit: 8192, supportsGeneration: true },
    { id: 'gemini-2.0-flash', name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', description: 'Fast Gemini 2.0 Flash', inputTokenLimit: 1000000, outputTokenLimit: 8192, supportsGeneration: true },
];

/**
 * Clear the cached models (useful for refreshing)
 */
export const clearModelCache = () => {
    cachedModels = null;
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
