
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  GeneratedMedia, GenerationTask, MonthlyCredit, BoardImage, BoardGroup, ModelName, GenerationBatch, PromptFolder, GenerationParams, ChatMessage, AiAction, Resolution, AspectRatio
} from './types';
import { bananyang_MEDIA_MIME_TYPE, ROWS_PER_PAGE, DEFAULT_PROMPT_FOLDERS, TOTAL_MONTHLY_CREDIT, MODEL_NAMES } from './constants';
import { Z_INDEX } from './constants/zIndex';
import { setApiKey, getApiKey, fileToBase64, hasValidAuth } from './services/geminiService';
import { t, TranslationKey } from './localization';
import type { Language } from './localization';
import { ImageViewerModal } from './components/ImageViewerModal';
import { AppSettingsModal } from './components/AppSettingsModal';
import { SavePresetModal } from './components/SavePresetModal';
import { useCanvasStore } from './store/canvasStore';
import { useImageGeneration } from './hooks/useImageGeneration';
import { LeftPanel } from './features/left-panel/LeftPanel';
import { OriginalImagePanel } from './features/original-image-panel';
import { useShortcutStore } from './hooks/useShortcuts';
import { useGenerationStore } from './store/generationStore';
import { useUIStore, NotificationType, SnapIndicatorState } from './store/uiStore';
import { useCreditStore } from './store/creditStore';
import { GroupQuickBar } from './features/canvas/components/GroupQuickBar';
import { Canvas } from './features/canvas/index';
import { saveHandle, loadHandle, clearHandle } from './utils/idb';
import { useSaveDirectory } from './hooks/useSaveDirectory';
import { useMediaHistory } from './hooks/useMediaHistory';
import { useClipboard } from './hooks/useClipboard';
import { UnifiedEditorModal, EditResult } from './features/canvas/components/UnifiedEditorModal';
import { generateThumbnail, generateThumbnailFromDataURL, generateTinySrc, ensureBoardImageFile, dataURLtoFile } from './utils/imageUtils';
import { convertToPng } from './utils/imageOptimization';
import { blobManager } from './utils/blobManager';
import { deserializeWorkspace } from './services/dataWorkerService';
import { initToolbarBindingController } from './features/toolbar/toolbarBindingController';
import { LoadingOverlay } from './components/LoadingOverlay';
import { DraggableHeader } from './components/DraggableHeader';

import { SnapIndicator } from './components/SnapIndicator';
import { CanvasNavigator } from './features/canvas/components/CanvasNavigator';
import { useSettingsStore } from './store/settingsStore';
// ImageLimitWarning 팝업 제거 → 알림 시스템으로 통합
import { SessionRecoveryModal } from './components/SessionRecoveryModal';
import { ProfilerOverlay } from './components/ProfilerOverlay';
import { useMemoryCleanup } from './hooks/useMemoryCleanup';
import { useAutoSave } from './hooks/useAutoSave';
import { QuotaExceededModal } from './components/QuotaExceededModal';
import { ExitConfirmModal } from './components/ExitConfirmModal';
import { AiSortConfirmModal } from './components/AiSortConfirmModal';
import { canvasTabRouter, canvasStoreRegistry } from './store/canvasStore';
import { runAiSort } from './features/canvas/hooks/runAiSort';
import { GenerationLoginPrompt } from './components/GenerationLoginPrompt';
import { useWorkspace } from './hooks/useWorkspace';
import { useEditorHandlers } from './hooks/useEditorHandlers';
import { useWorkspaceTabsStore } from './store/workspaceTabsStore';
import { isShortcut } from './hooks/useShortcuts';
import { PanelShell } from './components/PanelShell';
import { GalleryIcon, PhotoIcon } from './components/icons';
import { SidebarControls } from './components/SidebarControls';
import generateIcon from './assets/generate-icon.png';
import { usePanelSystem } from './hooks/usePanelSystem';
import bananyangIcon from './assets/bananyang-icon.png';
import { FloatingToolbar } from './features/toolbar/FloatingToolbar';
import { ToolbarPopoverPanel } from './features/toolbar/ToolbarPopoverPanel';
import { useToolbarStore } from './features/toolbar/useToolbarStore';
import type { DockTarget } from './features/toolbar/FloatingToolbar';
import { ConceptTab } from './features/right-panel/components/tabs/ConceptTab';
import { AiEditPanel } from './features/right-panel/components/AiEditPanel';
import { CameraTab } from './features/right-panel/components/tabs/CameraTab';
import { PoseTab } from './features/right-panel/components/tabs/PoseTab';
import { PaintingTab } from './features/right-panel/components/tabs/PaintingTab';
import { CropTab } from './features/canvas/components/editor/tabs/CropTab';
import { ObjectTab } from './features/canvas/components/editor/tabs/ObjectTab';
import { RelightTab } from './features/canvas/components/editor/tabs/RelightTab';
import { InpaintingTab } from './features/canvas/components/editor/tabs/InpaintingTab';
import { useEditorStore } from './features/toolbar/useEditorStore';
import { UpdateNotificationToast } from './components/UpdateNotificationToast';
import { UpdatePromptModal } from './components/UpdatePromptModal';
import { setUpdatePolicy, checkForUpdates } from './services/autoUpdater';
import { startUpdateChannel } from './services/updateChannel';


// [FIX C-3] dataURLtoFile moved to utils/imageUtils.ts (single source of truth)

// StrictMode 2회 발화 방지 — 모듈 수명 동안 초기 탭을 정확히 1회만 생성
let initialTabEnsured = false;


// --- Main Application Component ---
const LOCAL_CREDIT_KEY = 'bananyang-monthly-credit-usd-v1';
// NotificationType moved to store/uiStore.ts



