import { CameraSize, BodyPart, ClothingItem, ActionPose, ObjectItem, PromptFolder, PaletteCategory, BoardImage, Resolution, AspectRatio, CameraAnglePreset, LensFocusPreset, ShotSizePreset } from './types';

export const CAMERA_SIZES: CameraSize[] = [
    CameraSize.Full,
];

// Camera Angle Presets with prompt text
export const CAMERA_ANGLE_PRESETS: { key: CameraAnglePreset; promptText: string }[] = [
    { key: 'eyeLevel', promptText: 'eye level shot' },
    { key: 'highAngle', promptText: 'high angle shot, looking down' },
    { key: 'lowAngle', promptText: 'low angle shot, looking up' },
    { key: 'birdsEye', promptText: "bird's eye view, overhead shot" },
    { key: 'wormsEye', promptText: "worm's eye view, extreme low angle" },
    { key: 'dutchAngle', promptText: 'dutch angle, tilted camera' },
    { key: 'overTheShoulder', promptText: 'over the shoulder shot' },
];

// Lens & Focus Presets with prompt text
export const LENS_FOCUS_PRESETS: { key: LensFocusPreset; promptText: string }[] = [
    { key: 'deepFocus', promptText: 'deep focus, everything sharp' },
    { key: 'shallowFocus', promptText: 'shallow focus, bokeh, f/1.8' },
    { key: 'rackFocus', promptText: 'rack focus effect' },
    { key: 'fisheyeLens', promptText: 'fisheye lens, wide angle, distorted' },
    { key: 'telephotoLens', promptText: 'telephoto lens, compressed background' },
    { key: 'wideAngleLens', promptText: 'wide angle lens, exaggerated perspective' },
];

// Shot Size Presets with prompt text
export const SHOT_SIZE_PRESETS: { key: ShotSizePreset; promptText: string }[] = [
    { key: 'extremeLongShot', promptText: 'extreme long shot, establishing shot' },
    { key: 'longShot', promptText: 'long shot, full body with background' },
    { key: 'fullShot', promptText: 'full shot, head to toe framing' },
    { key: 'kneeShot', promptText: 'knee shot, framed from knees up' },
    { key: 'waistShot', promptText: 'medium shot, waist up' },
    { key: 'bustShot', promptText: 'bust shot, chest up' },
    { key: 'closeUp', promptText: 'close up shot, face only' },
    { key: 'extremeCloseUp', promptText: 'extreme close up, detailed features' },
];

// Get lens type label based on focal length
export const getLensTypeFromFocalLength = (focalLength: number): { key: string; promptText: string } => {
    if (focalLength < 24) return { key: 'fisheye', promptText: 'fisheye lens, wide angle, distorted' };
    if (focalLength <= 50) return { key: 'standard', promptText: '' }; // Standard lens, no special prompt
    return { key: 'telephoto', promptText: 'telephoto lens, shallow focus, compressed background' };
};

// Model Names
export const MODEL_NAMES = {
    GEMINI_3_PRO_IMAGE_PREVIEW: 'models/gemini-3-pro-image-preview',
    GEMINI_3_1_FLASH_IMAGE: 'gemini-3.1-flash-image-preview',
    GEMINI_2_5_FLASH_IMAGE: 'gemini-2.5-flash-image',
    GEMINI_1_5_PRO_PREVIEW: 'gemini-1.5-pro-preview-0409',
    GEMINI_1_5_PRO_PREVIEW_PREFIXED: 'models/gemini-1.5-pro-preview-0409',
    OPENAI_GPT_IMAGE_2: 'openai/gpt-image-2',
    FLUX_2_MAX: 'flux/flux-2-max',
};

export const RESOLUTIONS: Resolution[] = ['auto', '512', '1k', '2k', '4k'];
export const ASPECT_RATIOS: AspectRatio[] = [
    'auto',
    '1:1',
    '16:9', '9:16',
    '4:3',  '3:4',
    '2:3',  '3:2',
    '4:5',  '5:4',
    '21:9',
    '1:4',  '4:1',
    '1:8',  '8:1',
];

export const MODEL_RESOLUTIONS: Record<string, Resolution[]> = {
    [MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW]: ['auto', '512', '1k', '2k', '4k'],
    [MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE]: ['auto', '512', '1k', '2k', '4k'],
    [MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE]: ['auto', '1k'],
    [MODEL_NAMES.OPENAI_GPT_IMAGE_2]: ['auto', '512', '1k', '2k', '4k'],
    [MODEL_NAMES.FLUX_2_MAX]: ['auto', '1k', '2k'],
};


// Image generation costs (in USD) — Source: Google AI for Developers / Vertex AI Pricing
// gemini-2.5-flash-image: $0.039/img flat (1290 tokens, Batch $0.0195)
// gemini-3-pro-image-preview: $0.134 (1K/2K), $0.240 (4K)
// gemini-3.1-flash-image-preview: 0.5K $0.045 (747t), 1K $0.067 (1120t), 2K $0.101 (1680t), 4K $0.150 (2520t)
export const COST_PER_IMAGE = 0.039;
export const MODEL_COSTS: Record<string, (resolution?: string, quality?: string) => number> = {
    [MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE]: () => 0.039,  // flat rate, 1290 tokens
    [MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW]: (resolution) => {
        if (resolution === '4k') return 0.240;  // 4K (~16MP)
        return 0.134;                            // 1K / 2K
    },
    [MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE]: (resolution) => {
        if (resolution === '4k') return 0.150;   // 4K (~16MP, 2520 tokens)
        if (resolution === '2k') return 0.101;   // 2K (~4MP,  1680 tokens)
        if (resolution === '512') return 0.045;  // 0.5K (512px, 747 tokens)
        return 0.067;                             // 1K default (~1MP, 1120 tokens)
    },
    [MODEL_NAMES.GEMINI_1_5_PRO_PREVIEW]: (resolution) => resolution === '4k' ? 0.240 : 0.134,
    [MODEL_NAMES.GEMINI_1_5_PRO_PREVIEW_PREFIXED]: (resolution) => resolution === '4k' ? 0.240 : 0.134,
    // Source: OpenAI pricing — gpt-image-2 per quality (1024x1024 기준)
    // low: $0.006 / medium: $0.053 / high: $0.211; resolution multiplier applied on top
    [MODEL_NAMES.OPENAI_GPT_IMAGE_2]: (resolution, quality = 'auto') => {
        const q = quality === 'auto' ? 'medium' : quality;
        const baseCost = q === 'low' ? 0.006 : q === 'high' ? 0.211 : 0.053;
        const mpMultiplier = resolution === '4k' ? 8.3 : resolution === '2k' ? 3.7 : resolution === '512' ? 0.25 : 1;
        return Number((baseCost * mpMultiplier).toFixed(3));
    },
    // Source: BFL pricing — $0.07/MP (0.6MP=$0.042, 1MP=$0.07, 2MP=$0.14, 4MP=$0.28)
    [MODEL_NAMES.FLUX_2_MAX]: (resolution) => {
        const mp = parseFloat(resolution || '1') || 1;
        return Number((mp * 0.07).toFixed(3));
    },
};
export const ROWS_PER_PAGE = 12;
export const TOTAL_MONTHLY_CREDIT = 300.00;
export const bananyang_MEDIA_MIME_TYPE = 'application/x-bananyang-media';

