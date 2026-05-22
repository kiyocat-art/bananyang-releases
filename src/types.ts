
import { FunctionCall } from "@google/genai";

export enum CameraAngle {
  Front = 'Front',
  FrontLeft = 'FrontLeft',
  FrontRight = 'FrontRight',
  Left = 'Left',
  Right = 'Right',
  Back = 'Back',
  BackLeft = 'BackLeft',
  BackRight = 'BackRight',
}

export enum CameraSize {
  Full = 'Full',
}

// Camera Angle Presets
export type CameraAnglePreset =
  | 'eyeLevel' | 'highAngle' | 'lowAngle'
  | 'birdsEye' | 'wormsEye' | 'dutchAngle' | 'overTheShoulder';

// Lens & Focus Presets
export type LensFocusPreset =
  | 'deepFocus' | 'shallowFocus' | 'rackFocus'
  | 'fisheyeLens' | 'telephotoLens' | 'wideAngleLens';

// Shot Size Presets
export type ShotSizePreset =
  | 'extremeLongShot' | 'longShot' | 'fullShot' | 'kneeShot'
  | 'waistShot' | 'bustShot' | 'closeUp' | 'extremeCloseUp';

export type SelectedView = {
  yaw: number;
  pitch: number;
  fov: number;
  size: CameraSize;
  focalLength: number; // 14mm - 200mm
  cameraAnglePreset: CameraAnglePreset | null;
  lensFocusPreset: LensFocusPreset | null;
  shotSizePreset: ShotSizePreset | null;
}

export enum BodyPart {
  Face = 'Face',
  Hair = 'Hair',
  Body = 'Body',
  LeftShoulder = 'LeftShoulder',
  RightShoulder = 'RightShoulder',
  LeftArm = 'LeftArm',
  RightArm = 'RightArm',
  BothArms = 'BothArms',
  Pelvis = 'Pelvis',
  LeftLeg = 'LeftLeg',
  RightLeg = 'RightLeg',
  BothLegs = 'BothLegs',
  LeftHand = 'LeftHand',
  RightHand = 'RightHand',
  BothHands = 'BothHands',
  LeftFoot = 'LeftFoot',
  RightFoot = 'RightFoot',
  BothFeet = 'BothFeet',
}

export enum ClothingItem {
  // Modern
  ModernTShirt = 'ModernTShirt',
  ModernShirt = 'ModernShirt',
  ModernHoodie = 'ModernHoodie',
  ModernSuitJacket = 'ModernSuitJacket',
  ModernDressTop = 'ModernDressTop',
  ModernSlimfitJacket = 'ModernSlimfitJacket',
  ModernJumperJacket = 'ModernJumperJacket',
  ModernLongJumper = 'ModernLongJumper',
  ModernBlazer = 'ModernBlazer',
  ModernLongCoat = 'ModernLongCoat',
  ModernHoodedJumper = 'ModernHoodedJumper',
  ModernJeans = 'ModernJeans',
  ModernSlacks = 'ModernSlacks',
  ModernSweatpants = 'ModernSweatpants',
  ModernShorts = 'ModernShorts',
  ModernSkirt = 'ModernSkirt',
  ModernDressBottom = 'ModernDressBottom',
  ModernJoggerPants = 'ModernJoggerPants',
  ModernHipHopPants = 'ModernHipHopPants',
  ModernSkinnyJeans = 'ModernSkinnyJeans',
  ModernSlimfitPants = 'ModernSlimfitPants',
  ModernSneakers = 'ModernSneakers',
  ModernDressShoes = 'ModernDressShoes',
  ModernSandals = 'ModernSandals',
  ModernBoots = 'ModernBoots',
  ModernLeatherGloves = 'ModernLeatherGloves',
  ModernSportsGloves = 'ModernSportsGloves',
  ModernKnitGloves = 'ModernKnitGloves',
  ModernCap = 'ModernCap',
  ModernBeanie = 'ModernBeanie',
  ModernFedora = 'ModernFedora',
  ModernBucketHat = 'ModernBucketHat',
  ModernHelmet = 'ModernHelmet',
  ModernMilitaryCap = 'ModernMilitaryCap',
  ModernBackpack = 'ModernBackpack',
  ModernSlingBag = 'ModernSlingBag',
  ModernShoulderBag = 'ModernShoulderBag',
  ModernToteBag = 'ModernToteBag',
  ModernWatch = 'ModernWatch',
  ModernNecklace = 'ModernNecklace',
  ModernScarf = 'ModernScarf',
  ModernShoulderArmor = 'ModernShoulderArmor',
  ModernGauntlets = 'ModernGauntlets',
  ModernCape = 'ModernCape',
  ModernCasualSet = 'ModernCasualSet',
  ModernSuitSet = 'ModernSuitSet',
  ModernUniformSet = 'ModernUniformSet',
  ModernStreetwearSet = 'ModernStreetwearSet',
  ModernBikerSet = 'ModernBikerSet',
  ModernDetectiveSet = 'ModernDetectiveSet',

