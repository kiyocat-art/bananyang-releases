import React, { useState, useRef, useEffect, useCallback } from 'react';
import RBush from 'rbush';
import { Z_INDEX } from '../../constants/zIndex';
import { BoardImage, GeneratedMedia, GenerationTask, BoardGroup, ModelName, PromptFolder, GenerationParams } from '../../types';
import { useCanvasStore } from '../../store/canvasStore';
import { isShortcut } from '../../hooks/useShortcuts';
import { bananyang_MEDIA_MIME_TYPE } from '../../constants';
import { t, Language } from '../../localization';
import { CanvasGroup } from './components/CanvasGroup';
import { CanvasImage } from './components/CanvasImage';
import { ContextMenuItem } from './components/ContextMenu';
import { SelectionBox } from './components/SelectionBox';
import { PromptPanel } from './components/prompt-panel/index';
import { GlobalCanvasListeners } from './components/GlobalCanvasListeners';
import { CanvasOverlays } from './components/CanvasOverlays';
import { useToolbarPositionSync } from '../toolbar/useToolbarPositionSync';
import { measureText } from '../../utils/measureText';
import { TransformControls } from './components/TransformControls';
import { useVisibleObjects, useCanvasInteractions, useCanvasWorker } from './hooks';
import { MagnifyIcon, PencilIcon, DownloadIcon, TrashIcon } from '../../components/icons';
import { RoleThumbnails } from './components/RoleThumbnails';
import { MergeGroupsModal } from '../../components/MergeGroupsModal';
import { useGenerationStore } from '../../store/generationStore';
import { SpatialItem, buildSpatialIndex, hitTestPoint } from '../../utils/spatialIndex';

