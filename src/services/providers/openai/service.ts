import { ImageProvider } from '../types';
import { ProcessImageParams } from '../../gemini/types';
import { AspectRatio, Resolution, OpenAIQuality } from '../../../types';
import { getOpenAIKey, buildOpenAIHeaders } from './api';
import { buildOpenAIImageInput, OpenAIRefImage } from './promptBuilder';
import { t } from '../../../localization';
import { useSettingsStore } from '../../../store/settingsStore';

const RATIO_NUM: Record<string, [number, number]> = {
    '1:1':  [1, 1],
    '16:9': [16, 9],
    '9:16': [9, 16],
    '4:3':  [4, 3],
    '3:4':  [3, 4],
    '3:2':  [3, 2],
    '2:3':  [2, 3],
    '4:5':  [4, 5],
    '5:4':  [5, 4],
    '21:9': [21, 9],
    '9:21': [9, 21],
    '1:4':  [1, 4],
    '4:1':  [4, 1],
    '1:8':  [1, 8],
    '8:1':  [8, 1],
};

const RESOLUTION_TO_MP: Record<string, number> = {
    'auto': 1, '512': 0.25, '1k': 1, '2k': 3.7, '4k': 8.3,
};

async function measureAspect(b64: string, mime: string): Promise<number | null> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload  = () => resolve(img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null);
        img.onerror = () => resolve(null);
        img.src = `data:${mime};base64,${b64}`;
    });
}

function toOpenAISize(
    resolution: Resolution | undefined,
    aspectRatio: AspectRatio | undefined,
    originalAspect: number | null,
): { width: number; height: number } {
    let ar: number;
    if (!aspectRatio || aspectRatio === 'auto') {
        ar = originalAspect && originalAspect > 0 ? originalAspect : 1;
    } else if (RATIO_NUM[aspectRatio]) {
        const [rw, rh] = RATIO_NUM[aspectRatio];
        ar = rw / rh;
    } else {
        ar = 1;
    }

    const mp = RESOLUTION_TO_MP[resolution ?? 'auto'] ?? 1;
    const targetArea = mp * 1_000_000;

    let w = Math.round(Math.sqrt(targetArea * ar) / 32) * 32;
    let h = Math.round(Math.sqrt(targetArea / ar) / 32) * 32;

    // Ensure minimum 1024 on the short side
    const MIN = 1024;
    if (Math.min(w, h) < MIN) {
        const scale = MIN / Math.min(w, h);
        w = Math.round(w * scale / 32) * 32;
        h = Math.round(h * scale / 32) * 32;
    }

    return { width: w, height: h };
}

function resolveQuality(q?: OpenAIQuality): 'auto' | 'high' | 'medium' | 'low' {
    return q ?? 'auto';
}

function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}

function extFromMime(mime: string): string {
    if (/png/i.test(mime)) return 'png';
    if (/jpe?g/i.test(mime)) return 'jpg';
    if (/webp/i.test(mime)) return 'webp';
    return 'png';
}

function handleOpenAIError(res: Response, errText: string, defaultKey: 'error.openai.genericError' | 'error.openai.editGenericError'): Error {
    const lang = useSettingsStore.getState().language;
    if (res.status === 401) return new Error(t('error.openai.apiKeyInvalid', lang));
    if (res.status === 429) return new Error(t('error.openai.rateLimited', lang));
    if (res.status === 403 && /verif/i.test(errText)) return new Error(t('error.openai.orgVerification', lang));
    return new Error(t(defaultKey, lang, { status: String(res.status), error: errText }));
}

