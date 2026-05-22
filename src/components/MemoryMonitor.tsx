/**
 * Memory Monitor Component
 * Displays current memory usage and provides cleanup controls
 */

import React, { useState, useMemo } from 'react';
import { useMemoryCleanup, CleanupResult } from '../hooks/useMemoryCleanup';
import { useMemoryHistory } from '../hooks/useMemoryHistory';
import { useGpuMemory } from '../hooks/useGpuMemory';
import { useCanvasStore } from '../store/canvasStore';
import { useSettingsStore } from '../store/settingsStore';
import { UnifiedMemoryGraph } from './UnifiedMemoryGraph';
import { useRenderTelemetry } from '../hooks/useRenderTelemetry';
import type { RenderTelemetry } from '../features/canvas/observability/RenderTelemetry';
import { t, Language, TranslationKey } from '../localization';

type TimeRange = '5min' | '1hr';

interface MemoryMonitorProps {
    className?: string;
    compact?: boolean;
    showGraph?: boolean;
    language?: Language;
}


/**
 * Get memory status color based on usage
 */
function getStatusColor(memoryMB: number): string {
    if (memoryMB < 500) return '#4ade80'; // Green
    if (memoryMB < 1000) return '#facc15'; // Yellow
    return '#f87171'; // Red
}

