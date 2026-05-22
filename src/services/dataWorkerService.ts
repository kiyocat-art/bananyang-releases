// src/services/dataWorkerService.ts
import { BoardImage, BoardGroup, GeneratedMedia } from '../types';
import { blobManager } from '../utils/blobManager';

const worker = new Worker('./data.worker.js', { type: 'module' });

type RequestEntry = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    onProgress?: (count: number, total: number) => void;
    signal?: AbortSignal;
    onAbort?: () => void;
};

const requestMap = new Map<string, RequestEntry>();

worker.onmessage = (event: MessageEvent) => {
    const { id, type, payload } = event.data;
    if (!requestMap.has(id)) return;

    const request = requestMap.get(id)!;

    if (type === 'progress') {
        if (request.onProgress) {
            request.onProgress(payload.count, payload.total);
        }
        return; // Don't delete request for progress updates
    }

    if (request.signal && request.onAbort) {
        request.signal.removeEventListener('abort', request.onAbort);
    }

    const { resolve, reject } = request;
    if (type === 'success') {
        resolve(payload);
    } else {
        reject(new Error(payload));
    }
    requestMap.delete(id);
};

function postRequest<T>(
    type: string,
    payload: any,
    onProgress?: (count: number, total: number) => void,
    signal?: AbortSignal,
): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            return;
        }

        const entry: RequestEntry = { resolve, reject, onProgress, signal };

        if (signal) {
            entry.onAbort = () => {
                if (!requestMap.has(id)) return;
                requestMap.delete(id);
                reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
            };
            signal.addEventListener('abort', entry.onAbort, { once: true });
        }

        requestMap.set(id, entry);
        // For payload with File objects, we need to list them as transferable
        const transferables = (Array.isArray(payload) && payload[0] instanceof File) ? payload : [];
        worker.postMessage({ id, type, payload }, transferables);
    });
}

export type ProcessedFileData = {
    file: File;
    src: string;
    thumbnailSrc: string;
    naturalWidth: number;
    naturalHeight: number;
};

// Helper to hydrate Blob URLs from Worker results
function hydrateBlobUrls(data: any): any {
    if (!data) return data;

    // Handle Array (e.g. processFilesForCanvas result)
    if (Array.isArray(data)) {
        return data.filter(Boolean).map(item => hydrateBlobUrls(item));
    }

    // Handle Object
    if (typeof data === 'object') {
        // 1. Handle Tiles
        if (Array.isArray(data.tiles)) {
            data.tiles.forEach((tile: any) => {
                if (tile.blob instanceof Blob) {
                    tile.src = blobManager.create(tile.blob);
                    // tile.blob = undefined; // Optional: Release reference if not needed
                }
            });
        }

        // 2. Handle KTX2
        if (data.ktx2Blob instanceof Blob) {
            data.ktx2Src = blobManager.create(data.ktx2Blob);
        }

        // 3. Handle Deserialized Images (deserialize-workspace)
        if (data.file instanceof File || data.file instanceof Blob) {
             // For main images, we usually rely on 'src' being set by caller or already being a blob URL?
             // Actually, deserialize-workspace returns 'file' objects.
             // Canvas uses 'src' for display. If 'src' is empty but 'file' exists, we should create it.
             if (!data.src && data.file) {
                 data.src = blobManager.create(data.file);
             }
        }

        // 4. Handle Preview/Tiny Files
        if (data.previewFile instanceof Blob && !data.previewSrc) {
            data.previewSrc = blobManager.create(data.previewFile);
        }
        if (data.tinyFile instanceof Blob && !data.tinySrc) {
            data.tinySrc = blobManager.create(data.tinyFile);
        }
    }

    return data;
}

export async function processFilesForCanvas(files: File[]): Promise<ProcessedFileData[]> {
    await initWasmProcessor();
    const result = await postRequest<ProcessedFileData[]>('process-files-for-canvas', files);
    return hydrateBlobUrls(result);
}

export type ProcessedMediaData = GeneratedMedia & ProcessedFileData;

export function processMediaForCanvas(media: GeneratedMedia[]): Promise<ProcessedMediaData[]> {
    // initWasmProcessor call is implicit if needed, but let's be safe if process-media uses WASM
    // process-media uses generateTiles/Thumbnail which might use WASM if we switch to WASM implementation
    // Currently JS fallback exists but let's ensure initialization
    initWasmProcessor().catch(console.warn);
    return postRequest<ProcessedMediaData[]>('process-media-for-canvas', media).then(res => hydrateBlobUrls(res));
}

