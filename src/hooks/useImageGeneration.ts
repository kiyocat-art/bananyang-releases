import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GenerationTask, GeneratedMedia, GenerationBatch, MonthlyCredit, ModelName, GenerationParams, AiAction, Resolution, AspectRatio } from '../types';
// FIX: Import missing functions from geminiService and remove unused ones.
import { processCharacterImage, getApiKey, fileToBase64, callImageEditModel, callImageEditModelWithRefs, extractPoseImage, extractOutfitImage, keepBackgroundOnly, removeImageBackground, getAutoColoringPrompt, getVariationPrompt, buildAutoColoringReferenceHint, buildVariationReferenceHint, buildAutoColoringRenderingHint, buildCameraTabHint, buildGridInstruction, expandImage, generatePbrMap, generateAdvancedPbrMap, hasValidAuth, inpaintImage } from '../services/geminiService';
import { getUseGoogleAuth } from '../services/gemini/api';
import { t, TranslationKey, Language } from '../localization';
import { useCanvasStore } from '../store/canvasStore';
// FIX: Import COST_PER_IMAGE constant from the correct file.
import { COST_PER_IMAGE, MODEL_COSTS } from '../constants';
import { useGenerationStore } from '../store/generationStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../store/uiStore';
import { processGeneratedImage } from '../services/dataWorkerService';
import { blobManager } from '../utils/blobManager';
import { vramGuard } from '../services/vramGuardService';
import { useCreditStore } from '../store/creditStore';
import { getFluxCredits } from '../services/providers/flux/api';
import { openAIProvider } from '../services/providers/openai/service';
import { fluxProvider } from '../services/providers/flux/service';
import { preparePaddedRegion, blendInpaintResult } from '../lib/inpaint/blendPipeline';
import { BlendOptions, PaddedRegion, DEFAULT_BLEND_OPTIONS } from '../lib/inpaint/types';
import { TextureImage } from '../services/gemini/types';
import { convertMaskToOpenAIFormat } from '../lib/inpaint/maskConvert';

const LOCAL_CREDIT_KEY = 'bananyang-monthly-credit-usd-v1';

const INPAINT_ACTIONS: ReadonlyArray<AiAction> = ['inpainting', 'inpaintInsert', 'inpaintRemove'];

const TASKS_BYPASSING_MASK: ReadonlyArray<AiAction> = [
    'expand',
    'pbr',
    'pbr_advanced',
    'extractOutfit',
    'extractPose',
    'removeBackground',
    'keepBackgroundOnly',
    'insertObject',
];

function shouldRouteThroughMask(task: GenerationTask): boolean {
    if (!task.maskImage) return false;
    if (!task.aiEditAction) return false;
    return !TASKS_BYPASSING_MASK.includes(task.aiEditAction);
}

function readBlendOptions(task: GenerationTask): BlendOptions {
    return {
        featherRadius: task.maskFeatherRadius ?? DEFAULT_BLEND_OPTIONS.featherRadius,
        contextPaddingRatio: task.contextPaddingRatio ?? DEFAULT_BLEND_OPTIONS.contextPaddingRatio,
        toneMatch: task.toneMatch ?? DEFAULT_BLEND_OPTIONS.toneMatch,
    };
}

function syncFluxCreditsFireAndForget(): void {
    getFluxCredits()
        .then(credits => useCreditStore.getState().setFluxCredits(credits))
        .catch(err => console.warn('[Flux Credits Sync] Failed:', err?.message));
}

function resolveGeneratedBy(modelName: string): GeneratedMedia['generatedBy'] {
    if (modelName.startsWith('flux/')) return 'flux';
    if (modelName.startsWith('openai/')) return 'openai';
    return getUseGoogleAuth() ? 'vertex' : 'apiKey';
}

/**
 * 이미지 파일의 가로/세로 비율을 감지해 가장 가까운 표준 AspectRatio를 반환합니다.
 * 2x2 그리드는 각 셀과 동일한 비율이므로 전체 출력도 동일 비율이 됩니다.
 */
async function detectAspectRatio(file: File): Promise<AspectRatio> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio = img.naturalWidth / img.naturalHeight;
            const candidates: Array<[AspectRatio, number]> = [
                ['1:1', 1 / 1],
                ['16:9', 16 / 9],
                ['9:16', 9 / 16],
                ['4:3', 4 / 3],
                ['3:4', 3 / 4],
            ];
            let best: AspectRatio = '1:1';
            let minDiff = Infinity;
            for (const [name, val] of candidates) {
                const diff = Math.abs(ratio - val);
                if (diff < minDiff) { minDiff = diff; best = name; }
            }
            resolve(best);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve('1:1'); };
        img.src = url;
    });
}

interface UseImageGenerationProps {
    monthlyCredit: MonthlyCredit;
    setMonthlyCredit: React.Dispatch<React.SetStateAction<MonthlyCredit>>;
    userAcknowledgedPaidUsage: boolean;
    modelName: ModelName;
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    saveDirectoryPath: string | null;
    setGenerationBatches: React.Dispatch<React.SetStateAction<GenerationBatch[]>>;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    setShowUsagePlanModal: React.Dispatch<React.SetStateAction<boolean>>;
    setShowQuotaModal: React.Dispatch<React.SetStateAction<boolean>>;
    language: Language;
    mainPanelRef: React.RefObject<HTMLElement>;
    onNotification: (message: string, type: 'success' | 'error') => void;
}

