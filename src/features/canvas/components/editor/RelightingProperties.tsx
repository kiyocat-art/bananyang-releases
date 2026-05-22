import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Z_INDEX } from '../../../../constants/zIndex';
import { LightSource, LightType } from '../../../../types';
import { t, Language } from '../../../../localization';
import { Tooltip } from '../../../../components/Tooltip';
import { PlusIcon, TrashIcon, CopyIcon, ResetIcon } from '../../../../components/icons';
import { useCanvasStore } from '../../../../store/canvasStore';
import { AdvancedColorPicker } from '../../../../components/AdvancedColorPicker';
import { LIGHTING_PRESETS, PRESET_CATEGORIES, PresetCategory, LightingPreset } from './relightPresets';
import { HoverEdgeAutoScroll } from '../../../../components/HoverEdgeAutoScroll';

// ── i18n helpers ──────────────────────────────────────────────────────────────

const getPresetName = (preset: LightingPreset, lang: Language): string =>
    preset.names?.[lang] ?? (lang === 'ko' ? preset.nameKo : preset.nameEn);

const getPresetDesc = (preset: LightingPreset, lang: Language): string =>
    preset.descriptions?.[lang] ??
    (lang === 'ko' && preset.descriptionKo ? preset.descriptionKo : preset.promptHint);

// ── SVG Pictograms ────────────────────────────────────────────────────────────

const ICON_CLS = 'text-zinc-400';

const LightTypeIcon: React.FC<{ type: LightType; size?: number }> = ({ type, size = 16 }) => {
    const s = size;
    const c = s / 2;
    switch (type) {
        case 'omni': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                {[0,45,90,135,180,225,270,315].map(deg => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = 8 + Math.cos(rad) * 4; const y1 = 8 + Math.sin(rad) * 4;
                    const x2 = 8 + Math.cos(rad) * 6; const y2 = 8 + Math.sin(rad) * 6;
                    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>;
                })}
            </svg>
        );
        case 'direct': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <line x1="3" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <polyline points="8,5 11,8 8,11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
        case 'sun': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
                {[0,60,120,180,240,300].map(deg => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = 8 + Math.cos(rad) * 4.5; const y1 = 8 + Math.sin(rad) * 4.5;
                    const x2 = 8 + Math.cos(rad) * 6.5; const y2 = 8 + Math.sin(rad) * 6.5;
                    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>;
                })}
            </svg>
        );
        case 'ambient': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5"/>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 2"/>
            </svg>
        );
        case 'rim': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M 11.8 4.2 A 6 6 0 0 1 11.8 11.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
        );
        case 'area': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="4" cy="6" r="0.8" fill="currentColor"/>
                <circle cx="12" cy="6" r="0.8" fill="currentColor"/>
                <circle cx="4" cy="10" r="0.8" fill="currentColor"/>
                <circle cx="12" cy="10" r="0.8" fill="currentColor"/>
            </svg>
        );
        case 'gobo': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1"/>
                <line x1="2" y1="8.5" x2="14" y2="8.5" stroke="currentColor" strokeWidth="1"/>
                <line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1"/>
            </svg>
        );
        case 'practical': return (
            <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className={ICON_CLS}>
                <path d="M6 10 Q6 6 8 5 Q10 6 10 10 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <line x1="8" y1="2" x2="8" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="3.5" y1="3.5" x2="5" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="12.5" y1="3.5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <line x1="6" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="7" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
        );
        default: return null;
    }
};

