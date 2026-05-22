const INTERACTION_DEBOUNCE_FRAMES = 18; // ~300ms @ 60fps
const RECONCILE_PERIOD = 30;
const STALE_REQUEST_PERIOD = 60;
const IDLE_EVICT_PERIOD = 1800; // ~30s @ 60fps

export interface SchedulerHooks {
    isReady: () => boolean;
    isInteracting: () => boolean;
    onInteractionEnd: () => void;
    processLODBatch: () => boolean; // returns true if queue still has items after batch
    reconcile: () => void;
    cleanupStaleRequests: () => void;
    evictIdle: () => void;
    render: () => void;
    processPendingDestroys: () => void;
}

export class RenderScheduler {
    private pending = false;
    private frameCount = 0;
    private interactionFrames = 0;

    constructor(private readonly hooks: SchedulerHooks) {}

    request(): void {
        if (this.pending) return;
        this.pending = true;
        self.requestAnimationFrame(this.tick);
    }

    notifyInteraction(): void {
        this.interactionFrames = 0;
        this.request();
    }

    private tick = (): void => {
        this.pending = false;
        if (!this.hooks.isReady()) return;

        this.frameCount++;

        // Phase 1: Interaction debounce (RAF counter replaces setTimeout)
        if (this.hooks.isInteracting()) {
            this.interactionFrames++;
            if (this.interactionFrames >= INTERACTION_DEBOUNCE_FRAMES) {
                this.interactionFrames = 0;
                this.hooks.onInteractionEnd();
            }
        } else {
            this.interactionFrames = 0;
        }

        // Phase 2: LOD batch
        const lodHasMore = this.hooks.processLODBatch();

        // Fast path: skip periodic phases + postRender when LOD backlog
        if (lodHasMore) {
            this.hooks.render();
            this.request();
            return;
        }

        // Phase 3: Periodic reconcile
        if (this.frameCount % RECONCILE_PERIOD === 0 && !this.hooks.isInteracting()) {
            this.hooks.reconcile();
        }
        // Phase 4: Periodic stale request cleanup
        if (this.frameCount % STALE_REQUEST_PERIOD === 0) {
            this.hooks.cleanupStaleRequests();
        }
        // Phase 5: Periodic idle eviction
        if (this.frameCount % IDLE_EVICT_PERIOD === 0) {
            this.hooks.evictIdle();
        }

        // Phase 6: Render
        this.hooks.render();
        // Phase 7: Post-render deferred destroy drain (prevents WebGL race conditions)
        this.hooks.processPendingDestroys();

        // Phase 8: Reschedule if still interacting
        if (this.hooks.isInteracting()) {
            this.request();
        }
    };
}