async function generateTextToImage(
    apiKey: string,
    prompt: string,
    size: { width: number; height: number },
    quality: 'auto' | 'high' | 'medium' | 'low',
    signal?: AbortSignal,
): Promise<string[]> {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: buildOpenAIHeaders(apiKey, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            model: 'gpt-image-2',
            prompt,
            n: 1,
            size: `${size.width}x${size.height}`,
            quality,
            output_format: 'png',
        }),
        signal,
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw handleOpenAIError(res, errText, 'error.openai.genericError');
    }

    const json = await res.json();
    const base64Results: string[] = (json.data ?? [])
        .map((d: any) => `data:image/png;base64,${d.b64_json}`);

    if (base64Results.length === 0) throw new Error(t('error.openai.noImage', useSettingsStore.getState().language));
    return base64Results;
}

async function editImageWithReferences(
    apiKey: string,
    prompt: string,
    referenceImages: OpenAIRefImage[],
    maskBase64: string | null,
    size: { width: number; height: number },
    quality: 'auto' | 'high' | 'medium' | 'low',
    signal?: AbortSignal,
): Promise<string[]> {
    const formData = new FormData();
    formData.append('model', 'gpt-image-2');
    formData.append('prompt', prompt);
    formData.append('n', '1');
    formData.append('size', `${size.width}x${size.height}`);
    formData.append('quality', quality);

    // Attach reference images. OpenAI Images Edit API accepts:
    // - single 'image' field with one file, OR
    // - 'image[]' field repeated for multi-image composition (gpt-image-1+).
    if (referenceImages.length === 1) {
        const ref = referenceImages[0];
        formData.append('image', base64ToBlob(ref.data, ref.mimeType), `image.${extFromMime(ref.mimeType)}`);
    } else {
        referenceImages.forEach((ref, idx) => {
            formData.append('image[]', base64ToBlob(ref.data, ref.mimeType), `image_${idx}.${extFromMime(ref.mimeType)}`);
        });
    }

    if (maskBase64) {
        formData.append('mask', base64ToBlob(maskBase64, 'image/png'), 'mask.png');
    }

    const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: buildOpenAIHeaders(apiKey),
        body: formData,
        signal,
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw handleOpenAIError(res, errText, 'error.openai.editGenericError');
    }

    const json = await res.json();
    const base64Results: string[] = (json.data ?? [])
        .map((d: any) => `data:image/png;base64,${d.b64_json}`);

    if (base64Results.length === 0) throw new Error(t('error.openai.noEditImage', useSettingsStore.getState().language));
    return base64Results;
}

const SUPPORTED_ASPECT_RATIOS: AspectRatio[] = [
    'auto', '1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2',
    '4:5', '5:4', '21:9', '9:21', '1:4', '4:1', '1:8', '8:1',
];

export const openAIProvider: ImageProvider = {
    id: 'openai',

    capabilities: {
        supportsMask: true,
        supportsInpaint: true,
        maxRefImages: 8,
        supportedAspectRatios: SUPPORTED_ASPECT_RATIOS,
        supportedResolutions: ['auto', '512', '1k', '2k', '4k'] as Resolution[],
        supportsAbort: true,
    },

    async generate(params: ProcessImageParams, signal?: AbortSignal): Promise<string[]> {
        const apiKey = getOpenAIKey();
        if (!apiKey) throw new Error(t('error.openai.apiKeyMissing', useSettingsStore.getState().language));

        const { prompt, referenceImages, maskBase64 } = buildOpenAIImageInput(params);

        // Measure original aspect when AR=auto
        let originalAspect: number | null = null;
        if (params.aspectRatio === 'auto') {
            if (params.originalImage) {
                originalAspect = await measureAspect(params.originalImage.data, params.originalImage.mimeType);
            } else if (referenceImages[0]) {
                originalAspect = await measureAspect(referenceImages[0].data, referenceImages[0].mimeType);
            }
        }

        const size = toOpenAISize(params.resolution, params.aspectRatio, originalAspect);
        const quality = resolveQuality(params.openAIOptions?.quality);

        if (referenceImages.length > 0) {
            return editImageWithReferences(apiKey, prompt, referenceImages, maskBase64, size, quality, signal);
        }

        return generateTextToImage(apiKey, prompt, size, quality, signal);
    },
};
