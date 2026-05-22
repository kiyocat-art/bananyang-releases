import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PromptFolder, PromptItem } from '../types';
import { DEFAULT_PROMPT_FOLDERS } from '../constants';

const PRESET_STORAGE_KEY = 'bananyang-prompt-presets';

interface PresetState {
    folders: PromptFolder[];
}

interface PresetActions {
    setFolders: (folders: PromptFolder[]) => void;
    addFolder: () => void;
    deleteFolder: (folderId: string) => void;
    renameFolder: (folderId: string, name: string) => void;
    toggleQuickBar: (folderId: string) => void;
    addPreset: (folderId: string, preset: PromptItem) => void;
    updatePreset: (folderId: string, preset: PromptItem) => void;
    deletePreset: (folderId: string, presetId: string) => void;
}

export const usePresetStore = create<PresetState & PresetActions>()(
    persist(
        (set) => ({
            folders: DEFAULT_PROMPT_FOLDERS,
            setFolders: (folders) => set({ folders }),
            addFolder: () => set(state => {
                const newFolder: PromptFolder = {
                    id: crypto.randomUUID(),
                    name: `New Folder ${state.folders.length + 1}`,
                    presets: [],
                    showInQuickBar: true,
                };
                return { folders: [...state.folders, newFolder] };
            }),
            deleteFolder: (folderId) => set(state => ({
                folders: state.folders.filter(f => f.id !== folderId)
            })),
            renameFolder: (folderId, name) => set(state => ({
                folders: state.folders.map(f => f.id === folderId ? { ...f, name } : f)
            })),
            toggleQuickBar: (folderId) => set(state => ({
                folders: state.folders.map(f => f.id === folderId ? { ...f, showInQuickBar: !(f.showInQuickBar ?? true) } : f)
            })),
            addPreset: (folderId, preset) => set(state => ({
                folders: state.folders.map(f => f.id === folderId ? { ...f, presets: [...f.presets, preset] } : f)
            })),
            updatePreset: (folderId, preset) => set(state => ({
                folders: state.folders.map(f => f.id === folderId ? { ...f, presets: f.presets.map(p => p.id === preset.id ? preset : p) } : f)
            })),
            deletePreset: (folderId, presetId) => set(state => ({
                folders: state.folders.map(f => f.id === folderId ? { ...f, presets: f.presets.filter(p => p.id !== presetId) } : f)
            })),
        }),
        {
            name: PRESET_STORAGE_KEY,
        }
    )
);