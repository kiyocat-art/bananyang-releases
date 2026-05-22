/**
 * TextureRegistry — single source of truth for texture lifecycle.
 *
 * Replaces 11 scattered state maps in rendering.worker.ts:
 *   textureCache, textureLastUsed, textureTier, textureByteSize, currentTotalBytes
 *   requestedResources, pendingRequests, requestTimestamps, pendingAbortControllers
 *   pendingDestroys, protectedDuringInteraction
 *
 * Key design change: ref-count (bindCount) replaces the old 3-layer protection:
 *   - spriteBoundSrcs     (by image src field)
 *   - spriteBoundTextureObjects (by Texture object identity)
 *   - protectedDuringInteraction (interaction snapshot)
 * A texture with bindCount > 0 is NEVER scheduled for destruction.
 * Corollary: destroyingTextures Set ([FIX CRASH-4]) is no longer needed.
 * Corollary: needsUpdateContent flag ([FIX TINY-1]) is no longer needed —
 *   only zero-ref textures are evicted, so no live sprite is ever left blank.
 */

import { Texture } from 'pixi.js';

const REQUEST_TIMEOUT_MS = 30_000;
export const TEXTURE_PROTECTION_MS = 10_000;
const IDLE_EVICTION_THRESHOLD_MS = 30_000;

export interface BindCountBuckets {
    '1': number;
    '2': number;
    '3-5': number;
    '6+': number;
}

export interface RegistryStats {
    vramUsedMB: number;
    vramLimitMB: number;
    textureCacheCount: number;
    pendingDestroysCount: number;
    pendingRequestsCount: number;
    requestedResourcesCount: number;
    bindCountBuckets: BindCountBuckets;
    leakCandidatesCount: number;
}

export class TextureRegistry {
    // ---- Texture cache ----
    private cache = new Map<string, Texture>();
    private lastUsed = new Map<string, number>();
    private tier = new Map<string, 'TINY' | 'PREVIEW' | 'FULL'>();
    private byteSize = new Map<string, number>();
    private totalBytes = 0;

    // ---- Request tracking ----
    private requested = new Set<string>();
    private pending = new Set<string>();
    private timestamps = new Map<string, number>();
    private abortControllers = new Map<string, AbortController>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;

    // ---- Ref-count binding ----
    // spriteId (= image.id) → currently bound src
    private spriteSrc = new Map<string, string>();
    // src → count of sprites currently displaying this texture
    private bindCount = new Map<string, number>();

    // ---- Deferred destruction ----
    private destroyQueue: string[] = [];

    // ---- Dependencies ----
    private maxBytes: number;
    private readonly onRequestResource: (src: string) => void;
    private readonly onStaleIds: (ids: string[]) => void;
    private readonly getGreyPlaceholder: () => Texture;

    private paused = false;

    constructor(opts: {
        maxBytes: number;
        onRequestResource: (src: string) => void;
        onStaleIds: (ids: string[]) => void;
        getGreyPlaceholder: () => Texture;
    }) {
        this.maxBytes = opts.maxBytes;
        this.onRequestResource = opts.onRequestResource;
        this.onStaleIds = opts.onStaleIds;
        this.getGreyPlaceholder = opts.getGreyPlaceholder;
    }

    // ---- Configuration ----

    setMaxBytes(bytes: number): void { this.maxBytes = bytes; }
    setPaused(value: boolean): void { this.paused = value; }
    isUnderPressure(): boolean { return this.totalBytes > this.maxBytes * 0.8; }

    // ---- Acquire (replaces getTexture) ----
    /**
     * Return the cached Texture for src, or Texture.EMPTY while requesting.
     * Caller must bind() the returned non-EMPTY texture to a sprite.
     */
    acquire(src: string, textureTier?: 'TINY' | 'PREVIEW' | 'FULL'): Texture {
        if (this.paused) return Texture.EMPTY;

        const cached = this.cache.get(src);
        if (cached) {
            if ((cached as any).destroyed) {
                this.dropCacheEntry(src);
                // fall through to request
            } else {
                this.lastUsed.set(src, Date.now());
                return cached;
            }
        }

        if (textureTier) this.tier.set(src, textureTier);

        if (!this.requested.has(src) && !this.pending.has(src)) {
            this.pending.add(src);
            if (!this.flushTimer) {
                this.flushTimer = setTimeout(() => this.flush(), 100);
            }
        }
        return Texture.EMPTY;
    }

