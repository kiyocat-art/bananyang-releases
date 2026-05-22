/**
 * Memory History Hook
 * Tracks memory usage over time for visualization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { blobManager } from '../utils/blobManager';
import { useCanvasStore } from '../store/canvasStore';

export interface MemoryDataPoint {
    timestamp: number;
    blobMemoryMB: number;
    imageCount: number;
    event?: 'cleanup' | 'add' | 'delete';
}

interface MemoryHistoryOptions {
    maxDataPoints?: number;
    sampleIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<MemoryHistoryOptions> = {
    maxDataPoints: 60, // 5 minutes at 5-second intervals
    sampleIntervalMs: 5000,
};

export function useMemoryHistory(options: MemoryHistoryOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const [history, setHistory] = useState<MemoryDataPoint[]>([]);
    const eventQueue = useRef<MemoryDataPoint['event'][]>([]);
    const previousImageCount = useRef<number>(0);

    // Sampling interval
    useEffect(() => {
        const sample = () => {
            const stats = blobManager.getMemoryStats();
            const imageCount = useCanvasStore.getState().boardImages.length;

            // Auto-detect add/delete events
            let autoEvent: MemoryDataPoint['event'] | undefined;
            if (imageCount > previousImageCount.current) {
                autoEvent = 'add';
            } else if (imageCount < previousImageCount.current) {
                autoEvent = 'delete';
            }
            previousImageCount.current = imageCount;

            // Manual event takes priority
            const event = eventQueue.current.shift() || autoEvent;

            const dataPoint: MemoryDataPoint = {
                timestamp: Date.now(),
                blobMemoryMB: stats.estimatedBytes / (1024 * 1024),
                imageCount,
                event,
            };

            setHistory(prev => {
                const newHistory = [...prev, dataPoint];
                // Remove old entries if exceeding max
                if (newHistory.length > opts.maxDataPoints) {
                    return newHistory.slice(-opts.maxDataPoints);
                }
                return newHistory;
            });
        };

        // Initial sample
        sample();

        const interval = setInterval(sample, opts.sampleIntervalMs);
        return () => clearInterval(interval);
    }, [opts.maxDataPoints, opts.sampleIntervalMs]);

    // Add event manually (for cleanup events)
    const addEvent = useCallback((event: MemoryDataPoint['event']) => {
        eventQueue.current.push(event);
    }, []);

    // Clear history
    const clear = useCallback(() => {
        setHistory([]);
        eventQueue.current = [];
    }, []);

    const currentStats = history[history.length - 1] || {
        timestamp: Date.now(),
        blobMemoryMB: 0,
        imageCount: 0,
    };

    return { history, currentStats, addEvent, clear };
}
