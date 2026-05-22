import React, { useRef, useCallback } from 'react';
import { useCanvasStore } from '../../../store/canvasStore';

export interface ObjectTransform {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX?: number;
}

interface TransformControlsProps {
    transform: ObjectTransform;
    onTransform: (updater: (prev: ObjectTransform) => ObjectTransform) => void;
    onTransformEnd?: () => void; // Called when transform interaction ends
    /** Optional: editor-local zoom override. If omitted, reads from canvasStore (canvas context). */
    zoom?: number;
    isInteractive?: boolean;
    isSelected?: boolean;
    showRotation?: boolean;
    children?: React.ReactNode;
    onMouseDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
    onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    className?: string;
    style?: React.CSSProperties;
}

const handles = ['nw', 'ne', 'sw', 'se'];

const getCursorForHandle = (type: string, rotation: number) => {
    const cursors = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
    let initialIndex = 0;

    switch (type) {
        case 'ne': case 'sw': initialIndex = 1; break;
        case 'se': case 'nw': initialIndex = 3; break;
    }

    const rotationSteps = Math.round(rotation / 45);
    const finalIndex = (initialIndex + rotationSteps) % 4;
    const normalizedIndex = finalIndex < 0 ? finalIndex + 4 : finalIndex;

    return cursors[normalizedIndex];
};

