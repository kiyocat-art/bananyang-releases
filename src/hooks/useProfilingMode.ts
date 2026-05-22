/**
 * Profiling Mode Hook
 * Provides real-time performance metrics for debugging
 * Only active in development or when explicitly enabled
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { blobManager } from '../utils/blobManager';
import { useCanvasStore } from '../store/canvasStore';

export interface ProfilerStats {
    // Frame metrics
    fps: number;
    frameTime: number;
    frameTimeAvg: number;
    frameTimeHistory: number[];

    // Memory metrics
    blobCount: number;
    blobMemoryMB: number;

    // Texture metrics
    textureCount: number;
    textureMemoryMB: number;

    // Canvas metrics
    imageCount: number;
    selectedCount: number;

    // JS Heap (if available)
    jsHeapMB: number | null;
    jsHeapLimitMB: number | null;

    // GC events
    gcEvents: number;
}

interface ProfilerOptions {
    updateIntervalMs?: number;
    fpsHistorySize?: number;
}

const DEFAULT_OPTIONS: Required<ProfilerOptions> = {
    updateIntervalMs: 500,
    fpsHistorySize: 60,
};

export function useProfilingMode(options: ProfilerOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const [enabled, setEnabled] = useState(false);
    const [stats, setStats] = useState<ProfilerStats>({
        fps: 0,
        frameTime: 0,
        frameTimeAvg: 0,
        frameTimeHistory: [],
        blobCount: 0,
        blobMemoryMB: 0,
        textureCount: 0,
        textureMemoryMB: 0,
        imageCount: 0,
        selectedCount: 0,
        jsHeapMB: null,
        jsHeapLimitMB: null,
        gcEvents: 0,
    });

    const frameTimesRef = useRef<number[]>([]);
    const lastFrameTimeRef = useRef(performance.now());
    const frameCountRef = useRef(0);
    const rafIdRef = useRef<number | null>(null);
    const gcEventCountRef = useRef(0);
    const prevHeapRef = useRef<number | null>(null);

    // Frame timing loop
    useEffect(() => {
        if (!enabled) {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            return;
        }

        const measureFrame = () => {
            const now = performance.now();
            const frameTime = now - lastFrameTimeRef.current;
            lastFrameTimeRef.current = now;

            // Track frame times
            frameTimesRef.current.push(frameTime);
            if (frameTimesRef.current.length > opts.fpsHistorySize) {
                frameTimesRef.current.shift();
            }

            frameCountRef.current++;
            rafIdRef.current = requestAnimationFrame(measureFrame);
        };

        rafIdRef.current = requestAnimationFrame(measureFrame);

        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [enabled, opts.fpsHistorySize]);

    // Stats update interval
    useEffect(() => {
        if (!enabled) return;

        let lastFrameCount = 0;
        let lastTime = performance.now();

        const updateStats = () => {
            const now = performance.now();
            const elapsed = now - lastTime;
            const frames = frameCountRef.current - lastFrameCount;

            // Calculate FPS
            const fps = frames / (elapsed / 1000);

            // Calculate average frame time
            const frameTimes = frameTimesRef.current;
            const frameTimeAvg = frameTimes.length > 0
                ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
                : 0;

            // Get current frame time
            const frameTime = frameTimes[frameTimes.length - 1] || 0;

            // Get frame time history snapshot (last 60 values)
            const frameTimeHistory = [...frameTimes];

            // Get memory stats
            const blobStats = blobManager.getMemoryStats();
            const canvasState = useCanvasStore.getState();

            // Estimate texture stats from board images
            // Each displayed image corresponds to ~1 GPU texture
            const boardImages = canvasState.boardImages;
            const textureCount = boardImages.length;
            // Estimate texture memory: width * height * 4 bytes (RGBA) per texture
            let textureMemoryBytes = 0;
            for (const img of boardImages) {
                const w = img.originalDimensions?.width || img.width;
                const h = img.originalDimensions?.height || img.height;
                textureMemoryBytes += w * h * 4;
            }

            // Get JS heap if available (Chrome only)
            let jsHeapMB = null;
            let jsHeapLimitMB = null;
            if ((performance as any).memory) {
                const currentHeap = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
                jsHeapMB = currentHeap;
                jsHeapLimitMB = (performance as any).memory.jsHeapSizeLimit / (1024 * 1024);

                // Detect GC events by heap size drops > 5MB
                if (prevHeapRef.current !== null && prevHeapRef.current - currentHeap > 5) {
                    gcEventCountRef.current++;
                }
                prevHeapRef.current = currentHeap;
            }

            setStats({
                fps: Math.round(fps),
                frameTime: Math.round(frameTime * 10) / 10,
                frameTimeAvg: Math.round(frameTimeAvg * 10) / 10,
                frameTimeHistory,
                blobCount: blobStats.urlCount,
                blobMemoryMB: Math.round(blobStats.estimatedBytes / (1024 * 1024) * 10) / 10,
                textureCount,
                textureMemoryMB: Math.round(textureMemoryBytes / (1024 * 1024) * 10) / 10,
                imageCount: canvasState.boardImages.length,
                selectedCount: canvasState.selectedImageIds.size,
                jsHeapMB: jsHeapMB !== null ? Math.round(jsHeapMB) : null,
                jsHeapLimitMB: jsHeapLimitMB !== null ? Math.round(jsHeapLimitMB) : null,
                gcEvents: gcEventCountRef.current,
            });

            lastFrameCount = frameCountRef.current;
            lastTime = now;
        };

        const interval = setInterval(updateStats, opts.updateIntervalMs);
        return () => clearInterval(interval);
    }, [enabled, opts.updateIntervalMs]);

    const toggle = useCallback(() => {
        setEnabled(prev => !prev);
    }, []);

    const enable = useCallback(() => setEnabled(true), []);
    const disable = useCallback(() => setEnabled(false), []);

    return {
        enabled,
        stats,
        toggle,
        enable,
        disable,
        setEnabled,
    };
}
