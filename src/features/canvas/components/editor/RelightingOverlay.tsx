import React, { useRef, useCallback, useEffect } from 'react';
import { LightSource } from '../../../../types';

interface RelightingOverlayProps {
    lightSources: LightSource[];
    selectedLightId: string | null;
    imageSize: { width: number; height: number };
    zoom: number;
    pan: { x: number; y: number };
    onSelectLight: (id: string) => void;
    onUpdateLight: (id: string, updates: Partial<LightSource>) => void;
    isZKeyDown?: boolean;
}

type DragType = 'position' | 'direction';

/** Convert colorTemperature (-100..+100) to a subtle tint color for the handle */
function ctToTint(ct: number): string {
    if (ct > 20)  return `rgba(255, 179, 71, ${Math.min(0.6, ct / 100 * 0.6)})`;  // warm amber
    if (ct < -20) return `rgba(155, 180, 255, ${Math.min(0.6, Math.abs(ct) / 100 * 0.6)})`; // cool blue
    return 'transparent';
}

export const RelightingOverlay: React.FC<RelightingOverlayProps> = ({
    lightSources,
    selectedLightId,
    imageSize,
    zoom,
    pan,
    onSelectLight,
    onUpdateLight,
    isZKeyDown = false,
}) => {
    const draggingStateRef = useRef<{ lightId: string; type: DragType } | null>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const lightSourcesRef = useRef(lightSources);
    lightSourcesRef.current = lightSources;
    const imageSizeRef = useRef(imageSize);
    imageSizeRef.current = imageSize;
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const onUpdateLightRef = useRef(onUpdateLight);
    onUpdateLightRef.current = onUpdateLight;
    const onSelectLightRef = useRef(onSelectLight);
    onSelectLightRef.current = onSelectLight;

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const ds = draggingStateRef.current;
        if (!ds || !dragStartRef.current) return;

        const light = lightSourcesRef.current.find(l => l.id === ds.lightId);
        if (!light) return;

        if (ds.type === 'position') {
            const dx = (e.clientX - dragStartRef.current.x) / zoomRef.current;
            const dy = (e.clientY - dragStartRef.current.y) / zoomRef.current;
            const newX = Math.max(0, Math.min(1, light.position.x + dx / imageSizeRef.current.width));
            const newY = Math.max(0, Math.min(1, light.position.y + dy / imageSizeRef.current.height));
            onUpdateLightRef.current(ds.lightId, { position: { x: newX, y: newY } });
            dragStartRef.current = { x: e.clientX, y: e.clientY };
        } else if (ds.type === 'direction') {
            const lightX = light.position.x * imageSizeRef.current.width;
            const lightY = light.position.y * imageSizeRef.current.height;
            const viewportRect = overlayRef.current?.getBoundingClientRect();
            if (!viewportRect) return;
            const currentMouseX = (e.clientX - viewportRect.left) / zoomRef.current;
            const currentMouseY = (e.clientY - viewportRect.top) / zoomRef.current;
            const deltaX = currentMouseX - lightX;
            const deltaY = currentMouseY - lightY;
            const currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            onUpdateLightRef.current(ds.lightId, { direction: Math.round(currentAngle) });
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        draggingStateRef.current = null;
        dragStartRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const startDrag = (lightId: string, type: DragType, e: React.MouseEvent) => {
        if (isZKeyDown) return;
        e.stopPropagation();
        onSelectLightRef.current(lightId);
        draggingStateRef.current = { lightId, type };
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Ambient lights: render as full-image tint overlays (no position handle)
    const ambientLights = lightSources.filter(l => l.type === 'ambient');
    // Rim lights: render edge glow on image border
    const rimLights = lightSources.filter(l => l.type === 'rim');

    return (
        <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none"
            style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0'
            }}
        >
            {/* Ambient light overlays — full image tint */}
            {ambientLights.map(light => {
                const ct = light.colorTemperature ?? 0;
                const tintColor = ct > 20
                    ? `rgba(255, 179, 71, ${(light.intensity / 100) * 0.12})`
                    : ct < -20
                        ? `rgba(100, 149, 255, ${(light.intensity / 100) * 0.12})`
                        : `rgba(255, 255, 255, ${(light.intensity / 100) * 0.08})`;
                const isSelected = light.id === selectedLightId;
                return (
                    <div
                        key={light.id}
                        className="absolute inset-0 pointer-events-auto cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: tintColor }}
                        onClick={() => onSelectLightRef.current(light.id)}
                    >
                        {/* Ambient icon in center */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                            <div
                                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                                    isSelected ? 'border-white/80 bg-black/40' : 'border-white/30 bg-black/20'
                                }`}
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" className="text-zinc-300"/>
                                    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className="text-zinc-400"/>
                                    <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 2.5" className="text-zinc-500"/>
                                </svg>
                            </div>
                        </div>
                        {isSelected && (
                            <div className="absolute inset-0 border-2 border-sky-400/40 pointer-events-none" />
                        )}
                    </div>
                );
            })}

            {/* Rim light: edge glow on entire image border */}
            {rimLights.map(light => {
                const glowSize = Math.round((light.radius ?? 50) / 100 * 30 + 5);
                return (
                    <div
                        key={`rim-glow-${light.id}`}
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            boxShadow: `inset 0 0 ${glowSize}px ${glowSize / 2}px ${light.color}${Math.round((light.intensity / 100) * 160).toString(16).padStart(2, '0')}`
                        }}
                    />
                );
            })}

            {/* Per-light position handles */}
            {lightSources.map((light) => {
                if (light.type === 'ambient') return null; // ambient has no position handle

                const x = light.position.x * imageSize.width;
                const y = light.position.y * imageSize.height;
                const isSelected = light.id === selectedLightId;
                const hasDirection = light.type === 'direct' || light.type === 'sun';

                const intensityScale = 1 + (light.intensity / 100) * 8;
                const ringSize = 40 * intensityScale;
                const directionLineLength = ringSize + 60;

                // Radius diffusion ring
                const radiusScale = (light.radius ?? 50) / 100;
                const diffusionRingSize = ringSize * (1 + radiusScale * 0.6);

                // colorTemperature tint for handle
                const tint = ctToTint(light.colorTemperature ?? 0);

                // Area softbox size
                const areaSize = 40 + ((light.radius ?? 50) / 100) * 80;

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
                        {/* Area softbox rectangle */}
                        {light.type === 'area' && (
                            <div
                                className="absolute rounded-lg transition-all duration-200"
                                style={{
                                    width: `${areaSize * 1.4}px`,
                                    height: `${areaSize}px`,
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    border: `1.5px solid ${light.color}50`,
                                    boxShadow: `0 0 ${areaSize / 4}px ${light.color}30`
                                }}
                            />
                        )}

                        {/* Radius diffusion ring (subtle, semi-transparent) */}
                        {light.type !== 'area' && (
                            <div
                                className="absolute rounded-full pointer-events-none"
                                style={{
                                    width: `${diffusionRingSize}px`,
                                    height: `${diffusionRingSize}px`,
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: `radial-gradient(circle, ${light.color}08 0%, transparent 70%)`
                                }}
                            />
                        )}

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

                        {/* Outer Glow Ring (selected) */}
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

                        {/* Direction Line (direct/sun) */}
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
                                    style={{ width: `${directionLineLength}px` }}
                                />
                                <div
                                    className="absolute top-1/2 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                                    style={{
                                        left: `${directionLineLength}px`,
                                        transform: 'translate(-50%, -50%)',
                                        pointerEvents: 'auto'
                                    }}
                                    onMouseDown={(e) => startDrag(light.id, 'direction', e)}
                                >
                                    <div className="w-4 h-4 rounded-full bg-white border-2 border-zinc-800 shadow-lg" />
                                </div>
                            </div>
                        )}

                        {/* Light Center Handle */}
                        <div
                            className="absolute left-1/2 top-1/2 pointer-events-auto cursor-move"
                            style={{ transform: 'translate(-50%, -50%)' }}
                            onMouseDown={(e) => startDrag(light.id, 'position', e)}
                        >
                            <div
                                className={`relative flex items-center justify-center transition-all ${
                                    isSelected ? 'w-12 h-12' : 'w-8 h-8'
                                }`}
                            >
                                {/* Color temperature tint overlay */}
                                {tint !== 'transparent' && (
                                    <div
                                        className="absolute inset-0 rounded-full opacity-60 blur-md"
                                        style={{ backgroundColor: tint }}
                                    />
                                )}
                                {/* Glow */}
                                <div
                                    className="absolute inset-0 rounded-full opacity-40 blur-md"
                                    style={{ backgroundColor: light.color }}
                                />
                                {/* Inner Circle */}
                                <div
                                    className={`relative rounded-full border-2 ${
                                        isSelected ? 'border-white w-8 h-8' : 'border-white/60 w-6 h-6'
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
                                    {light.type.toUpperCase()} — {light.intensity}%
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
