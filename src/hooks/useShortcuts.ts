
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ShortcutAction } from '../types';

export type Shortcut = {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean; // For Command key on Mac
    shiftKey: boolean;
    altKey: boolean;
};

export const shortcutLabels: Record<ShortcutAction, string> = {
    alignSelection: '선택 항목 정렬',
    toggleGroup: '그룹화/그룹 해제',
    saveWorkspace: '워크스페이스 저장',
    saveWorkspaceAs: '다른 이름으로 저장',
    loadWorkspace: '워크스페이스 불러오기',
    deleteSelection: '선택 항목 삭제',
    undoDrawing: '실행 취소',
    redoDrawing: '다시 실행',
    editGroup: '그룹 편집 모드 시작/종료',
    openEditor: '이미지 에디터 열기',
    generateImage: '이미지 생성',
    panCanvas: '캔버스 이동 (패닝)',
    translateMemo: '메모 번역 (스페이스바 3회)',
    cancel: '취소/닫기',
    mergeGroups: '그룹 병합',
    newTab: '새 탭',
    closeTab: '현재 탭 닫기',
    nextTab: '다음 탭',
    prevTab: '이전 탭',
    toggleAppSettings: '앱 설정 토글',
    toggleOriginalImagePanel: '원본이미지 패널 토글',
    toggleLeftPanel: '생성기록 패널 토글',
};

export const shortcutCategories: Record<string, ShortcutAction[]> = {
    workspace: ['newTab', 'closeTab', 'nextTab', 'prevTab'],
    panels: ['toggleAppSettings', 'toggleOriginalImagePanel', 'toggleLeftPanel'],
    general: ['saveWorkspace', 'saveWorkspaceAs', 'loadWorkspace', 'openEditor'],
    editing: ['deleteSelection', 'toggleGroup', 'alignSelection', 'editGroup', 'mergeGroups'],
    generation: ['generateImage'],
    tools: ['undoDrawing', 'redoDrawing', 'panCanvas', 'translateMemo', 'cancel'],
};

const defaultShortcuts: Record<ShortcutAction, Shortcut> = {
    alignSelection: { key: 'p', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    toggleGroup: { key: 'g', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    saveWorkspace: { key: 's', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    saveWorkspaceAs: { key: 's', ctrlKey: true, metaKey: true, shiftKey: true, altKey: false },
    loadWorkspace: { key: 'o', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    deleteSelection: { key: 'Delete', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    undoDrawing: { key: 'z', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    redoDrawing: { key: 'z', ctrlKey: true, metaKey: true, shiftKey: true, altKey: false },
    editGroup: { key: 'e', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    openEditor: { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    generateImage: { key: 'Enter', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    panCanvas: { key: ' ', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    translateMemo: { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, // Special gesture: Space x3
    cancel: { key: 'Escape', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    mergeGroups: { key: 'g', ctrlKey: true, metaKey: true, shiftKey: true, altKey: false },
    newTab: { key: 't', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    closeTab: { key: 'w', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    nextTab: { key: 'Tab', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
    prevTab: { key: 'Tab', ctrlKey: true, metaKey: true, shiftKey: true, altKey: false },
    toggleAppSettings: { key: 'F1', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    toggleOriginalImagePanel: { key: 'F2', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    toggleLeftPanel: { key: 'F3', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
};

// A second key for deleteSelection (Backspace)
export const defaultShortcutsAlternate: Partial<Record<ShortcutAction, Shortcut>> = {
    deleteSelection: { key: 'Backspace', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
}

interface ShortcutState {
    shortcuts: Record<ShortcutAction, Shortcut>;
    setShortcut: (action: ShortcutAction, shortcut: Shortcut) => void;
    resetShortcuts: () => void;
}

export const useShortcutStore = create<ShortcutState>()(
    persist(
        (set) => ({
            shortcuts: defaultShortcuts,
            setShortcut: (action, shortcut) => set(state => ({
                shortcuts: { ...state.shortcuts, [action]: shortcut }
            })),
            resetShortcuts: () => set({ shortcuts: defaultShortcuts }),
        }),
        {
            name: 'bananyang-shortcuts',
            version: 3,
            migrate: (persistedState: any, version: number) => {
                if (version < 2) {
                    // openEditor was Ctrl+T — reassign to empty (newTab takes over Ctrl+T)
                    if (persistedState?.shortcuts?.openEditor?.key === 't') {
                        persistedState.shortcuts.openEditor = defaultShortcuts.openEditor;
                    }
                    // Inject new tab shortcut defaults
                    persistedState.shortcuts = {
                        ...defaultShortcuts,
                        ...(persistedState.shortcuts || {}),
                        newTab: defaultShortcuts.newTab,
                        closeTab: defaultShortcuts.closeTab,
                        nextTab: defaultShortcuts.nextTab,
                        prevTab: defaultShortcuts.prevTab,
                    };
                }
                if (version < 3) {
                    // Inject panel toggle shortcut defaults (F1/F2/F3)
                    persistedState.shortcuts = {
                        ...defaultShortcuts,
                        ...(persistedState.shortcuts || {}),
                        toggleAppSettings: defaultShortcuts.toggleAppSettings,
                        toggleOriginalImagePanel: defaultShortcuts.toggleOriginalImagePanel,
                        toggleLeftPanel: defaultShortcuts.toggleLeftPanel,
                    };
                }
                return persistedState;
            },
            merge: (persistedState: any, currentState) => {
                return {
                    ...currentState,
                    ...persistedState,
                    shortcuts: {
                        ...currentState.shortcuts,
                        ...(persistedState.shortcuts || {}),
                    },
                };
            },
        }
    )
);

export type { ShortcutAction };

export function isShortcut(e: KeyboardEvent, action: ShortcutAction): boolean {
    const state = useShortcutStore.getState();
    const shortcut = state.shortcuts[action];
    if (!shortcut) return false;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const platformCtrl = isMac ? e.metaKey : e.ctrlKey;
    const otherCtrl = isMac ? e.ctrlKey : e.metaKey;

    const checkMatch = (s: Shortcut) => {
        const requiredPlatformCtrl = s.ctrlKey || s.metaKey;

        if (requiredPlatformCtrl) {
            return platformCtrl &&
                e.key.toLowerCase() === s.key.toLowerCase() &&
                e.shiftKey === s.shiftKey &&
                e.altKey === s.altKey &&
                !otherCtrl; // Ensure the other modifier isn't pressed unless intended
        } else { // Handle shortcuts without Ctrl/Cmd (like 'Delete')
            return e.key.toLowerCase() === s.key.toLowerCase() &&
                e.shiftKey === s.shiftKey &&
                e.altKey === s.altKey &&
                !e.ctrlKey && !e.metaKey;
        }
    };

    let match = checkMatch(shortcut);

    if (!match) {
        const alternate = defaultShortcutsAlternate[action];
        if (alternate) {
            match = checkMatch(alternate);
        }
    }

    return match;
}

export function formatShortcut(shortcut: Shortcut): string {
    const parts: string[] = [];
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (shortcut.ctrlKey || shortcut.metaKey) parts.push(isMac ? 'Cmd' : 'Ctrl');
    if (shortcut.altKey) parts.push(isMac ? 'Option' : 'Alt');
    if (shortcut.shiftKey) parts.push('Shift');

    let key = shortcut.key;
    if (key.length === 1) key = key.toUpperCase();
    else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');

    parts.push(key);

    return parts.join(' + ');
}
