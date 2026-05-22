import React, { useState } from 'react';
import openaiIconUrl from '../../assets/openai-icon.png';
import {
    getOpenAIKey, setOpenAIKey, validateOpenAIKey,
    buildOpenAIBillingUrl,
} from '../../services/providers/openai/api';
import { t } from '../../localization';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
    onNotification: (message: string, type: 'success' | 'error') => void;
    isOpen?: boolean;
}

const openExternal = (url: string) => {
    if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(url);
    } else {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
};

export const OpenAIApiSection: React.FC<Props> = ({ onNotification }) => {
    const language = useSettingsStore(state => state.language);
    const [keyInput, setKeyInput] = useState(getOpenAIKey());
    const [showKey, setShowKey] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    const handleSave = () => {
        setOpenAIKey(keyInput.trim());
        onNotification(t('settings.openai.saved', language), 'success');
    };

    const handleDelete = () => {
        setOpenAIKey('');
        setKeyInput('');
        onNotification(t('settings.openai.deleted', language), 'success');
    };

    const handleValidate = async () => {
        const key = keyInput.trim();
        if (!key) {
            onNotification(t('settings.openai.enterApiKeyFirst', language), 'error');
            return;
        }
        setIsValidating(true);
        try {
            const valid = await validateOpenAIKey(key);
            if (valid) {
                onNotification(t('settings.openai.apiKeyValid', language), 'success');
            } else {
                onNotification(t('settings.openai.apiKeyInvalid', language), 'error');
            }
        } catch {
            onNotification(t('settings.openai.validationError', language), 'error');
        } finally {
            setIsValidating(false);
        }
    };

    const handleRecharge = () => openExternal(buildOpenAIBillingUrl());

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                    <img src={openaiIconUrl} alt="OpenAI" className="w-full h-full object-contain" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-200">OpenAI gpt-image-2</p>
                    <p className="text-xs text-zinc-500">OpenAI Images / Responses API</p>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-zinc-400">{t('settings.openai.apiKeyLabel', language)}</label>
                <div className="relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 px-3 pr-9 text-xs text-white placeholder-zinc-600 focus:ring-1 focus:ring-white/20 focus:border-transparent outline-none transition-all"
                    />
                    <button
                        onClick={() => setShowKey(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                        title={showKey ? t('settings.openai.hideKey', language) : t('settings.openai.showKey', language)}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            {showKey ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            )}
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Billing page link button */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('settings.openai.rechargeCredits', language)}</label>
                <button
                    onClick={handleRecharge}
                    title={t('settings.openai.openRechargePage', language)}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs font-medium rounded-xl bg-white/5 border border-white/[0.08] text-zinc-300 hover:bg-white/10 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('settings.openai.openRechargePage', language)}
                </button>
            </div>

            <div className="flex gap-2">
                <button onClick={handleDelete} disabled={!keyInput} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-zinc-400 hover:bg-red-500/20 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-white/5 hover:border-red-500/20 cursor-pointer">
                    {t('settings.openai.delete', language)}
                </button>
                <button
                    onClick={handleValidate}
                    disabled={!keyInput || isValidating}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] cursor-pointer"
                >
                    {isValidating ? t('settings.openai.validating', language) : t('settings.openai.validateKey', language)}
                </button>
                <button onClick={handleSave} className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer">
                    {t('settings.openai.save', language)}
                </button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    {t('settings.openai.apiKeyDescription', language)}
                </p>
            </div>

            <button
                onClick={() => openExternal('https://platform.openai.com/api-keys')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                {t('settings.openai.apiKeyPageLink', language)}
            </button>

            <button
                onClick={() => openExternal('https://platform.openai.com/settings/organization/general')}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                {t('settings.openai.verificationPageLink', language)}
            </button>
        </div>
    );
};
