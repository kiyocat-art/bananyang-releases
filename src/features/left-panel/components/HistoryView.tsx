import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
// FIX: Corrected import path to point to the correct types file within the src directory.
import { GeneratedMedia, GenerationTask, MonthlyCredit, GenerationParams, AiAction } from '../../../types';
import { t, Language, TranslationKey } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { FolderIcon, CloseIcon, DownloadIcon, MagnifyIcon, CheckIcon, PencilIcon, SparklesIcon, PauseFilledIcon, PlayFilledIcon, CanvasAutoAddIcon } from '../../../components/icons';
import { useSettingsStore } from '../../../store/settingsStore';
import { GenerationSummaryContent } from '../../../components/GenerationSummaryContent';
import { HoverEdgeAutoScroll } from '../../../components/HoverEdgeAutoScroll';

interface HistoryViewProps {
    language: Language;
    isProcessing: boolean;
    isPaused: boolean;
    generationQueue: GenerationTask[];
    onCancelAll: () => void;
    onCancelSingleTask: (taskId: string) => void;
    onPauseGeneration: () => void;
    onResumeGeneration: () => void;
    allHistoryMedia: GeneratedMedia[];
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    onSelectSaveDirectory: () => void;
    onOpenSaveDirectory: () => void;
    onSetSaveDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
    selectedMediaIds: Set<string>;
    onSelectAllToggle: () => void;
    onDownloadSelectedMedia: () => void;
    onDeleteSelectedMedia: () => void;
    currentMedia: GeneratedMedia[];
    onHistoryDragStart: (e: React.DragEvent<HTMLElement>, media: GeneratedMedia) => void;
    onToggleMediaSelection: (id: string) => void;
    onZoomImage: (media: GeneratedMedia | string) => void;
    onDownload: (e: React.MouseEvent, media: GeneratedMedia) => void;
    downloadStatus: Record<string, 'downloading' | 'success'>;
    downloadedImageIds: Set<string>;
    totalPages: number;
    currentPage: number;
    onSetCurrentPage: (page: number | ((prev: number) => number)) => void;
    leftPanelWidth: number;
    onLoadGenerationParams: (params: GenerationParams) => void;
    onReorderQueue?: (ids: string[]) => void;
    onSelectSourceImage?: (mediaId: string) => void;
}

const getTaskSummary = (task: GenerationTask, lang: Language): string => {
    if (task.aiEditAction) {
        const keyMap: Record<AiAction, TranslationKey> = {
            'removeBackground': 'removeBackground.button',
            'keepBackgroundOnly': 'editModal.keepBackgroundOnly',
            'extractPose': 'aiEdit.extractPose',
            'autoColoring': 'aiEdit.autoColoring',
            'extractOutfit': 'aiEdit.extractOutfit',
            'variation': 'aiEdit.variation',
            'insertObject': 'aiEdit.insertObject',
            'expand': 'aiEdit.expand',
            'pbr': 'aiEdit.pbr',
            'pbr_advanced': 'aiEdit.pbr',
            'relight': 'aiEdit.relight',
            'inpainting': 'aiEdit.inpainting',
            'inpaintInsert': 'aiEdit.inpainting',
            'inpaintRemove': 'aiEdit.inpainting',
        };
        return t(keyMap[task.aiEditAction], lang);
    }
    if (task.selectedActionPose) return t('taskSummary.imagePose', lang);
    if (task.selectedObjectItems.length > 0) return t('taskSummary.imageConcept', lang, { item: t(`object.${task.selectedObjectItems[0]}` as TranslationKey, lang) });
    if (task.cameraView) return t('taskSummary.imageViews', lang, { count: 1 });
    if (!task.originalImage) return t('taskSummary.imageGenerate', lang);
    return t('taskSummary.imageEdit', lang);
};