export const TransformControls: React.FC<TransformControlsProps> = ({
    transform,
    onTransform,
    onTransformEnd,
    zoom: zoomProp,
    isInteractive = true,
    isSelected = false,
    showRotation = true,
    children,
    onMouseDown: onContainerMouseDown,
    onContextMenu,
    onDoubleClick,
    className,
    style
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // zoomProp is used by editor context (local zoom). canvasZoom used by canvas context.
    // [PERF] Only rendered in group edit mode — canvas zoom subscription here is acceptable.
    const canvasZoom = useCanvasStore(state => state.zoom);
    const zoom = zoomProp !== undefined ? zoomProp : canvasZoom;
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;

    const interactionRef = useRef<{
        type: 'move' | 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'rotate';
        startX: number;
        startY: number;
        startTransform: ObjectTransform;
        objectCenterX: number;
        objectCenterY: number;
    } | null>(null);

    const handleInteraction = useCallback((e: React.PointerEvent<HTMLDivElement>, type: typeof interactionRef.current['type']) => {
        if (!isInteractive) return;
        e.preventDefault();
        e.stopPropagation();

        if (type === 'move' && onContainerMouseDown) {
            onContainerMouseDown(e);
        }

        if (!containerRef.current) return;

        // Capture zoom at interaction start — stays constant for the entire drag
        const currentZoom = zoomRef.current;
        const parentRect = containerRef.current.parentElement!.getBoundingClientRect();
        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        const objectCenterX = centerX * currentZoom + parentRect.left;
        const objectCenterY = centerY * currentZoom + parentRect.top;

        interactionRef.current = {
            type,
            startX: e.clientX,
            startY: e.clientY,
            startTransform: transform,
            objectCenterX,
            objectCenterY,
        };

        const handleMouseMove = (moveEvent: PointerEvent) => {
            if (!interactionRef.current) return;
            const { type, startX, startY, startTransform, objectCenterX, objectCenterY } = interactionRef.current;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            onTransform(prev => {
                const rad = (startTransform.rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                switch (type) {
                    case 'move':
                        return { ...prev, x: startTransform.x + dx / currentZoom, y: startTransform.y + dy / currentZoom };

                    case 'rotate': {
                        const startAngle = Math.atan2(startY - objectCenterY, startX - objectCenterX);
                        const currentAngle = Math.atan2(moveEvent.clientY - objectCenterY, moveEvent.clientX - objectCenterX);
                        const angleDiff = currentAngle - startAngle;
                        return { ...prev, rotation: startTransform.rotation + (angleDiff * 180 / Math.PI) };
                    }

                    default: {
                        const dx_canvas = dx / currentZoom;
                        const dy_canvas = dy / currentZoom;

                        const dw_x = dx_canvas * cos + dy_canvas * sin;
                        const dh_y = -dx_canvas * sin + dy_canvas * cos;

                        let dw = 0; let dh = 0;

                        if (type.includes('e')) dw = dw_x;
                        if (type.includes('w')) dw = -dw_x;
                        if (type.includes('s')) dh = dh_y;
                        if (type.includes('n')) dh = -dh_y;

                        if ((type === 'nw' || type === 'ne' || type === 'sw' || type === 'se')) {
                            const aspectRatio = startTransform.width / startTransform.height;
                            if (!isFinite(aspectRatio) || aspectRatio === 0) return prev;

                            if (Math.abs(dw_x) * aspectRatio > Math.abs(dh_y)) {
                                dh = dw / aspectRatio;
                            } else {
                                dw = dh * aspectRatio;
                            }
                        }

                        let newWidth = Math.max(20, startTransform.width + dw);
                        let newHeight = Math.max(20, startTransform.height + dh);

                        let anchorX_local = 0;
                        let anchorY_local = 0;

                        if (type.includes('e')) anchorX_local = -startTransform.width / 2;
                        else anchorX_local = startTransform.width / 2;

                        if (type.includes('s')) anchorY_local = -startTransform.height / 2;
                        else anchorY_local = startTransform.height / 2;

                        const startCenterX = startTransform.x + startTransform.width / 2;
                        const startCenterY = startTransform.y + startTransform.height / 2;

                        const anchorX_world = startCenterX + (anchorX_local * cos - anchorY_local * sin);
                        const anchorY_world = startCenterY + (anchorX_local * sin + anchorY_local * cos);

                        let newAnchorX_local = 0;
                        let newAnchorY_local = 0;

                        if (type.includes('e')) newAnchorX_local = -newWidth / 2;
                        else newAnchorX_local = newWidth / 2;

                        if (type.includes('s')) newAnchorY_local = -newHeight / 2;
                        else newAnchorY_local = newHeight / 2;

                        const newCenterX = anchorX_world - (newAnchorX_local * cos - newAnchorY_local * sin);
                        const newCenterY = anchorY_world - (newAnchorX_local * sin + newAnchorY_local * cos);

                        return {
                            ...prev,
                            width: newWidth,
                            height: newHeight,
                            x: newCenterX - newWidth / 2,
                            y: newCenterY - newHeight / 2,
                        };
                    }
                }
            });
        };

        const handleMouseUp = () => {
            interactionRef.current = null;
            window.removeEventListener('pointermove', handleMouseMove);
            window.removeEventListener('pointerup', handleMouseUp);
            // Save history after transform interaction ends
            useCanvasStore.getState().saveHistory();
            // Call external callback if provided (for UnifiedEditorModal)
            if (onTransformEnd) onTransformEnd();
        };

        window.addEventListener('pointermove', handleMouseMove);
        window.addEventListener('pointerup', handleMouseUp);
    }, [transform, onTransform, isInteractive, onContainerMouseDown]);

    const handleSize = 12 / zoom;
    const rotationHandleOffset = 20 / zoom;

    const handleStyle = (type: string) => {
        const style: React.CSSProperties = {
            width: handleSize,
            height: handleSize,
            transform: 'translate(-50%, -50%)'
        };
        if (type.includes('n')) style.top = '0%';
        if (type.includes('s')) style.top = '100%';
        if (type.includes('w')) style.left = '0%';
        if (type.includes('e')) style.left = '100%';
        if (type === 'n' || type === 's') style.left = '50%';
        if (type === 'w' || type === 'e') style.top = '50%';
        return style;
    };

    return (
        <div
            ref={containerRef}
            className={`absolute ${isSelected ? 'border-2 border-yellow-400' : 'border border-transparent'} pointer-events-auto ${className || ''}`}
            style={{
                left: transform.x,
                top: transform.y,
                width: transform.width,
                height: transform.height,
                transform: `rotate(${transform.rotation}deg)`,
                cursor: isInteractive ? 'move' : 'default',
                willChange: 'transform',
                ...style
            }}
            onPointerDown={(e) => handleInteraction(e, 'move')}
            onContextMenu={onContextMenu}
            onDoubleClick={onDoubleClick}
        >
            {children}

            {isSelected && isInteractive && (
                <>
                    {showRotation && (
                        <>
                            <div
                                className="absolute w-px bg-white pointer-events-none"
                                style={{
                                    height: rotationHandleOffset,
                                    top: -rotationHandleOffset,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                }}
                            />
                            <div
                                className="absolute bg-white border-2 border-neutral-800 rounded-full cursor-alias"
                                style={{
                                    width: handleSize,
                                    height: handleSize,
                                    top: -rotationHandleOffset - (handleSize / 2),
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                }}
                                onPointerDown={(e) => handleInteraction(e, 'rotate')}
                            />
                        </>
                    )}

                    {handles.map((type) => (
                        <div
                            key={type}
                            className="absolute bg-white border-2 border-neutral-800 rounded-full"
                            style={{
                                ...handleStyle(type),
                                cursor: getCursorForHandle(type, transform.rotation),
                            }}
                            onPointerDown={(e) => handleInteraction(e, type as any)}
                        />
                    ))}
                </>
            )}
        </div>
    );
};