type SerializableWorkspaceData = {
    version: string;
    boardImages: BoardImage[];
    boardGroups: BoardGroup[];
    leftPanelState: any;
    rightPanelState: any;
    saveDirectoryName: string | null;
    leftPanelTab: 'history' | 'chat';
    memos: any[];
};

export function serializeWorkspace(data: SerializableWorkspaceData): Promise<string> {
    return postRequest('serialize-workspace', data);
}

export async function deserializeWorkspace(
    json: string,
    onProgress?: (count: number, total: number) => void,
    signal?: AbortSignal,
): Promise<SerializableWorkspaceData> {
    await initWasmProcessor();
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    const result = await postRequest<SerializableWorkspaceData>('deserialize-workspace', json, onProgress, signal);
    // Deserialize returns BoardImages which need hydration
    if (result && result.boardImages) {
        result.boardImages = hydrateBlobUrls(result.boardImages);
    }
    return result;
}

// ===== KTX2 Encoding API =====
let ktx2Initialized = false;

export async function initKTX2Encoder(): Promise<void> {
    if (ktx2Initialized) return;

    // Skip KTX2 in Electron (file:// protocol) - importScripts doesn't work with file:// URLs
    if (window.location.protocol === 'file:') {
        console.log('[dataWorkerService] KTX2 encoder skipped (Electron file:// protocol)');
        return;
    }

    // Resolve WASM path relative to current location
    const wasmPath = new URL('assets/libs/basis_encoder.wasm', window.location.href).href;

    try {
        await postRequest<{ initialized: boolean }>('init-ktx2', { wasmPath });
        ktx2Initialized = true;
        console.log('[dataWorkerService] KTX2 encoder initialized');
    } catch (e) {
        // Silent fail - KTX2 is optional optimization
    }
}

// ===== WASM Image Processor API (LOD) =====
let wasmProcessorInitialized = false;

export async function initWasmProcessor(): Promise<void> {
    if (wasmProcessorInitialized) return;

    // Resolve WASM path relative to app root
    // This works in both Web and Electron (file://) - use href as base to avoid origin root issue
    const wasmPath = new URL('assets/libs/wasm_image_processor_bg.wasm', window.location.href).href;

    try {
        await postRequest<{ initialized: boolean }>('init-wasm', { wasmPath });
        wasmProcessorInitialized = true;
        console.log('[dataWorkerService] Image Processor WASM initialized');
    } catch (e) {
        console.warn('[dataWorkerService] WASM init failed:', e);
    }
}

export type KTX2EncodingResult = {
    imageId: string;
    ktx2Src: string | null;
    ktx2Blob?: Blob; // Added for hydration
    error?: string;
};

export async function encodeImageToKTX2(imageId: string, file: File): Promise<KTX2EncodingResult> {
    // Ensure encoder is initialized
    if (!ktx2Initialized) {
        await initKTX2Encoder();
    }

    const result = await postRequest<KTX2EncodingResult>('encode-ktx2', { imageId, file });
    return hydrateBlobUrls(result);
}

// ===== Generated Image Processing API =====
export type ProcessedGeneratedImageData = {
    id: string;
    file: File;
    src: string;
    proxySrc: string;
    proxyFile: File;
    tinySrc: string;
    tinyFile: File;
    thumbnailSrc: string;
    tiles: any[];
    isTiled: boolean;
    tileSize: number;
    naturalWidth: number;
    naturalHeight: number;
    originalSrc: string;
    originalFile: File;
    error?: string;
};

/**
 * Process a base64-encoded generated image in a web worker (off main thread)
 * This prevents UI blocking during image decoding and LOD generation
 *
 * @param id - Unique identifier for the generated image
 * @param base64Data - Base64-encoded image data (without data URL prefix)
 * @param mimeType - MIME type of the image (e.g., 'image/png')
 * @param filename - Filename for the generated File object
 */
export async function processGeneratedImage(
    id: string,
    base64Data: string,
    mimeType: string,
    filename: string
): Promise<ProcessedGeneratedImageData> {
    const result = await postRequest<ProcessedGeneratedImageData>('process-generated-image', {
        id,
        base64Data,
        mimeType,
        filename
    });
    return hydrateBlobUrls(result);
}
