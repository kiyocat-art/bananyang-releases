import { useState, useRef, useEffect, useMemo } from 'react';
import { BoardImage, GenerationTask, ModelName, PromptFolder, AiAction, ThinkingLevel, GroundingTool } from '../../../../types';
import { t, Language, TranslationKey } from '../../../../localization';
import { hasValidAuth, getAllAvailableModels, translateToEnglish } from '../../../../services/geminiService';
import { isExternalModel, hasExternalAuth, supportsInpaint } from '../../../../services/providers/registry';
import { useGenerationStore } from '../../../../store/generationStore';
import { useCanvasStore } from '../../../../store/canvasStore';
import { useToolbarStore } from '../../../../features/toolbar/useToolbarStore';
import { useInpaintPresetStore } from '../../../../store/inpaintPresetStore';
import { analyzeSceneContext, SceneContext } from '../../../../services/sceneContextService';
import {
    DEFAULT_MASK_FEATHER_RADIUS,
    DEFAULT_INPAINT_CONTEXT_PADDING,
    DEFAULT_INPAINT_TONE_MATCH,
    DEFAULT_INPAINT_VARIATION_STRENGTH,
} from '../../../../constants/inpaint';
import { ensureBoardImageFile } from '../../../../utils/imageUtils';
import { isShortcut } from '../../../../hooks/useShortcuts';

interface UsePromptPanelProps {
    customPrompt: string;
    onCustomPromptChange: (prompt: string) => void;
    onQueueGeneration: (task: GenerationTask) => void;
    isProcessing: boolean;
    generationQueue: GenerationTask[];
    originalImage: BoardImage | undefined;
    modelName: ModelName;
    language: Language;
    onNotification: (message: string, type: 'success' | 'error') => void;
    folders: PromptFolder[];
    onPresetDropdownStateChange?: (isOpen: boolean) => void;
}

