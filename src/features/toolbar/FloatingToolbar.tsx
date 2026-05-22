import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TOOLBAR_ITEMS } from './toolbarConfig';
import { useToolbarStore } from './useToolbarStore';
import { ToolbarTooltip } from './ToolbarTooltip';
import { ToolbarContextMenu } from './ToolbarContextMenu';
import { ToolbarScrollContainer } from './ToolbarScrollContainer';
import { useUIStore } from '../../store/uiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useCanvasStore } from '../../store/canvasStore';
import { APP_TOTAL_HEADER_HEIGHT } from '../../hooks/useDockLayout';
import { t } from '../../localization';
import type { Language } from '../../localization';
import { emitBindingDragStart, emitBindingDrag, emitBindingDragEnd } from './bindingDragBus';
import type { ModelName } from '../../types';

export interface DockTarget {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isVisible: boolean;
    /** 패널이 도킹된 사이드바 방향. null=부유, undefined=미지원 */
    dockSide?: 'left' | 'right' | null;
}

interface FloatingToolbarProps {
    language?: Language;
    onToolActivate?: (toolKey: string | null) => void;
    dockTargets?: DockTarget[];
    onDockedPanelDragDelta?: (dx: number, dy: number) => void;
    /** 툴바+부유패널 그룹을 사이드바 도킹 패널의 위/아래 12px 엣지에 드롭 시 호출 */
    onCommitGroupStack?: (
        targetPanelId: string,
        position: 'top' | 'bottom',
        draggingPanelId: string,
    ) => void;
    modelName?: ModelName;
}

// 툴바 베이스 크기 (v35: 커스텀 스케일러 제거 — OS DPI 직접 위임)
const TOOLBAR_WIDTH_BASE = 52; // px (세로 모드 너비 베이스)
const TOOLBAR_HEIGHT_BASE = 52; // px (가로 모드 높이 베이스)
const MIN_MARGIN_X = 8;     // viewport 좌우 여백 (스케일 무관, 화면 끝 여백)
const MIN_MARGIN_Y = APP_TOTAL_HEADER_HEIGHT + 8; // viewport 상하 여백 (헤더 36 + 탭바 36 + 8 = 80)
const DOCK_THRESHOLD = 30; // 스냅 감지 임계값 (px, 스케일 무관 — 사용자 마우스 정확도 기준)

