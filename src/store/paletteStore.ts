
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ColorPalette } from '../types';

const PALETTE_STORAGE_KEY = 'bananyang-custom-palettes';

interface PaletteStore {
    // Key format: "categoryName:subCategoryName" e.g., "mood:Warm"
    customPalettes: Record<string, ColorPalette[]>;
    addPalette: (categoryKey: string, palette: ColorPalette) => void;
    removePalette: (categoryKey: string, paletteId: string) => void;
}

export const usePaletteStore = create<PaletteStore>()(
    persist(
        (set) => ({
            customPalettes: {},
            addPalette: (categoryKey, palette) => set((state) => {
                const existing = state.customPalettes[categoryKey] || [];
                return {
                    customPalettes: {
                        ...state.customPalettes,
                        [categoryKey]: [...existing, palette]
                    }
                };
            }),
            removePalette: (categoryKey, paletteId) => set((state) => {
                const existing = state.customPalettes[categoryKey] || [];
                return {
                    customPalettes: {
                        ...state.customPalettes,
                        [categoryKey]: existing.filter(p => p.id !== paletteId)
                    }
                };
            }),
        }),
        {
            name: PALETTE_STORAGE_KEY,
        }
    )
);
