// ToolChipBar — Row 2 icon + chip toolbar
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../../../constants/zIndex';
import { ModelName, Resolution, AspectRatio, PromptFolder, ThinkingLevel, GroundingTool, GridLayout } from '../../../../types';
import { Language, t, TranslationKey } from '../../../../localization';
import { SettingsPopover } from './SettingsPopover';
import { PromptPresets } from '../PromptPresets';
import { MODEL_NAMES, MODEL_RESOLUTIONS } from '../../../../constants';
import { Tooltip } from '../../../../components/Tooltip';
import { HoverEdgeAutoScroll } from '../../../../components/HoverEdgeAutoScroll';

// ─── Icons ────────────────────────────────────────────────────────────────────

// Horizontal sliders — resolution & ratio settings
const SlidersIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
);

const ThinkingIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

// Google official "G" logo (monochromatic, single stroke path)
const SearchIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
        {/* Google "G" simplified to monochromatic pictogram */}
        <path d="M12 11h6.5c.07.44.1.88.1 1.33C18.6 16.5 15.8 19 12 19a7 7 0 110-14c1.88 0 3.6.74 4.87 1.94l-1.98 1.98A4.25 4.25 0 0012 7.75 4.25 4.25 0 007.75 12 4.25 4.25 0 0012 16.25c2.1 0 3.6-1.07 4.08-2.75H12V11z" />
    </svg>
);

// Google Images style — image frame + search magnifier (monochromatic pictogram)
const ImageSearchIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        {/* Image frame */}
        <rect x="2" y="3.5" width="14" height="11" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Mountain/landscape inside frame */}
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 11.5l3.5-3.5 3 3 2-2 3.5 3.5" />
        {/* Search magnifier overlaid */}
        <circle cx="18" cy="18" r="3.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 20.5L22.5 22.5" />
    </svg>
);

// ─── Grid Layout Icons ────────────────────────────────────────────────────────

const ICON_PROPS = { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const GridDefaultIcon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
);
const Grid1x2Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
);
const Grid2x1Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
);
const Grid1x3Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="9" y1="2" x2="9" y2="22" />
        <line x1="16" y1="2" x2="16" y2="22" />
    </svg>
);
const Grid3x1Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="2" y1="16" x2="22" y2="16" />
    </svg>
);
const Grid2x2Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
);
const Grid2x3Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="9" y1="2" x2="9" y2="22" />
        <line x1="16" y1="2" x2="16" y2="22" />
    </svg>
);
const Grid3x2Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="2" y1="16" x2="22" y2="16" />
        <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
);
const Grid3x3Icon = ({ className }: { className?: string }) => (
    <svg {...ICON_PROPS} className={className}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="2" y1="16" x2="22" y2="16" />
        <line x1="9" y1="2" x2="9" y2="22" />
        <line x1="16" y1="2" x2="16" y2="22" />
    </svg>
);

const GRID_LAYOUTS: { value: GridLayout; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { value: '1x2', label: '1×2', Icon: Grid1x2Icon },
    { value: '2x1', label: '2×1', Icon: Grid2x1Icon },
    { value: '1x3', label: '1×3', Icon: Grid1x3Icon },
    { value: '3x1', label: '3×1', Icon: Grid3x1Icon },
    { value: '2x2', label: '2×2', Icon: Grid2x2Icon },
    { value: '2x3', label: '2×3', Icon: Grid2x3Icon },
    { value: '3x2', label: '3×2', Icon: Grid3x2Icon },
    { value: '3x3', label: '3×3', Icon: Grid3x3Icon },
];

function getGridIcon(layout: GridLayout | null): React.FC<{ className?: string }> {
    switch (layout) {
        case '1x2': return Grid1x2Icon;
        case '2x1': return Grid2x1Icon;
        case '1x3': return Grid1x3Icon;
        case '3x1': return Grid3x1Icon;
        case '2x2': return Grid2x2Icon;
        case '2x3': return Grid2x3Icon;
        case '3x2': return Grid3x2Icon;
        case '3x3': return Grid3x3Icon;
        default: return GridDefaultIcon;
    }
}

