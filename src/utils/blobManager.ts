/**
 * Centralized Blob URL Manager
 * Tracks and manages all blob URLs to prevent memory leaks
 * Enhanced with LRU-like tracking for automatic cleanup
 */

interface BlobEntry {
    refCount: number;
    lastAccessed: number;
    createdAt: number; // [FIX CRASH-3] Track creation time for grace period
    size?: number; // Estimated size for prioritization
}

// Log aggregation system to group repeated console logs
interface LogAggregation {
    count: number;
    totalSizeMB: number;
    lastTotalUrls: number;
    lastEstimatedMB: number;
    timer: ReturnType<typeof setTimeout> | null;
}

const logState: { allocated: LogAggregation; released: LogAggregation } = {
    allocated: { count: 0, totalSizeMB: 0, lastTotalUrls: 0, lastEstimatedMB: 0, timer: null },
    released: { count: 0, totalSizeMB: 0, lastTotalUrls: 0, lastEstimatedMB: 0, timer: null }
};

function aggregateLog(
    type: 'allocated' | 'released',
    sizeMB: number,
    totalUrls: number,
    estimatedMB: number
): void {
    if (process.env.NODE_ENV !== 'development') return;

    const state = logState[type];
    state.count++;
    state.totalSizeMB += sizeMB;
    state.lastTotalUrls = totalUrls;
    state.lastEstimatedMB = estimatedMB;

    if (state.timer) clearTimeout(state.timer);

    state.timer = setTimeout(() => {
        if (type === 'allocated') {
            console.log(
                `[${state.count}] [BlobManager] Allocated: ~${state.totalSizeMB.toFixed(2)}MB ` +
                `(total: ${state.lastTotalUrls} URLs, ~${state.lastEstimatedMB}MB)`
            );
        } else {
            console.log(
                `[${state.count}] [BlobManager] Released: ~${state.totalSizeMB.toFixed(2)}MB ` +
                `(remaining: ${state.lastTotalUrls} URLs)`
            );
        }
        state.count = 0;
        state.totalSizeMB = 0;
        state.timer = null;
    }, 500);
}

// Configuration for automatic cleanup
const CLEANUP_INTERVAL_MS = 30000; // Run cleanup every 30 seconds
const STALE_THRESHOLD_MS = 300000; // Consider URLs stale after 5 minutes (was 60s)
const MAX_TRACKED_URLS = 200; // Trigger aggressive cleanup above this threshold

// [FIX CRASH-3] Grace period for newly created blobs to prevent race condition
// New blobs are protected from cleanup for this duration after creation
const NEW_BLOB_GRACE_PERIOD_MS = 30000; // 30 seconds protection for new blobs

class BlobManager {
    private refs = new Map<string, BlobEntry>();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private totalSizeBytes: number = 0;

    constructor() {
        // [FIX] Disable automatic cleanup.
        // Time-based cleanup is dangerous because "old" images (displayed for > 5 min)
        // are identified as "stale" and revoked, causing crashes when the app returns to foreground.
        // We must rely on explicit .release() calls from React components/Store.
        // this.startAutoCleanup();
    }

    /**
     * Create a blob URL and track it with reference counting
     */
    create(blob: Blob | File): string {
        const url = URL.createObjectURL(blob);
        const now = Date.now();
        this.refs.set(url, {
            refCount: 1,
            lastAccessed: now,
            createdAt: now, // [FIX CRASH-3] Track creation time
            size: blob.size
        });
        this.totalSizeBytes += blob.size;

        // Use aggregated logging to group repeated console output
        const sizeMB = blob.size / (1024 * 1024);
        aggregateLog('allocated', sizeMB, this.refs.size, Math.round(this.totalSizeBytes / (1024 * 1024) * 10) / 10);

        return url;
    }

    /**
     * Increment reference count for an existing URL
     */
    addRef(url: string | undefined): void {
        if (!url || !url.startsWith('blob:')) return;

        const entry = this.refs.get(url);
        if (entry) {
            entry.refCount++;
            entry.lastAccessed = Date.now();
        } else {
            const now = Date.now();
            this.refs.set(url, {
                refCount: 1,
                lastAccessed: now,
                createdAt: now // [FIX CRASH-3] Track creation time for new entries
            });
        }
    }

