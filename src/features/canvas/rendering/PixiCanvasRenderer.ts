import { Application, Container, Graphics, Texture, Rectangle, Assets, Sprite, DOMAdapter, TextureGCSystem } from 'pixi.js';
import 'pixi.js/ktx2';
import RBush from 'rbush';
import { TextureRegistry } from './TextureRegistry';
import { BoardImage, BoardGroup } from '../../../types';
import { REF_COLORS, ROLE_COLORS } from '../../../constants';
import type { ICanvasRenderer, InitPayload, MemoryStatus, CleanupPayload, RendererStatsTelemetry } from './ICanvasRenderer';
import { RenderScheduler } from './RenderScheduler';

// [STABILITY] Strictly disable PixiJS auto GC to prevent Use-After-Free crashes (_resourceId errors).
(TextureGCSystem as any).defaultMode = 'manual';

// [Tip] 트랜스코더 위치 지정 (오프라인/로컬 환경 지원)
Assets.init({
    preferences: {
        preferWorkers: true, // 워커 내에서 트랜스코딩 수행
        // [STABILITY FIX] Disable ImageBitmap - causes 10x VRAM bloat in Chromium
        // See: https://github.com/pixijs/pixijs/issues/11331
        preferCreateImageBitmap: false,
    },
    // KTX2 설정
    ktx2: {
        // 이미 프로젝트 내에 basis_transcoder가 있다면 그 경로를 지정
        transcoderUrl: 'assets/libs/basis_transcoder.js',
        transcoderWasm: 'assets/libs/basis_transcoder.wasm'
    }
} as any).catch(err => console.error('[Worker] Assets init failed:', err));

// ---- Module-level state (moved verbatim from rendering.worker.ts) ----

// Define global variables for the worker
let app: Application | undefined;
let isInitialized = false; // Guard: only true after app.init() completes successfully
const displayObjects = new Map<string, Container | Graphics>();
const stuckTextureTracker = new Map<string, number>(); // [NEW] Track images stuck on placeholder
const groupContainerMap = new Map<string, Container>(); // [NEW] Group containers for O(1) group movement
const recentlyDraggedGroups = new Set<string>(); // Track groups being actively dragged
let dragClearTimeout: ReturnType<typeof setTimeout> | null = null; // Timeout to clear drag tracking
let isPaused = false; // [VRAM] Low Spec Mode: pauses rendering and releases textures
// [VRAM] Saved canvas reference for app recreation after destroy
let savedCanvas: OffscreenCanvas | null = null;
let savedResolution: number = 1;
let savedWidth: number = 0;
let savedHeight: number = 0;

// [TextureRegistry] Single-responsibility texture lifecycle manager.
const registry = new TextureRegistry({
    maxBytes: 512 * 1024 * 1024, // default; updated after GPU detection via registry.setMaxBytes()
    onRequestResource: (src) => self.postMessage({ type: 'request-resource', payload: { id: src } }),
    onStaleIds: (ids) => self.postMessage({ type: 'clear-failed-ids', payload: { ids } }),
    getGreyPlaceholder: () => getGreyPlaceholder(),
});

// Grey placeholder texture for initial load (prevents flickering before any texture arrives)
let greyPlaceholderTexture: Texture | null = null;
const getGreyPlaceholder = (): Texture => {
    if (!greyPlaceholderTexture || (greyPlaceholderTexture as any).destroyed) {
        // Create a small grey canvas as placeholder
        const canvas = new OffscreenCanvas(4, 4);
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#333333';
            ctx.fillRect(0, 0, 4, 4);
        }
        greyPlaceholderTexture = Texture.from(canvas);
        if (greyPlaceholderTexture.source) {
            greyPlaceholderTexture.source.autoGenerateMipmaps = false;
        }
    }
    return greyPlaceholderTexture;
};

// Worker Local State
let workerState = {
    boardImages: [] as BoardImage[],
    boardGroups: [] as BoardGroup[],
    selectedImageIds: [] as string[],
    selectedGroupIds: [] as string[],
    groupEditModeId: null as string | null,
    marquee: null as any,
    pan: { x: 0, y: 0 },
    zoom: 1,
    lodZoom: 1, // Debounced zoom for LOD calculations
    isInteracting: false, // [INTERACTION LOCK] True during rapid zoom/pan
};

// [GRID] Infinite Grid Graphics
let gridGraphics: Graphics | null = null;
const GRID_SIZE = 50; // Base grid size in pixels
const GRID_COLOR = 0xFFFFFF; // White lines with very low opacity for refined look

// [3-Stage LOD] Settings synced from main thread
let workerSettings = {};

const lodUpdateQueue: BoardImage[] = []; // Queue for sequential LOD updates
// Dynamic batch size based on LOD tier (set during render loop)

// [SIMPLIFIED] Unload timers removed — LRU eviction in enforceTextureLimit handles all texture cleanup

// [Phase 3] Dynamic LOD tier based on screen-space image size
// Analogy: a postage stamp at arm's length doesn't need 4K resolution — TINY is enough.
interface LODResult { src: string; tier: 'TINY' | 'PREVIEW' | 'FULL' }

const getLODSource = (image: BoardImage, zoom: number, isSelected: boolean): LODResult => {
    const screenSize = Math.max(image.width, image.height) * zoom;

    // Below 128 screen-pixels: TINY thumbnail is sufficient
    if (screenSize < 96) {
        const src = image.tinySrc || (image as any).thumbnailSrc || image.proxySrc || image.src;
        return { src, tier: 'TINY' };
    }

    // Large AND selected: load full resolution for detail inspection
    if (isSelected && screenSize > 1024) {
        const src = image.ktx2Src || image.originalSrc || image.src;
        return { src, tier: 'FULL' };
    }

    // Default: PREVIEW (1K proxy)
    const src = image.previewSrc || image.proxySrc || image.src;
    return { src, tier: 'PREVIEW' };
};

// [Phase 2] Worker-side spatial index for O(log n) viewport queries
interface WorkerSpatialItem { minX: number; minY: number; maxX: number; maxY: number; id: string }
let workerSpatialIndex: RBush<WorkerSpatialItem> | null = null;
let boardImageById = new Map<string, BoardImage>();

const rebuildWorkerSpatialIndex = () => {
    const tree = new RBush<WorkerSpatialItem>();
    const items: WorkerSpatialItem[] = [];
    boardImageById = new Map();
    for (const img of workerState.boardImages) {
        items.push({ minX: img.x, minY: img.y, maxX: img.x + img.width, maxY: img.y + img.height, id: img.id });
        boardImageById.set(img.id, img);
    }
    tree.load(items);
    workerSpatialIndex = tree;
};

// Memory Management Constraints - Size-based LRU
// [PDCA Phase 3] Dynamic VRAM limit based on detected GPU
let MAX_TEXTURE_BYTES = 512 * 1024 * 1024; // Default 512MB VRAM limit (safe fallback)
let lastFrameTime = 0; // For FPS calculation

