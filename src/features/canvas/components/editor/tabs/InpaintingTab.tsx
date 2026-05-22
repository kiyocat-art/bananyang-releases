import React, { useState, useCallback, useRef } from 'react';
import { t, Language } from '../../../../../localization';
import { useCanvasStore } from '../../../../../store/canvasStore';
import { useInpaintPresetStore } from '../../../../../store/inpaintPresetStore';
import { BUILT_IN_PRESETS, InpaintPreset } from './inpaintPresets';
import { ClothingIcon, CharacterEditIcon, BgFillIcon, RemoveIcon, FaceCloseUpIcon } from './inpaintWorkTypeIcons';
import { TrashIcon, ResetIcon, UndoIcon } from '../../../../../components/icons';
import { Tooltip } from '../../../../../components/Tooltip';
import { EditorImageViewer, ImageSizeType } from '../EditorImageViewer';
import { InpaintMaskOverlay } from '../overlays/InpaintMaskOverlay';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { useInpaintMaskInteraction } from '../hooks/useInpaintMaskInteraction';
import { HoverEdgeAutoScroll } from '../../../../../components/HoverEdgeAutoScroll';
import { ROLE_COLORS } from '../../../../../constants';
import {
    DEFAULT_INPAINT_BRUSH_SIZE,
    DEFAULT_MASK_FEATHER_RADIUS,
    DEFAULT_INPAINT_CONTEXT_PADDING,
    DEFAULT_INPAINT_TONE_MATCH,
    DEFAULT_INPAINT_VARIATION_STRENGTH,
} from '../../../../../constants/inpaint';
import { SafeImage } from '../../../../../components/SafeImage';
import { useRegisterPopoverImages } from '../../../../../hooks/usePopoverImageRegistry';
import { InpaintCard, MiniToggle, HelpIcon } from './InpaintCard';
import {
    BrainIcon, BodySilhouetteIcon, SunRayIcon, SparklesIcon,
    BrushTipIcon, FeatherTipIcon, ExpandIcon, DropletIcon,
    PlusCircleIcon, EraserPathIcon, LayersIcon,
    RunningPersonIcon, HangerIcon, ImageStackIcon, MessageDotsIcon, WandIcon,
    TargetIcon, Settings2Icon,
} from './InpaintIcons';

interface InpaintingTabProps {
    language: Language;
    onNotification: (message: string, type: 'success' | 'error') => void;
    localImageSrc?: string | null;
}

function getPresetIcon(preset: InpaintPreset, sizeClass = 'w-5 h-5'): React.ReactNode {
    if (preset.mode === 'remove') return <RemoveIcon className={sizeClass} />;
    if (preset.workType === 'clothing') return <ClothingIcon className={sizeClass} />;
    if (preset.id === 'face-edit') return <FaceCloseUpIcon className={sizeClass} />;
    if (preset.workType === 'characterEdit') return <CharacterEditIcon className={sizeClass} />;
    if (preset.workType === 'backgroundFill') return <BgFillIcon className={sizeClass} />;
    return <RemoveIcon className={sizeClass} />;
}

// Compact toolbar button (header)
const ToolButton: React.FC<{
    icon: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
    label: string;
    disabled?: boolean;
    variant?: 'default' | 'danger' | 'primary';
}> = ({ icon, active, onClick, label, disabled, variant = 'default' }) => (
    <Tooltip tip={label} position="bottom">
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            className={`p-1.5 rounded-md transition-all duration-150 cursor-pointer motion-reduce:transition-none
                ${active
                    ? (variant === 'primary'
                        ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40'
                        : 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40')
                    : variant === 'danger'
                        ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]'}
                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400
            `}
        >
            <span className="block w-4 h-4">{icon}</span>
        </button>
    </Tooltip>
);

// Scene Analyzer sub-toggle row
const SubToggleRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    help?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    accentClass?: string;
}> = ({ icon, label, help, checked, onChange, accentClass = 'text-emerald-400/70' }) => (
    <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-1.5 min-w-0">
            <span className={`flex-shrink-0 ${accentClass}`}>{icon}</span>
            <span className="text-[11px] text-zinc-300 truncate">{label}</span>
            {help && <HelpIcon help={help} />}
        </div>
        <MiniToggle checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
);