    /**
     * Touch a URL to update its last accessed time (for LRU tracking)
     */
    touch(url: string | undefined): void {
        if (!url || !url.startsWith('blob:')) return;
        const entry = this.refs.get(url);
        if (entry) {
            entry.lastAccessed = Date.now();
        }
    }

    /**
     * Decrement reference count and revoke if zero
     */
    release(url: string | undefined): void {
        if (!url || !url.startsWith('blob:')) return;

        const entry = this.refs.get(url);
        if (entry === undefined) {
            // Not tracked? Revoke immediately to be safe (legacy behavior)
            URL.revokeObjectURL(url);
            return;
        }

        if (entry.refCount > 1) {
            entry.refCount--;
            entry.lastAccessed = Date.now();
        } else {
            // Use aggregated logging to group repeated console output
            const sizeMB = (entry.size || 0) / (1024 * 1024);
            aggregateLog('released', sizeMB, this.refs.size - 1, 0);
            this.totalSizeBytes -= entry.size ?? 0;
            URL.revokeObjectURL(url);
            this.refs.delete(url);
        }
    }

    /**
     * Alias for release to maintain compatibility
     */
    revoke(url: string | undefined): void {
        this.release(url);
    }

    /**
     * Revoke multiple blob URLs
     */
    revokeMultiple(urls: (string | undefined)[]): void {
        urls.forEach(url => this.release(url));
    }

    /**
     * Revoke all tracked blob URLs (use with caution)
     */
    revokeAll(): void {
        this.refs.forEach((_, url) => URL.revokeObjectURL(url));
        this.refs.clear();
        this.totalSizeBytes = 0;
    }

    /**
     * Get count of tracked URLs (for debugging)
     */
    getTrackedCount(): number {
        return this.refs.size;
    }

    /**
     * Check if a URL is tracked
     */
    isTracked(url: string): boolean {
        return this.refs.has(url);
    }

