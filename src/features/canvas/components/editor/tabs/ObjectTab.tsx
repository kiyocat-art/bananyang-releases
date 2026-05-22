import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ResetIcon, UndoIcon, RedoIcon } from '../../../../../components/icons';
import { Tooltip } from '../../../../../components/Tooltip';
import { Language, t, TranslationKey } from '../../../../../localization';
import { ObjectInteractionType } from '../../../../../types';
import { useEditorStore } from '../../../../../features/toolbar/useEditorStore';
import { useCanvasStore } from '../../../../../store/canvasStore';
import { isShortcut } from '../../../../../hooks/useShortcuts';
import { blobManager } from '../../../../../utils/blobManager';
import { SafeImage } from '../../../../../components/SafeImage';
import { EditorImageViewer, ImageSizeType } from '../EditorImageViewer';
import { useObjectDrawCanvas } from '../hooks/useObjectDrawCanvas';
import { ObjectOverlay } from '../overlays/ObjectOverlay';
import { ObjectContextMenu as ObjectContextMenuState } from '../types';
import { ObjectContextMenu } from '../overlays/ObjectContextMenu';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { HoverEdgeAutoScroll } from '../../../../../components/HoverEdgeAutoScroll';

// ── Interaction type pictograms ───────────────────────────────────────────────

/** 배경 배치 — 객체가 바닥에 놓임 */
const PlaceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="3" width="10" height="8" rx="1.5" />
    <line x1="3" y1="16" x2="17" y2="16" />
    <line x1="7" y1="16" x2="6" y2="19" />
    <line x1="13" y1="16" x2="14" y2="19" />
  </svg>
);

/** 손에 들기 — 손이 위로 물체를 받침 */
const HoldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="2" width="8" height="6" rx="1" />
    <path d="M6 8h8v5a3 3 0 01-8 0V8z" />
    <line x1="8" y1="8" x2="8" y2="12" />
    <line x1="10" y1="8" x2="10" y2="13" />
    <line x1="12" y1="8" x2="12" y2="12" />
  </svg>
);

/** 착용하기 — 티셔츠 실루엣 */
const WearIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7.5 2L3 5.5 5.5 7V17h9V7l2.5-1.5L12.5 2" />
    <path d="M7.5 2c0 1.3 5 1.3 5 0" />
  </svg>
);

/** 인물 추가 — 사람 + 플러스 */
const AddCharIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7.5" cy="5" r="2.5" />
    <path d="M2 17v-1a5.5 5.5 0 0111 0v1" />
    <line x1="15" y1="9" x2="15" y2="16" />
    <line x1="11.5" y1="12.5" x2="18.5" y2="12.5" />
  </svg>
);

const INTERACTION_ITEMS: { type: ObjectInteractionType; labelKo: string; icon: React.ReactNode }[] = [
  { type: 'place',         labelKo: '배경 배치', icon: <PlaceIcon /> },
  { type: 'hold',          labelKo: '손에 들기', icon: <HoldIcon /> },
  { type: 'wear',          labelKo: '착용하기',  icon: <WearIcon /> },
  { type: 'add_character', labelKo: '인물 추가', icon: <AddCharIcon /> },
];

/** 최초 삽입 시에만 적용: 뷰어 표시 크기의 40% 이내로 맞추고 중앙 배치 */
function computeInitialTransform(
  naturalW: number,
  naturalH: number,
  viewW: number,
  viewH: number,
): { x: number; y: number; width: number; height: number; rotation: number } {
  if (viewW > 0 && viewH > 0) {
    const scale = Math.min((viewW * 0.4) / naturalW, (viewH * 0.4) / naturalH, 1);
    const w = naturalW * scale;
    const h = naturalH * scale;
    return { x: (viewW - w) / 2, y: (viewH - h) / 2, width: w, height: h, rotation: 0 };
  }
  // 뷰어 크기 미확인 시 최대 300px로 제한
  const scale = Math.min(1, 300 / Math.max(naturalW, naturalH));
  return { x: 0, y: 0, width: naturalW * scale, height: naturalH * scale, rotation: 0 };
}

interface ObjectTabProps {
  language: Language;
  onNotification: (message: string, type: 'success' | 'error') => void;
  localImageSrc?: string | null;
}