  // Sci-Fi
  SciFiCyberneticJacket = 'SciFiCyberneticJacket',
  SciFiHolographicTop = 'SciFiHolographicTop',
  SciFiLightArmorChest = 'SciFiLightArmorChest',
  SciFiBioSuitTop = 'SciFiBioSuitTop',
  SciFiSpaceSuitTorso = 'SciFiSpaceSuitTorso',
  SciFiNeonTrenchcoat = 'SciFiNeonTrenchcoat',
  SciFiArmoredPants = 'SciFiArmoredPants',
  SciFiEnergyLeggings = 'SciFiEnergyLeggings',
  SciFiZeroGravityTrousers = 'SciFiZeroGravityTrousers',
  SciFiCyberpunkSkirt = 'SciFiCyberpunkSkirt',
  SciFiBioSuitBottom = 'SciFiBioSuitBottom',
  SciFiExoskeletonLegs = 'SciFiExoskeletonLegs',
  SciFiMagneticBoots = 'SciFiMagneticBoots',
  SciFiHoverBoots = 'SciFiHoverBoots',
  SciFiCyberneticGreaves = 'SciFiCyberneticGreaves',
  SciFiEnergySandals = 'SciFiEnergySandals',
  SciFiLightweightPlatingBoots = 'SciFiLightweightPlatingBoots',
  SciFiDataGloves = 'SciFiDataGloves',
  SciFiPowerGauntlets = 'SciFiPowerGauntlets',
  SciFiNanoGloves = 'SciFiNanoGloves',
  SciFiRoboticHands = 'SciFiRoboticHands',
  SciFiCyberneticForearms = 'SciFiCyberneticForearms',
  SciFiVisorHelmet = 'SciFiVisorHelmet',
  SciFiNeuroLinkHeadset = 'SciFiNeuroLinkHeadset',
  SciFiHolographicHood = 'SciFiHolographicHood',
  SciFiBreathingMask = 'SciFiBreathingMask',
  SciFiCombatHelmet = 'SciFiCombatHelmet',
  SciFiDataVisor = 'SciFiDataVisor',
  SciFiGravityPouch = 'SciFiGravityPouch',
  SciFiTechBackpack = 'SciFiTechBackpack',
  SciFiEnergyCellHolster = 'SciFiEnergyCellHolster',
  SciFiUtilityBelt = 'SciFiUtilityBelt',
  SciFiShoulderMountedDrone = 'SciFiShoulderMountedDrone',
  SciFiFloatingPauldrons = 'SciFiFloatingPauldrons',
  SciFiEnergyShieldEmitter = 'SciFiEnergyShieldEmitter',
  SciFiPlasmaCables = 'SciFiPlasmaCables',
  SciFiPilotSuitSet = 'SciFiPilotSuitSet',
  SciFiCyborgEnforcerSet = 'SciFiCyborgEnforcerSet',
  SciFiExplorerSuitSet = 'SciFiExplorerSuitSet',
  SciFiStealthOpsSet = 'SciFiStealthOpsSet',

