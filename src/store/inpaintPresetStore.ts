import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILT_IN_PRESETS, InpaintPreset } from '../features/canvas/components/editor/tabs/inpaintPresets';

const STORAGE_KEY = 'bananyang-inpaint-presets';

interface InpaintPresetState {
    customPresets: InpaintPreset[];
    activePresetId: string | null;
    presetAugmentPrompt: string | null;
}

interface InpaintPresetActions {
    addPreset: (p: Omit<InpaintPreset, 'id' | 'isBuiltIn'>) => void;
    updatePreset: (id: string, updates: Partial<InpaintPreset>) => void;
    deletePreset: (id: string) => void;
    setActivePresetId: (id: string | null) => void;
    setPresetAugmentPrompt: (prompt: string | null) => void;
    resetCustomPresets: () => void;
}

export const useInpaintPresetStore = create<InpaintPresetState & InpaintPresetActions>()(
    persist(
        (set) => ({
            customPresets: [],
            activePresetId: null,
            presetAugmentPrompt: null,
            addPreset: (p) => set((state) => ({
                customPresets: [
                    ...state.customPresets,
                    { ...p, id: crypto.randomUUID(), isBuiltIn: false },
                ],
            })),
            updatePreset: (id, updates) => set((state) => ({
                customPresets: state.customPresets.map((p) =>
                    p.id === id ? { ...p, ...updates } : p
                ),
            })),
            deletePreset: (id) => set((state) => ({
                customPresets: state.customPresets.filter((p) => p.id !== id),
            })),
            setActivePresetId: (id) => id === null
                ? set({ activePresetId: null, presetAugmentPrompt: null })
                : set({ activePresetId: id }),
            setPresetAugmentPrompt: (prompt) => set({ presetAugmentPrompt: prompt }),
            resetCustomPresets: () => set({ customPresets: [], activePresetId: null, presetAugmentPrompt: null }),
        }),
        {
            name: STORAGE_KEY,
            partialize: (state) => ({ customPresets: state.customPresets }),
        }
    )
);

export const getAllInpaintPresets = (): InpaintPreset[] => [
    ...BUILT_IN_PRESETS,
    ...useInpaintPresetStore.getState().customPresets,
];
