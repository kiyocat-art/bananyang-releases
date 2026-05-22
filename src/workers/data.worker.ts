// src/workers/data.worker.ts
import { BoardImage, GeneratedMedia } from '../types';

// WASM LOD processor removed (unused)
// let wasmInitialized = false;
// let wasmPath: string | undefined;

// [ELECTRON FIX] Explicitly initialize WASM with path from main thread
// This avoids 'import.meta.url' failure in bundled worker
async function ensureWasm(): Promise<void> {
    // No-op for removed WASM
}

// ===== KTX2 Encoding with Basis Universal =====
let basisEncoderModule: any = null;
let basisEncoderWasmPath: string | null = null;

function setBasisWasmPath(path: string): void {
    basisEncoderWasmPath = path;
    console.log('[data.worker] Basis WASM path set:', path);
}

async function ensureBasisEncoder(): Promise<any> {
    if (basisEncoderModule) return basisEncoderModule;
    if (!basisEncoderWasmPath) {
        throw new Error('Basis encoder WASM path not set. Call init-ktx2 first.');
    }

    try {
        // Dynamic import of basis_encoder.js
        const scriptUrl = basisEncoderWasmPath.replace('basis_encoder.wasm', 'basis_encoder.js');
        (self as unknown as { importScripts: (url: string) => void }).importScripts(scriptUrl);

        // @ts-ignore - BASIS is loaded globally by importScripts (loaders.gl exports as 'BASIS')
        const BASIS = (self as any).BASIS;
        if (!BASIS) {
            throw new Error('BASIS not found after loading script');
        }

        // Initialize with WASM path
        basisEncoderModule = await BASIS({ wasmBinary: await fetchWasmBinary(basisEncoderWasmPath) });
        console.log('[data.worker] Basis encoder initialized successfully');
        return basisEncoderModule;
    } catch (e) {
        // Silent fail - Basis encoder is optional (doesn't work in Electron file:// protocol)
        throw e;
    }
}

async function fetchWasmBinary(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
}

async function encodeToKTX2(imageData: Uint8Array, width: number, height: number): Promise<Blob> {
    const basis = await ensureBasisEncoder();

    // Create encoder instance
    const encoder = new basis.BasisEncoder();

    try {
        // Configure for UASTC (high quality, GPU-friendly)
        encoder.setCreateKTX2File(true);
        encoder.setKTX2UASTCSupercompression(true); // Zstd compression on top
        encoder.setUASTC(true);
        encoder.setMipGen(true); // Generate mipmaps
        encoder.setQualityLevel(128); // UASTC quality (0-255)
        encoder.setDebug(false);

        // Set image data (RGBA format)
        encoder.setSliceSourceImage(0, imageData, width, height, false);

        // Pre-allocate output buffer (estimate: ~1.5x input for safety)
        const maxOutputSize = width * height * 4 * 2; // RGBA * 2 for safety margin
        const outputBuffer = new Uint8Array(maxOutputSize);

        // Encode - returns actual bytes written
        const bytesWritten = encoder.encode(outputBuffer);
        if (bytesWritten === 0) {
            throw new Error('Basis encoding failed - no bytes written');
        }

        // Trim to actual size
        const ktx2FileData = outputBuffer.slice(0, bytesWritten);

        console.log(`[data.worker] KTX2 encoded: ${width}x${height} -> ${(bytesWritten / 1024).toFixed(1)}KB`);

        return new Blob([ktx2FileData], { type: 'image/ktx2' });
    } finally {
        encoder.delete();
    }
}

// ------------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------------

