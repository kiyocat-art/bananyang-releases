/**
 * Memory Graph Component
 * Visualizes memory usage over time using Canvas API
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { MemoryDataPoint } from '../hooks/useMemoryHistory';

interface MemoryGraphProps {
    history: MemoryDataPoint[];
    width?: number;
    height?: number;
    warningThreshold?: number;  // MB
    criticalThreshold?: number; // MB
}

export const MemoryGraph: React.FC<MemoryGraphProps> = ({
    history,
    width: propWidth,
    height = 150,
    warningThreshold = 1024,
    criticalThreshold = 2048,
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

    // Calculate max value for Y-axis scaling - dynamic based on actual data
    const maxValue = useMemo(() => {
        if (history.length === 0) return 100; // Default minimum
        const dataMax = Math.max(...history.map(d => d.blobMemoryMB), 0);
        // Ensure minimum of 100MB for readability, scale to 1.3x of max for headroom
        const scaledMax = Math.max(dataMax * 1.3, 100);
        // Round up to nice values for readability
        if (scaledMax <= 100) return 100;
        if (scaledMax <= 250) return 250;
        if (scaledMax <= 500) return 500;
        if (scaledMax <= 1000) return 1000;
        if (scaledMax <= 2000) return 2000;
        return Math.ceil(scaledMax / 500) * 500;
    }, [history]);

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

        // Calculate threshold Y positions
        const warningY = padding.top + chartHeight * (1 - warningThreshold / maxValue);
        const criticalY = padding.top + chartHeight * (1 - criticalThreshold / maxValue);

        // Draw critical zone (red background)
        if (criticalY > padding.top) {
            ctx.fillStyle = 'rgba(248, 113, 113, 0.1)';
            ctx.fillRect(padding.left, padding.top, chartWidth, Math.max(0, criticalY - padding.top));
        }

        // Draw warning zone (yellow background)
        if (warningY > criticalY) {
            ctx.fillStyle = 'rgba(250, 204, 21, 0.1)';
            ctx.fillRect(padding.left, criticalY, chartWidth, Math.max(0, warningY - criticalY));
        }

        // Draw threshold lines
        ctx.setLineDash([4, 4]);

        // Critical line
        if (criticalY > padding.top && criticalY < height - padding.bottom) {
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, criticalY);
            ctx.lineTo(width - padding.right, criticalY);
            ctx.stroke();
        }

        // Warning line
        if (warningY > padding.top && warningY < height - padding.bottom) {
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
            ctx.beginPath();
            ctx.moveTo(padding.left, warningY);
            ctx.lineTo(width - padding.right, warningY);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Calculate time range
        const timeRange = history[history.length - 1].timestamp - history[0].timestamp;
        if (timeRange === 0) return;

        // Draw data line with gradient fill
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa'; // Blue
        ctx.lineWidth = 2;

        const points: { x: number; y: number }[] = [];

        history.forEach((point, i) => {
            const x = padding.left + ((point.timestamp - history[0].timestamp) / timeRange) * chartWidth;
            const y = padding.top + chartHeight * (1 - point.blobMemoryMB / maxValue);
            points.push({ x, y });

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Fill area under line
        if (points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, height - padding.bottom);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
            ctx.closePath();

            const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
            gradient.addColorStop(0, 'rgba(96, 165, 250, 0.3)');
            gradient.addColorStop(1, 'rgba(96, 165, 250, 0.05)');
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw event markers
        history.forEach((point) => {
            if (!point.event) return;

            const x = padding.left + ((point.timestamp - history[0].timestamp) / timeRange) * chartWidth;
            const y = padding.top + chartHeight * (1 - point.blobMemoryMB / maxValue);

            ctx.beginPath();
            if (point.event === 'cleanup') {
                ctx.fillStyle = '#4ade80'; // Green
            } else if (point.event === 'add') {
                ctx.fillStyle = '#60a5fa'; // Blue
            } else {
                ctx.fillStyle = '#f87171'; // Red
            }
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();

            // White border for visibility
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw Y-axis labels
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(maxValue)}MB`, padding.left - 4, padding.top + 8);
        ctx.fillText('0MB', padding.left - 4, height - padding.bottom - 5);

        // Draw X-axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const timeSpanMin = timeRange / 60000;
        ctx.fillText(`-${timeSpanMin.toFixed(0)}m`, padding.left + 20, height - 22);
        ctx.fillText('now', width - padding.right - 15, height - 22);

    }, [history, width, height, maxValue, warningThreshold, criticalThreshold]);

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
                데이터 수집 중...
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

export default MemoryGraph;