// FIX: Export DEFAULT_PROMPT_FOLDERS constant.
export const DEFAULT_PROMPT_FOLDERS: PromptFolder[] = [];


export const BODY_PARTS: BodyPart[] = [
    BodyPart.Face,
    BodyPart.Hair,
    BodyPart.Body,
    BodyPart.Pelvis,
    BodyPart.LeftShoulder,
    BodyPart.RightShoulder,
    BodyPart.LeftArm,
    BodyPart.RightArm,
    BodyPart.BothArms,
    BodyPart.LeftHand,
    BodyPart.RightHand,
    BodyPart.BothHands,
    BodyPart.LeftLeg,
    BodyPart.RightLeg,
    BodyPart.BothLegs,
    BodyPart.LeftFoot,
    BodyPart.RightFoot,
    BodyPart.BothFeet,
];

export type ClothingCategory = {
    categoryKey: 'tops' | 'bottoms' | 'footwear' | 'gloves' | 'hats' | 'bags' | 'decorations' | 'sets' | 'outerwear';
    items: ClothingItem[];
};

export type ClothingTheme = {
    themeKey: 'scifi' | 'modern' | 'fantasy';
    categories: ClothingCategory[];
};

export const CLOTHING_THEMES: ClothingTheme[] = [
    {
        themeKey: 'scifi',
        categories: [
            { categoryKey: 'tops', items: [ClothingItem.SciFiCyberneticJacket, ClothingItem.SciFiHolographicTop, ClothingItem.SciFiLightArmorChest, ClothingItem.SciFiBioSuitTop, ClothingItem.SciFiSpaceSuitTorso] },
            { categoryKey: 'outerwear', items: [ClothingItem.SciFiNeonTrenchcoat] },
            { categoryKey: 'bottoms', items: [ClothingItem.SciFiArmoredPants, ClothingItem.SciFiEnergyLeggings, ClothingItem.SciFiZeroGravityTrousers, ClothingItem.SciFiCyberpunkSkirt, ClothingItem.SciFiBioSuitBottom, ClothingItem.SciFiExoskeletonLegs] },
            { categoryKey: 'footwear', items: [ClothingItem.SciFiMagneticBoots, ClothingItem.SciFiHoverBoots, ClothingItem.SciFiCyberneticGreaves, ClothingItem.SciFiEnergySandals, ClothingItem.SciFiLightweightPlatingBoots] },
            { categoryKey: 'gloves', items: [ClothingItem.SciFiDataGloves, ClothingItem.SciFiPowerGauntlets, ClothingItem.SciFiNanoGloves, ClothingItem.SciFiRoboticHands, ClothingItem.SciFiCyberneticForearms] },
            { categoryKey: 'hats', items: [ClothingItem.SciFiVisorHelmet, ClothingItem.SciFiNeuroLinkHeadset, ClothingItem.SciFiHolographicHood, ClothingItem.SciFiBreathingMask, ClothingItem.SciFiCombatHelmet, ClothingItem.SciFiDataVisor] },
            { categoryKey: 'bags', items: [ClothingItem.SciFiGravityPouch, ClothingItem.SciFiTechBackpack, ClothingItem.SciFiEnergyCellHolster, ClothingItem.SciFiUtilityBelt] },
            { categoryKey: 'decorations', items: [ClothingItem.SciFiShoulderMountedDrone, ClothingItem.SciFiFloatingPauldrons, ClothingItem.SciFiEnergyShieldEmitter, ClothingItem.SciFiPlasmaCables] },
            { categoryKey: 'sets', items: [ClothingItem.SciFiPilotSuitSet, ClothingItem.SciFiCyborgEnforcerSet, ClothingItem.SciFiExplorerSuitSet, ClothingItem.SciFiStealthOpsSet] },
        ]
    },
    {
        themeKey: 'fantasy',
        categories: [
            { categoryKey: 'tops', items: [ClothingItem.FantasyPlateArmorChest, ClothingItem.FantasyLeatherJerkin, ClothingItem.FantasyMageRobesTop, ClothingItem.FantasyChainmailShirt, ClothingItem.FantasyTunic, ClothingItem.FantasyElvenRobe, ClothingItem.FantasyDwarvenArmor] },
            { categoryKey: 'outerwear', items: [ClothingItem.FantasyTravelersCloak, ClothingItem.FantasyRoyalCape, ClothingItem.FantasyFurMantle] },
            { categoryKey: 'bottoms', items: [ClothingItem.FantasyPlateGreaves, ClothingItem.FantasyLeatherPants, ClothingItem.FantasyMageRobesBottom, ClothingItem.FantasyChainmailLeggings, ClothingItem.FantasyTrousers, ClothingItem.FantasyKilt] },
            { categoryKey: 'footwear', items: [ClothingItem.FantasyPlateSabatons, ClothingItem.FantasyLeatherBoots, ClothingItem.FantasyMageSandals, ClothingItem.FantasyElvenBoots] },
            { categoryKey: 'gloves', items: [ClothingItem.FantasyPlateGauntlets, ClothingItem.FantasyLeatherBracers, ClothingItem.FantasyMageGloves] },
            { categoryKey: 'hats', items: [ClothingItem.FantasyChainmailCoif, ClothingItem.FantasyLeatherHood, ClothingItem.FantasyCirclet, ClothingItem.FantasyCrown, ClothingItem.FantasySteelHelmet] },
            { categoryKey: 'bags', items: [ClothingItem.FantasyAdventurerBelt, ClothingItem.FantasyPotionBelt] },
            { categoryKey: 'decorations', items: [ClothingItem.FantasyPlatePauldrons, ClothingItem.FantasyLeatherShoulderPads, ClothingItem.FantasyMagePauldrons] },
            { categoryKey: 'sets', items: [ClothingItem.FantasyKnightSet, ClothingItem.FantasyRogueSet, ClothingItem.FantasyWizardSet, ClothingItem.FantasyRangerSet, ClothingItem.FantasyKingSet] },
        ]
    },
    {
        themeKey: 'modern',
        categories: [
            { categoryKey: 'tops', items: [ClothingItem.ModernShirt, ClothingItem.ModernHoodie, ClothingItem.ModernBlazer, ClothingItem.ModernJumperJacket, ClothingItem.ModernDressTop] },
            { categoryKey: 'outerwear', items: [ClothingItem.ModernLongCoat, ClothingItem.ModernHoodedJumper, ClothingItem.ModernSlimfitJacket] },
            { categoryKey: 'bottoms', items: [ClothingItem.ModernJeans, ClothingItem.ModernSlacks, ClothingItem.ModernSkirt, ClothingItem.ModernShorts, ClothingItem.ModernSweatpants, ClothingItem.ModernSkinnyJeans] },
            { categoryKey: 'footwear', items: [ClothingItem.ModernSneakers, ClothingItem.ModernDressShoes, ClothingItem.ModernBoots, ClothingItem.ModernSandals] },
            { categoryKey: 'gloves', items: [ClothingItem.ModernLeatherGloves, ClothingItem.ModernKnitGloves] },
            { categoryKey: 'hats', items: [ClothingItem.ModernCap, ClothingItem.ModernBeanie, ClothingItem.ModernFedora, ClothingItem.ModernBucketHat] },
            { categoryKey: 'bags', items: [ClothingItem.ModernBackpack, ClothingItem.ModernSlingBag, ClothingItem.ModernShoulderBag, ClothingItem.ModernToteBag] },
            { categoryKey: 'decorations', items: [ClothingItem.ModernScarf, ClothingItem.ModernWatch, ClothingItem.ModernNecklace] },
            { categoryKey: 'sets', items: [ClothingItem.ModernCasualSet, ClothingItem.ModernSuitSet, ClothingItem.ModernStreetwearSet, ClothingItem.ModernBikerSet] },
        ]
    }
];

