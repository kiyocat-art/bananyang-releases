import { create } from 'zustand';
import { SnapIndicatorState } from '../components/SnapIndicator';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
    id: number;
    message: string;
    type: NotificationType;
}

// Re-export for convenience
export type { SnapIndicatorState } from '../components/SnapIndicator';

export type AppSettingsTab = 'general' | 'toolbar' | 'system' | 'api' | 'shortcuts' | 'presets';
export type ApiSubTab = 'google' | 'apiKey' | 'openai' | 'flux';

interface UIState {
    // Modal states
    showAppSettingsModal: boolean;
    appSettingsInitialTab: AppSettingsTab;
    appSettingsApiSubTab: ApiSubTab | null;
    showQuotaModal: boolean;
    showExitConfirmModal: boolean;
    isSaveModalOpen: boolean;
    showGenerationLoginPrompt: boolean;
    pendingCloseTabId: string | null;

    // AI Sort confirm modal
    showAiSortConfirmModal: boolean;
    pendingAiSortMaxGroups: number | null;
    pendingAiSortTabId: string | null;
    pendingAiSortUngroupedCount: number;

    // Editor state (persistent panel)
    isEditorOpen: boolean;
    editorMode: 'crop' | 'expand' | 'generate' | 'object' | 'relight' | 'pbr' | 'inpaint' | null; // Track editor operation for button label

    // Notification
    notification: Notification | null;

    // Snap indicator
    snapIndicator: SnapIndicatorState | null;

    // Loading overlay
    loadingState: {
        isLoading: boolean;
        message: string;
        progress: number;
        isReversed: boolean; // When true, border empties (for save animation)
        variant: 'default' | 'glass'; // 'glass' = liquid glass blur effect for bulk uploads
    };
    isOverlayVisible: boolean;
}

interface UIActions {
    // Modal actions
    setShowAppSettingsModal: (show: boolean) => void;
    openAppSettings: (tab?: AppSettingsTab) => void;
    openAppSettingsApiTab: (subTab: ApiSubTab) => void;
    setShowQuotaModal: (show: boolean) => void;
    setShowExitConfirmModal: (show: boolean) => void;
    setIsSaveModalOpen: (open: boolean) => void;
    setShowGenerationLoginPrompt: (show: boolean) => void;
    setPendingCloseTabId: (id: string | null) => void;

    // AI Sort confirm modal actions
    setShowAiSortConfirmModal: (show: boolean) => void;
    setPendingAiSortMaxGroups: (n: number | null) => void;
    setPendingAiSortTabId: (id: string | null) => void;
    setPendingAiSortUngroupedCount: (count: number) => void;

    // Editor actions
    setIsEditorOpen: (open: boolean) => void;
    setEditorMode: (mode: 'crop' | 'expand' | 'generate' | 'object' | 'relight' | 'pbr' | 'inpaint' | null) => void;

    // Notification actions
    showNotification: (message: string, type: NotificationType) => void;
    clearNotification: () => void;

    // Snap indicator actions
    setSnapIndicator: (indicator: SnapIndicatorState | null) => void;

    // Loading overlay actions
    setLoadingState: (state: Partial<UIState['loadingState']> | ((prev: UIState['loadingState']) => UIState['loadingState'])) => void;
    setIsOverlayVisible: (visible: boolean) => void;

    // Computed
    isModalOpen: () => boolean;
}

const initialUIState: UIState = {
    showAppSettingsModal: false,
    appSettingsInitialTab: 'general' as AppSettingsTab,
    appSettingsApiSubTab: null,
    showQuotaModal: false,
    showExitConfirmModal: false,
    isSaveModalOpen: false,
    showGenerationLoginPrompt: false,
    pendingCloseTabId: null,
    showAiSortConfirmModal: false,
    pendingAiSortMaxGroups: null,
    pendingAiSortTabId: null,
    pendingAiSortUngroupedCount: 0,
    isEditorOpen: false,
    editorMode: null,
    notification: null,
    snapIndicator: null,
    loadingState: {
        isLoading: false,
        message: '',
        progress: 0,
        isReversed: false,
        variant: 'default',
    },
    isOverlayVisible: false,
};

export const useUIStore = create<UIState & UIActions>((set, get) => ({
    ...initialUIState,

    // Modal actions
    setShowAppSettingsModal: (showAppSettingsModal) => set({ showAppSettingsModal }),
    openAppSettings: (tab) => set({ showAppSettingsModal: true, appSettingsInitialTab: tab || 'general', appSettingsApiSubTab: null }),
    openAppSettingsApiTab: (subTab) => set({ showAppSettingsModal: true, appSettingsInitialTab: 'api', appSettingsApiSubTab: subTab }),
    setShowQuotaModal: (showQuotaModal) => set({ showQuotaModal }),
    setShowExitConfirmModal: (showExitConfirmModal) => set({ showExitConfirmModal }),
    setIsSaveModalOpen: (isSaveModalOpen) => set({ isSaveModalOpen }),
    setShowGenerationLoginPrompt: (showGenerationLoginPrompt) => set({ showGenerationLoginPrompt }),
    setPendingCloseTabId: (pendingCloseTabId) => set({ pendingCloseTabId }),

    // AI Sort confirm modal actions
    setShowAiSortConfirmModal: (showAiSortConfirmModal) => set({ showAiSortConfirmModal }),
    setPendingAiSortMaxGroups: (pendingAiSortMaxGroups) => set({ pendingAiSortMaxGroups }),
    setPendingAiSortTabId: (pendingAiSortTabId) => set({ pendingAiSortTabId }),
    setPendingAiSortUngroupedCount: (pendingAiSortUngroupedCount) => set({ pendingAiSortUngroupedCount }),

    // Editor actions
    setIsEditorOpen: (isEditorOpen) => set({ isEditorOpen }),
    setEditorMode: (editorMode) => set({ editorMode }),

    // Notification actions
    showNotification: (message, type) => set({
        notification: { id: Date.now(), message, type }
    }),
    clearNotification: () => set({ notification: null }),

    // Snap indicator actions
    setSnapIndicator: (snapIndicator) => set({ snapIndicator }),

    // Loading overlay actions
    setLoadingState: (stateOrUpdater) => set((prev) => {
        const newState = typeof stateOrUpdater === 'function'
            ? stateOrUpdater(prev.loadingState)
            : { ...prev.loadingState, ...stateOrUpdater };
        return { loadingState: newState };
    }),
    setIsOverlayVisible: (isOverlayVisible) => set({ isOverlayVisible }),

    // Computed
    isModalOpen: () => {
        const state = get();
        return !!(
            state.showAppSettingsModal ||
            state.showQuotaModal ||
            state.showExitConfirmModal ||
            state.isSaveModalOpen ||
            state.isOverlayVisible ||
            state.showAiSortConfirmModal
        );
    },
}));