export const usePromptPanel = ({
    customPrompt, onCustomPromptChange, onQueueGeneration, isProcessing, generationQueue,
    originalImage, modelName, language, onNotification,
    folders, onPresetDropdownStateChange,
}: UsePromptPanelProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
    const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
    const [isResolutionOpen, setIsResolutionOpen] = useState(false);
    const [isAspectRatioOpen, setIsAspectRatioOpen] = useState(false);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    // Phase 3: Thinking & Grounding state
    const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel | null>(null);
    // groundingTools is global state (also shown in GenerationOptionsBar thumbnail)
    const groundingToolsArr = useGenerationStore(s => s.groundingTools);
    const groundingTools = useMemo(() => new Set(groundingToolsArr), [groundingToolsArr]);
    const toggleGroundingTool = useGenerationStore(s => s.toggleGroundingTool);

    const resolutionRef = useRef<HTMLDivElement>(null);
    const aspectRatioRef = useRef<HTMLDivElement>(null);
    const modelSelectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        onPresetDropdownStateChange?.(isPresetDropdownOpen);
    }, [isPresetDropdownOpen, onPresetDropdownStateChange]);

    // Note: Click-outside handling for model selector and resolution popover
    // is now done within their respective components using Portal refs

    useEffect(() => {
        if (folders.length > 0 && !folders.some(f => f.id === selectedFolderId)) {
            setSelectedFolderId(folders[0].id);
        } else if (folders.length === 0) {
            setSelectedFolderId(null);
        }
    }, [folders, selectedFolderId]);

    // Auto-switch model if current model is not available (external models are exempt)
    useEffect(() => {
        if (isExternalModel(modelName)) return;
        const availableModels = getAllAvailableModels();
        if (!availableModels.includes(modelName) && availableModels.length > 0) {
            window.dispatchEvent(new CustomEvent('model-change', { detail: availableModels[0] }));
        }
    }, [modelName]);

    const {
        cameraView, isCameraViewActive, lightDirection, lightIntensity, isLightDirectionActive,
        useAposeForViews, bodyPartReferenceMap, selectedClothingConcept, selectedObjectItems,
        poseControlImage, selectedActionPose, isApplyingFullOutfit, isApplyingTop, isApplyingBottom,
        selectedPalette, numPaletteColors, isAutoColorizeSketch,
        selectedAiEditAction, isAutoColoringActive, isVariationActive,
        variationCreativity, autoColoringIntensity,
        selectedResolution, selectedAspectRatio, setSelectedResolution, setSelectedAspectRatio,
        gridLayout, setGridLayout,
        editGuideImage, setSelectedAiEditAction, setEditGuideImage,
        // 5단계 의상참조 합성
        costumeCreativityLevel, costumeBodyType, costumeGender,
        synthesisControlMode, originalPreservationLevel,
        isCostumeDesignEnabled,
        fluxOptions,
        openAIOptions,
    } = useGenerationStore();
    const {
        boardImages, inpaintWorkType, maskFeatherRadius, inpaintMode,
        inpaintContextPadding, inpaintToneMatch,
        inpaintSmartHint,
        inpaintOverrides, inpaintSceneAnalyzerEnabled,
        inpaintAnatomyConstraintsEnabled, inpaintSceneAwareEnabled,
        inpaintVariationStrength,
        setLastSceneContext,
    } = useCanvasStore();
    const toolbarActiveToolId = useToolbarStore(s => s.activeToolId);

    const isFluxModel = modelName === 'flux/flux-2-max';
    const isOpenAIModel = modelName === 'openai/gpt-image-2';

    const canGenerate = useMemo(() => {
        const externalModelHasKey = isExternalModel(modelName) && hasExternalAuth(modelName);
        if (!hasValidAuth() && !externalModelHasKey) return false;
        if (!modelName.trim()) return false;
        if (toolbarActiveToolId === 'inpaint') {
            if (!supportsInpaint(modelName)) return false;
            if (!originalImage?.maskFile) return false;
            const presetAugmentPrompt = useInpaintPresetStore.getState().presetAugmentPrompt;
            if (inpaintMode === 'insert' && !customPrompt.trim() && !presetAugmentPrompt) return false;
            return true;
        }
        if (selectedAiEditAction || isAutoColoringActive || isVariationActive) {
            if (selectedAiEditAction === 'insertObject') return !!editGuideImage && !!customPrompt.trim();
            return !!originalImage;
        }
        if (customPrompt.trim().length > 0) return true;

        const hasActiveOptions = isCameraViewActive || isLightDirectionActive ||
            Object.keys(bodyPartReferenceMap).length > 0 ||
            !!selectedClothingConcept || selectedObjectItems.length > 0 ||
            !!poseControlImage || !!selectedActionPose || !!selectedPalette || isAutoColorizeSketch;

        if (originalImage) {
            const hasPoseImage = boardImages.some(img => img.role === 'pose');
            const hasBackgroundImage = boardImages.some(img => img.role === 'background');
            const hasReferenceImage = boardImages.some(img =>
                img.role === 'reference' ||
                img.role === 'generalRef' ||
                img.role === 'costumeRef' ||
                img.role === 'poseRef'
            );
            return hasActiveOptions || hasPoseImage || hasReferenceImage || hasBackgroundImage;
        }

        const hasPoseImage = boardImages.some(img => img.role === 'pose');
        const hasReferenceImage = boardImages.some(img =>
            img.role === 'reference' ||
            img.role === 'generalRef' ||
            img.role === 'costumeRef' ||
            img.role === 'poseRef'
        );
        if (hasPoseImage || hasReferenceImage) {
            const noOtherRoles = !boardImages.some(img => img.role === 'background' || img.role === 'original');
            const noOtherSettings = !hasActiveOptions && !customPrompt.trim();
            return noOtherRoles && noOtherSettings;
        }

        return false;
    }, [customPrompt, modelName, originalImage, selectedAiEditAction, isAutoColoringActive, isVariationActive, isCameraViewActive, isLightDirectionActive, bodyPartReferenceMap, selectedClothingConcept, selectedObjectItems, poseControlImage, selectedActionPose, selectedPalette, isAutoColorizeSketch, boardImages, editGuideImage, toolbarActiveToolId, inpaintMode]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 200;
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
    }, [customPrompt]);

    const MASK_BYPASS_ACTIONS: AiAction[] = [
        'expand', 'pbr', 'pbr_advanced', 'extractOutfit', 'extractPose',
        'removeBackground', 'keepBackgroundOnly', 'insertObject',
    ];

    const notifyMaskRoutingIfAny = (task: Pick<GenerationTask, 'maskImage' | 'aiEditAction'>) => {
        if (!task.maskImage) return;
        if (task.aiEditAction === 'inpainting') return;
        const isBypassed = !!task.aiEditAction && MASK_BYPASS_ACTIONS.includes(task.aiEditAction);
        if (isBypassed) {
            onNotification(
                language === 'ko'
                    ? '이 작업은 마스크를 사용할 수 없어 전체 이미지를 처리합니다.'
                    : 'This tool does not use masks; the full image will be processed.',
                'error'
            );
        } else {
            onNotification(
                language === 'ko'
                    ? '마스크가 적용된 이미지: 마스크 영역만 수정됩니다'
                    : 'Mask present: only the masked region will be modified',
                'success'
            );
        }
    };

    const handleDoQueue = async (
        maskImage: File | null = null,
        submitFn: (task: GenerationTask) => void | Promise<void> = onQueueGeneration
    ) => {
        if (selectedAiEditAction || isAutoColoringActive || isVariationActive) {
            if (!originalImage) {
                onNotification(t('error.noOriginalImage', language), 'error');
                return;
            }

            // Ensure original image file exists
            const originalFile = await ensureBoardImageFile(originalImage, 'original');
            if (!originalFile) {
                console.error('[handleDoQueue] Failed to recover image file for generation. Image:', originalImage.id,
                    'src:', originalImage.src?.substring(0, 50), 'originalSrc:', originalImage.originalSrc?.substring(0, 50),
                    'hasFile:', !!originalImage.file, 'hasOriginalFile:', !!originalImage.originalFile,
                    'filePath:', originalImage.filePath, 'originalFilePath:', originalImage.originalFilePath);
                onNotification(
                    language === 'ko'
                        ? '이미지 데이터가 만료되었습니다. 워크스페이스를 다시 저장/로드해 주세요.'
                        : 'Image data has expired. Please save and reload the workspace.',
                    'error'
                );
                return;
            }

            if (selectedAiEditAction === 'insertObject' && !editGuideImage) {
                onNotification("Please edit and save the image first.", 'error');
                return;
            }

            // 유효 액션 결정
            let effectiveAction: AiAction;
            if (selectedAiEditAction) {
                effectiveAction = selectedAiEditAction;
            } else if (isAutoColoringActive && !isVariationActive) {
                effectiveAction = 'autoColoring';
            } else {
                effectiveAction = 'variation'; // variation이 primary (단독 or 결합)
            }

            const isCombinedMode = isAutoColoringActive && isVariationActive;
            // autoColoring / variation만 카메라·컨셉탭 설정과 동시 적용 허용
            const isCombinable =
                effectiveAction === 'autoColoring' ||
                effectiveAction === 'variation';

            // 참조 이미지 수집 (isCombinable일 때만)
            let validTextureImages: any[] = [];
            if (isCombinable) {
                const refImagesOnBoard = boardImages
                    .filter(img =>
                        img.role === 'reference' || img.role === 'generalRef' ||
                        img.role === 'costumeRef' || img.role === 'poseRef'
                    )
                    .sort((a, b) => (a.refIndex ?? 0) - (b.refIndex ?? 0));

                const raw = await Promise.all(
                    refImagesOnBoard.map(async (img) => {
                        const file = await ensureBoardImageFile(img, 'original');
                        return {
                            file: file!,
                            referenceType:
                                img.role === 'generalRef' ? 'general' as const :
                                img.role === 'costumeRef' ? 'costume' as const :
                                img.role === 'poseRef'    ? 'pose'    as const :
                                (img as any).referenceType,
                        };
                    })
                );
                validTextureImages = raw.filter(t => !!t.file);
            }

            const taskToQueue: GenerationTask = {
                id: `task-ai-edit-${Date.now()}`,
                taskType: 'image',
                originalImage: originalFile,
                sourceImageId: originalImage.id,
                aiEditAction: effectiveAction,
                variationCreativity,
                autoColoringIntensity,
                gridLayout,
                combinedAutoColoringIntensity: isCombinedMode ? autoColoringIntensity : undefined,
                poseControlImage: effectiveAction === 'insertObject' ? editGuideImage : null,
                customPrompt: customPrompt,

                // isCombinable이면 카메라·컨셉 설정 전달, 그 외는 빈값 고정
                textureImages:         isCombinable ? validTextureImages : [],
                cameraView:            isCombinable && isCameraViewActive ? cameraView : null,
                bodyPartReferenceMap:  isCombinable ? bodyPartReferenceMap : {},
                selectedClothingItems: isCombinable && selectedClothingConcept ? [selectedClothingConcept] : [],
                selectedObjectItems:   isCombinable ? selectedObjectItems : [],
                selectedActionPose:    isCombinable ? selectedActionPose : null,
                useAposeForViews:      isCombinable ? useAposeForViews : false,
                isApplyingFullOutfit:  isCombinable ? isApplyingFullOutfit : false,
                isApplyingTop:         isCombinable ? isApplyingTop : false,
                isApplyingBottom:      isCombinable ? isApplyingBottom : false,

                backgroundImage: null, backgroundImageAspectRatio: null,
                lightDirection: null, lightIntensity: null,
                maskImage: originalImage.maskFile ?? null,
                selectedPalette: null, numPaletteColors: 4, isAutoColorizeSketch: false,
                maskFeatherRadius: originalImage.maskFile ? maskFeatherRadius : undefined,
                contextPaddingRatio: originalImage.maskFile
                    ? (inpaintMode === 'remove' ? 10 : inpaintContextPadding)
                    : undefined,
                toneMatch: originalImage.maskFile
                    ? (inpaintMode === 'remove' ? false : inpaintToneMatch)
                    : undefined,
                resolution: selectedResolution,
                aspectRatio: selectedAspectRatio,
                modelName,
            };
            notifyMaskRoutingIfAny(taskToQueue);
            submitFn(taskToQueue);
            return;
        }

        const poseImages = boardImages.filter(img => img.role === 'pose');
        const referenceImages = boardImages.filter(img =>
            img.role === 'reference' ||
            img.role === 'generalRef' ||
            img.role === 'costumeRef' ||
            img.role === 'poseRef'
        );
        const backgroundImages = boardImages.filter(img => img.role === 'background');

        const noOtherSettings = !isCameraViewActive && !isLightDirectionActive && Object.keys(bodyPartReferenceMap).length === 0 && !selectedClothingConcept && selectedObjectItems.length === 0 && !poseControlImage && !selectedActionPose && !selectedPalette && !isAutoColorizeSketch;

        if (!originalImage && !customPrompt.trim() && noOtherSettings) {
            const isPoseOnly = poseImages.length === 1 && referenceImages.length === 0 && backgroundImages.length === 0;
            const isReferenceOnly = referenceImages.length === 1 && poseImages.length === 0 && backgroundImages.length === 0;

            let action: AiAction | null = null;
            let imageForAction: BoardImage | undefined;

            if (isPoseOnly) {
                action = 'extractPose';
                imageForAction = poseImages[0];
            } else if (isReferenceOnly) {
                const refImg = referenceImages[0];
                if (refImg.role === 'poseRef' || (refImg.role === 'reference' && refImg.referenceType === 'pose')) {
                    action = 'extractPose';
                    imageForAction = refImg;
                } else {
                    action = 'extractOutfit';
                    imageForAction = refImg;
                }
            }

            if (action && imageForAction) {
                const actionImageFile = await ensureBoardImageFile(imageForAction, 'original');
                if (!actionImageFile) {
                    onNotification(t('error.failedToLoadImage' as any, language), 'error');
                    return;
                }

                const taskToQueue: GenerationTask = {
                    id: `task-ai-edit-${Date.now()}`, taskType: 'image', originalImage: actionImageFile, sourceImageId: imageForAction.id,
                    aiEditAction: action, customPrompt: '', textureImages: [], backgroundImage: null, backgroundImageAspectRatio: null,
                    poseControlImage: null, cameraView: null, bodyPartReferenceMap: {}, selectedClothingItems: [], selectedObjectItems: [],
                    selectedActionPose: null, useAposeForViews: false, isApplyingFullOutfit: false, isApplyingTop: false,
                    isApplyingBottom: false, lightDirection: null, lightIntensity: null, maskImage: null, selectedPalette: null,
                    numPaletteColors: 4, isAutoColorizeSketch: false,
                    gridLayout,
                    resolution: selectedResolution,
                    aspectRatio: selectedAspectRatio,
                    modelName,
                };
                submitFn(taskToQueue);
                return;
            }
        }

        if (!originalImage && !customPrompt.trim()) {
            onNotification(t('error.noOriginalImage', language), 'error');
            return;
        };

        const originalImageFile = originalImage ? await ensureBoardImageFile(originalImage, 'original') : null;

        // [FIX STALE-BLOB] If we have an originalImage but couldn't recover its file, notify the user
        if (originalImage && !originalImageFile) {
            console.error('[handleDoQueue] Failed to recover original image file. Image:', originalImage.id,
                'src:', originalImage.src?.substring(0, 50), 'originalSrc:', originalImage.originalSrc?.substring(0, 50),
                'hasFile:', !!originalImage.file, 'hasOriginalFile:', !!originalImage.originalFile,
                'filePath:', originalImage.filePath, 'originalFilePath:', originalImage.originalFilePath);
            onNotification(
                language === 'ko'
                    ? '이미지 데이터가 만료되었습니다. 워크스페이스를 다시 저장/로드해 주세요.'
                    : 'Image data has expired. Please save and reload the workspace.',
                'error'
            );
            return;
        }

        const poseImageOnCanvas = boardImages.find(img => img.role === 'pose');
        const poseRefImage = boardImages.find(img => img.role === 'poseRef');

        // 드로잉 여부: store의 poseControlImage가 set되어 있으면 실제 스케치가 있는 것
        const hasDrawing = !!poseControlImage;

        // 포즈 우선순위: 그림판 드로잉 > 캔버스 pose 이미지 > poseRef 역할 이미지(폴백)
        // 그림판에 그림이 없을 때만 poseRef 역할 이미지를 포즈 참고로 활용
        const poseControlFile = poseControlImage
            || (poseImageOnCanvas ? await ensureBoardImageFile(poseImageOnCanvas, 'original') : null)
            || (poseRefImage ? await ensureBoardImageFile(poseRefImage, 'original') : null);

        const backgroundImage = boardImages.find(img => img.role === 'background');
        const backgroundImageFile = backgroundImage ? await ensureBoardImageFile(backgroundImage, 'original') : null;

        const relevantRefImages = boardImages
            .filter(img =>
                img.role === 'reference' ||
                img.role === 'generalRef' ||
                img.role === 'costumeRef'
                // poseRef는 항상 textureImages에서 제외:
                //   드로잉 있음 → 그림판이 포즈 기준 (poseRef는 밑그림 오버레이용)
                //   드로잉 없음 → poseControlFile로 이미 처리됨
            )
            .sort((a, b) => (a.refIndex ?? 0) - (b.refIndex ?? 0));

        const textureImages = await Promise.all(relevantRefImages.map(async (img) => {
            const file = await ensureBoardImageFile(img, 'original');
            return {
                file: file!,
                referenceType: img.role === 'generalRef' ? 'general' as const :
                    img.role === 'costumeRef' ? 'costume' as const :
                        img.role === 'poseRef' ? 'pose' as const :
                            img.referenceType
            };
        }));

        const validTextureImages = textureImages.filter(t => !!t.file);

        const effectiveMaskFileForIntent = maskImage || originalImage?.maskFile || null;
        const isInpaintWithMask = toolbarActiveToolId === 'inpaint' && !!effectiveMaskFileForIntent && !!originalImageFile;

        // ── Unified-mode Scene Analyzer ─────────────────────────────────────────
        let sceneCtx: SceneContext | null = null;
        if (isInpaintWithMask && inpaintSceneAnalyzerEnabled) {
            const refsForAnalyzer: Array<{ file: File; role: 'poseRef' | 'costumeRef' | 'generalRef' }> = [];
            for (const ref of boardImages) {
                if (ref.role !== 'poseRef' && ref.role !== 'costumeRef' && ref.role !== 'generalRef') continue;
                const file = await ensureBoardImageFile(ref, 'original');
                if (file) refsForAnalyzer.push({ file, role: ref.role as 'poseRef' | 'costumeRef' | 'generalRef' });
            }

            const classifierAbort = new AbortController();
            const classifierTimeout = setTimeout(() => classifierAbort.abort(), 30000);
            try {
                onNotification(
                    language === 'ko' ? 'Scene Analyzer 동작 중…' : 'Scene Analyzer running…',
                    'success'
                );
                sceneCtx = await analyzeSceneContext({
                    originalFile: originalImageFile!,
                    maskFile: effectiveMaskFileForIntent!,
                    referenceImages: refsForAnalyzer.slice(0, 4),
                    userText: inpaintSmartHint || customPrompt,
                    modelName,
                    signal: classifierAbort.signal,
                    options: {
                        anatomyEnabled: inpaintAnatomyConstraintsEnabled,
                        sceneEnabled: inpaintSceneAwareEnabled,
                    },
                });
                setLastSceneContext(sceneCtx);

                const label = sceneCtx.intent === 'remove' ? (language === 'ko' ? '제거' : 'Remove')
                    : sceneCtx.intent === 'replace' ? (language === 'ko' ? '교체' : 'Replace')
                    : sceneCtx.intent === 'touchup' ? (language === 'ko' ? '보정' : 'Touch-up')
                    : (language === 'ko' ? '확장' : 'Extend');
                const pct = Math.round(sceneCtx.confidence * 100);
                const bodyPart = sceneCtx.anatomy.bodyParts[0]?.part;
                const locTail = bodyPart ? (language === 'ko' ? ` · 위치: ${bodyPart}` : ` · part: ${bodyPart}`) : '';
                onNotification(
                    language === 'ko'
                        ? `AI 분석: ${label} (${pct}%)${locTail}`
                        : `AI intent: ${label} (${pct}%)${locTail}`,
                    'success'
                );
            } catch (e) {
                console.warn('[SceneContext] analyzer failed, falling back to user values', e);
            } finally {
                clearTimeout(classifierTimeout);
            }
        }

        // ── Effective value resolution: override true → user value, false → AI suggestion or default ──
        const finalInpaintMode: 'insert' | 'remove' = inpaintOverrides.mode
            ? inpaintMode
            : (sceneCtx?.intent === 'remove' ? 'remove' : 'insert');

        const hasInpaintRefs = toolbarActiveToolId === 'inpaint'
            && boardImages.some(img => ['generalRef', 'costumeRef', 'poseRef'].includes(img.role));

        // contextPadding — AI suggests full-image (0.10) when broad scene context needed;
        // remove mode + refs always force full-image. User override wins otherwise.
        const aiSuggestsFullImage = sceneCtx?.suggestedStrategy === 'full-image';
        const useFullImage = aiSuggestsFullImage || finalInpaintMode === 'remove' || hasInpaintRefs;
        // contextPaddingRatio is a bbox multiplier: 0.6 = +60% on each side, 10 = effectively full-image.
        // Magic value 10 retained from original logic (forces full-image crop in blendPipeline).
        const effectiveContextPadding = inpaintOverrides.contextPadding
            ? inpaintContextPadding
            : (useFullImage ? 10 : DEFAULT_INPAINT_CONTEXT_PADDING);

        const effectiveToneMatch = inpaintOverrides.toneMatch
            ? inpaintToneMatch
            : (finalInpaintMode !== 'remove');

        const effectiveFeatherRadius = inpaintOverrides.maskFeatherRadius
            ? maskFeatherRadius
            : DEFAULT_MASK_FEATHER_RADIUS;

        const effectiveVariationStrength = inpaintOverrides.variationStrength
            ? inpaintVariationStrength
            : DEFAULT_INPAINT_VARIATION_STRENGTH;

        const effectivePrompt = (() => {
            if (toolbarActiveToolId !== 'inpaint') return customPrompt;
            const augment = useInpaintPresetStore.getState().presetAugmentPrompt;
            const aiInferred = sceneCtx?.inferredPrompt?.trim() ?? '';
            const userText = (inpaintSmartHint || customPrompt).trim();
            // Compose: AI inferredPrompt (high-level intent) + preset augment + user text.
            // Empty entries are dropped; downstream geminiService also injects anatomy/scene/variation blocks.
            return [aiInferred, augment, userText].filter(s => s && s.trim()).join('\n\n');
        })();

        const taskToQueue: GenerationTask = {
            id: `task-img-${Date.now()}`,
            taskType: 'image',
            aiEditAction: toolbarActiveToolId === 'inpaint' ? 'inpainting' : undefined,
            originalImage: originalImageFile || null,
            sourceImageId: originalImage?.id,
            customPrompt: effectivePrompt,
            gridLayout,
            textureImages: validTextureImages,
            backgroundImage: backgroundImageFile || null,
            backgroundImageAspectRatio: backgroundImage ? (backgroundImage.width / backgroundImage.height).toFixed(2) : null,
            poseControlImage: poseControlFile || null,
            // 실제 그림판 드로잉일 때만 isPoseSketch=true (스케치 추종 모드)
            // poseRef 폴백일 때는 false (사진 참고 모드, 포즈만 참고)
            isPoseSketch: hasDrawing,
            cameraView: isCameraViewActive ? cameraView : null,
            bodyPartReferenceMap,
            selectedClothingItems: selectedClothingConcept ? [selectedClothingConcept] : [],
            selectedObjectItems,
            selectedActionPose,
            useAposeForViews,
            isApplyingFullOutfit,
            isApplyingTop,
            isApplyingBottom,
            lightDirection: isLightDirectionActive ? lightDirection : null,
            lightIntensity: isLightDirectionActive ? lightIntensity : null,
            maskImage: maskImage || (originalImage ? originalImage.maskFile : null) || null,
            selectedPalette,
            numPaletteColors,
            isAutoColorizeSketch,
            contextPaddingRatio: effectiveContextPadding,
            toneMatch: effectiveToneMatch,
            resolution: selectedResolution,
            aspectRatio: selectedAspectRatio,
            modelName,
            costumeCreativityLevel: isCostumeDesignEnabled ? costumeCreativityLevel : undefined,
            synthesisControlMode: isCostumeDesignEnabled ? synthesisControlMode : undefined,
            originalPreservationLevel,
            costumeBodyType,
            costumeGender,
            thinkingLevel: thinkingLevel ?? undefined,
            groundingTools: groundingTools.size > 0 ? Array.from(groundingTools) : undefined,
            inpaintWorkType: inpaintWorkType ?? undefined,
            maskFeatherRadius: effectiveFeatherRadius > 0 ? effectiveFeatherRadius : undefined,
            inpaintMode: finalInpaintMode,
            variationStrength: effectiveVariationStrength,
            sceneContext: sceneCtx,
            anatomyConstraintsEnabled: inpaintAnatomyConstraintsEnabled,
            sceneAwareEnabled: inpaintSceneAwareEnabled,
            referenceImages: toolbarActiveToolId === 'inpaint'
                ? boardImages
                    .filter(img => ['generalRef', 'costumeRef', 'poseRef'].includes(img.role))
                    .map(img => ({
                        file: img.file, src: img.src,
                        role: img.role as 'poseRef' | 'costumeRef' | 'generalRef',
                    }))
                : undefined,
            fluxOptions: isFluxModel ? { ...fluxOptions } : undefined,
            openAIOptions: isOpenAIModel ? { ...openAIOptions } : undefined,
        };
        notifyMaskRoutingIfAny(taskToQueue);
        submitFn(taskToQueue);
    };

    const handleTranslate = async () => {
        if (!customPrompt.trim() || isTranslating) return;

        setIsTranslating(true);
        onNotification(t('translation.inProgress', language), 'success');
        try {
            const translatedText = await translateToEnglish(customPrompt);
            onCustomPromptChange(translatedText);
            onNotification(t('translation.success', language), 'success');
        } catch (err: any) {
            const errorKey = err instanceof Error ? err.message as TranslationKey : 'translation.error';
            onNotification(t(errorKey, language), 'error');
        } finally {
            setIsTranslating(false);
        }
    };

    const lastSpaceTime = useRef<number>(0);
    const spaceCount = useRef<number>(0);

    const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            if (selectedAiEditAction || editGuideImage) {
                e.preventDefault();
                setSelectedAiEditAction(null);
                setEditGuideImage(null);
                return;
            }
        }

        if (e.key === ' ') {
            const now = Date.now();
            if (now - lastSpaceTime.current < 500) {
                spaceCount.current += 1;
            } else {
                spaceCount.current = 1;
            }
            lastSpaceTime.current = now;

            if (spaceCount.current === 3) {
                e.preventDefault();
                spaceCount.current = 0;
                handleTranslate();
                return;
            }
        } else {
            spaceCount.current = 0;
        }

        if (isShortcut(e.nativeEvent, 'generateImage')) {
            e.preventDefault();
            handleDoQueue();
        }
    };

    const inpaintModelUnsupported = toolbarActiveToolId === 'inpaint' && !supportsInpaint(modelName);

    return {
        textareaRef,
        isTranslating,
        selectedFolderId,
        setSelectedFolderId,
        isPresetManagerOpen,
        setIsPresetManagerOpen,
        isPresetDropdownOpen,
        setIsPresetDropdownOpen,
        isResolutionOpen,
        setIsResolutionOpen,
        isAspectRatioOpen,
        setIsAspectRatioOpen,
        isModelSelectorOpen,
        setIsModelSelectorOpen,
        resolutionRef,
        aspectRatioRef,
        modelSelectorRef,
        canGenerate,
        inpaintModelUnsupported,
        handleDoQueue,
        handleTranslate,
        handlePromptKeyDown,
        selectedResolution,
        setSelectedResolution,
        selectedAspectRatio,
        setSelectedAspectRatio,
        selectedAiEditAction,
        isAutoColoringActive,
        isVariationActive,
        // Phase 3: Thinking & Grounding
        thinkingLevel,
        setThinkingLevel,
        groundingTools,
        toggleGroundingTool,
        // Grid layout (from store)
        gridLayout,
        setGridLayout,
    };
};
