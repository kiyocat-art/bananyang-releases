/**
 * GPU Memory Graph Component
 * Visualizes GPU VRAM usage over time (similar to Windows Task Manager)
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { GpuMemoryDataPoint } from '../hooks/useGpuMemory';

interface GpuMemoryGraphProps {
    history: GpuMemoryDataPoint[];
    totalMemoryMB?: number | null;
    width?: number;
    height?: number;
}

export const GpuMemoryGraph: React.FC<GpuMemoryGraphProps> = ({
    history,
    totalMemoryMB,
    width: propWidth,
    height = 150,
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

    // Calculate max value for Y-axis scaling
    const maxValue = useMemo(() => {
        if (totalMemoryMB && totalMemoryMB > 0) {
            return totalMemoryMB;
        }
        if (history.length === 0) return 1024; // Default 1GB
        const dataMax = Math.max(...history.map(d => d.dedicatedMB + d.sharedMB), 0);
        // Scale to nice round numbers
        const scaled = Math.max(dataMax * 1.2, 512);
        if (scaled <= 1024) return 1024;
        if (scaled <= 2048) return 2048;
        if (scaled <= 4096) return 4096;
        if (scaled <= 8192) return 8192;
        if (scaled <= 12288) return 12288;
        if (scaled <= 16384) return 16384;
        if (scaled <= 24576) return 24576;
        return Math.ceil(scaled / 4096) * 4096;
    }, [history, totalMemoryMB]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || history.length < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);

        const padding = { top: 14, right: 14, bottom: 28, left: 52 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Calculate time range
        const timeRange = history[history.length - 1].timestamp - history[0].timestamp;
        if (timeRange === 0) return;

        // Draw dedicated memory (solid green area like Task Manager)
        const dedicatedPoints: { x: number; y: number }[] = [];

        ctx.beginPath();
        history.forEach((point, i) => {
            const x = padding.left + ((point.timestamp - history[0].timestamp) / timeRange) * chartWidth;
            const y = padding.top + chartHeight * (1 - point.dedicatedMB / maxValue);
            dedicatedPoints.push({ x, y });

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Stroke line
        ctx.strokeStyle = '#22c55e'; // Green (like Task Manager GPU graph)
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fill area under dedicated line
        if (dedicatedPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(dedicatedPoints[0].x, height - padding.bottom);
            dedicatedPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(dedicatedPoints[dedicatedPoints.length - 1].x, height - padding.bottom);
            ctx.closePath();

            const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
            gradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0.1)');
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw shared memory as a lighter overlay (if significant)
        const hasSharedMemory = history.some(p => p.sharedMB > 10);
        if (hasSharedMemory) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)'; // Blue for shared
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);

            history.forEach((point, i) => {
                const x = padding.left + ((point.timestamp - history[0].timestamp) / timeRange) * chartWidth;
                const totalY = padding.top + chartHeight * (1 - (point.dedicatedMB + point.sharedMB) / maxValue);

                if (i === 0) {
                    ctx.moveTo(x, totalY);
                } else {
                    ctx.lineTo(x, totalY);
                }
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw Y-axis labels
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Format memory labels
        const formatMB = (mb: number) => {
            if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
            return `${mb}MB`;
        };

        ctx.fillText(formatMB(maxValue), padding.left - 4, padding.top + 8);
        ctx.fillText('0', padding.left - 4, height - padding.bottom - 5);

        // Draw X-axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const timeSpanSec = timeRange / 1000;
        const timeLabel = timeSpanSec >= 60 ? `${Math.round(timeSpanSec / 60)}m` : `${Math.round(timeSpanSec)}s`;
        ctx.fillText(`-${timeLabel}`, padding.left + 20, height - 22);
        ctx.fillText('now', width - padding.right - 15, height - 22);

    }, [history, width, height, maxValue]);

    if (history.length < 2) {
        return (
            <div
                ref={containerRef}
                style={{
                    width: propWidth || '100%',
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: 8,
                    color: '#666',
                    fontSize: 16,
                }}
            >
                GPU 데이터 수집 중...
            </div>
        );
    }

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
        </div>
    );
};

export default GpuMemoryGraph;
