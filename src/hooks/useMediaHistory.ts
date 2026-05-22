import { useState, useMemo, useCallback, useEffect } from 'react';
import { GeneratedMedia, GenerationBatch } from '../types';
import { bananyang_MEDIA_MIME_TYPE } from '../constants';
import { t, Language, TranslationKey } from '../localization';

// Convert WebP (or any format) blob to PNG for download
const convertToPng = (sourceBlob: Blob): Promise<Blob> =>
    createImageBitmap(sourceBlob).then(bitmap => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        bitmap.close();
        return new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG conversion failed')), 'image/png')
        );
    });

interface UseMediaHistoryOptions {
    language: Language;
    onNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    saveMediaToHandle: (media: GeneratedMedia, dirHandle: FileSystemDirectoryHandle) => Promise<void>;
    itemsPerPage: number;
}

interface UseMediaHistoryReturn {
    // State
    generationBatches: GenerationBatch[];
    setGenerationBatches: React.Dispatch<React.SetStateAction<GenerationBatch[]>>;
    selectedMediaIds: Set<string>;
    setSelectedMediaIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    downloadStatus: Record<string, 'downloading' | 'success'>;
    downloadedImageIds: Set<string>;

    // Computed
    allHistoryMedia: GeneratedMedia[];
    displayedHistoryMedia: GeneratedMedia[];
    currentMedia: GeneratedMedia[];
    totalPages: number;

    // Handlers
    handleToggleMediaSelection: (id: string) => void;
    handleDeleteSelectedMedia: () => Promise<void>;
    handleDeleteSingleMedia: (id: string) => void;
    handleHistoryDragStart: (e: React.DragEvent<HTMLElement>, media: GeneratedMedia) => void;
    handleSelectAllToggle: () => void;
    handleDownload: (e: React.MouseEvent, media: GeneratedMedia) => Promise<void>;
    handleDownloadSelectedMedia: () => Promise<void>;
}

