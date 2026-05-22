import { useRef, useCallback, useState, useEffect } from 'react';
import { useCanvasStore } from '../../../../../store/canvasStore';
import { ImageSizeType } from '../EditorImageViewer';

interface UseInpaintMaskInteractionParams {
    zoomRef: React.RefObject<number>;
    imageSize: ImageSizeType;
    brushSize: number;
    targetImageId: string | null;
    isEraserMode?: boolean;
    onBrushSizeChange?: (size: number) => void;
}

export function useInpaintMaskInteraction({
    zoomRef,
    imageSize,
    brushSize,
    targetImageId,
    isEraserMode = false,
    onBrushSizeChange,
}: UseInpaintMaskInteractionParams) {
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const prevTargetIdRef = useRef<string | null>(null);
    const prevMaskSrcRef = useRef<string | null>(null);
    const undoStackRef = useRef<ImageData[]>([]);
    const overlayRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const livePointsRef = useRef<{ x: number; y: number }[]>([]);
    const cursorPosRef = useRef<{ x: number; y: number } | null>(null);
    const [renderTick, setRenderTick] = useState(0);
    // Track eraser state at stroke start so mid-stroke mode changes don't mix
    const strokeEraserRef = useRef(false);

    const rerender = useCallback(() => setRenderTick(t => t + 1), []);

    // Keyboard shortcuts: [ / ] for brush size, E to toggle eraser
    useEffect(() => {
        const BRUSH_STEP = 5;
        const MIN_BRUSH = 3;
        const MAX_BRUSH = 100;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore when typing in input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === '[') {
                e.preventDefault();
                const current = useCanvasStore.getState().inpaintBrushSize;
                const next = Math.max(MIN_BRUSH, current - BRUSH_STEP);
                useCanvasStore.getState().setInpaintBrushSize(next);
                onBrushSizeChange?.(next);
            } else if (e.key === ']') {
                e.preventDefault();
                const current = useCanvasStore.getState().inpaintBrushSize;
                const next = Math.min(MAX_BRUSH, current + BRUSH_STEP);
                useCanvasStore.getState().setInpaintBrushSize(next);
                onBrushSizeChange?.(next);
            } else if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                const current = useCanvasStore.getState().inpaintEraserMode;
                useCanvasStore.getState().setInpaintEraserMode(!current);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onBrushSizeChange]);

    // (Re)initialize the offscreen canvas when the target image or image size changes.
    // Bug fix: the old guard `if (targetImageId === prevTargetIdRef.current) return` would block
    // re-entry when imageSize loaded after targetImageId was already set, leaving canvas as null.
    useEffect(() => {
        const targetChanged = targetImageId !== prevTargetIdRef.current;
        if (targetChanged) {
            prevTargetIdRef.current = targetImageId;
            // Each image owns its own maskSrc lifecycle in the store; do not revoke
            // the previous target's blob URL via this hook-scoped ref.
            prevMaskSrcRef.current = null;
            undoStackRef.current = [];
            livePointsRef.current = [];
        }

        if (!targetImageId || !imageSize.naturalWidth || !imageSize.naturalHeight) {
            if (targetChanged) maskCanvasRef.current = null;
            return;
        }

        // Skip recreation if the correct-sized canvas already exists for this image
        const prevCanvas = maskCanvasRef.current;
        if (
            !targetChanged
            && prevCanvas
            && prevCanvas.width === imageSize.naturalWidth
            && prevCanvas.height === imageSize.naturalHeight
        ) {
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = imageSize.naturalWidth;
        canvas.height = imageSize.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Same-target resize: synchronously preserve previous canvas pixels so
            // strokes drawn before imageSize finalised are not lost.
            if (!targetChanged && prevCanvas) {
                ctx.drawImage(prevCanvas, 0, 0, canvas.width, canvas.height);
            }
        }
        maskCanvasRef.current = canvas;

        // Load existing committed mask from store when switching to a new target.
        // Skip this on same-target resize since the prevCanvas copy already holds it.
        if (targetChanged && ctx) {
            const existingImg = useCanvasStore.getState().boardImages.find(i => i.id === targetImageId);
            const existingSrc = existingImg?.maskSrc;
            if (existingSrc) {
                const img = new window.Image();
                img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); rerender(); };
                img.src = existingSrc;
            }
        }

        rerender();
    }, [targetImageId, imageSize.naturalWidth, imageSize.naturalHeight, rerender]);

    const getDisplayPos = useCallback((e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
        const el = overlayRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const zoom = zoomRef.current ?? 1;
        return {
            x: (e.clientX - rect.left) / zoom,
            y: (e.clientY - rect.top) / zoom,
        };
    }, [zoomRef]);

    const drawStrokeToCanvas = useCallback((points: { x: number; y: number }[], radius: number, erasing: boolean) => {
        const canvas = maskCanvasRef.current;
        if (!canvas || points.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width: dW, height: dH, naturalWidth: nW, naturalHeight: nH } = imageSize;
        const scaleX = nW / dW;
        const scaleY = nH / dH;
        const naturalRadius = radius * scaleX;

        // Eraser paints black (preserve), brush paints white (edit area)
        const color = erasing ? 'black' : 'white';
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = naturalRadius * 2;

        if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0].x * scaleX, points[0].y * scaleY, naturalRadius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x * scaleX, points[i].y * scaleY);
            }
            ctx.stroke();
        }
    }, [imageSize]);

    const exportMask = useCallback(() => {
        const canvas = maskCanvasRef.current;
        if (!canvas || !targetImageId) return;
        canvas.toBlob(blob => {
            if (!blob) return;
            const maskFile = new File([blob], 'mask.png', { type: 'image/png' });
            const newSrc = URL.createObjectURL(blob);
            if (prevMaskSrcRef.current) URL.revokeObjectURL(prevMaskSrcRef.current);
            prevMaskSrcRef.current = newSrc;
            useCanvasStore.getState().updateImage(targetImageId, { maskFile, maskSrc: newSrc });
            rerender();
        }, 'image/png');
    }, [targetImageId, rerender]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);

        // Save undo snapshot
        const canvas = maskCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }

        // Capture eraser mode at stroke start
        strokeEraserRef.current = isEraserMode;

        const pos = getDisplayPos(e);
        if (!pos) return;
        isDrawingRef.current = true;
        livePointsRef.current = [pos];
        rerender();
    }, [getDisplayPos, rerender, isEraserMode]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const pos = getDisplayPos(e);
        if (pos) {
            cursorPosRef.current = pos;
            if (isDrawingRef.current) {
                livePointsRef.current = [...livePointsRef.current, pos];
            }
        }
        rerender();
    }, [getDisplayPos, rerender]);

    const handlePointerUp = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        const points = livePointsRef.current;
        livePointsRef.current = [];

        if (points.length > 0) {
            drawStrokeToCanvas(points, brushSize / 2, strokeEraserRef.current);
            exportMask();
        }
        rerender();
    }, [brushSize, drawStrokeToCanvas, exportMask, rerender]);

    const handlePointerLeave = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
        cursorPosRef.current = null;
        rerender();
    }, [rerender]);

    const clearMask = useCallback(() => {
        const canvas = maskCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
        undoStackRef.current = [];
        livePointsRef.current = [];
        if (prevMaskSrcRef.current) {
            URL.revokeObjectURL(prevMaskSrcRef.current);
            prevMaskSrcRef.current = null;
        }
        if (targetImageId) {
            useCanvasStore.getState().updateImage(targetImageId, { maskFile: undefined, maskSrc: undefined });
        }
        rerender();
    }, [targetImageId, rerender]);

    const undoLastStroke = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        const snapshot = undoStackRef.current.pop()!;
        const canvas = maskCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.putImageData(snapshot, 0, 0);
        }
        exportMask();
    }, [exportMask]);

    void renderTick; // consumed to trigger re-renders

    return {
        overlayRef,
        livePoints: livePointsRef.current,
        cursorPos: cursorPosRef.current,
        isDrawingEraser: isDrawingRef.current && strokeEraserRef.current,
        clearMask,
        undoLastStroke,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerLeave,
    };
}

