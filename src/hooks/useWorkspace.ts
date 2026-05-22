import { useState, useRef, useCallback, useEffect } from 'react';
import { t } from '../localization';
import type { Language } from '../localization';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../store/uiStore';
import { useCanvasStore, canvasStoreRegistry } from '../store/canvasStore';
import { fileToBase64 } from '../services/geminiService';
import { blobManager } from '../utils/blobManager';
import { ensureBoardImageFile } from '../utils/imageUtils';
import { generateWorkspaceThumbnail } from '../utils/imageOptimization';
import { deserializeWorkspace } from '../services/dataWorkerService';
import bananyangIconSrc from '../assets/bananyang-icon.png';
import { loadHandle, clearHandle } from '../utils/idb';
import type { PromptFolder, BoardImage, GenerationParams } from '../types';
import { DEFAULT_PROMPT_FOLDERS } from '../constants';
import { triggerTinyPreload, clearTinyPreloadQueue } from '../features/canvas/hooks/useCanvasWorker';
import { useWorkspaceTabsStore, syncActiveTabTitle, WorkspaceLoadingState } from '../store/workspaceTabsStore';
import { tabAbortRegistry, isAbortError } from '../store/tabAbortRegistry';

export type WorkspaceLoadMode = 'newTab' | 'replace';

const LOCAL_PRESETS_KEY = 'bananyang-user-presets';

interface UseWorkspaceParams {
    mainPanelRef: React.RefObject<HTMLElement | null>;
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    handleSetSaveDirectory: (handle: FileSystemDirectoryHandle | null, path: string | null) => void;
    setSaveDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
    setSaveDirectoryPath: (path: string | null) => void;
}

/** Get canvas store for a specific tab, fall back to active. */
function getCanvasStoreForTab(tabId: string | null) {
    if (tabId) {
        const inst = canvasStoreRegistry.getInstance(tabId);
        if (inst) return inst;
    }
    return canvasStoreRegistry.getActiveInstance();
}

