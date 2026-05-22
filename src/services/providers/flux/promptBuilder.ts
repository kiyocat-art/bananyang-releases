import { ProcessImageParams } from '../../gemini/types';
import { SelectedView } from '../../../types';
import { buildCameraPrompt } from '../../cameraPromptHelper';

export interface FluxImageInput {
    prompt: string;
    // input_image: originalImage slot, input_image_2~8: ref slots (up to 8 total)
    inputImages: (string | null)[];
}

const ROLE_LABELS: Record<string, string> = {
    general:  'reference image',
    costume:  'costume/outfit reference',
    pose:     'pose reference',
};

// Flux-friendly camera hint — single-line comma format (no Markdown)
export function buildFluxCameraHint(cameraView: SelectedView | null | undefined, useAposeForViews?: boolean): string {
    if (!cameraView) return '';
    const hint = buildCameraPrompt(cameraView, { formatStyle: 'comma' });
    if (!hint) return useAposeForViews ? 'A-pose reference for view consistency' : '';
    return useAposeForViews ? `${hint}, A-pose reference for view consistency` : hint;
}

// Flux-friendly lighting hint — single-line format
export function buildFluxLightingHint(
    lightDirection: { yaw: number; pitch: number } | null | undefined,
    lightIntensity: number | null | undefined,
): string {
    if (!lightDirection) return '';

    const { yaw, pitch } = lightDirection;

    // Skip hint when light is at default front position (no meaningful direction set)
    const normCheck = ((Math.round(yaw) % 360) + 360) % 360;
    const isDefaultPos = (normCheck < 22.5 || normCheck >= 337.5) && pitch >= -15 && pitch <= 15;
    if (isDefaultPos && (lightIntensity === null || lightIntensity === undefined || (lightIntensity > 30 && lightIntensity < 70))) return '';

    // yaw → 8-segment light source direction
    const norm = ((Math.round(yaw) % 360) + 360) % 360;
    let dirLabel: string;
    if      (norm < 22.5 || norm >= 337.5) dirLabel = 'from front';
    else if (norm < 67.5)                  dirLabel = 'from front-left';
    else if (norm < 112.5)                 dirLabel = 'from left';
    else if (norm < 157.5)                 dirLabel = 'from back-left';
    else if (norm < 202.5)                 dirLabel = 'from back';
    else if (norm < 247.5)                 dirLabel = 'from back-right';
    else if (norm < 292.5)                 dirLabel = 'from right';
    else                                   dirLabel = 'from front-right';

    const vertLabel = pitch < -15 ? ', from above' : pitch > 15 ? ', from below' : '';

    let intensityLabel = 'dramatic ';
    if (lightIntensity !== null && lightIntensity !== undefined) {
        if (lightIntensity <= 30)      intensityLabel = 'soft ';
        else if (lightIntensity >= 70) intensityLabel = 'harsh ';
    }

    return `Lighting: ${intensityLabel}light ${dirLabel}${vertLabel}`;
}

export function buildFluxImageInput(params: ProcessImageParams): FluxImageInput {
    const { textureImages = [], originalImage, prompt } = params;
    const validRefs = textureImages.filter((t): t is NonNullable<typeof t> => t != null);

    // Slot assignment:
    // - If originalImage exists → slot 1 (input_image)
    // - textureImages fill slots from slot 2 onward (max 8 slots total)
    // - If no originalImage → first ref takes slot 1
    const inputImages: (string | null)[] = [];
    const roleLines: string[] = [];

    if (originalImage) {
        inputImages.push(originalImage.data);
        roleLines.push('[input_image] = original character — preserve identity, proportions, and style');

        validRefs.slice(0, 7).forEach((ref, i) => {
            inputImages.push(ref.data);
            const label = ROLE_LABELS[ref.referenceType ?? 'general'];
            roleLines.push(`[input_image_${i + 2}] = ${label} — apply only the relevant design elements`);
        });
    } else if (validRefs.length > 0) {
        // Text-to-image with refs
        const [first, ...rest] = validRefs;
        inputImages.push(first.data);
        const firstLabel = ROLE_LABELS[first.referenceType ?? 'general'];
        roleLines.push(`[input_image] = ${firstLabel}`);

        rest.slice(0, 7).forEach((ref, i) => {
            inputImages.push(ref.data);
            const label = ROLE_LABELS[ref.referenceType ?? 'general'];
            roleLines.push(`[input_image_${i + 2}] = ${label}`);
        });
    }

    const roleBlock = roleLines.length > 0
        ? `\n\nImage reference roles:\n${roleLines.join('\n')}`
        : '';

    // Camera and lighting hints (injected by provider — callers must NOT duplicate these in textPrompt)
    const cameraHint   = buildFluxCameraHint(params.cameraView, params.useAposeForViews);
    const lightingHint = buildFluxLightingHint(params.lightDirection, params.lightIntensity);
    const extraHints   = [cameraHint, lightingHint].filter(Boolean);

    if (params.selectedPalette) {
        const colors = (params.numPaletteColors && params.numPaletteColors > 0)
            ? params.selectedPalette.colors.slice(0, params.numPaletteColors)
            : params.selectedPalette.colors;
        extraHints.push(`Color palette (${params.selectedPalette.name}): use only these colors for clothing, props, and background — ${colors.join(', ')}. Use natural skin/hair tones for characters.`);
    }

    if (params.selectedActionPose) {
        const pose = params.selectedActionPose;
        extraHints.push(`Pose: ${pose.name}${(pose as any).description ? ` — ${(pose as any).description}` : ''}.`);
    }

    if (params.selectedClothingItems?.length) {
        const names = params.selectedClothingItems.map((c: any) => c.name).filter(Boolean).join(', ');
        if (names) extraHints.push(`Outfit elements: ${names}.`);
    }

    if (params.isAutoColorizeSketch) {
        extraHints.push('The base image is a line-art sketch. Add natural vibrant coloring while preserving line work and composition.');
    }
    const hintBlock    = extraHints.length > 0 ? '\n\n' + extraHints.join('\n') : '';

    return {
        prompt: prompt + roleBlock + hintBlock,
        inputImages,
    };
}
