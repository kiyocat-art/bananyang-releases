import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { useToolbarStore } from './useToolbarStore';
import { forceSyncBinding } from './toolbarBindingController';
import { t } from '../../localization';
import { Z_INDEX } from '../../constants/zIndex';

interface ToolbarContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
}

const MENU_W = 160;
const MENU_H = 280;

const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="13" y1="8" x2="3" y2="8" />
        <polyline points="7,4 3,8 7,12" />
    </svg>
);

const ArrowRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="8" x2="13" y2="8" />
        <polyline points="9,4 13,8 9,12" />
    </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2,8 6,12 14,4" />
    </svg>
);

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1" />
        <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" />
    </svg>
);

const VerticalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
        <rect x="5" y="2" width="6" height="12" rx="2" />
    </svg>
);

const HorizontalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
        <rect x="2" y="5" width="12" height="6" rx="2" />
    </svg>
);

export const ToolbarContextMenu: React.FC<ToolbarContextMenuProps> = ({ x, y, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const bindingSide = useSettingsStore(state => state.toolbarBindingSide);
    const setToolbarBindingSide = useSettingsStore(state => state.setToolbarBindingSide);
    const autoConnect = useSettingsStore(state => state.autoBindToolbarToOriginal);
    const setAutoConnect = useSettingsStore(state => state.setAutoBindToolbarToOriginal);
    const language = useSettingsStore(state => state.language);
    const isBound = useToolbarStore(state => state.toolbarBoundImageId !== null);
    const orientation = useToolbarStore(state => state.orientation);
    const setOrientation = useToolbarStore(state => state.setOrientation);

    const clampedX = Math.min(x, window.innerWidth - MENU_W - 8);
    const clampedY = Math.min(y, window.innerHeight - MENU_H - 8);

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleBindingSide = (side: 'left' | 'right') => {
        if (!isBound) return;
        setToolbarBindingSide(side);
        onClose();
    };

    const handleOrientation = (o: 'vertical' | 'horizontal') => {
        setOrientation(o);
        onClose();
    };

    const handleAutoConnect = () => {
        setAutoConnect(!autoConnect);
        // 구독 알림을 기다리지 않고 즉시 바인딩 상태 동기화
        forceSyncBinding();
        onClose();
    };

    const menuEl = (
        <div
            ref={menuRef}
            className="fixed py-1 rounded-xl border border-white/10 backdrop-blur-md shadow-2xl"
            style={{
                left: clampedX,
                top: clampedY,
                minWidth: MENU_W,
                zIndex: Z_INDEX.TOOLBAR_CONTEXT_MENU,
                background: 'rgba(18, 18, 18, 0.96)',
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {t('toolbar.autoConnect', language)}
            </div>

            <button
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/[0.07] ${autoConnect ? 'text-yellow-400' : 'text-zinc-200'}`}
                onClick={handleAutoConnect}
            >
                <LinkIcon className="w-4 h-4 flex-shrink-0" />
                <span>{t('toolbar.autoConnect', language)}</span>
                {autoConnect && <CheckIcon className="w-3.5 h-3.5 ml-auto text-yellow-400" />}
            </button>

            <div className="h-px bg-white/10 my-1 mx-3" />
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {t('toolbar.layout', language)}
            </div>

            <button
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/[0.07] ${orientation === 'vertical' ? 'text-yellow-400' : 'text-zinc-200'}`}
                onClick={() => handleOrientation('vertical')}
            >
                <VerticalIcon className="w-4 h-4 flex-shrink-0" />
                <span>{t('toolbar.vertical', language)}</span>
                {orientation === 'vertical' && <CheckIcon className="w-3.5 h-3.5 ml-auto text-yellow-400" />}
            </button>

            <button
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/[0.07] ${orientation === 'horizontal' ? 'text-yellow-400' : 'text-zinc-200'}`}
                onClick={() => handleOrientation('horizontal')}
            >
                <HorizontalIcon className="w-4 h-4 flex-shrink-0" />
                <span>{t('toolbar.horizontal', language)}</span>
                {orientation === 'horizontal' && <CheckIcon className="w-3.5 h-3.5 ml-auto text-yellow-400" />}
            </button>

            <div className="h-px bg-white/10 my-1 mx-3" />
            <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${isBound ? 'text-zinc-500' : 'text-zinc-700'}`}>
                {t('toolbar.bindingDirection', language)}
            </div>

            <button
                disabled={!isBound}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                    !isBound
                        ? 'opacity-35 cursor-not-allowed text-zinc-500'
                        : `hover:bg-white/[0.07] ${bindingSide === 'left' ? 'text-yellow-400' : 'text-zinc-200'}`
                }`}
                onClick={() => handleBindingSide('left')}
            >
                <ArrowLeftIcon className="w-4 h-4 flex-shrink-0" />
                <span>{t('toolbar.bindLeft', language)}</span>
                {isBound && bindingSide === 'left' && <CheckIcon className="w-3.5 h-3.5 ml-auto text-yellow-400" />}
            </button>

            <button
                disabled={!isBound}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                    !isBound
                        ? 'opacity-35 cursor-not-allowed text-zinc-500'
                        : `hover:bg-white/[0.07] ${bindingSide === 'right' ? 'text-yellow-400' : 'text-zinc-200'}`
                }`}
                onClick={() => handleBindingSide('right')}
            >
                <ArrowRightIcon className="w-4 h-4 flex-shrink-0" />
                <span>{t('toolbar.bindRight', language)}</span>
                {isBound && bindingSide === 'right' && <CheckIcon className="w-3.5 h-3.5 ml-auto text-yellow-400" />}
            </button>
        </div>
    );

    return ReactDOM.createPortal(menuEl, document.body);
};
