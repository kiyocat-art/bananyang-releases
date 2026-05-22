import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BodyPart, ClothingItem, ObjectItem } from '../../../../types';
import {
  CLOTHING_THEMES, OBJECT_THEMES, CLOTHING_TO_BODY_PARTS_MAP,
  APPLY_FULL_OUTFIT_BODY_PARTS, APPLY_TOP_BODY_PARTS, APPLY_BOTTOM_BODY_PARTS,
  CLOTHING_ITEM_TO_CATEGORY_MAP
} from '../../../../constants';
import { t, getEnumText, Language, TranslationKey } from '../../../../localization';
import { Tooltip } from '../../../../components/Tooltip';
import { Section } from '../../../../components/Section';
import { BodyIcon, HangerIcon } from '../../../../components/icons';
import { THEME_ICON_MAP } from '../../iconMaps';
import { useCanvasStore } from '../../../../store/canvasStore';
import { useGenerationStore } from '../../../../store/generationStore';
import { BodyPartSelector } from '../BodyPartSelector';
import { DropdownCategory, DropdownContent } from '../DropdownCategory';

type ConceptThemeKey = 'scifi' | 'modern' | 'fantasy';
type ConceptSubTabKey = 'clothing' | 'item';

interface ConceptTabProps {
  language: Language;
  onNotification: (message: string, type: 'success' | 'error') => void;
}

