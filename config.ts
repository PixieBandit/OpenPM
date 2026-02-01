/**
 * Centralized configuration for OpenPM
 * Environment variables take precedence over defaults
 */

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// OAuth Configuration (load from environment)
export const OAUTH_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID || '';
export const OAUTH_REDIRECT_PORT = import.meta.env.VITE_OAUTH_REDIRECT_PORT || 51121;

// Gemini API
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Application Constants
export const LOG_RETENTION_LIMIT = 50;
export const AUTOSAVE_DEBOUNCE_MS = 2000;
export const AUTH_POLLING_MAX_ATTEMPTS = 30;
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Default Agent Power Levels
export const DEFAULT_NOVA_POWER = 80;
export const DEFAULT_SPARK_POWER = 60;
export const DEFAULT_QUARTZ_POWER = 70;

// Project IDs
export const DEFAULT_PROJECT_ID = import.meta.env.VITE_DEFAULT_PROJECT_ID || 'rising-fact-p41fc';
