import { create } from 'zustand';
import { canvasStoreRegistry, canvasTabRouter } from './canvasStore';
import { tabAbortRegistry } from './tabAbortRegistry';

export interface WorkspaceLoadingState {
    isLoading: boolean;
    message: string;
    progress: number;
    isReversed: boolean;
    variant: 'default' | 'glass';
}

export interface WorkspaceTab {
    id: string;
    title: string;
    filePath: string | null;
    isDirty: boolean;
    createdAt: number;
    lastActivatedAt: number;
    autoSavePath: string | null;
    loadingState: WorkspaceLoadingState | null;
}

interface WorkspaceTabsState {
    tabs: WorkspaceTab[];
    activeTabId: string | null;
}

interface WorkspaceTabsActions {
    createTab: (opts?: { title?: string; filePath?: string | null }) => string;
    closeTab: (tabId: string) => void;
    closeOtherTabs: (tabId: string) => void;
    closeTabsToTheRight: (tabId: string) => void;
    closeAllTabs: () => void;
    activateTab: (tabId: string) => void;
    reorderTabs: (fromIndex: number, toIndex: number) => void;
    updateTabMeta: (tabId: string, patch: Partial<Pick<WorkspaceTab, 'title' | 'filePath' | 'isDirty' | 'autoSavePath'>>) => void;
    nextTab: () => void;
    prevTab: () => void;
    getActiveTab: () => WorkspaceTab | undefined;

    setTabLoadingState: (
        tabId: string,
        state: Partial<WorkspaceLoadingState> | ((prev: WorkspaceLoadingState | null) => WorkspaceLoadingState | null)
    ) => void;
    clearTabLoadingState: (tabId: string) => void;
    getTabLoadingState: (tabId: string) => WorkspaceLoadingState | null;
}

let _tabCounter = 1;

function generateTabId(): string {
    return `tab-${Date.now()}-${_tabCounter++}`;
}

function makeUntitledTitle(): string {
    return `Untitled`;
}

const DEFAULT_LOADING_STATE: WorkspaceLoadingState = {
    isLoading: false,
    message: '',
    progress: 0,
    isReversed: false,
    variant: 'default',
};

function disposeTab(tabId: string): void {
    tabAbortRegistry.dispose(tabId);
    canvasStoreRegistry.disposeInstance(tabId);
}

