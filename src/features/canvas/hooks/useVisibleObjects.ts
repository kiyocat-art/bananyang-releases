import { useMemo, useState, useEffect } from 'react';
import { BoardImage, BoardGroup } from '../../../types';
import { useCanvasStore } from '../../../store/canvasStore';

interface UseVisibleObjectsProps {
    boardImages: BoardImage[];
    boardGroups: BoardGroup[];
    canvasRect: { width: number, height: number } | null;
}

// Buffer: 3x viewport in total to prevent pop-in during fast flick panning.
// [FIX FLICK] Increased from 2.0 to 3.0 for smooth inertial momentum.
const BUFFER_MULTIPLIER = 3.0;

export const useVisibleObjects = ({ boardImages, boardGroups, canvasRect }: UseVisibleObjectsProps) => {
    // Track pan/zoom with 50ms debounce — PixiJS handles real-time visual rendering,
    // React DOM is only the hit-test layer so slight lag is acceptable and saves re-renders.
    const [viewport, setViewport] = useState(() => {
        const { pan, zoom } = useCanvasStore.getState();
        return { pan, zoom };
    });

    useEffect(() => {
        // [FIX FLICK] Use requestAnimationFrame instead of 50ms setTimeout.
        // This ensures DOM hit-test elements update within 1 frame (~16ms) of pan/zoom changes,
        // preventing image pop-in/pop-out during fast flick panning.
        let rafId: number | null = null;

        const unsubscribe = useCanvasStore.subscribe((state, prev) => {
            if (state.pan === prev.pan && state.zoom === prev.zoom) return;
            if (rafId !== null) return; // Already scheduled for this frame
            rafId = requestAnimationFrame(() => {
                const { pan, zoom } = useCanvasStore.getState();
                setViewport({ pan, zoom });
                rafId = null;
            });
        });

        return () => {
            unsubscribe();
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, []);

    // Always include selected images so drag/interaction hit areas remain mounted
    const selectedImageIds = useCanvasStore(state => state.selectedImageIds);

    const visibleObjects = useMemo(() => {
        // Without canvas dimensions we cannot cull — render everything
        if (!canvasRect) {
            return { visibleImages: boardImages, visibleGroups: boardGroups };
        }

        const { pan, zoom } = viewport;
        const viewW = canvasRect.width / zoom;
        const viewH = canvasRect.height / zoom;

        // World-space bounding rect including buffer
        const bufX = viewW * (BUFFER_MULTIPLIER - 1) / 2;
        const bufY = viewH * (BUFFER_MULTIPLIER - 1) / 2;
        const minX = -pan.x / zoom - bufX;
        const minY = -pan.y / zoom - bufY;
        const maxX = minX + viewW + bufX * 2;
        const maxY = minY + viewH + bufY * 2;

        const visibleImages = boardImages.filter(img =>
            // Always include selected images (drag/interaction safety)
            selectedImageIds.has(img.id) ||
            // AABB intersection with buffered viewport
            (img.x < maxX && img.x + img.width > minX &&
             img.y < maxY && img.y + img.height > minY)
        );

        const visibleGroups = boardGroups.filter(g =>
            g.x < maxX && g.x + g.width > minX &&
            g.y < maxY && g.y + g.height > minY
        );

        return { visibleImages, visibleGroups };
    }, [boardImages, boardGroups, canvasRect, viewport, selectedImageIds]);

    return visibleObjects;
};
