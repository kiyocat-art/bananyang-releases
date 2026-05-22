import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../../store/canvasStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { BoardImage, BoardGroup } from '../../../types';
import { imageLoader } from '../../../services/ImageLoaderService';
import { blobManager } from '../../../utils/blobManager';

// [Phase 5] Delta Sync - Track last synced state to only send changes
interface ImageSyncState {
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    groupId?: string;
    role: string;
    scaleX?: number;
    src?: string;
    proxySrc?: string;
    tinySrc?: string;
    previewSrc?: string;
    originalSrc?: string;
    ktx2Src?: string;
    highResSrc?: string;
}

// [FIX CRASH-1] Concurrency limiter to prevent memory explosion from too many simultaneous image loads
// Dynamic limits based on resolution tier to prevent memory spikes
// 4K/Original = ~64MB each, Preview/2K = ~16MB each, Tiny/128px = <1MB each
const MAX_CONCURRENT_FULL = 2;     // 4K/Original images
const MAX_CONCURRENT_PREVIEW = 8;  // 1K-2K preview images
const MAX_CONCURRENT_TINY = 16;    // 128px tiny thumbnails

let activeFullLoads = 0;
let activePreviewLoads = 0;
let activeTinyLoads = 0;

interface LoadQueueItem {
    id: string;
    tier: 'FULL' | 'PREVIEW' | 'TINY';
    task: () => Promise<void>;
}

const loadQueue: LoadQueueItem[] = [];

// [FIX CRASH-2] Track URLs currently being processed to prevent cleanup race condition
// These URLs MUST be protected from ViewportCleanup while loading
const processingUrls = new Set<string>();

/**
 * Get URLs currently in load queue or being processed
 * Used by useMemoryCleanup to prevent premature blob revocation
 */
export const getProcessingUrls = (): Set<string> => {
    const urls = new Set(processingUrls);
    // Also include queued items
    loadQueue.forEach(item => urls.add(item.id));
    return urls;
};

/**
 * Clear all pending load tasks - call before revoking blob URLs (e.g., reset/clearCanvas)
 * Prevents race condition where queued tasks try to fetch revoked blobs
 */
export const clearLoadQueue = () => {
    loadQueue.length = 0;
    processingUrls.clear();
    activeFullLoads = 0;
    activePreviewLoads = 0;
    activeTinyLoads = 0;
    console.log('[useCanvasWorker] Load queue cleared');
};

// [Improvement 1] Dispatch evict-offscreen-textures to worker (main thread bridge)
export const evictOffscreenTextures = (): void => {
    window.dispatchEvent(new Event('canvas-evict-offscreen'));
};

// [Improvement 2] TINY texture background preload queue
// Populated by triggerTinyPreload(), drained 1/100ms by the hook's interval
const tinyPreloadQueue: string[] = [];
const tinyPreloadSet = new Set<string>(); // O(1) deduplication

export const triggerTinyPreload = (images: { tinySrc?: string; src?: string }[]): void => {
    for (const img of images) {
        const url = img.tinySrc || img.src;
        if (url && !tinyPreloadSet.has(url)) {
            tinyPreloadSet.add(url);
            tinyPreloadQueue.push(url);
        }
    }
    if (process.env.NODE_ENV === 'development') {
        console.log(`[useCanvasWorker] TINY preload queued: ${tinyPreloadQueue.length} images`);
    }
};

export const clearTinyPreloadQueue = (): void => {
    tinyPreloadQueue.length = 0;
    tinyPreloadSet.clear();
};

const failedIds = new Set<string>(); // Track failed IDs to prevent infinite retry

/**
 * Remove specific blob URLs from failedIds so they can be retried.
 * Call this after undo/redo restores images whose blob URLs may have been
 * transiently marked as failed.
 */
export const clearFailedBlobUrls = (srcs: string[]) => {
    srcs.forEach(src => {
        if (src && src.startsWith('blob:') && failedIds.has(src)) {
            failedIds.delete(src);
        }
    });
};

// Determine tier from resource ID
const getTierFromId = (id: string): 'FULL' | 'PREVIEW' | 'TINY' => {
    if (id.includes('tiny') || id.includes('128')) return 'TINY';
    if (id.includes('preview') || id.includes('proxy') || id.includes('1024')) return 'PREVIEW';
    return 'FULL'; // Original, highRes, or unknown = treat as FULL (safest)
};

const canStartLoad = (tier: 'FULL' | 'PREVIEW' | 'TINY'): boolean => {
    switch (tier) {
        case 'TINY': return activeTinyLoads < MAX_CONCURRENT_TINY;
        case 'PREVIEW': return activePreviewLoads < MAX_CONCURRENT_PREVIEW;
        case 'FULL': return activeFullLoads < MAX_CONCURRENT_FULL;
    }
};

const incrementActive = (tier: 'FULL' | 'PREVIEW' | 'TINY') => {
    switch (tier) {
        case 'TINY': activeTinyLoads++; break;
        case 'PREVIEW': activePreviewLoads++; break;
        case 'FULL': activeFullLoads++; break;
    }
};

