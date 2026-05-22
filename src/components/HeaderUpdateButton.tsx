import React, { useEffect, useRef, useState } from 'react';
import {
    onUpdateStatus,
    checkForUpdates,
    downloadUpdate,
    applyUpdateNow,
    UpdateStatus,
} from '../services/autoUpdater';
import { t, Language, TranslationKey } from '../localization';
import { Z_INDEX } from '../constants/zIndex';

const UpdateIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="8 17 12 21 16 17" />
        <line x1="12" y1="21" x2="12" y2="9" />
        <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
    </svg>
);

interface HeaderUpdateButtonProps {
    language: Language;
}

export const HeaderUpdateButton: React.FC<HeaderUpdateButtonProps> = ({ language }) => {
    const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => onUpdateStatus(setStatus), []);

    useEffect(() => {
        if (!isOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isOpen]);

    const getIconColorClass = (): string => {
        switch (status.state) {
            case 'available':
            case 'downloading':
            case 'downloaded':
                return 'text-yellow-400 hover:text-yellow-300';
            case 'error':
                return 'text-red-400 hover:text-red-300';
            default:
                return 'text-white/60 hover:text-white';
        }
    };

    const getTooltip = (): string => {
        switch (status.state) {
            case 'checking':
                return t('update.header.tooltip.checking' as TranslationKey, language);
            case 'available':
                return t('update.header.tooltip.available' as TranslationKey, language).replace('{version}', status.version);
            case 'downloading':
                return t('update.header.tooltip.downloading' as TranslationKey, language).replace('{percent}', String(Math.round(status.percent)));
            case 'downloaded':
                return t('update.header.tooltip.downloaded' as TranslationKey, language).replace('{version}', status.version);
            case 'error':
                return t('update.header.tooltip.error' as TranslationKey, language);
            default:
                return t('update.header.tooltip.idle' as TranslationKey, language);
        }
    };

    const renderDropdownContent = () => {
        const headerLabel = (text: string) => (
            <div className="px-3 pt-2 pb-1.5 text-xs font-semibold text-white/40 uppercase tracking-wider select-none">
                {text}
            </div>
        );
        const divider = <div className="mx-3 mb-1 border-t border-white/10" />;

        switch (status.state) {
            case 'idle':
            case 'not-available':
                return (
                    <>
                        {headerLabel(t('update.header.popup.title' as TranslationKey, language))}
                        {divider}
                        <div className="px-4 py-2 text-sm text-white/60 select-none">
                            {t('update.header.popup.upToDate' as TranslationKey, language)}
                        </div>
                        <div className="px-3 pb-2 pt-1">
                            <button
                                onClick={() => { void checkForUpdates(); setIsOpen(false); }}
                                className="w-full text-left px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 transition-colors cursor-pointer"
                                type="button"
                            >
                                {t('update.header.popup.checkNow' as TranslationKey, language)}
                            </button>
                        </div>
                    </>
                );
            case 'checking':
                return (
                    <>
                        {headerLabel(t('update.header.popup.title' as TranslationKey, language))}
                        {divider}
                        <div className="px-4 py-2 text-sm text-white/60 select-none">
                            {t('update.header.tooltip.checking' as TranslationKey, language)}
                        </div>
                    </>
                );
            case 'available':
                return (
                    <>
                        {headerLabel(t('update.toast.available' as TranslationKey, language))}
                        {divider}
                        <div className="px-4 py-1.5 text-sm text-yellow-300 font-medium">v{status.version}</div>
                        <div className="px-3 pb-2 pt-1 flex gap-2">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 cursor-pointer"
                                type="button"
                            >
                                {t('update.toast.later' as TranslationKey, language)}
                            </button>
                            <button
                                onClick={() => { void downloadUpdate(); setIsOpen(false); }}
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-900 font-medium cursor-pointer"
                                type="button"
                            >
                                {t('update.toast.installNow' as TranslationKey, language)}
                            </button>
                        </div>
                    </>
                );
            case 'downloading':
                return (
                    <>
                        {headerLabel(t('update.toast.downloading' as TranslationKey, language))}
                        {divider}
                        <div className="px-4 py-1.5 text-xs text-white/50">
                            {Math.round(status.percent)}%
                        </div>
                        <div className="mx-4 mb-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-yellow-400 transition-all duration-200"
                                style={{ width: `${status.percent}%` }}
                            />
                        </div>
                    </>
                );
            case 'downloaded':
                return (
                    <>
                        {headerLabel(t('update.toast.ready' as TranslationKey, language))}
                        {divider}
                        <div className="px-4 py-1.5 text-sm text-yellow-300 font-medium">v{status.version}</div>
                        <div className="px-3 pb-2 pt-1 flex gap-2">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 cursor-pointer"
                                type="button"
                            >
                                {t('update.toast.installOnQuit' as TranslationKey, language)}
                            </button>
                            <button
                                onClick={() => { void applyUpdateNow(); }}
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-900 font-medium cursor-pointer"
                                type="button"
                            >
                                {t('update.toast.restartNow' as TranslationKey, language)}
                            </button>
                        </div>
                    </>
                );
            case 'error':
                return (
                    <>
                        {headerLabel(t('update.toast.error' as TranslationKey, language))}
                        {divider}
                        <div className="px-4 py-1.5 text-xs text-red-400 break-words max-w-[220px]">
                            {status.message}
                        </div>
                        <div className="px-3 pb-2 pt-1">
                            <button
                                onClick={() => { void checkForUpdates(); setIsOpen(false); }}
                                className="w-full text-left px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 transition-colors cursor-pointer"
                                type="button"
                            >
                                {t('update.header.popup.retry' as TranslationKey, language)}
                            </button>
                        </div>
                    </>
                );
        }
    };

    const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

    return (
        <div ref={dropdownRef} className="relative" style={noDrag}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className={`p-2 rounded-md transition-colors ${getIconColorClass()}`}
                title={getTooltip()}
                type="button"
            >
                <UpdateIcon />
            </button>
            {isOpen && (
                <div
                    className="absolute top-full right-0 mt-1 bg-zinc-900/95 border border-white/10 rounded-lg shadow-xl py-1 min-w-[200px]"
                    style={{
                        zIndex: Z_INDEX.HEADER_DROPDOWN,
                        isolation: 'isolate',
                        transform: 'translateZ(0)',
                        WebkitAppRegion: 'no-drag',
                    } as React.CSSProperties}
                >
                    {renderDropdownContent()}
                </div>
            )}
        </div>
    );
};
