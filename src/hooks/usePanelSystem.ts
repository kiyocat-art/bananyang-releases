import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useToolbarStore } from '../features/toolbar/useToolbarStore';
import { useDockingSystem as useDraggablePanel } from './useDockingSystem';
import type { SnapCandidate, PanelState } from './useDockingSystem';
import { useDockLayout } from './useDockLayout';
import { usePanelRegistry } from './usePanelRegistry';
import type { PanelAdapter } from './usePanelRegistry';
import { usePanelOrchestration } from './usePanelOrchestration';
import { useUIStore } from '../store/uiStore';

// ── Module-level constants ─────────────────────────────────────────────────────
const HEADER_HEIGHT = 36;
const PADDING = 20;

// 뷰포트 비율 기반 패널 초기 사이즈 (Windows DPI 동기화 후 window.innerWidth/Height가 올바른 CSS px)
const getInitialPanelSize = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
        width:  Math.max(240, Math.min(290, Math.round(vw * 0.11))),
        height: Math.max(300, Math.min(860, Math.round(vh * 0.55))),
    };
};

const getInitialLeftPanelState = (): PanelState => {
    const { width, height } = getInitialPanelSize();
    return { x: PADDING, y: HEADER_HEIGHT + PADDING, width, height, isCollapsed: false, dockSide: null };
};

const getInitialOriginalImagePanelState = (): PanelState => {
    const { width } = getInitialPanelSize();
    return { x: PADDING + 20, y: HEADER_HEIGHT + PADDING + 20, width, height: 340, isCollapsed: false, dockSide: null };
};

