import { useState, useRef, useEffect, useCallback } from 'react';
import { ObjectState, ObjectMemo, ObjectMode, ObjectTransform, ObjectContextMenu } from '../types';
import { blobManager } from '../../../../../utils/blobManager';
import { BoardImage } from '../../../../../types';
import { useCanvasStore } from '../../../../../store/canvasStore';
import { StrokeProcessor, createStrokePointFromEvent } from '../../../../right-panel/utils/pressureBrush';

interface UseObjectEditorProps {
    image: BoardImage;
    activeTool: string;
    imageSize: { width: number; height: number; naturalWidth: number; naturalHeight: number };
    onNotification: (message: string, type: 'success' | 'error') => void;
    t: (key: string, ...args: any[]) => string;
}

export const useObjectEditor = ({ image, activeTool, imageSize, onNotification, t }: UseObjectEditorProps) => {
    // Object States
    const [objectStates, setObjectStates] = useState<ObjectState[]>([]);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [objectMode, setObjectMode] = useState<ObjectMode>('transform');
    const [objectContextMenu, setObjectContextMenu] = useState<ObjectContextMenu | null>(null);

    // Memos
    const [objectMemos, setObjectMemos] = useState<ObjectMemo[]>([]);
    const [selectedObjectMemoId, setSelectedObjectMemoId] = useState<string | null>(null);

    // Drawing State (on object canvas)
    const objectDrawCanvasRef = useRef<HTMLCanvasElement>(null);
    const [objectDrawCtx, setObjectDrawCtx] = useState<CanvasRenderingContext2D | null>(null);
    const [isDrawingOnObject, setIsDrawingOnObject] = useState(false);
    const [objectDrawTool, setObjectDrawTool] = useState<'draw' | 'erase' | 'rectangle'>('draw');
    const [objectDrawBrushSize, setObjectDrawBrushSize] = useState(20);
    const [objectEraseBrushSize, setObjectEraseBrushSize] = useState(40);
    const [objectBrushColor, setObjectBrushColor] = useState('#ffffff');
    const strokeProcessorRef = useRef<StrokeProcessor>(new StrokeProcessor());

    // History
    const [objectHistory, setObjectHistory] = useState<{ objectStates: ObjectState[], objectMemos: ObjectMemo[], selectedObjectId: string | null }[]>([]);
    const [objectHistoryIndex, setObjectHistoryIndex] = useState(-1);
    const maxObjectHistorySize = 20;

    // Drawing History
    const [objectDrawHistory, setObjectDrawHistory] = useState<string[]>([]);
    const [objectDrawHistoryIndex, setObjectDrawHistoryIndex] = useState(-1);

    // Prompt
    const [objectPrompt, setObjectPrompt] = useState('');
    const objectFileInputRef = useRef<HTMLInputElement>(null);



    // --- History Logic ---
    const saveObjectHistory = useCallback(() => {
        const snapshot = {
            objectStates: objectStates.map(s => ({ ...s })),
            objectMemos: objectMemos.map(m => ({ ...m })),
            selectedObjectId,
        };

        setObjectHistory(prev => {
            const newHistory = prev.slice(0, objectHistoryIndex + 1);
            newHistory.push(snapshot);
            if (newHistory.length > maxObjectHistorySize) {
                newHistory.shift();
                return newHistory; // index needs adjustment? usually we just set index to length-1
            }
            return newHistory;
        });
        setObjectHistoryIndex(prev => {
            // If we sliced, the length changed. 
            // Simpler: just calculate new index based on newHistory length
            const newLength = Math.min(objectHistoryIndex + 2, maxObjectHistorySize + 1); // rough estimate logic update needed
            // Actually simpler:
            // We just use the setState callback which gives fresh prev
            return prev + 1; // wait, this is tricky inside.
            // Let's rely on the useEffect below to sync index if needed?
            // No, let's just set it to length - 1 of the new array.
            // Correct implementation:
            // See unifiedEditorModal logic:
            // setObjectHistoryIndex(newHistory.length - 1);
        });
    }, [objectStates, objectMemos, selectedObjectId, objectHistoryIndex]);

    // Better implementation of saveObjectHistory matching original
    const saveObjectHistoryCorrect = useCallback(() => {
        const snapshot = {
            objectStates: objectStates.map(s => ({ ...s })),
            objectMemos: objectMemos.map(m => ({ ...m })),
            selectedObjectId,
        };
        setObjectHistory(prev => {
            const newHistory = prev.slice(0, objectHistoryIndex + 1);
            newHistory.push(snapshot);
            if (newHistory.length > maxObjectHistorySize) {
                newHistory.shift();
            }
            setObjectHistoryIndex(newHistory.length - 1);
            return newHistory;
        });
    }, [objectStates, objectMemos, selectedObjectId, objectHistoryIndex]);

    const handleObjectFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            onNotification(t('error.uploadImage'), 'error');
            return;
        }

        const src = blobManager.create(file);
        const img = new Image();
        img.onload = () => {
            const baseSize = Math.min(imageSize.width, imageSize.height) * 0.3;
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const initialWidth = aspectRatio >= 1 ? baseSize : baseSize * aspectRatio;
            const initialHeight = aspectRatio < 1 ? baseSize : baseSize / aspectRatio;

            const newObject: ObjectState = {
                id: crypto.randomUUID(),
                file,
                src,
                transform: {
                    x: (imageSize.width / 2) - (initialWidth / 2),
                    y: (imageSize.height / 2) - (initialHeight / 2),
                    width: initialWidth,
                    height: initialHeight,
                    rotation: 0
                }
            };

            setObjectStates(prev => [...prev, newObject]);
            useCanvasStore.getState().addObjectEditorImage({ id: newObject.id, src: newObject.src, file: newObject.file });
            setSelectedObjectId(newObject.id);
            setObjectMode('select'); // Auto-enable edit mode on insert
            setTimeout(() => saveObjectHistoryCorrect(), 0);
        };
        img.src = src;
    }, [imageSize, saveObjectHistoryCorrect, onNotification, t, setObjectStates, setSelectedObjectId, setObjectMode]);

    const undoObjectOperation = useCallback(() => {
        if (objectHistoryIndex <= 0) return;
        const newIndex = objectHistoryIndex - 1;
        const snapshot = objectHistory[newIndex];
        setObjectStates(snapshot.objectStates.map(s => ({ ...s })));
        setObjectMemos(snapshot.objectMemos.map(m => ({ ...m })));
        setSelectedObjectId(snapshot.selectedObjectId);
        setObjectHistoryIndex(newIndex);
    }, [objectHistory, objectHistoryIndex]);

    const redoObjectOperation = useCallback(() => {
        if (objectHistoryIndex >= objectHistory.length - 1) return;
        const newIndex = objectHistoryIndex + 1;
        const snapshot = objectHistory[newIndex];
        setObjectStates(snapshot.objectStates.map(s => ({ ...s })));
        setObjectMemos(snapshot.objectMemos.map(m => ({ ...m })));
        setSelectedObjectId(snapshot.selectedObjectId);
        setObjectHistoryIndex(newIndex);
    }, [objectHistory, objectHistoryIndex]);

    // --- Object Management ---
    const removeObject = useCallback((id: string) => {
        setObjectStates(prev => prev.filter(obj => obj.id !== id));
        useCanvasStore.getState().removeObjectEditorImage(id);
        if (selectedObjectId === id) setSelectedObjectId(null);
        saveObjectHistoryCorrect();
    }, [selectedObjectId, saveObjectHistoryCorrect]);

    const flipObject = useCallback((id: string) => {
        setObjectStates(prev => prev.map(obj => {
            if (obj.id === id) {
                // Toggle the flipped property (horizontal flip)
                return { ...obj, flipped: !obj.flipped };
            }
            return obj;
        }));
        saveObjectHistoryCorrect();
    }, [saveObjectHistoryCorrect]);

    // --- Drawing on Object Canvas ---
    useEffect(() => {
        if (objectDrawCtx) {
            objectDrawCtx.lineCap = 'round';
            objectDrawCtx.lineJoin = 'round';
        }
        const isEraser = objectDrawTool === 'erase';
        strokeProcessorRef.current.updateSettings({
            size: isEraser ? objectEraseBrushSize : objectDrawBrushSize,
            color: objectBrushColor,
            minSizeRatio: 0.05,
        });
        strokeProcessorRef.current.setEraserMode(isEraser);
    }, [objectDrawBrushSize, objectEraseBrushSize, objectDrawTool, objectDrawCtx, objectBrushColor]);

    const saveObjectDrawState = useCallback(() => {
        if (!objectDrawCanvasRef.current) return;
        const url = objectDrawCanvasRef.current.toDataURL();
        const newHistory = objectDrawHistory.slice(0, objectDrawHistoryIndex + 1);
        setObjectDrawHistory([...newHistory, url]);
        setObjectDrawHistoryIndex(newHistory.length);
    }, [objectDrawHistory, objectDrawHistoryIndex]);

    const clearObjectDraw = useCallback(() => {
        if (objectDrawCtx) {
            objectDrawCtx.clearRect(0, 0, objectDrawCtx.canvas.width, objectDrawCtx.canvas.height);
            saveObjectDrawState();
        }
    }, [objectDrawCtx, saveObjectDrawState]);

    const handleObjectDrawUndo = useCallback(() => {
        if (objectDrawHistoryIndex > 0) {
            const newIndex = objectDrawHistoryIndex - 1;
            setObjectDrawHistoryIndex(newIndex);
            const img = new Image();
            img.src = objectDrawHistory[newIndex];
            img.onload = () => {
                if (objectDrawCtx) {
                    objectDrawCtx.clearRect(0, 0, objectDrawCtx.canvas.width, objectDrawCtx.canvas.height);
                    objectDrawCtx.drawImage(img, 0, 0);
                }
            };
        }
    }, [objectDrawHistory, objectDrawHistoryIndex, objectDrawCtx]);

    const handleObjectDrawRedo = useCallback(() => {
        if (objectDrawHistoryIndex < objectDrawHistory.length - 1) {
            const newIndex = objectDrawHistoryIndex + 1;
            setObjectDrawHistoryIndex(newIndex);
            const img = new Image();
            img.src = objectDrawHistory[newIndex];
            img.onload = () => {
                if (objectDrawCtx) {
                    objectDrawCtx.clearRect(0, 0, objectDrawCtx.canvas.width, objectDrawCtx.canvas.height);
                    objectDrawCtx.drawImage(img, 0, 0);
                }
            };
        }
    }, [objectDrawHistory, objectDrawHistoryIndex, objectDrawCtx]);

    // Drawing Handlers
    const getObjectDrawCoords = (e: React.PointerEvent) => {
        const canvas = e.currentTarget as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        return { x, y };
    };

    const startDrawingOnObject = useCallback((e: React.PointerEvent) => {
        if (!objectDrawCtx || objectMode !== 'draw') return;
        const canvas = objectDrawCanvasRef.current;
        if (!canvas) return;
        setIsDrawingOnObject(true);
        const point = createStrokePointFromEvent(e, canvas);
        strokeProcessorRef.current.beginStroke(objectDrawCtx, point);
    }, [objectDrawCtx, objectMode]);

    const drawOnObject = useCallback((e: React.PointerEvent) => {
        if (!isDrawingOnObject || !objectDrawCtx || objectMode !== 'draw') return;
        const canvas = objectDrawCanvasRef.current;
        if (!canvas) return;
        const point = createStrokePointFromEvent(e, canvas);
        strokeProcessorRef.current.continueStroke(objectDrawCtx, point);
    }, [isDrawingOnObject, objectDrawCtx, objectMode]);

    const finishDrawingOnObject = useCallback(() => {
        if (!isDrawingOnObject || !objectDrawCtx) return;
        strokeProcessorRef.current.endStroke();
        setIsDrawingOnObject(false);
        saveObjectDrawState();
    }, [isDrawingOnObject, objectDrawCtx, saveObjectDrawState]);

    // Cleanup drawing if tool changes or mode changes
    useEffect(() => {
        setIsDrawingOnObject(false);
        // We don't clear context here, we persist history
    }, [objectDrawTool, objectMode]);

    // --- File Handling ---
    const handleObjectUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const objectUrl = blobManager.create(file);
            const img = new Image();
            img.onload = () => {
                const newObject: ObjectState = {
                    id: `obj-${Date.now()}-${Math.random()}`,
                    file: file,
                    src: objectUrl,
                    transform: {
                        x: (imageSize.width - 100) / 2,
                        y: (imageSize.height - 100) / 2,
                        width: 100,
                        height: 100 * (img.naturalHeight / img.naturalWidth),
                        rotation: 0
                    }
                };
                setObjectStates(prev => [...prev, newObject]);
                useCanvasStore.getState().addObjectEditorImage({ id: newObject.id, src: newObject.src, file: newObject.file });
                setSelectedObjectId(newObject.id);
                setTimeout(() => saveObjectHistoryCorrect(), 0);
            };
            img.src = objectUrl;
            e.target.value = ''; // Reset input
        }
    };

    // --- Handlers for Global Events (Paste/Insert) ---
    // These should likely be exposed or attached via useEffect inside the hook 
    // BUT since they depend on window events, it's better to attach them here if possible
    // or expose handlers to be called by parent.
    // The original attached them to window in UnifiedEditorModal.
    // We can move that logic here.

    // --- Canvas Store Integration ---
    const { insertTargetImage, setInsertTargetImage, setObjectInsertMode } = useCanvasStore();

    useEffect(() => {
        if (insertTargetImage && activeTool === 'object') {
            const handlePasteFromCanvas = async () => {
                try {
                    // Use the File object directly if available to avoid revoked blob URL issues
                    const blob = insertTargetImage.file
                        ? insertTargetImage.file
                        : await fetch(insertTargetImage.src).then(r => r.blob());
                    const newBlobUrl = blobManager.create(blob);

                    // Load image to get actual dimensions for proper sizing
                    const img = new Image();
                    await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = () => reject(new Error('Failed to load image'));
                        img.src = newBlobUrl;
                    });

                    // Fixed initial size: width 200, height proportional to aspect ratio
                    // User will resize as needed; starting small prevents exceeding original size
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    const initialWidth = 200;
                    const initialHeight = initialWidth / aspectRatio;

                    const newObject: ObjectState = {
                        id: `obj-${Date.now()}-${Math.random()}`,
                        src: newBlobUrl,
                        transform: {
                            x: (imageSize.width / 2) - (initialWidth / 2),
                            y: (imageSize.height / 2) - (initialHeight / 2),
                            width: initialWidth,
                            height: initialHeight,
                            rotation: 0
                        }
                    };
                    setObjectStates(prev => [...prev, newObject]);
                    useCanvasStore.getState().addObjectEditorImage({ id: newObject.id, src: newObject.src });
                    setSelectedObjectId(newObject.id);
                    setObjectMode('transform');
                    setTimeout(() => saveObjectHistoryCorrect(), 0);
                    onNotification(t('common.paste.success') || 'Image Inserted', 'success');
                } catch (err) {
                    console.error('[ObjectInsert] Failed to copy image from canvas:', err);
                    onNotification(t('error.pasteFailed'), 'error');
                } finally {
                    setInsertTargetImage(null);
                }
            };
            handlePasteFromCanvas();
        }
    }, [insertTargetImage, activeTool, imageSize, saveObjectHistoryCorrect, setInsertTargetImage, onNotification, t]);

    // --- Handlers for Global Events (Paste/Insert) ---
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (activeTool !== 'object') return;

            // If user is typing in an input (like prompt), don't intercept paste
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.clipboardData && e.clipboardData.files.length > 0) {
                // Find first image file
                for (let i = 0; i < e.clipboardData.files.length; i++) {
                    const file = e.clipboardData.files[i];
                    if (file.type.startsWith('image/')) {
                        e.preventDefault();
                        e.stopPropagation();

                        const objectUrl = blobManager.create(file);
                        const img = new Image();
                        img.onload = () => {
                            const newObject: ObjectState = {
                                id: `obj-${Date.now()}-${Math.random()}`,
                                file: file,
                                src: objectUrl,
                                transform: {
                                    x: (imageSize.width - 100) / 2, // Center roughly
                                    y: (imageSize.height - 100) / 2,
                                    width: 100,
                                    height: 100 * (img.naturalHeight / img.naturalWidth),
                                    rotation: 0
                                }
                            };
                            setObjectStates(prev => [...prev, newObject]);
                            useCanvasStore.getState().addObjectEditorImage({ id: newObject.id, src: newObject.src, file: newObject.file });
                            setSelectedObjectId(newObject.id);
                            setTimeout(() => saveObjectHistoryCorrect(), 0);
                        };
                        img.src = objectUrl;
                        return; // Handle one image at a time
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [activeTool, imageSize, saveObjectHistoryCorrect]);

    useEffect(() => {
        const handleObjectInsertFromCanvas = (e: CustomEvent<{ imageId: string, imageSrc: string }>) => {
            if (activeTool !== 'object') return;
            const { imageSrc } = e.detail;
            if (imageSrc.startsWith('blob:')) blobManager.addRef(imageSrc);

            const img = new Image();
            img.onload = () => {
                const newObject: ObjectState = {
                    id: `obj-${Date.now()}-${Math.random()}`,
                    src: imageSrc,
                    transform: {
                        x: (imageSize.width - 100) / 2,
                        y: (imageSize.height - 100) / 2,
                        width: 100,
                        height: 100 * (img.naturalHeight / img.naturalWidth),
                        rotation: 0
                    }
                };
                setObjectStates(prev => [...prev, newObject]);
                useCanvasStore.getState().addObjectEditorImage({ id: newObject.id, src: newObject.src });
                setSelectedObjectId(newObject.id);
                setTimeout(() => saveObjectHistoryCorrect(), 0);
            };
            img.src = imageSrc;
        };
        window.addEventListener('object-insert-from-canvas' as any, handleObjectInsertFromCanvas);
        return () => window.removeEventListener('object-insert-from-canvas' as any, handleObjectInsertFromCanvas);
    }, [activeTool, imageSize, saveObjectHistoryCorrect]);


    // Memo Logic
    const updateObjectMemo = useCallback((id: string, updates: Partial<ObjectMemo>) => {
        setObjectMemos(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        // Debounce history save? Or save on blur/finalize. 
        // Original didn't explicitly save history on every keystroke usually.
    }, []);

    const deleteObjectMemo = useCallback((id: string) => {
        setObjectMemos(prev => prev.filter(m => m.id !== id));
        if (selectedObjectMemoId === id) setSelectedObjectMemoId(null);
        saveObjectHistoryCorrect();
    }, [selectedObjectMemoId, saveObjectHistoryCorrect]);


    // Context Menu Handlers (Copy/Paste)
    const handleCopyObject = useCallback(async () => {
        if (!selectedObjectId) return;
        const obj = objectStates.find(o => o.id === selectedObjectId);
        if (obj) {
            try {
                const response = await fetch(obj.src);
                const blob = await response.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
                onNotification(t('common.copied'), 'success'); // Assuming t handles common.copied
            } catch (e) {
                onNotification(t('error.copyFailed'), 'error');
            }
        }
    }, [selectedObjectId, objectStates, onNotification, t]);

    const handlePasteObject = useCallback(async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const url = blobManager.create(blob);
                    const img = new Image();
                    img.onload = () => {
                        const newObject: ObjectState = {
                            id: `obj-${Date.now()}-${Math.random()}`,
                            src: url,
                            transform: {
                                x: (imageSize.width - 100) / 2,
                                y: (imageSize.height - 100) / 2,
                                width: 100,
                                height: 100 * (img.naturalHeight / img.naturalWidth),
                                rotation: 0
                            }
                        };
                        setObjectStates(prev => [...prev, newObject]);
                        useCanvasStore.getState().addObjectEditorImage({ id: newObject.id, src: newObject.src });
                        setSelectedObjectId(newObject.id);
                        setTimeout(() => saveObjectHistoryCorrect(), 0);
                        onNotification(t('drawing.paste.success') || 'Image pasted', 'success');
                    };
                    img.src = url;
                    break;
                }
            }
        } catch (e) {
            onNotification(t('error.pasteFailed'), 'error');
        }
    }, [imageSize, saveObjectHistoryCorrect, onNotification, t]);


    // Reset
    const resetObjectHistory = useCallback(() => {
        setObjectHistory([]);
        setObjectHistoryIndex(-1);
        setObjectDrawHistory([]);
        setObjectDrawHistoryIndex(-1);
    }, []);

    const resetObjectEditor = useCallback(() => {
        setObjectStates([]);
        useCanvasStore.getState().clearObjectEditorImages();
        useCanvasStore.getState().setInsertTargetImage(null);
        setObjectMemos([]);
        setSelectedObjectId(null);
        setSelectedObjectMemoId(null);
        if (objectDrawCtx) {
            objectDrawCtx.clearRect(0, 0, objectDrawCtx.canvas.width, objectDrawCtx.canvas.height);
        }
        setObjectDrawHistory([]);
        setObjectDrawHistoryIndex(-1);
        setObjectHistory([]);
        setObjectHistoryIndex(-1);
    }, [objectDrawCtx]);


    return {
        // State
        objectStates, setObjectStates,
        selectedObjectId, setSelectedObjectId,
        objectMode, setObjectMode,
        objectContextMenu, setObjectContextMenu,
        objectMemos, setObjectMemos,
        selectedObjectMemoId, setSelectedObjectMemoId,
        objectPrompt, setObjectPrompt,

        // Drawing State
        objectDrawCanvasRef,
        objectDrawCtx, setObjectDrawCtx,
        isDrawingOnObject, setIsDrawingOnObject,
        objectDrawTool, setObjectDrawTool,
        objectDrawBrushSize, setObjectDrawBrushSize,
        objectEraseBrushSize, setObjectEraseBrushSize,
        objectBrushColor, setObjectBrushColor,

        // History State
        objectHistoryIndex,
        objectHistoryLength: objectHistory.length,
        objectDrawHistoryIndex,
        objectDrawHistoryLength: objectDrawHistory.length,

        // Handlers
        saveObjectHistory: saveObjectHistoryCorrect,
        undoObjectOperation,
        redoObjectOperation,
        removeObject,
        flipObject,

        // Drawing Handlers
        saveObjectDrawState,
        clearObjectDraw,
        handleObjectDrawUndo,
        handleObjectDrawRedo,
        startDrawingOnObject,
        drawOnObject,
        finishDrawingOnObject,

        // File/IO
        objectFileInputRef,
        handleObjectUploadChange,
        handleObjectFile,

        handleCopyObject,
        handlePasteObject,

        // Memos
        updateObjectMemo,
        deleteObjectMemo,

        resetObjectHistory,
        resetObjectEditor,
        objectDrawHistory,
        objectHistory
    };
};

