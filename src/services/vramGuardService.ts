/**
 * VRAM Guard Service
 * Prevents app crashes by controlling generation based on GPU memory usage
 *
 * Features:
 * - VRAM usage threshold checking (80% warning, 85% block)
 * - Generation cooldown (prevents rapid successive generations)
 * - Emergency cleanup triggers
 * - Generation queue management
 * - Render telemetry observation (no auto-actions, warn-only)
 */

import { RenderTelemetry, RENDER_TELEMETRY_EVENT } from '../features/canvas/observability/RenderTelemetry';

// VRAM Thresholds (percentage of total VRAM)
const VRAM_WARNING_THRESHOLD = 80;  // Show warning at 80%
const VRAM_BLOCK_THRESHOLD = 85;    // Block generation at 85%
const VRAM_EMERGENCY_THRESHOLD = 90; // Trigger emergency cleanup at 90%

// Cooldown settings
const MIN_COOLDOWN_MS = 2000;       // Minimum 2 seconds between generations
const COOLDOWN_PER_4K_MS = 3000;    // Additional 3 seconds for 4K images

// Default VRAM estimate when nvidia-smi fails (16GB is common for gaming GPUs)
const DEFAULT_VRAM_ESTIMATE_MB = 16384;

interface VramStatus {
    usageMB: number;
    totalMB: number;
    usagePercent: number;
    canGenerate: boolean;
    shouldWarn: boolean;
    shouldEmergencyCleanup: boolean;
    reason: string | null;
}

interface GenerationRecord {
    timestamp: number;
    resolution: string;
    is4K: boolean;
}

class VramGuardService {
    private lastGenerationTime: number = 0;
    private recentGenerations: GenerationRecord[] = [];
    private cachedVramTotal: number | null = null;
    private emergencyCleanupCallbacks: Array<() => void> = [];
    private isEmergencyCleanupInProgress: boolean = false;

