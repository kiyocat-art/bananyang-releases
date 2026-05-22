import { ProcessImageParams } from '../../gemini/types';
import { buildFluxCameraHint, buildFluxLightingHint } from '../flux/promptBuilder';

export interface OpenAIRefImage {
    data: string;
    mimeType: string;
    role: 'original' | 'general' | 'costume' | 'pose' | 'pose-control' | 'background';
}

export interface OpenAIImageInput {
    prompt: string;
    referenceImages: OpenAIRefImage[];
    maskBase64: string | null;
}

const ROLE_LABELS: Record<string, string> = {
    general: 'general reference (texture / color / style)',
    costume: 'costume / outfit reference',
    pose: 'pose reference',
};

export function buildOpenAIImageInput(params: ProcessImageParams): OpenAIImageInput {
    const {
        originalImage,
        maskImage,
        textureImages = [],
        poseImage,
        poseControlImage,
        backgroundImage,
        prompt = '',
        cameraView,
        selectedPalette,
        numPaletteColors,
        lightDirection,
        lightIntensity,
        isPoseSketch,
        isAutoColorizeSketch,
    } = params;

    const referenceImages: OpenAIRefImage[] = [];
    const roleLines: string[] = [];

    const pushRole = (line: string) => {
        roleLines.push(`[image_${referenceImages.length}] = ${line}`);
    };

    // 1. Original image (slot 1)
    if (originalImage) {
        referenceImages.push({
            data: originalImage.data,
            mimeType: originalImage.mimeType,
            role: 'original',
        });
        pushRole('original/base image — preserve identity, proportions, and overall composition');
    }

    // 2. textureImages (general / costume / pose) — preserve order from canvas
    const validRefs = textureImages.filter((t): t is NonNullable<typeof t> => t != null);
    validRefs.forEach((ref) => {
        const refType: 'general' | 'costume' | 'pose' = ref.referenceType ?? 'general';
        referenceImages.push({
            data: ref.data,
            mimeType: ref.mimeType,
            role: refType,
        });
        pushRole(`${ROLE_LABELS[refType]} — apply only the relevant design elements from this image`);
    });

    // 3. poseControlImage (drawn pose / canvas pose) — distinct from poseImage
    if (poseControlImage) {
        referenceImages.push({
            data: poseControlImage.data,
            mimeType: poseControlImage.mimeType,
            role: 'pose-control',
        });
        pushRole('pose control sketch — use SOLELY for joint positions, limb angles, and body orientation. Do NOT copy any appearance from this image');
    }

    // 4. poseImage (only when poseControlImage is absent — they share the pose role)
    if (poseImage && !poseControlImage) {
        referenceImages.push({
            data: poseImage.data,
            mimeType: poseImage.mimeType,
            role: 'pose',
        });
        if (isPoseSketch) {
            pushRole('pose sketch — hand-drawn sketch defining ONLY the desired body pose geometry. Use SOLELY for joint positions, limb angles, and orientation. Do NOT interpret as a realistic character');
        } else {
            pushRole('pose reference — use SOLELY for the pose, facial expression, and camera angle');
        }
    }

    // 5. backgroundImage
    if (backgroundImage) {
        referenceImages.push({
            data: backgroundImage.data,
            mimeType: backgroundImage.mimeType,
            role: 'background',
        });
        pushRole('background image — use as the final background scene');
    }

    // === Build textual prompt ===
    const segments: string[] = [];

    const userPrompt = (prompt ?? '').trim();
    if (userPrompt) {
        segments.push(userPrompt);
    }

    if (roleLines.length > 0) {
        segments.push(`Image reference roles (in the order they were attached):\n${roleLines.join('\n')}`);
    }

    // Camera composition (reuse Flux's hint builder for consistency)
    const cameraHint = buildFluxCameraHint(cameraView);
    if (cameraHint) segments.push(cameraHint);

    // Lighting / relight (reuse Flux's hint builder)
    const lightingHint = buildFluxLightingHint(lightDirection, lightIntensity);
    if (lightingHint) segments.push(lightingHint);

    // Color palette
    if (selectedPalette) {
        const colors = numPaletteColors && numPaletteColors > 0
            ? selectedPalette.colors.slice(0, numPaletteColors)
            : selectedPalette.colors;
        segments.push(
            `Color palette (${selectedPalette.name}): strictly use these colors for clothing, objects, and background — ${colors.join(', ')}. Use natural skin and hair tones for any characters.`,
        );
    }

    // Auto-coloring sketch hint
    if (isAutoColorizeSketch) {
        segments.push('The base/original image is a line-art sketch. Add natural and vibrant coloring while preserving the line work and composition.');
    }

    // Action pose
    if (params.selectedActionPose) {
        const pose = params.selectedActionPose as any;
        segments.push(`Pose: ${pose.name}${pose.description ? ` — ${pose.description}` : ''}.`);
    }

    // Clothing items
    if (params.selectedClothingItems?.length) {
        const names = (params.selectedClothingItems as any[]).map(c => c.name).filter(Boolean).join(', ');
        if (names) segments.push(`Outfit elements: ${names}.`);
    }

    // Mask hint (when present)
    if (maskImage) {
        segments.push('A mask image is provided alongside the base image. WHITE areas in the mask = the regions to edit. BLACK areas = preserve unchanged.');
    }

    const finalPrompt = segments.length > 0
        ? segments.join('\n\n')
        : 'Generate a high-quality image based on the provided references.';

    return {
        prompt: finalPrompt,
        referenceImages,
        maskBase64: maskImage?.data ?? null,
    };
}