export const OBJECT_THEMES = [
    {
        themeKey: 'scifi',
        categories: [
            { categoryKey: 'weapons', items: [ObjectItem.SciFiWeaponPlasmaRifle, ObjectItem.SciFiWeaponEnergySword, ObjectItem.SciFiWeaponLaserPistol, ObjectItem.SciFiWeaponRailgun, ObjectItem.SciFiWeaponLaserKatana, ObjectItem.SciFiWeaponGravityGun, ObjectItem.SciFiWeaponTeslaCannon, ObjectItem.SciFiWeaponPlasmaBlade, ObjectItem.SciFiWeaponPhaseRifle, ObjectItem.SciFiWeaponNanoSwarmGrenade] },
            { categoryKey: 'gadgets', items: [ObjectItem.SciFiItemHolographicProjector, ObjectItem.SciFiItemPersonalDrone, ObjectItem.SciFiItemDataPad, ObjectItem.SciFiItemMedibot, ObjectItem.SciFiItemTeleporter, ObjectItem.SciFiItemScanner, ObjectItem.SciFiItemNanoMedInjector, ObjectItem.SciFiItemGravBoots] },
            { categoryKey: 'defense', items: [ObjectItem.SciFiDefenseEnergyShield, ObjectItem.SciFiDefenseLightCompositeArmor, ObjectItem.SciFiDefenseExoFrame, ObjectItem.SciFiDefenseStealthCloak, ObjectItem.SciFiDefenseNanoShield, ObjectItem.SciFiDefenseForceFieldGenerator, ObjectItem.SciFiDefenseHoloDecoy] }
        ]
    },
    {
        themeKey: 'fantasy',
        categories: [
            { categoryKey: 'swords', items: [ObjectItem.FantasyWeaponLongsword, ObjectItem.FantasyWeaponBroadsword, ObjectItem.FantasyWeaponDagger, ObjectItem.FantasyWeaponGreatsword, ObjectItem.FantasyWeaponRapier, ObjectItem.FantasyWeaponScimitar, ObjectItem.FantasyWeaponClaymore] },
            { categoryKey: 'axes', items: [ObjectItem.FantasyWeaponBattleAxe, ObjectItem.FantasyWeaponWarhammer, ObjectItem.FantasyWeaponMace, ObjectItem.FantasyWeaponMorningStar, ObjectItem.FantasyWeaponFlail, ObjectItem.FantasyWeaponWarAxe] },
            { categoryKey: 'polearms', items: [ObjectItem.FantasyWeaponSpear, ObjectItem.FantasyWeaponHalberd, ObjectItem.FantasyWeaponLance, ObjectItem.FantasyWeaponPike, ObjectItem.FantasyWeaponTrident, ObjectItem.FantasyWeaponGlaive] },
            { categoryKey: 'ranged', items: [ObjectItem.FantasyWeaponLongbow, ObjectItem.FantasyWeaponCrossbow, ObjectItem.FantasyWeaponShortbow, ObjectItem.FantasyWeaponCompositeBow, ObjectItem.FantasyWeaponThrowingKnife] },
            { categoryKey: 'magic', items: [ObjectItem.FantasyWeaponMagicStaff, ObjectItem.FantasyWeaponMagicWand, ObjectItem.FantasyWeaponMagicOrb, ObjectItem.FantasyWeaponRuneBlade] },
            { categoryKey: 'shields', items: [ObjectItem.FantasyDefenseKiteShield, ObjectItem.FantasyDefenseRoundShield, ObjectItem.FantasyDefenseTowerShield, ObjectItem.FantasyDefenseBuckler, ObjectItem.FantasyDefenseHeaterShield] },
            { categoryKey: 'armor', items: [ObjectItem.FantasyDefensePlateArmor, ObjectItem.FantasyDefenseChainmail, ObjectItem.FantasyDefenseLeatherArmor, ObjectItem.FantasyDefenseScaleArmor, ObjectItem.FantasyDefenseGreatHelm, ObjectItem.FantasyDefenseBarbuteHelm] },
            { categoryKey: 'artifacts', items: [ObjectItem.FantasyItemMagicCrystal, ObjectItem.FantasyItemAncientScroll, ObjectItem.FantasyItemHealthPotion, ObjectItem.FantasyItemRing, ObjectItem.FantasyItemAmulet, ObjectItem.FantasyItemGoblet] },
            { categoryKey: 'environment', items: [ObjectItem.FantasyItemTreasureChest, ObjectItem.FantasyItemTorch, ObjectItem.FantasyItemSpellbook] }
        ]
    },
    {
        themeKey: 'modern',
        categories: [
            { categoryKey: 'weapons', items: [ObjectItem.ModernWeaponPistol, ObjectItem.ModernWeaponRifle, ObjectItem.ModernWeaponShotgun, ObjectItem.ModernWeaponKnife, ObjectItem.ModernWeaponBaseballBat, ObjectItem.ModernWeaponSubmachineGun, ObjectItem.ModernWeaponSniperRifle, ObjectItem.ModernWeaponRevolver, ObjectItem.ModernWeaponCombatKnife, ObjectItem.ModernWeaponKatana, ObjectItem.ModernWeaponSaber, ObjectItem.ModernWeaponLongsword, ObjectItem.ModernWeaponMachete, ObjectItem.ModernWeaponTaser, ObjectItem.ModernWeaponPepperSpray, ObjectItem.ModernWeaponCrossbow, ObjectItem.ModernWeaponBoxingGloves, ObjectItem.ModernWeaponBrassKnuckles, ObjectItem.ModernWeaponBaton] },
            { categoryKey: 'electronics', items: [ObjectItem.ModernItemSmartphone, ObjectItem.ModernItemLaptop, ObjectItem.ModernItemHeadphones, ObjectItem.ModernItemDrone, ObjectItem.ModernItemWalkieTalkie, ObjectItem.ModernItemFlashlight, ObjectItem.ModernItemCamera, ObjectItem.ModernItemTablet] },
            { categoryKey: 'everyday', items: [ObjectItem.ModernItemCoffeeMug, ObjectItem.ModernItemBriefcase, ObjectItem.ModernItemLighter, ObjectItem.ModernItemHandcuffs, ObjectItem.ModernItemBinoculars] },
            { categoryKey: 'defense', items: [ObjectItem.ModernDefenseKevlarVest, ObjectItem.ModernDefenseTacticalHelmet, ObjectItem.ModernDefenseRiotShield, ObjectItem.ModernDefenseGasMask, ObjectItem.ModernDefenseTacticalVest, ObjectItem.ModernDefenseBulletproofSunglasses, ObjectItem.ModernDefenseKneePads, ObjectItem.ModernDefenseElbowPads] }
        ]
    },
    {
        themeKey: 'ancient',
        categories: [
            { categoryKey: 'weapons', items: [ObjectItem.AncientWeaponGladius, ObjectItem.AncientWeaponKhopesh, ObjectItem.AncientWeaponXiphos, ObjectItem.AncientWeaponPilum, ObjectItem.AncientWeaponSarissa] },
            { categoryKey: 'defense', items: [ObjectItem.AncientDefenseScutum, ObjectItem.AncientDefenseAspis, ObjectItem.AncientDefenseLorica, ObjectItem.AncientDefenseGaleaHelm] }
        ]
    },
    {
        themeKey: 'eastern',
        categories: [
            { categoryKey: 'weapons', items: [ObjectItem.EasternWeaponKatana, ObjectItem.EasternWeaponWakizashi, ObjectItem.EasternWeaponNodachi, ObjectItem.EasternWeaponNaginata, ObjectItem.EasternWeaponYari, ObjectItem.EasternWeaponKusarigama, ObjectItem.EasternWeaponShuriken, ObjectItem.EasternWeaponNunchaku, ObjectItem.EasternWeaponJian, ObjectItem.EasternWeaponDao, ObjectItem.EasternWeaponGuandao] },
            { categoryKey: 'defense', items: [ObjectItem.EasternDefenseSamuraiArmor, ObjectItem.EasternDefenseKabutoHelm, ObjectItem.EasternDefenseChineseLamellar] }
        ]
    }
];