const FloatingToolbarInner: React.FC<FloatingToolbarProps> = ({
    language = 'ko',
    onToolActivate,
    dockTargets,
    onDockedPanelDragDelta,
    onCommitGroupStack,
    modelName = 'gemini-2.5-flash-image',
}) => {
    const {
        activeToolId, toggleTool,
        toolbarSide, setToolbarSide,
        toolbarDockedTo, setToolbarDockedTo,
        toolbarFloatingPosition, setToolbarFloatingPosition,
        setToolbarDockedHeight,
        isPopoverDetached,
        toolbarUserHeight, setToolbarUserHeight,
        toolbarUserWidth, setToolbarUserWidth,
        setToolbarRenderedHeight,
        setToolbarRenderedWidth,
        toolbarBoundImageId, setToolbarBoundImageId,
    } = useToolbarStore();

    // [PERF] toolbarPosition을 React 구독에서 제거 — subscribe로 DOM 직접 조작
    // toolbarPosition 변경이 React reconciliation을 우회하여 리렌더 0회 달성
    useEffect(() => {
        const el = toolbarRef.current;
        if (!el) return;
        const { x, y } = useToolbarStore.getState().toolbarPosition;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        return useToolbarStore.subscribe(state => {
            if (toolbarRef.current) {
                const { x: sx, y: sy } = state.toolbarPosition;
                toolbarRef.current.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
                toolbarRef.current.style.visibility =
                    (state.toolbarBoundImageId && state.toolbarBoundImageOffScreen) ? 'hidden' : '';
            }
        });
    }, []);

    const setSnapIndicator = useUIStore(state => state.setSnapIndicator);
    const hasOriginalImage = useCanvasStore(state => state.boardImages.some(img => img.role === 'original'));
    const orientation = useToolbarStore(state => state.orientation);
    const setOrientation = useToolbarStore(state => state.setOrientation);
    const isHorizontal = orientation === 'horizontal';

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const toolbarRef = useRef<HTMLDivElement>(null);
    const dragOriginRef = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
    // 드래그 중 감지된 도킹 후보
    const pendingDockRef = useRef<{ panelId: string; side: 'left' | 'right' | 'bottom' } | null>(null);
    // 툴바+부유패널 그룹 드래그 중 감지된 stack-into 후보 (사이드바 도킹 패널의 위/아래 12px 엣지)
    const pendingPanelStackRef = useRef<{
        targetPanelId: string;
        position: 'top' | 'bottom';
    } | null>(null);
    // 위치/side/높이 sync 무한루프 방지
    const lastSyncedRef = useRef<{ x: number; y: number; side: 'left' | 'right' | 'bottom' | null; h: number }>({
        x: -1, y: -1, side: null, h: -1,
    });
    // dockTargets prop의 최신 값을 이벤트 핸들러에서 안전하게 참조
    const dockTargetsRef = useRef(dockTargets);
    useEffect(() => { dockTargetsRef.current = dockTargets; }, [dockTargets]);
    // 순간 delta 계산용 (도킹 중 패널 그룹 이동)
    const prevDragPosRef = useRef<{ x: number; y: number } | null>(null);
    const onDockedPanelDragDeltaRef = useRef(onDockedPanelDragDelta);
    useEffect(() => { onDockedPanelDragDeltaRef.current = onDockedPanelDragDelta; }, [onDockedPanelDragDelta]);
    const onCommitGroupStackRef = useRef(onCommitGroupStack);
    useEffect(() => { onCommitGroupStackRef.current = onCommitGroupStack; }, [onCommitGroupStack]);
    // 바인딩 이미지 드래그 중 이전 마우스 위치 추적 (incremental delta 계산)
    const prevMouseRef = useRef<{ x: number; y: number } | null>(null);
    // 최신 toolbarDockedTo를 이벤트 핸들러에서 참조
    const toolbarDockedToRef = useRef(toolbarDockedTo);
    useEffect(() => { toolbarDockedToRef.current = toolbarDockedTo; }, [toolbarDockedTo]);

    // 툴바 side 자동 판단
    const recalcSide = useCallback((x: number, currentActiveToolId: string | null = null, currentPopoverSize: {w: number, h: number} | null = null, force = false) => {
        // Find the tool's size to know how much space it needs
        const activeTool = currentActiveToolId || useToolbarStore.getState().activeToolId;

        // [FIX] 팝오버가 이미 열려있는 상태에서 이동할 때는 방향을 유지함 (force === true 일 때만 방향 변경 허용)
        if (activeTool && !force) return;

        const popSize = currentPopoverSize || useToolbarStore.getState().popoverSize;

        const item = activeTool ? TOOLBAR_ITEMS.find(i => i.key === activeTool) : null;
        const requiredW = item ? item.defaultSize.w : popSize.w;

        const scaledToolbarWidth = TOOLBAR_WIDTH_BASE;
        const screenW = window.innerWidth;
        const spaceOnRight = screenW - (x + scaledToolbarWidth + MIN_MARGIN_X);
        const spaceOnLeft = x - MIN_MARGIN_X;

        let side: 'left' | 'right';

        // 1. 기본: 캔버스 중심 기준으로 우측에 있으면 좌측 출력('right'), 좌측에 있으면 우측 출력('left')
        const isRightHalf = x + scaledToolbarWidth / 2 >= screenW / 2;

        if (isRightHalf) {
            // 중심 우측 -> 툴바 좌측 출력 선호 ('right' side)
            // 좌측 공간이 부족한지 확인
            if (spaceOnLeft < requiredW) {
                // 공간 부족! 우측으로 출력 시도 (만약 가능하다면)
                side = 'left';
            } else {
                side = 'right';
            }
        } else {
            // 중심 좌측 -> 툴바 우측 출력 선호 ('left' side)
            // 우측 공간이 부족한지 확인
            if (spaceOnRight < requiredW) {
                // 공간 부족! 좌측으로 출력 시도
                side = 'right';
            } else {
                side = 'left';
            }
        }
        
        setToolbarSide(side);
    }, [setToolbarSide]);

    // 도킹 side와 orientation 자동 매칭:
    //  - 'bottom' → horizontal
    //  - 'left'/'right' (사이드바 패널 또는 screen-edge) → vertical
    useEffect(() => {
        if (!toolbarDockedTo) return;
        if (toolbarDockedTo.side === 'bottom' && orientation !== 'horizontal') {
            setOrientation('horizontal');
        } else if (toolbarDockedTo.side !== 'bottom' && orientation !== 'vertical') {
            setOrientation('vertical');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toolbarDockedTo?.side]);

    // orientation 변경 시: dock side와 충돌하는 경우에만 도킹 해제.
    // 자동 회전이 트리거한 호환 변경은 도킹 유지.
    const prevOrientationRef = useRef(orientation);
    useEffect(() => {
        if (prevOrientationRef.current === orientation) return;
        prevOrientationRef.current = orientation;

        const docked = toolbarDockedTo;
        const isConflict =
            docked != null && (
                (orientation === 'horizontal' && docked.side !== 'bottom') ||
                (orientation === 'vertical'   && docked.side === 'bottom')
            );

        if (isConflict) {
            setToolbarDockedTo(null);
            useToolbarStore.getState().setToolbarPosition(toolbarFloatingPosition);
            setToolbarDockedHeight(null);
            lastSyncedRef.current = { x: -1, y: -1, side: null, h: -1 };
        }

        // 팝오버는 orientation 변경 시 항상 닫고 user size 리셋
        useToolbarStore.getState().setActiveToolId(null);
        setToolbarUserHeight(null);
        setToolbarUserWidth(null);
    }, [orientation, toolbarDockedTo, setToolbarDockedTo, toolbarFloatingPosition, setToolbarDockedHeight, setToolbarUserHeight, setToolbarUserWidth]);

    // 툴바 실제 높이 측정 → 팝오버 위치 계산에 사용
    // ResizeObserver: 크기 변경 시에만 업데이트 (무한 루프 방지)
    useEffect(() => {
        const el = toolbarRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            const box = entries[0]?.borderBoxSize?.[0];
            const h = Math.round(box?.blockSize ?? el.offsetHeight);
            const w = Math.round(box?.inlineSize ?? el.offsetWidth);
            setToolbarRenderedHeight(h);
            setToolbarRenderedWidth(w);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [setToolbarRenderedHeight, setToolbarRenderedWidth]);

    // ── 툴바 리사이즈 핸들 ────────────────────────────────────
    const toolbarResizeRef = useRef<{
        type: 'height' | 'width';
        startPos: number;
        startSize: number;
        minSize: number;
    } | null>(null);

    // min 크기는 렌더 후반부에서 계산되므로 ref로 전달
    const minSizesRef = useRef({ height: 0, width: 0 });

    const handleToolbarResizeStart = useCallback((e: React.MouseEvent, type: 'height' | 'width') => {
        e.preventDefault();
        e.stopPropagation();
        const el = toolbarRef.current;
        if (!el) return;
        toolbarResizeRef.current = {
            type,
            startPos: type === 'height' ? e.clientY : e.clientX,
            startSize: type === 'height' ? el.offsetHeight : el.offsetWidth,
            minSize: type === 'height' ? minSizesRef.current.height : minSizesRef.current.width,
        };
    }, []);

    // ── 헤더 더블클릭: 기본 크기 복원 ───────────────────────
    const handleHeaderDoubleClick = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (isHorizontal) {
            setToolbarUserWidth(null);
        } else {
            setToolbarUserHeight(null);
        }
    }, [isHorizontal, setToolbarUserHeight, setToolbarUserWidth]);

    // 드래그 시작 (도킹 중에도 허용 — 도킹된 패널 그룹 함께 이동)
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.toolbar-btn') ||
            (e.target as HTMLElement).closest('.toolbar-undock-btn')) return;
        e.preventDefault();

        // 바인딩 이미지 모드: 마우스 위치만 기록, 드래그 delta로 이미지 이동
        if (useToolbarStore.getState().toolbarBoundImageId !== null) {
            prevMouseRef.current = { x: e.clientX, y: e.clientY };
            const pos = useToolbarStore.getState().toolbarPosition;
            dragOriginRef.current = { mx: e.clientX, my: e.clientY, tx: pos.x, ty: pos.y };
            emitBindingDragStart();
            return;
        }

        const pos = useToolbarStore.getState().toolbarPosition;
        dragOriginRef.current = {
            mx: e.clientX,
            my: e.clientY,
            tx: pos.x,
            ty: pos.y,
        };
        prevDragPosRef.current = { x: pos.x, y: pos.y };
    }, []);

    // mousemove / mouseup
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            // 툴바 자체 리사이즈
            if (toolbarResizeRef.current) {
                const { type, startPos, startSize, minSize } = toolbarResizeRef.current;
                if (type === 'height') {
                    const newH = Math.max(minSize, startSize + (e.clientY - startPos));
                    setToolbarUserHeight(newH);
                } else {
                    const newW = Math.max(minSize, startSize + (e.clientX - startPos));
                    setToolbarUserWidth(newW);
                }
                return;
            }

            if (!dragOriginRef.current) return;

            // ── 바인딩 이미지 드래그 모드: toolbar 위치 + 이미지 위치 동시 이동 ──
            if (useToolbarStore.getState().toolbarBoundImageId !== null && prevMouseRef.current) {
                const dx = e.clientX - prevMouseRef.current.x;
                const dy = e.clientY - prevMouseRef.current.y;
                prevMouseRef.current = { x: e.clientX, y: e.clientY };
                if (dx !== 0 || dy !== 0) {
                    const cur = useToolbarStore.getState().toolbarPosition;
                    useToolbarStore.getState().setToolbarPosition({ x: cur.x + dx, y: cur.y + dy });
                    emitBindingDrag(dx, dy);
                }
                return;
            }

            const { mx, my, tx, ty } = dragOriginRef.current;
            const el = toolbarRef.current;
            const h = el?.offsetHeight ?? 400;
            const w = el?.offsetWidth ?? (TOOLBAR_WIDTH_BASE);

            const newX = Math.max(MIN_MARGIN_X, Math.min(
                window.innerWidth - w - MIN_MARGIN_X,
                tx + e.clientX - mx
            ));
            const newY = Math.max(MIN_MARGIN_Y, Math.min(
                window.innerHeight - h - MIN_MARGIN_X, // 하단 여백은 8px로 유지
                ty + e.clientY - my
            ));

            const docked = toolbarDockedToRef.current;
            const isScreenDocked = docked?.panelId === 'screen-left' || docked?.panelId === 'screen-right';

            if (docked && !isScreenDocked) {
                const targetDockTarget = dockTargetsRef.current?.find(t => t.id === docked.panelId);
                const isTargetSidebarDocked = targetDockTarget?.dockSide != null;

                if (isTargetSidebarDocked) {
                    // 사이드바에 도킹된 패널: 툴바 독립 이동 차단 (패널과 한몸 유지)
                    prevDragPosRef.current = { x: newX, y: newY };
                    return;
                }

                // ── 부유 패널 도킹 중: 사이드바 패널 top/bottom 12px hit-test + 패널 그룹 이동 ──
                pendingPanelStackRef.current = null;
                setSnapIndicator(null);

                const STACK_EDGE_PX = 12;
                const cursorX = e.clientX;
                const cursorY = e.clientY;
                const sidebarTargets = dockTargetsRef.current?.filter(
                    t => t.isVisible && t.dockSide != null && t.id !== docked.panelId
                ) ?? [];

                for (const target of sidebarTargets) {
                    const inX = cursorX >= target.x && cursorX <= target.x + target.width;
                    const inY = cursorY >= target.y && cursorY <= target.y + target.height;
                    if (!inX || !inY) continue;

                    if (cursorY < target.y + STACK_EDGE_PX) {
                        pendingPanelStackRef.current = { targetPanelId: target.id, position: 'top' };
                        setSnapIndicator({
                            x: target.x, y: target.y - 2,
                            width: target.width, height: 4, isVisible: true,
                        });
                        break;
                    } else if (cursorY > target.y + target.height - STACK_EDGE_PX) {
                        pendingPanelStackRef.current = { targetPanelId: target.id, position: 'bottom' };
                        setSnapIndicator({
                            x: target.x, y: target.y + target.height - 2,
                            width: target.width, height: 4, isVisible: true,
                        });
                        break;
                    }
                }

                // 기존 그룹 이동
                if (prevDragPosRef.current) {
                    const instantDx = newX - prevDragPosRef.current.x;
                    const instantDy = newY - prevDragPosRef.current.y;
                    if (instantDx !== 0 || instantDy !== 0) {
                        onDockedPanelDragDeltaRef.current?.(instantDx, instantDy);
                    }
                }
            } else if (!docked) {
                // ── 미도킹: 스냅 감지 (orientation 무관, 4종 후보 모두 평가) ──
                pendingDockRef.current = null;
                setSnapIndicator(null);

                // floating 상태에서 side 추적 (스크린엣지 fallback용)
                recalcSide(newX);

                type Candidate = {
                    panelId: string;
                    side: 'left' | 'right' | 'bottom';
                    dist: number;
                    yOverlap: number;
                    xOverlap: number;
                    indicator: { x: number; y: number; width: number; height: number };
                };
                let best: Candidate | null = null;

                // dist primary, overlap 길이 secondary (같은 사이드바 스택 패널 tie-breaking)
                const EPS = 0.5;
                const isBetter = (c: Candidate, b: Candidate | null): boolean => {
                    if (!b) return true;
                    if (c.dist < b.dist - EPS) return true;
                    if (c.dist > b.dist + EPS) return false;
                    if ((c.side === 'left' || c.side === 'right') && (b.side === 'left' || b.side === 'right')) {
                        return c.yOverlap > b.yOverlap;
                    }
                    if (c.side === 'bottom' && b.side === 'bottom') {
                        return c.xOverlap > b.xOverlap;
                    }
                    return false;
                };

                const targets = dockTargetsRef.current;
                if (targets) {
                    const toolbarBottom = newY + h;
                    const toolbarRight = newX + w;
                    for (const target of targets) {
                        if (!target.isVisible) continue;

                        const tRight = target.x + target.width;
                        const tBottom = target.y + target.height;

                        // 좌/우: y-overlap 길이 계산
                        const yOverlapLen = Math.max(0, Math.min(toolbarBottom, tBottom) - Math.max(newY, target.y));
                        if (yOverlapLen > 0) {
                            const rightDist = Math.abs(newX - tRight);
                            if (rightDist < DOCK_THRESHOLD) {
                                const cand: Candidate = {
                                    panelId: target.id, side: 'right', dist: rightDist,
                                    yOverlap: yOverlapLen, xOverlap: 0,
                                    indicator: { x: tRight, y: target.y, width: 4, height: target.height },
                                };
                                if (isBetter(cand, best)) best = cand;
                            }
                            const leftDist = Math.abs(toolbarRight - target.x);
                            if (leftDist < DOCK_THRESHOLD) {
                                const cand: Candidate = {
                                    panelId: target.id, side: 'left', dist: leftDist,
                                    yOverlap: yOverlapLen, xOverlap: 0,
                                    indicator: { x: target.x, y: target.y, width: 4, height: target.height },
                                };
                                if (isBetter(cand, best)) best = cand;
                            }
                        }

                        // 하단: x-overlap 길이 계산
                        const xOverlapLen = Math.max(0, Math.min(toolbarRight, tRight) - Math.max(newX, target.x));
                        if (xOverlapLen > 0) {
                            const bottomDist = Math.abs(newY - tBottom);
                            if (bottomDist < DOCK_THRESHOLD) {
                                const cand: Candidate = {
                                    panelId: target.id, side: 'bottom', dist: bottomDist,
                                    yOverlap: 0, xOverlap: xOverlapLen,
                                    indicator: { x: target.x, y: tBottom, width: target.width, height: 4 },
                                };
                                if (isBetter(cand, best)) best = cand;
                            }
                        }
                    }
                }

                if (best) {
                    pendingDockRef.current = { panelId: best.panelId, side: best.side };
                    setSnapIndicator({ isVisible: true, ...best.indicator });
                } else {
                    // 스크린엣지 fallback (패널 후보 없을 때만)
                    const SCREEN_DOCK_THRESHOLD = 20;
                    if (newX < SCREEN_DOCK_THRESHOLD) {
                        pendingDockRef.current = { panelId: 'screen-left', side: 'right' };
                        setSnapIndicator({ isVisible: true, x: 0, y: APP_TOTAL_HEADER_HEIGHT, width: 4, height: window.innerHeight - APP_TOTAL_HEADER_HEIGHT - 16 });
                    } else if (newX + w > window.innerWidth - SCREEN_DOCK_THRESHOLD) {
                        pendingDockRef.current = { panelId: 'screen-right', side: 'left' };
                        setSnapIndicator({ isVisible: true, x: window.innerWidth - 4, y: APP_TOTAL_HEADER_HEIGHT, width: 4, height: window.innerHeight - APP_TOTAL_HEADER_HEIGHT - 16 });
                    }
                }
            }

            prevDragPosRef.current = { x: newX, y: newY };
            useToolbarStore.getState().setToolbarPosition({ x: newX, y: newY });
        };

        const onUp = () => {
            toolbarResizeRef.current = null;

            // ── 바인딩 이미지 드래그 종료 ──
            if (prevMouseRef.current !== null) {
                prevMouseRef.current = null;
                dragOriginRef.current = null;
                emitBindingDragEnd();
                setSnapIndicator(null);
                return;
            }

            prevDragPosRef.current = null;

            // 툴바+부유패널 그룹 → 사이드바 패널 stack commit
            const stackPending = pendingPanelStackRef.current;
            const dockedNow = toolbarDockedToRef.current;
            if (stackPending && dockedNow && dockedNow.panelId !== 'screen-left' && dockedNow.panelId !== 'screen-right') {
                pendingPanelStackRef.current = null;
                onCommitGroupStackRef.current?.(stackPending.targetPanelId, stackPending.position, dockedNow.panelId);
                setSnapIndicator(null);
                dragOriginRef.current = null;
                return;
            }

            // 도킹 중에는 스냅 커밋 생략 (단순 이동이었으므로)
            if (!toolbarDockedToRef.current) {
                const dock = pendingDockRef.current;
                if (dragOriginRef.current && dock) {
                    // ── orientation 자동 동기화 (도킹 사이드 우선) ──
                    // bottom 도킹 → horizontal, left/right 도킹 (패널 + 스크린엣지) → vertical
                    // setToolbarDockedTo 호출 전에 실행해야 auto-derive/conflict effect가 충돌하지 않음
                    const targetOrientation: 'horizontal' | 'vertical' =
                        dock.side === 'bottom' ? 'horizontal' : 'vertical';
                    if (useToolbarStore.getState().orientation !== targetOrientation) {
                        setOrientation(targetOrientation);
                    }

                    if (dock.side === 'bottom') {
                        const target = dockTargetsRef.current?.find(t => t.id === dock.panelId);
                        if (target) {
                            const currentPos = useToolbarStore.getState().toolbarPosition;
                            setToolbarFloatingPosition(currentPos);
                            setToolbarDockedTo({ panelId: dock.panelId as any, side: 'bottom' });
                            useToolbarStore.getState().setToolbarPosition({ x: target.x, y: target.y + target.height });
                        }
                    } else if (dock.panelId === 'screen-left' || dock.panelId === 'screen-right') {
                        // 스크린 가장자리 도킹
                        const currentPos = useToolbarStore.getState().toolbarPosition;
                        setToolbarFloatingPosition(currentPos);
                        setToolbarDockedTo({ panelId: dock.panelId as any, side: dock.side });
                        const tw = toolbarRef.current?.offsetWidth ?? (TOOLBAR_WIDTH_BASE);
                        const newX = dock.panelId === 'screen-left' ? 0 : window.innerWidth - tw;
                        useToolbarStore.getState().setToolbarPosition({ x: newX, y: APP_TOTAL_HEADER_HEIGHT });
                        setToolbarSide(dock.panelId === 'screen-left' ? 'left' : 'right');
                    } else {
                        const target = dockTargetsRef.current?.find(t => t.id === dock.panelId);
                        if (target) {
                            const currentPos = useToolbarStore.getState().toolbarPosition;
                            setToolbarFloatingPosition(currentPos);
                            setToolbarDockedTo({ panelId: dock.panelId as any, side: dock.side });
                            const tw = toolbarRef.current?.offsetWidth ?? (TOOLBAR_WIDTH_BASE);
                            const newX = dock.side === 'right'
                                ? target.x + target.width
                                : target.x - tw;
                            useToolbarStore.getState().setToolbarPosition({ x: newX, y: target.y });
                            setToolbarSide(dock.side === 'right' ? 'left' : 'right');
                        }
                    }
                    pendingDockRef.current = null;
                }
            }
            setSnapIndicator(null);
            dragOriginRef.current = null;
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [recalcSide, setSnapIndicator, setToolbarDockedTo, setToolbarFloatingPosition, setToolbarSide, setToolbarUserHeight, setToolbarUserWidth]);

    // 도킹 상태: 패널 이동·리사이즈·사이드바 전환 시 툴바 위치/side/높이 동기화
    useEffect(() => {
        if (!toolbarDockedTo || !dockTargets) return;

        // 스크린 도킹: 패널에 의존하지 않으므로 고정 위치
        if (toolbarDockedTo.panelId === 'screen-left' || toolbarDockedTo.panelId === 'screen-right') {
            const tw = toolbarRef.current?.offsetWidth ?? (TOOLBAR_WIDTH_BASE);
            const newX = toolbarDockedTo.panelId === 'screen-left' ? 0 : window.innerWidth - tw;
            const prev = lastSyncedRef.current;
            if (prev.x !== newX || prev.y !== APP_TOTAL_HEADER_HEIGHT) {
                lastSyncedRef.current = { x: newX, y: APP_TOTAL_HEADER_HEIGHT, side: toolbarDockedTo.side, h: window.innerHeight - APP_TOTAL_HEADER_HEIGHT - 16 };
                useToolbarStore.getState().setToolbarPosition({ x: newX, y: APP_TOTAL_HEADER_HEIGHT });
                setToolbarSide(toolbarDockedTo.panelId === 'screen-left' ? 'left' : 'right');
            }
            return;
        }

        // 첫 동기화(x===-1)는 패널이 숨겨진 상태여도 저장된 위치로 초기 배치
        const target = dockTargets.find(t => t.id === toolbarDockedTo.panelId);
        const isInitialSync = lastSyncedRef.current.x === -1;
        if (!target || (!target.isVisible && !isInitialSync)) {
            // 패널이 숨겨진 경우 높이 초기화
            if (lastSyncedRef.current.h !== -1) {
                lastSyncedRef.current.h = -1;
                setToolbarDockedHeight(null);
            }
            return;
        }

        // ── 가로 모드 bottom 도킹 동기화 ──
        if (toolbarDockedTo.side === 'bottom') {
            const newX = target.x;
            const newY = target.y + target.height;
            const prev = lastSyncedRef.current;
            if (prev.x === newX && prev.y === newY && prev.side === 'bottom') return;
            const th = toolbarRef.current?.offsetHeight ?? (TOOLBAR_HEIGHT_BASE);
            lastSyncedRef.current = { x: newX, y: newY, side: 'bottom', h: th };
            if (prev.x !== newX || prev.y !== newY) useToolbarStore.getState().setToolbarPosition({ x: newX, y: newY });
            return;
        }

        // 사이드바 전환 감지: target.dockSide 기반으로 올바른 side 자동 계산
        // 좌측 사이드바 → 툴바는 패널 우측, 우측 사이드바 → 툴바는 패널 좌측
        let correctSide = toolbarDockedTo.side;
        if (target.dockSide != null && (correctSide === 'left' || correctSide === 'right')) {
            correctSide = target.dockSide === 'right' ? 'left' : 'right';
        }

        const tw = toolbarRef.current?.offsetWidth ?? (TOOLBAR_WIDTH_BASE);
        const newX = correctSide === 'right'
            ? target.x + target.width
            : target.x - tw;
        const newY = target.y;
        const newH = target.height;

        const prev = lastSyncedRef.current;
        if (prev.x === newX && prev.y === newY && prev.side === correctSide && prev.h === newH) return;

        lastSyncedRef.current = { x: newX, y: newY, side: correctSide, h: newH };

        if (prev.x !== newX || prev.y !== newY) useToolbarStore.getState().setToolbarPosition({ x: newX, y: newY });
        setToolbarSide(correctSide === 'right' ? 'left' : 'right');
        if (prev.side !== correctSide) {
            setToolbarDockedTo({ panelId: toolbarDockedTo.panelId, side: correctSide });
        }
        setToolbarDockedHeight(newH);
    }, [toolbarDockedTo, dockTargets, setToolbarSide, setToolbarDockedTo, setToolbarDockedHeight]);

    const prevActiveToolRef = useRef(activeToolId);

    // 활성 도구가 변경되거나 (다른 크기의 팝오버) 툴바 위치가 변경될 때마다 방향 재계산 (도킹 안 된 상태일 때)
    useEffect(() => {
        if (!toolbarDockedTo) {
            // 바인딩 모드: useToolbarPositionSync가 toolbarSide를 관리 → recalcSide 스킵
            if (toolbarBoundImageId !== null) return;

            const isNewlyOpened = prevActiveToolRef.current === null && activeToolId !== null;
            prevActiveToolRef.current = activeToolId;

            // [FIX] 팝오버가 완전히 닫혀있다가 새로 열릴 때만 강제로 방향 계산
            // 단순 위치 이동이나 팝오버 열린 상태에서 다른 탭으로 변경할 때는 force=false로 하여 방향 유지
            recalcSide(useToolbarStore.getState().toolbarPosition.x, null, null, isNewlyOpened);
        }
    }, [activeToolId, toolbarDockedTo, toolbarBoundImageId, recalcSide]);

    // 우클릭 컨텍스트 메뉴
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    }, []);

    // 언도킹
    const handleUndock = useCallback(() => {
        setToolbarDockedTo(null);
        useToolbarStore.getState().setToolbarPosition(toolbarFloatingPosition);
        recalcSide(toolbarFloatingPosition.x);
        setToolbarDockedHeight(null);
        lastSyncedRef.current = { x: -1, y: -1, side: null, h: -1 };
    }, [setToolbarDockedTo, toolbarFloatingPosition, recalcSide, setToolbarDockedHeight]);

    // 선택바 바인딩 해제 — 설정 스위치 OFF와 동일 효과 (재바인딩 방지)
    const handleUnbind = useCallback(() => {
        useSettingsStore.getState().setAutoBindToolbarToOriginal(false);
        // syncBinding 타이밍에 의존하지 않고 즉시 명시적 언바인드
        const ts = useToolbarStore.getState();
        if (ts.toolbarBoundImageId !== null) {
            ts.setToolbarBoundImageId(null);
            ts.setToolbarPosition(ts.toolbarFloatingPosition);
        }
    }, []);

    // 바인딩된 이미지 위치로 캔버스 이동
    const handleNavigateToImage = useCallback(() => {
        if (!toolbarBoundImageId) return;
        const image = useCanvasStore.getState().boardImages.find(img => img.id === toolbarBoundImageId);
        if (!image) return;
        const canvasRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
        useCanvasStore.getState().zoomToImage(image, canvasRect);
    }, [toolbarBoundImageId]);

    // 키보드: 1~9 단축키 + Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

            if (e.key === 'Escape') {
                if (useToolbarStore.getState().activeToolId !== null) {
                    useToolbarStore.getState().setActiveToolId(null);
                    // 팝오버가 열려있을 때만 이벤트 전파 차단 — 역할 해제 등 다른 ESC 핸들러 실행 방지
                    e.stopImmediatePropagation();
                }
                return;
            }
            const idx = parseInt(e.key, 10);
            if (idx >= 1 && idx <= TOOLBAR_ITEMS.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const item = TOOLBAR_ITEMS[idx - 1];
                if (item) toggleTool(item.key);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleTool]);

    // 외부 onToolActivate 콜백
    useEffect(() => {
        onToolActivate?.(activeToolId);
    }, [activeToolId, onToolActivate]);

    const getLabel = (item: typeof TOOLBAR_ITEMS[0]) =>
        language === 'ko' ? item.labelKo : item.labelEn;

    const generationItems = TOOLBAR_ITEMS.filter(i => i.group === 'generation');
    const editorItems = TOOLBAR_ITEMS.filter(i => i.group === 'editor');

    // 샌드위치 여부: 툴바가 도킹되어 있고, 팝오버가 열려 있고, 팝오버가 분리되지 않은 상태
    const isSandwiched = toolbarDockedTo && activeToolId && !isPopoverDetached;

    // 도킹 상태 CSS 클래스
    const dockedClass = toolbarDockedTo
        ? `toolbar-docked toolbar-docked-${toolbarDockedTo.side}${isSandwiched ? ' toolbar-sandwiched' : ''}`
        : '';

    // 도킹 시 패널 높이에 맞춤
    const dockedTarget = toolbarDockedTo
        ? dockTargets?.find(t => t.id === toolbarDockedTo.panelId)
        : null;
    const dockedHeight = dockedTarget?.height;
    // 가로 모드 bottom 도킹 시 패널 너비에 맞춤
    const dockedWidth = isHorizontal && toolbarDockedTo?.side === 'bottom' ? dockedTarget?.width : undefined;

    // ── 최소 크기 (스크롤 모드: 1버튼 + 화살표 2개 + 헤더) ──────────────────────
    const HEADER_W_PX = 48;     // w-12
    const HEADER_H_PX = 48;     // h-12
    const BUTTON_W_PX = 44;
    const BUTTON_H_PX = 44;
    const ARROW_SIZE = 18;      // CSS .arrow-v/h 18px과 동기화
    const TOOLBAR_BTM_PAD = 6;
    const RESIZE_HANDLE_PX = 6;

    const minToolbarHeight = HEADER_H_PX + ARROW_SIZE * 2 + BUTTON_H_PX + TOOLBAR_BTM_PAD;
    const minToolbarWidth = HEADER_W_PX + ARROW_SIZE * 2 + BUTTON_W_PX + RESIZE_HANDLE_PX;

    // 매 렌더마다 ref 갱신 (useCallback이 ref를 통해 최신 값 접근)
    minSizesRef.current = { height: minToolbarHeight, width: minToolbarWidth };

    const effectiveUserHeight = toolbarUserHeight != null
        ? Math.max(toolbarUserHeight, minToolbarHeight)
        : toolbarUserHeight;
    const effectiveUserWidth = toolbarUserWidth != null
        ? Math.max(toolbarUserWidth, minToolbarWidth)
        : toolbarUserWidth;

    const tooltipSide = 'top' as const;

    return (
        <>
        <div
            ref={toolbarRef}
            className={`floating-toolbar ${isHorizontal ? 'horizontal' : 'vertical'} ${dockedClass}`}
            style={{
                left: 0,
                top: 0,
                willChange: 'transform',
                ...(!isHorizontal ? {
                    // 세로 모드: 도킹 패널 높이 우선 → 사용자 조절 높이 fallback
                    height: dockedHeight ?? effectiveUserHeight ?? undefined,
                } : {
                    // 가로 모드: 도킹 패널 너비 우선 → 사용자 조절 너비 fallback
                    width: dockedWidth ?? effectiveUserWidth ?? undefined,
                }),
            }}
            onMouseDown={handleDragStart}
            onContextMenu={handleContextMenu}
            role="toolbar"
            aria-label={t('toolbar.title', language)}
            aria-orientation={isHorizontal ? 'horizontal' : 'vertical'}
        >
            {/* 툴바 헤더 */}
            <div
                className={`${isHorizontal ? 'w-12' : 'h-12 w-full'} flex items-center justify-center flex-shrink-0 ${isHorizontal ? 'border-r' : 'border-b'} border-white/5 bg-white/5 select-none ${
                    isSandwiched ? '' :
                    !toolbarDockedTo ? (isHorizontal ? 'rounded-l-2xl' : 'rounded-t-2xl') :
                    toolbarDockedTo.side === 'left' ? 'rounded-tl-2xl' :
                    toolbarDockedTo.side === 'bottom' ? 'rounded-tl-2xl' : 'rounded-tr-2xl'
                }`}
                onMouseDown={handleDragStart}
                onDoubleClick={handleHeaderDoubleClick}
                style={{ cursor: toolbarBoundImageId && !toolbarDockedTo ? 'grab' : 'move' }}
            >
                {/* 헤더 컨트롤: 도킹 > 바인딩 > 드래그 핸들 순 우선순위 */}
                {toolbarDockedTo ? (
                    <button
                        className="p-2 text-amber-400/80 hover:text-amber-300 transition-colors rounded-full hover:bg-white/10"
                        onClick={handleUndock}
                        title={t('toolbar.undock', language)}
                        aria-label={t('toolbar.undock', language)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                    </button>
                ) : toolbarBoundImageId ? (
                    <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center gap-0.5`}>
                        {/* 이미지 위치로 이동 */}
                        <button
                            className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
                            onClick={(e) => { e.stopPropagation(); handleNavigateToImage(); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={t('toolbar.goToImage', language)}
                            aria-label={t('toolbar.goToImage', language)}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="11" y1="8" x2="11" y2="14"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                            </svg>
                        </button>
                        {/* 바인딩 해제 (활성 스타일) */}
                        <button
                            className="p-1.5 text-blue-400 hover:text-blue-300 transition-colors rounded-full hover:bg-white/10"
                            onClick={(e) => { e.stopPropagation(); handleUnbind(); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={t('toolbar.unbindImage', language)}
                            aria-label={t('toolbar.unbindImage', language)}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div className="toolbar-drag-handle" aria-hidden="true" style={{ margin: 0 }}>
                        <span /><span /><span />
                    </div>
                )}
            </div>

            <ToolbarScrollContainer orientation={isHorizontal ? 'horizontal' : 'vertical'}>
                <div className={`flex ${isHorizontal ? 'flex-row items-center h-full flex-nowrap' : 'flex-col items-center w-full flex-nowrap'} gap-2 px-1 py-1`}>
                    {/* Generation 도구 */}
                    {generationItems.map((item) => {
                        const isActive = activeToolId === item.key;
                        const isDisabled = item.enabledCondition ? !item.enabledCondition({ modelName, hasOriginalImage }) : false;
                        const disabledReason = isDisabled
                            ? (language === 'ko' ? '현재 모델에서 지원하지 않는 기능입니다' : 'Not supported by the current model')
                            : undefined;

                        return (
                            <ToolbarTooltip
                                key={item.key}
                                label={getLabel(item)}
                                shortcut={item.shortcut}
                                side={tooltipSide}
                                disabledReason={disabledReason}
                            >
                                <button
                                    className="toolbar-btn"
                                    aria-label={getLabel(item)}
                                    aria-pressed={isActive}
                                    disabled={isDisabled}
                                    onClick={() => !isDisabled && toggleTool(item.key)}
                                >
                                    {item.icon ? (
                                        <item.icon className="w-5 h-5" />
                                    ) : (
                                        <span className="toolbar-text-icon">{item.textIcon}</span>
                                    )}
                                </button>
                            </ToolbarTooltip>
                        );
                    })}

                    {/* Editor 도구 */}
                    {editorItems.map((item) => {
                        const isActive = activeToolId === item.key;
                        const isDisabled = item.enabledCondition ? !item.enabledCondition({ modelName, hasOriginalImage }) : false;
                        const disabledReason = isDisabled
                            ? (!hasOriginalImage
                                ? (language === 'ko' ? '원본 이미지가 필요합니다' : 'Original image required')
                                : (language === 'ko' ? '현재 모델에서 지원하지 않는 기능입니다' : 'Not supported by the current model'))
                            : undefined;

                        return (
                            <ToolbarTooltip
                                key={item.key}
                                label={getLabel(item)}
                                shortcut={item.shortcut}
                                side={tooltipSide}
                                disabledReason={disabledReason}
                            >
                                <button
                                    className="toolbar-btn"
                                    aria-label={getLabel(item)}
                                    aria-pressed={isActive}
                                    disabled={isDisabled}
                                    onClick={() => !isDisabled && toggleTool(item.key)}
                                >
                                    {item.icon ? (
                                        <item.icon className="w-5 h-5" />
                                    ) : (
                                        <span className="toolbar-text-icon">{item.textIcon}</span>
                                    )}
                                </button>
                            </ToolbarTooltip>
                        );
                    })}
                </div>
            </ToolbarScrollContainer>

            {/* 세로 모드 하단 리사이즈 핸들 */}
            {!isHorizontal && (
                <div
                    className="toolbar-resize-handle-bottom"
                    onMouseDown={(e) => handleToolbarResizeStart(e, 'height')}
                />
            )}

            {/* 가로 모드 우측 리사이즈 핸들 */}
            {isHorizontal && (
                <div
                    className="toolbar-resize-handle-right"
                    onMouseDown={(e) => handleToolbarResizeStart(e, 'width')}
                />
            )}
        </div>

        {contextMenu && (
            <ToolbarContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
            />
        )}
        </>
    );
};

export const FloatingToolbar = React.memo(FloatingToolbarInner);
