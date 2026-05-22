import { useState, useEffect } from 'react';
import { RenderTelemetry, RENDER_TELEMETRY_EVENT } from '../features/canvas/observability/RenderTelemetry';
import { TextureCacheDataPoint } from '../components/UnifiedMemoryGraph';

const MAX_HISTORY = 300; // 60s at 200ms interval

export const useRenderTelemetry = () => {
    const [latest, setLatest] = useState<RenderTelemetry | null>(null);
    const [history, setHistory] = useState<TextureCacheDataPoint[]>([]);

    useEffect(() => {
        const handle = (e: Event) => {
            const telemetry = (e as CustomEvent<RenderTelemetry>).detail;
            setLatest(telemetry);

            const point: TextureCacheDataPoint = {
                timestamp: telemetry.timestamp,
                vramUsedMB: telemetry.vramUsedMB,
                textureCacheCount: telemetry.textureCacheCount,
                pendingDestroysCount: telemetry.pendingDestroysCount,
                bindCountBuckets: telemetry.bindCountBuckets,
                leakCandidatesCount: telemetry.leakCandidatesCount,
            };

            setHistory(prev => [...prev, point].slice(-MAX_HISTORY));
        };

        window.addEventListener(RENDER_TELEMETRY_EVENT, handle);
        return () => window.removeEventListener(RENDER_TELEMETRY_EVENT, handle);
    }, []);

    return { latest, history };
};