export function useMediaHistory({
    language,
    onNotification,
    saveDirectoryHandle,
    saveMediaToHandle,
    itemsPerPage,
}: UseMediaHistoryOptions): UseMediaHistoryReturn {
    // State
    const [generationBatches, setGenerationBatches] = useState<GenerationBatch[]>([]);
    const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [downloadStatus, setDownloadStatus] = useState<Record<string, 'downloading' | 'success'>>({});
    const [downloadedImageIds, setDownloadedImageIds] = useState<Set<string>>(new Set());

    // Computed
    const allHistoryMedia = useMemo(
        () => generationBatches.flatMap(batch => batch.media),
        [generationBatches]
    );

    const displayedHistoryMedia = useMemo(() => allHistoryMedia, [allHistoryMedia]);
    const totalPages = Math.ceil(displayedHistoryMedia.length / itemsPerPage);

    const currentMedia = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return displayedHistoryMedia.slice(startIndex, startIndex + itemsPerPage);
    }, [displayedHistoryMedia, currentPage, itemsPerPage]);

    // Reset to page 1 when itemsPerPage changes (panel resize changes cols)
    useEffect(() => {
        setCurrentPage(1);
    }, [itemsPerPage]);

    // Clamp currentPage if it exceeds totalPages after deletion
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // Handlers
    const handleToggleMediaSelection = useCallback((id: string) => {
        setSelectedMediaIds(prev => {
            const newSet = new Set(prev);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            return newSet;
        });
    }, []);

    const handleDeleteSingleMedia = useCallback((id: string) => {
        setGenerationBatches(prev =>
            prev
                .map(batch => ({ ...batch, media: batch.media.filter(item => item.id !== id) }))
                .filter(batch => batch.media.length > 0)
        );
        setSelectedMediaIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        onNotification(t('delete.success', language, { count: 1 }), 'success');
    }, [language, onNotification]);

    const handleDeleteSelectedMedia = useCallback(async () => {
        if (selectedMediaIds.size === 0) return;
        const count = selectedMediaIds.size;
        setGenerationBatches(prev =>
            prev
                .map(batch => ({
                    ...batch,
                    media: batch.media.filter(item => !selectedMediaIds.has(item.id))
                }))
                .filter(batch => batch.media.length > 0)
        );
        setSelectedMediaIds(new Set());
        onNotification(t('delete.success', language, { count }), 'success');
    }, [selectedMediaIds, language, onNotification]);

    const handleHistoryDragStart = useCallback(
        (e: React.DragEvent<HTMLElement>, media: GeneratedMedia) => {
            if (media.type !== 'image') {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData(bananyang_MEDIA_MIME_TYPE, media.id);
            e.dataTransfer.effectAllowed = 'copy';
        },
        []
    );

    const handleSelectAllToggle = useCallback(() => {
        const currentMediaIds = new Set(currentMedia.map(item => item.id));
        const areAllCurrentPageMediaSelected =
            currentMedia.length > 0 && currentMedia.every(item => selectedMediaIds.has(item.id));

        if (areAllCurrentPageMediaSelected) {
            setSelectedMediaIds(prev => {
                const newSet = new Set(prev);
                currentMediaIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        } else {
            setSelectedMediaIds(prev => new Set([...prev, ...currentMediaIds]));
        }
    }, [currentMedia, selectedMediaIds]);

    const handleDownload = useCallback(async (e: React.MouseEvent, media: GeneratedMedia) => {
        e.stopPropagation();
        if (downloadStatus[media.id] === 'downloading') return;

        setDownloadStatus(prev => ({ ...prev, [media.id]: 'downloading' }));

        try {
            if (saveDirectoryHandle) {
                await saveMediaToHandle(media, saveDirectoryHandle);
                setDownloadedImageIds(prev => new Set(prev).add(media.id));
                setDownloadStatus(prev => ({ ...prev, [media.id]: 'success' }));
                onNotification(`${media.id}가 ${saveDirectoryHandle.name}에 저장되었습니다.`, 'success');
            } else {
                // Batch server results (Firebase URLs) are full-res originals even without originalFilePath
                const isBatchServerResult = media.isGenerated && !media.originalFile && !media.originalFilePath
                    && typeof media.src === 'string' && media.src.startsWith('http');

                let fileName = `bananyang-${media.id}.${media.type === 'video' ? 'mp4' : 'png'}`;
                if (media.type === 'image' && media.isGenerated) {
                    const hasOriginal = media.originalFile || media.originalFilePath || isBatchServerResult;
                    const prefix = hasOriginal ? 'generated-original' : 'generated-optimized';
                    fileName = `bananyang-${prefix}-${media.id}.png`;
                }

                // Use originalFile (high-res) when available, otherwise fetch from src
                let blob: Blob;
                if (media.type === 'image' && media.isGenerated && media.originalFile) {
                    // RAM: original PNG from Google API
                    console.log(`[Download] RAM path | id=${media.id} | size=${media.originalFile.size}B | type=${media.originalFile.type}`);
                    blob = media.originalFile;
                } else if (media.type === 'image' && media.isGenerated && media.originalFilePath) {
                    // Disk-offloaded: load original PNG from temp file
                    const fileUrl = `file:///${media.originalFilePath.replace(/\\/g, '/')}`;
                    const response = await fetch(fileUrl);
                    blob = await response.blob();
                    console.log(`[Download] Disk path | id=${media.id} | path=${media.originalFilePath} | size=${blob.size}B`);
                } else {
                    const response = await fetch(media.src);
                    const rawBlob = await response.blob();
                    // Convert WebP → PNG (batch Firebase results or display WebP fallback)
                    const needsConversion = isBatchServerResult || rawBlob.type === 'image/webp';
                    blob = needsConversion ? await convertToPng(rawBlob) : rawBlob;
                    console.log(`[Download] Src path | id=${media.id} | isBatch=${isBatchServerResult} | converted=${needsConversion}`);
                }
                const blobUrl = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up the temporary blob URL after a short delay
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

                // Now show notification after download is triggered with ready blob
                setDownloadedImageIds(prev => new Set(prev).add(media.id));
                setDownloadStatus(prev => ({ ...prev, [media.id]: 'success' }));
                onNotification(t('downloadComplete', language), 'success');
            }

            setTimeout(() => {
                setDownloadStatus(prev => {
                    const newState = { ...prev };
                    if (newState[media.id] === 'success') delete newState[media.id];
                    return newState;
                });
            }, 2000);
        } catch (err: any) {
            console.error('Download failed:', err);
            onNotification(t('notification.downloadFailed' as TranslationKey, language), 'error');
            setDownloadStatus(prev => {
                const newState = { ...prev };
                delete newState[media.id];
                return newState;
            });
        }
    }, [downloadStatus, saveDirectoryHandle, saveMediaToHandle, language, onNotification]);

    const handleDownloadSelectedMedia = useCallback(async () => {
        if (selectedMediaIds.size === 0) return;
        let successCount = 0;

        for (const mediaId of selectedMediaIds) {
            const mediaItem = allHistoryMedia.find(m => m.id === mediaId);
            if (mediaItem) {
                setDownloadStatus(prev => ({ ...prev, [mediaId]: 'downloading' }));
                try {
                    if (saveDirectoryHandle) {
                        await saveMediaToHandle(mediaItem, saveDirectoryHandle);
                    } else {
                        const isBatchServerResult = mediaItem.isGenerated && !mediaItem.originalFile && !mediaItem.originalFilePath
                            && typeof mediaItem.src === 'string' && mediaItem.src.startsWith('http');

                        let fileName = `bananyang-${mediaItem.id}.${mediaItem.type === 'video' ? 'mp4' : 'png'}`;
                        if (mediaItem.type === 'image' && mediaItem.isGenerated) {
                            const hasOriginal = mediaItem.originalFile || mediaItem.originalFilePath || isBatchServerResult;
                            const prefix = hasOriginal ? 'generated-original' : 'generated-optimized';
                            fileName = `bananyang-${prefix}-${mediaItem.id}.png`;
                        }
                        let downloadBlob: Blob;
                        if (mediaItem.type === 'image' && mediaItem.isGenerated && mediaItem.originalFile) {
                            downloadBlob = mediaItem.originalFile;
                        } else if (mediaItem.type === 'image' && mediaItem.isGenerated && mediaItem.originalFilePath) {
                            // Disk-offloaded: originalFile was released, load from temp path
                            const fileUrl = `file:///${mediaItem.originalFilePath.replace(/\\/g, '/')}`;
                            const res = await fetch(fileUrl);
                            downloadBlob = await res.blob();
                        } else {
                            const res = await fetch(mediaItem.src);
                            const rawBlob = await res.blob();
                            // Convert WebP → PNG (batch Firebase results or display WebP fallback)
                            const needsConversion = isBatchServerResult || rawBlob.type === 'image/webp';
                            downloadBlob = needsConversion ? await convertToPng(rawBlob) : rawBlob;
                        }
                        const downloadBlobUrl = URL.createObjectURL(downloadBlob);
                        const link = document.createElement('a');
                        link.href = downloadBlobUrl;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(downloadBlobUrl), 1000);
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                    setDownloadedImageIds(prev => new Set(prev).add(mediaId));
                    setDownloadStatus(prev => ({ ...prev, [mediaId]: 'success' }));
                    successCount++;
                } catch (err: any) {
                    console.error(`Download failed for ${mediaId}:`, err);
                    setDownloadStatus(prev => {
                        const newState = { ...prev };
                        delete newState[mediaId];
                        return newState;
                    });
                    break;
                }
            }
        }

        if (successCount > 0) {
            if (saveDirectoryHandle) {
                onNotification(`${successCount}개의 파일이 ${saveDirectoryHandle.name} 폴더에 저장되었습니다.`, 'success');
            } else {
                onNotification(t('downloadCompleteMultiple', language, { count: successCount }), 'success');
            }
        }

        setTimeout(() => {
            setDownloadStatus(prev => {
                const newState = { ...prev };
                for (const mediaId of selectedMediaIds) {
                    if (newState[mediaId] === 'success') delete newState[mediaId];
                }
                return newState;
            });
        }, 2000);
    }, [selectedMediaIds, allHistoryMedia, saveDirectoryHandle, saveMediaToHandle, language, onNotification]);

    return {
        // State
        generationBatches,
        setGenerationBatches,
        selectedMediaIds,
        setSelectedMediaIds,
        currentPage,
        setCurrentPage,
        downloadStatus,
        downloadedImageIds,

        // Computed
        allHistoryMedia,
        displayedHistoryMedia,
        currentMedia,
        totalPages,

        // Handlers
        handleToggleMediaSelection,
        handleDeleteSelectedMedia,
        handleDeleteSingleMedia,
        handleHistoryDragStart,
        handleSelectAllToggle,
        handleDownload,
        handleDownloadSelectedMedia,
    };
}
