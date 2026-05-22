import React from 'react';
import { t } from '../../localization';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
    onClick: () => void;
    disabled?: boolean;
}

export const NewTabButton: React.FC<Props> = ({ onClick, disabled = false }) => {
    const language = useSettingsStore(state => state.language);
    return (
    <button
        onClick={onClick}
        onMouseDown={e => e.stopPropagation()}
        className={[
            'flex items-center justify-center w-7 h-full shrink-0 transition-colors',
            disabled
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/40 hover:text-white/80 hover:bg-white/8',
        ].join(' ')}
        title={t('tab.newTab', language)}
        tabIndex={-1}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
    </button>
    );
};
