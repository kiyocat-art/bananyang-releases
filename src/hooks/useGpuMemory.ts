/**
 * GPU Memory Monitoring Hook
 * Tracks GPU VRAM usage in real-time (Windows only)
 * Matches Windows Task Manager GPU memory display
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface GpuInfo {
    description: string;
    totalMemoryBytes: number | null;
    totalMemoryMB: number | null;
}

export interface GpuMemoryDataPoint {
    timestamp: number;
    dedicatedMB: number;
    sharedMB: number;
}

interface UseGpuMemoryOptions {
    /** Polling interval in milliseconds (default: 1000ms) */
    pollIntervalMs?: number;
    /** Maximum data points to keep in history (default: 300 = 5 min at 1s interval) */
    maxDataPoints?: number;
    /** Whether monitoring is enabled (default: true) */
    enabled?: boolean;
}

const DEFAULT_OPTIONS: Required<UseGpuMemoryOptions> = {
    pollIntervalMs: 1000,
    maxDataPoints: 300,
    enabled: true,
};

interface GpuMemoryState {
    gpuInfo: GpuInfo | null;
    currentUsage: {
        dedicatedMB: number;
        sharedMB: number;
    } | null;
    history: GpuMemoryDataPoint[];
    isLoading: boolean;
    error: string | null;
    isSupported: boolean;
}

export function useGpuMemory(options: UseGpuMemoryOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const [state, setState] = useState<GpuMemoryState>({
        gpuInfo: null,
        currentUsage: null,
        history: [],
        isLoading: true,
        error: null,
        isSupported: typeof window !== 'undefined' && !!window.electronAPI,
    });

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // Fetch GPU info (once on mount)
    useEffect(() => {
        const fetchGpuInfo = async () => {
            if (!window.electronAPI?.getGpuInfo) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'GPU monitoring not available',
                    isSupported: false,
                }));
                return;
            }

            try {
                const result = await window.electronAPI.getGpuInfo();
                if (result.success && result.data) {
                    setState(prev => ({
                        ...prev,
                        gpuInfo: {
                            description: result.data!.description,
                            totalMemoryBytes: result.data!.totalMemoryBytes,
                            totalMemoryMB: result.data!.totalMemoryBytes
                                ? Math.round(result.data!.totalMemoryBytes / (1024 * 1024))
                                : null,
                        },
                        isLoading: false,
                    }));
                } else {
                    setState(prev => ({
                        ...prev,
                        isLoading: false,
                        error: result.error || 'Failed to get GPU info',
                    }));
                }
            } catch (error) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }));
            }
        };

        fetchGpuInfo();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Poll GPU memory usage
    useEffect(() => {
        if (!opts.enabled || !state.isSupported) {
            return;
        }

        const pollMemoryUsage = async () => {
            if (!mountedRef.current || !window.electronAPI?.getGpuMemoryUsage) {
                return;
            }

            try {
                const result = await window.electronAPI.getGpuMemoryUsage();

                if (!mountedRef.current) return;

                if (result.success && result.data) {
                    const dedicatedMB = Math.round(result.data.dedicatedBytes / (1024 * 1024));
                    const sharedMB = Math.round(result.data.sharedBytes / (1024 * 1024));

                    setState(prev => {
                        const newDataPoint: GpuMemoryDataPoint = {
                            timestamp: result.data!.timestamp,
                            dedicatedMB,
                            sharedMB,
                        };

                        const newHistory = [...prev.history, newDataPoint];
                        // Trim history if exceeding max
                        const trimmedHistory = newHistory.length > opts.maxDataPoints
                            ? newHistory.slice(-opts.maxDataPoints)
                            : newHistory;

                        return {
                            ...prev,
                            currentUsage: { dedicatedMB, sharedMB },
                            history: trimmedHistory,
                            error: null,
                        };
                    });
                } else if (result.error) {
                    // Don't spam errors, just log once
                    if (state.error !== result.error) {
                        setState(prev => ({
                            ...prev,
                            error: result.error || null,
                        }));
                    }
                }
            } catch (error) {
                // Silent fail for polling errors
                console.warn('[useGpuMemory] Polling error:', error);
            }
        };

        // Initial poll
        pollMemoryUsage();

        // Set up interval
        intervalRef.current = setInterval(pollMemoryUsage, opts.pollIntervalMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [opts.enabled, opts.pollIntervalMs, opts.maxDataPoints, state.isSupported]);

    // Clear history
    const clearHistory = useCallback(() => {
        setState(prev => ({
            ...prev,
            history: [],
        }));
    }, []);

    return {
        gpuInfo: state.gpuInfo,
        currentUsage: state.currentUsage,
        history: state.history,
        isLoading: state.isLoading,
        error: state.error,
        isSupported: state.isSupported,
        clearHistory,
    };
}

export default useGpuMemory;