export default function App() {
  const language = useSettingsStore(state => state.language);
  const autoOpenEditorOnOriginal = useSettingsStore(state => state.autoOpenEditorOnOriginal);

  // 툴바 스토어 — 팝오버 콘텐츠 결정에 사용
  const toolbarActiveToolId = useToolbarStore(state => state.activeToolId);
  const toolbarDockedTo = useToolbarStore(state => state.toolbarDockedTo);

  // [MEMORY OPTIMIZATION] Memory cleanup hook
  const { cleanup: cleanupMemory } = useMemoryCleanup();

  // [AUTOSAVE] Periodic workspace autosave to session dir (crash recovery)
  useAutoSave();

  // ... (inside component)
  const [modelName, setModelName] = useState<ModelName>(() => {
    const saved = localStorage.getItem('bananyang-selected-model');
    // Validate saved model name against known valid values
    const validModels = [MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE, MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE, MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW];
    if (saved && validModels.includes(saved)) {
      return saved as ModelName;
    }
    return MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE as ModelName;
  });

  // 툴바 바인딩 컨트롤러 초기화 (React 외부 Zustand 구독)
  useEffect(() => {
    return initToolbarBindingController();
  }, []);

  // [OTA] 자동 업데이트 정책 + Firestore 채널 부트스트랩
  useEffect(() => {
    // 1) 현재 토글 상태를 main에 통지
    const initialEnabled = useSettingsStore.getState().autoUpdateEnabled;
    void setUpdatePolicy(initialEnabled ? 'silent' : 'prompt');

    // 2) 설정 토글 변경 시 main에 재통지
    const unsubSettings = useSettingsStore.subscribe((state, prev) => {
      if (state.autoUpdateEnabled !== prev.autoUpdateEnabled) {
        void setUpdatePolicy(state.autoUpdateEnabled ? 'silent' : 'prompt');
      }
    });

    // 3) Firestore 채널 — 새 릴리스 감지 시 electron-updater 트리거 + severity 전달
    const unsubChannel = startUpdateChannel((doc) => {
      const enabled = useSettingsStore.getState().autoUpdateEnabled;
      void setUpdatePolicy(enabled ? 'silent' : 'prompt', doc.severity);
      void checkForUpdates();
    });

    return () => {
      unsubSettings();
      unsubChannel();
    };
  }, []);

  // 탭 시스템 — 초기 탭 보장 (persist rehydrate 후 빈 탭 케이스 대비)
  const activeTabId = useWorkspaceTabsStore(s => s.activeTabId);
  const activeTabLoadingState = useWorkspaceTabsStore(s => {
    const id = s.activeTabId;
    if (!id) return null;
    return s.tabs.find(t => t.id === id)?.loadingState ?? null;
  });
  useEffect(() => {
    if (initialTabEnsured) return;
    initialTabEnsured = true;
    const { tabs, createTab } = useWorkspaceTabsStore.getState();
    if (tabs.length === 0) createTab();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isShortcut(e, 'newTab')) {
        e.preventDefault();
        useWorkspaceTabsStore.getState().createTab();
      } else if (isShortcut(e, 'closeTab')) {
        e.preventDefault();
        const { activeTabId: id, tabs } = useWorkspaceTabsStore.getState();
        if (!id) return;
        const tab = tabs.find(t => t.id === id);
        if (tab?.isDirty) {
          useUIStore.getState().setPendingCloseTabId(id);
          useUIStore.getState().setShowExitConfirmModal(true);
        } else {
          useWorkspaceTabsStore.getState().closeTab(id);
        }
      } else if (isShortcut(e, 'nextTab')) {
        e.preventDefault();
        useWorkspaceTabsStore.getState().nextTab();
      } else if (isShortcut(e, 'prevTab')) {
        e.preventDefault();
        useWorkspaceTabsStore.getState().prevTab();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('bananyang-selected-model', modelName);
  }, [modelName]);

  useEffect(() => {
    const handleModelChange = (e: CustomEvent<ModelName>) => {
      setModelName(e.detail);
    };
    window.addEventListener('model-change', handleModelChange as EventListener);
    return () => {
      window.removeEventListener('model-change', handleModelChange as EventListener);
    };
  }, []);

  // UI Store - Modal and notification state — individual selectors
  const showAppSettingsModal = useUIStore(state => state.showAppSettingsModal);
  const appSettingsInitialTab = useUIStore(state => state.appSettingsInitialTab);
  const appSettingsApiSubTab = useUIStore(state => state.appSettingsApiSubTab);
  const showQuotaModal = useUIStore(state => state.showQuotaModal);
  const showExitConfirmModal = useUIStore(state => state.showExitConfirmModal);
  const isSaveModalOpen = useUIStore(state => state.isSaveModalOpen);
  const notification = useUIStore(state => state.notification);
  const snapIndicator = useUIStore(state => state.snapIndicator);
  const loadingState = useUIStore(state => state.loadingState);
  const isOverlayVisible = useUIStore(state => state.isOverlayVisible);
  const showGenerationLoginPrompt = useUIStore(state => state.showGenerationLoginPrompt);
  const pendingCloseTabId = useUIStore(state => state.pendingCloseTabId);
  const setPendingCloseTabId = useUIStore(state => state.setPendingCloseTabId);
  const setShowAppSettingsModal = useUIStore(state => state.setShowAppSettingsModal);
  const openAppSettings = useUIStore(state => state.openAppSettings);
  const setShowQuotaModal = useUIStore(state => state.setShowQuotaModal);
  const setShowExitConfirmModal = useUIStore(state => state.setShowExitConfirmModal);
  const setIsSaveModalOpen = useUIStore(state => state.setIsSaveModalOpen);
  const showNotification = useUIStore(state => state.showNotification);
  const clearNotification = useUIStore(state => state.clearNotification);
  const setSnapIndicator = useUIStore(state => state.setSnapIndicator);
  const setLoadingState = useUIStore(state => state.setLoadingState);
  const setIsOverlayVisible = useUIStore(state => state.setIsOverlayVisible);
  const setIsEditorOpen = useUIStore(state => state.setIsEditorOpen);
  const setEditorMode = useUIStore(state => state.setEditorMode);
  const setShowGenerationLoginPrompt = useUIStore(state => state.setShowGenerationLoginPrompt);
  const showAiSortConfirmModal = useUIStore(state => state.showAiSortConfirmModal);
  const pendingAiSortTabId = useUIStore(state => state.pendingAiSortTabId);
  const pendingAiSortUngroupedCount = useUIStore(state => state.pendingAiSortUngroupedCount);
  const aiSortAxis = useSettingsStore(state => state.aiSortAxis);
  const aiSortMaxGroups = useSettingsStore(state => state.aiSortMaxGroups);
  const aiSortVerifyClusters = useSettingsStore(state => state.aiSortVerifyClusters);


  // Apply glass effect level setting to HTML element for CSS targeting
  const glassEffectLevel = useSettingsStore(state => state.glassEffectLevel);
  const setGlassEffectLevel = useSettingsStore(state => state.setGlassEffectLevel);

  useEffect(() => {
    document.documentElement.setAttribute('data-glass-effect', glassEffectLevel);
    // [GLASS] Apply OS-level acrylic/vibrancy blur (Windows 11 / macOS)
    window.electronAPI?.setGlassLevel?.(glassEffectLevel);
  }, [glassEffectLevel]);

  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // Save Directory Hook
  const {
    saveDirectoryHandle,
    saveDirectoryPath,
    setSaveDirectoryHandle,
    setSaveDirectoryPath,
    handleSetSaveDirectory,
    saveMediaToHandle,
    handleSelectSaveDirectory,
    handleOpenSaveDirectory,
  } = useSaveDirectory({
    language,
    onNotification: showNotification,
  });

  // Credit Store — individual selectors
  const monthlyCredit = useCreditStore(state => state.monthlyCredit);
  const userAcknowledgedPaidUsage = useCreditStore(state => state.userAcknowledgedPaidUsage);
  const manualUsedCredit = useCreditStore(state => state.manualUsedCredit);
  const setMonthlyCredit = useCreditStore(state => state.setMonthlyCredit);
  const setUserAcknowledgedPaidUsage = useCreditStore(state => state.setUserAcknowledgedPaidUsage);
  const setManualUsedCredit = useCreditStore(state => state.setManualUsedCredit);
  const initializeCredit = useCreditStore(state => state.initializeCredit);
  const updateTotalCredit = useCreditStore(state => state.updateTotalCredit);
  const updateCredit = useCreditStore(state => state.updateCredit);
  const handleCreditInputBlur = useCreditStore(state => state.handleCreditInputBlur);
  const handleManualUsedCreditChange = useCreditStore(state => state.handleManualUsedCreditChange);

  // ── Panel system (snap, docking, sidebar, drag) ────────────────────────────
  const {
    showLeftPanel, setShowLeftPanel,
    leftPanelState, setLeftPanelState,
    handleLeftPanelDragStart, handleLeftPanelResizeStart,
    toggleLeftPanelCollapse, resetLeftPanel,
    showOriginalImagePanel, setShowOriginalImagePanel,
    originalImagePanelState,
    handleOriginalImagePanelDragStart, handleOriginalImagePanelResizeStart,
    toggleOriginalImagePanelCollapse, resetOriginalImagePanel,
    handleOriginalImageSplitterResize,
    leftSidebar, setLeftSidebar,
    rightSidebar, setRightSidebar,
    undockPanelFromSidebar,
    snapLinksDisplay,
    handleVerticalSnapWith, handleVerticalUnsnap,
    handleLeftSplitterResize,
    getPanelPos, refreshAllSnapRefs,
    resetPanels,
    handleToolbarGroupDrag,
    handleStackWith,
  } = usePanelSystem();

  // F1/F2/F3 패널 토글 단축키 — usePanelSystem 이후에 배치 (패널 상태 접근 필요)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (isShortcut(e, 'toggleAppSettings')) {
        e.preventDefault();
        const uiState = useUIStore.getState();
        uiState.setShowAppSettingsModal(!uiState.showAppSettingsModal);
      } else if (isShortcut(e, 'toggleOriginalImagePanel')) {
        e.preventDefault();
        const isVisible = showOriginalImagePanel || originalImagePanelState.dockSide !== null;
        setShowOriginalImagePanel(!isVisible);
      } else if (isShortcut(e, 'toggleLeftPanel')) {
        e.preventDefault();
        setShowLeftPanel(!showLeftPanel);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showOriginalImagePanel, originalImagePanelState.dockSide, showLeftPanel, setShowOriginalImagePanel, setShowLeftPanel]);

  // Media History Hook — placed after usePanelSystem so leftPanelState.width is available
  const historyPanelCols: 1 | 2 | 3 = leftPanelState.width >= 400 ? 3 : leftPanelState.width >= 180 ? 2 : 1;
  const historyItemsPerPage = ROWS_PER_PAGE * historyPanelCols;
  const {
    generationBatches,
    setGenerationBatches,
    selectedMediaIds,
    setSelectedMediaIds,
    currentPage,
    setCurrentPage,
    downloadStatus,
    downloadedImageIds,
    allHistoryMedia,
    displayedHistoryMedia,
    currentMedia,
    totalPages,
    handleToggleMediaSelection,
    handleDeleteSelectedMedia,
    handleDeleteSingleMedia,
    handleHistoryDragStart,
    handleSelectAllToggle,
    handleDownload,
    handleDownloadSelectedMedia,
  } = useMediaHistory({
    language,
    onNotification: showNotification,
    saveDirectoryHandle,
    saveMediaToHandle,
    itemsPerPage: historyItemsPerPage,
  });

  const mainPanelRef = useRef<HTMLElement>(null);

  // ── Original Image Compare Panel ─────────────────────────────────────────────
  const [comparedMediaId, setComparedMediaId] = useState<string | null>(null);

  // Reset comparedMediaId when the referenced media is deleted from history
  useEffect(() => {
    if (comparedMediaId && !allHistoryMedia.find(m => m.id === comparedMediaId)) {
      setComparedMediaId(null);
    }
  }, [comparedMediaId, allHistoryMedia]);

  const handleSelectSourceImage = useCallback((mediaId: string) => {
    if (!mediaId) {
      setComparedMediaId(null);
      return;
    }
    const media = allHistoryMedia.find(m => m.id === mediaId);
    if (!media?.sourceImageId) {
      setComparedMediaId(mediaId);
      setShowOriginalImagePanel(true);
      return;
    }
    const { boardImages, setRole } = useCanvasStore.getState();
    const target = boardImages.find(b => b.id === media.sourceImageId);
    if (!target) {
      showNotification(t('section.originalImage.sourceMissing', language), 'error');
      return;
    }
    setRole([media.sourceImageId], 'original');
    setComparedMediaId(mediaId);
    setShowOriginalImagePanel(true);
  }, [allHistoryMedia, language, showNotification, setShowOriginalImagePanel]);

  useEffect(() => {
    useShortcutStore.getState();
  }, []);


  // Memory monitoring - detect high memory usage and warn user
  useEffect(() => {
    if (typeof window === 'undefined' || !('performance' in window)) return;

    const checkMemory = () => {
      const perf = performance as any;
      if (perf.memory) {
        const usedMB = perf.memory.usedJSHeapSize / 1048576;
        const limitMB = perf.memory.jsHeapSizeLimit / 1048576;
        const usagePercent = (usedMB / limitMB) * 100;

        // Warn if using over 80% of available memory
        if (usagePercent > 80) {
          console.warn(`[Memory] High usage: ${usedMB.toFixed(0)}MB / ${limitMB.toFixed(0)}MB (${usagePercent.toFixed(1)}%)`);

          // Suggest cleanup if over 90%
          if (usagePercent > 90) {
            showNotification(t('notification.highMemory', language), 'error');
          }
        }
      }
    };

    // Check every 2 minutes
    const interval = setInterval(checkMemory, 120000);
    return () => clearInterval(interval);
  }, [showNotification]);

  // [MEMORY V2] Check for recoverable sessions on startup
  useEffect(() => {
    const checkRecoverableSessions = async () => {
      if (!window.electronAPI?.getRecoverableSessions) return;

      try {
        const result = await window.electronAPI.getRecoverableSessions();
        if (result.success && result.sessions.length > 0) {
          // Only show if there are sessions with images
          setShowRecoveryModal(true);
        }
      } catch (error) {
        console.warn('[SessionRecovery] Failed to check sessions:', error);
      }
    };

    // Delay check to allow app to initialize
    const timer = setTimeout(checkRecoverableSessions, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Canvas Store — individual selectors
  const boardImages = useCanvasStore(state => state.boardImages);
  const boardGroups = useCanvasStore(state => state.boardGroups);
  const selectedImageIds = useCanvasStore(state => state.selectedImageIds);
  const selectedGroupIds = useCanvasStore(state => state.selectedGroupIds);
  const leftPanelTab = useCanvasStore(state => state.leftPanelTab);
  const memos = useCanvasStore(state => state.memos);
  const zoomToImage = useCanvasStore(state => state.zoomToImage);
  const setBoardImages = useCanvasStore(state => state.setBoardImages);
  const setBoardGroups = useCanvasStore(state => state.setBoardGroups);
  const setCanvasSelectedIds = useCanvasStore(state => state.setSelectedImageIds);
  const uploadImages = useCanvasStore(state => state.uploadImages);
  const updateImageWithHistory = useCanvasStore(state => state.updateImageWithHistory);
  const downloadSelection = useCanvasStore(state => state.downloadSelection);
  const setChatHistory = useCanvasStore(state => state.setChatHistory);
  const setLeftPanelTab = useCanvasStore(state => state.setLeftPanelTab);
  const clearCanvas = useCanvasStore(state => state.clearCanvas);
  const groupEditedImage = useCanvasStore(state => state.groupEditedImage);
  const groupSelection = useCanvasStore(state => state.groupSelection);
  const ungroupSelection = useCanvasStore(state => state.ungroupSelection);
  const deleteSelection = useCanvasStore(state => state.deleteSelection);
  const aiSortImages = useCanvasStore(state => state.aiSortImages);
  const alignSelection = useCanvasStore(state => state.alignSelection);





  useEffect(() => {
    const restoreHandle = async () => {
      try {
        const handle = await loadHandle();
        if (handle) {
          setSaveDirectoryHandle(handle);
        }
      } catch (error) {
        console.error('Failed to load save directory handle from DB:', error);
      }
    };
    restoreHandle();
  }, []);

  const {
    generationQueue,
    isProcessing,
    isPaused,
    queueGeneration,
    cancelAll,
    cancelSingleTask,
    pauseGeneration,
    resumeGeneration,
    reorderGenerationQueue,
  } = useImageGeneration({
    monthlyCredit,
    setMonthlyCredit,
    userAcknowledgedPaidUsage,
    modelName,
    saveDirectoryHandle,
    saveDirectoryPath,
    setGenerationBatches,
    setCurrentPage,
    setShowUsagePlanModal: setShowAppSettingsModal,
    setShowQuotaModal,
    language,
    mainPanelRef,
    onNotification: showNotification,
  });

  const originalImage = useMemo(() => boardImages.find(img => img.role === 'original'), [boardImages]);
  const isOriginalImageSelected = useMemo(
    () => !originalImage || selectedImageIds.has(originalImage.id),
    [originalImage, selectedImageIds]
  );
  const hasOriginalImage = useMemo(() => !!originalImage, [originalImage]);

  // ── Workspace management ───────────────────────────────────────────────────
  const {
    isDirty, setIsDirty,
    pendingWorkspace, setPendingWorkspace,
    pendingNewWorkspace, setPendingNewWorkspace,
    workspaceFilePath, setWorkspaceFilePath,
    folders, quitAfterSave,
    markAsClean, saveFolders, animateProgress,
    handleSaveWorkspace, handleNewWorkspace, handleLoadWorkspace,
    handleExportPromptPresets, handleImportPromptPresets,
  } = useWorkspace({
    mainPanelRef,
    saveDirectoryHandle,
    handleSetSaveDirectory,
    setSaveDirectoryHandle,
    setSaveDirectoryPath,
  });

  // ── Editor & viewer handlers ───────────────────────────────────────────────
  const {
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
  } = useEditorHandlers({
    mainPanelRef,
    customPrompt,
    modelName,
    queueGeneration,
    handleLoadWorkspace,
  });

  const isModalOpen = !!zoomedImageSrc || !!unifiedEditingImage || showAppSettingsModal || showQuotaModal || showExitConfirmModal || isSaveModalOpen || isOverlayVisible;

  // ── 의상(costumeRef) 역할 이미지 선택 시 concept 팝오버 자동 열기 ────────────
  const selectedCostumeRefImageId = useMemo(
    () => boardImages.find(img => img.role === 'costumeRef' && selectedImageIds.has(img.id))?.id ?? null,
    [boardImages, selectedImageIds]
  );
  const prevSelectedCostumeRefIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevSelectedCostumeRefIdRef.current;
    prevSelectedCostumeRefIdRef.current = selectedCostumeRefImageId;
    // costumeRef 이미지가 새로 선택됐을 때만 concept 팝오버 열기
    if (selectedCostumeRefImageId && selectedCostumeRefImageId !== prevId) {
      useToolbarStore.getState().setActiveToolId('concept');
    }
  }, [selectedCostumeRefImageId]);

  // ── costumeRef 역할 이미지 전부 해제 시 concept 팝오버 닫기 + 상태 리셋 ────────
  const costumeRefCount = useMemo(
    () => boardImages.filter(img => img.role === 'costumeRef').length,
    [boardImages]
  );
  const prevCostumeRefCountRef = useRef<number>(costumeRefCount);
  useEffect(() => {
    const prev = prevCostumeRefCountRef.current;
    prevCostumeRefCountRef.current = costumeRefCount;
    // costumeRef가 하나 이상 있다가 0이 됐을 때만 처리
    if (prev > 0 && costumeRefCount === 0) {
      if (useToolbarStore.getState().activeToolId === 'concept') {
        useToolbarStore.getState().setActiveToolId(null);
      }
      useGenerationStore.getState().setSelectedClothingConcept(null);
      useGenerationStore.getState().setSelectedObjectItems([]);
      useGenerationStore.getState().setBodyPartReferenceMap({});
    }
  }, [costumeRefCount]);

  // ── 포즈(poseRef) 역할 이미지 선택 시 pose 팝오버 자동 열기 ─────────────────
  const selectedPoseRefImageId = useMemo(
    () => boardImages.find(img => img.role === 'poseRef' && selectedImageIds.has(img.id))?.id ?? null,
    [boardImages, selectedImageIds]
  );
  const prevSelectedPoseRefIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevSelectedPoseRefIdRef.current;
    prevSelectedPoseRefIdRef.current = selectedPoseRefImageId;
    // poseRef 이미지가 새로 선택됐을 때만 pose 팝오버 열기
    if (selectedPoseRefImageId && selectedPoseRefImageId !== prevId) {
      useToolbarStore.getState().setActiveToolId('pose');
    }
  }, [selectedPoseRefImageId]);

  // ── poseRef 역할 이미지 전부 해제 시 pose 팝오버 닫기 ────────────────────────
  const poseRefCount = useMemo(
    () => boardImages.filter(img => img.role === 'poseRef').length,
    [boardImages]
  );
  const prevPoseRefCountRef = useRef<number>(poseRefCount);
  useEffect(() => {
    const prev = prevPoseRefCountRef.current;
    prevPoseRefCountRef.current = poseRefCount;
    // poseRef가 하나 이상 있다가 0이 됐을 때만 팝오버 닫기
    if (prev > 0 && poseRefCount === 0) {
      if (useToolbarStore.getState().activeToolId === 'pose') {
        useToolbarStore.getState().setActiveToolId(null);
      }
    }
  }, [poseRefCount]);

  // ── 툴바 편집 도구(6~9) → 팝오버 패널 연동 + uiStore 동기화 ──────────────────
  const EDITOR_TOOL_KEYS = useMemo(() => new Set(['crop', 'object', 'relight', 'inpaint']), []);
  // 편집 탭에 전달할 유효한 이미지 src (stale blob/file:// URL 방어용)
  const [editorLocalImageSrc, setEditorLocalImageSrc] = useState<string | null>(null);
  // 이전 toolId 추적 — originalImage 변경 vs 툴 변경 구분용
  const prevEditorToolIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevTool = prevEditorToolIdRef.current;       // 이전값 캡처
    prevEditorToolIdRef.current = toolbarActiveToolId;  // 현재값 갱신

    // object 탭에서 벗어날 때 상태 즉시 해제 (창 닫기 또는 다른 툴 전환 모두 처리)
    if (prevTool === 'object' && toolbarActiveToolId !== 'object') {
      useEditorStore.getState().resetObjectEditor();
    }

    if (!toolbarActiveToolId || !EDITOR_TOOL_KEYS.has(toolbarActiveToolId)) {
      if (!toolbarActiveToolId) useEditorStore.getState().setEditingImageId(null);
      setIsEditorOpen(false);
      setEditorMode(null);
      setEditorLocalImageSrc(null);
      return;
    }
    useEditorStore.getState().setEditingImageId(originalImage?.id ?? null);
    // 처음 crop 활성화 시 cropBox 초기화
    if (toolbarActiveToolId === 'crop' && originalImage && !useEditorStore.getState().cropBox) {
      useEditorStore.getState().resetCrop(originalImage.width, originalImage.height);
    }
    // 처음 relight 활성화 시 기본 조명 추가
    if (toolbarActiveToolId === 'relight' && useEditorStore.getState().lightSources.length === 0) {
      useEditorStore.getState().addLight();
    }
    // uiStore 동기화 — ActionButtons/RoleThumbnails가 에디터 모드를 인식하도록 (도킹 여부 무관)
    setIsEditorOpen(true);
    setEditorMode(toolbarActiveToolId as 'crop' | 'object' | 'relight' | 'inpaint');

    if (!originalImage) {
      setEditorLocalImageSrc(null);
      return;
    }

    // ensureBoardImageFile로 유효한 URL 확보 (stale blob/file:// URL 방어)
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    ensureBoardImageFile(originalImage, 'original').then(file => {
      if (cancelled) return;
      if (file) {
        createdBlobUrl = URL.createObjectURL(file);
        setEditorLocalImageSrc(createdBlobUrl);
      } else {
        setEditorLocalImageSrc(
          originalImage.highResSrc || originalImage.previewSrc || originalImage.src || null
        );
      }
    });

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolbarActiveToolId, originalImage?.id, originalImage?.src, originalImage?.highResSrc, originalImage?.previewSrc]);

  // ── 툴바 편집 도구 생성 핸들러 ──────────────────────────────────────────────
  const handleToolbarEditorGenerate = useCallback(async () => {
    const activeTool = useToolbarStore.getState().activeToolId;
    if (!activeTool || !['crop', 'object', 'relight'].includes(activeTool)) return;

    const editorState = useEditorStore.getState();
    const editingImage = useCanvasStore.getState().boardImages.find(img => img.id === editorState.editingImageId);
    if (!editingImage) {
      showNotification(t('error.selectImageToEdit', language), 'error');
      return;
    }

    const { selectedResolution, selectedAspectRatio } = useGenerationStore.getState();
    const { imageDisplaySize } = editorState;

    // ── CROP ──────────────────────────────────────────────────────────────────
    if (activeTool === 'crop') {
      const { cropBox, cropPrompt } = editorState;
      if (!cropBox || !imageDisplaySize) {
        showNotification(t('notification.imageStillLoading', language), 'error');
        return;
      }
      const scaleX = imageDisplaySize.naturalWidth / imageDisplaySize.width;
      const scaleY = imageDisplaySize.naturalHeight / imageDisplaySize.height;
      const isExpanding =
        cropBox.x < 0 || cropBox.y < 0 ||
        cropBox.x + cropBox.width > imageDisplaySize.width ||
        cropBox.y + cropBox.height > imageDisplaySize.height;

      // stale blob URL 방어: ensureBoardImageFile로 유효한 URL 확보 후 이미지 로드
      // (에디터 UI 표시와 동일한 보호 경로 사용)
      const img = new Image();
      let freshBlobUrl: string | null = null;
      try {
        const file = await ensureBoardImageFile(editingImage, 'original');
        const imgSrc = file
          ? (freshBlobUrl = URL.createObjectURL(file))
          : (editingImage.highResSrc || editingImage.previewSrc || editingImage.src);
        if (!imgSrc) {
          if (freshBlobUrl) URL.revokeObjectURL(freshBlobUrl);
          showNotification(t('notification.imageSourceUnavailable', language), 'error');
          return;
        }
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error('이미지 로드 실패'));
          img.src = imgSrc;
        });
      } catch {
        showNotification(t('notification.imageLoadError', language), 'error');
        if (freshBlobUrl) URL.revokeObjectURL(freshBlobUrl);
        return;
      }
      // img에 이미지가 로드된 후 임시 URL 해제 (img element는 디코딩된 이미지를 메모리에 보유)
      if (freshBlobUrl) URL.revokeObjectURL(freshBlobUrl);

      if (isExpanding || cropPrompt.trim().length > 0) {
        // AI 이미지 확장
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(cropBox.width * scaleX);
        canvas.height = Math.round(cropBox.height * scaleY);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img,
          Math.round(-cropBox.x * scaleX), Math.round(-cropBox.y * scaleY),
          imageDisplaySize.naturalWidth, imageDisplaySize.naturalHeight
        );
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return;
        const expandedFile = new File([blob], 'expanded.png', { type: 'image/png' });
        queueGeneration({
          id: `task-toolbar-expand-${Date.now()}`, taskType: 'image',
          originalImage: expandedFile, sourceImageId: editingImage.id,
          sourceImageDisplaySize: { width: imageDisplaySize.width, height: imageDisplaySize.height },
          aiEditAction: 'expand' as AiAction, customPrompt: cropPrompt,
          textureImages: [], backgroundImage: null, backgroundImageAspectRatio: null,
          poseControlImage: null, cameraView: null, bodyPartReferenceMap: {},
          selectedClothingItems: [], selectedObjectItems: [], selectedActionPose: null,
          useAposeForViews: false, isApplyingFullOutfit: false, isApplyingTop: false, isApplyingBottom: false,
          lightDirection: null, lightIntensity: null, maskImage: null,
          selectedPalette: null, numPaletteColors: 4, isAutoColorizeSketch: false,
          resolution: selectedResolution as Resolution, aspectRatio: selectedAspectRatio as AspectRatio, modelName,
        });
      } else {
        // 단순 크롭 → 새 BoardImage 생성
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(cropBox.width * scaleX);
        canvas.height = Math.round(cropBox.height * scaleY);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img,
          cropBox.x * scaleX, cropBox.y * scaleY, canvas.width, canvas.height,
          0, 0, canvas.width, canvas.height
        );
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return;
        const croppedFile = new File([blob], `crop-${editingImage.file?.name ?? 'image'}.png`, { type: 'image/png' });
        const blobUrl = blobManager.create(blob);
        const MAX_DIM = 512;
        let dW = canvas.width, dH = canvas.height;
        if (dW > MAX_DIM || dH > MAX_DIM) {
          if (dW > dH) { dH = (dH / dW) * MAX_DIM; dW = MAX_DIM; }
          else { dW = (dW / dH) * MAX_DIM; dH = MAX_DIM; }
        }
        const zIndex = useCanvasStore.getState().zIndexCounter + 1;
        const newImageId = crypto.randomUUID();
        const newCroppedImage: BoardImage = {
          id: newImageId, src: blobUrl, file: croppedFile,
          x: editingImage.x + editingImage.width + 20, y: editingImage.y,
          width: dW, height: dH, role: 'none', zIndex, thumbnailSrc: blobUrl,
        };
        useCanvasStore.getState().groupEditedImage(editingImage.id, newCroppedImage);
      }
    }

    // ── OBJECT ────────────────────────────────────────────────────────────────
    else if (activeTool === 'object') {
      const { objectStates, objectPrompt, objectInteractionType, objectMemos } = editorState;
      if (!imageDisplaySize) return;
      const canvas = document.createElement('canvas');
      canvas.width = imageDisplaySize.naturalWidth;
      canvas.height = imageDisplaySize.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // 원본 이미지 로드
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const imgSrc = editingImage.highResSrc || editingImage.previewSrc || editingImage.src;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = imgSrc; });
      ctx.drawImage(img, 0, 0, imageDisplaySize.naturalWidth, imageDisplaySize.naturalHeight);
      // 객체 합성
      const scaleX = imageDisplaySize.naturalWidth / imageDisplaySize.width;
      const scaleY = imageDisplaySize.naturalHeight / imageDisplaySize.height;
      for (const objState of objectStates) {
        try {
          let objImg: HTMLImageElement | null = document.querySelector(`img[data-object-id="${objState.id}"]`);
          if (!objImg || !objImg.complete || objImg.naturalWidth === 0) {
            const r = await fetch(objState.src);
            const b = await r.blob();
            const tmpUrl = URL.createObjectURL(b);
            objImg = new Image();
            objImg.src = tmpUrl;
            await new Promise<void>((res, rej) => { objImg!.onload = () => res(); objImg!.onerror = rej; });
            setTimeout(() => URL.revokeObjectURL(tmpUrl), 100);
          }
          const { x, y, width, height, rotation } = objState.transform;
          ctx.save();
          ctx.translate((x + width / 2) * scaleX, (y + height / 2) * scaleY);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.scale(objState.transform.scaleX ?? 1, 1);
          ctx.drawImage(objImg, (-width / 2) * scaleX, (-height / 2) * scaleY, width * scaleX, height * scaleY);
          ctx.restore();
        } catch (err) {
          console.error('[toolbar object] Failed to draw object:', objState.id, err);
        }
      }
      // 메모 합성
      ctx.textBaseline = 'top';
      objectMemos.forEach(memo => {
        ctx.font = `${memo.fontSize}px sans-serif`;
        ctx.fillStyle = memo.color;
        ctx.fillText(memo.text || '', memo.x, memo.y);
      });
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const guideFile = new File([blob], 'guide.png', { type: 'image/png' });
      // 첫 객체 file 확보 (캔버스 삽입 시 file 없을 수 있음)
      let objectStateForTask: { file: File; transform: any } | undefined;
      if (objectStates.length > 0) {
        const first = objectStates[0];
        let f = first.file;
        if (!f && first.src) {
          try {
            const r = await fetch(first.src);
            const b = await r.blob();
            f = new File([b], 'obj.png', { type: 'image/png' });
          } catch { /* skip */ }
        }
        if (f) objectStateForTask = { file: f, transform: first.transform };
      }
      queueGeneration({
        id: `task-toolbar-object-${Date.now()}`, taskType: 'image',
        originalImage: guideFile, sourceImageId: editingImage.id,
        sourceImageDisplaySize: { width: imageDisplaySize.width, height: imageDisplaySize.height },
        aiEditAction: 'insertObject' as AiAction,
        objectToInsert: objectStateForTask
          ? { file: objectStateForTask.file, transform: objectStateForTask.transform, prompt: objectPrompt }
          : undefined,
        objectInteractionType: objectInteractionType ?? undefined,
        customPrompt: objectPrompt,
        textureImages: [], backgroundImage: null, backgroundImageAspectRatio: null,
        poseControlImage: null, cameraView: null, bodyPartReferenceMap: {},
        selectedClothingItems: [], selectedObjectItems: [], selectedActionPose: null,
        useAposeForViews: false, isApplyingFullOutfit: false, isApplyingTop: false, isApplyingBottom: false,
        lightDirection: null, lightIntensity: null, maskImage: null,
        selectedPalette: null, numPaletteColors: 4, isAutoColorizeSketch: false,
        resolution: selectedResolution as Resolution, aspectRatio: selectedAspectRatio as AspectRatio, modelName,
      });
    }

    // ── RELIGHT ───────────────────────────────────────────────────────────────
    else if (activeTool === 'relight') {
      const { lightSources, lightingPrompt } = editorState;
      if (lightSources.length === 0) {
        showNotification(t('notification.addLightFirst', language), 'error');
        return;
      }
      const lightDesc = lightSources.map((l, i) => {
        const typeText = l.type === 'omni' ? '전방향 조명' : l.type === 'direct' ? '방향성 조명' : '태양광';
        const pos = `위치 (${Math.round(l.position.x * 100)}%, ${Math.round(l.position.y * 100)}%)`;
        const dirText = (l.type === 'direct' || l.type === 'sun') && l.direction !== undefined
          ? `, 방향 ${l.direction}도` : '';
        return `조명 ${i + 1}: ${typeText}, ${pos}, 강도 ${l.intensity}%, 색상 ${l.color}${dirText}`;
      }).join('. ');
      let relightPrompt = `다음 조명 설정으로 이미지를 다시 조명하세요: ${lightDesc}. 원본 이미지의 구도와 내용은 유지하되, 조명만 변경하세요.`;
      if (lightingPrompt.trim()) relightPrompt += ` 추가 요청: ${lightingPrompt}`;
      let relightFile = editingImage.file || null;
      if (!relightFile && editingImage.src) {
        try {
          const r = await fetch(editingImage.src);
          const b = await r.blob();
          relightFile = new File([b], 'relight-source.png', { type: b.type || 'image/png' });
        } catch (err) {
          console.error('[toolbar relight] Failed to fetch image:', err);
        }
      }
      if (!relightFile) { showNotification(t('notification.originalImageLoadFailed', language), 'error'); return; }
      queueGeneration({
        id: `task-toolbar-relight-${Date.now()}`, taskType: 'image',
        originalImage: relightFile, sourceImageId: editingImage.id,
        aiEditAction: 'relight' as AiAction, variationCreativity: 30,
        customPrompt: relightPrompt,
        textureImages: [], backgroundImage: null, backgroundImageAspectRatio: null,
        poseControlImage: null, cameraView: null, bodyPartReferenceMap: {},
        selectedClothingItems: [], selectedObjectItems: [], selectedActionPose: null,
        useAposeForViews: false, isApplyingFullOutfit: false, isApplyingTop: false, isApplyingBottom: false,
        lightDirection: null, lightIntensity: null, maskImage: null,
        selectedPalette: null, numPaletteColors: 4, isAutoColorizeSketch: false,
        resolution: selectedResolution as Resolution, aspectRatio: selectedAspectRatio as AspectRatio, modelName,
      });
    }

  }, [modelName, queueGeneration, showNotification]);

  // editor-execute 이벤트 → 툴바 편집 도구 생성 트리거
  useEffect(() => {
    const handler = () => { handleToolbarEditorGenerate(); };
    window.addEventListener('editor-execute', handler);
    return () => window.removeEventListener('editor-execute', handler);
  }, [handleToolbarEditorGenerate]);

  // ── 툴바 도킹 대상 패널 목록 (memoized) ──────────────────────────────────────
  const toolbarDockTargets = useMemo<DockTarget[]>(() => [
    {
      id: 'left-panel',
      x: leftPanelState.x,
      y: leftPanelState.y,
      width: leftPanelState.width,
      height: leftPanelState.height,
      dockSide: leftPanelState.dockSide,
      isVisible: showLeftPanel || leftPanelState.dockSide !== null,
    },
    {
      id: 'original-image-panel',
      x: originalImagePanelState.x,
      y: originalImagePanelState.y,
      width: originalImagePanelState.width,
      height: originalImagePanelState.height,
      dockSide: originalImagePanelState.dockSide,
      isVisible: showOriginalImagePanel || originalImagePanelState.dockSide !== null,
    },
  ], [
    leftPanelState.x, leftPanelState.y, leftPanelState.width, leftPanelState.height,
    showLeftPanel, leftPanelState.dockSide,
    originalImagePanelState.x, originalImagePanelState.y, originalImagePanelState.width, originalImagePanelState.height,
    showOriginalImagePanel, originalImagePanelState.dockSide,
  ]);

  // ── 툴바/팝오버 헤더 드래그 시 도킹된 패널 그룹 함께 이동 ──────────────────
  const handleToolbarDragDelta = useCallback((dx: number, dy: number) => {
    const { toolbarDockedTo: docked } = useToolbarStore.getState();
    if (!docked) return;
    if (docked.panelId === 'screen-left' || docked.panelId === 'screen-right') return;
    handleToolbarGroupDrag(docked.panelId, dx, dy);
  }, [handleToolbarGroupDrag]);

  // ── 툴바+부유패널 그룹을 사이드바 도킹 패널 위/아래 엣지에 드롭 → stack 커밋 ──
  const handleToolbarGroupCommitStack = useCallback((
    targetPanelId: string,
    position: 'top' | 'bottom',
    draggingPanelId: string,
  ) => {
    // handleStackWith 내부에서 halfHeight를 재계산하므로 입력값은 일관성만 유지
    const APP_HEADER_HEIGHT = 36;
    const DOCK_MARGIN = 16;
    const MIN_STACK_HEIGHT = 120;
    const availableHeight = window.innerHeight - APP_HEADER_HEIGHT - DOCK_MARGIN;
    const halfHeight = Math.max(MIN_STACK_HEIGHT, availableHeight / 2);
    const targetNewY = position === 'top' ? APP_HEADER_HEIGHT + halfHeight : APP_HEADER_HEIGHT;
    handleStackWith(targetPanelId, position, halfHeight, targetNewY, draggingPanelId);
  }, [handleStackWith]);

  /** 바인딩 이미지 드래그 중 누적 위치 (일반 드래그와 동일 패턴: 드래그 종료 시 Zustand 커밋) */
  const boundImageDragPosRef = useRef<{ id: string; x: number; y: number } | null>(null);

  /** 툴바가 이미지에 바인딩된 상태에서 드래그 시 — 해당 이미지를 캔버스에서 이동 */
  const handleBoundImageDrag = useCallback((screenDx: number, screenDy: number) => {
    const { toolbarBoundImageId } = useToolbarStore.getState();
    if (!toolbarBoundImageId) return;
    const { zoom, boardImages } = useCanvasStore.getState();
    const canvasDx = screenDx / zoom;
    const canvasDy = screenDy / zoom;

    // 첫 호출 시 현재 이미지 위치로 ref 초기화
    if (!boundImageDragPosRef.current || boundImageDragPosRef.current.id !== toolbarBoundImageId) {
      const img = boardImages.find(i => i.id === toolbarBoundImageId);
      if (!img) return;
      boundImageDragPosRef.current = { id: toolbarBoundImageId, x: img.x, y: img.y };
    }

    boundImageDragPosRef.current = {
      id: toolbarBoundImageId,
      x: boundImageDragPosRef.current.x + canvasDx,
      y: boundImageDragPosRef.current.y + canvasDy,
    };

    // canvas-element-move 이벤트로 실시간 위치 반영 (일반 드래그와 동일)
    const img = boardImages.find(i => i.id === toolbarBoundImageId);
    window.dispatchEvent(new CustomEvent('canvas-element-move', {
      detail: { id: toolbarBoundImageId, x: boundImageDragPosRef.current.x, y: boundImageDragPosRef.current.y, groupId: img?.groupId },
    }));
    // 선택박스 + 선택바 실시간 업데이트
    if (img) {
      window.dispatchEvent(new CustomEvent('canvas-selection-override', {
        detail: { bounds: { x: boundImageDragPosRef.current.x, y: boundImageDragPosRef.current.y, width: img.width, height: img.height } },
      }));
      window.dispatchEvent(new CustomEvent('canvas-action-ring-override', {
        detail: { position: { x: boundImageDragPosRef.current.x, y: boundImageDragPosRef.current.y, width: img.width } },
      }));
    }
  }, []);

  /** 바인딩 이미지 드래그 종료 — Zustand 커밋 + history 저장 */
  const handleBoundImageDragEnd = useCallback(() => {
    const pos = boundImageDragPosRef.current;
    if (pos) {
      useCanvasStore.getState().setBoardImages(prev =>
        prev.map(img => img.id === pos.id ? { ...img, x: pos.x, y: pos.y } : img)
      );
      useCanvasStore.getState().saveHistory('move');
      boundImageDragPosRef.current = null;
    }
    // 선택박스 + 선택바 오버라이드 해제 (Zustand 값으로 복귀)
    window.dispatchEvent(new CustomEvent('canvas-selection-override', { detail: { bounds: null } }));
    window.dispatchEvent(new CustomEvent('canvas-action-ring-override', { detail: { position: null } }));
  }, []);

  // ── 바인딩 드래그 이벤트 버스 구독 (bindingDragBus) ─────────────────────────────
  useEffect(() => {
    const onDrag = (e: Event) => {
      const { dx, dy } = (e as CustomEvent<{ dx: number; dy: number }>).detail;
      handleBoundImageDrag(dx, dy);
    };
    const onDragEnd = () => handleBoundImageDragEnd();
    window.addEventListener('binding-drag', onDrag);
    window.addEventListener('binding-drag-end', onDragEnd);
    return () => {
      window.removeEventListener('binding-drag', onDrag);
      window.removeEventListener('binding-drag-end', onDragEnd);
    };
  }, [handleBoundImageDrag, handleBoundImageDragEnd]);

  // ── 툴바 도킹 시 패널 border-radius 병합 CSS 클래스 ─────────────────────────
  const getPanelToolbarClass = (panelId: string): string => {
    if (toolbarDockedTo?.panelId !== panelId) return '';
    return toolbarDockedTo.side === 'left'
      ? 'panel-has-toolbar-left'
      : 'panel-has-toolbar-right';
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => clearNotification(), notification.type === 'error' ? 6000 : 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  // 이미지 제한 경고 → 팝업 대신 기존 알림 시스템으로 전달
  useEffect(() => {
    const count = boardImages.length;
    const { imageLimitConfig, getImageWarningLevel } = useSettingsStore.getState();
    const level = getImageWarningLevel(count);
    if (level === 'none') return;

    const { hardLimit } = imageLimitConfig;
    const pct = Math.round((count / hardLimit) * 100);

    let message: string;
    let type: 'success' | 'error';

    if (level === 'hard') {
      message = count > hardLimit
        ? t('notification.imageLimit.hardExceeded', language, { count, hardLimit })
        : t('notification.imageLimit.hardReached', language, { count, hardLimit });
      type = 'error';
    } else if (level === 'strong') {
      message = t('notification.imageLimit.strong', language, { count, hardLimit, pct });
      type = 'error';
    } else {
      message = t('notification.imageLimit.warn', language, { count, hardLimit, pct });
      type = 'success';
    }

    showNotification(message, type);
    // boardImages.length 변화만 감지. getImageWarningLevel은 내부 set() 사이드이펙트가 있어 deps 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardImages.length]);


  // Clipboard Hook - handles copy/paste with event listeners
  const {
    compositeSelectionToBlob,
    handleCopyToClipboard,
    handlePasteFromClipboard,
  } = useClipboard({
    language,
    onNotification: showNotification,
    isModalOpen,
    unifiedEditingImage,
    handleUploadAndPositionImages,
  });

  const {
    setBodyPartReferenceMap, setSelectedClothingConcept, setSelectedObjectItems,
    setSelectedActionPose, setActiveRightPanelTab,
    setCameraView, setIsCameraViewActive,
    setSynthesisControlMode, setOriginalPreservationLevel, setCostumeCreativityLevel,
    setSelectedResolution, setSelectedAspectRatio,
    setVariationCreativity, setAutoColoringIntensity,
    setIsAutoColoringActive, setIsVariationActive,
  } = useGenerationStore();

  // 툴바 activeToolId → generationStore 동기화
  useEffect(() => {
    const generationTabKeys = ['concept', 'aiEdit', 'camera', 'pose', 'painting'];
    if (toolbarActiveToolId && generationTabKeys.includes(toolbarActiveToolId)) {
      setActiveRightPanelTab(toolbarActiveToolId as any);
    }
  }, [toolbarActiveToolId, setActiveRightPanelTab]);
  const handleLoadGenerationParams = useCallback((params: GenerationParams) => {
    // 1. Prompt
    setCustomPrompt(params.customPrompt);

    // 2. Concept tab settings
    setBodyPartReferenceMap(params.bodyPartReferenceMap);
    setSelectedClothingConcept(params.selectedClothingItems[0] || null);
    setSelectedObjectItems(params.selectedObjectItems);
    setSelectedActionPose(params.selectedActionPose);

    // 3. Camera settings
    if (params.cameraView) {
      setCameraView(params.cameraView);
      const hasCustomCamera = params.cameraView.yaw !== 0 || params.cameraView.pitch !== 0
        || params.cameraView.fov !== 50 || params.cameraView.cameraAnglePreset
        || params.cameraView.lensFocusPreset || params.cameraView.shotSizePreset;
      setIsCameraViewActive(!!hasCustomCamera);
    }

    // 4. Synthesis mode (concept tab - original preservation / reference design)
    if (params.synthesisControlMode) setSynthesisControlMode(params.synthesisControlMode);
    if (params.originalPreservationLevel !== undefined) setOriginalPreservationLevel(params.originalPreservationLevel);
    if (params.costumeCreativityLevel !== undefined) setCostumeCreativityLevel(params.costumeCreativityLevel);

    // 5. Resolution / Aspect Ratio
    if (params.resolution) setSelectedResolution(params.resolution);
    if (params.aspectRatio) setSelectedAspectRatio(params.aspectRatio);

    // 6. AI edit action detail restoration
    if (params.aiEditAction) {
      if (params.aiEditAction === 'autoColoring') {
        // autoColoring uses its own boolean toggle
        setIsAutoColoringActive(true);
        setIsVariationActive(false);
        if (params.autoColoringIntensity !== undefined) setAutoColoringIntensity(params.autoColoringIntensity);
      } else if (params.aiEditAction === 'variation') {
        // variation uses its own boolean toggle
        setIsVariationActive(true);
        setIsAutoColoringActive(false);
        if (params.variationCreativity !== undefined) setVariationCreativity(params.variationCreativity);
      } else if (params.aiEditAction === 'insertObject') {
        // insertObject requires editGuideImage (File) which cannot be serialized/restored from history.
        // Setting selectedAiEditAction without it would lock the generate button in a disabled state.
        useGenerationStore.setState({ selectedAiEditAction: null, isAutoColoringActive: false, isVariationActive: false });
      } else {
        // Other actions (extractPose, extractOutfit, removeBackground, etc.)
        // Use direct setState to avoid setSelectedAiEditAction's side effect of clearing all settings
        useGenerationStore.setState({
          selectedAiEditAction: params.aiEditAction,
          isAutoColoringActive: false,
          isVariationActive: false,
        });
      }
    } else {
      // No AI edit action — clear any active states
      useGenerationStore.setState({ selectedAiEditAction: null });
      setIsAutoColoringActive(false);
      setIsVariationActive(false);
      if (params.variationCreativity !== undefined) setVariationCreativity(params.variationCreativity);
      if (params.autoColoringIntensity !== undefined) setAutoColoringIntensity(params.autoColoringIntensity);
    }

    // 8. Grid Layout + Grounding Tools
    useGenerationStore.setState({
      gridLayout: params.gridLayout ?? null,
      groundingTools: params.groundingTools ?? [],
    });

    // 7. Auto-switch to the most relevant right panel tab (last to avoid side-effect conflicts)
    //    Priority: aiEdit > concept > camera > pose > concept(default)
    const hasConcept = Object.keys(params.bodyPartReferenceMap || {}).length > 0
      || (params.selectedClothingItems && params.selectedClothingItems.length > 0)
      || (params.selectedObjectItems && params.selectedObjectItems.length > 0);
    const hasCamera = params.cameraView && (
      params.cameraView.yaw !== 0 || params.cameraView.pitch !== 0
      || params.cameraView.fov !== 50 || params.cameraView.cameraAnglePreset
      || params.cameraView.lensFocusPreset || params.cameraView.shotSizePreset
    );
    const hasPose = !!params.selectedActionPose;

    if (params.aiEditAction) {
      setActiveRightPanelTab('aiEdit');
    } else if (hasConcept) {
      setActiveRightPanelTab('concept');
    } else if (hasCamera) {
      setActiveRightPanelTab('camera');
    } else if (hasPose) {
      setActiveRightPanelTab('pose');
    } else {
      setActiveRightPanelTab('concept');
    }

    showNotification('Generation parameters loaded!', 'success');
  }, [
    setCustomPrompt, setBodyPartReferenceMap, setSelectedClothingConcept,
    setSelectedObjectItems, setSelectedActionPose, showNotification,
    setCameraView, setIsCameraViewActive,
    setSynthesisControlMode, setOriginalPreservationLevel, setCostumeCreativityLevel,
    setSelectedResolution, setSelectedAspectRatio,
    setVariationCreativity, setAutoColoringIntensity, setActiveRightPanelTab,
    setIsAutoColoringActive, setIsVariationActive,
  ]);


  const handleDownloadCanvasImage = useCallback(async (image: BoardImage) => {
    const src = image.src;
    if (!src) return;
    const rawBlob = await fetch(src).then(r => r.blob());
    const pngBlob = rawBlob.type === 'image/png' ? rawBlob : await convertToPng(rawBlob);
    const objectUrl = URL.createObjectURL(pngBlob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'canvas-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  }, []);

  // 탭 닫기 dirty 가드
  const handleRequestCloseTab = useCallback((tabId: string) => {
    const tab = useWorkspaceTabsStore.getState().tabs.find(t => t.id === tabId);
    if (!tab) return;
    if (tab.isDirty) {
      setPendingCloseTabId(tabId);
      setShowExitConfirmModal(true);
    } else {
      useWorkspaceTabsStore.getState().closeTab(tabId);
    }
  }, [setPendingCloseTabId, setShowExitConfirmModal]);

  const handleExitDiscard = useCallback(() => {
    setShowExitConfirmModal(false);
    if (pendingCloseTabId) {
      useWorkspaceTabsStore.getState().closeTab(pendingCloseTabId);
      setPendingCloseTabId(null);
    } else if (pendingWorkspace) {
      setIsDirty(false);
      markAsClean();
      handleLoadWorkspace(pendingWorkspace.content, pendingWorkspace.filePath, true, 'replace');
      setPendingWorkspace(null);
    } else if (pendingNewWorkspace) {
      clearCanvas();
      setWorkspaceFilePath(null);
      markAsClean();
      if (window.electronAPI?.setWindowTitle) window.electronAPI.setWindowTitle('BanaNyang');
      setPendingNewWorkspace(false);
    } else {
      window.electronAPI.confirmClose();
    }
  }, [pendingCloseTabId, pendingWorkspace, pendingNewWorkspace, markAsClean, clearCanvas, setWorkspaceFilePath, handleLoadWorkspace, setPendingCloseTabId]);

  const handleExitSave = useCallback(async () => {
    setShowExitConfirmModal(false);
    if (pendingCloseTabId) {
      // Activate the tab temporarily, save, then close
      useWorkspaceTabsStore.getState().activateTab(pendingCloseTabId);
      await handleSaveWorkspace(false);
      useWorkspaceTabsStore.getState().closeTab(pendingCloseTabId);
      setPendingCloseTabId(null);
    } else if (pendingWorkspace) {
      await handleSaveWorkspace(false, true);
      setIsDirty(false);
      markAsClean();
      handleLoadWorkspace(pendingWorkspace.content, pendingWorkspace.filePath, true, 'replace');
      setPendingWorkspace(null);
    } else if (pendingNewWorkspace) {
      await handleSaveWorkspace(false);
      clearCanvas();
      setWorkspaceFilePath(null);
      markAsClean();
      if (window.electronAPI?.setWindowTitle) window.electronAPI.setWindowTitle('BanaNyang');
      setPendingNewWorkspace(false);
    } else {
      // 종료 시 dirty 상태인 모든 탭을 순차 저장
      const dirtyTabs = useWorkspaceTabsStore.getState().tabs.filter(t => t.isDirty);
      if (dirtyTabs.length === 0) {
        // 비정상 경로 안전장치 (모달이 떴는데 dirty 탭이 0개) — 활성 탭만 저장 후 종료
        quitAfterSave.current = true;
        handleSaveWorkspace(false);
        return;
      }
      for (const tab of dirtyTabs) {
        useWorkspaceTabsStore.getState().activateTab(tab.id);
        // 라우터/구독 전환과 React 렌더가 끝나도록 1프레임 대기
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        await handleSaveWorkspace(false);
      }
      if (window.electronAPI) window.electronAPI.savedAndReadyToQuit();
    }
  }, [pendingCloseTabId, pendingWorkspace, pendingNewWorkspace, markAsClean, clearCanvas, setWorkspaceFilePath, handleSaveWorkspace, handleLoadWorkspace, setPendingCloseTabId]);

  const handleExitCancel = useCallback(() => {
    setShowExitConfirmModal(false);
    setPendingWorkspace(null);
    setPendingNewWorkspace(false);
    setPendingCloseTabId(null);
  }, [setPendingCloseTabId]);

  const currentZoomIndex = useMemo(() => {
    if (!zoomedImageId) return -1;
    return allHistoryMedia.findIndex(m => m.id === zoomedImageId);
  }, [zoomedImageId, allHistoryMedia]);

  const zoomedMedia = useMemo(() =>
    zoomedImageId ? (allHistoryMedia.find(m => m.id === zoomedImageId) ?? null) : null,
    [zoomedImageId, allHistoryMedia]
  );

  const handleViewerDownload = useCallback(() => {
    if (!zoomedMedia) return;
    handleDownload({ stopPropagation: () => { } } as React.MouseEvent, zoomedMedia);
  }, [zoomedMedia, handleDownload]);

  const handleViewerDelete = useCallback(() => {
    if (!zoomedImageId) return;
    // 인접 이미지로 이동 후 삭제
    if (currentZoomIndex < allHistoryMedia.length - 1) {
      const next = allHistoryMedia[currentZoomIndex + 1];
      setZoomedImageId(next.id);
      setZoomedImageSrc(next.src);
    } else if (currentZoomIndex > 0) {
      const prev = allHistoryMedia[currentZoomIndex - 1];
      setZoomedImageId(prev.id);
      setZoomedImageSrc(prev.src);
    } else {
      handleCloseViewer();
    }
    handleDeleteSingleMedia(zoomedImageId);
  }, [zoomedImageId, currentZoomIndex, allHistoryMedia, handleDeleteSingleMedia, handleCloseViewer]);

  const handleNextImage = useCallback(() => {
    if (currentZoomIndex === -1 || currentZoomIndex >= allHistoryMedia.length - 1) return;
    const nextMedia = allHistoryMedia[currentZoomIndex + 1];
    setZoomedImageId(nextMedia.id);
    setZoomedImageSrc(nextMedia.src);
  }, [currentZoomIndex, allHistoryMedia]);

  const handlePrevImage = useCallback(() => {
    if (currentZoomIndex <= 0) return;
    const prevMedia = allHistoryMedia[currentZoomIndex - 1];
    setZoomedImageId(prevMedia.id);
    setZoomedImageSrc(prevMedia.src);
  }, [currentZoomIndex, allHistoryMedia]);

  const hasNext = currentZoomIndex !== -1 && currentZoomIndex < allHistoryMedia.length - 1;
  const hasPrev = currentZoomIndex > 0;

  const getStackVariant = (
    panelId: string,
    dockSide: 'left' | 'right' | null,
  ): 'sidebar-top' | 'sidebar-bottom' | 'snap-top' | 'snap-bottom' | null => {
    if (dockSide === 'left') {
      const idx = leftSidebar.panels.indexOf(panelId);
      if (idx === 0 && leftSidebar.panels.length >= 2) return 'sidebar-top';
      if (idx > 0 && idx === leftSidebar.panels.length - 1) return 'sidebar-bottom';
    } else if (dockSide === 'right') {
      const idx = rightSidebar.panels.indexOf(panelId);
      if (idx === 0 && rightSidebar.panels.length >= 2) return 'sidebar-top';
      if (idx > 0 && idx === rightSidebar.panels.length - 1) return 'sidebar-bottom';
    } else {
      if (snapLinksDisplay.some(([p]) => p === panelId)) return 'snap-top';
      if (snapLinksDisplay.some(([, c]) => c === panelId)) return 'snap-bottom';
    }
    return null;
  };

  // [TOOLBAR BIND] Compute header-icon props for the 2-stack sidebar toolbar binding selector.
  // Returns undefined onBindToolbarHere when the icon should not appear — PanelShell uses that
  // absence to hide the button. The toolbar's side relative to the panel always faces the canvas:
  //   panel docked left  → toolbar on 'right' edge   panel docked right → toolbar on 'left' edge.
  const getToolbarBindProps = (panelIdLocal: string): { toolbarBoundHere: boolean; onBindToolbarHere?: () => void } => {
    const stackPanels =
      leftSidebar.panels.length === 2 ? leftSidebar.panels :
      rightSidebar.panels.length === 2 ? rightSidebar.panels : null;
    if (!stackPanels || !stackPanels.includes(panelIdLocal)) {
      return { toolbarBoundHere: false };
    }
    if (!toolbarDockedTo || toolbarDockedTo.side === 'bottom' || !stackPanels.includes(toolbarDockedTo.panelId)) {
      return { toolbarBoundHere: false };
    }
    const boundHere = toolbarDockedTo.panelId === panelIdLocal;
    return {
      toolbarBoundHere: boundHere,
      onBindToolbarHere: () => {
        if (boundHere) return;
        useToolbarStore.getState().setToolbarDockedTo({
          panelId: panelIdLocal as any,
          side: toolbarDockedTo.side,
        });
      },
    };
  };

  return (
    <>

      {isOverlayVisible && <LoadingOverlay isLoading={loadingState.isLoading} message={loadingState.message} progress={loadingState.progress} isReversed={loadingState.isReversed} variant={loadingState.variant} />}
      <DraggableHeader
        language={language}
        onOpenSettings={(tab) => openAppSettings(tab)}
        onResetUI={resetPanels}
        // File menu
        onUploadImage={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.multiple = true;
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleUploadAndPositionImages(files);
          };
          input.click();
        }}
        onNewWorkspace={handleNewWorkspace}
        onSaveWorkspace={() => handleSaveWorkspace(false)}
        onSaveWorkspaceAs={() => handleSaveWorkspace(true)}
        onLoadWorkspace={() => handleLoadWorkspace(undefined, undefined, false, 'newTab')}
        onLoadWorkspaceInCurrentTab={() => handleLoadWorkspace(undefined, undefined, false, 'replace')}
        onExportPromptPresets={handleExportPromptPresets}
        onImportPromptPresets={handleImportPromptPresets}

        // Edit menu
        onCopy={handleCopyToClipboard}
        onPaste={handlePasteFromClipboard}
        onDelete={deleteSelection}
        onAlignImages={alignSelection}
        onAiSortImages={() => {
          const tabId = canvasTabRouter.getActiveTabId();
          const inst = canvasStoreRegistry.getInstance(tabId);
          const imgs: { groupId?: string }[] = inst?.getState().boardImages ?? [];
          const ungroupedCount = imgs.filter((img: { groupId?: string }) => !img.groupId).length;
          if (ungroupedCount < 2) {
            showNotification(t('aiSort.needMore', language), 'error');
            return;
          }
          const ui = useUIStore.getState();
          ui.setPendingAiSortTabId(tabId);
          ui.setPendingAiSortUngroupedCount(ungroupedCount);
          ui.setShowAiSortConfirmModal(true);
        }}
        onGroupSelection={groupSelection}
        onUngroupSelection={ungroupSelection}
        onRenameGroup={() => window.dispatchEvent(new CustomEvent('menu-rename-group'))}
        onEditGroup={() => window.dispatchEvent(new CustomEvent('menu-edit-group'))}
        // Image menu
        onZoomImage={() => {
          const selectedId = Array.from(selectedImageIds)[0];
          if (selectedId) {
            const img = boardImages.find(i => i.id === selectedId);
            if (img) setZoomedImageSrc(img.highResSrc || img.previewSrc || img.src);
          }
        }}
        onEditImage={() => {
          useToolbarStore.getState().toggleTool('crop');
        }}
        onCutImage={async () => {
          await handleCopyToClipboard();
          deleteSelection();
        }}
        onFlipHorizontal={() => {
          Array.from(selectedImageIds).forEach(id => {
            const img = boardImages.find(i => i.id === id);
            if (img) updateImageWithHistory(id, { scaleX: img.scaleX === -1 ? 1 : -1 });
          });
        }}
        onDownloadImage={() => downloadSelection(saveDirectoryHandle)}
        onAiAutoColoring={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setIsAutoColoringActive(true);
          useGenerationStore.getState().setIsVariationActive(false);
        }}
        onAiVariation={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setIsVariationActive(true);
          useGenerationStore.getState().setIsAutoColoringActive(false);
        }}
        onAiExtractPose={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('extractPose');
        }}
        onAiExtractOutfit={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('extractOutfit');
        }}
        onAiRemoveBackground={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('removeBackground');
        }}
        onAiKeepBackground={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('keepBackgroundOnly');
        }}
        onAiInsertObject={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('insertObject');
        }}
        onAiExpand={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('expand');
        }}
        onAiInpainting={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('inpainting');
        }}
        onAiPbr={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('pbr');
        }}
        onAiRelight={() => {
          useToolbarStore.getState().setActiveToolId('aiEdit');
          useGenerationStore.getState().setSelectedAiEditAction('relight');
        }}
        onSetRoleOriginal={() => {
          useCanvasStore.getState().setRoleForSelection('original');
        }}
        onSetRoleGeneralRef={() => Array.from(selectedImageIds).forEach(id => updateImageWithHistory(id, { role: 'generalRef' }))}
        onSetRoleCostumeRef={() => {
          Array.from(selectedImageIds).forEach(id => updateImageWithHistory(id, { role: 'costumeRef' }));
          useToolbarStore.getState().setActiveToolId('concept');
        }}
        onSetRolePoseRef={() => {
          Array.from(selectedImageIds).forEach(id => updateImageWithHistory(id, { role: 'poseRef' }));
          useToolbarStore.getState().setActiveToolId('pose');
        }}
        onSetRoleBackground={() => Array.from(selectedImageIds).forEach(id => updateImageWithHistory(id, { role: 'background' }))}
        onAddMemo={() => window.dispatchEvent(new CustomEvent('menu-add-memo'))}
        onLoadWorkflow={() => window.dispatchEvent(new CustomEvent('menu-load-workflow'))}
        // View menu
        onToggleGlassEffect={() => {
          const levels: Array<'transparent' | 'sunglasses' | 'off'> = ['transparent', 'sunglasses', 'off'];
          const currentIndex = levels.indexOf(glassEffectLevel);
          setGlassEffectLevel(levels[(currentIndex + 1) % levels.length]);
        }}
        isGlassEffectEnabled={glassEffectLevel !== 'off'}
        isAlwaysOnTop={false}
        onOpenLeftPanel={() => setShowLeftPanel(true)}
        onOpenOriginalImagePanel={() => setShowOriginalImagePanel(true)}
        // Selection state
        hasSelection={selectedImageIds.size > 0 || selectedGroupIds.size > 0}
        hasGroupSelection={selectedGroupIds.size > 0}
        hasImageSelection={selectedImageIds.size > 0}
        isOriginalImageSelected={isOriginalImageSelected}
        hasOriginalImage={hasOriginalImage}
        workspaceName={workspaceFilePath ? workspaceFilePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? null : null}
        onRequestCloseTab={handleRequestCloseTab}
      />
      <div className="flex flex-col h-screen overflow-hidden text-zinc-200" style={{ paddingTop: '72px' }}>
        {showAppSettingsModal && (
          <AppSettingsModal
            isOpen={showAppSettingsModal}
            initialTab={appSettingsInitialTab}
            initialApiSubTab={appSettingsApiSubTab ?? undefined}
            onSaveApiKey={(key) => { setApiKey(key); showNotification(t('appSettingsModal.save', language), 'success'); }}
            onClose={() => setShowAppSettingsModal(false)}
            monthlyCredit={monthlyCredit}
            onUpdateTotalCredit={updateTotalCredit}
            userAcknowledgedPaidUsage={userAcknowledgedPaidUsage}
            setUserAcknowledgedPaidUsage={setUserAcknowledgedPaidUsage}
            language={language}
            folders={folders}
            saveFolders={saveFolders}
            currentPrompt={customPrompt}
            onLoadPrompt={setCustomPrompt}
            modelName={modelName}
            setModelName={setModelName}
            onNotification={showNotification}
            manualUsedCredit={manualUsedCredit}
            onManualUsedCreditChange={handleManualUsedCreditChange}
            onUpdateCredit={updateCredit}
            onCreditInputBlur={handleCreditInputBlur}
          />
        )}
        {isSaveModalOpen && <SavePresetModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          onSave={(name, folderId) => {
            const newPreset = { id: crypto.randomUUID(), name, prompt: customPrompt };
            const newFolders = folders.map(f => f.id === folderId ? { ...f, presets: [...f.presets, newPreset] } : f);
            saveFolders(newFolders);
            showNotification(t('presets.promptSaved', language), 'success');
            setIsSaveModalOpen(false);
          }}
          folders={folders}
          language={language}
          initialFolderId={null}
        />}
        {showQuotaModal && (
          <QuotaExceededModal
            language={language}
            onStop={() => { setShowQuotaModal(false); cancelAll(); }}
            onContinue={() => { setUserAcknowledgedPaidUsage(true); setShowQuotaModal(false); }}
          />
        )}
        {showExitConfirmModal && (
          <ExitConfirmModal
            language={language}
            pendingWorkspace={pendingWorkspace}
            pendingNewWorkspace={pendingNewWorkspace}
            pendingCloseTab={pendingCloseTabId
              ? (() => {
                  const tab = useWorkspaceTabsStore.getState().tabs.find(t => t.id === pendingCloseTabId);
                  return tab ? { tabId: tab.id, title: tab.title } : null;
                })()
              : null}
            dirtyTabs={useWorkspaceTabsStore.getState().tabs
              .filter(t => t.isDirty)
              .map(t => ({ tabId: t.id, title: t.title }))}
            onDiscard={handleExitDiscard}
            onCancel={handleExitCancel}
            onSaveAndProceed={handleExitSave}
          />
        )}
        {showAiSortConfirmModal && pendingAiSortTabId && (
          <AiSortConfirmModal
            language={language}
            ungroupedCount={pendingAiSortUngroupedCount}
            initialAxis={aiSortAxis}
            initialMaxGroups={aiSortMaxGroups}
            initialVerify={aiSortVerifyClusters}
            onCancel={() => {
              const ui = useUIStore.getState();
              ui.setShowAiSortConfirmModal(false);
              ui.setPendingAiSortTabId(null);
            }}
            onConfirm={(axis, maxGroups, verify) => {
              const tabId = pendingAiSortTabId!;
              const ui = useUIStore.getState();
              ui.setShowAiSortConfirmModal(false);
              ui.setPendingAiSortTabId(null);
              const settings = useSettingsStore.getState();
              settings.setAiSortAxis(axis);
              settings.setAiSortMaxGroups(maxGroups);
              settings.setAiSortVerifyClusters(verify);
              runAiSort(tabId, language, { axis, maxGroups, verifyClusters: verify }, showNotification);
            }}
          />
        )}
        {showGenerationLoginPrompt && (
          <GenerationLoginPrompt
            onClose={() => setShowGenerationLoginPrompt(false)}
            onOpenApiSettings={() => { setShowGenerationLoginPrompt(false); openAppSettings('api'); }}
          />
        )}
        {/* [MEMORY OPTIMIZATION] Image limit warning - moved to top-center notification area */}
        {/* [MEMORY V2] Session recovery modal */}
        <SessionRecoveryModal
          isOpen={showRecoveryModal}
          onClose={() => setShowRecoveryModal(false)}
          onRecover={handleRecoverSession}
          language={language}
        />
        {/* [MEMORY V2] Developer profiler overlay - toggle with Ctrl+Shift+P */}
        <ProfilerOverlay />
        {zoomedImageSrc && (
          <ImageViewerModal
            src={zoomedImageSrc}
            onClose={handleCloseViewer}
            language={language}
            onNext={hasNext ? handleNextImage : undefined}
            onPrev={hasPrev ? handlePrevImage : undefined}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onDownload={zoomedMedia ? handleViewerDownload : undefined}
            onDelete={zoomedMedia ? handleViewerDelete : undefined}
            onLoadParams={zoomedMedia?.generationParams ? () => { handleLoadGenerationParams(zoomedMedia.generationParams!); handleCloseViewer(); } : undefined}
            generationParams={zoomedMedia?.generationParams}
            downloadStatus={zoomedMedia ? downloadStatus[zoomedMedia.id] : undefined}
          />
        )}

        <div className="relative flex flex-grow overflow-hidden">
          <main ref={mainPanelRef} className="flex-grow flex flex-col relative min-h-0">
            <Canvas
              key={activeTabId ?? 'default'}
              allHistoryMedia={allHistoryMedia}
              language={language}
              onZoomSelection={handleZoomImage}
              onZoomCanvasImage={(image) => handleZoomImage(image.src ?? '')}
              onDownloadCanvasImage={handleDownloadCanvasImage}
              onEditSelection={handleStartUnifiedEdit}
              onNewWorkspace={handleNewWorkspace}
              onSaveWorkspace={() => handleSaveWorkspace(false)}
              onSaveWorkspaceAs={() => handleSaveWorkspace(true)}
              onLoadWorkspace={handleLoadWorkspace}
              mainPanelRef={mainPanelRef}
              customPrompt={customPrompt}
              onCustomPromptChange={setCustomPrompt}
              onQueueGeneration={queueGeneration}
              isProcessing={isProcessing}
              generationQueue={generationQueue}
              originalImage={originalImage}
              modelName={modelName}
              notification={notification}
              onNotification={showNotification}
              isModalOpen={isModalOpen && !unifiedEditingImage}
              editingImageId={unifiedEditingImage?.id}
              onCopySelection={handleCopyToClipboard}
              onPasteFromClipboard={handlePasteFromClipboard}
              folders={folders}
              saveFolders={saveFolders}
              onSavePreset={() => {
                if (!customPrompt.trim()) {
                  showNotification(t('presets.noPromptToSave', language), 'error');
                  return;
                }
                setIsSaveModalOpen(true);
              }}
              onLoadGenerationParams={handleLoadGenerationParams}
              saveDirectoryHandle={saveDirectoryHandle}
              onSetSaveDirectoryHandle={handleSetSaveDirectory}
              handleUploadAndPositionImages={handleUploadAndPositionImages}
              onCanvasClick={() => showAppSettingsModal && setShowAppSettingsModal(false)}
            />
            {activeTabLoadingState && (
              <LoadingOverlay
                scope="workspace"
                isLoading={activeTabLoadingState.isLoading}
                message={activeTabLoadingState.message}
                progress={activeTabLoadingState.progress}
                isReversed={activeTabLoadingState.isReversed}
                variant={activeTabLoadingState.variant}
              />
            )}
          </main>

          <PanelShell
            panelId="original-image-panel"
            isVisible={showOriginalImagePanel}
            panelState={originalImagePanelState}
            stackVariant={getStackVariant('original-image-panel', originalImagePanelState.dockSide)}
            isSnapped={snapLinksDisplay.some(([p, c]) => p === 'original-image-panel' || c === 'original-image-panel')}
            title={t('section.originalImage.title', language)}
            icon={<PhotoIcon className="w-5 h-5 text-white/80" />}
            language={language}
            onDragStart={handleOriginalImagePanelDragStart}
            onToggleCollapse={toggleOriginalImagePanelCollapse}
            onReset={resetOriginalImagePanel}
            onClose={() => setShowOriginalImagePanel(false)}
            onUnsnap={() => handleVerticalUnsnap('original-image-panel')}
            onUndockFromSidebar={originalImagePanelState.dockSide ? () => undockPanelFromSidebar('original-image-panel', originalImagePanelState.dockSide as 'left' | 'right') : undefined}
            onResizeStart={handleOriginalImagePanelResizeStart}
            extraClassName={getPanelToolbarClass('original-image-panel')}
            {...getToolbarBindProps('original-image-panel')}
          >
            <OriginalImagePanel
              language={language}
              allHistoryMedia={allHistoryMedia}
              comparedMediaId={comparedMediaId}
              onSelectComparedMedia={handleSelectSourceImage}
              panelWidth={originalImagePanelState.width}
            />
          </PanelShell>

          <PanelShell
            panelId="left-panel"
            isVisible={showLeftPanel}
            panelState={leftPanelState}
            stackVariant={getStackVariant('left-panel', leftPanelState.dockSide)}
            isSnapped={snapLinksDisplay.some(([p, c]) => p === 'left-panel' || c === 'left-panel')}
            title={t('section.history.title', language)}
            icon={<GalleryIcon className="w-5 h-5 text-white/80" />}
            language={language}
            onDragStart={handleLeftPanelDragStart}
            onToggleCollapse={toggleLeftPanelCollapse}
            onReset={resetLeftPanel}
            onClose={() => setShowLeftPanel(false)}
            onUnsnap={() => handleVerticalUnsnap('left-panel')}
            onUndockFromSidebar={leftPanelState.dockSide ? () => undockPanelFromSidebar('left-panel', leftPanelState.dockSide as 'left' | 'right') : undefined}
            onResizeStart={handleLeftPanelResizeStart}
            extraClassName={getPanelToolbarClass('left-panel')}
            {...getToolbarBindProps('left-panel')}
          >
            <LeftPanel
              language={language}
              monthlyCredit={monthlyCredit}
              manualUsedCredit={manualUsedCredit}
              onManualUsedCreditChange={handleManualUsedCreditChange}
              onUpdateCredit={updateCredit}
              onCreditInputBlur={handleCreditInputBlur}
              isProcessing={isProcessing}
              isPaused={isPaused}
              generationQueue={generationQueue}
              onCancelAll={cancelAll}
              onCancelSingleTask={cancelSingleTask}
              onPauseGeneration={pauseGeneration}
              onResumeGeneration={resumeGeneration}
              onReorderQueue={reorderGenerationQueue}
              allHistoryMedia={allHistoryMedia}
              saveDirectoryHandle={saveDirectoryHandle}
              onSelectSaveDirectory={handleSelectSaveDirectory}
              onOpenSaveDirectory={handleOpenSaveDirectory}
              onSetSaveDirectoryHandle={handleSetSaveDirectory}
              selectedMediaIds={selectedMediaIds}
              onSelectAllToggle={handleSelectAllToggle}
              onDownloadSelectedMedia={handleDownloadSelectedMedia}
              onDeleteSelectedMedia={handleDeleteSelectedMedia}
              currentMedia={currentMedia}
              onHistoryDragStart={handleHistoryDragStart}
              onToggleMediaSelection={handleToggleMediaSelection}
              onZoomImage={handleZoomImage}
              onSelectSourceImage={handleSelectSourceImage}
              onDownload={handleDownload}
              downloadStatus={downloadStatus}
              downloadedImageIds={downloadedImageIds}
              totalPages={totalPages}
              currentPage={currentPage}
              onSetCurrentPage={setCurrentPage}
              leftPanelWidth={leftPanelState.width}
              onUpdateTotalCredit={updateTotalCredit}
              onLoadGenerationParams={handleLoadGenerationParams}
              onNotification={showNotification}
            />
          </PanelShell>
          <SidebarControls side="left" sidebar={leftSidebar} setSidebar={setLeftSidebar} />

          <GroupQuickBar language={language} mainPanelRef={mainPanelRef} />

          <CanvasNavigator
            language={language}
            canvasRef={mainPanelRef}
            rightOffset={32}
          />

          <SidebarControls side="right" sidebar={rightSidebar} setSidebar={setRightSidebar} />
          {/* UnifiedEditorModal 비활성화 — 편집 탭이 툴바 팝오버로 이동됨 (백업: UnifiedEditorModal.backup.tsx) */}
          {/* {unifiedEditingImage && (
            <UnifiedEditorModal
              key={`editor-session-${editorSessionRef.current}`}
              image={unifiedEditingImage}
              onComplete={handleUnifiedEditComplete}
              onCancel={() => { setUnifiedEditingImage(null); setIsEditorOpen(false); }}
              language={language}
              onNotification={showNotification}
              modelName={modelName}
            />
          )} */}
          {/* ── 배치예약목록 플로팅 패널 ────────────────────────────── */}
          {/* ── 플로팅 툴바 ─────────────────────────── */}
          <>
            <FloatingToolbar
              language={language as 'ko' | 'en'}
              dockTargets={toolbarDockTargets}
              onDockedPanelDragDelta={handleToolbarDragDelta}
              onCommitGroupStack={handleToolbarGroupCommitStack}
              modelName={modelName}
            />
            <ToolbarPopoverPanel language={language as 'ko' | 'en'} onToolbarDragDelta={handleToolbarDragDelta}>
              {/* Generation group (1~5) */}
              {toolbarActiveToolId === 'concept' && (
                <ConceptTab language={language} onNotification={showNotification} />
              )}
              {toolbarActiveToolId === 'aiEdit' && (
                <AiEditPanel language={language} onNotification={showNotification} queueGeneration={queueGeneration} />
              )}
              {toolbarActiveToolId === 'camera' && (
                <CameraTab language={language} />
              )}
              {toolbarActiveToolId === 'pose' && (
                <PoseTab language={language} />
              )}
              {toolbarActiveToolId === 'painting' && (
                <PaintingTab language={language} />
              )}
              {/* Editor group (6~9) */}
              {toolbarActiveToolId === 'crop' && (
                <CropTab language={language} localImageSrc={editorLocalImageSrc} />
              )}
              {toolbarActiveToolId === 'object' && (
                <ObjectTab language={language} onNotification={showNotification} localImageSrc={editorLocalImageSrc} />
              )}
              {toolbarActiveToolId === 'relight' && (
                <RelightTab language={language} localImageSrc={editorLocalImageSrc} />
              )}
              {toolbarActiveToolId === 'inpaint' && (
                <InpaintingTab language={language} onNotification={showNotification} localImageSrc={editorLocalImageSrc} />
              )}
            </ToolbarPopoverPanel>
          </>

          {/* Global Notification - Always on top */}
          {snapIndicator && <SnapIndicator {...snapIndicator} />}
          {/* Center notification area */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: Z_INDEX.DROPDOWN }}>
            {notification && (
              <div
                key={notification.id}
                className={`pointer-events-auto flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-fade-in-out-center ${notification.type === 'success' ? 'bg-yellow-400 text-zinc-800' : notification.type === 'warning' ? 'bg-orange-500 text-white' : 'bg-red-600 text-white'}`}
              >
                <span>{notification.message}</span>
              </div>
            )}
          </div>
        </div>
      </div >
      <UpdateNotificationToast />
      <UpdatePromptModal />
    </>
  );
}