export const CLOTHING_TO_BODY_PARTS_MAP: Record<ClothingItem, BodyPart[]> = {
    // Sci-Fi
    [ClothingItem.SciFiCyberneticJacket]: [BodyPart.LeftShoulder, BodyPart.RightShoulder, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Body],
    [ClothingItem.SciFiHolographicTop]: [BodyPart.Body],
    [ClothingItem.SciFiLightArmorChest]: [BodyPart.Body],
    [ClothingItem.SciFiBioSuitTop]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.SciFiSpaceSuitTorso]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.SciFiNeonTrenchcoat]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.SciFiArmoredPants]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.SciFiEnergyLeggings]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.SciFiZeroGravityTrousers]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.SciFiCyberpunkSkirt]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.SciFiBioSuitBottom]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.SciFiExoskeletonLegs]: [BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.SciFiMagneticBoots]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.SciFiHoverBoots]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.SciFiCyberneticGreaves]: [BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.SciFiEnergySandals]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.SciFiLightweightPlatingBoots]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.SciFiDataGloves]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiPowerGauntlets]: [BodyPart.LeftArm, BodyPart.RightArm, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiNanoGloves]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiRoboticHands]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiCyberneticForearms]: [BodyPart.LeftArm, BodyPart.RightArm, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiVisorHelmet]: [BodyPart.Hair],
    [ClothingItem.SciFiNeuroLinkHeadset]: [BodyPart.Hair],
    [ClothingItem.SciFiHolographicHood]: [BodyPart.Hair],
    [ClothingItem.SciFiBreathingMask]: [BodyPart.Hair],
    [ClothingItem.SciFiCombatHelmet]: [BodyPart.Hair],
    [ClothingItem.SciFiDataVisor]: [BodyPart.Hair],
    [ClothingItem.SciFiGravityPouch]: [BodyPart.Pelvis],
    [ClothingItem.SciFiTechBackpack]: [BodyPart.Body],
    [ClothingItem.SciFiEnergyCellHolster]: [BodyPart.Pelvis],
    [ClothingItem.SciFiUtilityBelt]: [BodyPart.Pelvis],
    [ClothingItem.SciFiShoulderMountedDrone]: [BodyPart.LeftShoulder],
    [ClothingItem.SciFiFloatingPauldrons]: [BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.SciFiEnergyShieldEmitter]: [BodyPart.LeftArm],
    [ClothingItem.SciFiPlasmaCables]: [BodyPart.Body],
    [ClothingItem.SciFiPilotSuitSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiCyborgEnforcerSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiExplorerSuitSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.SciFiStealthOpsSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],

    // Fantasy
    [ClothingItem.FantasyPlateArmorChest]: [BodyPart.Body, BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyLeatherJerkin]: [BodyPart.Body],
    [ClothingItem.FantasyMageRobesTop]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.FantasyChainmailShirt]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.FantasyTunic]: [BodyPart.Body],
    [ClothingItem.FantasyElvenRobe]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.FantasyDwarvenArmor]: [BodyPart.Body, BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyTravelersCloak]: [BodyPart.Body, BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyRoyalCape]: [BodyPart.Body, BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyFurMantle]: [BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyPlateGreaves]: [BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.FantasyLeatherPants]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.FantasyMageRobesBottom]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.FantasyChainmailLeggings]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.FantasyTrousers]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.FantasyKilt]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.FantasyPlateSabatons]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.FantasyLeatherBoots]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.FantasyMageSandals]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.FantasyElvenBoots]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.FantasyPlateGauntlets]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.FantasyLeatherBracers]: [BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.FantasyMageGloves]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.FantasyChainmailCoif]: [BodyPart.Hair],
    [ClothingItem.FantasyLeatherHood]: [BodyPart.Hair],
    [ClothingItem.FantasyCirclet]: [BodyPart.Hair],
    [ClothingItem.FantasyCrown]: [BodyPart.Hair],
    [ClothingItem.FantasySteelHelmet]: [BodyPart.Hair],
    [ClothingItem.FantasyAdventurerBelt]: [BodyPart.Pelvis],
    [ClothingItem.FantasyPotionBelt]: [BodyPart.Pelvis],
    [ClothingItem.FantasyPlatePauldrons]: [BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyLeatherShoulderPads]: [BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyMagePauldrons]: [BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.FantasyKnightSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.FantasyRogueSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.FantasyWizardSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.FantasyRangerSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.FantasyKingSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot, BodyPart.LeftHand, BodyPart.RightHand],

    // Modern
    [ClothingItem.ModernShirt]: [BodyPart.Body],
    [ClothingItem.ModernHoodie]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernBlazer]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernJumperJacket]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernDressTop]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernSlimfitJacket]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernLongCoat]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernHoodedJumper]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernJeans]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernSlacks]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernSkirt]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernShorts]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernSweatpants]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernSkinnyJeans]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernSneakers]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernDressShoes]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernBoots]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernSandals]: [BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernLeatherGloves]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.ModernKnitGloves]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.ModernCap]: [BodyPart.Hair],
    [ClothingItem.ModernBeanie]: [BodyPart.Hair],
    [ClothingItem.ModernFedora]: [BodyPart.Hair],
    [ClothingItem.ModernBucketHat]: [BodyPart.Hair],
    [ClothingItem.ModernBackpack]: [BodyPart.Body],
    [ClothingItem.ModernSlingBag]: [BodyPart.LeftHand],
    [ClothingItem.ModernShoulderBag]: [BodyPart.Body],
    [ClothingItem.ModernToteBag]: [BodyPart.LeftHand],
    [ClothingItem.ModernScarf]: [BodyPart.Body],
    [ClothingItem.ModernWatch]: [BodyPart.LeftArm],
    [ClothingItem.ModernNecklace]: [BodyPart.Body],
    [ClothingItem.ModernCasualSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernSuitSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernStreetwearSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernBikerSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernTShirt]: [BodyPart.Body],
    [ClothingItem.ModernSuitJacket]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernLongJumper]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm],
    [ClothingItem.ModernDressBottom]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernJoggerPants]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernHipHopPants]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernSlimfitPants]: [BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg],
    [ClothingItem.ModernSportsGloves]: [BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.ModernHelmet]: [BodyPart.Hair],
    [ClothingItem.ModernMilitaryCap]: [BodyPart.Hair],
    [ClothingItem.ModernShoulderArmor]: [BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.ModernGauntlets]: [BodyPart.LeftArm, BodyPart.RightArm, BodyPart.LeftHand, BodyPart.RightHand],
    [ClothingItem.ModernCape]: [BodyPart.Body, BodyPart.LeftShoulder, BodyPart.RightShoulder],
    [ClothingItem.ModernDetectiveSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
    [ClothingItem.ModernUniformSet]: [BodyPart.Body, BodyPart.LeftArm, BodyPart.RightArm, BodyPart.Pelvis, BodyPart.LeftLeg, BodyPart.RightLeg, BodyPart.LeftFoot, BodyPart.RightFoot],
};

