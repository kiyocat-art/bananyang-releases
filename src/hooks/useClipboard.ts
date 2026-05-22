import { useCallback, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { t, Language } from '../localization';
import { BoardImage } from '../types';
// [FIX C-3] Import from shared utility instead of local duplicate
import { dataURLtoFile } from '../utils/imageUtils';

/**
 * [INTERNAL CLIPBOARD] 앱 내부 다중 이미지 클립보드
 * OS 클립보드는 다중 이미지를 지원하지 않으므로 내부적으로 관리
 */
interface InternalClipboardItem {
    file: File;
    width: number;
    height: number;
}

let internalClipboard: InternalClipboardItem[] = [];
let internalClipboardTimestamp = 0;

// 내부 클립보드 설정
const setInternalClipboard = (items: InternalClipboardItem[]) => {
    internalClipboard = items;
    internalClipboardTimestamp = Date.now();
    console.log(`[Clipboard] Internal clipboard set with ${items.length} images`);
};

// 내부 클립보드 가져오기 (5분 후 만료)
const getInternalClipboard = (): InternalClipboardItem[] => {
    const EXPIRY_MS = 5 * 60 * 1000; // 5분
    if (Date.now() - internalClipboardTimestamp > EXPIRY_MS) {
        internalClipboard = [];
        return [];
    }
    return internalClipboard;
};

// 내부 클립보드 비우기 (향후 사용 예정)
const _clearInternalClipboard = () => {
    internalClipboard = [];
    internalClipboardTimestamp = 0;
};
void _clearInternalClipboard; // Suppress unused warning

/**
 * [FIX] Robust blob extraction from BoardImage
 * Tries ALL available sources to avoid stale blob URL issues.
 * Handles tiny mode where only tinyFile/tinySrc might be valid.
 */
const getBlobFromImage = async (img: BoardImage): Promise<Blob | null> => {
    // Helper: Check if blob is valid
    const isValidBlob = (b: any): b is Blob => b instanceof Blob && b.size > 0;

    // Priority 1: Use file objects (most reliable, best quality first)
    const fileObjects = [
        img.originalFile,
        img.file,
        img.proxyFile,
        img.tinyFile,
    ];

    for (const fileObj of fileObjects) {
        if (isValidBlob(fileObj)) {
            console.log(`[Clipboard] Using file object for ${img.id}`);
            return fileObj;
        }
    }

    // Priority 2: Try fetching from URLs (data URLs first, then blob URLs)
    // Priority 2: Try fetching from URLs (data URLs first, then blob URLs)
    // [RESOLUTION FIX] Order adjusted to prioritize high resolution
    const urlsToTry = [
        img.originalSrc,       // 1. Original (Max Quality)
        img.highResSrc,        // 2. High Res
        img.previewSrc,        // 3. Preview (1K)
        img.filePath ? `file:///${img.filePath.replace(/\\/g, '/')}` : null, // 4. Local File (Disk)
        img.originalFilePath ? `file:///${img.originalFilePath.replace(/\\/g, '/')}` : null, // 5. Local Original (Disk)
        img.proxySrc,          // 6. Proxy
        img.src,               // 7. Standard Src
        // Explicitly exclude thumbnailSrc/tinySrc unless nothing else exists
    ].filter((url): url is string => typeof url === 'string' && url.length > 0 && !url.includes('tiny') && !url.includes('thumbnail'));

    // If no high-res URLs found, fall back to low-res
    if (urlsToTry.length === 0) {
        if (img.src) urlsToTry.push(img.src);
        if (img.thumbnailSrc) urlsToTry.push(img.thumbnailSrc);
        if (img.tinySrc) urlsToTry.push(img.tinySrc);
    }

    // Sort: data URLs first (always work), then blob URLs
    const sortedUrls = urlsToTry.sort((a, b) => {
        const aIsData = a.startsWith('data:') ? 0 : 1;
        const bIsData = b.startsWith('data:') ? 0 : 1;
        return aIsData - bIsData;
    });

    for (const url of sortedUrls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 0) {
                    console.log(`[Clipboard] Fetched blob from URL for ${img.id}: ${url.substring(0, 50)}...`);
                    return blob;
                }
            }
        } catch (e) {
            // Continue to next URL
            console.log(`[Clipboard] Failed to fetch ${url.substring(0, 30)}...: ${e}`);
        }
    }

    console.error(`[Clipboard] All sources failed for image: ${img.id}`, {
        hasFile: !!img.file,
        hasOriginalFile: !!img.originalFile,
        hasProxyFile: !!img.proxyFile,
        hasTinyFile: !!img.tinyFile,
        urls: sortedUrls.map(u => u.substring(0, 30) + '...')
    });
    return null;
};

