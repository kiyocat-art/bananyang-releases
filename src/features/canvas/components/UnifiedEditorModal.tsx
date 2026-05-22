

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Z_INDEX } from '../../../constants/zIndex';
import { BoardImage, AiAction, LightSource, LightType, ModelName } from '../../../types';
import { t, Language, TranslationKey } from '../../../localization';
import { isShortcut } from '../../../hooks/useShortcuts';
import { Tooltip } from '../../../components/Tooltip';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ScissorsIcon, PaintBrushIcon, UndoIcon, RedoIcon, TrashIcon, ResetIcon, PhotoIcon, UploadIcon, HandIcon, LightIcon, PlusIcon } from '../../../components/icons';
import { TransformableObject, ObjectTransform } from './TransformableObject';
import { RelightingProperties } from './editor/RelightingProperties';
import { RelightingOverlay } from './editor/RelightingOverlay';
import { useGenerationStore } from '../../../store/generationStore';
import { useUIStore } from '../../../store/uiStore';
import { useCanvasStore } from '../../../store/canvasStore';
import { blobManager } from '../../../utils/blobManager';
import { EditorHeader } from './editor/ui/EditorHeader';
import { EditorSidebar } from './editor/ui/EditorSidebar';
import { CropTab } from './editor/tabs/CropTab';
import { ObjectTab } from './editor/tabs/ObjectTab';
import { RelightTab } from './editor/tabs/RelightTab';


import { ObjectState, ObjectMemo, ObjectMode } from './editor/types';
import { CropOverlay } from './editor/overlays/CropOverlay';
import { ObjectOverlay } from './editor/overlays/ObjectOverlay';
import { ObjectContextMenu } from './editor/overlays/ObjectContextMenu';
import { ModalResizeHandles } from './editor/overlays/ModalResizeHandles';
import { useObjectEditor } from './editor/hooks/useObjectEditor';

function buildRelightPrompt(lightSources: LightSource[], extraPrompt: string): string {
    const typeMap: Record<LightType, string> = {
        omni:      'omnidirectional point light',
        direct:    'directional spotlight',
        sun:       'parallel sunlight',
        ambient:   'ambient environment light',
        rim:       'rim backlight',
        area:      'area softbox light',
        gobo:      'gobo patterned shadow light (venetian blind / leaf shadow pattern)',
        practical: 'practical in-scene light source (lamp, neon sign, window)',
    };

    const lightDescriptions = lightSources.map((l, i) => {
        const parts: string[] = [typeMap[l.type]];

        if (l.type !== 'ambient') {
            const px = l.position.x < 0.33 ? 'left' : l.position.x > 0.66 ? 'right' : 'center';
            const py = l.position.y < 0.33 ? 'top'  : l.position.y > 0.66 ? 'bottom' : 'middle';
            parts.push(`from ${py}-${px}`);
        }

        if (l.direction !== undefined && (l.type === 'direct' || l.type === 'sun')) {
            const dirs = ['top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left'];
            parts.push(`pointing ${dirs[Math.round(l.direction / 45) % 8]}`);
        }

        const iDesc = l.intensity > 80 ? 'intense' : l.intensity > 50 ? 'moderate' : 'subtle';
        parts.push(`${iDesc} (${l.intensity}%)`);
        parts.push(`color ${l.color}`);

        const ct = l.colorTemperature ?? 0;
        if (ct > 20)  parts.push(`warm tone (+${ct}%)`);
        else if (ct < -20) parts.push(`cool tone (${ct}%)`);

        const r = l.radius ?? 50;
        if (r > 70) parts.push('wide soft spread');
        else if (r < 30) parts.push('tight focused beam');

        const si = l.specularIntensity ?? 30;
        if (si > 60) parts.push('strong specular highlights');
        else if (si < 15) parts.push('matte surface');

        const ss = l.shadowSoftness ?? 50;
        if (ss < 25) parts.push('hard sharp shadows');
        else if (ss > 75) parts.push('very soft shadows');

        if (l.affectedArea === 'foreground') parts.push('foreground only');
        else if (l.affectedArea === 'background') parts.push('background only');

        const fxMap: Record<string, string> = {
            volumetric: 'with volumetric rays',
            god_rays:   'with god rays',
            haze:       'with atmospheric haze',
        };
        if (l.atmosphericEffect && l.atmosphericEffect !== 'none') {
            parts.push(fxMap[l.atmosphericEffect]);
        }

        return `Light ${i + 1}: ${parts.join(', ')}`;
    }).join('. ');

    const moodParts: string[] = [];
    if (lightSources.some(l => (l.colorTemperature ?? 0) > 30))  moodParts.push('warm cinematic atmosphere');
    if (lightSources.some(l => (l.colorTemperature ?? 0) < -30)) moodParts.push('cool moody ambiance');
    if (lightSources.some(l => l.type === 'rim'))                 moodParts.push('dramatic subject edge definition');
    if (lightSources.some(l => l.atmosphericEffect && l.atmosphericEffect !== 'none')) moodParts.push('atmospheric lighting effect');
    const avgIntensity = lightSources.reduce((s, l) => s + l.intensity, 0) / (lightSources.length || 1);
    if (avgIntensity > 75) moodParts.push('high-contrast dramatic');
    else if (avgIntensity < 30) moodParts.push('low-key subtle');

    const mood = moodParts.length > 0 ? ` Overall mood: ${moodParts.join(', ')}.` : '';
    let prompt = `Professional relighting: ${lightDescriptions}.${mood} Preserve original composition, subject details, and colors. Apply realistic light physics with proper falloff, shadow casting, and specular highlights on surfaces.`;
    if (extraPrompt.trim()) prompt += ` Additional: ${extraPrompt.trim()}`;
    return prompt;
}

