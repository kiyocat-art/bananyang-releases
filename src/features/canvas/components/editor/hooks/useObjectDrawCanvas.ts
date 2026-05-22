import { useRef, useState } from 'react';
import { useEditorStore } from '../../../../../features/toolbar/useEditorStore';
import { ImageSizeType } from '../EditorImageViewer';

interface UseObjectDrawCanvasParams {
    imageSize: ImageSizeType;
}

export const useObjectDrawCanvas = ({ imageSize }: UseObjectDrawCanvasParams) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const undoStack = useRef<ImageData[]>([]);
    const redoStack = useRef<ImageData[]>([]);
    const [undoCount, setUndoCount] = useState(0);
    const [redoCount, setRedoCount] = useState(0);

    const saveSnapshot = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        redoStack.current = [];
        setUndoCount(undoStack.current.length);
        setRedoCount(0);
    };

    const undoDrawing = () => {
        if (undoStack.current.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        redoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const snapshot = undoStack.current.pop()!;
        ctx.putImageData(snapshot, 0, 0);
        setUndoCount(undoStack.current.length);
        setRedoCount(redoStack.current.length);
    };

    const redoDrawing = () => {
        if (redoStack.current.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const snapshot = redoStack.current.pop()!;
        ctx.putImageData(snapshot, 0, 0);
        setUndoCount(undoStack.current.length);
        setRedoCount(redoStack.current.length);
    };

    const clearDrawing = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        undoStack.current = [];
        redoStack.current = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setUndoCount(0);
        setRedoCount(0);
    };

    const draw = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas || !isDrawingRef.current) return;
        const { objectMode, objectDrawTool, objectDrawBrushSize, objectBrushColor } = useEditorStore.getState();
        if (objectMode !== 'draw') return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.globalCompositeOperation = objectDrawTool === 'erase' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = objectBrushColor;
        ctx.lineWidth = objectDrawBrushSize * scaleX;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { objectMode } = useEditorStore.getState();
        if (objectMode !== 'draw') return;

        isDrawingRef.current = true;
        canvas.setPointerCapture(e.pointerId);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        draw(e);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) ctx.beginPath();
        saveSnapshot();
    };

    return {
        canvasRef, handlePointerDown, handlePointerMove, handlePointerUp,
        undoDrawing, redoDrawing, clearDrawing,
        canUndoDrawing: undoCount > 0,
        canRedoDrawing: redoCount > 0,
        /** undo 스택 잔여 수를 동기적으로 반환 (ref 기반) */
        getDrawUndoCount: () => undoStack.current.length,
    };
};
