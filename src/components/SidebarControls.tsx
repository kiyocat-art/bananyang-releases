import React from 'react';
import type { SidebarState, ColumnInfo } from '../hooks/useDockLayout';
import { MIN_STACK_HEIGHT, APP_HEADER_HEIGHT, DOCK_MARGIN, SIDEBAR_MIN_WIDTH } from '../hooks/useDockLayout';
import { Z_INDEX } from '../constants/zIndex';

interface SidebarControlsProps {
    side: 'left' | 'right';
    sidebar: SidebarState;
    setSidebar: (fn: (prev: SidebarState) => SidebarState) => void;
}

/**
 * 컬럼 단위로 boundary splitter(수직 스택 사이) + 너비 리사이저(컬럼 가장자리) 렌더링.
 * 패널 array 인덱싱은 column.panels 기준.
 */
const ColumnControls: React.FC<{
    side: 'left' | 'right';
    column: ColumnInfo;
    columnX: number;                                  // 컬럼 좌측 x 좌표
    onColumnChange: (next: ColumnInfo) => void;
    /** 너비 리사이저 활성화 여부 (캔버스 쪽 외곽 컬럼에만) */
    showWidthResizer: boolean;
    isWidthResizerOnLeft: boolean;                    // true: 왼쪽 가장자리에 표시 (오른쪽 사이드바용)
}> = ({ side, column, columnX, onColumnChange, showWidthResizer, isWidthResizerOnLeft }) => {
    const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;

    return (
        <>
            {/* 컬럼 내 stack splitter (panels >= 2) */}
            {column.panels.length >= 2 && column.splitRatios.map((ratio, splitterIdx) => {
                const splitterY = APP_HEADER_HEIGHT + availableHeight * ratio;
                return (
                    <div
                        key={`${side}-col-splitter-${columnX}-${splitterIdx}`}
                        style={{
                            position: 'fixed',
                            left: columnX,
                            top: splitterY - 4,
                            width: column.width,
                            height: 8,
                            cursor: 'row-resize',
                            zIndex: Z_INDEX.CANVAS_INTERACTION,
                        }}
                        className="hover:bg-white/10 transition-colors group"
                        onMouseDown={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            const startY = e.clientY;
                            const startRatio = ratio;
                            const bounds = [0, ...column.splitRatios, 1];
                            const minRatio = MIN_STACK_HEIGHT / availableHeight;
                            const handleMouseMove = (mv: MouseEvent) => {
                                const newRatio = Math.max(
                                    bounds[splitterIdx] + minRatio,
                                    Math.min(bounds[splitterIdx + 2] - minRatio, startRatio + (mv.clientY - startY) / availableHeight)
                                );
                                const newRatios = [...column.splitRatios];
                                newRatios[splitterIdx] = newRatio;
                                onColumnChange({ ...column, splitRatios: newRatios });
                            };
                            const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                            };
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                        }}
                    >
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 bg-white/20 rounded-full group-hover:bg-white/50" />
                    </div>
                );
            })}

            {/* 컬럼 너비 리사이저 (캔버스 쪽 외곽) */}
            {showWidthResizer && column.panels.length >= 1 && (
                <div
                    style={{
                        position: 'fixed',
                        left: isWidthResizerOnLeft ? columnX - 4 : columnX + column.width - 4,
                        top: APP_HEADER_HEIGHT,
                        width: 8,
                        height: availableHeight,
                        cursor: 'col-resize',
                        zIndex: Z_INDEX.CANVAS_INTERACTION,
                    }}
                    className="hover:bg-white/10 transition-colors"
                    onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const startX = e.clientX;
                        const startWidth = column.width;
                        const handleMouseMove = (mv: MouseEvent) => {
                            const delta = isWidthResizerOnLeft ? startX - mv.clientX : mv.clientX - startX;
                            const newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(startWidth + delta, 1100));
                            onColumnChange({ ...column, width: newWidth });
                        };
                        const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                    }}
                />
            )}
        </>
    );
};

export const SidebarControls: React.FC<SidebarControlsProps> = ({
    side,
    sidebar,
    setSidebar,
}) => {
    const isLeft = side === 'left';
    const primary: ColumnInfo = { width: sidebar.width, panels: sidebar.panels, splitRatios: sidebar.splitRatios };
    const secondary = sidebar.secondaryColumn;

    // 컬럼 위치 계산:
    //  - LEFT 사이드바: primary x=0, secondary x=primary.width (안쪽)
    //  - RIGHT 사이드바: primary x=W-primary.width, secondary x=primary.x - secondary.width
    const primaryX = isLeft ? 0 : window.innerWidth - primary.width;
    const secondaryX = secondary
        ? (isLeft ? primaryX + primary.width : primaryX - secondary.width)
        : 0;

    return (
        <>
            <ColumnControls
                side={side}
                column={primary}
                columnX={primaryX}
                showWidthResizer={!secondary} // secondary가 있으면 별도 처리
                isWidthResizerOnLeft={!isLeft}
                onColumnChange={(next) =>
                    setSidebar(prev => ({ ...prev, width: next.width, panels: next.panels, splitRatios: next.splitRatios }))
                }
            />
            {secondary && (
                <ColumnControls
                    side={side}
                    column={secondary}
                    columnX={secondaryX}
                    showWidthResizer={true}
                    isWidthResizerOnLeft={!isLeft}  // 캔버스 쪽 외곽이 secondary의 너비 리사이저 위치
                    onColumnChange={(next) =>
                        setSidebar(prev => prev.secondaryColumn ? { ...prev, secondaryColumn: next } : prev)
                    }
                />
            )}
            {/* 컬럼 간 boundary 리사이저 (primary <-> secondary) */}
            {secondary && (
                <div
                    style={{
                        position: 'fixed',
                        left: isLeft ? primary.width - 4 : primaryX - 4,
                        top: APP_HEADER_HEIGHT,
                        width: 8,
                        height: window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN,
                        cursor: 'col-resize',
                        zIndex: Z_INDEX.CANVAS_INTERACTION,
                    }}
                    className="hover:bg-white/10 transition-colors"
                    onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const startX = e.clientX;
                        const startPrimaryWidth = primary.width;
                        const startSecondaryWidth = secondary.width;
                        const handleMouseMove = (mv: MouseEvent) => {
                            const delta = isLeft ? mv.clientX - startX : startX - mv.clientX;
                            const newPrimary = Math.max(SIDEBAR_MIN_WIDTH, startPrimaryWidth + delta);
                            const newSecondary = Math.max(SIDEBAR_MIN_WIDTH, startSecondaryWidth - delta);
                            setSidebar(prev => prev.secondaryColumn
                                ? { ...prev, width: newPrimary, secondaryColumn: { ...prev.secondaryColumn, width: newSecondary } }
                                : prev
                            );
                        };
                        const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                    }}
                />
            )}
        </>
    );
};