// [PDCA Phase 3] GPU VRAM Detection System
// Detects GPU capabilities and adjusts MAX_TEXTURE_BYTES accordingly
const detectGPUMemory = (gl: WebGL2RenderingContext | WebGLRenderingContext): number => {
    let estimatedVRAM = 0;

    try {
        // Method 1: WEBGL_debug_renderer_info extension (most reliable)
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
            const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
            console.log('[Worker] GPU Detected:', renderer);

            // Estimate VRAM based on known GPU models (approximate values in GB)
            const gpuVRAMMap: { [key: string]: number } = {
                // NVIDIA RTX 40 Series
                '4090': 24, '4080': 16, '4070': 12, '4060': 8,
                // NVIDIA RTX 30 Series
                '3090': 24, '3080': 10, '3070': 8, '3060': 12,
                // NVIDIA RTX 20 Series
                '2080': 8, '2070': 8, '2060': 6,
                // NVIDIA GTX 16 Series
                '1660': 6, '1650': 4,
                // NVIDIA GTX 10 Series
                '1080': 8, '1070': 8, '1060': 6, '1050': 4,
                // AMD RX 7000 Series
                '7900': 20, '7800': 16, '7700': 12, '7600': 8,
                // AMD RX 6000 Series
                '6900': 16, '6800': 16, '6700': 12, '6600': 8,
                // Intel Arc
                'A770': 16, 'A750': 8, 'A380': 6,
                // Integrated GPUs (conservative estimates)
                'Intel': 2, 'UHD': 2, 'Iris': 2, 'Mali': 1, 'Adreno': 1,
            };

            for (const [key, vram] of Object.entries(gpuVRAMMap)) {
                if (renderer.includes(key)) {
                    estimatedVRAM = vram * 1024 * 1024 * 1024; // Convert GB to bytes
                    break;
                }
            }
        }

        // Method 2: Fallback - estimate from max texture size
        if (estimatedVRAM === 0) {
            const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            // Rough heuristic: larger max texture size = more VRAM
            if (maxTextureSize >= 16384) {
                estimatedVRAM = 8 * 1024 * 1024 * 1024; // 8GB
            } else if (maxTextureSize >= 8192) {
                estimatedVRAM = 4 * 1024 * 1024 * 1024; // 4GB
            } else {
                estimatedVRAM = 2 * 1024 * 1024 * 1024; // 2GB
            }
        }
    } catch (e) {
        console.warn('[Worker] GPU detection failed:', e);
    }

    return estimatedVRAM;
};

// [PDCA Phase 3] Initialize VRAM limit based on detected GPU
const initVRAMLimit = (gl: WebGL2RenderingContext | WebGLRenderingContext): void => {
    const detectedVRAM = detectGPUMemory(gl);

    // Apply limits based on detected VRAM (from PDCA document)
    if (detectedVRAM <= 2 * 1024 * 1024 * 1024) {
        MAX_TEXTURE_BYTES = 384 * 1024 * 1024; // 384MB for ≤2GB VRAM
    } else if (detectedVRAM <= 4 * 1024 * 1024 * 1024) {
        MAX_TEXTURE_BYTES = 512 * 1024 * 1024; // 512MB for 2-4GB VRAM
    } else if (detectedVRAM <= 8 * 1024 * 1024 * 1024) {
        MAX_TEXTURE_BYTES = 1024 * 1024 * 1024; // 1GB for 4-8GB VRAM
    } else {
        MAX_TEXTURE_BYTES = 1536 * 1024 * 1024; // 1.5GB for 8GB+ VRAM
    }

    // Cap at 25% of detected VRAM (safety limit from PDCA)
    const maxByVRAMPercent = Math.floor(detectedVRAM * 0.25);
    if (maxByVRAMPercent > 0 && maxByVRAMPercent < MAX_TEXTURE_BYTES) {
        MAX_TEXTURE_BYTES = maxByVRAMPercent;
    }

    console.log(`[Worker] VRAM limit set to ${(MAX_TEXTURE_BYTES / 1024 / 1024).toFixed(0)}MB ` +
        `(detected VRAM: ${(detectedVRAM / 1024 / 1024 / 1024).toFixed(1)}GB)`);
};

// [PDCA Phase 2] Get current memory status for backpressure system
const getMemoryStatus = (): MemoryStatus => ({
    vramUsageMB: registry.getTotalBytes() / (1024 * 1024),
    vramLimitMB: MAX_TEXTURE_BYTES / (1024 * 1024),
    textureCount: registry.getCacheSize(),
    isUnderPressure: registry.isUnderPressure(),
});

// [SIMPLIFIED] Request tracking fully absorbed by TextureRegistry.
const getTexture = (src: string, tier?: 'TINY' | 'PREVIEW' | 'FULL'): Texture => {
    return registry.acquire(src, tier);
};

// Texture destruction is fully managed by TextureRegistry.

// [Improvement 3] Snapshot of active srcs at interaction start — protects textures
// visible before fast zoom/pan from being evicted during the interaction debounce window
let protectedDuringInteraction: Set<string> = new Set();

// [Improvement 3] Shared helper: compute visible image srcs without touching displayObjects.
// Used by reconcile(), evict-offscreen-textures, and evictIdlePreviews.
const buildActiveSrcs = (): Set<string> => {
    if (!app?.screen) return new Set();
    const zoom = workerState.zoom;
    const pan = workerState.pan;
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;
    const basePadding = Math.max(screenWidth, screenHeight);
    const rawMultiplier = zoom >= 1.2 ? 2.0
        : zoom >= 0.8 ? 0.5 + zoom * 1.5
            : Math.max(0.3, zoom * 2.0);
    const VISIBILITY_PADDING = basePadding * Math.min(2.0, rawMultiplier);
    const viewRect = {
        x: -pan.x / zoom - VISIBILITY_PADDING,
        y: -pan.y / zoom - VISIBILITY_PADDING,
        width: screenWidth / zoom + VISIBILITY_PADDING * 2,
        height: screenHeight / zoom + VISIBILITY_PADDING * 2,
    };
    const activeSrcs = new Set<string>();
    const selectedImageSet = new Set(workerState.selectedImageIds);

    // [Phase 2] Use spatial index for O(log n + k) viewport query instead of O(n)
    const vr = viewRect;
    const visibleImages = workerSpatialIndex
        ? workerSpatialIndex.search({ minX: vr.x, minY: vr.y, maxX: vr.x + vr.width, maxY: vr.y + vr.height })
            .map(item => boardImageById.get(item.id))
            .filter(Boolean) as BoardImage[]
        : workerState.boardImages.filter(i =>
            i.x < vr.x + vr.width && i.x + i.width > vr.x &&
            i.y < vr.y + vr.height && i.y + i.height > vr.y
        );

    for (const i of visibleImages) {
        // [Phase 3] LOD-based source selection (TINY/PREVIEW/FULL based on screen size)
        const isSelected = selectedImageSet.has(i.id);
        const { src: lodSrc } = getLODSource(i, zoom, isSelected);
        activeSrcs.add(lodSrc);

        // Always keep TINY cached as instant fallback to prevent flicker
        const tinySrc = i.tinySrc || (i as any).thumbnailSrc;
        if (tinySrc) activeSrcs.add(tinySrc);
    }
    return activeSrcs;
};

