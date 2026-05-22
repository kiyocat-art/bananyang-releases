import React, { useMemo, memo, useCallback, useState, useRef } from 'react';
import { Language, t, TranslationKey } from '../../../localization';
import { ModelName, GridLayout, GroundingTool } from '../../../types';
import { useGenerationStore } from '../../../store/generationStore';
import { useUIStore } from '../../../store/uiStore';
import { useToolbarStore } from '../../../features/toolbar/useToolbarStore';
import { useCanvasStore } from '../../../store/canvasStore';
import { Tooltip } from '../../../components/Tooltip';
import { MODEL_RESOLUTIONS, MODEL_NAMES } from '../../../constants';
import { SettingsPopover } from './prompt-panel/SettingsPopover';
import {
    HangerIcon, CameraIcon, BodyIcon, PaintBrushIcon, PaletteIcon, LightIcon, CloseIcon,
    FitToScreenIcon, ScissorsIcon, ObjectIcon,
} from '../../../components/icons';

// AI Tool Icons
import iconAutoColoring from '../../../assets/icons/ai-tools/icon_auto_coloring.png';
import iconVariation from '../../../assets/icons/ai-tools/icon_variation.png';
import iconPose from '../../../assets/icons/ai-tools/icon_pose.png';
import iconOutfit from '../../../assets/icons/ai-tools/icon_outfit.png';
import iconRemoveBg from '../../../assets/icons/ai-tools/icon_remove_bg.png';
import iconKeepBg from '../../../assets/icons/ai-tools/icon_keep_bg.png';

interface GenerationOptionsBarProps {
    language: Language;
    modelName?: ModelName;
}

interface OptionBadge {
    key: string;
    label?: string;
    icon?: React.ReactNode;
    type: 'icon' | 'image' | 'text' | 'badge' | 'separator';
    canDismiss: boolean;
    onDismiss?: () => void;
    onClick?: () => void;
}