// Robust p-limit implementation with progress tracking capability
// Robust p-limit implementation with progress tracking capability
const runWithLimit = async <T>(
    tasks: (() => Promise<T>)[],
    limit: number,
    onProgress?: (count: number, total: number) => void
): Promise<T[]> => {
    const total = tasks.length;
    if (total === 0) return [];

    const results: T[] = new Array(total);
    let nextIndex = 0;
    let completed = 0;

    const worker = async () => {
        while (nextIndex < total) {
            const currentIndex = nextIndex++;
            try {
                results[currentIndex] = await tasks[currentIndex]();
            } catch (err) {
                console.error('[runWithLimit] Task failed (index:', currentIndex, '):', err);
                // [FIX] Don't throw - return undefined so one failure doesn't abort the entire batch
                results[currentIndex] = undefined as any;
            } finally {
                completed++;
                if (onProgress) onProgress(completed, total);
            }
        }
    };

    const numWorkers = Math.min(limit, total);
    const workers = [];
    for (let i = 0; i < numWorkers; i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    return results;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as a base64 string.'));
            }
        };
        reader.onerror = error => reject(error);
    });
};

const dataURLtoFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
};

// Helper to recursively remove blob URLs from objects (e.g., generationParams)
const sanitizeBlobUrls = (obj: any): any => {
    if (!obj) return obj;
    if (typeof obj === 'string') {
        return obj.startsWith('blob:') ? '' : obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeBlobUrls);
    }
    if (typeof obj === 'object') {
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = sanitizeBlobUrls(obj[key]);
        }
        return newObj;
    }
    return obj;
};

// 최적화된 썸네일 생성 함수 - Returns File object (NOT blob URL!)
// [FIX] Worker context blob URLs are invalid in main thread
// [PERF] Accept ImageBitmap to avoid re-decoding
async function generateTinyFile(source: File | ImageBitmap): Promise<File | null> {
    let bitmap: ImageBitmap | null = null;
    let canvas: OffscreenCanvas | null = null;
    try {
        // 1. 고속 리사이징 (GPU 가속)
        // If source is ImageBitmap, createImageBitmap will use it efficiently
        bitmap = await createImageBitmap(source, {
            resizeWidth: 128,
            resizeQuality: 'medium'
        });

        // 2. Zero-Copy 전송
        canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('bitmaprenderer');

        if (ctx && bitmap) {
            ctx.transferFromImageBitmap(bitmap); // bitmap은 여기서 소유권 이전됨 (Closed)
        } else {
            // Fallback (혹시 모를 호환성 대비)
            const ctx2d = canvas.getContext('2d');
            ctx2d?.drawImage(bitmap, 0, 0);
        }

        // 3. Return File object (NOT URL - URLs created in worker are invalid in main thread!)
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.7 });
        return new File([blob], 'tiny.webp', { type: 'image/webp' });

    } catch (e) {
        console.error('Tiny gen failed:', e);
        return null;
    } finally {
        if (bitmap && typeof bitmap.close === 'function') {
            bitmap.close();
        }
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}