    // Telemetry observation (read-only, no auto-actions)
    private lastTelemetry: RenderTelemetry | null = null;
    private lastVramWarnMs: number = 0;
    private lastLeakWarnMs: number = 0;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener(RENDER_TELEMETRY_EVENT, this.handleTelemetry as EventListener);
        }
    }

    private readonly handleTelemetry = (e: Event): void => {
        const telemetry = (e as CustomEvent<RenderTelemetry>).detail;
        this.lastTelemetry = telemetry;

        const now = Date.now();
        if (telemetry.vramLimitMB > 0) {
            const pct = (telemetry.vramUsedMB / telemetry.vramLimitMB) * 100;
            if (pct >= VRAM_BLOCK_THRESHOLD && now - this.lastVramWarnMs > 30_000) {
                console.warn(`[VramGuard] VRAM pressure: ${pct.toFixed(1)}%`);
                this.lastVramWarnMs = now;
            }
        }
        if (telemetry.leakCandidatesCount > 50 && now - this.lastLeakWarnMs > 60_000) {
            console.warn(`[VramGuard] ${telemetry.leakCandidatesCount} leak candidates detected`);
            this.lastLeakWarnMs = now;
        }
    };

    /**
     * Check current VRAM status and whether generation is allowed
     */
    async checkVramStatus(): Promise<VramStatus> {
        const defaultStatus: VramStatus = {
            usageMB: 0,
            totalMB: DEFAULT_VRAM_ESTIMATE_MB,
            usagePercent: 0,
            canGenerate: true,
            shouldWarn: false,
            shouldEmergencyCleanup: false,
            reason: null,
        };

        if (!window.electronAPI?.getGpuMemoryUsage) {
            return defaultStatus;
        }

        try {
            const [usageResult, infoResult] = await Promise.all([
                window.electronAPI.getGpuMemoryUsage(),
                this.getVramTotal(),
            ]);

            if (!usageResult.success || !usageResult.data) {
                return defaultStatus;
            }

            const usageMB = Math.round(usageResult.data.dedicatedBytes / (1024 * 1024));
            const totalMB = infoResult || DEFAULT_VRAM_ESTIMATE_MB;
            const usagePercent = Math.round((usageMB / totalMB) * 100);

            const shouldWarn = usagePercent >= VRAM_WARNING_THRESHOLD;
            const shouldBlock = usagePercent >= VRAM_BLOCK_THRESHOLD;
            const shouldEmergencyCleanup = usagePercent >= VRAM_EMERGENCY_THRESHOLD;

            let reason: string | null = null;
            if (shouldBlock) {
                reason = `VRAM 사용량이 ${usagePercent}%입니다. ${VRAM_BLOCK_THRESHOLD}% 미만으로 낮춰주세요.`;
            } else if (shouldWarn) {
                reason = `VRAM 사용량 경고: ${usagePercent}%`;
            }

            return {
                usageMB,
                totalMB,
                usagePercent,
                canGenerate: !shouldBlock,
                shouldWarn,
                shouldEmergencyCleanup,
                reason,
            };
        } catch (error) {
            console.warn('[VramGuard] Failed to check VRAM status:', error);
            return defaultStatus;
        }
    }

    /**
     * Get cached VRAM total (fetches once)
     */
    private async getVramTotal(): Promise<number | null> {
        if (this.cachedVramTotal !== null) {
            return this.cachedVramTotal;
        }

        if (!window.electronAPI?.getGpuInfo) {
            return null;
        }

        try {
            const result = await window.electronAPI.getGpuInfo();
            if (result.success && result.data?.totalMemoryBytes) {
                this.cachedVramTotal = Math.round(result.data.totalMemoryBytes / (1024 * 1024));
                return this.cachedVramTotal;
            }
        } catch (error) {
            console.warn('[VramGuard] Failed to get VRAM total:', error);
        }

        return null;
    }

    /**
     * Check if enough time has passed since last generation (cooldown)
     */
    checkCooldown(resolution?: string): { canGenerate: boolean; waitMs: number; reason: string | null } {
        const now = Date.now();
        const timeSinceLastGen = now - this.lastGenerationTime;

        // Determine cooldown based on resolution
        const is4K = resolution?.includes('4') || resolution?.includes('high');
        const requiredCooldown = is4K ? MIN_COOLDOWN_MS + COOLDOWN_PER_4K_MS : MIN_COOLDOWN_MS;

        if (timeSinceLastGen < requiredCooldown) {
            const waitMs = requiredCooldown - timeSinceLastGen;
            return {
                canGenerate: false,
                waitMs,
                reason: `이미지 생성 후 ${(waitMs / 1000).toFixed(1)}초 대기 필요 (메모리 안정화)`,
            };
        }

        return { canGenerate: true, waitMs: 0, reason: null };
    }

    /**
     * Record that a generation just completed
     */
    recordGeneration(resolution?: string): void {
        const is4K = resolution?.includes('4') || resolution?.includes('high');

        this.lastGenerationTime = Date.now();
        this.recentGenerations.push({
            timestamp: this.lastGenerationTime,
            resolution: resolution || 'unknown',
            is4K,
        });

        // Keep only last 10 generations
        if (this.recentGenerations.length > 10) {
            this.recentGenerations = this.recentGenerations.slice(-10);
        }

        console.log(`[VramGuard] Generation recorded. Resolution: ${resolution}, is4K: ${is4K}`);
    }

    /**
     * Full pre-generation check (VRAM + cooldown)
     */
    async canGenerate(resolution?: string): Promise<{
        allowed: boolean;
        reason: string | null;
        vramStatus: VramStatus;
        cooldownStatus: ReturnType<typeof this.checkCooldown>;
    }> {
        const [vramStatus, cooldownStatus] = await Promise.all([
            this.checkVramStatus(),
            Promise.resolve(this.checkCooldown(resolution)),
        ]);

        // Check cooldown first (faster check)
        if (!cooldownStatus.canGenerate) {
            return {
                allowed: false,
                reason: cooldownStatus.reason,
                vramStatus,
                cooldownStatus,
            };
        }

        // Check VRAM
        if (!vramStatus.canGenerate) {
            return {
                allowed: false,
                reason: vramStatus.reason,
                vramStatus,
                cooldownStatus,
            };
        }

        // Trigger emergency cleanup if needed (but don't block)
        if (vramStatus.shouldEmergencyCleanup && !this.isEmergencyCleanupInProgress) {
            this.triggerEmergencyCleanup();
        }

        return {
            allowed: true,
            reason: vramStatus.shouldWarn ? vramStatus.reason : null,
            vramStatus,
            cooldownStatus,
        };
    }

    /**
     * Wait for cooldown to finish
     */
    async waitForCooldown(resolution?: string): Promise<void> {
        const { waitMs } = this.checkCooldown(resolution);
        if (waitMs > 0) {
            console.log(`[VramGuard] Waiting ${waitMs}ms for cooldown...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
    }

    /**
     * Register callback for emergency cleanup
     */
    onEmergencyCleanup(callback: () => void): () => void {
        this.emergencyCleanupCallbacks.push(callback);
        return () => {
            this.emergencyCleanupCallbacks = this.emergencyCleanupCallbacks.filter(cb => cb !== callback);
        };
    }

    /**
     * Trigger emergency cleanup (called when VRAM > 90%)
     * [SIMPLIFIED] No longer dispatches canvas-cleanup-textures — Worker LRU handles texture cleanup.
     * vramGuard only blocks generation and manages cooldowns.
     */
    private triggerEmergencyCleanup(): void {
        if (this.isEmergencyCleanupInProgress) return;

        this.isEmergencyCleanupInProgress = true;
        console.warn('[VramGuard] EMERGENCY: VRAM usage critical! Generation will be blocked until usage drops.');

        // Call all registered cleanup callbacks (non-texture cleanup like blob management)
        for (const callback of this.emergencyCleanupCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('[VramGuard] Emergency cleanup callback error:', error);
            }
        }

        // Reset flag after a delay
        setTimeout(() => {
            this.isEmergencyCleanupInProgress = false;
        }, 5000);
    }

    /**
     * Get statistics about recent generations and last render telemetry
     */
    getStats(): {
        recentCount: number;
        recent4KCount: number;
        lastGenerationAgo: number;
        lastTelemetry: RenderTelemetry | null;
    } {
        const now = Date.now();
        const fiveMinAgo = now - 5 * 60 * 1000;

        const recentGens = this.recentGenerations.filter(g => g.timestamp > fiveMinAgo);

        return {
            recentCount: recentGens.length,
            recent4KCount: recentGens.filter(g => g.is4K).length,
            lastGenerationAgo: now - this.lastGenerationTime,
            lastTelemetry: this.lastTelemetry,
        };
    }
}

// Singleton instance
export const vramGuard = new VramGuardService();

export default vramGuard;
