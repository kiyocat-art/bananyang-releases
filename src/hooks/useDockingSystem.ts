import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useToolbarStore } from '../features/toolbar/useToolbarStore';

// Types and Constants
export type DockSide = 'left' | 'right' | null;

export type PanelState = {
    x: number;
    y: number;
    width: number;
    height: number;
    isCollapsed: boolean;
    dockSide: DockSide;
};

export type SnapIndicatorState = {
    x: number;
    y: number;
    width: number;
    height: number;
    isVisible: boolean;
    /** SnapIndicator 모양 — 기본 'line'. 'rect-outline'은 탭 그룹화 드롭존 표시용. */
    kind?: 'line' | 'rect-fill' | 'rect-outline';
};

export type SnapCandidate = {
    id?: string; // for parent-child vertical snap tracking
    dockSide?: DockSide; // tracks whether candidate is docked (used to skip docked panels in Section B)
    x: number;
    y: number;
    width: number;
    height: number;
};

// [STACKING] Extended type for docked panels with identifiers
export type DockedPanelInfo = SnapCandidate & {
    id: string;
    dockSide: DockSide;
};

// [STACKING] Split position when dropping onto a docked panel
export type SplitPosition = 'top' | 'bottom' | null;

// [STACK TRANSITION] Snapshot of a sidebar column needed to migrate the entire stack.
// Mirrors SidebarState from useDockLayout but kept local to avoid circular imports.
export type SidebarSnapshot = {
    width: number;
    panels: string[];
    splitRatios: number[];
    secondaryColumn?: { width: number; panels: string[]; splitRatios: number[] };
};

export type SidebarStateMap = {
    left: SidebarSnapshot;
    right: SidebarSnapshot;
};

export type SidebarStackTransitionArgs = {
    fromSide: 'left' | 'right';
    toSide: 'left' | 'right';
    panelIds: string[];
    splitRatios: number[];
    width: number;
    secondaryColumn?: SidebarSnapshot['secondaryColumn'];
};

const PANEL_HEADER_HEIGHT = 32;
const APP_HEADER_HEIGHT = 36; // Match DraggableHeader height 36px
const DOCK_MARGIN = 16;
const MIN_STACK_HEIGHT = 120; // [STACKING] Minimum height for stacked panels
const SNAP_THRESHOLD = 20;
const EDGE_SNAP_THRESHOLD = 20; // Distance to snap to screen edge
const UNDOCK_THRESHOLD = 50;    // Distance to drag away to undock
// 도킹 패널 드롭존:
//  - 상/하 가장자리(12px 이내): 수직 스택 (Stack-Above / Stack-Below)
//  - 캔버스 방향 가장자리(12px 이내): 새 컬럼 생성
const STACK_EDGE_PX = 12;
// Viewport-proportional panel size bounds (evaluated at drag-time)
const getMinPanelWidth  = () => Math.max(220, Math.min(340, Math.round(window.innerWidth  * 0.17)));
const getLeftPanelMinWidth = () => Math.max(120, Math.min(200, Math.round(window.innerWidth * 0.10)));
const getMinPanelHeight = () => Math.max(200, Math.min(320, Math.round(window.innerHeight * 0.30)));
const getMaxPanelWidth  = () => Math.max(480, Math.min(780, Math.round(window.innerWidth  * 0.45)));

interface UseDockingSystemProps {
    panelId: string; // [STACKING] Unique panel identifier
    storageKey?: string; // [FIX] Optional to allow disabling persistence
    defaultState: PanelState;
    snapCandidatesRef?: React.MutableRefObject<SnapCandidate[]>;
    dockedPanelsRef?: React.MutableRefObject<DockedPanelInfo[]>; // [STACKING] Info about all docked panels
    onSnapIndicatorChange?: (state: SnapIndicatorState | null) => void;
    // [STACKING] Callbacks for cross-panel communication
    onStackWith?: (targetPanelId: string, position: SplitPosition, newHeight: number, newY: number, draggingPanelId: string) => void;
    onStackLeave?: () => void;
    // [MULTI-COLUMN] Drop on canvas-facing outer edge → create new secondary column
    onNewColumnWith?: (targetPanelId: string, draggingPanelId: string) => void;
    onBoundaryResize?: (newBottomY: number) => void;
    onWidthChange?: (newWidth: number) => void; // [STACKING] Sync width between stacked panels
    // [PARENT-CHILD] Callbacks for magnetic snap parent-child linking
    onDragDelta?: (dx: number, dy: number) => void;
    onVerticalSnapWith?: (candidateId: string, amBelow: boolean) => void;
    onVerticalUnsnap?: () => void;
    // [GROUP LOCK] When true, prevents auto-unsnap on free drop
    isVerticallySnappedRef?: React.MutableRefObject<boolean>;
    // [INNER SPLITTER] Notifies child when parent's south edge is resized
    onSplitterResize?: (heightDelta: number) => void;
    // [STACK TRANSITION] Live ref to both sidebar states — needed to capture splitRatios/width/secondaryColumn
    // for whole-stack sidebar switching (A2). Updated each render in useDockLayout.
    sidebarStateRef?: React.MutableRefObject<SidebarStateMap | null>;
    // [STACK TRANSITION] Fired when the dragged panel was part of a multi-panel sidebar
    // and the user dragged it across the screen midline to the opposite (empty) sidebar.
    // The entire stack — panels, splitRatios, width, secondaryColumn — is transferred together.
    onSidebarStackTransition?: (args: SidebarStackTransitionArgs) => void;
}

