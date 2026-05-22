
import React from 'react';
import { TransformableObject } from '../../TransformableObject';
import { ObjectState, ObjectMemo, ObjectMode } from '../types';
import { Language } from '../../../../../localization';

interface ObjectOverlayProps {
    objectStates: ObjectState[];
    setObjectStates: React.Dispatch<React.SetStateAction<ObjectState[]>>;
    saveObjectHistory: () => void;
    zoom: number;
    objectMode: ObjectMode;
    selectedObjectId: string | null;
    setSelectedObjectId: (id: string) => void;
    removeObject: (id: string) => void;
    flipObject: (id: string) => void;
    viewportRef: React.RefObject<HTMLDivElement>;
    setObjectContextMenu: (menu: { x: number; y: number; objectId: string } | null) => void;
    objectDrawCanvasRef: React.RefObject<HTMLCanvasElement>;
    imageSize: { width: number; height: number; naturalWidth: number; naturalHeight: number };
    startDrawingOnObject: (e: React.PointerEvent) => void;
    finishDrawingOnObject: (e: React.PointerEvent) => void;
    drawOnObject: (e: React.PointerEvent) => void;
    handleObjectCanvasContextMenu: (e: React.MouseEvent) => void;
    handleObjectMemoMouseMove: (e: React.MouseEvent) => void;
    handleObjectMemoMouseUp: (e: React.MouseEvent) => void;
    isDraggingObjectMemo: boolean;
    objectMemos: ObjectMemo[];
    selectedObjectMemoId: string | null;
    handleObjectMemoMouseDown: (e: React.MouseEvent, id: string) => void;
    updateObjectMemo: (id: string, updates: Partial<ObjectMemo>) => void;
    t: (key: string, lang: string) => string;
    language: Language;
}

export const ObjectOverlay: React.FC<ObjectOverlayProps> = ({
    objectStates,
    setObjectStates,
    saveObjectHistory,
    zoom,
    objectMode,
    selectedObjectId,
    setSelectedObjectId,
    removeObject,
    flipObject,
    viewportRef,
    setObjectContextMenu,
    objectDrawCanvasRef,
    imageSize,
    startDrawingOnObject,
    finishDrawingOnObject,
    drawOnObject,
    handleObjectCanvasContextMenu,
    handleObjectMemoMouseMove,
    handleObjectMemoMouseUp,
    isDraggingObjectMemo,
    objectMemos,
    selectedObjectMemoId,
    handleObjectMemoMouseDown,
    updateObjectMemo,
    t,
    language
}) => {
    return (
        <>
            {objectStates.map(objState => (
                <TransformableObject
                    key={objState.id}
                    objectId={objState.id}
                    src={objState.src}
                    transform={objState.transform}
                    onTransform={(updater) => setObjectStates(prev => prev.map(s => s.id === objState.id ? { ...s, transform: updater(s.transform) } : s))}
                    onTransformEnd={() => saveObjectHistory()}
                    zoom={zoom}
                    isInteractive={objectMode === 'transform'}
                    isSelected={selectedObjectId === objState.id}
                    onSelect={() => setSelectedObjectId(objState.id)}
                    onDelete={() => removeObject(objState.id)}
                    onFlip={() => flipObject(objState.id)}
                    flipped={objState.flipped}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = viewportRef.current?.getBoundingClientRect();
                        setObjectContextMenu({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0), objectId: objState.id });
                    }}
                />
            ))}

            <canvas
                ref={objectDrawCanvasRef}
                width={imageSize.naturalWidth}
                height={imageSize.naturalHeight}
                onPointerDown={startDrawingOnObject}
                onPointerUp={finishDrawingOnObject}
                onPointerMove={drawOnObject}
                onPointerLeave={finishDrawingOnObject}
                onContextMenu={handleObjectCanvasContextMenu}
                onMouseMove={handleObjectMemoMouseMove}
                onMouseUp={handleObjectMemoMouseUp}
                onMouseLeave={handleObjectMemoMouseUp}
                className={`absolute top-0 left-0 w-full h-full ${objectMode === 'draw' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                style={{ cursor: isDraggingObjectMemo ? 'move' : (objectMode === 'draw' ? 'crosshair' : 'default') }}
            />

            {objectMemos.map(memo => {
                const rect = objectDrawCanvasRef.current?.getBoundingClientRect();
                if (!rect) return null;
                const screenX = (memo.x / imageSize.width) * imageSize.width;
                const screenY = (memo.y / imageSize.height) * imageSize.height;
                return (
                    <div
                        key={memo.id}
                        className={`absolute p-1 border ${selectedObjectMemoId === memo.id ? 'border-blue-500 bg-black/40' : 'border-transparent hover:border-white/30'}`}
                        style={{ left: screenX, top: screenY, cursor: 'move', pointerEvents: 'auto' }}
                        onMouseDown={(e) => handleObjectMemoMouseDown(e, memo.id)}
                    >
                        <input
                            type="text"
                            value={memo.text}
                            onChange={(e) => updateObjectMemo(memo.id, { text: e.target.value })}
                            placeholder={t('drawing.memo.placeholder', language)}
                            className="bg-transparent border-none focus:ring-0 p-0 m-0 font-sans"
                            style={{
                                color: memo.color,
                                fontSize: `${memo.fontSize}px`,
                                width: `${Math.max(100, memo.text.length * memo.fontSize * 0.8)}px`
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>
                );
            })}
        </>
    );
};
