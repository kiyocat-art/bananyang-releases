import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { t, Language } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';
import { UndoIcon, RedoIcon, ResetIcon } from '../../../components/icons';
import {
  StrokeProcessor,
  createStrokePointFromEvent,
  applyPressureCurve,
  PressureCurveType,
} from '../utils/pressureBrush';

interface Memo {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

interface AddedImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawingCanvasProps {
  onDrawEnd: (file: File | null) => void;
  language: Language;
  backgroundImage?: File | null;
  isInsertMode?: boolean;
  onDoubleClick?: (e: React.MouseEvent) => void;
  /** 반투명 밑그림 오버레이 URL (내보내기에 포함되지 않음) */
  referenceOverlayUrl?: string | null;
  /** 오버레이 불투명도 (0~1, 기본 0.4) */
  overlayOpacity?: number;
}

export interface DrawingCanvasRef {
  clear: () => void;
  exportImage: () => Promise<File | null>;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({ onDrawEnd, language, backgroundImage, isInsertMode = false, onDoubleClick, referenceOverlayUrl, overlayOpacity = 0.4 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageUrlRef = useRef<string | null>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (bgImageUrlRef.current) {
        URL.revokeObjectURL(bgImageUrlRef.current);
      }
    };
  }, []);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawBrushSize, setDrawBrushSize] = useState(5);
  const [eraseBrushSize, setEraseBrushSize] = useState(20);
  const [tool, setTool] = useState<'draw' | 'erase'>('draw');
  const [brushColor, setBrushColor] = useState('#FFFFFF');

  // Pressure Brush Settings
  const pressureCurve: PressureCurveType = 'linear';
  const strokeProcessorRef = useRef<StrokeProcessor>(new StrokeProcessor());

  // History now stores canvas state, memo state, and added images state
  const [history, setHistory] = useState<{ canvasUrl: string; memos: Memo[]; addedImages: AddedImage[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [currentDynamicBrushSize, setCurrentDynamicBrushSize] = useState(5);
  const [currentPressure, setCurrentPressure] = useState(0.5);

  // Memo State
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [isDraggingMemo, setIsDraggingMemo] = useState(false);

  // Added Images State
  const [addedImages, setAddedImages] = useState<AddedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const currentBrushSize = useMemo(() => (tool === 'draw' ? drawBrushSize : eraseBrushSize), [tool, drawBrushSize, eraseBrushSize]);
  const setCurrentBrushSize = useCallback((value: React.SetStateAction<number>) => {
    if (tool === 'draw') {
      setDrawBrushSize(value);
    } else {
      setEraseBrushSize(value);
    }
  }, [tool]);

  // Load background image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx) return;

    if (backgroundImage) {
      // Revoke previous URL if exists
      if (bgImageUrlRef.current) URL.revokeObjectURL(bgImageUrlRef.current);

      const url = URL.createObjectURL(backgroundImage);
      bgImageUrlRef.current = url;

      const img = new Image();
      img.src = url;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw background image fitting the canvas while maintaining aspect ratio
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        // Save initial state with background
        const dataUrl = canvas.toDataURL();
        setHistory([{ canvasUrl: dataUrl, memos: [], addedImages: [] }]);
        setHistoryIndex(0);
      };
    } else {
      if (bgImageUrlRef.current) {
        URL.revokeObjectURL(bgImageUrlRef.current);
        bgImageUrlRef.current = null;
      }

      // Save initial blank state
      const dataUrl = canvas.toDataURL();
      if (history.length === 0) {
        setHistory([{ canvasUrl: dataUrl, memos: [], addedImages: [] }]);
        setHistoryIndex(0);
      }
    }
  }, [backgroundImage, ctx]); // Only re-run if background changes significantly

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context) {
      context.lineCap = 'round';
      context.lineJoin = 'round';
      setCtx(context);
    }
  }, []);

  useEffect(() => {
    if (!ctx) return;
    ctx.lineWidth = currentBrushSize;
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = tool === 'erase' ? 'rgba(0,0,0,1)' : brushColor;
    setCurrentDynamicBrushSize(currentBrushSize);
  }, [currentBrushSize, tool, ctx, brushColor]);

  const saveState = useCallback(() => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL();
    const newHistory = history.slice(0, historyIndex + 1);

    // Limit history size to prevent memory issues
    const MAX_HISTORY_SIZE = 20;
    if (newHistory.length >= MAX_HISTORY_SIZE) {
      newHistory.shift(); // Remove oldest state
    }

    // Save canvas state, current memos, and added images
    setHistory([...newHistory, { canvasUrl: url, memos: [...memos], addedImages: [...addedImages] }]);
    setHistoryIndex(newHistory.length >= MAX_HISTORY_SIZE ? MAX_HISTORY_SIZE - 1 : newHistory.length);
  }, [history, historyIndex, memos, addedImages]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const historyState = history[newIndex];
      const img = new Image();
      img.src = historyState.canvasUrl;
      img.onload = () => {
        ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx?.drawImage(img, 0, 0);
      };
      // Restore memos and images from history
      setMemos([...historyState.memos]);
      setAddedImages([...historyState.addedImages]);
      setSelectedMemoId(null);
      setSelectedImageId(null);
    }
  }, [history, historyIndex, ctx]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const historyState = history[newIndex];
      const img = new Image();
      img.src = historyState.canvasUrl;
      img.onload = () => {
        ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx?.drawImage(img, 0, 0);
      };
      // Restore memos and images from history
      setMemos([...historyState.memos]);
      setAddedImages([...historyState.addedImages]);
      setSelectedMemoId(null);
      setSelectedImageId(null);
    }
  }, [history, historyIndex, ctx]);

  // Update StrokeProcessor settings when brush settings change
  useEffect(() => {
    const processor = strokeProcessorRef.current;
    processor.updateSettings({
      size: currentBrushSize,
      color: brushColor,
      pressureCurve,
      minSizeRatio: 0.05, // 5% minimum size for thin strokes
    });
    processor.setEraserMode(tool === 'erase');
  }, [currentBrushSize, brushColor, pressureCurve, tool]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ctx || !canvasRef.current) return;
    setIsDrawing(true);

    const point = createStrokePointFromEvent(e, canvasRef.current);
    strokeProcessorRef.current.beginStroke(ctx, point);

    // Update dynamic brush size for cursor
    const transformedPressure = applyPressureCurve(point.pressure, pressureCurve);
    const dynamicSize = currentBrushSize * (0.05 + transformedPressure * 0.95);
    setCurrentDynamicBrushSize(dynamicSize);
    setCurrentPressure(point.pressure);
  };

  const finishDrawing = () => {
    if (!ctx || !isDrawing) return;
    setIsDrawing(false);
    strokeProcessorRef.current.endStroke();
    saveState();
    exportImage().then(file => onDrawEnd(file));
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;

    const point = createStrokePointFromEvent(e, canvasRef.current);
    strokeProcessorRef.current.continueStroke(ctx, point);

    // Update dynamic brush size for cursor
    const transformedPressure = applyPressureCurve(point.pressure, pressureCurve);
    const dynamicSize = currentBrushSize * (0.05 + transformedPressure * 0.95);
    setCurrentDynamicBrushSize(dynamicSize);
    setCurrentPressure(point.pressure);
  };

  const handleCursorMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    if (e.pointerType === 'pen' && e.buttons > 0) {
      const pressure = e.pressure;
      const transformedPressure = applyPressureCurve(pressure, pressureCurve);
      setCurrentDynamicBrushSize(currentBrushSize * (0.05 + transformedPressure * 0.95));
      setCurrentPressure(pressure);
    } else if (e.pointerType === 'pen') {
      // Pen hovering - show pressure indicator at default
      setCurrentDynamicBrushSize(currentBrushSize * 0.3);
      setCurrentPressure(0);
    } else {
      // Mouse - show full size
      setCurrentDynamicBrushSize(currentBrushSize);
      setCurrentPressure(0.5);
    }
  };

  const clearCanvas = useCallback(() => {
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (backgroundImage && bgImageUrlRef.current) {
        // Redraw background if it exists
        const img = new Image();
        img.src = bgImageUrlRef.current;
        img.onload = () => {
          const scale = Math.min(ctx.canvas.width / img.width, ctx.canvas.height / img.height);
          const x = (ctx.canvas.width / 2) - (img.width / 2) * scale;
          const y = (ctx.canvas.height / 2) - (img.height / 2) * scale;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          saveState();
          onDrawEnd(null);
        };
      } else {
        saveState();
        onDrawEnd(null);
      }
      setMemos([]); // Clear memos
      setAddedImages([]); // Clear added images
    }
  }, [ctx, onDrawEnd, saveState, backgroundImage]);

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInsertMode) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isInsertMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    const processImageSource = (src: string, offsetX: number = 0, offsetY: number = 0) => {
      const img = new Image();
      img.crossOrigin = "Anonymous"; // Try to handle CORS
      img.onload = () => {
        // Default size or scaled down if too big
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const maxSize = 500;
        if (width > maxSize || height > maxSize) {
          const scale = Math.min(maxSize / width, maxSize / height);
          width *= scale;
          height *= scale;
        }

        setAddedImages(prev => {
          const newImages = [...prev, {
            id: crypto.randomUUID(),
            src,
            x: dropX + offsetX,
            y: dropY + offsetY,
            width,
            height
          }];
          setTimeout(() => saveState(), 100);
          return newImages;
        });
      };
      img.src = src;
    };

    // 1. Handle Files
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      imageFiles.forEach((file, index) => {
        const src = URL.createObjectURL(file);
        // Adjust position slightly for multiple files
        processImageSource(src, index * 20, index * 20);
      });
      return;
    }

    // 2. Handle URLs (e.g. from web)
    const imageUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (imageUrl && (imageUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || imageUrl.startsWith('data:image'))) {
      processImageSource(imageUrl);
    }
  }, [saveState, isInsertMode]);

  // Image Interaction Handlers
  const handleImageMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedImageId(id);
    setSelectedMemoId(null); // Deselect memo
    setIsDraggingImage(true);
    const image = addedImages.find(img => img.id === id);
    if (image) {
      setDragOffset({ x: e.clientX - image.x, y: e.clientY - image.y });
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (isDraggingImage && selectedImageId) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      setAddedImages(addedImages.map(img => img.id === selectedImageId ? { ...img, x: newX, y: newY } : img));
    }
  };

  const handleImageMouseUp = () => {
    if (isDraggingImage) {
      setIsDraggingImage(false);
      setTimeout(() => saveState(), 0);
    }
  };

  const updateImage = (id: string, updates: Partial<AddedImage>) => {
    setAddedImages(addedImages.map(img => img.id === id ? { ...img, ...updates } : img));
    setTimeout(() => saveState(), 0);
  };

  const deleteImage = (id: string) => {
    setAddedImages(addedImages.filter(img => img.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
    setTimeout(() => saveState(), 0);
  };

  // Memo Functions
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newMemo: Memo = {
      id: crypto.randomUUID(),
      text: '',
      x,
      y,
      fontSize: 14,
      color: '#FFFF00', // Default yellow
    };
    setMemos([...memos, newMemo]);
    setSelectedMemoId(newMemo.id);
    setSelectedImageId(null); // Deselect image
    // Save state after adding memo for undo/redo
    setTimeout(() => saveState(), 0);
  };

  const handleMemoMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedMemoId(id);
    setSelectedImageId(null); // Deselect image
    setIsDraggingMemo(true);
    const memo = memos.find(m => m.id === id);
    if (memo) {
      setDragOffset({ x: e.clientX - memo.x, y: e.clientY - memo.y });
    }
  };

  const handleMemoMouseMove = (e: React.MouseEvent) => {
    if (isDraggingMemo && selectedMemoId) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let newX = e.clientX - dragOffset.x;
      let newY = e.clientY - dragOffset.y;

      setMemos(memos.map(m => m.id === selectedMemoId ? { ...m, x: newX, y: newY } : m));
    }
  };

  const handleMemoMouseUp = () => {
    if (isDraggingMemo) {
      setIsDraggingMemo(false);
      setTimeout(() => saveState(), 0);
    }
  };

  const updateMemo = (id: string, updates: Partial<Memo>) => {
    setMemos(memos.map(m => m.id === id ? { ...m, ...updates } : m));
    setTimeout(() => saveState(), 0);
  };

  const deleteMemo = (id: string) => {
    setMemos(memos.filter(m => m.id !== id));
    if (selectedMemoId === id) setSelectedMemoId(null);
    setTimeout(() => saveState(), 0);
  };

  const exportImage = async (): Promise<File | null> => {
    if (!canvasRef.current) return null;

    // Create a temporary canvas to combine drawing, memos, and added images
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    // Draw the current canvas content (background + drawing)
    tempCtx.drawImage(canvasRef.current, 0, 0);

    // Draw added images
    // We need to wait for all images to load if they aren't already (though they should be)
    // Since we have src, we can draw them
    const imagePromises = addedImages.map(imgData => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          tempCtx.drawImage(img, imgData.x, imgData.y, imgData.width, imgData.height);
          resolve();
        };
        img.onerror = () => resolve(); // Skip on error
        img.src = imgData.src;
      });
    });

    await Promise.all(imagePromises);

    // Draw memos
    tempCtx.textBaseline = 'top';
    memos.forEach(memo => {
      tempCtx.font = `${memo.fontSize}px sans-serif`;
      tempCtx.fillStyle = memo.color;
      tempCtx.fillText(memo.text || t('drawing.memo.placeholder', language), memo.x, memo.y);
    });

    return new Promise((resolve) => {
      tempCanvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "annotated_image.png", { type: "image/png" });
          resolve(file);
        } else {
          resolve(null);
        }
      });
    });
  };

  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    exportImage
  }));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); handleRedo(); }
      else if (e.key === 'b') { e.preventDefault(); setTool('draw'); }
      else if (e.key === 'e') { e.preventDefault(); setTool('erase'); }
      else if (e.key === 'Delete') {
        if (selectedMemoId) { e.preventDefault(); deleteMemo(selectedMemoId); }
        if (selectedImageId) { e.preventDefault(); deleteImage(selectedImageId); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, clearCanvas, selectedMemoId, selectedImageId]);


  const handleResetBrushSize = () => {
    if (tool === 'draw') {
      setDrawBrushSize(5);
    } else {
      setEraseBrushSize(20);
    }
  };

  // Unified mouse move/up handler for container
  const handleContainerMouseMove = (e: React.MouseEvent) => {
    handleMemoMouseMove(e);
    handleImageMouseMove(e);
  };

  const handleContainerMouseUp = () => {
    handleMemoMouseUp();
    handleImageMouseUp();
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div
        className="relative overflow-hidden rounded-md border border-neutral-700 bg-neutral-900"
        onPointerEnter={() => setIsCursorVisible(true)}
        onPointerLeave={() => setIsCursorVisible(false)}
        onPointerMove={handleCursorMove}
        onContextMenu={handleContextMenu}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDoubleClick={onDoubleClick}
        style={{ width: '100%', maxWidth: '600px', height: 'auto', aspectRatio: '3/4' }} // Fixed size for editor
      >
        {/* 반투명 포즈 밑그림 오버레이 — 내보내기(export)에 포함되지 않음 */}
        {referenceOverlayUrl && (
          <img
            src={referenceOverlayUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            style={{ opacity: overlayOpacity, zIndex: 0 }}
            draggable={false}
          />
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerUp={finishDrawing}
          onPointerMove={draw}
          onPointerLeave={finishDrawing}
          width={768}
          height={1024}
          className="bg-transparent touch-none cursor-none relative"
          style={{ zIndex: 1 }}
        />
        {/* Cursor */}
        {isCursorVisible && !isDraggingMemo && !isDraggingImage && (
          <div
            className="absolute bg-transparent border border-white/80 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: currentDynamicBrushSize,
              height: currentDynamicBrushSize,
              transition: 'width 0.05s ease-out, height 0.05s ease-out',
              borderColor: tool === 'erase' ? 'white' : brushColor
            }}
          />
        )}

        {/* Added Images */}
        {addedImages.map(img => (
          <div
            key={img.id}
            className={`absolute border ${selectedImageId === img.id ? 'border-blue-500' : 'border-transparent hover:border-white/30'}`}
            style={{
              left: img.x,
              top: img.y,
              width: img.width,
              height: img.height,
              cursor: isInsertMode ? 'move' : 'default',
              pointerEvents: isInsertMode ? 'auto' : 'none'
            }}
            onMouseDown={(e) => isInsertMode && handleImageMouseDown(e, img.id)}
          >
            <img
              src={img.src}
              alt="added"
              className="w-full h-full object-contain pointer-events-none"
            />
            {/* Resize Handle (Simple bottom-right corner) */}
            {selectedImageId === img.id && isInsertMode && (
              <div
                className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // Implement resize logic here if needed, for now just a visual indicator or simple scale
                  // For simplicity in this iteration, we'll skip complex resize implementation
                }}
              />
            )}
          </div>
        ))}

        {/* Memos */}
        {memos.map(memo => (
          <div
            key={memo.id}
            className={`absolute p-1 border ${selectedMemoId === memo.id ? 'border-blue-500 bg-black/40' : 'border-transparent hover:border-white/30'}`}
            style={{ left: memo.x, top: memo.y, cursor: 'move' }}
            onMouseDown={(e) => handleMemoMouseDown(e, memo.id)}
          >
            <input
              type="text"
              value={memo.text}
              onChange={(e) => updateMemo(memo.id, { text: e.target.value })}
              placeholder={t('drawing.memo.placeholder', language)}
              className="bg-transparent border-none focus:ring-0 p-0 m-0 font-sans"
              style={{
                color: memo.color,
                fontSize: `${memo.fontSize}px`,
                width: `${Math.max(100, memo.text.length * memo.fontSize * 0.8)}px`
              }}
              onKeyDown={(e) => e.stopPropagation()} // Allow typing
            />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="w-full bg-black/20 border border-white/10 p-2 rounded-xl flex flex-col gap-2">
        {/* Tools Row */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2 flex-grow">
            <Tooltip tip={`${t('drawing.draw', language)} (B)`} position="top" className="flex-1"><button onClick={() => setTool('draw')} className={`w-full py-2 rounded-md text-xs ${tool === 'draw' ? 'bg-white text-zinc-800' : 'bg-white/10 hover:bg-white/20 text-zinc-200'}`}>{t('drawing.draw', language)}</button></Tooltip>
            <Tooltip tip={`${t('drawing.erase', language)} (E)`} position="top" className="flex-1"><button onClick={() => setTool('erase')} className={`w-full py-2 rounded-md text-xs ${tool === 'erase' ? 'bg-white text-zinc-800' : 'bg-white/10 hover:bg-white/20 text-zinc-200'}`}>{t('drawing.erase', language)}</button></Tooltip>
            <Tooltip tip={`${t('drawing.clear', language)}`} position="top" className="flex-1"><button onClick={clearCanvas} className="w-full py-2 rounded-md text-xs bg-red-600 hover:bg-red-500 text-white">{t('drawing.clear', language)}</button></Tooltip>
          </div>
          <div className="flex items-center gap-1 pl-2 ml-2 border-l border-white/10">
            <Tooltip tip={`${t('drawing.undo', language)} (Ctrl+Z)`} position="top"><button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 rounded-md text-zinc-200 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"><UndoIcon /></button></Tooltip>
            <Tooltip tip={`${t('drawing.redo', language)}`} position="top"><button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-1.5 rounded-md text-zinc-200 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"><RedoIcon /></button></Tooltip>
          </div>
        </div>

        {/* Brush Settings */}
        <div className="flex items-center gap-2">
          <label htmlFor="brush-size" className="text-xs text-zinc-300 whitespace-nowrap">{t('drawing.brushSize', language)}</label>
          <Tooltip tip={`${t('drawing.decreaseBrush', language)} / ${t('drawing.increaseBrush', language)}`} position="top" className="w-full">
            <input id="brush-size" type="range" min="0.5" max="100" step="0.1" value={currentBrushSize} onChange={e => setCurrentBrushSize(parseFloat(e.target.value))} className="w-full" />
          </Tooltip>
          <Tooltip tip={t('drawing.resetBrush', language)} position="top">
            <button onClick={handleResetBrushSize} className="p-1 rounded-full text-zinc-400 hover:bg-white/20 hover:text-white transition-colors">
              <ResetIcon />
            </button>
          </Tooltip>
          <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" title={t('drawing.brushColor', language)} />
        </div>

        {/* Memo Settings (Only visible when a memo is selected) */}
        {selectedMemoId && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs text-zinc-400 ">Memo:</span>
            <input
              type="number"
              min="10" max="50"
              value={memos.find(m => m.id === selectedMemoId)?.fontSize || 14}
              onChange={(e) => updateMemo(selectedMemoId, { fontSize: parseInt(e.target.value) })}
              className="w-12 h-6 text-xs bg-neutral-800 border border-neutral-600 rounded px-1 text-white"
              title={t('drawing.memo.textSize', language)}
            />
            <input
              type="color"
              value={memos.find(m => m.id === selectedMemoId)?.color || '#FFFF00'}
              onChange={(e) => updateMemo(selectedMemoId, { color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-none"
              title={t('drawing.memo.textColor', language)}
            />
            <button onClick={() => deleteMemo(selectedMemoId)} className="ml-auto text-xs text-red-400 hover:text-red-300 hover:underline">{t('drawing.memo.delete', language)}</button>
          </div>
        )}

        {/* Image Settings (Only visible when an image is selected) */}
        {selectedImageId && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs text-zinc-400 ">Image:</span>
            <span className="text-xs text-zinc-500">Drag to move</span>
            <button onClick={() => deleteImage(selectedImageId)} className="ml-auto text-xs text-red-400 hover:text-red-300 hover:underline">Delete Image</button>
          </div>
        )}
      </div>
    </div>
  );
});
