// Google AI Studio API 키 목록을 관리하는 설정 섹션
import React, { useState, useRef, useEffect } from 'react';
import { GOOGLEAISTUDIOICON_ICON } from '../../assets/icons';
import {
    KeyEntry,
    listApiKeys,
    addApiKey,
    updateApiKey,
    removeApiKey,
    getActiveKeyId,
    setActiveKeyId,
} from '../../services/gemini/api';
import { t } from '../../localization';
import { useSettingsStore } from '../../store/settingsStore';
import { HoverEdgeAutoScroll } from '../HoverEdgeAutoScroll';

interface Props {
    onNotification: (message: string, type: 'success' | 'error') => void;
}

const ExternalLinkButton: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => {
    const open = () => {
        if ((window as any).electronAPI?.openExternal) {
            (window as any).electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };
    return (
        <button
            onClick={open}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {children}
        </button>
    );
};

async function validateGeminiKey(key: string): Promise<boolean> {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
        );
        return res.ok;
    } catch {
        return false;
    }
}

function maskKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••' + key.slice(-4);
}

export const GoogleAIApiSection: React.FC<Props> = ({ onNotification }) => {
    const language = useSettingsStore(state => state.language);
    const [keys, setKeys] = useState<KeyEntry[]>(() => listApiKeys());
    const [activeId, setActiveIdState] = useState<string | null>(() => getActiveKeyId());
    const [showDropdown, setShowDropdown] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
    const [isValidating, setIsValidating] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newKey, setNewKey] = useState('');
    const [showNewKey, setShowNewKey] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dropdownScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const refresh = () => {
        setKeys(listApiKeys());
        setActiveIdState(getActiveKeyId());
    };

    const activeEntry = keys.find(k => k.id === activeId) ?? null;

    const handleSelectKey = (id: string) => {
        setActiveKeyId(id);
        setActiveIdState(id);
        setShowDropdown(false);
        onNotification(t('settings.google.apiKeyChanged', language), 'success');
    };

    const handleDeleteKey = (id: string) => {
        removeApiKey(id);
        refresh();
        onNotification(t('settings.google.apiKeyDeleted', language), 'success');
    };

    const handleStartEdit = (entry: KeyEntry) => {
        setEditingId(entry.id);
        setEditLabel(entry.label);
    };

    const handleSaveLabel = (id: string) => {
        const label = editLabel.trim();
        if (label) updateApiKey(id, { label });
        setEditingId(null);
        refresh();
    };

    const handleToggleShow = (id: string) => {
        setShowKeyMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleValidateActive = async () => {
        if (!activeEntry?.key) {
            onNotification(t('settings.google.noActiveKey', language), 'error');
            return;
        }
        setIsValidating(true);
        try {
            const valid = await validateGeminiKey(activeEntry.key);
            onNotification(
                t(valid ? 'settings.google.apiKeyValid' : 'settings.google.apiKeyInvalid', language),
                valid ? 'success' : 'error'
            );
        } catch {
            onNotification(t('settings.google.validationError', language), 'error');
        } finally {
            setIsValidating(false);
        }
    };

    const handleAddKey = () => {
        const label = newLabel.trim() || `Key ${keys.length + 1}`;
        const key = newKey.trim();
        if (!key) {
            onNotification(t('settings.google.enterApiKeyFirst', language), 'error');
            return;
        }
        const entry = addApiKey(label, key);
        if (keys.length === 0) setActiveIdState(entry.id);
        setIsAdding(false);
        setNewLabel('');
        setNewKey('');
        setShowNewKey(false);
        refresh();
        onNotification(t('settings.google.apiKeyAdded', language), 'success');
    };

    const handleCancelAdd = () => {
        setIsAdding(false);
        setNewLabel('');
        setNewKey('');
        setShowNewKey(false);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                    <img src={GOOGLEAISTUDIOICON_ICON} alt="Google AI Studio" className="w-full h-full object-contain" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-zinc-200">Gemini Flash / Pro</p>
                    <p className="text-xs text-zinc-500">Google AI Studio API</p>
                </div>
            </div>

            {/* 활성 키 드롭다운 */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('settings.google.apiKeyLabel', language)}</label>
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setShowDropdown(v => !v)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl bg-black/30 border border-white/10 text-zinc-300 hover:border-white/20 transition-colors cursor-pointer"
                    >
                        <span className="truncate">
                            {activeEntry ? `${activeEntry.label}  ${maskKey(activeEntry.key)}` : t('settings.google.selectOrAddKey', language)}
                        </span>
                        <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl">
                            <div className="relative max-h-56">
                            <div ref={dropdownScrollRef} className="h-full overflow-y-auto">
                                {keys.length === 0 ? (
                                    <p className="text-xs text-zinc-500 text-center py-4">{t('settings.google.noKeysRegistered', language)}</p>
                                ) : (
                                    keys.map(entry => (
                                        <div
                                            key={entry.id}
                                            className={`flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] transition-colors ${entry.id === activeId ? 'bg-white/[0.04]' : ''}`}
                                        >
                                            {/* 선택 */}
                                            <button
                                                onClick={() => handleSelectKey(entry.id)}
                                                className="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer"
                                            >
                                                <svg
                                                    className={`w-3 h-3 flex-shrink-0 ${entry.id === activeId ? 'text-yellow-400' : 'text-zinc-700'}`}
                                                    fill="currentColor" viewBox="0 0 20 20"
                                                >
                                                    <circle cx="10" cy="10" r="8" />
                                                </svg>
                                                <div className="min-w-0">
                                                    {editingId === entry.id ? (
                                                        <input
                                                            type="text"
                                                            value={editLabel}
                                                            onChange={e => setEditLabel(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleSaveLabel(entry.id);
                                                                if (e.key === 'Escape') setEditingId(null);
                                                            }}
                                                            onBlur={() => handleSaveLabel(entry.id)}
                                                            autoFocus
                                                            onClick={e => e.stopPropagation()}
                                                            className="bg-black/30 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white outline-none w-28"
                                                        />
                                                    ) : (
                                                        <span className={`text-xs font-medium ${entry.id === activeId ? 'text-yellow-400' : 'text-zinc-300'}`}>
                                                            {entry.label}
                                                        </span>
                                                    )}
                                                    <div className="text-[11px] text-zinc-600 font-mono mt-0.5">
                                                        {showKeyMap[entry.id] ? entry.key : maskKey(entry.key)}
                                                    </div>
                                                </div>
                                            </button>

                                            {/* 액션 */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleToggleShow(entry.id); }}
                                                    className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                                                    title={showKeyMap[entry.id] ? t('settings.google.hideKey', language) : t('settings.google.showKey', language)}
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                                        {showKeyMap[entry.id] ? (
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                        ) : (
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                        )}
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleStartEdit(entry); }}
                                                    className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                                                    title={t('settings.google.editLabel', language)}
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDeleteKey(entry.id); }}
                                                    className="p-1 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                                                    title={t('settings.google.deleteKey', language)}
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <HoverEdgeAutoScroll targetRef={dropdownScrollRef} />
                            </div>

                            {/* 키 추가 폼 */}
                            {isAdding ? (
                                <div className="border-t border-white/[0.06] p-2.5 flex flex-col gap-2">
                                    <input
                                        type="text"
                                        value={newLabel}
                                        onChange={e => setNewLabel(e.target.value)}
                                        placeholder={`Key ${keys.length + 1}`}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg py-1.5 px-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-white/20"
                                    />
                                    <div className="relative">
                                        <input
                                            type={showNewKey ? 'text' : 'password'}
                                            value={newKey}
                                            onChange={e => setNewKey(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleAddKey(); if (e.key === 'Escape') handleCancelAdd(); }}
                                            placeholder="AIza..."
                                            autoFocus
                                            className="w-full bg-black/30 border border-white/10 rounded-lg py-1.5 px-2.5 pr-8 text-xs text-white placeholder-zinc-600 outline-none focus:border-white/20"
                                        />
                                        <button
                                            onClick={() => setShowNewKey(v => !v)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                                {showNewKey ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                )}
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={handleCancelAdd}
                                            className="flex-1 py-1.5 text-xs rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors cursor-pointer"
                                        >
                                            {t('settings.google.cancel', language)}
                                        </button>
                                        <button
                                            onClick={handleAddKey}
                                            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
                                        >
                                            {t('settings.google.add', language)}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="border-t border-white/[0.06] p-1.5">
                                    <button
                                        onClick={() => { setIsAdding(true); setShowDropdown(true); }}
                                        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        {t('settings.google.addKey', language)}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 활성 키 액션 */}
            <div className="flex gap-2">
                <button
                    onClick={handleValidateActive}
                    disabled={!activeEntry || isValidating}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.08] cursor-pointer"
                >
                    {isValidating ? t('settings.google.validating', language) : t('settings.google.validateKey', language)}
                </button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    {t('settings.google.apiKeyDescription', language)}
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <ExternalLinkButton url="https://aistudio.google.com/app/apikey">{t('settings.google.apiKeyPageLink', language)}</ExternalLinkButton>
                <ExternalLinkButton url="https://aistudio.google.com/spend">{t('settings.google.spendPageLink', language)}</ExternalLinkButton>
                <ExternalLinkButton url="https://aistudio.google.com/spend">{t('settings.google.spendLimitLink', language)}</ExternalLinkButton>
            </div>
        </div>
    );
};