// ─── Google official G logo (monochromatic pictogram) ─────────────────────────
const GoogleGIcon = ({ size = 32 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 11h6.5c.07.44.1.88.1 1.33C18.6 16.5 15.8 19 12 19a7 7 0 110-14c1.88 0 3.6.74 4.87 1.94l-1.98 1.98A4.25 4.25 0 0012 7.75 4.25 4.25 0 007.75 12 4.25 4.25 0 0012 16.25c2.1 0 3.6-1.07 4.08-2.75H12V11z" />
    </svg>
);

// Google Images style icon — image frame + magnifier (monochromatic pictogram)
const GoogleImagesIcon = ({ size = 32 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3.5" width="14" height="11" rx="1.5" />
        <path d="M2 11.5l3.5-3.5 3 3 2-2 3.5 3.5" />
        <circle cx="18.5" cy="18.5" r="3" strokeWidth={1.5} />
        <path d="M20.5 20.5L22.5 22.5" strokeWidth={1.5} />
    </svg>
);

const AI_ACTION_MAP: Record<string, { labelKo: string; labelEn: string; icon: string }> = {
    autoColoring: { labelKo: '자동채색', labelEn: 'Auto Color', icon: iconAutoColoring },
    variation: { labelKo: '베리에이션', labelEn: 'Variation', icon: iconVariation },
    extractPose: { labelKo: '포즈 추출', labelEn: 'Extract Pose', icon: iconPose },
    extractOutfit: { labelKo: '의상 추출', labelEn: 'Extract Outfit', icon: iconOutfit },
    removeBackground: { labelKo: '배경 제거', labelEn: 'Remove BG', icon: iconRemoveBg },
    keepBackgroundOnly: { labelKo: '배경만 남기기', labelEn: 'Keep BG', icon: iconKeepBg },
};

// Expand only — insertObject/relight/inpainting merged into toolbar slots 7/8/9
const AI_ACTION_EDITOR_ICONS: Partial<Record<string, { labelKo: string; labelEn: string; icon: React.ReactNode }>> = {
    expand: { labelKo: '이미지 확장', labelEn: 'Expand', icon: <FitToScreenIcon className="w-[38px] h-[38px]" /> },
};

/**
 * Inline generation options badges — rendered inside RoleThumbnails row.
 * Groups: (1) role images [handled by parent], (2) tool badges in toolbar order,
 * (3) resolution/ratio.
 */
export const GenerationOptionsBadges = memo<GenerationOptionsBarProps>(({ language, modelName }) => {
    const editorMode = useUIStore(s => s.editorMode);
    const originalImageWithMask = useCanvasStore(s =>
        s.boardImages.find(img => img.role === 'original' && img.maskFile != null)
    );

    const selectedClothingConcept = useGenerationStore(s => s.selectedClothingConcept);
    const bodyPartReferenceMap = useGenerationStore(s => s.bodyPartReferenceMap);
    const isApplyingFullOutfit = useGenerationStore(s => s.isApplyingFullOutfit);
    const isApplyingTop = useGenerationStore(s => s.isApplyingTop);
    const isApplyingBottom = useGenerationStore(s => s.isApplyingBottom);
    const isCameraViewActive = useGenerationStore(s => s.isCameraViewActive);
    const poseControlImage = useGenerationStore(s => s.poseControlImage);
    const selectedPalette = useGenerationStore(s => s.selectedPalette);
    const selectedAiEditAction = useGenerationStore(s => s.selectedAiEditAction);
    const isAutoColoringActive = useGenerationStore(s => s.isAutoColoringActive);
    const isVariationActive = useGenerationStore(s => s.isVariationActive);
    const selectedResolution = useGenerationStore(s => s.selectedResolution);
    const selectedAspectRatio = useGenerationStore(s => s.selectedAspectRatio);
    const gridLayout = useGenerationStore(s => s.gridLayout);
    const groundingTools = useGenerationStore(s => s.groundingTools);
    const toggleGroundingTool = useGenerationStore(s => s.toggleGroundingTool);
    const fluxOptions = useGenerationStore(s => s.fluxOptions);
    const isFluxModel = modelName === MODEL_NAMES.FLUX_2_MAX;

    const setSelectedResolution = useGenerationStore(s => s.setSelectedResolution);
    const setSelectedAspectRatio = useGenerationStore(s => s.setSelectedAspectRatio);
    const setGridLayout = useGenerationStore(s => s.setGridLayout);

    const [openBadge, setOpenBadge] = useState<'resolution' | 'ratio' | null>(null);
    const resolutionBadgeRef = useRef<HTMLButtonElement>(null);
    const ratioBadgeRef = useRef<HTMLButtonElement>(null);

    const modelResolutions = (modelName && MODEL_RESOLUTIONS[modelName]) ?? ['auto', '1k', '2k', '4k'];

    const setBodyPartReferenceMap = useGenerationStore(s => s.setBodyPartReferenceMap);
    const setSelectedClothingConcept = useGenerationStore(s => s.setSelectedClothingConcept);
    const setSelectedObjectItems = useGenerationStore(s => s.setSelectedObjectItems);
    const setIsCameraViewActive = useGenerationStore(s => s.setIsCameraViewActive);
    const setPoseControlImage = useGenerationStore(s => s.setPoseControlImage);
    const setSelectedActionPose = useGenerationStore(s => s.setSelectedActionPose);
    const setSelectedPalette = useGenerationStore(s => s.setSelectedPalette);
    const setSelectedAiEditAction = useGenerationStore(s => s.setSelectedAiEditAction);
    const setIsAutoColoringActive = useGenerationStore(s => s.setIsAutoColoringActive);
    const setIsVariationActive = useGenerationStore(s => s.setIsVariationActive);
    const setActiveRightPanelTab = useGenerationStore(s => s.setActiveRightPanelTab);

    const dismissConcept = useCallback(() => {
        setBodyPartReferenceMap({});
        setSelectedClothingConcept(null);
        setSelectedObjectItems([]);
    }, [setBodyPartReferenceMap, setSelectedClothingConcept, setSelectedObjectItems]);

    const dismissCamera = useCallback(() => {
        setIsCameraViewActive(false);
    }, [setIsCameraViewActive]);

    const dismissPose = useCallback(() => {
        setPoseControlImage(null);
        setSelectedActionPose(null);
    }, [setPoseControlImage, setSelectedActionPose]);

    const dismissPalette = useCallback(() => {
        setSelectedPalette(null);
    }, [setSelectedPalette]);

    const dismissAiAction = useCallback(() => {
        setSelectedAiEditAction(null);
    }, [setSelectedAiEditAction]);

    const dismissAutoColoring = useCallback(() => setIsAutoColoringActive(false), [setIsAutoColoringActive]);
    const dismissVariation = useCallback(() => setIsVariationActive(false), [setIsVariationActive]);
    const dismissGridLayout = useCallback(() => setGridLayout(null), [setGridLayout]);
    const dismissGoogleSearch = useCallback(() => toggleGroundingTool('googleSearch'), [toggleGroundingTool]);
    const dismissImageSearch = useCallback(() => toggleGroundingTool('imageSearch'), [toggleGroundingTool]);

    const navigateToConcept = useCallback(() => {
        setActiveRightPanelTab('concept');
    }, [setActiveRightPanelTab]);

    const navigateToCamera = useCallback(() => {
        setActiveRightPanelTab('camera');
    }, [setActiveRightPanelTab]);

    const navigateToPose = useCallback(() => {
        setActiveRightPanelTab('pose');
    }, [setActiveRightPanelTab]);

    const navigateToPainting = useCallback(() => {
        setActiveRightPanelTab('painting');
    }, [setActiveRightPanelTab]);

    const navigateToAiEdit = useCallback(() => {
        setActiveRightPanelTab('aiEdit');
    }, [setActiveRightPanelTab]);

    const badges = useMemo(() => {
        const items: OptionBadge[] = [];

        // ── 1. Concept (toolbar tool 1) ──────────────────────────────────────
        const bodyPartCount = Object.keys(bodyPartReferenceMap).length;
        const hasConceptSelection = bodyPartCount > 0 || selectedClothingConcept;

        if (hasConceptSelection) {
            let conceptLabel: string;
            if (isApplyingFullOutfit) {
                conceptLabel = t('genOptions.fullOutfit' as TranslationKey, language);
            } else if (isApplyingTop) {
                conceptLabel = t('genOptions.top' as TranslationKey, language);
            } else if (isApplyingBottom) {
                conceptLabel = t('genOptions.bottom' as TranslationKey, language);
            } else if (bodyPartCount > 0) {
                conceptLabel = t('genOptions.partsCount' as TranslationKey, language, { count: bodyPartCount });
            } else if (selectedClothingConcept) {
                conceptLabel = selectedClothingConcept;
            } else {
                conceptLabel = t('genOptions.concept' as TranslationKey, language);
            }

            items.push({
                key: 'concept',
                label: t('genOptions.conceptLabel' as TranslationKey, language, { label: conceptLabel }),
                icon: <HangerIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissConcept,
                onClick: navigateToConcept,
            });
        }

        // ── 2. AI Edit sub-actions (toolbar tool 2, non-overlapping with slots 7-9) ──
        if (selectedAiEditAction && AI_ACTION_MAP[selectedAiEditAction]
            && selectedAiEditAction !== 'autoColoring'
            && selectedAiEditAction !== 'variation') {
            const ai = AI_ACTION_MAP[selectedAiEditAction];
            items.push({
                key: `ai-${selectedAiEditAction}`,
                label: language === 'ko' ? ai.labelKo : ai.labelEn,
                icon: <img src={ai.icon} alt="" className="w-[38px] h-[38px] object-contain" />,
                type: 'image',
                canDismiss: true,
                onDismiss: dismissAiAction,
                onClick: navigateToAiEdit,
            });
        }

        // expand (no toolbar slot)
        if (selectedAiEditAction === 'expand') {
            items.push({
                key: 'ai-editor-action-expand',
                label: language === 'ko' ? '이미지 확장' : 'Expand',
                icon: AI_ACTION_EDITOR_ICONS.expand!.icon,
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissAiAction,
            });
        }

        if (isAutoColoringActive) {
            const ai = AI_ACTION_MAP.autoColoring;
            items.push({
                key: 'ai-autoColoring',
                label: language === 'ko' ? ai.labelKo : ai.labelEn,
                icon: <img src={ai.icon} alt="" className="w-[38px] h-[38px] object-contain" />,
                type: 'image',
                canDismiss: true,
                onDismiss: dismissAutoColoring,
                onClick: navigateToAiEdit,
            });
        }

        if (isVariationActive) {
            const ai = AI_ACTION_MAP.variation;
            items.push({
                key: 'ai-variation',
                label: language === 'ko' ? ai.labelKo : ai.labelEn,
                icon: <img src={ai.icon} alt="" className="w-[38px] h-[38px] object-contain" />,
                type: 'image',
                canDismiss: true,
                onDismiss: dismissVariation,
                onClick: navigateToAiEdit,
            });
        }

        // ── 3. Camera (toolbar tool 3) ────────────────────────────────────────
        if (isCameraViewActive) {
            items.push({
                key: 'camera',
                label: t('genOptions.camera' as TranslationKey, language),
                icon: <CameraIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissCamera,
                onClick: navigateToCamera,
            });
        }

        // ── 4. Pose (toolbar tool 4) ──────────────────────────────────────────
        if (poseControlImage) {
            items.push({
                key: 'pose',
                label: t('genOptions.pose' as TranslationKey, language),
                icon: <BodyIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissPose,
                onClick: navigateToPose,
            });
        }

        // ── 5. Palette (toolbar tool 5) ───────────────────────────────────────
        if (selectedPalette) {
            items.push({
                key: 'palette',
                label: t('genOptions.paletteLabel' as TranslationKey, language, { name: selectedPalette.name }),
                icon: <PaletteIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissPalette,
                onClick: navigateToPainting,
            });
        }

        // ── 6. Crop (toolbar tool 6) ──────────────────────────────────────────
        if (editorMode === 'crop') {
            items.push({
                key: 'editor-tool-crop',
                label: language === 'ko' ? '크롭' : 'Crop',
                icon: <ScissorsIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: () => useToolbarStore.getState().setActiveToolId(null),
            });
        }

        // ── 7. Object (toolbar tool 7) ────────────────────────────────────────
        if (editorMode === 'object' || selectedAiEditAction === 'insertObject') {
            items.push({
                key: 'editor-tool-object',
                label: language === 'ko' ? '객체삽입' : 'Object Insert',
                icon: <ObjectIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: () => {
                    useToolbarStore.getState().setActiveToolId(null);
                    setSelectedAiEditAction(null);
                },
            });
        }

        // ── 8. Inpaint (toolbar tool 8) ───────────────────────────────────────
        if (editorMode === 'inpaint' || selectedAiEditAction === 'inpainting' || originalImageWithMask) {
            items.push({
                key: 'editor-tool-inpaint',
                label: language === 'ko' ? '인페인팅' : 'Inpaint',
                icon: <PaintBrushIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: () => {
                    useToolbarStore.getState().setActiveToolId(null);
                    setSelectedAiEditAction(null);
                    if (originalImageWithMask) {
                        useCanvasStore.getState().updateImage(originalImageWithMask.id, {
                            maskFile: null,
                            maskSrc: null,
                        } as any);
                    }
                },
            });
        }

        // ── 9. Relight (toolbar tool 9) ───────────────────────────────────────
        if (editorMode === 'relight' || selectedAiEditAction === 'relight') {
            items.push({
                key: 'editor-tool-relight',
                label: language === 'ko' ? '리라이트' : 'Relight',
                icon: <LightIcon className="w-[38px] h-[38px]" />,
                type: 'icon',
                canDismiss: true,
                onDismiss: () => {
                    useToolbarStore.getState().setActiveToolId(null);
                    setSelectedAiEditAction(null);
                },
            });
        }

        // ── 10. Grid layout ───────────────────────────────────────────────────
        if (gridLayout) {
            const [rows, cols] = gridLayout.split('x').map(Number);
            const gridLabel = language === 'ko' ? `${cols}×${rows} 그리드` : language === 'ja' ? `${cols}×${rows} グリッド` : `${cols}×${rows} Grid`;
            items.push({
                key: 'grid',
                label: gridLabel,
                icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <rect x="2" y="2" width="20" height="20" rx="2" />
                        {cols >= 2 && <line x1={cols === 3 ? 9 : 12} y1="2" x2={cols === 3 ? 9 : 12} y2="22" />}
                        {cols === 3 && <line x1="16" y1="2" x2="16" y2="22" />}
                        {rows >= 2 && <line x1="2" y1={rows === 3 ? 9 : 12} x2="22" y2={rows === 3 ? 9 : 12} />}
                        {rows === 3 && <line x1="2" y1="16" x2="22" y2="16" />}
                    </svg>
                ),
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissGridLayout,
            });
        }

        // ── 11. G·Search ──────────────────────────────────────────────────────
        if (groundingTools.includes('googleSearch')) {
            const label = language === 'ko' ? 'G검색' : language === 'ja' ? 'G検索' : 'G·Search';
            items.push({
                key: 'grounding-googleSearch',
                label: language === 'ko' ? 'Google 검색 그라운딩' : language === 'ja' ? 'Google検索グラウンディング' : 'Google Search Grounding',
                icon: (
                    <div className="flex flex-col items-center gap-0.5">
                        <GoogleGIcon size={28} />
                        <span className="text-[9px] font-bold leading-none tracking-tight">{label}</span>
                    </div>
                ),
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissGoogleSearch,
            });
        }

        // ── 12. Image Search ──────────────────────────────────────────────────
        if (groundingTools.includes('imageSearch')) {
            const label = language === 'ko' ? '이미지검색' : language === 'ja' ? '画像検索' : 'Img·Search';
            items.push({
                key: 'grounding-imageSearch',
                label: language === 'ko' ? 'Google 이미지 검색 그라운딩' : language === 'ja' ? 'Google画像検索グラウンディング' : 'Google Image Search Grounding',
                icon: (
                    <div className="flex flex-col items-center gap-0.5">
                        <GoogleImagesIcon size={28} />
                        <span className="text-[9px] font-bold leading-none tracking-tight">{label}</span>
                    </div>
                ),
                type: 'icon',
                canDismiss: true,
                onDismiss: dismissImageSearch,
            });
        }

        // ── Separator before resolution/ratio ─────────────────────────────────
        items.push({ key: '__sep_res__', type: 'separator', canDismiss: false });

        // ── Resolution (always shown) ─────────────────────────────────────────
        const resolutionLabel = isFluxModel
            ? `${fluxOptions.resolutionMP} MP`
            : selectedResolution === 'auto' ? 'Auto' : selectedResolution.toUpperCase();
        items.push({
            key: 'resolution',
            label: t('genOptions.resolution' as TranslationKey, language, { value: resolutionLabel }),
            icon: <span className="text-sm font-bold leading-none">{resolutionLabel}</span>,
            type: 'badge',
            canDismiss: false,
        });

        // ── Ratio (always shown) ──────────────────────────────────────────────
        items.push({
            key: 'ratio',
            label: t('genOptions.ratio' as TranslationKey, language, { value: selectedAspectRatio === 'auto' ? 'Auto' : selectedAspectRatio }),
            icon: <span className="text-sm font-bold leading-none">{selectedAspectRatio === 'auto' ? 'Auto' : selectedAspectRatio}</span>,
            type: 'badge',
            canDismiss: false,
        });

        return items;
    }, [
        bodyPartReferenceMap, selectedClothingConcept, isApplyingFullOutfit, isApplyingTop, isApplyingBottom,
        isCameraViewActive, poseControlImage, selectedPalette, selectedAiEditAction,
        isAutoColoringActive, isVariationActive,
        originalImageWithMask,
        selectedResolution, selectedAspectRatio, gridLayout, groundingTools, language,
        fluxOptions, isFluxModel,
        dismissConcept, dismissCamera, dismissPose, dismissPalette, dismissAiAction,
        dismissAutoColoring, dismissVariation, dismissGridLayout,
        dismissGoogleSearch, dismissImageSearch,
        navigateToConcept, navigateToCamera, navigateToPose, navigateToPainting, navigateToAiEdit,
        editorMode, setSelectedAiEditAction,
    ]);

    return (
        <>
            {/* Separator between role thumbnails and tool badges */}
            <div className="w-px h-[52px] bg-white/20 mx-1 flex-shrink-0" />

            {badges.map((badge) => {
                if (badge.type === 'separator') {
                    return <div key={badge.key} className="w-px h-[52px] bg-white/20 mx-1 flex-shrink-0" />;
                }
                return (
                    <Tooltip key={badge.key} tip={badge.label ?? ''} position="top">
                        {badge.type === 'badge' ? (
                            <button
                                ref={badge.key === 'resolution' ? resolutionBadgeRef : ratioBadgeRef}
                                onClick={() => setOpenBadge(openBadge === badge.key as 'resolution' | 'ratio' ? null : badge.key as 'resolution' | 'ratio')}
                                className={`flex items-center justify-center w-[52px] h-[52px] rounded-lg border-2 text-yellow-400 flex-shrink-0 transition-all duration-200 ${
                                    openBadge === badge.key
                                        ? 'bg-yellow-500/30 border-yellow-500/60 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                                        : 'bg-yellow-500/15 border-yellow-500/30 hover:bg-yellow-500/25 hover:border-yellow-500/50'
                                }`}
                            >
                                {badge.icon}
                            </button>
                        ) : (
                            <button
                                onClick={badge.onClick}
                                className="group relative flex items-center justify-center w-[52px] h-[52px] rounded-lg bg-white/10 border-2 border-white/15 text-white flex-shrink-0 cursor-pointer hover:bg-white/20 transition-colors"
                            >
                                {badge.icon}
                                {badge.canDismiss && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            badge.onDismiss?.();
                                        }}
                                        className="absolute top-0 right-0 z-10 p-1 bg-black/50 rounded-bl-md text-white/70 hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <CloseIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </button>
                        )}
                    </Tooltip>
                );
            })}

            {/* Badge section popovers */}
            {openBadge === 'resolution' && (
                <SettingsPopover
                    section="resolution"
                    centered
                    language={language}
                    resolutions={modelResolutions}
                    selectedResolution={selectedResolution}
                    setSelectedResolution={setSelectedResolution}
                    selectedAspectRatio={selectedAspectRatio}
                    setSelectedAspectRatio={setSelectedAspectRatio}
                    triggerRef={resolutionBadgeRef as React.RefObject<Element>}
                    isOpen={true}
                    setIsOpen={(v) => { if (!v) setOpenBadge(null); }}
                    modelName={modelName}
                />
            )}
            {openBadge === 'ratio' && (
                <SettingsPopover
                    section="ratio"
                    centered
                    language={language}
                    resolutions={modelResolutions}
                    selectedResolution={selectedResolution}
                    setSelectedResolution={setSelectedResolution}
                    selectedAspectRatio={selectedAspectRatio}
                    setSelectedAspectRatio={setSelectedAspectRatio}
                    triggerRef={ratioBadgeRef as React.RefObject<Element>}
                    isOpen={true}
                    setIsOpen={(v) => { if (!v) setOpenBadge(null); }}
                    modelName={modelName}
                />
            )}
        </>
    );
});