export const InpaintingTab: React.FC<InpaintingTabProps> = ({ language, onNotification, localImageSrc }) => {
    const {
        boardImages,
        inpaintMode, setInpaintMode,
        inpaintWorkType, setInpaintWorkType,
        maskFeatherRadius, setMaskFeatherRadius,
        inpaintContextPadding, setInpaintContextPadding,
        inpaintToneMatch, setInpaintToneMatch,
        inpaintBrushSize, setInpaintBrushSize,
        inpaintEraserMode, setInpaintEraserMode,
        inpaintSmartHint, setInpaintSmartHint,
        inpaintVariationStrength, setInpaintVariationStrength,
        inpaintSceneAnalyzerEnabled, setInpaintSceneAnalyzerEnabled,
        inpaintAnatomyConstraintsEnabled, setInpaintAnatomyConstraintsEnabled,
        inpaintSceneAwareEnabled, setInpaintSceneAwareEnabled,
        inpaintOverrides, markInpaintOverride, resetInpaintField,
        lastSceneContext,
    } = useCanvasStore();

    const { activePresetId, setActivePresetId, setPresetAugmentPrompt, addPreset, deletePreset, customPresets } = useInpaintPresetStore();

    const [showSavePreset, setShowSavePreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [imageSize, setImageSize] = useState<ImageSizeType>({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

    const zoomRef = useRef(1);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);
    const { sidebarWidth, handleResizeMouseDown } = useResizableSidebar();

    const originalImage = boardImages.find(img => img.role === 'original') ?? null;
    const targetImage = originalImage;
    const effectiveLocalImageSrc = localImageSrc;
    const hasMask = !!(targetImage?.maskSrc || targetImage?.maskFile);

    const {
        overlayRef, livePoints, cursorPos, isDrawingEraser,
        clearMask, undoLastStroke,
        handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave,
    } = useInpaintMaskInteraction({
        zoomRef,
        imageSize,
        brushSize: inpaintBrushSize,
        targetImageId: targetImage?.id ?? null,
        isEraserMode: inpaintEraserMode,
    });

    // Preset application — marks all related fields as overridden, since user chose a preset explicitly.
    const applyPreset = useCallback((preset: InpaintPreset) => {
        setInpaintMode(preset.mode);
        setInpaintWorkType(preset.workType);
        setMaskFeatherRadius(preset.maskFeatherRadius);
        setInpaintBrushSize(preset.brushSize);
        setActivePresetId(preset.id);
        markInpaintOverride('preset', true);
        const dp = language === 'ko' ? preset.defaultPromptKo : preset.defaultPromptEn;
        setPresetAugmentPrompt(dp ?? null);
    }, [setInpaintMode, setInpaintWorkType, setMaskFeatherRadius, setInpaintBrushSize, setActivePresetId, setPresetAugmentPrompt, language, markInpaintOverride]);

    const clearActivePreset = useCallback(() => {
        setActivePresetId(null);
        markInpaintOverride('preset', false);
    }, [setActivePresetId, markInpaintOverride]);

    const handleSavePreset = useCallback(() => {
        const name = newPresetName.trim();
        if (!name) return;
        addPreset({
            labelKo: name,
            labelEn: name,
            mode: inpaintMode,
            workType: inpaintWorkType,
            maskFeatherRadius,
            brushSize: inpaintBrushSize,
        });
        setNewPresetName('');
        setShowSavePreset(false);
        onNotification(t('editor.inpaint.preset.save' as any, language), 'success');
    }, [newPresetName, inpaintMode, inpaintWorkType, maskFeatherRadius, inpaintBrushSize, addPreset, onNotification, language]);

    const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
    const visiblePresets = allPresets.filter(p => p.mode === inpaintMode);

    // Canvas role-tagged reference images
    const refsByRole = {
        poseRef:    boardImages.filter(img => img.role === 'poseRef'),
        costumeRef: boardImages.filter(img => img.role === 'costumeRef'),
        generalRef: boardImages.filter(img => img.role === 'generalRef'),
    };
    const hasAnyRefs = Object.values(refsByRole).some(arr => arr.length > 0);
    const refImageIds = Object.values(refsByRole).flat().map(img => img.id);
    useRegisterPopoverImages(refImageIds);

    const ROLE_META: Record<string, { ko: string; en: string; color: string; icon: React.ReactNode }> = {
        poseRef:    { ko: '포즈/해부학', en: 'Pose/Anatomy',   color: ROLE_COLORS.poseRef,    icon: <RunningPersonIcon className="w-3 h-3" /> },
        costumeRef: { ko: '의상/재질',   en: 'Costume/Mat.',   color: ROLE_COLORS.costumeRef, icon: <HangerIcon className="w-3 h-3" /> },
        generalRef: { ko: '외형 참조',   en: 'Appearance',     color: ROLE_COLORS.generalRef, icon: <ImageStackIcon className="w-3 h-3" /> },
    };

    // AI suggestion bar — shown when Scene Analyzer has produced a result for this session
    const aiHasResult = !!lastSceneContext;
    const aiIntentLabel = (() => {
        if (!lastSceneContext) return null;
        const ko = { remove: '제거', replace: '교체', touchup: '보정', extend: '확장' };
        const en = { remove: 'Remove', replace: 'Replace', touchup: 'Touch-up', extend: 'Extend' };
        return language === 'ko' ? ko[lastSceneContext.intent] : en[lastSceneContext.intent];
    })();
    const aiBodyPart = lastSceneContext?.anatomy.bodyParts[0]?.part ?? null;

    return (
        <div className="absolute inset-0 flex overflow-hidden bg-[#0e0e0e]">
            {/* Infinite canvas viewer */}
            <EditorImageViewer
                className="flex-1 min-w-0 h-full"
                localImageSrc={effectiveLocalImageSrc}
                onZoomChange={z => { zoomRef.current = z; }}
                onImageLoad={size => setImageSize(size)}
                renderInsideTransform={({ imageSize: iSize, zoom, isNavigateMode, isZKeyDown }) =>
                    targetImage ? (
                        <InpaintMaskOverlay
                            imageSize={iSize}
                            zoom={zoom}
                            isNavigateMode={isNavigateMode}
                            isZKeyDown={isZKeyDown}
                            maskSrc={targetImage.maskSrc}
                            livePoints={livePoints}
                            cursorPos={cursorPos}
                            brushSize={inpaintBrushSize}
                            overlayRef={overlayRef}
                            isEraserMode={inpaintEraserMode}
                            isDrawingEraser={isDrawingEraser}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerLeave}
                        />
                    ) : null
                }
            />

            {/* Right resizable sidebar */}
            <div
                className="relative flex-shrink-0 h-full bg-zinc-900/85 backdrop-blur-sm border-l border-white/10"
                style={{ width: sidebarWidth }}
            >
                {/* Resize handle */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group/rh"
                    onMouseDown={handleResizeMouseDown}
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-px rounded-full bg-white/0 group-hover/rh:bg-white/30 transition-colors duration-150" />
                </div>
                <div ref={sidebarScrollRef} className="h-full overflow-y-auto px-3 py-3">

                    {/* ── Header ──────────────────────────────────────────── */}
                    <header className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <BrushTipIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                            <h3 className="text-xs font-bold text-zinc-100 tracking-wide truncate">
                                {language === 'ko' ? '인페인팅' : 'Inpaint'}
                            </h3>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <ToolButton
                                icon={<BrushTipIcon />}
                                active={!inpaintEraserMode}
                                onClick={() => setInpaintEraserMode(false)}
                                label={language === 'ko' ? '브러시 (E)' : 'Brush (E)'}
                            />
                            <ToolButton
                                icon={<EraserPathIcon />}
                                active={inpaintEraserMode}
                                onClick={() => setInpaintEraserMode(true)}
                                label={language === 'ko' ? '지우개 (E)' : 'Eraser (E)'}
                                variant="primary"
                            />
                            <div className="w-px h-4 bg-white/10 mx-0.5" />
                            <ToolButton
                                icon={<UndoIcon />}
                                onClick={undoLastStroke}
                                disabled={!hasMask}
                                label={language === 'ko' ? '실행취소' : 'Undo'}
                            />
                            <ToolButton
                                icon={<TrashIcon />}
                                onClick={clearMask}
                                disabled={!hasMask}
                                label={t('editor.inpaint.clearMask' as any, language)}
                                variant="danger"
                            />
                        </div>
                    </header>

                    {/* ── User Hint (always visible) ──────────────────────── */}
                    <InpaintCard
                        icon={<MessageDotsIcon className="w-3.5 h-3.5" />}
                        title={t('editor.inpaint.userHint' as any, language)}
                        help={t('editor.inpaint.userHint.help' as any, language)}
                        accent="text-zinc-300"
                        language={language}
                    >
                        <input
                            type="text"
                            value={inpaintSmartHint}
                            onChange={e => setInpaintSmartHint(e.target.value)}
                            placeholder={t('editor.inpaint.userHint.placeholder' as any, language)}
                            className="w-full bg-zinc-900/60 text-zinc-200 text-xs rounded-lg px-2 py-1.5 outline-none border border-zinc-700/60 focus:border-emerald-500/60 transition-colors motion-reduce:transition-none"
                        />
                    </InpaintCard>

                    {/* ── Variation Strength ──────────────────────────────── */}
                    <InpaintCard
                        icon={<SparklesIcon className="w-3.5 h-3.5" />}
                        title={t('editor.inpaint.variationStrength' as any, language)}
                        chip={inpaintOverrides.variationStrength ? 'custom' : 'ai'}
                        onResetToAI={() => resetInpaintField('variationStrength')}
                        aiSuggestion={`${DEFAULT_INPAINT_VARIATION_STRENGTH.toFixed(2)}`}
                        help={t('editor.inpaint.variationStrength.help' as any, language)}
                        accent="text-amber-300"
                        language={language}
                    >
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={0} max={100} step={5}
                                value={Math.round(inpaintVariationStrength * 100)}
                                onChange={e => setInpaintVariationStrength(Number(e.target.value) / 100)}
                                className="flex-1 accent-amber-400 h-1 cursor-pointer"
                                aria-label={t('editor.inpaint.variationStrength' as any, language)}
                            />
                            <span className="text-[10px] text-zinc-300 w-9 text-right tabular-nums">
                                {inpaintVariationStrength.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-[9px] text-zinc-500 px-0.5 mt-0.5">
                            <span>{language === 'ko' ? '충실' : 'Faithful'}</span>
                            <span>{language === 'ko' ? '자유' : 'Creative'}</span>
                        </div>
                    </InpaintCard>

                    {/* ── Scene Analyzer ──────────────────────────────────── */}
                    <InpaintCard
                        icon={<BrainIcon className="w-4 h-4" />}
                        title={t('editor.inpaint.sceneAnalyzer' as any, language)}
                        help={t('editor.inpaint.sceneAnalyzer.help' as any, language)}
                        collapsible
                        defaultExpanded
                        accent="text-emerald-300"
                        language={language}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-zinc-500 leading-tight">
                                {language === 'ko' ? 'AI 의도·해부학·씬 자동 분석' : 'AI auto intent + anatomy + scene'}
                            </span>
                            <MiniToggle
                                checked={inpaintSceneAnalyzerEnabled}
                                onChange={setInpaintSceneAnalyzerEnabled}
                                ariaLabel={t('editor.inpaint.sceneAnalyzer' as any, language)}
                            />
                        </div>

                        {inpaintSceneAnalyzerEnabled && (
                            <div className="space-y-0.5 mt-2 pt-2 border-t border-white/5">
                                <SubToggleRow
                                    icon={<BodySilhouetteIcon className="w-3.5 h-3.5" />}
                                    label={t('editor.inpaint.anatomyConstraints' as any, language)}
                                    help={t('editor.inpaint.anatomyConstraints.help' as any, language)}
                                    checked={inpaintAnatomyConstraintsEnabled}
                                    onChange={setInpaintAnatomyConstraintsEnabled}
                                />
                                <SubToggleRow
                                    icon={<SunRayIcon className="w-3.5 h-3.5" />}
                                    label={t('editor.inpaint.sceneAware' as any, language)}
                                    help={t('editor.inpaint.sceneAware.help' as any, language)}
                                    checked={inpaintSceneAwareEnabled}
                                    onChange={setInpaintSceneAwareEnabled}
                                />
                            </div>
                        )}

                        {aiHasResult && (
                            <div className="mt-2 px-2 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                                <div className="text-[9px] text-emerald-300/70 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    <WandIcon className="w-2.5 h-2.5" />
                                    {language === 'ko' ? 'AI 분석 결과' : 'AI Analysis'}
                                </div>
                                <div className="text-[10px] text-zinc-300 leading-snug">
                                    {language === 'ko' ? '의도' : 'Intent'}: <span className="text-emerald-300">{aiIntentLabel}</span>
                                    {aiBodyPart && (
                                        <> · {language === 'ko' ? '위치' : 'Part'}: <span className="text-emerald-300">{aiBodyPart}</span></>
                                    )}
                                </div>
                                {lastSceneContext?.lightingHint && (
                                    <div className="text-[9px] text-zinc-500 mt-0.5 truncate" title={lastSceneContext.lightingHint}>
                                        ☀ {lastSceneContext.lightingHint}
                                    </div>
                                )}
                            </div>
                        )}
                    </InpaintCard>

                    {/* ── Mask Status ─────────────────────────────────────── */}
                    <InpaintCard
                        icon={<TargetIcon className="w-3.5 h-3.5" />}
                        title={t('editor.inpaint.maskApplied' as any, language)}
                        accent="text-yellow-400"
                        language={language}
                    >
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/50 text-[10px]">
                            {hasMask ? (
                                <>
                                    {targetImage?.maskSrc && (
                                        <div className="relative w-7 h-7 rounded border border-yellow-400/40 overflow-hidden flex-shrink-0 bg-black">
                                            <SafeImage
                                                srcChain={[targetImage.thumbnailSrc, targetImage.tinySrc, targetImage.previewSrc, targetImage.src]}
                                                alt="target"
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                            <div
                                                className="absolute inset-0 pointer-events-none"
                                                style={{
                                                    backgroundColor: 'rgba(255, 50, 50, 0.55)',
                                                    WebkitMaskImage: `url(${targetImage.maskSrc})`,
                                                    maskImage: `url(${targetImage.maskSrc})`,
                                                    WebkitMaskMode: 'luminance',
                                                    maskMode: 'luminance',
                                                    WebkitMaskSize: '100% 100%',
                                                    maskSize: '100% 100%',
                                                    WebkitMaskRepeat: 'no-repeat',
                                                    maskRepeat: 'no-repeat',
                                                } as React.CSSProperties}
                                            />
                                        </div>
                                    )}
                                    <span className="text-yellow-400 flex-1 truncate">{t('editor.inpaint.maskApplied' as any, language)}</span>
                                    <button
                                        onClick={clearMask}
                                        className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors motion-reduce:transition-none cursor-pointer"
                                        title={t('editor.inpaint.clearMask' as any, language)}
                                        aria-label={t('editor.inpaint.clearMask' as any, language)}
                                    >
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </>
                            ) : (
                                <span className="text-zinc-500">{t('editor.inpaint.noMask' as any, language)}</span>
                            )}
                        </div>
                        {!targetImage && (
                            <p className="text-[10px] text-zinc-500 mt-1.5 text-center">{t('editor.inpaint.selectImageHint' as any, language)}</p>
                        )}
                    </InpaintCard>

                    {/* ── Mode tabs ───────────────────────────────────────── */}
                        <InpaintCard
                            icon={<Settings2Icon className="w-3.5 h-3.5" />}
                            title={language === 'ko' ? '모드' : 'Mode'}
                            chip={inpaintOverrides.mode ? 'custom' : 'ai'}
                            onResetToAI={() => resetInpaintField('mode')}
                            aiSuggestion={lastSceneContext?.intent ?? undefined}
                            accent="text-zinc-300"
                            language={language}
                        >
                            <div className="grid grid-cols-2 gap-1.5">
                                {(['insert', 'remove'] as const).map(mode => {
                                    const active = inpaintMode === mode;
                                    const aiSuggests = lastSceneContext
                                        ? ((lastSceneContext.intent === 'remove' ? 'remove' : 'insert') === mode)
                                        : false;
                                    return (
                                        <button
                                            key={mode}
                                            onClick={() => { setInpaintMode(mode); clearActivePreset(); }}
                                            className={`relative flex flex-col items-center gap-1 py-2 rounded-lg border transition-all duration-200 motion-reduce:transition-none cursor-pointer
                                                ${active
                                                    ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-300 ring-1 ring-yellow-500/30'
                                                    : 'bg-zinc-900/40 border-white/[0.06] text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'}`}
                                            aria-pressed={active}
                                        >
                                            {aiSuggests && !active && (
                                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none"
                                                    title={language === 'ko' ? 'AI 추천' : 'AI suggestion'} />
                                            )}
                                            {mode === 'insert' ? <PlusCircleIcon className="w-4 h-4" /> : <EraserPathIcon className="w-4 h-4" />}
                                            <span className="text-[10px] font-semibold">{t(`editor.inpaint.mode.${mode}` as any, language)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </InpaintCard>

                    {/* ── Presets ─────────────────────────────────────────── */}
                        <InpaintCard
                            icon={<LayersIcon className="w-3.5 h-3.5" />}
                            title={t('editor.inpaint.presets' as any, language)}
                            chip={inpaintOverrides.preset ? 'custom' : 'ai'}
                            onResetToAI={clearActivePreset}
                            accent="text-zinc-300"
                            language={language}
                        >
                            <div className="grid grid-cols-2 gap-1.5">
                                {visiblePresets.map(preset => {
                                    const active = activePresetId === preset.id;
                                    const aiSuggests = !active && lastSceneContext?.recommendedPresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => applyPreset(preset)}
                                            className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border transition-all duration-200 motion-reduce:transition-none cursor-pointer
                                                ${active
                                                    ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-300 ring-1 ring-yellow-500/30'
                                                    : 'bg-zinc-900/40 border-white/[0.06] text-zinc-300 hover:bg-zinc-800/60'}`}
                                            aria-pressed={active}
                                        >
                                            {aiSuggests && (
                                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none"
                                                    title={language === 'ko' ? 'AI 추천' : 'AI suggestion'} />
                                            )}
                                            {getPresetIcon(preset, 'w-4 h-4')}
                                            <span className="text-[10px] leading-tight text-center px-0.5 line-clamp-2">
                                                {language === 'ko' ? preset.labelKo : preset.labelEn}
                                            </span>
                                            {!preset.isBuiltIn && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); deletePreset(preset.id); }}
                                                    className="absolute top-0.5 left-0.5 p-0.5 text-zinc-500 hover:text-red-400 transition-colors motion-reduce:transition-none cursor-pointer"
                                                    title={t('editor.inpaint.preset.delete' as any, language)}
                                                    aria-label={t('editor.inpaint.preset.delete' as any, language)}
                                                >
                                                    <TrashIcon className="w-2.5 h-2.5" />
                                                </button>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom preset save */}
                            {showSavePreset ? (
                                <div className="mt-2 flex gap-1">
                                    <input
                                        type="text"
                                        value={newPresetName}
                                        onChange={e => setNewPresetName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleSavePreset();
                                            if (e.key === 'Escape') setShowSavePreset(false);
                                        }}
                                        placeholder={t('editor.inpaint.preset.custom' as any, language)}
                                        className="flex-1 bg-zinc-900/60 text-zinc-200 text-xs rounded-lg px-2 py-1.5 outline-none border border-zinc-700/60 focus:border-yellow-500/60 transition-colors motion-reduce:transition-none"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSavePreset}
                                        disabled={!newPresetName.trim()}
                                        className="px-2 py-1.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-zinc-900 text-[10px] font-semibold rounded-lg transition-colors motion-reduce:transition-none cursor-pointer"
                                    >
                                        OK
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSavePreset(true)}
                                    className="mt-2 w-full py-1.5 rounded-lg text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors motion-reduce:transition-none cursor-pointer border border-white/[0.04]"
                                >
                                    + {t('editor.inpaint.preset.save' as any, language)}
                                </button>
                            )}
                        </InpaintCard>

                    {/* ── Brush size ──────────────────────────────────────── */}
                    <InpaintCard
                        icon={<BrushTipIcon className="w-3.5 h-3.5" />}
                        title={`${t('editor.inpaint.brushSize' as any, language)} · ${inpaintBrushSize}`}
                        chip={inpaintOverrides.brushSize ? 'custom' : 'ai'}
                        onResetToAI={() => resetInpaintField('brushSize')}
                        aiSuggestion={`${DEFAULT_INPAINT_BRUSH_SIZE}px`}
                        accent="text-red-400"
                        language={language}
                    >
                        <input
                            type="range"
                            min={3} max={100} step={1}
                            value={inpaintBrushSize}
                            onChange={e => { setInpaintBrushSize(Number(e.target.value)); clearActivePreset(); }}
                            className="w-full accent-red-400 h-1 cursor-pointer"
                            aria-label={t('editor.inpaint.brushSize' as any, language)}
                        />
                    </InpaintCard>

                    {/* ── Feathering ──────────────────────────────────────── */}
                    <InpaintCard
                        icon={<FeatherTipIcon className="w-3.5 h-3.5" />}
                        title={`${t('editor.inpaint.feathering' as any, language)} · ${maskFeatherRadius}`}
                        chip={inpaintOverrides.maskFeatherRadius ? 'custom' : 'ai'}
                        onResetToAI={() => resetInpaintField('maskFeatherRadius')}
                        aiSuggestion={`${DEFAULT_MASK_FEATHER_RADIUS}px`}
                        help={t('editor.inpaint.feathering.help' as any, language)}
                        accent="text-cyan-400"
                        language={language}
                    >
                        <input
                            type="range"
                            min={0} max={20} step={1}
                            value={maskFeatherRadius}
                            onChange={e => { setMaskFeatherRadius(Number(e.target.value)); clearActivePreset(); }}
                            className="w-full accent-cyan-400 h-1 cursor-pointer"
                            aria-label={t('editor.inpaint.feathering' as any, language)}
                        />
                    </InpaintCard>

                    {/* ── Context Padding & Tone Match ─────────────────────── */}
                    <>
                            <InpaintCard
                                icon={<ExpandIcon className="w-3.5 h-3.5" />}
                                title={`${t('editor.inpaint.contextPadding' as any, language)} · ${Math.round(inpaintContextPadding * 100)}%`}
                                chip={inpaintOverrides.contextPadding ? 'custom' : 'ai'}
                                onResetToAI={() => resetInpaintField('contextPadding')}
                                aiSuggestion={`${Math.round(DEFAULT_INPAINT_CONTEXT_PADDING * 100)}%`}
                                help={t('editor.inpaint.contextPadding.help' as any, language)}
                                accent="text-purple-400"
                                language={language}
                            >
                                <input
                                    type="range"
                                    min={0} max={100} step={5}
                                    value={Math.round(inpaintContextPadding * 100)}
                                    onChange={e => { setInpaintContextPadding(Number(e.target.value) / 100); clearActivePreset(); }}
                                    className="w-full accent-purple-400 h-1 cursor-pointer"
                                    aria-label={t('editor.inpaint.contextPadding' as any, language)}
                                />
                            </InpaintCard>

                            <InpaintCard
                                icon={<DropletIcon className="w-3.5 h-3.5" />}
                                title={t('editor.inpaint.toneMatch' as any, language)}
                                chip={inpaintOverrides.toneMatch ? 'custom' : 'ai'}
                                onResetToAI={() => resetInpaintField('toneMatch')}
                                aiSuggestion={DEFAULT_INPAINT_TONE_MATCH ? (language === 'ko' ? '켜짐' : 'On') : (language === 'ko' ? '꺼짐' : 'Off')}
                                help={t('editor.inpaint.toneMatch.help' as any, language)}
                                accent="text-blue-400"
                                language={language}
                            >
                                <label className="flex items-center justify-between cursor-pointer py-0.5">
                                    <span className="text-[10px] text-zinc-300">
                                        {language === 'ko' ? '주변 색조 자동 매칭' : 'Auto match surrounding tone'}
                                    </span>
                                    <MiniToggle
                                        checked={inpaintToneMatch}
                                        onChange={enabled => { setInpaintToneMatch(enabled); clearActivePreset(); }}
                                        ariaLabel={t('editor.inpaint.toneMatch' as any, language)}
                                    />
                                </label>
                            </InpaintCard>
                    </>

                    {/* ── Reference Images ────────────────────────────────── */}
                    <InpaintCard
                            icon={<ImageStackIcon className="w-3.5 h-3.5" />}
                            title={t('editor.inpaint.referenceImages' as any, language)}
                            accent="text-zinc-300"
                            language={language}
                        >
                            {hasAnyRefs ? (
                                <div className="flex flex-col gap-1.5">
                                    {(Object.entries(refsByRole) as [keyof typeof refsByRole, typeof boardImages[0][]][]).map(([role, images]) => {
                                        if (images.length === 0) return null;
                                        const meta = ROLE_META[role];
                                        const aiHighlights = lastSceneContext?.recommendedRefRole === role;
                                        return (
                                            <div key={role}>
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-white"
                                                        style={{ backgroundColor: meta.color }}
                                                    >
                                                        {meta.icon}
                                                        {language === 'ko' ? meta.ko : meta.en}
                                                    </span>
                                                    {aiHighlights && (
                                                        <Tooltip tip={language === 'ko' ? 'AI가 이 역할 강조' : 'AI emphasizes this role'}>
                                                            <WandIcon className="w-2.5 h-2.5 text-emerald-400" />
                                                        </Tooltip>
                                                    )}
                                                </div>
                                                <div
                                                    className={`flex flex-wrap gap-1 ${aiHighlights ? 'p-1 rounded-md bg-emerald-500/5 ring-1 ring-emerald-500/20' : ''}`}
                                                >
                                                    {images.map(img => (
                                                        <div
                                                            key={img.id}
                                                            className="w-7 h-7 rounded-md overflow-hidden bg-zinc-700 flex-shrink-0 hover:ring-2 hover:ring-white/30 transition-all duration-150 motion-reduce:transition-none cursor-pointer"
                                                            title={`${language === 'ko' ? meta.ko : meta.en}`}
                                                        >
                                                            <SafeImage
                                                                srcChain={[img.tinySrc, img.previewSrc, img.src]}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-[10px] text-zinc-500 text-center py-2 leading-relaxed">
                                    {language === 'ko'
                                        ? '캔버스 이미지에 역할을 지정하면 여기에 표시됩니다'
                                        : 'Tag canvas images with a role to use them here'}
                                </p>
                            )}
                    </InpaintCard>

                    {/* ── Prompt guide footer ─────────────────────────────── */}
                    <div className="mt-3 pt-2 border-t border-white/5">
                        <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                            {inpaintMode === 'remove'
                                ? (language === 'ko'
                                    ? '마스크를 그리고 아래 버튼을 누르면 AI가 자동으로 제거합니다'
                                    : 'Draw a mask and press the button below — AI will auto-remove')
                                : t('editor.inpaint.promptGuide' as any, language)}
                        </p>
                    </div>
                </div>
                <HoverEdgeAutoScroll targetRef={sidebarScrollRef} />
            </div>
        </div>
    );
};

