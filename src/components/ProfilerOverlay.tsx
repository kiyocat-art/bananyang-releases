/**
 * Profiler Overlay Component
 * Displays real-time performance metrics in a floating overlay
 * Toggle with Ctrl+Shift+P or via settings
 */

import React, { useEffect, useRef } from 'react';
import { useProfilingMode, ProfilerStats } from '../hooks/useProfilingMode';
import { Z_INDEX } from '../constants/zIndex';

interface ProfilerOverlayProps {
    defaultEnabled?: boolean;
}

function getColorForFps(fps: number): string {
    if (fps >= 55) return '#4ade80'; // Green - good
    if (fps >= 30) return '#facc15'; // Yellow - ok
    return '#f87171'; // Red - bad
}

function getColorForFrameTime(ms: number): string {
    if (ms <= 16.67) return '#4ade80'; // Green - 60fps
    if (ms <= 33.33) return '#facc15'; // Yellow - 30fps
    return '#f87171'; // Red - below 30fps
}

function getColorForMemory(mb: number, limit?: number | null): string {
    if (limit && mb > limit * 0.9) return '#f87171'; // Red - near limit
    if (mb > 1024) return '#facc15'; // Yellow - high
    return '#4ade80'; // Green - normal
}

const StatRow: React.FC<{
    label: string;
    value: string | number;
    color?: string;
    unit?: string;
}> = ({ label, value, color, unit }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ color: '#888' }}>{label}</span>
        <span style={{ color: color || '#fff', fontFamily: 'monospace' }}>
            {value}{unit && <span className="text-xs" style={{ color: '#666' }}>{unit}</span>}
        </span>
    </div>
);

/**
 * Mini frame time graph using Canvas
 */
const FrameTimeGraph: React.FC<{ history: number[]; width?: number; height?: number }> = ({
    history,
    width = 160,
    height = 32,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || history.length < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);

        // Draw 16.67ms (60fps) reference line
        const maxMs = Math.max(33.33, ...history);
        const refY = height * (1 - 16.67 / maxMs);
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, refY);
        ctx.lineTo(width, refY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw frame time bars
        const barWidth = Math.max(1, width / history.length);
        history.forEach((ft, i) => {
            const barHeight = (ft / maxMs) * height;
            const x = i * barWidth;
            const y = height - barHeight;

            if (ft <= 16.67) {
                ctx.fillStyle = 'rgba(74, 222, 128, 0.6)';
            } else if (ft <= 33.33) {
                ctx.fillStyle = 'rgba(250, 204, 21, 0.6)';
            } else {
                ctx.fillStyle = 'rgba(248, 113, 113, 0.6)';
            }
            ctx.fillRect(x, y, barWidth - 0.5, barHeight);
        });
    }, [history, width, height]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width, height, borderRadius: 4, display: 'block', marginTop: 4 }}
        />
    );
};

export const ProfilerOverlay: React.FC<ProfilerOverlayProps> = ({
    defaultEnabled = false,
}) => {
    const { enabled, stats, toggle, setEnabled } = useProfilingMode();

    // Initialize with default
    useEffect(() => {
        if (defaultEnabled) {
            setEnabled(true);
        }
    }, [defaultEnabled, setEnabled]);

    // Keyboard shortcut: Ctrl+Shift+P
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                toggle();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggle]);

    if (!enabled) {
        return null;
    }

    return (
        <div
            className="text-xs"
            style={{
                position: 'fixed',
                top: '40px',
                right: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '12px',
                fontFamily: 'monospace',
                color: '#fff',
                zIndex: Z_INDEX.DROPDOWN,
                minWidth: '180px',
                userSelect: 'none',
                pointerEvents: 'auto',
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
                <span style={{ fontWeight: 600, color: '#60a5fa' }}>Profiler</span>
                <button
                    onClick={toggle}
                    className="text-sm"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#666',
                        cursor: 'pointer',
                        padding: '2px 4px',
                    }}
                    title="Close (Ctrl+Shift+P)"
                >
                    ✕
                </button>
            </div>

            {/* Frame Stats */}
            <div style={{ marginBottom: '8px' }}>
                <div className="text-xs" style={{
                    color: '#666',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                }}>
                    Frame
                </div>
                <StatRow
                    label="FPS"
                    value={stats.fps}
                    color={getColorForFps(stats.fps)}
                />
                <StatRow
                    label="Frame"
                    value={stats.frameTime}
                    unit="ms"
                    color={getColorForFrameTime(stats.frameTime)}
                />
                <StatRow
                    label="Avg"
                    value={stats.frameTimeAvg}
                    unit="ms"
                    color={getColorForFrameTime(stats.frameTimeAvg)}
                />
                {stats.frameTimeHistory.length >= 2 && (
                    <FrameTimeGraph history={stats.frameTimeHistory} />
                )}
            </div>

            {/* Memory Stats */}
            <div style={{ marginBottom: '8px' }}>
                <div className="text-xs" style={{
                    color: '#666',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                }}>
                    Memory
                </div>
                <StatRow
                    label="Blobs"
                    value={stats.blobCount}
                />
                <StatRow
                    label="Blob MB"
                    value={stats.blobMemoryMB}
                    unit="MB"
                    color={getColorForMemory(stats.blobMemoryMB)}
                />
                {stats.jsHeapMB !== null && (
                    <StatRow
                        label="JS Heap"
                        value={stats.jsHeapMB}
                        unit="MB"
                        color={getColorForMemory(stats.jsHeapMB, stats.jsHeapLimitMB)}
                    />
                )}
                <StatRow
                    label="GC Events"
                    value={stats.gcEvents}
                    color={stats.gcEvents > 0 ? '#facc15' : '#888'}
                />
            </div>

            {/* Texture Stats */}
            <div style={{ marginBottom: '8px' }}>
                <div className="text-xs" style={{
                    color: '#666',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                }}>
                    Textures
                </div>
                <StatRow
                    label="Count"
                    value={stats.textureCount}
                />
                <StatRow
                    label="VRAM (est)"
                    value={stats.textureMemoryMB}
                    unit="MB"
                    color={getColorForMemory(stats.textureMemoryMB)}
                />
            </div>

            {/* Canvas Stats */}
            <div>
                <div className="text-xs" style={{
                    color: '#666',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                }}>
                    Canvas
                </div>
                <StatRow
                    label="Images"
                    value={stats.imageCount}
                />
                <StatRow
                    label="Selected"
                    value={stats.selectedCount}
                />
            </div>

            {/* Keyboard hint */}
            <div className="text-xs" style={{
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#555',
                textAlign: 'center',
            }}>
                Ctrl+Shift+P to toggle
            </div>
        </div>
    );
};

export default ProfilerOverlay;