export const useImageGeneration = ({
    monthlyCredit,
    setMonthlyCredit,
    userAcknowledgedPaidUsage,
    modelName,
    saveDirectoryHandle,
    saveDirectoryPath,
    setGenerationBatches,
    setCurrentPage,
    setShowUsagePlanModal,
    setShowQuotaModal,
    language,
    mainPanelRef,
    onNotification,
}: UseImageGenerationProps) => {
    const [generationQueue, setGenerationQueue] = useState<GenerationTask[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    // Synchronous guard: React state updates are async, so isProcessing can be stale
    // when the effect fires multiple times before re-render. This ref prevents concurrent execution.
    const isProcessingRef = useRef(false);
    const autoResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoResumeOnRateLimit = useSettingsStore(s => s.autoResumeOnRateLimit);
    const autoResumeOnRateLimitRef = useRef(autoResumeOnRateLimit);
    useEffect(() => { autoResumeOnRateLimitRef.current = autoResumeOnRateLimit; }, [autoResumeOnRateLimit]);
    const addImagesToCenter = useCanvasStore(state => state.addImagesToCenter);
    const { resetPaintingParams } = useGenerationStore();

    const queueGeneration = useCallback(async (task: GenerationTask) => {
        if (!hasValidAuth()) {
            useUIStore.getState().setShowGenerationLoginPrompt(true);
            return;
        }
        // Generate a small thumbnail from originalImage for queue display
        if (task.originalImage && !task.thumbnailDataUrl) {
            try {
                const bitmapSrc = URL.createObjectURL(task.originalImage);
                const img = new Image();
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = reject;
                    img.src = bitmapSrc;
                });
                const THUMB_SIZE = 64;
                const scale = Math.min(THUMB_SIZE / img.width, THUMB_SIZE / img.height);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h);
                    task.thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                }
                URL.revokeObjectURL(bitmapSrc);
            } catch (e) {
                // Silently fail — queue will still work without thumbnail
            }
        }
        setGenerationQueue(prev => [...prev, task]);
    }, [language, onNotification]);

    useEffect(() => () => {
        if (autoResumeTimerRef.current) clearTimeout(autoResumeTimerRef.current);
    }, []);

    const cancelAll = useCallback(() => {
        if (autoResumeTimerRef.current) {
            clearTimeout(autoResumeTimerRef.current);
            autoResumeTimerRef.current = null;
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        isProcessingRef.current = false;
        setGenerationQueue([]);
        setIsProcessing(false);
        setIsPaused(false);
        onNotification(t('error.cancelled', language), 'error');
    }, [language, onNotification]);

    const pauseGeneration = useCallback(() => {
        setIsPaused(true);
    }, []);

    const resumeGeneration = useCallback(() => {
        setIsPaused(false);
    }, []);

    const cancelSingleTask = useCallback((taskId: string) => {
        if (isProcessing && generationQueue.length > 0 && generationQueue[0].id === taskId) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        } else {
            setGenerationQueue(prev => prev.filter(task => task.id !== taskId));
        }
    }, [isProcessing, generationQueue]);

    const reorderGenerationQueue = useCallback((ids: string[]) => {
        setGenerationQueue(prev => {
            const idMap = new Map(prev.map(t => [t.id, t]));
            return ids.map(id => idMap.get(id)!).filter(Boolean);
        });
    }, []);

    useEffect(() => {
        const processNextInQueue = async () => {
            // isProcessingRef is a synchronous guard: React state (isProcessing) can be stale
            // if this effect fires multiple times before a re-render, causing concurrent executions.
            if (isProcessingRef.current || isProcessing || generationQueue.length === 0 || isPaused) return;
            isProcessingRef.current = true;
            if (!hasValidAuth()) {
                isProcessingRef.current = false;
                useUIStore.getState().setShowGenerationLoginPrompt(true);
                return;
            }
            if (monthlyCredit.current <= 0 && !userAcknowledgedPaidUsage) {
                isProcessingRef.current = false;
                setShowQuotaModal(true);
                return;
            }

            // [STABILITY] Proactive texture cleanup before high-res generation
            // Trigger cleanup for 4K/2K images to free VRAM before generation
            const task = generationQueue[0];
            const resolution = task.resolution;
            const is4K = resolution?.includes('4') || resolution?.includes('high');
            const is2K = resolution?.includes('2') || resolution?.includes('2k') || resolution?.includes('2K');

            if (is4K || is2K) {
                console.log('[Generation] Pre-generation texture cleanup for high-res image');
                // [FIX] Must include activeImageIds to prevent deleting ALL textures
                const boardImages = useCanvasStore.getState().boardImages;
                const activeImageIds = boardImages.map(img => img.id);
                const activeSrcs: string[] = [];
                boardImages.forEach(img => {
                    if (img.src) activeSrcs.push(img.src);
                    if (img.tinySrc) activeSrcs.push(img.tinySrc);
                    if (img.previewSrc) activeSrcs.push(img.previewSrc);
                    if (img.proxySrc) activeSrcs.push(img.proxySrc);
                });

                window.dispatchEvent(new CustomEvent('canvas-cleanup-textures', {
                    detail: {
                        aggressive: is4K,
                        source: 'pre-generation',
                        activeImageIds,
                        activeSrcs
                    }
                }));
                // Brief wait for cleanup to complete
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // [VRAM GUARD] Check if generation is allowed based on VRAM usage and cooldown
            const vramCheck = await vramGuard.canGenerate(resolution);

            if (!vramCheck.allowed) {
                console.warn(`[VramGuard] Generation blocked: ${vramCheck.reason}`);
                onNotification(vramCheck.reason || 'VRAM 사용량이 너무 높습니다. 잠시 후 다시 시도하세요.', 'error');

                // If it's a cooldown issue, wait and retry automatically
                if (vramCheck.cooldownStatus && !vramCheck.cooldownStatus.canGenerate) {
                    isProcessingRef.current = false;
                    await vramGuard.waitForCooldown(resolution);
                    // Retry after cooldown
                    processNextInQueue();
                } else {
                    isProcessingRef.current = false;
                }
                return;
            }

            // Show warning if VRAM is high but not blocking
            if (vramCheck.vramStatus.shouldWarn && vramCheck.reason) {
                console.warn(`[VramGuard] Warning: ${vramCheck.reason}`);
            }

            setIsProcessing(true);
            setProgress(0);
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            // Timing measurement for progress bar calibration
            const generationStartTime = performance.now();
            console.log(`[Generation Timing] Started at ${new Date().toISOString()}, Model: ${task.modelName || modelName}`);

            try {
                if (task.taskType === 'image') {
                    let resultSrcs: string[];
                    let successMessageKey: TranslationKey = 'generation.complete';
                    let generationParams: GenerationParams | undefined;
                    let blendRegion: PaddedRegion | null = null;
                    let blendOriginalFile: File | null = null;
                    let blendOptionsForPost: BlendOptions = DEFAULT_BLEND_OPTIONS;

                    if (task.aiEditAction) {
                        generationParams = {
                            customPrompt: task.aiEditAction === 'insertObject' ? task.objectToInsert?.prompt || '' : task.customPrompt,
                            bodyPartReferenceMap: {},
                            selectedClothingItems: [],
                            selectedObjectItems: [],
                            selectedActionPose: null,
                            aiEditAction: task.aiEditAction,
                            variationCreativity: task.variationCreativity,
                            autoColoringIntensity: task.autoColoringIntensity,
                            gridLayout: task.gridLayout,
                            resolution: task.resolution,
                            aspectRatio: task.aspectRatio,
                            modelName: task.modelName,
                            pbrMapTypes: task.pbrMapTypes?.length ? task.pbrMapTypes : undefined,
                            groundingTools: task.groundingTools?.length ? task.groundingTools : undefined,
                        };

                        const originalImageBeforeMaskCrop = task.originalImage;
                        if (!originalImageBeforeMaskCrop) throw new Error('error.noOriginalImage');

                        blendOriginalFile = originalImageBeforeMaskCrop;
                        blendOptionsForPost = readBlendOptions(task);

                        let imageForEdit: File = originalImageBeforeMaskCrop;
                        let maskFileForEdit: File | null = task.maskImage ?? null;

                        const isExternalInpaint =
                            (modelName.startsWith('openai/') || modelName.startsWith('flux/'))
                            && INPAINT_ACTIONS.includes(task.aiEditAction as AiAction);

                        if (shouldRouteThroughMask(task) && task.maskImage && !isExternalInpaint) {
                            try {
                                const prepared = await preparePaddedRegion(originalImageBeforeMaskCrop, task.maskImage, blendOptionsForPost);
                                if (prepared) {
                                    blendRegion = prepared;
                                    imageForEdit = prepared.paddedImageFile;
                                    maskFileForEdit = prepared.paddedMaskFile;
                                    console.info('[blendPipeline] mask routing engaged', {
                                        action: task.aiEditAction,
                                        crop: { x: prepared.cropX, y: prepared.cropY, w: prepared.cropW, h: prepared.cropH },
                                        full: { w: prepared.imageW, h: prepared.imageH },
                                    });
                                }
                            } catch (e) {
                                console.warn('[blendPipeline] preparePaddedRegion failed, falling back to full image:', e);
                                blendRegion = null;
                            }
                        }

                        const region = blendRegion;
                        const base64 = await fileToBase64(imageForEdit);
                        const imagePayload = { data: base64, mimeType: imageForEdit.type };

                        const isExternalProvider = modelName.startsWith('flux/') || modelName.startsWith('openai/');
                        type SimpleEditFunc = (img: any, model: string, sig: AbortSignal, res?: Resolution, asp?: AspectRatio, fluxOpts?: any, openAIOpts?: any) => Promise<string[]>;
                        const actionMap: Record<string, { func: SimpleEditFunc, loadKey: TranslationKey, successKey: TranslationKey }> = {
                            removeBackground: { func: removeImageBackground, loadKey: 'removeBackground.loading', successKey: 'removeBackground.complete' },
                            keepBackgroundOnly: { func: keepBackgroundOnly, loadKey: 'editModal.keepBackgroundOnly', successKey: 'editModal.keepBackgroundOnlyComplete' },
                            extractPose: { func: extractPoseImage, loadKey: 'aiEdit.extractPoseLoading', successKey: 'aiEdit.extractPoseComplete' },
                            // extractOutfit removed - handled separately with outputMode parameter
                        };

                        if (task.aiEditAction === 'autoColoring') {
                            const base64Data = await fileToBase64(imageForEdit);
                            const hasRefs = !!(task.textureImages && task.textureImages.length > 0);

                            const basePrompt = getAutoColoringPrompt(task.autoColoringIntensity ?? 3);
                            const referenceHint = hasRefs
                                ? buildAutoColoringReferenceHint(task.textureImages!)
                                : '';
                            // Gemini 경로에서만 Markdown 카메라 힌트 삽입 — 외부 provider는 자체 주입
                            const cameraTabHint = (!isExternalProvider && task.cameraView)
                                ? buildCameraTabHint(task.cameraView)
                                : '';

                            const promptParts = hasRefs ? [referenceHint, basePrompt] : [basePrompt];
                            if (cameraTabHint) promptParts.push(cameraTabHint);
                            if (task.customPrompt?.trim()) promptParts.push(`Additional instruction: ${task.customPrompt.trim()}`);
                            const finalPrompt = promptParts.join('\n\n') + buildGridInstruction(task.gridLayout ?? null);

                            if (hasRefs) {
                                const refPayloads = await Promise.all(
                                    task.textureImages!.map(async (ref) => ({
                                        data: await fileToBase64(ref.file),
                                        mimeType: ref.file.type,
                                    }))
                                );
                                resultSrcs = await callImageEditModelWithRefs(
                                    { data: base64Data, mimeType: imageForEdit.type },
                                    refPayloads,
                                    finalPrompt,
                                    modelName, signal, task.resolution, task.aspectRatio,
                                    task.fluxOptions,
                                    task.openAIOptions,
                                    isExternalProvider ? (task.cameraView ?? null) : null,
                                    isExternalProvider ? (task.lightDirection ?? null) : null,
                                    isExternalProvider ? (task.lightIntensity ?? null) : null,
                                );
                            } else {
                                resultSrcs = await callImageEditModel(
                                    { data: base64Data, mimeType: imageForEdit.type },
                                    finalPrompt,
                                    modelName, signal, task.resolution, task.aspectRatio,
                                    task.fluxOptions,
                                    task.openAIOptions,
                                    isExternalProvider ? (task.cameraView ?? null) : null,
                                    isExternalProvider ? (task.lightDirection ?? null) : null,
                                    isExternalProvider ? (task.lightIntensity ?? null) : null,
                                );
                            }
                            successMessageKey = 'aiEdit.autoColoringComplete';
                        } else if (task.aiEditAction === 'variation') {
                            const base64Data = await fileToBase64(imageForEdit);
                            const hasRefs = !!(task.textureImages && task.textureImages.length > 0);

                            const gridLayout = task.gridLayout ?? null;
                            const effectiveAspectRatio = task.aspectRatio;

                            const isCombinedMode = !!task.combinedAutoColoringIntensity;

                            if (isCombinedMode) {
                                // 결합 모드: 베리에이션 디자인 + 자동채색 렌더링
                                const variationBasePrompt = getVariationPrompt(task.variationCreativity ?? 3, undefined, gridLayout);
                                const autoColoringRenderingHint = buildAutoColoringRenderingHint(task.combinedAutoColoringIntensity!);
                                // Gemini 경로에서만 Markdown 카메라 힌트 삽입 — 외부 provider는 자체 주입
                                const cameraTabHint = (!isExternalProvider && task.cameraView) ? buildCameraTabHint(task.cameraView) : '';

                                let referenceHint = '';
                                if (hasRefs) {
                                    referenceHint = buildVariationReferenceHint(task.textureImages!, task.variationCreativity ?? 3);
                                }

                                const promptParts = hasRefs
                                    ? [referenceHint, variationBasePrompt, autoColoringRenderingHint]
                                    : [variationBasePrompt, autoColoringRenderingHint];
                                if (cameraTabHint) promptParts.push(cameraTabHint);
                                if (task.customPrompt?.trim()) promptParts.push(`Additional instruction: ${task.customPrompt.trim()}`);
                                const finalPrompt = promptParts.join('\n\n');

                                if (hasRefs) {
                                    const refPayloads = await Promise.all(
                                        task.textureImages!.map(async (ref) => ({
                                            data: await fileToBase64(ref.file),
                                            mimeType: ref.file.type,
                                        }))
                                    );
                                    resultSrcs = await callImageEditModelWithRefs(
                                        { data: base64Data, mimeType: imageForEdit.type },
                                        refPayloads, finalPrompt, modelName, signal, task.resolution, effectiveAspectRatio,
                                        task.fluxOptions,
                                        task.openAIOptions,
                                        isExternalProvider ? (task.cameraView ?? null) : null,
                                        isExternalProvider ? (task.lightDirection ?? null) : null,
                                        isExternalProvider ? (task.lightIntensity ?? null) : null,
                                    );
                                } else {
                                    resultSrcs = await callImageEditModel(
                                        { data: base64Data, mimeType: imageForEdit.type },
                                        finalPrompt, modelName, signal, task.resolution, effectiveAspectRatio,
                                        task.fluxOptions,
                                        task.openAIOptions,
                                        isExternalProvider ? (task.cameraView ?? null) : null,
                                        isExternalProvider ? (task.lightDirection ?? null) : null,
                                        isExternalProvider ? (task.lightIntensity ?? null) : null,
                                    );
                                }
                            } else if (hasRefs) {
                                const referenceHint = buildVariationReferenceHint(
                                    task.textureImages!,
                                    task.variationCreativity ?? 3
                                );
                                // Gemini 경로에서만 Markdown 카메라 힌트 삽입 — 외부 provider는 자체 주입
                                const cameraTabHint = (!isExternalProvider && task.cameraView)
                                    ? buildCameraTabHint(task.cameraView)
                                    : '';

                                const variationBaseForRefs = getVariationPrompt(task.variationCreativity ?? 3, undefined, gridLayout);
                                const promptParts = [referenceHint, variationBaseForRefs];
                                if (cameraTabHint) promptParts.push(cameraTabHint);
                                if (task.customPrompt?.trim()) promptParts.push(`Additional instruction: ${task.customPrompt.trim()}`);
                                const finalPrompt = promptParts.join('\n\n');

                                const refPayloads = await Promise.all(
                                    task.textureImages!.map(async (ref) => ({
                                        data: await fileToBase64(ref.file),
                                        mimeType: ref.file.type,
                                    }))
                                );
                                resultSrcs = await callImageEditModelWithRefs(
                                    { data: base64Data, mimeType: imageForEdit.type },
                                    refPayloads,
                                    finalPrompt,
                                    modelName, signal, task.resolution, effectiveAspectRatio,
                                    task.fluxOptions,
                                    task.openAIOptions,
                                    isExternalProvider ? (task.cameraView ?? null) : null,
                                    isExternalProvider ? (task.lightDirection ?? null) : null,
                                    isExternalProvider ? (task.lightIntensity ?? null) : null,
                                );
                            } else {
                                const prompt = getVariationPrompt(
                                    task.variationCreativity ?? 3,
                                    task.customPrompt,
                                    gridLayout
                                );
                                resultSrcs = await processCharacterImage(
                                    { data: base64Data, mimeType: imageForEdit.type },
                                    task.cameraView ?? null,
                                    [], {}, [], [],
                                    prompt,
                                    null, [], null, null,
                                    task.useAposeForViews ?? false,
                                    false, false, false, null,
                                    modelName, signal, null, null, null, null, 0,
                                    false,
                                    task.resolution, effectiveAspectRatio
                                );
                            }
                            successMessageKey = 'aiEdit.variationComplete';
                        } else if (task.aiEditAction === 'extractOutfit') {
                            resultSrcs = await extractOutfitImage(imagePayload, modelName, signal, task.resolution, task.aspectRatio, task.gridLayout ?? null, task.fluxOptions, task.openAIOptions);
                            successMessageKey = 'aiEdit.extractOutfitComplete';
                        } else if (task.aiEditAction === 'expand') {
                            resultSrcs = await expandImage(imagePayload, modelName, signal, task.resolution, task.aspectRatio, task.customPrompt, task.fluxOptions, task.openAIOptions);
                            successMessageKey = 'aiEdit.expandComplete';
                        } else if (task.aiEditAction === 'pbr') {
                            resultSrcs = await generatePbrMap(imagePayload, modelName, signal, task.resolution, task.aspectRatio, task.customPrompt, task.fluxOptions, task.openAIOptions);
                            successMessageKey = 'generation.complete';
                        } else if (task.aiEditAction === 'pbr_advanced') {
                            // [FALLBACK] If pbrStructureImage is missing, use originalImage (which is passed as filePayload from modal)
                            const structureFile = task.pbrStructureImage || task.originalImage;

                            // [PERF] Parallelize all PBR image conversions
                            const [structurePayload, frontPayload, backPayload] = await Promise.all([
                                structureFile
                                    ? fileToBase64(structureFile).then(data => ({ data, mimeType: structureFile.type }))
                                    : Promise.resolve(null),
                                task.pbrFrontImage
                                    ? fileToBase64(task.pbrFrontImage).then(data => ({ data, mimeType: task.pbrFrontImage!.type }))
                                    : Promise.resolve(null),
                                task.pbrBackImage
                                    ? fileToBase64(task.pbrBackImage).then(data => ({ data, mimeType: task.pbrBackImage!.type }))
                                    : Promise.resolve(null),
                            ]);

                            resultSrcs = await generateAdvancedPbrMap(
                                structurePayload,
                                frontPayload,
                                backPayload,
                                task.pbrMapTypes || [],
                                modelName,
                                signal,
                                task.resolution,
                                task.aspectRatio,
                                task.customPrompt
                            );
                            successMessageKey = 'generation.complete';
                        } else {
                            const simpleAction = actionMap[task.aiEditAction];

                            if (simpleAction) {
                                resultSrcs = await simpleAction.func(imagePayload, modelName, signal, task.resolution, task.aspectRatio, task.fluxOptions, task.openAIOptions);
                                successMessageKey = simpleAction.successKey;

                            } else if (task.aiEditAction === 'relight') {
                                // Relighting uses the prompt constructed in the UI
                                const prompt = (task.customPrompt || "Relight this image.") + buildGridInstruction(task.gridLayout ?? null);
                                resultSrcs = await callImageEditModel(
                                    imagePayload, prompt, modelName, signal, task.resolution, task.aspectRatio,
                                    task.fluxOptions,
                                    task.openAIOptions,
                                    isExternalProvider ? (task.cameraView ?? null) : null,
                                    isExternalProvider ? (task.lightDirection ?? null) : null,
                                    isExternalProvider ? (task.lightIntensity ?? null) : null,
                                );
                                successMessageKey = 'aiEdit.variationComplete'; // Can share completion message or add specific one
                            } else if (
                                task.aiEditAction === 'inpainting'
                                || task.aiEditAction === 'inpaintInsert'
                                || task.aiEditAction === 'inpaintRemove'
                            ) {
                                if (!maskFileForEdit) throw new Error('error.noMaskImage');

                                const explicitMode = task.aiEditAction === 'inpaintInsert'
                                    ? 'insert'
                                    : task.aiEditAction === 'inpaintRemove'
                                        ? 'remove'
                                        : (task.inpaintMode === 'remove' ? 'remove' : 'insert');

                                const hasRefs = !!(task.referenceImages && task.referenceImages.length > 0);
                                const maskBase64 = await fileToBase64(maskFileForEdit);
                                const maskPayload = { data: maskBase64, mimeType: maskFileForEdit.type };
                                const prompt = (task.customPrompt || '') + buildGridInstruction(task.gridLayout ?? null);

                                let referenceImagePayloads: { data: string, mimeType: string, role?: 'poseRef' | 'costumeRef' | 'generalRef' }[] | undefined;
                                if (hasRefs) {
                                    try {
                                        referenceImagePayloads = await Promise.all(task.referenceImages!.map(async (ref) => {
                                            let refFile: File | undefined = ref.file;
                                            if (!refFile && ref.src) {
                                                const response = await fetch(ref.src);
                                                const blob = await response.blob();
                                                refFile = new File([blob], 'ref.png', { type: blob.type });
                                            }
                                            if (!refFile) throw new Error('ref image has no file or src');
                                            const base64 = await fileToBase64(refFile);
                                            return { data: base64, mimeType: refFile.type, role: ref.role };
                                        }));
                                    } catch (refErr) {
                                        console.warn('[inpainting] ref image processing failed:', refErr);
                                    }
                                }

                                let poseControlImagePayload: { data: string; mimeType: string } | null = null;
                                if (task.poseControlImage) {
                                    try {
                                        const pciBase64 = await fileToBase64(task.poseControlImage);
                                        poseControlImagePayload = { data: pciBase64, mimeType: task.poseControlImage.type };
                                    } catch (e) {
                                        console.warn('[inpainting] poseControlImage conversion failed:', e);
                                    }
                                }

                                console.info('[inpaint] dispatch', {
                                    action: task.aiEditAction, model: modelName,
                                    hasRefs, mode: explicitMode, hasPrompt: !!task.customPrompt,
                                    routedThroughMask: !!region,
                                });

                                if (modelName.startsWith('openai/')) {
                                    const maskForOpenAI = await convertMaskToOpenAIFormat(maskBase64);
                                    const textureImgs: TextureImage[] = (referenceImagePayloads ?? []).map(r => ({
                                        data: r.data, mimeType: r.mimeType, referenceType: 'general' as const,
                                    }));
                                    const openAIPrompt = (explicitMode === 'remove' && !task.customPrompt?.trim())
                                        ? 'Remove the object in the masked area and reconstruct the background naturally to fill the gap seamlessly'
                                        : prompt;
                                    resultSrcs = await openAIProvider.generate({
                                        originalImage: imagePayload,
                                        maskImage: { data: maskForOpenAI, mimeType: 'image/png' },
                                        prompt: openAIPrompt,
                                        textureImages: textureImgs,
                                        poseImage: null,
                                        backgroundImage: null,
                                        backgroundImageAspectRatio: task.backgroundImageAspectRatio ?? null,
                                        poseControlImage: poseControlImagePayload,
                                        cameraView: task.cameraView ?? null,
                                        bodyPartReferenceMap: task.bodyPartReferenceMap ?? {} as any,
                                        selectedClothingItems: task.selectedClothingItems ?? [],
                                        selectedObjectItems: task.selectedObjectItems ?? [],
                                        selectedActionPose: task.selectedActionPose ?? null,
                                        useAposeForViews: task.useAposeForViews ?? false,
                                        isApplyingFullOutfit: task.isApplyingFullOutfit ?? false,
                                        isApplyingTop: task.isApplyingTop ?? false,
                                        isApplyingBottom: task.isApplyingBottom ?? false,
                                        lightDirection: task.lightDirection ?? null,
                                        lightIntensity: task.lightIntensity ?? null,
                                        selectedPalette: task.selectedPalette ?? null,
                                        numPaletteColors: task.numPaletteColors ?? 0,
                                        isAutoColorizeSketch: task.isAutoColorizeSketch ?? false,
                                        modelName, signal,
                                        resolution: task.resolution,
                                        aspectRatio: task.aspectRatio,
                                        openAIOptions: task.openAIOptions,
                                    }, signal);
                                } else if (modelName.startsWith('flux/')) {
                                    const textureImgs: TextureImage[] = (referenceImagePayloads ?? []).map(r => ({
                                        data: r.data, mimeType: r.mimeType, referenceType: 'general' as const,
                                    }));
                                    const fluxPrompt = (explicitMode === 'remove' && !task.customPrompt?.trim())
                                        ? 'Remove the object in the masked area and fill the background naturally'
                                        : prompt;
                                    resultSrcs = await fluxProvider.generate({
                                        originalImage: imagePayload,
                                        maskImage: maskPayload,
                                        prompt: fluxPrompt,
                                        textureImages: textureImgs,
                                        poseImage: null,
                                        backgroundImage: null,
                                        backgroundImageAspectRatio: task.backgroundImageAspectRatio ?? null,
                                        poseControlImage: poseControlImagePayload,
                                        cameraView: task.cameraView ?? null,
                                        bodyPartReferenceMap: task.bodyPartReferenceMap ?? {} as any,
                                        selectedClothingItems: task.selectedClothingItems ?? [],
                                        selectedObjectItems: task.selectedObjectItems ?? [],
                                        selectedActionPose: task.selectedActionPose ?? null,
                                        useAposeForViews: task.useAposeForViews ?? false,
                                        isApplyingFullOutfit: task.isApplyingFullOutfit ?? false,
                                        isApplyingTop: task.isApplyingTop ?? false,
                                        isApplyingBottom: task.isApplyingBottom ?? false,
                                        lightDirection: task.lightDirection ?? null,
                                        lightIntensity: task.lightIntensity ?? null,
                                        selectedPalette: task.selectedPalette ?? null,
                                        numPaletteColors: task.numPaletteColors ?? 0,
                                        isAutoColorizeSketch: task.isAutoColorizeSketch ?? false,
                                        modelName, signal,
                                        resolution: task.resolution,
                                        aspectRatio: task.aspectRatio,
                                        fluxOptions: task.fluxOptions,
                                    }, signal);
                                } else {
                                    resultSrcs = await inpaintImage(
                                        imagePayload, maskPayload, prompt, modelName, signal,
                                        task.resolution, task.aspectRatio,
                                        referenceImagePayloads,
                                        task.inpaintWorkType,
                                        explicitMode,
                                        undefined,                              // numberOfImages
                                        task.sceneContext ?? null,
                                        task.variationStrength,
                                        task.anatomyConstraintsEnabled,
                                        task.sceneAwareEnabled,
                                    );
                                }
                                successMessageKey = 'aiEdit.inpaintingComplete';
                            } else if (task.aiEditAction === 'insertObject') {
                                // [FIX] The filePayload (guideImageFile) already contains the composed image
                                // from UnifiedEditorModal. We just need to send it to the AI with the prompt.
                                // No need to re-composite here - that was causing duplicate composition issues.

                                const { objectToInsert } = task;
                                const prompt = objectToInsert?.prompt || '';
                                const transform = objectToInsert?.transform;
                                const canvasW = task.sourceImageDisplaySize?.width ?? 0;
                                const canvasH = task.sourceImageDisplaySize?.height ?? 0;

                                const placementMetadata = (transform && canvasW > 0 && canvasH > 0) ? (() => {
                                    const centerX = transform.x + transform.width / 2;
                                    const centerY = transform.y + transform.height / 2;
                                    const pctX = Math.round((centerX / canvasW) * 100);
                                    const pctY = Math.round((centerY / canvasH) * 100);
                                    const pctW = Math.round((transform.width / canvasW) * 100);
                                    const pctH = Math.round((transform.height / canvasH) * 100);
                                    const hZone = pctX < 35 ? 'left' : pctX > 65 ? 'right' : 'center';
                                    const vZone = pctY < 35 ? 'upper' : pctY > 65 ? 'lower' : 'middle';
                                    const regionLabel = `${vZone}-${hZone}`;
                                    const rotationNote = transform.rotation !== 0
                                        ? `tilted at ${transform.rotation > 0 ? '+' : ''}${Math.round(transform.rotation)}° (clockwise)`
                                        : 'no rotation (upright)';
                                    return `\n\n[OBJECT PLACEMENT METADATA — treat this as ground truth]\n` +
                                        `- Canvas size: ${canvasW} × ${canvasH} px\n` +
                                        `- Object top-left corner: (${Math.round(transform.x)}, ${Math.round(transform.y)}) px\n` +
                                        `- Object center: (${Math.round(centerX)}, ${Math.round(centerY)}) px  →  ${pctX}% from left, ${pctY}% from top\n` +
                                        `- Object size: ${Math.round(transform.width)} × ${Math.round(transform.height)} px  →  ${pctW}% × ${pctH}% of canvas\n` +
                                        `- Rotation: ${rotationNote}\n` +
                                        `- Region: ${regionLabel} area of the scene\n` +
                                        `The guide image visually shows this exact placement. Both the metadata and the guide image MUST be respected simultaneously.`;
                                })() : '';

                                // [개선 A] Interaction-type specific instructions
                                const interactionBlock = (() => {
                                    const iType = task.objectInteractionType;
                                    if (iType === 'hold') {
                                        return `\n\n**INTERACTION — Hand Hold:**
- The character's hand(s) must naturally grip the inserted object — no floating gap between hand and object.
- If the hand is not visible yet, regenerate it in a natural gripping pose matching the object's shape.
- Cast a contact shadow where fingers touch the object surface.
- The object must follow the hand's orientation and tilt angle.`;
                                    }
                                    if (iType === 'wear') {
                                        return `\n\n**INTERACTION — Wearing/Equipped:**
- The object must conform tightly to the character's body contour — no floating or hovering above the surface.
- Generate appropriate fabric folds or deformation where the object contacts the body.
- Preserve the original skin tone boundary precisely at the contact edge.
- The object must cast a shadow on the body surface consistent with the scene's light source.`;
                                    }
                                    if (iType === 'add_character') {
                                        return `\n\n**INTERACTION — Adding a Character:**
- Scale the inserted character based on vertical Y position: lower Y = larger (foreground), higher Y = smaller (background).
- Ensure the character's feet (or base) touch the ground plane with a contact shadow.
- Match the character's perspective angle to the scene's vanishing point.
- The new character's art style MUST exactly match the existing characters in the scene.`;
                                    }
                                    if (iType === 'place') {
                                        return `\n\n**INTERACTION — Placed on Surface:**
- Generate a contact shadow beneath the object where it rests on the surface.
- Match the surface texture and normal direction at the base of the object.
- The object's base must sit flush on the surface — no floating.`;
                                    }
                                    return '';
                                })();

                                const basePrompt = `**MANDATORY ART STYLE ANALYSIS (perform this BEFORE generating):**
Examine the main image and identify:
1. Line art: Is there a visible outline? → thickness, color, style (clean / rough / none)?
2. Coloring technique: Flat color / Cel shading / Soft gradient / Painterly / Sketch?
3. Shading approach: Hard-edge / Soft / No shading / Anime-style highlight?
4. Color palette: 3–5 dominant colors, overall saturation and brightness level.

→ The inserted object MUST use the EXACT SAME art style:
   - Same linework style and thickness as the scene.
   - Do NOT apply photo-realistic rendering if the scene is flat/cel-shaded.
   - Use the same shading approach and stay within the existing color palette.

Seamlessly blend the pasted object into the background scene while strictly preserving its exact position, size, and rotation as specified below.${placementMetadata}${interactionBlock}

**CRITICAL — Position & Scale:**
- Do NOT move, resize, or rotate the object. The placement metadata above defines the absolute ground truth.
- The object center must remain at the stated pixel coordinates after generation.
- The object must occupy the stated percentage of the canvas — no larger, no smaller.
- If the object is rotated, preserve that exact tilt angle in the final image.

**Lighting & Shadows:**
- Analyze the background scene's dominant light source (direction, color temperature, intensity).
- Apply matching light and shadow to the object so it appears to be lit by the same source.
- Cast a realistic shadow from the object onto the background surface, consistent with the light angle and object distance.

**Depth & Edge Integration:**
- Apply depth-of-field blur to the object if it is in the background area (lower % coverage = farther away).
- Create soft, seamless edges where the object meets the background — no hard cuts or halos.
- Match the object's color temperature and atmospheric haze to the background distance.

**Overall Goal:** Produce a single high-quality image where the object appears completely natural within the scene, at exactly the position and scale the user set.`;

                                const finalPrompt = prompt
                                    ? `User Request: "${prompt}"\n\n${basePrompt}`
                                    : basePrompt;

                                // imagePayload is already the composed guide image from filePayload
                                resultSrcs = await callImageEditModel(imagePayload, finalPrompt, modelName, signal, task.resolution, task.aspectRatio);
                                successMessageKey = 'aiEdit.insertObjectComplete';
                            } else {
                                throw new Error('Unsupported AI action');
                            }
                        }
                    } else {
                        // This is a regular character sheet generation task
                        generationParams = {
                            customPrompt: task.customPrompt,
                            bodyPartReferenceMap: task.bodyPartReferenceMap,
                            selectedClothingItems: task.selectedClothingItems,
                            selectedObjectItems: task.selectedObjectItems,
                            selectedActionPose: task.selectedActionPose,
                            resolution: task.resolution,
                            aspectRatio: task.aspectRatio,
                            cameraView: task.cameraView,
                            synthesisControlMode: task.synthesisControlMode,
                            originalPreservationLevel: task.originalPreservationLevel,
                            costumeCreativityLevel: task.costumeCreativityLevel,
                            lightDirection: task.lightDirection || undefined,
                            lightIntensity: task.lightIntensity || undefined,
                            modelName: task.modelName,
                            gridLayout: task.gridLayout ?? undefined,
                            groundingTools: task.groundingTools?.length ? task.groundingTools : undefined,
                        };

                        // Mask routing: crop original to padded region, send to API without mask,
                        // then composite result back over the original using soft alpha.
                        // This prevents mask artifacts from appearing in AI output.
                        let originalImageForApi: File | null = task.originalImage ?? null;
                        if (task.maskImage && task.originalImage) {
                            blendOriginalFile = task.originalImage;
                            blendOptionsForPost = readBlendOptions(task);
                            try {
                                const prepared = await preparePaddedRegion(task.originalImage, task.maskImage, blendOptionsForPost);
                                if (prepared) {
                                    blendRegion = prepared;
                                    originalImageForApi = prepared.paddedImageFile;
                                    console.info('[blendPipeline] mask routing engaged (general gen)', {
                                        crop: { x: prepared.cropX, y: prepared.cropY, w: prepared.cropW, h: prepared.cropH },
                                        full: { w: prepared.imageW, h: prepared.imageH },
                                    });
                                }
                            } catch (e) {
                                console.warn('[blendPipeline] preparePaddedRegion failed (general gen), falling back to full image:', e);
                            }
                        }

                        // [PERF] Parallelize all base64 conversions to eliminate waterfall
                        // mask64Data intentionally excluded — mask is handled by client-side blend pipeline
                        const [base64Data, textureDataArray, background64Data, poseImage64Data] = await Promise.all([
                            originalImageForApi ? fileToBase64(originalImageForApi) : Promise.resolve(null),
                            Promise.all(task.textureImages.map(async ({ file, referenceType }) => {
                                const fileBase64 = await fileToBase64(file);
                                return { data: fileBase64, mimeType: file.type, referenceType };
                            })),
                            task.backgroundImage
                                ? fileToBase64(task.backgroundImage).then(data => ({ data, mimeType: task.backgroundImage!.type }))
                                : Promise.resolve(null),
                            task.poseControlImage
                                ? fileToBase64(task.poseControlImage).then(data => ({ data, mimeType: task.poseControlImage!.type }))
                                : Promise.resolve(null),
                        ]);

                        if (signal.aborted) throw new Error('error.cancelled');

                        const promptWithGrid = (task.customPrompt || '') + buildGridInstruction(task.gridLayout ?? null);
                        resultSrcs = await processCharacterImage(
                            base64Data ? { data: base64Data, mimeType: originalImageForApi!.type } : null,
                            task.cameraView, [], task.bodyPartReferenceMap,
                            task.selectedClothingItems, task.selectedObjectItems, promptWithGrid, poseImage64Data, textureDataArray, background64Data,
                            task.selectedActionPose, task.useAposeForViews, task.isApplyingFullOutfit, task.isApplyingTop, task.isApplyingBottom,
                            task.backgroundImageAspectRatio, task.modelName || modelName, signal, task.lightDirection, task.lightIntensity, null,
                            task.selectedPalette, task.numPaletteColors,
                            task.isAutoColorizeSketch,
                            task.resolution,
                            task.aspectRatio,
                            // 5단계 의상참조 합성
                            task.synthesisControlMode,
                            task.originalPreservationLevel,
                            task.costumeCreativityLevel,
                            task.costumeBodyType,
                            task.costumeGender,
                            task.thinkingLevel,
                            task.groundingTools,
                            task.isPoseSketch,
                            task.fluxOptions,
                            task.openAIOptions
                        );
                    }

                    // Mask routing post-blend: AI worked on cropped padded region,
                    // composite it back over the full original with soft alpha + tone match.
                    if (blendRegion && blendOriginalFile && resultSrcs.length > 0) {
                        const blended: string[] = [];
                        for (const src of resultSrcs) {
                            try {
                                blended.push(await blendInpaintResult(blendOriginalFile, src, blendRegion, blendOptionsForPost));
                            } catch (e) {
                                console.warn('[blendPipeline] blendInpaintResult failed, using raw AI output for this image:', e);
                                blended.push(src);
                            }
                        }
                        resultSrcs = blended;
                    }

                    // Process generated images with LOD for better 4K performance
                    const newImages: GeneratedMedia[] = await Promise.all(resultSrcs.map(async (src, index) => {
                        const imageId = `${task.id}-${Date.now()}-${index}`;
                        const filename = `generated-${task.id}-${index}`;
                        const fullFilename = `${filename}.png`;

                        try {
                            // Extract base64 data from data URL
                            const base64Match = src.match(/^data:([^;]+);base64,(.+)$/);
                            if (base64Match) {
                                const [, mimeType, base64Data] = base64Match;
                                // Use worker-based LOD processing for better performance
                                const processed = await processGeneratedImage(imageId, base64Data, mimeType, fullFilename);

                                // [DIAGNOSTIC] Log actual dimensions received from Google API
                                console.log(`[Google API] Image received: ${processed.naturalWidth}×${processed.naturalHeight}px | requested resolution: ${task.resolution || 'auto'} | model: ${task.modelName || modelName}`);

                                // [MEMORY OPTIMIZATION] Offload to Disk if Save Directory is set
                                let mainThreadSrc: string;
                                let mainThreadProxySrc: string | undefined;
                                let mainThreadTinySrc: string;
                                let displayFile: File | undefined = processed.file;
                                let displayFilePath: string | undefined;
                                let originalFile: File | undefined = processed.originalFile;
                                let originalFilePath: string | undefined;
                                let tinyFile: File | undefined = processed.tinyFile;
                                let tinyFilePath: string | undefined;
                                let proxyFile: File | undefined = processed.proxyFile;
                                let proxyFilePath: string | undefined;

                                // Check if we can save to disk (Workspace active)
                                // [CHANGED] Use System Temp for Memory Optimization (Forced Offloading)
                                // This keeps RAM usage low without cluttering user folders.
                                if ((window as any).electronAPI?.saveTempFile) {
                                    try {
                                        // 1. Save Original
                                        const originalBase64 = await fileToBase64(processed.originalFile);
                                        const originalSaved = await (window as any).electronAPI.saveTempFile(`${filename}_original.png`, originalBase64);

                                        // 2. Save Display WebP (canvas)
                                        const displayBase64 = await fileToBase64(processed.file);
                                        const displaySaved = await (window as any).electronAPI.saveTempFile(`${filename}.webp`, displayBase64);

                                        // 3. Save Tiny WebP (128px)
                                        const tinyBase64 = await fileToBase64(processed.tinyFile);
                                        const tinySaved = await (window as any).electronAPI.saveTempFile(`${filename}_tiny.webp`, tinyBase64);

                                        // 4. Save Proxy WebP (Optional)
                                        if (processed.proxyFile) {
                                            const proxyBase64 = await fileToBase64(processed.proxyFile);
                                            const proxySaved = await (window as any).electronAPI.saveTempFile(`${filename}_proxy.webp`, proxyBase64);
                                            if (proxySaved.success && proxySaved.filePath) {
                                                proxyFilePath = proxySaved.filePath;
                                                // Create file:// URL (Triple Slash)
                                                mainThreadProxySrc = `file:///${proxyFilePath.replace(/\\/g, '/')}`;
                                                proxyFile = undefined;
                                            }
                                        }

                                        if (originalSaved.success && originalSaved.filePath && displaySaved.success && displaySaved.filePath && tinySaved.success && tinySaved.filePath) {
                                            // SUCCESS: All saved. Switch to Path-based.
                                            originalFilePath = originalSaved.filePath;
                                            displayFilePath = displaySaved.filePath;
                                            tinyFilePath = tinySaved.filePath;

                                            mainThreadSrc = `file:///${displayFilePath.replace(/\\/g, '/')}`;
                                            const standardTinySrc = `file:///${tinyFilePath.replace(/\\/g, '/')}`;
                                            mainThreadTinySrc = standardTinySrc; // Tiny uses file path

                                            if (!mainThreadProxySrc) mainThreadProxySrc = mainThreadSrc;

                                            // [CRITICAL] Release memory blobs immediately since they are on disk
                                            displayFile = undefined;
                                            originalFile = undefined;
                                            tinyFile = undefined;
                                            proxyFile = undefined;

                                            console.log(`[MemoryFix] Offloaded image ${imageId} to TEMP disk.`);
                                        } else {
                                            throw new Error("Failed to save some files to temp");
                                        }
                                    } catch (saveErr) {
                                        console.warn('[MemoryFix] Failed to save to disk, falling back to RAM:', saveErr);
                                        // Fallback to RAM logic below
                                        mainThreadSrc = blobManager.create(processed.file);
                                        mainThreadProxySrc = processed.proxyFile ? blobManager.create(processed.proxyFile) : mainThreadSrc;

                                        mainThreadTinySrc = processed.tinyFile ? blobManager.create(processed.tinyFile) : processed.thumbnailSrc;
                                    }
                                } else {
                                    // NO SAVE DIRECTORY: RAM Mode
                                    mainThreadSrc = blobManager.create(processed.file);

                                    mainThreadProxySrc = processed.proxyFile ? blobManager.create(processed.proxyFile) : mainThreadSrc;

                                    mainThreadTinySrc = processed.tinyFile ? blobManager.create(processed.tinyFile) : processed.thumbnailSrc;
                                }

                                return {
                                    id: imageId,
                                    src: mainThreadSrc,
                                    proxySrc: mainThreadProxySrc,
                                    tinySrc: mainThreadTinySrc,
                                    thumbnailSrc: mainThreadTinySrc, // Use the generated tiny src as thumbnail
                                    type: 'image',
                                    view: task.aiEditAction ? null : task.cameraView,
                                    generationParams,

                                    // Memory Optimization: File will be undefined if saved to disk
                                    originalFile: originalFile,
                                    originalFilePath: originalFilePath,

                                    file: displayFile,
                                    filePath: displayFilePath,

                                    tinyFile: tinyFile,
                                    tinyFilePath: tinyFilePath,

                                    proxyFile: proxyFile,
                                    proxyFilePath: proxyFilePath,

                                    // [FIX] Add preview fields - required by canvas worker for proper 1K display
                                    // Preview mirrors proxy (both are 1K resolution)
                                    previewSrc: mainThreadProxySrc,
                                    previewFile: proxyFile,
                                    previewFilePath: proxyFilePath,

                                    isGenerated: true,
                                    generatedBy: resolveGeneratedBy(task.modelName || modelName),
                                    originalDimensions: { width: processed.naturalWidth, height: processed.naturalHeight },

                                    sourceImageId: task.sourceImageId,
                                    maskSrc: task.maskImage ? blobManager.create(task.maskImage) : undefined,
                                    maskFile: task.maskImage ?? undefined,
                                };
                            }
                        } catch (e) {
                            console.warn('[useImageGeneration] LOD processing failed, using original:', e);
                        }

                        // Fallback: use original without LOD (Also keeps memory blob if failed)
                        const response = await fetch(src);
                        const blob = await response.blob();
                        const file = new File([blob], fullFilename, { type: 'image/png' });
                        return {
                            id: imageId,
                            src: src,
                            type: 'image',
                            view: task.aiEditAction ? null : task.cameraView,
                            generationParams,
                            originalFile: file,
                            file: file,
                            isGenerated: true,
                            generatedBy: getUseGoogleAuth() ? 'vertex' : 'apiKey',
                            sourceImageId: task.sourceImageId,
                            maskSrc: task.maskImage ? blobManager.create(task.maskImage) : undefined,
                            maskFile: task.maskImage ?? undefined,
                        };
                    }));

                    if (newImages.length > 0) {
                        const getCost = MODEL_COSTS[modelName];
                        const costPerImage = getCost ? getCost(task.fluxOptions?.resolutionMP ?? task.resolution, task.openAIOptions?.quality) : COST_PER_IMAGE;
                        const cost = costPerImage * newImages.length;
                        setMonthlyCredit(prev => {
                            const newCreditState = { ...prev, current: Math.max(0, prev.current - cost) };
                            localStorage.setItem(LOCAL_CREDIT_KEY, JSON.stringify(newCreditState));
                            return newCreditState;
                        });
                        if (modelName.startsWith('flux/')) syncFluxCreditsFireAndForget();
                        const newBatch: GenerationBatch = { id: `batch-${Date.now()}`, timestamp: new Date(), media: newImages };
                        setGenerationBatches(prev => [newBatch, ...prev]);

                        const canvasRect = mainPanelRef.current?.getBoundingClientRect();
                        if (canvasRect && useSettingsStore.getState().autoAddToCanvas) {
                            // [CRITICAL] Await canvas update to prevent parallel heavy operations (WSOD fix)
                            await addImagesToCenter(newImages, canvasRect, task.sourceImageId);

                            // [Safety Pause] GPU Breathing Room (150ms)
                            await new Promise(resolve => setTimeout(resolve, 150));
                        }
                        setCurrentPage(1);

                        // Log generation timing
                        const generationEndTime = performance.now();
                        const durationSeconds = ((generationEndTime - generationStartTime) / 1000).toFixed(1);
                        console.log(`[Generation Timing] Completed! Duration: ${durationSeconds}s, Model: ${task.modelName || modelName}`);

                        // [VRAM GUARD] Record this generation for cooldown tracking
                        vramGuard.recordGeneration(task.resolution);

                        onNotification(t(successMessageKey, language, { count: newImages.length }), 'success');

                        // Auto-download if enabled - uses left panel's save directory
                        const { autoDownloadEnabled, autoDownloadPath } = useSettingsStore.getState();
                        // Priority: left panel's saveDirectoryPath > settings' autoDownloadPath
                        const effectiveSavePath = saveDirectoryPath || autoDownloadPath;

                        if (autoDownloadEnabled && effectiveSavePath) {
                            for (const media of newImages) {
                                try {
                                    const fileName = `BanaNyang_${Date.now()}_${media.id.slice(-6)}.png`;

                                    // 1. Try Memory-based Save (if file blob exists)
                                    if (media.originalFile && (window as any).electronAPI?.saveFileToDirectory) {
                                        // Convert file to base64 data URL for IPC transfer
                                        const reader = new FileReader();
                                        const base64Data = await new Promise<string>((resolve, reject) => {
                                            reader.onloadend = () => resolve(reader.result as string);
                                            reader.onerror = reject;
                                            reader.readAsDataURL(media.originalFile!);
                                        });
                                        await (window as any).electronAPI.saveFileToDirectory(effectiveSavePath, fileName, base64Data);
                                    }
                                    // 2. Try Disk-to-Disk Copy (Memory Optimization Friendly)
                                    else if (media.originalFilePath && (window as any).electronAPI?.copyFile) {
                                        // Simple path join for Windows (assuming Windows env based on user context)
                                        // If cross-platform needed, we'd need path separator logic or let main process handle join.
                                        // Since we know effectiveSavePath is a dir, and we have fileName.
                                        const sep = effectiveSavePath.includes('\\') ? '\\' : '/';
                                        const destPath = `${effectiveSavePath}${sep}${fileName}`;

                                        await (window as any).electronAPI.copyFile(media.originalFilePath, destPath);
                                        console.log('[Auto-Download] Saved via Copy:', destPath);
                                    }
                                } catch (downloadErr) {
                                    console.error('[Auto-Download] Failed to save image:', downloadErr);
                                }
                            }
                        }
                    }
                }
                setGenerationQueue(prev => prev.slice(1));
            } catch (err: any) {
                const errorKey = err instanceof Error ? err.message : 'error.unknown';
                if (errorKey === 'error.apiKeyInvalid') setShowUsagePlanModal(true);
                if (errorKey === 'error.quotaExceeded') {
                    if (!userAcknowledgedPaidUsage) {
                        setShowQuotaModal(true);
                        setIsProcessing(false);
                        setProgress(null);
                        return;
                    }
                    // acknowledged 상태: rateLimited와 동일하게 pause 처리 (큐에서 제거 안 함)
                    setIsPaused(true);
                    if (autoResumeOnRateLimitRef.current) {
                        const RETRY_DELAY_MS = 60_000;
                        onNotification(t('error.rateLimitedAutoResume' as TranslationKey, language), 'warning');
                        autoResumeTimerRef.current = setTimeout(() => {
                            autoResumeTimerRef.current = null;
                            setIsPaused(false);
                        }, RETRY_DELAY_MS);
                    } else {
                        onNotification(t('error.rateLimited' as TranslationKey, language), 'error');
                    }
                    return;
                }
                if (errorKey === 'error.rateLimited') {
                    setIsPaused(true);
                    // 큐에서 제거하지 않음 — 재개 시 현재 작업 재시도
                    if (autoResumeOnRateLimitRef.current) {
                        const RETRY_DELAY_MS = 60_000;
                        onNotification(t('error.rateLimitedAutoResume' as TranslationKey, language), 'warning');
                        autoResumeTimerRef.current = setTimeout(() => {
                            autoResumeTimerRef.current = null;
                            setIsPaused(false);
                        }, RETRY_DELAY_MS);
                    } else {
                        onNotification(t(errorKey as TranslationKey, language), 'error');
                    }
                    return;
                }
                const errorMessage = t(errorKey as TranslationKey, language);
                if (errorKey !== 'error.cancelled') onNotification(errorMessage, 'error');
                if (modelName.startsWith('flux/')) syncFluxCreditsFireAndForget();
                setGenerationQueue(prev => prev.slice(1));
            } finally {
                isProcessingRef.current = false;
                setIsProcessing(false);
                setProgress(null);
                resetPaintingParams();
            }
        };

        processNextInQueue();
    }, [generationQueue, isProcessing, isPaused, userAcknowledgedPaidUsage, monthlyCredit, language, modelName, addImagesToCenter, mainPanelRef, setMonthlyCredit, setGenerationBatches, setCurrentPage, onNotification, setShowQuotaModal, setShowUsagePlanModal, resetPaintingParams]);

    return {
        generationQueue,
        isProcessing,
        isPaused,
        progress,
        queueGeneration,
        cancelAll,
        cancelSingleTask,
        pauseGeneration,
        resumeGeneration,
        reorderGenerationQueue,
    };
};