  // Medieval Fantasy
  FantasyChainmailCoif = 'FantasyChainmailCoif',
  FantasyLeatherHood = 'FantasyLeatherHood',
  FantasyCirclet = 'FantasyCirclet',
  FantasyCrown = 'FantasyCrown',
  FantasySteelHelmet = 'FantasySteelHelmet',
  FantasyPlateArmorChest = 'FantasyPlateArmorChest',
  FantasyLeatherJerkin = 'FantasyLeatherJerkin',
  FantasyMageRobesTop = 'FantasyMageRobesTop',
  FantasyChainmailShirt = 'FantasyChainmailShirt',
  FantasyTunic = 'FantasyTunic',
  FantasyElvenRobe = 'FantasyElvenRobe',
  FantasyDwarvenArmor = 'FantasyDwarvenArmor',
  FantasyPlatePauldrons = 'FantasyPlatePauldrons',
  FantasyLeatherShoulderPads = 'FantasyLeatherShoulderPads',
  FantasyMagePauldrons = 'FantasyMagePauldrons',
  FantasyFurMantle = 'FantasyFurMantle',
  FantasyPlateGauntlets = 'FantasyPlateGauntlets',
  FantasyLeatherBracers = 'FantasyLeatherBracers',
  FantasyMageGloves = 'FantasyMageGloves',
  FantasyPlateGreaves = 'FantasyPlateGreaves',
  FantasyLeatherPants = 'FantasyLeatherPants',
  FantasyMageRobesBottom = 'FantasyMageRobesBottom',
  FantasyChainmailLeggings = 'FantasyChainmailLeggings',
  FantasyTrousers = 'FantasyTrousers',
  FantasyKilt = 'FantasyKilt',
  FantasyPlateSabatons = 'FantasyPlateSabatons',
  FantasyLeatherBoots = 'FantasyLeatherBoots',
  FantasyMageSandals = 'FantasyMageSandals',
  FantasyElvenBoots = 'FantasyElvenBoots',
  FantasyTravelersCloak = 'FantasyTravelersCloak',
  FantasyRoyalCape = 'FantasyRoyalCape',
  FantasyAdventurerBelt = 'FantasyAdventurerBelt',
  FantasyPotionBelt = 'FantasyPotionBelt',
  FantasyKnightSet = 'FantasyKnightSet',
  FantasyRogueSet = 'FantasyRogueSet',
  FantasyWizardSet = 'FantasyWizardSet',
  FantasyRangerSet = 'FantasyRangerSet',
  FantasyKingSet = 'FantasyKingSet',
}

export enum ObjectItem {
  // Modern Weapons
  ModernWeaponPistol = 'ModernWeaponPistol',
  ModernWeaponRifle = 'ModernWeaponRifle',
  ModernWeaponShotgun = 'ModernWeaponShotgun',
  ModernWeaponKnife = 'ModernWeaponKnife',
  ModernWeaponBaseballBat = 'ModernWeaponBaseballBat',
  ModernWeaponSubmachineGun = 'ModernWeaponSubmachineGun',
  ModernWeaponSniperRifle = 'ModernWeaponSniperRifle',
  ModernWeaponRevolver = 'ModernWeaponRevolver',
  ModernWeaponCombatKnife = 'ModernWeaponCombatKnife',
  ModernWeaponKatana = 'ModernWeaponKatana',
  ModernWeaponSaber = 'ModernWeaponSaber',
  ModernWeaponLongsword = 'ModernWeaponLongsword',
  ModernWeaponMachete = 'ModernWeaponMachete',
  ModernWeaponTaser = 'ModernWeaponTaser',
  ModernWeaponPepperSpray = 'ModernWeaponPepperSpray',
  ModernWeaponCrossbow = 'ModernWeaponCrossbow',
  ModernWeaponBoxingGloves = 'ModernWeaponBoxingGloves',
  ModernWeaponBrassKnuckles = 'ModernWeaponBrassKnuckles',
  ModernWeaponBaton = 'ModernWeaponBaton',
  // Modern Items
  ModernItemSmartphone = 'ModernItemSmartphone',
  ModernItemLaptop = 'ModernItemLaptop',
  ModernItemHeadphones = 'ModernItemHeadphones',
  ModernItemEnergyDrink = 'ModernItemEnergyDrink',
  ModernItemMedkit = 'ModernItemMedkit',
  ModernItemDrone = 'ModernItemDrone',
  ModernItemCoffeeMug = 'ModernItemCoffeeMug',
  ModernItemBriefcase = 'ModernItemBriefcase',
  ModernItemLighter = 'ModernItemLighter',
  ModernItemWalkieTalkie = 'ModernItemWalkieTalkie',
  ModernItemFlashlight = 'ModernItemFlashlight',
  ModernItemHandcuffs = 'ModernItemHandcuffs',
  ModernItemBinoculars = 'ModernItemBinoculars',
  ModernItemCamera = 'ModernItemCamera',
  ModernItemTablet = 'ModernItemTablet',
  // Modern Defense
  ModernDefenseKevlarVest = 'ModernDefenseKevlarVest',
  ModernDefenseBallisticShield = 'ModernDefenseBallisticShield',
  ModernDefenseRiotShield = 'ModernDefenseRiotShield',
  ModernDefenseTacticalHelmet = 'ModernDefenseTacticalHelmet',
  ModernDefenseGasMask = 'ModernDefenseGasMask',
  ModernDefenseTacticalVest = 'ModernDefenseTacticalVest',
  ModernDefenseBulletproofSunglasses = 'ModernDefenseBulletproofSunglasses',
  ModernDefenseKneePads = 'ModernDefenseKneePads',
  ModernDefenseElbowPads = 'ModernDefenseElbowPads',

