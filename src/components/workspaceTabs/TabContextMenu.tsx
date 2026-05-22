import React, { useEffect, useRef } from 'react';
import { Z_INDEX } from '../../constants/zIndex';
import { t } from '../../localization';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
    x: number;
    y: number;
    tabId: string;
    filePath: string | null;
    onClose: (tabId: string) => void;
    onCloseOthers: (tabId: string) => void;
    onCloseRight: (tabId: string) => void;
    onDismiss: () => void;
}

export const TabContextMenu: React.FC<Props> = ({
    x, y, tabId, filePath,
    onClose, onCloseOthers, onCloseRight, onDismiss,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const language = useSettingsStore(state => state.language);

    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onDismiss]);

    const item = (label: string, action: () => void) => (
        <button
            className="w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            onClick={() => { action(); onDismiss(); }}
        >
            {label}
        </button>
    );

    return (
        <div
            ref={ref}
            className="fixed bg-zinc-900/95 border border-white/10 rounded-lg shadow-xl py-1 min-w-[180px]"
            style={{ left: x, top: y, zIndex: Z_INDEX.HEADER_DROPDOWN }}
        >
            {item(t('tab.close', language), () => onClose(tabId))}
            {item(t('tab.closeOthers', language), () => onCloseOthers(tabId))}
            {item(t('tab.closeRight', language), () => onCloseRight(tabId))}
            {filePath && (
                <>
                    <div className="border-t border-white/10 my-1" />
                    {item(t('tab.openFileLocation', language), () => {
                        (window as any).electronAPI?.showItemInFolder?.(filePath);
                    })}
                </>
            )}
        </div>
    );
};