    // ---- Register (called from add-resource / add-compressed-resource) ----
    /**
     * Store a freshly-decoded GPU texture in the registry.
     * Caller is responsible for closing/freeing the source bitmap if needed.
     */
    registerTexture(id: string, texture: Texture, byteSize: number): void {
        const oldSize = this.byteSize.get(id) || 0;
        this.totalBytes = Math.max(0, this.totalBytes - oldSize);

        this.cache.set(id, texture);
        this.byteSize.set(id, byteSize);
        this.totalBytes += byteSize;

        this.abortControllers.delete(id);
        this.pending.delete(id);
        this.timestamps.delete(id);
        this.lastUsed.set(id, Date.now());
    }

    // ---- Ref-count binding ----
    /**
     * Call when setting proxySprite.texture = texture.
     * spriteId = image.id
     */
    bind(spriteId: string, texture: Texture): void {
        const prevSrc = this.spriteSrc.get(spriteId);
        if (prevSrc) {
            const n = (this.bindCount.get(prevSrc) || 0) - 1;
            if (n <= 0) this.bindCount.delete(prevSrc);
            else this.bindCount.set(prevSrc, n);
        }

        const newSrc = this.srcForTexture(texture);
        if (newSrc) {
            this.spriteSrc.set(spriteId, newSrc);
            this.bindCount.set(newSrc, (this.bindCount.get(newSrc) || 0) + 1);
        } else {
            this.spriteSrc.delete(spriteId);
        }
    }

    /**
     * Call when a sprite is destroyed or its texture set to EMPTY/placeholder.
     * spriteId = image.id
     */
    unbind(spriteId: string): void {
        const src = this.spriteSrc.get(spriteId);
        if (!src) return;
        const n = (this.bindCount.get(src) || 0) - 1;
        if (n <= 0) this.bindCount.delete(src);
        else this.bindCount.set(src, n);
        this.spriteSrc.delete(spriteId);
    }

    // ---- Deferred destruction ----
    /**
     * Process the pending destroy queue after render() completes.
     * Provide current active srcs to cancel any queued-but-now-visible textures.
     *
     * [STABILITY FIX] Equivalent to old processPendingDestroys().
     */
    processPendingDestroys(currentActiveSrcs: Set<string>): void {
        if (this.destroyQueue.length === 0) return;
        const toDestroy = this.destroyQueue.splice(0);
        toDestroy.forEach(src => {
            if (currentActiveSrcs.has(src)) {
                this.lastUsed.set(src, Date.now());
                return;
            }
            this.destroyOne(src);
        });
    }

    // ---- Enforce VRAM limit (replaces enforceTextureLimit) ----
    /**
     * LRU eviction. Call after reconcile().
     * activeSrcs: set of srcs needed by visible sprites this frame.
     * extraProtected: interaction-time snapshot (one-shot, caller clears after use).
     */
    enforceLimit(activeSrcs: Set<string>, extraProtected?: Set<string>): void {
        if (this.totalBytes <= this.maxBytes) return;

        const now = Date.now();
        const sorted = Array.from(this.cache.keys())
            .sort((a, b) => (this.lastUsed.get(a) || 0) - (this.lastUsed.get(b) || 0));

        let scheduled = 0;
        for (const src of sorted) {
            if (this.totalBytes <= this.maxBytes * 0.7) break;

            // TINY textures are always kept as instant fallback
            if (this.tier.get(src) === 'TINY') continue;

            // Ref-count replaces both spriteBoundSrcs and spriteBoundTextureObjects
            if ((this.bindCount.get(src) || 0) > 0) continue;

            const lastUsed = this.lastUsed.get(src) || 0;
            const isEmergency = this.totalBytes > this.maxBytes * 0.9;
            const effectiveProtection = isEmergency ? 5_000 : TEXTURE_PROTECTION_MS;
            if (now - lastUsed < effectiveProtection) continue;

            if (!activeSrcs.has(src) && !(extraProtected?.has(src))) {
                this.scheduleDestroy(src);
                scheduled++;
            }
        }

        if (scheduled > 0) {
            console.log('[TextureRegistry] Scheduled', scheduled, 'textures for deferred cleanup');
        }
    }