  // Sci-Fi Weapons
  SciFiWeaponPlasmaRifle = 'SciFiWeaponPlasmaRifle',
  SciFiWeaponLaserPistol = 'SciFiWeaponLaserPistol',
  SciFiWeaponEnergySword = 'SciFiWeaponEnergySword',
  SciFiWeaponRailgun = 'SciFiWeaponRailgun',
  SciFiWeaponPulseCannon = 'SciFiWeaponPulseCannon',
  SciFiWeaponGaussRifle = 'SciFiWeaponGaussRifle',
  SciFiWeaponSonicPistol = 'SciFiWeaponSonicPistol',
  SciFiWeaponLaserKatana = 'SciFiWeaponLaserKatana',
  SciFiWeaponEMPGrenade = 'SciFiWeaponEMPGrenade',
  SciFiWeaponSmartGrenade = 'SciFiWeaponSmartGrenade',
  SciFiWeaponHeavyPlasmaCannon = 'SciFiWeaponHeavyPlasmaCannon',
  SciFiWeaponCryoGun = 'SciFiWeaponCryoGun',
  SciFiWeaponParticleBeamRifle = 'SciFiWeaponParticleBeamRifle',
  SciFiWeaponGravityGun = 'SciFiWeaponGravityGun',
  SciFiWeaponTeslaCannon = 'SciFiWeaponTeslaCannon',
  SciFiWeaponPlasmaBlade = 'SciFiWeaponPlasmaBlade',
  SciFiWeaponPhaseRifle = 'SciFiWeaponPhaseRifle',
  SciFiWeaponNanoSwarmGrenade = 'SciFiWeaponNanoSwarmGrenade',
  // Sci-Fi Items
  SciFiItemMedibot = 'SciFiItemMedibot',
  SciFiItemHolographicProjector = 'SciFiItemHolographicProjector',
  SciFiItemAntiGravityDevice = 'SciFiItemAntiGravityDevice',
  SciFiItemPersonalDrone = 'SciFiItemPersonalDrone',
  SciFiItemDataPad = 'SciFiItemDataPad',
  SciFiItemTeleporter = 'SciFiItemTeleporter',
  SciFiItemScanner = 'SciFiItemScanner',
  SciFiItemNanoMedInjector = 'SciFiItemNanoMedInjector',
  SciFiItemGravBoots = 'SciFiItemGravBoots',
  // Sci-Fi Defense
  SciFiDefenseEnergyShield = 'SciFiDefenseEnergyShield',
  SciFiDefenseLightCompositeArmor = 'SciFiDefenseLightCompositeArmor',
  SciFiDefenseExoFrame = 'SciFiDefenseExoFrame',
  SciFiDefenseStealthCloak = 'SciFiDefenseStealthCloak',
  SciFiDefenseNanoShield = 'SciFiDefenseNanoShield',
  SciFiDefenseForceFieldGenerator = 'SciFiDefenseForceFieldGenerator',
  SciFiDefenseHoloDecoy = 'SciFiDefenseHoloDecoy',
  // Sci-Fi Robots
  SciFiRobotAndroid = 'SciFiRobotAndroid',
  SciFiRobotSecurityDrone = 'SciFiRobotSecurityDrone',
  SciFiRobotAssaultMech = 'SciFiRobotAssaultMech',
  SciFiRobotUtilityBot = 'SciFiRobotUtilityBot',
  SciFiRobotCyberneticAnimal = 'SciFiRobotCyberneticAnimal',