// Eviction fully absorbed by TextureRegistry.
const softMemoryManagement = (activeSrcs: Set<string>, extraProtected?: Set<string>) => {
    registry.softManage(activeSrcs, extraProtected);
};

// [FIX FLICK] Lightweight visibility-only update during interaction (pan/zoom).
// Unlike full reconcile(), this skips texture management, LOD changes, and memory cleanup.
// Only updates container.visible for sprites entering/leaving the viewport.
// O(n) but very cheap per-item (single AABB check + boolean set).
const _updateVisibilityDuringInteraction = () => {
    if (!app || !app.stage || !app.screen) return;
    const zoom = workerState.zoom;
    const pan = workerState.pan;
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;
    // Use a moderate padding to avoid pop-in during fast panning
    const basePadding = Math.max(screenWidth, screenHeight);
    const VISIBILITY_PADDING = basePadding * 0.5;
    const viewRect = {
        x: -pan.x / zoom - VISIBILITY_PADDING,
        y: -pan.y / zoom - VISIBILITY_PADDING,
        width: screenWidth / zoom + VISIBILITY_PADDING * 2,
        height: screenHeight / zoom + VISIBILITY_PADDING * 2,
    };

    for (const img of workerState.boardImages) {
        const container = displayObjects.get(img.id) as Container;
        if (!container) continue;
        const isVisible = (
            img.x < viewRect.x + viewRect.width &&
            img.x + img.width > viewRect.x &&
            img.y < viewRect.y + viewRect.height &&
            img.y + img.height > viewRect.y
        );
        container.visible = isVisible;
    }
};

// Removes display objects for items that no longer exist
const reconcile = () => {
    if (!app || !app.stage || !app.renderer || !app.screen) return;

    // [INTERACTION LOCK] Skip heavy reconciliation during rapid interaction
    // We only update transforms (in update-viewport) to keep FPS high
    if (workerState.isInteracting) {
        // console.log('[Worker] Reconcile skipped due to interaction');
        return;
    }
    const currentIds = new Set([
        ...workerState.boardImages.map(i => i.id),
        ...workerState.boardGroups.map(g => g.id)
    ]);

    for (const id of displayObjects.keys()) {
        if (!currentIds.has(id)) {
            const obj = displayObjects.get(id);
            if (obj) {
                app.stage.removeChild(obj);
                obj.destroy({ children: true, texture: false });
            }
            displayObjects.delete(id);
            // Release ref-count — registry eviction will clean up the texture when VRAM is tight
            registry.unbind(id);
        }
    }


    // Smart Culling Logic:
    // 1. Calculations for VISIBILITY only (hide off-screen items to save GPU)
    const zoom = workerState.zoom;
    const pan = workerState.pan;
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;

    // [CRITICAL FIX] Dynamic Visibility Padding based on zoom level
    // At high zoom (1.0+): large padding (2.0x) for smooth panning
    // At low zoom (0.2): reduced padding (0.5x) to prevent GPU overload
    const basePadding = Math.max(screenWidth, screenHeight);
    // 0.8~1.2 구간에서 완만한 전환으로 zoom=1.0 경계 급변 제거
    const rawMultiplier = zoom >= 1.2 ? 2.0
        : zoom >= 0.8 ? 0.5 + zoom * 1.5
            : Math.max(0.3, zoom * 2.0);
    const paddingMultiplier = Math.min(2.0, rawMultiplier);
    const VISIBILITY_PADDING = basePadding * paddingMultiplier;

    const viewRect = {
        x: -pan.x / zoom - VISIBILITY_PADDING,
        y: -pan.y / zoom - VISIBILITY_PADDING,
        width: screenWidth / zoom + (VISIBILITY_PADDING * 2),
        height: screenHeight / zoom + (VISIBILITY_PADDING * 2)
    };

    // 2. Active Sources Set (Visible Items Only)
    const activeSrcs = new Set<string>();

    // [PERF] O(1) lookup for selected images (was O(n) with includes)
    const selectedImageSet = new Set(workerState.selectedImageIds);

    workerState.boardImages.forEach(i => {
        let container = displayObjects.get(i.id) as Container;

        // Determine target parent: group container or stage
        const groupContainer = i.groupId ? groupContainerMap.get(i.groupId) : null;
        const targetParent = groupContainer || app!.stage;

        if (!container) {
            const proxySprite = new Sprite(Texture.EMPTY);
            const border = new Graphics();
            container = new Container();
            // [Phase 5.1] Let PixiJS cull at GPU level instead of just hiding
            container.cullable = true;
            container.addChild(proxySprite, border);
            displayObjects.set(i.id, container);
            targetParent.addChild(container);
        } else if (container.parent !== targetParent) {
            // Reparent if needed (image moved to/from group)
            targetParent.addChild(container);
        }

        // Simple viewport visibility check (still needed for texture load decisions)
        const isVisible = (
            i.x < viewRect.x + viewRect.width &&
            i.x + i.width > viewRect.x &&
            i.y < viewRect.y + viewRect.height &&
            i.y + i.height > viewRect.y
        );

        const isSelected = selectedImageSet.has(i.id);

        if (container) {
            // [Phase 5.1] PixiJS cullable handles GPU-level culling automatically.
            // Still set visible=false for fully out-of-viewport containers to prevent
            // hit-test and event propagation overhead.
            container.visible = isVisible;
        }

        if (isVisible) {
            // [3-Stage LOD] Track active sources for memory management
            // Always keep preview (1K) in cache, optionally keep high-res
            const previewSrc = i.previewSrc || i.proxySrc || i.src;
            activeSrcs.add(previewSrc);

            let targetSrc: string;

            if (isSelected) {
                // Selected images: track original/ktx2
                targetSrc = i.ktx2Src || i.originalSrc || i.src;
            } else {
                // Default: track preview (1K)
                targetSrc = previewSrc;
            }

            if (targetSrc !== previewSrc) {
                activeSrcs.add(targetSrc);
            }
        }
    });

    // [SIMPLIFIED] Single cleanup path: soft memory management (LRU + request cancellation)
    // [Improvement 3] Pass interaction-time snapshot as extra protection for one cycle
    const postProtected = protectedDuringInteraction.size > 0 ? protectedDuringInteraction : undefined;
    softMemoryManagement(activeSrcs, postProtected);
    if (postProtected) protectedDuringInteraction = new Set(); // One-shot: clear after use

};