export const APPLY_FULL_OUTFIT_BODY_PARTS = [
    BodyPart.Body,
    BodyPart.LeftArm,
    BodyPart.RightArm,
    BodyPart.Pelvis,
    BodyPart.LeftLeg,
    BodyPart.RightLeg,
    BodyPart.LeftFoot,
    BodyPart.RightFoot,
    BodyPart.LeftHand,
    BodyPart.RightHand,
    BodyPart.LeftShoulder,
    BodyPart.RightShoulder
];

export const APPLY_TOP_BODY_PARTS = [
    BodyPart.Body,
    BodyPart.LeftArm,
    BodyPart.RightArm,
    BodyPart.LeftShoulder,
    BodyPart.RightShoulder
];

export const APPLY_BOTTOM_BODY_PARTS = [
    BodyPart.Pelvis,
    BodyPart.LeftLeg,
    BodyPart.RightLeg,
    BodyPart.LeftFoot,
    BodyPart.RightFoot
];

export const CLOTHING_ITEM_TO_CATEGORY_MAP: Record<ClothingItem, string> = (() => {
    const map: Record<string, string> = {};
    CLOTHING_THEMES.forEach(theme => {
        theme.categories.forEach(category => {
            category.items.forEach(item => {
                map[item] = category.categoryKey;
            });
        });
    });
    return map as Record<ClothingItem, string>;
})();

export const OBJECT_ITEM_TO_CATEGORY_MAP: Record<ObjectItem, string> = (() => {
    const map: Record<string, string> = {};
    OBJECT_THEMES.forEach(theme => {
        theme.categories.forEach(category => {
            category.items.forEach(item => {
                map[item] = category.categoryKey;
            });
        });
    });
    return map as Record<ObjectItem, string>;
})();

export const REF_COLORS = [
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#6366F1', // indigo-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
    '#84CC16', // lime-500
];

export const PALETTE_CATEGORIES: PaletteCategory[] = [
    {
        id: 'basic',
        nameKey: 'palette.category.basic',
        colors: [
            { hex: '#FFFFFF', nameKey: 'palette.color.white' },
            { hex: '#000000', nameKey: 'palette.color.black' },
            { hex: '#808080', nameKey: 'palette.color.gray' },
            { hex: '#FF0000', nameKey: 'palette.color.red' },
            { hex: '#00FF00', nameKey: 'palette.color.green' },
            { hex: '#0000FF', nameKey: 'palette.color.blue' },
            { hex: '#FFFF00', nameKey: 'palette.color.yellow' },
            { hex: '#00FFFF', nameKey: 'palette.color.cyan' },
            { hex: '#FF00FF', nameKey: 'palette.color.magenta' },
        ]
    },
    {
        id: 'skin',
        nameKey: 'palette.category.skin',
        colors: [
            { hex: '#FFDFC4', nameKey: 'palette.color.skin1' },
            { hex: '#F0D5BE', nameKey: 'palette.color.skin2' },
            { hex: '#EECEB3', nameKey: 'palette.color.skin3' },
            { hex: '#EAB38B', nameKey: 'palette.color.skin4' },
            { hex: '#E29E72', nameKey: 'palette.color.skin5' },
            { hex: '#D99164', nameKey: 'palette.color.skin6' },
            { hex: '#CC8454', nameKey: 'palette.color.skin7' },
            { hex: '#C67847', nameKey: 'palette.color.skin8' },
            { hex: '#8D5524', nameKey: 'palette.color.skin9' },
            { hex: '#583E2A', nameKey: 'palette.color.skin10' },
        ]
    },
    {
        id: 'hair',
        nameKey: 'palette.category.hair',
        colors: [
            { hex: '#090806', nameKey: 'palette.color.hair1' },
            { hex: '#2C222B', nameKey: 'palette.color.hair2' },
            { hex: '#71635A', nameKey: 'palette.color.hair3' },
            { hex: '#B7A69E', nameKey: 'palette.color.hair4' },
            { hex: '#D6C4C2', nameKey: 'palette.color.hair5' },
            { hex: '#CABFB1', nameKey: 'palette.color.hair6' },
            { hex: '#DCD0BA', nameKey: 'palette.color.hair7' },
            { hex: '#FFF5E1', nameKey: 'palette.color.hair8' },
            { hex: '#E6CEA8', nameKey: 'palette.color.hair9' },
            { hex: '#A56B46', nameKey: 'palette.color.hair10' },
            { hex: '#91553D', nameKey: 'palette.color.hair11' },
            { hex: '#533D32', nameKey: 'palette.color.hair12' },
        ]
    },
    {
        id: 'pastel',
        nameKey: 'palette.category.pastel',
        colors: [
            { hex: '#FFB3BA', nameKey: 'palette.color.pastelRed' },
            { hex: '#FFDFBA', nameKey: 'palette.color.pastelOrange' },
            { hex: '#FFFFBA', nameKey: 'palette.color.pastelYellow' },
            { hex: '#BAFFC9', nameKey: 'palette.color.pastelGreen' },
            { hex: '#BAE1FF', nameKey: 'palette.color.pastelBlue' },
            { hex: '#E6B3FF', nameKey: 'palette.color.pastelPurple' },
            { hex: '#FFB3E6', nameKey: 'palette.color.pastelPink' },
        ]
    },
    {
        id: 'neon',
        nameKey: 'palette.category.neon',
        colors: [
            { hex: '#FF0055', nameKey: 'palette.color.neonRed' },
            { hex: '#FF9900', nameKey: 'palette.color.neonOrange' },
            { hex: '#CCFF00', nameKey: 'palette.color.neonYellow' },
            { hex: '#00FF66', nameKey: 'palette.color.neonGreen' },
            { hex: '#00FFFF', nameKey: 'palette.color.neonCyan' },
            { hex: '#0066FF', nameKey: 'palette.color.neonBlue' },
            { hex: '#9900FF', nameKey: 'palette.color.neonPurple' },
            { hex: '#FF00CC', nameKey: 'palette.color.neonPink' },
        ]
    }
];

export const ROLE_COLORS = {
    original: '#10B981', // emerald-500 (Green)
    background: '#EF4444', // red-500 (Red)
    pose: '#8B5CF6', // violet-500 (Purple)
    generalRef: '#3B82F6', // blue-500 (Blue)
    costumeRef: '#F59E0B', // amber-500 (Yellow)
    poseRef: '#8B5CF6', // violet-500 (Purple)
};

export const REFERENCE_TYPE_COLORS: Record<string, string> = {
    general: ROLE_COLORS.generalRef,
    costume: ROLE_COLORS.costumeRef,
    pose: ROLE_COLORS.poseRef,
};

