import React, { useState, useRef, useCallback } from 'react';
import { LightSource } from '../../../../types';

interface RelightingOverlayProps {
    lightSources: LightSource[];
    selectedLightId: string | null;
    imageSize: { width: number; height: number };
    zoom: number;
    pan: { x: number; y: number };
    onSelectLight: (id: string) => void;
    onUpdateLight: (id: string, updates: Partial<LightSource>) => void;
}

type DragType = 'position' | 'direction';

export const RelightingOverlay: React.FC<RelightingOverlayProps> = ({
    lightSources,
    selectedLightId,
    imageSize,
    zoom,
    pan,
    onSelectLight,
    onUpdateLight
}) => {
    const [draggingState, setDraggingState] = useState<{ lightId: string; type: DragType; initialAngle?: number } | null>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const handlePositionMouseDown = (e: React.MouseEvent, lightId: string) => {
        e.stopPropagation();
        onSelectLight(lightId);
        setDraggingState({ lightId, type: 'position' });
        dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleDirectionMouseDown = (e: React.MouseEvent, lightId: string) => {
        e.stopPropagation();
        onSelectLight(lightId);

        const light = lightSources.find(l => l.id === lightId);
        if (!light) return;

        // Store the initial angle when starting to drag
        const initialAngle = light.direction ?? 0;
        setDraggingState({ lightId, type: 'direction', initialAngle });
        dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!draggingState || !dragStartRef.current) return;

        const light = lightSources.find(l => l.id === draggingState.lightId);
        if (!light) return;

        if (draggingState.type === 'position') {
            const dx = (e.clientX - dragStartRef.current.x) / zoom;
            const dy = (e.clientY - dragStartRef.current.y) / zoom;

            const newX = Math.max(0, Math.min(1, light.position.x + dx / imageSize.width));
            const newY = Math.max(0, Math.min(1, light.position.y + dy / imageSize.height));

            onUpdateLight(draggingState.lightId, {
                position: { x: newX, y: newY }
            });

            dragStartRef.current = { x: e.clientX, y: e.clientY };
        } else if (draggingState.type === 'direction') {
            // Calculate the angle from light center to current mouse position
            const lightX = light.position.x * imageSize.width;
            const lightY = light.position.y * imageSize.height;

            // Get viewport rect to calculate mouse position relative to viewport
            const viewportRect = overlayRef.current?.getBoundingClientRect();
            if (!viewportRect) return;

            // Calculate current mouse position in image coordinates
            // Note: viewportRect.left already includes pan.x because the overlay is transformed
            // So we just subtract rect.left from clientX to get position relative to the transformed element origin
            // Then divide by zoom to get back to image coordinate space
            const currentMouseX = (e.clientX - viewportRect.left) / zoom;
            const currentMouseY = (e.clientY - viewportRect.top) / zoom;

            // Calculate the angle from light center to current mouse position
            const deltaX = currentMouseX - lightX;
            const deltaY = currentMouseY - lightY;
            const currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

            onUpdateLight(draggingState.lightId, {
                direction: Math.round(currentAngle)
            });
        }
    }, [draggingState, lightSources, imageSize, zoom, pan, onUpdateLight]);

    const handleMouseUp = useCallback(() => {
        setDraggingState(null);
        dragStartRef.current = null;
    }, []);

    React.useEffect(() => {
        if (draggingState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggingState, handleMouseMove, handleMouseUp]);

    return (
        <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none"
            style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0'
            }}
        >
            {lightSources.map((light) => {
                const x = light.position.x * imageSize.width;
                const y = light.position.y * imageSize.height;
                const isSelected = light.id === selectedLightId;
                const hasDirection = light.type === 'direct' || light.type === 'sun';

                // Calculate intensity ring size (scale based on intensity) - 3x larger for better visibility
                const intensityScale = 1 + (light.intensity / 100) * 8; // 1x to 9x scale (3x larger than before)
                const ringSize = 40 * intensityScale;

                // Direction line length - longer for better usability
                const directionLineLength = ringSize + 60;

                return (
                    <div
                        key={light.id}
                        className="absolute"
                        style={{
                            left: x,
                            top: y,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none'
                        }}
                    >
                        {/* Intensity Ring */}
                        <div
                            className="absolute rounded-full border-2 border-white/20 transition-all duration-200"
                            style={{
                                width: `${ringSize}px`,
                                height: `${ringSize}px`,
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                boxShadow: `0 0 ${ringSize / 4}px ${light.color}40`
                            }}
                        />

                        {/* Outer Glow Ring (for selected light) */}
                        {isSelected && (
                            <div
                                className="absolute rounded-full transition-all duration-200"
                                style={{
                                    width: `${ringSize + 20}px`,
                                    height: `${ringSize + 20}px`,
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    border: `2px solid ${light.color}60`,
                                    boxShadow: `0 0 20px ${light.color}80`
                                }}
                            />
                        )}

                        {/* Direction Line (for directional lights) */}
                        {hasDirection && light.direction !== undefined && (
                            <div
                                className="absolute"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transform: `translate(-50%, -50%) rotate(${light.direction}deg)`,
                                    transformOrigin: 'center center',
                                    pointerEvents: 'none'
                                }}
                            >
                                <div
                                    className="relative h-0.5 bg-white/60"
                                    style={{
                                        width: `${directionLineLength}px`,
                                        marginLeft: '0'
                                    }}
                                />

                                {/* Direction Handle (draggable) - always visible */}
                                <div
                                    className="absolute top-1/2 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                                    style={{
                                        left: `${directionLineLength}px`,
                                        transform: 'translate(-50%, -50%)',
                                        pointerEvents: 'auto'
                                    }}
                                    onMouseDown={(e) => handleDirectionMouseDown(e, light.id)}
                                >
                                    <div className="w-4 h-4 rounded-full bg-white border-2 border-zinc-800 shadow-lg" />
                                </div>
                            </div>
                        )}

                        {/* Light Center Handle */}
                        <div
                            className="absolute left-1/2 top-1/2 pointer-events-auto cursor-move"
                            style={{
                                transform: 'translate(-50%, -50%)'
                            }}
                            onMouseDown={(e) => handlePositionMouseDown(e, light.id)}
                        >
                            <div
                                className={`relative flex items-center justify-center transition-all ${isSelected ? 'w-12 h-12' : 'w-8 h-8'
                                    }`}
                            >
                                {/* Outer Glow */}
                                <div
                                    className="absolute inset-0 rounded-full opacity-40 blur-md"
                                    style={{ backgroundColor: light.color }}
                                />

                                {/* Inner Circle */}
                                <div
                                    className={`relative rounded-full border-2 ${isSelected ? 'border-white w-8 h-8' : 'border-white/60 w-6 h-6'
                                        }`}
                                    style={{ backgroundColor: light.color }}
                                />
                            </div>
                        </div>

                        {/* Light Type Label */}
                        {isSelected && (
                            <div
                                className="absolute whitespace-nowrap pointer-events-none"
                                style={{
                                    left: '50%',
                                    top: `${ringSize / 2 + 20}px`,
                                    transform: 'translateX(-50%)'
                                }}
                            >
                                <div className="px-2 py-1 bg-black/80 rounded text-xs text-white">
                                    {light.type.toUpperCase()} - {light.intensity}%
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
