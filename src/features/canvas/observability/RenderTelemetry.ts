export interface BindCountBuckets {
    '1': number;
    '2': number;
    '3-5': number;
    '6+': number;
}

export interface RenderTelemetry {
    timestamp: number;
    vramUsedMB: number;
    vramLimitMB: number;
    textureCacheCount: number;
    pendingDestroysCount: number;
    pendingRequestsCount: number;
    requestedResourcesCount: number;
    imageCount: number;
    bindCountBuckets: BindCountBuckets;
    leakCandidatesCount: number;
}

export const RENDER_TELEMETRY_EVENT = 'canvas-render-telemetry';