    evictIdlePreviews(visibleSrcs: Set<string>): void {
        const now = Date.now();
        let evicted = 0;
        for (const [src, ts] of this.lastUsed) {
            if (this.tier.get(src) === 'TINY') continue;
            if (visibleSrcs.has(src)) continue;
            if (now - ts < IDLE_EVICTION_THRESHOLD_MS) continue;
            this.scheduleDestroy(src);
            evicted++;
        }
        if (evicted > 0) {
            console.log(`[TextureRegistry] Idle eviction: ${evicted} PREVIEW textures scheduled`);
        }
    }

    softManage(activeSrcs: Set<string>, extraProtected?: Set<string>): void {
        this.cancelOutOfViewportRequests(activeSrcs);
        this.enforceLimit(activeSrcs, extraProtected);
    }

    // ---- Request cancellation ----
    cancelRequest(src: string): void {
        const ctrl = this.abortControllers.get(src);
        if (ctrl) {
            ctrl.abort();
            this.abortControllers.delete(src);
        }
        this.pending.delete(src);
        this.requested.delete(src);
    }

    cancelOutOfViewportRequests(visibleSrcs: Set<string>): void {
        for (const [src] of this.abortControllers) {
            if (!visibleSrcs.has(src)) this.cancelRequest(src);
        }
    }

    cleanupStaleRequests(): void {
        const now = Date.now();
        const timedOut: string[] = [];
        for (const [src, ts] of this.timestamps) {
            if (now - ts > REQUEST_TIMEOUT_MS) {
                this.requested.delete(src);
                this.timestamps.delete(src);
                this.abortControllers.delete(src);
                timedOut.push(src);
            }
        }
        if (timedOut.length > 0) {
            this.onStaleIds(timedOut);
        }
    }

    clearPendingRequests(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.requested.clear();
        this.pending.clear();
        this.timestamps.clear();
        this.abortControllers.clear();
    }

    /** Destroy all cached GPU textures immediately, then reset state. Call on pause/low-VRAM flush. */
    destroyAllTextures(): void {
        for (const [, texture] of this.cache) {
            try {
                if (!(texture as any).destroyed) {
                    texture.destroy(true);
                }
            } catch (e) { /* ignore */ }
        }
        this.clear();
    }

    /** Reset all state — call on WebGL context loss. */
    clear(): void {
        this.cache.clear();
        this.lastUsed.clear();
        this.requested.clear();
        this.tier.clear();
        this.byteSize.clear();
        this.bindCount.clear();
        this.spriteSrc.clear();
        this.destroyQueue.length = 0;
        this.totalBytes = 0;
        if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    }

    // ---- Getters ----
    getTexture(src: string): Texture | undefined { return this.cache.get(src); }
    getTotalBytes(): number { return this.totalBytes; }
    getCacheSize(): number { return this.cache.size; }
    getPendingDestroyCount(): number { return this.destroyQueue.length; }
    getPendingRequestCount(): number { return this.pending.size; }
    getRequestedCount(): number { return this.requested.size; }
    getTier(src: string) { return this.tier.get(src); }

