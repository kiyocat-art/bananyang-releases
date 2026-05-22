import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '../../../../features/toolbar/useEditorStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import { useCanvasStore } from '../../../../store/canvasStore';

export interface ImageSizeType {
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
}

export interface ViewerRenderParams {
    imageSize: ImageSizeType;
    zoom: number;
    pan: { x: number; y: number };
    viewportRef: React.RefObject<HTMLDivElement>;
    isNavigateMode: boolean;
    isZKeyDown: boolean;
    imageSrc: string | null;
}

interface EditorImageViewerProps {
    className?: string;
    localImageSrc?: string | null;
    renderInsideTransform?: (params: ViewerRenderParams) => React.ReactNode;
    renderAtViewport?: (params: ViewerRenderParams) => React.ReactNode;
    onZoomChange?: (zoom: number) => void;
    onImageLoad?: (size: ImageSizeType) => void;
}

type InteractionMode =
    | { type: 'pan'; startX: number; startY: number; startPan: { x: number; y: number } }
    | { type: 'scrubbyZoom'; startX: number; startZoom: number; startPan: { x: number; y: number }; pivotImg: { x: number; y: number }; startScreenX: number; startScreenY: number }
    | null;

const BASE_GRID_SIZE = 50;

/** 줌 수준에 따라 adaptive grid size 계산 (PixiJS 그리드와 동일 로직) */
function getAdaptiveGridSize(zoom: number): number {
    let size = BASE_GRID_SIZE;
    while (size * zoom < 20) size *= 2;
    return size;
}