// Updates or creates display objects based on current state
const updateContent = () => {
    if (!app || !app.stage) return;

    const zoom = workerState.zoom;
    // [Phase 3] O(1) selected image lookup for LOD tier (FULL for large selected images)
    const selectedSet = new Set(workerState.selectedImageIds);

    // 1. Handle Groups - Create/Update group containers and background graphics
    // Remove old group containers that no longer exist
    const currentGroupIds = new Set(workerState.boardGroups.map(g => g.id));
    for (const [groupId, container] of groupContainerMap.entries()) {
        if (!currentGroupIds.has(groupId)) {
            // Move children back to stage before removing
            while (container.children.length > 0) {
                const child = container.children[0];
                app!.stage.addChild(child);
            }
            app!.stage.removeChild(container);
            groupContainerMap.delete(groupId);
        }
    }

    workerState.boardGroups.forEach(group => {
        // Create/get group container (holds images for O(1) movement)
        let groupContainer = groupContainerMap.get(group.id);
        if (!groupContainer) {
            groupContainer = new Container();
            groupContainer.sortableChildren = true;
            groupContainerMap.set(group.id, groupContainer);
            app!.stage.addChild(groupContainer);
        }
        // Always sync container position from workerState.boardGroups
        groupContainer.position.set(group.x, group.y);
        groupContainer.zIndex = group.zIndex;

        // Create/get background graphics (visual only)
        let graphics = displayObjects.get(group.id) as Graphics;
        if (!graphics) {
            graphics = new Graphics();
            displayObjects.set(group.id, graphics);
            groupContainer.addChild(graphics);
        } else if (graphics.parent !== groupContainer) {
            groupContainer.addChild(graphics);
        }

        const isSelected = workerState.selectedGroupIds.includes(group.id);
        const isInEditMode = workerState.groupEditModeId === group.id;
        const isSuspended = !!workerState.groupEditModeId && !isInEditMode;
        drawGroup(graphics, group, isSelected, isInEditMode, isSuspended);
        graphics.position.set(0, 0); // Graphics is at (0,0) relative to container
        graphics.zIndex = -1; // Behind images
    });

    // 2. Handle Images - Place in group containers or directly on stage
    workerState.boardImages.forEach(image => {
        let container = displayObjects.get(image.id) as Container;
        let proxySprite: Sprite;
        let border: Graphics;

        // Determine target parent: group container or stage
        const groupContainer = image.groupId ? groupContainerMap.get(image.groupId) : null;
        const targetParent = groupContainer || app!.stage;

        if (!container) {
            container = new Container();
            proxySprite = new Sprite(Texture.EMPTY);
            border = new Graphics();

            container.addChild(proxySprite, border);
            displayObjects.set(image.id, container);
            targetParent.addChild(container);
        } else {
            proxySprite = container.children[0] as Sprite;
            border = container.children[1] as Graphics;

            // Reparent if needed (image moved to/from group)
            if (container.parent !== targetParent) {
                targetParent.addChild(container);
            }
        }

        // [CRITICAL] "Hold Until Ready" - Never let a visible sprite be blank
        // If target texture isn't ready, immediately use TINY fallback (always cached)
        // [FIX] Also re-check when showing grey placeholder: texture may have loaded while container was hidden
        if (proxySprite.texture === Texture.EMPTY || (proxySprite.texture as any).destroyed || proxySprite.texture === greyPlaceholderTexture) {
            // [Phase 3] Use zoom-based LOD instead of always PREVIEW
            const { src: targetSrc, tier } = getLODSource(image, zoom, selectedSet.has(image.id));
            const texture = getTexture(targetSrc, tier);

            if (texture !== Texture.EMPTY && !(texture as any).destroyed) {
                proxySprite.texture = texture;
                registry.bind(image.id, texture);
            } else {
                // FALLBACK 1: Use TINY texture immediately (request via getTexture for proper destroyed handling)
                const tinySrc = image.tinySrc || image.thumbnailSrc || image.proxySrc || image.src;
                const tinyTexture = getTexture(tinySrc, 'TINY');
                if (tinyTexture !== Texture.EMPTY && !(tinyTexture as any).destroyed) {
                    proxySprite.texture = tinyTexture;
                    registry.bind(image.id, tinyTexture);
                } else {
                    // FALLBACK 2: Use grey placeholder (prevents blank/flickering during initial load)
                    proxySprite.texture = getGreyPlaceholder();
                    registry.unbind(image.id);
                }
            }
        }

        // [FIX] Queue LOD updates if we are not at the desired quality
        // This was missing, causing images to stick at low resolution
        if (proxySprite.texture && proxySprite.texture !== Texture.EMPTY && proxySprite.texture !== getGreyPlaceholder()) {
            // [Phase 3] Use zoom-based LOD for upgrade check too
            const { src: targetSrc } = getLODSource(image, zoom, selectedSet.has(image.id));

            // Only queue if we have the target texture cached (fast switch)
            // OR if we need to request it (handled by processLODQueue)
            // AND we are not already displaying it
            const cachedTexture = registry.getTexture(targetSrc);
            const isTargetLoaded = cachedTexture && !(cachedTexture as any).destroyed;

            // If target is loaded but not displayed, apply immediately (fast path)
            if (isTargetLoaded && proxySprite.texture !== cachedTexture) {
                proxySprite.texture = cachedTexture;
                registry.bind(image.id, cachedTexture);
            } else if (!isTargetLoaded && targetSrc !== image.tinySrc) {
                // If not loaded and we want high res, push to queue (gradual loading)
                // But only if we aren't already queued
                if (!lodUpdateQueue.includes(image)) {
                    lodUpdateQueue.push(image);
                    // Trigger render loop to process queue
                    requestRender();
                }
            }
        }

        // NOTE: Dynamic LOD switching is now handled in processLODQueue (render loop)
        // We do NOT swap textures here anymore (except fast path above) to prevent lag spikes on zoom.

        proxySprite.anchor.set(0);
        proxySprite.width = Math.round(image.width);
        proxySprite.height = Math.round(image.height);

        proxySprite.anchor.set(0);
        proxySprite.position.set(0, 0);

        // [CRITICAL] Position calculation: relative if in group, absolute otherwise
        // Use groupContainer.position as source of truth (it's updated by update-group-position during drag)
        if (groupContainer) {
            // Relative to group container's actual position (NOT workerState.boardGroups which may be stale)
            const relX = image.x - groupContainer.position.x;
            const relY = image.y - groupContainer.position.y;
            container.position.set(Math.round(relX), Math.round(relY));
        } else {
            // Absolute position on stage
            container.position.set(Math.round(image.x), Math.round(image.y));
        }

        // [FIX FLIP] Handle flipping AFTER position is set — previously the offset was
        // applied before position.set() which overwrote it, causing the flipped image
        // to render at the wrong position (shifted left by image.width).
        if (image.scaleX === -1) {
            container.scale.x = -1;
            container.position.x += image.width;
        } else {
            container.scale.x = 1;
        }

        container.zIndex = image.zIndex;
        container.pivot.set(0, 0);

        const isInEditMode = !!workerState.groupEditModeId;
        const isPartOfEditingGroup = image.groupId === workerState.groupEditModeId;
        container.alpha = (isInEditMode && !isPartOfEditingGroup) ? 0.3 : 1;

        const hasRole = image.role !== 'none';
        if (hasRole) {
            border.clear();
            const outlineWidth = 5; // Fixed border thickness (like thumbnails)
            let colorStr = '#FFFFFF';
            switch (image.role) {
                case 'original':
                    colorStr = ROLE_COLORS.original;
                    break;
                case 'background':
                    colorStr = ROLE_COLORS.background;
                    break;
                case 'pose':
                    colorStr = ROLE_COLORS.pose;
                    break;
                case 'generalRef':
                    colorStr = ROLE_COLORS.generalRef;
                    break;
                case 'costumeRef':
                    colorStr = ROLE_COLORS.costumeRef;
                    break;
                case 'poseRef':
                    colorStr = ROLE_COLORS.poseRef;
                    break;
                case 'reference':
                    // Legacy reference role with referenceType
                    if (image.referenceType === 'costume') {
                        colorStr = ROLE_COLORS.costumeRef;
                    } else if (image.referenceType === 'pose') {
                        colorStr = ROLE_COLORS.poseRef;
                    } else if (image.referenceType === 'general') {
                        colorStr = ROLE_COLORS.generalRef;
                    } else if (image.refIndex !== undefined) {
                        colorStr = REF_COLORS[image.refIndex % REF_COLORS.length];
                    }
                    break;
            }

            const color = parseInt(colorStr.slice(1), 16);
            border.rect(0, 0, image.width, image.height).stroke({ width: outlineWidth, color: color, alpha: 1 });
        } else {
            border.clear();
        }
    });

    // 3. Draw Overlays
    let overlayGraphics = app.stage.getChildByLabel('overlays') as Graphics;
    if (!overlayGraphics) {
        overlayGraphics = new Graphics();
        overlayGraphics.label = 'overlays';
        overlayGraphics.zIndex = 99999;
        app.stage.addChild(overlayGraphics);
    }
    overlayGraphics.clear();

    app.stage.sortChildren();

    // [REMOVED] Stress detection removed - using soft memory management instead
    lastFrameTime = Date.now();
};

