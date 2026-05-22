import { createStore, useStore, type StoreApi } from 'zustand';
import { useSyncExternalStore } from 'react';
import { produceWithPatches, enablePatches, applyPatches, Patch, enableMapSet } from 'immer';
import { BoardImage, GeneratedMedia, BoardGroup, GenerationParams, ChatMessage, Memo, LightSource, InpaintWorkType } from '../types';
import { blobManager } from '../utils/blobManager';
import { t } from '../localization';
import { imageLoader } from '../services/ImageLoaderService';
import { encodeImageToKTX2 } from '../services/dataWorkerService';
import { useGenerationStore } from './generationStore';
import { useSettingsStore } from './settingsStore';
import { useMetadataStore } from './metadataStore';
import { REF_COLORS } from '../constants';
import { CANVAS_ZINDEX_BASE } from '../constants/zIndex';
import {
    DEFAULT_MASK_FEATHER_RADIUS,
    DEFAULT_INPAINT_CONTEXT_PADDING,
    DEFAULT_INPAINT_TONE_MATCH,
    DEFAULT_INPAINT_BRUSH_SIZE,
    DEFAULT_INPAINT_VARIATION_STRENGTH,
    DEFAULT_INPAINT_MODE,
    DEFAULT_INPAINT_OVERRIDES,
    type InpaintOverrides,
    type InpaintOverrideKey,
} from '../constants/inpaint';
import type { SceneContext } from '../services/sceneContextService';
import { pLimit } from '../utils/concurrency';
import { generateThumbnail, dataURLtoFile, ensureBoardImageFile, generateTinySrc } from '../utils/imageUtils';
import { revokeImageResources, updateActiveReferenceIndex, alignGrid, resizeGroup } from '../utils/canvasUtils';
import { clearLoadQueue, clearFailedBlobUrls, clearTinyPreloadQueue } from '../features/canvas/hooks/useCanvasWorker';






enablePatches();
enableMapSet();

/**
 * 역할에 맞는 다음 캔버스 z-index를 계산한다.
 * 역할 이미지는 반드시 일반 이미지(none/background)보다 위에 위치해야 하며,
 * 같은 역할 그룹 내에서는 기존 최댓값 + 1을 반환한다.
 */
function computeRoleZIndex(role: BoardImage['role'], images: BoardImage[]): number {
    const base = CANVAS_ZINDEX_BASE[role] ?? 0;
    const maxInRole = images
        .filter(img => img.role === role)
        .reduce((max, img) => Math.max(max, img.zIndex), base);
    return maxInRole + 1;
}

const MAX_HISTORY_LENGTH_DEFAULT = 10;
const MAX_HISTORY_LENGTH_MAX = 50;

interface SavedSnapshot {
    boardImages: BoardImage[];
    boardGroups: BoardGroup[];
    memos: Memo[];
    selectedImageIds: Set<string>;
    selectedGroupIds: Set<string>;
    selectedMemoIds: Set<string>;
    zIndexCounter: number;
}

interface HistoryEntry {
    patches: Patch[];
    inversePatches: Patch[];
    timestamp: number;
    snapshot: SavedSnapshot;
    actionType: 'delete' | 'move' | 'other';
}


interface CanvasState {
    boardImages: BoardImage[];
    boardGroups: BoardGroup[];
    memos: Memo[];
    selectedImageIds: Set<string>;
    selectedGroupIds: Set<string>;
    selectedMemoIds: Set<string>;
    pan: { x: number; y: number };
    zoom: number;
    activeReferenceIndex: number | null;
    zIndexCounter: number;
    editingGroupId: string | null;
    groupEditModeId: string | null;
    chatHistory: ChatMessage[];
    leftPanelTab: 'history' | 'chat' | 'settings';
    marquee: { x: number; y: number; width: number; height: number; } | null;
    lightingClipboard: { type: 'single' | 'all', data: LightSource[] } | null;
    // 객체 삽입 모드 및 단축키 컨텍스트
    isObjectInsertMode: boolean;
    activeKeyboardContext: 'canvas' | 'editor';
    insertTargetImage: BoardImage | null;
    isShiftDown: boolean;
    // Merge groups modal
    mergeGroupsModalOpen: boolean;
    inpaintMode: 'insert' | 'remove';
    inpaintWorkType: InpaintWorkType | null;
    maskFeatherRadius: number;
    inpaintContextPadding: number;
    inpaintToneMatch: boolean;
    inpaintBrushSize: number;
    inpaintEraserMode: boolean;
    inpaintSmartHint: string;
    // Unified-mode override tracking — true = user opted out of AI default for this field
    inpaintOverrides: InpaintOverrides;
    // Scene Analyzer master/sub toggles
    inpaintSceneAnalyzerEnabled: boolean;
    inpaintAnatomyConstraintsEnabled: boolean;
    inpaintSceneAwareEnabled: boolean;
    // Variation strength slider (0.0-1.0). Influences prompt when user hint is empty.
    inpaintVariationStrength: number;
    // Latest Scene Analyzer result (for UI to show AI suggestions / highlights). Null until first analysis.
    lastSceneContext: SceneContext | null;
    // Object editor thumbnails (for RoleThumbnails display)
    objectEditorImages: { id: string; src: string; file?: File }[];
    // Undo/Redo history
    history: HistoryEntry[];
    // Internal state to track changes for patching
    lastCommittedSnapshot: SavedSnapshot;
    historyIndex: number;
}

interface CanvasActions {
    setBoardImages: (updater: (prev: BoardImage[]) => BoardImage[]) => void;
    setSelectedImageIds: (updater: (prev: Set<string>) => Set<string>) => void;
    setBoardGroups: (updater: (prev: BoardGroup[]) => BoardGroup[]) => void;
    setSelectedGroupIds: (updater: (prev: Set<string>) => Set<string>) => void;
    setEditingGroupId: (id: string | null) => void;
    setGroupEditModeId: (id: string | null) => void;
    removeImageFromGroup: (imageId: string) => void;
    setPan: (updater: (prev: { x: number; y: number }) => { x: number; y: number }) => void;
    setZoom: (updater: (prev: number) => number) => void;
    addImagesToCenter: (media: GeneratedMedia[], canvasRect: DOMRect, sourceImageId?: string) => Promise<void>;
    uploadImages: (files: File[], position: { x: number; y: number }, canvasRect: DOMRect) => Promise<void>;
    addHistoryImage: (mediaItem: GeneratedMedia, position: { x: number; y: number }, canvasRect: DOMRect) => Promise<void>;
    updateImage: (id: string, updates: Partial<BoardImage>) => void;
    updateImageWithHistory: (id: string, updates: Partial<BoardImage>) => void;
    updateGroup: (id: string, updates: Partial<BoardGroup>) => void;
    addImagesToExistingGroup: (groupId: string, imageIds: string[]) => void;
    deleteSelection: () => void;
    downloadSelection: (saveDirectoryHandle: FileSystemDirectoryHandle | null, format?: 'png' | 'webp') => Promise<void>;
    downloadImagesByIds: (imageIds: string[], format?: 'png' | 'webp') => Promise<number>;
    downloadGroup: (groupId: string, format?: 'png' | 'webp') => Promise<number>;
    setRoleForSelection: (role: BoardImage['role']) => void;
    setReferenceType: (type: 'general' | 'costume' | 'pose') => void;
    setRole: (imageIds: string[], role: BoardImage['role']) => void;
    clearRoleForSelection: () => void;
    clearActiveReferenceRole: () => void;
    alignSelection: () => void;
    alignRoleImagesToOriginal: () => void;
    addNewCanvasImage: (dataUrl: string, file: File, originalImage?: BoardImage) => void;
    handleImageMouseDown: (imageId: string, isShiftKey: boolean) => void;
    handleGroupMouseDown: (groupId: string, isShiftKey: boolean) => void;
    groupSelection: () => void;
    groupEditedImage: (originalImageId: string, newImage: BoardImage) => void;
    ungroupSelection: () => void;
    setGroupName: (id: string, name: string) => void;
    zoomToImage: (image: BoardImage, canvasRect: DOMRect) => void;
    zoomToGroup: (group: BoardGroup, canvasRect: DOMRect) => void;
    zoomToBounds: (bounds: { x: number, y: number, width: number, height: number }, canvasRect: DOMRect) => void;
    reorderBoardGroups: (draggedId: string, targetId: string) => void;
    dropSelectionOnGroup: (targetGroupId: string) => void;
    setChatHistory: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
    setLeftPanelTab: (tab: 'history' | 'chat' | 'settings') => void;
    clearCanvas: () => void;
    intelligentGrouping: (groups: { name: string; imageIds: string[] }[]) => void;
    aiSortImages: (onProgress?: (percent: number, status: string) => void, opts?: { axis?: import('../services/aiSortService').AxisMode; maxGroups?: number | 'auto'; verifyClusters?: boolean }) => Promise<void>;
    mergeGroups: (targetGroupId: string) => void;
    setMergeGroupsModalOpen: (open: boolean) => void;
    reset: () => void;
    setMarquee: (marquee: CanvasState['marquee']) => void;
    updateImageStyleIntensity: (id: string, intensity: number) => void;
    addMemo: (memo: Memo) => void;
    updateMemo: (id: string, updates: Partial<Memo>) => void;
    deleteMemo: (id: string) => void;
    handleMemoMouseDown: (id: string, isShiftKey: boolean) => void;
    setSelectedMemoIds: (updater: (prev: Set<string>) => Set<string>) => void;
    // Undo/Redo actions
    undo: () => void;
    redo: () => void;
    saveHistory: (actionType?: 'delete' | 'move' | 'other') => void;
    resetHistory: () => void;
    setIsShiftDown: (isShiftDown: boolean) => void;
    flipSelectionHorizontal: () => void;
    copyLighting: (type: 'single' | 'all', data: LightSource[]) => void;

    // KTX2 Background Encoding

    // 객체 삽입 모드 및 단축키 컨텍스트
    setObjectInsertMode: (isActive: boolean) => void;
    setActiveKeyboardContext: (context: 'canvas' | 'editor') => void;
    setInsertTargetImage: (image: BoardImage | null) => void;
    setInpaintMode: (mode: 'insert' | 'remove') => void;
    setInpaintWorkType: (workType: InpaintWorkType | null) => void;
    setMaskFeatherRadius: (radius: number) => void;
    setInpaintContextPadding: (ratio: number) => void;
    setInpaintToneMatch: (enabled: boolean) => void;
    setInpaintBrushSize: (size: number) => void;
    setInpaintEraserMode: (enabled: boolean) => void;
    setInpaintSmartHint: (hint: string) => void;
    setInpaintVariationStrength: (value: number) => void;
    setInpaintSceneAnalyzerEnabled: (enabled: boolean) => void;
    setInpaintAnatomyConstraintsEnabled: (enabled: boolean) => void;
    setInpaintSceneAwareEnabled: (enabled: boolean) => void;
    setLastSceneContext: (ctx: SceneContext | null) => void;
    // Unified-mode override controls
    markInpaintOverride: (key: InpaintOverrideKey, overridden: boolean) => void;
    resetInpaintField: (key: InpaintOverrideKey) => void;
    resetAllInpaintOverrides: () => void;
    addObjectEditorImage: (image: { id: string; src: string; file?: File }) => void;
    removeObjectEditorImage: (id: string) => void;
    clearObjectEditorImages: () => void;
    backgroundEncodeKTX2: () => Promise<void>;
}



const initialState: CanvasState = {
    boardImages: [],
    boardGroups: [],
    memos: [],
    selectedImageIds: new Set<string>(),
    selectedGroupIds: new Set<string>(),
    selectedMemoIds: new Set<string>(),
    pan: { x: 0, y: 0 },
    zoom: 1,
    activeReferenceIndex: null,
    zIndexCounter: 10,
    editingGroupId: null,
    groupEditModeId: null,
    chatHistory: [{ role: 'model', content: t('chat.intro', 'ko') }],
    leftPanelTab: 'history',
    marquee: null,
    lightingClipboard: null,
    // 객체 삽입 모드 및 단축키 컨텍스트
    mergeGroupsModalOpen: false,
    isObjectInsertMode: false,
    activeKeyboardContext: 'canvas',
    insertTargetImage: null,
    isShiftDown: false,
    inpaintMode: DEFAULT_INPAINT_MODE,
    inpaintWorkType: null,
    maskFeatherRadius: DEFAULT_MASK_FEATHER_RADIUS,
    inpaintContextPadding: DEFAULT_INPAINT_CONTEXT_PADDING,
    inpaintToneMatch: DEFAULT_INPAINT_TONE_MATCH,
    inpaintBrushSize: DEFAULT_INPAINT_BRUSH_SIZE,
    inpaintEraserMode: false,
    inpaintSmartHint: '',
    inpaintOverrides: { ...DEFAULT_INPAINT_OVERRIDES },
    inpaintSceneAnalyzerEnabled: true,
    inpaintAnatomyConstraintsEnabled: true,
    inpaintSceneAwareEnabled: true,
    inpaintVariationStrength: DEFAULT_INPAINT_VARIATION_STRENGTH,
    lastSceneContext: null,
    objectEditorImages: [],
    history: [],
    historyIndex: -1,
    lastCommittedSnapshot: {
        boardImages: [],
        boardGroups: [],
        memos: [],
        selectedImageIds: new Set(),
        selectedGroupIds: new Set(),
        selectedMemoIds: new Set(),
        zIndexCounter: 10,
    }
};

// ─── Tab Router ────────────────────────────────────────────────────────────────
// Lightweight event bus tracking which canvas instance is "active".
// workspaceTabsStore (Phase 2) will call canvasTabRouter.setActiveTabId() to
// drive tab switching. Components subscribe via useSyncExternalStore so they
// re-render automatically when the active tab changes.
let _activeTabId = 'default';
type _TabChangeListener = () => void;
const _tabListeners = new Set<_TabChangeListener>();

export const canvasTabRouter = {
    getActiveTabId: (): string => _activeTabId,
    setActiveTabId: (tabId: string): void => {
        _activeTabId = tabId;
        _tabListeners.forEach(fn => fn());
    },
    subscribe: (fn: _TabChangeListener): (() => void) => {
        _tabListeners.add(fn);
        return () => _tabListeners.delete(fn);
    },
};

type _CanvasStoreApi = StoreApi<CanvasState & CanvasActions>;
const _instances = new Map<string, _CanvasStoreApi>();