const PresetIcon: React.FC<{ presetId: string }> = ({ presetId }) => {
    const cls = ICON_CLS;
    switch (presetId) {
        case 'rembrandt': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="14" cy="12" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="3" y1="4" x2="11" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="10" cy="9" r="1.5" fill="currentColor" opacity="0.6"/>
            </svg>
        );
        case 'butterfly': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="14" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="12" y1="2" x2="12" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M9 9 L12 8 L15 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
        );
        case 'loop': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="14" cy="13" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="3" y1="5" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
        );
        case 'split': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <path d="M12 4 L12 20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5"/>
                <rect x="12" y="4" width="10" height="16" rx="5" fill="currentColor" opacity="0.15"/>
                <line x1="2" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <polyline points="6,9 9,12 6,15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
        case '3point_studio': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="4" y1="5" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="20" y1="7" x2="15" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
                <line x1="12" y1="22" x2="12" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
            </svg>
        );
        case 'cinematic_moody': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <rect x="8" y="4" width="14" height="16" rx="5" fill="currentColor" opacity="0.08"/>
                <line x1="2" y1="8" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="14" cy="12" r="4" stroke="currentColor" strokeWidth="1"/>
            </svg>
        );
        case 'neon_night': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="7" cy="12" r="4" stroke="#b060b0" strokeWidth="1.5"/>
                <circle cx="17" cy="12" r="4" stroke="#40b0b0" strokeWidth="1.5"/>
            </svg>
        );
        case 'golden_hour': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <path d="M2 18 Q6 10 12 10 Q18 10 22 16" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <circle cx="3" cy="17" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="3" y1="14" x2="3" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
        );
        case 'blue_hour': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <path d="M8 12 A6 6 0 0 1 8 12 A5 5 0 1 0 15 7 A6 6 0 0 1 8 12Z" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="19" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/>
            </svg>
        );
        case 'overcast': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <path d="M5 10 Q5 6 9 6 Q10 3 14 4 Q18 4 18 8 Q21 8 21 11 Q21 14 18 14 L6 14 Q3 14 3 11 Q3 10 5 10Z" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="8" y1="18" x2="8" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
                <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
                <line x1="16" y1="18" x2="16" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            </svg>
        );
        case 'harsh_sunlight': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="12" y1="8" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="8" y1="12" x2="5" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
                <line x1="16" y1="12" x2="19" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" strokeLinecap="round"/>
            </svg>
        );
        case 'window_soft': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <rect x="2" y="3" width="7" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <line x1="5.5" y1="3" x2="5.5" y2="13" stroke="currentColor" strokeWidth="0.8"/>
                <line x1="2" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="0.8"/>
                <line x1="9" y1="6" x2="22" y2="10" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 1.5" opacity="0.6"/>
                <line x1="9" y1="10" x2="22" y2="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 1.5" opacity="0.4"/>
            </svg>
        );
        case 'rim_dramatic': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" strokeDasharray="0 28.3" strokeLinecap="round"
                    style={{ strokeDashoffset: 0 }}/>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" opacity="0.5"/>
            </svg>
        );
        case 'god_rays': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                {[-30,-15,0,15,30].map((a, i) => {
                    const rad = ((a - 90) * Math.PI) / 180;
                    const x2 = 12 + Math.cos(rad) * 16;
                    const y2 = 4 + Math.sin(rad) * 16;
                    return <line key={i} x1="12" y1="7" x2={x2} y2={y2} stroke="currentColor" strokeWidth={i === 2 ? 1.5 : 1} opacity={i === 2 ? 0.9 : 0.5} strokeLinecap="round"/>;
                })}
            </svg>
        );
        case 'horror_under': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="10" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="12" y1="22" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="9,19 12,16 15,19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
        case 'studio_white': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="1" y="6" width="5" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <rect x="18" y="8" width="5" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
        );
        case 'product_dramatic': return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="2" y1="7" x2="8" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M19 8 A7 7 0 0 1 19 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
            </svg>
        );
        default: return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={cls}>
                <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
        );
    }
};

// ── LightColorPicker ───────────────────────────────────────────────────────────