export const useWorkspaceTabsStore = create<WorkspaceTabsState & WorkspaceTabsActions>()(
    (set, get) => ({
        tabs: [],
        activeTabId: null,

        createTab: (opts = {}) => {
                const id = generateTabId();
                canvasStoreRegistry.createInstance(id);
                const tab: WorkspaceTab = {
                    id,
                    title: opts.title ?? makeUntitledTitle(),
                    filePath: opts.filePath ?? null,
                    isDirty: false,
                    createdAt: Date.now(),
                    lastActivatedAt: Date.now(),
                    autoSavePath: null,
                    loadingState: null,
                };
                set(state => ({ tabs: [...state.tabs, tab], activeTabId: id }));
                canvasTabRouter.setActiveTabId(id);
                return id;
            },

            closeTab: (tabId: string) => {
                const { tabs, activeTabId, createTab } = get();
                const idx = tabs.findIndex(t => t.id === tabId);
                if (idx === -1) return;

                const remaining = tabs.filter(t => t.id !== tabId);

                let nextActiveId: string | null = activeTabId;
                if (activeTabId === tabId) {
                    const neighbor = remaining[idx] ?? remaining[idx - 1];
                    nextActiveId = neighbor?.id ?? null;
                }

                disposeTab(tabId);

                if (remaining.length === 0) {
                    // Always keep at least one tab — createTab handles set + setActiveTabId internally
                    set({ tabs: [], activeTabId: null });
                    createTab();
                    return;
                }

                set({ tabs: remaining, activeTabId: nextActiveId });
                if (nextActiveId) canvasTabRouter.setActiveTabId(nextActiveId);
            },

            closeOtherTabs: (tabId: string) => {
                const { tabs } = get();
                tabs.filter(t => t.id !== tabId).forEach(t => disposeTab(t.id));
                const kept = tabs.filter(t => t.id === tabId);
                set({ tabs: kept, activeTabId: tabId });
                canvasTabRouter.setActiveTabId(tabId);
            },

            closeTabsToTheRight: (tabId: string) => {
                const { tabs, activeTabId } = get();
                const idx = tabs.findIndex(t => t.id === tabId);
                if (idx === -1) return;
                const toClose = tabs.slice(idx + 1);
                toClose.forEach(t => disposeTab(t.id));
                const kept = tabs.slice(0, idx + 1);
                const newActiveId = toClose.some(t => t.id === activeTabId) ? tabId : activeTabId;
                set({ tabs: kept, activeTabId: newActiveId });
                if (newActiveId) canvasTabRouter.setActiveTabId(newActiveId);
            },

            closeAllTabs: () => {
                const { tabs, createTab } = get();
                tabs.forEach(t => disposeTab(t.id));
                set({ tabs: [], activeTabId: null });
                createTab();
            },

            activateTab: (tabId: string) => {
                set(state => ({
                    tabs: state.tabs.map(t =>
                        t.id === tabId ? { ...t, lastActivatedAt: Date.now() } : t
                    ),
                    activeTabId: tabId,
                }));
                canvasTabRouter.setActiveTabId(tabId);
            },

            reorderTabs: (fromIndex: number, toIndex: number) => {
                set(state => {
                    const tabs = [...state.tabs];
                    const [moved] = tabs.splice(fromIndex, 1);
                    tabs.splice(toIndex, 0, moved);
                    return { tabs };
                });
            },

            updateTabMeta: (tabId, patch) => {
                set(state => ({
                    tabs: state.tabs.map(t => t.id === tabId ? { ...t, ...patch } : t),
                }));
            },

            nextTab: () => {
                const { tabs, activeTabId, activateTab } = get();
                if (tabs.length < 2) return;
                const idx = tabs.findIndex(t => t.id === activeTabId);
                const next = tabs[(idx + 1) % tabs.length];
                activateTab(next.id);
            },

            prevTab: () => {
                const { tabs, activeTabId, activateTab } = get();
                if (tabs.length < 2) return;
                const idx = tabs.findIndex(t => t.id === activeTabId);
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                activateTab(prev.id);
            },

            getActiveTab: () => {
                const { tabs, activeTabId } = get();
                return tabs.find(t => t.id === activeTabId);
            },

            setTabLoadingState: (tabId, stateOrUpdater) => {
                set(state => ({
                    tabs: state.tabs.map(t => {
                        if (t.id !== tabId) return t;
                        const prev = t.loadingState;
                        let next: WorkspaceLoadingState | null;
                        if (typeof stateOrUpdater === 'function') {
                            next = stateOrUpdater(prev);
                        } else {
                            const base = prev ?? DEFAULT_LOADING_STATE;
                            next = { ...base, ...stateOrUpdater };
                        }
                        return { ...t, loadingState: next };
                    }),
                }));
            },

            clearTabLoadingState: (tabId) => {
                set(state => ({
                    tabs: state.tabs.map(t => t.id === tabId ? { ...t, loadingState: null } : t),
                }));
            },

            getTabLoadingState: (tabId) => {
                const tab = get().tabs.find(t => t.id === tabId);
                return tab?.loadingState ?? null;
            },
        })
);

/**
 * Syncs the active tab's title and filePath with the given workspace file path.
 * Call after load, save-as, and new-workspace events.
 */
export function syncActiveTabTitle(filePath: string | null): void {
    const { activeTabId, updateTabMeta } = useWorkspaceTabsStore.getState();
    if (!activeTabId) return;
    const title = filePath
        ? (filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Untitled')
        : 'Untitled';
    updateTabMeta(activeTabId, { title, filePath });
}

export function useIsAnyTabLoading(): boolean {
    return useWorkspaceTabsStore(s => s.tabs.some(t => t.loadingState?.isLoading === true));
}
