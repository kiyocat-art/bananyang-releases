import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SnapIndicatorState } from '../components/SnapIndicator';

const PANEL_HEADER_HEIGHT = 48; // Updated to match the new 48px header
const MIN_PANEL_WIDTH = 300; // Updated according to requirements
const MIN_PANEL_HEIGHT = 350;
const SNAP_THRESHOLD = 20;

type PanelState = {
    x: number;
    y: number;
    width: number;
    height: number;
    isCollapsed: boolean;
    dockSide: 'left' | 'right' | null;
};

type SnapCandidate = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export const useDraggablePanel = (
    storageKey: string,
    getDefaultState: () => PanelState,
    snapCandidatesRef?: React.MutableRefObject<SnapCandidate[]>,
    setSnapIndicator?: (state: SnapIndicatorState | null) => void
) => {
    const [panelState, setPanelState] = useState<PanelState>(() => {
        try {
            const savedState = localStorage.getItem(storageKey);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                if (typeof parsed === 'object' && parsed !== null && 'x' in parsed && 'width' in parsed) {
                    return { ...parsed, dockSide: parsed.dockSide || null };
                }
            }
        } catch (e) {
            console.error(`Failed to load panel state for ${storageKey} from localStorage`, e);
        }
        return getDefaultState();
    });

    const dragInteractionRef = useRef<{ type: 'drag' | 'resize', direction?: string, startX: number, startY: number, startState: typeof panelState } | null>(null);
    const pendingDockRef = useRef<{ height?: number; dockSide?: 'left' | 'right' | null } | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(panelState));
        } catch (e) {
            console.error(`Failed to save panel state for ${storageKey} to localStorage`, e);
        }
    }, [panelState, storageKey]);


    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        // When starting drag, if docked, we might want to undock immediately or keep docked logic until pulled away.
        // For smoother UX, let's treat it as free floating start, and it will re-snap if close.
        dragInteractionRef.current = { type: 'drag', startX: e.clientX, startY: e.clientY, startState: panelState };
        document.body.style.userSelect = 'none';
    }, [panelState]);

    const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
        e.preventDefault();
        e.stopPropagation();
        dragInteractionRef.current = { type: 'resize', direction, startX: e.clientX, startY: e.clientY, startState: panelState };
        document.body.style.userSelect = 'none';
    }, [panelState]);

    const toggleCollapse = useCallback(() => {
        setPanelState(p => ({ ...p, isCollapsed: !p.isCollapsed }));
    }, []);

    const resetPanel = useCallback(() => {
        setPanelState(getDefaultState());
    }, [getDefaultState]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragInteractionRef.current) return;
            const { type, startX, startY, startState, direction } = dragInteractionRef.current;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (type === 'drag') {
                let newX = startState.x + dx;
                let newY = startState.y + dy;

                // --- Magnetic Snapping Logic ---
                const myWidth = startState.width;
                const myHeight = startState.isCollapsed ? PANEL_HEADER_HEIGHT : startState.height;
                const myRight = newX + myWidth;
                const myBottom = newY + myHeight;

                // Reset Docking State
                pendingDockRef.current = null;
                let currentIndicator: SnapIndicatorState | null = null;
                let newDockSide: 'left' | 'right' | null = null;

                // 1. Snap to Screen Edges
                if (Math.abs(newX) < SNAP_THRESHOLD) {
                    newX = 0;
                    // Dock Cleanly Left
                    if (setSnapIndicator) {
                        currentIndicator = { x: 0, y: PANEL_HEADER_HEIGHT, width: 4, height: window.innerHeight - PANEL_HEADER_HEIGHT, isVisible: true };
                        pendingDockRef.current = { height: window.innerHeight - PANEL_HEADER_HEIGHT, dockSide: 'left' };
                    }
                    newDockSide = 'left';
                }

                // Only snap Y if not docking or if snapping to top/bottom edge strictly
                if (Math.abs(newY - PANEL_HEADER_HEIGHT) < SNAP_THRESHOLD) newY = PANEL_HEADER_HEIGHT; // Snap to Top Header Offset

                if (Math.abs(window.innerWidth - myRight) < SNAP_THRESHOLD) {
                    newX = window.innerWidth - myWidth;
                    // Dock Cleanly Right
                    if (setSnapIndicator) {
                        currentIndicator = { x: window.innerWidth - 4, y: PANEL_HEADER_HEIGHT, width: 4, height: window.innerHeight - PANEL_HEADER_HEIGHT, isVisible: true };
                        pendingDockRef.current = { height: window.innerHeight - PANEL_HEADER_HEIGHT, dockSide: 'right' };
                    }
                    newDockSide = 'right';
                }
                if (Math.abs(window.innerHeight - myBottom) < SNAP_THRESHOLD) newY = window.innerHeight - myHeight;

                // If dragged away significantly from edge, clear dockSide
                if (startState.dockSide === 'left' && newX > SNAP_THRESHOLD) newDockSide = null;
                if (startState.dockSide === 'right' && Math.abs(window.innerWidth - (newX + myWidth)) > SNAP_THRESHOLD) newDockSide = null;


                // 2. Snap to Candidates (Other Panels)
                if (snapCandidatesRef && snapCandidatesRef.current) {
                    // Force Panel-to-Panel Alignment if close
                    for (const other of snapCandidatesRef.current) {
                        const otherRight = other.x + other.width;
                        const otherBottom = other.y + (other.height || PANEL_HEADER_HEIGHT);
                        const otherHeight = other.height || PANEL_HEADER_HEIGHT;

                        // Horizontal Snapping
                        if (Math.abs(myRight - other.x) < SNAP_THRESHOLD) {
                            newX = other.x - myWidth;
                            // Force Y Alignment
                            if (Math.abs(newY - other.y) < SNAP_THRESHOLD * 2) newY = other.y;

                            if (setSnapIndicator) {
                                currentIndicator = { x: other.x - 2, y: other.y, width: 4, height: otherHeight, isVisible: true };
                                pendingDockRef.current = { height: otherHeight }; // Match height
                            }
                        }
                        if (Math.abs(newX - otherRight) < SNAP_THRESHOLD) {
                            newX = otherRight;
                            // Force Y Alignment
                            if (Math.abs(newY - other.y) < SNAP_THRESHOLD * 2) newY = other.y;

                            if (setSnapIndicator) {
                                currentIndicator = { x: otherRight - 2, y: other.y, width: 4, height: otherHeight, isVisible: true };
                                pendingDockRef.current = { height: otherHeight };
                            }
                        }
                        // Alignments
                        if (Math.abs(newX - other.x) < SNAP_THRESHOLD) newX = other.x;
                        if (Math.abs(myRight - otherRight) < SNAP_THRESHOLD) newX = otherRight - myWidth;

                        // Vertical Snapping
                        if (Math.abs(newY - other.y) < SNAP_THRESHOLD) newY = other.y;
                        if (Math.abs(myBottom - otherBottom) < SNAP_THRESHOLD) newY = otherBottom - myHeight;
                        if (Math.abs(myBottom - other.y) < SNAP_THRESHOLD) newY = other.y - myHeight;
                    }
                }

                if (setSnapIndicator) {
                    setSnapIndicator(currentIndicator);
                }

                // Final clamp
                const clampedX = Math.max(-myWidth + 20, Math.min(newX, window.innerWidth - 20));
                const clampedY = Math.max(PANEL_HEADER_HEIGHT, Math.min(newY, window.innerHeight - PANEL_HEADER_HEIGHT));

                setPanelState(prev => ({
                    ...prev,
                    x: clampedX,
                    y: clampedY,
                    // If we are actively docking/snapping to edge (newDockSide set), update dockSide immediately? 
                    // No, typically updated on drop. But we can update if it affects rendering (border radius).
                    // Ideally, 'dockSide' state change should happen on drop to avoid flickering.
                }));

                // Store potential dock side for mouse up
                if (newDockSide) {
                    // We already set this in pendingDockRef if setSnapIndicator was called, 
                    // but let's ensure we track it even if indicator logic is separate.
                    if (!pendingDockRef.current) pendingDockRef.current = {};
                    pendingDockRef.current.dockSide = newDockSide;
                } else {
                    if (pendingDockRef.current && pendingDockRef.current.dockSide) {
                        pendingDockRef.current.dockSide = null;
                    }
                }

            } else if (type === 'resize' && direction) {
                let { x, y, width, height } = startState;
                const { dockSide } = startState;
                height = Math.max(MIN_PANEL_HEIGHT, startState.height + dy);

                // Docked Interaction: 
                // Left Dock -> Resizing East only affects width. X stays 0.
                // Right Dock -> Resizing West affects width and X.

                if (dockSide === 'left') {
                    if (direction.includes('e')) {
                        width = Math.max(MIN_PANEL_WIDTH, Math.min(startState.width + dx, window.innerWidth * 0.5));
                    }
                } else if (dockSide === 'right') {
                    if (direction.includes('w')) {
                        const potentialWidth = startState.width - dx;
                        width = Math.max(MIN_PANEL_WIDTH, Math.min(potentialWidth, window.innerWidth * 0.5));
                        x = window.innerWidth - width;
                    }
                } else {
                    // Normal Resize
                    if (direction.includes('e')) {
                        width = Math.max(MIN_PANEL_WIDTH, startState.width + dx);
                    }
                    if (direction.includes('w')) {
                        const newWidth = startState.width - dx;
                        if (newWidth < MIN_PANEL_WIDTH) {
                            width = MIN_PANEL_WIDTH;
                            x = startState.x + (startState.width - MIN_PANEL_WIDTH);
                        } else {
                            width = newWidth;
                            x = startState.x + dx;
                        }
                    }
                    height = Math.min(height, window.innerHeight - y);
                }

                setPanelState(prev => ({ ...prev, x, width, height }));
            }
        };

        const handleMouseUp = () => {
            if (dragInteractionRef.current?.type === 'drag') {
                // Apply Docking Logic
                if (pendingDockRef.current) {
                    setPanelState(prev => {
                        const newState = { ...prev };
                        if (pendingDockRef.current?.height) newState.height = pendingDockRef.current.height;
                        if (pendingDockRef.current?.dockSide !== undefined) newState.dockSide = pendingDockRef.current.dockSide;

                        // If undocking (explicitly null), ensure we reset.
                        // But if pendingDockRef.dockSide is undefined (not set during drag), it means we dragged away freely?
                        // The logic above sets dockSide to null if moved away.

                        return newState;
                    });
                } else {
                    // If no pending dock, checks if we should undock
                    setPanelState(prev => {
                        // If we dragged far from edge, clear dockSide
                        const isAtLeft = Math.abs(prev.x) < SNAP_THRESHOLD;
                        const isAtRight = Math.abs(window.innerWidth - (prev.x + prev.width)) < SNAP_THRESHOLD;

                        // If previously docked but now moved away, undock
                        if (prev.dockSide === 'left' && !isAtLeft) return { ...prev, dockSide: null };
                        if (prev.dockSide === 'right' && !isAtRight) return { ...prev, dockSide: null };

                        return prev;
                    });
                }
            }

            dragInteractionRef.current = null;
            document.body.style.userSelect = '';
            if (setSnapIndicator) setSnapIndicator(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Responsive Resize Effect
    useEffect(() => {
        const handleResize = () => {
            setPanelState(prev => {
                let { x, y, width, height, dockSide } = prev;

                // If docked, stay docked
                if (dockSide === 'left') {
                    x = 0;
                    height = window.innerHeight - PANEL_HEADER_HEIGHT;
                } else if (dockSide === 'right') {
                    x = window.innerWidth - width;
                    height = window.innerHeight - PANEL_HEADER_HEIGHT;
                } else {
                    // Constrain floating
                    x = Math.max(0, Math.min(x, window.innerWidth - width));
                    y = Math.max(PANEL_HEADER_HEIGHT, Math.min(y, window.innerHeight - 40));
                }

                return { ...prev, x, y, width, height };
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return { panelState, setPanelState, handleDragStart, handleResizeStart, toggleCollapse, resetPanel };
};