interface UseClipboardOptions {
    language: Language;
    onNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    isModalOpen: boolean;
    unifiedEditingImage: BoardImage | null;
    handleUploadAndPositionImages: (files: File[], position?: { x: number; y: number }) => Promise<void>;
}

interface UseClipboardReturn {
    compositeSelectionToBlob: () => Promise<Blob | null>;
    handleCopyToClipboard: () => Promise<Blob | null>;
    handlePasteFromClipboard: (position?: { x: number; y: number }) => Promise<void>;
}

export function useClipboard({
    language,
    onNotification,
    isModalOpen,
    unifiedEditingImage,
    handleUploadAndPositionImages,
}: UseClipboardOptions): UseClipboardReturn {
    const compositeSelectionToBlob = useCallback(async (): Promise<Blob | null> => {
        const { boardImages, selectedImageIds, selectedGroupIds, boardGroups } = useCanvasStore.getState();

        const imageIdsInSelectedGroups = new Set(
            boardGroups.filter(g => selectedGroupIds.has(g.id)).flatMap(g => g.imageIds)
        );
        const allImageIdsToComposite = new Set([...selectedImageIds, ...imageIdsInSelectedGroups]);
        const imagesToComposite = boardImages.filter(img => allImageIdsToComposite.has(img.id));

        if (imagesToComposite.length === 0) return null;

        try {
            // If only one image is selected, convert it to a PNG blob to ensure clipboard compatibility.
            if (imagesToComposite.length === 1) {
                const image = imagesToComposite[0];
                const blob = await getBlobFromImage(image);
                if (!blob) return null;

                const imgBitmap = await createImageBitmap(blob);

                const canvas = document.createElement('canvas');
                canvas.width = imgBitmap.width;
                canvas.height = imgBitmap.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    imgBitmap.close();
                    return null;
                }
                if (image.scaleX === -1) {
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(imgBitmap, 0, 0);

                // [FIX] ImageBitmap 메모리 해제
                imgBitmap.close();

                return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            }

            // Load all images using robust blob extraction
            const loadedImages = await Promise.all(
                imagesToComposite.map(async (imgData) => {
                    try {
                        const blob = await getBlobFromImage(imgData);
                        if (!blob) return null;

                        const imgBitmap = await createImageBitmap(blob);
                        return { el: imgBitmap, data: imgData };
                    } catch (e) {
                        console.error(`[Clipboard] Failed to load image: ${imgData.id}`, e);
                        return null;
                    }
                })
            );

            const validImages = loadedImages.filter((item): item is { el: ImageBitmap, data: BoardImage } => item !== null);
            if (validImages.length === 0) {
                console.error('[Clipboard] No valid images could be loaded for composite');
                return null;
            }

            // Find the maximum scaling factor
            const maxScale = validImages.reduce((max, { el, data }) => {
                if (data.width > 0) {
                    return Math.max(max, el.width / data.width);
                }
                return max;
            }, 1);

            const minX = Math.min(...imagesToComposite.map(i => i.x));
            const minY = Math.min(...imagesToComposite.map(i => i.y));
            const maxX = Math.max(...imagesToComposite.map(i => i.x + i.width));
            const maxY = Math.max(...imagesToComposite.map(i => i.y + i.height));

            const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            if (bounds.width <= 0 || bounds.height <= 0) return null;

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bounds.width * maxScale);
            canvas.height = Math.round(bounds.height * maxScale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            imagesToComposite.sort((a, b) => a.zIndex - b.zIndex);

            imagesToComposite.forEach(imgData => {
                const loadedImg = validImages.find(li => li.data.id === imgData.id);
                if (loadedImg) {
                    const x = (imgData.x - minX) * maxScale;
                    const y = (imgData.y - minY) * maxScale;
                    const w = imgData.width * maxScale;
                    const h = imgData.height * maxScale;
                    ctx.save();
                    if (imgData.scaleX === -1) {
                        ctx.translate(x + w, y);
                        ctx.scale(-1, 1);
                        ctx.drawImage(loadedImg.el, 0, 0, w, h);
                    } else {
                        ctx.drawImage(loadedImg.el, x, y, w, h);
                    }
                    ctx.restore();
                }
            });

            // [FIX] 사용 완료된 ImageBitmap 메모리 해제
            validImages.forEach(({ el }) => el.close());

            return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        } catch (error) {
            console.error("Error compositing images for clipboard:", error);
            return null;
        }
    }, []);

    const handleCopyToClipboard = useCallback(async (): Promise<Blob | null> => {
        const { selectedImageIds, selectedGroupIds, boardImages, boardGroups } = useCanvasStore.getState();
        if (selectedImageIds.size === 0 && selectedGroupIds.size === 0) return null;

        // Collect all images to copy
        const imageIdsInSelectedGroups = new Set(
            boardGroups.filter(g => selectedGroupIds.has(g.id)).flatMap(g => g.imageIds)
        );
        const allImageIdsToCopy = new Set([...selectedImageIds, ...imageIdsInSelectedGroups]);
        let imagesToCopy = boardImages.filter(img => allImageIdsToCopy.has(img.id));

        if (imagesToCopy.length === 0) return null;

        // [LIMIT] 최대 20장까지만 복사 가능
        const MAX_COPY_LIMIT = 20;
        if (imagesToCopy.length > MAX_COPY_LIMIT) {
            onNotification(t('notification.clipboard.copyLimitExceeded', language, { count: MAX_COPY_LIMIT }), 'error');
            return null;
        }

        // [LOADING] 2개 이상일 경우 로딩 오버레이 표시
        const BULK_THRESHOLD = 2;
        const isBulkCopy = imagesToCopy.length >= BULK_THRESHOLD;
        let uiStoreModule: typeof import('../store/uiStore') | null = null;

        if (isBulkCopy) {
            try {
                uiStoreModule = await import('../store/uiStore');
                uiStoreModule.useUIStore.getState().setLoadingState({
                    isLoading: true,
                    message: t('notification.clipboard.copying', language),
                    progress: 0,
                    isReversed: false,
                    variant: 'glass',
                });
                uiStoreModule.useUIStore.getState().setIsOverlayVisible(true);
            } catch (e) {
                console.warn('Failed to load UI store for copy loading overlay', e);
                // Continue copy even if loading overlay fails
            }
        }

        try {
            // [STEP 1] 내부 클립보드에 개별 이미지들 저장 (앱 내 붙여넣기용)
            const internalItems: InternalClipboardItem[] = [];
            let processedCount = 0;

            let failedCount = 0;
            for (const img of imagesToCopy) {
                const blob = await getBlobFromImage(img);
                if (blob) {
                    const file = blob instanceof File
                        ? blob
                        : new File([blob], `copied_${img.id}.png`, { type: blob.type || 'image/png' });
                    internalItems.push({
                        file,
                        width: img.width,
                        height: img.height,
                    });
                } else {
                    failedCount++;
                }

                // 진행률 업데이트 (70%까지 - 나머지 30%는 합성용)
                if (isBulkCopy && uiStoreModule) {
                    processedCount++;
                    const progress = Math.round((processedCount / imagesToCopy.length) * 70);
                    uiStoreModule.useUIStore.getState().setLoadingState({ progress });
                }
            }

            console.log(`[Clipboard] Internal clipboard: ${internalItems.length} success, ${failedCount} failed`);

            if (internalItems.length === 0) {
                if (isBulkCopy && uiStoreModule) {
                    uiStoreModule.useUIStore.getState().setLoadingState({ isLoading: false });
                    uiStoreModule.useUIStore.getState().setIsOverlayVisible(false);
                }
                onNotification(t('notification.clipboard.loadError', language), 'error');
                return null;
            }

            setInternalClipboard(internalItems);

            // [STEP 2] OS 클립보드에 합성 이미지 저장 (외부 앱 붙여넣기용)
            if (isBulkCopy && uiStoreModule) {
                uiStoreModule.useUIStore.getState().setLoadingState({ progress: 80 });
            }

            const blob = await compositeSelectionToBlob();
            if (!blob) {
                if (isBulkCopy && uiStoreModule) {
                    uiStoreModule.useUIStore.getState().setLoadingState({ isLoading: false });
                    uiStoreModule.useUIStore.getState().setIsOverlayVisible(false);
                }
                onNotification(t('error.copyFailed', language), 'error');
                return null;
            }

            // Write to OS clipboard
            if (window.electronAPI) {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                window.electronAPI.writeImage(dataUrl);
            } else {
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            }

            // 로딩 완료
            if (isBulkCopy && uiStoreModule) {
                uiStoreModule.useUIStore.getState().setLoadingState({ progress: 100 });
                setTimeout(() => {
                    uiStoreModule!.useUIStore.getState().setLoadingState({ isLoading: false });
                    uiStoreModule!.useUIStore.getState().setIsOverlayVisible(false);
                }, 300);
            }

            // 알림
            onNotification(
                imagesToCopy.length > 1
                    ? t('copy.successMultiple', language, { count: imagesToCopy.length })
                    : t('copy.success', language),
                'success'
            );
            return blob;
        } catch (error) {
            // 에러 시 로딩 숨김
            if (isBulkCopy && uiStoreModule) {
                uiStoreModule.useUIStore.getState().setLoadingState({ isLoading: false });
                uiStoreModule.useUIStore.getState().setIsOverlayVisible(false);
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("[Clipboard] Copy failed:", errorMessage);
            onNotification(t('error.copyFailed', language), 'error');
            return null;
        }
    }, [compositeSelectionToBlob, language, onNotification]);

    const handlePasteFromClipboard = useCallback(async (position?: { x: number; y: number }) => {
        try {
            const files: File[] = [];

            // [PRIORITY 1] 내부 클립보드 확인 (앱 내 복사된 다중 이미지)
            const internalItems = getInternalClipboard();
            if (internalItems.length > 0) {
                console.log(`[Clipboard] Using internal clipboard: ${internalItems.length} images`);

                // [LOADING] 2개 이상일 경우 로딩 오버레이 표시
                const BULK_THRESHOLD = 2;
                const isBulkPaste = internalItems.length >= BULK_THRESHOLD;

                if (isBulkPaste) {
                    const { useUIStore } = await import('../store/uiStore');
                    useUIStore.getState().setLoadingState({
                        isLoading: true,
                        message: t('notification.clipboard.pasting', language),
                        progress: 0,
                        isReversed: false,
                        variant: 'glass',
                    });
                    useUIStore.getState().setIsOverlayVisible(true);
                }

                const internalFiles = internalItems.map(item => item.file);
                await handleUploadAndPositionImages(internalFiles, position);

                // 로딩은 uploadImages에서 자동으로 관리됨 (20개 이상)
                // 2-19개의 경우 여기서 숨김 처리
                if (isBulkPaste && internalItems.length < 20) {
                    const { useUIStore } = await import('../store/uiStore');
                    setTimeout(() => {
                        useUIStore.getState().setLoadingState({ isLoading: false });
                        useUIStore.getState().setIsOverlayVisible(false);
                    }, 300);
                }
                return;
            }

            // [PRIORITY 2] OS 클립보드 (외부에서 복사된 이미지)
            // 2a. Try generic navigator.clipboard (Supports multiple items)
            try {
                const clipboardItems = await navigator.clipboard.read();

                for (const item of clipboardItems) {
                    // Find image type
                    const imageType = item.types.find(type => type.startsWith('image/'));
                    if (imageType) {
                        const blob = await item.getType(imageType);
                        // Assign unique name for each
                        files.push(new File([blob], `pasted_image_${Date.now()}_${files.length}.png`, { type: blob.type }));
                    }
                }
            } catch (navError) {
                console.warn('navigator.clipboard.read() failed or not supported, trying fallback:', navError);
            }

            // 2b. If no files found via navigator, try Electron API (Fallback for single image)
            if (files.length === 0 && window.electronAPI) {
                const dataUrl = await window.electronAPI.readImage();
                if (dataUrl) {
                    const file = await dataURLtoFile(dataUrl, `pasted_image_${Date.now()}.png`);
                    files.push(file);
                }
            }

            if (files.length > 0) {
                // [LOADING] 2개 이상일 경우 로딩 오버레이 표시 (OS 클립보드)
                const BULK_THRESHOLD = 2;
                const isBulkPaste = files.length >= BULK_THRESHOLD;
                let uiStoreModule: typeof import('../store/uiStore') | null = null;

                if (isBulkPaste) {
                    uiStoreModule = await import('../store/uiStore');
                    uiStoreModule.useUIStore.getState().setLoadingState({
                        isLoading: true,
                        message: t('notification.clipboard.pasting', language),
                        progress: 0,
                        isReversed: false,
                        variant: 'glass',
                    });
                    uiStoreModule.useUIStore.getState().setIsOverlayVisible(true);
                }

                await handleUploadAndPositionImages(files, position);

                // 로딩 종료 (20개 미만일 경우 여기서 닫기, 20개 이상은 uploadImages에서 처리됨)
                if (isBulkPaste && files.length < 20 && uiStoreModule) {
                    setTimeout(() => {
                        uiStoreModule!.useUIStore.getState().setLoadingState({ isLoading: false });
                        uiStoreModule!.useUIStore.getState().setIsOverlayVisible(false);
                    }, 300);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to read from clipboard:', errorMessage);
            onNotification(t('error.pasteImage', language), 'error');
        }
    }, [handleUploadAndPositionImages, language, onNotification]);

    // Register paste handler
    useEffect(() => {
        const pasteHandler = async (e: ClipboardEvent) => {
            if ((isModalOpen && !unifiedEditingImage) ||
                document.activeElement instanceof HTMLInputElement ||
                document.activeElement instanceof HTMLTextAreaElement) {
                return;
            }
            e.preventDefault();

            // [PRIORITY 1] 내부 클립보드 확인 (앱 내 복사된 다중 이미지)
            const internalItems = getInternalClipboard();
            if (internalItems.length > 0) {
                console.log(`[Clipboard] Paste event: using internal clipboard (${internalItems.length} images)`);

                // [LOADING] 2개 이상일 경우 로딩 오버레이 표시
                const BULK_THRESHOLD = 2;
                const isBulkPaste = internalItems.length >= BULK_THRESHOLD;

                if (isBulkPaste) {
                    const { useUIStore } = await import('../store/uiStore');
                    useUIStore.getState().setLoadingState({
                        isLoading: true,
                        message: t('notification.clipboard.pasting', language),
                        progress: 0,
                        isReversed: false,
                        variant: 'glass',
                    });
                    useUIStore.getState().setIsOverlayVisible(true);
                }

                const internalFiles = internalItems.map(item => item.file);
                await handleUploadAndPositionImages(internalFiles);

                // 2-19개의 경우 여기서 로딩 숨김 (20개 이상은 uploadImages에서 관리)
                if (isBulkPaste && internalItems.length < 20) {
                    const { useUIStore } = await import('../store/uiStore');
                    setTimeout(() => {
                        useUIStore.getState().setLoadingState({ isLoading: false });
                        useUIStore.getState().setIsOverlayVisible(false);
                    }, 300);
                }
                return;
            }

            // [PRIORITY 2] OS 클립보드 (외부에서 복사된 이미지)
            // If event has clipboardData, prioritize it (synchronous access to items)
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const droppedFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
                if (droppedFiles.length > 0) {
                    // [LOADING] 2개 이상일 경우 로딩 오버레이 표시 (OS 클립보드 - 동기 이벤트)
                    const BULK_THRESHOLD = 2;
                    const isBulkPaste = droppedFiles.length >= BULK_THRESHOLD;
                    let uiStoreModule: typeof import('../store/uiStore') | null = null;

                    if (isBulkPaste) {
                        try {
                            uiStoreModule = await import('../store/uiStore');
                            uiStoreModule.useUIStore.getState().setLoadingState({
                                isLoading: true,
                                message: t('notification.clipboard.pasting', language),
                                progress: 0,
                                isReversed: false,
                                variant: 'glass',
                            });
                            uiStoreModule.useUIStore.getState().setIsOverlayVisible(true);
                        } catch (e) {
                            console.warn('Failed to load UI store for paste loading overlay', e);
                        }
                    }

                    await handleUploadAndPositionImages(droppedFiles);

                    if (isBulkPaste && droppedFiles.length < 20 && uiStoreModule) {
                        setTimeout(() => {
                            uiStoreModule!.useUIStore.getState().setLoadingState({ isLoading: false });
                            uiStoreModule!.useUIStore.getState().setIsOverlayVisible(false);
                        }, 300);
                    }
                    return;
                }
            }

            // Fallback to async handler
            handlePasteFromClipboard();
        };

        document.addEventListener('paste', pasteHandler);
        return () => {
            document.removeEventListener('paste', pasteHandler);
        };
    }, [handlePasteFromClipboard, isModalOpen, unifiedEditingImage, handleUploadAndPositionImages]);

    // Register copy handler
    useEffect(() => {
        console.log('[Clipboard] Registering copy handler, isModalOpen:', isModalOpen);

        const copyHandler = (e: ClipboardEvent) => {
            const { zoom } = useCanvasStore.getState();
            console.log('[Clipboard] Copy event triggered', {
                zoom,
                isModalOpen,
                unifiedEditingImage: !!unifiedEditingImage,
                activeElement: document.activeElement?.tagName,
            });

            if ((isModalOpen && !unifiedEditingImage) ||
                document.activeElement instanceof HTMLInputElement ||
                document.activeElement instanceof HTMLTextAreaElement) {
                console.log('[Clipboard] Copy blocked: modal open or input focused');
                return;
            }

            // [FIX] 이미지가 선택되어 있으면 텍스트 선택 체크를 건너뜀
            // 캔버스에서 이미지 드래그 선택 시 불필요한 텍스트 선택이 남을 수 있음
            const { selectedImageIds, selectedGroupIds } = useCanvasStore.getState();
            const hasImageSelection = selectedImageIds.size > 0 || selectedGroupIds.size > 0;

            // Check if there is a text selection anywhere on the page.
            // 단, 이미지가 선택되어 있으면 이 체크를 건너뜀
            if (!hasImageSelection) {
                const textSelection = window.getSelection()?.toString();
                if (textSelection && textSelection.trim().length > 0) {
                    console.log('[Clipboard] Copy blocked: text selection exists (no image selected)');
                    return;
                }
            }
            console.log('[Clipboard] Selection state:', {
                selectedImageIds: selectedImageIds.size,
                selectedGroupIds: selectedGroupIds.size,
            });

            if (selectedImageIds.size === 0 && selectedGroupIds.size === 0) {
                console.log('[Clipboard] Copy blocked: no selection');
                return;
            }

            e.preventDefault();
            handleCopyToClipboard();
        };
        document.addEventListener('copy', copyHandler);

        // [FIX] 줌아웃 상태에서 copy 이벤트가 발생하지 않는 문제 대응
        // PixiJS WebGL 캔버스가 포커스를 가지면 DOM copy 이벤트가 전달되지 않을 수 있음
        // keydown 이벤트로 Ctrl+C를 직접 감지하여 백업 처리
        const keydownHandler = (e: KeyboardEvent) => {
            // Ctrl+C 또는 Cmd+C (Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                // 입력 필드에서는 기본 동작 유지
                if (document.activeElement instanceof HTMLInputElement ||
                    document.activeElement instanceof HTMLTextAreaElement) {
                    return;
                }

                const { selectedImageIds, selectedGroupIds, zoom } = useCanvasStore.getState();
                const hasImageSelection = selectedImageIds.size > 0 || selectedGroupIds.size > 0;

                // 이미지가 선택되어 있을 때만 처리
                if (hasImageSelection && !isModalOpen) {
                    console.log('[Clipboard] Ctrl+C detected via keydown (backup)', { zoom, selectedImageIds: selectedImageIds.size });
                    e.preventDefault();
                    handleCopyToClipboard();
                }
            }

            // Ctrl+X 또는 Cmd+X — 잘라내기
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                if (document.activeElement instanceof HTMLInputElement ||
                    document.activeElement instanceof HTMLTextAreaElement) {
                    return;
                }

                const { selectedImageIds, selectedGroupIds } = useCanvasStore.getState();
                const hasImageSelection = selectedImageIds.size > 0 || selectedGroupIds.size > 0;

                if (hasImageSelection && !isModalOpen) {
                    e.preventDefault();
                    handleCopyToClipboard().then(() => {
                        useCanvasStore.getState().deleteSelection();
                    });
                }
            }
        };

        window.addEventListener('keydown', keydownHandler);

        return () => {
            document.removeEventListener('copy', copyHandler);
            window.removeEventListener('keydown', keydownHandler);
        };
    }, [handleCopyToClipboard, isModalOpen, unifiedEditingImage]);

    return {
        compositeSelectionToBlob,
        handleCopyToClipboard,
        handlePasteFromClipboard,
    };
}
