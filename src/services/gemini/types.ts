import { BoardImage, Resolution, AspectRatio, BodyPart, SelectedView, ActionPose, ObjectItem, ColorPalette, FluxResolutionMP, OpenAIQuality } from '../../types';

export interface ChatImage {
    file: File;
    role: BoardImage['role'];
    refIndex?: number;
    id: string;
}

export interface TextureImage {
    data: string;
    mimeType: string;
    referenceType?: 'general' | 'costume' | 'pose';
    styleIntensity?: number;
}

export interface ProcessImageParams {
    originalImage: { data: string; mimeType: string } | null;
    maskImage: { data: string; mimeType: string } | null;
    prompt: string;
    textureImages: TextureImage[];
    poseImage: { data: string; mimeType: string } | null;
    backgroundImage: { data: string; mimeType: string } | null;
    backgroundImageAspectRatio: number | string | null;
    poseControlImage: { data: string; mimeType: string } | null;
    cameraView: SelectedView | null;
    bodyPartReferenceMap: Record<BodyPart, number>;
    selectedClothingItems: string[];
    selectedObjectItems: ObjectItem[];
    selectedActionPose: ActionPose | null;
    useAposeForViews: boolean;
    isApplyingFullOutfit: boolean;
    isApplyingTop: boolean;
    isApplyingBottom: boolean;
    lightDirection: { yaw: number; pitch: number } | null;
    lightIntensity: number | null;
    selectedPalette: ColorPalette | null;
    numPaletteColors: number;
    isAutoColorizeSketch: boolean;
    modelName: string;
    signal: AbortSignal;
    resolution?: Resolution;
    aspectRatio?: AspectRatio;
    // 5단계 의상참조 합성
    synthesisControlMode?: 'original' | 'reference';
    originalPreservationLevel?: number;
    costumeCreativityLevel?: number;
    costumeBodyType?: 'slim' | 'average' | 'muscular' | 'curvy';
    costumeGender?: 'male' | 'female' | 'androgynous';
    // Thinking & Grounding (Phase 3)
    thinkingLevel?: 'minimal' | 'high' | null;
    groundingTools?: Array<'googleSearch' | 'imageSearch'>;
    /** true = poseImage가 사용자가 직접 그린 스케치 */
    isPoseSketch?: boolean;
    fluxOptions?: { resolutionMP: FluxResolutionMP; promptUpsampling: boolean };
    openAIOptions?: { quality: OpenAIQuality };
}
