import React from 'react';
import { usePromptContextMenu } from '../../../../../hooks/usePromptContextMenu';
import { ResetIcon, UploadIcon, UndoIcon, RedoIcon, PaintBrushIcon, TrashIcon } from '../../../../../components/icons';
import { Tooltip } from '../../../../../components/Tooltip';
import { Language, t, TranslationKey } from '../../../../../localization';
import { ObjectState, ObjectMemo, ObjectMode } from '../types';

interface ObjectTabProps {
    t: (key: string, lang: string) => string;
    language: Language;
    objectStates: ObjectState[];
    setObjectStates: React.Dispatch<React.SetStateAction<ObjectState[]>>;
    selectedObjectId: string | null;
    setSelectedObjectId: (id: string | null) => void;
    setObjectContextMenu: (menu: { x: number; y: number; objectId: string } | null) => void;
    modalState: { x: number; y: number };
    removeObject: (id: string) => void;
    isObjectInsertMode: boolean;
    setObjectInsertMode: (mode: boolean) => void;
    objectFileInputRef: React.RefObject<HTMLInputElement>;
    handleObjectUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onReset: () => void;
    objectMode: ObjectMode;
    setObjectMode: (mode: ObjectMode) => void;
    handleGlobalUndo: () => void;
    handleGlobalRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    objectDrawTool: 'draw' | 'erase' | 'rectangle';
    setObjectDrawTool: (tool: 'draw' | 'erase' | 'rectangle') => void;
    currentObjectDrawBrushSize: number;
    setCurrentObjectDrawBrushSize: (size: number) => void;
    objectBrushColor: string;
    setObjectBrushColor: (color: string) => void;
    clearObjectDraw: () => void;
    selectedObjectMemoId: string | null;
    objectMemos: ObjectMemo[];
    updateObjectMemo: (id: string, updates: Partial<ObjectMemo>) => void;
    deleteObjectMemo: (id: string) => void;
    objectPrompt: string;
    setObjectPrompt: (prompt: string) => void;
    onNotification: (message: string, type: 'success' | 'error') => void;
}

