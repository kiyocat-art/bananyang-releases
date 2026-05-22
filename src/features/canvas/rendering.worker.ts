import { PixiCanvasRenderer } from './rendering/PixiCanvasRenderer';

// Polyfills for Worker environment to satisfy PixiJS DOM dependencies
if (typeof self !== 'undefined' && typeof window === 'undefined') {
    (self as any).window = self;
}
// Helper to patch OffscreenCanvas to handle float dimensions safely
const patchCanvas = (canvas: OffscreenCanvas) => {
    const originalWidthDesc = Object.getOwnPropertyDescriptor(OffscreenCanvas.prototype, 'width');
    const originalHeightDesc = Object.getOwnPropertyDescriptor(OffscreenCanvas.prototype, 'height');

    if (originalWidthDesc && originalHeightDesc) {
        Object.defineProperty(canvas, 'width', {
            get() { return originalWidthDesc.get?.call(this); },
            set(v) {
                const n = Number(v);
                const val = (Number.isFinite(n) && n > 0) ? Math.floor(n) : 1;
                originalWidthDesc.set?.call(this, val);
            }
        });
        Object.defineProperty(canvas, 'height', {
            get() { return originalHeightDesc.get?.call(this); },
            set(v) {
                const n = Number(v);
                const val = (Number.isFinite(n) && n > 0) ? Math.floor(n) : 1;
                originalHeightDesc.set?.call(this, val);
            }
        });
    }
    return canvas;
};

if (typeof document === 'undefined') {
    (self as any).document = {
        createElement: (tag: string) => {
            if (tag === 'canvas') {
                const canvas = new OffscreenCanvas(1, 1);
                (canvas as any).style = {};
                (canvas as any).addEventListener = () => { };
                (canvas as any).removeEventListener = () => { };
                return patchCanvas(canvas);
            }
            return {
                style: {},
                appendChild: () => { },
                removeChild: () => { },
                setAttribute: () => { },
                addEventListener: () => { },
                removeEventListener: () => { },
            };
        },
        body: {
            appendChild: () => { },
            removeChild: () => { },
            contains: () => true, // Mock contains to satisfy PixiJS visibility check
        },
        addEventListener: () => { },
        removeEventListener: () => { },
    };
}
if (typeof HTMLElement === 'undefined') {
    (self as any).HTMLElement = class { };
}
if (typeof HTMLCanvasElement === 'undefined') {
    (self as any).HTMLCanvasElement = OffscreenCanvas;
}
if (typeof HTMLVideoElement === 'undefined') {
    (self as any).HTMLVideoElement = class { };
}
if (typeof HTMLImageElement === 'undefined') {
    (self as any).HTMLImageElement = class { };
}

const renderer = new PixiCanvasRenderer();
let telemetryIntervalId: ReturnType<typeof setInterval> | null = null;

self.onmessage = async (event: MessageEvent) => {
    const { type, payload, nonce } = event.data;

    switch (type) {
        case 'init': {
            patchCanvas(payload.canvas);
            await renderer.init(payload);
            if (telemetryIntervalId) clearInterval(telemetryIntervalId);
            telemetryIntervalId = setInterval(() => {
                const s = renderer.stats();
                if (!s.initialized) return;
                self.postMessage({ type: 'telemetry', payload: { timestamp: Date.now(), ...s } });
            }, 200);
            break;
        }
        case 'resize':
            renderer.resize(payload.width, payload.height);
            break;
        case 'apply-state':
            renderer.applyPatch(event.data.patch);
            break;
        case 'add-resource':
            renderer.addResource(payload.id, payload.bitmap);
            break;
        case 'add-compressed-resource':
            renderer.addCompressedResource(payload.id, payload.buffer, payload.mimeType);
            break;
        case 'pause-rendering':
            renderer.pause();
            break;
        case 'resume-rendering':
            renderer.resume();
            break;
        case 'query-memory-status':
            self.postMessage({ type: 'memory-status', data: renderer.getMemoryStatus() });
            break;
        case 'cleanup-unused-textures':
            renderer.cleanupUnusedTextures(payload);
            break;
        case 'evict-offscreen-textures':
            renderer.evictOffscreenTextures(nonce);
            break;
        case 'resource-error':
            renderer.onResourceError(payload.id);
            break;
        case 'resume-from-background':
            renderer.resumeFromBackground();
            break;
        case 'sync-settings':
            renderer.requestRender();
            break;
    }
};
