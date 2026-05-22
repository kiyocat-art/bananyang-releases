import React, { useState } from 'react';
import { Language, t, TranslationKey } from '../../../localization';
import { ColorPalette, PaletteCategory } from '../../../types';
import { COLOR_PALETTES } from '../../../constants';
import { useGenerationStore } from '../../../store/generationStore';
import { Tooltip } from '../../../components/Tooltip';
import { CloseIcon, SparklesIcon } from '../../../components/icons';
import { Section } from '../../../components/Section';

interface ColorPalettePanelProps {
    language: Language;
}

const PaletteDisplay: React.FC<{ colors: string[] }> = ({ colors }) => (
    <div className="flex h-5 w-full rounded-md overflow-hidden">
        {colors.map((color, i) => (
            <div key={i} style={{ backgroundColor: color, flex: 1 }} />
        ))}
    </div>
);

export const ColorPalettePanel: React.FC<ColorPalettePanelProps> = ({ language }) => {
    const {
        selectedPalette,
        setSelectedPalette,
        numPaletteColors,
        setNumPaletteColors,
    } = useGenerationStore();

    const [activeCategory, setActiveCategory] = useState<typeof COLOR_PALETTES[number]['category']>('mood');

    const handleRandomClick = () => {
        const allPalettes = COLOR_PALETTES.flatMap(cat => cat.subCategories.flatMap(sub => sub.palettes));
        const randomPalette = allPalettes[Math.floor(Math.random() * allPalettes.length)];
        setSelectedPalette(randomPalette);
    };

    const activeCategoryData = COLOR_PALETTES.find(cat => cat.category === activeCategory);

    const clearButton = (
        <button
            onClick={() => setSelectedPalette(null)}
            disabled={!selectedPalette}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {t('clearSelection', language)}
        </button>
    );

    return (
        <div className="space-y-4 animate-category-fade-in">
            <Section title={t('colorPalette.title', language)} topRightAction={clearButton}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <label className="text-sm text-zinc-300 whitespace-nowrap">{t('colorPalette.numColors', language)}</label>
                        <div className="flex gap-1">
                            {[3, 4, 5].map(num => (
                                <button
                                    key={num}
                                    onClick={() => setNumPaletteColors(num)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${numPaletteColors === num ? 'bg-white text-black' : 'bg-white/10 text-zinc-300 hover:bg-white/20'}`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>

            <div className="bg-black/20 rounded-lg p-1 flex items-center gap-1">
                {COLOR_PALETTES.map(category => (
                    <button
                        key={category.category}
                        onClick={() => setActiveCategory(category.category)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${activeCategory === category.category ? 'bg-white text-zinc-800' : 'bg-transparent text-zinc-300 hover:bg-neutral-700/50'}`}
                    >
                        {t(`colorPalette.category.${category.category}` as TranslationKey, language)}
                    </button>
                ))}
            </div>

            {activeCategoryData && (
                <div className="animate-category-fade-in">
                    {activeCategoryData.subCategories.map(sub => (
                        <div key={sub.name} className="mb-3">
                            <h4 className="text-xs font-semibold text-zinc-300 mb-2">{t(sub.translationKey as TranslationKey, language)}</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {sub.palettes.map(palette => (
                                    <button
                                        key={palette.name}
                                        onClick={() => setSelectedPalette(palette)}
                                        className={`w-full p-2 rounded-lg border-2 transition-all ${selectedPalette?.name === palette.name ? 'border-white bg-white/20' : 'border-transparent hover:bg-white/10'}`}
                                    >
                                        <PaletteDisplay colors={palette.colors.slice(0, numPaletteColors)} />
                                        {/* FIX: Use a conditional check for translationKey to prevent errors and provide a fallback to palette.name. */}
                                        <span className="text-xs text-zinc-300 mt-1.5 block text-left truncate">{palette.translationKey ? t(palette.translationKey as TranslationKey, language) : palette.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="pt-2 border-t border-white/10 flex gap-2">
                <button
                    onClick={handleRandomClick}
                    className="w-full py-2.5 text-sm font-semibold rounded-md bg-white/10 hover:bg-white/20 text-zinc-100 transition-colors"
                >
                    {t('colorPalette.random', language)}
                </button>
            </div>
        </div>
    );
};