const drawGroup = (graphics: Graphics, group: BoardGroup, isSelected: boolean, isInEditMode: boolean, isSuspended: boolean) => {
    graphics.clear();
    if (isSuspended) {
        graphics.roundRect(0, 0, group.width, group.height, 8)
            .fill({ color: 0x000000, alpha: 0.5 })
            .stroke({ width: 1, color: 0x555555, alpha: 1 });
    } else if (isInEditMode) {
        graphics.roundRect(0, 0, group.width, group.height, 8)
            .fill({ color: 0x1a1a1a, alpha: 0.8 })
            .stroke({ width: 3, color: 0x00AAFF, alpha: 1 });
    } else {
        graphics.roundRect(0, 0, group.width, group.height, 8)
            .fill({ color: 0x222222, alpha: 0.8 })
            .stroke({ width: isSelected ? 3 : 1, color: isSelected ? 0xFFFFFF : 0x444444, alpha: 1 });
    }
};

// ---- Named handler functions (extracted from self.onmessage cases) ----

const _handleInit = async (payload: InitPayload): Promise<void> => {
    console.log('[Worker] Init received', payload);
    const { canvas } = payload;

    try {
        const width = Math.floor(payload.width);
        const height = Math.floor(payload.height);
        const res = payload.resolution || 1;

        // [VRAM] Save canvas reference for recreation
        savedCanvas = canvas;
        savedResolution = res;
        savedWidth = width;
        savedHeight = height;

        app = new Application();

        // [STEP 5] WebGPU activation gate — default 'webgl' for production stability.
        // Set enableWebGPU=true via DevTools to enable WebGPU for measurement.
        const requestedPreference: 'webgl' | 'webgpu' = payload.enableWebGPU === true ? 'webgpu' : 'webgl';
        try {
            await app.init({
                canvas: canvas,
                width: width,
                height: height,
                resolution: res,
                backgroundAlpha: 0,
                antialias: true,
                autoDensity: true,
                preference: requestedPreference, // PixiJS auto-falls-back to WebGL if WebGPU unavailable
                preferWebGLVersion: 2,
                powerPreference: 'high-performance',
            });
        } catch (e) {
            console.error(`[Worker] ❌ Renderer init failed (requested: ${requestedPreference}):`, e);
            self.postMessage({ type: 'init-failed', error: (e as Error).message });
            return;
        }
        const rendererName = (app.renderer as any)?.constructor?.name ?? 'Unknown';
        const actualType: 'webgl' | 'webgpu' = rendererName.toLowerCase().includes('gpu') ? 'webgpu' : 'webgl';
        console.log(`[Worker] ✅ ${actualType.toUpperCase()} renderer initialized (requested: ${requestedPreference}, class: ${rendererName})`);
        self.postMessage({ type: 'renderer-info', payload: { type: actualType, requested: requestedPreference, rendererName } });

        // ✅ Enable Native Texture GC - PixiJS safely manages VRAM
        if (app.renderer.textureGC) {
            // @ts-ignore - Runtime configuration for TextureGCSystem
            app.renderer.textureGC.mode = 'manual'; // [CRITICAL] Disable auto GC to prevent _resourceId crashes
            // @ts-ignore
            app.renderer.textureGC.maxIdle = 60000; // 60s idle (Return to safe default)
            // @ts-ignore
            app.renderer.textureGC.checkCountMax = Number.MAX_SAFE_INTEGER; // [FIX] Effectively disable Auto GC to prevent race conditions
            console.log('[Worker] PixiJS TextureGC enabled: MANUAL mode (Prevents crash)');
        }

        app.stage.sortableChildren = true;

        // [Phase 4] WebGL Context Loss Recovery
        const gl = (app.renderer as any).gl as WebGLRenderingContext;
        if (gl && gl.canvas) {
            gl.canvas.addEventListener('webglcontextlost', (e: Event) => {
                e.preventDefault();
                console.warn('[Worker] WebGL context LOST - pausing render');
                isInitialized = false;
                self.postMessage({ type: 'render-crash' });
            }, false);

            gl.canvas.addEventListener('webglcontextrestored', () => {
                console.log('[Worker] WebGL context RESTORED - reinitializing');
                // Clear all texture caches - textures are invalid after context loss
                registry.clear();
                greyPlaceholderTexture = null;

                isInitialized = true;
                updateSceneGraph();
                reconcile();
                requestRender();
            }, false);
        }

        // [PDCA Phase 3] Initialize dynamic VRAM limit based on detected GPU
        if (gl) {
            initVRAMLimit(gl);
            registry.setMaxBytes(MAX_TEXTURE_BYTES);
        }

        // Mark as fully initialized - now safe to process other messages
        isInitialized = true;

        updateSceneGraph();
        requestRender();
    } catch (e) {
        console.error('[Worker] PIXI Init Failed:', e);
    }
};

