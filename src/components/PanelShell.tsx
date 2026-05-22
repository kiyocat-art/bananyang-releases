import React from 'react';
import type { Language } from '../localization';
import { t } from '../localization';
import type { PanelState, DockSide } from '../hooks/useDockingSystem';
import { MinusIcon, PinIcon, ResetIcon, SquareIcon, UndockIcon } from './icons';
import { Tooltip } from './Tooltip';
import { Z_INDEX } from '../constants/zIndex';

export type StackVariant =
    | 'sidebar-top'
    | 'sidebar-bottom'
    | 'snap-top'
    | 'snap-bottom'
    | null;

interface PanelShellProps {
    isVisible: boolean;
    panelState: PanelState;
    stackVariant: StackVariant;
    isSnapped: boolean;
    title: string;
    icon: React.ReactNode;
    language: Language;
    onDragStart: (e: React.MouseEvent) => void;
    onResizeStart: (e: React.MouseEvent, dir: string) => void;
    onToggleCollapse: () => void;
    onReset: () => void;
    onClose: () => void;
    onUnsnap: () => void;
    onUndockFromSidebar?: () => void;
    children: React.ReactNode;
    extraClassName?: string;
    /** useDockingSystem이 드래그 중 data-dragging 속성을 DOM 직접 조작하는 데 사용 */
    panelId?: string;
    /** [TOOLBAR BIND] 현재 툴바가 이 패널에 바인딩되어 있는지 (아이콘 활성 표시) */
    toolbarBoundHere?: boolean;
    /** [TOOLBAR BIND] 사이드바 2단 스택일 때 헤더 PinIcon 클릭 핸들러. 미지정 시 아이콘 숨김. */
    onBindToolbarHere?: () => void;
}

function computePanelClass(dockSide: DockSide, sv: StackVariant): string {
    if (dockSide !== null) {
        const sideClass = dockSide === 'left' ? 'border-l-0' : 'border-r-0';
        if (sv === 'sidebar-top') {
            return dockSide === 'left'
                ? `rounded-tr-3xl ${sideClass} border-b-0`
                : `rounded-tl-3xl ${sideClass} border-b-0`;
        }
        if (sv === 'sidebar-bottom') {
            return dockSide === 'left'
                ? `rounded-br-3xl ${sideClass} border-t-0`
                : `rounded-bl-3xl ${sideClass} border-t-0`;
        }
        return dockSide === 'left'
            ? `rounded-r-3xl ${sideClass}`
            : `rounded-l-3xl ${sideClass}`;
    }
    if (sv === 'snap-top') return 'rounded-t-3xl border-b-0';
    if (sv === 'snap-bottom') return 'rounded-b-3xl border-t-0';
    return 'rounded-3xl';
}

function computeHeaderRoundClass(dockSide: DockSide, sv: StackVariant): string {
    if (dockSide !== null) return '';
    if (sv === 'snap-bottom') return '';
    return 'rounded-t-3xl';
}