// ── usePanelSystem ─────────────────────────────────────────────────────────────
export function usePanelSystem() {
    const setSnapIndicator = useUIStore(state => state.setSnapIndicator);

    // ── 1회성 마이그레이션: 이전 탭 그룹 상태 제거 (다음 릴리스에서 삭제 가능) ──
    useEffect(() => {
        try { localStorage.removeItem('tab-group-state'); } catch {}
    }, []);

    // ── Panel visibility state — persisted to localStorage ─────────────────────
    const [showLeftPanel, setShowLeftPanel] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('panel-left-visible');
            return saved !== null ? JSON.parse(saved) : true;
        } catch { return true; }
    });
    const [showOriginalImagePanel, setShowOriginalImagePanel] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('panel-original-image-visible');
            return saved !== null ? JSON.parse(saved) : false;
        } catch { return false; }
    });

    useEffect(() => {
        localStorage.setItem('panel-left-visible', JSON.stringify(showLeftPanel));
    }, [showLeftPanel]);

    useEffect(() => {
        localStorage.setItem('panel-original-image-visible', JSON.stringify(showOriginalImagePanel));
    }, [showOriginalImagePanel]);

    // ── Dock state persistence across sidebar toggle ──────────────────────────
    // Saves which panels were docked (and the sidebar panels[]/splitRatios) when
    // the sidebar is closed, so they can be restored when it's reopened.
    type SavedDockInfo = {
        dockedPanels: { panelId: string; dockSide: 'left' | 'right' }[];
        sidebarState: { panels: string[]; splitRatios: number[]; width: number } | null;
    };
    const savedLeftDockRef = useRef<SavedDockInfo | null>(null);
    const savedRightDockRef = useRef<SavedDockInfo | null>(null);

    // ── Snap Candidate Refs ────────────────────────────────────────────────────
    const leftPanelSnapRef = useRef<SnapCandidate[]>([{ ...getInitialLeftPanelState() }]);
    const originalImagePanelSnapRef = useRef<SnapCandidate[]>([{ ...getInitialOriginalImagePanelState() }]);

    // Previous dockSide tracking (초기값 = 초기 state의 dockSide)
    const prevLeftDockSideRef = useRef<'left' | 'right' | null>(getInitialLeftPanelState().dockSide);
    const prevOriginalImageDockSideRef = useRef<'left' | 'right' | null>(getInitialOriginalImagePanelState().dockSide);

    // Docked panels info ref
    const dockedPanelsRef = useRef<{ id: string; x: number; y: number; width: number; height: number; dockSide: 'left' | 'right' | null }[]>([]);

    // Per-panel snap group tracking
    const leftPanelIsSnappedRef = useRef(false);
    const originalImagePanelIsSnappedRef = useRef(false);

    // ── Panel Registry ─────────────────────────────────────────────────────────
    const panelRegistry = usePanelRegistry();

    // ── Panel Orchestration ────────────────────────────────────────────────────
    const {
        snapLinksRef,
        snapLinksDisplay,
        handleVerticalSnapWith,
        handleVerticalUnsnap,
        makeDragDeltaHandler,
        makeSplitterResizeHandler,
    } = usePanelOrchestration(panelRegistry);

    // ── Stacking refs (need to exist before useDockLayout) ────────────────────
    const setLeftPanelStateRef = useRef<React.Dispatch<React.SetStateAction<any>> | null>(null);
    const leftPanelStateRef = useRef<any>(null);
    const setOriginalImagePanelStateRef = useRef<React.Dispatch<React.SetStateAction<any>> | null>(null);
    const originalImagePanelStateRef = useRef<any>(null);

    // ── Default float position table ───────────────────────────────────────────
    const getDefaultFloatPos = useCallback((panelId: string): { x: number; y: number; width?: number; height?: number } => {
        const { width: pw, height: ph } = getInitialPanelSize();
        const table: Record<string, { x: number; y: number; width?: number; height?: number }> = {
            'left-panel': { x: 80, y: 100, width: pw, height: ph },
            'original-image-panel': { x: 60, y: 80, width: pw, height: 340 },
        };
        return table[panelId] ?? { x: 200, y: 120 };
    }, []);

    // ── Dock Layout ────────────────────────────────────────────────────────────
    const {
        leftSidebar, setLeftSidebar,
        rightSidebar, setRightSidebar,
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
    } = useDockLayout({
        panelRegistry,
        getDefaultFloatPos,
        leftPanelStateRef,
        showLeftPanel,
    });

    // ── Splitter resize + drag delta memos ─────────────────────────────────────
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleLeftSplitterResize = useMemo(() => makeSplitterResizeHandler('left-panel'), [makeSplitterResizeHandler]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleOriginalImageSplitterResize = useMemo(() => makeSplitterResizeHandler('original-image-panel'), [makeSplitterResizeHandler]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleLeftDragDelta = useMemo(() => makeDragDeltaHandler('left-panel'), [makeDragDeltaHandler]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleOriginalImageDragDelta = useMemo(() => makeDragDeltaHandler('original-image-panel'), [makeDragDeltaHandler]);
    // ── Draggable Panels ───────────────────────────────────────────────────────
    const {
        panelState: leftPanelState,
        setPanelState: setLeftPanelState,
        handleDragStart: handleLeftPanelDragStart,
        handleResizeStart: handleLeftPanelResizeStart,
        toggleCollapse: toggleLeftPanelCollapse,
        resetPanel: resetLeftPanel,
    } = useDraggablePanel({
        panelId: 'left-panel',
        storageKey: 'panel-left-state',
        defaultState: getInitialLeftPanelState(),
        snapCandidatesRef: leftPanelSnapRef,
        dockedPanelsRef,
        onSnapIndicatorChange: setSnapIndicator,
        onStackWith: handleStackWith,
        onSidebarStackTransition: handleSidebarStackTransition,
        sidebarStateRef,
        onNewColumnWith: handleNewColumnWith,
        onStackLeave: () => handleStackLeave('left-panel'),
        onBoundaryResize: (newBottomY: number) => {
            const ds = leftPanelStateRef.current?.dockSide;
            if (ds === 'left') handleLeftBoundaryResize(newBottomY);
            else if (ds === 'right') handleRightBoundaryResize(newBottomY);
        },
        onWidthChange: (newWidth: number) => {
            const ds = leftPanelStateRef.current?.dockSide;
            if (ds === 'left') handleLeftWidthChange(newWidth);
            else if (ds === 'right') handleRightWidthChange(newWidth);
        },
        onDragDelta: handleLeftDragDelta,
        onVerticalSnapWith: (cid, amBelow) => handleVerticalSnapWith('left-panel', cid, amBelow),
        onVerticalUnsnap: () => handleVerticalUnsnap('left-panel'),
        isVerticallySnappedRef: leftPanelIsSnappedRef,
        onSplitterResize: handleLeftSplitterResize,
    });

    const {
        panelState: originalImagePanelState,
        setPanelState: setOriginalImagePanelState,
        handleDragStart: handleOriginalImagePanelDragStart,
        handleResizeStart: handleOriginalImagePanelResizeStart,
        toggleCollapse: toggleOriginalImagePanelCollapse,
        resetPanel: resetOriginalImagePanel,
    } = useDraggablePanel({
        panelId: 'original-image-panel',
        storageKey: 'panel-original-image-state',
        defaultState: getInitialOriginalImagePanelState(),
        snapCandidatesRef: originalImagePanelSnapRef,
        dockedPanelsRef,
        onSnapIndicatorChange: setSnapIndicator,
        onStackWith: handleStackWith,
        onSidebarStackTransition: handleSidebarStackTransition,
        sidebarStateRef,
        onNewColumnWith: handleNewColumnWith,
        onStackLeave: () => handleStackLeave('original-image-panel'),
        onBoundaryResize: (newBottomY: number) => {
            const ds = originalImagePanelStateRef.current?.dockSide;
            if (ds === 'left') handleLeftBoundaryResize(newBottomY);
            else if (ds === 'right') handleRightBoundaryResize(newBottomY);
        },
        onWidthChange: (newWidth: number) => {
            const ds = originalImagePanelStateRef.current?.dockSide;
            if (ds === 'left') handleLeftWidthChange(newWidth);
            else if (ds === 'right') handleRightWidthChange(newWidth);
        },
        onDragDelta: handleOriginalImageDragDelta,
        onVerticalSnapWith: (cid, amBelow) => handleVerticalSnapWith('original-image-panel', cid, amBelow),
        onVerticalUnsnap: () => handleVerticalUnsnap('original-image-panel'),
        isVerticallySnappedRef: originalImagePanelIsSnappedRef,
        onSplitterResize: handleOriginalImageSplitterResize,
    });

    // ── Sync setter refs ───────────────────────────────────────────────────────
    useEffect(() => {
        setLeftPanelStateRef.current = setLeftPanelState;
    }, [setLeftPanelState]);

    useEffect(() => {
        setOriginalImagePanelStateRef.current = setOriginalImagePanelState;
    }, [setOriginalImagePanelState]);

    // ── Panel Registry — adapter registration ──────────────────────────────────
    panelRegistry.register('original-image-panel', {
        getId: () => 'original-image-panel',
        getState: () => originalImagePanelStateRef.current ?? originalImagePanelState,
        setState: (s) => setOriginalImagePanelState((p: any) => ({ ...p, ...s })),
        applyDelta: (dx, dy) => setOriginalImagePanelState((p: any) =>
            p.dockSide != null ? p : { ...p, x: p.x + dx, y: p.y + dy }
        ),
        applyHeightDelta: (delta) => setOriginalImagePanelState((p: any) => ({
            ...p, height: Math.max(150, p.height - delta),
        })),
        getSnapRef: () => originalImagePanelSnapRef,
        getIsSnappedRef: () => originalImagePanelIsSnappedRef,
        getVisibleRef: () => ({
            current: showOriginalImagePanel || (originalImagePanelStateRef.current?.dockSide ?? originalImagePanelState.dockSide) !== null
        }),
    });

    panelRegistry.register('left-panel', {
        getId: () => 'left-panel',
        getState: () => leftPanelStateRef.current ?? leftPanelState,
        setState: (s) => setLeftPanelState((p: any) => ({ ...p, ...s })),
        applyDelta: (dx, dy) => setLeftPanelState((p: any) =>
            p.dockSide != null ? p : { ...p, x: p.x + dx, y: p.y + dy }
        ),
        applyHeightDelta: (delta) => setLeftPanelState((p: any) => ({
            ...p, height: Math.max(150, p.height - delta),
        })),
        getSnapRef: () => leftPanelSnapRef,
        getIsSnappedRef: () => leftPanelIsSnappedRef,
        getVisibleRef: () => ({ current: true }),
    });

    // ── getPanelPos helper ─────────────────────────────────────────────────────
    const getPanelPos = useCallback((panelId: string): { x: number; y: number; width: number; height: number } | null => {
        if (panelId === 'left-panel') {
            const s = leftPanelStateRef.current;
            return s ? { x: s.x, y: s.y, width: s.width, height: s.height } : null;
        }
        if (panelId === 'original-image-panel') {
            const s = originalImagePanelStateRef.current;
            return s ? { x: s.x, y: s.y, width: s.width, height: s.height } : null;
        }
        return null;
    }, []);

    // ── refreshAllSnapRefs ─────────────────────────────────────────────────────
    function refreshAllSnapRefs() {
        const HEADER_H = 48;
        const toCandidate = (a: PanelAdapter): SnapCandidate => {
            const s = a.getState();
            return { id: a.getId(), dockSide: s.dockSide, x: s.x, y: s.y, width: s.width, height: s.isCollapsed ? HEADER_H : s.height };
        };
        const visibleAdapters = panelRegistry.getAll().filter(a => a.getVisibleRef().current);
        for (const adapter of panelRegistry.getAll()) {
            adapter.getSnapRef().current = visibleAdapters
                .filter(a => a.getId() !== adapter.getId())
                .map(toCandidate);
        }
    }

    // ── Effects: update snap refs when panel states change ────────────────────
    useEffect(() => {
        leftPanelStateRef.current = leftPanelState;
        originalImagePanelStateRef.current = originalImagePanelState;
        refreshAllSnapRefs();
    }, [leftPanelState, originalImagePanelState]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Effect: update dockedPanelsRef ────────────────────────────────────────
    useEffect(() => {
        const dockedPanels: { id: string; x: number; y: number; width: number; height: number; dockSide: 'left' | 'right' | null }[] = [];
        if (leftPanelState.dockSide) {
            dockedPanels.push({
                id: 'left-panel',
                x: leftPanelState.x, y: leftPanelState.y,
                width: leftPanelState.width,
                height: leftPanelState.isCollapsed ? 48 : leftPanelState.height,
                dockSide: leftPanelState.dockSide,
            });
        }
        if (originalImagePanelState.dockSide) {
            dockedPanels.push({
                id: 'original-image-panel',
                x: originalImagePanelState.x, y: originalImagePanelState.y,
                width: originalImagePanelState.width,
                height: originalImagePanelState.isCollapsed ? 48 : originalImagePanelState.height,
                dockSide: originalImagePanelState.dockSide,
            });
        }
        dockedPanelsRef.current = dockedPanels;
    }, [leftPanelState, originalImagePanelState]);

    // ── left-panel sidebar membership on dockSide change ──
    useEffect(() => {
        const dockSide = leftPanelState.dockSide;
        const prevSide = prevLeftDockSideRef.current;
        prevLeftDockSideRef.current = dockSide;
        if (dockSide === prevSide) return;
        if (dockSide !== null && prevSide !== null) movePanelToSidebar('left-panel', dockSide);
        else if (dockSide !== null) addPanelToSidebar('left-panel', dockSide);
        else removePanelFromSidebar('left-panel');
    }, [leftPanelState.dockSide]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── original-image-panel sidebar membership on dockSide change ──
    useEffect(() => {
        const dockSide = originalImagePanelState.dockSide;
        const prevSide = prevOriginalImageDockSideRef.current;
        prevOriginalImageDockSideRef.current = dockSide;
        if (dockSide === prevSide) return;
        if (dockSide !== null && prevSide !== null) movePanelToSidebar('original-image-panel', dockSide);
        else if (dockSide !== null) addPanelToSidebar('original-image-panel', dockSide);
        else removePanelFromSidebar('original-image-panel');
    }, [originalImagePanelState.dockSide]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── handleToolbarGroupDrag ────────────────────────────────────────────────
    // 툴바/팝오버 헤더 드래그 시 도킹된 패널 + 스냅 그룹 함께 이동
    const handleToolbarGroupDrag = useCallback((panelId: string, dx: number, dy: number) => {
        // 패널 자체 이동 (dockSide != null이면 applyDelta 내부에서 무시됨)
        panelRegistry.get(panelId)?.applyDelta(dx, dy);
        // 수직 스냅된 패널(자식+부모)도 함께 이동
        makeDragDeltaHandler(panelId)(dx, dy);
    }, [panelRegistry, makeDragDeltaHandler]);

    // ── resetPanels ───────────────────────────────────────────────────────────
    const resetPanels = () => {
        [...leftSidebar.panels].forEach(id => undockPanelFromSidebar(id, 'left'));
        [...rightSidebar.panels].forEach(id => undockPanelFromSidebar(id, 'right'));
        resetLeftPanel();

        // 팝오버는 항상 닫기
        useToolbarStore.getState().setActiveToolId(null);
        // 툴바: 기본 위치(우측 상단 자유 부유, 세로 모드)로 완전 초기화
        const defaultPos = { x: window.innerWidth - 60, y: 60 };
        useToolbarStore.getState().setToolbarBoundImageId(null);
        useToolbarStore.getState().setToolbarDockedTo(null);
        useToolbarStore.getState().setToolbarPosition(defaultPos);
        useToolbarStore.getState().setToolbarFloatingPosition(defaultPos);
        useToolbarStore.getState().setToolbarSide('left');
        useToolbarStore.getState().setOrientation('vertical');
    };

    // ── Sidebar toggle with dock state persistence ─────────────────────────────
    // Wraps the raw setShowXxxPanel so that closing a sidebar saves the dock state
    // and reopening it restores the docking layout.
    const toggleLeftPanel = useCallback((visible: boolean) => {
        if (!visible) {
            // Closing: save current dock state for all panels docked to 'left'
            const dockedPanels: { panelId: string; dockSide: 'left' | 'right' }[] = [];
            const lps = leftPanelStateRef.current;
            if (lps?.dockSide === 'left') dockedPanels.push({ panelId: 'left-panel', dockSide: 'left' });
            const oips = originalImagePanelStateRef.current;
            if (oips?.dockSide === 'left') dockedPanels.push({ panelId: 'original-image-panel', dockSide: 'left' });

            savedLeftDockRef.current = {
                dockedPanels,
                sidebarState: leftSidebar.panels.length > 0
                    ? { panels: [...leftSidebar.panels], splitRatios: [...leftSidebar.splitRatios], width: leftSidebar.width }
                    : null,
            };
        } else {
            // Opening: restore saved dock state
            const saved = savedLeftDockRef.current;
            if (saved) {
                // Restore individual panel dockSide
                for (const { panelId, dockSide } of saved.dockedPanels) {
                    const adapter = panelRegistry.get(panelId);
                    if (adapter && adapter.getState().dockSide !== dockSide) {
                        adapter.setState({ dockSide });
                    }
                }
                // Restore sidebar panels array & ratios
                if (saved.sidebarState) {
                    setLeftSidebar(prev => ({
                        ...prev,
                        panels: saved.sidebarState!.panels,
                        splitRatios: saved.sidebarState!.splitRatios,
                        width: saved.sidebarState!.width,
                    }));
                }
                savedLeftDockRef.current = null;
            }
        }
        setShowLeftPanel(visible);
    }, [panelRegistry, leftSidebar, setLeftSidebar]);

    return {
        // Panel visibility (wrappers that preserve dock state)
        showLeftPanel, setShowLeftPanel: toggleLeftPanel,
        showOriginalImagePanel, setShowOriginalImagePanel,
        // Panel states & handlers
        leftPanelState, setLeftPanelState,
        handleLeftPanelDragStart,
        handleLeftPanelResizeStart,
        toggleLeftPanelCollapse,
        resetLeftPanel,
        originalImagePanelState, setOriginalImagePanelState,
        handleOriginalImagePanelDragStart,
        handleOriginalImagePanelResizeStart,
        toggleOriginalImagePanelCollapse,
        resetOriginalImagePanel,
        handleOriginalImageSplitterResize,
        // Sidebar states
        leftSidebar, setLeftSidebar,
        rightSidebar, setRightSidebar,
        undockPanelFromSidebar,
        // Snap system
        snapLinksDisplay,
        handleVerticalSnapWith,
        handleVerticalUnsnap,
        handleLeftSplitterResize,
        // Helpers
        getPanelPos,
        refreshAllSnapRefs,
        resetPanels,
        handleToolbarGroupDrag,
        handleStackWith,
    };
}