const _handleAddResource = (id: string, bitmap: any): void => {
    try {
        let textureSource = bitmap;
        const MAX_TEXTURE_SIZE_PX = 4096; // Increased to 4K to support high-res
        let finalWidth = bitmap.width;
        let finalHeight = bitmap.height;

        // Enforce 2K Limit: Downscale if larger
        if (bitmap.width > MAX_TEXTURE_SIZE_PX || bitmap.height > MAX_TEXTURE_SIZE_PX) {
            const scale = MAX_TEXTURE_SIZE_PX / Math.max(bitmap.width, bitmap.height);
            finalWidth = Math.floor(bitmap.width * scale);
            finalHeight = Math.floor(bitmap.height * scale);

            const canvas = new OffscreenCanvas(finalWidth, finalHeight);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(bitmap, 0, 0, finalWidth, finalHeight);
                textureSource = canvas;

                // Free the original large bitmap immediately (already drawn to canvas)
                if (bitmap.close) bitmap.close();
            }
        }

        const texture = Texture.from(textureSource);

        // [VRAM OPTIMIZATION] Disable mipmaps to save ~33% texture memory
        if (texture.source) {
            texture.source.autoGenerateMipmaps = false;
        }

        // [FIX VRAM] Release OffscreenCanvas backing store after GPU upload
        // Once Texture.from() is called, the GPU has the data; zeroing the canvas
        // releases the CPU-side pixel buffer (~4MB for 1024px image)
        if (textureSource instanceof OffscreenCanvas) {
            textureSource.width = 0;
            textureSource.height = 0;
        }

        // Track texture byte size (RGBA = 4 bytes per pixel, no mipmaps)
        const byteSize = finalWidth * finalHeight * 4;

        // [TextureRegistry] Register texture — tracks cache, byte size, timestamps
        registry.registerTexture(id, texture, byteSize);

        // [ROLLBACK GPU-2] bitmap.close()는 WebGPU 비동기 업로드와 충돌
        // PixiJS WebGPU 렌더러가 copyExternalImageToTexture 완료 전에 bitmap이 detached됨
        // → InvalidStateError: External image has been detached
        // ImageBitmap은 PixiJS TextureGC가 자연스럽게 정리하도록 유지

        // [FIX] Immediately update any visible sprites waiting for this texture
        // Find images that use this src and update their sprites
        workerState.boardImages.forEach(img => {
            if (img.src === id || img.proxySrc === id || img.tinySrc === id || img.previewSrc === id || img.originalSrc === id) {
                const container = displayObjects.get(img.id) as Container;
                if (container && container.visible && container.children.length > 0) {
                    const sprite = container.children[0] as Sprite;
                    // Only update if sprite is showing placeholder or destroyed texture
                    if (!sprite.texture ||
                        sprite.texture === Texture.EMPTY ||
                        sprite.texture === greyPlaceholderTexture ||
                        (sprite.texture as any).destroyed) {
                        sprite.texture = texture;
                        registry.bind(img.id, texture);
                    }
                }
            }
        });

        // [FIX] Use updateSceneGraph instead of reconcile - reconcile skips if isInteracting is true
        updateSceneGraph();
        requestRender();
    } catch (e) {
        console.error('[Worker] Failed to create texture', e);
    }
};

const _handleAddCompressedResource = (id: string, buffer: ArrayBuffer, mimeType: string): void => {
    try {
        // Create Blob URL for PixiJS to load
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Load using PixiJS Assets (handles KTX2 parsing)
        Assets.load(url).then((texture) => {
            URL.revokeObjectURL(url); // Clean up URL

            if (!texture) throw new Error('KTX2 Load Failed');

            // [VRAM] KTX2 has explicit mipmaps or none, but we disable auto-gen just in case
            if (texture.source) {
                texture.source.autoGenerateMipmaps = false;
            }

            // KTX2는 GPU에서 압축 포맷으로 저장 → RGBA 대비 약 1/4 크기
            const byteSize = texture.width * texture.height * 1;

            // [TextureRegistry] Register texture
            registry.registerTexture(id, texture, byteSize);

            console.log(`[KTX2] 🎨 GPU Texture Ready: ${id} (${texture.width}x${texture.height}, ~${(byteSize / 1024).toFixed(1)} KB VRAM)`);

            // Update visible sprites
            workerState.boardImages.forEach(img => {
                if (img.ktx2Src === id) {
                    const container = displayObjects.get(img.id) as Container;
                    if (container && container.visible && container.children.length > 0) {
                        const sprite = container.children[0] as Sprite;
                        sprite.texture = texture;
                        registry.bind(img.id, texture);
                    }
                }
            });

            // [FIX] Use updateSceneGraph instead of reconcile - reconcile skips if isInteracting is true
            updateSceneGraph();
            requestRender();
        }).catch(err => {
            console.error('[Worker] Failed to load KTX2:', err);
            URL.revokeObjectURL(url); // [FIX] Prevent blob URL leak on error
            registry.cancelRequest(id); // Allow retry
        });

    } catch (e) {
        console.error('[Worker] Error handling KTX2:', e);
    }
};

const _handleApplyPatch = (patch: any): void => {
    switch (patch.kind) {
        case 'full': {
            // [FIX STALE-LOD] Clear stale image refs from LOD queue — they hold old src URLs
            lodUpdateQueue.length = 0;
            // Preserve container positions for actively dragged groups
            workerState.boardGroups = patch.boardGroups.map((group: BoardGroup) => {
                if (recentlyDraggedGroups.has(group.id)) {
                    const existingContainer = groupContainerMap.get(group.id);
                    if (existingContainer) {
                        return { ...group, x: existingContainer.position.x, y: existingContainer.position.y };
                    }
                }
                return group;
            });
            workerState.boardImages = patch.boardImages;
            if (!isInitialized) break;
            rebuildWorkerSpatialIndex();
            reconcile();
            updateSceneGraph();
            requestRender();
            break;
        }
        case 'delta': {
            if (!isInitialized) break;
            const { added, changed, removed, boardGroups } = patch;
            if ((added?.length > 0) || (changed?.length > 0) || (removed?.length > 0)) {
                lodUpdateQueue.length = 0;
            }
            if (removed?.length > 0) {
                const removedSet = new Set(removed as string[]);
                workerState.boardImages = workerState.boardImages.filter(img => !removedSet.has(img.id));
            }
            if (added?.length > 0) {
                workerState.boardImages = [...workerState.boardImages, ...added];
            }
            if (changed?.length > 0) {
                const changedMap = new Map((changed as BoardImage[]).map(img => [img.id, img]));
                workerState.boardImages = workerState.boardImages.map(img => {
                    const update = changedMap.get(img.id);
                    return update ? { ...img, ...update } : img;
                });
            }
            if (boardGroups) workerState.boardGroups = boardGroups;
            rebuildWorkerSpatialIndex();
            reconcile();
            updateSceneGraph();
            requestRender();
            break;
        }
        case 'selection': {
            if (!isInitialized) break;
            const { selectedImageIds, selectedGroupIds, groupEditModeId, marquee } = patch;
            Object.assign(workerState, { selectedImageIds, selectedGroupIds, groupEditModeId, marquee });
            updateSceneGraph();
            requestRender();
            break;
        }
        case 'viewport': {
            workerState.pan = patch.pan;
            workerState.zoom = patch.zoom;
            if (!workerState.isInteracting && isInitialized && app?.screen) {
                protectedDuringInteraction = buildActiveSrcs();
            }
            workerState.isInteracting = true;
            if (!isInitialized || !app?.screen) break;
            app.stage.position.set(patch.pan.x, patch.pan.y);
            app.stage.scale.set(patch.zoom, patch.zoom);
            drawGrid();
            // [FIX FLICK] Lightweight visibility update during interaction.
            // Full reconcile() is skipped when isInteracting=true (to avoid texture churn),
            // but we still need to show/hide sprites entering/leaving the viewport
            // for smooth flick panning with many images.
            _updateVisibilityDuringInteraction();
            scheduler.notifyInteraction();
            break;
        }
        case 'transform': {
            const { id, x, y, groupId } = patch;
            const img = workerState.boardImages.find(i => i.id === id);
            if (img) {
                img.x = x;
                img.y = y;
                const container = displayObjects.get(id) as Container;
                if (container) {
                    let posX: number;
                    let posY: number;
                    if (groupId) {
                        const group = workerState.boardGroups.find(g => g.id === groupId);
                        if (group) {
                            posX = Math.round(x - group.x);
                            posY = Math.round(y - group.y);
                        } else {
                            posX = Math.round(x);
                            posY = Math.round(y);
                        }
                    } else {
                        posX = Math.round(x);
                        posY = Math.round(y);
                    }
                    container.position.set(posX, posY);
                    // [FIX FLIP FLICKER] Apply scaleX offset for flipped images,
                    // matching the logic in updateContent(). Without this, flipped
                    // images flicker between offset and non-offset positions during drag.
                    if (img.scaleX === -1) {
                        container.scale.x = -1;
                        container.position.x += img.width;
                    } else {
                        container.scale.x = 1;
                    }
                    requestRender();
                }
            }
            break;
        }
        case 'group-transform': {
            const { groupId, x, y } = patch;
            const groupContainer = groupContainerMap.get(groupId);
            if (groupContainer) {
                recentlyDraggedGroups.add(groupId);
                if (dragClearTimeout) clearTimeout(dragClearTimeout);
                dragClearTimeout = setTimeout(() => recentlyDraggedGroups.clear(), 200);
                const oldX = groupContainer.position.x;
                const oldY = groupContainer.position.y;
                const dx = x - oldX;
                const dy = y - oldY;
                groupContainer.position.set(x, y);
                const group = workerState.boardGroups.find(g => g.id === groupId);
                if (group) { group.x = x; group.y = y; }
                workerState.boardImages.forEach(img => {
                    if (img.groupId === groupId) { img.x += dx; img.y += dy; }
                });
                requestRender();
            }
            break;
        }
    }
};