    /**
     * Start automatic periodic cleanup
     */
    startAutoCleanup(): void {
        if (this.cleanupTimer) return;

        this.cleanupTimer = setInterval(() => {
            this.cleanupStale();
        }, CLEANUP_INTERVAL_MS);

        // Don't prevent Node.js from exiting
        if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
            this.cleanupTimer.unref();
        }
    }

    /**
     * Stop automatic cleanup
     */
    stopAutoCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Clean up stale blob URLs (those not accessed recently with low ref count)
     */
    cleanupStale(): number {
        const now = Date.now();
        let cleaned = 0;

        // Aggressive cleanup if too many URLs tracked
        const aggressive = this.refs.size > MAX_TRACKED_URLS;
        const threshold = aggressive ? STALE_THRESHOLD_MS / 2 : STALE_THRESHOLD_MS;

        const toRemove: string[] = [];

        this.refs.forEach((entry, url) => {
            const age = now - entry.lastAccessed;
            // Only clean up URLs with refCount of 1 (not actively shared)
            // and that haven't been accessed recently
            // [FIX] Disabled aggressive cleanup.
            // Old timestamps do not mean "stale" in a persistent canvas application.
            // Only manual release() should remove blobs.
            /* 
            if (entry.refCount <= 1 && age > threshold) {
                toRemove.push(url);
            }
            */
        });

        // Sort by size (largest first) if aggressive cleanup
        if (aggressive && toRemove.length > 0) {
            toRemove.sort((a, b) => {
                const sizeA = this.refs.get(a)?.size || 0;
                const sizeB = this.refs.get(b)?.size || 0;
                return sizeB - sizeA;
            });
        }

        toRemove.forEach(url => {
            URL.revokeObjectURL(url);
            this.refs.delete(url);
            cleaned++;
        });

        if (cleaned > 0) {
            console.log(`[BlobManager] Cleaned ${cleaned} stale blob URLs (${this.refs.size} remaining)`);
        }

        return cleaned;
    }

    /**
     * Force immediate cleanup (call after heavy operations like image generation)
     */
    scheduleImmediateCleanup(): void {
        // Use setTimeout to avoid blocking the current operation
        setTimeout(() => {
            this.cleanupStale();
        }, 100);
    }

    /**
     * Get memory statistics (for debugging)
     */
    getStats(): { count: number; totalSize: number; avgAge: number } {
        const now = Date.now();
        let totalSize = 0;
        let totalAge = 0;

        this.refs.forEach(entry => {
            totalSize += entry.size || 0;
            totalAge += now - entry.lastAccessed;
        });

        return {
            count: this.refs.size,
            totalSize,
            avgAge: this.refs.size > 0 ? totalAge / this.refs.size : 0
        };
    }

    /**
     * Safe cleanup - excludes URLs currently in use on canvas
     * Returns cleanup result with freed memory estimate
     */
    safeCleanup(activeUrls: Set<string>): {
        cleaned: string[];
        retained: string[];
        freedMemoryEstimate: number
    } {
        const cleaned: string[] = [];
        const retained: string[] = [];
        let freedMemoryEstimate = 0;
        const now = Date.now();

        for (const [url, entry] of this.refs.entries()) {
            // Skip URLs that are actively being used
            if (activeUrls.has(url)) {
                retained.push(url);
                continue;
            }

            // [FIX CRASH-3] Skip recently created blobs (grace period protection)
            // This prevents race condition where blob is created but Worker hasn't
            // requested it yet, or image is added to canvas but outside viewport
            const createdAt = entry.createdAt || entry.lastAccessed; // Fallback for legacy entries
            const age = now - createdAt;
            if (age < NEW_BLOB_GRACE_PERIOD_MS) {
                retained.push(url);
                continue;
            }

            // Only cleanup URLs with refCount of 0 or 1
            if (entry.refCount <= 1) {
                freedMemoryEstimate += entry.size || 2 * 1024 * 1024; // Default 2MB if unknown
                this.totalSizeBytes -= entry.size ?? 0;
                URL.revokeObjectURL(url);
                this.refs.delete(url);
                cleaned.push(url);
            } else {
                retained.push(url);
            }
        }

        if (cleaned.length > 0) {
            console.log(`[BlobManager] Safe cleanup: ${cleaned.length} URLs freed, ${retained.length} retained`);
        }

        return { cleaned, retained, freedMemoryEstimate };
    }

    /**
     * Force cleanup - same as safeCleanup but with shorter grace period.
     * Use for explicit user-triggered memory optimization actions.
     */
    forceCleanup(activeUrls: Set<string>, gracePeriodMs = 5000): {
        cleaned: string[];
        retained: string[];
        freedMemoryEstimate: number
    } {
        const cleaned: string[] = [];
        const retained: string[] = [];
        let freedMemoryEstimate = 0;
        const now = Date.now();

        for (const [url, entry] of this.refs.entries()) {
            if (activeUrls.has(url)) {
                retained.push(url);
                continue;
            }

            const createdAt = entry.createdAt || entry.lastAccessed;
            const age = now - createdAt;
            if (age < gracePeriodMs) {
                retained.push(url);
                continue;
            }

            if (entry.refCount <= 1) {
                freedMemoryEstimate += entry.size || 2 * 1024 * 1024;
                this.totalSizeBytes -= entry.size ?? 0;
                URL.revokeObjectURL(url);
                this.refs.delete(url);
                cleaned.push(url);
            } else {
                retained.push(url);
            }
        }

        if (cleaned.length > 0) {
            console.log(`[BlobManager] Force cleanup: ${cleaned.length} URLs freed (grace: ${gracePeriodMs}ms), ${retained.length} retained`);
        }

        return { cleaned, retained, freedMemoryEstimate };
    }

    /**
     * Get detailed memory statistics for monitoring UI
     */
    getMemoryStats(): {
        urlCount: number;
        estimatedBytes: number;
        estimatedMB: number;
        oldestAccessMs: number;
        newestAccessMs: number;
    } {
        const now = Date.now();
        let oldestAccess = now;
        let newestAccess = 0;

        this.refs.forEach(entry => {
            if (entry.lastAccessed < oldestAccess) oldestAccess = entry.lastAccessed;
            if (entry.lastAccessed > newestAccess) newestAccess = entry.lastAccessed;
        });

        return {
            urlCount: this.refs.size,
            estimatedBytes: this.totalSizeBytes,
            estimatedMB: Math.round(this.totalSizeBytes / (1024 * 1024) * 10) / 10,
            oldestAccessMs: this.refs.size > 0 ? now - oldestAccess : 0,
            newestAccessMs: this.refs.size > 0 ? now - newestAccess : 0,
        };
    }

    /**
     * Get all tracked URLs (for comparison with active URLs)
     */
    getAllTrackedUrls(): string[] {
        return Array.from(this.refs.keys());
    }
}

// Singleton instance
export const blobManager = new BlobManager();

// Expose for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).blobManager = blobManager;
}
