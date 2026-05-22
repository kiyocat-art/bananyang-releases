import React from 'react';
import { RenderTelemetry } from '../features/canvas/observability/RenderTelemetry';
import { BindCountBuckets } from './UnifiedMemoryGraph';

interface DevRegistryStatsPanelProps {
    telemetry: RenderTelemetry;
}

const DEFAULT_BUCKETS: BindCountBuckets = { '1': 0, '2': 0, '3-5': 0, '6+': 0 };

function VramGauge({ usedMB, limitMB }: { usedMB: number; limitMB: number }) {
    const pct = limitMB > 0 ? Math.min(100, Math.round((usedMB / limitMB) * 100)) : 0;
    const color = pct >= 85 ? '#f87171' : pct >= 70 ? '#facc15' : '#4ade80';
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 3 }}>
                <span>VRAM</span>
                <span style={{ color }}>{usedMB.toFixed(0)} / {limitMB.toFixed(0)} MB ({pct}%)</span>
            </div>
            <div style={{ height: 6, backgroundColor: '#3f3f46', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, transition: 'width 0.3s' }} />
            </div>
        </div>
    );
}

function BindCountHistogram({ buckets }: { buckets: BindCountBuckets }) {
    const entries = [
        { label: '×1', value: buckets['1'], color: '#60a5fa' },
        { label: '×2', value: buckets['2'], color: '#a78bfa' },
        { label: '×3-5', value: buckets['3-5'], color: '#f97316' },
        { label: '×6+', value: buckets['6+'], color: '#f87171' },
    ];
    const max = Math.max(1, ...entries.map(e => e.value));

    return (
        <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>bindCount 분포</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {entries.map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: '#71717a', width: 32, flexShrink: 0 }}>{label}</span>
                        <div style={{ flex: 1, height: 10, backgroundColor: '#3f3f46', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                                width: `${(value / max) * 100}%`,
                                height: '100%',
                                backgroundColor: color,
                                transition: 'width 0.3s',
                                minWidth: value > 0 ? 4 : 0,
                            }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#a1a1aa', width: 24, textAlign: 'right', flexShrink: 0 }}>{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatBadge({ label, value, warn, danger }: { label: string; value: number; warn: number; danger: number }) {
    const isWarn = value >= warn;
    const isDanger = value >= danger;
    const color = isDanger ? '#f87171' : isWarn ? '#facc15' : '#a1a1aa';
    const pulse = value >= danger;
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#71717a' }}>{label}</span>
            <span style={{
                fontSize: 13,
                fontWeight: 600,
                color,
                animation: pulse ? 'dev-pulse 1s ease-in-out infinite' : 'none',
            }}>{value}</span>
        </div>
    );
}

export const DevRegistryStatsPanel: React.FC<DevRegistryStatsPanelProps> = ({ telemetry }) => {
    const buckets = telemetry.bindCountBuckets ?? DEFAULT_BUCKETS;
    const leakCount = telemetry.leakCandidatesCount ?? 0;
    const pendingDestroys = telemetry.pendingDestroysCount;
    const vramUsed = telemetry.vramUsedMB;
    const vramLimit = telemetry.vramLimitMB;

    return (
        <>
            <style>{`
                @keyframes dev-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
            <div style={{
                marginTop: 10,
                padding: '10px 12px',
                backgroundColor: 'rgba(39, 39, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
            }}>
                <div style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Dev · Texture Registry
                </div>
                <VramGauge usedMB={vramUsed} limitMB={vramLimit} />
                <BindCountHistogram buckets={buckets} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <StatBadge label="누수 후보 (idleMs > 30s)" value={leakCount} warn={1} danger={50} />
                    <StatBadge label="pendingDestroys 큐" value={pendingDestroys} warn={5} danger={10} />
                </div>
            </div>
        </>
    );
};
