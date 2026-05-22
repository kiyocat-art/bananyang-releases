
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Language, t, TranslationKey } from '../../../localization';
import { ColorPalette, PaletteCategory } from '../../../types';
import { COLOR_PALETTES } from '../../../constants';
import { useGenerationStore } from '../../../store/generationStore';
import { usePaletteStore } from '../../../store/paletteStore';
import { Tooltip } from '../../../components/Tooltip';
import { PlusIcon, TrashIcon, ChevronDownIcon, DiceIcon, MoodIcon, WeatherIcon, ConceptIcon, ResetIcon, PaintBrushIcon } from '../../../components/icons';
import { CreatePaletteModal } from './CreatePaletteModal';
import { Section } from '../../../components/Section';

interface ColorPalettePanelProps {
  language: Language;
}


// ── Color count visualizer ────────────────────────────────────────────────────

const ColorCountButton: React.FC<{
  num: number;
  active: boolean;
  onClick: () => void;
  language: Language;
}> = ({ num, active, onClick, language }) => (
  <Tooltip tip={t('tooltip.paletteNumColors', language)} position="top">
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all ${
        active
          ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]'
          : 'bg-white/10 text-zinc-300 hover:bg-white/20'
      }`}
    >
      <span className="flex gap-0.5 items-center">
        {Array.from({ length: num }).map((_, i) => (
          <span
            key={i}
            className={`block w-2 h-3 rounded-[2px] ${active ? 'bg-zinc-700' : 'bg-white/50'}`}
          />
        ))}
      </span>
      <span className="text-xs ">{num}</span>
    </button>
  </Tooltip>
);

// ── Category Icon map ─────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  mood: MoodIcon,
  weather: WeatherIcon,
  concept: ConceptIcon,
};

// ── Subcategory Accordion ─────────────────────────────────────────────────────

interface SubCategoryAccordionProps {
  subName: string;
  label: string;
  palettes: Array<ColorPalette | typeof COLOR_PALETTES[number]['subCategories'][number]['palettes'][number]>;
  open: boolean;
  onToggle: () => void;
  numColors: number;
  selectedPalette: ColorPalette | null;
  onSelect: (palette: ColorPalette | typeof COLOR_PALETTES[number]['subCategories'][number]['palettes'][number]) => void;
  onDelete?: (paletteId: string) => void;
  activeCategory: string;
  language: Language;
  gridCols: number;
}

const SubCategoryAccordion: React.FC<SubCategoryAccordionProps> = ({
  subName,
  label,
  palettes,
  open,
  onToggle,
  numColors,
  selectedPalette,
  onSelect,
  onDelete,
  activeCategory,
  language,
  gridCols,
}) => {

  const colorBarHeight = gridCols === 5 ? 'h-7' : gridCols === 4 ? 'h-8' : gridCols === 3 ? 'h-10' : 'h-12';
  const gridClass = gridCols === 5 ? 'grid-cols-5' : gridCols === 4 ? 'grid-cols-4' : gridCols === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="mb-1">
      <>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between py-2.5 group transition-colors"
          aria-expanded={open}
        >
          <span className="text-sm text-zinc-200 group-hover:text-white transition-colors">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">{palettes.length}</span>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
        <div className="h-px bg-white/10 mb-2" />
      </>

      {open && (
        <div className={`grid ${gridClass} gap-2 mt-2 animate-category-fade-in`}>
          {palettes.map((palette) => {
            const pid = 'id' in palette && palette.id ? palette.id : palette.name;
            const pname = palette.translationKey
              ? t(palette.translationKey as TranslationKey, language)
              : palette.name;
            const isSelected = selectedPalette?.name === palette.name;
            const isCustom = 'isCustom' in palette && palette.isCustom && 'id' in palette && palette.id;

            return (
              <div key={pid} className="relative group">
                <Tooltip tip={pname} position="top" className="w-full block">
                  <button
                    onClick={() => onSelect(palette)}
                    className={`w-full p-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-white bg-white/15 shadow-[0_0_12px_rgba(255,255,255,0.25)]'
                        : 'border-transparent hover:bg-white/10'
                    }`}
                  >
                    {/* Color bar */}
                    <div
                      className={`flex w-full rounded-md overflow-hidden ring-1 ring-white/10 bg-black/20 ${colorBarHeight}`}
                      style={{ gap: '0.5px' }}
                    >
                      {palette.colors.slice(0, numColors).map((color, ci) => (
                        <div
                          key={ci}
                          style={{ backgroundColor: color, flex: '1 1 0%' }}
                          className="h-full first:rounded-l-md last:rounded-r-md"
                        />
                      ))}
                    </div>
                    {/* Name */}
                    <span className="text-xs text-zinc-300 mt-1.5 block text-left truncate leading-snug">
                      {pname}
                    </span>
                  </button>
                </Tooltip>

                {/* Delete button for custom palettes */}
                {isCustom && onDelete && (
                  <Tooltip tip={t('tooltip.deletePalette', language)} position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete((palette as ColorPalette).id!);
                        if (isSelected) {
                          // parent will clear
                        }
                      }}
                      className={`absolute -top-1 -right-1 p-1 bg-red-500/80 text-white rounded-full transition-opacity hover:bg-red-600 shadow-sm ${
                        isSelected ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'
                      }`}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────

export const ColorPalettePanel: React.FC<ColorPalettePanelProps> = ({ language }) => {
  const {
    selectedPalette,
    setSelectedPalette,
    numPaletteColors,
    setNumPaletteColors,
  } = useGenerationStore();

  const { customPalettes, addPalette, removePalette } = usePaletteStore();

  const [activeCategory, setActiveCategory] = useState<typeof COLOR_PALETTES[number]['category']>('mood');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [openSubs, setOpenSubs] = useState<Set<string>>(() => {
    const first = COLOR_PALETTES.find(c => c.category === 'mood')?.subCategories[0]?.name;
    return first ? new Set([first]) : new Set();
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gridCols = containerWidth < 430 ? 2 : containerWidth < 630 ? 3 : containerWidth < 830 ? 4 : 5;

  const handleRandomClick = () => {
    const defaultPalettes = COLOR_PALETTES.flatMap(cat => cat.subCategories.flatMap(sub => sub.palettes));
    const allCustomPalettes = Object.values(customPalettes).flat();
    const allPalettes = [...defaultPalettes, ...allCustomPalettes];
    if (allPalettes.length > 0) {
      setSelectedPalette(allPalettes[Math.floor(Math.random() * allPalettes.length)]);
    }
  };

  const activeCategoryData = COLOR_PALETTES.find(cat => cat.category === activeCategory);

  const subCategoriesWithCustom = useMemo(() => {
    if (!activeCategoryData) return [];
    return activeCategoryData.subCategories.map(sub => {
      const key = `${activeCategory}:${sub.name}`;
      const userPalettes = customPalettes[key] || [];
      return { ...sub, palettes: [...userPalettes, ...sub.palettes] };
    });
  }, [activeCategoryData, customPalettes, activeCategory]);

  // Reset openSubs when category changes (first sub open by default)
  useEffect(() => {
    const first = activeCategoryData?.subCategories[0]?.name;
    setOpenSubs(first ? new Set([first]) : new Set());
  }, [activeCategory]);

  // Keep the sub with selected palette open
  useEffect(() => {
    if (!selectedPalette) return;
    const subWithSelected = subCategoriesWithCustom.find(sub =>
      sub.palettes.some(p => p.name === selectedPalette.name)
    );
    if (subWithSelected) {
      setOpenSubs(prev => new Set([...prev, subWithSelected.name]));
    }
  }, [selectedPalette]);

  const toggleSub = (name: string) => {
    setOpenSubs(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const allSubNames = subCategoriesWithCustom.map(s => s.name);
  const allExpanded = allSubNames.length > 0 && allSubNames.every(n => openSubs.has(n));

  const handleToggleAll = () => {
    if (allExpanded) {
      setOpenSubs(new Set());
    } else {
      setOpenSubs(new Set(allSubNames));
    }
  };

  const headerActions = (
    <div className="flex items-center gap-1">
      <button
        onClick={handleToggleAll}
        className="px-2 py-1 text-xs rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        {allExpanded
          ? t('colorPalette.collapseAll', language)
          : t('colorPalette.expandAll', language)
        }
      </button>
      <Tooltip tip={t('clearSelection', language)} position="top">
        <button
          onClick={() => setSelectedPalette(null)}
          disabled={!selectedPalette}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ResetIcon className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );

  const handleSavePalette = (name: string, categoryKey: string, colors: string[]) => {
    const newPalette: ColorPalette = {
      id: crypto.randomUUID(),
      name,
      colors,
      isCustom: true,
    };
    addPalette(categoryKey, newPalette);
  };

  return (
    <Section
      title={t('colorPalette.title', language)}
      icon={<PaintBrushIcon className="w-4 h-4" />}
      topRightAction={headerActions}
    >
    <div className="space-y-4 animate-category-fade-in">
      {/* 팔레트 추가 / 랜덤 / 색상 미리보기 — 1행 3열 */}
      <div className="grid grid-cols-3 gap-2 items-stretch">
        <Tooltip tip={t('colorPalette.create', language)} position="top">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors border border-white/10 hover:border-white/20"
          >
            <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
            {t('colorPalette.addPalette', language)}
          </button>
        </Tooltip>
        <Tooltip tip={t('tooltip.randomPalette', language)} position="top">
          <button
            onClick={handleRandomClick}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/25 text-zinc-200 transition-colors border border-white/10 hover:border-white/15"
          >
            <DiceIcon className="w-3.5 h-3.5 flex-shrink-0" />
            {t('colorPalette.random', language)}
          </button>
        </Tooltip>
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/5 border border-white/10 rounded-md min-w-0">
          {selectedPalette ? (
            <div className="flex items-center gap-1 min-w-0">
              <div className="flex gap-0.5 flex-shrink-0">
                {selectedPalette.colors.slice(0, numPaletteColors).map((color, i) => (
                  <div key={i} className="w-3.5 h-3.5 rounded-sm border border-white/20 flex-shrink-0" style={{ backgroundColor: color }} />
                ))}
              </div>
              <span className="text-xs text-zinc-300 truncate">{selectedPalette.name}</span>
            </div>
          ) : (
            <span className="text-xs text-zinc-600">—</span>
          )}
        </div>
      </div>

      {/* Color count selector */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-zinc-300 whitespace-nowrap">
          {t('colorPalette.numColors', language)}
        </label>
        <div className="flex gap-1">
          {[3, 4, 5].map(num => (
            <ColorCountButton
              key={num}
              num={num}
              active={numPaletteColors === num}
              onClick={() => setNumPaletteColors(num)}
              language={language}
            />
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="bg-black/20 rounded-lg p-1 flex items-center gap-1">
        {COLOR_PALETTES.map(category => {
          const Icon = CATEGORY_ICONS[category.category];
          const isActive = activeCategory === category.category;
          return (
            <Tooltip
              key={category.category}
              tip={t(`tooltip.paletteCategory.${category.category}` as TranslationKey, language)}
              position="top"
              className="flex-1"
            >
              <button
                onClick={() => setActiveCategory(category.category)}
                className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-md transition-colors ${
                  isActive
                    ? 'bg-white text-zinc-800'
                    : 'bg-transparent text-zinc-400 hover:bg-neutral-700/50 hover:text-zinc-200'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span className="text-xs leading-none">
                  {t(`colorPalette.category.${category.category}` as TranslationKey, language)}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Subcategory accordions */}
      {activeCategoryData && (
        <div ref={containerRef} className="animate-category-fade-in space-y-1">
          {subCategoriesWithCustom.map((sub) => {
            return (
              <SubCategoryAccordion
                key={sub.name}
                subName={sub.name}
                label={t(sub.translationKey as TranslationKey, language)}
                palettes={sub.palettes}
                open={openSubs.has(sub.name)}
                onToggle={() => toggleSub(sub.name)}
                numColors={numPaletteColors}
                selectedPalette={selectedPalette}
                onSelect={(palette) => setSelectedPalette(palette)}
                onDelete={(paletteId) => {
                  const key = `${activeCategory}:${sub.name}`;
                  removePalette(key, paletteId);
                  if (selectedPalette?.id === paletteId) {
                    setSelectedPalette(null);
                  }
                }}
                activeCategory={activeCategory}
                language={language}
                gridCols={gridCols}
              />
            );
          })}
        </div>
      )}

      <CreatePaletteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleSavePalette}
        language={language}
      />
    </div>
    </Section>
  );
};