const LightColorPicker: React.FC<{ color: string; onChange: (color: string) => void; language: Language }> = ({ color, onChange, language }) => {
    const [showPicker, setShowPicker] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 });

    const PICKER_W = 192;
    const PICKER_H = 172;

    const handleClick = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            let x = rect.left;
            let y = rect.bottom + 4;
            if (x + PICKER_W > window.innerWidth - 8) x = window.innerWidth - PICKER_W - 8;
            if (y + PICKER_H > window.innerHeight - 8) y = rect.top - PICKER_H - 4;
            setPickerPos({ x: Math.max(8, x), y: Math.max(8, y) });
        }
        setShowPicker(v => !v);
    };

    return (
        <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                {t('relight.lightColor', language)}
            </label>
            <button
                ref={buttonRef}
                onClick={handleClick}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full h-7 rounded border border-white/20 transition-colors hover:border-white/40 cursor-pointer"
                style={{ backgroundColor: color }}
            />
            {showPicker && ReactDOM.createPortal(
                <>
                    <div className="fixed inset-0" style={{ zIndex: Z_INDEX.MODAL }} onClick={() => setShowPicker(false)} />
                    <div
                        className="fixed"
                        style={{ left: pickerPos.x, top: pickerPos.y, zIndex: Z_INDEX.MODAL_ELEVATED }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <AdvancedColorPicker color={color} onChange={onChange} compact />
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

// ── Slider helper ──────────────────────────────────────────────────────────────

const PropSlider: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    unit?: string;
    gradientStyle?: React.CSSProperties;
    minLabel?: string;
    maxLabel?: string;
    onChange: (v: number) => void;
}> = ({ label, value, min, max, unit = '%', gradientStyle, minLabel, maxLabel, onChange }) => (
    <div>
        <div className="flex justify-between mb-1">
            <label className="text-xs font-medium text-zinc-400">{label}</label>
            <span className="text-xs text-zinc-500">{value}{unit}</span>
        </div>
        <div className="relative">
            {gradientStyle && (
                <div className="absolute inset-0 rounded h-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={gradientStyle} />
            )}
            <input
                type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full relative z-10"
                style={{ touchAction: 'none', ...(gradientStyle ? { WebkitAppearance: 'none', background: 'transparent' } : {}) }}
            />
        </div>
        {(minLabel || maxLabel) && (
            <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-zinc-500">{minLabel}</span>
                <span className="text-[10px] text-zinc-500">{maxLabel}</span>
            </div>
        )}
    </div>
);

// ── Types config ───────────────────────────────────────────────────────────────

const ALL_LIGHT_TYPES: LightType[] = ['omni', 'direct', 'sun', 'ambient', 'rim', 'area', 'gobo', 'practical'];

// ── Category label helper ──────────────────────────────────────────────────────

const categoryLabelKey = (cat: PresetCategory) =>
    `relight.preset.category.${cat}` as const;

// ── Main Component ─────────────────────────────────────────────────────────────

interface RelightingPropertiesProps {
    lightSources: LightSource[];
    selectedLightId: string | null;
    onAddLight: () => void;
    onSelectLight: (id: string) => void;
    onUpdateLight: (id: string, updates: Partial<LightSource>) => void;
    onDeleteLight: (id: string) => void;
    onPasteLights: (lights: LightSource[]) => void;
    onReset: () => void;
    onSetLightingPrompt?: (hint: string) => void;
    language: Language;
}

export const RelightingProperties: React.FC<RelightingPropertiesProps> = ({
    lightSources,
    selectedLightId,
    onAddLight,
    onSelectLight,
    onUpdateLight,
    onDeleteLight,
    onPasteLights,
    onReset,
    onSetLightingPrompt,
    language,
}) => {
    const selectedLight = lightSources.find(l => l.id === selectedLightId);
    const { copyLighting, lightingClipboard } = useCanvasStore();

    const [activeTab, setActiveTab] = useState<'presets' | 'lights'>('presets');
    const [activeCategory, setActiveCategory] = useState<PresetCategory>('portrait');
    const presetsScrollRef = useRef<HTMLDivElement>(null);
    const lightsScrollRef = useRef<HTMLDivElement>(null);

    const filteredPresets = LIGHTING_PRESETS.filter(p => p.category === activeCategory);

    const applyPreset = (preset: LightingPreset) => {
        const withIds = preset.lights.map(l => ({ ...l, id: crypto.randomUUID() }));
        onReset();
        onPasteLights(withIds);
        onSetLightingPrompt?.(preset.promptHint);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedLight) { e.preventDefault(); copyLighting('single', [selectedLight]); }
                else if (lightSources.length > 0) { e.preventDefault(); copyLighting('all', lightSources); }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (lightingClipboard) { e.preventDefault(); onPasteLights(lightingClipboard.data); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLight, lightSources, copyLighting, lightingClipboard, onPasteLights]);

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{t('relight.title', language)}</h3>
                <div className="flex items-center gap-1">
                    <Tooltip tip={t('common.reset', language)} position="top">
                        <button
                            onClick={onReset}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                        >
                            <ResetIcon className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                    <Tooltip tip={t('relight.addLight', language)} position="left">
                        <button
                            onClick={onAddLight}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="p-1.5 bg-sky-500 hover:bg-sky-600 rounded transition-colors"
                        >
                            <PlusIcon className="w-3.5 h-3.5 text-white" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Tab Toggle */}
            <div className="flex rounded-md overflow-hidden border border-white/10 flex-shrink-0">
                {(['presets', 'lights'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                            activeTab === tab
                                ? 'bg-yellow-400 text-zinc-950'
                                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                        }`}
                    >
                        {tab === 'presets' ? t('relight.presets', language) : t('relight.lights', language)}
                    </button>
                ))}
            </div>

            {/* ── PRESETS TAB ── */}
            {activeTab === 'presets' && (
                <div className="flex-1 relative min-h-0">
                <div ref={presetsScrollRef} className="flex flex-col gap-2 h-full overflow-y-auto custom-scrollbar">
                    {/* Category strip — single-line horizontal scroll, no wrap */}
                    <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {PRESET_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                                    activeCategory === cat
                                        ? 'bg-yellow-400 text-zinc-950'
                                        : 'bg-white/8 text-zinc-400 hover:bg-white/15 hover:text-zinc-200'
                                }`}
                            >
                                {t(categoryLabelKey(cat), language)}
                            </button>
                        ))}
                    </div>

                    {/* Preset list — single column */}
                    <div className="flex flex-col gap-1">
                        {filteredPresets.map((preset) => (
                            <Tooltip key={preset.id} tip={getPresetDesc(preset, language)} position="left" tipClassName="max-w-[220px]">
                                <button
                                    onClick={() => applyPreset(preset)}
                                    className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/15 hover:border-white/20 transition-colors cursor-pointer"
                                >
                                    <div className="opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <PresetIcon presetId={preset.id} />
                                    </div>
                                    <span className="text-zinc-400 group-hover:text-zinc-200 text-xs leading-tight transition-colors text-left">
                                        {getPresetName(preset, language)}
                                    </span>
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>
                <HoverEdgeAutoScroll targetRef={presetsScrollRef} />
                </div>
            )}

            {/* ── LIGHTS TAB ── */}
            {activeTab === 'lights' && (
                <div className="flex-1 relative min-h-0">
                <div ref={lightsScrollRef} className="flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar">
                    {/* Light List */}
                    <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar flex-shrink-0">
                        {lightSources.length === 0 ? (
                            <p className="text-xs text-zinc-500 text-center py-3">{t('relight.noLights', language)}</p>
                        ) : (
                            lightSources.map((light, index) => {
                                const isCopied = lightingClipboard?.type === 'single' && lightingClipboard.data[0].id === light.id;
                                return (
                                    <div
                                        key={light.id}
                                        onClick={() => onSelectLight(light.id)}
                                        className={`px-2 py-1.5 rounded cursor-pointer transition-colors relative group ${
                                            selectedLightId === light.id
                                                ? 'bg-yellow-400/15 border border-yellow-400/70'
                                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: light.color }} />
                                                <span className="text-xs text-white truncate">
                                                    {t(`relight.type.${light.type}`, language)} {index + 1}
                                                </span>
                                                {isCopied && (
                                                    <span className="text-[9px] bg-zinc-600 text-white px-1 py-0.5 rounded-full">
                                                        {t('common.copied', language)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onPasteLights([light]); }}
                                                    className="p-0.5 hover:bg-white/20 rounded transition-colors text-zinc-400 hover:text-white"
                                                >
                                                    <CopyIcon className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteLight(light.id); }}
                                                    className="p-0.5 hover:bg-red-500/20 rounded transition-colors"
                                                >
                                                    <TrashIcon className="w-3 h-3 text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Light Properties */}
                    {selectedLight && (
                        <div className="flex flex-col gap-3 p-2.5 bg-white/5 rounded-md border border-white/10">
                            {/* Light Type — 3×3 grid */}
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    {t('relight.lightType', language)}
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                    {ALL_LIGHT_TYPES.map((type, idx) => {
                                        if (idx === 8) return <div key="spacer" />;
                                        return (
                                            <Tooltip key={type} tip={t(`tooltip.relight.${type}`, language)} position="top">
                                                <button
                                                    onClick={() => onUpdateLight(selectedLight.id, { type })}
                                                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded transition-colors w-full ${
                                                        selectedLight.type === type
                                                            ? 'bg-yellow-400/20 border border-yellow-400 text-yellow-300'
                                                            : 'bg-white/8 border border-white/10 text-zinc-400 hover:bg-white/15 hover:text-zinc-200'
                                                    }`}
                                                >
                                                    <LightTypeIcon type={type} size={14} />
                                                    <span className="text-[9px] leading-none">{t(`relight.type.${type}`, language)}</span>
                                                </button>
                                            </Tooltip>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Light Color */}
                            <LightColorPicker
                                color={selectedLight.color}
                                onChange={(color) => onUpdateLight(selectedLight.id, { color })}
                                language={language}
                            />

                            {/* Color Temperature */}
                            <PropSlider
                                label={t('relight.colorTemperature', language)}
                                value={selectedLight.colorTemperature ?? 0}
                                min={-100}
                                max={100}
                                onChange={(v) => onUpdateLight(selectedLight.id, { colorTemperature: v })}
                                gradientStyle={{
                                    background: 'linear-gradient(to right, #9bb4ff, #ffffff, #ffb347)',
                                    height: '4px',
                                    borderRadius: '2px',
                                }}
                                minLabel={t('relight.colorTemp.cool', language)}
                                maxLabel={t('relight.colorTemp.warm', language)}
                            />

                            {/* Intensity */}
                            <PropSlider
                                label={`${t('relight.lightIntensity', language)}`}
                                value={selectedLight.intensity}
                                min={0}
                                max={100}
                                onChange={(v) => onUpdateLight(selectedLight.id, { intensity: v })}
                            />

                            {/* Direction (direct / sun) */}
                            {(selectedLight.type === 'direct' || selectedLight.type === 'sun') && (
                                <PropSlider
                                    label={t('relight.lightDirection', language)}
                                    value={selectedLight.direction ?? 0}
                                    min={0}
                                    max={360}
                                    unit="°"
                                    onChange={(v) => onUpdateLight(selectedLight.id, { direction: v })}
                                />
                            )}

                            {/* Radius (not ambient) */}
                            {selectedLight.type !== 'ambient' && (
                                <PropSlider
                                    label={t('relight.radius', language)}
                                    value={selectedLight.radius ?? 50}
                                    min={0}
                                    max={100}
                                    onChange={(v) => onUpdateLight(selectedLight.id, { radius: v })}
                                />
                            )}

                            {/* Specular Intensity */}
                            <PropSlider
                                label={t('relight.specularIntensity', language)}
                                value={selectedLight.specularIntensity ?? 30}
                                min={0}
                                max={100}
                                onChange={(v) => onUpdateLight(selectedLight.id, { specularIntensity: v })}
                            />

                            {/* Shadow Softness */}
                            <PropSlider
                                label={t('relight.shadowSoftness', language)}
                                value={selectedLight.shadowSoftness ?? 50}
                                min={0}
                                max={100}
                                onChange={(v) => onUpdateLight(selectedLight.id, { shadowSoftness: v })}
                            />

                            {/* Affected Area */}
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    {t('relight.affectedArea', language)}
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                    {(['full', 'foreground', 'background'] as const).map(area => (
                                        <button
                                            key={area}
                                            onClick={() => onUpdateLight(selectedLight.id, { affectedArea: area })}
                                            className={`py-1 rounded text-[9px] transition-colors ${
                                                (selectedLight.affectedArea ?? 'full') === area
                                                    ? 'bg-sky-500/30 border border-sky-500 text-sky-300'
                                                    : 'bg-white/8 border border-white/10 text-zinc-400 hover:bg-white/15'
                                            }`}
                                        >
                                            {t(`relight.affectedArea.${area}`, language)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Atmospheric Effect */}
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    {t('relight.atmosphericEffect', language)}
                                </label>
                                <select
                                    value={selectedLight.atmosphericEffect ?? 'none'}
                                    onChange={(e) => onUpdateLight(selectedLight.id, {
                                        atmosphericEffect: e.target.value as LightSource['atmosphericEffect']
                                    })}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="w-full bg-zinc-800 border border-white/10 rounded px-2 py-1 text-xs text-zinc-300 hover:border-white/20 transition-colors appearance-none cursor-pointer"
                                >
                                    {(['none', 'volumetric', 'god_rays', 'haze'] as const).map(fx => (
                                        <option key={fx} value={fx}>
                                            {t(`relight.atmosphericEffect.${fx}`, language)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
                <HoverEdgeAutoScroll targetRef={lightsScrollRef} />
                </div>
            )}
        </div>
    );
};