export const HistoryView: React.FC<HistoryViewProps> = ({
    language, isProcessing, isPaused, generationQueue, onCancelAll, onCancelSingleTask,
    onPauseGeneration, onResumeGeneration,
    allHistoryMedia, saveDirectoryHandle, onSelectSaveDirectory, onOpenSaveDirectory, onSetSaveDirectoryHandle,
    selectedMediaIds, onSelectAllToggle, onDownloadSelectedMedia, onDeleteSelectedMedia,
    currentMedia, onHistoryDragStart, onToggleMediaSelection, onZoomImage, onDownload,
    downloadStatus, downloadedImageIds, totalPages, currentPage, onSetCurrentPage,
    leftPanelWidth, onLoadGenerationParams, onReorderQueue, onSelectSourceImage
}) => {
    const autoAddToCanvas = useSettingsStore(state => state.autoAddToCanvas);
    const setAutoAddToCanvas = useSettingsStore(state => state.setAutoAddToCanvas);
    const [queueHeight, setQueueHeight] = useState(128);
    const prevMediaIdsRef = useRef<Set<string>>(new Set());
    const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
    const isDraggingDivider = useRef(false);
    const queueScrollRef = useRef<HTMLDivElement>(null);
    const historyScrollRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);

    // ── 생성대기열 드래그 재정렬 상태
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    const handleQueueDragStart = useCallback((id: string) => (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setDraggingId(id);
        setOverIndex(null);
    }, []);

    const handleQueueDragOver = useCallback((index: number) => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverIndex(index);
    }, []);

    const handleQueueDrop = useCallback((targetIndex: number) => (e: React.DragEvent) => {
        e.preventDefault();
        setDraggingId(prev => {
            if (!prev) return null;
            const pendingItems = generationQueue.slice(isProcessing ? 1 : 0);
            const fromIndex = pendingItems.findIndex(t => t.id === prev);
            if (fromIndex === -1 || fromIndex === targetIndex) return null;
            const newPending = [...pendingItems];
            const [removed] = newPending.splice(fromIndex, 1);
            newPending.splice(targetIndex, 0, removed);
            const newQueue = [
                ...(isProcessing ? [generationQueue[0]] : []),
                ...newPending,
            ];
            onReorderQueue?.(newQueue.map(t => t.id));
            return null;
        });
        setOverIndex(null);
    }, [generationQueue, isProcessing, onReorderQueue]);

    const handleQueueDragEnd = useCallback(() => {
        setDraggingId(null);
        setOverIndex(null);
    }, []);

    // Derive cols directly from panel width — eliminates ResizeObserver timing bug
    // (Observer was missing when gridContainer was conditionally unmounted on first render)
    const cols: 1 | 2 | 3 = leftPanelWidth >= 400 ? 3 : leftPanelWidth >= 180 ? 2 : 1;

    const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingDivider.current = true;
        dragStartY.current = e.clientY;
        dragStartHeight.current = queueHeight;

        const handleMouseMove = (ev: MouseEvent) => {
            if (!isDraggingDivider.current) return;
            const delta = ev.clientY - dragStartY.current;
            const newHeight = Math.max(80, Math.min(400, dragStartHeight.current + delta));
            setQueueHeight(newHeight);
        };

        const handleMouseUp = () => {
            isDraggingDivider.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [queueHeight]);

    useEffect(() => {
        const currentIds = new Set(allHistoryMedia.map(m => m.id));
        const added = new Set<string>();
        currentIds.forEach(id => {
            if (!prevMediaIdsRef.current.has(id)) added.add(id);
        });
        if (added.size > 0) {
            setNewlyAddedIds(added);
            const timer = setTimeout(() => setNewlyAddedIds(new Set()), 900);
            prevMediaIdsRef.current = currentIds;
            return () => clearTimeout(timer);
        }
        prevMediaIdsRef.current = currentIds;
    }, [allHistoryMedia]);

    return (
        <div className="flex flex-col flex-grow p-4 pt-2 space-y-3 min-h-0">
            <style>{`
                @keyframes progress-to-90 {
                    from { width: 0%; }
                    to { width: 90%; }
                }
                @keyframes history-item-new {
                    0%   { transform: scale(0.88); box-shadow: 0 0 0 0px rgba(255,255,255,0); }
                    35%  { transform: scale(1.09); box-shadow: 0 0 0 3px rgba(255,255,255,1); }
                    60%  { transform: scale(0.97); box-shadow: 0 0 0 2px rgba(255,255,255,0.9); }
                    80%  { transform: scale(1.02); box-shadow: 0 0 0 2px rgba(255,255,255,0.5); }
                    100% { transform: scale(1.00); box-shadow: 0 0 0 0px rgba(255,255,255,0); }
                }
                .history-item-new {
                    animation: history-item-new 800ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
            `}</style>
            <div className="flex-shrink-0 space-y-3">
                {(isProcessing || generationQueue.length > 0) && (
                    <>
                        <div className="flex justify-between items-center">
                            <h3 className="text-base font-bold text-zinc-100">
                                {t('queue.title', language)}
                            </h3>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={isPaused ? onResumeGeneration : onPauseGeneration}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${isPaused ? 'text-zinc-100 bg-zinc-600 hover:bg-zinc-500' : 'text-zinc-400 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-300'}`}
                                    title={isPaused ? '재개' : '일시정지'}
                                >
                                    {isPaused
                                        ? <><PlayFilledIcon className="w-3 h-3" /><span>재개</span></>
                                        : <><PauseFilledIcon className="w-3 h-3" /><span>정지</span></>
                                    }
                                </button>
                                <button onClick={onCancelAll} className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors">{t('queue.cancelAll', language)}</button>
                            </div>
                        </div>
                        <div className="relative" style={{ height: `${queueHeight}px` }}>
                        <div ref={queueScrollRef} className="h-full space-y-1.5 overflow-y-auto pr-1 dark-glass-scrollbar">
                            {isProcessing && generationQueue.length > 0 && (
                                <div className="bg-neutral-900/50 p-2 rounded-md flex gap-2">
                                    {generationQueue[0].thumbnailDataUrl && (
                                        <img
                                            src={generationQueue[0].thumbnailDataUrl}
                                            alt=""
                                            className="w-12 h-12 object-cover rounded flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-zinc-200 truncate">{getTaskSummary(generationQueue[0], language)}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-zinc-300 font-semibold">{t('queue.processing', language, { count: generationQueue.length - 1 })}</span>
                                                <button onClick={() => onCancelSingleTask(generationQueue[0].id)} className="text-xs text-zinc-500 hover:text-white">&times; {t('queue.cancel', language)}</button>
                                            </div>
                                        </div>
                                        <div className="w-full bg-neutral-600 rounded-full h-1.5">
                                            <div
                                                className="bg-yellow-400 h-1.5 rounded-full"
                                                style={{
                                                    animation: `progress-to-90 ${generationQueue[0].modelName?.includes('gemini-3') ? '52s' : '15s'} ease-out forwards`
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {generationQueue.slice(isProcessing ? 1 : 0).map((task, index) => {
                                const isDragging = draggingId === task.id;
                                const isDropTarget = overIndex === index && draggingId !== task.id;
                                return (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={handleQueueDragStart(task.id)}
                                        onDragOver={handleQueueDragOver(index)}
                                        onDrop={handleQueueDrop(index)}
                                        onDragEnd={handleQueueDragEnd}
                                        className={`bg-neutral-900/50 border p-2 rounded-md flex items-center gap-2 select-none ${isDropTarget ? 'border-t-2 border-t-blue-400 border-white/10' : 'border-white/10'}`}
                                        style={{ opacity: isDragging ? 0.35 : 1, cursor: 'grab', transition: 'opacity 150ms' }}
                                    >
                                        {task.thumbnailDataUrl && (
                                            <img
                                                src={task.thumbnailDataUrl}
                                                alt=""
                                                className="w-10 h-10 object-cover rounded flex-shrink-0"
                                            />
                                        )}
                                        <span className="text-sm text-zinc-400 truncate flex-1">{getTaskSummary(task, language)}</span>
                                        <button onClick={() => onCancelSingleTask(task.id)} className="text-xs text-zinc-500 hover:text-white flex-shrink-0">&times; {t('queue.cancel', language)}</button>
                                    </div>
                                );
                            })}
                        </div>
                        <HoverEdgeAutoScroll targetRef={queueScrollRef} />
                        </div>
                        <div
                            className="flex-shrink-0 flex items-center justify-center h-3 cursor-row-resize group select-none"
                            onMouseDown={handleDividerMouseDown}
                        >
                            <div className="w-16 h-1 rounded-full bg-white/10 group-hover:bg-white/30 transition-colors" />
                        </div>
                    </>
                )}
            </div>
            <div className="flex-grow flex flex-col min-h-0">
                <div className="flex-shrink-0 mb-2 p-2 bg-neutral-900/50 border border-white/10 rounded-xl">
                    {/* 2행 × 3열: [제목/폴더] [자동추가/다운로드] [선택/삭제] */}
                    <div className="grid gap-x-2 gap-y-1 items-center" style={{ gridTemplateColumns: '1fr auto auto' }}>
                        {/* Row 1, Col 1: 제목 */}
                        <h2 className="text-base font-bold text-zinc-100 min-w-0">{t('section.history.title', language)}</h2>
                        {/* Row 1, Col 2: 자동추가 */}
                        <Tooltip tip={autoAddToCanvas ? '캔버스 자동추가 켜짐' : '캔버스 자동추가 꺼짐'} position="top">
                            <button onClick={() => setAutoAddToCanvas(!autoAddToCanvas)} className={`w-8 h-8 flex items-center justify-center rounded-md border transition-colors ${autoAddToCanvas ? 'text-yellow-400 bg-yellow-400/15 border-yellow-400/30 hover:bg-yellow-400/25' : 'text-zinc-500 bg-white/5 border-white/10 hover:bg-white/10 hover:text-zinc-300'}`}>
                                <CanvasAutoAddIcon className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        {/* Row 1, Col 3: 선택 */}
                        <Tooltip tip={t('tooltip.selectAllOnPage', language)} position="top">
                            <button onClick={onSelectAllToggle} className="w-8 h-8 flex items-center justify-center bg-white/10 border border-white/10 rounded-md text-zinc-300 hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                            </button>
                        </Tooltip>
                        {/* Row 2, Col 1: 폴더 설정 */}
                        <div className="w-fit max-w-full min-w-0">
                            {saveDirectoryHandle ? (
                                <div className="flex items-center gap-1 text-xs bg-black/30 text-zinc-300 rounded-md px-1.5 py-1 border border-white/10 min-w-0 max-w-full">
                                    <Tooltip tip="폴더 열기" position="top">
                                        <button onClick={onOpenSaveDirectory} className="text-zinc-300 hover:text-white transition-colors flex-shrink-0"><FolderIcon className="w-3.5 h-3.5" /></button>
                                    </Tooltip>
                                    <Tooltip tip={saveDirectoryHandle.name} position="top">
                                        <span className="font-mono truncate min-w-0">{saveDirectoryHandle.name}</span>
                                    </Tooltip>
                                    <Tooltip tip={t('tooltip.unsetSaveDirectory', language)} position="top">
                                        <button onClick={() => onSetSaveDirectoryHandle(null)} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0 ml-1"><CloseIcon className="w-3 h-3" /></button>
                                    </Tooltip>
                                </div>
                            ) : (
                                <Tooltip tip={t('tooltip.setSaveDirectory', language)} position="top">
                                    <button onClick={onSelectSaveDirectory} className="flex items-center gap-1.5 px-1.5 py-1 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs transition-colors">
                                        <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                        {/* Row 2, Col 2: 다운로드 */}
                        <Tooltip tip={t('tooltip.downloadSelected', language, { count: selectedMediaIds.size })} position="top">
                            <button onClick={onDownloadSelectedMedia} disabled={selectedMediaIds.size === 0} className="w-8 h-8 flex items-center justify-center bg-white/10 border border-white/10 rounded-md text-zinc-300 hover:text-white transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed">
                                <DownloadIcon className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        {/* Row 2, Col 3: 삭제 */}
                        <Tooltip tip={t('tooltip.removeSelected', language, { count: selectedMediaIds.size })} position="top">
                            <button onClick={onDeleteSelectedMedia} disabled={selectedMediaIds.size === 0} className="w-8 h-8 flex items-center justify-center bg-white/10 border border-white/10 rounded-md text-zinc-300 hover:text-red-400 hover:border-red-500/50 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </button>
                        </Tooltip>
                    </div>
                </div>
                {allHistoryMedia.length === 0 ? (
                    <div className="flex-grow flex items-center justify-center text-center text-zinc-500">
                        <p>{t('history.empty', language)}</p>
                    </div>
                ) : (
                    <div className="flex-grow relative min-h-0">
                    <div ref={historyScrollRef} className="h-full pr-1 overflow-y-auto dark-glass-scrollbar">
                        <div className={`grid gap-2 ${{ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[cols]}`}>
                            {currentMedia.map((media, index) => (
                                <div key={media.id} draggable={media.type === 'image'} onDragStart={(e) => onHistoryDragStart(e, media)} className={`relative group aspect-square rounded-md ${newlyAddedIds.has(media.id) ? 'history-item-new' : ''}`} onClick={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) { onToggleMediaSelection(media.id); } else { onSelectSourceImage?.(media.id); } }}>
                                    <img src={media.proxySrc || media.src || media.thumbnailSrc || media.tinySrc} alt={`Generated ${media.type} ${index}`} className="w-full h-full object-cover rounded-md bg-neutral-700" loading="lazy" />
                                    {/* ── Hover overlay ── */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-md pointer-events-none" />
                                    {/* ── Backend badge (bottom-left) ── */}
                                    {media.generatedBy && (
                                        <div className={`absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold backdrop-blur-sm pointer-events-none ${
                                            media.generatedBy === 'vertex'
                                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                                : media.generatedBy === 'openai'
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : media.generatedBy === 'flux'
                                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                : 'bg-zinc-500/20 text-zinc-300 border border-white/10'
                                        }`}>
                                            {t(
                                                media.generatedBy === 'vertex' ? 'badge.vertexAi'
                                                : media.generatedBy === 'openai' ? 'badge.openai'
                                                : media.generatedBy === 'flux' ? 'badge.flux'
                                                : 'badge.aiStudio',
                                                language
                                            )}
                                        </div>
                                    )}
                                    {/* ── Icon cluster — ㄱ shape at top-right ── */}
                                    <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        {/* Top row: P + Zoom */}
                                        <div className="flex gap-1.5">
                                            {media.generationParams && (
                                                <Tooltip tip={<GenerationSummaryContent params={media.generationParams} language={language} />} position="top" className="text-left">
                                                    <button onClick={(e) => { e.stopPropagation(); onLoadGenerationParams(media.generationParams!); }} className="w-8 h-8 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-md text-white font-bold text-sm border border-white/20 hover:bg-white/40 hover:text-black transition-all cursor-pointer">
                                                        P
                                                    </button>
                                                </Tooltip>
                                            )}
                                            <Tooltip tip={t('tooltip.zoomImage', language)} position="top">
                                                <button onClick={(e) => { e.stopPropagation(); onZoomImage(media); }} className="w-8 h-8 flex items-center justify-center bg-black/60 rounded-md text-white hover:bg-white/30 transition-colors cursor-pointer">
                                                    <MagnifyIcon className="w-4 h-4" />
                                                </button>
                                            </Tooltip>
                                        </div>
                                        {/* Bottom: Download (right-aligned → ㄱ shape) */}
                                        <Tooltip tip={downloadedImageIds.has(media.id) ? t('tooltip.downloadAgain', language) : (media.type === 'video' ? t('tooltip.downloadMp4', language) : t('tooltip.downloadImage', language))} position="top">
                                            <button onClick={(e) => onDownload(e, media)} className="w-8 h-8 flex items-center justify-center bg-black/60 rounded-md text-white hover:bg-white/30 transition-colors cursor-pointer">
                                                {downloadStatus[media.id] === 'downloading' ? <LoadingSpinner className="h-4 w-4" /> : <DownloadIcon className="w-4 h-4" />}
                                            </button>
                                        </Tooltip>
                                    </div>
                                    {selectedMediaIds.has(media.id) && (
                                        <div className="absolute inset-0 border-2 border-white rounded-md pointer-events-none">
                                            <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-white text-zinc-800 rounded-full flex items-center justify-center"><CheckIcon /></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-2 pb-1">
                                <button
                                    onClick={() => onSetCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="px-2.5 py-1 text-xs font-medium text-zinc-300 bg-white/10 border border-white/10 rounded-md hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    ‹
                                </button>
                                <span className="text-xs text-zinc-400 tabular-nums">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => onSetCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="px-2.5 py-1 text-xs font-medium text-zinc-300 bg-white/10 border border-white/10 rounded-md hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    ›
                                </button>
                            </div>
                        )}
                    </div>
                    <HoverEdgeAutoScroll targetRef={historyScrollRef} />
                    </div>
                )}
            </div>
        </div>
    );
};