export const MemoryMonitor: React.FC<MemoryMonitorProps> = ({
    className = '',
    compact = false,
    showGraph = true,
    language: langProp,
}) => {
    const storeLanguage = useSettingsStore(state => state.language);
    const language = langProp || storeLanguage || 'ko';

    const TIME_RANGE_OPTIONS: Record<TimeRange, { maxDataPoints: number; sampleIntervalMs: number; label: string }> = {
        '5min': { maxDataPoints: 60, sampleIntervalMs: 5000, label: t('memoryMonitor.5min' as TranslationKey, language) },
        '1hr': { maxDataPoints: 720, sampleIntervalMs: 5000, label: t('memoryMonitor.1hr' as TranslationKey, language) },
    };
    const { stats, softRefresh } = useMemoryCleanup();
    const imageLimitConfig = useSettingsStore(state => state.imageLimitConfig);
    const developerMode = useSettingsStore(state => state.developerMode);
    const { latest: latestTelemetry, history: textureCacheHistory } = useRenderTelemetry();
    const [timeRange, setTimeRange] = useState<TimeRange>('5min');
    const historyOptions = useMemo(() => ({
        maxDataPoints: TIME_RANGE_OPTIONS[timeRange].maxDataPoints,
        sampleIntervalMs: TIME_RANGE_OPTIONS[timeRange].sampleIntervalMs,
    }), [timeRange]);
    const { history, addEvent } = useMemoryHistory(historyOptions);
    const imageCount = useCanvasStore(state => state.boardImages.length);
    const [isCleaningUp, setIsCleaningUp] = useState(false);
    const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

    // GPU Memory Monitoring (only active when showGraph is true)
    const {
        gpuInfo,
        currentUsage: gpuUsage,
        history: gpuHistory,
        isSupported: gpuSupported,
        error: gpuError,
    } = useGpuMemory({
        enabled: showGraph, // Only poll when component is visible
        pollIntervalMs: 1000,
        maxDataPoints: 300, // 5 minutes at 1s interval
    });

    const handleSoftRefresh = async () => {
        setIsCleaningUp(true);
        try {
            const result = await softRefresh();
            setLastResult(result);
            addEvent('cleanup');
            setTimeout(() => setLastResult(null), 8000);
        } finally {
            setIsCleaningUp(false);
        }
    };

    const statusColor = getStatusColor(stats.estimatedMemoryMB);

    if (compact) {
        return (
            <div
                className={`memory-monitor-compact text-base ${className}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 8px',
                    color: '#888',
                }}
            >
                <span
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: statusColor,
                    }}
                />
                <span>{stats.estimatedMemoryMB.toFixed(0)}MB</span>
                <span style={{ color: '#666' }}>|</span>
                <span>{imageCount}img</span>
                <button
                    onClick={handleSoftRefresh}
                    disabled={isCleaningUp}
                    className="text-base"
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        opacity: isCleaningUp ? 0.5 : 1,
                    }}
                    title={t('memoryMonitor.cleanupTooltip' as TranslationKey, language)}
                >
                    {isCleaningUp ? '...' : '🔄'}
                </button>
            </div>
        );
    }

    return (
        <div
            className={`memory-monitor text-base ${className}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
            }}
        >
            {/* Header with cleanup buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{t('memoryMonitor.title' as TranslationKey, language)}</span>
                <button
                    onClick={handleSoftRefresh}
                    disabled={isCleaningUp}
                    className="text-base"
                    style={{
                        background: 'rgba(96, 165, 250, 0.15)',
                        border: '1px solid rgba(96, 165, 250, 0.3)',
                        borderRadius: '8px',
                        cursor: isCleaningUp ? 'not-allowed' : 'pointer',
                        padding: '6px 10px',
                        color: '#60a5fa',
                        opacity: isCleaningUp ? 0.5 : 1,
                        transition: 'background 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                    title={t('memoryMonitor.refreshTooltip' as TranslationKey, language)}
                    onMouseEnter={(e) => { if (!isCleaningUp) e.currentTarget.style.background = 'rgba(96, 165, 250, 0.25)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(96, 165, 250, 0.15)'; }}
                >
                    <span style={{
                        display: 'inline-block',
                        animation: isCleaningUp ? 'spin 1s linear infinite' : 'none',
                    }}>🔄</span>
                    <span>{t('memoryMonitor.refresh' as TranslationKey, language)}</span>
                </button>
            </div>

            {/* Stats Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-base" style={{ color: '#888' }}>Blob URLs</span>
                    <span>{stats.blobUrlCount}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-base" style={{ color: '#888' }}>{t('memoryMonitor.estimatedMemory' as TranslationKey, language)}</span>
                    <span style={{ color: statusColor }}>
                        {stats.estimatedMemoryMB.toFixed(1)} MB
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-base" style={{ color: '#888' }}>{t('memoryMonitor.canvasImages' as TranslationKey, language)}</span>
                    <span>
                        {imageCount} <span style={{ color: '#888' }}>/ {imageLimitConfig.hardLimit} ({t('memoryMonitor.recommended' as TranslationKey, language)})</span>
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-base" style={{ color: '#888' }}>{t('memoryMonitor.lastCleanup' as TranslationKey, language)}</span>
                    <span>
                        {stats.lastCleanupTime
                            ? t('memoryMonitor.secondsAgo' as TranslationKey, language, { seconds: Math.round((Date.now() - stats.lastCleanupTime) / 1000) })
                            : t('memoryMonitor.noCleanup' as TranslationKey, language)}
                    </span>
                </div>
            </div>

            {/* Memory Bar */}
            <div
                style={{
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${Math.min((stats.estimatedMemoryMB / 2048) * 100, 100)}%`,
                        backgroundColor: statusColor,
                        transition: 'width 0.3s, background-color 0.3s',
                    }}
                />
            </div>
            <div className="text-base" style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                <span>0 MB</span>
                <span>2 GB</span>
            </div>

            {/* Last cleanup result */}
            {lastResult && (
                <div
                    className="text-lg"
                    style={{
                        padding: '8px',
                        backgroundColor: lastResult.success
                            ? 'rgba(74, 222, 128, 0.1)'
                            : 'rgba(248, 113, 113, 0.1)',
                        borderRadius: '4px',
                    }}
                >
                    {lastResult.success
                        ? `✓ ${lastResult.offloadedImages > 0 ? t('memoryMonitor.cleanupSuccess' as TranslationKey, language, { count: lastResult.offloadedImages }) : t('memoryMonitor.cleanupComplete' as TranslationKey, language)}${lastResult.cleanedUrls > 0 ? ` (${t('memoryMonitor.blobsCleaned' as TranslationKey, language, { count: lastResult.cleanedUrls })})` : ''}${lastResult.vramFreedMB && lastResult.vramFreedMB > 0 ? ` (+VRAM ${lastResult.vramFreedMB.toFixed(1)}MB)` : ''}`
                        : `✗ ${t('memoryMonitor.cleanupFailed' as TranslationKey, language)}`}
                </div>
            )}

            {/* Warning for high memory */}
            {stats.estimatedMemoryMB >= 1000 && (
                <div
                    className="text-base"
                    style={{
                        padding: '8px',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                        borderRadius: '4px',
                        color: '#f87171',
                    }}
                >
                    ⚠️ {t('memoryMonitor.highMemoryWarning' as TranslationKey, language)}
                </div>
            )}

            {/* GPU VRAM Info Section */}
            {showGraph && gpuSupported && (
                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '12px' }}>
                    {/* GPU Info Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className="text-lg" style={{ color: '#888' }}>GPU (VRAM)</span>
                            {gpuInfo && (
                                <span className="text-sm" style={{ color: '#666' }}>
                                    {gpuInfo.description}
                                </span>
                            )}
                        </div>
                        {gpuUsage && (
                            <div style={{ textAlign: 'right' }}>
                                <span className="text-lg" style={{ color: '#22c55e' }}>
                                    {gpuUsage.dedicatedMB >= 1024
                                        ? `${(gpuUsage.dedicatedMB / 1024).toFixed(1)} GB`
                                        : `${gpuUsage.dedicatedMB} MB`}
                                </span>
                                {/* Show total memory - use detected or estimate from current usage */}
                                <span className="text-lg" style={{ color: '#666', marginLeft: '4px' }}>
                                    / {(() => {
                                        // Use detected total, or estimate based on current usage
                                        const total = gpuInfo?.totalMemoryMB && gpuInfo.totalMemoryMB > gpuUsage.dedicatedMB
                                            ? gpuInfo.totalMemoryMB
                                            : Math.ceil(gpuUsage.dedicatedMB / 1024) * 1024 * 2; // Estimate: round up to nearest GB * 2
                                        return total >= 1024
                                            ? `${(total / 1024).toFixed(0)} GB`
                                            : `${total} MB`;
                                    })()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* GPU Memory Stats - Compact */}
                    {gpuUsage && (
                        <div className="text-base" style={{
                            display: 'flex',
                            gap: '16px',
                            marginBottom: '8px',
                        }}>
                            <span>
                                <span style={{ color: '#888' }}>{t('memoryMonitor.dedicated' as TranslationKey, language)}</span>
                                <span style={{ color: '#22c55e', fontWeight: 500 }}>
                                    {gpuUsage.dedicatedMB >= 1024
                                        ? `${(gpuUsage.dedicatedMB / 1024).toFixed(2)} GB`
                                        : `${gpuUsage.dedicatedMB} MB`}
                                </span>
                            </span>
                            <span>
                                <span style={{ color: '#888' }}>{t('memoryMonitor.shared' as TranslationKey, language)}</span>
                                <span style={{ color: '#60a5fa', fontWeight: 500 }}>
                                    {gpuUsage.sharedMB >= 1024
                                        ? `${(gpuUsage.sharedMB / 1024).toFixed(2)} GB`
                                        : `${gpuUsage.sharedMB} MB`}
                                </span>
                            </span>
                        </div>
                    )}

                    {/* GPU Memory Bar */}
                    {gpuUsage && (
                        <>
                            <div
                                style={{
                                    height: '8px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                }}
                            >
                                {(() => {
                                    // Calculate percentage based on detected or estimated total
                                    const total = gpuInfo?.totalMemoryMB && gpuInfo.totalMemoryMB > gpuUsage.dedicatedMB
                                        ? gpuInfo.totalMemoryMB
                                        : Math.ceil(gpuUsage.dedicatedMB / 1024) * 1024 * 2;
                                    const percent = Math.min((gpuUsage.dedicatedMB / total) * 100, 100);
                                    return (
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${percent}%`,
                                                backgroundColor: '#22c55e',
                                                transition: 'width 0.3s',
                                            }}
                                        />
                                    );
                                })()}
                            </div>
                            <div className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', color: '#666', marginTop: '2px' }}>
                                <span>0</span>
                                <span>
                                    {(() => {
                                        const total = gpuInfo?.totalMemoryMB && gpuInfo.totalMemoryMB > gpuUsage.dedicatedMB
                                            ? gpuInfo.totalMemoryMB
                                            : Math.ceil(gpuUsage.dedicatedMB / 1024) * 1024 * 2;
                                        return total >= 1024
                                            ? `${(total / 1024).toFixed(0)} GB`
                                            : `${total} MB`;
                                    })()}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Unified Memory Graph */}
            {showGraph && (
                <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span className="text-lg" style={{ color: '#888' }}>
                            {t('memoryMonitor.memoryTrend' as TranslationKey, language)}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {(Object.keys(TIME_RANGE_OPTIONS) as TimeRange[]).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className="text-xs"
                                    style={{
                                        padding: '2px 8px',
                                        border: '1px solid',
                                        borderColor: timeRange === range ? 'rgba(96, 165, 250, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '4px',
                                        backgroundColor: timeRange === range ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                                        color: timeRange === range ? '#60a5fa' : '#666',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {TIME_RANGE_OPTIONS[range].label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <UnifiedMemoryGraph
                        appHistory={history}
                        gpuHistory={gpuHistory}
                        gpuTotalMB={gpuInfo?.totalMemoryMB && gpuInfo.totalMemoryMB > (gpuUsage?.dedicatedMB || 0)
                            ? gpuInfo.totalMemoryMB
                            : null}
                        textureCacheHistory={textureCacheHistory}
                        developerMode={developerMode}
                        latestTelemetry={latestTelemetry}
                        height={180}
                        language={language}
                    />
                </div>
            )}

            {/* GPU Error Message */}
            {gpuError && (
                <div className="text-sm" style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    borderRadius: '4px',
                    color: '#f87171',
                }}>
                    {t('memoryMonitor.gpuError' as TranslationKey, language, { error: gpuError })}
                </div>
            )}
        </div>
    );
};

export default MemoryMonitor;