  // Medieval Fantasy Weapons - Swords
  FantasyWeaponLongsword = 'FantasyWeaponLongsword',
  FantasyWeaponBroadsword = 'FantasyWeaponBroadsword',
  FantasyWeaponDagger = 'FantasyWeaponDagger',
  FantasyWeaponGreatsword = 'FantasyWeaponGreatsword',
  FantasyWeaponRapier = 'FantasyWeaponRapier',
  FantasyWeaponScimitar = 'FantasyWeaponScimitar',
  FantasyWeaponFlamberge = 'FantasyWeaponFlamberge',
  FantasyWeaponClaymore = 'FantasyWeaponClaymore',
  // Medieval Fantasy Weapons - Axes & Hammers
  FantasyWeaponBattleAxe = 'FantasyWeaponBattleAxe',
  FantasyWeaponWarhammer = 'FantasyWeaponWarhammer',
  FantasyWeaponMace = 'FantasyWeaponMace',
  FantasyWeaponMorningStar = 'FantasyWeaponMorningStar',
  FantasyWeaponFlail = 'FantasyWeaponFlail',
  FantasyWeaponWarAxe = 'FantasyWeaponWarAxe',
  // Medieval Fantasy Weapons - Polearms
  FantasyWeaponSpear = 'FantasyWeaponSpear',
  FantasyWeaponHalberd = 'FantasyWeaponHalberd',
  FantasyWeaponLance = 'FantasyWeaponLance',
  FantasyWeaponPike = 'FantasyWeaponPike',
  FantasyWeaponTrident = 'FantasyWeaponTrident',
  FantasyWeaponGlaive = 'FantasyWeaponGlaive',
  // Medieval Fantasy Weapons - Ranged
  FantasyWeaponLongbow = 'FantasyWeaponLongbow',
  FantasyWeaponCrossbow = 'FantasyWeaponCrossbow',
  FantasyWeaponShortbow = 'FantasyWeaponShortbow',
  FantasyWeaponCompositeBow = 'FantasyWeaponCompositeBow',
  FantasyWeaponSling = 'FantasyWeaponSling',
  FantasyWeaponThrowingKnife = 'FantasyWeaponThrowingKnife',
  // Medieval Fantasy Weapons - Magic
  FantasyWeaponMagicStaff = 'FantasyWeaponMagicStaff',
  FantasyWeaponMagicWand = 'FantasyWeaponMagicWand',
  FantasyWeaponMagicOrb = 'FantasyWeaponMagicOrb',
  FantasyWeaponRuneBlade = 'FantasyWeaponRuneBlade',
  // Medieval Fantasy Defense - Shields
  FantasyDefenseKiteShield = 'FantasyDefenseKiteShield',
  FantasyDefenseRoundShield = 'FantasyDefenseRoundShield',
  FantasyDefenseTowerShield = 'FantasyDefenseTowerShield',
  FantasyDefenseBuckler = 'FantasyDefenseBuckler',
  FantasyDefenseHeaterShield = 'FantasyDefenseHeaterShield',
  // Medieval Fantasy Defense - Armor
  FantasyDefensePlateArmor = 'FantasyDefensePlateArmor',
  FantasyDefenseChainmail = 'FantasyDefenseChainmail',
  FantasyDefenseLeatherArmor = 'FantasyDefenseLeatherArmor',
  FantasyDefenseScaleArmor = 'FantasyDefenseScaleArmor',
  FantasyDefenseGreatHelm = 'FantasyDefenseGreatHelm',
  FantasyDefenseBarbuteHelm = 'FantasyDefenseBarbuteHelm',
  // Medieval Fantasy Items
  FantasyItemHealthPotion = 'FantasyItemHealthPotion',
  FantasyItemManaPotion = 'FantasyItemManaPotion',
  FantasyItemSpellbook = 'FantasyItemSpellbook',
  FantasyItemAncientScroll = 'FantasyItemAncientScroll',
  FantasyItemTreasureChest = 'FantasyItemTreasureChest',
  FantasyItemTorch = 'FantasyItemTorch',
  FantasyItemMagicCrystal = 'FantasyItemMagicCrystal',
  FantasyItemRing = 'FantasyItemRing',
  FantasyItemAmulet = 'FantasyItemAmulet',
  FantasyItemGoblet = 'FantasyItemGoblet',
  // Medieval Fantasy Creatures
  FantasyCreatureDragon = 'FantasyCreatureDragon',
  FantasyCreatureGoblin = 'FantasyCreatureGoblin',
  FantasyCreatureOrc = 'FantasyCreatureOrc',
  FantasyCreatureGriffin = 'FantasyCreatureGriffin',
  FantasyCreatureUnicorn = 'FantasyCreatureUnicorn',

  // Ancient Era Weapons (고대)
  AncientWeaponGladius = 'AncientWeaponGladius',
  AncientWeaponKhopesh = 'AncientWeaponKhopesh',
  AncientWeaponXiphos = 'AncientWeaponXiphos',
  AncientWeaponPilum = 'AncientWeaponPilum',
  AncientWeaponSarissa = 'AncientWeaponSarissa',
  // Ancient Era Defense (고대)
  AncientDefenseScutum = 'AncientDefenseScutum',
  AncientDefenseAspis = 'AncientDefenseAspis',
  AncientDefenseLorica = 'AncientDefenseLorica',
  AncientDefenseGaleaHelm = 'AncientDefenseGaleaHelm',

