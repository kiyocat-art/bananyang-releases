// FIX: Import React to resolve namespace errors for event types.
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// Icons removed as per user request
import { useCanvasStore } from '../../../store/canvasStore';
import { useSettingsStore } from '../../../store/settingsStore';
// FIX: Import GeneratedMedia, GenerationParams, BoardImage and ShortcutAction types.
import { GeneratedMedia, GenerationParams, BoardImage, ShortcutAction } from '../../../types';
import { bananyang_MEDIA_MIME_TYPE } from '../../../constants';
// FIX: Import t for localization to fix missing name error.
import { t, TranslationKey, Language } from '../../../localization';
// FIX: Import ContextMenuItem and ContextMenuProps to resolve missing name errors.
import { ContextMenuItem, ContextMenuProps } from '../components/ContextMenu';
import { isShortcut, useShortcutStore } from '../../../hooks/useShortcuts';
import { readWorkspacePayload } from '../../../utils/workspaceContainer';

// FIX: Update props interface to include all necessary props and their correct types.
interface UseCanvasInteractionsProps {
    allHistoryMedia: GeneratedMedia[];
    onNewWorkspace: () => void;
    onSaveWorkspace: () => void;
    onSaveWorkspaceAs: () => void;
    onLoadWorkspace: (content?: string, filePath?: string) => void;
    onPasteFromClipboard: (position: { x: number; y: number; }) => void;
    onNotification: (message: string, type: 'success' | 'error') => void;
    language: Language;
    onCopySelection: () => Promise<Blob | null>;
    onZoomSelection: (media: File | string | null) => void;
    onEditSelection: (imageOrId: string | BoardImage) => void;
    onLoadGenerationParams: (params: GenerationParams) => void;
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    editingImageId?: string;
    isLowZoomMode: boolean;
    hitTest: (x: number, y: number) => { type: 'image' | 'group' | 'memo'; id: string } | null;
}