// --- START: Infinite Canvas Components ---
interface InfiniteCanvasProps {
    allHistoryMedia: GeneratedMedia[];
    language: Language;
    onZoomSelection: (media: File | string | null) => void;
    onEditSelection: (imageOrId: string | BoardImage) => void;
    onNewWorkspace: () => void;
    onSaveWorkspace: () => void;
    onSaveWorkspaceAs: () => void;
    onLoadWorkspace: (content?: string, filePath?: string) => void;
    notification: { id: number; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
    onNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    isModalOpen: boolean;
    onCopySelection: () => Promise<Blob | null>;
    onPasteFromClipboard: (position: { x: number; y: number; }) => void;
    onLoadGenerationParams: (params: GenerationParams) => void;
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    onSetSaveDirectoryHandle: (handle: FileSystemDirectoryHandle) => void;
    editingImageId?: string;
    onCanvasClick?: () => void;
    originalImage?: BoardImage;
    onZoomCanvasImage?: (image: BoardImage) => void;
    onDownloadCanvasImage?: (image: BoardImage) => void;
}

const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error("Failed to read file"));
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({ allHistoryMedia, language, onZoomSelection, onEditSelection, onNewWorkspace, onSaveWorkspace, onSaveWorkspaceAs, onLoadWorkspace, notification, onNotification, isModalOpen, onCopySelection, onPasteFromClipboard, onLoadGenerationParams, saveDirectoryHandle, onSetSaveDirectoryHandle, editingImageId, onCanvasClick, originalImage, onZoomCanvasImage, onDownloadCanvasImage }) => {
    // Render state — individual selectors to prevent wholesale re-renders
    const boardImages          = useCanvasStore(state => state.boardImages);
    const boardGroups          = useCanvasStore(state => state.boardGroups);
    const memos                = useCanvasStore(state => state.memos);
    const selectedImageIds     = useCanvasStore(state => state.selectedImageIds);
    const selectedMemoIds      = useCanvasStore(state => state.selectedMemoIds);
    const groupEditModeId      = useCanvasStore(state => state.groupEditModeId);
    const mergeGroupsModalOpen = useCanvasStore(state => state.mergeGroupsModalOpen);
    const history              = useCanvasStore(state => state.history);
    const activeKeyboardContext = useCanvasStore(state => state.activeKeyboardContext);
    // Actions — stable references, individual selectors
    const setSelectedImageIds = useCanvasStore(state => state.setSelectedImageIds);
    const deleteSelection     = useCanvasStore(state => state.deleteSelection);
    const downloadSelection   = useCanvasStore(state => state.downloadSelection);
    const setGroupEditModeId  = useCanvasStore(state => state.setGroupEditModeId);
    const updateImage         = useCanvasStore(state => state.updateImage);
    const updateMemo          = useCanvasStore(state => state.updateMemo);
    const saveHistory         = useCanvasStore(state => state.saveHistory);
    const setRole             = useCanvasStore(state => state.setRole);

    const [isSpacebarDown, setIsSpacebarDown] = useState(false);
    const [isZKeyDown, setIsZKeyDown] = useState(false);
    const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);

    const [editingMemoId, setEditingMemoId] = useState<string | null>(null);

    // [SAFETY] Zoom stress warning & render crash detection
    const [showRenderError, setShowRenderError] = useState(false);
    const zoomEventTimestampsRef = useRef<number[]>([]);
    const zoomWarningActiveRef = useRef(false);
    const zoomWarningTimeoutRef = useRef<number | null>(null);


    const workerCanvasRef = useRef<HTMLCanvasElement>(null);
    const worker = useCanvasWorker(workerCanvasRef);
    // [PERF] World div ref for direct DOM transform updates (bypasses React re-renders on pan/zoom)
    const worldDivRef = useRef<HTMLDivElement>(null);

    // [Phase 2] Spatial index for O(log n) hit testing — rebuilt when boardImages/boardGroups change
    const spatialIndexRef = useRef<RBush<SpatialItem> | null>(null);
    useEffect(() => {
        spatialIndexRef.current = buildSpatialIndex(boardImages, boardGroups);
    }, [boardImages, boardGroups]);

    // [SIMPLIFIED] PixiJS only - no hybrid rendering
    // Always use PixiJS renderer, no Canvas 2D fallback
    const isLowZoomMode = false;
    const hitTest = useCallback((screenX: number, screenY: number) => {
        const { pan, zoom } = useCanvasStore.getState();
        const worldX = (screenX - pan.x) / zoom;
        const worldY = (screenY - pan.y) / zoom;

        // [Phase 2] O(log n) spatial query instead of O(n) linear scan
        const tree = spatialIndexRef.current;
        if (tree) {
            return hitTestPoint(tree, worldX, worldY);
        }

        // Fallback: O(n) linear scan (used before first render)
        const { boardImages, boardGroups } = useCanvasStore.getState();
        for (let i = boardGroups.length - 1; i >= 0; i--) {
            const group = boardGroups[i];
            if (worldX >= group.x && worldX <= group.x + group.width &&
                worldY >= group.y && worldY <= group.y + group.height) {
                return { type: 'group' as const, id: group.id };
            }
        }
        for (let i = boardImages.length - 1; i >= 0; i--) {
            const image = boardImages[i];
            if (worldX >= image.x && worldX <= image.x + image.width &&
                worldY >= image.y && worldY <= image.y + image.height) {
                return { type: 'image' as const, id: image.id };
            }
        }
        return null;
    }, []);

    const {
        canvasRef,
        fileInputRef,
        cursorClass,
        isDraggingOver,
        selectionBounds,
        actionRingPosition,
        contextMenu,
        handleDrop,
        handleDragEnter,
        handleDragLeave,
        handleMouseDownOnCanvas,
        handleContextMenu,
        handleElementMouseDown,
        handleUploadAndPositionImages,
        marquee
    } = useCanvasInteractions({
        allHistoryMedia,
        language,
        onZoomSelection,
        onEditSelection: (imageOrId) => {
            if (typeof imageOrId === 'string') {
                const img = boardImages.find(i => i.id === imageOrId);
                if (img) onEditSelection(img);
            } else {
                onEditSelection(imageOrId);
            }
        },
        onNewWorkspace,
        onSaveWorkspace,
        onSaveWorkspaceAs,
        onLoadWorkspace,
        onCopySelection,
        onPasteFromClipboard,
        onNotification,
        saveDirectoryHandle,
        onLoadGenerationParams,
        editingImageId,
        isLowZoomMode,
        hitTest
    });

    const { visibleImages, visibleGroups } = useVisibleObjects({
        boardImages,
        boardGroups,
        canvasRect: canvasRect,
    });

    // 툴바 위치 동기화 — pan/zoom은 내부 subscribe로 처리 (React 리렌더 없음)
    useToolbarPositionSync({ canvasRect });

    // [PERF] World div transform — direct DOM update via zustand subscribe (no React re-render)
    // Sets initial transform on mount and --canvas-zoom CSS variable for child components.
    useEffect(() => {
        const el = worldDivRef.current;
        if (!el) return;
        const { pan, zoom } = useCanvasStore.getState();
        el.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`;
        el.style.setProperty('--canvas-zoom', String(zoom));

        return useCanvasStore.subscribe((state, prev) => {
            if (state.pan === prev.pan && state.zoom === prev.zoom) return;
            const el = worldDivRef.current;
            if (!el) return;
            el.style.transform = `translate3d(${state.pan.x}px, ${state.pan.y}px, 0) scale(${state.zoom})`;
            if (state.zoom !== prev.zoom) {
                el.style.setProperty('--canvas-zoom', String(state.zoom));
            }
        });
    }, []);

    // Save initial history if empty
    useEffect(() => {
        if (history.length === 0) {
            saveHistory();
        }
    }, []);







    useEffect(() => {
        const element = canvasRef.current;
        if (!element) return;

        const observer = new ResizeObserver(() => {
            setCanvasRect(element.getBoundingClientRect());
        });

        observer.observe(element);
        setCanvasRect(element.getBoundingClientRect()); // Initial set

        return () => observer.disconnect();
    }, []);



    // Ctrl+T shortcut to open editor — 원본이미지 지정시에만 활성
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isShortcut(e, 'openEditor')) {
                e.preventDefault();
                if (!originalImage) {
                    onNotification(t('error.noOriginalImage', language), 'error');
                    return;
                }
                onEditSelection(originalImage);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [originalImage, onNotification, onEditSelection, language]);



    // Handle delete key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isModalOpen || activeKeyboardContext === 'editor' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (editingImageId && selectedImageIds.has(editingImageId)) {
                    onNotification(t('error.cannotDeleteEditingImage', language), 'error');
                    return;
                }
                // Delete selected memos
                const { selectedMemoIds, deleteMemo } = useCanvasStore.getState();
                if (selectedMemoIds.size > 0) {
                    selectedMemoIds.forEach(memoId => deleteMemo(memoId));
                    return;
                }
                deleteSelection();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteSelection, isModalOpen, editingImageId, selectedImageIds, onNotification, language]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isModalOpen || activeKeyboardContext === 'editor' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.code === 'Space') { e.preventDefault(); setIsSpacebarDown(true); }
            if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') { setIsZKeyDown(true); }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacebarDown(false);
            if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') { setIsZKeyDown(false); }
        };

        // Reset key states when window loses focus to prevent stuck keys
        const handleBlur = () => {
            setIsSpacebarDown(false);
            setIsZKeyDown(false);
        };

        // Reset key states when tab becomes hidden
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsSpacebarDown(false);
                setIsZKeyDown(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isModalOpen]);







    // [PERF] Debounced zoom class removal - prevents backdrop-filter flicker during zoom
    const zoomTimeoutRef = useRef<number | null>(null);
    // [PERF] RAF batching — accumulate wheel events per frame, fire setState once per frame
    const pendingWheelRef = useRef<{ zoomFactor: number; mouseX: number; mouseY: number } | null>(null);
    const wheelRafRef = useRef<number | null>(null);

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        // [Trackpad Support] Distinguish trackpad gesture from mouse wheel:
        // - ctrlKey/metaKey: always zoom (pinch-to-zoom on trackpad, Ctrl+wheel on mouse)
        // - No modifier + deltaX present: trackpad 2-finger pan (horizontal component)
        // - No modifier + deltaX=0 + small continuous deltaY: trackpad vertical scroll → pan
        // - No modifier + deltaX=0 + large step deltaY (±100+): mouse wheel → zoom (legacy behavior)
        const isCtrlZoom = e.ctrlKey || e.metaKey;
        const isTrackpadPan = !isCtrlZoom && (
            Math.abs(e.deltaX) > 0 || // Any horizontal delta = trackpad
            (e.deltaMode === 0 && Math.abs(e.deltaY) < 50) // Small continuous pixel delta = trackpad
        );

        if (isTrackpadPan) {
            // Trackpad panning — macOS provides native momentum scrolling
            useCanvasStore.setState(state => ({
                pan: {
                    x: state.pan.x - e.deltaX,
                    y: state.pan.y - e.deltaY,
                }
            }));
            return;
        }

        // Below: ctrlKey/metaKey present = zoom (mouse wheel or pinch-to-zoom)
        const scaleAmount = 1.1;

        // [PERF] Add zooming class to disable backdrop-filter during zoom
        document.body.classList.add('zooming');
        if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
        }
        zoomTimeoutRef.current = window.setTimeout(() => {
            document.body.classList.remove('zooming');
            zoomTimeoutRef.current = null;
        }, 150);

        // [SAFETY] Track rapid zoom events — warn if > 30 events in 3 seconds
        const now = Date.now();
        zoomEventTimestampsRef.current.push(now);
        zoomEventTimestampsRef.current = zoomEventTimestampsRef.current.filter(t => now - t < 3000);
        if (zoomEventTimestampsRef.current.length > 30 && !zoomWarningActiveRef.current) {
            zoomWarningActiveRef.current = true;
            onNotification(t('canvas.zoomStress.warning', language), 'warning');
            if (zoomWarningTimeoutRef.current) clearTimeout(zoomWarningTimeoutRef.current);
            zoomWarningTimeoutRef.current = window.setTimeout(() => {
                zoomWarningActiveRef.current = false;
                zoomWarningTimeoutRef.current = null;
            }, 5000);
        }

        // 이벤트 시점에 좌표 계산 후 누적 (RAF에서 setState)
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? scaleAmount : 1 / scaleAmount;
        const prev = pendingWheelRef.current;
        pendingWheelRef.current = {
            zoomFactor: (prev?.zoomFactor ?? 1) * factor,
            mouseX,
            mouseY,
        };

        if (wheelRafRef.current === null) {
            wheelRafRef.current = requestAnimationFrame(() => {
                const pending = pendingWheelRef.current;
                if (pending) {
                    useCanvasStore.setState(state => {
                        const { zoom: prevZoom, pan: prevPan } = state;
                        const newZoom = prevZoom * pending.zoomFactor;
                        const clampedZoom = Math.max(0.05, Math.min(5, newZoom));
                        if (prevZoom === clampedZoom) return {};
                        const newPanX = pending.mouseX - (pending.mouseX - prevPan.x) * (clampedZoom / prevZoom);
                        const newPanY = pending.mouseY - (pending.mouseY - prevPan.y) * (clampedZoom / prevZoom);
                        return { zoom: clampedZoom, pan: { x: newPanX, y: newPanY } };
                    });
                    pendingWheelRef.current = null;
                }
                wheelRafRef.current = null;
            });
        }
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            return () => canvas.removeEventListener('wheel', handleWheel);
        }
    }, [handleWheel]);

    // [SAFETY] Listen for WebGL context loss relayed from the rendering worker
    useEffect(() => {
        const handleRenderCrash = () => setShowRenderError(true);
        window.addEventListener('canvas-render-crash', handleRenderCrash);
        return () => window.removeEventListener('canvas-render-crash', handleRenderCrash);
    }, []);



    const handleDownload = useCallback(async (currentHandle: FileSystemDirectoryHandle | null, format: 'png' | 'webp' = 'png') => {
        const count = selectedImageIds.size;
        if (count === 0) return;

        // saveDirectoryHandle이 설정된 경우 해당 폴더에 저장, 없으면 blob URL 직접 다운로드 폴백
        await downloadSelection(currentHandle, format);

        if (currentHandle) {
            const message = t('canvas.downloadToFolder', language, { count, folder: currentHandle.name });
            onNotification(message, 'success');
        } else {
            const message = count > 1
                ? t('downloadCompleteMultiple', language, { count })
                : t('downloadComplete', language);
            onNotification(message, 'success');
        }
    }, [downloadSelection, onNotification, language, selectedImageIds]);


    return (
        <div className="flex-grow flex flex-col relative min-h-0">
            {mergeGroupsModalOpen && <MergeGroupsModal language={language} />}

            {/* [SAFETY] Critical render error popup */}
            {showRenderError && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/60" style={{ zIndex: Z_INDEX.DROPDOWN }}>
                    <div className="rounded-xl px-8 py-6 max-w-md mx-4 shadow-2xl bg-zinc-950 border-2 border-red-500">
                        <div className="flex items-center gap-3 mb-3">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                                <circle cx="12" cy="12" r="10" fill="rgba(239,68,68,0.2)" stroke="rgb(239,68,68)" strokeWidth="1.5" />
                                <line x1="12" y1="7" x2="12" y2="13" stroke="rgb(239,68,68)" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="12" cy="16.5" r="1.2" fill="rgb(239,68,68)" />
                            </svg>
                            <p className="text-red-300 font-bold text-base">
                                {t('canvas.renderError.title', language)}
                            </p>
                        </div>
                        <p className="text-red-200 text-sm leading-relaxed mb-5">
                            {t('canvas.renderError.message', language)}
                        </p>
                        <button
                            onClick={() => window.electronAPI?.restartApp()}
                            className="bg-red-800 hover:bg-red-600 text-white font-semibold text-sm rounded-lg px-5 py-2 transition-colors cursor-pointer"
                        >
                            ↺ Restart App
                        </button>
                    </div>
                </div>
            )}
            <CanvasOverlays
                contextMenu={contextMenu}
                selectionBarPosition={actionRingPosition}
                onZoomSelection={onZoomSelection}
                onEditSelection={onEditSelection}
                onDelete={() => { deleteSelection(); setSelectedImageIds(() => new Set()); }}
                onDownload={(format) => { handleDownload(saveDirectoryHandle, format); setSelectedImageIds(() => new Set()); }}
                onHideSelectionBar={() => setSelectedImageIds(() => new Set())}
                language={language}
                onContextMenu={(e) => handleContextMenu(e as any)}
            />
            <div
                ref={canvasRef}
                className={`flex-grow w-full h-full relative overflow-hidden glass-grid-background ${cursorClass}`}
                style={{
                    willChange: 'transform',
                    transform: 'translate3d(0, 0, 0)',
                }}
                onMouseDown={(e) => { handleMouseDownOnCanvas(e); onCanvasClick?.(); }}
                onContextMenu={(e) => handleContextMenu(e as any)}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleDrop}
                tabIndex={0}
            >
                <canvas
                    ref={workerCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none pixi-canvas"
                />
                {/* [REMOVED] Canvas 2D fallback no longer needed - PixiJS only */}
                {isDraggingOver && (
                    <div className="absolute inset-0 bg-sky-500/20 border-4 border-dashed border-sky-500 pointer-events-none flex items-center justify-center transition-all duration-200" style={{ zIndex: Z_INDEX.CANVAS_INTERACTION }}>
                        <p className="text-2xl font-bold text-white bg-black/50 px-4 py-2 rounded-lg">{t('uploader.orDragAndDrop', language)}</p>
                    </div>
                )}
                <div ref={worldDivRef} style={{ transformOrigin: '0 0', willChange: 'transform', pointerEvents: isZKeyDown ? 'none' : 'auto' }}>
                    {visibleGroups.map(group => (
                        <CanvasGroup
                            key={group.id}
                            group={group}
                            onMouseDown={(e, id) => handleElementMouseDown(e, id, 'group')}
                            onContextMenu={handleContextMenu}
                            isSuspended={!!groupEditModeId && group.id !== groupEditModeId}
                            onDoubleClick={setGroupEditModeId}
                            isZKeyDown={isZKeyDown}
                            onDownloadGroup={async (groupId) => {
                                const count = await useCanvasStore.getState().downloadGroup(groupId);
                                if (count > 0) {
                                    const message = count === 1
                                        ? t('downloadComplete', language)
                                        : t('downloadCompleteMultiple', language, { count });
                                    onNotification(message, 'success');
                                }
                            }}
                        />
                    ))}
                    {visibleImages.map(image => (
                        <React.Fragment key={image.id}>
                            <CanvasImage
                                image={image}
                                onContextMenu={handleContextMenu}
                                onMouseDown={(e, id) => handleElementMouseDown(e, id, 'image')}
                                onDoubleClick={(id) => {
                                    const state = useCanvasStore.getState();
                                    const img = state.boardImages.find(i => i.id === id);
                                    if (!img) return;
                                    if (editingImageId && id !== editingImageId) {
                                        // setRole([id], 'original') already atomically removes the previous original.
                                        // Calling setRole([prevOriginal.id], 'none') separately would cause two store
                                        // updates: the first fires syncBinding with no original → toolbarBoundImageId
                                        // becomes null, and the second may not rebind if the image isn't selected.
                                        setRole([id], 'original');
                                        onEditSelection(img);
                                    } else {
                                        setRole([id], img.role === 'original' ? 'none' : 'original');
                                    }
                                }}
                                onLoadGenerationParams={onLoadGenerationParams}
                                onZoomImage={onZoomCanvasImage}
                                onDownloadImage={onDownloadCanvasImage}
                            />
                            {groupEditModeId && image.groupId === groupEditModeId && selectedImageIds.has(image.id) && (
                                <TransformControls
                                    transform={{
                                        x: image.x,
                                        y: image.y,
                                        width: image.width,
                                        height: image.height,
                                        rotation: 0 // Rotation not yet supported in BoardImage
                                    }}
                                    onTransform={(updater) => {
                                        const newTransform = updater({
                                            x: image.x,
                                            y: image.y,
                                            width: image.width,
                                            height: image.height,
                                            rotation: 0
                                        });
                                        updateImage(image.id, {
                                            x: newTransform.x,
                                            y: newTransform.y,
                                            width: newTransform.width,
                                            height: newTransform.height
                                        });
                                    }}
                                    isInteractive={true}
                                    isSelected={true}
                                    showRotation={false}
                                    onMouseDown={(e) => handleElementMouseDown(e, image.id, 'image')}
                                    className="pointer-events-auto"
                                />
                            )}
                        </React.Fragment>
                    ))}
                    {memos.map(memo => {
                        const isEditing = editingMemoId === memo.id;
                        const isSelected = selectedMemoIds.has(memo.id);

                        return (
                            <React.Fragment key={memo.id}>
                                {/* Show transform controls only when selected and not editing */}
                                {isSelected && !isEditing ? (
                                    <TransformControls
                                        transform={{
                                            x: memo.x,
                                            y: memo.y,
                                            width: memo.width,
                                            height: memo.height,
                                            rotation: memo.rotation
                                        }}
                                        onTransform={(updater) => {
                                            const newTransform = updater({
                                                x: memo.x,
                                                y: memo.y,
                                                width: memo.width,
                                                height: memo.height,
                                                rotation: memo.rotation
                                            });

                                            // Calculate new font size based on height change
                                            const heightRatio = newTransform.height / memo.height;
                                            const desiredFontSize = memo.fontSize * heightRatio;

                                            // Clamp font size between 8px and 200px (increased max)
                                            const MIN_FONT_SIZE = 8;
                                            const MAX_FONT_SIZE = 200;
                                            const newFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, desiredFontSize));

                                            // If font size is clamped, adjust box size to match the clamped font size
                                            const actualFontRatio = newFontSize / memo.fontSize;
                                            const finalWidth = memo.width * actualFontRatio;
                                            const finalHeight = memo.height * actualFontRatio;

                                            // Allow all transformations including resize
                                            updateMemo(memo.id, {
                                                x: newTransform.x,
                                                y: newTransform.y,
                                                width: finalWidth,
                                                height: finalHeight,
                                                rotation: newTransform.rotation,
                                                fontSize: newFontSize
                                            });
                                        }}
                                        isInteractive={true}
                                        isSelected={true}
                                        showRotation={true}
                                        onMouseDown={(e) => {
                                            if (e.button === 0) {
                                                handleElementMouseDown(e, memo.id, 'memo');
                                            }
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, memo.id, 'memo')}
                                        className="pointer-events-auto"
                                        onDoubleClick={() => {
                                            setEditingMemoId(memo.id);
                                        }}
                                    >
                                        <div
                                            className="w-full h-full p-2 overflow-hidden cursor-text"
                                            style={{
                                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                color: memo.color,
                                                fontSize: `${memo.fontSize}px`,
                                                whiteSpace: 'pre',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {memo.text}
                                        </div>
                                    </TransformControls>
                                ) : (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: memo.x,
                                            top: memo.y,
                                            width: memo.width,
                                            height: memo.height,
                                            transform: `rotate(${memo.rotation}deg)`,
                                            transformOrigin: 'center',
                                            border: isEditing ? '2px solid #FFFF00' : '2px solid white',
                                            pointerEvents: 'auto',
                                        }}
                                        onMouseDown={(e) => {
                                            if (e.button === 0 && !isEditing) {
                                                const { handleMemoMouseDown } = useCanvasStore.getState();
                                                handleMemoMouseDown(memo.id, e.shiftKey);
                                            }
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, memo.id, 'memo')}
                                    >
                                        {isEditing ? (
                                            <textarea
                                                autoFocus
                                                className="w-full h-full p-2 resize-none outline-none"
                                                style={{
                                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                                    color: memo.color,
                                                    fontSize: `${memo.fontSize}px`,
                                                    border: 'none',
                                                    whiteSpace: 'pre',
                                                    overflow: 'hidden',
                                                }}
                                                value={memo.text}
                                                onChange={(e) => {
                                                    const newText = e.target.value;
                                                    // Measure text without maxWidth to allow it to grow naturally
                                                    const { width, height } = measureText(newText, memo.fontSize);
                                                    // Update both width and height to fit the text exactly
                                                    updateMemo(memo.id, { text: newText, width: Math.max(width, 50), height: Math.max(height, 40) });
                                                }}
                                                onBlur={() => setEditingMemoId(null)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setEditingMemoId(null);
                                                    }
                                                    e.stopPropagation();
                                                }}
                                            />
                                        ) : (
                                            <div
                                                className="w-full h-full p-2 cursor-move"
                                                style={{
                                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                    color: memo.color,
                                                    fontSize: `${memo.fontSize}px`,
                                                    whiteSpace: 'pre',
                                                    overflow: 'hidden',
                                                }}
                                                onDoubleClick={() => {
                                                    setEditingMemoId(memo.id);
                                                    const { handleMemoMouseDown } = useCanvasStore.getState();
                                                    handleMemoMouseDown(memo.id, false);
                                                }}
                                                onMouseDown={(e) => {
                                                    if (e.button === 0) {
                                                        handleElementMouseDown(e, memo.id, 'memo');
                                                    }
                                                }}
                                            >
                                                {memo.text}
                                            </div>
                                        )}
                                    </div>
                                )
                                }
                            </React.Fragment>
                        );
                    })}
                    {marquee && (
                        <div
                            className="absolute border-2 border-dashed border-white bg-white/20 pointer-events-none"
                            style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height, zIndex: Z_INDEX.DROPDOWN }}
                        />
                    )}
                    {selectionBounds && <SelectionBox bounds={selectionBounds} />}
                </div>
                <input type="file" ref={fileInputRef} multiple accept="image/*,.nyang,.rfy,.bananyang" className="hidden" onChange={async (e) => {
                    if (e.target.files) {
                        const files: File[] = Array.from(e.target.files);
                        const workspaceFiles = files.filter(f => f.name.endsWith('.nyang') || f.name.endsWith('.rfy') || f.name.endsWith('.bananyang'));
                        if (workspaceFiles.length > 0) {
                            for (const wf of workspaceFiles) {
                                try {
                                    const content = await fileToText(wf);
                                    onLoadWorkspace(content);
                                    await new Promise(r => setTimeout(r, 0));
                                } catch (err) {
                                    console.error('Failed to read workspace file:', err instanceof Error ? err.message : String(err));
                                }
                            }
                        } else {
                            handleUploadAndPositionImages(files);
                        }
                    }
                    // Reset input value to allow selecting the same file again
                    e.target.value = '';
                }} />
            </div>
        </div >
    );
};

interface CanvasProps {
    allHistoryMedia: GeneratedMedia[];
    language: Language;
    onZoomSelection: (media: File | string | null) => void;
    onEditSelection: (imageId: string) => void;
    onNewWorkspace: () => void;
    onSaveWorkspace: () => void;
    onSaveWorkspaceAs: () => void;
    onLoadWorkspace: (content?: string, filePath?: string) => void;
    mainPanelRef: React.RefObject<HTMLElement>;
    customPrompt: string;
    onCustomPromptChange: (prompt: string) => void;
    onQueueGeneration: (task: GenerationTask) => void;
    isProcessing: boolean;
    generationQueue: GenerationTask[];
    originalImage: BoardImage | undefined;
    modelName: ModelName;
    notification: { id: number; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
    onNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    isModalOpen: boolean;
    onCopySelection: () => Promise<Blob | null>;
    onPasteFromClipboard: (position: { x: number; y: number; }) => void;
    folders: PromptFolder[];
    saveFolders: (folders: PromptFolder[]) => void;
    onSavePreset: () => void;
    onLoadGenerationParams: (params: GenerationParams) => void;
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    onSetSaveDirectoryHandle: (handle: FileSystemDirectoryHandle) => void;
    handleUploadAndPositionImages: (files: File[], position?: { x: number; y: number; }) => void;
    editingImageId?: string;
    onCanvasClick?: () => void;
    onZoomCanvasImage?: (image: BoardImage) => void;
    onDownloadCanvasImage?: (image: BoardImage) => void;
}

export const Canvas: React.FC<CanvasProps> = (props) => {
    const [isPresetDropdownOpen, setIsPresetDropdownOpen] = React.useState(false);
    const [promptPanelHeight, setPromptPanelHeight] = React.useState(80);
    const promptPanelRef = React.useRef<HTMLDivElement>(null);

    // Measure prompt panel height
    React.useEffect(() => {
        const el = promptPanelRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setPromptPanelHeight(entry.contentRect.height);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <InfiniteCanvas
                allHistoryMedia={props.allHistoryMedia}
                language={props.language}
                onZoomSelection={props.onZoomSelection}
                onEditSelection={props.onEditSelection}
                onNewWorkspace={props.onNewWorkspace}
                onSaveWorkspace={props.onSaveWorkspace}
                onSaveWorkspaceAs={props.onSaveWorkspaceAs}
                onLoadWorkspace={props.onLoadWorkspace}
                notification={props.notification}
                onNotification={props.onNotification}
                isModalOpen={props.isModalOpen}
                onCopySelection={props.onCopySelection}
                onPasteFromClipboard={props.onPasteFromClipboard}
                onLoadGenerationParams={props.onLoadGenerationParams}
                saveDirectoryHandle={props.saveDirectoryHandle}
                onSetSaveDirectoryHandle={props.onSetSaveDirectoryHandle}
                editingImageId={props.editingImageId}
                onCanvasClick={props.onCanvasClick}
                onZoomCanvasImage={props.onZoomCanvasImage}
                onDownloadCanvasImage={props.onDownloadCanvasImage}
            />
            <GlobalCanvasListeners onSaveWorkspace={props.onSaveWorkspace} onSaveWorkspaceAs={props.onSaveWorkspaceAs} onLoadWorkspace={props.onLoadWorkspace} isModalOpen={props.isModalOpen} />
            <PromptPanel
                customPrompt={props.customPrompt}
                onCustomPromptChange={props.onCustomPromptChange}
                onQueueGeneration={props.onQueueGeneration}
                isProcessing={props.isProcessing}
                generationQueue={props.generationQueue}
                originalImage={props.originalImage}
                modelName={props.modelName}
                language={props.language}
                mainPanelRef={props.mainPanelRef}
                onNotification={props.onNotification}
                folders={props.folders}
                onSavePreset={props.onSavePreset}
                saveFolders={props.saveFolders}
                onPresetDropdownStateChange={setIsPresetDropdownOpen}
                panelRef={promptPanelRef}
            />
            <RoleThumbnails
                language={props.language}
                modelName={props.modelName}
                onImageDoubleClick={(image) => {
                    const { zoomToImage } = useCanvasStore.getState();
                    if (props.mainPanelRef.current) {
                        zoomToImage(image, props.mainPanelRef.current.getBoundingClientRect());
                    }
                }}
                isPresetDropdownOpen={isPresetDropdownOpen}
                promptPanelHeight={promptPanelHeight}
            />

        </>
    )
}