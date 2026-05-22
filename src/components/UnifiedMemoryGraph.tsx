/**
 * Unified Memory Graph Component
 * Combines App Memory (Blob) and GPU VRAM in a single graph
 * Similar to Windows Task Manager style
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { MemoryDataPoint } from '../hooks/useMemoryHistory';
import { GpuMemoryDataPoint } from '../hooks/useGpuMemory';
import { t, Language, TranslationKey } from '../localization';
import { RenderTelemetry } from '../features/canvas/observability/RenderTelemetry';
import { DevRegistryStatsPanel } from './DevRegistryStatsPanel';

export interface BindCountBuckets {
    '1': number;
    '2': number;
    '3-5': number;
    '6+': number;
}

export interface TextureCacheDataPoint {
    timestamp: number;
    vramUsedMB: number;
    textureCacheCount: number;
    pendingDestroysCount: number;
    bindCountBuckets?: BindCountBuckets;
    leakCandidatesCount?: number;
}

interface UnifiedMemoryGraphProps {
    /** App memory history (Blob URLs) */
    appHistory: MemoryDataPoint[];
    /** GPU VRAM history */
    gpuHistory: GpuMemoryDataPoint[];
    /** GPU total memory in MB (for scaling) */
    gpuTotalMB?: number | null;
    /** Texture cache telemetry from rendering worker */
    textureCacheHistory?: TextureCacheDataPoint[];
    /** Show advanced texture stats (developer mode) */
    developerMode?: boolean;
    /** Latest telemetry for dev stats panel */
    latestTelemetry?: RenderTelemetry | null;
    width?: number;
    height?: number;
    language?: Language;
}

