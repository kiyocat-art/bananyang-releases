import React, { useState, useMemo, useRef } from 'react';
import { BoardImage } from '../../../types';
import { t, Language } from '../../../localization';
import { useCanvasStore } from '../../../store/canvasStore';
import { REF_COLORS } from '../../../constants';
import { Tooltip } from '../../../components/Tooltip';
import {
    MapIcon, PlusIcon, MinusIcon, FitToScreenIcon, CloseIcon,
} from '../../../components/icons';


export const CanvasNavigator: React.FC<{ language: Language; canvasRef: React.RefObject<HTMLElement>; rightOffset?: number; }> = ({ language, canvasRef, rightOffset }) => {
    const boardImages = useCanvasStore(state => state.boardImages);
    const pan = useCanvasStore(state => state.pan);
    const zoom = useCanvasStore(state => state.zoom);
    const setPan = useCanvasStore(state => state.setPan);
    const setZoom = useCanvasStore(state => state.setZoom);
    const [isOpen, setIsOpen] = useState(true);
    const minimapRef = useRef<HTMLDivElement>(null);
    const [isDraggingViewport, setIsDraggingViewport] = useState(false);
    const interactionRef = useRef<{ startX: number; startY: number; startPan: { x: number; y: number; } } | null>(null);

    const contentBounds = useMemo(() => {
        if (boardImages.length === 0) return { x: 0, y: 0, width: 0, height: 0, defined: false };
        const minX = Math.min(...boardImages.map(i => i.x));
        const minY = Math.min(...boardImages.map(i => i.y));
        const maxX = Math.max(...boardImages.map(i => i.x + i.width));
        const maxY = Math.max(...boardImages.map(i => i.y + i.height));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, defined: true };
    }, [boardImages]);

    const handleZoomToFit = () => {
        const canvasEl = canvasRef.current;
        if (!canvasEl || !contentBounds.defined || contentBounds.width === 0 || contentBounds.height === 0) return;

        const PADDING = 50;
        const scaleX = (canvasEl.offsetWidth - PADDING * 2) / contentBounds.width;
        const scaleY = (canvasEl.offsetHeight - PADDING * 2) / contentBounds.height;
        const newZoom = Math.min(scaleX, scaleY, 5);
        const newPanX = (canvasEl.offsetWidth - contentBounds.width * newZoom) / 2 - contentBounds.x * newZoom;
        const newPanY = (canvasEl.offsetHeight - contentBounds.height * newZoom) / 2 - contentBounds.y * newZoom;
        setZoom(() => newZoom);
        setPan(() => ({ x: newPanX, y: newPanY }));
    };

    const MINIMAP_SIZE = 180;
    const minimapScale = (contentBounds.defined && contentBounds.width > 0 && contentBounds.height > 0)
        ? Math.min(MINIMAP_SIZE / contentBounds.width, MINIMAP_SIZE / contentBounds.height)
        : 0;

    const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!minimapRef.current || !canvasRef.current || !contentBounds.defined || minimapScale === 0) return;
        e.preventDefault(); e.stopPropagation();
        setIsDraggingViewport(true);

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        let hasMoved = false;

        interactionRef.current = { startX: e.clientX, startY: e.clientY, startPan: pan };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!interactionRef.current) return;

            const dx = moveEvent.clientX - interactionRef.current.startX;
            const dy = moveEvent.clientY - interactionRef.current.startY;

            // Mark as moved if dragged more than 2 pixels
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                hasMoved = true;
            }

            const deltaPanX = -(dx / minimapScale) * zoom;
            const deltaPanY = -(dy / minimapScale) * zoom;
            setPan(p => ({ x: interactionRef.current!.startPan.x + deltaPanX, y: interactionRef.current!.startPan.y + deltaPanY }));
        };
        const handleMouseUp = () => {
            setIsDraggingViewport(false);
            interactionRef.current = null;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Don't handle click if we just finished dragging the viewport
        if (isDraggingViewport) return;

        const minimapEl = minimapRef.current;
        const canvasEl = canvasRef.current;
        if (!minimapEl || !canvasEl || !contentBounds.defined) return;

        // Check if click is on the viewport box itself - if so, ignore
        const target = e.target as HTMLElement;
        if (target.closest('[data-viewport-box]')) return;

        const minimapRect = minimapEl.getBoundingClientRect();

        const contentDisplayWidth = contentBounds.width * minimapScale;
        const contentDisplayHeight = contentBounds.height * minimapScale;
        const contentOffsetX = (MINIMAP_SIZE - contentDisplayWidth) / 2;
        const contentOffsetY = (MINIMAP_SIZE - contentDisplayHeight) / 2;
        const clickX = e.clientX - minimapRect.left - contentOffsetX;
        const clickY = e.clientY - minimapRect.top - contentOffsetY;
        const targetCanvasX = (clickX / minimapScale) + contentBounds.x;
        const targetCanvasY = (clickY / minimapScale) + contentBounds.y;
        const newPanX = -targetCanvasX * zoom + canvasEl.offsetWidth / 2;
        const newPanY = -targetCanvasY * zoom + canvasEl.offsetHeight / 2;
        setPan(() => ({ x: newPanX, y: newPanY }));
    };

    const getRoleColor = (image: BoardImage) => {
        if (image.role === 'original') return '#22c55e';
        if (image.role === 'background') return '#a855f7';
        if (image.role === 'pose') return '#f59e0b';
        if (image.role === 'reference' && image.refIndex !== undefined) return REF_COLORS[image.refIndex % REF_COLORS.length];
        return '#737373'; // neutral-500
    };

    const canvasEl = canvasRef.current;
    let viewport = { x: 0, y: 0, width: 0, height: 0 };
    if (canvasEl && contentBounds.defined && zoom > 0) {
        const contentDisplayWidth = contentBounds.width * minimapScale;
        const contentDisplayHeight = contentBounds.height * minimapScale;
        // Calculate viewport dimensions in minimap space
        const viewportWidthInCanvas = canvasEl.offsetWidth / zoom;
        const viewportHeightInCanvas = canvasEl.offsetHeight / zoom;

        // Calculate viewport position in canvas space
        const viewportXInCanvas = -pan.x / zoom;
        const viewportYInCanvas = -pan.y / zoom;

        // Convert to minimap space
        // Note: We do NOT add contentOffsetX/Y here because the viewport box is rendered 
        // INSIDE the content container (line 141), which is already centered by the parent flex container.
        viewport = {
            width: viewportWidthInCanvas * minimapScale,
            height: viewportHeightInCanvas * minimapScale,
            x: (viewportXInCanvas - contentBounds.x) * minimapScale,
            y: (viewportYInCanvas - contentBounds.y) * minimapScale,
        };
    }

    return (
        <div
            className="absolute bottom-8 right-8 z-50"
            style={{
                right: rightOffset !== undefined ? rightOffset : 32,
                transition: 'right 0.3s ease',
                // [PERF] GPU layer isolation to prevent flickering during canvas operations
                willChange: 'transform, right',
                backfaceVisibility: 'hidden',
                contain: 'layout style paint',
                isolation: 'isolate',
            }}
        >
            {isOpen ? (
                <div className="glass-panel rounded-2xl p-4 shadow-2xl animate-category-fade-in">
                    <Tooltip tip={t('navigator.hide', language)} position="left"><button onClick={() => setIsOpen(false)} className="absolute top-3 right-3 z-10 p-1.5 text-white/40 hover:text-white rounded-full hover:bg-white/10 transition-colors"><CloseIcon className="w-4 h-4" /></button></Tooltip>
                    <div className="flex flex-col items-center gap-3">
                        <div ref={minimapRef} className="w-[180px] h-[180px] bg-black/40 rounded-xl overflow-hidden relative cursor-pointer border border-white/5 shadow-inner flex items-center justify-center" onClick={handleMinimapClick}>
                            {contentBounds.defined && minimapScale > 0 && (
                                <div style={{ width: contentBounds.width * minimapScale, height: contentBounds.height * minimapScale, position: 'relative' }}>
                                    {boardImages.map(img => (<div key={img.id} style={{ position: 'absolute', left: (img.x - contentBounds.x) * minimapScale, top: (img.y - contentBounds.y) * minimapScale, width: img.width * minimapScale, height: img.height * minimapScale, backgroundColor: getRoleColor(img), borderRadius: '2px' }} />))}
                                    <div data-viewport-box onMouseDown={handleViewportMouseDown} style={{
                                        position: 'absolute',
                                        left: viewport.x,
                                        top: viewport.y,
                                        width: viewport.width,
                                        height: viewport.height,
                                        border: '2px solid white',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        cursor: isDraggingViewport ? 'grabbing' : 'grab',
                                        borderRadius: '4px',
                                        // Removed heavy boxShadow that caused full canvas flicker
                                    }} />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 bg-black/30 rounded-xl p-1.5 border border-white/5">
                            <Tooltip tip={t('navigator.zoomOut', language)} position="top"><button onClick={() => setZoom(z => z / 1.2)} className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"><MinusIcon className="w-4 h-4" /></button></Tooltip>
                            <Tooltip tip={t('navigator.zoomTo100', language)} position="top"><button onClick={() => {
                                const el = canvasRef.current;
                                if (el) {
                                    // Calculate current viewport center in world coordinates
                                    const centerWorldX = (-pan.x + el.offsetWidth / 2) / zoom;
                                    const centerWorldY = (-pan.y + el.offsetHeight / 2) / zoom;
                                    // Compute new pan so that the same world center remains at screen center at zoom=1
                                    const newPanX = -centerWorldX + el.offsetWidth / 2;
                                    const newPanY = -centerWorldY + el.offsetHeight / 2;
                                    setZoom(() => 1);
                                    setPan(() => ({ x: newPanX, y: newPanY }));
                                } else {
                                    setZoom(() => 1);
                                }
                            }} className="px-2 text-xs font-mono w-12 text-center h-8 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">{(zoom * 100).toFixed(0)}%</button></Tooltip>
                            <Tooltip tip={t('navigator.zoomIn', language)} position="top"><button onClick={() => setZoom(z => z * 1.2)} className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"><PlusIcon className="w-4 h-4" /></button></Tooltip>
                            <div className="w-px h-5 bg-white/10 mx-1"></div>
                            <Tooltip tip={t('navigator.zoomToFit', language)} position="top"><button onClick={handleZoomToFit} disabled={boardImages.length === 0} className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><FitToScreenIcon className="w-4 h-4" /></button></Tooltip>
                        </div>
                    </div>
                </div>
            ) : (
                <Tooltip tip={t('navigator.show', language)} position="left">
                    <button onClick={() => setIsOpen(true)} className="glass-button w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl text-white/80 hover:text-white transition-all">
                        <MapIcon className="w-7 h-7" />
                    </button>
                </Tooltip>
            )}
        </div>
    );
};