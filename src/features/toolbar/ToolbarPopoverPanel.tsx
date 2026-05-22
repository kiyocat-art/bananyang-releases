import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useToolbarStore } from './useToolbarStore';
import { useSettingsStore } from '../../store/settingsStore';
import { APP_TOTAL_HEADER_HEIGHT } from '../../hooks/useDockLayout';
import { t } from '../../localization';
import { emitBindingDragStart, emitBindingDrag, emitBindingDragEnd } from './bindingDragBus';

const MIN_W = 280;
const MIN_H = 200;

type ResizeDir = 'n' | 'nw' | 'ne' | 's' | 'sw' | 'se' | 'w' | 'e';

interface ResizeState {
    dir: ResizeDir;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPX: number;
    startPY: number;
}

interface ToolbarPopoverPanelProps {
    language?: 'ko' | 'en';
    children: React.ReactNode;
    onToolbarDragDelta?: (dx: number, dy: number) => void;
}

/**
 * 툴바 팝오버 패널
 * - isPopoverDetached=false (기본): 툴바 옆에 도킹된 형태, 헤더 드래그 비활성
 * - isPopoverDetached=true: 자유 부유, 헤더 드래그 이동 가능, 5방향 리사이즈
 * - 헤더에 도킹해제/재도킹 버튼
 */