// Preview file generation (1024px for default viewing) - 3-Stage LOD System
// Preview file generation (1024px for default viewing) - 3-Stage LOD System
async function generatePreviewFile(
    source: File | ImageBitmap,
    knownDimensions?: { width: number; height: number }
): Promise<File | null> {
    let bitmap: ImageBitmap | null = null;
    let tempBitmap: ImageBitmap | null = null;
    let canvas: OffscreenCanvas | null = null;
    try {
        // 1. 크기 체크 - 1K 이하면 원본 반환
        let srcWidth: number;
        let srcHeight: number;
        if (knownDimensions) {
            srcWidth = knownDimensions.width;
            srcHeight = knownDimensions.height;
        } else {
            tempBitmap = await createImageBitmap(source);
            srcWidth = tempBitmap.width;
            srcHeight = tempBitmap.height;
            tempBitmap.close();
            tempBitmap = null;
        }

        const maxDim = Math.max(srcWidth, srcHeight);
        if (maxDim <= 1024) {
            return (source instanceof File) ? source : null;
        }

        // 2. 1K로 리사이즈 (비율 유지)
        const scale = 1024 / maxDim;
        const targetWidth = Math.round(srcWidth * scale);
        const targetHeight = Math.round(srcHeight * scale);



        bitmap = await createImageBitmap(source, {
            resizeWidth: targetWidth,
            resizeHeight: targetHeight,
            resizeQuality: 'high'
        });

        // 3. Zero-Copy 전송
        canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('bitmaprenderer');

        if (ctx && bitmap) {
            ctx.transferFromImageBitmap(bitmap);
            bitmap = null; // 소유권 이전됨
        } else {
            const ctx2d = canvas.getContext('2d');
            ctx2d?.drawImage(bitmap, 0, 0);
        }

        // 4. WebP Q85로 저장
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
        return new File([blob], 'preview.webp', { type: 'image/webp' });

    } catch (e) {
        console.error('Preview gen failed:', e);
        return null;
    } finally {
        if (tempBitmap?.close) tempBitmap.close();
        if (bitmap?.close) bitmap.close();
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}

/** 4K(4096px) 초과 이미지를 4K WebP로 다운사이즈. 이하면 원본 반환. */
const MAX_CANVAS_4K = 4096;
async function downsizeTo4K(source: File): Promise<File> {
    let bitmap: ImageBitmap | null = null;
    let resized: ImageBitmap | null = null;
    let canvas: OffscreenCanvas | null = null;
    try {
        bitmap = await createImageBitmap(source);
        const maxDim = Math.max(bitmap.width, bitmap.height);
        if (maxDim <= MAX_CANVAS_4K) {
            return source; // 4K 이하 — 그대로 반환
        }
        const scale = MAX_CANVAS_4K / maxDim;
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        bitmap.close();
        bitmap = null;

        resized = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
        canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('bitmaprenderer');
        if (ctx) {
            ctx.transferFromImageBitmap(resized);
            resized = null; // 소유권 이전
        } else {
            const ctx2d = canvas.getContext('2d');
            ctx2d?.drawImage(resized, 0, 0);
        }
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.92 });
        return new File([blob], source.name.replace(/\.[^/.]+$/, '') + '_4k.webp', { type: 'image/webp' });
    } catch (e) {
        console.error('[Worker] 4K downsize failed:', e);
        return source; // 실패 시 원본 fallback
    } finally {
        if (bitmap?.close) bitmap.close();
        if (resized?.close) resized.close();
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}

// Full-resolution WebP for canvas display (original PNG kept separately for download)
async function generateDisplayWebp(source: File | ImageBitmap): Promise<File | null> {
    let bitmap: ImageBitmap | null = null;
    let canvas: OffscreenCanvas | null = null;
    try {
        bitmap = await createImageBitmap(source);
        canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('bitmaprenderer');
        if (ctx) {
            ctx.transferFromImageBitmap(bitmap);
            bitmap = null;
        } else {
            const ctx2d = canvas.getContext('2d');
            ctx2d?.drawImage(bitmap, 0, 0);
        }
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.92 });
        return new File([blob], 'display.webp', { type: 'image/webp' });
    } catch (e) {
        console.error('Display WebP gen failed:', e);
        return null;
    } finally {
        if (bitmap?.close) bitmap.close();
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
}

// [FIX B-3] generateThumbnail removed - Worker blob URLs are invalid in main thread
// Use generateTinyFile() instead, which returns a File object for main thread blob URL creation

const generateTiles = async (source: File | ImageBitmap, tileSize = 512): Promise<any[]> => {
    // Tiling threshold: only tile images larger than 4096px
    const TILING_THRESHOLD = 4096;

    try {
        const bitmap = await createImageBitmap(source);
        const width = bitmap.width;
        const height = bitmap.height;

        if (width <= TILING_THRESHOLD && height <= TILING_THRESHOLD) {
            bitmap.close();
            return [];
        }

        const cols = Math.ceil(width / tileSize);
        const rows = Math.ceil(height / tileSize);
        const tiles: any[] = [];

        const canvas = new OffscreenCanvas(tileSize, tileSize);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close();
            return [];
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const tileX = x * tileSize;
                const tileY = y * tileSize;
                const tileWidth = Math.min(tileSize, width - tileX);
                const tileHeight = Math.min(tileSize, height - tileY);

                ctx.clearRect(0, 0, tileSize, tileSize);
                ctx.drawImage(bitmap, tileX, tileY, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);

                const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
                // [FIX MEMORY LEAK] Do not create object URL in worker. Return blob directly.
                // const tileUrl = URL.createObjectURL(blob);

                tiles.push({
                    x: tileX,
                    y: tileY,
                    width: tileWidth,
                    height: tileHeight,
                    src: '', // Main thread will populate this
                    blob: blob, // Transfer ownership to main thread
                    isLoaded: true
                });
            }
        }
        bitmap.close();
        canvas.width = 0; canvas.height = 0; // Release canvas backing buffer
        return tiles;
    } catch (e) {
        console.warn('[data.worker] generateTiles failed:', e);
        return [];
    }
};