const decrementActive = (tier: 'FULL' | 'PREVIEW' | 'TINY') => {
    switch (tier) {
        case 'TINY': activeTinyLoads = Math.max(0, activeTinyLoads - 1); break;
        case 'PREVIEW': activePreviewLoads = Math.max(0, activePreviewLoads - 1); break;
        case 'FULL': activeFullLoads = Math.max(0, activeFullLoads - 1); break;
    }
};

const processLoadQueue = () => {
    // Process queue by tier priority: TINY > PREVIEW > FULL (smaller first for faster perceived loading)
    const tiers: Array<'TINY' | 'PREVIEW' | 'FULL'> = ['TINY', 'PREVIEW', 'FULL'];

    for (const tier of tiers) {
        while (canStartLoad(tier)) {
            const itemIndex = loadQueue.findIndex(item => item.tier === tier && !failedIds.has(item.id));
            if (itemIndex === -1) break;

            const item = loadQueue.splice(itemIndex, 1)[0];
            incrementActive(tier);

            // [FIX CRASH-2] Track URL as actively processing
            processingUrls.add(item.id);

            item.task().finally(() => {
                // [FIX CRASH-2] Remove from processing set when done
                processingUrls.delete(item.id);
                decrementActive(tier);
                processLoadQueue();
            });
        }
    }
};

const queueImageLoad = (id: string, task: () => Promise<void>, tierOverride?: 'FULL' | 'PREVIEW' | 'TINY') => {
    // Skip if already failed
    if (failedIds.has(id)) {
        return;
    }

    // Skip if already in queue
    if (loadQueue.some(item => item.id === id)) {
        return;
    }

    const tier = tierOverride || getTierFromId(id);
    loadQueue.push({ id, tier, task });
    processLoadQueue();
};

const markFailed = (id: string) => {
    failedIds.add(id);
    // Clear failed IDs after 30 seconds to allow retry
    setTimeout(() => failedIds.delete(id), 30000);
};