function createCanvasStoreInstance(): _CanvasStoreApi {
    return createStore<CanvasState & CanvasActions>()((set, get) => ({
    ...initialState,
    setIsShiftDown: (isShiftDown) => set({ isShiftDown }),
    setInsertTargetImage: (image) => set({ insertTargetImage: image }),

    setBoardImages: (updater) => set(state => {
        const newBoardImages = updater(state.boardImages);
        return { boardImages: newBoardImages, activeReferenceIndex: updateActiveReferenceIndex(newBoardImages, state.selectedImageIds) };
    }),
    setSelectedImageIds: (updater) => set(state => {
        const newSelectedImageIds = updater(state.selectedImageIds);
        return { selectedImageIds: newSelectedImageIds, activeReferenceIndex: updateActiveReferenceIndex(state.boardImages, newSelectedImageIds) };
    }),
    setBoardGroups: (updater) => set(state => ({ boardGroups: updater(state.boardGroups) })),
    setSelectedGroupIds: (updater) => set(state => ({ selectedGroupIds: updater(state.selectedGroupIds) })),
    setSelectedMemoIds: (updater) => set(state => ({ selectedMemoIds: updater(state.selectedMemoIds) })),
    setEditingGroupId: (id) => set({ editingGroupId: id }),
    setGroupEditModeId: (id) => set(state => {
        const oldGroupId = state.groupEditModeId;

        if (oldGroupId && id === null) {
            const groupImages = state.boardImages.filter(img => img.groupId === oldGroupId);
            if (groupImages.length > 0) {
                const group = state.boardGroups.find(g => g.id === oldGroupId);
                if (!group) return { ...state, groupEditModeId: null };

                const PADDING = 20;
                const { packImagesWithRolePriority, packImages } = require('../utils/binPacking');

                // Use hybrid packing with role priority, and enable normalization to STANDARD_SIZE (512px)
                const STANDARD_SIZE = 512;
                const positionUpdates = packImagesWithRolePriority(groupImages, group.x + PADDING, group.y + PADDING, PADDING, false, STANDARD_SIZE);

                // Apply updates
                const updatedImages = state.boardImages.map(img => {
                    const update = positionUpdates.get(img.id);
                    if (update) {
                        return {
                            ...img,
                            x: update.x,
                            y: update.y,
                            width: update.width ?? img.width,
                            height: update.height ?? img.height
                        };
                    }
                    return img;
                });

                const resizedState = resizeGroup(oldGroupId, updatedImages, state.boardGroups);

                // Save history after exiting group edit mode with alignment
                setTimeout(() => get().saveHistory(), 0);

                return {
                    boardImages: updatedImages,
                    ...resizedState,
                    groupEditModeId: null,
                    selectedImageIds: new Set(),
                    selectedGroupIds: new Set([oldGroupId])
                };
            }
        }

        return {
            groupEditModeId: id,
            selectedImageIds: new Set(),
            selectedGroupIds: id ? new Set([id]) : new Set()
        };
    }),
    setPan: (updater) => set(state => ({ pan: updater(state.pan) })),
    setZoom: (updater) => set(state => ({ zoom: updater(state.zoom) })),

    updateImage: (id, updates) => {
        get().setBoardImages(prev => prev.map(img => (img.id === id ? { ...img, ...updates } : img)));
        get().saveHistory();
    },
    updateImageWithHistory: (id, updates) => {
        get().updateImage(id, updates);
    },
    updateGroup: (id, updates) => {
        get().setBoardGroups(prev => prev.map(g => (g.id === id ? { ...g, ...updates } : g)));
        get().saveHistory();
    },
    setGroupName: (id, name) => get().updateGroup(id, { name }),

    addNewCanvasImage: async (dataUrl, file, originalImage) => {
        // Import optimization utilities
        const { optimizeImageForCanvas } = await import('../utils/imageOptimization');

        // Optimize image (resize to max 2k for display, preserve original)
        const optimized = await optimizeImageForCanvas(file, 2048, true);

        // [PERF: async-parallel] Process canvas and generate tinySrc in parallel
        const [processed, { tinySrc, tinyFile }] = await Promise.all([
            imageLoader.processImage(optimized.displayFile),
            generateTinySrc(optimized.displayFile, 128)
        ]);

        // Normalize to standard size (512px)
        const STANDARD_SIZE = 512;
        const aspect = processed.width / processed.height;
        let newWidth: number;
        let newHeight: number;
        if (aspect >= 1) {
            newWidth = STANDARD_SIZE;
            newHeight = STANDARD_SIZE / aspect;
        } else {
            newHeight = STANDARD_SIZE;
            newWidth = STANDARD_SIZE * aspect;
        }

        let zIndexCounter = get().zIndexCounter + 1;
        const newImage: BoardImage = {
            id: crypto.randomUUID(),
            src: processed.src,
            file: optimized.displayFile,
            originalSrc: optimized.originalSrc,
            originalFile: optimized.originalFile,
            x: originalImage ? originalImage.x + 20 : 0,
            y: originalImage ? originalImage.y + 20 : 0,
            width: newWidth,
            height: newHeight,
            role: 'none',
            zIndex: zIndexCounter,
            thumbnailSrc: tinySrc,
            tinySrc,
            tinyFile,
            originalDimensions: optimized.originalDimensions,
            scaleX: 1,
            highResSrc: optimized.highResSrc,
            highResDimensions: optimized.highResDimensions,
        };


        set(state => ({
            boardImages: [...state.boardImages, newImage],
            zIndexCounter,
            selectedImageIds: new Set([newImage.id]),
        }));

        // [KTX2] Trigger background encoding for GPU-optimized textures
        // Threshold: > 1024px (1K)
        (async () => {
            try {
                const { width, height } = newImage.originalDimensions || { width: 0, height: 0 };
                const isLargeEnough = width > 1024 || height > 1024;

                if (isLargeEnough) {
                    const { encodeImageToKTX2 } = await import('../services/dataWorkerService');
                    // Ensure file exists
                    const sourceFile = await ensureBoardImageFile(newImage, 'original') || await ensureBoardImageFile(newImage, 'display');

                    if (sourceFile) {
                        const result = await encodeImageToKTX2(newImage.id, sourceFile);
                        if (result.ktx2Src) {
                            set(state => ({
                                boardImages: state.boardImages.map(i =>
                                    i.id === newImage.id ? { ...i, ktx2Src: result.ktx2Src! } : i
                                )
                            }));
                            console.log(`[KTX2] ✅ Encoded ${newImage.id} -> ${result.ktx2Src}`);
                        }
                    }
                }
            } catch (error) {
                console.warn('[KTX2] ⚠️ Encoding failed (non-critical):', error);
            }
        })();
    },

    addImagesToCenter: async (media, canvasRect, sourceImageId) => {
        if (media.length === 0) return;

        // [Memory Optimization] Check image count limit before adding
        const currentCount = get().boardImages.length;
        const { imageLimitConfig } = useSettingsStore.getState();

        if (currentCount + media.length > imageLimitConfig.hardLimit) {
            const allowedCount = Math.max(0, imageLimitConfig.hardLimit - currentCount);
            if (allowedCount === 0) {
                console.warn(`[CanvasStore] Image limit reached (${imageLimitConfig.hardLimit}). Cannot add more images.`);
                // Dispatch custom event for UI to show warning
                window.dispatchEvent(new CustomEvent('canvas-image-limit-reached', {
                    detail: { currentCount, hardLimit: imageLimitConfig.hardLimit, attemptedCount: media.length }
                }));
                return;
            }
            // Truncate media array to fit within limit
            console.warn(`[CanvasStore] Truncating ${media.length} images to ${allowedCount} due to limit.`);
            media = media.slice(0, allowedCount);
        }

        try {

            // Process images in parallel
            const processedNewImages = await Promise.all(media.map(async (item) => {
                try {
                    // [Case 1: Pre-processed AI Image]
                    // If the item already has optimization data, transfer ownership and skip processing
                    if (item.file && item.tinySrc) {
                        // [Scale Control] Calculate dimensions maintaining aspect ratio within BASE_SIZE
                        const BASE_SIZE = 512;
                        let newWidth = BASE_SIZE;
                        let newHeight = BASE_SIZE;

                        if (item.originalDimensions) {
                            const { width: rawW, height: rawH } = item.originalDimensions;
                            // Use user's recommended logic structure
                            const ratio = rawH / rawW;

                            if (rawW >= rawH) {
                                // Landscape
                                newWidth = BASE_SIZE;
                                newHeight = BASE_SIZE * ratio;
                            } else {
                                // Portrait
                                newHeight = BASE_SIZE;
                                newWidth = BASE_SIZE / ratio;
                            }
                        }

                        return {
                            id: item.id,
                            src: item.src,                      // Display URL (max 2k or proxy)
                            file: item.file,                    // Display file (max 2k)
                            originalSrc: item.originalSrc || item.src,
                            originalFile: item.originalFile || item.file,
                            x: 0,
                            y: 0,
                            width: newWidth,
                            height: newHeight,
                            role: 'none',
                            zIndex: 0,
                            generationParams: item.generationParams,
                            thumbnailSrc: item.thumbnailSrc || item.tinySrc, // Use tinySrc if thumbnail missing
                            tinySrc: item.tinySrc,              // [VRAM FIX] 128px for zoom <= 100%
                            tinyFile: item.tinyFile,            // [VRAM FIX] File for worker requests
                            isGenerated: true,                  // AI Generated
                            originalDimensions: item.originalDimensions,
                            scaleX: 1,
                            // Use pre-calculated proxy/highRes if available
                            proxySrc: item.proxySrc,
                            proxyFile: item.proxyFile,
                            highResSrc: item.highResSrc,
                            highResDimensions: item.highResDimensions
                        } as BoardImage;
                    }

                    // [Case 2: Raw Image (Fallback / Legacy / Other Sources)]
                    // Import optimization utilities only when needed
                    const { optimizeImageForCanvas } = await import('../utils/imageOptimization');
                    const { generateTinySrc } = await import('../utils/imageUtils');

                    // Fetch the original image
                    const response = await fetch(item.src);
                    const blob = await response.blob();
                    const pngFile = new File([blob], `generated-${item.id}.png`, { type: 'image/png' });

                    // Convert to WebP immediately to ensure consistent format and avoid re-conversion on load
                    const { convertToWebP } = await import('../utils/imageOptimization');
                    const originalFile = await convertToWebP(pngFile);

                    // Optimize image (resize to max 2k for display, preserve original)
                    const optimized = await optimizeImageForCanvas(originalFile, 2048, true);

                    // [PERF: async-parallel] Process canvas and generate tinySrc in parallel
                    const [processed, { tinySrc, tinyFile }] = await Promise.all([
                        imageLoader.processImage(optimized.displayFile, undefined, true),
                        generateTinySrc(optimized.displayFile, 128)
                    ]);

                    const newImage: BoardImage = {
                        id: item.id,
                        src: processed.src,                 // Display URL (max 2k)
                        file: optimized.displayFile,        // Display file (max 2k)
                        originalSrc: optimized.originalSrc, // Original URL (if resized)
                        originalFile: optimized.originalFile, // Original file
                        x: 0,
                        y: 0,
                        width: processed.width,
                        height: processed.height,
                        role: 'none',
                        zIndex: 0,
                        generationParams: item.generationParams,
                        thumbnailSrc: tinySrc,              // [VRAM FIX] Use tinySrc
                        tinySrc,                            // [VRAM FIX] 128px for zoom <= 100%
                        tinyFile,                           // [VRAM FIX] File for worker requests
                        isGenerated: true,                  // AI Generated
                        originalDimensions: optimized.originalDimensions,
                        scaleX: 1,
                    };
                    return newImage;
                } catch (err) {
                    console.error('Error processing generated image:', item.id, err);
                    return null;
                }
            }));

            const validImages = processedNewImages.filter((img): img is BoardImage => img !== null);
            if (validImages.length === 0) return;

            set(state => {
                let currentZCounter = state.zIndexCounter;
                const newImagesWithZ = validImages.map(img => ({ ...img, zIndex: ++currentZCounter }));
                const sourceImgInState = sourceImageId ? state.boardImages.find(img => img.id === sourceImageId) : undefined;

                if (!sourceImgInState) {
                    const newImagesWithPositions = newImagesWithZ.map((item, index) => {
                        const { pan, zoom } = state;
                        const centerX = (canvasRect.width / 2 - pan.x) / zoom;
                        const centerY = (canvasRect.height / 2 - pan.y) / zoom;
                        // Use item width/height if available, otherwise default standard size
                        const width = item.width || 512;
                        const height = item.height || 512;

                        const x = centerX - (width / 2) + ((index - (media.length - 1) / 2) * (width + 20));
                        const y = centerY - (height / 2);
                        return { ...item, x, y, width, height };
                    });

                    return {
                        boardImages: [...state.boardImages, ...newImagesWithPositions],
                        selectedImageIds: new Set(newImagesWithPositions.map(img => img.id)),
                        zIndexCounter: currentZCounter,
                        activeReferenceIndex: updateActiveReferenceIndex([...state.boardImages, ...newImagesWithPositions], new Set(newImagesWithPositions.map(img => img.id)))
                    };
                }
                const STANDARD_SIZE = 512;
                const BASE_SPACING = 30;

                // Dimension helper — respects aspect ratio within STANDARD_SIZE
                const computeDims = (img: BoardImage) => {
                    let newWidth = STANDARD_SIZE;
                    let newHeight = STANDARD_SIZE;
                    if (img.width && img.height) {
                        const aspect = img.width / img.height;
                        if (aspect >= 1) { newWidth = STANDARD_SIZE; newHeight = STANDARD_SIZE / aspect; }
                        else { newHeight = STANDARD_SIZE; newWidth = STANDARD_SIZE * aspect; }
                    } else if (img.originalDimensions) {
                        const aspect = img.originalDimensions.width / img.originalDimensions.height;
                        if (aspect >= 1) { newWidth = STANDARD_SIZE; newHeight = STANDARD_SIZE / aspect; }
                        else { newHeight = STANDARD_SIZE; newWidth = STANDARD_SIZE * aspect; }
                    }
                    return { newWidth, newHeight };
                };

                // Auto-group ON: place images below source with normalized sizes
                // (intelligentGrouping will apply packImagesWithRolePriority layout)
                if (useSettingsStore.getState().autoGroupGenerated) {
                    const baseX = sourceImgInState.x;
                    const baseY = sourceImgInState.y + sourceImgInState.height + BASE_SPACING;

                    const newImagesWithPositions = newImagesWithZ.map((img, i) => {
                        const { newWidth, newHeight } = computeDims(img);
                        return { ...img, x: baseX + i * (newWidth + 16), y: baseY, width: newWidth, height: newHeight };
                    });

                    return {
                        boardImages: [...state.boardImages, ...newImagesWithPositions],
                        selectedImageIds: new Set(newImagesWithPositions.map(i => i.id)),
                        zIndexCounter: currentZCounter,
                        activeReferenceIndex: updateActiveReferenceIndex([...state.boardImages, ...newImagesWithPositions], new Set(newImagesWithPositions.map(i => i.id)))
                    };
                }

                // Photo album style (auto-group OFF): place generated images below source with random overlap
                const OVERLAP_RANGE = 60;

                // Calculate starting position below the source image
                const startX = sourceImgInState.x;
                const startY = sourceImgInState.y + sourceImgInState.height + BASE_SPACING;

                // Place images in a scattered album layout
                const newImagesWithPositions = newImagesWithZ.map((img, index) => {
                    const { newWidth, newHeight } = computeDims(img);

                    // Grid-based positioning with random offset for photo album effect
                    const cols = Math.ceil(Math.sqrt(newImagesWithZ.length + 1));
                    const col = index % cols;
                    const row = Math.floor(index / cols);

                    const randomOffsetX = (Math.random() - 0.5) * OVERLAP_RANGE;
                    const randomOffsetY = (Math.random() - 0.5) * OVERLAP_RANGE;

                    const x = startX + col * (newWidth * 0.8) + randomOffsetX;
                    const y = startY + row * (newHeight * 0.8) + randomOffsetY;

                    return { ...img, x, y, width: newWidth, height: newHeight };
                });

                return {
                    boardImages: [...state.boardImages, ...newImagesWithPositions],
                    selectedImageIds: new Set(newImagesWithPositions.map(i => i.id)),
                    zIndexCounter: currentZCounter,
                    activeReferenceIndex: updateActiveReferenceIndex([...state.boardImages, ...newImagesWithPositions], new Set(newImagesWithPositions.map(i => i.id)))
                };
            });

            // Auto-group: when enabled, group source + generated images together
            if (useSettingsStore.getState().autoGroupGenerated) {
                const newIds = validImages.map(i => i.id);
                if (sourceImageId) {
                    const sourceImg = get().boardImages.find(img => img.id === sourceImageId);
                    const existingGroupId = sourceImg?.groupId;
                    const groupStillExists = existingGroupId
                        ? get().boardGroups.some(g => g.id === existingGroupId)
                        : false;

                    if (existingGroupId && groupStillExists) {
                        get().addImagesToExistingGroup(existingGroupId, newIds);
                    } else if (sourceImg) {
                        get().intelligentGrouping([{ name: 'Generated', imageIds: [sourceImageId, ...newIds] }]);
                    } else if (newIds.length >= 2) {
                        get().intelligentGrouping([{ name: 'Generated', imageIds: newIds }]);
                    }
                } else if (newIds.length >= 2) {
                    get().intelligentGrouping([{ name: 'Generated', imageIds: newIds }]);
                }
            }

            // [MEMORY OPTIMIZATION] Store generationParams in metadataStore for memory efficiency
            const paramsEntries: Array<[string, typeof validImages[0]['generationParams']]> = [];
            for (const img of validImages) {
                if (img.generationParams) {
                    paramsEntries.push([img.id, img.generationParams]);
                }
            }
            if (paramsEntries.length > 0) {
                useMetadataStore.getState().bulkSetParams(paramsEntries as Array<[string, NonNullable<typeof validImages[0]['generationParams']>]>);
            }

            // [MEMORY OPTIMIZATION] Trigger immediate blob cleanup after adding images
            blobManager.scheduleImmediateCleanup();

            // [KTX2] Trigger background encoding for GPU-optimized textures (Delayed & Sequential)
            // Matches Workspace Loading optimization strategy (2s delay)
            setTimeout(async () => {
                try {
                    const { encodeImageToKTX2 } = await import('../services/dataWorkerService');

                    // We need to re-fetch images from state to ensure we have the latest references
                    const currentImages = get().boardImages;

                    for (const img of validImages) {
                        // Check if image still exists in store
                        const currentImg = currentImages.find(i => i.id === img.id);
                        if (!currentImg) continue;

                        // Prioritize 1K+ images for KTX2 encoding
                        const isLargeEnough = (img.originalDimensions?.width || 0) > 1024 || (img.originalDimensions?.height || 0) > 1024;
                        if (!isLargeEnough) continue; // Skip small images

                        // [FIX] Ensure file object exists (reconstruct from path if needed)
                        const sourceFile = await ensureBoardImageFile(currentImg, 'original') || await ensureBoardImageFile(currentImg, 'display');

                        if (sourceFile) {
                            const result = await encodeImageToKTX2(currentImg.id, sourceFile);

                            if (result.ktx2Src) {
                                set(state => ({
                                    boardImages: state.boardImages.map(i =>
                                        i.id === currentImg.id ? { ...i, ktx2Src: result.ktx2Src! } : i
                                    )
                                }));
                                console.log(`[KTX2] ✅ Encoded image ${currentImg.id}`);
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[KTX2] ⚠️ Encoding failed (non-critical):', error);
                }
            }, 2000);
        } catch (error) {
            console.error('[canvasStore] Error adding generated images:', error);
        }
    },

    uploadImages: async (files, dropPosition, containerRect) => {
        const { pan, zoom } = get();
        let zIndexCounter = get().zIndexCounter;
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        // 파일 크기 제한: MAX_UPLOAD_FILE_BYTES(100MB) 초과 파일 거부
        const { MAX_UPLOAD_FILE_BYTES: MAX_BYTES } = await import('../utils/imageOptimization');
        const oversized = imageFiles.filter(f => f.size > MAX_BYTES);
        if (oversized.length > 0) {
            console.warn(`[Canvas] ${oversized.length}개 파일이 최대 크기(${Math.round(MAX_BYTES / 1024 / 1024)}MB) 초과로 제외됨:`, oversized.map(f => f.name));
        }
        const uploadableFiles = imageFiles.filter(f => f.size <= MAX_BYTES);
        if (uploadableFiles.length === 0) return;

        const canvasX = (dropPosition.x - containerRect.left - pan.x) / zoom;
        const canvasY = (dropPosition.y - containerRect.top - pan.y) / zoom;

        // Bulk upload loading overlay (20+ images)
        const BULK_THRESHOLD = 20;
        const isBulkUpload = uploadableFiles.length >= BULK_THRESHOLD;
        const uiStoreModule = isBulkUpload ? await import('./uiStore') : null;

        if (isBulkUpload && uiStoreModule) {
            uiStoreModule.useUIStore.getState().setLoadingState({
                isLoading: true,
                message: '이미지 초기화 중...',
                progress: 0,
                isReversed: false,
                variant: 'glass',
            });
            uiStoreModule.useUIStore.getState().setIsOverlayVisible(true);
        }

        try {
            // Import optimization utilities
            const { optimizeImageForCanvas } = await import('../utils/imageOptimization');
            const { generateTinySrc } = await import('../utils/imageUtils'); // generateTinySrc now returns dimensions

            // --- Phase 1: Fast Tiny Generation & Immediate Render ---
            // Process all images to get Tiny placeholders ASAP
            const tinyGenerationPromises = uploadableFiles.map(async (file, index) => {
                try {
                    // Fast: Generate 128px thumbnail + Get Dimensions
                    const { tinySrc, tinyFile, width, height } = await generateTinySrc(file, 128);

                    // Standard display size logic
                    const STANDARD_SIZE = 512;
                    let newWidth = STANDARD_SIZE;
                    let newHeight = STANDARD_SIZE;
                    const aspect = width / height;

                    if (aspect >= 1) {
                        newWidth = STANDARD_SIZE;
                        newHeight = STANDARD_SIZE / aspect;
                    } else {
                        newHeight = STANDARD_SIZE;
                        newWidth = STANDARD_SIZE * aspect;
                    }

                    const x = canvasX - (newWidth / 2) + (index * 20);
                    const y = canvasY - (newHeight / 2) + (index * 20);

                    return {
                        id: crypto.randomUUID(),
                        src: tinySrc,                          // Initially use Tiny as Src (Instant Render)
                        file: file,                            // Raw file initially (Will be replaced by optimized.displayFile)
                        originalSrc: tinySrc,                  // Placeholder
                        originalFile: file,                    // Raw file
                        x,
                        y,
                        width: newWidth,
                        height: newHeight,
                        role: 'none' as const,
                        zIndex: 0, // Will assign proper Z later
                        thumbnailSrc: tinySrc,
                        tinySrc,
                        tinyFile,
                        isGenerated: false,
                        originalDimensions: { width, height }, // We have dimensions now!
                        scaleX: 1,
                        // Mark as unoptimized so we know to process it
                        _pendingOptimization: true
                    } as BoardImage & { _pendingOptimization?: boolean };
                } catch (e) {
                    console.error("Failed to generate tiny for upload:", e);
                    return null;
                }
            });

            const initialImages = (await Promise.all(tinyGenerationPromises)).filter((img): img is (BoardImage & { _pendingOptimization?: boolean }) => img !== null);

            if (initialImages.length === 0) return;

            // Commit Phase 1: Render immediately
            set(state => {
                let currentZ = state.zIndexCounter;
                const imagesWithZ = initialImages.map(img => ({ ...img, zIndex: ++currentZ }));
                return {
                    boardImages: [...state.boardImages, ...imagesWithZ],
                    zIndexCounter: currentZ
                };
            });

            // Update loading UI if bulk
            if (isBulkUpload && uiStoreModule) {
                uiStoreModule.useUIStore.getState().setLoadingState({
                    message: '고해상도 최적화 중...',
                    progress: 10
                });
            }

            // --- Phase 2: Background Optimization (Progressive Upgrade) ---
            // Run heavy optimization in background without blocking UI
            // Use pLimit to control concurrency
            (async () => {
                let processedCount = 0;
                const totalCount = initialImages.length;

                await pLimit(initialImages, async (imgItem) => {
                    try {
                        // Optimize raw file: 4K max (MAX_CANVAS_RESOLUTION). 초과 시 원본 제거.
                        const { MAX_CANVAS_RESOLUTION } = await import('../utils/imageOptimization');
                        const optimized = await optimizeImageForCanvas(imgItem.originalFile!, MAX_CANVAS_RESOLUTION, false);

                        // Process for display (create blob url for high res)
                        const processed = await imageLoader.processImage(optimized.displayFile, undefined, true);

                        // 4K 초과 이미지는 원본 제거 — displayFile(4K WebP)을 원본으로 사용
                        const finalOriginalFile = optimized.displayFile;

                        // Update Store: Upgrade this specific image to High Res
                        set(state => ({
                            boardImages: state.boardImages.map(current =>
                                current.id === imgItem.id ? {
                                    ...current,
                                    src: processed.src,                 // Upgrade: High Res URL
                                    file: optimized.displayFile,        // Upgrade: 4K-limited WebP
                                    originalSrc: undefined,             // 원본 별도 URL 없음 (4K = 원본)
                                    originalFile: finalOriginalFile,    // 4K max WebP가 최고해상도
                                    highResSrc: optimized.highResSrc,
                                    highResDimensions: optimized.highResDimensions,
                                    // Remove pending flag implicitly by not including it
                                } : current
                            )
                        }));

                        processedCount++;
                        if (isBulkUpload && uiStoreModule && processedCount % 5 === 0) {
                            uiStoreModule.useUIStore.getState().setLoadingState({
                                progress: 10 + Math.round((processedCount / totalCount) * 90)
                            });
                        }

                    } catch (e) {
                        console.error("Failed to optimize uploaded image:", imgItem.id, e);
                    }
                }, 4); // Concurrency 4

                // Cleanup loading UI
                if (isBulkUpload && uiStoreModule) {
                    uiStoreModule.useUIStore.getState().setLoadingState({ isLoading: false });
                    uiStoreModule.useUIStore.getState().setIsOverlayVisible(false);
                }

                // Trigger cleanup
                blobManager.scheduleImmediateCleanup();
            })();


            // --- Phase 3: Delayed KTX2 Encoding ---
            // Wait 2s to allow UI to settle, then start KTX2 encoding
            setTimeout(async () => {
                try {
                    const { encodeImageToKTX2 } = await import('../services/dataWorkerService');

                    // Iterate over the IDs we just added
                    for (const imgItem of initialImages) {
                        // Re-fetch latest state (it might have been deleted or optimized)
                        const currentImg = get().boardImages.find(i => i.id === imgItem.id);
                        if (!currentImg) continue;

                        const { width, height } = currentImg.originalDimensions || { width: 0, height: 0 };
                        if (width <= 1024 && height <= 1024) continue;

                        // Ensure we have a file source (Optimization should be done by now usually, but if not, ensureBoardImageFile handles it)
                        const sourceFile = await ensureBoardImageFile(currentImg, 'original') || await ensureBoardImageFile(currentImg, 'display');

                        if (sourceFile) {
                            const result = await encodeImageToKTX2(currentImg.id, sourceFile);
                            if (result.ktx2Src) {
                                set(state => ({
                                    boardImages: state.boardImages.map(i =>
                                        i.id === currentImg.id ? { ...i, ktx2Src: result.ktx2Src! } : i
                                    )
                                }));
                                console.log(`[KTX2] ✅ Encoded ${currentImg.id}`);
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[KTX2] ⚠️ Encoding failed:', error);
                }
            }, 2000);

        } catch (error) {
            console.error('[canvasStore] Error uploading images:', error);
            if (isBulkUpload && uiStoreModule) {
                uiStoreModule.useUIStore.getState().setLoadingState({ isLoading: false });
                uiStoreModule.useUIStore.getState().setIsOverlayVisible(false);
            }
        }
    },

    addHistoryImage: async (mediaItem, position, canvasRect) => {
        try {
            // Import optimization utilities
            const { optimizeImageForCanvas } = await import('../utils/imageOptimization');

            // Convert URL to File
            const response = await fetch(mediaItem.src);
            const blob = await response.blob();
            const originalFile = new File([blob], `history-${mediaItem.id}.png`, { type: 'image/png' });

            // Optimize image (resize to 2048px for quality, display at 512px)
            const optimized = await optimizeImageForCanvas(originalFile, 2048, true);

            const { pan, zoom } = get();
            let zIndexCounter = get().zIndexCounter + 1;

            // [PERF: async-parallel] Process canvas and generate tinySrc in parallel
            const [processed, { tinySrc, tinyFile }] = await Promise.all([
                imageLoader.processImage(optimized.displayFile, undefined, true),
                generateTinySrc(optimized.displayFile, 128)
            ]);

            const STANDARD_SIZE = 512;
            const aspect = processed.width / processed.height;
            let newWidth: number;
            let newHeight: number;
            if (aspect >= 1) {
                newWidth = STANDARD_SIZE;
                newHeight = STANDARD_SIZE / aspect;
            } else {
                newHeight = STANDARD_SIZE;
                newWidth = STANDARD_SIZE * aspect;
            }

            const x = (position.x - pan.x - canvasRect.left) / zoom - (newWidth / 2);
            const y = (position.y - pan.y - canvasRect.top) / zoom - (newHeight / 2);

            const newImage: BoardImage = {
                id: crypto.randomUUID(),
                src: processed.src,                 // Display URL (1k)
                file: optimized.displayFile,        // Display file (1k)
                originalSrc: optimized.originalSrc, // Original URL (2k/4k)
                originalFile: optimized.originalFile, // Original file (2k/4k)
                x,
                y,
                width: newWidth,
                height: newHeight,
                role: 'none',
                zIndex: zIndexCounter,
                generationParams: mediaItem.generationParams,
                thumbnailSrc: tinySrc,              // [VRAM FIX] Use tinySrc
                tinySrc,                            // [VRAM FIX] 128px for zoom <= 100%
                tinyFile,                           // [VRAM FIX] File for worker requests
                isGenerated: true,                  // AI Generated
                originalDimensions: optimized.originalDimensions,
                scaleX: 1,
                highResSrc: optimized.highResSrc,
                highResDimensions: optimized.highResDimensions,
            };

            set(state => ({ boardImages: [...state.boardImages, newImage], zIndexCounter }));

            // [FIX B-5] KTX2 background encoding (was missing in addHistoryImage)
            (async () => {
                try {
                    const { width, height } = newImage.originalDimensions || { width: 0, height: 0 };
                    if (width > 1024 || height > 1024) {
                        const { encodeImageToKTX2 } = await import('../services/dataWorkerService');
                        const sourceFile = await ensureBoardImageFile(newImage, 'original') || await ensureBoardImageFile(newImage, 'display');
                        if (sourceFile) {
                            const result = await encodeImageToKTX2(newImage.id, sourceFile);
                            if (result.ktx2Src) {
                                set(state => ({
                                    boardImages: state.boardImages.map(i =>
                                        i.id === newImage.id ? { ...i, ktx2Src: result.ktx2Src! } : i
                                    )
                                }));
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[KTX2] Encoding failed (non-critical):', error);
                }
            })();
        } catch (error) {
            console.error('[canvasStore] Error adding history image:', error);
        }
    },


    deleteSelection: () => {
        set(state => {
            const { boardImages, selectedImageIds, boardGroups, selectedGroupIds, groupEditModeId } = state;

            if (groupEditModeId && selectedImageIds.size > 0) {
                const group = boardGroups.find(g => g.id === groupEditModeId);
                if (group) {
                    const newBoardImages = boardImages.filter(img => !selectedImageIds.has(img.id));
                    const remainingImageIds = group.imageIds.filter(id => !selectedImageIds.has(id));

                    if (remainingImageIds.length < 2) {
                        const newBoardGroups = boardGroups.filter(g => g.id !== groupEditModeId);
                        const finalImages = newBoardImages.map(img => remainingImageIds.includes(img.id) ? { ...img, groupId: undefined } : img);
                        return { ...state, boardImages: finalImages, boardGroups: newBoardGroups, selectedImageIds: new Set(remainingImageIds), selectedGroupIds: new Set(), groupEditModeId: null };
                    } else {
                        const newBoardGroups = boardGroups.map(g => g.id === groupEditModeId ? { ...g, imageIds: remainingImageIds } : g);
                        const resizedState = resizeGroup(groupEditModeId, newBoardImages, newBoardGroups);
                        return { ...state, boardImages: newBoardImages, boardGroups: resizedState.boardGroups, selectedImageIds: new Set() };
                    }
                }
            }

            const imageIdsInSelectedGroups = new Set<string>(boardGroups.filter(g => selectedGroupIds.has(g.id)).flatMap(g => g.imageIds));
            const allImageIdsToDelete = new Set<string>(selectedImageIds);
            imageIdsInSelectedGroups.forEach(id => allImageIdsToDelete.add(id));

            const newBoardImages = boardImages.filter(img => !allImageIdsToDelete.has(img.id));
            const newBoardGroups = boardGroups.filter(g => !selectedGroupIds.has(g.id));

            // [MEMORY OPTIMIZATION] Delete metadata for removed images
            if (allImageIdsToDelete.size > 0) {
                useMetadataStore.getState().bulkDeleteParams(Array.from(allImageIdsToDelete));
            }

            return { ...state, boardImages: newBoardImages, boardGroups: newBoardGroups, selectedImageIds: new Set<string>(), selectedGroupIds: new Set<string>(), activeReferenceIndex: null, groupEditModeId: null };
        });
        get().saveHistory('delete');
    },

    downloadSelection: async (saveDirectoryHandle, format = 'png') => {
        const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        const convertToFormat = (source: Blob): Promise<Blob> => new Promise((resolve, reject) => {
            if (source.type === mimeType) { resolve(source); return; }
            const url = URL.createObjectURL(source);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { URL.revokeObjectURL(url); reject(new Error('No 2d context')); return; }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(result => {
                    URL.revokeObjectURL(url);
                    result ? resolve(result) : reject(new Error('toBlob failed'));
                }, mimeType, format === 'webp' ? 0.92 : undefined);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
            img.src = url;
        });

        const { boardImages, selectedImageIds, boardGroups, selectedGroupIds } = get();
        const imageIdsInSelectedGroups = new Set<string>(boardGroups.filter(g => selectedGroupIds.has(g.id)).flatMap(g => g.imageIds));
        const allImageIdsToDownload = new Set<string>(selectedImageIds);
        imageIdsInSelectedGroups.forEach(id => allImageIdsToDownload.add(id));
        for (const imageId of Array.from(allImageIdsToDownload)) {
            const image = boardImages.find(img => img.id === imageId);
            if (image) {
                try {
                    // Priority: originalFile > highResSrc > file (display) > src fallback
                    let blob: Blob;
                    let baseName: string;

                    if (image.originalFile) {
                        // 1. RAM의 원본 파일
                        blob = image.originalFile;
                        baseName = image.originalFile.name.replace(/\.[^.]+$/, '') || `bananyang-${image.id}`;
                    } else if (image.originalFilePath && (window as any).electronAPI?.readBinaryFile) {
                        // 2. 디스크에 오프로드된 원본 파일
                        const base64 = await (window as any).electronAPI.readBinaryFile(image.originalFilePath);
                        const byteChars = atob(base64);
                        const byteArr = new Uint8Array(byteChars.length);
                        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                        blob = new Blob([byteArr], { type: 'image/png' });
                        baseName = image.originalFilePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || `bananyang-${image.id}`;
                    } else if (image.highResSrc) {
                        // 3. 고해상도 URL
                        const response = await fetch(image.highResSrc);
                        blob = await response.blob();
                        baseName = `bananyang-highres-${image.id}`;
                    } else if (image.file) {
                        // 4. 디스플레이 파일 (max 2K)
                        blob = image.file;
                        baseName = image.file.name.replace(/\.[^.]+$/, '') || `bananyang-${image.id}`;
                    } else {
                        // 5. URL fallback
                        const response = await fetch(image.src);
                        blob = await response.blob();
                        baseName = `bananyang-${image.id}`;
                    }

                    // 포맷 변환
                    blob = await convertToFormat(blob);
                    const fileName = `${baseName}.${format}`;

                    const autoDownloadPath = useSettingsStore.getState().autoDownloadPath;
                    if (autoDownloadPath && (window as any).electronAPI?.saveFileToDirectory) {
                        // Electron: 지정 경로에 직접 저장
                        const base64Data = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve((reader.result as string).split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        await (window as any).electronAPI.saveFileToDirectory(autoDownloadPath, fileName, base64Data);
                    } else if (saveDirectoryHandle) {
                        // Web: FileSystemDirectoryHandle API 사용
                        const fileHandle = await saveDirectoryHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                    } else {
                        // 폴백: 브라우저 직접 다운로드
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.href = url;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (err) { console.error("Failed to download image", imageId, err); }

            }
        }
    },

    downloadImagesByIds: async (imageIds: string[], format: 'png' | 'webp' = 'png') => {
        const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        const convertToFormat = (source: Blob): Promise<Blob> => new Promise((resolve, reject) => {
            if (source.type === mimeType) { resolve(source); return; }
            const url = URL.createObjectURL(source);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { URL.revokeObjectURL(url); reject(new Error('No 2d context')); return; }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(result => {
                    URL.revokeObjectURL(url);
                    result ? resolve(result) : reject(new Error('toBlob failed'));
                }, mimeType, format === 'webp' ? 0.92 : undefined);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
            img.src = url;
        });

        const { boardImages } = get();
        if (imageIds.length === 0) return 0;

        // 폴더 선택은 루프 전에 1회만 수행
        const autoDownloadPath = useSettingsStore.getState().autoDownloadPath;
        let saveDirectoryPath: string | null = autoDownloadPath || null;
        let saveDirectoryHandle: FileSystemDirectoryHandle | null = null;

        if (!saveDirectoryPath) {
            if ((window as any).electronAPI?.selectDirectory) {
                saveDirectoryPath = await (window as any).electronAPI.selectDirectory();
                if (!saveDirectoryPath) return 0; // 사용자가 취소
            } else if ((window as any).showDirectoryPicker) {
                try {
                    saveDirectoryHandle = await (window as any).showDirectoryPicker();
                } catch {
                    return 0; // 사용자가 취소
                }
            }
        }

        let downloadedCount = 0;
        for (const imageId of imageIds) {
            const image = boardImages.find(img => img.id === imageId);
            if (image) {
                try {
                    let blob: Blob;
                    let baseName: string;

                    if (image.originalFile) {
                        blob = image.originalFile;
                        baseName = image.originalFile.name.replace(/\.[^.]+$/, '') || `bananyang-${image.id}`;
                    } else if (image.originalFilePath && (window as any).electronAPI?.readBinaryFile) {
                        const base64 = await (window as any).electronAPI.readBinaryFile(image.originalFilePath);
                        const byteChars = atob(base64);
                        const byteArr = new Uint8Array(byteChars.length);
                        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                        blob = new Blob([byteArr], { type: 'image/png' });
                        baseName = image.originalFilePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || `bananyang-${image.id}`;
                    } else if (image.highResSrc) {
                        const response = await fetch(image.highResSrc);
                        blob = await response.blob();
                        baseName = `bananyang-highres-${image.id}`;
                    } else if (image.file) {
                        blob = image.file;
                        baseName = image.file.name.replace(/\.[^.]+$/, '') || `bananyang-${image.id}`;
                    } else {
                        const response = await fetch(image.src);
                        blob = await response.blob();
                        baseName = `bananyang-${image.id}`;
                    }

                    blob = await convertToFormat(blob);
                    const fileName = `${baseName}.${format}`;

                    if (saveDirectoryPath && (window as any).electronAPI?.saveFileToDirectory) {
                        const base64Data = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve((reader.result as string).split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        await (window as any).electronAPI.saveFileToDirectory(saveDirectoryPath, fileName, base64Data);
                    } else if (saveDirectoryHandle) {
                        const fileHandle = await saveDirectoryHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                    } else {
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.href = url;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    }
                    downloadedCount++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (err) { console.error("Failed to download image", imageId, err); }
            }
        }
        return downloadedCount;
    },

    downloadGroup: async (groupId: string, format: 'png' | 'webp' = 'png') => {
        const { boardGroups } = get();
        const group = boardGroups.find(g => g.id === groupId);
        if (!group || group.imageIds.length === 0) return 0;
        return get().downloadImagesByIds(group.imageIds, format);
    },

    setRoleForSelection: (role) => set(state => {
        let updatedImages = [...state.boardImages];
        const { selectedImageIds } = state;

        // Toggle behavior: if all selected images already have this role, set to 'none'
        const allSelectedHaveRole = Array.from(selectedImageIds).every(id => state.boardImages.find(i => i.id === id)?.role === role);
        const newRoleForSelection = allSelectedHaveRole ? 'none' : role;

        // Open concept panel when setting costume reference role
        if (newRoleForSelection === 'costumeRef') {
            useGenerationStore.getState().setActiveRightPanelTab('concept');
        }

        // Enforce selection limits based on role type
        if (newRoleForSelection !== 'none') {
            if (role === 'generalRef') {
                // Allow up to 14 general references
                const existingGeneralRefs = updatedImages.filter(img => img.role === 'generalRef' && !selectedImageIds.has(img.id));
                if (existingGeneralRefs.length >= 14) {
                    // Remove oldest general ref to make room
                    const oldestRef = existingGeneralRefs[0];
                    updatedImages = updatedImages.map(img => img.id === oldestRef.id ? { ...img, role: 'none' as const, refIndex: undefined } : img);
                }
            } else if (role === 'costumeRef' || role === 'poseRef' || role === 'original' || role === 'background' || role === 'pose') {
                // Single selection: clear other images with the same role
                updatedImages = updatedImages.map(img => (img.role === role && !selectedImageIds.has(img.id)) ? { ...img, role: 'none' as const, refIndex: undefined } : img);
            }
            // Legacy 'reference' role: keep for backward compatibility
            else if (role === 'reference') {
                updatedImages = updatedImages.map(img => (img.role === 'reference' && !selectedImageIds.has(img.id)) ? { ...img, role: 'none' as const, refIndex: undefined, referenceType: undefined } : img);
            }
        }

        // Set the new role for selected images; clear mask unless staying as generalRef
        updatedImages = updatedImages.map(img => {
            if (!selectedImageIds.has(img.id)) return img;
            if (newRoleForSelection === 'generalRef') return { ...img, role: newRoleForSelection, referenceType: undefined };
            return { ...img, role: newRoleForSelection, referenceType: undefined, maskFile: undefined, maskSrc: undefined };
        });

        // Re-index only generalRef and deprecated reference types
        let refCounter = 0;
        const finalImages = updatedImages.map(img => {
            // Assign refIndex to all reference types (general, costume, pose)
            if (img.role === 'generalRef' || img.role === 'costumeRef' || img.role === 'poseRef' || img.role === 'reference') {
                return { ...img, refIndex: refCounter++ };
            }
            // Remove refIndex from other roles
            if (img.refIndex !== undefined) return { ...img, refIndex: undefined };
            return img;
        });

        // 역할이 지정된 이미지는 해당 역할 그룹의 최상단 z-index로 이동
        let zReindexed = [...finalImages];
        if (newRoleForSelection !== 'none') {
            for (const id of Array.from(selectedImageIds)) {
                const newZ = computeRoleZIndex(newRoleForSelection, zReindexed.filter(i => i.id !== id));
                zReindexed = zReindexed.map(img => img.id === id ? { ...img, zIndex: newZ } : img);
            }
        }

        return {
            boardImages: zReindexed,
            activeReferenceIndex: updateActiveReferenceIndex(zReindexed, state.selectedImageIds)
        };
    }),

    /** @deprecated Use setRoleForSelection with new role types instead */
    setReferenceType: (type) => set(state => {
        useGenerationStore.getState().setActiveRightPanelTab('concept');

        let updatedImages = [...state.boardImages];
        const { selectedImageIds } = state;

        // Clear other references with the same type (enforce single selection per type, EXCEPT for general)
        updatedImages = updatedImages.map(img => {
            if (!selectedImageIds.has(img.id) && img.role === 'reference' && img.referenceType === type) {
                // Allow multiple general references
                if (type === 'general') return img;
                return { ...img, role: 'none' as const, refIndex: undefined, referenceType: undefined };
            }
            return img;
        });

        // Check if selected image already has this reference type - if so, deactivate it
        const selectedId = Array.from(selectedImageIds)[0];
        const selectedImg = selectedId ? updatedImages.find(img => img.id === selectedId) : null;

        if (selectedImg && selectedImg.role === 'reference' && selectedImg.referenceType === type) {
            // Deactivate: set to none
            updatedImages = updatedImages.map(img =>
                selectedImageIds.has(img.id) ? { ...img, role: 'none' as const, referenceType: undefined } : img
            );
        } else {
            // Activate: set to reference with this type
            updatedImages = updatedImages.map(img =>
                selectedImageIds.has(img.id) ? { ...img, role: 'reference', referenceType: type } : img
            );
        }

        // Re-index reference images (only general references get numbers)
        let refCounter = 0;
        const finalImages = updatedImages.map(img => {
            // Only assign refIndex to general references
            if (img.role === 'reference' && (img.referenceType === 'general' || !img.referenceType)) {
                return { ...img, refIndex: refCounter++ };
            }
            // Remove refIndex from non-general references
            if (img.refIndex !== undefined) return { ...img, refIndex: undefined };
            return img;
        });

        return { boardImages: finalImages };
    }),

    setRole: (imageIds, role) => get().setBoardImages(prev => {
        if (role === 'reference') {
            useGenerationStore.getState().setActiveRightPanelTab('concept');
        }

        let updatedImages = [...prev];
        const idsToSet = new Set(imageIds);

        if (role === 'original' || role === 'background' || role === 'pose') {
            updatedImages = updatedImages.map(img => (img.role === role && !idsToSet.has(img.id)) ? { ...img, role: 'none' as const, refIndex: undefined, maskFile: undefined, maskSrc: undefined } : img);
        }

        updatedImages = updatedImages.map(img => {
            if (!idsToSet.has(img.id)) return img;
            // original and generalRef preserve existing mask; all other roles clear it
            if (role === 'original' || role === 'generalRef') return { ...img, role };
            return { ...img, role, maskFile: undefined, maskSrc: undefined };
        });

        let refCounter = 0;
        let refIndexed = updatedImages.map(img => {
            // Assign refIndex to all reference types
            if (img.role === 'generalRef' || img.role === 'costumeRef' || img.role === 'poseRef' || img.role === 'reference') {
                return { ...img, refIndex: refCounter++ };
            }
            // Remove refIndex from non-reference roles
            if (img.refIndex !== undefined) {
                const { refIndex, ...rest } = img;
                return rest as BoardImage;
            }
            return img;
        });

        // 역할이 지정된 이미지는 해당 역할 그룹의 최상단 z-index로 이동
        if (role !== 'none') {
            for (const id of Array.from(idsToSet)) {
                const newZ = computeRoleZIndex(role, refIndexed.filter(i => i.id !== id));
                refIndexed = refIndexed.map(img => img.id === id ? { ...img, zIndex: newZ } : img);
            }
        }

        return refIndexed;
    }),

    clearRoleForSelection: () => set(state => {
        const { selectedImageIds } = state;
        const imagesWithClearedRoles = state.boardImages.map(img => selectedImageIds.has(img.id) ? { ...img, role: 'none' as const, refIndex: undefined } : img);
        let refCounter = 0;
        const finalImages = imagesWithClearedRoles.map(img => { if (img.role === 'reference' || img.role === 'generalRef' || img.role === 'costumeRef' || img.role === 'poseRef') return { ...img, refIndex: refCounter++ }; return img; });
        return { boardImages: finalImages };
    }),

    clearActiveReferenceRole: () => set(state => {
        const { activeReferenceIndex } = state;
        if (activeReferenceIndex === null) return state;
        const imagesWithClearedRole = state.boardImages.map(img => (img.role === 'reference' && img.refIndex === activeReferenceIndex) ? { ...img, role: 'none' as const, refIndex: undefined } : img);
        let refCounter = 0;
        const finalImages = imagesWithClearedRole.map(img => { if (img.role === 'reference' || img.role === 'generalRef' || img.role === 'costumeRef' || img.role === 'poseRef') return { ...img, refIndex: refCounter++ }; return img; });
        return { boardImages: finalImages, activeReferenceIndex: null };
    }),

    alignRoleImagesToOriginal: () => {
        set(state => {
            const { boardImages, boardGroups } = state;
            const original = boardImages.find(img => img.role === 'original');
            if (!original) return state;

            const ROLE_ORDER: Record<BoardImage['role'], number> = {
                'original': 1, 'generalRef': 2, 'costumeRef': 3, 'poseRef': 4,
                'background': 5, 'reference': 2, 'pose': 4, 'none': 99,
            };
            const roleImages = boardImages
                .filter(img => img.role !== 'none' && img.role !== 'original')
                .sort((a, b) => {
                    const oa = ROLE_ORDER[a.role]; const ob = ROLE_ORDER[b.role];
                    if (oa !== ob) return oa - ob;
                    if ((a.role === 'generalRef' && b.role === 'generalRef') ||
                        (a.role === 'reference' && b.role === 'reference')) {
                        return (a.refIndex ?? 0) - (b.refIndex ?? 0);
                    }
                    return 0;
                });
            if (roleImages.length === 0) return state;

            const PADDING = 20;
            const targetGroupId = original.groupId;
            const alignedIds = new Set(roleImages.map(i => i.id));
            const oldGroupIds = new Set<string>();
            for (const img of roleImages) {
                if (img.groupId && img.groupId !== targetGroupId) oldGroupIds.add(img.groupId);
            }

            let cursorX = original.x + original.width + PADDING;
            const positions = new Map<string, number>();
            for (const img of roleImages) {
                positions.set(img.id, cursorX);
                cursorX += img.width + PADDING;
            }

            let nextImages = boardImages.map(img => {
                if (!alignedIds.has(img.id)) return img;
                return { ...img, x: positions.get(img.id)!, y: original.y, groupId: targetGroupId };
            });

            let nextGroups = boardGroups.map(g => {
                if (oldGroupIds.has(g.id)) return { ...g, imageIds: g.imageIds.filter(id => !alignedIds.has(id)) };
                if (targetGroupId && g.id === targetGroupId) {
                    const existing = new Set(g.imageIds);
                    const additions = roleImages.filter(i => !existing.has(i.id)).map(i => i.id);
                    return additions.length > 0 ? { ...g, imageIds: [...g.imageIds, ...additions] } : g;
                }
                return g;
            });

            const dissolved: string[] = [];
            nextGroups = nextGroups.filter(g => {
                if (g.imageIds.length < 2) { dissolved.push(g.id); return false; }
                return true;
            });
            if (dissolved.length > 0) {
                const dset = new Set(dissolved);
                nextImages = nextImages.map(img =>
                    img.groupId && dset.has(img.groupId) ? { ...img, groupId: undefined } : img
                );
            }

            const groupsToResize = [
                ...(targetGroupId ? [targetGroupId] : []),
                ...Array.from(oldGroupIds).filter(id => !dissolved.includes(id)),
            ];
            let acc = { boardImages: nextImages, boardGroups: nextGroups };
            for (const gid of groupsToResize) {
                const r = resizeGroup(gid, acc.boardImages, acc.boardGroups);
                acc = { boardImages: acc.boardImages, boardGroups: r.boardGroups };
            }

            return { boardImages: acc.boardImages, boardGroups: acc.boardGroups };
        });
        get().saveHistory();
    },

    alignSelection: () => {
        set(state => {
            const { boardImages, selectedImageIds, boardGroups, selectedGroupIds, groupEditModeId } = state;

            const PADDING = 20;

            if (groupEditModeId) {
                // Aligning images within a group during edit mode
                const imagesToAlign = boardImages.filter(img => selectedImageIds.has(img.id) && (img.groupId === groupEditModeId || !img.groupId));
                if (imagesToAlign.length <= 1) return state;

                const { packImagesWithRolePriority } = require('../utils/binPacking');
                const group = boardGroups.find(g => g.id === groupEditModeId);
                const startX = group ? group.x + PADDING : 0;
                const startY = group ? group.y + PADDING : 0;
                const STANDARD_SIZE = 512;

                // Use role priority packing with unified normalization size
                const positionUpdates = packImagesWithRolePriority(
                    imagesToAlign, startX, startY, PADDING, false, STANDARD_SIZE
                );

                // Apply updates
                const finalImages = boardImages.map(img => {
                    const update = positionUpdates.get(img.id);
                    return update ? { ...img, ...update } : img;
                });

                return { boardImages: finalImages };
            }

            // Normal mode: Align standalone images AND/OR groups
            const standaloneImagesToAlign = boardImages.filter(img => selectedImageIds.has(img.id) && !img.groupId);
            const groupsToAlign = boardGroups.filter(g => selectedGroupIds.has(g.id));

            // Need at least 2 items to align
            if (standaloneImagesToAlign.length + groupsToAlign.length <= 1) return state;

            const { packImagesWithRolePriority, packImages } = require('../utils/binPacking');

            // Calculate bounding box of selection to determine start position
            const allItems = [...standaloneImagesToAlign, ...groupsToAlign];
            const minX = Math.min(...allItems.map(i => i.x));
            const minY = Math.min(...allItems.map(i => i.y));
            const STANDARD_SIZE = 512;

            // Case 1: Only standalone images - use role priority with normalization
            if (groupsToAlign.length === 0 && standaloneImagesToAlign.length > 0) {
                const positionUpdates = packImagesWithRolePriority(
                    standaloneImagesToAlign, minX, minY, PADDING, false, STANDARD_SIZE
                );

                const finalImages = boardImages.map(img => {
                    const update = positionUpdates.get(img.id);
                    return update ? { ...img, ...update } : img;
                });

                return { boardImages: finalImages };
            }

            // Case 2: Mixed (images + groups) or only groups - use packImages for groups
            // Groups don't get normalized, but their positions are updated
            const positionUpdates = packImages(allItems, minX, minY, PADDING);

            // Pre-calculate deltas for all groups that will move
            const groupDeltas = new Map<string, { dx: number; dy: number }>();
            for (const group of boardGroups) {
                const update = positionUpdates.get(group.id);
                if (update) {
                    groupDeltas.set(group.id, {
                        dx: update.x - group.x,
                        dy: update.y - group.y
                    });
                }
            }

            // Update group positions
            const finalGroups = boardGroups.map(group => {
                const update = positionUpdates.get(group.id);
                return update ? { ...group, x: update.x, y: update.y } : group;
            });

            // Update image positions
            const finalImages = boardImages.map(img => {
                // Standalone image that was directly aligned
                const directUpdate = positionUpdates.get(img.id);
                if (directUpdate) {
                    return { ...img, x: directUpdate.x, y: directUpdate.y };
                }

                // Image inside a group that moved
                if (img.groupId) {
                    const delta = groupDeltas.get(img.groupId);
                    if (delta) {
                        return { ...img, x: img.x + delta.dx, y: img.y + delta.dy };
                    }
                }

                return img;
            });

            return { boardImages: finalImages, boardGroups: finalGroups };
        });
        get().saveHistory();
    },

    flipSelectionHorizontal: () => {
        set(state => {
            const { boardImages, selectedImageIds } = state;
            if (selectedImageIds.size === 0) return state;

            const newBoardImages = boardImages.map(img => {
                if (selectedImageIds.has(img.id)) {
                    return { ...img, scaleX: (img.scaleX || 1) * -1 };
                }
                return img;
            });

            return { boardImages: newBoardImages };
        });
        get().saveHistory();
    },

    backgroundEncodeKTX2: async () => {
        const { boardImages } = get();
        // Filter for images that need encoding (> 1K, no existing KTX2)
        const candidates = boardImages.filter(img => {
            if (img.ktx2Src) return false;
            const { width, height } = img.originalDimensions || { width: 0, height: 0 };
            return width > 1024 || height > 1024;
        });

        if (candidates.length > 0) {
            // Process sequentially to be gentle on background resources
            for (const img of candidates) {
                try {
                    // Re-fetch current state to verify it still exists
                    const currentImg = get().boardImages.find(i => i.id === img.id);
                    if (!currentImg || currentImg.ktx2Src) continue;

                    // Ensure we have a file to encode
                    const file = await ensureBoardImageFile(currentImg, 'original') || await ensureBoardImageFile(currentImg, 'display');
                    if (file) {
                        const result = await encodeImageToKTX2(currentImg.id, file);
                        if (result.ktx2Src) {
                            set(state => ({
                                boardImages: state.boardImages.map(i =>
                                    i.id === currentImg.id ? { ...i, ktx2Src: result.ktx2Src! } : i
                                )
                            }));
                        }
                    }
                } catch (err) { }
                // Small delay between items
                await new Promise(r => setTimeout(r, 100));
            }
        }
    },



    handleImageMouseDown: (imageId, isShiftKey) => {
        const { boardImages, groupEditModeId } = get();
        const image = boardImages.find(img => img.id === imageId);
        if (!image) return;

        if (!groupEditModeId && image.groupId) {
            get().handleGroupMouseDown(image.groupId, isShiftKey);
            return;
        }

        if (groupEditModeId && image.groupId && image.groupId !== groupEditModeId) {
            return;
        }

        set(state => {
            let zIndexCounter = state.zIndexCounter + 1;

            let nextSelectedImageIds;
            let nextSelectedGroupIds;
            let nextSelectedMemoIds;

            if (isShiftKey) {
                const newSet = new Set(state.selectedImageIds);
                newSet.has(imageId) ? newSet.delete(imageId) : newSet.add(imageId);
                nextSelectedImageIds = newSet;

                // Preserve group and memo selections when using shift-click
                nextSelectedGroupIds = state.selectedGroupIds;
                nextSelectedMemoIds = state.selectedMemoIds;
            } else if (state.selectedImageIds.has(imageId)) {
                // Clicking an already selected item without shift -> keep all current selections intact for dragging
                nextSelectedImageIds = state.selectedImageIds;
                nextSelectedGroupIds = state.selectedGroupIds;
                nextSelectedMemoIds = state.selectedMemoIds;
            } else {
                // Clicking an unselected item without shift -> clear other selections and select only this one
                nextSelectedImageIds = new Set([imageId]);
                nextSelectedGroupIds = new Set<string>();
                nextSelectedMemoIds = new Set<string>();
            }

            return {
                boardImages: state.boardImages.map(img => (nextSelectedImageIds.has(img.id)) ? { ...img, zIndex: zIndexCounter } : img),
                zIndexCounter,
                selectedImageIds: nextSelectedImageIds,
                selectedGroupIds: nextSelectedGroupIds,
                selectedMemoIds: nextSelectedMemoIds,
            };
        });
    },

    handleGroupMouseDown: (groupId, isShiftKey) => set(state => {
        const { selectedGroupIds, selectedImageIds, selectedMemoIds, zIndexCounter } = state;
        let newZIndexCounter = zIndexCounter + 1;
        let nextSelectedGroupIds;
        let nextSelectedImageIds;
        let nextSelectedMemoIds;

        if (isShiftKey) {
            const newSet = new Set(selectedGroupIds);
            newSet.has(groupId) ? newSet.delete(groupId) : newSet.add(groupId);
            nextSelectedGroupIds = newSet;

            // Preserve other selections when shift-clicking
            nextSelectedImageIds = selectedImageIds;
            nextSelectedMemoIds = selectedMemoIds;
        } else if (selectedGroupIds.has(groupId)) {
            // Clicking an already selected item without shift -> keep all current selections intact for dragging
            nextSelectedGroupIds = selectedGroupIds;
            nextSelectedImageIds = selectedImageIds;
            nextSelectedMemoIds = selectedMemoIds;
        } else {
            // Clicking an unselected item without shift -> clear other selections and select only this one
            nextSelectedGroupIds = new Set([groupId]);
            nextSelectedImageIds = new Set<string>();
            nextSelectedMemoIds = new Set<string>();
        }

        return {
            boardGroups: state.boardGroups.map(g => nextSelectedGroupIds.has(g.id) ? { ...g, zIndex: newZIndexCounter + 1 } : g),
            selectedGroupIds: nextSelectedGroupIds,
            selectedImageIds: nextSelectedImageIds,
            selectedMemoIds: nextSelectedMemoIds,
            zIndexCounter: newZIndexCounter
        };
    }),

    groupSelection: () => {
        set(state => {
            const { boardImages, selectedImageIds, zIndexCounter } = state;
            const selectedImages = boardImages.filter(img => selectedImageIds.has(img.id) && !img.groupId);
            if (selectedImages.length < 2) return state;

            const PADDING = 20;

            // Arrange images using simple shelf packing - NEVER modify width/height
            const originX = Math.min(...selectedImages.map(i => i.x));
            const originY = Math.min(...selectedImages.map(i => i.y));

            // Sort by height descending for better packing
            const sorted = [...selectedImages].sort((a, b) => b.height - a.height);

            // Calculate shelf max width based on total area
            const totalWidth = sorted.reduce((sum, img) => sum + img.width, 0);
            const avgWidth = totalWidth / sorted.length;
            const maxShelfWidth = Math.max(
                avgWidth * Math.ceil(Math.sqrt(sorted.length) * 1.5),
                sorted[0]?.width || 0
            );

            // Shelf packing - position only, sizes untouched
            const posMap = new Map<string, { x: number; y: number }>();
            let shelfX = originX;
            let shelfY = originY;
            let shelfHeight = 0;

            for (const img of sorted) {
                if (shelfX > originX && shelfX + img.width > originX + maxShelfWidth) {
                    shelfY += shelfHeight + PADDING;
                    shelfX = originX;
                    shelfHeight = 0;
                }
                posMap.set(img.id, { x: shelfX, y: shelfY });
                shelfX += img.width + PADDING;
                shelfHeight = Math.max(shelfHeight, img.height);
            }

            const newGroupId = `group-${crypto.randomUUID()}`;
            const imagesWithNewPositionsAndGroup = selectedImages.map(img => {
                const pos = posMap.get(img.id);
                return {
                    ...img,
                    groupId: newGroupId,
                    x: pos?.x ?? img.x,
                    y: pos?.y ?? img.y,
                    // width and height are intentionally NOT changed
                };
            });
            const imageUpdateMap = new Map(imagesWithNewPositionsAndGroup.map(img => [img.id, img]));

            const minX = Math.min(...imagesWithNewPositionsAndGroup.map(i => i.x));
            const minY = Math.min(...imagesWithNewPositionsAndGroup.map(i => i.y));
            const maxX = Math.max(...imagesWithNewPositionsAndGroup.map(i => i.x + i.width));
            const maxY = Math.max(...imagesWithNewPositionsAndGroup.map(i => i.y + i.height));

            const newGroup: BoardGroup = {
                id: newGroupId,
                name: t('group.defaultName', 'ko'),
                x: minX - PADDING,
                y: minY - PADDING,
                width: (maxX - minX) + PADDING * 2,
                height: (maxY - minY) + PADDING * 2,
                imageIds: imagesWithNewPositionsAndGroup.map(img => img.id),
                zIndex: zIndexCounter + 1,
            };

            const updatedImages = state.boardImages.map(img => imageUpdateMap.get(img.id) || img);

            return {
                boardImages: updatedImages,
                boardGroups: [...state.boardGroups, newGroup],
                selectedImageIds: new Set<string>(),
                selectedGroupIds: new Set([newGroupId]),
                zIndexCounter: zIndexCounter + 1,
                editingGroupId: newGroupId,
            };
        });
        get().saveHistory();
    },

    groupEditedImage: (originalImageId, newImage) => set(state => {
        const originalImg = state.boardImages.find(img => img.id === originalImageId);
        if (!originalImg) return state;

        let { boardImages, zIndexCounter } = state;

        // Photo album style: place edited image below original with random offset
        const OVERLAP_RANGE = 60;
        const BASE_SPACING = 30;

        // Use the passed width/height directly (already calculated correctly from crop result)
        // Do NOT normalize to a fixed size - the dimensions come from handleUnifiedEditComplete
        // which calculates the correct display size based on actual image dimensions
        const newWidth = newImage.width;
        const newHeight = newImage.height;

        // Random offset for photo album effect
        const randomOffsetX = (Math.random() - 0.5) * OVERLAP_RANGE;
        const randomOffsetY = (Math.random() - 0.5) * OVERLAP_RANGE;

        // Position below original image
        const x = originalImg.x + randomOffsetX;
        const y = originalImg.y + originalImg.height + BASE_SPACING + randomOffsetY;

        zIndexCounter++;
        const newImageWithPosition = {
            ...newImage,
            x,
            y,
            width: newWidth,
            height: newHeight,
            zIndex: zIndexCounter,
            // No groupId - no auto-grouping
        };

        return {
            ...state,
            boardImages: [...boardImages, newImageWithPosition],
            selectedImageIds: new Set([newImage.id]),
            zIndexCounter,
        };
    }),

    ungroupSelection: () => {
        set(state => {
            const { boardImages, boardGroups, selectedGroupIds } = state;
            if (selectedGroupIds.size === 0) return state;
            const imageIdsToUngroup = new Set<string>();
            boardGroups.forEach(g => { if (selectedGroupIds.has(g.id)) { g.imageIds.forEach(id => imageIdsToUngroup.add(id)); } });
            const remainingGroups = boardGroups.filter(g => !selectedGroupIds.has(g.id));
            const updatedImages = boardImages.map((img): BoardImage => { if (imageIdsToUngroup.has(img.id)) { const newImg = { ...img }; delete newImg.groupId; return newImg; } return img; });
            const groupIds = Array.from(state.selectedGroupIds);
            return { boardImages: updatedImages, boardGroups: remainingGroups, selectedImageIds: imageIdsToUngroup, selectedGroupIds: new Set<string>(), groupEditModeId: groupIds.includes(state.groupEditModeId!) ? null : state.groupEditModeId };
        });
        get().saveHistory();
    },

    setMergeGroupsModalOpen: (open) => set({ mergeGroupsModalOpen: open }),

    mergeGroups: (targetGroupId) => {
        set(state => {
            const { boardImages, boardGroups, selectedGroupIds, zIndexCounter } = state;
            if (selectedGroupIds.size < 2) return state;

            const targetGroup = boardGroups.find(g => g.id === targetGroupId);
            if (!targetGroup) return state;

            const PADDING = 20;

            // Collect all imageIds from all selected groups
            const allImageIds = new Set<string>();
            boardGroups
                .filter(g => selectedGroupIds.has(g.id))
                .forEach(g => g.imageIds.forEach(id => allImageIds.add(id)));

            const allImages = boardImages.filter(img => allImageIds.has(img.id));
            if (allImages.length === 0) return state;

            // Shelf packing anchored at target group origin
            const originX = targetGroup.x + PADDING;
            const originY = targetGroup.y + PADDING;
            const sorted = [...allImages].sort((a, b) => b.height - a.height);
            const totalWidth = sorted.reduce((sum, img) => sum + img.width, 0);
            const avgWidth = totalWidth / sorted.length;
            const maxShelfWidth = Math.max(
                avgWidth * Math.ceil(Math.sqrt(sorted.length) * 1.5),
                sorted[0]?.width || 0
            );

            const posMap = new Map<string, { x: number; y: number }>();
            let shelfX = originX;
            let shelfY = originY;
            let shelfHeight = 0;
            for (const img of sorted) {
                if (shelfX > originX && shelfX + img.width > originX + maxShelfWidth) {
                    shelfY += shelfHeight + PADDING;
                    shelfX = originX;
                    shelfHeight = 0;
                }
                posMap.set(img.id, { x: shelfX, y: shelfY });
                shelfX += img.width + PADDING;
                shelfHeight = Math.max(shelfHeight, img.height);
            }

            // Update all merged images
            const updatedImages = boardImages.map(img => {
                if (!allImageIds.has(img.id)) return img;
                const pos = posMap.get(img.id);
                return { ...img, groupId: targetGroupId, x: pos?.x ?? img.x, y: pos?.y ?? img.y };
            });

            // Recalculate target group bounds
            const mergedImgs = updatedImages.filter(img => allImageIds.has(img.id));
            const minX = Math.min(...mergedImgs.map(i => i.x));
            const minY = Math.min(...mergedImgs.map(i => i.y));
            const maxX = Math.max(...mergedImgs.map(i => i.x + i.width));
            const maxY = Math.max(...mergedImgs.map(i => i.y + i.height));

            const updatedTargetGroup: BoardGroup = {
                ...targetGroup,
                x: minX - PADDING,
                y: minY - PADDING,
                width: (maxX - minX) + PADDING * 2,
                height: (maxY - minY) + PADDING * 2,
                imageIds: Array.from(allImageIds),
                zIndex: zIndexCounter + 1,
            };

            const updatedGroups = boardGroups
                .filter(g => !selectedGroupIds.has(g.id) || g.id === targetGroupId)
                .map(g => g.id === targetGroupId ? updatedTargetGroup : g);

            return {
                boardImages: updatedImages,
                boardGroups: updatedGroups,
                selectedGroupIds: new Set([targetGroupId]),
                selectedImageIds: new Set<string>(),
                mergeGroupsModalOpen: false,
                zIndexCounter: zIndexCounter + 1,
            };
        });
        get().saveHistory();
    },

    zoomToBounds: (bounds, canvasRect) => {
        const PADDING = 100;
        const targetWidth = bounds.width + PADDING * 2;
        const targetHeight = bounds.height + PADDING * 2;
        if (targetWidth <= 0 || targetHeight <= 0) return;
        const scaleX = canvasRect.width / targetWidth;
        const scaleY = canvasRect.height / targetHeight;
        const newZoom = Math.min(scaleX, scaleY, 2);
        const newPanX = (canvasRect.width / 2) - (bounds.x + bounds.width / 2) * newZoom;
        const newPanY = (canvasRect.height / 2) - (bounds.y + bounds.height / 2) * newZoom;
        set({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
    },

    zoomToImage: (image, canvasRect) => { get().zoomToBounds(image, canvasRect); },
    zoomToGroup: (group, canvasRect) => { get().zoomToBounds(group, canvasRect); },

    reorderBoardGroups: (draggedId, targetId) => set(state => {
        const { boardGroups } = state;
        const draggedIndex = boardGroups.findIndex(g => g.id === draggedId);
        const targetIndex = boardGroups.findIndex(g => g.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return state;
        const newGroups = [...boardGroups];
        const [draggedItem] = newGroups.splice(draggedIndex, 1);
        newGroups.splice(targetIndex, 0, draggedItem);
        get().saveHistory();
        return { boardGroups: newGroups };
    }),

    removeImageFromGroup: (imageId) => {
        set(state => {
            const image = state.boardImages.find(img => img.id === imageId);
            if (!image || !image.groupId) return state;
            const groupId = image.groupId;
            const newImages = state.boardImages.map(img => img.id === imageId ? { ...img, groupId: undefined } : img);
            const group = state.boardGroups.find(g => g.id === groupId);
            if (!group) return { ...state, boardImages: newImages };
            const remainingImageIds = group.imageIds.filter(id => id !== imageId);
            if (remainingImageIds.length < 2) {
                const finalImages = newImages.map(img => remainingImageIds.includes(img.id) ? { ...img, groupId: undefined } : img);
                const newGroups = state.boardGroups.filter(g => g.id !== groupId);
                return { ...state, boardImages: finalImages, boardGroups: newGroups, groupEditModeId: state.groupEditModeId === groupId ? null : state.groupEditModeId, selectedImageIds: new Set([imageId, ...remainingImageIds]), selectedGroupIds: new Set() };
            } else {
                const newBoardGroups = state.boardGroups.map(g => g.id === groupId ? { ...g, imageIds: remainingImageIds } : g);
                const resizedState = resizeGroup(groupId, newImages, newBoardGroups);
                return {
                    ...state,
                    boardImages: newImages,
                    boardGroups: resizedState.boardGroups,
                    selectedImageIds: new Set([imageId]),
                    selectedGroupIds: new Set(),
                };
            }
        });
        get().saveHistory();
    },

    dropSelectionOnGroup: (targetGroupId) => {
        set(state => {
            const { boardImages, boardGroups, selectedImageIds } = state;
            const targetGroup = boardGroups.find(g => g.id === targetGroupId);
            const imagesToAdd = boardImages.filter(img => selectedImageIds.has(img.id) && img.groupId !== targetGroupId);

            if (!targetGroup || imagesToAdd.length === 0) return state;

            const imageIdsToAdd = imagesToAdd.map(img => img.id);

            const updatedImages = boardImages.map(img => {
                if (imageIdsToAdd.includes(img.id)) {
                    return { ...img, groupId: targetGroupId };
                }
                return img;
            });

            const updatedGroups = boardGroups.map(g => {
                if (g.id === targetGroupId) {
                    return { ...g, imageIds: Array.from(new Set([...g.imageIds, ...imageIdsToAdd])) };
                }
                // Remove images from their old groups
                return { ...g, imageIds: g.imageIds.filter(id => !imageIdsToAdd.includes(id)) };
            }).filter(g => g.imageIds.length > 0);

            // Auto-sort: bin-pack images within the target group after adding
            const PADDING = 20;
            const STANDARD_SIZE = 512;
            const { packImagesWithRolePriority } = require('../utils/binPacking');

            const groupImages = updatedImages.filter(img => img.groupId === targetGroupId);
            const positionUpdates = packImagesWithRolePriority(
                groupImages,
                targetGroup.x + PADDING,
                targetGroup.y + PADDING,
                PADDING,
                false,
                STANDARD_SIZE
            );

            const packedImages = updatedImages.map(img => {
                const update = positionUpdates.get(img.id);
                if (update) {
                    return { ...img, x: update.x, y: update.y, width: update.width ?? img.width, height: update.height ?? img.height };
                }
                return img;
            });

            const resizedState = resizeGroup(targetGroupId, packedImages, updatedGroups);

            return {
                boardImages: packedImages,
                boardGroups: resizedState.boardGroups,
                selectedImageIds: new Set(),
                selectedGroupIds: new Set([targetGroupId]),
            };
        });
        get().saveHistory();
    },

    addImagesToExistingGroup: (groupId, imageIds) => {
        set(state => {
            const targetGroup = state.boardGroups.find(g => g.id === groupId);
            if (!targetGroup || imageIds.length === 0) return state;

            const idsToAdd = imageIds.filter(id =>
                state.boardImages.some(img => img.id === id)
            );
            if (idsToAdd.length === 0) return state;

            // 1) 신규 이미지에 groupId 부여
            const imagesWithGroupId = state.boardImages.map(img =>
                idsToAdd.includes(img.id) ? { ...img, groupId } : img
            );

            // 2) imageIds 배열 갱신 (중복 방지)
            const updatedGroups = state.boardGroups.map(g => {
                if (g.id !== groupId) return g;
                const existing = new Set(g.imageIds);
                const appendOnly = idsToAdd.filter(id => !existing.has(id));
                return { ...g, imageIds: [...g.imageIds, ...appendOnly] };
            });

            // 3) 그룹 전체 재정렬 (intelligentGrouping과 동일 알고리즘 — 역할 우선순위 + 정규화 bin packing)
            const { packImagesWithRolePriority } = require('../utils/binPacking');
            const PADDING = 20;
            const STANDARD_SIZE = 512;
            const allGroupImages = imagesWithGroupId.filter(img => img.groupId === groupId);

            // 앵커: 기존 그룹의 좌상단 (위치 점프 방지)
            const positionUpdates = packImagesWithRolePriority(
                allGroupImages,
                targetGroup.x + PADDING,
                targetGroup.y + PADDING,
                PADDING,
                false,
                STANDARD_SIZE
            );

            // 4) 위치/크기 적용
            const packedImages = imagesWithGroupId.map(img => {
                const update = positionUpdates.get(img.id);
                if (!update) return img;
                return {
                    ...img,
                    x: update.x,
                    y: update.y,
                    ...(update.width !== undefined ? { width: update.width } : {}),
                    ...(update.height !== undefined ? { height: update.height } : {}),
                };
            });

            // 5) 그룹 bounds 재계산
            const resizedState = resizeGroup(groupId, packedImages, updatedGroups);
            return {
                ...state,
                boardImages: packedImages,
                boardGroups: resizedState.boardGroups,
            };
        });
        get().saveHistory();
    },

    setChatHistory: (updater) => set(state => ({ chatHistory: updater(state.chatHistory) })),
    setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),

    clearCanvas: () => set(state => {
        // [FIX CRASH-3] Clear load queue BEFORE revoking blobs to prevent race condition
        clearLoadQueue();
        clearTinyPreloadQueue();

        // [MEMORY] Explicitly revoke all image resources before clearing
        state.boardImages.forEach(img => {
            revokeImageResources(img);
        });

        // [MEMORY OPTIMIZATION] Clear metadata store
        useMetadataStore.getState().clear();

        setTimeout(() => get().resetHistory(), 0);
        return {
            boardImages: [],
            boardGroups: [],
            memos: [],
            selectedImageIds: new Set(),
            selectedGroupIds: new Set(),
            selectedMemoIds: new Set(),
            chatHistory: [{ role: 'model', content: t('chat.intro', 'ko') }],
            zIndexCounter: 10,
            activeReferenceIndex: null,
            editingGroupId: null,
            groupEditModeId: null,
            marquee: null,
            lightingClipboard: null,
            insertTargetImage: null,
            inpaintWorkType: null,
            objectEditorImages: [],
            isObjectInsertMode: false,
        };
    }),

    intelligentGrouping: (groupsToCreate) => {
        set(state => {
            const { boardImages, boardGroups, zIndexCounter } = state;
            let newZIndex = zIndexCounter;

            const allImageIdsToGroup = new Set(groupsToCreate.flatMap(g => g.imageIds));
            const imagesBeingGrouped = boardImages.filter(img => allImageIdsToGroup.has(img.id));
            if (imagesBeingGrouped.length === 0) return state;

            const newGroups: BoardGroup[] = [];
            const imageUpdateMap = new Map<string, { groupId: string }>();

            for (const groupData of groupsToCreate) {
                const imagesInThisGroup = imagesBeingGrouped.filter(img => groupData.imageIds.includes(img.id));
                if (imagesInThisGroup.length === 0) continue;

                const newGroupId = `group - ${crypto.randomUUID()} `;
                newZIndex++;

                imagesInThisGroup.forEach(img => imageUpdateMap.set(img.id, { groupId: newGroupId }));

                const PADDING = 20;
                const STANDARD_SIZE = 512;
                const { packImagesWithRolePriority } = require('../utils/binPacking');

                // 기준 앵커: 기존 이미지들의 좌상단
                const anchorX = Math.min(...imagesInThisGroup.map(i => i.x));
                const anchorY = Math.min(...imagesInThisGroup.map(i => i.y));

                // 역할 이미지 1행 우선 배치 (자동정렬과 동일 알고리즘)
                const positionUpdates = packImagesWithRolePriority(
                    imagesInThisGroup,
                    anchorX + PADDING,
                    anchorY + PADDING,
                    PADDING,
                    false,
                    STANDARD_SIZE
                );

                positionUpdates.forEach((pos, id) => {
                    imageUpdateMap.set(id, { ...imageUpdateMap.get(id)!, ...pos });
                });

                // 새 위치 기준으로 bounding box 계산
                const positions = imagesInThisGroup.map(img => {
                    const p = positionUpdates.get(img.id);
                    const w = p?.width ?? img.width;
                    const h = p?.height ?? img.height;
                    const x = p?.x ?? img.x;
                    const y = p?.y ?? img.y;
                    return { x, y, w, h };
                });
                const minX = Math.min(...positions.map(p => p.x));
                const minY = Math.min(...positions.map(p => p.y));
                const maxX = Math.max(...positions.map(p => p.x + p.w));
                const maxY = Math.max(...positions.map(p => p.y + p.h));

                newGroups.push({
                    id: newGroupId,
                    name: groupData.name,
                    x: minX - PADDING,
                    y: minY - PADDING,
                    width: (maxX - minX) + PADDING * 2,
                    height: (maxY - minY) + PADDING * 2,
                    imageIds: groupData.imageIds,
                    zIndex: newZIndex,
                });
            }

            const updatedImages = boardImages.map(img => {
                const update = imageUpdateMap.get(img.id);
                if (update) {
                    const { groupId, x, y, width, height } = update as any;
                    return {
                        ...img,
                        groupId: groupId ?? img.groupId,
                        ...(x !== undefined ? { x } : {}),
                        ...(y !== undefined ? { y } : {}),
                        ...(width !== undefined ? { width } : {}),
                        ...(height !== undefined ? { height } : {}),
                    };
                }
                return img;
            });

            return {
                boardImages: updatedImages,
                boardGroups: [...boardGroups, ...newGroups],
                selectedImageIds: new Set(),
                selectedGroupIds: new Set(newGroups.map(g => g.id)),
                zIndexCounter: newZIndex,
            };
        });
        get().saveHistory();
    },

    aiSortImages: async (onProgress, opts) => {
        const { boardImages } = get();

        // Only sort ungrouped images
        const ungroupedImages = boardImages.filter(img => !img.groupId);
        if (ungroupedImages.length < 2) {
            console.warn('[aiSort] Need at least 2 ungrouped images to sort.');
            return;
        }

        try {
            // aiSortService controls 5→92%, canvasStore handles 93→100% (layout + apply)
            const { classifyImages } = await import('../services/aiSortService');
            const { language, aiSortMaxGroups, aiSortAxis, aiSortVerifyClusters } = useSettingsStore.getState();
            const result = await classifyImages(ungroupedImages, {
                axis: opts?.axis ?? aiSortAxis ?? 'concept',
                maxGroups: opts?.maxGroups ?? aiSortMaxGroups ?? 'auto',
                verifyClusters: opts?.verifyClusters ?? aiSortVerifyClusters ?? true,
                language,
                onProgress,
            });

            if (Object.keys(result.groups).length === 0) {
                console.warn('[aiSort] No groups returned from AI.');
                return;
            }

            onProgress?.(88, 'Arranging layout...');

            // Step 2: Build image map for layout
            const imageMap = new Map<string, typeof ungroupedImages[0]>();
            for (const img of ungroupedImages) imageMap.set(img.id, img);

            const groupedImagesMap = new Map<string, typeof ungroupedImages>();
            for (const [groupName, imageIds] of Object.entries(result.groups)) {
                const imgs = imageIds.map(id => imageMap.get(id)).filter(Boolean) as typeof ungroupedImages;
                if (imgs.length > 0) groupedImagesMap.set(groupName, imgs);
            }

            // Step 3: Compute layout using packGroupedImages
            const { packGroupedImages } = await import('../utils/binPacking');

            // Use center of ungrouped images as anchor
            const centerX = ungroupedImages.reduce((s, i) => s + i.x, 0) / ungroupedImages.length;
            const centerY = ungroupedImages.reduce((s, i) => s + i.y, 0) / ungroupedImages.length;

            const STANDARD_SIZE = 512;
            const { imagePositions, groupBounds } = packGroupedImages(
                groupedImagesMap, centerX, centerY, 20, 60, STANDARD_SIZE
            );

            // Step 4: Apply to store
            get().saveHistory();
            set(state => {
                let newZIndex = state.zIndexCounter;

                // Update image positions
                const updatedImages = state.boardImages.map(img => {
                    const pos = imagePositions.get(img.id);
                    if (pos) {
                        return { ...img, x: pos.x, y: pos.y };
                    }
                    return img;
                });

                // Create new BoardGroups
                const newGroups = groupBounds.map(gb => {
                    newZIndex++;
                    const groupId = `group-${crypto.randomUUID()}`;
                    // Assign groupId to images in this group
                    for (const imgId of gb.imageIds) {
                        const imgIdx = updatedImages.findIndex(i => i.id === imgId);
                        if (imgIdx >= 0) {
                            updatedImages[imgIdx] = { ...updatedImages[imgIdx], groupId };
                        }
                    }
                    return {
                        id: groupId,
                        name: gb.name,
                        x: gb.x,
                        y: gb.y,
                        width: gb.width,
                        height: gb.height,
                        imageIds: gb.imageIds,
                        zIndex: newZIndex,
                    };
                });

                const distribution = newGroups.map(g => ({ name: g.name, count: g.imageIds.length }));
                const maxRatio = Math.max(...distribution.map(d => d.count / ungroupedImages.length));
                console.log('[aiSort] 분포:', distribution);
                console.log(`[aiSort] 최대그룹비율: ${(maxRatio * 100).toFixed(1)}%`);

                return {
                    boardImages: updatedImages,
                    boardGroups: [...state.boardGroups, ...newGroups],
                    selectedImageIds: new Set(),
                    selectedGroupIds: new Set(newGroups.map(g => g.id)),
                    zIndexCounter: newZIndex,
                };
            });

            onProgress?.(100, 'Complete');
            console.log(`[aiSort] ✅ Sorted ${ungroupedImages.length} images into ${groupBounds.length} groups.`);
        } catch (error) {
            console.error('[aiSort] ❌ AI Sort failed:', error);
            throw error;
        }
    },

    reset: () => set((state) => {
        // [FIX CRASH-3] Clear load queue BEFORE revoking blobs to prevent race condition
        clearLoadQueue();
        clearTinyPreloadQueue();

        state.boardImages.forEach(img => {
            revokeImageResources(img);
        });
        // [MEMORY OPTIMIZATION] Clear metadata store
        useMetadataStore.getState().clear();
        return {
            ...initialState,
            chatHistory: [{ role: 'model', content: t('chat.intro', 'ko') }],
        };
    }),
    setMarquee: (marquee) => set({ marquee }),
    updateImageStyleIntensity: (id, intensity) => set((state) => ({
        boardImages: state.boardImages.map((img) =>
            img.id === id ? { ...img, styleIntensity: intensity } : img
        ),
    })),



    saveHistory: (actionType = 'other') => set(state => {
        const maxHistory = Math.min(
            MAX_HISTORY_LENGTH_MAX,
            Math.max(1, useSettingsStore.getState().undoHistorySize ?? MAX_HISTORY_LENGTH_DEFAULT)
        );

        // Build lightweight snapshot (exclude File objects to save RAM)
        const snapshot: SavedSnapshot = {
            boardImages: state.boardImages.map(img => ({
                ...img,
                file: undefined,
                originalFile: undefined,
                proxyFile: undefined,
                tinyFile: undefined,
                previewFile: undefined,
            })),
            boardGroups: [...state.boardGroups],
            memos: [...state.memos],
            selectedImageIds: new Set(state.selectedImageIds),
            selectedGroupIds: new Set(state.selectedGroupIds),
            selectedMemoIds: new Set(state.selectedMemoIds),
            zIndexCounter: state.zIndexCounter,
        };

        // Discard redo entries (everything after current index)
        let newHistory: HistoryEntry[] = [
            ...state.history.slice(0, state.historyIndex + 1),
            { patches: [], inversePatches: [], timestamp: Date.now(), snapshot, actionType },
        ];

        // Helper: cleanup blobs from a dropped entry
        // [FIX BLOB-PROTECT] Protect ALL LOD URL fields across all remaining entries and current images.
        // Previously only src/thumbnailSrc/tinySrc were protected — previewSrc, proxySrc, ktx2Src etc.
        // could be revoked while still referenced by remaining history entries.
        const collectAllSrcs = (img: BoardImage, set: Set<string>) => {
            if (img.src) set.add(img.src);
            if (img.thumbnailSrc) set.add(img.thumbnailSrc);
            if (img.tinySrc) set.add(img.tinySrc);
            if (img.previewSrc) set.add(img.previewSrc);
            if (img.proxySrc) set.add(img.proxySrc);
            if (img.ktx2Src) set.add(img.ktx2Src);
            if (img.highResSrc) set.add(img.highResSrc);
            if (img.originalSrc) set.add(img.originalSrc);
            if (img.maskSrc) set.add(img.maskSrc);
        };

        const cleanupSnapshotBlobs = (dropped: HistoryEntry, remaining: HistoryEntry[], currentImages: BoardImage[]) => {
            const activeSrcs = new Set<string>();
            currentImages.forEach(img => collectAllSrcs(img, activeSrcs));
            remaining.forEach(entry => entry.snapshot.boardImages.forEach(img => collectAllSrcs(img, activeSrcs)));

            // Revoke each URL individually — only if not referenced anywhere else
            dropped.snapshot.boardImages.forEach(img => {
                const urlsToCheck: (string | undefined)[] = [
                    img.src, img.thumbnailSrc, img.tinySrc, img.previewSrc,
                    img.proxySrc, img.ktx2Src, img.highResSrc, img.originalSrc, img.maskSrc,
                ];
                urlsToCheck.forEach(url => {
                    if (url && !activeSrcs.has(url)) {
                        blobManager.revoke(url);
                    }
                });
            });
        };

        // Enforce overall history limit
        if (newHistory.length > maxHistory) {
            const dropped = newHistory.shift()!;
            cleanupSnapshotBlobs(dropped, newHistory, state.boardImages);
        }

        return {
            history: newHistory,
            historyIndex: newHistory.length - 1,
            lastCommittedSnapshot: snapshot,
        };
    }),

    undo: () => {
        set(state => {
            if (state.historyIndex <= 0) return state;
            const prevIndex = state.historyIndex - 1;
            const { snapshot } = state.history[prevIndex];
            // [FIX BLOB-RETRY] Clear failedIds for restored images so they can reload after undo
            const restoredSrcs = snapshot.boardImages.flatMap(img => [
                img.src, img.tinySrc, img.previewSrc, img.proxySrc, img.ktx2Src, img.highResSrc, img.originalSrc,
            ].filter(Boolean) as string[]);
            clearFailedBlobUrls(restoredSrcs);
            return {
                boardImages: snapshot.boardImages,
                boardGroups: snapshot.boardGroups,
                memos: snapshot.memos,
                selectedImageIds: new Set(snapshot.selectedImageIds),
                selectedGroupIds: new Set(snapshot.selectedGroupIds),
                selectedMemoIds: new Set(snapshot.selectedMemoIds),
                zIndexCounter: snapshot.zIndexCounter,
                historyIndex: prevIndex,
                lastCommittedSnapshot: snapshot,
            };
        });
    },

    redo: () => {
        set(state => {
            if (state.historyIndex >= state.history.length - 1) return state;
            const nextIndex = state.historyIndex + 1;
            const { snapshot } = state.history[nextIndex];
            // [FIX BLOB-RETRY] Clear failedIds for restored images so they can reload after redo
            const restoredSrcs = snapshot.boardImages.flatMap(img => [
                img.src, img.tinySrc, img.previewSrc, img.proxySrc, img.ktx2Src, img.highResSrc, img.originalSrc,
            ].filter(Boolean) as string[]);
            clearFailedBlobUrls(restoredSrcs);
            return {
                boardImages: snapshot.boardImages,
                boardGroups: snapshot.boardGroups,
                memos: snapshot.memos,
                selectedImageIds: new Set(snapshot.selectedImageIds),
                selectedGroupIds: new Set(snapshot.selectedGroupIds),
                selectedMemoIds: new Set(snapshot.selectedMemoIds),
                zIndexCounter: snapshot.zIndexCounter,
                historyIndex: nextIndex,
                lastCommittedSnapshot: snapshot,
            };
        });
    },

    resetHistory: () => set(state => {
        // [MEMORY] Clear history array and revoke orphaned blob URLs
        const currentImageSrcs = new Set<string>();
        state.boardImages.forEach(img => {
            currentImageSrcs.add(img.src);
            if (img.thumbnailSrc) currentImageSrcs.add(img.thumbnailSrc);
            if (img.tinySrc) currentImageSrcs.add(img.tinySrc);
        });

        state.history.forEach(entry => {
            entry.snapshot.boardImages.forEach(img => {
                if (img.src && !currentImageSrcs.has(img.src)) {
                    revokeImageResources(img);
                }
            });
        });

        const freshSnapshot: SavedSnapshot = {
            boardImages: state.boardImages.map(img => ({
                ...img,
                file: undefined,
                originalFile: undefined,
                proxyFile: undefined,
                tinyFile: undefined,
                previewFile: undefined,
            })),
            boardGroups: [...state.boardGroups],
            memos: [...state.memos],
            selectedImageIds: new Set(state.selectedImageIds),
            selectedGroupIds: new Set(state.selectedGroupIds),
            selectedMemoIds: new Set(state.selectedMemoIds),
            zIndexCounter: state.zIndexCounter,
        };

        return {
            history: [],
            historyIndex: -1,
            lastCommittedSnapshot: freshSnapshot,
        };
    }),

    // Memo actions
    addMemo: (memo) => {
        set((state) => ({
            memos: [...state.memos, memo],
            zIndexCounter: state.zIndexCounter + 1,
        }));
        get().saveHistory();
    },

    updateMemo: (id, updates) => {
        set((state) => ({
            memos: state.memos.map((memo) =>
                memo.id === id ? { ...memo, ...updates } : memo
            ),
        }));
        // Note: saveHistory() removed - caller should save history explicitly after batch updates
    },

    deleteMemo: (id) => {
        set((state) => ({
            memos: state.memos.filter((memo) => memo.id !== id),
            selectedMemoIds: new Set(Array.from(state.selectedMemoIds).filter(memoId => memoId !== id)),
        }));
        get().saveHistory();
    },

    handleMemoMouseDown: (id, isShiftKey) => set((state) => {
        let nextSelectedMemoIds;
        let nextSelectedImageIds;
        let nextSelectedGroupIds;

        if (isShiftKey) {
            const newSelected = new Set(state.selectedMemoIds);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            nextSelectedMemoIds = newSelected;

            // Preserve other selections when shift-clicking
            nextSelectedImageIds = state.selectedImageIds;
            nextSelectedGroupIds = state.selectedGroupIds;
        } else if (state.selectedMemoIds.has(id)) {
            // Clicking an already selected memo without shift -> keep all current selections intact for dragging
            nextSelectedMemoIds = state.selectedMemoIds;
            nextSelectedImageIds = state.selectedImageIds;
            nextSelectedGroupIds = state.selectedGroupIds;
        } else {
            // Clicking an unselected memo without shift -> clear other selections and select only this one
            nextSelectedMemoIds = new Set([id]);
            nextSelectedImageIds = new Set<string>();
            nextSelectedGroupIds = new Set<string>();
        }

        return {
            selectedMemoIds: nextSelectedMemoIds,
            selectedImageIds: nextSelectedImageIds,
            selectedGroupIds: nextSelectedGroupIds,
        };
    }),





    copyLighting: (type, data) => set({ lightingClipboard: { type, data } }),
    // 객체 삽입 모드 및 단축키 컨텍스트
    setObjectInsertMode: (isActive) => set({ isObjectInsertMode: isActive }),
    setActiveKeyboardContext: (context) => set({ activeKeyboardContext: context }),
    setInpaintMode: (mode) => set(state => ({
        inpaintMode: mode,
        inpaintOverrides: { ...state.inpaintOverrides, mode: mode !== DEFAULT_INPAINT_MODE },
    })),
    setInpaintWorkType: (workType) => set(state => ({
        inpaintWorkType: workType,
        inpaintOverrides: { ...state.inpaintOverrides, workType: workType !== null },
    })),
    setMaskFeatherRadius: (radius) => set(state => ({
        maskFeatherRadius: radius,
        inpaintOverrides: { ...state.inpaintOverrides, maskFeatherRadius: radius !== DEFAULT_MASK_FEATHER_RADIUS },
    })),
    setInpaintContextPadding: (ratio) => set(state => ({
        inpaintContextPadding: ratio,
        inpaintOverrides: { ...state.inpaintOverrides, contextPadding: ratio !== DEFAULT_INPAINT_CONTEXT_PADDING },
    })),
    setInpaintToneMatch: (enabled) => set(state => ({
        inpaintToneMatch: enabled,
        inpaintOverrides: { ...state.inpaintOverrides, toneMatch: enabled !== DEFAULT_INPAINT_TONE_MATCH },
    })),
    setInpaintBrushSize: (size) => set(state => ({
        inpaintBrushSize: size,
        inpaintOverrides: { ...state.inpaintOverrides, brushSize: size !== DEFAULT_INPAINT_BRUSH_SIZE },
    })),
    setInpaintEraserMode: (enabled) => set({ inpaintEraserMode: enabled }),
    setInpaintSmartHint: (hint) => set({ inpaintSmartHint: hint }),
    setInpaintVariationStrength: (value) => set(state => ({
        inpaintVariationStrength: value,
        inpaintOverrides: { ...state.inpaintOverrides, variationStrength: value !== DEFAULT_INPAINT_VARIATION_STRENGTH },
    })),
    setInpaintSceneAnalyzerEnabled: (enabled) => set({ inpaintSceneAnalyzerEnabled: enabled }),
    setInpaintAnatomyConstraintsEnabled: (enabled) => set({ inpaintAnatomyConstraintsEnabled: enabled }),
    setInpaintSceneAwareEnabled: (enabled) => set({ inpaintSceneAwareEnabled: enabled }),
    setLastSceneContext: (ctx) => set({ lastSceneContext: ctx }),
    markInpaintOverride: (key, overridden) => set(state => ({
        inpaintOverrides: { ...state.inpaintOverrides, [key]: overridden },
    })),
    resetInpaintField: (key) => set(state => {
        const next: Partial<typeof state> = {
            inpaintOverrides: { ...state.inpaintOverrides, [key]: false },
        };
        switch (key) {
            case 'mode':              next.inpaintMode = DEFAULT_INPAINT_MODE; break;
            case 'workType':          next.inpaintWorkType = null; break;
            case 'brushSize':         next.inpaintBrushSize = DEFAULT_INPAINT_BRUSH_SIZE; break;
            case 'maskFeatherRadius': next.maskFeatherRadius = DEFAULT_MASK_FEATHER_RADIUS; break;
            case 'contextPadding':    next.inpaintContextPadding = DEFAULT_INPAINT_CONTEXT_PADDING; break;
            case 'toneMatch':         next.inpaintToneMatch = DEFAULT_INPAINT_TONE_MATCH; break;
            case 'variationStrength': next.inpaintVariationStrength = DEFAULT_INPAINT_VARIATION_STRENGTH; break;
            case 'preset':            break; // preset reset handled by inpaintPresetStore.setActivePresetId(null)
        }
        return next;
    }),
    resetAllInpaintOverrides: () => set({
        inpaintMode: DEFAULT_INPAINT_MODE,
        inpaintWorkType: null,
        maskFeatherRadius: DEFAULT_MASK_FEATHER_RADIUS,
        inpaintContextPadding: DEFAULT_INPAINT_CONTEXT_PADDING,
        inpaintToneMatch: DEFAULT_INPAINT_TONE_MATCH,
        inpaintBrushSize: DEFAULT_INPAINT_BRUSH_SIZE,
        inpaintVariationStrength: DEFAULT_INPAINT_VARIATION_STRENGTH,
        inpaintOverrides: { ...DEFAULT_INPAINT_OVERRIDES },
    }),
    addObjectEditorImage: (image) => set((state) => ({
        objectEditorImages: [...state.objectEditorImages, image]
    })),
    removeObjectEditorImage: (id) => set((state) => {
        const toRemove = state.objectEditorImages.find(img => img.id === id);
        if (toRemove?.src) blobManager.revoke(toRemove.src);
        return { objectEditorImages: state.objectEditorImages.filter(img => img.id !== id) };
    }),
    clearObjectEditorImages: () => set((state) => {
        state.objectEditorImages.forEach(img => { if (img.src) blobManager.revoke(img.src); });
        return { objectEditorImages: [] };
    }),
}
)); }

// ─────────────────────────────────────────────────────────────────────────────
// Registry & Proxy Hook
// ─────────────────────────────────────────────────────────────────────────────

// Initialize the default (single-tab) instance
_instances.set('default', createCanvasStoreInstance());

/**
 * Access or create per-tab canvas store instances.
 * Phase 1: only 'default' tab. Phase 2+: workspaceTabsStore drives multi-tab.
 */
export const canvasStoreRegistry = {
    get instances(): ReadonlyMap<string, _CanvasStoreApi> { return _instances; },

    createInstance(tabId: string): _CanvasStoreApi {
        if (!_instances.has(tabId)) {
            _instances.set(tabId, createCanvasStoreInstance());
        }
        return _instances.get(tabId)!;
    },

    getInstance(tabId: string): _CanvasStoreApi | undefined {
        return _instances.get(tabId);
    },

    getActiveInstance(): _CanvasStoreApi {
        return _instances.get(canvasTabRouter.getActiveTabId()) ?? _instances.get('default')!;
    },

    disposeInstance(tabId: string): void {
        if (tabId === 'default') return;
        const inst = _instances.get(tabId);
        if (inst) {
            inst.getState().clearCanvas();
            _instances.delete(tabId);
        }
        // Safety: prevent stale router reference after disposal
        if (_activeTabId === tabId) _activeTabId = '';
    },
};

// Selector identity fallback (avoids recreating function on each call)
const _identitySelector = (s: CanvasState & CanvasActions) => s;

/**
 * Proxy hook — drop-in replacement for the original zustand bound store.
 * Routes to the active tab's store instance; re-renders on tab switch.
 */
function _useCanvasProxy(): CanvasState & CanvasActions;
function _useCanvasProxy<T>(selector: (state: CanvasState & CanvasActions) => T): T;
function _useCanvasProxy<T = CanvasState & CanvasActions>(
    selector?: (state: CanvasState & CanvasActions) => T,
): T {
    // useSyncExternalStore subscription causes re-render when active tab changes
    const activeTabId = useSyncExternalStore(
        canvasTabRouter.subscribe,
        canvasTabRouter.getActiveTabId,
        canvasTabRouter.getActiveTabId,
    );
    const inst = _instances.get(activeTabId) ?? _instances.get('default')!;
    return useStore(inst, (selector ?? _identitySelector) as (s: CanvasState & CanvasActions) => T);
}

// Static methods to match original UseBoundStore API (used as useCanvasStore.getState(), etc.)
_useCanvasProxy.getState = (): CanvasState & CanvasActions =>
    canvasStoreRegistry.getActiveInstance().getState();

_useCanvasProxy.setState = (
    updater: Partial<CanvasState & CanvasActions> | ((s: CanvasState & CanvasActions) => Partial<CanvasState & CanvasActions>),
    replace?: boolean,
): void =>
    canvasStoreRegistry.getActiveInstance().setState(updater as any, replace as any);

_useCanvasProxy.subscribe = (
    listener: (state: CanvasState & CanvasActions, prev: CanvasState & CanvasActions) => void,
): () => void =>
    canvasStoreRegistry.getActiveInstance().subscribe(listener);

/**
 * useCanvasStore — use exactly as before.
 * Now routes to the active workspace tab's isolated canvas state.
 */
export const useCanvasStore = _useCanvasProxy as unknown as {
    (): CanvasState & CanvasActions;
    <T>(selector: (state: CanvasState & CanvasActions) => T): T;
    getState: () => CanvasState & CanvasActions;
    setState: (updater: any, replace?: boolean) => void;
    subscribe: (listener: (state: CanvasState & CanvasActions, prev: CanvasState & CanvasActions) => void) => () => void;
};
