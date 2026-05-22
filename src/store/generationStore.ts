import { create } from 'zustand';
import {
    CameraSize, BodyPart, ClothingItem, SelectedView,
    ActionPose, ObjectItem, ColorPalette, RightPanelTab, AiAction, Resolution, AspectRatio, GridLayout, GroundingTool, FluxResolutionMP, OpenAIQuality
} from '../types';
import {
    APPLY_FULL_OUTFIT_BODY_PARTS,
    APPLY_TOP_BODY_PARTS,
    APPLY_BOTTOM_BODY_PARTS,
} from '../constants';

export interface GenerationOptions {
    cameraView: SelectedView;
    isCameraViewActive: boolean;
    lightDirection: { yaw: number, pitch: number };
    lightIntensity: number;
    isLightDirectionActive: boolean;
    useAposeForViews: boolean;
    bodyPartReferenceMap: Partial<Record<BodyPart, number>>;
    selectedClothingConcept: ClothingItem | null;
    selectedObjectItems: ObjectItem[];
    poseControlImage: File | null;
    selectedActionPose: ActionPose | null;
    isApplyingFullOutfit: boolean;
    isApplyingTop: boolean;
    isApplyingBottom: boolean;
    selectedPalette: ColorPalette | null;
    numPaletteColors: number;
    isAutoColorizeSketch: boolean;
    activeRightPanelTab: RightPanelTab;
    variationCreativity: number;
    autoColoringIntensity: number;
    selectedAiEditAction: AiAction | null;
    isAutoColoringActive: boolean;
    isVariationActive: boolean;
    selectedResolution: Resolution;
    selectedAspectRatio: AspectRatio;
    gridLayout: GridLayout | null;
    editGuideImage: File | null;
    groundingTools: GroundingTool[];
    // 5단계 의상참조 합성
    costumeCreativityLevel: number; // 1-5
    costumeBodyType: 'slim' | 'average' | 'muscular' | 'curvy';
    costumeGender: 'male' | 'female' | 'androgynous';
    // Original Preservation vs Reference Design
    synthesisControlMode: 'original' | 'reference';
    originalPreservationLevel: number; // 1-5
    isCostumeDesignEnabled: boolean;
    fluxOptions: { resolutionMP: FluxResolutionMP; promptUpsampling: boolean };
    openAIOptions: { quality: OpenAIQuality };
}

export interface GenerationActions {
    setCameraView: (view: SelectedView | ((prev: SelectedView) => SelectedView)) => void;
    setIsCameraViewActive: (isActive: boolean) => void;
    setLightDirection: (direction: { yaw: number, pitch: number }) => void;
    setLightIntensity: (intensity: number) => void;
    setIsLightDirectionActive: (isActive: boolean) => void;
    setUseAposeForViews: (use: boolean) => void;
    setBodyPartReferenceMap: (map: Partial<Record<BodyPart, number>> | ((prev: Partial<Record<BodyPart, number>>) => Partial<Record<BodyPart, number>>)) => void;
    setSelectedClothingConcept: (concept: ClothingItem | null) => void;
    setSelectedObjectItems: (items: ObjectItem[] | ((prev: ObjectItem[]) => ObjectItem[])) => void;
    setPoseControlImage: (image: File | null) => void;
    setSelectedActionPose: (pose: ActionPose | null) => void;
    setSelectedPalette: (palette: ColorPalette | null) => void;
    setNumPaletteColors: (num: number) => void;
    setIsAutoColorizeSketch: (isAuto: boolean) => void;
    setActiveRightPanelTab: (tab: RightPanelTab) => void;
    setVariationCreativity: (value: number) => void;
    setAutoColoringIntensity: (value: number) => void;
    setSelectedAiEditAction: (action: AiAction | null) => void;
    setIsAutoColoringActive: (v: boolean) => void;
    setIsVariationActive: (v: boolean) => void;
    loadPaintingParams: (params: { palette: ColorPalette | null; numColors: number; }) => void;
    updateDerivedOutfitState: (bodyPartMap: Partial<Record<BodyPart, number>>, activeRef: number | null) => void;
    reset: () => void;
    resetPaintingParams: () => void;
    setSelectedResolution: (resolution: Resolution) => void;
    setSelectedAspectRatio: (ratio: AspectRatio) => void;
    setGridLayout: (layout: GridLayout | null) => void;
    setEditGuideImage: (image: File | null) => void;
    toggleGroundingTool: (tool: GroundingTool) => void;
    setGroundingTools: (tools: GroundingTool[]) => void;
    // 5단계 의상참조 합성
    setCostumeCreativityLevel: (level: number) => void;
    setCostumeBodyType: (type: 'slim' | 'average' | 'muscular' | 'curvy') => void;
    setCostumeGender: (gender: 'male' | 'female' | 'androgynous') => void;
    // Original Preservation vs Reference Design
    setSynthesisControlMode: (mode: 'original' | 'reference') => void;
    setOriginalPreservationLevel: (level: number) => void;
    setIsCostumeDesignEnabled: (enabled: boolean) => void;
    setFluxOptions: (opts: Partial<{ resolutionMP: FluxResolutionMP; promptUpsampling: boolean }>) => void;
    setOpenAIOptions: (opts: Partial<{ quality: OpenAIQuality }>) => void;
}

