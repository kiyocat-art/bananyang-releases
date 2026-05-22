import React, { useState } from 'react';
import fluxIconUrl from '../../assets/flux-icon.png';
import { getFluxKey, setFluxKey, validateFluxKey, getFluxOrgId, setFluxOrgId, isValidFluxOrgId, buildFluxRechargeUrl } from '../../services/providers/flux/api';
import { useFluxCredits } from '../../hooks/useFluxCredits';
import { t } from '../../localization';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
    onNotification: (message: string, type: 'success' | 'error') => void;
    isOpen?: boolean;
}

export const FluxApiSection: React.FC<Props> = ({ onNotification, isOpen = false }) => {
    const language = useSettingsStore(state => state.language);
    const [keyInput, setKeyInput] = useState(getFluxKey());
    const [showKey, setShowKey] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [orgIdInput, setOrgIdInput] = useState(getFluxOrgId());
    const [savedOrgId, setSavedOrgId] = useState(getFluxOrgId());

    const hasKey = Boolean(getFluxKey());
    const rechargeAvailable = Boolean(buildFluxRechargeUrl(savedOrgId));
    const { credits, isLoading: isCreditsLoading, error: creditsError, refresh } = useFluxCredits(isOpen && hasKey);

    const handleSave = () => {
        setFluxKey(keyInput.trim());
        onNotification(t('settings.flux.apiKeySaved', language), 'success');
    };

    const handleDelete = () => {
        setFluxKey('');
        setKeyInput('');
        onNotification(t('settings.flux.apiKeyDeleted', language), 'success');
    };

    const handleValidate = async () => {
        const key = keyInput.trim();
        if (!key) {
            onNotification(t('settings.flux.enterApiKeyFirst', language), 'error');
            return;
        }
        setIsValidating(true);
        try {
            const valid = await validateFluxKey(key);
            if (valid) {
                onNotification(t('settings.flux.apiKeyValid', language), 'success');
            } else {
                onNotification(t('settings.flux.apiKeyInvalid', language), 'error');
            }
        } catch {
            onNotification(t('settings.flux.validationError', language), 'error');
        } finally {
            setIsValidating(false);
        }
    };

    const handleSaveOrgId = () => {
        const trimmed = orgIdInput.trim();
        if (trimmed && !isValidFluxOrgId(trimmed)) {
            onNotification(t('settings.flux.invalidOrgIdFormat', language), 'error');
            return;
        }
        setFluxOrgId(trimmed);
        setOrgIdInput(trimmed);
        setSavedOrgId(trimmed);
        onNotification(t(trimmed ? 'settings.flux.orgIdSaved' : 'settings.flux.orgIdDeleted', language), 'success');
    };

    const handleRecharge = () => {
        const url = buildFluxRechargeUrl(getFluxOrgId());
        if (!url) return;
        if ((window as any).electronAPI?.openExternal) {
            (window as any).electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const formatCredits = (c: number): string => {
        const usd = c * 0.01;
        return `$${usd.toFixed(2)}`;
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                    <img src={fluxIconUrl} alt="Flux" className="w-full h-full object-contain" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-200">FLUX.2 Max</p>
                    <p className="text-xs text-zinc-500">Black Forest Labs API</p>
                </div>
            </div>

            {/* API Key input */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-zinc-400">{t('settings.flux.apiKeyLabel', language)}</label>
                <div className="relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="bfl-..."
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 px-3 pr-9 text-xs text-white placeholder-zinc-600 focus:ring-1 focus:ring-white/20 focus:border-transparent outline-none transition-all"
                    />
                    <button
                        onClick={() => setShowKey(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                        title={showKey ? t('settings.flux.hideKey', language) : t('settings.flux.showKey', language)}
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

            {/* Credits display */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('settings.flux.creditsLabel', language)}</label>
                <div className="flex items-center justify-between bg-black/20 border border-white/[0.07] rounded-xl px-3 py-2.5">
                    {!hasKey ? (
                        <span className="text-xs text-zinc-600">{t('settings.flux.registerApiKeyFirst', language)}</span>
                    ) : isCreditsLoading && credits === null ? (
                        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            {t('settings.flux.loadingCredits', language)}
                        </span>
                    ) : creditsError ? (
                        <span className="text-xs text-red-400">{t('settings.flux.loadFailed', language)}</span>
                    ) : (
                        <span className="text-sm font-semibold text-zinc-100">
                            {credits !== null ? formatCredits(credits) : '—'}
                            <span className="text-xs font-normal text-zinc-500 ml-1.5">({credits?.toFixed(0) ?? '—'} credits)</span>
                        </span>
                    )}
                    <button
                        onClick={refresh}
                        disabled={!hasKey || isCreditsLoading}
                        title={t('settings.flux.refreshCredits', language)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ml-2 flex-shrink-0"
                    >
                        <svg className={`w-3.5 h-3.5 ${isCreditsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
                <p className="text-xs text-zinc-600">{t('settings.flux.creditInfo', language)}</p>
            </div>

            {/* Credit recharge button */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('settings.flux.rechargeCredits', language)}</label>
                <button
                    onClick={handleRecharge}
                    disabled={!hasKey || !rechargeAvailable}
                    title={!rechargeAvailable ? t('settings.flux.enterOrgIdFirst', language) : t('settings.flux.openRechargePage', language)}
                    className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs font-medium rounded-xl bg-white/5 border border-white/[0.08] text-zinc-300 hover:bg-white/10 hover:text-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('settings.flux.openRechargePage', language)}
                </button>
            </div>

            {/* BFL Org ID input */}
            {hasKey && (
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-zinc-400">{t('settings.flux.orgIdLabel', language)}</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={orgIdInput}
                            onChange={(e) => setOrgIdInput(e.target.value)}
                            placeholder="cea88af9-aadf-4731-9a4f-6edc01898ae7"
                            className="flex-1 bg-black/30 border border-white/10 rounded-xl py-2.5 px-3 text-xs text-white placeholder-zinc-600 focus:ring-1 focus:ring-white/20 focus:border-transparent outline-none transition-all font-mono"
                        />
                        <button
                            onClick={handleSaveOrgId}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors border border-white/[0.08] cursor-pointer"
                        >
                            {t('settings.flux.save', language)}
                        </button>
                    </div>
                    <p className="text-xs text-zinc-600">{t('settings.flux.orgIdDescription', language)}</p>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
                <button onClick={handleDelete} disabled={!keyInput} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-zinc-400 hover:bg-red-500/20 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-white/5 hover:border-red-500/20 cursor-pointer">
                    {t('settings.flux.delete', language)}
                </button>
                <button
                    onClick={handleValidate}
                    disabled={!keyInput || isValidating}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] cursor-pointer"
                >
                    {isValidating ? t('settings.flux.validating', language) : t('settings.flux.validateKey', language)}
                </button>
                <button onClick={handleSave} className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer">
                    {t('settings.flux.save', language)}
                </button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    {t('settings.flux.apiKeyDescription', language)}
                </p>
            </div>

            <button
                onClick={() => {
                    const url = 'https://dashboard.bfl.ai/get-started';
                    if ((window as any).electronAPI?.openExternal) {
                        (window as any).electronAPI.openExternal(url);
                    } else {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                {t('settings.flux.apiKeyPageLink', language)}
            </button>
        </div>
    );
};
