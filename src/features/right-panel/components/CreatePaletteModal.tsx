
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Z_INDEX } from '../../../constants/zIndex';
import { t, Language, TranslationKey } from '../../../localization';
import { COLOR_PALETTES } from '../../../constants';
import { PaletteCategory } from '../../../types';
import { AdvancedColorPicker } from '../../../components/AdvancedColorPicker';

interface CreatePaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, categoryKey: string, colors: string[]) => void;
  language: Language;
}

export const CreatePaletteModal: React.FC<CreatePaletteModalProps> = ({ isOpen, onClose, onSave, language }) => {
  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<typeof COLOR_PALETTES[number]['category']>('mood');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [colors, setColors] = useState<string[]>(['#FFFFFF', '#CCCCCC', '#888888', '#444444', '#000000']);
  const [activeColorIndex, setActiveColorIndex] = useState<number | null>(0);

  const categories = COLOR_PALETTES.map(c => c.category);
  const subCategories = useMemo(() => {
    const cat = COLOR_PALETTES.find(c => c.category === selectedCategory);
    return cat ? cat.subCategories : [];
  }, [selectedCategory]);

  // Set default subcategory when category changes
  useEffect(() => {
    if (subCategories.length > 0) {
      setSelectedSubCategory(subCategories[0].name);
    }
  }, [subCategories]);

  if (!isOpen) return null;

  const handleColorChange = (index: number, newColor: string) => {
    const newColors = [...colors];
    newColors[index] = newColor;
    setColors(newColors);
  };

  const handleSave = () => {
    if (name.trim() && selectedSubCategory) {
      // Key format: categoryName:subCategoryName
      const key = `${selectedCategory}:${selectedSubCategory}`;
      onSave(name.trim(), key, colors);
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-start justify-center pt-12 overflow-y-auto dark-glass-scrollbar" style={{ zIndex: Z_INDEX.IMAGE_VIEWER }} onClick={onClose}>
      <div className="glass-panel rounded-2xl p-6 max-w-md w-[90%] shadow-2xl animate-category-fade-in relative overflow-visible my-8" onClick={(e) => { e.stopPropagation(); setActiveColorIndex(null); }}>

        <h3 className="font-bold text-lg text-zinc-100 mb-4">{t('colorPalette.modalTitle', language)}</h3>

        <div className="space-y-4">
          {/* Name Input */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('colorPalette.namePlaceholder', language)}
              className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none"
              autoFocus
            />
          </div>

          {/* Category Select */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('colorPalette.categoryLabel', language)}</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-2 text-sm text-zinc-200 outline-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{t(`colorPalette.category.${cat}` as TranslationKey, language)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t('colorPalette.subCategoryLabel', language)}</label>
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-2 text-sm text-zinc-200 outline-none"
              >
                {subCategories.map(sub => (
                  <option key={sub.name} value={sub.name}>{t(sub.translationKey as TranslationKey, language)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Pickers */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">{t('colorPalette.colorsLabel', language)}</label>
            <div className="flex justify-between gap-2 mb-4">
              {colors.map((color, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveColorIndex(index);
                  }}
                  className={`w-10 h-10 rounded-full border shadow-md transition-transform hover:scale-110 focus:outline-none ${activeColorIndex === index ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900 border-transparent' : 'border-white/20'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Color Picker - Always visible */}
            <div
              className="flex justify-center"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <AdvancedColorPicker
                color={colors[activeColorIndex ?? 0]}
                onChange={(newColor) => handleColorChange(activeColorIndex ?? 0, newColor)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
          >
            {t('editModal.cancel', language)}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('appSettingsModal.save', language)}
          </button>
        </div>
      </div>
    </div>
  );
};
