import { useState, useCallback, useEffect, useMemo } from 'react';
import { saveHandle, loadHandle, clearHandle } from '../utils/idb';
import { t, Language } from '../localization';
import { GeneratedMedia } from '../types';
import { useSettingsStore } from '../store/settingsStore';

// Convert WebP (or any format) blob to PNG for save
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

interface UseSaveDirectoryOptions {
    language: Language;
    onNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface UseSaveDirectoryReturn {
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    saveDirectoryPath: string | null;
    setSaveDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
    setSaveDirectoryPath: (path: string | null) => void;
    handleSetSaveDirectory: (handle: FileSystemDirectoryHandle | null) => Promise<void>;
    saveMediaToHandle: (media: GeneratedMedia, dirHandle: FileSystemDirectoryHandle) => Promise<void>;
    handleSelectSaveDirectory: () => Promise<void>;
    handleOpenSaveDirectory: () => Promise<void>;
}

export function useSaveDirectory({
    language,
    onNotification,
}: UseSaveDirectoryOptions): UseSaveDirectoryReturn {
    // [SYNC] Use Store as Single Source of Truth for Path
    const saveDirectoryPath = useSettingsStore(state => state.autoDownloadPath);
    const setStorePath = useSettingsStore(state => state.setAutoDownloadPath);

    // [WEB] Handle state for Browser File System Access API (non-serializable, separate from store path)
    const [webHandle, setWebHandle] = useState<FileSystemDirectoryHandle | null>(null);

    // [DERIVED] Calculate effective handle based on environment
    const saveDirectoryHandle = useMemo(() => {
        // Electron: Create pseudo-handle from Store Path
        if (window.electronAPI && saveDirectoryPath) {
            return { name: saveDirectoryPath.split(/[/\\]/).pop() || 'Folder' } as FileSystemDirectoryHandle;
        }
        // Web: Use real handle state
        return webHandle;
    }, [saveDirectoryPath, webHandle]);

    // [WEB] Restore handle from IndexedDB on mount
    useEffect(() => {
        if (!window.electronAPI) {
            const restoreHandle = async () => {
                try {
                    const handle = await loadHandle();
                    if (handle) {
                        setWebHandle(handle);
                        // Optional: Sync name to store if empty, but IDB is authoritative for Web
                        if (!saveDirectoryPath) {
                            setStorePath(handle.name);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load save directory handle from DB:', error);
                }
            };
            restoreHandle();
        }
    }, []); // Run once on mount

    // [ACTION] Update Handle (Web) or Path (Store)
    const handleSetSaveDirectory = useCallback(async (handle: FileSystemDirectoryHandle | null) => {
        if (window.electronAPI) {
            // Should not be called with handle in Electron usually, but if so:
            if (handle === null) {
                setStorePath(null);
            }
        } else {
            // Web Mode
            setWebHandle(handle);
            try {
                if (handle) {
                    await saveHandle(handle);
                    setStorePath(handle.name); // Sync name to store for display consistency
                } else {
                    await clearHandle();
                    setStorePath(null);
                }
            } catch (error) {
                console.error('Failed to update save directory handle in DB:', error);
                onNotification('Could not save directory preference.', 'error');
            }
        }
    }, [onNotification, setStorePath]);

    // Wrapper for manual path setting (mainly for Electron or manual input)
    const setSaveDirectoryPath = useCallback((path: string | null) => {
        setStorePath(path);
        // If Electron, handle updates automatically via useMemo
        // If Web, clearing path should probably clear handle too?
        if (!window.electronAPI && path === null) {
            setWebHandle(null);
            clearHandle().catch(console.error);
        }
    }, [setStorePath]);

    // Wrapper for manual handle setting
    const setSaveDirectoryHandle = useCallback((handle: FileSystemDirectoryHandle | null) => {
        handleSetSaveDirectory(handle);
    }, [handleSetSaveDirectory]);


    const saveMediaToHandle = useCallback(async (media: GeneratedMedia, dirHandle: FileSystemDirectoryHandle) => {
        try {
            // ELECTRON MODE: Use native file system API with saveDirectoryPath
            if (window.electronAPI?.saveFileToDirectory && saveDirectoryPath) {
                let blob: Blob;
                let fileName = `bananyang-${media.id}.${media.type === 'video' ? 'mp4' : 'png'}`;

                if (media.type === 'image' && media.isGenerated) {
                    if (media.originalFile) {
                        // RAM: original PNG from Google API
                        blob = media.originalFile;
                        fileName = `bananyang-generated-original-${media.id}.png`;
                        console.log(`[Save] RAM path | id=${media.id} | size=${media.originalFile.size}B`);
                    } else if (media.originalFilePath) {
                        // Disk-offloaded: load original PNG from temp file
                        const fileUrl = `file:///${media.originalFilePath.replace(/\\/g, '/')}`;
                        const res = await fetch(fileUrl);
                        blob = await res.blob();
                        fileName = `bananyang-generated-original-${media.id}.png`;
                        console.log(`[Save] Disk path | id=${media.id} | path=${media.originalFilePath} | size=${blob.size}B`);
                    } else {
                        // Batch server result or display WebP fallback
                        const isBatchServerResult = typeof media.src === 'string' && media.src.startsWith('http');
                        const res = await fetch(media.src);
                        const rawBlob = await res.blob();
                        // Convert WebP → PNG (batch Firebase results or display WebP fallback)
                        const needsConversion = isBatchServerResult || rawBlob.type === 'image/webp';
                        blob = needsConversion ? await convertToPng(rawBlob) : rawBlob;
                        const prefix = isBatchServerResult ? 'generated-original' : 'generated-optimized';
                        fileName = `bananyang-${prefix}-${media.id}.png`;
                        console.log(`[Save] Src path | id=${media.id} | isBatch=${isBatchServerResult} | converted=${needsConversion}`);
                    }
                } else {
                    const res = await fetch(media.src);
                    blob = await res.blob();
                }

                // Convert blob to base64 for IPC transfer
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                const base64Data = await base64Promise;

                const result = await window.electronAPI.saveFileToDirectory(saveDirectoryPath, fileName, base64Data);
                if (!result.success) {
                    throw new Error(result.error || 'Failed to save file');
                }
                return;
            }

            // BROWSER MODE: Use FileSystemDirectoryHandle API
            if (typeof dirHandle.queryPermission === 'function') {
                if ((await dirHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
                    if ((await dirHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
                        onNotification(t('error.permissionDenied', language), 'error');
                        await handleSetSaveDirectory(null);
                        return;
                    }
                }
            }

            let blob: Blob;
            let fileName = `bananyang-${media.id}.${media.type === 'video' ? 'mp4' : 'png'}`;

            if (media.type === 'image' && media.isGenerated) {
                if (media.originalFile) {
                    blob = media.originalFile;
                    fileName = `bananyang-generated-original-${media.id}.png`;
                } else if (media.originalFilePath) {
                    // Disk-offloaded: originalFile was released, load from temp path
                    const fileUrl = `file:///${media.originalFilePath.replace(/\\/g, '/')}`;
                    const res = await fetch(fileUrl);
                    blob = await res.blob();
                    fileName = `bananyang-generated-original-${media.id}.png`;
                } else {
                    // Batch server result or display WebP fallback
                    const isBatchServerResult = typeof media.src === 'string' && media.src.startsWith('http');
                    const res = await fetch(media.src);
                    const rawBlob = await res.blob();
                    // Convert WebP → PNG (batch Firebase results or display WebP fallback)
                    const needsConversion = isBatchServerResult || rawBlob.type === 'image/webp';
                    blob = needsConversion ? await convertToPng(rawBlob) : rawBlob;
                    const prefix = isBatchServerResult ? 'generated-original' : 'generated-optimized';
                    fileName = `bananyang-${prefix}-${media.id}.png`;
                }
            } else {
                const res = await fetch(media.src);
                blob = await res.blob();
            }

            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (err: any) {
            console.error(`Failed to save media ${media.id}:`, err);
            if (err instanceof Error && err.name === 'NotAllowedError') {
                onNotification(t('error.permissionDenied', language), 'error');
            } else {
                onNotification(t('error.saveFailed', language), 'error');
                throw err;
            }
        }
    }, [saveDirectoryPath, language, onNotification, handleSetSaveDirectory]);

    const handleSelectSaveDirectory = useCallback(async () => {
        try {
            // Use Electron's native dialog if available
            if (window.electronAPI?.selectDirectory) {
                const dirPath = await window.electronAPI.selectDirectory();
                if (dirPath) {
                    setStorePath(dirPath); // Only update store
                    onNotification(`저장 폴더가 설정되었습니다: ${dirPath}`, 'success');
                }
            } else if (window.showDirectoryPicker) {
                // Fallback to web API
                const handle = await window.showDirectoryPicker();
                await handleSetSaveDirectory(handle); // Updates web handle & syncs name to store
            } else {
                onNotification(t('error.fsApiNotSupported', language), 'error');
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Error selecting directory:", err);
                onNotification(t('error.directorySelectFailed', language), 'error');
            }
        }
    }, [language, onNotification, handleSetSaveDirectory, setStorePath]);

    const handleOpenSaveDirectory = useCallback(async () => {
        if (!saveDirectoryPath && !saveDirectoryHandle) return;

        // Prefer Path for Electron
        if (window.electronAPI?.openFolder && saveDirectoryPath) {
            try {
                const result = await window.electronAPI.openFolder(saveDirectoryPath);
                if (!result.success) {
                    onNotification('폴더를 열 수 없습니다', 'error');
                }
            } catch (error) {
                console.error('Failed to open folder:', error);
                onNotification('폴더를 열 수 없습니다', 'error');
            }
        } else {
            // Web or no path
            onNotification('폴더 경로가 설정되지 않았습니다', 'info');
        }
    }, [saveDirectoryPath, saveDirectoryHandle, onNotification]);


    return {
        saveDirectoryHandle,
        saveDirectoryPath,
        setSaveDirectoryHandle,
        setSaveDirectoryPath,
        handleSetSaveDirectory,
        saveMediaToHandle,
        handleSelectSaveDirectory,
        handleOpenSaveDirectory,
    };
}
