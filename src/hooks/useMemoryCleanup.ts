/**
 * Memory Cleanup Hook
 * Provides memory monitoring and cleanup functionality for the canvas
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { blobManager } from '../utils/blobManager';
import { useCanvasStore, canvasStoreRegistry, canvasTabRouter } from '../store/canvasStore';
import { getProcessingUrls } from '../features/canvas/hooks/useCanvasWorker';
import { getPopoverImageIds } from './usePopoverImageRegistry';
import type { BoardImage } from '../types';

export interface MemoryStats {
    blobUrlCount: number;
    estimatedMemoryMB: number;
    textureCount: number;
    vramUsageMB: number;
    lastCleanupTime: number | null;
}

export interface MemoryCleanupOptions {
    viewportCleanupEnabled: boolean;    // 뷰포트 기반 주기적 cleanup
    viewportCleanupIntervalMs: number;  // Default: 10000 (10 seconds)
    viewportCleanupMinImages: number;   // 이 수 이상일 때만 viewport cleanup 활성화
}

const DEFAULT_OPTIONS: MemoryCleanupOptions = {
    viewportCleanupEnabled: true,      // 뷰포트 기반 cleanup 기본 활성화
    viewportCleanupIntervalMs: 5000,   // 5초 간격 (기존 10초 → 300장+ 환경에서 blob 누적 감소)
    viewportCleanupMinImages: 100,     // 100장 이상일 때만 동작 (소규모 workspace 부담 방지)
};

export interface CleanupResult {
    cleanedUrls: number;
    freedMemoryMB: number;
    texturesCleaned: boolean;
    success: boolean;
    offloadedImages: number;
    vramFreedMB?: number; // VRAM freed by off-screen texture eviction (개선 1)
}

/**
 * [Viewport-Based 3-Zone Memory Management]
 * Zone 1 (Visible + Nearby): tinySrc + previewSrc + proxySrc + src + maskSrc 보호
 * Zone 2 (Far): tinySrc만 보호 → 나머지 blob URL은 safeCleanup 해제 대상
 *
 * 기존 방식: 모든 이미지의 모든 LOD URL을 active로 표시 → 1000장 시 ~9000개 blob 보호
 * 개선 방식: 뷰포트 기반 필터링 → 뷰포트 내 ~50장만 전체 보호, 나머지는 tinySrc만
 *
 * [FIX CRASH-2] Also protects URLs currently being processed by useCanvasWorker
 * to prevent race condition where cleanup revokes blob before processImage completes
 */