export const ObjectTab: React.FC<ObjectTabProps> = ({
    t, language, objectStates, setObjectStates, selectedObjectId, setSelectedObjectId,
    setObjectContextMenu, modalState, removeObject, isObjectInsertMode, setObjectInsertMode,
    objectFileInputRef, handleObjectUploadChange, onReset, objectMode, setObjectMode,
    handleGlobalUndo, handleGlobalRedo, canUndo, canRedo,
    objectDrawTool, setObjectDrawTool, currentObjectDrawBrushSize, setCurrentObjectDrawBrushSize,
    objectBrushColor, setObjectBrushColor, clearObjectDraw,
    selectedObjectMemoId, objectMemos, updateObjectMemo, deleteObjectMemo,
    objectPrompt, setObjectPrompt, onNotification
}) => {
    const { ref: promptRef, handleContextMenu, contextMenuPortal } = usePromptContextMenu({
        value: objectPrompt,
        onChange: setObjectPrompt,
        language,
    });
    return (
        <div className="p-4 space-y-4">
            {/* Header - 조명 스튜디오 스타일 */}
            <div className="flex items-center justify-between">

                <h3 className="text-base font-semibold text-zinc-100">{t('aiEdit.insertObject', language)}</h3>
                <div className="flex items-center gap-1">
                    <Tooltip tip={t('common.reset', language)} position="bottom">
                        <button
                            onClick={onReset}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors me-2"
                        >
                            <ResetIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                    <input type="file" accept="image/*" ref={objectFileInputRef} className="hidden" onChange={handleObjectUploadChange} />
                    <button
                        onClick={() => objectFileInputRef.current?.click()}
                        className="p-1.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Object List - 조명 리스트 스타일 */}
            {objectStates.length > 0 && (
                <div className="space-y-1 max-h-[192px] overflow-y-auto custom-scrollbar">
                    {objectStates.map((obj, index) => (
                        <div
                            key={obj.id}
                            onClick={() => setSelectedObjectId(obj.id)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                // 모달 기준 상대 좌표로 변환
                                setObjectContextMenu({ x: e.clientX - modalState.x, y: e.clientY - modalState.y, objectId: obj.id });
                            }}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedObjectId === obj.id
                                ? 'bg-red-500/20 border border-red-500/50'
                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                }`}
                        >
                            <div className={`w-3 h-3 rounded-full ${selectedObjectId === obj.id ? 'bg-red-500' : 'bg-white/30'}`} />
                            <img src={obj.src} alt={`Object ${index + 1}`} className="w-8 h-8 object-cover rounded" />
                            <span className="text-sm text-white flex-1 truncate">Object {index + 1}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeObject(obj.id); }}
                                className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* 캔버스 이미지 삽입 모드 버튼 */}
            <div className="border-t border-white/10 pt-3">
                <Tooltip tip={t('objectTab.canvasSelectTooltip' as TranslationKey, language)} position="top">
                    <button
                        onClick={() => {
                            setObjectInsertMode(!isObjectInsertMode);
                            if (!isObjectInsertMode) {
                                onNotification(t('objectTab.modeActivated' as TranslationKey, language), 'success');
                            } else {
                                onNotification(t('objectTab.modeDeactivated' as TranslationKey, language), 'success');
                            }
                        }}
                        className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${isObjectInsertMode
                            ? 'bg-blue-500 text-white border border-blue-400 shadow-lg shadow-blue-500/30'
                            : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {isObjectInsertMode
                            ? t('objectTab.exitMode' as TranslationKey, language)
                            : t('objectTab.enterMode' as TranslationKey, language)
                        }
                    </button>
                </Tooltip>
            </div>


            {/* Mode Toggle */}
            <div className="border-t border-white/10 pt-3">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">{t('objectTab.modeLabel' as TranslationKey, language)}</h4>
                <div className="flex bg-neutral-900 p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => setObjectMode('transform')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors ${objectMode === 'transform' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <UploadIcon className="w-3.5 h-3.5" />
                        <span>{t('objectTab.editMode' as TranslationKey, language)}</span>
                    </button>
                    <button
                        onClick={() => setObjectMode('draw')}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors ${objectMode === 'draw' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <PaintBrushIcon className="w-3.5 h-3.5" />
                        <span>{t('objectTab.drawMode' as TranslationKey, language)}</span>
                    </button>
                </div>
            </div>

            {/* Unified Undo/Redo - Works for both transform and drawing modes */}
            <div className="border-t border-white/10 pt-3">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">{t('objectTab.undoRedoTitle' as TranslationKey, language)}</h4>
                <div className="grid grid-cols-2 gap-2">
                    <Tooltip tip={t('objectTab.undoTooltip' as TranslationKey, language)} position="bottom">
                        <button
                            onClick={handleGlobalUndo}
                            disabled={!canUndo}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/20 text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <UndoIcon className="w-4 h-4" />
                            <span>{t('objectTab.undoButton' as TranslationKey, language)}</span>
                        </button>
                    </Tooltip>
                    <Tooltip tip={t('objectTab.redoTooltip' as TranslationKey, language)} position="bottom">
                        <button
                            onClick={handleGlobalRedo}
                            disabled={!canRedo}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/20 text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <RedoIcon className="w-4 h-4" />
                            <span>{t('objectTab.redoButton' as TranslationKey, language)}</span>
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Drawing Tools */}
            <div className={`border-t border-white/10 pt-3 transition-opacity duration-200 ${objectMode === 'draw' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">{t('objectTab.drawingTools' as TranslationKey, language)}</h4>
                <div className="flex gap-2 mb-2">
                    <Tooltip tip={`${t('drawing.draw', language)} (B)`} position="top" className="flex-1">
                        <button onClick={() => setObjectDrawTool('draw')} className={`w-full py-2 rounded-md text-xs font-semibold ${objectDrawTool === 'draw' ? 'bg-white text-zinc-800' : 'bg-white/10 hover:bg-white/20 text-zinc-200'}`}>{t('drawing.draw', language)}</button>
                    </Tooltip>
                    <Tooltip tip={`${t('drawing.erase', language)} (E)`} position="top" className="flex-1">
                        <button onClick={() => setObjectDrawTool('erase')} className={`w-full py-2 rounded-md text-xs font-semibold ${objectDrawTool === 'erase' ? 'bg-white text-zinc-800' : 'bg-white/10 hover:bg-white/20 text-zinc-200'}`}>{t('drawing.erase', language)}</button>
                    </Tooltip>
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <label htmlFor="object-brush-size" className="text-xs text-zinc-300 whitespace-nowrap">{t('drawing.brushSize', language)}</label>
                    <input id="object-brush-size" type="range" min="1" max="50" step="1" value={currentObjectDrawBrushSize} onChange={e => setCurrentObjectDrawBrushSize(parseFloat(e.target.value))} className="w-full" />
                    <input type="color" value={objectBrushColor} onChange={(e) => setObjectBrushColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" title={t('drawing.brushColor', language)} />
                </div>
                <Tooltip tip={`${t('drawing.clear', language)}`} position="bottom">
                    <button onClick={clearObjectDraw} className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold bg-red-600/20 hover:bg-red-600/40 text-red-300"><TrashIcon className="w-4 h-4" /><span>{t('drawing.clear', language)}</span></button>
                </Tooltip>
            </div>

            {/* Memo Controls */}
            {selectedObjectMemoId && (
                <div className="border-t border-white/10 pt-3 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-sm font-semibold text-zinc-200 mb-2">Memo Settings</h4>
                    <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs text-zinc-300">Size:</label>
                        <input
                            type="number"
                            min="10" max="50"
                            value={objectMemos.find(m => m.id === selectedObjectMemoId)?.fontSize || 14}
                            onChange={(e) => updateObjectMemo(selectedObjectMemoId, { fontSize: parseInt(e.target.value) })}
                            className="w-12 h-6 text-xs bg-neutral-800 border border-neutral-600 rounded px-1 text-white"
                        />
                        <label className="text-xs text-zinc-300">Color:</label>
                        <input
                            type="color"
                            value={objectMemos.find(m => m.id === selectedObjectMemoId)?.color || '#FFFF00'}
                            onChange={(e) => updateObjectMemo(selectedObjectMemoId, { color: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-none"
                        />
                    </div>
                    <button onClick={() => deleteObjectMemo(selectedObjectMemoId)} className="w-full text-xs text-red-400 hover:text-red-300 hover:underline">{t('drawing.memo.delete', language)}</button>
                </div>
            )}

            <div className="text-xs text-zinc-500 text-center pt-1 border-t border-white/10">
                {t('drawing.memo.add', language)}
            </div>

            {/* Prompt */}
            <div className="border-t border-white/10 pt-3">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">{t('aiEdit.prompt', language)}</h4>
                <textarea
                    ref={promptRef}
                    onContextMenu={handleContextMenu}
                    value={objectPrompt}
                    onChange={(e) => setObjectPrompt(e.target.value)}
                    placeholder={t('aiEdit.promptPlaceholder', language)}
                    className="w-full bg-neutral-900 border border-neutral-600 rounded-md py-2 px-3 text-sm text-zinc-200 placeholder-zinc-400 focus:ring-1 focus:ring-white outline-none resize-none"
                    rows={3}
                />
            </div>
            {contextMenuPortal}
        </div>
    );
};
