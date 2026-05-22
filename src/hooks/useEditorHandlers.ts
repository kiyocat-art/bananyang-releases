import { useState, useRef, useCallback } from 'react';
import type { BoardImage, GenerationTask, GeneratedMedia, Resolution, AspectRatio, ModelName } from '../types';
import type { EditResult } from '../features/canvas/components/UnifiedEditorModal';
import { t } from '../localization';
import type { TranslationKey } from '../localization';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { useCanvasStore } from '../store/canvasStore';
import { blobManager } from '../utils/blobManager';
import { generateThumbnailFromDataURL, dataURLtoFile } from '../utils/imageUtils';
import { useGenerationStore } from '../store/generationStore';

interface UseEditorHandlersParams {
    mainPanelRef: React.RefObject<HTMLElement | null>;
    customPrompt: string;
    modelName: ModelName;
    queueGeneration: (task: GenerationTask) => void;
    handleLoadWorkspace: (content?: string, filePath?: string, skipDirtyCheck?: boolean) => Promise<void>;
}

export function useEditorHandlers({
    mainPanelRef,
    customPrompt,
    modelName,
    queueGeneration,
    handleLoadWorkspace,
}: UseEditorHandlersParams) {
    const showNotification = useUIStore(state => state.showNotification);
    const setIsEditorOpen = useUIStore(state => state.setIsEditorOpen);
    const language = useSettingsStore(state => state.language);

    // ── State ─────────────────────────────────────────────────────────────────
    const [zoomedImageId, setZoomedImageId] = useState<string | null>(null);
    const [zoomedImageSrc, setZoomedImageSrc] = useState<string | null>(null);
    const [unifiedEditingImage, setUnifiedEditingImage] = useState<BoardImage | null>(null);
    const editorSessionRef = useRef(0);

    // ── handleStartUnifiedEdit ────────────────────────────────────────────────
    const handleStartUnifiedEdit = useCallback((imageOrId: string | BoardImage) => {
        const boardImages = useCanvasStore.getState().boardImages;
        const imageToEdit = typeof imageOrId === 'string'
            ? boardImages.find(img => img.id === imageOrId)
            : imageOrId;
        if (imageToEdit) {
            const isCurrentlyOpen = useUIStore.getState().isEditorOpen;
            if (!isCurrentlyOpen) {
                editorSessionRef.current += 1;
            }
            setUnifiedEditingImage(imageToEdit);
            setIsEditorOpen(true);
        }
    }, [setIsEditorOpen]);

    // ── handleUnifiedEditComplete ─────────────────────────────────────────────
    const handleUnifiedEditComplete = async (result: EditResult) => {
        if (!unifiedEditingImage) return;

        if (result.type === 'generateAiEdit') {
            const taskToQueue: GenerationTask = {
                id: `task-ai-edit-${Date.now()}`,
                taskType: 'image',
                originalImage: result.filePayload || unifiedEditingImage.file,
                sourceImageId: unifiedEditingImage.id,
                sourceImageDisplaySize: result.displaySize,
                aiEditAction: result.action,
                variationCreativity: result.params.variationCreativity,
                autoColoringIntensity: result.params.autoColoringIntensity,
                objectToInsert: (result.params.objectState || result.params.objectPrompt) ? {
                    file: result.params.objectState?.file,
                    transform: result.params.objectState?.transform || { x: 0, y: 0, width: 0, height: 0, rotation: 0 },
                    prompt: result.params.objectPrompt || '',
                } : undefined,
                pbrStructureImage: result.params.pbrStructureImage || null,
                pbrFrontImage: result.params.pbrFrontImage || null,
                pbrBackImage: result.params.pbrBackImage || null,
                pbrMapTypes: result.params.pbrMapTypes || [],
                customPrompt: result.customPrompt || customPrompt,
                textureImages: [],
                backgroundImage: null,
                backgroundImageAspectRatio: null,
                poseControlImage: null,
                cameraView: null,
                bodyPartReferenceMap: {},
                selectedClothingItems: [],
                selectedObjectItems: [],
                selectedActionPose: null,
                useAposeForViews: false,
                isApplyingFullOutfit: false,
                isApplyingTop: false,
                isApplyingBottom: false,
                lightDirection: null,
                lightIntensity: null,
                maskImage: (result as any).maskImage || null,
                referenceImages: (result as any).referenceImages || [],
                selectedPalette: null,
                numPaletteColors: 4,
                isAutoColorizeSketch: false,
                resolution: result.resolution as Resolution,
                aspectRatio: result.aspectRatio as AspectRatio,
                modelName: result.modelName || modelName,
            };
            queueGeneration(taskToQueue);
        } else if (result.type === 'newImage') {
            const MAX_DIM = 512;
            let displayWidth = result.width, displayHeight = result.height;
            if (displayWidth > MAX_DIM || displayHeight > MAX_DIM) {
                if (displayWidth > displayHeight) {
                    displayHeight = (displayHeight / displayWidth) * MAX_DIM;
                    displayWidth = MAX_DIM;
                } else {
                    displayWidth = (displayWidth / displayHeight) * MAX_DIM;
                    displayHeight = MAX_DIM;
                }
            }

            const zIndex = useCanvasStore.getState().zIndexCounter + 1;
            const newImageId = crypto.randomUUID();

            const newImage: BoardImage = {
                id: newImageId,
                src: result.dataUrl,
                file: unifiedEditingImage.file,
                x: unifiedEditingImage.x + unifiedEditingImage.width + 20,
                y: unifiedEditingImage.y,
                width: displayWidth,
                height: displayHeight,
                role: 'none',
                zIndex: zIndex,
                thumbnailSrc: result.dataUrl,
            };

            useCanvasStore.getState().groupEditedImage(unifiedEditingImage.id, newImage);

            const originalFileName = unifiedEditingImage.file.name;
            (async () => {
                try {
                    const [newFile, thumbnailSrc] = await Promise.all([
                        dataURLtoFile(result.dataUrl, `edited-${originalFileName}`),
                        generateThumbnailFromDataURL(result.dataUrl)
                    ]);
                    useCanvasStore.getState().updateImageWithHistory(newImageId, { file: newFile, thumbnailSrc });
                } catch (err) {
                    console.error('Failed to generate thumbnail/file in background:', err);
                }
            })();
        } else if (result.type === 'update') {
            let updates: Partial<BoardImage> = { ...result.updates };
            if (result.updates.maskFile) {
                const oldImage = useCanvasStore.getState().boardImages.find(img => img.id === unifiedEditingImage.id);
                if (oldImage?.maskSrc) blobManager.release(oldImage.maskSrc);
                updates.maskSrc = URL.createObjectURL(result.updates.maskFile);
            }
            useCanvasStore.getState().updateImageWithHistory(unifiedEditingImage.id, updates);
        }

        if (result.type !== 'generateAiEdit') {
            setUnifiedEditingImage(null);
            setIsEditorOpen(false);
        }
    };

    // ── handleZoomToImage ─────────────────────────────────────────────────────
    const handleZoomToImage = useCallback((image: BoardImage) => {
        if (mainPanelRef.current) {
            useCanvasStore.getState().zoomToImage(image, mainPanelRef.current.getBoundingClientRect());
        }
    }, [mainPanelRef]);

    // ── handleZoomImage ───────────────────────────────────────────────────────
    const handleZoomImage = useCallback((media: GeneratedMedia | File | string | null) => {
        if (!media) return;
        if (typeof media === 'object' && 'id' in media && 'type' in media) {
            setZoomedImageId(media.id);
            setZoomedImageSrc(media.src);
        } else {
            const src = media instanceof File ? URL.createObjectURL(media) : media as string;
            setZoomedImageId(null);
            setZoomedImageSrc(src);
        }
    }, []);

    // ── handleCloseViewer ─────────────────────────────────────────────────────
    const handleCloseViewer = useCallback(() => {
        setZoomedImageId(null);
        setZoomedImageSrc(prev => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
            return null;
        });
    }, []);

    // ── handleUploadAndPositionImages ─────────────────────────────────────────
    const handleUploadAndPositionImages = useCallback(async (files: File[] | FileList, position?: { x: number; y: number }) => {
        if (!mainPanelRef.current) return;
        const containerRect = mainPanelRef.current.getBoundingClientRect();
        const dropPos = position || { x: containerRect.left + containerRect.width / 2, y: containerRect.top + containerRect.height / 2 };
        await useCanvasStore.getState().uploadImages(Array.from(files), dropPos, containerRect);
    }, [mainPanelRef]);

    // ── handleRecoverSession ──────────────────────────────────────────────────
    const handleRecoverSession = useCallback(async (sessionId: string) => {
        try {
            const result = await window.electronAPI.recoverSession(sessionId);
            if (!result.success) {
                showNotification(result.error || 'Recovery failed', 'error');
                return;
            }
            if (result.workspaceBase64) {
                const { readWorkspacePayload } = await import('../utils/workspaceContainer');
                const bin = atob(result.workspaceBase64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const { json } = readWorkspacePayload(bytes);
                await handleLoadWorkspace(json, undefined, true);
            } else if (result.workspaceContent) {
                await handleLoadWorkspace(result.workspaceContent, undefined, true);
            } else if (result.images && result.images.length > 0) {
                const files: File[] = [];
                for (const img of result.images) {
                    try {
                        const response = await fetch(img.url);
                        const blob = await response.blob();
                        const ext = img.filename.split('.').pop()?.toLowerCase() || 'png';
                        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                            : ext === 'webp' ? 'image/webp' : 'image/png';
                        const file = new File([blob], img.filename, { type: mimeType });
                        files.push(file);
                    } catch (e) {
                        console.warn(`[SessionRecovery] Failed to load image: ${img.filename}`, e);
                    }
                }
                if (files.length > 0) {
                    await handleUploadAndPositionImages(files);
                    showNotification(
                        t('sessionRecovery.imagesRecovered' as TranslationKey, language, { count: files.length }),
                        'success'
                    );
                }
            }
            await window.electronAPI.deleteSession(sessionId);
        } catch (error) {
            console.error('[SessionRecovery] Recovery failed:', error);
            showNotification(
                t('sessionRecovery.recoveryFailed' as TranslationKey, language),
                'error'
            );
        }
    }, [language, showNotification, handleLoadWorkspace, handleUploadAndPositionImages]);

    return {
        zoomedImageId, setZoomedImageId,
        zoomedImageSrc, setZoomedImageSrc,
        unifiedEditingImage, setUnifiedEditingImage,
        editorSessionRef,
        handleStartUnifiedEdit,
        handleUnifiedEditComplete,
        handleZoomToImage,
        handleZoomImage,
        handleCloseViewer,
        handleUploadAndPositionImages,
        handleRecoverSession,
    };
}