function getActiveImageUrls(): Set<string> {
    const activeUrls = new Set<string>();

    // [FIX CRASH-2] Protect URLs currently in load queue or being processed
    const processingUrls = getProcessingUrls();
    processingUrls.forEach(url => activeUrls.add(url));

    // [FIX POPOVER] Protect all LOD URLs for images currently shown in popover panels.
    // Viewport-based Zone 2 cleanup would otherwise revoke off-screen image LODs while
    // the popover is still rendering them (e.g. InpaintingTab ref list, RoleThumbnails).
    const popoverIds = getPopoverImageIds();

    const activeTabId = canvasTabRouter.getActiveTabId();

    for (const [tabId, inst] of canvasStoreRegistry.instances) {
        const state = inst.getState();

        if (tabId === activeTabId) {
            // Active tab: viewport-based 3-Zone protection
            const { boardImages, pan, zoom } = state;

            const mainPanel = document.getElementById('main-panel');
            const vw = mainPanel?.clientWidth || window.innerWidth;
            const vh = mainPanel?.clientHeight || window.innerHeight;

            const viewLeft = -pan.x / zoom;
            const viewTop = -pan.y / zoom;
            const viewWidth = vw / zoom;
            const viewHeight = vh / zoom;

            // Nearby padding: 뷰포트 최대 변의 0.5배 (1.5x 뷰포트 영역)
            const pad = Math.max(viewWidth, viewHeight) * 0.5;

            for (const img of boardImages) {
                // [FIX POPOVER] Popover-registered images bypass Zone classification —
                // protect every LOD so they remain valid while displayed in any panel.
                if (popoverIds.has(img.id)) {
                    if (img.tinySrc) activeUrls.add(img.tinySrc);
                    if (img.thumbnailSrc) activeUrls.add(img.thumbnailSrc);
                    if (img.src) activeUrls.add(img.src);
                    if (img.proxySrc) activeUrls.add(img.proxySrc);
                    if (img.previewSrc) activeUrls.add(img.previewSrc);
                    if (img.maskSrc) activeUrls.add(img.maskSrc);
                    if (img.originalSrc) activeUrls.add(img.originalSrc);
                    if (img.highResSrc) activeUrls.add(img.highResSrc);
                    if (img.ktx2Src) activeUrls.add(img.ktx2Src);
                    continue;
                }

                // tinySrc는 항상 보호 (Zone 1/2 공통, 128px = ~64KB로 매우 작음)
                if (img.tinySrc) activeUrls.add(img.tinySrc);

                // [FIX] 역할이 있는 이미지는 thumbnailSrc 항상 보호
                // RoleThumbnails 바가 뷰포트 위치와 무관하게 항상 표시하기 때문
                if (img.role !== 'none' && img.thumbnailSrc) {
                    activeUrls.add(img.thumbnailSrc);
                }

                // 뷰포트 + padding 영역 내에 있는지 판단
                const isNearViewport = (
                    img.x < viewLeft + viewWidth + pad &&
                    img.x + img.width > viewLeft - pad &&
                    img.y < viewTop + viewHeight + pad &&
                    img.y + img.height > viewTop - pad
                );

                if (isNearViewport) {
                    // Zone 1: 뷰포트 내/근처 — 작업에 필요한 URL 보호
                    if (img.src) activeUrls.add(img.src);
                    if (img.thumbnailSrc) activeUrls.add(img.thumbnailSrc);
                    if (img.proxySrc) activeUrls.add(img.proxySrc);
                    if (img.previewSrc) activeUrls.add(img.previewSrc);
                    if (img.maskSrc) activeUrls.add(img.maskSrc);
                    if (img.originalSrc) activeUrls.add(img.originalSrc);
                    if (img.highResSrc) activeUrls.add(img.highResSrc);
                    if (img.ktx2Src) activeUrls.add(img.ktx2Src);
                } else {
                    // Zone 2 (Far): tinySrc만 보호됨 → 나머지는 safeCleanup에서 해제 가능
                    // 안전장치: File 객체도 filePath도 없는 이미지는 blob 해제 시 복원 불가능하므로 보호
                    const hasFileBackup = !!(img.file || img.originalFile || img.previewFile || img.proxyFile || img.tinyFile);
                    const hasPathBackup = !!(img.filePath || img.originalFilePath || img.previewFilePath || img.proxyFilePath || img.tinyFilePath);
                    const hasSrcFallback = !!(img.src?.startsWith('file://') || img.originalSrc?.startsWith('file://'));
                    if (!hasFileBackup && !hasPathBackup && !hasSrcFallback) {
                        // 복원 수단이 없으면 모든 URL 보호 (데이터 손실 방지)
                        if (img.src) activeUrls.add(img.src);
                        if (img.thumbnailSrc) activeUrls.add(img.thumbnailSrc);
                        if (img.proxySrc) activeUrls.add(img.proxySrc);
                        if (img.previewSrc) activeUrls.add(img.previewSrc);
                        if (img.maskSrc) activeUrls.add(img.maskSrc);
                        if (img.originalSrc) activeUrls.add(img.originalSrc);
                        if (img.highResSrc) activeUrls.add(img.highResSrc);
                        if (img.ktx2Src) activeUrls.add(img.ktx2Src);
                    }
                    // [FIX] 편집 도구(LassoOverlay, Sam3dPanel 등)가 img.src/maskSrc를 직접 사용하므로
                    // blob URL은 Zone 2에서도 항상 보호. File 객체가 있어도 blob revoke는
                    // 실제 메모리를 절약하지 않음 (이미지 데이터는 File 객체에 남아 있음).
                    if (img.src?.startsWith('blob:')) activeUrls.add(img.src);
                    if (img.maskSrc?.startsWith('blob:')) activeUrls.add(img.maskSrc);
                    // [FIX STALE-BLOB] originalSrc blob도 보호 — ensureBoardImageFile('original')이
                    // 이 URL을 사용하므로, revoke되면 이미지 생성 시 ERR_FILE_NOT_FOUND 발생
                    if (img.originalSrc?.startsWith('blob:')) activeUrls.add(img.originalSrc);
                }
            }
        } else {
            // Inactive tabs: protect all LOD URLs unconditionally.
            // viewport-based cleanup cannot safely evict blobs from tabs not currently visible —
            // pan/zoom context is different and the user can switch back at any time.
            for (const img of state.boardImages) {
                if (img.tinySrc) activeUrls.add(img.tinySrc);
                if (img.thumbnailSrc) activeUrls.add(img.thumbnailSrc);
                if (img.src) activeUrls.add(img.src);
                if (img.proxySrc) activeUrls.add(img.proxySrc);
                if (img.previewSrc) activeUrls.add(img.previewSrc);
                if (img.originalSrc) activeUrls.add(img.originalSrc);
                if (img.maskSrc) activeUrls.add(img.maskSrc);
                if (img.highResSrc) activeUrls.add(img.highResSrc);
                if (img.ktx2Src) activeUrls.add(img.ktx2Src);
            }
        }
    }

    return activeUrls;
}