  // Eastern Weapons (동양)
  EasternWeaponKatana = 'EasternWeaponKatana',
  EasternWeaponWakizashi = 'EasternWeaponWakizashi',
  EasternWeaponNodachi = 'EasternWeaponNodachi',
  EasternWeaponNaginata = 'EasternWeaponNaginata',
  EasternWeaponYari = 'EasternWeaponYari',
  EasternWeaponKusarigama = 'EasternWeaponKusarigama',
  EasternWeaponShuriken = 'EasternWeaponShuriken',
  EasternWeaponNunchaku = 'EasternWeaponNunchaku',
  EasternWeaponBo = 'EasternWeaponBo',
  EasternWeaponJian = 'EasternWeaponJian',
  EasternWeaponDao = 'EasternWeaponDao',
  EasternWeaponGuandao = 'EasternWeaponGuandao',
  // Eastern Defense (동양)
  EasternDefenseSamuraiArmor = 'EasternDefenseSamuraiArmor',
  EasternDefenseKabutoHelm = 'EasternDefenseKabutoHelm',
  EasternDefenseChineseLamellar = 'EasternDefenseChineseLamellar',
}

export interface GenerationParams {
  customPrompt: string;
  bodyPartReferenceMap: Partial<Record<BodyPart, number>>;
  selectedClothingItems: ClothingItem[];
  selectedObjectItems: ObjectItem[];
  selectedActionPose: ActionPose | null;
  aiEditAction?: AiAction;
  variationCreativity?: number;
  autoColoringIntensity?: number;
  gridLayout?: GridLayout | null;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  pbrMapTypes?: string[];
  // Camera settings
  cameraView?: SelectedView | null;
  camera3DControl?: {
    yaw: number;
    pitch: number;
    fov: number;
    size: CameraSize;
  };
  // Concept tab settings
  synthesisControlMode?: 'original' | 'reference';
  originalPreservationLevel?: number;
  costumeCreativityLevel?: number;
  // Lighting settings
  lightDirection?: { yaw: number; pitch: number };
  lightIntensity?: number;
  // Model info
  modelName?: ModelName;
  // Grounding tools used during generation
  groundingTools?: GroundingTool[];
}

export interface GeneratedMedia {
  id: string;
  type: 'image' | 'video';
  src: string;
  view: SelectedView | null;
  generationParams?: GenerationParams;
  originalFile?: File;
  originalFilePath?: string;
  isGenerated?: boolean;
  generatedBy?: 'vertex' | 'apiKey' | 'openai' | 'flux';
  // Pre-calculated optimization data (ownership transferred to canvasStore)
  file?: File;
  tinySrc?: string;
  tinyFile?: File;
  proxySrc?: string;
  proxyFile?: File;
  originalSrc?: string;
  thumbnailSrc?: string;
  originalDimensions?: { width: number; height: number };
  highResSrc?: string;
  highResDimensions?: { width: number; height: number };
  sourceImageId?: string;
  maskSrc?: string;
  maskFile?: File;
  maskFilePath?: string;
}

export interface GenerationBatch {
  id: string;
  timestamp: Date;
  media: GeneratedMedia[];
}

export enum ActionPose {
  General = 'General',
  Attack = 'Attack',
  StandingModel = 'StandingModel',
}

export type ColorPalette = {
  id?: string;
  name: string;
  colors: string[];
  translationKey?: string;
  isCustom?: boolean;
};

export type PaletteColor = {
  hex: string;
  nameKey: string;
};

export type PaletteCategory = {
  id: string;
  nameKey: string;
  colors: PaletteColor[];
};

export type LightType = 'omni' | 'direct' | 'sun' | 'ambient' | 'rim' | 'area' | 'gobo' | 'practical';

export interface LightSource {
  id: string;
  type: LightType;
  color: string;
  intensity: number; // 0-100
  position: { x: number; y: number }; // Normalized 0-1 relative to image
  direction?: number; // degrees for directional light
  // Advanced properties (all optional for backwards compatibility)
  colorTemperature?: number;  // -100(cool/blue) ~ +100(warm/yellow), default 0
  radius?: number;            // 0-100, light spread/falloff radius, default 50
  specularIntensity?: number; // 0-100, specular highlight strength, default 30
  shadowSoftness?: number;    // 0-100, shadow edge softness, default 50
  affectedArea?: 'full' | 'foreground' | 'background'; // default 'full'
  atmosphericEffect?: 'none' | 'volumetric' | 'god_rays' | 'haze'; // default 'none'
}