// Color Palettes for the palette panel (category/subCategories/palettes structure)
export const COLOR_PALETTES = [
    {
        category: 'mood' as const,
        subCategories: [
            {
                name: 'Warm',
                translationKey: 'colorPalette.subcategory.warm',
                palettes: [
                    { name: 'Sunset', translationKey: 'colorPalette.palette.sunset', colors: ['#FF6B35', '#F7931E', '#FDC830', '#F37335', '#C73E1D'] },
                    { name: 'Autumn', translationKey: 'colorPalette.palette.autumn', colors: ['#8B4513', '#D2691E', '#CD853F', '#DEB887', '#F4A460'] },
                    { name: 'Fire', translationKey: 'colorPalette.palette.fire', colors: ['#FF0000', '#FF4500', '#FF6347', '#FF7F50', '#FFA500'] },
                    { name: 'Desert', translationKey: 'colorPalette.palette.desert', colors: ['#EDC9AF', '#E3A857', '#D2691E', '#CD853F', '#8B4513'] },
                    { name: 'Terracotta', translationKey: 'colorPalette.palette.terracotta', colors: ['#E2725B', '#D4735E', '#C66B5C', '#B8635A', '#AA5B58'] },
                    { name: 'Amber', translationKey: 'colorPalette.palette.amber', colors: ['#FFBF00', '#FF9500', '#FF7F00', '#FF6600', '#FF4500'] },
                    { name: 'Coral', translationKey: 'colorPalette.palette.coral', colors: ['#FF7F50', '#FF6B6B', '#FF5252', '#FF4444', '#FF3333'] },
                    { name: 'Peach', translationKey: 'colorPalette.palette.peach', colors: ['#FFDAB9', '#FFCBA4', '#FFBC8F', '#FFAD7A', '#FF9E65'] },
                    { name: 'Rust', translationKey: 'colorPalette.palette.rust', colors: ['#B7410E', '#A63A0F', '#953310', '#842C11', '#732512'] },
                    { name: 'Copper', translationKey: 'colorPalette.palette.copper', colors: ['#B87333', '#A66729', '#945B1F', '#824F15', '#70430B'] }
                ]
            },
            {
                name: 'Cool',
                translationKey: 'colorPalette.subcategory.cool',
                palettes: [
                    { name: 'Ocean', translationKey: 'colorPalette.palette.ocean', colors: ['#006994', '#0582CA', '#00A6FB', '#0085FF', '#00B4D8'] },
                    { name: 'Winter', translationKey: 'colorPalette.palette.winter', colors: ['#A7C7E7', '#B0E0E6', '#ADD8E6', '#87CEEB', '#4682B4'] },
                    { name: 'Ice', translationKey: 'colorPalette.palette.ice', colors: ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA'] },
                    { name: 'Arctic', translationKey: 'colorPalette.palette.arctic', colors: ['#F0F8FF', '#E6F3FF', '#CCEEFF', '#B3E5FF', '#99DAFF'] },
                    { name: 'Teal', translationKey: 'colorPalette.palette.teal', colors: ['#008080', '#20B2AA', '#48D1CC', '#40E0D0', '#00CED1'] },
                    { name: 'Aqua', translationKey: 'colorPalette.palette.aqua', colors: ['#00FFFF', '#00E5E5', '#00CCCC', '#00B2B2', '#009999'] },
                    { name: 'Navy', translationKey: 'colorPalette.palette.navy', colors: ['#000080', '#000099', '#0000B3', '#0000CC', '#0000E6'] },
                    { name: 'Sapphire', translationKey: 'colorPalette.palette.sapphire', colors: ['#0F52BA', '#1560BD', '#1B6EC2', '#217CC7', '#278ACC'] },
                    { name: 'Turquoise', translationKey: 'colorPalette.palette.turquoise', colors: ['#40E0D0', '#48D1CC', '#00CED1', '#20B2AA', '#008B8B'] },
                    { name: 'Mint', translationKey: 'colorPalette.palette.mint', colors: ['#98FF98', '#90EE90', '#87CEEB', '#7FFFD4', '#76EEC6'] }
                ]
            },
            {
                name: 'Neutral',
                translationKey: 'colorPalette.subcategory.neutral',
                palettes: [
                    { name: 'Earth', translationKey: 'colorPalette.palette.earth', colors: ['#8B7355', '#A0826D', '#C19A6B', '#D2B48C', '#DEB887'] },
                    { name: 'Stone', translationKey: 'colorPalette.palette.stone', colors: ['#696969', '#808080', '#A9A9A9', '#C0C0C0', '#D3D3D3'] },
                    { name: 'Sand', translationKey: 'colorPalette.palette.sand', colors: ['#C2B280', '#E0C097', '#F5DEB3', '#FFE4B5', '#FFEFD5'] },
                    { name: 'Beige', translationKey: 'colorPalette.palette.beige', colors: ['#F5F5DC', '#EEE8AA', '#E6D8AD', '#DCC8A8', '#D2B48C'] },
                    { name: 'Taupe', translationKey: 'colorPalette.palette.taupe', colors: ['#483C32', '#6B5D52', '#8E7F72', '#B1A192', '#D4C3B2'] },
                    { name: 'Charcoal', translationKey: 'colorPalette.palette.charcoal', colors: ['#36454F', '#3B444B', '#404347', '#454243', '#4A413F'] },
                    { name: 'Slate', translationKey: 'colorPalette.palette.slate', colors: ['#708090', '#778899', '#B0C4DE', '#C0D0E0', '#D0E0F0'] },
                    { name: 'Ash', translationKey: 'colorPalette.palette.ash', colors: ['#B2BEB5', '#A8AFA8', '#9EA69B', '#949D8E', '#8A9481'] },
                    { name: 'Cream', translationKey: 'colorPalette.palette.cream', colors: ['#FFFDD0', '#FFF8DC', '#FFF5EE', '#FFF0E6', '#FFEBCD'] },
                    { name: 'Ivory', translationKey: 'colorPalette.palette.ivory', colors: ['#FFFFF0', '#FFFACD', '#FFF8DC', '#FFF5EE', '#FFF0E6'] }
                ]
            },
            {
                name: 'Vibrant',
                translationKey: 'colorPalette.subcategory.vibrant',
                palettes: [
                    { name: 'Rainbow', translationKey: 'colorPalette.palette.rainbow', colors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF'] },
                    { name: 'Tropical', translationKey: 'colorPalette.palette.tropical', colors: ['#FF1493', '#FF6347', '#FFD700', '#00FF7F', '#1E90FF'] },
                    { name: 'Candy', translationKey: 'colorPalette.palette.candy', colors: ['#FF69B4', '#FFB6C1', '#FFC0CB', '#FFE4E1', '#FFF0F5'] },
                    { name: 'Neon Lights', translationKey: 'colorPalette.palette.neonLights', colors: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF0080', '#00FF00'] },
                    { name: 'Electric', translationKey: 'colorPalette.palette.electric', colors: ['#7DF9FF', '#00BFFF', '#1E90FF', '#0000FF', '#4B0082'] },
                    { name: 'Citrus', translationKey: 'colorPalette.palette.citrus', colors: ['#FFA500', '#FFB347', '#FFC125', '#FFD700', '#FFEC8B'] },
                    { name: 'Berry', translationKey: 'colorPalette.palette.berry', colors: ['#8B008B', '#9932CC', '#BA55D3', '#DA70D6', '#EE82EE'] },
                    { name: 'Jewel', translationKey: 'colorPalette.palette.jewel', colors: ['#E0115F', '#9B111E', '#50C878', '#0047AB', '#6A0DAD'] }
                ]
            },
            {
                name: 'Pastel',
                translationKey: 'colorPalette.subcategory.pastel',
                palettes: [
                    { name: 'Spring', translationKey: 'colorPalette.palette.spring', colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF'] },
                    { name: 'Baby', translationKey: 'colorPalette.palette.baby', colors: ['#FFB6C1', '#FFE4E1', '#E6E6FA', '#B0E0E6', '#F0E68C'] },
                    { name: 'Lavender', translationKey: 'colorPalette.palette.lavender', colors: ['#E6E6FA', '#D8BFD8', '#DDA0DD', '#EE82EE', '#DA70D6'] },
                    { name: 'Rose', translationKey: 'colorPalette.palette.rose', colors: ['#FFC0CB', '#FFB6C1', '#FF69B4', '#FF1493', '#C71585'] },
                    { name: 'Lilac', translationKey: 'colorPalette.palette.lilac', colors: ['#C8A2C8', '#B695C0', '#A488B8', '#927BB0', '#806EA8'] },
                    { name: 'Powder', translationKey: 'colorPalette.palette.powder', colors: ['#B0E0E6', '#ADD8E6', '#87CEEB', '#87CEFA', '#6495ED'] }
                ]
            }
        ]
    },
    {
        category: 'weather' as const,
        subCategories: [
            {
                name: 'Sunny',
                translationKey: 'colorPalette.subcategory.sunny',
                palettes: [
                    { name: 'Bright Day', translationKey: 'colorPalette.palette.brightDay', colors: ['#FFD700', '#FFA500', '#FF8C00', '#FF7F50', '#FF6347'] },
                    { name: 'Golden Hour', translationKey: 'colorPalette.palette.goldenHour', colors: ['#FFB347', '#FFA07A', '#FF8C69', '#FF7F50', '#FF6B35'] },
                    { name: 'Summer', translationKey: 'colorPalette.palette.summer', colors: ['#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336'] },
                    { name: 'Sunrise', translationKey: 'colorPalette.palette.sunrise', colors: ['#FF6B6B', '#FF8E53', '#FEB144', '#FDCA40', '#F4E04D'] },
                    { name: 'Noon', translationKey: 'colorPalette.palette.noon', colors: ['#FFFACD', '#FFFFE0', '#FFFAF0', '#FFF8DC', '#FFF5EE'] },
                    { name: 'Warm Breeze', translationKey: 'colorPalette.palette.warmBreeze', colors: ['#FFE4B5', '#FFDEAD', '#FFD8A8', '#FFD29D', '#FFCC92'] }
                ]
            },
            {
                name: 'Rainy',
                translationKey: 'colorPalette.subcategory.rainy',
                palettes: [
                    { name: 'Storm', translationKey: 'colorPalette.palette.storm', colors: ['#2F4F4F', '#36454F', '#414A4C', '#696969', '#778899'] },
                    { name: 'Drizzle', translationKey: 'colorPalette.palette.drizzle', colors: ['#B0C4DE', '#ADD8E6', '#87CEEB', '#87CEFA', '#6495ED'] },
                    { name: 'Thunder', translationKey: 'colorPalette.palette.thunder', colors: ['#191970', '#000080', '#00008B', '#0000CD', '#4169E1'] },
                    { name: 'Monsoon', translationKey: 'colorPalette.palette.monsoon', colors: ['#2C3E50', '#34495E', '#4A5F7F', '#607D8B', '#78909C'] },
                    { name: 'Wet Pavement', translationKey: 'colorPalette.palette.wetPavement', colors: ['#36454F', '#3F4F5F', '#48596F', '#51637F', '#5A6D8F'] },
                    { name: 'Rain Forest', translationKey: 'colorPalette.palette.rainForest', colors: ['#013220', '#014421', '#015622', '#016823', '#017A24'] }
                ]
            },
            {
                name: 'Cloudy',
                translationKey: 'colorPalette.subcategory.cloudy',
                palettes: [
                    { name: 'Overcast', translationKey: 'colorPalette.palette.overcast', colors: ['#D3D3D3', '#C0C0C0', '#B0B0B0', '#A9A9A9', '#808080'] },
                    { name: 'Misty', translationKey: 'colorPalette.palette.misty', colors: ['#F5F5F5', '#E8E8E8', '#DCDCDC', '#D3D3D3', '#C0C0C0'] },
                    { name: 'Fog', translationKey: 'colorPalette.palette.fog', colors: ['#E5E4E2', '#D3D3D3', '#C0C0C0', '#A9A9A9', '#808080'] },
                    { name: 'Haze', translationKey: 'colorPalette.palette.haze', colors: ['#F0EAD6', '#E8DCC4', '#E0CEB2', '#D8C0A0', '#D0B28E'] },
                    { name: 'Dusk', translationKey: 'colorPalette.palette.dusk', colors: ['#B8860B', '#DAA520', '#F0E68C', '#EEE8AA', '#FAFAD2'] },
                    { name: 'Dawn', translationKey: 'colorPalette.palette.dawn', colors: ['#FFB6C1', '#FFC0CB', '#FFD8E4', '#FFE4E1', '#FFF0F5'] }
                ]
            },
            {
                name: 'Snowy',
                translationKey: 'colorPalette.subcategory.snowy',
                palettes: [
                    { name: 'Fresh Snow', translationKey: 'colorPalette.palette.freshSnow', colors: ['#FFFAFA', '#FFF5EE', '#FFF0F5', '#FFFAF0', '#F8F8FF'] },
                    { name: 'Blizzard', translationKey: 'colorPalette.palette.blizzard', colors: ['#F0F8FF', '#E6F3FF', '#CCEEFF', '#B3E5FF', '#99DAFF'] },
                    { name: 'Frost', translationKey: 'colorPalette.palette.frost', colors: ['#E0FFFF', '#D0F0FF', '#C0E0FF', '#B0D0FF', '#A0C0FF'] },
                    { name: 'Ice Crystal', translationKey: 'colorPalette.palette.iceCrystal', colors: ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#26C6DA'] }
                ]
            }
        ]
    },
    {
        category: 'concept' as const,
        subCategories: [
            {
                name: 'Fantasy',
                translationKey: 'colorPalette.subcategory.fantasy',
                palettes: [
                    { name: 'Magic', translationKey: 'colorPalette.palette.magic', colors: ['#9B59B6', '#8E44AD', '#7D3C98', '#6C3483', '#5B2C6F'] },
                    { name: 'Mystical', translationKey: 'colorPalette.palette.mystical', colors: ['#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA', '#9C27B0'] },
                    { name: 'Enchanted', translationKey: 'colorPalette.palette.enchanted', colors: ['#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0'] },
                    { name: 'Dragon', translationKey: 'colorPalette.palette.dragon', colors: ['#8B0000', '#A52A2A', '#B22222', '#DC143C', '#FF0000'] },
                    { name: 'Fairy', translationKey: 'colorPalette.palette.fairy', colors: ['#FFB6C1', '#FFC0CB', '#FFD8E4', '#FFE4E1', '#FFF0F5'] },
                    { name: 'Wizard', translationKey: 'colorPalette.palette.wizard', colors: ['#191970', '#000080', '#00008B', '#0000CD', '#4169E1'] },
                    { name: 'Elf', translationKey: 'colorPalette.palette.elf', colors: ['#228B22', '#32CD32', '#00FF00', '#7FFF00', '#ADFF2F'] },
                    { name: 'Dwarf', translationKey: 'colorPalette.palette.dwarf', colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F4A460'] },
                    { name: 'Unicorn', translationKey: 'colorPalette.palette.unicorn', colors: ['#FF69B4', '#FFB6C1', '#FFC0CB', '#FFE4E1', '#FFF0F5'] },
                    { name: 'Phoenix', translationKey: 'colorPalette.palette.phoenix', colors: ['#FF4500', '#FF6347', '#FF7F50', '#FFA500', '#FFD700'] }
                ]
            },
            {
                name: 'Sci-Fi',
                translationKey: 'colorPalette.subcategory.scifi',
                palettes: [
                    { name: 'Neon', translationKey: 'colorPalette.palette.neon', colors: ['#00FFFF', '#00FF00', '#FF00FF', '#FFFF00', '#FF0080'] },
                    { name: 'Cyber', translationKey: 'colorPalette.palette.cyber', colors: ['#0D1117', '#1F6FEB', '#58A6FF', '#79C0FF', '#A5D6FF'] },
                    { name: 'Hologram', translationKey: 'colorPalette.palette.hologram', colors: ['#00CED1', '#00BFFF', '#1E90FF', '#4169E1', '#0000FF'] },
                    { name: 'Matrix', translationKey: 'colorPalette.palette.matrix', colors: ['#003300', '#004400', '#005500', '#006600', '#007700'] },
                    { name: 'Laser', translationKey: 'colorPalette.palette.laser', colors: ['#FF0000', '#FF3333', '#FF6666', '#FF9999', '#FFCCCC'] },
                    { name: 'Plasma', translationKey: 'colorPalette.palette.plasma', colors: ['#FF00FF', '#FF33FF', '#FF66FF', '#FF99FF', '#FFCCFF'] },
                    { name: 'Circuit', translationKey: 'colorPalette.palette.circuit', colors: ['#00FF00', '#00CC00', '#009900', '#006600', '#003300'] },
                    { name: 'Alien', translationKey: 'colorPalette.palette.alien', colors: ['#7FFF00', '#ADFF2F', '#32CD32', '#00FF00', '#00FA9A'] },
                    { name: 'Space', translationKey: 'colorPalette.palette.space', colors: ['#000000', '#191970', '#000080', '#00008B', '#0000CD'] },
                    { name: 'Robot', translationKey: 'colorPalette.palette.robot', colors: ['#708090', '#778899', '#B0C4DE', '#C0D0E0', '#D0E0F0'] }
                ]
            },
            {
                name: 'Vintage',
                translationKey: 'colorPalette.subcategory.vintage',
                palettes: [
                    { name: 'Sepia', translationKey: 'colorPalette.palette.sepia', colors: ['#704214', '#8B4513', '#A0522D', '#BC8F8F', '#D2B48C'] },
                    { name: 'Retro', translationKey: 'colorPalette.palette.retro', colors: ['#F4A460', '#E9967A', '#FA8072', '#FFA07A', '#FFB6C1'] },
                    { name: 'Classic', translationKey: 'colorPalette.palette.classic', colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F5DEB3'] },
                    { name: 'Victorian', translationKey: 'colorPalette.palette.victorian', colors: ['#800020', '#8B0000', '#A52A2A', '#B22222', '#DC143C'] },
                    { name: 'Art Deco', translationKey: 'colorPalette.palette.artDeco', colors: ['#FFD700', '#FFA500', '#FF8C00', '#FF7F50', '#FF6347'] },
                    { name: '50s', translationKey: 'colorPalette.palette.fifties', colors: ['#FF69B4', '#FFB6C1', '#FFC0CB', '#FFE4E1', '#FFF0F5'] },
                    { name: '60s', translationKey: 'colorPalette.palette.sixties', colors: ['#FF6347', '#FF7F50', '#FFA500', '#FFD700', '#FFFF00'] },
                    { name: '70s', translationKey: 'colorPalette.palette.seventies', colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F4A460'] },
                    { name: '80s', translationKey: 'colorPalette.palette.eighties', colors: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF0080', '#00FF00'] },
                    { name: 'Antique', translationKey: 'colorPalette.palette.antique', colors: ['#8B7355', '#A0826D', '#C19A6B', '#D2B48C', '#DEB887'] }
                ]
            },
            {
                name: 'Nature',
                translationKey: 'colorPalette.subcategory.nature',
                palettes: [
                    { name: 'Forest', translationKey: 'colorPalette.palette.forest', colors: ['#013220', '#014421', '#015622', '#016823', '#017A24'] },
                    { name: 'Jungle', translationKey: 'colorPalette.palette.jungle', colors: ['#228B22', '#32CD32', '#00FF00', '#7FFF00', '#ADFF2F'] },
                    { name: 'Mountain', translationKey: 'colorPalette.palette.mountain', colors: ['#696969', '#808080', '#A9A9A9', '#C0C0C0', '#D3D3D3'] },
                    { name: 'River', translationKey: 'colorPalette.palette.river', colors: ['#4682B4', '#5F9EA0', '#6495ED', '#87CEEB', '#87CEFA'] },
                    { name: 'Meadow', translationKey: 'colorPalette.palette.meadow', colors: ['#9ACD32', '#ADFF2F', '#7FFF00', '#7CFC00', '#00FF00'] },
                    { name: 'Savanna', translationKey: 'colorPalette.palette.savanna', colors: ['#F4A460', '#DEB887', '#D2B48C', '#BC8F8F', '#A0826D'] },
                    { name: 'Tundra', translationKey: 'colorPalette.palette.tundra', colors: ['#F0F8FF', '#E6F3FF', '#CCEEFF', '#B3E5FF', '#99DAFF'] },
                    { name: 'Volcano', translationKey: 'colorPalette.palette.volcano', colors: ['#8B0000', '#A52A2A', '#B22222', '#DC143C', '#FF0000'] }
                ]
            },
            {
                name: 'Urban',
                translationKey: 'colorPalette.subcategory.urban',
                palettes: [
                    { name: 'City Lights', translationKey: 'colorPalette.palette.cityLights', colors: ['#FFD700', '#FFA500', '#FF8C00', '#FF7F50', '#FF6347'] },
                    { name: 'Concrete', translationKey: 'colorPalette.palette.concrete', colors: ['#696969', '#808080', '#A9A9A9', '#C0C0C0', '#D3D3D3'] },
                    { name: 'Graffiti', translationKey: 'colorPalette.palette.graffiti', colors: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF0080', '#00FF00'] },
                    { name: 'Subway', translationKey: 'colorPalette.palette.subway', colors: ['#2F4F4F', '#36454F', '#414A4C', '#696969', '#778899'] },
                    { name: 'Neon Signs', translationKey: 'colorPalette.palette.neonSigns', colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#FFC0CB', '#FFE4E1'] },
                    { name: 'Industrial', translationKey: 'colorPalette.palette.industrial', colors: ['#708090', '#778899', '#B0C4DE', '#C0D0E0', '#D0E0F0'] }
                ]
            }
        ]
    }
];