self.onmessage = async (event: MessageEvent) => {
    const { id, type, payload } = event.data;

    try {
        let result: any;
        switch (type) {
            case 'process-files-for-canvas': {
                await ensureWasm();
                // [CONCURRENCY] Limit parallel processing to 8 files
                result = (await runWithLimit(
                    payload.map((file: File) => async () => {
                        // Generate metadata, etc.
                        // Generate metadata, etc.
                        // [PERF] Decode once, use for all operations
                        const bitmap = await createImageBitmap(file);
                        const naturalWidth = bitmap.width;
                        const naturalHeight = bitmap.height;

                        // Pass bitmap to generators to avoid re-decoding
                        const tiles = await generateTiles(bitmap);
                        const tinyFileObj = await generateTinyFile(bitmap);
                        const tinyFile = tinyFileObj || file;
                        const previewFileObj = await generatePreviewFile(bitmap, { width: naturalWidth, height: naturalHeight });
                        const previewFile = previewFileObj || file;

                        bitmap.close();

                        return {
                            file: file,
                            src: '',
                            proxySrc: '',
                            proxyFile: previewFile,
                            tinySrc: '',
                            tinyFile: tinyFile,
                            previewSrc: '',
                            previewFile: previewFile,
                            originalSrc: '',
                            originalFile: file,
                            thumbnailSrc: '',
                            tiles,
                            isTiled: tiles.length > 0,
                            tileSize: 512,
                            naturalWidth,
                            naturalHeight,
                        };
                    }),
                    8
                )).filter(Boolean);
                break;
            }
            case 'process-media-for-canvas': {
                // [CONCURRENCY] Limit parallel processing to 8 items
                result = (await runWithLimit(
                    payload.map((item: GeneratedMedia) => async () => {
                        const file = await dataURLtoFile(item.src, `generated-${item.id}.png`);
                        // [PERF] Decode once
                        const bitmap = await createImageBitmap(file);
                        const naturalWidth = bitmap.width;
                        const naturalHeight = bitmap.height;

                        // [FIX B-3] Removed legacy generateThumbnail() - Worker blob URLs are invalid in main thread
                        // tinySrc/tinyFile are used instead (main thread creates blob URLs from File objects)
                        const tiles = await generateTiles(bitmap);
                        const tinyFileObj = await generateTinyFile(bitmap);
                        const tinyFile = tinyFileObj || file;
                        const previewFileObj = await generatePreviewFile(bitmap, { width: naturalWidth, height: naturalHeight });
                        const previewFile = previewFileObj || file;

                        bitmap.close();

                        return {
                            ...item,
                            file,
                            src: item.src,
                            proxySrc: item.src,
                            originalSrc: item.src,
                            proxyFile: previewFile,
                            originalFile: file,
                            thumbnailSrc: '', // [FIX B-3] Empty - main thread will use tinySrc
                            tinyFile,
                            tinySrc: '',
                            previewFile,
                            previewSrc: '',
                            tiles,
                            isTiled: tiles.length > 0,
                            tileSize: 512,
                            naturalWidth,
                            naturalHeight,
                        };
                    }),
                    8
                )).filter(Boolean);
                break;
            }


            case 'serialize-workspace': {
                const { boardImages, ...rest } = payload;
                const serializableImages = await Promise.all(boardImages.map(async (img: BoardImage) => {
                    let fileToSave = img.file;
                    // PNG -> WebP optimization
                    if (fileToSave.type === 'image/png') {
                        let bitmap: ImageBitmap | null = null;
                        let canvas: OffscreenCanvas | null = null;
                        try {
                            bitmap = await createImageBitmap(fileToSave);
                            canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(bitmap, 0, 0);
                                const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
                                fileToSave = new File([blob], fileToSave.name.replace(/\.png$/i, '.webp'), { type: 'image/webp' });
                            }
                        } catch (e) {
                            console.error('Failed to convert PNG to WebP during save:', e);
                        } finally {
                            if (bitmap) bitmap.close();
                            if (canvas) { canvas.width = 0; canvas.height = 0; }
                        }
                    }
                    const base64 = await fileToBase64(fileToSave);
                    // [FIX] Remove ALL blob URL fields - they are session-specific and become invalid after app restart
                    // Only save essential metadata and file data. LOD files will be regenerated on load.
                    const {
                        file, src, thumbnailSrc,
                        // All blob URLs - must not be saved
                        proxySrc, tinySrc, previewSrc, originalSrc, ktx2Src, highResSrc,
                        // [FIX] Explicitly remove mask blob URLs
                        maskSrc, maskFile,
                        // All File objects - will be regenerated from base64
                        proxyFile, tinyFile, previewFile, originalFile,
                        // Sanitize generationParams (deep check for blobs)
                        generationParams,
                        ...restOfImage
                    } = img;

                    // [FIX B-6] Skip originalFile serialization if it's the same object as file
                    const skipOriginal = img.originalFile && img.originalFile === img.file;

                    return {
                        ...restOfImage,
                        generationParams: sanitizeBlobUrls(generationParams),
                        fileData: { name: fileToSave.name, type: fileToSave.type, base64 },
                        _originalSameAsFile: skipOriginal || undefined,
                    };
                }));
                result = JSON.stringify({ ...rest, boardImages: serializableImages });
                break;
            }
            case 'deserialize-workspace': {
                await ensureWasm();
                const data = JSON.parse(payload);
                // [FIX] Filter out null entries (can occur if save skipped images with missing Files)
                const validBoardImages = data.boardImages.filter((img: any) => img != null);
                // [CONCURRENCY] Use runWithLimit with progress reporting
                const total = validBoardImages.length;
                if (total > 0) {
                    // Initial progress
                    self.postMessage({ id, type: 'progress', payload: { count: 0, total } });
                }
                const newBoardImages: BoardImage[] = await runWithLimit(
                    validBoardImages.map((savedImg: any) => async () => {
                        if (!savedImg.fileData) {
                            return { ...savedImg, src: '', error: 'Legacy format' };
                        }
                        const dataUrl = `data:${String(savedImg.fileData.type)};base64,${String(savedImg.fileData.base64)}`;
                        const rawFile = await dataURLtoFile(dataUrl, String(savedImg.fileData.name));
                        // 4K 초과 이미지 자동 다운사이즈 (원본 제거)
                        const file = await downsizeTo4K(rawFile);
                        // [3-Stage LOD]
                        const tinyFile = await generateTinyFile(file);
                        const previewFile = await generatePreviewFile(file);

                        return {
                            ...savedImg,
                            src: '',
                            file,
                            proxySrc: '',
                            proxyFile: previewFile || file,
                            tinySrc: '',
                            tinyFile: tinyFile || file,
                            previewSrc: '',
                            previewFile: previewFile || file,
                            thumbnailSrc: '',
                            originalSrc: '',
                            originalFile: file,
                            // [FIX] Ensure maskSrc is cleared if it was stale
                            maskSrc: '',
                            // [FIX] Sanitize any remaining stale blobs in params
                            generationParams: sanitizeBlobUrls(savedImg.generationParams),
                        };
                    }),
                    8, // Concurrency
                    (count, total) => {
                        self.postMessage({ id, type: 'progress', payload: { count, total } });
                    }
                );
                // [FIX] Filter out failed images (undefined entries from individual task failures)
                result = { ...data, boardImages: newBoardImages.filter(Boolean) };
                break;
            }
            case 'init-wasm': {
                // No-op
                result = { initialized: true };
                break;
            }
            case 'init-ktx2': {
                const { wasmPath } = payload;
                setBasisWasmPath(wasmPath);
                result = { initialized: true };
                break;
            }
            case 'encode-ktx2': {
                const { imageId, file } = payload as { imageId: string; file: File };
                let bitmap: ImageBitmap | null = null;
                let canvas: OffscreenCanvas | null = null;
                try {
                    bitmap = await createImageBitmap(file);
                    canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Failed to get canvas context');
                    ctx.drawImage(bitmap, 0, 0);
                    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
                    const ktx2Blob = await encodeToKTX2(new Uint8Array(imageData.data.buffer), bitmap.width, bitmap.height);
                    // [FIX MEMORY LEAK] Do not create object URL in worker
                    // const ktx2Src = URL.createObjectURL(ktx2Blob);
                    result = { imageId, ktx2Blob, ktx2Src: '' };
                } catch (e) {
                    result = { imageId, ktx2Blob: null, ktx2Src: null };
                } finally {
                    if (bitmap) bitmap.close();
                    if (canvas) { canvas.width = 0; canvas.height = 0; }
                }
                break;
            }
            case 'process-generated-image': {
                const { id: imageId, base64Data, mimeType, filename } = payload as any;
                try {
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: mimeType });
                    // PNG original — kept for download
                    const originalFile = new File([blob], filename, { type: mimeType });

                    // [PERF] Decode once
                    const bitmap = await createImageBitmap(originalFile);
                    const naturalWidth = bitmap.width;
                    const naturalHeight = bitmap.height;

                    const tinyFileObj = await generateTinyFile(bitmap);       // WebP 128px
                    const tinyFile = tinyFileObj || originalFile;
                    const previewFileObj = await generatePreviewFile(bitmap, { width: naturalWidth, height: naturalHeight }); // WebP 1024px
                    const previewFile = previewFileObj || originalFile;
                    const displayFileObj = await generateDisplayWebp(bitmap); // WebP full-res for canvas
                    const displayFile = displayFileObj || originalFile;
                    const tiles = await generateTiles(bitmap);

                    // Ensure originalFile is always genuine PNG for download
                    // (Gemini may return image/webp or other formats despite requesting PNG)
                    let pngOriginalFile: File;
                    if (mimeType === 'image/png') {
                        pngOriginalFile = originalFile;
                    } else {
                        try {
                            const offscreen = new OffscreenCanvas(naturalWidth, naturalHeight);
                            offscreen.getContext('2d')!.drawImage(bitmap, 0, 0);
                            const pngBlob = await offscreen.convertToBlob({ type: 'image/png' });
                            const pngName = filename.endsWith('.png') ? filename : filename.replace(/\.[^.]+$/, '.png');
                            pngOriginalFile = new File([pngBlob], pngName, { type: 'image/png' });
                        } catch {
                            pngOriginalFile = originalFile;
                        }
                    }

                    bitmap.close();

                    result = {
                        id: imageId,
                        file: displayFile,   // WebP for canvas display
                        originalFile: pngOriginalFile,  // Always PNG for download
                        src: '',
                        proxySrc: '',
                        proxyFile: previewFile,
                        tinySrc: '',
                        tinyFile,
                        previewSrc: '',
                        previewFile,
                        thumbnailSrc: '',
                        tiles,
                        isTiled: tiles.length > 0,
                        tileSize: 512,
                        naturalWidth,
                        naturalHeight,
                        originalSrc: '',
                    };
                } catch (e) {
                    result = { id: imageId, error: String(e) };
                }
                break;
            }
        }
        self.postMessage({ id, type: 'success', payload: result });
    } catch (error) {
        self.postMessage({ id, type: 'error', payload: error instanceof Error ? error.message : String(error) });
    }
};