export type AiAction =
  | 'removeBackground'
  | 'keepBackgroundOnly'
  | 'extractPose'
  | 'extractOutfit'
  | 'autoColoring'
  | 'variation'
  | 'insertObject'
  | 'expand'
  | 'pbr'
  | 'pbr_advanced'
  | 'relight'
  | 'inpainting'
  | 'inpaintInsert'
  | 'inpaintRemove';

export type ObjectInteractionType = 'place' | 'hold' | 'wear' | 'add_character';
export type InpaintWorkType = 'clothing' | 'characterEdit' | 'backgroundFill';

export interface ObjectTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface GenerationTask {
  id: string;
  taskType: 'image';
  originalImage: File | null;
  sourceImageId?: string;
  sourceImageDisplaySize?: { width: number; height: number };
  customPrompt: string;
  textureImages: { file: File, referenceType?: 'general' | 'costume' | 'pose' }[];
  backgroundImage: File | null;
  backgroundImageAspectRatio: string | null;
  poseControlImage: File | null;
  /** true = poseControlImage가 사용자가 직접 그린 스케치 */
  isPoseSketch?: boolean;
  cameraView: SelectedView | null;
  bodyPartReferenceMap: Partial<Record<BodyPart, number>>;
  selectedClothingItems: ClothingItem[];
  selectedObjectItems: ObjectItem[];
  selectedActionPose: ActionPose | null;
  useAposeForViews: boolean;
  isApplyingFullOutfit: boolean;
  isApplyingTop: boolean;
  isApplyingBottom: boolean;
  lightDirection: { yaw: number; pitch: number; } | null;
  lightIntensity: number | null;
  maskImage: File | null;
  selectedPalette: ColorPalette | null;
  numPaletteColors: number;
  isAutoColorizeSketch: boolean;
  aiEditAction?: AiAction;
  variationCreativity?: number;
  autoColoringIntensity?: number;
  combinedAutoColoringIntensity?: number;  // variation + autoColoring 결합 모드
  gridLayout?: GridLayout | null;
  objectToInsert?: { file: File; transform: ObjectTransform; prompt: string; };
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  modelName?: ModelName;
  costumeCreativityLevel?: number;
  synthesisControlMode?: 'original' | 'reference';
  originalPreservationLevel?: number;
  costumeBodyType?: 'slim' | 'average' | 'muscular' | 'curvy';
  costumeGender?: 'male' | 'female' | 'androgynous';
  // PBR Advanced
  pbrStructureImage?: File | null;
  pbrFrontImage?: File | null;
  pbrBackImage?: File | null;
  pbrMapTypes?: string[];
  // Inpainting
  referenceImages?: { file?: File; src?: string; role?: 'poseRef' | 'costumeRef' | 'generalRef' }[];
  objectInteractionType?: ObjectInteractionType;
  inpaintWorkType?: InpaintWorkType;
  maskFeatherRadius?: number;
  contextPaddingRatio?: number;
  toneMatch?: boolean;
  inpaintMode?: 'insert' | 'remove';
  /** Variation strength 0.0-1.0 — influences prompt when user customPrompt is empty. */
  variationStrength?: number;
  /** Scene Analyzer result. When present, prompt builder injects anatomy/scene-aware constraints. */
  sceneContext?: import('./services/sceneContextService').SceneContext | null;
  /** Toggle flags from Scene Analyzer panel — drives prompt section inclusion. */
  anatomyConstraintsEnabled?: boolean;
  sceneAwareEnabled?: boolean;
  // Thumbnail for queue display
  thumbnailDataUrl?: string;
  // Thinking & Grounding (Phase 3)
  thinkingLevel?: ThinkingLevel | null;
  groundingTools?: GroundingTool[];
  // Flux-specific options
  fluxOptions?: { resolutionMP: FluxResolutionMP; promptUpsampling: boolean };
  // OpenAI-specific options
  openAIOptions?: { quality: OpenAIQuality };
}

export interface MonthlyCredit {
  current: number;
  total: number;
  month: string;
}

export interface BoardGroup {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageIds: string[];
  zIndex: number;
}