    stats(): RegistryStats {
        const now = Date.now();
        const buckets: BindCountBuckets = { '1': 0, '2': 0, '3-5': 0, '6+': 0 };
        let leakCandidatesCount = 0;

        for (const [src, count] of this.bindCount) {
            if (count <= 0) continue;
            if (count === 1) buckets['1']++;
            else if (count === 2) buckets['2']++;
            else if (count <= 5) buckets['3-5']++;
            else buckets['6+']++;

            const lastUsed = this.lastUsed.get(src) || now;
            if (now - lastUsed > IDLE_EVICTION_THRESHOLD_MS) leakCandidatesCount++;
        }

        return {
            vramUsedMB: this.totalBytes / (1024 * 1024),
            vramLimitMB: this.maxBytes / (1024 * 1024),
            textureCacheCount: this.cache.size,
            pendingDestroysCount: this.destroyQueue.length,
            pendingRequestsCount: this.pending.size,
            requestedResourcesCount: this.requested.size,
            bindCountBuckets: buckets,
            leakCandidatesCount,
        };
    }

    getLeakCandidates(idleThresholdMs = IDLE_EVICTION_THRESHOLD_MS): Array<{ src: string; bindCount: number; idleMs: number; tier: string }> {
        const now = Date.now();
        const results: Array<{ src: string; bindCount: number; idleMs: number; tier: string }> = [];
        for (const [src, count] of this.bindCount) {
            if (count <= 0) continue;
            const lastUsed = this.lastUsed.get(src) || now;
            const idleMs = now - lastUsed;
            if (idleMs > idleThresholdMs) {
                results.push({ src, bindCount: count, idleMs, tier: this.tier.get(src) || 'unknown' });
            }
        }
        results.sort((a, b) => b.idleMs - a.idleMs);
        return results.slice(0, 20);
    }

    // ---- Sort pending by center-out distance ----
    /**
     * Re-queue pending requests sorted by distance from canvas center.
     * Call before flushPendingRequests for center-out loading.
     */
    reprioritizePending(
        sortedSrcs: string[],
    ): void {
        const inPending = sortedSrcs.filter(s => this.pending.has(s));
        const notInList = Array.from(this.pending).filter(s => !inPending.includes(s));
        this.pending.clear();
        [...inPending, ...notInList].forEach(s => this.pending.add(s));
    }

    // ---- Private ----

    private scheduleDestroy(src: string): void {
        if (!this.destroyQueue.includes(src)) this.destroyQueue.push(src);
    }

    private destroyOne(src: string): void {
        // Double-check ref-count before actually destroying
        if ((this.bindCount.get(src) || 0) > 0) return;

        const texture = this.cache.get(src);
        if (!texture) {
            this.dropCacheEntry(src);
            return;
        }

        try {
            if (!(texture as any).destroyed) {
                this.cache.delete(src);
                this.lastUsed.delete(src);
                this.requested.delete(src);
                this.tier.delete(src);
                if (texture.source && !(texture.source as any).destroyed) {
                    texture.source.destroy();
                }
            }
        } catch (e) {
            console.warn('[TextureRegistry] destroy failed:', src, e);
        }

        const size = this.byteSize.get(src) || 0;
        this.totalBytes = Math.max(0, this.totalBytes - size);
        this.byteSize.delete(src);
    }

    private dropCacheEntry(src: string): void {
        this.cache.delete(src);
        this.lastUsed.delete(src);
        this.requested.delete(src);
        this.tier.delete(src);
        this.byteSize.delete(src);
    }

    private srcForTexture(texture: Texture): string | undefined {
        for (const [src, tex] of this.cache) {
            if (tex === texture) return src;
        }
        return undefined;
    }

    private flush(): void {
        this.flushTimer = null;
        this.cleanupStaleRequests();
        if (this.pending.size === 0) return;

        const pressure = this.totalBytes > this.maxBytes * 0.7;
        const batchMax = pressure ? 10 : 20;
        let sent = 0;
        const overflow: string[] = [];

        for (const src of this.pending) {
            if (sent >= batchMax) { overflow.push(src); continue; }
            if (!this.requested.has(src)) {
                this.requested.add(src);
                this.timestamps.set(src, Date.now());
                const ctrl = new AbortController();
                this.abortControllers.set(src, ctrl);
                this.onRequestResource(src);
                sent++;
            }
        }

        this.pending.clear();
        if (overflow.length > 0) {
            overflow.forEach(s => this.pending.add(s));
            this.flushTimer = setTimeout(() => this.flush(), 100);
        }
    }
}