export const useDockingSystem = ({
    panelId,
    storageKey,
    defaultState,
    snapCandidatesRef,
    dockedPanelsRef,
    onSnapIndicatorChange,
    onStackWith,
    onStackLeave,
    onNewColumnWith,
    onBoundaryResize,
    onWidthChange,
    onDragDelta,
    onVerticalSnapWith,
    onVerticalUnsnap,
    isVerticallySnappedRef,
    onSplitterResize,
    sidebarStateRef,
    onSidebarStackTransition,
}: UseDockingSystemProps) => {
    const effectiveMinWidth = () => 192;

    // 1. Initialize State from Storage
    const [panelState, setPanelState] = useState<PanelState>(() => {
        if (storageKey) { // [FIX] Only load if key provided
            try {
                const savedState = localStorage.getItem(storageKey);
                if (savedState) {
                    const parsed = JSON.parse(savedState);
                    if (typeof parsed === 'object' && parsed !== null && 'x' in parsed && 'width' in parsed) {
                        // Ensure robust fallback for dockSide
                        const restored = { ...defaultState, ...parsed, dockSide: parsed.dockSide || null };
                        // DPI 변경 후 저장된 위치가 현재 뷰포트 밖이면 기본값으로 리셋
                        const isOutOfViewport = restored.x >= window.innerWidth || restored.y >= window.innerHeight;
                        if (isOutOfViewport) return defaultState;
                        // 이전 최솟값으로 저장된 너비가 현재 최솟값(192px)보다 작으면 클램프
                        if (restored.width < 192) restored.width = 192;
                        return restored;
                    }
                }
            } catch (e) {
                console.error(`Failed to load panel state for ${storageKey}`, e);
            }
        }
        return defaultState;
    });

    // 2. Refs for Drag Interaction
    const dragRef = useRef<{
        type: 'move' | 'resize';
        startX: number;
        startY: number;
        startState: PanelState;
        resizeDirection?: string; // 'e', 'w', 'n', 's', 'ne', etc.
        prevClientX: number;
        prevClientY: number;
        prevSplitterHeightDelta?: number; // tracks last sent delta for floating south resize
        // [HIT-TEST FIX] Grab offset within panel body (for center-based stack zone detection)
        grabOffsetX?: number;
        grabOffsetY?: number;
    } | null>(null);

    const pendingDockRef = useRef<{
        dockSide: DockSide;
        height?: number;
    } | null>(null);

    // [NEW] Ref for "Snap Preview". Stores the target state if user were to drop now.
    const pendingSnapRef = useRef<{
        x: number;
        y: number;
        width: number;
        height: number;
        dockSide: DockSide;
        // [STACKING] Split mode info
        splitPosition?: SplitPosition;
        targetPanelId?: string;
        // [PARENT-CHILD] Vertical snap info
        snapCandidateId?: string;
        amBelow?: boolean;
        // [MULTI-COLUMN] When set, drop = create new column adjacent to targetPanelId
        newColumnIntoPanelId?: string;
    } | null>(null);

    // [NEW] Ref to store floating size for restore on undock
    const lastFloatingSizeRef = useRef<{ width: number; height: number } | null>(null);

    // [STACK TRANSITION] Set when A2 detects a sidebar-switch involving a multi-panel stack
    // and the destination sidebar is empty. Consumed in handleMouseUp to fire
    // onSidebarStackTransition, then cleared.
    const pendingGroupTransitionRef = useRef<SidebarStackTransitionArgs | null>(null);

    // [STABLE CALLBACKS] Prevent the drag event useEffect from re-running on every render.
    // onVerticalSnapWith/onVerticalUnsnap are inline arrow functions in usePanelSystem —
    // new references on each render. Capturing them in refs lets the effect call fresh
    // closures without listing them as deps, preventing window.mouseup from being
    // removed+re-added mid-drag (which caused the drag state to get stuck).
    const onVerticalSnapWithRef = useRef(onVerticalSnapWith);
    const onVerticalUnsnapRef = useRef(onVerticalUnsnap);
    onVerticalSnapWithRef.current = onVerticalSnapWith;
    onVerticalUnsnapRef.current = onVerticalUnsnap;

    // [FIX] On first launch (no saved state), recalculate position after mount
    // when window dimensions are properly set
    const isFirstLaunchRef = useRef<boolean>((() => {
        if (!storageKey) return true; // [FIX] Always treat as first launch if no storage
        try {
            return !localStorage.getItem(storageKey);
        } catch {
            return true;
        }
    })());

    useEffect(() => {
        // Only run on first launch (no saved state)
        if (isFirstLaunchRef.current) {
            isFirstLaunchRef.current = false;

            // Use requestAnimationFrame to ensure window is fully rendered
            requestAnimationFrame(() => {
                setPanelState(prev => {
                    // Recalculate position based on current window dimensions
                    const newDefaultState = {
                        ...defaultState,
                        // For right-side positioned panels, recalculate x based on current window width
                        // [FIX] Use defaultState.dockSide check more robustly
                        x: defaultState.x > window.innerWidth / 2
                            ? window.innerWidth - defaultState.width - (defaultState.dockSide === 'right' ? 0 : 24)
                            : defaultState.x
                    };
                    return newDefaultState;
                });
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Persist State
    useEffect(() => {
        if (storageKey) { // [FIX] Only save if key provided
            try {
                localStorage.setItem(storageKey, JSON.stringify(panelState));
            } catch (e) {
                console.error(`Failed to save panel state for ${storageKey}`, e);
            }
        }
    }, [panelState, storageKey]);

    // 3. Action Handlers

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
        e.preventDefault();

        // [SIZE RESTORE] Save floating size ONLY if currently floating (not docked)
        if (!panelState.dockSide) {
            lastFloatingSizeRef.current = { width: panelState.width, height: panelState.height };
        }

        dragRef.current = {
            type: 'move',
            startX: e.clientX,
            startY: e.clientY,
            startState: panelState,
            prevClientX: e.clientX,
            prevClientY: e.clientY,
            // [HIT-TEST FIX] Capture grab offset so Section D can compute panel center
            grabOffsetX: e.clientX - panelState.x,
            grabOffsetY: e.clientY - panelState.y,
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        // [PHOTOSHOP-STYLE DRAG PREVIEW] 드래그 중 패널 투명도 55% — DOM 직접 조작 (리렌더 없음)
        const dragEl = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null;
        if (dragEl) dragEl.setAttribute('data-dragging', 'true');
    }, [panelState, panelId]);

    const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = {
            type: 'resize',
            startX: e.clientX,
            startY: e.clientY,
            startState: panelState,
            resizeDirection: direction,
            prevClientX: e.clientX,
            prevClientY: e.clientY,
            prevSplitterHeightDelta: 0,
        };
        document.body.style.userSelect = 'none';
        const cursorMap: Record<string, string> = {
            n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
            ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize'
        };
        document.body.style.cursor = cursorMap[direction] ?? 'default';
    }, [panelState]);

    const toggleCollapse = useCallback(() => {
        setPanelState(prev => ({ ...prev, isCollapsed: !prev.isCollapsed }));
    }, []);

    const resetPanel = useCallback(() => {
        setPanelState(prev => {
            if (prev.dockSide) {
                // Docked: only reset width, keep position and dock side
                return { ...prev, width: defaultState.width };
            }
            return defaultState;
        });
    }, [defaultState]);

    // [BATCH PANELS] Size-only reset — keeps position (x, y) and dockSide unchanged
    const resetSizeOnly = useCallback(() => {
        setPanelState(prev => ({
            ...prev,
            width: defaultState.width,
            height: defaultState.height,
        }));
    }, [defaultState]);

    // 4. Core Logic: Move & Resize
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;

            const { type, startX, startY, startState, resizeDirection } = dragRef.current;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (type === 'move') {
                // [PARENT-CHILD] Fire delta for child propagation
                if (onDragDelta && dragRef.current) {
                    const moveDx = e.clientX - dragRef.current.prevClientX;
                    const moveDy = e.clientY - dragRef.current.prevClientY;
                    if (moveDx !== 0 || moveDy !== 0) onDragDelta(moveDx, moveDy);
                }
                if (dragRef.current) {
                    dragRef.current.prevClientX = e.clientX;
                    dragRef.current.prevClientY = e.clientY;
                }

                let newX = startState.x + dx;
                let newY = startState.y + dy;

                // [HEADER GUARD] Prevent panels from overlapping the app header during drag
                newY = Math.max(APP_HEADER_HEIGHT, newY);

                // --- Docking & Snapping Logic (Decoupled) ---
                // "Free Drag": newX/newY follow mouse exactly.
                // "Preview": Calculated separately for indicator and pendingSnapRef.

                const myWidth = startState.width;
                const myHeight = startState.isCollapsed ? PANEL_HEADER_HEIGHT : startState.height;
                const myRight = newX + myWidth;
                const myBottom = newY + myHeight; // Note: using free-drag Y for detection

                let indicator: SnapIndicatorState | null = null;
                pendingSnapRef.current = null; // Reset pending snap
                pendingDockRef.current = null; // Clear legacy ref

                let snapTarget: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    dockSide: DockSide;
                    splitPosition?: SplitPosition;
                    targetPanelId?: string;
                } = {
                    x: newX,
                    y: newY,
                    width: myWidth,
                    height: myHeight,
                    dockSide: null
                };
                let hasSnap = false;
                // [PARENT-CHILD] Track which candidate caused a vertical snap
                let snapCandidateId: string | undefined;
                let snapAmBelow: boolean | undefined;

                // A. Check Screen Edges (Priority)
                const isNearLeft = newX < EDGE_SNAP_THRESHOLD;
                // Use screen coordinates for right edge check
                const isNearRight = (window.innerWidth - myRight) < EDGE_SNAP_THRESHOLD;

                // Top Magnet Check (Relative to free drag position)
                const isNearTop = Math.abs(newY - APP_HEADER_HEIGHT) < SNAP_THRESHOLD;

                if (isNearLeft) {
                    // [FIX] Removed startState.dockSide check. Just being near the left edge is enough to trigger snap preview.
                    const targetH = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
                    snapTarget = { x: 0, y: APP_HEADER_HEIGHT, width: myWidth, height: targetH, dockSide: 'left' };
                    indicator = { x: 0, y: APP_HEADER_HEIGHT, width: 4, height: targetH, isVisible: true };
                    hasSnap = true;
                } else if (isNearRight) {
                    // [FIX] Same here.
                    const targetH = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
                    const targetX = window.innerWidth - myWidth;
                    snapTarget = { x: targetX, y: APP_HEADER_HEIGHT, width: myWidth, height: targetH, dockSide: 'right' };
                    indicator = { x: window.innerWidth - 4, y: APP_HEADER_HEIGHT, width: 4, height: targetH, isVisible: true };
                    hasSnap = true;
                }

                // A2. [SIDEBAR SWITCH] For docked panels: snap to opposite side when center crosses screen midpoint.
                // This allows switching left↔right sidebars by dragging past the screen center,
                // instead of requiring the panel to be dragged all the way to the opposite screen edge.
                if (!hasSnap && startState.dockSide !== null) {
                    const myMidX = newX + myWidth / 2;
                    const screenMidX = window.innerWidth / 2;
                    const targetH = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
                    if (startState.dockSide === 'left' && myMidX > screenMidX) {
                        const targetX = window.innerWidth - myWidth;
                        snapTarget = { x: targetX, y: APP_HEADER_HEIGHT, width: myWidth, height: targetH, dockSide: 'right' };
                        indicator = { x: window.innerWidth - 4, y: APP_HEADER_HEIGHT, width: 4, height: targetH, isVisible: true };
                        hasSnap = true;
                    } else if (startState.dockSide === 'right' && myMidX < screenMidX) {
                        snapTarget = { x: 0, y: APP_HEADER_HEIGHT, width: myWidth, height: targetH, dockSide: 'left' };
                        indicator = { x: 0, y: APP_HEADER_HEIGHT, width: 4, height: targetH, isVisible: true };
                        hasSnap = true;
                    }
                }

                // [STACK TRANSITION] After A1/A2 settle: if the resulting snap is a sidebar switch
                // (source had multiple panels, dest empty), capture the entire stack so handleMouseUp
                // migrates it atomically. Otherwise clear any stale capture from a previous move event.
                {
                    const isSidebarSwitch =
                        hasSnap &&
                        startState.dockSide !== null &&
                        snapTarget.dockSide !== null &&
                        snapTarget.dockSide !== startState.dockSide;
                    let groupCaptured = false;
                    if (isSidebarSwitch && sidebarStateRef?.current && onSidebarStackTransition) {
                        const fromSide = startState.dockSide as 'left' | 'right';
                        const toSide = snapTarget.dockSide as 'left' | 'right';
                        const fromSb = sidebarStateRef.current[fromSide];
                        const toSb = sidebarStateRef.current[toSide];
                        const totalSourcePanels =
                            fromSb.panels.length + (fromSb.secondaryColumn?.panels.length ?? 0);
                        const totalDestPanels =
                            toSb.panels.length + (toSb.secondaryColumn?.panels.length ?? 0);
                        const sourceIncludesDragged =
                            fromSb.panels.includes(panelId) ||
                            (fromSb.secondaryColumn?.panels.includes(panelId) ?? false);
                        if (totalSourcePanels >= 2 && totalDestPanels === 0 && sourceIncludesDragged) {
                            pendingGroupTransitionRef.current = {
                                fromSide,
                                toSide,
                                panelIds: [...fromSb.panels],
                                splitRatios: [...fromSb.splitRatios],
                                width: fromSb.width,
                                secondaryColumn: fromSb.secondaryColumn
                                    ? {
                                        width: fromSb.secondaryColumn.width,
                                        panels: [...fromSb.secondaryColumn.panels],
                                        splitRatios: [...fromSb.secondaryColumn.splitRatios],
                                    }
                                    : undefined,
                            };
                            groupCaptured = true;
                        }
                    }
                    if (!groupCaptured) pendingGroupTransitionRef.current = null;
                }

                // B. Check Candidate Panels (Secondary) - Only if not snapping to edge
                // Skip entirely when dragging a previously-docked panel (sidebar transition):
                // during sidebar-to-sidebar moves we only want edge/A2 snapping, not panel-to-panel.
                if (!hasSnap && startState.dockSide === null && snapCandidatesRef?.current) {
                    for (const other of snapCandidatesRef.current) {
                        // 도킹된 패널은 스냅 후보에서 제외 (dockSide 직접 확인, dockedPanelsRef 타이밍 의존 제거)
                        if (other.dockSide != null) continue;
                        const otherRight = other.x + other.width;
                        const otherBottom = other.y + other.height;

                        // --- HORIZONTAL SNAP (Side-by-Side) ---
                        // Require vertical overlap so distant panels don't snap
                        const verticallyOverlaps = newY < other.y + other.height && myBottom > other.y;

                        // Snap Left to Other Right
                        if (verticallyOverlaps && Math.abs(newX - otherRight) < SNAP_THRESHOLD) {
                            snapTarget = { x: otherRight, y: other.y, width: myWidth, height: other.height, dockSide: null };
                            indicator = { x: otherRight - 2, y: other.y, width: 4, height: other.height, isVisible: true };
                            hasSnap = true;
                        }
                        // Snap Right to Other Left
                        else if (verticallyOverlaps && Math.abs(myRight - other.x) < SNAP_THRESHOLD) {
                            snapTarget = { x: other.x - myWidth, y: other.y, width: myWidth, height: other.height, dockSide: null };
                            indicator = { x: other.x - 2, y: other.y, width: 4, height: other.height, isVisible: true };
                            hasSnap = true;
                        }

                        // --- VERTICAL SNAP (Top-to-Bottom) ---
                        // Snap Top of dragged to Bottom of other (I am below → child)
                        else if (Math.abs(newY - otherBottom) < SNAP_THRESHOLD &&
                            newX < otherRight && myRight > other.x) { // Horizontal overlap check
                            // [WIDTH SYNC] Match the target panel's width and X
                            snapTarget = {
                                x: other.x,
                                y: otherBottom,
                                width: other.width, // SYNC WIDTH
                                height: myHeight,
                                dockSide: null
                            };
                            // Horizontal indicator line at the boundary
                            indicator = { x: other.x, y: otherBottom - 2, width: other.width, height: 4, isVisible: true };
                            hasSnap = true;
                            // [PARENT-CHILD] I am below (child), other is parent
                            snapCandidateId = other.id;
                            snapAmBelow = true;
                        }
                        // Snap Bottom of dragged to Top of other (I am above → parent)
                        else if (Math.abs(myBottom - other.y) < SNAP_THRESHOLD &&
                            newX < otherRight && myRight > other.x) { // Horizontal overlap check
                            // [WIDTH SYNC] Match the target panel's width and X
                            snapTarget = {
                                x: other.x,
                                y: other.y - myHeight,
                                width: other.width, // SYNC WIDTH
                                height: myHeight,
                                dockSide: null
                            };
                            // Horizontal indicator line at the boundary
                            indicator = { x: other.x, y: other.y - 2, width: other.width, height: 4, isVisible: true };
                            hasSnap = true;
                            // [PARENT-CHILD] I am above (parent), other is child
                            snapCandidateId = other.id;
                            snapAmBelow = false;
                        }

                        if (hasSnap) break;
                    }
                }

                // C. Top Magnet (Independent of Sidebar/Panel snap if not already set)
                // If we haven't snapped side-to-side, we might still snap to top
                if (!hasSnap && isNearTop) {
                    snapTarget.y = APP_HEADER_HEIGHT;
                    hasSnap = true;
                }

                // D. [DROP ZONES on docked panel]:
                //    - 캔버스 방향 가장자리 → 새 컬럼 생성
                //    - 드래그 패널 중심이 타겟 상반부 → Stack-Above
                //    - 드래그 패널 중심이 타겟 하반부 → Stack-Below
                //    - [HIT-TEST FIX] 커서 위치 대신 드래그 패널의 시각적 중심으로 판정.
                //      그랩 오프셋(헤더 좌/중/우 클릭 위치)과 무관하게 일관된 동작 보장.
                if (!hasSnap && dockedPanelsRef?.current) {
                    // 툴바 바인딩 상태 조회 (composite bounding box 계산용)
                    const ts = useToolbarStore.getState();
                    const boundToolbar = ts.toolbarDockedTo
                        ? {
                            panelId: ts.toolbarDockedTo.panelId,
                            side: ts.toolbarDockedTo.side,
                            width: ts.toolbarRenderedWidth,
                            height: ts.toolbarRenderedHeight,
                          }
                        : null;

                    // [HIT-TEST FIX] 드래그 패널의 effective bounding box (자기 toolbar 포함)
                    // newX/newY는 패널 본문 좌상단. 툴바가 바인딩된 경우 시각적 위젯은 더 넓음.
                    let myBoxX = newX;
                    let myBoxY = newY;
                    let myBoxW = myWidth;
                    let myBoxH = myHeight;
                    if (boundToolbar && boundToolbar.panelId === panelId) {
                        if (boundToolbar.side === 'left') {
                            myBoxX = newX - boundToolbar.width;
                            myBoxW = myWidth + boundToolbar.width;
                        } else if (boundToolbar.side === 'right') {
                            myBoxW = myWidth + boundToolbar.width;
                        } else if (boundToolbar.side === 'bottom') {
                            myBoxH = myHeight + boundToolbar.height;
                        }
                    }
                    // 드래그 패널의 시각적 중심점 — 그랩 위치(헤더 좌/중/우)와 무관한 안정적 앵커
                    const myCenterX = myBoxX + myBoxW / 2;
                    const myCenterY = myBoxY + myBoxH / 2;

                    for (const dockedPanel of dockedPanelsRef.current) {
                        // Skip self
                        if (dockedPanel.id === panelId) continue;

                        // [TOOLBAR BIND] 툴바가 이 패널에 바인딩된 경우 hit-test 박스를 툴바 크기만큼 확장.
                        // side === 'left'  : 툴바가 패널 좌측 → boxX 좌측 확장
                        // side === 'right' : 툴바가 패널 우측 → boxW 우측 확장
                        // side === 'bottom': 툴바가 패널 하단 → boxH 하단 확장
                        let boxX = dockedPanel.x;
                        let boxY = dockedPanel.y;
                        let boxW = dockedPanel.width;
                        let boxH = dockedPanel.height;
                        if (boundToolbar && boundToolbar.panelId === dockedPanel.id) {
                            if (boundToolbar.side === 'left') {
                                boxX = dockedPanel.x - boundToolbar.width;
                                boxW = dockedPanel.width + boundToolbar.width;
                            } else if (boundToolbar.side === 'right') {
                                boxW = dockedPanel.width + boundToolbar.width;
                            } else if (boundToolbar.side === 'bottom') {
                                boxH = dockedPanel.height + boundToolbar.height;
                            }
                        }

                        // [HIT-TEST FIX] 드래그 패널 중심이 타겟 합성 박스 안에 있는지 확인
                        const inX = myCenterX >= boxX && myCenterX <= boxX + boxW;
                        const inY = myCenterY >= boxY && myCenterY <= boxY + boxH;
                        if (!inX || !inY) continue;

                        const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
                        const halfHeight = Math.max(MIN_STACK_HEIGHT, availableHeight / 2);
                        // [HIT-TEST FIX] 상/하반부 분할 기준 — 12px zone 대신 중간선으로 판정
                        const midY = boxY + boxH / 2;

                        // [MULTI-COLUMN] 캔버스 쪽 외곽 가장자리 → 새 컬럼 생성
                        // 드래그 패널의 캔버스-측 가장자리가 타겟의 캔버스-측 가장자리에 가까운지 판정
                        const canvasFacingEdgeIsRight = dockedPanel.dockSide === 'left';
                        const canvasEdgeX = canvasFacingEdgeIsRight
                            ? boxX + boxW
                            : boxX;
                        // 드래그 패널의 캔버스 방향 가장자리
                        const myCanvasFacingEdgeX = canvasFacingEdgeIsRight
                            ? myBoxX           // 타겟이 left sidebar → 드래그 패널의 왼쪽
                            : myBoxX + myBoxW; // 타겟이 right sidebar → 드래그 패널의 오른쪽
                        const CANVAS_EDGE_THRESHOLD = 40;
                        const isOnCanvasEdge = Math.abs(myCanvasFacingEdgeX - canvasEdgeX) < CANVAS_EDGE_THRESHOLD
                            && myCenterY >= boxY && myCenterY <= boxY + boxH;

                        if (isOnCanvasEdge) {
                            // [New Column] 수직 파란 라인 indicator
                            const lineX = canvasFacingEdgeIsRight ? canvasEdgeX : canvasEdgeX - 4;
                            snapTarget = {
                                x: lineX,
                                y: dockedPanel.y,
                                width: 4,
                                height: dockedPanel.height,
                                dockSide: dockedPanel.dockSide,
                            };
                            indicator = {
                                x: lineX,
                                y: APP_HEADER_HEIGHT,
                                width: 4,
                                height: window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN,
                                isVisible: true,
                            };
                            (snapTarget as any).newColumnIntoPanelId = dockedPanel.id;
                            hasSnap = true;
                        } else if (myCenterY < midY) {
                            // [Stack-Above] 드래그 패널 중심이 타겟 상반부 — 인디케이터는 합성 박스 너비로 표시
                            snapTarget = {
                                x: dockedPanel.x,
                                y: dockedPanel.y,
                                width: dockedPanel.width,
                                height: halfHeight,
                                dockSide: dockedPanel.dockSide,
                                splitPosition: 'top',
                                targetPanelId: dockedPanel.id,
                            };
                            indicator = {
                                x: boxX,
                                y: boxY - 2,
                                width: boxW,
                                height: 4,
                                isVisible: true,
                            };
                            hasSnap = true;
                        } else {
                            // [Stack-Below] 드래그 패널 중심이 타겟 하반부 (합성 박스 하단 기준 — bottom 툴바 포함)
                            snapTarget = {
                                x: dockedPanel.x,
                                y: dockedPanel.y + halfHeight,
                                width: dockedPanel.width,
                                height: halfHeight,
                                dockSide: dockedPanel.dockSide,
                                splitPosition: 'bottom',
                                targetPanelId: dockedPanel.id,
                            };
                            indicator = {
                                x: boxX,
                                y: boxY + boxH - 2,
                                width: boxW,
                                height: 4,
                                isVisible: true,
                            };
                            hasSnap = true;
                        }

                        if (hasSnap) break;
                    }
                }

                // Update Pending Snap
                if (hasSnap) {
                    pendingSnapRef.current = {
                        ...snapTarget,
                        snapCandidateId,
                        amBelow: snapAmBelow,
                        // newColumnIntoPanelId가 snapTarget에 첨부됐을 수 있음 (D 섹션)
                        newColumnIntoPanelId: (snapTarget as any).newColumnIntoPanelId,
                    };
                }

                // Final State Update for Move (Visual only)
                if (onSnapIndicatorChange) onSnapIndicatorChange(indicator);

                setPanelState(prev => ({
                    ...prev,
                    x: newX, // Free Drag
                    y: newY, // Free Drag
                }));


            } else if (type === 'resize' && resizeDirection) {
                let { x, y, width, height, dockSide } = startState;
                let newWidth = width;
                let newHeight = height;
                let newX = x;
                let newY = y;

                // --- Resize Logic ---
                // [CRITICAL] Docked Resizing Rule:
                // If Docked Left: Only Resize Right Edge (East). X stays 0.
                // If Docked Right: Only Resize Left Edge (West). X changes.

                if (dockSide === 'left') {
                    if (resizeDirection.includes('e')) {
                        newWidth = Math.max(effectiveMinWidth(), Math.min(width + dx, getMaxPanelWidth()));
                        // [STACKING] Sync width with other panel on same dock side
                        if (onWidthChange && newWidth !== width) {
                            onWidthChange(newWidth);
                        }
                    }
                    // [STACKING] Handle south resize for coupled resizing
                    if (resizeDirection.includes('s') && onBoundaryResize) {
                        const intendedHeight = height + dy;
                        const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
                        const otherPanelMinHeight = Math.max(MIN_STACK_HEIGHT, availableHeight - intendedHeight);

                        // Check if there's a stacked panel below
                        if (dockedPanelsRef?.current) {
                            const stackedBelow = dockedPanelsRef.current.find(
                                p => p.id !== panelId && p.dockSide === dockSide && p.y > y
                            );

                            if (stackedBelow) {
                                const minHeight = MIN_STACK_HEIGHT;
                                if (intendedHeight >= minHeight && (availableHeight - intendedHeight) >= minHeight) {
                                    newHeight = intendedHeight;  // setPanelState가 old height로 덮어쓰기 방지
                                    onBoundaryResize(y + intendedHeight);
                                }
                            } else {
                                // No stacked panel, normal resize
                                newHeight = Math.max(getMinPanelHeight(), intendedHeight);
                            }
                        }
                    }
                }
                else if (dockSide === 'right') {
                    if (resizeDirection.includes('w')) {
                        const intendedWidth = width - dx;
                        newWidth = Math.max(effectiveMinWidth(), Math.min(intendedWidth, getMaxPanelWidth()));
                        newX = window.innerWidth - newWidth;
                        // [STACKING] Sync width with other panel on same dock side
                        if (onWidthChange && newWidth !== width) {
                            onWidthChange(newWidth);
                        }
                    }
                    // [STACKING] Handle south resize for coupled resizing
                    if (resizeDirection.includes('s') && onBoundaryResize) {
                        const intendedHeight = height + dy;
                        const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;

                        // Check if there's a stacked panel below
                        if (dockedPanelsRef?.current) {
                            const stackedBelow = dockedPanelsRef.current.find(
                                p => p.id !== panelId && p.dockSide === dockSide && p.y > y
                            );

                            if (stackedBelow) {
                                const minHeight = MIN_STACK_HEIGHT;
                                if (intendedHeight >= minHeight && (availableHeight - intendedHeight) >= minHeight) {
                                    newHeight = intendedHeight;  // setPanelState가 old height로 덮어쓰기 방지
                                    onBoundaryResize(y + intendedHeight);
                                }
                            } else {
                                // No stacked panel, normal resize
                                newHeight = Math.max(getMinPanelHeight(), intendedHeight);
                            }
                        }
                    }
                }
                else {
                    // Floating Resize
                    // Width
                    if (resizeDirection.includes('e')) {
                        newWidth = Math.max(effectiveMinWidth(), Math.min(width + dx, getMaxPanelWidth()));
                        // [PARENT-CHILD] Sync width to snapped child
                        if (onWidthChange && newWidth !== width) onWidthChange(newWidth);
                    } else if (resizeDirection.includes('w')) {
                        const intendedWidth = width - dx;
                        newWidth = Math.max(effectiveMinWidth(), Math.min(intendedWidth, getMaxPanelWidth()));
                        newX = x + (width - newWidth);
                        // [PARENT-CHILD] Sync width to snapped child
                        if (onWidthChange && newWidth !== width) onWidthChange(newWidth);
                    }

                    // Height
                    if (resizeDirection.includes('s')) {
                        newHeight = Math.max(getMinPanelHeight(), height + dy);
                        // [PARENT-CHILD] Move snapped child panel down with bottom edge.
                        // Use incremental delta (not absolute from startState) because
                        // applyDelta/applyHeightDelta accumulate onto current state each event.
                        const totalHeightDelta = newHeight - height;
                        const prevDelta = dragRef.current!.prevSplitterHeightDelta ?? 0;
                        const incrDelta = totalHeightDelta - prevDelta;
                        dragRef.current!.prevSplitterHeightDelta = totalHeightDelta;
                        if (incrDelta !== 0 && onDragDelta) onDragDelta(0, incrDelta);
                        // [INNER SPLITTER] Also notify child to resize inversely (constant group height)
                        if (incrDelta !== 0 && onSplitterResize) onSplitterResize(incrDelta);
                    }
                    if (resizeDirection.includes('n')) {
                        const intendedHeight = height - dy;
                        newHeight = Math.max(getMinPanelHeight(), intendedHeight);
                        newY = y + (height - newHeight);
                    }
                }

                // Constraint Check
                if (newX < 0) newX = 0;
                if (newX + newWidth > window.innerWidth) newWidth = window.innerWidth - newX;

                setPanelState(prev => ({
                    ...prev,
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight
                }));
            }
        };

        const handleMouseUp = () => {
            if (dragRef.current) {
                // [FIX] Capture ref value BEFORE calling setPanelState to avoid race condition.
                // setState callback may run async, and the ref could be cleared before it runs.
                const snapToApply = pendingSnapRef.current;
                // [STACK TRANSITION] Capture and clear group transition payload before setPanelState
                // so the post-setState setTimeout callback sees a consistent snapshot.
                const groupTransition = pendingGroupTransitionRef.current;
                pendingGroupTransitionRef.current = null;

                // Commit Docking
                if (dragRef.current.type === 'move') {

                    setPanelState(prev => {
                        const next = { ...prev };
                        const wasDocked = prev.dockSide !== null;

                        // [MULTI-COLUMN] 새 컬럼 드롭 — 위치 변경 없이 onNewColumnWith 콜백만 호출
                        if (snapToApply?.newColumnIntoPanelId && onNewColumnWith) {
                            setTimeout(() => onNewColumnWith(snapToApply.newColumnIntoPanelId!, panelId), 0);
                            return prev;
                        }

                        // [DECOUPLED LOGIC]
                        // If we have a calculated snap target, Commit it now.
                        if (snapToApply) {
                            next.x = snapToApply.x;
                            next.y = snapToApply.y;
                            next.width = snapToApply.width;
                            next.height = snapToApply.height;
                            next.dockSide = snapToApply.dockSide;

                            // [STACKING] Trigger callback if splitting onto docked panel
                            if (snapToApply.splitPosition && snapToApply.targetPanelId && onStackWith) {
                                const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
                                const halfHeight = Math.max(MIN_STACK_HEIGHT, availableHeight / 2);

                                // Calculate target panel's new position
                                const targetNewHeight = halfHeight;
                                const targetNewY = snapToApply.splitPosition === 'top'
                                    ? APP_HEADER_HEIGHT + halfHeight  // Target moves down
                                    : APP_HEADER_HEIGHT;              // Target stays at top

                                // Call after state update (use setTimeout to avoid state race)
                                setTimeout(() => {
                                    onStackWith(snapToApply.targetPanelId!, snapToApply.splitPosition!, targetNewHeight, targetNewY, panelId);
                                }, 0);
                            }

                            // [STACK TRANSITION] If a sidebar-switch group transition was captured,
                            // fire the callback after setState to let useDockLayout migrate the entire stack.
                            if (groupTransition && onSidebarStackTransition) {
                                setTimeout(() => onSidebarStackTransition(groupTransition), 0);
                            }
                        } else {
                            // No snap logic active. Just a free drop.

                            // Check if we are "Undocking" based on position
                            if (next.dockSide) {
                                if (next.dockSide === 'left' && next.x !== 0) next.dockSide = null;
                                if (next.dockSide === 'right' && next.x !== window.innerWidth - next.width) next.dockSide = null;
                            }

                            // [SIZE RESTORE] If transitioning from Docked -> Floating, restore size
                            if (wasDocked && !next.dockSide && lastFloatingSizeRef.current) {
                                next.width = lastFloatingSizeRef.current.width;
                                next.height = lastFloatingSizeRef.current.height;

                                // [STACKING] Notify that we left the stack
                                if (onStackLeave) {
                                    setTimeout(() => onStackLeave(), 0);
                                }
                            }
                        }

                        // Final Safety Constraints
                        if (next.y < APP_HEADER_HEIGHT) next.y = APP_HEADER_HEIGHT;
                        return next;
                    });
                }

                // [PARENT-CHILD] Fire vertical snap/unsnap callbacks
                // Docking to a sidebar always breaks floating snap groups (even if locked),
                // because the sidebar system takes over position management.
                const isDockingToSidebar = snapToApply != null && snapToApply.dockSide != null;
                if (snapToApply?.snapCandidateId !== undefined && snapToApply.amBelow !== undefined) {
                    onVerticalSnapWithRef.current?.(snapToApply.snapCandidateId, snapToApply.amBelow);
                } else if (isDockingToSidebar || !isVerticallySnappedRef?.current) {
                    // [GROUP LOCK] Fire unsnap when:
                    //   - Docking to sidebar (always breaks floating lock), OR
                    //   - Free drop when not in a locked snap group
                    onVerticalUnsnapRef.current?.();
                }

                dragRef.current = null;
                pendingDockRef.current = null;
                pendingSnapRef.current = null;
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                if (onSnapIndicatorChange) onSnapIndicatorChange(null);
                // [PHOTOSHOP-STYLE DRAG PREVIEW] 드래그 종료 — data-dragging 제거
                const dragEl = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null;
                if (dragEl) dragEl.removeAttribute('data-dragging');
            }
        };

        // [BUG FIX] Cancel drag if mouse leaves the window or window loses focus
        // (e.g., mouse exits Electron frame, OS dialog appears, alt-tab)
        // Without this, the snap indicator stays on screen permanently.
        const handleCancelDrag = () => {
            if (!dragRef.current) return;
            dragRef.current = null;
            pendingDockRef.current = null;
            pendingSnapRef.current = null;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            if (onSnapIndicatorChange) onSnapIndicatorChange(null);
            // [PHOTOSHOP-STYLE DRAG PREVIEW] 캔슬 시에도 data-dragging 제거
            const dragEl = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null;
            if (dragEl) dragEl.removeAttribute('data-dragging');
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseleave', handleCancelDrag);
        window.addEventListener('blur', handleCancelDrag);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseleave', handleCancelDrag);
            window.removeEventListener('blur', handleCancelDrag);
        };
    }, [onSnapIndicatorChange, snapCandidatesRef, onDragDelta, isVerticallySnappedRef, onSplitterResize]); // eslint-disable-line react-hooks/exhaustive-deps

    // 5. Auto-Resize Window Handler
    const prevWinSizeRef = useRef({ w: window.innerWidth, h: window.innerHeight });

    useEffect(() => {
        const handleWindowResize = () => {
            const newWinW = window.innerWidth;
            const newWinH = window.innerHeight;
            const prevWinW = prevWinSizeRef.current.w;
            prevWinSizeRef.current = { w: newWinW, h: newWinH };

            setPanelState(prev => {
                let { x, width, height, dockSide } = prev;

                if (dockSide === 'left') {
                    x = 0;
                    // height는 useDockLayout의 useLayoutEffect가 splitRatio 기반으로 관리
                } else if (dockSide === 'right') {
                    x = newWinW - width;
                    // height는 useDockLayout의 useLayoutEffect가 splitRatio 기반으로 관리
                } else {
                    // Floating: maintain distance from the nearest edge
                    const rightDist = prevWinW - (x + width);
                    const isCloserToRight = rightDist < x;

                    if (isCloserToRight) {
                        x = newWinW - width - rightDist;
                    }
                    // closer to left → x stays the same

                    // Safety clamp
                    x = Math.max(0, Math.min(x, newWinW - width));
                    if (prev.y + height > newWinH) height = Math.max(getMinPanelHeight(), newWinH - prev.y);
                }

                return { ...prev, x, height };
            });
        };

        window.addEventListener('resize', handleWindowResize);
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);

    return {
        panelState,
        setPanelState,
        handleDragStart,
        handleResizeStart,
        toggleCollapse,
        resetPanel,
        resetSizeOnly
    };
};