// FIX: Update hook signature to accept all required props and implement missing logic.
export const useCanvasInteractions = ({
    allHistoryMedia,
    language,
    onZoomSelection,
    onEditSelection,
    onNewWorkspace,
    onSaveWorkspace,
    onSaveWorkspaceAs,
    onLoadWorkspace,
    onCopySelection,
    onPasteFromClipboard,
    onNotification,
    saveDirectoryHandle,
    onLoadGenerationParams,
    editingImageId,
    isLowZoomMode = false,
    hitTest = () => null
}: UseCanvasInteractionsProps) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        pan, zoom, setPan, setZoom, boardImages, boardGroups,
        selectedImageIds, selectedGroupIds, setSelectedImageIds, setSelectedGroupIds,
        setBoardImages, setBoardGroups, handleImageMouseDown, handleGroupMouseDown,
        alignSelection, alignRoleImagesToOriginal, groupSelection, ungroupSelection, setEditingGroupId, uploadImages, addHistoryImage,
        dropSelectionOnGroup, removeImageFromGroup, updateImage, marquee, setMarquee, groupEditModeId, setGroupEditModeId,
        isObjectInsertMode
    } = useCanvasStore();

    const [isSpacebarDown, setIsSpacebarDown] = useState(false);

    const downloadSingleImage = useCallback(async (image: BoardImage, elementId: string, fullQualSrc: string, format: 'png' | 'webp') => {
        const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        const convertToFormat = (source: Blob): Promise<Blob> => new Promise((resolve, reject) => {
            if (source.type === mimeType) { resolve(source); return; }
            const url = URL.createObjectURL(source);
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { URL.revokeObjectURL(url); reject(new Error('No 2d context')); return; }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(result => {
                    URL.revokeObjectURL(url);
                    result ? resolve(result) : reject(new Error('toBlob failed'));
                }, mimeType, format === 'webp' ? 0.92 : undefined);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
            img.src = url;
        });

        const autoDownloadPath = useSettingsStore.getState().autoDownloadPath;
        let baseName = `image-${elementId}`;
        let blob: Blob;

        if (image.originalFile) {
            blob = image.originalFile;
            baseName = image.originalFile.name.replace(/\.[^.]+$/, '') || baseName;
        } else if (image.originalFilePath && (window as any).electronAPI?.readBinaryFile) {
            const base64 = await (window as any).electronAPI.readBinaryFile(image.originalFilePath);
            const byteChars = atob(base64);
            const byteArr = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
            const pathExt = (image.originalFilePath.split(/[/\\]/).pop()?.split('.').pop() || 'png').toLowerCase();
            const blobMime = pathExt === 'webp' ? 'image/webp' : (pathExt === 'jpg' || pathExt === 'jpeg') ? 'image/jpeg' : 'image/png';
            blob = new Blob([byteArr], { type: blobMime });
            baseName = image.originalFilePath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || baseName;
        } else if (image.file) {
            blob = image.file;
            baseName = image.file.name.replace(/\.[^.]+$/, '') || baseName;
        } else {
            try {
                const response = await fetch(fullQualSrc);
                blob = await response.blob();
            } catch {
                const link = document.createElement('a');
                link.href = fullQualSrc;
                link.download = `${baseName}.${format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return;
            }
            if (image.originalFilePath || image.filePath) {
                baseName = (image.originalFilePath || image.filePath)?.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || baseName;
            }
        }

        blob = await convertToFormat(blob);

        if (image.scaleX === -1) {
            blob = await new Promise<Blob>((resolve, reject) => {
                const url = URL.createObjectURL(blob);
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { URL.revokeObjectURL(url); reject(new Error('No 2d context')); return; }
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    canvas.toBlob(result => result ? resolve(result) : reject(new Error('toBlob failed')), mimeType, format === 'webp' ? 0.92 : undefined);
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
                img.src = url;
            });
        }

        const fileName = `${baseName}.${format}`;

        if (autoDownloadPath && (window as any).electronAPI?.saveFileToDirectory) {
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const result = await (window as any).electronAPI.saveFileToDirectory(autoDownloadPath, fileName, base64Data);
            if (result?.success) {
                onNotification(`${fileName} 저장되었습니다.`, 'success');
            } else {
                onNotification('저장에 실패했습니다.', 'error');
            }
        } else if (saveDirectoryHandle) {
            try {
                const fileHandle = await saveDirectoryHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                onNotification(`${fileName} 저장되었습니다.`, 'success');
            } catch {
                onNotification('저장에 실패했습니다.', 'error');
            }
        } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
            onNotification(t('downloadComplete', language), 'success');
        }
    }, [saveDirectoryHandle, onNotification, language]);
    const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
    const [isZKeyDown, setIsZKeyDown] = useState(false);

    useEffect(() => {
        const element = canvasRef.current;
        if (!element) return;
        const observer = new ResizeObserver(() => {
            setCanvasRect(element.getBoundingClientRect());
        });
        observer.observe(element);
        setCanvasRect(element.getBoundingClientRect()); // Initial set
        return () => observer.disconnect();
    }, []);

    const interactionRef = useRef<{
        type: 'pan' | 'marquee' | 'potentialMarquee' | 'drag' | 'potentialDrag' | 'scrubbyZoom';
        startX: number;
        startY: number;
        startZoom?: number;
        startPan?: { x: number; y: number };
        pivotWorld?: { x: number; y: number };
        relativeStartX?: number;
        relativeStartY?: number;
        elementStartPositions?: {
            images: Map<string, { x: number; y: number }>;
            groups: Map<string, { x: number; y: number }>;
            memos: Map<string, { x: number; y: number }>;
        };
        marqueeRect?: { x: number; y: number; width: number; height: number; };
        startScreenX?: number;
        startScreenY?: number;
        startSelectionBounds?: { x: number; y: number; width: number; height: number; };
        panButton?: number; // [FIX FLICK] Track which button started pan (0=LMB, 1=MMB, 2=RMB)
    } | null>(null);

    const hasPannedRef = useRef(false);
    const [overrideSelectionBounds, setOverrideSelectionBounds] = useState<{ x: number; y: number; width: number; height: number; } | null>(null);
    const [overrideActionRingPosition, setOverrideActionRingPosition] = useState<{ x: number; y: number } | null>(null);

    // Flick panning: velocity tracking & inertia animation
    const panVelocityHistoryRef = useRef<Array<{x: number; y: number; t: number}>>([]);
    const flickAnimationRef = useRef<number | null>(null);

    const startFlickAnimation = useCallback((vx: number, vy: number) => {
        if (flickAnimationRef.current !== null) {
            cancelAnimationFrame(flickAnimationRef.current);
        }

        // Fixed physics constants (Photoshop-equivalent)
        const FRICTION = 0.92;
        const MIN_VELOCITY = 0.5;

        let velocityX = vx;
        let velocityY = vy;

        const animate = () => {
            velocityX *= FRICTION;
            velocityY *= FRICTION;

            if (Math.sqrt(velocityX * velocityX + velocityY * velocityY) < MIN_VELOCITY) {
                flickAnimationRef.current = null;
                return;
            }

            useCanvasStore.setState(state => ({
                pan: {
                    x: state.pan.x + velocityX,
                    y: state.pan.y + velocityY,
                }
            }));

            flickAnimationRef.current = requestAnimationFrame(animate);
        };

        flickAnimationRef.current = requestAnimationFrame(animate);
    }, []);

    const actionRingPosition = useMemo(() => {
        if (selectedImageIds.size === 1 && selectedGroupIds.size === 0 && canvasRect) {
            const selectedId = Array.from(selectedImageIds)[0];
            const image = boardImages.find(img => img.id === selectedId);
            if (image) {
                const top = (image.y * zoom) + pan.y + canvasRect.top;
                const left = (image.x * zoom + (image.width * zoom) / 2) + pan.x + canvasRect.left;
                return { x: left, y: top };
            }
        }
        return null;
    }, [selectedImageIds, selectedGroupIds, boardImages, pan, zoom, canvasRect]);

    const selectionBounds = useMemo(() => {
        const selectedStandaloneImages = boardImages.filter(img => selectedImageIds.has(img.id) && !img.groupId);
        const selectedGroups = boardGroups.filter(g => selectedGroupIds.has(g.id));
        const elementsToBound = [...selectedStandaloneImages, ...selectedGroups];

        if (elementsToBound.length === 0) return null;

        const minX = Math.min(...elementsToBound.map(i => i.x));
        const minY = Math.min(...elementsToBound.map(i => i.y));
        const maxX = Math.max(...elementsToBound.map(i => i.x + i.width));
        const maxY = Math.max(...elementsToBound.map(i => i.y + i.height));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }, [selectedImageIds, selectedGroupIds, boardImages, boardGroups]);

    // canvas-selection-override: 툴바 바인딩 이미지 드래그 시 선택박스 실시간 업데이트
    useEffect(() => {
        const handler = (e: CustomEvent<{ bounds: { x: number; y: number; width: number; height: number } | null }>) => {
            setOverrideSelectionBounds(e.detail.bounds);
        };
        window.addEventListener('canvas-selection-override' as any, handler);
        return () => window.removeEventListener('canvas-selection-override' as any, handler);
    }, []);

    // canvas-action-ring-override: 툴바 바인딩 이미지 드래그 시 선택바 실시간 업데이트
    useEffect(() => {
        const handler = (e: CustomEvent<{ position: { x: number; y: number; width: number } | null }>) => {
            if (!e.detail.position) {
                setOverrideActionRingPosition(null);
                return;
            }
            const { x, y, width } = e.detail.position;
            const { zoom: z, pan: p } = useCanvasStore.getState();
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            setOverrideActionRingPosition({
                x: (x * z + (width * z) / 2) + p.x + rect.left,
                y: (y * z) + p.y + rect.top,
            });
        };
        window.addEventListener('canvas-action-ring-override' as any, handler);
        return () => window.removeEventListener('canvas-action-ring-override' as any, handler);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Debug log to ensure window is receiving events
            // console.log('Key down:', e.code, e.key); 

            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (isShortcut(e, 'panCanvas')) { e.preventDefault(); setIsSpacebarDown(true); }

            // Robust check for Z key (Physical KeyZ OR literal 'z'/'Z')
            if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                setIsZKeyDown(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            // Use key-only check (no modifier requirement) so releasing Space while holding
            // Ctrl/Shift still correctly clears the pan state.
            const panCanvasKey = useShortcutStore.getState().shortcuts['panCanvas']?.key ?? ' ';
            if (e.key === panCanvasKey) setIsSpacebarDown(false);
            if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                setIsZKeyDown(false);
            }
        };

        // Reset key states when window loses focus to prevent stuck keys
        const handleBlur = () => {
            setIsSpacebarDown(false);
            setIsZKeyDown(false);
        };

        // Reset key states when tab becomes hidden
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsSpacebarDown(false);
                setIsZKeyDown(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const cursorClass = useMemo(() => {
        if (isObjectInsertMode) return 'cursor-crosshair';
        if (interactionRef.current?.type === 'pan') return 'cursor-grabbing';
        if (interactionRef.current?.type === 'scrubbyZoom') {
            const dx = interactionRef.current.startX - (interactionRef.current.startScreenX || 0);
            return 'cursor-ew-resize';
        }
        if (isZKeyDown) return 'cursor-zoom-in';
        return isSpacebarDown ? 'cursor-grab' : 'cursor-default';
    }, [isSpacebarDown, isObjectInsertMode, isZKeyDown]);

    // Update cursor specifically for scrubby zoom direction if needed
    // Note: cursor-ew-resize is usually fine for dragging left/right, 
    // but if we want ZOOM-IN on right drag and ZOOM-OUT on left drag icon:
    // It's tricky to switch cursor mid-drag without custom CSS classes dynamically applied.
    // For now, let's keep it simple or use zoom-in/out based on KeyDown.

    const handleUploadAndPositionImages = useCallback(async (files: File[] | FileList, position?: { x: number; y: number }) => {
        if (!canvasRef.current) return;
        const containerRect = canvasRef.current.getBoundingClientRect();
        const dropPos = position || { x: containerRect.left + containerRect.width / 2, y: containerRect.top + containerRect.height / 2 };
        uploadImages(Array.from(files), dropPos, containerRect);
    }, [uploadImages]);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.relatedTarget && canvasRef.current?.contains(e.relatedTarget as Node)) {
            return;
        }
        setIsDraggingOver(false);
    };

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const position = { x: e.clientX, y: e.clientY };

        const files: File[] = Array.from(e.dataTransfer.files);
        const workspaceFiles = files.filter((f: File) => f.name.endsWith('.nyang') || f.name.endsWith('.rfy') || f.name.endsWith('.bananyang'));

        if (workspaceFiles.length > 0) {
            for (const wf of workspaceFiles) {
                const filePath = window.electronAPI?.getPathForFile?.(wf) || undefined;
                try {
                    const bytes = new Uint8Array(await wf.arrayBuffer());
                    const { json } = readWorkspacePayload(bytes);
                    if (filePath) {
                        onLoadWorkspace(json, filePath);
                    } else {
                        onLoadWorkspace(json);
                    }
                    await new Promise(r => setTimeout(r, 0));
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error("Failed to read workspace file:", errorMessage);
                }
            }
            return;
        }

        if (e.dataTransfer.types.includes(bananyang_MEDIA_MIME_TYPE)) {
            const mediaId = e.dataTransfer.getData(bananyang_MEDIA_MIME_TYPE);
            const mediaItem = allHistoryMedia.find(m => m.id === mediaId);
            if (mediaItem) addHistoryImage(mediaItem, position, rect);
        } else if (e.dataTransfer.files.length > 0) {
            handleUploadAndPositionImages(files, position);
        }
    }, [handleUploadAndPositionImages, allHistoryMedia, addHistoryImage, onLoadWorkspace]);

    const handleElementMouseDown = (e: React.MouseEvent<HTMLDivElement>, id: string, type: 'image' | 'group' | 'memo') => {
        // Cancel any ongoing flick animation
        if (flickAnimationRef.current !== null) {
            cancelAnimationFrame(flickAnimationRef.current);
            flickAnimationRef.current = null;
        }

        // Handle Scrubby Zoom (Z + Left Click) - Priority over element interactions
        if (e.button === 0 && isZKeyDown) {
            e.stopPropagation();
            // Reset interaction
            interactionRef.current = null;
            if (canvasRef.current) canvasRef.current.classList.remove('cursor-grabbing');
            setOverrideSelectionBounds(null);
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseScreenX = e.clientX - rect.left;
            const mouseScreenY = e.clientY - rect.top;
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

        e.stopPropagation();

        if (isSpacebarDown || e.button === 1 || e.button === 2) {
            hasPannedRef.current = false;
            interactionRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPan: pan, panButton: e.button };
            return;
        }

        if (e.button !== 0) return;

        // Object Insertion Mode Logic (Bypass if Shift is held)
        const { isObjectInsertMode, setInsertTargetImage, isShiftDown } = useCanvasStore.getState();
        if (isObjectInsertMode && !isShiftDown && type === 'image') {
            const targetImage = boardImages.find(img => img.id === id);
            if (targetImage) {
                setInsertTargetImage(targetImage);
                onNotification(t('notification.imageAddedToEditor' as TranslationKey, language), 'success');
                return;
            }
        }

        if (type === 'image') {
            handleImageMouseDown(id, e.shiftKey);
        } else if (type === 'group') {
            handleGroupMouseDown(id, e.shiftKey);
        } else if (type === 'memo') {
            const { handleMemoMouseDown } = useCanvasStore.getState();
            handleMemoMouseDown(id, e.shiftKey);
        }

        // Store potential drag info but don't activate drag mode yet
        // Drag will only activate in mousemove if mouse actually moves
        setTimeout(() => {
            const currentStoreState = useCanvasStore.getState();
            // Destructure selectedMemoIds here to ensure it is available
            const { selectedMemoIds, selectedImageIds, selectedGroupIds, boardImages, boardGroups, memos } = currentStoreState;
            const imageStartPositions = new Map<string, { x: number; y: number }>();
            const groupStartPositions = new Map<string, { x: number; y: number }>();
            const memoStartPositions = new Map<string, { x: number; y: number }>();

            boardImages.forEach(img => {
                if (selectedImageIds.has(img.id)) imageStartPositions.set(img.id, { x: img.x, y: img.y });
            });
            boardGroups.forEach(group => {
                if (selectedGroupIds.has(group.id)) {
                    groupStartPositions.set(group.id, { x: group.x, y: group.y });
                    group.imageIds.forEach(imgId => {
                        const img = boardImages.find(i => i.id === imgId);
                        if (img) imageStartPositions.set(img.id, { x: img.x, y: img.y });
                    });
                }
            });
            memos.forEach(memo => {
                if (selectedMemoIds.has(memo.id)) memoStartPositions.set(memo.id, { x: memo.x, y: memo.y });
            });

            // Calculate start selection bounds from current state
            let startSelectionBounds = undefined;
            const elementsToBound: { x: number, y: number, width: number, height: number }[] = [];

            boardImages.forEach(img => {
                if (selectedImageIds.has(img.id) && !img.groupId) elementsToBound.push(img);
            });
            boardGroups.forEach(group => {
                if (selectedGroupIds.has(group.id)) elementsToBound.push(group);
            });

            if (elementsToBound.length > 0) {
                const minX = Math.min(...elementsToBound.map(i => i.x));
                const minY = Math.min(...elementsToBound.map(i => i.y));
                const maxX = Math.max(...elementsToBound.map(i => i.x + i.width));
                const maxY = Math.max(...elementsToBound.map(i => i.y + i.height));
                startSelectionBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            }

            // Set as 'potentialDrag' instead of 'drag' - will convert to 'drag' on first movement
            interactionRef.current = {
                type: 'potentialDrag' as any,
                startX: e.clientX,
                startY: e.clientY,
                elementStartPositions: { images: imageStartPositions, groups: groupStartPositions, memos: memoStartPositions },
                startSelectionBounds
            };
        }, 0);
    };

    const handleMouseDownOnCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
        // [FIX] Hit Test for Low Zoom Mode (Canvas 2D)
        if (isLowZoomMode) {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const hit = hitTest(mouseX, mouseY);

            if (hit) {
                // @ts-ignore
                handleElementMouseDown(e, hit.id, hit.type);
                return;
            }
        }

        useCanvasStore.getState().setActiveKeyboardContext('canvas');

        // Cancel any ongoing flick animation
        if (flickAnimationRef.current !== null) {
            cancelAnimationFrame(flickAnimationRef.current);
            flickAnimationRef.current = null;
        }

        if (e.target !== e.currentTarget) return;

        // Exit Group Edit Mode on background click
        const { groupEditModeId, setGroupEditModeId } = useCanvasStore.getState();
        if (groupEditModeId && e.button === 0) {
            setGroupEditModeId(null);
            return;
        }

        if (contextMenu) setContextMenu(null);

        // Z-key + Left Click = Scrubby Zoom
        if (e.button === 0 && isZKeyDown) {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            // Calculate world coordinates of the click point (pivot)
            // Note: Mouse coordinates are relative to viewport, subtracting rect.left/top
            // worldX = (mouseScreenX - pan.x) / zoom
            const mouseScreenX = e.clientX - rect.left;
            const mouseScreenY = e.clientY - rect.top;
            const worldX = (mouseScreenX - pan.x) / zoom;
            const worldY = (mouseScreenY - pan.y) / zoom;

            interactionRef.current = {
                type: 'scrubbyZoom',
                startX: e.clientX,
                startY: e.clientY,
                startZoom: zoom,
                startPan: pan,
                pivotWorld: { x: worldX, y: worldY },
                startScreenX: mouseScreenX, // Store screen relative coords
                startScreenY: mouseScreenY
            };
            return;
        }

        // Left Click + Space OR Middle Click OR Right Click = Pan
        if (e.button === 1 || e.button === 2 || (e.button === 0 && isSpacebarDown)) {
            hasPannedRef.current = false;
            interactionRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPan: pan, panButton: e.button };
        }
        // Left Click = Marquee
        else if (e.button === 0) {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            interactionRef.current = {
                type: 'potentialMarquee',
                startX: e.clientX,
                startY: e.clientY,
                relativeStartX: e.clientX - rect.left,
                relativeStartY: e.clientY - rect.top
            };
        }
    };

    useEffect(() => {
        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!interactionRef.current) return;

            // Safety check: if no buttons are pressed, clear interaction
            if (moveEvent.buttons === 0) {
                handleMouseUp(moveEvent);
                return;
            }

            let { type } = interactionRef.current;
            const { startX, startY } = interactionRef.current;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            // Access current state directly to avoid closure staleness and dependency cycles
            const { zoom, pan, setPan, setZoom, setMarquee, setBoardImages, setBoardGroups } = useCanvasStore.getState();

            // Convert potentialDrag to drag on first movement
            if (type === 'potentialDrag') {
                const movement = Math.abs(dx) + Math.abs(dy);
                if (movement > 5) {
                    interactionRef.current.type = 'drag';
                    type = 'drag';
                    // Clear any native text selection that may have started
                    window.getSelection()?.removeAllRanges();
                } else {
                    return;
                }
            }

            // Convert potentialMarquee to marquee on first movement
            if (type === 'potentialMarquee') {
                const movement = Math.abs(dx) + Math.abs(dy);
                if (movement > 5) {
                    interactionRef.current.type = 'marquee';
                    type = 'marquee';
                } else {
                    return;
                }
            }

            if (type === 'pan') {
                const { startPan } = interactionRef.current;
                if (startPan) {
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasPannedRef.current = true;
                    setPan(() => ({ x: startPan.x + dx, y: startPan.y + dy }));

                    // Flick panning: record position history for velocity calculation
                    const now = performance.now();
                    const history = panVelocityHistoryRef.current;
                    history.push({ x: startPan.x + dx, y: startPan.y + dy, t: now });
                    if (history.length > 5) history.shift();
                }
            } else if (type === 'scrubbyZoom') {
                const { startZoom, pivotWorld, startScreenX, startScreenY } = interactionRef.current;

                if (startZoom && pivotWorld && startScreenX !== undefined && startScreenY !== undefined) {
                    // Use exponential formula for smoother feel: newZoom = startZoom * exp(delta * sensitivity)
                    const newZoom = Math.max(0.05, Math.min(5, startZoom * Math.exp(dx * 0.005)));
                    setZoom(() => newZoom);

                    const newPanX = startScreenX - (pivotWorld.x * newZoom);
                    const newPanY = startScreenY - (pivotWorld.y * newZoom);
                    setPan(() => ({ x: newPanX, y: newPanY }));
                }

            } else if (type === 'drag') {
                const { elementStartPositions } = interactionRef.current;
                if (!elementStartPositions) return;
                const canvasDx = dx / zoom;
                const canvasDy = dy / zoom;

                const computedImagePositions = new Map<string, { x: number; y: number }>();
                const computedGroupPositions = new Map<string, { x: number; y: number }>();

                const imageIdsInMovingGroups = new Set<string>();
                const { boardGroups } = useCanvasStore.getState();

                elementStartPositions.groups.forEach((startPos, groupId) => {
                    const group = boardGroups.find(g => g.id === groupId);
                    if (group) {
                        group.imageIds.forEach(imgId => imageIdsInMovingGroups.add(imgId));
                    }
                });

                elementStartPositions.images.forEach((startPos, id) => {
                    const newPos = { x: startPos.x + canvasDx, y: startPos.y + canvasDy };
                    computedImagePositions.set(id, newPos);

                    if (!imageIdsInMovingGroups.has(id)) {
                        const { boardImages } = useCanvasStore.getState();
                        const img = boardImages.find(i => i.id === id);
                        window.dispatchEvent(new CustomEvent('canvas-element-move', {
                            detail: { id, x: newPos.x, y: newPos.y, groupId: img?.groupId }
                        }));
                    }
                });

                elementStartPositions.groups.forEach((startPos, groupId) => {
                    const newPos = { x: startPos.x + canvasDx, y: startPos.y + canvasDy };
                    computedGroupPositions.set(groupId, newPos);
                    window.dispatchEvent(new CustomEvent('canvas-group-move', {
                        detail: { groupId, x: newPos.x, y: newPos.y }
                    }));
                });

                if (elementStartPositions.memos) {
                    elementStartPositions.memos.forEach((startPos, memoId) => {
                        const newPos = { x: startPos.x + canvasDx, y: startPos.y + canvasDy };
                        window.dispatchEvent(new CustomEvent('canvas-memo-move', {
                            detail: { id: memoId, x: newPos.x, y: newPos.y }
                        }));
                    });
                }

                (interactionRef.current as any).computedImagePositions = computedImagePositions;
                (interactionRef.current as any).computedGroupPositions = computedGroupPositions;

                // Update override selection bounds
                if (interactionRef.current.startSelectionBounds) {
                    const sb = interactionRef.current.startSelectionBounds;
                    setOverrideSelectionBounds({
                        x: sb.x + canvasDx,
                        y: sb.y + canvasDy,
                        width: sb.width,
                        height: sb.height
                    });
                }

                // Update override action ring position (toolbar)
                const { selectedImageIds: currentSelectedImageIds, boardImages: currentBoardImages } = useCanvasStore.getState();
                if (currentSelectedImageIds.size === 1) {
                    const selectedId = Array.from(currentSelectedImageIds)[0];
                    const originalImg = currentBoardImages.find(img => img.id === selectedId);
                    const draggedPos = computedImagePositions.get(selectedId);
                    if (originalImg && draggedPos && canvasRef.current) {
                        const rect = canvasRef.current.getBoundingClientRect();
                        const top = (draggedPos.y * zoom) + pan.y + rect.top;
                        const left = (draggedPos.x * zoom + (originalImg.width * zoom) / 2) + pan.x + rect.left;
                        setOverrideActionRingPosition({ x: left, y: top });
                    }
                }
            } else if (type === 'marquee') {
                if (!canvasRef.current) return;
                const rect = canvasRef.current.getBoundingClientRect();
                const currentX = moveEvent.clientX - rect.left;
                const currentY = moveEvent.clientY - rect.top;

                const rStartX = interactionRef.current.relativeStartX ?? 0;
                const rStartY = interactionRef.current.relativeStartY ?? 0;

                const currentMarquee = {
                    x: Math.min((rStartX - pan.x) / zoom, (currentX - pan.x) / zoom),
                    y: Math.min((rStartY - pan.y) / zoom, (currentY - pan.y) / zoom),
                    width: Math.abs(currentX - rStartX) / zoom,
                    height: Math.abs(currentY - rStartY) / zoom,
                };
                setMarquee(currentMarquee);
                interactionRef.current.marqueeRect = currentMarquee;
            }
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            if (!interactionRef.current) return;
            const { type, marqueeRect, elementStartPositions, startX, startY } = interactionRef.current;
            const { zoom, setBoardImages, setBoardGroups, setSelectedImageIds, setSelectedGroupIds, setMarquee, pan, boardImages, boardGroups, groupEditModeId, dropSelectionOnGroup, removeImageFromGroup } = useCanvasStore.getState();

            const totalMovement = Math.sqrt(
                Math.pow(upEvent.clientX - startX, 2) +
                Math.pow(upEvent.clientY - startY, 2)
            );

            if ((type === 'potentialDrag' || type === 'drag') && totalMovement < 5) {
                if (elementStartPositions) {
                    setBoardImages(prev => prev.map(img => {
                        const startPos = elementStartPositions.images.get(img.id);
                        return startPos ? { ...img, x: startPos.x, y: startPos.y } : img;
                    }));
                    setBoardGroups(prev => prev.map(group => {
                        const startPos = elementStartPositions.groups.get(group.id);
                        return startPos ? { ...group, x: startPos.x, y: startPos.y } : group;
                    }));
                }
                interactionRef.current = null;
                return;
            }

            if (type === 'potentialMarquee') {
                if (!upEvent.shiftKey) {
                    setSelectedImageIds(() => new Set());
                    setSelectedGroupIds(() => new Set());
                }
                interactionRef.current = null;
                return;
            }

            if (type === 'drag' && elementStartPositions) {
                const computedImagePositions = (interactionRef.current as any).computedImagePositions as Map<string, { x: number; y: number }> | undefined;
                const computedGroupPositions = (interactionRef.current as any).computedGroupPositions as Map<string, { x: number; y: number }> | undefined;

                if (computedImagePositions && computedImagePositions.size > 0) {
                    setBoardImages(prev => prev.map(img => {
                        const newPos = computedImagePositions.get(img.id);
                        return newPos ? { ...img, x: newPos.x, y: newPos.y } : img;
                    }));
                }

                if (computedGroupPositions && computedGroupPositions.size > 0) {
                    setBoardGroups(prev => prev.map(group => {
                        const newPos = computedGroupPositions.get(group.id);
                        return newPos ? { ...group, x: newPos.x, y: newPos.y } : group;
                    }));
                }

                if (elementStartPositions.memos && elementStartPositions.memos.size > 0) {
                    useCanvasStore.setState(state => ({
                        memos: state.memos.map(memo => {
                            const startPos = elementStartPositions.memos.get(memo.id);
                            if (startPos) {
                                const dx = (upEvent.clientX - startX) / zoom;
                                const dy = (upEvent.clientY - startY) / zoom;
                                return { ...memo, x: startPos.x + dx, y: startPos.y + dy };
                            }
                            return memo;
                        })
                    }));
                }

                setTimeout(() => {
                    const { boardImages, boardGroups, groupEditModeId, selectedImageIds } = useCanvasStore.getState();
                    const draggedImageIds = new Set(Array.from(elementStartPositions.images.keys()).filter(id => selectedImageIds.has(id)));

                    if (groupEditModeId) {
                        const editGroup = boardGroups.find(g => g.id === groupEditModeId);
                        if (editGroup) {
                            draggedImageIds.forEach(id => {
                                const img = useCanvasStore.getState().boardImages.find(i => i.id === id);
                                if (img) {
                                    const imgCenter = { x: img.x + img.width / 2, y: img.y + img.height / 2 };
                                    const isInsideGroupBounds =
                                        imgCenter.x >= editGroup.x && imgCenter.x <= editGroup.x + editGroup.width &&
                                        imgCenter.y >= editGroup.y && imgCenter.y <= editGroup.y + editGroup.height;

                                    if (img.groupId === groupEditModeId && !isInsideGroupBounds) {
                                        removeImageFromGroup(id);
                                    } else if (!img.groupId && isInsideGroupBounds) {
                                        if (useSettingsStore.getState().groupAutoAdd) {
                                            useCanvasStore.getState().setSelectedImageIds(() => new Set([id]));
                                            dropSelectionOnGroup(groupEditModeId);
                                        }
                                    }
                                }
                            });
                        }
                    } else if (draggedImageIds.size > 0) {
                        if (useSettingsStore.getState().groupAutoAdd) {
                            const firstDraggedImageId = Array.from(draggedImageIds)[0];
                            const firstDraggedImage = useCanvasStore.getState().boardImages.find(img => img.id === firstDraggedImageId);
                            if (firstDraggedImage) {
                                const imageCenter = { x: firstDraggedImage.x + firstDraggedImage.width / 2, y: firstDraggedImage.y + firstDraggedImage.height / 2 };
                                const targetGroup = useCanvasStore.getState().boardGroups.find(group => (
                                    group.id !== firstDraggedImage.groupId &&
                                    imageCenter.x >= group.x && imageCenter.x <= group.x + group.width &&
                                    imageCenter.y >= group.y && imageCenter.y <= group.y + group.height
                                ));

                                if (targetGroup) {
                                    dropSelectionOnGroup(targetGroup.id);
                                }
                            }
                        }
                    }
                    // Save history after all drag + group updates are applied
                    useCanvasStore.getState().saveHistory('move');
                }, 0);
            } else if (type === 'marquee' && marqueeRect) {
                if (marqueeRect.width * zoom > 5 || marqueeRect.height * zoom > 5) {
                    const affectedImageIds = new Set<string>();
                    const affectedGroupIds = new Set<string>();

                    boardImages.forEach(img => {
                        if (!img.groupId && img.x < marqueeRect.x + marqueeRect.width && img.x + img.width > marqueeRect.x && img.y < marqueeRect.y + marqueeRect.height && img.y + img.height > marqueeRect.y) {
                            affectedImageIds.add(img.id);
                        }
                    });

                    boardGroups.forEach(group => {
                        if (group.x < marqueeRect.x + marqueeRect.width && group.x + group.width > marqueeRect.x && group.y < marqueeRect.y + marqueeRect.height && group.y + group.height > marqueeRect.y) {
                            affectedGroupIds.add(group.id);
                        }
                    });

                    setSelectedImageIds(prev => upEvent.shiftKey ? new Set([...prev, ...affectedImageIds]) : affectedImageIds);
                    setSelectedGroupIds(prev => upEvent.shiftKey ? new Set([...prev, ...affectedGroupIds]) : affectedGroupIds);
                } else if (!upEvent.shiftKey) {
                    setSelectedImageIds(() => new Set());
                    setSelectedGroupIds(() => new Set());
                }
            }

            setMarquee(null);

            // [FIX FLICK] Enable flick panning for ALL pan modes (Space+LMB, MMB, RMB)
            // Previously RMB was excluded to match Photoshop, but user wants consistent flick behavior.
            const panButton = interactionRef.current.panButton;
            const flickAllowed = true; // All pan modes support flick

            if (type === 'pan' && flickAllowed && useSettingsStore.getState().flickPanning) {
                const history = panVelocityHistoryRef.current;
                const now = performance.now();
                // [FIX FLICK] Photoshop behavior: if the user paused (stopped moving)
                // before releasing the mouse, no inertia should occur.
                // 80ms threshold — if last movement was longer ago, consider it a "pause".
                const lastSample = history.length > 0 ? history[history.length - 1] : null;
                const isStale = !lastSample || (now - lastSample.t) > 80;

                if (!isStale && history.length >= 2) {
                    const oldest = history[0];
                    const newest = history[history.length - 1];
                    const dt = newest.t - oldest.t;
                    if (dt > 0) {
                        let vx = ((newest.x - oldest.x) / dt) * 16.67; // px per frame (60fps)
                        let vy = ((newest.y - oldest.y) / dt) * 16.67;
                        const speed = Math.sqrt(vx * vx + vy * vy);
                        const MAX_SPEED = 50;
                        if (speed > MAX_SPEED) {
                            const scale = MAX_SPEED / speed;
                            vx *= scale;
                            vy *= scale;
                        }
                        // [FIX FLICK] Very low threshold: any movement triggers inertia (Photoshop behavior)
                        if (speed > 0.1) {
                            startFlickAnimation(vx, vy);
                        }
                    }
                }
                panVelocityHistoryRef.current = [];
            }

            interactionRef.current = null;
            setOverrideSelectionBounds(null);
            setOverrideActionRingPosition(null);
        };

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!interactionRef.current) return;
            // Prevent native text selection while dragging on canvas
            e.preventDefault();
            handleMouseMove(e);
        };
        const handleGlobalMouseUp = (e: MouseEvent) => { if (interactionRef.current) handleMouseUp(e); };

        // Block native text selection during any canvas interaction (drag, pan, marquee)
        const handleSelectStart = (e: Event) => {
            if (interactionRef.current) e.preventDefault();
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('selectstart', handleSelectStart);
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            document.removeEventListener('selectstart', handleSelectStart);
        };
    }, []);

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>, elementId?: string, elementType?: 'image' | 'group' | 'memo') => {
        e.preventDefault(); e.stopPropagation();

        // Suppress context menu if right-click was used for panning (mouse moved during hold).
        if (hasPannedRef.current) {
            hasPannedRef.current = false;
            return;
        }

        // Don't auto-select on right-click - just show menu for current selection or clicked element
        // This prevents the selection bar from appearing on right-click

        setTimeout(() => {
            const { selectedImageIds, selectedGroupIds, selectedMemoIds, boardImages, boardGroups, groupEditModeId, setGroupEditModeId } = useCanvasStore.getState();

            const isBackgroundClick = !elementId;
            const hasSelection = selectedImageIds.size > 0 || selectedGroupIds.size > 0;
            const canAlign = groupEditModeId
                ? selectedImageIds.size > 1
                : (selectedImageIds.size + selectedGroupIds.size + selectedMemoIds.size) > 1;

            // === ALIGN ROLE IMAGES ITEM (always available) ===
            const hasOriginal = boardImages.some(i => i.role === 'original');
            const hasOtherRoleImages = boardImages.some(i => i.role !== 'none' && i.role !== 'original');
            const alignRoleImagesItem: ContextMenuItem = {
                label: t('contextMenu.alignRoleImages', language),
                onClick: alignRoleImagesToOriginal,
                disabled: !hasOriginal || !hasOtherRoleImages,
            };

            // === SHARED SELECTION ITEMS ===
            const selectionItems: ContextMenuItem[] = [];
            if (hasSelection) {
                selectionItems.push({ label: t('contextMenu.copyImages', language), onClick: onCopySelection });
            }
            selectionItems.push({ label: t('contextMenu.alignImages', language), onClick: alignSelection, disabled: !canAlign });
            if (!groupEditModeId) {
                const imagesInSelectionAreUngrouped = Array.from(selectedImageIds).every(id => !boardImages.find(i => i.id === id)?.groupId);
                if (selectedImageIds.size > 1 && imagesInSelectionAreUngrouped) {
                    selectionItems.push({ label: t('contextMenu.groupSelection', language), onClick: groupSelection });
                }
                if (selectedGroupIds.size >= 2) {
                    selectionItems.push({ label: t('contextMenu.mergeGroups', language), onClick: () => useCanvasStore.getState().setMergeGroupsModalOpen(true) });
                }
                if (selectedGroupIds.size > 0) {
                    selectionItems.push({ label: t('contextMenu.ungroupSelection', language), onClick: ungroupSelection });
                    if (selectedGroupIds.size === 1) {
                        const groupId = Array.from(selectedGroupIds)[0];
                        selectionItems.push({ label: t('contextMenu.renameGroup', language), onClick: () => setEditingGroupId(groupId) });
                        selectionItems.push({ label: t('contextMenu.editGroup', language), onClick: () => setGroupEditModeId(groupId) });
                        const makeGroupDownloadHandler = (fmt: 'png' | 'webp') => async () => {
                            const count = await useCanvasStore.getState().downloadGroup(groupId, fmt);
                            if (count > 0) {
                                const message = count === 1
                                    ? t('downloadComplete', language)
                                    : t('downloadCompleteMultiple', language, { count });
                                onNotification(message, 'success');
                            }
                        };
                        selectionItems.push({ label: `${t('contextMenu.downloadGroupImages', language)} (PNG)`, onClick: makeGroupDownloadHandler('png') });
                        selectionItems.push({ label: `${t('contextMenu.downloadGroupImages', language)} (WebP)`, onClick: makeGroupDownloadHandler('webp') });
                    }
                }
                if (selectedImageIds.size >= 2) {
                    const makeSelectionDownloadHandler = (fmt: 'png' | 'webp') => async () => {
                        const count = await useCanvasStore.getState().downloadImagesByIds(Array.from(selectedImageIds), fmt);
                        if (count > 0) {
                            const message = count === 1
                                ? t('downloadComplete', language)
                                : t('downloadCompleteMultiple', language, { count });
                            onNotification(message, 'success');
                        }
                    };
                    selectionItems.push({ label: `${t('contextMenu.downloadSelectedImages', language)} (PNG)`, onClick: makeSelectionDownloadHandler('png') });
                    selectionItems.push({ label: `${t('contextMenu.downloadSelectedImages', language)} (WebP)`, onClick: makeSelectionDownloadHandler('webp') });
                }
            }

            let allItems: ContextMenuItem[] = [];

            if (isBackgroundClick) {
                // === IMAGE GROUP ===
                const imageGroupItems: ContextMenuItem[] = [];

                if (groupEditModeId) {
                    imageGroupItems.push({ label: t('contextMenu.exitGroupEdit', language), onClick: () => setGroupEditModeId(null) });
                    imageGroupItems.push({ type: 'separator' });
                }

                imageGroupItems.push({ label: t('contextMenu.uploadImage', language), onClick: () => fileInputRef.current?.click() });
                imageGroupItems.push({ label: t('contextMenu.paste', language), onClick: () => onPasteFromClipboard({ x: e.clientX, y: e.clientY }) });

                const addMemoItem: ContextMenuItem = {
                    label: t('contextMenu.addMemo', language),
                    onClick: () => {
                        if (!canvasRef.current) return;
                        const rect = canvasRef.current.getBoundingClientRect();
                        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
                        const canvasY = (e.clientY - rect.top - pan.y) / zoom;
                        const { addMemo, zIndexCounter } = useCanvasStore.getState();
                        addMemo({
                            id: `memo-${crypto.randomUUID()}`,
                            text: 'New Memo',
                            x: canvasX,
                            y: canvasY,
                            width: 200,
                            height: 100,
                            fontSize: 14,
                            color: '#FFFF00',
                            zIndex: zIndexCounter + 1,
                            rotation: 0,
                        });
                    }
                };

                const requestAiSortConfirm = () => {
                    const { canvasTabRouter, canvasStoreRegistry } = require('../../../store/canvasStore');
                    const tabId: string = canvasTabRouter.getActiveTabId();
                    const inst = canvasStoreRegistry.getInstance(tabId);
                    const tabImages: { groupId?: string }[] = inst?.getState().boardImages ?? [];
                    const ungroupedCount = tabImages.filter((img: { groupId?: string }) => !img.groupId).length;
                    if (ungroupedCount < 2) {
                        onNotification(t('aiSort.needMore', language), 'error');
                        return;
                    }
                    const { useUIStore } = require('../../../store/uiStore');
                    const ui = useUIStore.getState();
                    ui.setPendingAiSortTabId(tabId);
                    ui.setPendingAiSortUngroupedCount(ungroupedCount);
                    ui.setShowAiSortConfirmModal(true);
                };

                const isAiSortDisabled = boardImages.filter(img => !img.groupId).length < 2;
                imageGroupItems.push({
                    label: t('contextMenu.aiSortImages', language),
                    disabled: isAiSortDisabled,
                    onClick: requestAiSortConfirm,
                });
                imageGroupItems.push(alignRoleImagesItem);

                if (selectionItems.length > 0) {
                    imageGroupItems.push(...selectionItems);
                }

                // === WORKSPACE GROUP ===
                const hasContent = boardImages.length > 0 || boardGroups.length > 0;
                const workspaceGroupItems: ContextMenuItem[] = [
                    { label: t('contextMenu.newWorkspace', language), onClick: () => onNewWorkspace() },
                    { type: 'separator' },
                    { label: t('contextMenu.loadWorkspace', language), onClick: () => onLoadWorkspace() },
                    { label: t('contextMenu.saveWorkspace', language), onClick: onSaveWorkspace, disabled: !hasContent },
                    { label: t('contextMenu.saveWorkspaceAs', language), onClick: onSaveWorkspaceAs, disabled: !hasContent },
                    { type: 'separator' },
                    { label: t('contextMenu.quitApp', language), onClick: () => (window as any).electronAPI.quitApp() },
                ];

                allItems = [
                    ...imageGroupItems,
                    { type: 'separator' },
                    addMemoItem,
                    { type: 'separator' },
                    ...workspaceGroupItems,
                ];
            } else {
                // === ELEMENT CLICK ===
                const imageGroupItems: ContextMenuItem[] = [];

                if (elementType === 'memo' && elementId) {
                    imageGroupItems.push({
                        label: t('contextMenu.deleteMemo', language),
                        onClick: () => useCanvasStore.getState().deleteMemo(elementId),
                    });
                }

                if (elementType === 'image' && elementId) {
                    const targetImage = boardImages.find(img => img.id === elementId);
                    if (targetImage) {
                        const pick = (s?: string | null) => (s && s.length > 0 ? s : null);
                        const fullQualSrc =
                            pick(targetImage.originalSrc) ||
                            pick(targetImage.highResSrc) ||
                            pick(targetImage.previewSrc) ||
                            pick(targetImage.proxySrc) ||
                            pick(targetImage.src) ||
                            '';

                        imageGroupItems.push({
                            label: t('contextMenu.flipHorizontal', language),
                            onClick: () => {
                                const { boardImages: imgs, updateImageWithHistory } = useCanvasStore.getState();
                                const target = imgs.find(i => i.id === elementId);
                                if (target) updateImageWithHistory(elementId, { scaleX: target.scaleX === -1 ? 1 : -1 });
                            },
                        });
                        imageGroupItems.push({ label: t('contextMenu.zoomImage', language), onClick: () => onZoomSelection(fullQualSrc) });
                        imageGroupItems.push({
                            label: `${t('contextMenu.download', language)} (PNG)`,
                            onClick: async () => {
                                await downloadSingleImage(targetImage, elementId, fullQualSrc as string, 'png');
                            }
                        });
                        imageGroupItems.push({
                            label: `${t('contextMenu.download', language)} (WebP)`,
                            onClick: async () => {
                                await downloadSingleImage(targetImage, elementId, fullQualSrc as string, 'webp');
                            }
                        });
                        imageGroupItems.push({
                            label: t('contextMenu.delete', language),
                            onClick: () => {
                                useCanvasStore.getState().setBoardImages(prev => prev.filter(img => img.id !== elementId));
                            }
                        });
                    }
                }

                // Add workflow item if applicable
                const targetImageId = elementType === 'image' ? elementId : (selectedImageIds.size === 1 ? Array.from(selectedImageIds)[0] : null);
                const targetImageForParams = boardImages.find(img => img.id === targetImageId);
                if (targetImageForParams?.generationParams) {
                    if (imageGroupItems.length > 0) imageGroupItems.push({ type: 'separator' });
                    imageGroupItems.push({ label: t('contextMenu.loadWorkflow', language), onClick: () => onLoadGenerationParams(targetImageForParams.generationParams!) });
                }

                if (imageGroupItems.length > 0) imageGroupItems.push({ type: 'separator' });
                imageGroupItems.push(alignRoleImagesItem);

                if (selectionItems.length > 0) {
                    if (imageGroupItems.length > 0) imageGroupItems.push({ type: 'separator' });
                    imageGroupItems.push(...selectionItems);
                }

                if (imageGroupItems.length > 0) {
                    allItems = [...imageGroupItems];
                }
            }

            if (allItems.length > 0) {
                setContextMenu({ x: e.clientX, y: e.clientY, onClose: () => setContextMenu(null), items: allItems });
            }
        }, 50);
    };

    return {
        canvasRef,
        fileInputRef,
        cursorClass,
        isDraggingOver,
        selectionBounds: overrideSelectionBounds || selectionBounds,
        actionRingPosition: overrideActionRingPosition || actionRingPosition,
        contextMenu,
        handleDrop,
        handleDragEnter,
        handleDragLeave,
        handleMouseDownOnCanvas,
        handleContextMenu,
        handleElementMouseDown,
        handleUploadAndPositionImages,
        // FIX: Return pan, zoom, and marquee
        pan,
        zoom,
        marquee,
    };
};