export const EditorImageViewer: React.FC<EditorImageViewerProps> = ({
    className = '',
    localImageSrc,
    renderInsideTransform,
    renderAtViewport,
    onZoomChange,
    onImageLoad,
}) => {
    const editingImageId = useEditorStore((s) => s.editingImageId);
    const boardImages = useCanvasStore((s) => s.boardImages);
    const originalImage = boardImages.find(img => img.id === editingImageId) ?? null;
    const storeImageSrc = (originalImage?.highResSrc || null)
        ?? (originalImage?.previewSrc || null)
        ?? (originalImage?.src || null)
        ?? (originalImage?.originalFilePath
            ? `file:///${originalImage.originalFilePath.replace(/\\/g, '/')}`
            : null)
        ?? (originalImage?.filePath
            ? `file:///${originalImage.filePath.replace(/\\/g, '/')}`
            : null);
    const imageSrc = (localImageSrc || null) ?? storeImageSrc ?? null;

    const viewportRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState<ImageSizeType>({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    const [isSpaceHeld, setIsSpaceHeld] = useState(false);
    const [isZKeyDown, setIsZKeyDown] = useState(false);
    const [interactionType, setInteractionType] = useState<'pan' | 'scrubbyZoom' | null>(null);

    const interactionRef = useRef<InteractionMode>(null);

    // [FLICK] Velocity tracking & inertia animation (same physics as main canvas)
    const panVelocityHistoryRef = useRef<Array<{x: number; y: number; t: number}>>([]);
    const flickAnimationRef = useRef<number | null>(null);

    const startFlickAnimation = useCallback((vx: number, vy: number) => {
        if (flickAnimationRef.current !== null) {
            cancelAnimationFrame(flickAnimationRef.current);
        }
        const FRICTION = 0.92;
        const MIN_VELOCITY = 0.5;
        let velocityX = vx;
        let velocityY = vy;
        const animate = () => {
            velocityX *= FRICTION;
            velocityY *= FRICTION;
            if (Math.sqrt(velocityX * velocityX + velocityY * velocityY) < MIN_VELOCITY) {
                flickAnimationRef.current = null;
                return;
            }
            setPan(prev => ({ x: prev.x + velocityX, y: prev.y + velocityY }));
            flickAnimationRef.current = requestAnimationFrame(animate);
        };
        flickAnimationRef.current = requestAnimationFrame(animate);
    }, []);

    // Cleanup flick animation on unmount
    useEffect(() => {
        return () => {
            if (flickAnimationRef.current !== null) {
                cancelAnimationFrame(flickAnimationRef.current);
            }
        };
    }, []);

    const zoomRef = useRef(zoom);
    useEffect(() => {
        zoomRef.current = zoom;
        onZoomChange?.(zoom);
    }, [zoom, onZoomChange]);

    // Auto-fit on image load
    useEffect(() => {
        if (!imageSrc) {
            setImageSize({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
            return;
        }
        const img = new Image();
        img.onload = () => {
            const container = viewportRef.current;
            if (!container) return;
            const { width: availW, height: availH } = container.getBoundingClientRect();
            const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1);
            const displayW = img.naturalWidth * scale;
            const displayH = img.naturalHeight * scale;
            const size: ImageSizeType = {
                width: displayW,
                height: displayH,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
            };
            setImageSize(size);
            setZoom(1);
            setPan({ x: (availW - displayW) / 2, y: (availH - displayH) / 2 });
            onImageLoad?.(size);
        };
        img.src = imageSrc;
    }, [imageSrc]); // eslint-disable-line react-hooks/exhaustive-deps

    // Wheel zoom with pivot at mouse
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const scaleAmount = 1.2;
        setZoom((prevZoom) => {
            const newZoom = e.deltaY < 0 ? prevZoom * scaleAmount : prevZoom / scaleAmount;
            const clamped = Math.max(0.1, Math.min(10, newZoom));
            if (viewportRef.current) {
                const rect = viewportRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                setPan((prev) => ({
                    x: mouseX - (mouseX - prev.x) * (clamped / prevZoom),
                    y: mouseY - (mouseY - prev.y) * (clamped / prevZoom),
                }));
            }
            return clamped;
        });
    }, []);

    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        vp.addEventListener('wheel', handleWheel, { passive: false });
        return () => vp.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // Space / Z key tracking — same pattern as infinite canvas
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.code === 'Space') {
                e.preventDefault();
                setIsSpaceHeld(true);
            }
            // Z key: scrubby zoom — Ctrl+Z/Meta+Z는 undo이므로 제외
            if ((e.code === 'KeyZ' || e.key.toLowerCase() === 'z') && !e.ctrlKey && !e.metaKey) {
                setIsZKeyDown(true);
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpaceHeld(false);
            if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') setIsZKeyDown(false);
        };
        // Prevent stuck keys
        const onBlur = () => { setIsSpaceHeld(false); setIsZKeyDown(false); };
        const onVisibility = () => {
            if (document.hidden) { setIsSpaceHeld(false); setIsZKeyDown(false); }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    // Pointer handlers
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const vp = viewportRef.current;
        if (!vp) return;

        // Scrubby zoom: Z + left button (same as infinite canvas)
        if (e.button === 0 && isZKeyDown) {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = vp.getBoundingClientRect();
            const startScreenX = e.clientX - rect.left;
            const startScreenY = e.clientY - rect.top;
            const currentPan = { x: 0, y: 0 };
            // Read latest pan via setState callback trick — use panRef instead
            const currentZoom = zoomRef.current;
            interactionRef.current = {
                type: 'scrubbyZoom',
                startX: e.clientX,
                startZoom: currentZoom,
                startPan: { x: 0, y: 0 }, // will be set below
                pivotImg: { x: 0, y: 0 },
                startScreenX,
                startScreenY,
            };
            // Capture latest pan synchronously via setPan
            setPan((prev) => {
                const pivotImgX = (startScreenX - prev.x) / currentZoom;
                const pivotImgY = (startScreenY - prev.y) / currentZoom;
                interactionRef.current = {
                    type: 'scrubbyZoom',
                    startX: e.clientX,
                    startZoom: currentZoom,
                    startPan: prev,
                    pivotImg: { x: pivotImgX, y: pivotImgY },
                    startScreenX,
                    startScreenY,
                };
                return prev; // no change yet
            });
            setInteractionType('scrubbyZoom');
            return;
        }

        // Pan: Space + left, middle, or right button
        const isSpacePan = isSpaceHeld && e.button === 0;
        const isMiddlePan = e.button === 1;
        const isRightPan = e.button === 2;
        if (!isSpacePan && !isMiddlePan && !isRightPan) return;

        // Cancel any ongoing flick animation when starting a new pan
        if (flickAnimationRef.current !== null) {
            cancelAnimationFrame(flickAnimationRef.current);
            flickAnimationRef.current = null;
        }
        panVelocityHistoryRef.current = [];

        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setPan((prev) => {
            interactionRef.current = {
                type: 'pan',
                startX: e.clientX,
                startY: e.clientY,
                startPan: prev,
            };
            return prev;
        });
        setInteractionType('pan');
    }, [isSpaceHeld, isZKeyDown]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const mode = interactionRef.current;
        if (!mode) return;

        if (mode.type === 'scrubbyZoom') {
            const dx = e.clientX - mode.startX;
            const newZoom = Math.max(0.1, Math.min(10, mode.startZoom * Math.exp(dx * 0.005)));
            setZoom(newZoom);
            setPan({
                x: mode.startScreenX - mode.pivotImg.x * newZoom,
                y: mode.startScreenY - mode.pivotImg.y * newZoom,
            });
        } else if (mode.type === 'pan') {
            const dx = e.clientX - mode.startX;
            const dy = e.clientY - mode.startY;
            const newPan = { x: mode.startPan.x + dx, y: mode.startPan.y + dy };
            setPan(newPan);

            // [FLICK] Record position history for velocity calculation
            const now = performance.now();
            const history = panVelocityHistoryRef.current;
            history.push({ x: newPan.x, y: newPan.y, t: now });
            if (history.length > 5) history.shift();
        }
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!interactionRef.current) return;
        const wasPan = interactionRef.current.type === 'pan';
        interactionRef.current = null;
        setInteractionType(null);
        e.currentTarget.releasePointerCapture(e.pointerId);

        // [FLICK] Apply inertia on pan release
        if (wasPan && useSettingsStore.getState().flickPanning) {
            const history = panVelocityHistoryRef.current;
            const now = performance.now();
            const lastSample = history.length > 0 ? history[history.length - 1] : null;
            const isStale = !lastSample || (now - lastSample.t) > 80;

            if (!isStale && history.length >= 2) {
                const oldest = history[0];
                const newest = history[history.length - 1];
                const dt = newest.t - oldest.t;
                if (dt > 0) {
                    let vx = ((newest.x - oldest.x) / dt) * 16.67;
                    let vy = ((newest.y - oldest.y) / dt) * 16.67;
                    const speed = Math.sqrt(vx * vx + vy * vy);
                    const MAX_SPEED = 50;
                    if (speed > MAX_SPEED) {
                        const scale = MAX_SPEED / speed;
                        vx *= scale;
                        vy *= scale;
                    }
                    if (speed > 0.1) {
                        startFlickAnimation(vx, vy);
                    }
                }
            }
            panVelocityHistoryRef.current = [];
        }
    }, [startFlickAnimation]);

    // Dynamic grid CSS — mirrors PixiJS drawGrid logic
    const gridSize = getAdaptiveGridSize(zoom);
    const screenGridSize = gridSize * zoom;
    const gridAlpha = Math.min(0.08, Math.max(0.02, zoom * 0.08));
    const gridColor = `rgba(255,255,255,${gridAlpha.toFixed(3)})`;

    const renderParams: ViewerRenderParams = {
        imageSize,
        zoom,
        pan,
        viewportRef,
        isNavigateMode: isSpaceHeld,
        isZKeyDown,
        imageSrc,
    };

    const isEmpty = !imageSrc;

    // Cursor — same priority as infinite canvas
    let cursor = 'default';
    if (interactionType === 'scrubbyZoom') cursor = 'ew-resize';
    else if (interactionType === 'pan') cursor = 'grabbing';
    else if (isZKeyDown) cursor = 'zoom-in';
    else if (isSpaceHeld) cursor = 'grab';

    return (
        <div
            ref={viewportRef}
            className={`overflow-hidden ${className}`}
            style={{
                cursor,
                touchAction: 'none',
                backgroundColor: '#0e0e0e',
                backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
                backgroundSize: `${screenGridSize}px ${screenGridSize}px`,
                backgroundPosition: `${pan.x % screenGridSize}px ${pan.y % screenGridSize}px`,
            }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            {isEmpty ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-xs text-zinc-500 text-center px-4">이미지를 선택하면 여기에 표시됩니다</p>
                </div>
            ) : (
                <>
                    {/* Main image + inside-transform overlays */}
                    <div
                        className="absolute"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px)`,
                            transformOrigin: '0 0',
                            width: imageSize.width,
                            height: imageSize.height,
                        }}
                    >
                        <div
                            style={{
                                transform: `scale(${zoom})`,
                                transformOrigin: '0 0',
                                width: imageSize.width,
                                height: imageSize.height,
                                position: 'relative',
                            }}
                        >
                            <img
                                src={imageSrc}
                                alt="editor"
                                draggable={false}
                                style={{ width: imageSize.width, height: imageSize.height, display: 'block', userSelect: 'none' }}
                            />
                            {renderInsideTransform?.(renderParams)}
                        </div>
                    </div>

                    {/* Viewport-level overlays */}
                    {renderAtViewport?.(renderParams)}
                </>
            )}
        </div>
    );
};