const initialGenerationState: GenerationOptions = {
    cameraView: {
        yaw: 0, pitch: 0, fov: 50, size: CameraSize.Full,
        focalLength: 50, cameraAnglePreset: null, lensFocusPreset: null, shotSizePreset: null
    },
    isCameraViewActive: false,
    lightDirection: { yaw: 0, pitch: 0 },
    lightIntensity: 1.0,
    isLightDirectionActive: false,
    useAposeForViews: false,
    bodyPartReferenceMap: {},
    selectedClothingConcept: null,
    selectedObjectItems: [],
    poseControlImage: null,
    selectedActionPose: null,
    isApplyingFullOutfit: false,
    isApplyingTop: false,
    isApplyingBottom: false,
    selectedPalette: null,
    numPaletteColors: 4,
    isAutoColorizeSketch: false,
    activeRightPanelTab: 'concept',
    variationCreativity: 3,
    autoColoringIntensity: 3,
    selectedAiEditAction: null,
    isAutoColoringActive: false,
    isVariationActive: false,
    selectedResolution: '2k',
    selectedAspectRatio: 'auto',
    gridLayout: null,
    editGuideImage: null,
    groundingTools: [],
    // 5단계 의상참조 합성
    costumeCreativityLevel: 3,
    costumeBodyType: 'average',
    costumeGender: 'female',
    synthesisControlMode: 'reference',
    originalPreservationLevel: 3,
    isCostumeDesignEnabled: true,
    fluxOptions: { resolutionMP: '2' as FluxResolutionMP, promptUpsampling: false },
    openAIOptions: { quality: 'auto' as OpenAIQuality },
};