const _handlePauseRendering = (): void => {
    console.log('[Worker] Pausing PixiJS rendering for VRAM optimization');
    isPaused = true;
    registry.setPaused(true);
    isInitialized = false; // Prevent any rendering attempts

    // STOP the ticker FIRST to prevent any rendering
    if (app && app.ticker) {
        app.ticker.stop();
        console.log('[Worker] Ticker stopped');
    }

    // Detach all sprites and release ref-counts BEFORE destroying textures
    for (const [id, obj] of displayObjects.entries()) {
        if (obj instanceof Container && obj.children.length > 0) {
            const sprite = obj.children[0] as Sprite;
            if (sprite) {
                sprite.texture = Texture.EMPTY;
                registry.unbind(id); // [FIX D] release ref-count so bindCount reaches 0
            }
        }
    }

    // Destroy all GPU textures immediately to free VRAM, then reset registry state
    registry.destroyAllTextures();
    stuckTextureTracker.clear();

    // Destroy grey placeholder
    if (greyPlaceholderTexture && !(greyPlaceholderTexture as any).destroyed) {
        try {
            greyPlaceholderTexture.destroy(true);
        } catch (e) { }
        greyPlaceholderTexture = null;
    }

    // Force PixiJS GC to free GPU memory
    if (app?.renderer?.textureGC) {
        try {
            (app.renderer.textureGC as any).run();
        } catch (e) { }
    }

    console.log('[Worker] All textures destroyed, VRAM should decrease');
    // [FIX RC-5] pause 완료 ACK 전송 — Main Thread가 안전하게 resume 가능
    self.postMessage({ type: 'pause-complete' });
};

const _handleResumeRendering = (): void => {
    console.log('[Worker] Resuming PixiJS rendering');
    isPaused = false;
    registry.setPaused(false);
    registry.clearPendingRequests();
    stuckTextureTracker.clear();

    // Reset grey placeholder
    greyPlaceholderTexture = null;

    // Start ticker
    if (app && app.ticker && !app.ticker.started) {
        app.ticker.start();
        console.log('[Worker] Ticker restarted');
    }

    // Mark as initialized
    isInitialized = true;

    // Force immediate re-sync to reload textures
    updateSceneGraph();
    reconcile();
    requestRender();

    console.log('[Worker] PixiJS rendering resumed');
};

const _handleCleanupUnusedTextures = (payload: CleanupPayload): void => {
    const { activeImageIds, activeSrcs: mainThreadActiveSrcs, aggressive } = payload;
    const activeIdSet = new Set(activeImageIds || []);

    // [SAFETY] If no active IDs provided and aggressive mode, skip cleanup
    // This prevents accidentally deleting ALL textures
    if (activeIdSet.size === 0 && aggressive) {
        console.warn('[Worker] Aggressive cleanup skipped - no activeImageIds provided (safety)');
        return;
    }

    console.log(`[Worker] Cleanup unused textures - active: ${activeIdSet.size}, cached: ${registry.getCacheSize()}, aggressive: ${!!aggressive}`);

    // [FIX RC-6] Main Thread에서 전달한 activeSrcs를 우선 사용 (상태 불일치 방지)
    const activeSrcs = new Set<string>(mainThreadActiveSrcs || []);

    // Fallback: workerState 기반 구성
    if (activeSrcs.size === 0) {
        workerState.boardImages.forEach(img => {
            if (activeIdSet.has(img.id)) {
                if (img.src) activeSrcs.add(img.src);
                if (img.proxySrc) activeSrcs.add(img.proxySrc);
                if (img.previewSrc) activeSrcs.add(img.previewSrc);
                if (img.tinySrc) activeSrcs.add(img.tinySrc);
                if (img.originalSrc) activeSrcs.add(img.originalSrc);
                if (img.ktx2Src) activeSrcs.add(img.ktx2Src);
            }
        });
    }

    // Clear stuck tracker for removed images
    for (const imageId of stuckTextureTracker.keys()) {
        if (!activeIdSet.has(imageId)) {
            stuckTextureTracker.delete(imageId);
        }
    }

    // registry.enforceLimit() handles deferred destruction (ref-count + LRU)
    registry.enforceLimit(activeSrcs);
    if (aggressive) {
        // Aggressive: force second pass to push VRAM to 50% of limit
        registry.enforceLimit(activeSrcs);
    }

    console.log(`[Worker] Cleanup scheduled via registry (${registry.getPendingDestroyCount()} queued)`);

    requestRender();
};