export const ConceptTab: React.FC<ConceptTabProps> = ({ language, onNotification }) => {
  const {
    bodyPartReferenceMap, setBodyPartReferenceMap, selectedClothingConcept, setSelectedClothingConcept,
    selectedObjectItems, setSelectedObjectItems, selectedActionPose, setSelectedActionPose,
    poseControlImage, setPoseControlImage, isApplyingFullOutfit, isApplyingTop, isApplyingBottom,
    setUseAposeForViews,
    // 5단계 의상참조 합성
    costumeCreativityLevel, setCostumeCreativityLevel,
    // Synthesis Control Mode
    synthesisControlMode, setSynthesisControlMode,
    originalPreservationLevel, setOriginalPreservationLevel,
    isCostumeDesignEnabled, setIsCostumeDesignEnabled,
  } = useGenerationStore();

  // Helper for slider descriptions
  const getStepDescription = (mode: 'original' | 'reference', level: number) => {
    const key = `step.${mode}.${level}` as TranslationKey;
    return level >= 1 && level <= 5 ? t(key, language) : "";
  };


  const { activeReferenceIndex, setSelectedImageIds, boardImages } = useCanvasStore();
  const referenceImages = boardImages.filter(img =>
    img.role === 'reference' ||
    img.role === 'generalRef' ||
    img.role === 'costumeRef' ||
    img.role === 'poseRef'
  ).sort((a, b) => (a.refIndex ?? Infinity) - (b.refIndex ?? Infinity));

  const costumeImages = boardImages.filter(img =>
    img.role === 'costumeRef' || img.referenceType === 'costume'
  ).sort((a, b) => (a.refIndex ?? Infinity) - (b.refIndex ?? Infinity));

  const activeCostumeImage = useMemo(() => costumeImages.find(img => img.refIndex === activeReferenceIndex), [costumeImages, activeReferenceIndex]);
  const hasCostumeReference = useMemo(() => costumeImages.length > 0, [costumeImages]);

  const [activeConceptTheme, setActiveConceptTheme] = useState<ConceptThemeKey>('fantasy');
  const [activeConceptSubTab, setActiveConceptSubTab] = useState<ConceptSubTabKey>('clothing');

  // [UI REFACTOR] Floating Dropdown State
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  // [UI REFACTOR] Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setActiveCategoryKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // [UI REFACTOR] Reset active category when switching tabs or themes
  useEffect(() => {
    setActiveCategoryKey(null);
  }, [activeConceptTheme, activeConceptSubTab]);

  const activateConceptMode = useCallback(() => {
    if (selectedActionPose) setSelectedActionPose(null);
    if (poseControlImage) setPoseControlImage(null);
  }, [selectedActionPose, poseControlImage, setSelectedActionPose, setPoseControlImage]);

  const handleBodyPartAssign = (part: BodyPart) => {
    if (!hasCostumeReference) {
      onNotification(t('error.bodyPartSelectionOnlyForCostumeRef', language), 'error');
      return;
    }

    const activeCostumeRefIndex = activeCostumeImage?.refIndex ?? null;
    const fallbackCostumeRefIndex = costumeImages[0]?.refIndex ?? null;
    const costumeRefIndex = activeCostumeRefIndex ?? fallbackCostumeRefIndex;

    if (costumeRefIndex === null) {
      onNotification(t('tooltip.uploadReferenceFirst', language), 'error');
      return;
    }

    if (selectedClothingConcept) setSelectedClothingConcept(null);
    setBodyPartReferenceMap(prevMap => {
      const newMap = { ...prevMap };
      if (newMap[part] === costumeRefIndex) delete newMap[part];
      else newMap[part] = costumeRefIndex;
      return newMap;
    });
  };

  const handleClothingItemToggle = (itemToToggle: ClothingItem) => {
    activateConceptMode(); setSelectedObjectItems([]);
    const isCurrentlySelected = selectedClothingConcept === itemToToggle;
    const newConcept = isCurrentlySelected ? null : itemToToggle;
    setSelectedClothingConcept(newConcept);
    const activeCostumeRefIndex = activeCostumeImage?.refIndex ?? null;
    const fallbackCostumeRefIndex = costumeImages[0]?.refIndex ?? null;
    let refIndexToUse = activeCostumeRefIndex ?? fallbackCostumeRefIndex;
    if (newConcept && refIndexToUse === null) {
      onNotification(t('error.modificationRequiresReference', language), 'error');
      setSelectedClothingConcept(null);
      return;
    }
    if (refIndexToUse === null) return;
    const finalRefIndex = refIndexToUse;
    setBodyPartReferenceMap(prevMap => {
      const newMap = { ...prevMap };
      const categoryOfItemToToggle = CLOTHING_ITEM_TO_CATEGORY_MAP[itemToToggle];
      const conflictingItems: ClothingItem[] = [];
      Object.values(ClothingItem).forEach(item => { const category = CLOTHING_ITEM_TO_CATEGORY_MAP[item]; if (category === categoryOfItemToToggle || category === 'sets' || categoryOfItemToToggle === 'sets') conflictingItems.push(item); });
      conflictingItems.forEach(item => { const partsToClear = CLOTHING_TO_BODY_PARTS_MAP[item] || []; partsToClear.forEach(part => { if (newMap[part] === finalRefIndex) delete newMap[part]; }); });
      if (newConcept) { const partsForItem = CLOTHING_TO_BODY_PARTS_MAP[itemToToggle] || []; partsForItem.forEach(part => { newMap[part] = finalRefIndex!; }); }
      return newMap;
    });
  };

  const handleObjectItemToggle = (itemToToggle: ObjectItem) => {
    activateConceptMode(); setBodyPartReferenceMap({});
    setSelectedObjectItems(prev => {
      if (prev.includes(itemToToggle)) return [];
      setUseAposeForViews(false); return [itemToToggle];
    });
  };

  const handleApplyFullOutfitClick = () => {
    if (!hasCostumeReference) {
      onNotification(t('error.bodyPartSelectionOnlyForCostumeRef', language), 'error');
      return;
    }
    const activeCostumeRefIndex = activeCostumeImage?.refIndex ?? null;
    const fallbackCostumeRefIndex = costumeImages[0]?.refIndex ?? null;
    const costumeRefIndex = activeCostumeRefIndex ?? fallbackCostumeRefIndex;
    if (costumeRefIndex === null) return;
    activateConceptMode();
    const shouldApply = !isApplyingFullOutfit;
    setBodyPartReferenceMap(prevMap => {
      const newMap = { ...prevMap };
      APPLY_FULL_OUTFIT_BODY_PARTS.forEach(part => {
        if (shouldApply) newMap[part] = costumeRefIndex;
        else if (newMap[part] === costumeRefIndex) delete newMap[part];
      });
      return newMap;
    });
    if (shouldApply) { setSelectedClothingConcept(null); setSelectedObjectItems([]); }
  };

  const handleApplyTopClick = () => {
    if (!hasCostumeReference) {
      onNotification(t('error.bodyPartSelectionOnlyForCostumeRef', language), 'error');
      return;
    }
    const activeCostumeRefIndex = activeCostumeImage?.refIndex ?? null;
    const fallbackCostumeRefIndex = costumeImages[0]?.refIndex ?? null;
    const costumeRefIndex = activeCostumeRefIndex ?? fallbackCostumeRefIndex;
    if (costumeRefIndex === null) return;
    activateConceptMode();
    const shouldApply = !isApplyingTop;
    setBodyPartReferenceMap(prevMap => {
      const newMap = { ...prevMap };
      APPLY_TOP_BODY_PARTS.forEach(part => {
        if (shouldApply) newMap[part] = costumeRefIndex;
        else if (newMap[part] === costumeRefIndex) delete newMap[part];
      });
      if (shouldApply && isApplyingFullOutfit) APPLY_BOTTOM_BODY_PARTS.forEach(part => { if (newMap[part] === costumeRefIndex) delete newMap[part]; });
      return newMap;
    });
    if (shouldApply) { setSelectedClothingConcept(null); setSelectedObjectItems([]); }
  };

  const handleApplyBottomClick = () => {
    if (!hasCostumeReference) {
      onNotification(t('error.bodyPartSelectionOnlyForCostumeRef', language), 'error');
      return;
    }
    const activeCostumeRefIndex = activeCostumeImage?.refIndex ?? null;
    const fallbackCostumeRefIndex = costumeImages[0]?.refIndex ?? null;
    const costumeRefIndex = activeCostumeRefIndex ?? fallbackCostumeRefIndex;
    if (costumeRefIndex === null) return;
    activateConceptMode();
    const shouldApply = !isApplyingBottom;
    setBodyPartReferenceMap(prevMap => {
      const newMap = { ...prevMap };
      APPLY_BOTTOM_BODY_PARTS.forEach(part => {
        if (shouldApply) newMap[part] = costumeRefIndex;
        else if (newMap[part] === costumeRefIndex) delete newMap[part];
      });
      if (shouldApply && isApplyingFullOutfit) APPLY_TOP_BODY_PARTS.forEach(part => { if (newMap[part] === costumeRefIndex) delete newMap[part]; });
      return newMap;
    });
    if (shouldApply) { setSelectedClothingConcept(null); setSelectedObjectItems([]); }
  };

  const conceptSelectionIsEmpty = Object.keys(bodyPartReferenceMap).length === 0 && selectedObjectItems.length === 0 && selectedClothingConcept === null;
  const conceptDeselectButton = (<Tooltip tip={t('tooltip.clearConceptSelection', language)} position="left"><button onClick={() => { setSelectedObjectItems([]); setBodyPartReferenceMap({}); setSelectedClothingConcept(null); }} disabled={conceptSelectionIsEmpty} className="px-3 py-1.5 text-xs text-zinc-200 bg-white/10 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('clearSelection', language)}</button></Tooltip>);
  const activeClothingThemeData = CLOTHING_THEMES.find(theme => theme.themeKey === activeConceptTheme);
  const activeObjectThemeData = OBJECT_THEMES.find(theme => theme.themeKey === activeConceptTheme);

  const conceptThemeTabs: { key: ConceptThemeKey; labelKey: TranslationKey }[] = [
    { key: 'scifi', labelKey: 'theme.scifi' }, { key: 'fantasy', labelKey: 'theme.fantasy' }, { key: 'modern', labelKey: 'theme.modern' },
  ];

  return (
    <div className="relative space-y-3">
      <Section title={t('section.bodyPartSelection.title', language)} icon={<BodyIcon />} topRightAction={conceptDeselectButton}>
        {/* 마네킹 카드 + 우측 컨트롤 수직중앙정렬 레이아웃 */}
        <div className={`grid gap-1.5 ${!hasCostumeReference ? 'opacity-50 pointer-events-none' : ''}`} style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* 마네킹 — 라운드 카드 */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <BodyPartSelector
              bodyPartReferenceMap={bodyPartReferenceMap}
              onAssign={handleBodyPartAssign}
              boardImages={boardImages}
            />
          </div>
          {/* 우측: 수직 중앙정렬 */}
          <div className="flex flex-col min-w-0 transition-opacity py-1">
            {/* 버튼 그룹 */}
            <div className="flex flex-col justify-center flex-1 pb-1">
            <div className="flex flex-col gap-1">
              <Tooltip tip={t('tooltip.applyFullOutfit', language)} position="right">
                <button
                  onClick={handleApplyFullOutfitClick}
                  disabled={!hasCostumeReference}
                  className={`w-full py-1.5 text-xs rounded-xl transition-colors border ${isApplyingFullOutfit ? 'bg-key text-zinc-900 border-transparent' : 'bg-white/10 hover:bg-white/20 text-zinc-200 border-white/20'} disabled:cursor-not-allowed`}
                >
                  {t('applyFullOutfit', language)}
                </button>
              </Tooltip>
              <div className="grid grid-cols-2 gap-1">
                <Tooltip tip={t('tooltip.applyTop', language)} position="right">
                  <button
                    onClick={handleApplyTopClick}
                    disabled={!hasCostumeReference}
                    className={`w-full py-1.5 text-xs rounded-xl transition-colors ${isApplyingTop ? 'bg-key text-zinc-900' : 'bg-white/10 hover:bg-white/20 text-zinc-200'} disabled:cursor-not-allowed`}
                  >
                    {t('applyTop', language)}
                  </button>
                </Tooltip>
                <Tooltip tip={t('tooltip.applyBottom', language)} position="right">
                  <button
                    onClick={handleApplyBottomClick}
                    disabled={!hasCostumeReference}
                    className={`w-full py-1.5 text-xs rounded-xl transition-colors ${isApplyingBottom ? 'bg-key text-zinc-900' : 'bg-white/10 hover:bg-white/20 text-zinc-200'} disabled:cursor-not-allowed`}
                  >
                    {t('applyBottom', language)}
                  </button>
                </Tooltip>
              </div>
            </div>
            </div>
            {/* 구분선 */}
            <div className="border-t border-white/10 flex-shrink-0" />
            {/* Synthesis Control Section */}
            <div className="flex flex-col justify-center flex-1 pt-1">
            <div className={`flex flex-col gap-1.5 w-full transition-opacity ${!isCostumeDesignEnabled ? 'opacity-50' : 'opacity-100'}`}>
              <Tooltip tip={t('tooltip.referenceDesign', language)} position="top">
                <label className="text-xs text-white cursor-pointer select-none flex items-center justify-between">
                  {t('referenceDesignControl', language)}
                  <input
                    type="checkbox"
                    checked={isCostumeDesignEnabled}
                    onChange={(e) => setIsCostumeDesignEnabled(e.target.checked)}
                    disabled={!hasCostumeReference}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </label>
              </Tooltip>
              <div className="relative px-1">
                <input
                  type="range" min="1" max="5"
                  disabled={!hasCostumeReference || !isCostumeDesignEnabled}
                  value={costumeCreativityLevel}
                  onChange={(e) => setCostumeCreativityLevel(parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white block disabled:cursor-not-allowed relative z-20"
                />
                <div className="flex justify-between w-full px-[2px] mt-2 relative z-10">
                  {[1, 2, 3, 4, 5].map(num => (
                    <div key={num} className={`text-xs transition-colors duration-200 ${costumeCreativityLevel === num && isCostumeDesignEnabled ? 'text-white' : 'text-zinc-600'}`}>
                      {num}
                    </div>
                  ))}
                </div>
                {isCostumeDesignEnabled && (
                  <div
                    className="absolute top-9 transform -translate-x-1/2 transition-all duration-300 pointer-events-none z-50"
                    style={{ left: `${(costumeCreativityLevel - 1) * 25}%` }}
                  >
                    <div className="bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg border border-zinc-600 whitespace-nowrap">
                      {getStepDescription('reference', costumeCreativityLevel)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('section.conceptDesign.title', language)} tooltipText={t('tooltip.section.conceptDesign', language)} icon={<HangerIcon />}>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">{conceptThemeTabs.map(tab => {
            const ThemeIcon = THEME_ICON_MAP[tab.key];
            return (
              <Tooltip key={tab.key} tip={t('tooltip.clothingTheme', language)} position="top" className="flex-1">
                <button onClick={() => setActiveConceptTheme(tab.key)} className={`w-full py-1 text-xs lg:py-1.5 lg:text-sm transition-colors flex items-center justify-center gap-1.5 rounded-xl ${activeConceptTheme === tab.key ? 'bg-key text-zinc-900' : 'bg-white/10 hover:bg-white/20 text-zinc-200'}`}>
                  {ThemeIcon && <ThemeIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
                  {t(tab.labelKey, language)}
                </button>
              </Tooltip>
            );
          })}</div>
          <div className="flex bg-black/20 rounded-xl p-1">
            <Tooltip tip={t('tooltip.subTabClothing', language)} position="top" className="flex-1"><button onClick={() => setActiveConceptSubTab('clothing')} className={`w-full py-2 rounded-md text-xs ${activeConceptSubTab === 'clothing' ? 'bg-neutral-700 text-white' : 'text-zinc-400 hover:bg-neutral-700/50'}`}>{t('subTab.clothingConcept', language)}</button></Tooltip>
            <Tooltip tip={t('tooltip.subTabItem', language)} position="top" className="flex-1"><button onClick={() => setActiveConceptSubTab('item')} className={`w-full py-2 rounded-md text-xs ${activeConceptSubTab === 'item' ? 'bg-neutral-700 text-white' : 'text-zinc-400 hover:bg-neutral-700/50'}`}>{t('subTab.itemConcept', language)}</button></Tooltip>
          </div>
          {/* [UI REFACTOR] Grid Layout + Expanding Row Dropdown */}
          <div className="relative min-h-[100px]" ref={dropdownContainerRef}>
            {(() => {
              // Determine which items to show based on active sub-tab
              const currentCategories = activeConceptSubTab === 'clothing' && activeClothingThemeData
                ? activeClothingThemeData.categories
                : activeConceptSubTab === 'item' && activeObjectThemeData
                  ? activeObjectThemeData.categories
                  : [];

              if (currentCategories.length === 0) return null;

              // Chunk categories into rows of 3
              const chunkSize = 3;
              const chunks = [];
              for (let i = 0; i < currentCategories.length; i += chunkSize) {
                chunks.push(currentCategories.slice(i, i + chunkSize));
              }

              return chunks.map((chunk, chunkIndex) => {
                // Check if any category in this row is currently active
                const activeCategoryInRow = chunk.find(cat => cat.categoryKey === activeCategoryKey);

                return (
                  <div key={chunkIndex} className="mb-1">
                    {/* Row of Categories */}
                    <div className="grid grid-cols-3 gap-1 relative z-10 animate-category-fade-in">
                      {chunk.map(category => (
                        <DropdownCategory
                          key={category.categoryKey}
                          categoryKey={category.categoryKey}
                          items={category.items}
                          selectedItem={activeConceptSubTab === 'clothing' ? selectedClothingConcept : null}
                          selectedItems={activeConceptSubTab === 'item' ? selectedObjectItems : undefined}
                          onItemSelect={activeConceptSubTab === 'clothing' ? handleClothingItemToggle : handleObjectItemToggle}
                          language={language}
                          type={activeConceptSubTab as 'clothing' | 'object'}
                          isOpen={activeCategoryKey === category.categoryKey}
                          onToggle={() => setActiveCategoryKey(prev => prev === category.categoryKey ? null : category.categoryKey)}
                        />
                      ))}
                    </div>

                    {/* Expanded Content (Inserted flow-inline below the row) */}
                    {activeCategoryInRow && (
                      <div className="mt-1 w-full animate-fadeIn origin-top">
                        <DropdownContent
                          items={activeCategoryInRow.items}
                          selectedItem={activeConceptSubTab === 'clothing' ? selectedClothingConcept : null}
                          selectedItems={activeConceptSubTab === 'item' ? selectedObjectItems : undefined}
                          onItemSelect={activeConceptSubTab === 'clothing' ? handleClothingItemToggle : handleObjectItemToggle}
                          language={language}
                          type={activeConceptSubTab as 'clothing' | 'object'}
                          className="bg-neutral-800/95 backdrop-blur-md border border-white/20"
                          categoryKey={activeCategoryInRow.categoryKey}
                        />
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </Section>
    </div>
  );
};