export const useGenerationStore = create<GenerationOptions & GenerationActions>((set, get) => ({
    ...initialGenerationState,
    setCameraView: (updater) => set(state => ({ cameraView: typeof updater === 'function' ? updater(state.cameraView) : updater, selectedAiEditAction: null })),
    setIsCameraViewActive: (isCameraViewActive) => set(state => ({ isCameraViewActive, selectedAiEditAction: isCameraViewActive ? null : state.selectedAiEditAction })),
    setIsAutoColoringActive: (v) => set(state => ({
        isAutoColoringActive: v,
        selectedAiEditAction: v ? null : state.selectedAiEditAction,
    })),
    setIsVariationActive: (v) => set(state => ({
        isVariationActive: v,
        selectedAiEditAction: v ? null : state.selectedAiEditAction,
    })),
    setLightDirection: (lightDirection) => set({ lightDirection, selectedAiEditAction: null }),
    setLightIntensity: (lightIntensity) => set({ lightIntensity }),
    setIsLightDirectionActive: (isLightDirectionActive) => set(state => ({ isLightDirectionActive, selectedAiEditAction: isLightDirectionActive ? null : state.selectedAiEditAction })),
    setUseAposeForViews: (useAposeForViews) => set({ useAposeForViews, selectedAiEditAction: null }),
    setBodyPartReferenceMap: (updater) => set(state => ({ bodyPartReferenceMap: typeof updater === 'function' ? updater(state.bodyPartReferenceMap) : updater, selectedAiEditAction: null })),
    setSelectedClothingConcept: (selectedClothingConcept) => set({ selectedClothingConcept, selectedAiEditAction: null }),
    setSelectedObjectItems: (updater) => set(state => ({ selectedObjectItems: typeof updater === 'function' ? updater(state.selectedObjectItems) : updater, selectedAiEditAction: null })),
    setPoseControlImage: (poseControlImage) => set({ poseControlImage, selectedAiEditAction: null, isAutoColoringActive: false, isVariationActive: false }),
    setSelectedActionPose: (selectedActionPose) => set({ selectedActionPose, selectedAiEditAction: null, isAutoColoringActive: false, isVariationActive: false }),
    setSelectedPalette: (selectedPalette) => set({ selectedPalette, selectedAiEditAction: null, isAutoColoringActive: false, isVariationActive: false }),
    setNumPaletteColors: (numPaletteColors) => set({ numPaletteColors }),
    setIsAutoColorizeSketch: (isAutoColorizeSketch) => set({ isAutoColorizeSketch, selectedAiEditAction: null, isAutoColoringActive: false, isVariationActive: false }),
    setActiveRightPanelTab: (tab) => set(state => {
        const isExclusiveTab = tab === 'painting' || tab === 'pose';
        if (isExclusiveTab) {
            return {
                activeRightPanelTab: tab,
                selectedAiEditAction: null,
                isAutoColoringActive: false,
                isVariationActive: false,
            };
        }
        // concept 탭: 단일선택 AI 액션만 초기화, autoColoring/variation 유지
        if (tab === 'concept') {
            return { activeRightPanelTab: tab, selectedAiEditAction: null };
        }
        // camera / aiEdit 탭 전환: 단일선택 액션만 기존 로직 유지
        if (tab !== 'aiEdit' && state.selectedAiEditAction) {
            return { activeRightPanelTab: tab, selectedAiEditAction: null };
        }
        return { activeRightPanelTab: tab };
    }),
    setVariationCreativity: (variationCreativity) => set({ variationCreativity }),
    setAutoColoringIntensity: (autoColoringIntensity) => set({ autoColoringIntensity }),
    setSelectedAiEditAction: (action) => set(state => {
        if (action) {
            return {
                selectedAiEditAction: action,
                isAutoColoringActive: false,
                isVariationActive: false,
                isCameraViewActive: false,
                isLightDirectionActive: false,
                useAposeForViews: false,
                bodyPartReferenceMap: {},
                selectedClothingConcept: null,
                selectedObjectItems: [],
                poseControlImage: null,
                selectedActionPose: null,
                isApplyingFullOutfit: false,
                isApplyingTop: false,
                isApplyingBottom: false,
                selectedPalette: null,
                isAutoColorizeSketch: false,
            };
        }
        return { selectedAiEditAction: null };
    }),
    loadPaintingParams: (params) => set({
        selectedPalette: params.palette,
        numPaletteColors: typeof params.numColors === 'number' ? params.numColors : 4,
        selectedAiEditAction: null,
        isAutoColoringActive: false,
        isVariationActive: false,
    }),
    updateDerivedOutfitState: (bodyPartMap, _activeRef) => set(() => {
        const assignedValues = Object.values(bodyPartMap).filter((v): v is number => v !== undefined);
        if (assignedValues.length === 0) {
            return { isApplyingFullOutfit: false, isApplyingTop: false, isApplyingBottom: false };
        }
        const uniqueRefs = new Set(assignedValues);
        for (const ref of uniqueRefs) {
            const full = APPLY_FULL_OUTFIT_BODY_PARTS.every(p => bodyPartMap[p] === ref);
            const top = !full && APPLY_TOP_BODY_PARTS.every(p => bodyPartMap[p] === ref) && !APPLY_BOTTOM_BODY_PARTS.some(p => bodyPartMap[p] === ref);
            const bottom = !full && APPLY_BOTTOM_BODY_PARTS.every(p => bodyPartMap[p] === ref) && !APPLY_TOP_BODY_PARTS.some(p => bodyPartMap[p] === ref);
            if (full || top || bottom) {
                return { isApplyingFullOutfit: full, isApplyingTop: top, isApplyingBottom: bottom };
            }
        }
        return { isApplyingFullOutfit: false, isApplyingTop: false, isApplyingBottom: false };
    }),
    reset: () => set(initialGenerationState),
    resetPaintingParams: () => set({
        selectedPalette: null,
        numPaletteColors: 4,
        // FIX: Added missing isAutoColorizeSketch reset to ensure painting state is fully cleared.
        isAutoColorizeSketch: false,
    }),
    setSelectedResolution: (selectedResolution) => set({ selectedResolution }),
    setSelectedAspectRatio: (selectedAspectRatio) => set({ selectedAspectRatio }),
    setGridLayout: (gridLayout) => set({ gridLayout }),
    setEditGuideImage: (editGuideImage) => set({ editGuideImage }),
    setGroundingTools: (groundingTools) => set({ groundingTools }),
    toggleGroundingTool: (tool) => set(state => ({
        groundingTools: state.groundingTools.includes(tool)
            ? state.groundingTools.filter(t => t !== tool)
            : [...state.groundingTools, tool],
    })),
    // 5단계 의상참조 합성
    setCostumeCreativityLevel: (costumeCreativityLevel) => set({ costumeCreativityLevel }),
    setCostumeBodyType: (costumeBodyType) => set({ costumeBodyType }),
    setCostumeGender: (costumeGender) => set({ costumeGender }),
    // Original Preservation vs Reference Design
    setSynthesisControlMode: (synthesisControlMode) => set({ synthesisControlMode }),
    setOriginalPreservationLevel: (originalPreservationLevel) => set({ originalPreservationLevel }),
    setIsCostumeDesignEnabled: (isCostumeDesignEnabled) => set({ isCostumeDesignEnabled }),
    setFluxOptions: (opts) => set(state => ({ fluxOptions: { ...state.fluxOptions, ...opts } })),
    setOpenAIOptions: (opts) => set(state => ({ openAIOptions: { ...state.openAIOptions, ...opts } })),
}));
