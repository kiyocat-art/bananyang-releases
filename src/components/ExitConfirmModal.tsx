import React, { useRef } from 'react';
import { t } from '../localization';
import type { Language } from '../localization';
import { Z_INDEX } from '../constants/zIndex';
import { HoverEdgeAutoScroll } from './HoverEdgeAutoScroll';

interface ExitConfirmModalProps {
    language: Language;
    pendingWorkspace: { content: string; filePath?: string } | null;
    pendingNewWorkspace: boolean;
    pendingCloseTab?: { tabId: string; title: string } | null;
    dirtyTabs?: { tabId: string; title: string }[];
    onDiscard: () => void;
    onCancel: () => void;
    onSaveAndProceed: () => Promise<void>;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
    language,
    pendingWorkspace,
    pendingNewWorkspace,
    pendingCloseTab,
    dirtyTabs,
    onDiscard,
    onCancel,
    onSaveAndProceed,
}) => {
    const listScrollRef = useRef<HTMLUListElement>(null);
    const isMultiDirtyExit = !pendingCloseTab && !pendingWorkspace && !pendingNewWorkspace
        && dirtyTabs && dirtyTabs.length >= 2;

    const bodyText = pendingCloseTab
        ? t('exitConfirmModal.bodyCloseTab', language, { title: pendingCloseTab.title })
        : isMultiDirtyExit
            ? t('exitConfirmModal.bodyCloseMultipleTabs', language, { count: dirtyTabs!.length })
            : (pendingWorkspace || pendingNewWorkspace)
                ? t('exitConfirmModal.bodyLoad', language)
                : t('exitConfirmModal.bodyClose', language);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}>
            <div className="glass-panel rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
                <h2 className="text-2xl font-bold mb-4 text-sky-400">{t('exitConfirmModal.title', language)}</h2>
                <p className="text-zinc-300 mb-4">{bodyText}</p>
                {isMultiDirtyExit && (
                    <div className="relative max-h-48 mb-6">
                    <ul ref={listScrollRef} className="h-full overflow-y-auto text-left bg-black/30 rounded-xl p-3 text-sm text-zinc-200 border border-white/10">
                        {dirtyTabs!.map(tab => (
                            <li key={tab.tabId} className="py-0.5 truncate">• {tab.title}</li>
                        ))}
                    </ul>
                    <HoverEdgeAutoScroll targetRef={listScrollRef as React.RefObject<HTMLElement>} />
                    </div>
                )}
                {!isMultiDirtyExit && <div className="mb-4" />}
                <div className="flex justify-center gap-4">
                    <button onClick={onDiscard} className="px-6 py-2 font-semibold rounded-xl bg-red-500/80 hover:bg-red-500 text-white shadow-lg transition-all">
                        {t('exitConfirmModal.dontSave', language)}
                    </button>
                    <button onClick={onCancel} className="glass-button px-6 py-2 font-semibold rounded-xl text-white">
                        {t('exitConfirmModal.cancel', language)}
                    </button>
                    <button onClick={onSaveAndProceed} className="px-6 py-2 font-semibold rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 shadow-lg transition-all">
                        {t('exitConfirmModal.save', language)}
                    </button>
                </div>
            </div>
        </div>
    );
};
