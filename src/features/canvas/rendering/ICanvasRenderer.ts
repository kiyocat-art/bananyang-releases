export interface MemoryStatus {
    vramUsageMB: number;
    vramLimitMB: number;
    textureCount: number;
    isUnderPressure: boolean;
}

export interface RendererStatsTelemetry {
    initialized: boolean;
    vramUsedMB: number;
    vramLimitMB: number;
    textureCacheCount: number;
    pendingDestroysCount: number;
    pendingRequestsCount: number;
    requestedResourcesCount: number;
    imageCount: number;
}

export interface InitPayload {
    canvas: OffscreenCanvas;
    width: number;
    height: number;
    resolution?: number;
    enableWebGPU?: boolean;
}

export interface CleanupPayload {
    activeImageIds?: string[];
    activeSrcs?: string[];
    aggressive?: boolean;
}

export interface ICanvasRenderer {
    init(payload: InitPayload): Promise<void>;
    resize(width: number, height: number): void;
    applyPatch(patch: any): void;
    addResource(id: string, bitmap: ImageBitmap | OffscreenCanvas | any): void;
    addCompressedResource(id: string, buffer: ArrayBuffer, mimeType: string): void;
    pause(): void;
    resume(): void;
    getMemoryStatus(): MemoryStatus;
    cleanupUnusedTextures(payload: CleanupPayload): void;
    evictOffscreenTextures(nonce: any): void;
    onResourceError(id: string): void;
    resumeFromBackground(): void;
    requestRender(): void;
    stats(): RendererStatsTelemetry;
}