export type EditResult =
    | { type: 'newImage', dataUrl: string, width: number, height: number }
    | { type: 'update', updates: Partial<BoardImage> }
    | { type: 'generateAiEdit', action: AiAction, params: { variationCreativity?: number; autoColoringIntensity?: number; objectState?: { file: File, transform: ObjectTransform }, objectPrompt?: string; mapType?: string; prompt?: string }, displaySize: { width: number, height: number }, filePayload?: File, customPrompt?: string, modelName?: ModelName, resolution?: string, aspectRatio?: string };

interface UnifiedEditorModalProps {
    image: BoardImage;
    onComplete: (result: EditResult) => void;
    onCancel: () => void;
    language: Language;
    onNotification: (message: string, type: 'success' | 'error') => void;
    modelName: ModelName;
}

type EditTool = 'crop' | 'object' | 'relight' | 'inpaint';

export const UnifiedEditorModal: React.FC<UnifiedEditorModalProps> = ({
    image, onComplete, onCancel, language, onNotification, modelName
}) => {
    // Modal positioning    // Initialize Modal State
    const [modalState, setModalState] = useState({
        x: window.innerWidth / 2 - 700, // width 1400
        y: window.innerHeight / 2 - 500, // height 1000
        width: 1400,
        height: 1000
    });
    const [isDraggingModal, setIsDraggingModal] = useState(false);
    const [isResizingModal, setIsResizingModal] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Resize handlers
    const handleResizeStart = (e: React.MouseEvent, direction: 'sw' | 'se') => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingModal(direction);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingModal) {
                const deltaX = e.clientX - dragStart.x;
                const deltaY = e.clientY - dragStart.y;

                setModalState(prev => {
                    let newWidth = prev.width;
                    let newHeight = prev.height;
                    let newX = prev.x;

                    if (isResizingModal === 'se') {
                        newWidth = Math.max(600, prev.width + deltaX);
                        newHeight = Math.max(500, prev.height + deltaY);
                    } else if (isResizingModal === 'sw') {
                        const proposedWidth = prev.width - deltaX;
                        if (proposedWidth >= 600) {
                            newWidth = proposedWidth;
                            newX = prev.x + deltaX;
                        }
                        newHeight = Math.max(500, prev.height + deltaY);
                    }

                    return { ...prev, width: newWidth, height: newHeight, x: newX };
                });
                setDragStart({ x: e.clientX, y: e.clientY });
            }
        };

        const handleMouseUp = () => {
            setIsResizingModal(null);
        };

        if (isResizingModal) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingModal, dragStart]);

    const { setActiveKeyboardContext, isObjectInsertMode, setObjectInsertMode, insertTargetImage, setInsertTargetImage, clearObjectEditorImages } = useCanvasStore();

    useEffect(() => {
        setActiveKeyboardContext('editor');
        const handleFocus = () => setActiveKeyboardContext('editor');
        const container = document.querySelector('.unified-editor-container');
        if (container) {
            container.addEventListener('click', handleFocus);
        }
        return () => {
            setActiveKeyboardContext('canvas');
            clearObjectEditorImages();   // Clear object thumbnails on editor close
            if (container) container.removeEventListener('click', handleFocus);
        };
    }, []);

    // [FIX] Create a local blob URL for the modal instead of using the shared canvas blob URL
    // This prevents the canvas image from being revoked when the modal closes
    const [localImageSrc, setLocalImageSrc] = useState<string | null>(null);

    useEffect(() => {
        let urlToRevoke: string | null = null;
        let mounted = true;

        const loadHighResImage = async () => {
            // [RESOLUTION FIX] Robust source selection prioritizing high-res
            // Order:
            // 1. originalFile (Memory)
            // 2. file (Memory)
            // 3. originalSrc (URL - might be local file path or blob)
            // 4. highResSrc (URL)
            // 5. previewSrc (1K URL)
            // 6. filePath / originalFilePath (Disk)
            // 7. src (Fallback)

            // 1. Files in Memory (Fastest, Best Quality)
            if (image.originalFile) {
                const url = blobManager.create(image.originalFile);
                if (mounted) {
                    setLocalImageSrc(url);
                    urlToRevoke = url;
                }
                return;
            }
            if (image.file) {
                const url = blobManager.create(image.file);
                if (mounted) {
                    setLocalImageSrc(url);
                    urlToRevoke = url;
                }
                return;
            }

            // 2. High-Res URLs (Blob URLs or Remote/Local Paths)
            // We verify they are not the tiny placeholder
            const isTiny = (url?: string) => url?.includes('tiny') || url?.includes('thumbnail');

            const potentialUrls = [
                image.originalSrc,
                image.highResSrc,
                image.previewSrc,
                image.filePath ? `file:///${image.filePath.replace(/\\/g, '/')}` : null, // Handle local paths
                image.originalFilePath ? `file:///${image.originalFilePath.replace(/\\/g, '/')}` : null
            ].filter((url): url is string => !!url && !isTiny(url));

            // Try the first valid high-res URL
            if (potentialUrls.length > 0) {
                // For local file paths or special URLs, we might use them directly
                // checking if it's a file protocol or blob
                const bestUrl = potentialUrls[0];
                if (mounted) {
                    setLocalImageSrc(bestUrl);
                    // If it's a blob url from our system, we might need to add ref, but usually
                    // originalSrc provided by store is already persistent or managed.
                }
                return;
            }

            // 3. Fallback: src (might be tiny if progressive load hasn't finished)
            if (image.src) {
                if (mounted) setLocalImageSrc(image.src);
            }
        };

        loadHighResImage();

        return () => {
            mounted = false;
            if (urlToRevoke) {
                blobManager.release(urlToRevoke);
            }
        };
    }, [image]);

    const [activeTool, setActiveTool] = useState<EditTool>('crop');





    // Inpaint reference image state (use canvasStore for canvas integration)


    // Viewport state (Hoisted for hooks)
    const [imageSize, setImageSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isSpacebarPressed, setIsSpacebarPressed] = useState(false);
    const [isZKeyDown, setIsZKeyDown] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [isCursorVisible, setIsCursorVisible] = useState(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    // Crop state


    const [editBox, setEditBox] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [cropPrompt, setCropPrompt] = useState('');



    const objectEditor = useObjectEditor({
        image,
        activeTool,
        imageSize,
        onNotification,
        t: (k, ...args) => t(k as any, language, ...args)
    });

    const {
        objectStates, setObjectStates,
        selectedObjectId, setSelectedObjectId,
        objectMode, setObjectMode,
        objectContextMenu, setObjectContextMenu,
        objectMemos, setObjectMemos,
        selectedObjectMemoId, setSelectedObjectMemoId,
        objectPrompt, setObjectPrompt,
        objectDrawCanvasRef,
        objectDrawCtx, setObjectDrawCtx,
        isDrawingOnObject, setIsDrawingOnObject,
        objectDrawTool, setObjectDrawTool,
        objectDrawBrushSize, setObjectDrawBrushSize,
        objectEraseBrushSize, setObjectEraseBrushSize,
        objectBrushColor, setObjectBrushColor,
        objectDrawHistory,
        objectDrawHistoryIndex,
        handleCopyObject,
        handlePasteObject,
        saveObjectHistory,
        undoObjectOperation,
        redoObjectOperation,
        removeObject,
        flipObject,
        handleObjectDrawUndo,
        handleObjectDrawRedo,
        objectFileInputRef,
        handleObjectUploadChange,
        handleObjectFile,
        updateObjectMemo,
        deleteObjectMemo,
        saveObjectDrawState, // needed for finishDrawingOnObject?
        clearObjectDraw,
        startDrawingOnObject,
        drawOnObject,
        finishDrawingOnObject,
        objectHistory,
        objectHistoryIndex,
        resetObjectHistory,
        resetObjectEditor
    } = objectEditor;

    // UI-only states not in hook
    const [isDraggingObjectFile, setIsDraggingObjectFile] = useState(false);
    const [isDraggingObjectMemo, setIsDraggingObjectMemo] = useState(false);
    const [objectMemoDragOffset, setObjectMemoDragOffset] = useState({ x: 0, y: 0 });



    // Editor Shortcuts Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (selectedObjectId) removeObject(selectedObjectId);
            }
            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                handleCopyObject();
            }
            // Paste (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                handlePasteObject();
            }
            // Undo/Redo는 아래 별도 핸들러(isShortcut 사용)에서 처리 — 여기서 처리 시 더블 실행 발생
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [activeTool, selectedObjectId, removeObject, handleCopyObject, handlePasteObject]);



    // Viewport state


    const interactionRef = useRef<{
        type: 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'pan' | 'scrubbyZoom';
        startX: number; startY: number;
        startEditBox?: typeof editBox;
        startPan?: typeof pan;
        startZoom?: number;
        pivotWorld?: { x: number; y: number };
        startScreenX?: number;
        startScreenY?: number;
    } | null>(null);



    const currentObjectDrawBrushSize = useMemo(() => (objectDrawTool === 'draw' ? objectDrawBrushSize : objectEraseBrushSize), [objectDrawTool, objectDrawBrushSize, objectEraseBrushSize]);
    const setCurrentObjectDrawBrushSize = useCallback((value: React.SetStateAction<number>) => {
        if (objectDrawTool === 'draw') setObjectDrawBrushSize(value);
        else setObjectEraseBrushSize(value);
    }, [objectDrawTool]);

    useEffect(() => {
        if (activeTool !== 'object') {
            if (isObjectInsertMode) setObjectInsertMode(false);
            setInsertTargetImage(null);
            resetObjectHistory();
        }
    }, [activeTool, isObjectInsertMode, setObjectInsertMode, setInsertTargetImage, resetObjectHistory]);

    // Cleanup on unmount - Release Object URLs to prevent memory leaks
    // [FIX] Use ref to track objectStates for cleanup only on unmount
    const objectStatesRef = useRef(objectStates);
    useEffect(() => {
        objectStatesRef.current = objectStates;
    }, [objectStates]);

    // Cleanup on unmount - Release Object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            setObjectInsertMode(false);
            useCanvasStore.getState().setInsertTargetImage(null);

            // [VRAM CLEANUP] Release blob URLs using BlobManager (RefCount dec)
            // Only release on unmount, not on every state change!
            objectStatesRef.current.forEach(obj => {
                if (obj.src && obj.src.startsWith('blob:')) {
                    blobManager.release(obj.src);
                }
            });
        };
    }, []);

    // Relighting State
    const [lightSources, setLightSources] = useState<LightSource[]>([]);
    const [selectedLightId, setSelectedLightId] = useState<string | null>(null);

    const handleAddLight = useCallback(() => {
        const newLight: LightSource = {
            id: crypto.randomUUID(),
            type: 'omni',
            color: '#ffffff',
            intensity: 50,
            position: { x: 0.5, y: 0.5 },
            direction: 0
        };
        setLightSources(prev => [...prev, newLight]);
        setSelectedLightId(newLight.id);
    }, []);

    const handleUpdateLight = useCallback((id: string, updates: Partial<LightSource>) => {
        setLightSources(prev => prev.map(light =>
            light.id === id ? { ...light, ...updates } : light
        ));
    }, []);

    const handleDeleteLight = useCallback((id: string) => {
        setLightSources(prev => prev.filter(light => light.id !== id));
        if (selectedLightId === id) {
            setSelectedLightId(null);
        }
    }, [selectedLightId]);

    const handlePasteLights = useCallback((lights: LightSource[]) => {
        const newLights = lights.map(light => ({
            ...light,
            id: crypto.randomUUID()
        }));
        setLightSources(prev => [...prev, ...newLights]);
        if (newLights.length > 0) {
            setSelectedLightId(newLights[newLights.length - 1].id);
        }
    }, []);

    useEffect(() => {
        if (activeTool === 'relight' && lightSources.length === 0) {
            // Add default light ONLY if switching to relight tool AND it's empty
            const newLight: LightSource = {
                id: crypto.randomUUID(),
                type: 'omni',
                position: { x: 0.5, y: 0.5 },
                color: '#ffffff',
                intensity: 100,
                direction: 0
            };
            setLightSources([newLight]);
            setSelectedLightId(newLight.id);
        }
    }, [activeTool, lightSources.length]);


    useEffect(() => {
        if (activeTool === 'object' && objectDrawCanvasRef.current) {
            const canvas = objectDrawCanvasRef.current;
            const context = canvas.getContext('2d', { willReadFrequently: true });

            if (context) {
                context.lineCap = 'round';
                context.lineJoin = 'round';
                setObjectDrawCtx(context);

                // Restore from history if available
                if (objectDrawHistory.length > 0 && objectDrawHistoryIndex >= 0) {
                    const img = new Image();
                    img.onload = () => {
                        context.clearRect(0, 0, canvas.width, canvas.height);
                        context.drawImage(img, 0, 0);
                    };
                    img.src = objectDrawHistory[objectDrawHistoryIndex];
                }
            }
        }
    }, [activeTool, objectDrawHistory, objectDrawHistoryIndex, setObjectDrawCtx]);



    useEffect(() => {
        // [FIX] Use file objects to create fresh blob URLs instead of potentially stale src URLs
        // This prevents ERR_FILE_NOT_FOUND when blob URLs have been revoked
        const sourceFile = image.originalFile || image.file;
        if (!sourceFile) {
            // Fallback to src if no file available (shouldn't happen in normal flow)
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const container = viewportRef.current;
                if (!container) return;
                const containerRect = container.getBoundingClientRect();
                const imageAspectRatio = img.naturalWidth / img.naturalHeight;
                const containerAspectRatio = containerRect.width / containerRect.height;

                let width, height;
                if (imageAspectRatio > containerAspectRatio) {
                    width = containerRect.width;
                    height = width / imageAspectRatio;
                } else {
                    height = containerRect.height;
                    width = height * imageAspectRatio;
                }

                setImageSize({ width, height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
                setEditBox({ x: 0, y: 0, width: width, height: height });
                setZoom(1); setPan({ x: (containerRect.width - width) / 2, y: (containerRect.height - height) / 2 });
            };
            img.src = image.originalSrc || image.src;
            return;
        }

        // Create a fresh blob URL from the file object (never stale)
        const freshUrl = URL.createObjectURL(sourceFile);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const container = viewportRef.current;
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const imageAspectRatio = img.naturalWidth / img.naturalHeight;
            const containerAspectRatio = containerRect.width / containerRect.height;

            let width, height;
            if (imageAspectRatio > containerAspectRatio) {
                width = containerRect.width;
                height = width / imageAspectRatio;
            } else {
                height = containerRect.height;
                width = height * imageAspectRatio;
            }

            setImageSize({ width, height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
            setEditBox({ x: 0, y: 0, width: width, height: height });
            setZoom(1); setPan({ x: (containerRect.width - width) / 2, y: (containerRect.height - height) / 2 });

            // Revoke after loading since we only need dimensions
            URL.revokeObjectURL(freshUrl);
        };
        img.onerror = () => {
            URL.revokeObjectURL(freshUrl);
        };
        img.src = freshUrl;
    }, [image.file, image.originalFile, image.src, image.originalSrc]);



    const [lightingPrompt, setLightingPrompt] = useState('');




    // Object Memo Handlers
    const handleObjectCanvasContextMenu = (e: React.MouseEvent) => {
        if (activeTool !== 'object') return;
        e.preventDefault();
        const canvas = objectDrawCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * imageSize.width;
        const y = ((e.clientY - rect.top) / rect.height) * imageSize.height;
        const newMemo: ObjectMemo = { id: crypto.randomUUID(), text: '', x, y, fontSize: 14, color: '#FFFF00' };
        setObjectMemos([...objectMemos, newMemo]);
        setSelectedObjectMemoId(newMemo.id);
    };
    const handleObjectMemoMouseDown = (e: React.MouseEvent, id: string) => {
        if (isSpacebarPressed || isZKeyDown || e.button === 1 || e.button === 2) {
            return; // Let bubble to viewport
        }
        if (e.button !== 0) return;

        e.stopPropagation();
        setSelectedObjectMemoId(id);
        setIsDraggingObjectMemo(true);
        const memo = objectMemos.find(m => m.id === id);
        if (memo) {
            const canvas = objectDrawCanvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const memoScreenX = (memo.x / imageSize.width) * rect.width + rect.left;
            const memoScreenY = (memo.y / imageSize.height) * rect.height + rect.top;
            setObjectMemoDragOffset({ x: e.clientX - memoScreenX, y: e.clientY - memoScreenY });
        }
    };
    const handleObjectMemoMouseMove = (e: React.MouseEvent) => {
        if (isDraggingObjectMemo && selectedObjectMemoId) {
            const canvas = objectDrawCanvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const newScreenX = e.clientX - objectMemoDragOffset.x;
            const newScreenY = e.clientY - objectMemoDragOffset.y;
            const newX = ((newScreenX - rect.left) / rect.width) * imageSize.width;
            const newY = ((newScreenY - rect.top) / rect.height) * imageSize.height;
            setObjectMemos(objectMemos.map(m => m.id === selectedObjectMemoId ? { ...m, x: newX, y: newY } : m));
        }
    };
    const handleObjectMemoMouseUp = () => { setIsDraggingObjectMemo(false); };

    // Object Drawing Interaction
    const { selectedResolution, selectedAspectRatio } = useGenerationStore();

    const handleConfirm = async () => {
        console.log('[handleConfirm] Called! activeTool:', activeTool);
        if (activeTool === 'crop') {
            if (!imageRef.current || !imageSize.naturalWidth) return;
            const scaleX = imageSize.naturalWidth / imageSize.width; const scaleY = imageSize.naturalHeight / imageSize.height;
            const isExpanding = editBox.x < 0 || editBox.y < 0 || editBox.x + editBox.width > imageSize.width || editBox.y + editBox.height > imageSize.height;
            if (isExpanding || cropPrompt.trim().length > 0) {
                const expandedCanvas = document.createElement('canvas');
                const newWidth = Math.round(editBox.width * scaleX);
                const newHeight = Math.round(editBox.height * scaleY);
                expandedCanvas.width = newWidth;
                expandedCanvas.height = newHeight;
                const ctx = expandedCanvas.getContext('2d');
                if (!ctx) {
                    onNotification('Failed to create canvas for expansion.', 'error');
                    return;
                }
                ctx.drawImage(
                    imageRef.current,
                    Math.round(-editBox.x * scaleX),
                    Math.round(-editBox.y * scaleY),
                    imageSize.naturalWidth,
                    imageSize.naturalHeight
                );
                const blob = await new Promise<Blob | null>(resolve => expandedCanvas.toBlob(resolve, 'image/png'));
                if (!blob) {
                    onNotification('Failed to create image blob for expansion.', 'error');
                    return;
                }
                const expandedFile = new File([blob], `expanded_${image.file?.name || 'image'}.png`, { type: 'image/png' });

                onComplete({
                    type: 'generateAiEdit',
                    action: 'expand',
                    params: {},
                    displaySize: { width: imageSize.width, height: imageSize.height },
                    filePayload: expandedFile,
                    modelName,
                    resolution: selectedResolution,
                    aspectRatio: selectedAspectRatio,
                    customPrompt: cropPrompt
                });

            } else { // Cropping
                const canvas = document.createElement('canvas');
                canvas.width = editBox.width * scaleX;
                canvas.height = editBox.height * scaleY;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(
                        imageRef.current,
                        editBox.x * scaleX,
                        editBox.y * scaleY,
                        editBox.width * scaleX,
                        editBox.height * scaleY,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );
                    // [PERF] Use toBlob + Blob URL instead of toDataURL for faster rendering
                    // toDataURL is slow because: PNG compression + Base64 encoding + decoding on render
                    // Blob URL directly references binary data in memory - no encoding/decoding overhead
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const blobUrl = blobManager.create(blob);
                            onComplete({
                                type: 'newImage',
                                dataUrl: blobUrl, // Now it's a blob URL, much faster!
                                width: canvas.width,
                                height: canvas.height
                            });
                        } else {
                            onNotification('Failed to create image blob.', 'error');
                        }
                    }, 'image/png');
                }
            }
        } else if (activeTool === 'object') {
            console.log('[Object handleConfirm] Starting object tab confirmation');
            // Create a combined image with original + drawings + memos
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageSize.naturalWidth;
            tempCanvas.height = imageSize.naturalHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx || !imageRef.current) {
                console.error('[Object handleConfirm] Early return - tempCtx:', !!tempCtx, 'imageRef:', !!imageRef.current);
                return;
            }
            console.log('[Object handleConfirm] Canvas created, drawing image...');

            // Draw original image
            tempCtx.drawImage(imageRef.current, 0, 0, imageSize.naturalWidth, imageSize.naturalHeight);

            // Draw the drawing canvas if it has content
            if (objectDrawCanvasRef.current) {
                tempCtx.drawImage(objectDrawCanvasRef.current, 0, 0);
            }

            // Draw all objects
            // We need to draw them in the correct order and position
            for (const objState of objectStates) {
                try {
                    // [FIX] Try to find the already-rendered image element in the DOM
                    // instead of creating a new Image() with a potentially revoked blob URL
                    let img: HTMLImageElement | null = document.querySelector(`img[data-object-id="${objState.id}"]`);

                    if (!img || !img.complete || img.naturalWidth === 0) {
                        // Fallback: try to fetch the blob and create image from it
                        console.log('[Object handleConfirm] Image not found in DOM, attempting fetch for:', objState.id);
                        try {
                            const response = await fetch(objState.src);
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);

                            img = new Image();
                            img.src = blobUrl;
                            await new Promise<void>((resolve, reject) => {
                                img!.onload = () => resolve();
                                img!.onerror = () => reject(new Error('Failed to load object image'));
                            });

                            // Clean up temporary blob URL after drawing
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                        } catch (fetchErr) {
                            console.error('[Object handleConfirm] Failed to fetch object image:', objState.id, fetchErr);
                            continue; // Skip this object and continue with others
                        }
                    }

                    tempCtx.save();
                    // Scale transform from display coordinates to natural resolution
                    const scaleX = imageSize.naturalWidth / imageSize.width;
                    const scaleY = imageSize.naturalHeight / imageSize.height;
                    const natX = objState.transform.x * scaleX;
                    const natY = objState.transform.y * scaleY;
                    const natW = objState.transform.width * scaleX;
                    const natH = objState.transform.height * scaleY;
                    // Translate to center of object in natural coordinates
                    const centerX = natX + natW / 2;
                    const centerY = natY + natH / 2;
                    tempCtx.translate(centerX, centerY);
                    tempCtx.rotate((objState.transform.rotation * Math.PI) / 180);
                    tempCtx.scale(objState.transform.scaleX ?? 1, 1);
                    tempCtx.drawImage(
                        img,
                        -natW / 2,
                        -natH / 2,
                        natW,
                        natH
                    );
                    tempCtx.restore();
                } catch (err) {
                    console.error('[Object handleConfirm] Error drawing object:', objState.id, err);
                }
            }

            // Draw memos
            tempCtx.textBaseline = 'top';
            objectMemos.forEach(memo => {
                tempCtx.font = `${memo.fontSize}px sans - serif`;
                tempCtx.fillStyle = memo.color;
                tempCtx.fillText(memo.text || t('drawing.memo.placeholder', language), memo.x, memo.y);
            });

            // Convert to blob and file
            const blob = await new Promise<Blob | null>(resolve => tempCanvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                onNotification('Failed to create guide image.', 'error');
                return;
            }
            const guideImageFile = new File([blob], `guide_${image.file?.name || 'image'}.png`, { type: 'image/png' });

            // For backward compatibility / simplicity, we might just pass the first object's file if needed by backend,
            // OR we rely entirely on the guide image (which now contains all objects).
            // The backend logic we saw uses `poseImage` (which is this guide image) as the main input.
            // So passing `objectState` is less critical for the visual, but might be needed if the backend
            // wants to know about the specific object file.
            // Since we now have multiple, passing just one is ambiguous.
            // However, the current backend implementation for 'insertObject' primarily uses the guide image.
            // We will pass the first object's file just to satisfy the type definition if it requires one,
            // or update the type to support multiple (which we haven't done in backend yet, but frontend can be ready).
            // For now, let's pass the first one if available, but the visual is in the guide image.

            // [FIX] Create file from src if file is missing (for objects inserted from canvas)
            let objectStateForTask: { file: File; transform: ObjectTransform } | undefined = undefined;
            if (objectStates.length > 0) {
                const firstObj = objectStates[0];
                let objFile = firstObj.file;

                // If file is missing but src exists (canvas-inserted object), create file from src
                if (!objFile && firstObj.src) {
                    try {
                        const response = await fetch(firstObj.src);
                        const blob = await response.blob();
                        objFile = new File([blob], `object-${firstObj.id}.png`, { type: 'image/png' });
                    } catch (err) {
                        console.error('[ObjectInsert] Failed to create file from src:', err);
                    }
                }

                if (objFile) {
                    objectStateForTask = { file: objFile, transform: firstObj.transform };
                }
            }

            console.log('[Object handleConfirm] Calling onComplete with:', {
                type: 'generateAiEdit',
                action: 'insertObject',
                objectStateExists: !!objectStateForTask,
                promptLength: objectPrompt.length,
                modelName,
            });

            onComplete({
                type: 'generateAiEdit',
                action: 'insertObject',
                params: {
                    objectState: objectStateForTask,
                    objectPrompt: objectPrompt,
                },
                displaySize: { width: imageSize.width, height: imageSize.height },
                filePayload: guideImageFile,
                modelName,
                resolution: selectedResolution,
                aspectRatio: selectedAspectRatio
            });
        } else if (activeTool === 'relight') {
            if (lightSources.length === 0) {
                onNotification(t('notification.addLightFirst', language), 'error');
                return;
            }

            const relightPrompt = buildRelightPrompt(lightSources, lightingPrompt);
            console.log('[Relighting] Generated prompt:', relightPrompt);

            // Ensure we have a valid file payload for relighting
            let relightImageFile = image.file;
            if (!relightImageFile && image.src) {
                try {
                    console.log('[Relighting] Image file missing, fetching from src:', image.src);
                    const response = await fetch(image.src);
                    const blob = await response.blob();
                    relightImageFile = new File([blob], 'relight-source.png', { type: blob.type || 'image/png' });
                } catch (err) {
                    console.error('[Relighting] Failed to fetch image from src:', err);
                    onNotification(t('notification.originalImageLoadFailed', language), 'error');
                    return;
                }
            }

            if (!relightImageFile) {
                onNotification(t('notification.originalImageFileMissing', language), 'error');
                return;
            }

            onComplete({
                type: 'generateAiEdit',
                action: 'relight', // Use specific action for relighting
                params: {
                    variationCreativity: 30 // Low creativity to maintain original image
                },
                displaySize: { width: imageSize.width, height: imageSize.height },
                filePayload: relightImageFile,
                customPrompt: relightPrompt, // Pass the relighting prompt
                modelName,
                resolution: selectedResolution,
                aspectRatio: selectedAspectRatio
            });
        }
    };

    const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // 1. Navigation Override: Middle(1) or Right(2) Click or Spacebar -> PAN
        if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpacebarPressed)) {
            e.preventDefault();
            e.stopPropagation();
            interactionRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPan: pan };
            return;
        }

        // 2. Scrubby Zoom: Z + Left Click
        if (e.button === 0 && isZKeyDown && viewportRef.current) {
            e.preventDefault();
            e.stopPropagation();
            const rect = viewportRef.current.getBoundingClientRect();
            const mouseScreenX = e.clientX - rect.left;
            const mouseScreenY = e.clientY - rect.top;

            // Calculate world coordinates relative to current zoom/pan
            // This is strictly visual logical world for the pivot
            const worldX = (mouseScreenX - pan.x) / zoom;
            const worldY = (mouseScreenY - pan.y) / zoom;

            interactionRef.current = {
                type: 'scrubbyZoom',
                startX: e.clientX,
                startY: e.clientY,
                startZoom: zoom,
                startPan: pan,
                pivotWorld: { x: worldX, y: worldY },
                startScreenX: mouseScreenX,
                startScreenY: mouseScreenY
            };
            return;
        }
    };
    const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: typeof interactionRef.current['type']) => {
        // Priority 1 & 2: Navigation Override (Space, Z, Middle, Right)
        if (isSpacebarPressed || isZKeyDown || e.button === 1 || e.button === 2) {
            // Delegate to viewport navigation (stop propagation handled differently or manually call handler?)
            // Since this is on a child, stopping propagation prevents the viewport handler from firing naturally if we don't handle it.
            // BUT, we want navigation. The easiest way is to NOT stop propagation if it's a navigation intent, 
            // but we must prevent the crop action.
            // However, `handleViewportMouseDown` is on the parent. 
            // So if we just return here effectively and NOT stop propagation, it bubbles to viewport?
            // Let's test: if we return, event bubbles. Viewport handles it.
            // But we probably want to preventDefault to avoid context menu on right click.
            if (e.button === 2) e.preventDefault();
            // Let it bubble to handleViewportMouseDown
            return;
        }

        // Priority 3: Left Click Only
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();
        interactionRef.current = { type, startX: e.clientX, startY: e.clientY, startEditBox: { ...editBox }, startPan: { ...pan } };
    };

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const scaleAmount = 1.2;

        setZoom(prevZoom => {
            const newZoom = e.deltaY < 0 ? prevZoom * scaleAmount : prevZoom / scaleAmount;
            const clampedZoom = Math.max(0.2, Math.min(10, newZoom));

            if (viewportRef.current) {
                const rect = viewportRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                setPan(prevPan => {
                    const newPanX = mouseX - (mouseX - prevPan.x) * (clampedZoom / prevZoom);
                    const newPanY = mouseY - (mouseY - prevPan.y) * (clampedZoom / prevZoom);
                    return { x: newPanX, y: newPanY };
                });
            }

            return clampedZoom;
        });
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport) {
            viewport.addEventListener('wheel', handleWheel, { passive: false });
            return () => {
                viewport.removeEventListener('wheel', handleWheel);
            };
        }
    }, [handleWheel]);

    const handleCursorMove = (e: React.PointerEvent<HTMLDivElement>) => { setCursorPos({ x: e.clientX, y: e.clientY }); };

    const isExpanding = useMemo(() => {
        if (activeTool !== 'crop') return false;
        return imageSize.width > 0 && (editBox.width > imageSize.width || editBox.height > imageSize.height || editBox.x < 0 || editBox.y < 0);
    }, [activeTool, editBox, imageSize]);

    // Sync editorMode to global store for button label
    const setEditorMode = useUIStore(state => state.setEditorMode);
    useEffect(() => {
        if (activeTool === 'crop') {
            // Crop-only (no AI) vs Expand (AI required)
            const needsAI = isExpanding || cropPrompt.trim().length > 0;
            setEditorMode(needsAI ? 'expand' : 'crop');
        } else {
            // Mapping other tools to their specific editor modes
            setEditorMode(activeTool);
        }
    }, [activeTool, isExpanding, cropPrompt, setEditorMode]);

    const confirmButtonTextKey = useMemo(() => {
        if (activeTool === 'crop') return (isExpanding || cropPrompt.trim().length > 0) ? 'editModal.generate' : 'editModal.apply';
        if (activeTool === 'relight') return 'editModal.confirm'; // Or 'Apply'
        return 'editModal.generate';
    }, [activeTool, isExpanding, cropPrompt]);

    const isConfirmDisabled = useMemo(() => {
        return false;
    }, [activeTool]);

    // [REF PATTERN] Use refs to access latest state in event listeners without re-binding
    const latestHandlersRef = useRef({ handleConfirm, isConfirmDisabled, activeTool });
    useEffect(() => {
        latestHandlersRef.current = { handleConfirm, isConfirmDisabled, activeTool };
    });

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (isShortcut(e, 'cancel')) { e.stopPropagation(); onCancel(); return; }
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') { e.preventDefault(); setIsSpacebarPressed(true); }
            if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') { setIsZKeyDown(true); }

            // Enter Key for Confirmation/Apply
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                const { handleConfirm, isConfirmDisabled } = latestHandlersRef.current;
                if (!isConfirmDisabled) {
                    handleConfirm();
                }
                return;
            }

            // Intercept Global Undo/Redo to prevent main canvas from undoing while modal is open
            const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
            const isRedo = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'));

            if (isUndo || isRedo) {
                // If active tool has its own history (object mode), let the specific handler handle it.
                // Otherwise, stop propagation to block the global app history.
                if (latestHandlersRef.current.activeTool !== 'object') {
                    e.stopPropagation();
                }
            }
        };
        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacebarPressed(false);
            if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') { setIsZKeyDown(false); }
        };
        window.addEventListener('keydown', handleGlobalKeyDown, true);
        window.addEventListener('keyup', handleGlobalKeyUp, true);

        // Listen for global button clicks (editor-execute event)
        const handleEditorExecute = () => {
            const { handleConfirm, isConfirmDisabled } = latestHandlersRef.current;
            if (!isConfirmDisabled) {
                handleConfirm();
            }
        };
        window.addEventListener('editor-execute', handleEditorExecute);

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown, true);
            window.removeEventListener('keyup', handleGlobalKeyUp, true);
            window.removeEventListener('editor-execute', handleEditorExecute);
        };
    }, [onCancel]);
    useEffect(() => {
        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!interactionRef.current) return;

            // Scrubby Zoom Logic
            if (interactionRef.current.type === 'scrubbyZoom') {
                const dx = moveEvent.clientX - interactionRef.current.startX;
                const { startZoom, pivotWorld, startScreenX, startScreenY } = interactionRef.current;

                if (startZoom && pivotWorld && startScreenX !== undefined && startScreenY !== undefined) {
                    const newZoom = Math.max(0.2, Math.min(10, startZoom * Math.exp(dx * 0.005)));
                    const newPanX = startScreenX - (pivotWorld.x * newZoom);
                    const newPanY = startScreenY - (pivotWorld.y * newZoom);

                    setZoom(newZoom);
                    setPan({ x: newPanX, y: newPanY });
                }
                return;
            }

            const { startX, startY, startEditBox, startPan, type } = interactionRef.current;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            if (type === 'pan') {
                setPan({ x: startPan!.x + dx, y: startPan!.y + dy });
                return;
            }

            // Edit Box Logic (Crop/Resize)
            if (startEditBox) {
                const dxCanvas = dx / zoom;
                const dyCanvas = dy / zoom;
                const minSize = 20 / zoom;
                let newEditBox = { ...startEditBox }; // Copy

                if (type === 'move') {
                    // Move the entire box (no resize)
                    newEditBox.x = startEditBox.x + dxCanvas;
                    newEditBox.y = startEditBox.y + dyCanvas;
                } else {
                    // Resize logic - only for resize handles
                    // Calculate the fixed edges (opposite side should remain fixed)
                    const rightEdge = startEditBox.x + startEditBox.width;
                    const bottomEdge = startEditBox.y + startEditBox.height;

                    if (type.includes('w')) {
                        // Left edge moves, right edge stays fixed
                        let newX = startEditBox.x + dxCanvas;
                        let newWidth = rightEdge - newX;
                        // Enforce minimum width while keeping right edge fixed
                        if (newWidth < minSize) {
                            newWidth = minSize;
                            newX = rightEdge - minSize;
                        }
                        newEditBox.x = newX;
                        newEditBox.width = newWidth;
                    }
                    if (type.includes('e')) {
                        // Right edge moves, left edge stays fixed (x unchanged)
                        let newWidth = startEditBox.width + dxCanvas;
                        if (newWidth < minSize) newWidth = minSize;
                        newEditBox.width = newWidth;
                    }
                    if (type.includes('n')) {
                        // Top edge moves, bottom edge stays fixed
                        let newY = startEditBox.y + dyCanvas;
                        let newHeight = bottomEdge - newY;
                        // Enforce minimum height while keeping bottom edge fixed
                        if (newHeight < minSize) {
                            newHeight = minSize;
                            newY = bottomEdge - minSize;
                        }
                        newEditBox.y = newY;
                        newEditBox.height = newHeight;
                    }
                    if (type.includes('s')) {
                        // Bottom edge moves, top edge stays fixed (y unchanged)
                        let newHeight = startEditBox.height + dyCanvas;
                        if (newHeight < minSize) newHeight = minSize;
                        newEditBox.height = newHeight;
                    }
                }

                setEditBox(newEditBox);
            }
        };
        const handleMouseUp = () => {
            interactionRef.current = null;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [pan, zoom]);

    // Cleanup blob URL on unmount or when objectStates changes
    useEffect(() => {
        return () => {
            objectStates.forEach(state => {
                if (state.src && state.src.startsWith('blob:')) {
                    // We should only revoke if we are sure it's not used anymore.
                    // React strict mode might mount/unmount.
                    // Better to rely on a more robust cleanup or just let browser handle it on page reload if small.
                    // But for correctness:
                    // blobManager.release(state.src);
                }
            });
        };
    }, []); // Run once on unmount effectively, or we need to track removed ones.

    // Better cleanup: when removing an object, revoke its URL.

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); if (activeTool === 'object') setIsDraggingObjectFile(true); };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingObjectFile(false); if (activeTool === 'object' && e.dataTransfer.files && e.dataTransfer.files[0]) handleObjectFile(e.dataTransfer.files[0]); };

    const toolButtons: { tool: EditTool, icon: React.ReactNode, labelKey: TranslationKey }[] = [
        { tool: 'crop', icon: <ScissorsIcon className="w-5 h-5" />, labelKey: "editModal.title" },
        { tool: 'object', icon: <PhotoIcon className="w-5 h-5" />, labelKey: "aiEdit.insertObject" },
        { tool: 'relight', icon: <LightIcon className="w-5 h-5" />, labelKey: "editModal.relight" }
    ];



    // Modal drag handlers
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDraggingModal(true);
        setDragStart({ x: e.clientX - modalState.x, y: e.clientY - modalState.y });
        e.preventDefault();
    };

    useEffect(() => {
        if (!isDraggingModal) return;

        const handleMouseMove = (e: MouseEvent) => {
            setModalState(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            }));
        };

        const handleMouseUp = () => {
            setIsDraggingModal(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingModal, dragStart]);



    // Keyboard shortcuts for undo/redo in object mode
    const handleGlobalUndo = useCallback(() => {
        if (objectMode === 'draw') {
            handleObjectDrawUndo();
        } else {
            undoObjectOperation();
        }
    }, [objectMode, handleObjectDrawUndo, undoObjectOperation]);

    const handleGlobalRedo = useCallback(() => {
        if (objectMode === 'draw') {
            handleObjectDrawRedo();
        } else {
            redoObjectOperation();
        }
    }, [objectMode, handleObjectDrawRedo, redoObjectOperation]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle shortcuts when in object mode
            if (activeTool !== 'object') return;

            // Don't handle if typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (isShortcut(e, 'undoDrawing')) {
                e.preventDefault();
                e.stopPropagation();
                handleGlobalUndo();
            } else if (isShortcut(e, 'redoDrawing')) {
                e.preventDefault();
                e.stopPropagation();
                handleGlobalRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [activeTool, handleGlobalUndo, handleGlobalRedo]);

    // Ctrl+Enter shortcut for generation/confirm (works even in text fields)
    useEffect(() => {
        const handleCtrlEnter = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                // Trigger the confirm/generate action
                handleConfirm();
            }
        };

        window.addEventListener('keydown', handleCtrlEnter);
        return () => window.removeEventListener('keydown', handleCtrlEnter);
    }, [handleConfirm]);



    return (
        <div
            className={`fixed flex flex-col pointer-events-auto shadow-2xl rounded-xl overflow-hidden border ${isObjectInsertMode ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-white/10'} glass-panel`}
            style={{
                zIndex: Z_INDEX.CANVAS_INTERACTION,
                left: modalState.x,
                top: modalState.y,
                width: modalState.width,
                height: modalState.height,
            }}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <EditorHeader
                title={t('editModal.title', language)}
                onCancel={onCancel}
                onMouseDown={handleHeaderMouseDown}
            />

            <div className="flex-1 flex flex-col min-h-0">
                <EditorSidebar
                    activeTool={activeTool}
                    setActiveTool={(tool) => setActiveTool(tool)}
                    t={t}
                    language={language}
                />
                <div className="flex-1 min-h-0 relative">
                    {activeTool === 'crop' && <CropTab language={language} localImageSrc={localImageSrc} />}
                    {activeTool === 'object' && <ObjectTab language={language} onNotification={onNotification} localImageSrc={localImageSrc} />}
                    {activeTool === 'relight' && <RelightTab language={language} localImageSrc={localImageSrc} onSetLightingPrompt={setLightingPrompt} />}
                </div>
            </div>
            {
                objectContextMenu && (
                    <ObjectContextMenu
                        menu={objectContextMenu}
                        onClose={() => setObjectContextMenu(null)}
                        onCopy={handleCopyObject}
                        onPaste={handlePasteObject}
                        onFlip={flipObject}
                        onDelete={removeObject}
                    />
                )
            }
            <ModalResizeHandles onResizeStart={handleResizeStart} />
        </div >
    );
};