export const useCanvasWorker = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
    const workerRef = useRef<Worker | null>(null);
    // [FIX TAB-SWITCH] Mount epoch — bumped each useEffect run. Used to bail in-flight
    // load tasks whose worker has been terminated by a tab switch unmount.
    const mountEpochRef = useRef(0);
    const lastSyncedImagesRef = useRef<Map<string, ImageSyncState>>(new Map());
    const lastSyncedGroupsRef = useRef<Map<string, BoardGroup>>(new Map());
    const isFirstSyncRef = useRef(true);

    // [FIX FLICK] Individual selectors — pan/zoom excluded to prevent unnecessary re-renders.
    // Viewport sync is handled via direct zustand subscription (see init useEffect) for zero-latency
    // forwarding to the PixiJS worker, which is critical for smooth flick panning.
    const boardImages = useCanvasStore(s => s.boardImages);
    const boardGroups = useCanvasStore(s => s.boardGroups);
    const selectedImageIds = useCanvasStore(s => s.selectedImageIds);
    const selectedGroupIds = useCanvasStore(s => s.selectedGroupIds);
    const groupEditModeId = useCanvasStore(s => s.groupEditModeId);
    const marquee = useCanvasStore(s => s.marquee);

    useEffect(() => {
        if (!canvasRef.current) return;

        // [FIX TAB-SWITCH] Bump epoch — in-flight tasks from prior mount will see a stale
        // epoch and bail before touching the freshly created worker.
        mountEpochRef.current++;
        const myEpoch = mountEpochRef.current;

        // Initialize Worker
        workerRef.current = new Worker('rendering.worker.js', { type: 'module' });

        const offscreen = canvasRef.current.transferControlToOffscreen();
        const enableWebGPU = useSettingsStore.getState().enableWebGPU;

        workerRef.current.postMessage({
            type: 'init',
            payload: {
                canvas: offscreen,
                resolution: window.devicePixelRatio || 1,
                width: canvasRef.current.clientWidth,
                height: canvasRef.current.clientHeight,
                enableWebGPU,
            }
        }, [offscreen]);

        const handleWorkerMessage = async (event: MessageEvent) => {
            const { type, payload, data } = event.data;
            if (type === 'renderer-info') {
                console.info('[Canvas] Active renderer:', payload);
                window.dispatchEvent(new CustomEvent('canvas-renderer-info', { detail: payload }));
                return;
            }
            if (type === 'render-crash') {
                window.dispatchEvent(new CustomEvent('canvas-render-crash'));
                return;
            }
            // [Improvement 1] Worker → main: off-screen eviction complete
            if (type === 'evict-complete') {
                window.dispatchEvent(new CustomEvent('canvas-evict-complete', { detail: data }));
                return;
            }
            // [TELEMETRY] Relay render telemetry to main thread listeners
            if (type === 'telemetry') {
                window.dispatchEvent(new CustomEvent('canvas-render-telemetry', { detail: payload }));
                return;
            }
            // [FIX STUCK-1] Worker가 stale 요청 타임아웃 처리 후 main thread failedIds도 클리어
            if (type === 'clear-failed-ids') {
                const { ids } = payload as { ids: string[] };
                ids.forEach(id => failedIds.delete(id));
                return;
            }
            if (type === 'request-resource') {
                const { id } = payload;

                // [FIX CRASH-1] Skip if already failed to prevent infinite retry loop
                if (failedIds.has(id)) {
                    return;
                }

                // [FIX] Touch blob to prevent premature cleanup
                blobManager.touch(id);

                // [FIX LOAD-5] Determine correct tier from image field matching (blob URLs lack tier keywords)
                let determinedTier: 'FULL' | 'PREVIEW' | 'TINY' | undefined;
                if (id.startsWith('blob:')) {
                    const { boardImages: imgs } = useCanvasStore.getState();
                    const matchedImg = imgs.find(img =>
                        img.src === id || img.proxySrc === id || img.tinySrc === id ||
                        img.ktx2Src === id || img.previewSrc === id || img.originalSrc === id
                    );
                    if (matchedImg) {
                        if (id === matchedImg.tinySrc) determinedTier = 'TINY';
                        else if (id === matchedImg.previewSrc || id === matchedImg.proxySrc) determinedTier = 'PREVIEW';
                        else determinedTier = 'FULL';
                    }
                }

                // [FIX CRASH-1] Queue the load task instead of running immediately
                queueImageLoad(id, async () => {
                // [FIX TAB-SWITCH] Bail if this task was queued for a now-terminated worker.
                if (myEpoch !== mountEpochRef.current || !workerRef.current) return;
                try {
                    // Check if this is a blob URL - if so, find the original File from store
                    if (id.startsWith('blob:')) {
                        const { boardImages } = useCanvasStore.getState();

                        // [FIX] Improved matching: check all possible src fields including ktx2Src and previewSrc
                        const image = boardImages.find(img =>
                            img.src === id || img.proxySrc === id || img.tinySrc === id || img.ktx2Src === id || img.previewSrc === id || img.originalSrc === id
                        );

                        if (image) {
                            // [KTX2 Support] Handle KTX2 requests
                            if (id === image.ktx2Src) {
                                try {
                                    // console.log('[KTX2] 📥 Loading KTX2 from URL:', id);
                                    const response = await fetch(id);
                                    if (response.ok) {
                                        const buffer = await response.arrayBuffer();
                                        console.log(`[KTX2] 📦 Transferred to Worker: ${id} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
                                        workerRef.current?.postMessage({
                                            type: 'add-compressed-resource',
                                            payload: {
                                                id,
                                                buffer,
                                                mimeType: 'image/ktx2'
                                            }
                                        }, [buffer]); // Transfer buffer
                                        return;
                                    }
                                } catch (e) {
                                    console.error('[KTX2] ❌ Failed to load KTX2:', id, e);
                                    // Fallback to normal loading if KTX2 fails
                                }
                            }

                            // [VRAM FIX] 요청된 소스에 맞는 LOD 파일 사용
                            // tinySrc 요청 -> tinyFile 사용, proxySrc 요청 -> proxyFile 사용
                            let fileToUse: File | undefined;

                            if (id === image.tinySrc && image.tinyFile) {
                                fileToUse = image.tinyFile;
                                // console.log('[useCanvasWorker] Using tinyFile for:', id);
                            } else if (id === image.proxySrc && image.proxyFile) {
                                fileToUse = image.proxyFile;
                                // console.log('[useCanvasWorker] Using proxyFile for:', id);
                            } else if (id === image.previewSrc && image.previewFile) {
                                fileToUse = image.previewFile;
                            } else if (image.file) {
                                fileToUse = image.file;
                            } else if (image.originalFile) {
                                fileToUse = image.originalFile;
                            }

                            if (fileToUse) {
                                // [FIX LOAD-1] 개별 try-catch로 processImage 내부 실패 처리
                                try {
                                    // [FIX BLOB-LEAK #5] Orphan blob release is now handled inside
                                    // ImageLoaderService.processImage when customId is provided.
                                    // No need to check result.src here anymore.
                                    await imageLoader.processImage(fileToUse, id, true);
                                } catch (e) {
                                    console.warn('[useCanvasWorker] processImage failed:', id, e);
                                    markFailed(id); // [FIX CRASH-1] Prevent infinite retry
                                    workerRef.current?.postMessage({ type: 'resource-error', payload: { id } });
                                }
                            } else {
                                // [FIX] Fallback chain for loaded workspaces (no File objects)
                                console.warn('[useCanvasWorker] File missing for:', id, '- attempting fallback chain');

                                let success = false;

                                // Try 1: Fetch from src blob URL
                                if (!success && image.src) {
                                    try {
                                        const response = await fetch(image.src);
                                        if (response.ok) {
                                            const blob = await response.blob();
                                            const file = new File([blob], `reload-${Date.now()}.png`, { type: blob.type });
                                            await imageLoader.processImage(file, id, true);
                                            success = true;
                                        }
                                    } catch (e) { console.warn('[useCanvasWorker] Fallback src fetch failed:', id, (e as Error)?.message); }
                                }

                                // Try 2: Fetch from proxySrc
                                if (!success && image.proxySrc && image.proxySrc !== image.src) {
                                    try {
                                        const response = await fetch(image.proxySrc);
                                        if (response.ok) {
                                            const blob = await response.blob();
                                            const file = new File([blob], `reload-${Date.now()}.png`, { type: blob.type });
                                            await imageLoader.processImage(file, id, true);
                                            success = true;
                                        }
                                    } catch (e) { console.warn('[useCanvasWorker] Fallback proxySrc fetch failed:', id, (e as Error)?.message); }
                                }

                                // Try 3: Fetch from originalSrc (if different from src)
                                if (!success && image.originalSrc && image.originalSrc !== image.src) {
                                    try {
                                        const response = await fetch(image.originalSrc);
                                        if (response.ok) {
                                            const blob = await response.blob();
                                            const file = new File([blob], `reload-${Date.now()}.png`, { type: blob.type });
                                            await imageLoader.processImage(file, id, true);
                                            success = true;
                                        }
                                    } catch (e) { console.warn('[useCanvasWorker] Fallback originalSrc fetch failed:', id, (e as Error)?.message); }
                                }

                                // Try 4: Fetch from highResSrc
                                if (!success && image.highResSrc) {
                                    try {
                                        const response = await fetch(image.highResSrc);
                                        if (response.ok) {
                                            const blob = await response.blob();
                                            const file = new File([blob], `reload-${Date.now()}.png`, { type: blob.type });
                                            await imageLoader.processImage(file, id, true);
                                            success = true;
                                        }
                                    } catch (e) { console.warn('[useCanvasWorker] Fallback highResSrc fetch failed:', id, (e as Error)?.message); }
                                }

                                // [FIX RC-3] 모든 fallback 실패 시 resource-error 전송하여 Deadlock 방지
                                if (!success) {
                                    console.warn('[useCanvasWorker] All fallback attempts failed for:', id);
                                    markFailed(id); // [FIX CRASH-1] Prevent infinite retry
                                    workerRef.current?.postMessage({ type: 'resource-error', payload: { id } });
                                }
                            }
                        } else {
                            // [FIX] Smart Fallback: Find image that has this blob URL in ANY of its LOD fields
                            // This handles the case where previewSrc/proxySrc are stale blob URLs but src is now file://
                            const imageByAnySrc = boardImages.find(img =>
                                img.previewSrc === id || img.proxySrc === id || img.tinySrc === id ||
                                img.originalSrc === id || img.highResSrc === id
                            );

                            if (imageByAnySrc) {
                                // Found the image - now load using a valid source
                                // Priority: file (in memory) > file:// URL (disk) > blob URL
                                let loaded = false;

                                // Try 1: Use in-memory file objects
                                if (!loaded && imageByAnySrc.file) {
                                    try {
                                        await imageLoader.processImage(imageByAnySrc.file, id, true);
                                        loaded = true;
                                    } catch (e) { console.warn('[useCanvasWorker] Smart fallback file load failed:', id, (e as Error)?.message); }
                                }

                                // Try 2: Use filePath/originalFilePath or file:// URL via Electron IPC (disk-offloaded images)
                                const diskPath = imageByAnySrc.originalFilePath || imageByAnySrc.filePath;
                                if (!loaded && (diskPath || imageByAnySrc.src?.startsWith('file://'))) {
                                    try {
                                        let filePath: string;
                                        if (diskPath) {
                                            filePath = decodeURIComponent(diskPath);
                                        } else {
                                            filePath = imageByAnySrc.src.replace('file:///', '');
                                            if (!(filePath.length > 2 && filePath[1] === ':')) {
                                                filePath = imageByAnySrc.src.replace('file://', '');
                                            }
                                            filePath = decodeURIComponent(filePath);
                                        }

                                        const base64 = await window.electronAPI?.readBinaryFile(filePath);
                                        if (base64) {
                                            const ext = filePath.split('.').pop()?.toLowerCase();
                                            const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                                            const res = await fetch(`data:${mimeType};base64,${base64}`);
                                            const blob = await res.blob();
                                            const file = new File([blob], `disk-${Date.now()}.${ext || 'webp'}`, { type: mimeType });
                                            await imageLoader.processImage(file, id, true);
                                            loaded = true;
                                        }
                                    } catch (e) { console.warn('[useCanvasWorker] Smart fallback disk load failed:', id, (e as Error)?.message); }
                                }

                                // Try 3: Fetch from src blob URL (if still valid)
                                if (!loaded && imageByAnySrc.src?.startsWith('blob:')) {
                                    try {
                                        const response = await fetch(imageByAnySrc.src);
                                        if (response.ok) {
                                            const blob = await response.blob();
                                            const file = new File([blob], `fallback-${Date.now()}.png`, { type: blob.type });
                                            await imageLoader.processImage(file, id, true);
                                            loaded = true;
                                        }
                                    } catch (e) { console.warn('[useCanvasWorker] Smart fallback blob fetch failed:', id, (e as Error)?.message); }
                                }

                                if (!loaded) {
                                    console.warn('[useCanvasWorker] Found image but all load attempts failed:', id);
                                    // [FIX RC-3] resource-error 전송하여 Worker Deadlock 방지
                                    markFailed(id); // [FIX CRASH-1] Prevent infinite retry
                                    workerRef.current?.postMessage({ type: 'resource-error', payload: { id } });
                                }
                            } else {
                                // Last resort: Try to fetch the blob URL directly (unlikely to work for stale blobs)
                                try {
                                    const response = await fetch(id);
                                    if (response.ok) {
                                        const blob = await response.blob();
                                        const file = new File([blob], `fallback-${Date.now()}.png`, { type: blob.type });
                                        await imageLoader.processImage(file, id, true);
                                        return;
                                    }
                                } catch (e) { console.warn('[useCanvasWorker] Last resort fetch failed:', id, (e as Error)?.message); }
                                console.warn('[useCanvasWorker] Cannot load blob resource - Image not found and fetch failed for:', id);
                                markFailed(id); // [FIX CRASH-1] Prevent infinite retry
                                workerRef.current?.postMessage({ type: 'resource-error', payload: { id } });
                            }
                        }
                    } else {
                        // [FIX] Handle file:// URLs via Electron IPC for disk-offloaded images
                        if (id.startsWith('file://')) {
                            // Extract path (remove file:// prefix) - careful with Windows paths
                            // Windows path might be file:///C:/... so removing file:/// leaves C:/...
                            let filePath = id.replace('file:///', '');
                            if (filePath.length > 2 && filePath[1] === ':') {
                                // Keep windows path as is (e.g. C:/...)
                            } else {
                                // Fallback for other formats
                                filePath = id.replace('file://', '');
                            }

                            // Decode URI component in case of spaces etc
                            filePath = decodeURIComponent(filePath);

                            try {
                                const base64 = await window.electronAPI?.readBinaryFile(filePath);
                                if (base64) {
                                    // Determine mime type from extension
                                    const ext = filePath.split('.').pop()?.toLowerCase();
                                    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

                                    const res = await fetch(`data:${mimeType};base64,${base64}`);
                                    const blob = await res.blob();
                                    const file = new File([blob], `disk-${Date.now()}.${ext}`, { type: mimeType });
                                    await imageLoader.processImage(file, id, true);
                                    // console.log(`[useCanvasWorker] 📂 Loaded file from disk: ${filePath}`);
                                } else {
                                    console.warn(`[useCanvasWorker] Failed to read file from disk: ${filePath}`);
                                }
                            } catch (err) {
                                console.error(`[useCanvasWorker] Error reading file: ${filePath}`, err);
                            }
                        } else {
                            // For http://, https://, data: URLs, use the original logic
                            await imageLoader.processUrl(id, id);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load requested resource:', id, error);
                    markFailed(id); // [FIX CRASH-1] Prevent infinite retry
                    workerRef.current?.postMessage({ type: 'resource-error', payload: { id } });
                }
                }, determinedTier); // End of queueImageLoad callback
            }
        };

        workerRef.current.addEventListener('message', handleWorkerMessage);
        workerRef.current.onerror = (e) => {
            console.error('[useCanvasWorker] Worker error:', e);
        };
        workerRef.current.onmessageerror = (e) => {
            console.error('[useCanvasWorker] Worker message error:', e);
        };

        // Handle Resize
        let resizeTimeout: number;
        const canvasEl = canvasRef.current;
        const resizeObserver = new ResizeObserver((entries) => {
            if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
            resizeTimeout = requestAnimationFrame(() => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    workerRef.current?.postMessage({
                        type: 'resize',
                        payload: {
                            width,
                            height,
                            resolution: window.devicePixelRatio || 1
                        }
                    });
                }
            });
        });
        resizeObserver.observe(canvasEl);

        // [Performance Fix] Handle visibility changes (tab switching, Photoshop work, etc.)
        // When returning from background, request texture refresh to prevent stale/unloaded textures
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[useCanvasWorker] App returned to foreground - forcing full re-sync');

                // Reset first sync flag to force full data sync on next update
                isFirstSyncRef.current = true;
                lastSyncedImagesRef.current.clear();
                lastSyncedGroupsRef.current.clear();

                // Send resume message to worker
                workerRef.current?.postMessage({ type: 'resume-from-background' });

                // Force immediate full sync with current data
                const { boardImages, boardGroups } = useCanvasStore.getState();
                workerRef.current?.postMessage({
                    type: 'apply-state',
                    patch: {
                        kind: 'full',
                        boardImages: boardImages.map(img => ({
                            ...img,
                            file: undefined,
                            originalFile: undefined,
                        })),
                        boardGroups
                    }
                });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // [VRAM] Handle Low Spec Mode pause/resume
        const handlePixijsPause = () => {
            console.log('[useCanvasWorker] Pausing PixiJS rendering for VRAM optimization');
            workerRef.current?.postMessage({ type: 'pause-rendering' });
        };
        const handlePixijsResume = () => {
            console.log('[useCanvasWorker] Resuming PixiJS rendering');
            workerRef.current?.postMessage({ type: 'resume-rendering' });
            // Force full resync to reload textures
            isFirstSyncRef.current = true;
            lastSyncedImagesRef.current.clear();
            lastSyncedGroupsRef.current.clear();
            // Trigger immediate sync
            const { boardImages, boardGroups } = useCanvasStore.getState();
            workerRef.current?.postMessage({
                type: 'apply-state',
                patch: {
                    kind: 'full',
                    boardImages: boardImages.map(img => ({
                        ...img,
                        file: undefined,
                        originalFile: undefined,
                    })),
                    boardGroups
                }
            });
        };
        window.addEventListener('pixijs-pause', handlePixijsPause);
        window.addEventListener('pixijs-resume', handlePixijsResume);

        // [MEMORY] Handle texture cleanup from memory cleanup hook or VRAM guard
        const handleCleanupTextures = (e: CustomEvent) => {
            const { activeImageIds, activeSrcs, aggressive, source } = e.detail || {};

            // [STABILITY] Pre-generation cleanup: aggressive mode clears more textures
            if (aggressive || source === 'vram-emergency' || source === 'pre-generation') {
                console.log(`[useCanvasWorker] Aggressive texture cleanup (source: ${source})`);
                workerRef.current?.postMessage({
                    type: 'cleanup-unused-textures',
                    payload: { activeImageIds, activeSrcs, aggressive: true }
                });
            } else {
                console.log('[useCanvasWorker] Cleaning up unused textures, active images:', activeImageIds?.length);
                workerRef.current?.postMessage({
                    type: 'cleanup-unused-textures',
                    payload: { activeImageIds, activeSrcs }
                });
            }
        };
        window.addEventListener('canvas-cleanup-textures' as any, handleCleanupTextures);

        // [Improvement 1] Off-screen targeted VRAM eviction (worker computes visible srcs internally)
        const handleEvictOffscreen = (e: Event) => {
            const evictNonce = (e as CustomEvent).detail?.nonce;
            workerRef.current?.postMessage({ type: 'evict-offscreen-textures', nonce: evictNonce });
        };
        window.addEventListener('canvas-evict-offscreen', handleEvictOffscreen);

        // [Improvement 2] TINY texture background preloader — drains tinyPreloadQueue at 100ms/item
        const tinyPreloadTimer = setInterval(() => {
            const url = tinyPreloadQueue.shift();
            if (!url) return;
            tinyPreloadSet.delete(url); // keep Set in sync with queue
            if (failedIds.has(url)) return;
            queueImageLoad(url, async () => {
                // [FIX TAB-SWITCH] Bail if mount epoch advanced or worker gone.
                if (myEpoch !== mountEpochRef.current || !workerRef.current) return;
                try {
                    const response = await fetch(url);
                    if (!response.ok) return;
                    const blob = await response.blob();
                    const bitmap = await createImageBitmap(blob);
                    if (myEpoch !== mountEpochRef.current || !workerRef.current) {
                        bitmap.close?.();
                        return;
                    }
                    workerRef.current?.postMessage(
                        { type: 'add-resource', payload: { id: url, bitmap } },
                        [bitmap]
                    );
                } catch { /* silent: preload is best-effort */ }
            }, 'TINY');
        }, 100);

        // [SOFT REFRESH] Clear all VRAM/cache and reload images without app restart
        // [FIX RC-5] ACK 기반으로 변경 — Worker pause 완료 확인 후 resume
        const handleSoftRefresh = () => {
            console.log('[useCanvasWorker] Soft refresh - clearing VRAM and reloading all images');

            const resumeAndReload = () => {
                console.log('[useCanvasWorker] Soft refresh - pause confirmed, resuming and reloading');
                workerRef.current?.postMessage({ type: 'resume-rendering' });

                // Force full resync to reload all textures
                isFirstSyncRef.current = true;
                lastSyncedImagesRef.current.clear();
                lastSyncedGroupsRef.current.clear();

                // Trigger immediate sync with all images
                const { boardImages, boardGroups } = useCanvasStore.getState();
                workerRef.current?.postMessage({
                    type: 'apply-state',
                    patch: {
                        kind: 'full',
                        boardImages: boardImages.map(img => ({
                            ...img,
                            file: undefined,
                            originalFile: undefined,
                        })),
                        boardGroups
                    }
                });

                console.log('[useCanvasWorker] Soft refresh complete -', boardImages.length, 'images queued for reload');
            };

            // Worker pause 완료 ACK를 대기하는 1회용 리스너
            let ackReceived = false;
            const handlePauseComplete = (event: MessageEvent) => {
                if (event.data.type !== 'pause-complete') return;
                ackReceived = true;
                workerRef.current?.removeEventListener('message', handlePauseComplete);
                resumeAndReload();
            };

            workerRef.current?.addEventListener('message', handlePauseComplete);

            // Step 1: Pause rendering (destroys all textures in worker)
            workerRef.current?.postMessage({ type: 'pause-rendering' });

            // [SAFETY] 3초 타임아웃 — ACK가 오지 않으면 강제 resume
            setTimeout(() => {
                if (!ackReceived) {
                    console.warn('[useCanvasWorker] Soft refresh - pause ACK timeout, forcing resume');
                    workerRef.current?.removeEventListener('message', handlePauseComplete);
                    resumeAndReload();
                }
            }, 3000);
        };
        window.addEventListener('canvas-soft-refresh', handleSoftRefresh);

        // [FIX STUCK-4] 60초 주기로 활성 이미지의 failedIds를 정리 (안전망)
        // Worker의 stale 타임아웃(30s)이 처리 못한 고착 케이스 보정
        const recoveryTimer = setInterval(() => {
            if (failedIds.size === 0) return;
            const { boardImages: imgs } = useCanvasStore.getState();
            const activeSrcs = new Set<string>();
            imgs.forEach(img => {
                if (img.src) activeSrcs.add(img.src);
                if (img.tinySrc) activeSrcs.add(img.tinySrc);
                if (img.proxySrc) activeSrcs.add(img.proxySrc);
                if (img.previewSrc) activeSrcs.add(img.previewSrc);
            });
            let cleared = 0;
            failedIds.forEach(id => {
                if (activeSrcs.has(id)) { failedIds.delete(id); cleared++; }
            });
            if (cleared > 0) {
                console.log(`[useCanvasWorker] Recovery: cleared ${cleared} failedIds for active images`);
            }
        }, 60000);

        // [FIX FLICK] Direct zustand subscription for viewport sync — bypasses React rendering.
        // This fires synchronously when pan/zoom changes, sending the update to the PixiJS worker
        // within the same frame. Critical for smooth flick panning (inertia animation).
        const unsubViewport = useCanvasStore.subscribe((state, prev) => {
            if (state.pan === prev.pan && state.zoom === prev.zoom) return;
            workerRef.current?.postMessage({
                type: 'apply-state',
                patch: { kind: 'viewport', pan: state.pan, zoom: state.zoom }
            });
        });

        return () => {
            unsubViewport();
            clearInterval(recoveryTimer);
            clearInterval(tinyPreloadTimer);
            clearTinyPreloadQueue();
            // [FIX TAB-SWITCH] Drain module-global load queue + reset counters + clear stale
            // failedIds. Without this, the next tab's Worker sees `loadQueue.some(id===...)`
            // short-circuits (L180) and `failedIds.has(id)` blocks (L175) → blank canvas.
            clearLoadQueue();
            failedIds.clear();
            resizeObserver.disconnect();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pixijs-pause', handlePixijsPause);
            window.removeEventListener('pixijs-resume', handlePixijsResume);
            window.removeEventListener('canvas-soft-refresh', handleSoftRefresh);
            window.removeEventListener('canvas-cleanup-textures' as any, handleCleanupTextures);
            window.removeEventListener('canvas-evict-offscreen', handleEvictOffscreen);
            // [FIX TAB-SWITCH] Null the ref BEFORE terminate so any racing postMessage
            // (e.g. from the zustand viewport subscription that fires synchronously) no-ops
            // instead of throwing on a dying worker.
            const w = workerRef.current;
            workerRef.current = null;
            w?.removeEventListener('message', handleWorkerMessage);
            w?.terminate();
        };
    }, []);

    // [Phase 5] Delta Sync - Only send changes instead of full array
    useEffect(() => {
        const timeout = setTimeout(() => {
            const currentImageIds = new Set(boardImages.map(img => img.id));
            const lastSyncedIds = new Set(lastSyncedImagesRef.current.keys());

            // First sync: send full data and establish baseline
            if (isFirstSyncRef.current) {
                isFirstSyncRef.current = false;

                workerRef.current?.postMessage({
                    type: 'apply-state',
                    patch: {
                        kind: 'full',
                        boardImages: boardImages.map(img => ({
                            ...img,
                            file: undefined,
                            originalFile: undefined,
                        })),
                        boardGroups
                    }
                });

                // Update tracking state
                boardImages.forEach(img => {
                    lastSyncedImagesRef.current.set(img.id, {
                        x: img.x, y: img.y, width: img.width, height: img.height,
                        zIndex: img.zIndex, groupId: img.groupId, role: img.role,
                        scaleX: img.scaleX,
                        src: img.src, proxySrc: img.proxySrc, tinySrc: img.tinySrc,
                        previewSrc: img.previewSrc, originalSrc: img.originalSrc,
                        ktx2Src: img.ktx2Src, highResSrc: img.highResSrc
                    });
                });
                lastSyncedGroupsRef.current = new Map(boardGroups.map(g => [g.id, g]));
                return;
            }

            // Detect changes
            const addedImages: BoardImage[] = [];
            const changedImages: BoardImage[] = [];
            const removedIds: string[] = [];

            // Find added and changed images
            boardImages.forEach(img => {
                const lastState = lastSyncedImagesRef.current.get(img.id);
                if (!lastState) {
                    addedImages.push(img);
                } else if (
                    lastState.x !== img.x ||
                    lastState.y !== img.y ||
                    lastState.width !== img.width ||
                    lastState.height !== img.height ||
                    lastState.zIndex !== img.zIndex ||
                    lastState.groupId !== img.groupId ||
                    lastState.role !== img.role ||
                    lastState.scaleX !== img.scaleX ||
                    lastState.src !== img.src ||
                    lastState.proxySrc !== img.proxySrc ||
                    lastState.tinySrc !== img.tinySrc ||
                    lastState.previewSrc !== img.previewSrc ||
                    lastState.originalSrc !== img.originalSrc ||
                    lastState.ktx2Src !== img.ktx2Src ||
                    lastState.highResSrc !== img.highResSrc
                ) {
                    changedImages.push(img);
                }
            });

            // Find removed images
            lastSyncedIds.forEach(id => {
                if (!currentImageIds.has(id)) {
                    removedIds.push(id);
                }
            });

            // Check if groups changed significantly
            const groupsChanged = boardGroups.length !== lastSyncedGroupsRef.current.size ||
                boardGroups.some(g => {
                    const lastGroup = lastSyncedGroupsRef.current.get(g.id);
                    return !lastGroup ||
                        lastGroup.x !== g.x ||
                        lastGroup.y !== g.y ||
                        lastGroup.width !== g.width ||
                        lastGroup.height !== g.height;
                });

            // Only send if there are changes
            if (addedImages.length > 0 || changedImages.length > 0 || removedIds.length > 0 || groupsChanged) {
                workerRef.current?.postMessage({
                    type: 'apply-state',
                    patch: {
                        kind: 'delta',
                        added: addedImages.map(img => ({ ...img, file: undefined, originalFile: undefined })),
                        changed: changedImages.map(img => ({ ...img, file: undefined, originalFile: undefined })),
                        removed: removedIds,
                        boardGroups: groupsChanged ? boardGroups : undefined
                    }
                });

                // Update tracking state
                addedImages.forEach(img => {
                    lastSyncedImagesRef.current.set(img.id, {
                        x: img.x, y: img.y, width: img.width, height: img.height,
                        zIndex: img.zIndex, groupId: img.groupId, role: img.role,
                        scaleX: img.scaleX,
                        src: img.src, proxySrc: img.proxySrc, tinySrc: img.tinySrc,
                        previewSrc: img.previewSrc, originalSrc: img.originalSrc,
                        ktx2Src: img.ktx2Src, highResSrc: img.highResSrc
                    });
                });
                changedImages.forEach(img => {
                    lastSyncedImagesRef.current.set(img.id, {
                        x: img.x, y: img.y, width: img.width, height: img.height,
                        zIndex: img.zIndex, groupId: img.groupId, role: img.role,
                        scaleX: img.scaleX,
                        src: img.src, proxySrc: img.proxySrc, tinySrc: img.tinySrc,
                        previewSrc: img.previewSrc, originalSrc: img.originalSrc,
                        ktx2Src: img.ktx2Src, highResSrc: img.highResSrc
                    });
                });
                removedIds.forEach(id => lastSyncedImagesRef.current.delete(id));

                if (groupsChanged) {
                    lastSyncedGroupsRef.current = new Map(boardGroups.map(g => [g.id, g]));
                }
            }
        }, 100);

        return () => clearTimeout(timeout);
    }, [boardImages, boardGroups]);

    // Sync Selection & UI (Medium) - Debounced to prevent excessive updates
    useEffect(() => {
        const timeout = setTimeout(() => {
            workerRef.current?.postMessage({
                type: 'apply-state',
                patch: {
                    kind: 'selection',
                    selectedImageIds: Array.from(selectedImageIds),
                    selectedGroupIds: Array.from(selectedGroupIds),
                    groupEditModeId,
                    marquee
                }
            });
        }, 150); // 150ms debounce to reduce update frequency

        return () => clearTimeout(timeout);
    }, [selectedImageIds, selectedGroupIds, groupEditModeId, marquee]);

    // [FIX FLICK] Viewport sync moved to direct zustand subscription in init useEffect.
    // This eliminates the React re-render → useEffect → RAF pipeline (2+ frame delay)
    // that caused PixiJS images to freeze during flick panning inertia animation.

    // Handle Resource Transfer (Bitmaps)
    useEffect(() => {
        const handleAddResource = (e: CustomEvent) => {
            const { id, bitmap } = e.detail;
            workerRef.current?.postMessage({
                type: 'add-resource',
                payload: { id, bitmap }
            }, [bitmap]); // Transfer ownership
        };

        window.addEventListener('canvas-add-resource' as any, handleAddResource);
        return () => window.removeEventListener('canvas-add-resource' as any, handleAddResource);
    }, []);

    // [Performance Fix] Handle lightweight position updates during drag (no React state involved)
    useEffect(() => {
        // Handle individual image/element movement
        const handleElementMove = (e: CustomEvent) => {
            const { id, x, y, groupId } = e.detail;
            workerRef.current?.postMessage({
                type: 'apply-state',
                patch: { kind: 'transform', id, x, y, groupId }
            });
        };

        // [NEW] Handle group movement - O(1) performance
        const handleGroupMove = (e: CustomEvent) => {
            const { groupId, x, y } = e.detail;
            workerRef.current?.postMessage({
                type: 'apply-state',
                patch: { kind: 'group-transform', groupId, x, y }
            });
        };

        window.addEventListener('canvas-element-move' as any, handleElementMove);
        window.addEventListener('canvas-group-move' as any, handleGroupMove);
        return () => {
            window.removeEventListener('canvas-element-move' as any, handleElementMove);
            window.removeEventListener('canvas-group-move' as any, handleGroupMove);
        };
    }, []);

    return {
        postMessage: (message: any, transfer?: Transferable[]) => {
            if (transfer) {
                workerRef.current?.postMessage(message, transfer);
            } else {
                workerRef.current?.postMessage(message);
            }
        }
    };
};