const _handleEvictOffscreenTextures = (nonce: any): void => {
    const viewportSrcSet = buildActiveSrcs();
    const beforeBytes = registry.getTotalBytes();
    registry.evictIdlePreviews(viewportSrcSet);
    registry.enforceLimit(viewportSrcSet);
    const freedBytes = Math.max(0, beforeBytes - registry.getTotalBytes());
    console.log(`[Worker] evict-offscreen: ~${(freedBytes / 1024 / 1024).toFixed(1)}MB VRAM freed`);
    self.postMessage({ type: 'evict-complete', data: { freedMB: freedBytes / 1024 / 1024, evictedCount: registry.getPendingDestroyCount(), nonce } });
    requestRender();
};

// ---- Render loop (RenderScheduler-based) ----

const _processLODBatch = (): boolean => {
    if (lodUpdateQueue.length === 0) return false;

    // [Phase 3] 20 per frame — uses getLODSource for zoom-aware tier selection
    const batch = lodUpdateQueue.splice(0, 20);
    const currentZoom = workerState.zoom;

    batch.forEach(image => {
        const container = displayObjects.get(image.id) as Container;
        if (container && container.children.length > 0) {
            const proxySprite = container.children[0] as Sprite;

            const { src: targetSrc, tier: targetTier } = getLODSource(image, currentZoom, workerState.selectedImageIds.includes(image.id));
            const texture = getTexture(targetSrc, targetTier);

            // Safety check: use TINY fallback instead of EMPTY to prevent blank flash
            if (proxySprite.texture && (proxySprite.texture as any).destroyed) {
                const tinySrc = image.tinySrc || image.thumbnailSrc || image.src;
                const tinyTex = registry.getTexture(tinySrc);
                if (tinyTex && !(tinyTex as any).destroyed) {
                    proxySprite.texture = tinyTex;
                    registry.bind(image.id, tinyTex);
                } else {
                    proxySprite.texture = getGreyPlaceholder();
                    registry.unbind(image.id);
                }
            }

            // Apply texture if loaded and valid
            if (texture !== Texture.EMPTY && !(texture as any).destroyed && proxySprite.texture !== texture) {
                proxySprite.texture = texture;
                registry.bind(image.id, texture);
            }
        }
    });

    return lodUpdateQueue.length > 0;
};

const scheduler = new RenderScheduler({
    isReady: () => !!(app && app.stage && app.renderer),
    isInteracting: () => workerState.isInteracting,
    onInteractionEnd: () => {
        workerState.isInteracting = false;
        workerState.lodZoom = workerState.zoom;
        reconcile();
        updateContent();
        requestRender();
    },
    processLODBatch: _processLODBatch,
    reconcile: () => reconcile(),
    cleanupStaleRequests: () => registry.cleanupStaleRequests(),
    evictIdle: () => registry.evictIdlePreviews(buildActiveSrcs()),
    render: () => { app!.render(); lastFrameTime = performance.now(); },
    processPendingDestroys: () => registry.processPendingDestroys(buildActiveSrcs()),
});

const requestRender = () => scheduler.request();

const updateSceneGraph = () => {
    updateContent();
    drawGrid(); // Ensure grid is drawn on scene update
};

// [GRID] Infinite Grid Implementation
// Draws lines strictly within the visible viewport for performance
const drawGrid = () => {
    if (!app || !app.stage) return;

    // Create graphics if missing
    if (!gridGraphics) {
        gridGraphics = new Graphics();
        gridGraphics.label = 'grid';
        gridGraphics.zIndex = -999; // Always at the bottom
        app.stage.addChild(gridGraphics);
    }

    // [OPTIMIZATION] Hide grid at very low zoom to prevent aliasing/noise
    if (workerState.zoom < 0.1) {
        gridGraphics.clear();
        return;
    }

    gridGraphics.clear();

    // Calculate visible bounds in world coordinates
    const zoom = workerState.zoom;
    const panX = workerState.pan.x;
    const panY = workerState.pan.y;
    const screenW = app.screen.width;
    const screenH = app.screen.height;

    // Viewport in world space
    const startX = (-panX) / zoom;
    const startY = (-panY) / zoom;
    const endX = (screenW - panX) / zoom;
    const endY = (screenH - panY) / zoom;

    // Adaptive Grid Size based on zoom
    // Prevent grid becoming too dense
    let currentGridSize = GRID_SIZE;
    while (currentGridSize * zoom < 20) {
        currentGridSize *= 2;
    }

    // Calculate grid alignment
    const offsetX = startX % currentGridSize;
    const offsetY = startY % currentGridSize;

    const firstLineX = startX - offsetX;
    const firstLineY = startY - offsetY;

    // Line drawing
    // [PERF] Use simple line style
    gridGraphics.moveTo(0, 0); // Reset path
    const color = GRID_COLOR;
    const alpha = Math.min(0.08, Math.max(0.02, zoom * 0.08)); // ~8% opacity, slightly brighter per user request

    // Vertical Lines
    for (let x = firstLineX; x <= endX; x += currentGridSize) {
        gridGraphics.moveTo(x, startY);
        gridGraphics.lineTo(x, endY);
    }

    // Horizontal Lines
    for (let y = firstLineY; y <= endY; y += currentGridSize) {
        gridGraphics.moveTo(startX, y);
        gridGraphics.lineTo(endX, y);
    }

    gridGraphics.stroke({ width: 1 / zoom, color, alpha }); // Constant screen-space width
};

// ---- Façade class ----

export class PixiCanvasRenderer implements ICanvasRenderer {
    async init(payload: InitPayload): Promise<void> {
        return _handleInit(payload);
    }

    resize(width: number, height: number): void {
        if (app && app.renderer) {
            app.renderer.resize(width, height);
            requestRender();
        }
    }

    applyPatch(patch: any): void {
        return _handleApplyPatch(patch);
    }

    addResource(id: string, bitmap: any): void {
        return _handleAddResource(id, bitmap);
    }

    addCompressedResource(id: string, buffer: ArrayBuffer, mimeType: string): void {
        return _handleAddCompressedResource(id, buffer, mimeType);
    }

    pause(): void {
        return _handlePauseRendering();
    }

    resume(): void {
        return _handleResumeRendering();
    }

    getMemoryStatus(): MemoryStatus {
        return getMemoryStatus();
    }

    cleanupUnusedTextures(payload: CleanupPayload): void {
        return _handleCleanupUnusedTextures(payload);
    }

    evictOffscreenTextures(nonce: any): void {
        return _handleEvictOffscreenTextures(nonce);
    }

    onResourceError(id: string): void {
        registry.cancelRequest(id);
        requestRender();
    }

    resumeFromBackground(): void {
        registry.clearPendingRequests();
        reconcile();
        requestRender();
    }

    requestRender(): void {
        requestRender();
    }

    stats(): RendererStatsTelemetry {
        const s = registry.stats();
        return {
            initialized: isInitialized,
            vramUsedMB: s.vramUsedMB,
            vramLimitMB: s.vramLimitMB,
            textureCacheCount: s.textureCacheCount,
            pendingDestroysCount: s.pendingDestroysCount,
            pendingRequestsCount: s.pendingRequestsCount,
            requestedResourcesCount: s.requestedResourcesCount,
            imageCount: workerState.boardImages.length,
        };
    }
}
