import React, { useState, useEffect } from 'react';
import {
    getApiKeyStatus,
    setApiKey,
    removeApiKey,
    validateApiKeyFormat,
    ApiProvider
} from '../services/apiKeys';

interface ApiKeySettingsProps {
    onKeysChanged?: () => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ onKeysChanged }) => {
    const [keyStatus, setKeyStatus] = useState(getApiKeyStatus());
    const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        setKeyStatus(getApiKeyStatus());
    }, []);

    const handleSaveKey = (provider: ApiProvider) => {
        const validation = validateApiKeyFormat(provider, inputValue);
        if (!validation.valid) {
            setError(validation.error || 'Invalid key format');
            return;
        }

        setApiKey(provider, inputValue.trim());
        setKeyStatus(getApiKeyStatus());
        setEditingProvider(null);
        setInputValue('');
        setError(null);
        setSuccess(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved!`);
        setTimeout(() => setSuccess(null), 3000);
        onKeysChanged?.();
    };

    const handleRemoveKey = (provider: ApiProvider) => {
        removeApiKey(provider);
        setKeyStatus(getApiKeyStatus());
        onKeysChanged?.();
    };

    const providers: { id: ApiProvider; name: string; description: string; color: string }[] = [
        {
            id: 'gemini',
            name: 'Google Gemini',
            description: 'Get your key from Google AI Studio',
            color: 'blue'
        },
        {
            id: 'anthropic',
            name: 'Anthropic Claude',
            description: 'Get your key from console.anthropic.com',
            color: 'orange'
        }
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    API Keys
                </h3>
            </div>

            {success && (
                <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-[11px] font-mono">
                    {success}
                </div>
            )}

            {error && (
                <div className="p-3 bg-rose-900/20 border border-rose-500/30 rounded-xl text-rose-400 text-[11px] font-mono">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {providers.map(provider => (
                    <div
                        key={provider.id}
                        className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                    keyStatus[provider.id].set ? 'bg-emerald-500' : 'bg-slate-600'
                                }`} />
                                <span className="text-[11px] font-bold text-white uppercase tracking-wide">
                                    {provider.name}
                                </span>
                            </div>
                            {keyStatus[provider.id].set && (
                                <span className="text-[9px] font-mono text-slate-500">
                                    {keyStatus[provider.id].masked}
                                </span>
                            )}
                        </div>

                        <p className="text-[9px] text-slate-500 mb-3">
                            {provider.description}
                        </p>

                        {editingProvider === provider.id ? (
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    value={inputValue}
                                    onChange={(e) => {
                                        setInputValue(e.target.value);
                                        setError(null);
                                    }}
                                    placeholder={`Paste your ${provider.name} API key...`}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleSaveKey(provider.id)}
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase rounded-lg transition-colors"
                                    >
                                        Save Key
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingProvider(null);
                                            setInputValue('');
                                            setError(null);
                                        }}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold uppercase rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditingProvider(provider.id);
                                        setInputValue('');
                                        setError(null);
                                    }}
                                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-colors ${
                                        keyStatus[provider.id].set
                                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    }`}
                                >
                                    {keyStatus[provider.id].set ? 'Update Key' : 'Add Key'}
                                </button>
                                {keyStatus[provider.id].set && (
                                    <button
                                        onClick={() => handleRemoveKey(provider.id)}
                                        className="px-4 py-2 bg-rose-900/30 hover:bg-rose-800/50 text-rose-400 text-[10px] font-bold uppercase rounded-lg transition-colors border border-rose-900/50"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-3 bg-slate-900/30 border border-slate-800 rounded-xl mt-4">
                <p className="text-[9px] text-slate-500 leading-relaxed">
                    <strong className="text-slate-400">Note:</strong> API keys are stored locally in your browser.
                    You need at least one key to use AI models. Gemini keys work with Google models,
                    Anthropic keys work with Claude models.
                </p>
            </div>
        </div>
    );
};

export default ApiKeySettings;