export const UnifiedMemoryGraph: React.FC<UnifiedMemoryGraphProps> = ({
    appHistory,
    gpuHistory,
    gpuTotalMB,
    textureCacheHistory,
    developerMode = false,
    latestTelemetry,
    width: propWidth,
    height = 180,
    language = 'ko',
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(propWidth || 400);

    // Measure container width with ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const measure = () => {
            const w = container.clientWidth;
            if (w > 0) setContainerWidth(w);
        };

        measure();

        const observer = new ResizeObserver(() => measure());
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const width = propWidth || containerWidth;

    // Calculate max GPU value for Y-axis scaling
    const maxGpuValue = useMemo(() => {
        if (gpuTotalMB && gpuTotalMB > 0) {
            return gpuTotalMB;
        }
        if (gpuHistory.length === 0) return 8192; // Default 8GB
        const dataMax = Math.max(...gpuHistory.map(d => d.dedicatedMB), 0);
        // Scale to nice round numbers
        const scaled = Math.max(dataMax * 1.2, 1024);
        if (scaled <= 2048) return 2048;
        if (scaled <= 4096) return 4096;
        if (scaled <= 8192) return 8192;
        if (scaled <= 12288) return 12288;
        if (scaled <= 16384) return 16384;
        if (scaled <= 24576) return 24576;
        return Math.ceil(scaled / 4096) * 4096;
    }, [gpuHistory, gpuTotalMB]);

    // Calculate max App memory value for secondary Y-axis
    const maxAppValue = useMemo(() => {
        if (appHistory.length === 0) return 500;
        const dataMax = Math.max(...appHistory.map(d => d.blobMemoryMB), 0);
        const scaled = Math.max(dataMax * 1.3, 100);
        if (scaled <= 100) return 100;
        if (scaled <= 250) return 250;
        if (scaled <= 500) return 500;
        if (scaled <= 1000) return 1000;
        if (scaled <= 2000) return 2000;
        return Math.ceil(scaled / 500) * 500;
    }, [appHistory]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);

        const padding = { top: 16, right: 50, bottom: 28, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Determine time range from GPU history (more frequent updates)
        const timeSource = gpuHistory.length >= 2 ? gpuHistory : appHistory;
        if (timeSource.length < 2) {
            // Draw "collecting data" message
            ctx.fillStyle = '#666';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t('memoryMonitor.collectingData' as TranslationKey, language), width / 2, height / 2);
            return;
        }

        const timeRange = timeSource[timeSource.length - 1].timestamp - timeSource[0].timestamp;
        const startTime = timeSource[0].timestamp;

        if (timeRange === 0) return;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        // Draw GPU VRAM line (green, primary)
        if (gpuHistory.length >= 2) {
            const gpuPoints: { x: number; y: number }[] = [];

            ctx.beginPath();
            gpuHistory.forEach((point, i) => {
                const x = padding.left + ((point.timestamp - startTime) / timeRange) * chartWidth;
                const y = padding.top + chartHeight * (1 - point.dedicatedMB / maxGpuValue);
                gpuPoints.push({ x, y });

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.strokeStyle = '#22c55e'; // Green
            ctx.lineWidth = 2;
            ctx.stroke();

            // Fill area under GPU line
            if (gpuPoints.length > 0) {
                ctx.beginPath();
                ctx.moveTo(gpuPoints[0].x, height - padding.bottom);
                gpuPoints.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.lineTo(gpuPoints[gpuPoints.length - 1].x, height - padding.bottom);
                ctx.closePath();

                const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
                gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
                gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }

        // Draw App Memory line (blue, secondary) - scaled to GPU range for visual comparison
        if (appHistory.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = '#60a5fa'; // Blue
            ctx.lineWidth = 2;

            // Scale app memory to fit within GPU range visually
            // Use separate scaling so both lines are visible
            const appScaleFactor = maxGpuValue / maxAppValue;

            appHistory.forEach((point, i) => {
                const x = padding.left + ((point.timestamp - startTime) / timeRange) * chartWidth;
                // Scale app memory to GPU range for visual comparison
                const scaledValue = point.blobMemoryMB * appScaleFactor;
                const y = padding.top + chartHeight * (1 - scaledValue / maxGpuValue);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Draw cleanup event markers
            appHistory.forEach((point) => {
                if (point.event !== 'cleanup') return;

                const x = padding.left + ((point.timestamp - startTime) / timeRange) * chartWidth;
                const scaledValue = point.blobMemoryMB * appScaleFactor;
                const y = padding.top + chartHeight * (1 - scaledValue / maxGpuValue);

                ctx.beginPath();
                ctx.fillStyle = '#4ade80';
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        }

        // Draw Texture Cache VRAM line (orange, tertiary)
        if (textureCacheHistory && textureCacheHistory.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = '#f97316'; // Orange
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);

            textureCacheHistory.forEach((point, i) => {
                const x = padding.left + ((point.timestamp - startTime) / timeRange) * chartWidth;
                const y = padding.top + chartHeight * (1 - point.vramUsedMB / maxGpuValue);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.setLineDash([]);

            // Pending destroys spike markers (red dots)
            textureCacheHistory.forEach((point) => {
                if (point.pendingDestroysCount <= 0) return;
                const x = padding.left + ((point.timestamp - startTime) / timeRange) * chartWidth;
                const y = padding.top + chartHeight * (1 - point.vramUsedMB / maxGpuValue);
                ctx.beginPath();
                ctx.fillStyle = '#ef4444';
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw Y-axis labels (GPU - left side)
        ctx.fillStyle = '#22c55e';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const formatMemory = (mb: number) => {
            if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`;
            return `${mb}MB`;
        };

        ctx.fillText(formatMemory(maxGpuValue), padding.left - 6, padding.top + 6);
        ctx.fillText('0', padding.left - 6, height - padding.bottom - 4);

        // Draw Y-axis labels (App Memory - right side)
        ctx.fillStyle = '#60a5fa';
        ctx.textAlign = 'left';
        ctx.fillText(formatMemory(maxAppValue), width - padding.right + 6, padding.top + 6);
        ctx.fillText('0', width - padding.right + 6, height - padding.bottom - 4);

        // Draw X-axis labels
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const timeSpanSec = timeRange / 1000;
        const timeLabel = timeSpanSec >= 60 ? `${Math.round(timeSpanSec / 60)}m` : `${Math.round(timeSpanSec)}s`;
        ctx.fillText(`-${timeLabel}`, padding.left + 20, height - 20);
        ctx.fillText('now', width - padding.right - 15, height - 20);

    }, [appHistory, gpuHistory, width, height, maxGpuValue, maxAppValue]);

    return (
        <div ref={containerRef} style={{ width: propWidth || '100%' }}>
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height,
                    borderRadius: 8,
                    display: 'block',
                }}
            />
            {/* Legend */}
            <div className="text-sm" style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                marginTop: '6px',
                color: '#888'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <span style={{ color: '#22c55e' }}>{t('memoryMonitor.gpuVram' as TranslationKey, language)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#60a5fa' }} />
                    <span style={{ color: '#60a5fa' }}>{t('memoryMonitor.appMemory' as TranslationKey, language)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4ade80' }} />
                    <span style={{ color: '#666' }}>{t('memoryMonitor.cleanupEvent' as TranslationKey, language)}</span>
                </span>
                {textureCacheHistory && textureCacheHistory.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 12, height: 2, backgroundColor: '#f97316', display: 'inline-block' }} />
                        <span style={{ color: '#f97316' }}>Tex Cache</span>
                    </span>
                )}
            </div>
            {developerMode && latestTelemetry && (
                <DevRegistryStatsPanel telemetry={latestTelemetry} />
            )}
        </div>
    );
};

export default UnifiedMemoryGraph;