export interface BoardImage {
  id: string;
  src: string;                    // Canvas display URL (max 2k)
  file?: File;                    // Canvas display file (max 2k) - Optional for memory effciency
  filePath?: string;              // Local file path for display image

  originalSrc?: string;           // Original URL for download (if resized)
  originalFile?: File;            // Original file for download (if resized)
  originalFilePath?: string;      // Local file path for original image

  x: number;
  y: number;
  width: number;
  height: number;
  role: 'none' | 'original' | 'background' | 'reference' | 'pose' | 'generalRef' | 'costumeRef' | 'poseRef';
  refIndex?: number;
  zIndex: number;
  groupId?: string;
  maskFile?: File;
  maskSrc?: string;
  generationParams?: GenerationParams;
  thumbnailSrc?: string;
  styleIntensity?: number;
  isGenerated?: boolean;          // Whether this is an AI-generated image
  originalDimensions?: {          // Original image dimensions (before resizing)
    width: number;
    height: number;
  };
  /** @deprecated Use role instead (generalRef, costumeRef, poseRef) */
  referenceType?: 'general' | 'costume' | 'pose';
  scaleX?: number;

  // Tiling and LOD properties
  proxySrc?: string;      // Alias for src (1k resized)
  proxyFile?: File;       // Alias for file (1k resized)
  proxyFilePath?: string; // Local file path for proxy image

  tinySrc?: string;       // Tiny proxy (128px) for placeholder
  tinyFile?: File;        // Tiny proxy file (128px)
  tinyFilePath?: string;  // Local file path for tiny proxy image

  previewSrc?: string;    // Preview (1K, 1024px) - default texture for all zoom levels
  previewFile?: File;     // Preview file (1K, 1024px)
  previewFilePath?: string; // Local file path for preview image

  highResSrc?: string;
  highResDimensions?: { width: number; height: number };
  ktx2Src?: string;  // KTX2 compressed texture URL (GPU-optimized, ~16x smaller VRAM)
}

export interface TileData {
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  isLoaded: boolean;
}

export type Memo = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  zIndex: number;
  rotation: number;
}

/** @deprecated Use role types instead */
export type ReferenceType = 'general' | 'costume' | 'pose';

export type UsagePlan = 'free' | 'paid';
export type ModelName = 'gemini-2.5-flash-image' | 'gemini-3.1-flash-image-preview' | 'models/gemini-3-pro-image-preview' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'openai/gpt-image-2' | 'flux/flux-2-max';

export interface PromptItem {
  id: string;
  name: string;
  prompt: string;
}

export interface PromptFolder {
  id: string;
  name: string;
  presets: PromptItem[];
  showInQuickBar?: boolean;
}


export interface ChatMessage {
  role: 'user' | 'model' | 'function';
  content: string;
  images?: File[];
  sources?: { title: string; uri: string }[];
  functionCall?: FunctionCall;
}

export type ShortcutAction =
  | 'alignSelection'
  | 'toggleGroup'
  | 'saveWorkspace'
  | 'saveWorkspaceAs'
  | 'loadWorkspace'
  | 'deleteSelection'
  | 'undoDrawing'
  | 'redoDrawing'
  | 'editGroup'
  | 'openEditor'
  | 'generateImage'
  | 'panCanvas'
  | 'translateMemo'
  | 'cancel'
  | 'mergeGroups'
  | 'newTab'
  | 'closeTab'
  | 'nextTab'
  | 'prevTab'
  | 'toggleAppSettings'
  | 'toggleOriginalImagePanel'
  | 'toggleLeftPanel';

export type RightPanelTab = 'concept' | 'camera' | 'pose' | 'painting' | 'aiEdit';

export type Resolution = 'auto' | '512' | '1k' | '2k' | '4k';
export type AspectRatio =
    | 'auto'
    | '1:1'
    | '16:9' | '9:16'
    | '4:3'  | '3:4'
    | '2:3'  | '3:2'
    | '4:5'  | '5:4'
    | '21:9' | '9:21'
    | '1:4'  | '4:1'
    | '1:8'  | '8:1';
export type FluxResolutionMP = '0.6' | '1' | '2' | '4';
export type OpenAIQuality = 'auto' | 'high' | 'medium' | 'low';
export type ThinkingLevel = 'minimal' | 'high';
export type GroundingTool = 'googleSearch' | 'imageSearch';
export type GridLayout = '1x2' | '2x1' | '1x3' | '3x1' | '2x2' | '2x3' | '3x2' | '3x3';
