import React, { useRef } from 'react';
import { HoverEdgeAutoScroll } from '../../../components/HoverEdgeAutoScroll';
import { ClothingItem, ObjectItem } from '../../../types';
import { t, getEnumText, Language, TranslationKey } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';
import { ChevronDownIcon } from '../../../components/icons';
import { CLOTHING_CATEGORY_ICON_MAP, OBJECT_CATEGORY_ICON_MAP, getShortItemName } from '../iconMaps';

// Props shared between Button and Content
export interface DropdownSharedProps {
  items: (ClothingItem | ObjectItem)[];
  selectedItem: ClothingItem | ObjectItem | null;
  selectedItems?: (ClothingItem | ObjectItem)[];
  onItemSelect: (item: any) => void;
  language: Language;
  type: 'clothing' | 'object';
}

// Props for the Content List Component
export interface DropdownContentProps extends DropdownSharedProps {
  className?: string;
  categoryKey?: string;
}

// Props for the Button Component
interface DropdownCategoryProps extends DropdownSharedProps {
  categoryKey: string;
  isOpen: boolean;  // Controlled state
  onToggle: () => void; // Toggle handler
  disabled?: boolean;
}

export const DropdownContent: React.FC<DropdownContentProps> = ({
  items,
  selectedItem,
  selectedItems = [],
  onItemSelect,
  language,
  type,
  className = '',
  categoryKey,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const iconMap = type === 'clothing' ? CLOTHING_CATEGORY_ICON_MAP : OBJECT_CATEGORY_ICON_MAP;
  const CategoryIcon = categoryKey ? iconMap[categoryKey] : undefined;

  return (
    <div className={`relative bg-neutral-800 border border-white/20 rounded-xl shadow-xl max-h-60 overflow-hidden z-50 ${className}`}>
      <div ref={scrollRef} className="overflow-y-auto max-h-60 custom-scrollbar">
      <div className="p-2 flex flex-wrap gap-1.5">
        {items.map(item => {
          const isSelected = type === 'clothing'
            ? selectedItem === item
            : selectedItems.includes(item);
          const itemName = type === 'clothing'
            ? getEnumText('clothing', item as ClothingItem, language)
            : getEnumText('object', item as ObjectItem, language);
          const shortName = getShortItemName(itemName);

          return (
            <Tooltip key={item} tip={itemName} position="top">
              <button
                onClick={() => onItemSelect(item)}
                className={`flex items-center gap-1 px-1.5 py-1 text-xs lg:px-2 lg:py-1.5 lg:text-xs rounded-md transition-colors ${isSelected
                  ? 'bg-white text-zinc-800 '
                  : 'bg-white/10 hover:bg-white/20 text-zinc-300'
                  }`}
              >
                {CategoryIcon && <CategoryIcon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
                <span>{shortName}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
      </div>
      <HoverEdgeAutoScroll targetRef={scrollRef} />
    </div>
  );
};

export const DropdownCategory: React.FC<DropdownCategoryProps> = ({
  categoryKey,
  items,
  selectedItem,
  selectedItems = [],
  onItemSelect,
  language,
  type,
  isOpen,
  onToggle,
  disabled = false
}) => {
  // Check if any item in this category is selected
  const hasSelectedItem = type === 'clothing'
    ? selectedItem && items.includes(selectedItem as ClothingItem)
    : selectedItems.some(item => items.includes(item as ObjectItem));

  // Get selected item name for display
  const selectedItemName = type === 'clothing'
    ? (selectedItem && items.includes(selectedItem as ClothingItem)
      ? getEnumText('clothing', selectedItem as ClothingItem, language)
      : null)
    : (selectedItems.find(item => items.includes(item as ObjectItem))
      ? getEnumText('object', selectedItems.find(item => items.includes(item as ObjectItem)) as ObjectItem, language)
      : null);

  const translationKey = type === 'clothing'
    ? `clothingCategory.${categoryKey}` as TranslationKey
    : `objectCategory.${categoryKey}` as TranslationKey;

  const iconMap = type === 'clothing' ? CLOTHING_CATEGORY_ICON_MAP : OBJECT_CATEGORY_ICON_MAP;
  const CategoryIcon = iconMap[categoryKey];

  return (
    <div className="relative">
      {/* Header Button */}
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-full flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all h-full min-h-[60px] ${hasSelectedItem || isOpen
            ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.15)]'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 bg-white/5'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {CategoryIcon && <CategoryIcon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
        <span className="text-xs text-center leading-tight break-keep">
          {t(translationKey, language)}
        </span>

        {/* Badge for selected item */}
        {selectedItemName && (
          <span className="text-xs px-1.5 py-0.5 bg-white/20 rounded-full text-white truncate max-w-full mt-0.5">
            {getShortItemName(selectedItemName)}
          </span>
        )}

        {/* Bottom Glow Bar (Active Indicator) */}
        {(hasSelectedItem || isOpen) && (
          <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        )}
      </button>
    </div>
  );
};