// ─── GridLayoutPopover ────────────────────────────────────────────────────────

interface GridLayoutPopoverProps {
    gridLayout: GridLayout | null;
    onGridLayoutChange: (v: GridLayout | null) => void;
    triggerRef: React.RefObject<HTMLDivElement>;
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    language: Language;
}

const GridLayoutPopover: React.FC<GridLayoutPopoverProps> = ({
    gridLayout, onGridLayoutChange, triggerRef, isOpen, setIsOpen, language,
}) => {
    const [position, setPosition] = useState<{ bottom: number; left: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, triggerRef, setIsOpen]);

    useEffect(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
            bottom: window.innerHeight - rect.top + 8,
            left: rect.left + rect.width / 2,
        });
    }, [isOpen, triggerRef]);

    if (!isOpen || !position) return null;

    const title = language === 'ko' ? '다중 그리드 생성' : language === 'ja' ? 'グリッド生成' : 'Multi-Grid Output';

    return createPortal(
        <div
            ref={dropdownRef}
            style={{ position: 'fixed', bottom: position.bottom, left: position.left, transform: 'translateX(-50%)', zIndex: Z_INDEX.DROPDOWN }}
            className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-3 w-52"
        >
            <p className="text-xs text-zinc-400 text-center mb-2.5 font-medium">{title}</p>
            <div className="grid grid-cols-2 gap-2">
                {GRID_LAYOUTS.map(({ value, label, Icon }) => {
                    const isSelected = gridLayout === value;
                    return (
                        <button
                            key={value}
                            onClick={() => { onGridLayoutChange(isSelected ? null : value); setIsOpen(false); }}
                            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all duration-150 cursor-pointer ${
                                isSelected
                                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                                    : 'bg-white/[0.05] border-white/[0.08] text-zinc-400 hover:bg-white/[0.10] hover:text-white hover:border-white/20'
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-medium">{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    );
};

// ─── Grounding Help Tooltip Content ──────────────────────────────────────────

const GoogleSearchHelpTip: React.FC<{ language: Language }> = ({ language }) => {
    const ko = language === 'ko';
    const ja = language === 'ja';
    return (
        <div className="w-56 space-y-2.5">
            <div>
                <p className="text-xs font-bold text-white mb-1">
                    {ko ? 'Google 검색 그라운딩' : ja ? 'Google検索グラウンディング' : 'Google Search Grounding'}
                </p>
                <p className="text-xs text-zinc-300 leading-relaxed">
                    {ko
                        ? '실시간 Google 웹 검색 결과를 AI 이미지 생성에 반영합니다. 최신 트렌드, 실존 브랜드·상품을 더 정확하게 표현합니다.'
                        : ja
                        ? 'リアルタイムのGoogle検索結果をAI生成に反映します。最新トレンドや実在ブランドをより正確に表現できます。'
                        : 'Grounds AI generation with real-time Google web search. Reflects latest trends and real-world products accurately.'}
                </p>
            </div>
            <div className="bg-yellow-500/15 border border-yellow-500/35 rounded-lg px-2.5 py-2">
                <p className="text-xs font-bold text-yellow-400">
                    ⚠ {ko ? '추가 비용이 발생합니다' : ja ? '追加費用が発生します' : 'Additional cost applies'}
                </p>
                <p className="text-xs text-yellow-300/80 mt-0.5 leading-relaxed">
                    {ko
                        ? 'Google 검색 API 비용이 표준 생성 비용에 추가됩니다. 필요한 경우에만 활성화하세요.'
                        : ja
                        ? 'Google検索APIの利用料が標準生成コストに加算されます。必要なときのみ有効にしてください。'
                        : 'Google Search API charges are added on top of standard generation cost. Enable only when needed.'}
                </p>
            </div>
        </div>
    );
};

const ImageSearchHelpTip: React.FC<{ language: Language }> = ({ language }) => {
    const ko = language === 'ko';
    const ja = language === 'ja';
    return (
        <div className="w-56 space-y-2.5">
            <div>
                <p className="text-xs font-bold text-white mb-1">
                    {ko ? '이미지 검색 그라운딩' : ja ? '画像検索グラウンディング' : 'Image Search Grounding'}
                </p>
                <p className="text-xs text-zinc-300 leading-relaxed">
                    {ko
                        ? 'Google 이미지 검색 결과를 시각적 레퍼런스로 활용합니다. 실존 아이템의 외관, 실제 사진 스타일 등을 사실적으로 반영합니다.'
                        : ja
                        ? 'Google画像検索の結果をビジュアル参照として使用します。実在アイテムの外観や実写スタイルをリアルに反映します。'
                        : 'Uses Google Image Search as visual references. Reflects real product appearances and photographic styles accurately.'}
                </p>
            </div>
            <div className="bg-yellow-500/15 border border-yellow-500/35 rounded-lg px-2.5 py-2">
                <p className="text-xs font-bold text-yellow-400">
                    ⚠ {ko ? '추가 비용이 발생합니다' : ja ? '追加費用が発生します' : 'Additional cost applies'}
                </p>
                <p className="text-xs text-yellow-300/80 mt-0.5 leading-relaxed">
                    {ko
                        ? 'Google 이미지 검색 API 비용이 표준 생성 비용에 추가됩니다. 필요한 경우에만 활성화하세요.'
                        : ja
                        ? 'Google画像検索APIの利用料が標準生成コストに加算されます。必要なときのみ有効にしてください。'
                        : 'Google Image Search API charges are added on top of standard generation cost. Enable only when needed.'}
                </p>
            </div>
        </div>
    );
};

// Monochromatic ? help icon button
const HelpButton: React.FC<{ tip: React.ReactNode }> = ({ tip }) => (
    <Tooltip tip={tip} position="top">
        <button
            type="button"
            onClick={e => e.stopPropagation()}
            className="
                w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0
                border border-zinc-600/60 text-zinc-500
                hover:border-zinc-400/70 hover:text-zinc-300
                transition-all duration-150 cursor-help
                text-[10px] font-bold leading-none select-none
            "
        >
            ?
        </button>
    </Tooltip>
);

// ─── Chip Component (ThinkingLevel / Grounding chips only) ────────────────────

interface ChipProps {
    onClick: () => void;
    isActive?: boolean;
    icon?: React.ReactNode;
    label: string;
    disabled?: boolean;
    tooltip?: string;
}

const Chip: React.FC<ChipProps> = ({ onClick, isActive, icon, label, disabled, tooltip }) => {
    const inner = (
        <button
            onClick={onClick}
            disabled={disabled}
            aria-pressed={isActive}
            className={`
                flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium
                border transition-all duration-200 cursor-pointer whitespace-nowrap
                ${isActive
                    ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-400'
                    : 'bg-white/[0.08] border-white/[0.12] text-white/70 hover:bg-white/[0.12] hover:text-white hover:border-white/20'
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
        >
            {icon && (
                <span className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-yellow-400' : 'text-zinc-400'}`}>
                    {icon}
                </span>
            )}
            <span>{label}</span>
        </button>
    );

    if (tooltip) return <Tooltip tip={tooltip} position="top">{inner}</Tooltip>;
    return inner;
};

// ─── ToolChipBar ──────────────────────────────────────────────────────────────

export interface ToolChipBarProps {
    modelName: ModelName;
    language: Language;
    // Resolution / Ratio
    selectedResolution: Resolution;
    setSelectedResolution: (r: Resolution) => void;
    selectedAspectRatio: AspectRatio;
    setSelectedAspectRatio: (r: AspectRatio) => void;
    // Preset
    folders: PromptFolder[];
    currentPrompt: string;
    onLoadPrompt: (prompt: string) => void;
    onManagePreset: () => void;
    onSavePreset: () => void;
    selectedFolderId: string | null;
    setSelectedFolderId: (id: string | null) => void;
    onPresetDropdownStateChange: (open: boolean) => void;
    promptPanelRef?: React.RefObject<HTMLDivElement>;
    // Phase 3 — ThinkingLevel & Grounding
    thinkingLevel?: ThinkingLevel | null;
    onThinkingLevelChange?: (level: ThinkingLevel | null) => void;
    groundingTools?: Set<GroundingTool>;
    onGroundingToolToggle?: (tool: GroundingTool) => void;
    // Multi-grid generation
    gridLayout?: GridLayout | null;
    onGridLayoutChange?: (v: GridLayout | null) => void;
}

export const ToolChipBar: React.FC<ToolChipBarProps> = ({
    modelName, language,
    selectedResolution, setSelectedResolution,
    selectedAspectRatio, setSelectedAspectRatio,
    folders, currentPrompt, onLoadPrompt, onManagePreset, onSavePreset,
    selectedFolderId, setSelectedFolderId, onPresetDropdownStateChange, promptPanelRef,
    thinkingLevel, onThinkingLevelChange,
    groundingTools, onGroundingToolToggle,
    gridLayout = null, onGridLayoutChange,
}) => {
    const settingsRef = useRef<HTMLDivElement>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);
    const [isGridOpen, setIsGridOpen] = useState(false);

    const modelResolutions = MODEL_RESOLUTIONS[modelName] ?? ['auto', '1k'];
    const showSettings =
        modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW ||
        modelName === MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE ||
        modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE ||
        modelName === MODEL_NAMES.FLUX_2_MAX ||
        modelName === MODEL_NAMES.OPENAI_GPT_IMAGE_2;
    const isSettingsActive = selectedResolution !== 'auto' || selectedAspectRatio !== 'auto';

    // Model-based chip visibility
    const supportsThinking =
        modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE ||
        modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW;
    const supportsImageSearch = modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE;

    // ThinkingLevel chip: cycles null → 'minimal' → 'high' → null
    const handleThinkingCycle = () => {
        if (!onThinkingLevelChange) return;
        if (!thinkingLevel) onThinkingLevelChange('minimal');
        else if (thinkingLevel === 'minimal') onThinkingLevelChange('high');
        else onThinkingLevelChange(null);
    };
    const thinkingLabel =
        !thinkingLevel ? t('toolbar.thinkingLabel.off', language) :
        thinkingLevel === 'minimal' ? t('toolbar.thinkingLabel.minimal', language) :
        t('toolbar.thinkingLabel.high', language);

    const isGoogleSearchEnabled = groundingTools?.has('googleSearch') ?? false;
    const isImageSearchEnabled = groundingTools?.has('imageSearch') ?? false;

    const googleSearchLabel = language === 'ko' ? 'G검색' : language === 'ja' ? 'G検索' : 'G·Search';
    const imageSearchLabel = language === 'ko' ? '이미지검색' : language === 'ja' ? '画像検索' : 'Img·Search';

    const chipBarScrollRef = useRef<HTMLDivElement>(null);

    return (
        <div className="relative min-w-0">
        <div ref={chipBarScrollRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide min-w-0">

            {/* ── Preset icon (original circle style) ── */}
            <div className="flex-shrink-0">
                <PromptPresets
                    folders={folders}
                    currentPrompt={currentPrompt}
                    onLoadPrompt={onLoadPrompt}
                    language={language}
                    onManageClick={onManagePreset}
                    onSaveClick={onSavePreset}
                    selectedFolderId={selectedFolderId}
                    setSelectedFolderId={setSelectedFolderId}
                    onDropdownStateChange={onPresetDropdownStateChange}
                    promptPanelRef={promptPanelRef}
                />
            </div>

            {/* ── Settings icon (resolution + ratio combined) ── */}
            {showSettings && (
                <div ref={settingsRef} className="flex-shrink-0">
                    <Tooltip tip={t('tooltip.settings' as TranslationKey, language)} position="top">
                        <button
                            onClick={() => setIsSettingsOpen(prev => !prev)}
                            className={`relative h-12 w-12 flex items-center justify-center rounded-full border transition-all duration-300 cursor-pointer ${
                                isSettingsOpen
                                    ? 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                        >
                            <SlidersIcon className={`w-5 h-5 ${isSettingsOpen ? 'text-yellow-400' : 'text-zinc-300'}`} />
                            {/* Active indicator dot */}
                            {isSettingsActive && !isSettingsOpen && (
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            )}
                        </button>
                    </Tooltip>
                    {isSettingsOpen && (
                        <SettingsPopover
                            language={language}
                            resolutions={modelResolutions}
                            selectedResolution={selectedResolution}
                            setSelectedResolution={setSelectedResolution}
                            selectedAspectRatio={selectedAspectRatio}
                            setSelectedAspectRatio={setSelectedAspectRatio}
                            triggerRef={settingsRef}
                            isOpen={isSettingsOpen}
                            setIsOpen={setIsSettingsOpen}
                            centered
                            modelName={modelName}
                        />
                    )}
                </div>
            )}

            {/* ── Grid Layout button ── */}
            {onGridLayoutChange && (
                <div ref={gridRef} className="flex-shrink-0">
                    <Tooltip
                        tip={language === 'ko' ? '다중 그리드 생성' : language === 'ja' ? 'グリッド生成' : 'Multi-grid output'}
                        position="top"
                    >
                        <button
                            onClick={() => setIsGridOpen(prev => !prev)}
                            className={`relative h-12 w-12 flex items-center justify-center rounded-full border transition-all duration-300 cursor-pointer ${
                                isGridOpen || gridLayout !== null
                                    ? 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                        >
                            {React.createElement(getGridIcon(gridLayout), {
                                className: `w-5 h-5 ${isGridOpen || gridLayout !== null ? 'text-yellow-400' : 'text-zinc-300'}`,
                            })}
                            {gridLayout !== null && !isGridOpen && (
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            )}
                        </button>
                    </Tooltip>
                    {isGridOpen && (
                        <GridLayoutPopover
                            gridLayout={gridLayout}
                            onGridLayoutChange={onGridLayoutChange}
                            triggerRef={gridRef}
                            isOpen={isGridOpen}
                            setIsOpen={setIsGridOpen}
                            language={language}
                        />
                    )}
                </div>
            )}

            {/* ── ThinkingLevel chip ── (3.1 Flash + Pro 3 only) */}
            {supportsThinking && onThinkingLevelChange && (
                <Chip
                    onClick={handleThinkingCycle}
                    isActive={!!thinkingLevel}
                    icon={<ThinkingIcon />}
                    label={thinkingLabel}
                    tooltip={t('toolbar.thinkingLevel', language)}
                />
            )}

            {/* ── Google Search chip + ? help ── */}
            {supportsThinking && onGroundingToolToggle && (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <Chip
                        onClick={() => onGroundingToolToggle('googleSearch')}
                        isActive={isGoogleSearchEnabled}
                        icon={<SearchIcon />}
                        label={googleSearchLabel}
                    />
                    <HelpButton tip={<GoogleSearchHelpTip language={language} />} />
                </div>
            )}

            {/* ── Image Search chip + ? help ── (3.1 Flash only) */}
            {supportsImageSearch && onGroundingToolToggle && (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <Chip
                        onClick={() => onGroundingToolToggle('imageSearch')}
                        isActive={isImageSearchEnabled}
                        icon={<ImageSearchIcon />}
                        label={imageSearchLabel}
                    />
                    <HelpButton tip={<ImageSearchHelpTip language={language} />} />
                </div>
            )}
        </div>
        <HoverEdgeAutoScroll targetRef={chipBarScrollRef} axis="horizontal" />
        </div>
    );
};