export const ObjectTab: React.FC<ObjectTabProps> = ({ language, onNotification, localImageSrc }) => {
  const {
    objectStates, setObjectStates,
    selectedObjectId, setSelectedObjectId,
    objectMode,
    objectInteractionType, setObjectInteractionType,
    objectMemos, setObjectMemos, selectedObjectMemoId, setSelectedObjectMemoId,
    updateObjectMemo, deleteObjectMemo,
    removeObject, flipObject, resetObjectEditor, setImageDisplaySize,
    undoObjectTransform, redoObjectTransform,
    objectHistory, objectHistoryIndex,
  } = useEditorStore();

  const { sidebarWidth, handleResizeMouseDown } = useResizableSidebar();

  const isObjectInsertMode = useCanvasStore((s) => s.isObjectInsertMode);
  const setObjectInsertMode = useCanvasStore((s) => s.setObjectInsertMode);
  const insertTargetImage = useCanvasStore((s) => s.insertTargetImage);
  const setInsertTargetImage = useCanvasStore((s) => s.setInsertTargetImage);
  // 다른 툴로 전환 시 (언마운트) 삽입 모드 및 관련 상태 초기화
  useEffect(() => {
    return () => {
      // Release blob refs held by any remaining object states on unmount
      for (const o of useEditorStore.getState().objectStates) {
        blobManager.release(o.src);
      }
      useCanvasStore.getState().setObjectInsertMode(false);
      useCanvasStore.getState().setInsertTargetImage(null);
      useCanvasStore.getState().clearObjectEditorImages();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 캔버스에서 클릭한 이미지를 오브젝트로 자동 추가
  useEffect(() => {
    if (!insertTargetImage) return;
    const src = (insertTargetImage as any).highResSrc ?? (insertTargetImage as any).previewSrc ?? (insertTargetImage as any).src;
    if (!src) { setInsertTargetImage(null); return; }
    const img = new Image();
    img.onload = () => {
      // Hold a blobManager ref so safeCleanup won't revoke this URL while displayed in the object list
      blobManager.addRef(src);
      setObjectStates((prev) => [...prev, {
        id: crypto.randomUUID(),
        file: null,
        src,
        transform: computeInitialTransform(img.naturalWidth, img.naturalHeight, imgSize.width, imgSize.height),
      }]);
      setSelectedObjectId(null);
      setTimeout(() => useEditorStore.getState().saveObjectHistory(), 0);
    };
    img.src = src;
    setInsertTargetImage(null); // consume
  }, [insertTargetImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const objectFileInputRef = useRef<HTMLInputElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState<ImageSizeType>({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [objectContextMenu, setObjectContextMenu] = useState<ObjectContextMenuState | null>(null);
  const [clipboard, setClipboard] = useState<typeof objectStates[0] | null>(null);
  const [isDraggingObjectMemo, setIsDraggingObjectMemo] = useState(false);
  const [objectMemoDragOffset, setObjectMemoDragOffset] = useState({ x: 0, y: 0 });

  const saveObjectHistory = useCallback(() => {
    useEditorStore.getState().saveObjectHistory();
  }, []);

  const handleCopy = () => {
    const idToCopy = selectedObjectId;
    if (!idToCopy) return;
    const obj = objectStates.find(o => o.id === idToCopy);
    if (obj) setClipboard({ ...obj });
  };

  const handlePaste = () => {
    if (!clipboard) return;
    setObjectStates(prev => [...prev, {
      ...clipboard,
      id: crypto.randomUUID(),
      transform: { ...clipboard.transform, x: clipboard.transform.x + 20, y: clipboard.transform.y + 20 },
    }]);
  };

  const {
    canvasRef, handlePointerDown, handlePointerMove, handlePointerUp,
    undoDrawing, redoDrawing, clearDrawing,
    canUndoDrawing, canRedoDrawing,
    getDrawUndoCount,
  } = useObjectDrawCanvas({ imageSize: imgSize });

  // index >= 0: 일반 취소 가능 | history.length > 0: 빈 상태지만 아직 초기화 안 됨 → 한 번 더 = 초기화
  const canUndoTransform = objectHistoryIndex >= 0 || objectHistory.length > 0;
  const canRedoTransform = objectHistoryIndex < objectHistory.length - 1;
  const handleUndoAction = useCallback(() => {
    const { objectHistoryIndex: currentIndex } = useEditorStore.getState();
    if (currentIndex >= 0) {
      undoObjectTransform();
      if (useEditorStore.getState().objectHistoryIndex < 0) {
        clearDrawing();
        resetObjectEditor();
      }
    } else {
      clearDrawing();
      resetObjectEditor();
    }
  }, [undoObjectTransform, clearDrawing, resetObjectEditor]);

  // 탭 진입 시 히스토리를 -1(빈 기저 상태)로 리셋
  // 기존 객체가 있으면 첫 히스토리(index 0)로 저장 → Ctrl+Z로 빈 상태까지 복귀 가능
  useEffect(() => {
    useEditorStore.setState({ objectHistory: [], objectHistoryIndex: -1 });
    if (useEditorStore.getState().objectStates.length > 0) {
      useEditorStore.getState().saveObjectHistory(); // 기존 객체 → index 0으로 저장
    }
    return () => { useEditorStore.getState().clearObjectHistory(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 키보드 단축키: Ctrl+Z/Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // isShortcut()로 중앙화된 단축키 설정 사용 (Ctrl+Z / Ctrl+Shift+Z 포토샵 방식)
      // e.code 폴백: 한글 IME 환경 대응
      const isUndo = isShortcut(e, 'undoDrawing') || ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey && !e.altKey);
      const isRedo = isShortcut(e, 'redoDrawing') || ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && e.shiftKey && !e.altKey);
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      e.stopPropagation();
      if (isUndo) {
        handleUndoAction();
      } else {
        redoObjectTransform();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleUndoAction, redoObjectTransform]);

  const handleObjectUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const blobUrl = blobManager.create(file);
      // Load image to get natural dimensions for ObjectTransform
      const img = new Image();
      img.onload = () => {
        const newObj = {
          id: crypto.randomUUID(),
          file,
          src: blobUrl,
          transform: computeInitialTransform(img.naturalWidth, img.naturalHeight, imgSize.width, imgSize.height),
        };
        setObjectStates((prev) => [...prev, newObj]);
        setSelectedObjectId(newObj.id);
        setTimeout(() => useEditorStore.getState().saveObjectHistory(), 0);
      };
      img.src = blobUrl;
      e.target.value = '';
    }
  };

  const handleObjectCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imgSize.width;
    const y = ((e.clientY - rect.top) / rect.height) * imgSize.height;
    const newMemo = { id: crypto.randomUUID(), text: '', x, y, fontSize: 14, color: '#FFFF00' };
    setObjectMemos((prev) => [...prev, newMemo]);
    setSelectedObjectMemoId(newMemo.id);
  };

  const handleObjectMemoMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedObjectMemoId(id);
    setIsDraggingObjectMemo(true);
    const memo = objectMemos.find((m) => m.id === id);
    if (memo && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const memoScreenX = (memo.x / imgSize.width) * rect.width + rect.left;
      const memoScreenY = (memo.y / imgSize.height) * rect.height + rect.top;
      setObjectMemoDragOffset({ x: e.clientX - memoScreenX, y: e.clientY - memoScreenY });
    }
  };

  const handleObjectMemoMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingObjectMemo || !selectedObjectMemoId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - objectMemoDragOffset.x - rect.left) / rect.width) * imgSize.width;
    const y = ((e.clientY - objectMemoDragOffset.y - rect.top) / rect.height) * imgSize.height;
    updateObjectMemo(selectedObjectMemoId, { x, y });
  };

  const handleObjectMemoMouseUp = () => {
    setIsDraggingObjectMemo(false);
  };

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-[#0e0e0e]">
      <EditorImageViewer
        className="flex-1 min-w-0 h-full"
        localImageSrc={localImageSrc}
        onImageLoad={(size) => { setImgSize(size); setImageDisplaySize(size); }}
        renderInsideTransform={({ imageSize, zoom, viewportRef, isZKeyDown }) => (
          <div className="absolute inset-0" style={{ pointerEvents: isZKeyDown ? 'none' : 'auto' }}>
          <ObjectOverlay
            objectStates={objectStates}
            setObjectStates={setObjectStates}
            saveObjectHistory={saveObjectHistory}
            zoom={zoom}
            objectMode={objectMode}
            selectedObjectId={selectedObjectId}
            setSelectedObjectId={setSelectedObjectId}
            removeObject={removeObject}
            flipObject={flipObject}
            viewportRef={viewportRef}
            setObjectContextMenu={setObjectContextMenu}
            objectDrawCanvasRef={canvasRef}
            imageSize={imageSize}
            startDrawingOnObject={handlePointerDown}
            drawOnObject={handlePointerMove}
            finishDrawingOnObject={handlePointerUp}
            handleObjectCanvasContextMenu={handleObjectCanvasContextMenu}
            handleObjectMemoMouseMove={handleObjectMemoMouseMove}
            handleObjectMemoMouseUp={handleObjectMemoMouseUp}
            isDraggingObjectMemo={isDraggingObjectMemo}
            objectMemos={objectMemos}
            selectedObjectMemoId={selectedObjectMemoId}
            handleObjectMemoMouseDown={handleObjectMemoMouseDown}
            updateObjectMemo={updateObjectMemo}
            t={t}
            language={language}
          />
          </div>
        )}
      />

      <div
        className="relative flex-shrink-0 h-full bg-zinc-900/85 backdrop-blur-sm border-l border-white/10"
        style={{ width: sidebarWidth }}
      >
        {/* 리사이즈 핸들 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group/rh"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-px rounded-full bg-white/0 group-hover/rh:bg-white/30 transition-colors duration-150" />
        </div>
        <div ref={sidebarScrollRef} className="h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-zinc-100">{t('aiEdit.insertObject', language)}</h3>
            <div className="flex items-center gap-1">
              <Tooltip tip="실행 취소 (Ctrl+Z)" position="top">
                <button
                  onClick={handleUndoAction}
                  disabled={!canUndoTransform}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <UndoIcon className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip tip="다시 실행 (Ctrl+Y)" position="top">
                <button
                  onClick={redoObjectTransform}
                  disabled={!canRedoTransform}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <RedoIcon className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip tip={t('common.reset', language)} position="top">
                <button
                  onClick={() => { clearDrawing(); resetObjectEditor(); }}
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

          {/* Object List */}
          {objectStates.length > 0 && (
            <div className="space-y-1 max-h-[144px] overflow-y-auto custom-scrollbar">
              {objectStates.map((obj, index) => (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedObjectId === obj.id
                    ? 'bg-red-500/20 border border-red-500/50'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                >
                  <div className={`w-3 h-3 rounded-full ${selectedObjectId === obj.id ? 'bg-red-500' : 'bg-white/30'}`} />
                  <SafeImage srcChain={[obj.src]} alt={`Object ${index + 1}`} className="w-8 h-8 object-cover rounded" />
                  <span className="text-sm text-white flex-1 truncate">Object {index + 1}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      blobManager.release(obj.src);
                      removeObject(obj.id);
                      setTimeout(() => useEditorStore.getState().saveObjectHistory(), 0);
                    }}
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

          {/* Canvas Insert Mode */}
          <div className="border-t border-white/10 pt-3">
            <Tooltip tip={t('objectTab.canvasSelectTooltip' as TranslationKey, language)} position="top">
              <button
                onClick={() => {
                  setObjectInsertMode(!isObjectInsertMode);
                  onNotification(
                    isObjectInsertMode
                      ? t('objectTab.modeDeactivated' as TranslationKey, language)
                      : t('objectTab.modeActivated' as TranslationKey, language),
                    'success'
                  );
                }}
                className={`w-full px-4 py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${isObjectInsertMode
                  ? 'bg-yellow-400 text-zinc-950 border border-yellow-400 shadow-lg shadow-yellow-400/30 font-medium'
                  : 'bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 border border-yellow-400/30'
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

          {/* Interaction Type */}
          <div className="border-t border-white/10 pt-3">
            <h4 className="font-bold text-sm text-zinc-200 mb-2">상호작용 유형</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {INTERACTION_ITEMS.map(({ type, labelKo, icon }) => (
                <button
                  key={type}
                  onClick={() => setObjectInteractionType(objectInteractionType === type ? null : type)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    objectInteractionType === type
                      ? 'bg-yellow-400 text-zinc-950 font-medium'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {icon}
                  <span>{labelKo}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Memo Controls */}
          {selectedObjectMemoId && (
            <div className="border-t border-white/10 pt-3 animate-in fade-in slide-in-from-top-2">
              <h4 className="font-bold text-sm text-zinc-200 mb-2">Memo Settings</h4>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-zinc-300">Size:</label>
                <input
                  type="number"
                  min="10" max="50"
                  value={objectMemos.find((m) => m.id === selectedObjectMemoId)?.fontSize || 14}
                  onChange={(e) => updateObjectMemo(selectedObjectMemoId, { fontSize: parseInt(e.target.value) })}
                  className="w-12 h-6 text-xs bg-neutral-800 border border-neutral-600 rounded px-1 text-white"
                />
                <label className="text-xs text-zinc-300">Color:</label>
                <input
                  type="color"
                  value={objectMemos.find((m) => m.id === selectedObjectMemoId)?.color || '#FFFF00'}
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

        </div>
        </div>
        <HoverEdgeAutoScroll targetRef={sidebarScrollRef} />
      </div>
      {objectContextMenu && (
        <ObjectContextMenu
          menu={objectContextMenu}
          onClose={() => setObjectContextMenu(null)}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onFlip={flipObject}
          onDelete={removeObject}
        />
      )}
    </div>
  );
};
