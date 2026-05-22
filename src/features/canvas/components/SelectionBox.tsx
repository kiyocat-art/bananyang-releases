import React, { useRef } from 'react';
import { Z_INDEX } from '../../../constants/zIndex';
import { useCanvasStore } from '../../../store/canvasStore';

export const SelectionBox: React.FC<{
    bounds: { x: number; y: number; width: number; height: number; };
}> = ({ bounds }) => {
    const zoom = useCanvasStore(state => state.zoom);
    const interactionRef = useRef<{
        startX: number;
        startY: number;
        initialBounds: typeof bounds;
        initialGeometries: {
            images: Map<string, { x: number; y: number; width: number; height: number }>;
            groups: Map<string, { x: number; y: number; width: number; height: number }>;
        };
    } | null>(null);

    const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: 'nw' | 'ne' | 'sw' | 'se') => {
        e.preventDefault();
        e.stopPropagation();

        const { boardImages, boardGroups, selectedImageIds, selectedGroupIds } = useCanvasStore.getState();

        const geometries = {
            images: new Map<string, { x: number; y: number; width: number; height: number }>(),
            groups: new Map<string, { x: number; y: number; width: number; height: number }>(),
        };

        const imageIdsInSelectedGroups = new Set(
            boardGroups.filter(g => selectedGroupIds.has(g.id)).flatMap(g => g.imageIds)
        );

        boardImages.forEach(img => {
            if (selectedImageIds.has(img.id) || imageIdsInSelectedGroups.has(img.id)) {
                geometries.images.set(img.id, { x: img.x, y: img.y, width: img.width, height: img.height });
            }
        });

        boardGroups.forEach(group => {
            if (selectedGroupIds.has(group.id)) {
                geometries.groups.set(group.id, { x: group.x, y: group.y, width: group.width, height: group.height });
            }
        });

        // Determine anchor point based on handle
        let anchorX = bounds.x;
        let anchorY = bounds.y;
        if (handle === 'nw') { anchorX = bounds.x + bounds.width; anchorY = bounds.y + bounds.height; }
        if (handle === 'ne') { anchorX = bounds.x; anchorY = bounds.y + bounds.height; }
        if (handle === 'sw') { anchorX = bounds.x + bounds.width; anchorY = bounds.y; }
        if (handle === 'se') { anchorX = bounds.x; anchorY = bounds.y; }

        interactionRef.current = { startX: e.clientX, startY: e.clientY, initialBounds: bounds, initialGeometries: geometries };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!interactionRef.current) return;

            const screenDx = moveEvent.clientX - interactionRef.current.startX;
            const screenDy = moveEvent.clientY - interactionRef.current.startY;
            const { initialBounds, initialGeometries } = interactionRef.current;

            // Calculate scale based on handle direction
            let scale = 1;
            const dx = screenDx / zoom;
            const dy = screenDy / zoom;

            if (handle === 'se') {
                scale = (initialBounds.width + dx) / initialBounds.width;
            } else if (handle === 'sw') {
                scale = (initialBounds.width - dx) / initialBounds.width;
            } else if (handle === 'ne') {
                scale = (initialBounds.width + dx) / initialBounds.width;
            } else if (handle === 'nw') {
                scale = (initialBounds.width - dx) / initialBounds.width;
            }

            if (!isFinite(scale) || scale <= 0.1) return;

            useCanvasStore.setState(state => {
                const newImages = state.boardImages.map(img => {
                    const initialGeo = initialGeometries.images.get(img.id);
                    if (initialGeo) {
                        return {
                            ...img,
                            x: anchorX + (initialGeo.x - anchorX) * scale,
                            y: anchorY + (initialGeo.y - anchorY) * scale,
                            width: initialGeo.width * scale,
                            height: initialGeo.height * scale,
                        };
                    }
                    return img;
                });
                const newGroups = state.boardGroups.map(group => {
                    const initialGeo = initialGeometries.groups.get(group.id);
                    if (initialGeo) {
                        return {
                            ...group,
                            x: anchorX + (initialGeo.x - anchorX) * scale,
                            y: anchorY + (initialGeo.y - anchorY) * scale,
                            width: initialGeo.width * scale,
                            height: initialGeo.height * scale,
                        };
                    }
                    return group;
                });
                return { boardImages: newImages, boardGroups: newGroups };
            });
        };

        const handleMouseUp = () => {
            interactionRef.current = null;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handles: ('nw' | 'ne' | 'sw' | 'se')[] = ['nw', 'ne', 'sw', 'se'];

    return (
        <div
            className="absolute pointer-events-none"
            style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, zIndex: Z_INDEX.DROPDOWN }}
        >
            <div className="w-full h-full border-2 border-dashed border-white" style={{ borderWidth: `${2 / zoom}px` }} />

            {handles.map(handle => {
                let cursor = 'nwse-resize';
                if (handle === 'ne' || handle === 'sw') cursor = 'nesw-resize';

                let style: React.CSSProperties = {
                    width: 12 / zoom,
                    height: 12 / zoom,
                    transform: 'translate(-50%, -50%)',
                    position: 'absolute',
                };

                if (handle.includes('n')) style.top = 0;
                if (handle.includes('s')) style.top = '100%';
                if (handle.includes('w')) style.left = 0;
                if (handle.includes('e')) style.left = '100%';

                return (
                    <div
                        key={handle}
                        className="bg-white border-2 border-zinc-800 rounded-full pointer-events-auto"
                        style={{
                            ...style,
                            cursor
                        }}
                        onMouseDown={(e) => handleResizeMouseDown(e, handle)}
                    />
                );
            })}
        </div>
    );
};