export const PanelShell: React.FC<PanelShellProps> = ({
    isVisible,
    panelState,
    stackVariant,
    isSnapped,
    title,
    icon,
    language,
    onDragStart,
    onResizeStart,
    onToggleCollapse,
    onReset,
    onClose,
    onUnsnap,
    onUndockFromSidebar,
    children,
    extraClassName,
    panelId,
    toolbarBoundHere,
    onBindToolbarHere,
}) => {
    const dockSide = panelState.dockSide;
    const isDockedToAnySide = dockSide !== null;
    const isTopInSnap = stackVariant === 'snap-top';
    const isSidebarStacked =
        stackVariant === 'sidebar-top' || stackVariant === 'sidebar-bottom';

    const panelClass = computePanelClass(dockSide, stackVariant);
    const headerRoundClass = computeHeaderRoundClass(dockSide, stackVariant);

    return (
        <>
            {(isVisible || dockSide !== null) && (
                <div
                    data-panel-id={panelId}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: panelState.width,
                        height: panelState.isCollapsed ? 'auto' : panelState.height,
                        transform: `translate3d(${panelState.x}px, ${panelState.y}px, 0)`,
                        zIndex: panelState.dockSide === null ? Z_INDEX.PANEL_FLOATING : Z_INDEX.PANEL,
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                    }}
                    className={`glass-panel flex flex-col overflow-hidden ${panelClass}${extraClassName ? ` ${extraClassName}` : ''}`}
                >
                    {/* Header */}
                    <div
                        onMouseDown={onDragStart}
                        onDoubleClick={onToggleCollapse}
                        className={`h-12 px-5 flex items-center justify-between flex-shrink-0 cursor-move border-b border-white/5 bg-white/5 select-none ${headerRoundClass}`}
                    >
                        <div className="flex items-center gap-3">
                            {icon}
                            <h2 className="font-bold text-base text-white drop-shadow-md">
                                {title}
                            </h2>
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Floating vertical snap undock */}
                            {isSnapped && (
                                <Tooltip tip={t('panel.unsnapGroup', language)} position="top">
                                    <button
                                        onClick={onUnsnap}
                                        className="p-2 text-amber-400/80 hover:text-amber-300 transition-colors rounded-full hover:bg-white/10"
                                        aria-label={t('panel.unsnapGroup', language)}
                                    >
                                        <UndockIcon />
                                    </button>
                                </Tooltip>
                            )}
                            {/* Sidebar stack undock */}
                            {isSidebarStacked && onUndockFromSidebar && (
                                <Tooltip tip={t('panel.undockSidebar', language)} position="top">
                                    <button
                                        onClick={onUndockFromSidebar}
                                        className="p-2 text-amber-400/80 hover:text-amber-300 transition-colors rounded-full hover:bg-white/10"
                                        aria-label={t('panel.undockSidebar', language)}
                                    >
                                        <UndockIcon />
                                    </button>
                                </Tooltip>
                            )}
                            {/* [TOOLBAR BIND] Toolbar binding selector — visible only when this panel
                                is part of a 2-stack sidebar group AND the toolbar is already docked to
                                one of those panels (so we know which side to attach to). */}
                            {isSidebarStacked && onBindToolbarHere && (
                                <Tooltip tip={t('panel.bindToolbar', language)} position="top">
                                    <button
                                        onClick={onBindToolbarHere}
                                        aria-pressed={!!toolbarBoundHere}
                                        aria-label={t('panel.bindToolbar', language)}
                                        className={`p-2 transition-colors rounded-full hover:bg-white/10 ${
                                            toolbarBoundHere
                                                ? 'text-cyan-300'
                                                : 'text-white/60 hover:text-white'
                                        }`}
                                    >
                                        <PinIcon className="w-4 h-4" />
                                    </button>
                                </Tooltip>
                            )}
                            <Tooltip tip={t('tooltip.resetAll', language)} position="top">
                                <button
                                    onClick={onReset}
                                    className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
                                >
                                    <ResetIcon className="w-4 h-4" />
                                </button>
                            </Tooltip>
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            <button
                                onClick={onToggleCollapse}
                                className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
                                aria-label={panelState.isCollapsed ? 'Expand panel' : 'Collapse panel'}
                            >
                                {panelState.isCollapsed
                                    ? <SquareIcon className="w-4 h-4" />
                                    : <MinusIcon className="w-4 h-4" />
                                }
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
                                title={t('toolbar.close', language)}
                                aria-label={t('toolbar.close', language)}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content + resize handles */}
                    {!panelState.isCollapsed && (
                        <div className="flex-grow min-h-0 relative">
                            {children}
                            {/* Docked resize handle */}
                            {isDockedToAnySide && (
                                <div
                                    onMouseDown={(e) => onResizeStart(e, dockSide === 'left' ? 'e' : 'w')}
                                    className={`absolute top-0 ${dockSide === 'left' ? 'right-0' : 'left-0'} w-2 h-full cursor-col-resize hover:bg-white/10 transition-colors`}
                                    style={{ zIndex: Z_INDEX.PANEL_RESIZE_CORNER }}
                                />
                            )}
                            {/* Floating resize handles */}
                            {!isDockedToAnySide && (
                                <>
                                    {!isTopInSnap && (
                                        <div onMouseDown={(e) => onResizeStart(e, 'se')} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1.5" style={{ zIndex: Z_INDEX.PANEL_RESIZE_CORNER }}>
                                            <svg className="w-2.5 h-2.5 text-white/30" fill="none" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="2"><path d="M 0 8 L 8 0 M 3 8 L 8 3 M 6 8 L 8 6" /></svg>
                                        </div>
                                    )}
                                    {!isTopInSnap && (
                                        <div onMouseDown={(e) => onResizeStart(e, 'sw')} className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize flex items-end justify-start p-1.5" style={{ zIndex: Z_INDEX.PANEL_RESIZE_CORNER }}>
                                            <svg className="w-2.5 h-2.5 text-white/30" fill="none" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="2"><path d="M 8 8 L 0 0 M 5 8 L 0 3 M 2 8 L 0 6" /></svg>
                                        </div>
                                    )}
                                    <div onMouseDown={(e) => onResizeStart(e, 'w')} className="absolute left-0 top-6 bottom-6 w-1.5 cursor-w-resize hover:bg-white/10 transition-colors" style={{ zIndex: Z_INDEX.PANEL_RESIZE_HANDLE }} />
                                    <div onMouseDown={(e) => onResizeStart(e, 'e')} className="absolute right-0 top-6 bottom-6 w-1.5 cursor-e-resize hover:bg-white/10 transition-colors" style={{ zIndex: Z_INDEX.PANEL_RESIZE_HANDLE }} />
                                    {!isTopInSnap && (
                                        <div onMouseDown={(e) => onResizeStart(e, 's')} className="absolute bottom-0 left-6 right-6 h-1.5 cursor-s-resize hover:bg-white/10 transition-colors" style={{ zIndex: Z_INDEX.PANEL_RESIZE_HANDLE }} />
                                    )}
                                    <div onMouseDown={(e) => onResizeStart(e, 'nw')} className="absolute top-0 left-0 w-5 h-5 cursor-nw-resize" style={{ zIndex: Z_INDEX.PANEL_RESIZE_CORNER }} />
                                    <div onMouseDown={(e) => onResizeStart(e, 'ne')} className="absolute top-0 right-0 w-5 h-5 cursor-ne-resize" style={{ zIndex: Z_INDEX.PANEL_RESIZE_CORNER }} />
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
