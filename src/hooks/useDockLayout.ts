import React, { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import type { PanelRegistry } from './usePanelRegistry';
import type { SidebarStateMap, SidebarStackTransitionArgs } from './useDockingSystem';
import { useToolbarStore } from '../features/toolbar/useToolbarStore';

// ── Constants ─────────────────────────────────────────────────────────────────
export const APP_HEADER_HEIGHT = 36;
export const WORKSPACE_TAB_BAR_HEIGHT = 36;
export const APP_TOTAL_HEADER_HEIGHT = APP_HEADER_HEIGHT + WORKSPACE_TAB_BAR_HEIGHT; // 72
export const DOCK_MARGIN = 16;
export const MIN_STACK_HEIGHT = 120;
export const SIDEBAR_MIN_WIDTH = 192;

// ── Types ─────────────────────────────────────────────────────────────────────
/** 사이드바 한쪽 = primary column + optional secondary column.
 *  primary는 사이드바 외곽(스크린 가장자리) 쪽, secondary는 캔버스 쪽으로 안쪽 확장. */
export type ColumnInfo = {
    width: number;
    panels: string[];          // 위→아래 순서
    splitRatios: number[];     // panels.length - 1 개
};

export type SidebarState = {
    width: number;             // = primary column width (backward-compat)
    panels: string[];          // = primary column panels (backward-compat)
    splitRatios: number[];     // = primary column splitRatios (backward-compat)
    /** [MULTI-COLUMN] 선택적 두 번째 컬럼 — 캔버스 쪽으로 확장.
     *  존재 시 사이드바 전체 너비 = width + secondaryColumn.width. */
    secondaryColumn?: ColumnInfo;
};

interface UseDockLayoutParams {
    panelRegistry: PanelRegistry;
    /** 언독 시 패널별 기본 float 위치 */
    getDefaultFloatPos: (panelId: string) => { x: number; y: number; width?: number; height?: number };
    /** 경계 리사이즈용 — 레거시 ref (handleBoundaryResize에서만 사용) */
    leftPanelStateRef: React.MutableRefObject<any>;
    showLeftPanel: boolean;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
const equalSplitRatios = (n: number): number[] =>
    n <= 1 ? [] : Array.from({ length: n - 1 }, (_, i) => (i + 1) / n);

const restoreOrEqualSplitRatios = (
    newPanels: string[],
    savedRef: React.MutableRefObject<{ panels: string[]; ratios: number[] } | null>
): number[] => {
    const saved = savedRef.current;
    if (
        saved &&
        saved.panels.length === newPanels.length &&
        saved.ratios.length === newPanels.length - 1 &&
        saved.panels.every(p => newPanels.includes(p)) &&
        newPanels.every(p => saved.panels.includes(p))
    ) {
        return saved.ratios;
    }
    return equalSplitRatios(newPanels.length);
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDockLayout({
    panelRegistry,
    getDefaultFloatPos,
    leftPanelStateRef,
    showLeftPanel,
}: UseDockLayoutParams) {
    // 뷰포트 비율 기반 사이드바 기본 너비 (Windows DPI 동기화 후 올바른 CSS px 사용)
    // 최솟값을 192로 맞춰 플로팅 패널 리사이즈 최솟값(effectiveMinWidth=192)과 동일하게 유지
    const getInitialSidebarWidth = () =>
        Math.max(192, Math.min(360, Math.round(window.innerWidth * 0.14)));

    const defaultSidebarState = (): SidebarState => ({
        width: getInitialSidebarWidth(),
        panels: [],
        splitRatios: [],
    });

    const [leftSidebar, setLeftSidebar] = useState<SidebarState>(() => {
        try {
            const saved = localStorage.getItem('sidebar-left-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.panels)) {
                    return { ...defaultSidebarState(), ...parsed };
                }
            }
        } catch {}
        return defaultSidebarState();
    });

    const [rightSidebar, setRightSidebar] = useState<SidebarState>(() => {
        try {
            const saved = localStorage.getItem('sidebar-right-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.panels)) {
                    return { ...defaultSidebarState(), ...parsed };
                }
            }
        } catch {}
        return defaultSidebarState();
    });

    useEffect(() => {
        try {
            localStorage.setItem('sidebar-left-state', JSON.stringify({
                panels: leftSidebar.panels,
                splitRatios: leftSidebar.splitRatios,
                width: leftSidebar.width,
            }));
        } catch {}
    }, [leftSidebar]);

    useEffect(() => {
        try {
            localStorage.setItem('sidebar-right-state', JSON.stringify({
                panels: rightSidebar.panels,
                splitRatios: rightSidebar.splitRatios,
                width: rightSidebar.width,
            }));
        } catch {}
    }, [rightSidebar]);

    const savedLeftSplitRef = useRef<{ panels: string[]; ratios: number[] } | null>(null);
    const savedRightSplitRef = useRef<{ panels: string[]; ratios: number[] } | null>(null);

    // [STACK TRANSITION] Live snapshot of both sidebar states, consumed by useDockingSystem
    // to capture splitRatios/width/secondaryColumn when an A2 sidebar switch involves a multi-panel stack.
    const sidebarStateRef = useRef<SidebarStateMap | null>(null);
    useEffect(() => {
        sidebarStateRef.current = { left: leftSidebar, right: rightSidebar };
    }, [leftSidebar, rightSidebar]);

    // 윈도우 리사이즈 감지 — useLayoutEffect가 splitRatio 기반으로 재계산하도록
    const [windowSize, setWindowSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
    useEffect(() => {
        const handler = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    // ── applySidebarPanelState ────────────────────────────────────────────────
    const applySidebarPanelState = useCallback((
        panelId: string,
        state: { x: number; y: number; width: number; height: number; isCollapsed: boolean; dockSide: 'left' | 'right' | null }
    ) => {
        panelRegistry.get(panelId)?.setState({ ...state, isCollapsed: false });
    }, [panelRegistry]);

    // ── Boundary resize (Fix 2: used with useLayoutEffect below) ─────────────
    // NOTE: Uses setSidebar functional update to read current sidebar state,
    // avoiding stale-closure issues with panel state refs.
    const handleLeftBoundaryResize = useCallback((newBottomY: number) => {
        const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
        const topHeight = newBottomY - APP_HEADER_HEIGHT;
        const newSplitRatio = topHeight / availableHeight;
        if (topHeight >= MIN_STACK_HEIGHT && (availableHeight - topHeight) >= MIN_STACK_HEIGHT) {
            setLeftSidebar(prev => {
                if (prev.panels.length < 2) return prev;
                const newRatios = [...prev.splitRatios];
                newRatios[0] = newSplitRatio;
                return { ...prev, splitRatios: newRatios };
            });
        }
    }, []);

    const handleRightBoundaryResize = useCallback((newBottomY: number) => {
        const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
        const topHeight = newBottomY - APP_HEADER_HEIGHT;
        const newSplitRatio = topHeight / availableHeight;
        if (topHeight >= MIN_STACK_HEIGHT && (availableHeight - topHeight) >= MIN_STACK_HEIGHT) {
            setRightSidebar(prev => {
                if (prev.panels.length < 2) return prev;
                const newRatios = [...prev.splitRatios];
                newRatios[0] = newSplitRatio;
                return { ...prev, splitRatios: newRatios };
            });
        }
    }, []);

    // ── Width sync ────────────────────────────────────────────────────────────
    const handleLeftWidthChange = useCallback((newWidth: number) => {
        setLeftSidebar(prev => ({ ...prev, width: newWidth }));
    }, []);

    const handleRightWidthChange = useCallback((newWidth: number) => {
        if (rightSidebar.panels.length > 0) {
            setRightSidebar(prev => ({ ...prev, width: newWidth }));
        } else {
            const leftState = leftPanelStateRef.current;
            if (leftState && leftState.dockSide === 'right') {
                panelRegistry.get('left-panel')?.setState({ width: newWidth, x: window.innerWidth - newWidth });
            }
        }
    }, [rightSidebar.panels.length, leftPanelStateRef, panelRegistry]);

    // ── Stack with / Stack leave ──────────────────────────────────────────────
    const handleStackWith = useCallback((
        targetPanelId: string,
        position: 'top' | 'bottom' | null,
        newHeight: number,
        newY: number,
        draggingPanelId: string,
    ) => {
        const targetState = panelRegistry.get(targetPanelId)?.getState();
        if (!targetState || !targetState.dockSide) return;

        const dockSide = targetState.dockSide as 'left' | 'right';
        const sidebarWidth = targetState.width;
        const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
        const halfHeight = Math.max(MIN_STACK_HEIGHT, availableHeight / 2);

        const orderedPanels = position === 'top'
            ? [draggingPanelId, targetPanelId]
            : [targetPanelId, draggingPanelId];

        if (dockSide === 'left') {
            setLeftSidebar(prev => ({ ...prev, width: sidebarWidth, panels: orderedPanels, splitRatios: [0.5] }));
        } else {
            setRightSidebar(prev => ({ ...prev, width: sidebarWidth, panels: orderedPanels, splitRatios: [0.5] }));
        }

        panelRegistry.get(targetPanelId)?.setState({ y: newY, height: halfHeight, width: sidebarWidth, dockSide });
    }, [panelRegistry]);

    // ── [MULTI-COLUMN] handleNewColumnWith ─────────────────────────────────────
    // 드래그 패널을 타겟 패널의 캔버스-side 외곽으로 드롭 → 새 secondary column 생성.
    // 사이드바당 최대 2개 컬럼만 지원하므로 secondaryColumn이 이미 있으면 무시.
    const handleNewColumnWith = useCallback((
        targetPanelId: string,
        draggingPanelId: string,
    ) => {
        const targetState = panelRegistry.get(targetPanelId)?.getState();
        if (!targetState?.dockSide) return;
        const side = targetState.dockSide as 'left' | 'right';
        const draggingState = panelRegistry.get(draggingPanelId)?.getState();
        const newColWidth = draggingState?.width ?? targetState.width;

        const newColumn: ColumnInfo = {
            width: Math.max(SIDEBAR_MIN_WIDTH, newColWidth),
            panels: [draggingPanelId],
            splitRatios: [],
        };

        if (side === 'left') {
            setLeftSidebar(prev => prev.secondaryColumn ? prev : { ...prev, secondaryColumn: newColumn });
        } else {
            setRightSidebar(prev => prev.secondaryColumn ? prev : { ...prev, secondaryColumn: newColumn });
        }
    }, [panelRegistry]);

    // [MULTI-COLUMN] 컬럼/사이드바에서 panelId 제거. 빈 secondary column은 자동 정리.
    const removeFromSidebarColumns = (prev: SidebarState, leavingId: string): SidebarState => {
        let changed = false;
        let next: SidebarState = prev;
        if (prev.panels.includes(leavingId)) {
            const newPanels = prev.panels.filter(p => p !== leavingId);
            next = { ...next, panels: newPanels, splitRatios: equalSplitRatios(newPanels.length) };
            changed = true;
        }
        if (prev.secondaryColumn?.panels.includes(leavingId)) {
            const newSecPanels = prev.secondaryColumn.panels.filter(p => p !== leavingId);
            if (newSecPanels.length === 0) {
                next = { ...next, secondaryColumn: undefined };
            } else {
                next = {
                    ...next,
                    secondaryColumn: {
                        ...prev.secondaryColumn,
                        panels: newSecPanels,
                        splitRatios: equalSplitRatios(newSecPanels.length),
                    },
                };
            }
            changed = true;
        }
        return changed ? next : prev;
    };

    const handleStackLeave = useCallback((leavingPanelId: string) => {
        // Remove leaving panel from sidebar.
        setLeftSidebar(prev => removeFromSidebarColumns(prev, leavingPanelId));
        setRightSidebar(prev => removeFromSidebarColumns(prev, leavingPanelId));
    }, []);

    // ── [STACK TRANSITION] Whole-stack sidebar switch ──────────────────────────
    // Photoshop-style: when user drags one panel of a multi-panel stack across the screen midline
    // to the opposite (empty) sidebar, the entire stack (panels + splitRatios + width + secondaryColumn)
    // migrates together. Triggered by useDockingSystem via the onSidebarStackTransition callback.
    const handleSidebarStackTransition = useCallback((args: SidebarStackTransitionArgs) => {
        const { fromSide, toSide, panelIds, splitRatios, width, secondaryColumn } = args;
        if (fromSide === toSide) return;
        if (panelIds.length === 0) return;

        // Build destination sidebar state (preserves order, ratios, width, secondaryColumn).
        const nextDest: SidebarState = {
            width,
            panels: panelIds,
            splitRatios,
            secondaryColumn: secondaryColumn ? { ...secondaryColumn } : undefined,
        };

        // Atomically: clear source, populate destination.
        if (toSide === 'left') {
            setLeftSidebar(nextDest);
            setRightSidebar(prev => ({ ...prev, panels: [], splitRatios: [], secondaryColumn: undefined }));
        } else {
            setRightSidebar(nextDest);
            setLeftSidebar(prev => ({ ...prev, panels: [], splitRatios: [], secondaryColumn: undefined }));
        }

        // Force each panel's dockSide so the usePanelSystem effect short-circuits as a no-op
        // (panel is already in destination sidebar.panels by the time movePanelToSidebar fires).
        const allPanels = [
            ...panelIds,
            ...(secondaryColumn?.panels ?? []),
        ];
        allPanels.forEach(id => {
            panelRegistry.get(id)?.setState({ dockSide: toSide });
        });

        // Preserve splitRatios in the destination's saved ref so future collapse/expand restores correctly.
        if (toSide === 'left') {
            savedLeftSplitRef.current = { panels: [...panelIds], ratios: [...splitRatios] };
        } else {
            savedRightSplitRef.current = { panels: [...panelIds], ratios: [...splitRatios] };
        }

        // [Feature 2 link] If the toolbar is docked to one of the migrating panels, update its side
        // so it follows the stack to the new sidebar edge instead of pointing at the old one.
        const tbDock = useToolbarStore.getState().toolbarDockedTo;
        if (
            tbDock &&
            tbDock.side !== 'bottom' &&
            allPanels.includes(tbDock.panelId)
        ) {
            // For a sidebar-edge panel, the toolbar sits on the canvas-facing side:
            //   panel docked left  → toolbar on 'right' edge of that panel (facing canvas)
            //   panel docked right → toolbar on 'left'  edge of that panel (facing canvas)
            const newToolbarSide = toSide === 'left' ? 'right' : 'left';
            useToolbarStore.getState().setToolbarDockedTo({
                panelId: tbDock.panelId,
                side: newToolbarSide,
            });
        }
    }, [panelRegistry]);

    // ── Panel sidebar membership ──────────────────────────────────────────────
    const addPanelToSidebar = useCallback((panelId: string, side: 'left' | 'right') => {
        if (side === 'left') {
            setLeftSidebar(prev => {
                if (prev.panels.includes(panelId)) return prev;
                const newPanels = [...prev.panels, panelId];
                // 사이드바가 비어있을 때 최초 도킹 — 패널 현재 너비를 그대로 계승
                const newWidth = prev.panels.length === 0
                    ? (panelRegistry.get(panelId)?.getState()?.width ?? prev.width)
                    : prev.width;
                return { ...prev, width: newWidth, panels: newPanels, splitRatios: restoreOrEqualSplitRatios(newPanels, savedLeftSplitRef) };
            });
        } else {
            setRightSidebar(prev => {
                if (prev.panels.includes(panelId)) return prev;
                const newPanels = [...prev.panels, panelId];
                const newWidth = prev.panels.length === 0
                    ? (panelRegistry.get(panelId)?.getState()?.width ?? prev.width)
                    : prev.width;
                return { ...prev, width: newWidth, panels: newPanels, splitRatios: restoreOrEqualSplitRatios(newPanels, savedRightSplitRef) };
            });
        }
    }, [panelRegistry]);

    const removePanelFromSidebar = useCallback((panelId: string) => {
        setLeftSidebar(prev => {
            const inPrimary = prev.panels.includes(panelId);
            const inSecondary = prev.secondaryColumn?.panels.includes(panelId);
            if (!inPrimary && !inSecondary) return prev;
            if (inPrimary) savedLeftSplitRef.current = { panels: prev.panels, ratios: prev.splitRatios };
            return removeFromSidebarColumns(prev, panelId);
        });
        setRightSidebar(prev => {
            const inPrimary = prev.panels.includes(panelId);
            const inSecondary = prev.secondaryColumn?.panels.includes(panelId);
            if (!inPrimary && !inSecondary) return prev;
            if (inPrimary) savedRightSplitRef.current = { panels: prev.panels, ratios: prev.splitRatios };
            return removeFromSidebarColumns(prev, panelId);
        });
    }, []);

    const movePanelToSidebar = useCallback((panelId: string, newSide: 'left' | 'right') => {
        const oldSide: 'left' | 'right' = newSide === 'left' ? 'right' : 'left';
        // 상태 변경 전에 패널의 현재 너비를 캡처 (전환 후 계승)
        const currentPanelWidth = panelRegistry.get(panelId)?.getState()?.width;

        // 기존 사이드바에서 제거 (primary 또는 secondary, 비율 savedRef에 보존)
        if (oldSide === 'left') {
            setLeftSidebar(prev => {
                if (prev.panels.includes(panelId)) {
                    savedLeftSplitRef.current = { panels: prev.panels, ratios: prev.splitRatios };
                }
                return removeFromSidebarColumns(prev, panelId);
            });
        } else {
            setRightSidebar(prev => {
                if (prev.panels.includes(panelId)) {
                    savedRightSplitRef.current = { panels: prev.panels, ratios: prev.splitRatios };
                }
                return removeFromSidebarColumns(prev, panelId);
            });
        }

        // 새 사이드바에 추가 — 대상 사이드바가 비어있으면 패널 너비를 그대로 계승
        if (newSide === 'left') {
            setLeftSidebar(prev => {
                if (prev.panels.includes(panelId)) return prev;
                const newPanels = [...prev.panels, panelId];
                const newWidth = prev.panels.length === 0 && currentPanelWidth
                    ? currentPanelWidth
                    : prev.width;
                return { ...prev, width: newWidth, panels: newPanels, splitRatios: restoreOrEqualSplitRatios(newPanels, savedLeftSplitRef) };
            });
        } else {
            setRightSidebar(prev => {
                if (prev.panels.includes(panelId)) return prev;
                const newPanels = [...prev.panels, panelId];
                const newWidth = prev.panels.length === 0 && currentPanelWidth
                    ? currentPanelWidth
                    : prev.width;
                return { ...prev, width: newWidth, panels: newPanels, splitRatios: restoreOrEqualSplitRatios(newPanels, savedRightSplitRef) };
            });
        }
    }, [panelRegistry]);

    const undockPanelFromSidebar = useCallback((panelId: string, side: 'left' | 'right') => {
        if (side === 'left') {
            setLeftSidebar(prev => {
                if (prev.panels.includes(panelId)) {
                    savedLeftSplitRef.current = { panels: prev.panels, ratios: prev.splitRatios };
                }
                return removeFromSidebarColumns(prev, panelId);
            });
        } else {
            setRightSidebar(prev => {
                if (prev.panels.includes(panelId)) {
                    savedRightSplitRef.current = { panels: prev.panels, ratios: prev.splitRatios };
                }
                return removeFromSidebarColumns(prev, panelId);
            });
        }
        const floatPos = getDefaultFloatPos(panelId);
        panelRegistry.get(panelId)?.setState({ dockSide: null, isCollapsed: false, ...floatPos });
    }, [panelRegistry, getDefaultFloatPos]);

    // ── Geometry sync (Fix 2: useLayoutEffect prevents render flash) ──────────
    // 컬럼 단위 패널 배치 헬퍼 — primary/secondary 공통 로직
    const layoutColumn = useCallback((
        column: { panels: string[]; splitRatios: number[]; width: number },
        x: number,
        side: 'left' | 'right',
    ) => {
        if (column.panels.length === 0) return;
        const availableHeight = window.innerHeight - APP_TOTAL_HEADER_HEIGHT - DOCK_MARGIN;
        if (column.panels.length === 1) {
            applySidebarPanelState(column.panels[0], {
                x, y: APP_TOTAL_HEADER_HEIGHT, width: column.width, height: availableHeight,
                isCollapsed: false, dockSide: side,
            });
            return;
        }
        const bounds = [0, ...column.splitRatios, 1];
        let currentY = APP_TOTAL_HEADER_HEIGHT;
        for (let i = 0; i < column.panels.length; i++) {
            const panelHeight = Math.max(MIN_STACK_HEIGHT, availableHeight * (bounds[i + 1] - bounds[i]));
            applySidebarPanelState(column.panels[i], {
                x, y: currentY, width: column.width, height: panelHeight,
                isCollapsed: false, dockSide: side,
            });
            currentY += panelHeight;
        }
    }, [applySidebarPanelState]);

    useLayoutEffect(() => {
        // [LEFT] primary at x=0, secondary adjacent at x=primary.width (inward toward canvas)
        layoutColumn(leftSidebar, 0, 'left');
        if (leftSidebar.secondaryColumn) {
            layoutColumn(leftSidebar.secondaryColumn, leftSidebar.width, 'left');
        }
    }, [leftSidebar, layoutColumn, showLeftPanel, windowSize]);

    useLayoutEffect(() => {
        // [RIGHT] primary at right edge, secondary inward (left of primary)
        const primaryX = window.innerWidth - rightSidebar.width;
        layoutColumn(rightSidebar, primaryX, 'right');
        if (rightSidebar.secondaryColumn) {
            const secondaryX = primaryX - rightSidebar.secondaryColumn.width;
            layoutColumn(rightSidebar.secondaryColumn, secondaryX, 'right');
        }
    }, [rightSidebar, layoutColumn, showLeftPanel, windowSize]);

    return {
        leftSidebar,
        setLeftSidebar,
        rightSidebar,
        setRightSidebar,
        applySidebarPanelState,
        handleLeftBoundaryResize,
        handleRightBoundaryResize,
        handleLeftWidthChange,
        handleRightWidthChange,
        handleStackWith,
        handleStackLeave,
        handleSidebarStackTransition,
        handleNewColumnWith,
        addPanelToSidebar,
        removePanelFromSidebar,
        movePanelToSidebar,
        undockPanelFromSidebar,
        sidebarStateRef,
    };
}
