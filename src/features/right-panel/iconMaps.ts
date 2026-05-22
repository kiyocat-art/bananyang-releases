import {
    TopsIcon, OuterwearIcon, BottomsIcon, FootwearIcon, GlovesIcon,
    HatsIcon, BagsIcon, DecorationsIcon, SetsIcon,
    WeaponsIcon, GadgetsIcon, DefenseIcon, SwordsIcon, AxesIcon,
    PolearmsIcon, RangedIcon, MagicIcon, ShieldsIcon, ArmorIcon,
    ArtifactsIcon, EnvironmentIcon, ElectronicsIcon, EverydayIcon,
    SciFiThemeIcon, FantasyThemeIcon, ModernThemeIcon,
    AncientThemeIcon, EasternThemeIcon,
} from '../../components/icons';
import React from 'react';

type IconComponent = React.FC<{ className?: string }>;

// ---------------------------------------------------------------------------
// Theme → Icon
// ---------------------------------------------------------------------------
export const THEME_ICON_MAP: Record<string, IconComponent> = {
    scifi: SciFiThemeIcon,
    fantasy: FantasyThemeIcon,
    modern: ModernThemeIcon,
    ancient: AncientThemeIcon,
    eastern: EasternThemeIcon,
};

// ---------------------------------------------------------------------------
// Clothing Category → Icon
// ---------------------------------------------------------------------------
export const CLOTHING_CATEGORY_ICON_MAP: Record<string, IconComponent> = {
    tops: TopsIcon,
    outerwear: OuterwearIcon,
    bottoms: BottomsIcon,
    footwear: FootwearIcon,
    gloves: GlovesIcon,
    hats: HatsIcon,
    bags: BagsIcon,
    decorations: DecorationsIcon,
    sets: SetsIcon,
};

// ---------------------------------------------------------------------------
// Object Category → Icon
// ---------------------------------------------------------------------------
export const OBJECT_CATEGORY_ICON_MAP: Record<string, IconComponent> = {
    weapons: WeaponsIcon,
    gadgets: GadgetsIcon,
    defense: DefenseIcon,
    swords: SwordsIcon,
    axes: AxesIcon,
    polearms: PolearmsIcon,
    ranged: RangedIcon,
    magic: MagicIcon,
    shields: ShieldsIcon,
    armor: ArmorIcon,
    artifacts: ArtifactsIcon,
    environment: EnvironmentIcon,
    electronics: ElectronicsIcon,
    everyday: EverydayIcon,
};

// ---------------------------------------------------------------------------
// Short name helper — first word of localized name (max 10 chars)
// ---------------------------------------------------------------------------
export function getShortItemName(fullName: string): string {
    const words = fullName.trim().split(/\s+/);
    if (words.length === 1) {
        return words[0].length > 10 ? words[0].slice(0, 9) + '…' : words[0];
    }
    const firstTwo = words[0] + ' ' + words[1];
    if (firstTwo.length <= 10) return firstTwo;
    return words[0].length > 10 ? words[0].slice(0, 9) + '…' : words[0];
}