const ToolbarPopoverPanelInner: React.FC<ToolbarPopoverPanelProps> = ({
    children,
    onToolbarDragDelta,
}) => {
    const {
        activeToolId, setActiveToolId,
        isMinimized, setIsMinimized,
        popoverPosition, setPopoverPosition,
        popoverSize, setPopoverSize,
        toolbarSide,
        toolbarPosition, setToolbarPosition,
        setToolbarUserHeight, setToolbarUserWidth,
        isPopoverDetached, setIsPopoverDetached,
    } = useToolbarStore();

    const orientation = useToolbarStore(state => state.orientation);
    const language = useSettingsStore(state => state.language);
    const isHorizontal = orientation === 'horizontal';
    const toolbarRenderedHeight = useToolbarStore(state => state.toolbarRenderedHeight);
    const toolbarRenderedWidth = useToolbarStore(state => state.toolbarRenderedWidth);
    const toolbarBoundImageId = useToolbarStore(state => state.toolbarBoundImageId);
    const boundPopoverAnchor  = useToolbarStore(state => state.boundPopoverAnchor);
    const toolbarBoundImageOffScreen = useToolbarStore(state => state.toolbarBoundImageOffScreen);

    const panelRef = useRef<HTMLDivElement>(null);
    const dragOriginRef = useRef<{ type: 'toolbar' | 'popover' | 'bound-image'; mx: number; my: number; px: number; py: number } | null>(null);
    const resizeRef = useRef<ResizeState | null>(null);
    // 순간 delta 계산용 (툴바 이동 시 도킹된 패널에 전달)
    const prevDragToolbarPosRef = useRef<{ x: number; y: number } | null>(null);
    const onToolbarDragDeltaRef = useRef(onToolbarDragDelta);
    useEffect(() => { onToolbarDragDeltaRef.current = onToolbarDragDelta; }, [onToolbarDragDelta]);

    // 콘텐츠 전환 키 — 도구가 바뀔 때 fade 트리거
    const [contentKey, setContentKey] = useState(activeToolId ?? '');
    useEffect(() => {
        if (activeToolId) setContentKey(activeToolId);
    }, [activeToolId]);

    // 가로 모드 + 이미지 바인딩: 팝오버를 툴바 하단이 아닌 이미지 우측 상단에 배치
    const isBoundHorizontal = isHorizontal && !isPopoverDetached
        && toolbarBoundImageId !== null && boundPopoverAnchor !== null;

    // 세로 모드(도킹): 높이 = 툴바 실제 높이에 동기화 (패널 도킹 포함)
    // 가로 모드(바인딩 아님): 너비 = 툴바 실제 너비에 동기화
    // 가로 모드(바인딩): 독립 너비 사용
    // 분리(detached) 상태에서는 popoverSize로 자유 제어
    const effectiveHeight = (!isPopoverDetached && !isHorizontal)
        ? toolbarRenderedHeight
        : popoverSize.h;
    const effectiveWidth = (!isPopoverDetached && isHorizontal && !isBoundHorizontal)
        ? toolbarRenderedWidth
        : popoverSize.w;

    // 도킹 상태 위치 계산 — 항상 툴바 기준 배치 (바인딩 모드 포함)
    // toolbarSide='left' → 팝오버가 툴바 우측 (이미지 바깥쪽)
    // toolbarSide='right' → 팝오버가 툴바 좌측 (이미지 바깥쪽)
    const rawDockedX = isHorizontal
        ? toolbarPosition.x
        : (toolbarSide === 'left'
            ? toolbarPosition.x + toolbarRenderedWidth
            : toolbarPosition.x - effectiveWidth);
    // 패닝 시 자연스러운 화면 밖 이동을 위해 클램핑 제거
    const dockedX = rawDockedX;
    const rawDockedY = isHorizontal
        ? toolbarPosition.y + toolbarRenderedHeight
        : toolbarPosition.y;
    const dockedY = rawDockedY;

    // 실제 적용 위치 — 가로+바인딩 모드는 boundPopoverAnchor 우선
    const effectiveX = isPopoverDetached ? popoverPosition.x
        : isBoundHorizontal ? boundPopoverAnchor!.x
        : dockedX;
    const effectiveY = isPopoverDetached ? popoverPosition.y
        : isBoundHorizontal ? boundPopoverAnchor!.y
        : dockedY;

    // ── 헤더 드래그 ──────────────────────────────────────────
    const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.popover-header-btn')) return;
        e.preventDefault();
        
        if (!isPopoverDetached) {
            // 바인딩 이미지 모드: 이벤트 버스로 일체 이동
            if (toolbarBoundImageId !== null) {
                dragOriginRef.current = {
                    type: 'bound-image',
                    mx: e.clientX,
                    my: e.clientY,
                    px: toolbarPosition.x,
                    py: toolbarPosition.y,
                };
                emitBindingDragStart();
                return;
            }
            // 도킹 상태: 툴바 이동
            dragOriginRef.current = {
                type: 'toolbar',
                mx: e.clientX,
                my: e.clientY,
                px: toolbarPosition.x,
                py: toolbarPosition.y,
            };
            prevDragToolbarPosRef.current = { x: toolbarPosition.x, y: toolbarPosition.y };
        } else {
            // 분리 상태: 팝오버만 이동
            dragOriginRef.current = {
                type: 'popover',
                mx: e.clientX,
                my: e.clientY,
                px: popoverPosition.x,
                py: popoverPosition.y,
            };
        }
    }, [popoverPosition, toolbarPosition, isPopoverDetached, toolbarBoundImageId]);

    // ── 도킹 해제 / 재도킹 ──────────────────────────────────
    const handleToggleDetach = useCallback(() => {
        if (!isPopoverDetached) {
            // 분리: 현재 도킹 위치를 자유 부유 위치로 저장 (화면 안에 클램핑)
            setPopoverPosition({
                x: Math.max(8, Math.min(window.innerWidth - effectiveWidth - 8, rawDockedX)),
                y: Math.max(APP_TOTAL_HEADER_HEIGHT + 8, Math.min(window.innerHeight - effectiveHeight - 8, rawDockedY)),
            });
            setIsPopoverDetached(true);
        } else {
            setIsPopoverDetached(false);
        }
    }, [isPopoverDetached, rawDockedX, rawDockedY, effectiveWidth, effectiveHeight, setPopoverPosition, setIsPopoverDetached]);

    // ── 리사이즈 핸들 ─────────────────────────────────────────
    const handleResizeMouseDown = useCallback((e: React.MouseEvent, dir: ResizeDir) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = {
            dir,
            startX: e.clientX,
            startY: e.clientY,
            // 도킹 모드에서는 실제 렌더 크기(toolbar 동기화 값)를 초기값으로 사용
            startW: (!isPopoverDetached && isHorizontal) ? toolbarRenderedWidth : popoverSize.w,
            startH: (!isPopoverDetached && !isHorizontal) ? toolbarRenderedHeight : popoverSize.h,
            startPX: isPopoverDetached ? popoverPosition.x : (isBoundHorizontal ? boundPopoverAnchor!.x : dockedX),
            startPY: isPopoverDetached ? popoverPosition.y : (isBoundHorizontal ? boundPopoverAnchor!.y : dockedY),
        };
    }, [popoverSize, popoverPosition, isPopoverDetached, isHorizontal, isBoundHorizontal, boundPopoverAnchor, toolbarRenderedWidth, toolbarRenderedHeight, dockedX, dockedY]);

    // ── mousemove / mouseup ───────────────────────────────────
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            // 헤더 드래그
            if (dragOriginRef.current) {
                const MIN_MARGIN_Y = 56;
                const { type, mx, my, px, py } = dragOriginRef.current;
                
                if (type === 'bound-image') {
                    // 바인딩 이미지 드래그: incremental delta → 이벤트 버스
                    const dx = e.clientX - mx;
                    const dy = e.clientY - my;
                    dragOriginRef.current = { ...dragOriginRef.current, mx: e.clientX, my: e.clientY };
                    if (dx !== 0 || dy !== 0) {
                        emitBindingDrag(dx, dy);
                    }
                    return;
                } else if (type === 'toolbar') {
                    // 툴바 좌표 업데이트
                    // FloatingToolbar.tsx와 동일한 제약 조건 적용
                    const TOOLBAR_WIDTH = 52;
                    const el = panelRef.current; // 현재 팝오버 기준
                    const h = el?.offsetHeight ?? 400; // 대략적인 높이
                    // 툴바의 w,h만 사용
                    const MIN_MARGIN_X = 8;
                    const newX = Math.max(MIN_MARGIN_X, Math.min(
                        window.innerWidth - TOOLBAR_WIDTH - MIN_MARGIN_X,
                        px + e.clientX - mx
                    ));
                    const newY = Math.max(MIN_MARGIN_Y, Math.min(
                        window.innerHeight - 100 - MIN_MARGIN_X, // 툴바 대략적인 높이 고려
                        py + e.clientY - my
                    ));

                    // 순간 delta 계산 → 도킹된 패널에 전달
                    if (prevDragToolbarPosRef.current) {
                        const instantDx = newX - prevDragToolbarPosRef.current.x;
                        const instantDy = newY - prevDragToolbarPosRef.current.y;
                        if (instantDx !== 0 || instantDy !== 0) {
                            onToolbarDragDeltaRef.current?.(instantDx, instantDy);
                        }
                    }
                    prevDragToolbarPosRef.current = { x: newX, y: newY };

                    setToolbarPosition({ x: newX, y: newY });
                } else {
                    const el = panelRef.current;
                    const w = el?.offsetWidth ?? popoverSize.w;
                    const h = el?.offsetHeight ?? popoverSize.h;
                    const newX = Math.max(8, Math.min(window.innerWidth  - w - 8, px + e.clientX - mx));
                    const newY = Math.max(MIN_MARGIN_Y, Math.min(window.innerHeight - h - 8, py + e.clientY - my));
                    setPopoverPosition({ x: newX, y: newY });
                }
                return;
            }

            // 리사이즈
            if (resizeRef.current) {
                const MIN_MARGIN_Y = 56;
                const MIN_MARGIN_X = 8;
                const { dir, startX, startY, startW, startH, startPX, startPY } = resizeRef.current;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                // ── 도킹 상태 리사이즈 ─────────────────────────────
                if (!isPopoverDetached) {
                    if (!isHorizontal) {
                        // 세로 도킹: 너비(팝오버만) + 높이(툴바 동기화)
                        if (dir === 'e' || dir === 'se') {
                            setPopoverSize({ w: Math.max(MIN_W, startW + dx), h: popoverSize.h });
                        }
                        if (dir === 'w' || dir === 'sw') {
                            setPopoverSize({ w: Math.max(MIN_W, startW - dx), h: popoverSize.h });
                        }
                        if (dir === 's' || dir === 'se' || dir === 'sw') {
                            setToolbarUserHeight(Math.max(MIN_H, startH + dy));
                        }
                    } else {
                        // 가로 도킹: 높이(팝오버만) + 너비(툴바 동기화, w 방향은 X 이동 포함)
                        if (dir === 's' || dir === 'sw' || dir === 'se') {
                            setPopoverSize({ w: popoverSize.w, h: Math.max(MIN_H, startH + dy) });
                        }
                        if (dir === 'e' || dir === 'se') {
                            setToolbarUserWidth(Math.max(MIN_W, startW + dx));
                        }
                        if (dir === 'w' || dir === 'sw') {
                            const newW = Math.max(MIN_W, startW - dx);
                            const actualExpansion = newW - startW;
                            setToolbarUserWidth(newW);
                            if (actualExpansion > 0) {
                                setToolbarPosition({
                                    x: Math.max(MIN_MARGIN_X, startPX - actualExpansion),
                                    y: useToolbarStore.getState().toolbarPosition.y,
                                });
                            }
                        }
                    }
                    return;
                }

                // ── 분리(detached) 상태 리사이즈 ─────────────────────
                let newW = startW;
                let newH = startH;
                let newX = startPX;
                let newY = startPY;

                if (dir === 's' || dir === 'sw' || dir === 'se') {
                    newH = Math.max(MIN_H, startH + dy);
                }
                if (dir === 'e' || dir === 'se') {
                    newW = Math.max(MIN_W, startW + dx);
                }
                if (dir === 'w' || dir === 'sw') {
                    const proposedW = startW - dx;
                    if (proposedW >= MIN_W) {
                        newW = proposedW;
                        newX = startPX + dx;
                    }
                }
                if (dir === 'n' || dir === 'nw' || dir === 'ne') {
                    const proposedH = Math.max(MIN_H, startH - dy);
                    const proposedY = startPY + (startH - proposedH);

                    if (proposedY >= MIN_MARGIN_Y) {
                        newH = proposedH;
                        newY = proposedY;
                    } else {
                        newY = MIN_MARGIN_Y;
                        newH = startH + (startPY - MIN_MARGIN_Y);
                    }
                }

                newX = Math.max(8, Math.min(newX, window.innerWidth - newW - 8));
                newY = Math.max(MIN_MARGIN_Y, Math.min(newY, window.innerHeight - newH - 8));

                setPopoverSize({ w: newW, h: newH });
                if (newX !== startPX || newY !== startPY) {
                    setPopoverPosition({ x: newX, y: newY });
                }
                return;
            }
        };

        const onUp = () => {
            // 바인딩 이미지 드래그 종료
            if (dragOriginRef.current?.type === 'bound-image') {
                dragOriginRef.current = null;
                emitBindingDragEnd();
                return;
            }
            dragOriginRef.current = null;
            resizeRef.current = null;
            prevDragToolbarPosRef.current = null;
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [popoverSize, popoverPosition, isPopoverDetached, isHorizontal, setPopoverPosition, setPopoverSize, setToolbarUserHeight, setToolbarUserWidth, setToolbarPosition]);

    if (toolbarBoundImageId && toolbarBoundImageOffScreen) return null;
    if (!activeToolId) return null;

    // 팝오버 등장 방향 애니메이션
    // 가로+바인딩: 이미지 우측 상단에서 등장 → 좌측에서 슬라이드
    const animClass = isHorizontal
        ? (isBoundHorizontal ? 'popover-from-left' : 'popover-from-bottom')
        : (toolbarSide === 'left' ? 'popover-from-right' : 'popover-from-left');
    const dockedClass = !isPopoverDetached ? `popover-docked popover-docked-${isHorizontal ? 'bottom' : toolbarSide}` : '';

    // 외측 리사이즈 핸들 방향 (도킹 상태: 1방향만)
    const outerResizeDir: ResizeDir = isHorizontal ? 's' : (toolbarSide === 'left' ? 'e' : 'w');

    const content = (
        <div
            ref={panelRef}
            className={`toolbar-popover ${animClass} ${dockedClass}`}
            style={{
                left: 0,
                top: 0,
                transform: `translate3d(${effectiveX}px, ${effectiveY}px, 0)`,
                willChange: 'transform',
                width: effectiveWidth,
                height: isMinimized ? 'auto' : effectiveHeight,
            }}
        >
            {/* ── 헤더 ── */}
            <div
                className="popover-header flex items-center justify-between px-2"
                onMouseDown={handleHeaderMouseDown}
            >
                {/* 도킹 해제 / 재도킹 버튼 — 좌측 */}
                <button
                    className="popover-header-btn"
                    aria-label={isPopoverDetached ? t('toolbar.dockToToolbar', language) : t('toolbar.undock', language)}
                    onClick={handleToggleDetach}
                    title={isPopoverDetached ? t('toolbar.dockToToolbar', language) : t('toolbar.undock', language)}
                >
                    {isPopoverDetached ? '⊞' : '⊟'}
                </button>
                {/* 최소화 + 닫기 — 우측 */}
                <div className="flex items-center gap-1">
                    <button
                        className="popover-header-btn"
                        aria-label={isMinimized ? t('toolbar.restore', language) : t('toolbar.minimize', language)}
                        onClick={() => setIsMinimized(!isMinimized)}
                        title={isMinimized ? t('toolbar.restore', language) : t('toolbar.minimize', language)}
                    >
                        {isMinimized ? '□' : '−'}
                    </button>
                    <button
                        className="popover-header-btn"
                        aria-label={t('toolbar.close', language)}
                        onClick={() => setActiveToolId(null)}
                        title={t('toolbar.close', language)}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* ── 본문 ── */}
            {!isMinimized && (
                <div className="popover-body relative">
                    <div key={contentKey} className="popover-content-enter">
                        {children}
                    </div>
                </div>
            )}

            {/* ── 리사이즈 핸들 ── */}
            {!isMinimized && (
                isPopoverDetached ? (
                    /* 자유 부유: 5방향 모두 */
                    <>
                        <div className="resize-handle-s"  onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
                        <div className="resize-handle-sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
                        <div className="resize-handle-se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
                        <div className="resize-handle-w"  onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
                        <div className="resize-handle-e"  onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
                    </>
                ) : !isHorizontal ? (
                    /* 세로 도킹: 외측 너비 + 하단 높이 + 외측 하단 모서리
                     * toolbarSide='left'  → e, s, se
                     * toolbarSide='right' → w, s, sw */
                    <>
                        <div
                            className={`resize-handle-${outerResizeDir}`}
                            onMouseDown={(e) => handleResizeMouseDown(e, outerResizeDir)}
                        />
                        <div className="resize-handle-s"
                            onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
                        <div
                            className={`resize-handle-s${toolbarSide === 'left' ? 'e' : 'w'}`}
                            onMouseDown={(e) => handleResizeMouseDown(e, toolbarSide === 'left' ? 'se' : 'sw')}
                        />
                    </>
                ) : (
                    /* 가로 도킹: 하단 높이 + 좌우 너비 + 하단 모서리 (상단 바인딩 제외)
                     * w, e, s, sw, se */
                    <>
                        <div className="resize-handle-s"  onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
                        <div className="resize-handle-sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
                        <div className="resize-handle-se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
                        <div className="resize-handle-w"  onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
                        <div className="resize-handle-e"  onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
                    </>
                )
            )}
        </div>
    );

    // document.body에 포탈 렌더링: 어떤 조상 요소의 CSS transform/overflow에도 영향받지 않음
    return ReactDOM.createPortal(content, document.body);
};

export const ToolbarPopoverPanel = React.memo(ToolbarPopoverPanelInner);