/**
 * Hook for memory monitoring and cleanup
 */
export function useMemoryCleanup(options: Partial<MemoryCleanupOptions> = {}) {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    const [stats, setStats] = useState<MemoryStats>({
        blobUrlCount: 0,
        estimatedMemoryMB: 0,
        textureCount: 0,
        vramUsageMB: 0,
        lastCleanupTime: null,
    });

    const viewportCleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastCleanupTimeRef = useRef<number | null>(null);

    // Update memory stats
    const updateStats = useCallback(() => {
        const blobStats = blobManager.getMemoryStats();

        setStats(prev => ({
            ...prev,
            blobUrlCount: blobStats.urlCount,
            estimatedMemoryMB: blobStats.estimatedMB,
            lastCleanupTime: lastCleanupTimeRef.current,
        }));
    }, []);

    // Force garbage collection hint (if available)
    const forceGC = useCallback(() => {
        if (typeof window !== 'undefined' && 'gc' in window) {
            try {
                (window as any).gc();
                console.log('[MemoryCleanup] GC requested');
            } catch (e) {
                console.log('[MemoryCleanup] GC not available');
            }
        }
    }, []);

    // Lightweight cleanup — blob URLs only (used by auto/viewport cleanup)
    const cleanup = useCallback(async (): Promise<CleanupResult> => {
        try {
            const activeUrls = getActiveImageUrls();
            const result = blobManager.safeCleanup(activeUrls);

            lastCleanupTimeRef.current = Date.now();
            updateStats();

            const freedMB = Math.round(result.freedMemoryEstimate / (1024 * 1024) * 10) / 10;
            console.log(`[MemoryCleanup] Cleaned ${result.cleaned.length} URLs, freed ~${freedMB}MB`);

            return {
                cleanedUrls: result.cleaned.length,
                freedMemoryMB: freedMB,
                texturesCleaned: false,
                success: true,
                offloadedImages: 0,
            };
        } catch (error) {
            console.error('[MemoryCleanup] Cleanup failed:', error);
            return { cleanedUrls: 0, freedMemoryMB: 0, texturesCleaned: false, success: false, offloadedImages: 0 };
        }
    }, [updateStats]);

    // Soft refresh — File disk offloading + VRAM reset + reload
    // Offloads in-memory File objects to disk (via saveTempFile) for real GB-level memory recovery,
    // then resets all VRAM textures and reloads visible images from file:// URLs.
    // Reuses the same pattern as Post-Load Offloading in App.tsx.
    const softRefresh = useCallback(async (): Promise<CleanupResult> => {
        try {
            // --- Phase 0: GPU 텍스처 오프스크린 퇴출 (VRAM 해제) ---
            // Worker가 내부 상태로 뷰포트 계산 → off-screen PREVIEW/FULL 텍스처 퇴출
            // TINY는 절대 퇴출 안 함; 현재 화면 텍스처도 보호됨
            const evictNonce = Math.random().toString(36).slice(2, 9);
            const evictResult = await new Promise<{ freedMB: number; evictedCount: number }>((resolve) => {
                const timer = setTimeout(() => {
                    window.removeEventListener('canvas-evict-complete' as any, handleComplete);
                    resolve({ freedMB: 0, evictedCount: 0 });
                }, 2000);
                const handleComplete = (e: Event) => {
                    const detail = (e as CustomEvent).detail;
                    if (detail?.nonce !== evictNonce) return; // ignore stale events
                    clearTimeout(timer);
                    window.removeEventListener('canvas-evict-complete' as any, handleComplete);
                    resolve(detail || { freedMB: 0, evictedCount: 0 });
                };
                window.addEventListener('canvas-evict-complete' as any, handleComplete);
                window.dispatchEvent(new CustomEvent('canvas-evict-offscreen', { detail: { nonce: evictNonce } }));
            });
            console.log(`[SoftRefresh] Phase 0: ${evictResult.evictedCount} textures evicted (~${evictResult.freedMB.toFixed(1)}MB VRAM)`);

            const { boardImages, setBoardImages } = useCanvasStore.getState();

            // --- Phase 1: File Disk Offloading ---
            let offloadedCount = 0;
            const blobsToRelease: string[] = []; // Collect blobs to release after delta sync
            const FILE_KEYS: { fileKey: keyof BoardImage; pathKey: keyof BoardImage; srcKey: keyof BoardImage }[] = [
                { fileKey: 'file', pathKey: 'filePath', srcKey: 'src' },
                { fileKey: 'originalFile', pathKey: 'originalFilePath', srcKey: 'originalSrc' },
                { fileKey: 'previewFile', pathKey: 'previewFilePath', srcKey: 'previewSrc' },
                { fileKey: 'proxyFile', pathKey: 'proxyFilePath', srcKey: 'proxySrc' },
                { fileKey: 'tinyFile', pathKey: 'tinyFilePath', srcKey: 'tinySrc' },
            ];

            const hasElectronAPI = !!window.electronAPI?.saveTempFile;
            const hasFileExists = !!window.electronAPI?.fileExists;
            let fileToBase64: ((file: File) => Promise<string>) | null = null;
            if (hasElectronAPI) {
                const mod = await import('../services/gemini/imageUtils');
                fileToBase64 = mod.fileToBase64;
            }

            // Helper: save File to disk, null it, swap src to file://
            const saveFileToDisk = async (
                file: File, newImg: any, fileKey: string, pathKey: string, srcKey: string, imgId: string
            ): Promise<boolean> => {
                if (!hasElectronAPI || !fileToBase64) return false;
                try {
                    const base64 = await fileToBase64(file);
                    const ext = file.type === 'image/jpeg' ? '.jpg' : (file.type === 'image/webp' ? '.webp' : '.png');
                    const suffix = fileKey === 'file' ? '' : `_${fileKey.replace('File', '')}`;
                    const filename = `offload_${imgId}${suffix}${ext}`;
                    const saved = await window.electronAPI!.saveTempFile(filename, base64);

                    if (saved.success && saved.filePath) {
                        newImg[fileKey] = undefined;
                        newImg[pathKey] = saved.filePath;
                        const fileUrl = `file:///${saved.filePath.replace(/\\/g, '/')}`;
                        const currentSrc = newImg[srcKey] as string | undefined;
                        if (currentSrc && currentSrc.startsWith('blob:')) {
                            blobsToRelease.push(currentSrc);
                        }
                        newImg[srcKey] = fileUrl;
                        return true;
                    }
                } catch (e) {
                    console.warn(`[SoftRefresh] Failed to save ${fileKey} for ${imgId}`, e);
                }
                return false;
            };

            const updatedImages: BoardImage[] = [];
            let imageOffloaded = false;
            let stalePathCount = 0;
            let verifiedPathCount = 0;
            let newSaveCount = 0;

            for (const img of boardImages) {
                // Check if this image has any in-memory File objects worth offloading
                const hasAnyFile = FILE_KEYS.some(({ fileKey }) => !!(img as any)[fileKey]);
                if (!hasAnyFile) {
                    updatedImages.push(img);
                    continue;
                }

                const newImg = { ...img };
                imageOffloaded = false;

                for (const { fileKey, pathKey, srcKey } of FILE_KEYS) {
                    const file = (img as any)[fileKey] as File | undefined;
                    if (!file) continue;

                    const existingPath = (img as any)[pathKey] as string | undefined;

                    if (existingPath) {
                        // Case A: filePath exists → verify file on disk before trusting
                        const fileOnDisk = hasFileExists
                            ? await window.electronAPI!.fileExists(existingPath)
                            : false;

                        if (fileOnDisk) {
                            // Verified: file exists on disk → safe to null File and swap src
                            (newImg as any)[fileKey] = undefined;
                            const currentSrc = (img as any)[srcKey] as string | undefined;
                            if (currentSrc && currentSrc.startsWith('blob:')) {
                                const fileUrl = `file:///${existingPath.replace(/\\/g, '/')}`;
                                (newImg as any)[srcKey] = fileUrl;
                                blobsToRelease.push(currentSrc);
                            }
                            imageOffloaded = true;
                            verifiedPathCount++;
                        } else {
                            // Stale filePath → re-save via Case B
                            stalePathCount++;
                            if (await saveFileToDisk(file, newImg, fileKey, pathKey, srcKey, img.id)) {
                                imageOffloaded = true;
                            }
                        }
                    } else {
                        // Case B: no filePath → save to temp disk first, then null
                        if (await saveFileToDisk(file, newImg, fileKey, pathKey, srcKey, img.id)) {
                            imageOffloaded = true;
                            newSaveCount++;
                        }
                    }
                }

                if (imageOffloaded) offloadedCount++;

                // [FIX] thumbnailSrc를 tinySrc와 동기화
                // tinyFile offload 후 tinySrc가 file:// URL로 변경되면
                // thumbnailSrc도 갱신해야 RoleThumbnails에서 깨지지 않음
                if (newImg.tinySrc && newImg.thumbnailSrc !== newImg.tinySrc) {
                    newImg.thumbnailSrc = newImg.tinySrc;
                }

                updatedImages.push(newImg);
            }

            // Update store if any images were offloaded
            if (offloadedCount > 0) {
                setBoardImages(() => updatedImages);
                console.log(`[SoftRefresh] Offloaded ${offloadedCount} images (verified: ${verifiedPathCount}, stale→resaved: ${stalePathCount}, new: ${newSaveCount})`);
            }

            // --- Phase 2: Blob URL cleanup ---
            // forceCleanup: 5s grace period (vs safeCleanup's 30s) for explicit optimization action
            const activeUrls = getActiveImageUrls();
            const blobResult = blobManager.forceCleanup(activeUrls, 5000);

            // Delay release of offloaded blob URLs by 500ms to allow delta sync
            // to reach the Worker before revoking old blob URLs.
            // This prevents ERR_FILE_NOT_FOUND when Worker still references stale blob URLs.
            if (blobsToRelease.length > 0) {
                setTimeout(() => {
                    for (const url of blobsToRelease) {
                        blobManager.release(url);
                    }
                    console.log(`[SoftRefresh] Released ${blobsToRelease.length} old blob URLs (delayed)`);
                    // Run safeCleanup again after releasing collected blobs
                    const postReleaseActiveUrls = getActiveImageUrls();
                    blobManager.safeCleanup(postReleaseActiveUrls);
                }, 500);
            }

            // --- Phase 3: GC hint ---
            // Note: canvas-soft-refresh NOT dispatched here — it would destroy ALL textures
            // and trigger 400+ simultaneous file:// reload requests (thundering herd).
            // Instead, setBoardImages() triggers delta sync → worker keeps existing VRAM textures
            // and only re-fetches visible images with changed src URLs.
            forceGC();

            lastCleanupTimeRef.current = Date.now();
            updateStats();

            const blobFreedMB = Math.round(blobResult.freedMemoryEstimate / (1024 * 1024) * 10) / 10;
            const totalFreedMB = Math.round((blobFreedMB + evictResult.freedMB) * 10) / 10;
            console.log(`[SoftRefresh] Offloaded: ${offloadedCount} images, Blob: ${blobResult.cleaned.length} URLs (~${blobFreedMB}MB), VRAM: ~${evictResult.freedMB.toFixed(1)}MB, Deferred: ${blobsToRelease.length} blobs`);

            return {
                cleanedUrls: blobResult.cleaned.length + blobsToRelease.length,
                freedMemoryMB: totalFreedMB,
                texturesCleaned: evictResult.evictedCount > 0,
                success: true,
                offloadedImages: offloadedCount,
                vramFreedMB: evictResult.freedMB,
            };
        } catch (error) {
            console.error('[SoftRefresh] Failed:', error);
            return { cleanedUrls: 0, freedMemoryMB: 0, texturesCleaned: false, success: false, offloadedImages: 0 };
        }
    }, [updateStats, forceGC]);

    // [Viewport-Based Cleanup] 뷰포트 기반 주기적 cleanup
    // 시간 기반이 아닌 뷰포트 거리 기반이므로 안전 (off-screen blob만 해제)
    useEffect(() => {
        if (!mergedOptions.viewportCleanupEnabled) {
            if (viewportCleanupTimerRef.current) {
                clearInterval(viewportCleanupTimerRef.current);
                viewportCleanupTimerRef.current = null;
            }
            return;
        }

        viewportCleanupTimerRef.current = setInterval(() => {
            const imageCount = useCanvasStore.getState().boardImages.length;
            if (imageCount < mergedOptions.viewportCleanupMinImages) return;

            const activeUrls = getActiveImageUrls();
            const result = blobManager.safeCleanup(activeUrls);

            if (result.cleaned.length > 0) {
                const freedMB = Math.round(result.freedMemoryEstimate / (1024 * 1024) * 10) / 10;
                console.log(`[ViewportCleanup] Released ${result.cleaned.length} off-screen blobs (~${freedMB}MB)`);

                // [SIMPLIFIED] No canvas-cleanup-textures dispatch — Worker LRU handles GPU textures independently

                updateStats();
            }
        }, mergedOptions.viewportCleanupIntervalMs);

        return () => {
            if (viewportCleanupTimerRef.current) {
                clearInterval(viewportCleanupTimerRef.current);
                viewportCleanupTimerRef.current = null;
            }
        };
    }, [mergedOptions.viewportCleanupEnabled, mergedOptions.viewportCleanupIntervalMs, mergedOptions.viewportCleanupMinImages, updateStats]);

    // Update stats periodically
    useEffect(() => {
        updateStats(); // Initial update

        const interval = setInterval(updateStats, 5000); // Update every 5 seconds

        return () => clearInterval(interval);
    }, [updateStats]);

    return {
        stats,
        cleanup,
        softRefresh,
        forceGC,
        updateStats,
    };
}

export default useMemoryCleanup;