export function useWorkspace({
    mainPanelRef,
    saveDirectoryHandle,
    handleSetSaveDirectory,
    setSaveDirectoryHandle,
    setSaveDirectoryPath,
}: UseWorkspaceParams) {
    const language = useSettingsStore(state => state.language);
    const showNotification = useUIStore(state => state.showNotification);
    const setShowExitConfirmModal = useUIStore(state => state.setShowExitConfirmModal);

    // Per-tab loading state actions
    const setTabLoadingState = useWorkspaceTabsStore(state => state.setTabLoadingState);
    const clearTabLoadingState = useWorkspaceTabsStore(state => state.clearTabLoadingState);

    // Reactive canvas state for dirty tracking (active tab)
    const boardImages = useCanvasStore(state => state.boardImages);
    const boardGroups = useCanvasStore(state => state.boardGroups);
    const memos = useCanvasStore(state => state.memos);
    const leftPanelTab = useCanvasStore(state => state.leftPanelTab);

    // ── State ─────────────────────────────────────────────────────────────────
    const [isDirty, setIsDirty] = useState(false);
    const [pendingWorkspace, setPendingWorkspace] = useState<{ content: string; filePath?: string } | null>(null);
    const [pendingNewWorkspace, setPendingNewWorkspace] = useState(false);
    const workspaceFilePath = useWorkspaceTabsStore(
        state => state.tabs.find(t => t.id === state.activeTabId)?.filePath ?? null
    );
    const setWorkspaceFilePath = useCallback((path: string | null) => {
        syncActiveTabTitle(path);
    }, []);
    const [folders, setFolders] = useState<PromptFolder[]>([]);

    const quitAfterSave = useRef(false);
    const isInitialLoad = useRef(true);

    // ── Preset Load ───────────────────────────────────────────────────────────
    useEffect(() => {
        const loadPresets = async () => {
            if (window.electronAPI) {
                try {
                    const loadedFolders = await window.electronAPI.loadPresets();
                    setFolders(loadedFolders ?? DEFAULT_PROMPT_FOLDERS);
                } catch {
                    setFolders(DEFAULT_PROMPT_FOLDERS);
                }
            } else {
                try {
                    const stored = localStorage.getItem(LOCAL_PRESETS_KEY);
                    setFolders(stored ? JSON.parse(stored) : DEFAULT_PROMPT_FOLDERS);
                } catch {
                    setFolders(DEFAULT_PROMPT_FOLDERS);
                }
            }
        };
        loadPresets();
    }, []);

    // ── Initial load timer ────────────────────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => { isInitialLoad.current = false; }, 500);
        return () => clearTimeout(timer);
    }, []);

    // ── Dirty sync to Electron ────────────────────────────────────────────────
    useEffect(() => {
        if (window.electronAPI) window.electronAPI.setDirty(isDirty);
    }, [isDirty]);

    // ── Dirty tracking from canvas ────────────────────────────────────────────
    useEffect(() => {
        if (isInitialLoad.current) return;
        if (boardImages.length > 0 || boardGroups.length > 0 || memos.length > 0) {
            setIsDirty(true);
            const { activeTabId, updateTabMeta } = useWorkspaceTabsStore.getState();
            if (activeTabId) updateTabMeta(activeTabId, { isDirty: true });
        }
    }, [boardImages, boardGroups, memos]);

    // ── markAsClean ───────────────────────────────────────────────────────────
    const markAsClean = useCallback(() => {
        setIsDirty(false);
        isInitialLoad.current = true;
        setTimeout(() => { isInitialLoad.current = false; }, 500);
    }, []);

    // ── saveFolders ───────────────────────────────────────────────────────────
    const saveFolders = useCallback(async (newFolders: PromptFolder[]) => {
        setFolders(newFolders);
        if (window.electronAPI) {
            try {
                const success = await window.electronAPI.savePresets(newFolders);
                if (!success) showNotification(t('error.saveFailed', language), 'error');
            } catch {
                showNotification(t('error.saveFailed', language), 'error');
            }
        } else {
            try {
                localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(newFolders));
            } catch {
                showNotification(t('error.saveFailed', language), 'error');
            }
        }
    }, [language, showNotification]);

    // ── handleExportPromptPresets ─────────────────────────────────────────────
    const handleExportPromptPresets = useCallback(async () => {
        try {
            const exportData = { version: '1.0', exportDate: new Date().toISOString(), folders };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `bananyang-presets-${new Date().toISOString().slice(0, 10)}.prompt`,
                    types: [{ description: 'Prompt Presets', accept: { 'application/json': ['.prompt'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `bananyang-presets-${new Date().toISOString().slice(0, 10)}.prompt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }
            showNotification(t('presets.exportSuccess', language), 'success');
        } catch (error: any) {
            if (error.name !== 'AbortError') showNotification(t('presets.exportFailed', language), 'error');
        }
    }, [folders, language, showNotification]);

    // ── handleImportPromptPresets ─────────────────────────────────────────────
    const handleImportPromptPresets = useCallback(async () => {
        try {
            const processImport = async (text: string) => {
                const importData = JSON.parse(text);
                if (importData.folders && Array.isArray(importData.folders)) {
                    if (window.confirm(t('presets.importConfirm', language))) {
                        await saveFolders(importData.folders);
                        showNotification(t('presets.importSuccess', language), 'success');
                    }
                } else {
                    showNotification(t('presets.importInvalid', language), 'error');
                }
            };
            if (window.showOpenFilePicker) {
                const [handle] = await window.showOpenFilePicker({
                    types: [{ description: 'Prompt Presets', accept: { 'application/json': ['.prompt'] } }],
                    multiple: false,
                });
                const file = await handle.getFile();
                await processImport(await file.text());
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.prompt';
                input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) await processImport(await file.text());
                };
                input.click();
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') showNotification(t('presets.importFailed', language), 'error');
        }
    }, [language, saveFolders, showNotification]);

    // ── animateProgress (per-tab) ─────────────────────────────────────────────
    const animateProgress = useCallback((
        tabId: string,
        operation: () => Promise<any>,
        options?: { skipAutoProgress?: boolean; keepOverlayVisible?: boolean }
    ): Promise<any> => {
        const patch = (p: Partial<WorkspaceLoadingState>) => setTabLoadingState(tabId, p);
        patch({ isLoading: true, progress: 0 });

        let animationFrameId: number | null = null;
        let progress = 0;
        let startTime: number | null = null;

        const easeAsync = (elapsed: number) => 99 * (1 - Math.exp(-elapsed / 4000));

        if (!options?.skipAutoProgress) {
            const animationStep = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const elapsed = timestamp - startTime;
                progress = easeAsync(elapsed);
                patch({ progress });
                animationFrameId = requestAnimationFrame(animationStep);
            };
            animationFrameId = requestAnimationFrame(animationStep);
        }

        return new Promise((resolve, reject) => {
            operation()
                .then(result => {
                    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
                    let finalProgressStart = options?.skipAutoProgress ? 100 : progress;
                    let finalAnimationStartTime: number | null = null;
                    const finalAnimationDuration = 300;
                    const finalAnimation = (timestamp: number) => {
                        if (!finalAnimationStartTime) finalAnimationStartTime = timestamp;
                        const elapsed = timestamp - finalAnimationStartTime;
                        const progressRatio = Math.min(elapsed / finalAnimationDuration, 1);
                        const currentProgress = finalProgressStart + (100 - finalProgressStart) * progressRatio;
                        patch({ progress: currentProgress });
                        if (currentProgress < 100) {
                            requestAnimationFrame(finalAnimation);
                        } else if (options?.keepOverlayVisible) {
                            resolve(result);
                        } else {
                            setTimeout(() => {
                                patch({ isLoading: false });
                                setTimeout(() => { clearTabLoadingState(tabId); resolve(result); }, 300);
                            }, 100);
                        }
                    };
                    requestAnimationFrame(finalAnimation);
                })
                .catch(err => {
                    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
                    patch({ isLoading: false });
                    setTimeout(() => { clearTabLoadingState(tabId); reject(err); }, 300);
                });
        });
    }, [setTabLoadingState, clearTabLoadingState]);

    // ── handleSaveSuccess ─────────────────────────────────────────────────────
    const handleSaveSuccess = useCallback(async (tabId: string, newFilePath?: string | null) => {
        showNotification(t('workspace.saved', language), 'success');
        markAsClean();
        useWorkspaceTabsStore.getState().updateTabMeta(tabId, { isDirty: false });
        if (newFilePath) {
            // Title sync — only meaningful when the saved tab is still active.
            const { activeTabId, updateTabMeta } = useWorkspaceTabsStore.getState();
            const title = newFilePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Untitled';
            updateTabMeta(tabId, { title, filePath: newFilePath });
            if (activeTabId === tabId && window.electronAPI?.setWindowTitle) {
                const fileName = newFilePath.split(/[\\/]/).pop() || 'BanaNyang';
                window.electronAPI.setWindowTitle(`${fileName} - BanaNyang`);
            }
        }
        if (quitAfterSave.current && window.electronAPI) {
            window.electronAPI.savedAndReadyToQuit();
        }
        if (quitAfterSave.current) {
            quitAfterSave.current = false;
        }
    }, [language, showNotification, markAsClean]);

    // ── handleSaveWorkspace ───────────────────────────────────────────────────
    const handleSaveWorkspace = useCallback(async (isSaveAs = false, keepOverlayVisible = false) => {
        const tabId = useWorkspaceTabsStore.getState().activeTabId;
        if (!tabId) return;
        const tabCanvas = getCanvasStoreForTab(tabId);

        const { boardImages: imgs, boardGroups: groups, memos: ms } = tabCanvas.getState();
        if (imgs.length === 0 && groups.length === 0 && ms.length === 0) return;

        // Pre-flight: warn user if any image has no recoverable source
        const sourcelessIds = imgs.filter(img => {
            const hasFile = !!(img.file || img.originalFile);
            const hasPath = !!(img.filePath || img.originalFilePath);
            const hasSrc = !!(img.src || img.originalSrc);
            return !hasFile && !hasPath && !hasSrc;
        });
        if (sourcelessIds.length > 0) {
            const proceed = window.confirm(
                t('workspace.save.sourcelessWarning', language, { count: sourcelessIds.length })
            );
            if (!proceed) return;
        }

        const tabTitle = useWorkspaceTabsStore.getState().tabs.find(t => t.id === tabId)?.title ?? 'Untitled';

        setTabLoadingState(tabId, {
            message: t('workspace.save.saving', language, { title: tabTitle }),
            isReversed: true,
            variant: 'glass',
        });

        const saveOperation = async () => {
            const { pLimit } = await import('../utils/concurrency');
            const { convertToWebP } = await import('../utils/imageOptimization');

            let processedCount = 0;
            const totalImages = imgs.length;
            const IMAGE_PROGRESS_WEIGHT = 90;

            setTabLoadingState(tabId, { progress: 0 });

            const updatesToApply: { id: string; updates: Partial<BoardImage> }[] = [];

            const serializableImages = await pLimit(imgs, async (img) => {
                processedCount++;
                const imageProgress = (processedCount / totalImages) * IMAGE_PROGRESS_WEIGHT;
                setTabLoadingState(tabId, {
                    message: t('workspace.save.processingImages', language, { title: tabTitle, current: processedCount, total: totalImages }),
                    progress: imageProgress,
                });

                if (processedCount % 5 === 0 || processedCount === totalImages) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                let fileToSave = (img.isGenerated && img.originalFile) ? img.originalFile : img.file;

                if (!fileToSave) {
                    fileToSave = await ensureBoardImageFile(img, (img.isGenerated && img.originalFile) ? 'original' : 'display');
                }

                if (!fileToSave) {
                    console.warn(`[Save] Skipping image ${img.id}: No file found.`);
                    return null;
                }

                let wasConverted = false;
                if (fileToSave.type !== 'image/webp') {
                    try {
                        fileToSave = await convertToWebP(fileToSave);
                        wasConverted = true;
                    } catch (err) {
                        console.warn('Failed to convert to WebP during save, falling back to original format:', err);
                    }
                }

                if (wasConverted) {
                    const updates: Partial<BoardImage> = {};
                    if (img.isGenerated && img.originalFile) {
                        updates.originalFile = fileToSave;
                    } else {
                        updates.file = fileToSave;
                    }
                    updatesToApply.push({ id: img.id, updates });
                }

                const base64 = await fileToBase64(fileToSave);
                // Strip ALL session-specific fields: blob URLs become invalid after restart,
                // File objects serialize as {}, and temp file paths from a previous load
                // cause saveAndReplace to skip offloading on the next load.
                const {
                    file, originalFile,
                    src, thumbnailSrc, originalSrc,
                    tinySrc, proxySrc, previewSrc, ktx2Src, highResSrc,
                    tinyFile, proxyFile, previewFile,
                    maskSrc, maskFile,
                    filePath, originalFilePath, tinyFilePath, proxyFilePath,
                    ...rest
                } = img;

                return {
                    ...rest,
                    fileData: { name: fileToSave.name, type: fileToSave.type, base64 },
                    isGenerated: img.isGenerated,
                    originalDimensions: img.originalDimensions
                };
            }, 4);

            if (updatesToApply.length > 0) {
                tabCanvas.getState().setBoardImages(prev => prev.map(img => {
                    const update = updatesToApply.find(u => u.id === img.id);
                    return update ? { ...img, ...update.updates } : img;
                }));
            }

            const { leftPanelTab: tab } = tabCanvas.getState();
            const activeTab = useWorkspaceTabsStore.getState().tabs.find(t => t.id === tabId);
            const workspaceData = {
                version: '1.4',
                boardImages: serializableImages.filter(Boolean),
                boardGroups: groups,
                memos: ms,
                saveDirectoryName: saveDirectoryHandle?.name || null,
                leftPanelTab: tab,
                tabTitle: activeTab?.title ?? null,
            };

            setTabLoadingState(tabId, { message: t('workspace.save.generatingThumbnails', language, { title: tabTitle }), progress: 92 });
            await new Promise(resolve => setTimeout(resolve, 0));

            // Generate thumbnail for embedding in ZIP container
            const { packWorkspaceZip, pngBase64ToUint8 } = await import('../utils/workspaceContainer');
            const { boardImages: currentBoardImages } = tabCanvas.getState();
            const thumbnailImages = currentBoardImages
                .filter(img => img.src || img.thumbnailSrc)
                .map(img => ({ x: img.x, y: img.y, width: img.width, height: img.height, src: img.src || img.thumbnailSrc || '' }));

            let thumbnailPng: Uint8Array | undefined;
            try {
                const thumbBase64 = await generateWorkspaceThumbnail(thumbnailImages, bananyangIconSrc, 512);
                if (thumbBase64) thumbnailPng = pngBase64ToUint8(thumbBase64);
            } catch (err) {
                console.warn('[Save] Thumbnail generation failed; saving without thumbnail:', err);
            }

            setTabLoadingState(tabId, { message: t('workspace.save.writingFile', language, { title: tabTitle }), progress: 98 });
            await new Promise(resolve => setTimeout(resolve, 0));

            const workspaceJson = JSON.stringify(workspaceData);
            const zipBytes = packWorkspaceZip({ workspaceJson, thumbnailPng });

            if (window.electronAPI) {
                let result;
                const activeTab = useWorkspaceTabsStore.getState().tabs.find(t => t.id === tabId);
                const activePath = activeTab?.filePath ?? null;
                const defaultName = activeTab?.title ?? null;
                if (isSaveAs || !activePath) {
                    result = await window.electronAPI.saveWorkspaceAs(zipBytes, defaultName);
                } else {
                    let savePath = activePath;
                    const legacyExtensions = ['.rfy', '.bananyang'];
                    for (const ext of legacyExtensions) {
                        if (savePath.toLowerCase().endsWith(ext)) {
                            savePath = savePath.slice(0, -ext.length) + '.nyang';
                            break;
                        }
                    }
                    const success = await window.electronAPI.saveWorkspaceFile(savePath, zipBytes);
                    result = { success, filePath: savePath, error: success ? undefined : 'File save failed' };
                }
                if (result.success) {
                    handleSaveSuccess(tabId, result.filePath);
                } else if (result.error) {
                    throw new Error(result.error);
                }
            } else {
                try {
                    const browserTab = useWorkspaceTabsStore.getState().tabs.find(t => t.id === tabId);
                    const browserTitle = browserTab?.title?.trim() || null;
                    const browserSuggestedName = browserTitle
                        ? (browserTitle.toLowerCase().endsWith('.nyang') ? browserTitle : `${browserTitle}.nyang`)
                        : `bananyang-workspace-${new Date().toISOString().slice(0, 10)}.nyang`;
                    if (window.showSaveFilePicker) {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: browserSuggestedName,
                            types: [{ description: 'BanaNyang Workspace', accept: { 'application/zip': ['.nyang'] } }],
                        });
                        const writable = await handle.createWritable();
                        await writable.write(zipBytes);
                        await writable.close();
                        handleSaveSuccess(tabId, handle.name);
                    } else {
                        const blob = new Blob([zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer], { type: 'application/zip' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = browserSuggestedName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        handleSaveSuccess(tabId, null);
                    }
                } catch (err: any) {
                    if (err.name !== 'AbortError') throw err;
                }
            }
        };

        try {
            await animateProgress(tabId, saveOperation, { skipAutoProgress: true, keepOverlayVisible });
        } catch (e) {
            console.error('Save operation failed:', e);
            showNotification(t('error.saveWorkspaceFailed', language), 'error');
        }
    }, [language, showNotification, handleSaveSuccess, saveDirectoryHandle, animateProgress, setTabLoadingState]);

    // ── handleNewWorkspace ────────────────────────────────────────────────────
    const handleNewWorkspace = useCallback(() => {
        const { boardImages: imgs, boardGroups: groups, memos: ms } = useCanvasStore.getState();
        const hasContent = imgs.length > 0 || groups.length > 0 || ms.length > 0;
        if (hasContent && isDirty) {
            setPendingNewWorkspace(true);
            setShowExitConfirmModal(true);
        } else {
            useCanvasStore.getState().clearCanvas();
            syncActiveTabTitle(null);
            markAsClean();
            useWorkspaceTabsStore.getState().updateTabMeta(
                useWorkspaceTabsStore.getState().activeTabId!,
                { isDirty: false }
            );
            if (window.electronAPI?.setWindowTitle) window.electronAPI.setWindowTitle('BanaNyang');
        }
    }, [isDirty, markAsClean, setShowExitConfirmModal]);

    // ── handleLoadWorkspace ───────────────────────────────────────────────────
    const handleLoadWorkspace = useCallback(async (content?: string, filePath?: string, skipDirtyCheck = false, mode: WorkspaceLoadMode = 'newTab') => {
        type SavedImage = {
            fileData: { type: string; base64: string; name: string; };
            id: string; x: number; y: number; width: number; height: number;
            role: BoardImage['role']; refIndex?: number; zIndex: number; groupId?: string;
            generationParams?: GenerationParams;
            isGenerated?: boolean;
            originalDimensions?: { width: number; height: number; };
        }

        let fileContent = content; // already-decoded JSON string (from pendingWorkspace or IPC)
        let newFilePath = filePath;

        const readAndDecodeWorkspaceFile = async (path: string): Promise<string | null> => {
            const { readWorkspacePayload } = await import('../utils/workspaceContainer');
            if (window.electronAPI?.readWorkspaceFile) {
                const result = await window.electronAPI.readWorkspaceFile(path);
                if (!result) return null;
                const bin = atob(result.base64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return readWorkspacePayload(bytes).json;
            }
            // Fallback: legacy text read (web environment or old preload)
            const text = await window.electronAPI?.readFile(path);
            if (!text) return null;
            if (text.charCodeAt(0) === 0x50 && text.charCodeAt(1) === 0x4B) {
                // Shouldn't happen via text path, but handle gracefully
                return null;
            }
            return text;
        };

        if (!fileContent && !filePath) {
            if (window.electronAPI) {
                newFilePath = await window.electronAPI.openFileDialog();
                if (!newFilePath) return;
                fileContent = await readAndDecodeWorkspaceFile(newFilePath);
            } else {
                try {
                    if (window.showOpenFilePicker) {
                        const [handle] = await window.showOpenFilePicker({
                            types: [{ description: 'BanaNyang Workspace', accept: { 'application/zip': ['.nyang'], 'application/json': ['.rfy', '.bananyang'] } }],
                            multiple: false
                        });
                        const file = await handle.getFile();
                        const { readWorkspacePayload } = await import('../utils/workspaceContainer');
                        const bytes = new Uint8Array(await file.arrayBuffer());
                        fileContent = readWorkspacePayload(bytes).json;
                        newFilePath = file.name;
                    } else {
                        throw new Error('Use drag and drop or file picker');
                    }
                } catch (err: any) {
                    if (err.name === 'AbortError') return;
                    throw err;
                }
            }
        } else if (!fileContent && filePath && window.electronAPI) {
            newFilePath = filePath;
            fileContent = await readAndDecodeWorkspaceFile(newFilePath);
        }

        if (!fileContent) {
            showNotification(t('error.loadWorkspaceFailed', language), 'error');
            return;
        }

        // newTab mode: 활성 탭이 비어 있으면 재사용, 아니면 새 탭 생성
        // Capture tabId AFTER potential createTab so subsequent work targets the correct store.
        let targetTabId: string;
        if (mode === 'newTab') {
            const activeId = useWorkspaceTabsStore.getState().activeTabId;
            const activeCanvas = getCanvasStoreForTab(activeId);
            const { boardImages: _imgs, boardGroups: _groups, memos: _ms } = activeCanvas.getState();
            const activeTabIsEmpty = _imgs.length === 0 && _groups.length === 0 && _ms.length === 0;
            if (!activeTabIsEmpty) {
                targetTabId = useWorkspaceTabsStore.getState().createTab({ filePath: newFilePath ?? null });
            } else {
                targetTabId = activeId!;
            }
        } else {
            // replace mode: check dirty state before overwriting current tab
            targetTabId = useWorkspaceTabsStore.getState().activeTabId!;
            const tabCanvas = getCanvasStoreForTab(targetTabId);
            const { boardImages: imgs, boardGroups: groups, memos: ms } = tabCanvas.getState();
            const hasContent = imgs.length > 0 || groups.length > 0 || ms.length > 0;
            if (!skipDirtyCheck && hasContent && isDirty) {
                setPendingWorkspace({ content: fileContent!, filePath: newFilePath });
                setShowExitConfirmModal(true);
                return;
            }
        }

        const tabId = targetTabId;
        const tabCanvas = getCanvasStoreForTab(tabId);
        const abortController = tabAbortRegistry.register(tabId);
        const signal = abortController.signal;
        const throwIfAborted = () => {
            if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        };

        setTabLoadingState(tabId, {
            message: t('workspace.load.loading', language),
            isReversed: false,
            variant: 'glass',
        });

        const loadOperation = async () => {
            const data = await deserializeWorkspace(fileContent!, (count, total) => {
                if (signal.aborted) return;
                const progress = Math.round((count / total) * 100);
                setTabLoadingState(tabId, { progress, message: t('workspace.load.processing', language, { current: count, total }) });
            }, signal);
            throwIfAborted();

            tabCanvas.getState().clearCanvas();

            const safeCreateBlobUrl = (file: any): string =>
                (file instanceof Blob || file instanceof File) ? blobManager.create(file) : '';

            const newBoardImages = data.boardImages.map((img: BoardImage) => {
                const src = img.src || safeCreateBlobUrl(img.file);
                const tinySrc = img.tinySrc || safeCreateBlobUrl(img.tinyFile);
                const proxySrc = img.proxySrc || (img.proxyFile ? safeCreateBlobUrl(img.proxyFile) : src);
                const originalSrc = img.originalSrc || (img.originalFile ? safeCreateBlobUrl(img.originalFile) : src);
                const thumbnailSrc = tinySrc || src;
                // Strip stale filePaths from old workspace formats so saveAndReplace
                // re-offloads fresh into the current session (paths from previous
                // sessions are unreliable across restarts).
                return {
                    ...img,
                    src, tinySrc, proxySrc, originalSrc, thumbnailSrc,
                    filePath: undefined,
                    originalFilePath: undefined,
                    tinyFilePath: undefined,
                    proxyFilePath: undefined,
                };
            });
            let localizedImages = newBoardImages;

            if (window.electronAPI?.saveTempFile) {
                try {
                    const { pLimit } = await import('../utils/concurrency');
                    const { fileToBase64: fb64 } = await import('../services/geminiService');

                    let processedCount = 0;
                    const totalCount = newBoardImages.length;
                    setTabLoadingState(tabId, { message: t('workspace.load.optimizing', language, { current: 0, total: totalCount }) });

                    localizedImages = await pLimit(newBoardImages, async (img, index) => {
                        if (signal.aborted) return img;
                        processedCount++;
                        if (processedCount % 5 === 0) {
                            setTabLoadingState(tabId, { message: t('workspace.load.optimizing', language, { current: processedCount, total: totalCount }) });
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }

                        if (!img.file) return img;

                        const newImg = { ...img };
                        const prefix = `load_${Date.now()}_${index}`;

                        const saveAndReplace = async (
                            fileKey: 'file' | 'originalFile' | 'tinyFile' | 'proxyFile',
                            pathKey: 'filePath' | 'originalFilePath' | 'tinyFilePath' | 'proxyFilePath',
                            suffix: string
                        ) => {
                            if (signal.aborted) return;
                            const f = img[fileKey];
                            if (f && !img[pathKey]) {
                                try {
                                    const base64 = await fb64(f);
                                    // [FIX TAB-SWITCH] Re-check abort after long base64 conversion.
                                    if (signal.aborted) return;
                                    const ext = f.type === 'image/jpeg' ? '.jpg' : (f.type === 'image/webp' ? '.webp' : '.png');
                                    const filename = `${prefix}${suffix}${ext}`;
                                    const saved = await window.electronAPI.saveTempFile(filename, base64);
                                    // [FIX TAB-SWITCH] Re-check abort after IPC round-trip.
                                    if (signal.aborted) return;
                                    if (saved.success && saved.filePath) {
                                        newImg[fileKey] = undefined;
                                        newImg[pathKey] = saved.filePath;
                                        const fileUrl = `file:///${saved.filePath.replace(/\\/g, '/')}`;
                                        if (fileKey === 'file') newImg.src = fileUrl;
                                        if (fileKey === 'originalFile') newImg.originalSrc = fileUrl;
                                        if (fileKey === 'tinyFile') newImg.tinySrc = fileUrl;
                                        if (fileKey === 'proxyFile') newImg.proxySrc = fileUrl;
                                        const oldSrc = img[fileKey === 'file' ? 'src' : (fileKey === 'originalFile' ? 'originalSrc' : (fileKey === 'tinyFile' ? 'tinySrc' : 'proxySrc'))];
                                        if (oldSrc && oldSrc.startsWith('blob:')) blobManager.release(oldSrc);
                                    } else if (!saved.success) {
                                        // [FIX TAB-SWITCH] Make memory-pressure failures observable.
                                        console.warn(`[Load] saveTempFile !success for ${fileKey} on ${img.id}`, saved);
                                    }
                                } catch (e) {
                                    console.warn(`[Load] Failed to offload ${fileKey} for ${img.id}`, e);
                                }
                            }
                        };

                        await saveAndReplace('originalFile', 'originalFilePath', '_original');
                        await saveAndReplace('file', 'filePath', '');
                        await saveAndReplace('tinyFile', 'tinyFilePath', '_tiny');
                        if (newImg.tinySrc && newImg.thumbnailSrc !== newImg.tinySrc) newImg.thumbnailSrc = newImg.tinySrc;
                        await saveAndReplace('proxyFile', 'proxyFilePath', '_proxy');
                        return newImg;
                    }, 4);
                } catch (error) {
                    console.error('[Load] Optimization failed, falling back to memory:', error);
                }
            }
            throwIfAborted();

            const progressiveBoardImages = localizedImages.map(img => {
                const tiny           = img.tinySrc || img.thumbnailSrc || img.src;
                const fallbackPreview  = img.previewSrc  || img.proxySrc  || img.src;
                const fallbackProxy    = img.proxySrc    || img.src;
                const fallbackOriginal = img.originalSrc || img.src;
                return {
                    ...img,
                    src: tiny,
                    tinySrc: tiny,
                    thumbnailSrc: tiny,
                    // [FIX] 빈 문자열 대신 fallback 유지 — 원본 지정/생성이 즉시 동작
                    previewSrc:  fallbackPreview,
                    proxySrc:    fallbackProxy,
                    originalSrc: fallbackOriginal,
                };
            });

            tabCanvas.getState().setBoardImages(() => progressiveBoardImages);
            tabCanvas.getState().setBoardGroups(() => data.boardGroups || []);
            tabCanvas.setState({ memos: (data as any).memos || [] });
            tabCanvas.getState().setSelectedImageIds(() => new Set());
            tabCanvas.getState().resetHistory();

            triggerTinyPreload(progressiveBoardImages);
            setTabLoadingState(tabId, { isLoading: false });

            (async () => {
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    if (signal.aborted) return;
                    // KTX2 encoding operates on whichever instance is active; safe to call generally.
                    await tabCanvas.getState().backgroundEncodeKTX2();
                } catch (e) {
                    console.warn('[KTX2] Background encoding trigger failed:', e);
                }
            })();

            if (data.version === '1.1' || data.version === '1.2' || data.version === '1.3') {
                if (data.leftPanelTab) tabCanvas.getState().setLeftPanelTab(data.leftPanelTab as any);
            }

            tabCanvas.getState().setChatHistory(() => [{ role: 'model', content: t('chat.intro', 'ko') }]);

            if (!window.electronAPI) {
                // Web 전용: IndexedDB 핸들 복원. Electron은 settingsStore가 경로를 영속 관리함.
                if (data.saveDirectoryName) {
                    try {
                        const handleFromDb = await loadHandle();
                        if (handleFromDb && handleFromDb.name === data.saveDirectoryName) {
                            setSaveDirectoryHandle(handleFromDb);
                        } else {
                            await clearHandle();
                            setSaveDirectoryHandle(null);
                            setSaveDirectoryPath(null);
                        }
                    } catch (dbError) {
                        console.error('Could not check for saved directory handle during workspace load:', dbError);
                        await clearHandle();
                        setSaveDirectoryHandle(null);
                        setSaveDirectoryPath(null);
                    }
                } else {
                    await clearHandle();
                    setSaveDirectoryHandle(null);
                    setSaveDirectoryPath(null);
                }
            }

            const restoredTitle = (data as any).tabTitle ||
                (newFilePath
                    ? (newFilePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Untitled')
                    : 'Untitled');
            useWorkspaceTabsStore.getState().updateTabMeta(tabId, { title: restoredTitle, filePath: newFilePath || null });

            showNotification(t('workspace.loaded', language), 'success');
            // Only clear dirty for the active tab; background-loaded tabs reset via updateTabMeta below.
            const currentActiveId = useWorkspaceTabsStore.getState().activeTabId;
            if (currentActiveId === tabId) markAsClean();
            useWorkspaceTabsStore.getState().updateTabMeta(tabId, { isDirty: false });

            if (newFilePath && currentActiveId === tabId && window.electronAPI?.setWindowTitle) {
                const fileName = newFilePath.split(/[\\/]/).pop() || 'BanaNyang';
                window.electronAPI.setWindowTitle(`${fileName} - BanaNyang`);
            }

            setTimeout(() => {
                if (signal.aborted) return;
                const isActive = useWorkspaceTabsStore.getState().activeTabId === tabId;
                const canvasEl = isActive ? mainPanelRef.current : null;
                if (!canvasEl || localizedImages.length === 0) return;
                const minX = Math.min(...localizedImages.map(i => i.x));
                const minY = Math.min(...localizedImages.map(i => i.y));
                const maxX = Math.max(...localizedImages.map(i => i.x + i.width));
                const maxY = Math.max(...localizedImages.map(i => i.y + i.height));
                const contentWidth = maxX - minX;
                const contentHeight = maxY - minY;
                if (contentWidth === 0 || contentHeight === 0) return;
                const PADDING = 50;
                const scaleX = (canvasEl.offsetWidth - PADDING * 2) / contentWidth;
                const scaleY = (canvasEl.offsetHeight - PADDING * 2) / contentHeight;
                const newZoom = Math.min(scaleX, scaleY, 5);
                const newPanX = (canvasEl.offsetWidth - contentWidth * newZoom) / 2 - minX * newZoom;
                const newPanY = (canvasEl.offsetHeight - contentHeight * newZoom) / 2 - minY * newZoom;
                tabCanvas.setState({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
            }, 100);
        };

        try {
            await animateProgress(tabId, loadOperation, { skipAutoProgress: true });
        } catch (err) {
            if (isAbortError(err)) {
                // Tab closed mid-load; state already cleaned up by closeTab → no toast.
                return;
            }
            if (!(err instanceof Error && err.message === 'USER_CANCELLED')) {
                console.error('Failed to load workspace:', err);
                showNotification(t('error.loadWorkspaceFailed', language), 'error');
            }
        }
    }, [language, showNotification, markAsClean, animateProgress, isDirty,
        setSaveDirectoryHandle, setSaveDirectoryPath, mainPanelRef, setTabLoadingState, setShowExitConfirmModal]);

    // ── Electron IPC listeners ────────────────────────────────────────────────
    // Use a serial queue to handle multiple load-workspace events that arrive
    // nearly simultaneously (e.g. when the user selects multiple files in Explorer).
    // Without this, concurrent async handleLoadWorkspace calls race each other
    // and only one workspace ends up loaded.
    const loadQueueRef = useRef<Array<{ filePath?: string; content?: string }>>([]);
    const isProcessingQueueRef = useRef(false);

    const processLoadQueue = useCallback(async () => {
        if (isProcessingQueueRef.current) return; // already draining
        isProcessingQueueRef.current = true;
        try {
            while (loadQueueRef.current.length > 0) {
                const item = loadQueueRef.current.shift()!;
                await handleLoadWorkspace(item.content, item.filePath);
            }
        } finally {
            isProcessingQueueRef.current = false;
        }
    }, [handleLoadWorkspace]);

    useEffect(() => {
        if (!window.electronAPI) return;
        const cleanupLoad = window.electronAPI.onLoadWorkspace((filePath, content) => {
            loadQueueRef.current.push({
                filePath: filePath || undefined,
                content: content || undefined,
            });
            processLoadQueue();
        });
        const cleanupClose = window.electronAPI.onCanClose(() => {
            // 모든 탭의 dirty 집계 (활성 탭 isDirty와 다른 탭의 isDirty를 모두 검사)
            const dirtyTabs = useWorkspaceTabsStore.getState().tabs.filter(t => t.isDirty);
            if (isDirty || dirtyTabs.length > 0) {
                setShowExitConfirmModal(true);
            } else {
                window.electronAPI.confirmClose();
            }
        });
        return () => { cleanupLoad(); cleanupClose(); };
    }, [isDirty, handleLoadWorkspace, processLoadQueue, setShowExitConfirmModal]);

    return {
        isDirty,
        setIsDirty,
        pendingWorkspace,
        setPendingWorkspace,
        pendingNewWorkspace,
        setPendingNewWorkspace,
        workspaceFilePath,
        setWorkspaceFilePath,
        folders,
        quitAfterSave,
        markAsClean,
        saveFolders,
        animateProgress,
        handleSaveWorkspace,
        handleNewWorkspace,
        handleLoadWorkspace,
        handleExportPromptPresets,
        handleImportPromptPresets,
    };
}
