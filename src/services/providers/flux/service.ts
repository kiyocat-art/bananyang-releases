import { ImageProvider, ProviderCapabilities } from '../types';
import { ProcessImageParams } from '../../gemini/types';
import { AspectRatio, Resolution } from '../../../types';
import { getFluxKey } from './api';
import { buildFluxImageInput } from './promptBuilder';
import { t } from '../../../localization';
import { useSettingsStore } from '../../../store/settingsStore';

const FLUX_API_BASE = 'https://api.bfl.ai/v1';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90000;
const MAX_RETRY_ATTEMPTS = 1;
const MAX_PENDING_BEFORE_RETRY = 20;

// Flux 2 Max requires explicit width/height in pixels.
// Compute from aspect ratio + megapixels (area ≈ mp × 1_000_000 px²).
const RATIO_MAP: Record<string, [number, number]> = {
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
};

async function measureAspect(b64: string, mime: string): Promise<number | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null);
        img.onerror = () => resolve(null);
        img.src = `data:${mime};base64,${b64}`;
    });
}

function toPixels(ar: AspectRatio | undefined, megapixels: string, originalAspect: number | null = null): { width: number; height: number } {
    const mp = parseFloat(megapixels) || 1;
    const targetArea = mp * 1_000_000;
    let rw: number, rh: number;
    if (ar === 'auto' && originalAspect !== null && originalAspect > 0) {
        rw = originalAspect;
        rh = 1;
    } else if (ar && ar !== 'auto' && RATIO_MAP[ar]) {
        [rw, rh] = RATIO_MAP[ar];
    } else {
        rw = 1; rh = 1;
    }
    // w/h = rw/rh  →  w = sqrt(area * rw/rh), rounded to multiple of 32
    const w = Math.round(Math.sqrt(targetArea * rw / rh) / 32) * 32;
    const h = Math.round(Math.sqrt(targetArea * rh / rw) / 32) * 32;
    return { width: Math.max(64, w), height: Math.max(64, h) };
}

function retryable(msg: string): Error {
    const err = new Error(msg);
    (err as any).retryable = true;
    return err;
}

async function fetchResultAsDataUrl(url: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(t('error.flux.downloadFailed', useSettingsStore.getState().language));
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function pollForResults(pollingUrl: string, signal?: AbortSignal): Promise<string[]> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let attempt = 0;
    let pendingStreak = 0;
    const urlHost = (() => { try { return new URL(pollingUrl).host; } catch { return pollingUrl; } })();
    console.log(`[Flux Polling] Started — host: ${urlHost}, timeout: ${POLL_TIMEOUT_MS}ms`);

    while (Date.now() < deadline) {
        if (signal?.aborted) throw new Error('error.cancelled');

        await new Promise<void>((resolve, reject) => {
            const tid = setTimeout(resolve, POLL_INTERVAL_MS);
            signal?.addEventListener('abort', () => { clearTimeout(tid); reject(new Error('error.cancelled')); }, { once: true });
        });

        if (signal?.aborted) throw new Error('error.cancelled');

        attempt++;
        const pollAbort = new AbortController();
        const pollTimeout = setTimeout(() => pollAbort.abort(), 5000);
        let res: Response;
        try {
            res = await fetch(pollingUrl, { signal: pollAbort.signal });
        } catch (fetchErr: any) {
            clearTimeout(pollTimeout);
            if (signal?.aborted) throw new Error('error.cancelled');
            console.warn(`[Flux Polling] Attempt ${attempt} — fetch error: ${fetchErr?.message}`);
            throw retryable(t('error.flux.pollingError', useSettingsStore.getState().language, { status: 'network' }));
        }
        clearTimeout(pollTimeout);

        if (!res.ok) {
            console.warn(`[Flux Polling] Attempt ${attempt} — HTTP ${res.status}`);
            throw retryable(t('error.flux.pollingError', useSettingsStore.getState().language, { status: String(res.status) }));
        }
        const json = await res.json();
        console.log(`[Flux Polling] Attempt ${attempt} — status: ${json.status}`);

        if (json.status === 'Ready') {
            const samples: string[] = json.result?.samples
                ?? (json.result?.sample ? [json.result.sample] : []);
            console.log(`[Flux Polling] Ready — samples: ${samples.length}`);
            if (samples.length === 0) throw retryable(t('error.flux.noImageUrl', useSettingsStore.getState().language));
            return Promise.all(samples.map(url => fetchResultAsDataUrl(url, signal)));
        }

        if (json.status === 'Failed' || json.status === 'Error') {
            console.error(`[Flux Polling] Failed — status: ${json.status}`);
            throw new Error(t('error.flux.generationFailed', useSettingsStore.getState().language, { status: json.status }));
        }

        if (json.status === 'Request Moderated' || json.status === 'Content Moderated') {
            console.error(`[Flux Polling] Moderated — status: ${json.status}`);
            throw new Error(t('error.flux.moderated', useSettingsStore.getState().language, { status: json.status }));
        }

        if (json.status === 'Task not found') {
            console.warn(`[Flux Polling] Task not found — retrying`);
            throw retryable(t('error.flux.taskNotFound', useSettingsStore.getState().language));
        }

        // 'Pending' | 'Processing' — track streak and exit early if stalled
        pendingStreak++;
        if (pendingStreak >= MAX_PENDING_BEFORE_RETRY) {
            console.warn(`[Flux Polling] Stalled — ${pendingStreak} consecutive Pending/Processing, triggering retry`);
            throw retryable(t('error.flux.timeout', useSettingsStore.getState().language));
        }
    }

    console.error(`[Flux Polling] Timeout after ${POLL_TIMEOUT_MS}ms (${attempt} attempts)`);
    throw retryable(t('error.flux.timeout', useSettingsStore.getState().language));
}

const SUPPORTED_ASPECT_RATIOS: AspectRatio[] = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '9:21'];

async function generateFluxFill(params: ProcessImageParams, signal?: AbortSignal): Promise<string[]> {
    const apiKey = getFluxKey();
    if (!apiKey) throw new Error(t('error.flux.apiKeyMissingFull', useSettingsStore.getState().language));
    if (!params.originalImage || !params.maskImage) throw new Error('error.noOriginalImage');

    let originalAspect: number | null = null;
    if (params.aspectRatio === 'auto' && params.originalImage) {
        originalAspect = await measureAspect(params.originalImage.data, params.originalImage.mimeType);
    }
    const { width, height } = toPixels(params.aspectRatio, params.fluxOptions?.resolutionMP ?? '1', originalAspect);

    const { prompt: enrichedPrompt } = buildFluxImageInput(params);
    const body: Record<string, any> = {
        prompt: enrichedPrompt,
        image: params.originalImage.data,
        mask: params.maskImage.data,
        width,
        height,
        output_format: 'png',
        safety_tolerance: 6,
    };

    let retryCount = 0;
    while (retryCount <= MAX_RETRY_ATTEMPTS) {
        if (signal?.aborted) throw new Error('error.cancelled');

        if (retryCount > 0) {
            await new Promise<void>((resolve, reject) => {
                const tid = setTimeout(resolve, 1000);
                signal?.addEventListener('abort', () => { clearTimeout(tid); reject(new Error('error.cancelled')); }, { once: true });
            });
        }

        let res: Response;
        try {
            res = await fetch(`${FLUX_API_BASE}/flux-fill-pro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-key': apiKey },
                body: JSON.stringify(body),
                signal,
            });
        } catch (fetchErr: any) {
            if (retryCount < MAX_RETRY_ATTEMPTS) { retryCount++; continue; }
            throw fetchErr;
        }

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            const lang = useSettingsStore.getState().language;
            if (res.status === 401 || res.status === 403) throw new Error(t('error.flux.apiKeyInvalid', lang));
            if (res.status === 402) throw new Error(t('error.flux.creditInsufficient', lang));
            if ((res.status === 429 || res.status === 503) && retryCount < MAX_RETRY_ATTEMPTS) { retryCount++; continue; }
            if (res.status === 429) throw new Error(t('error.flux.rateLimited', lang));
            throw new Error(t('error.flux.genericError', lang, { status: String(res.status), error: errText }));
        }

        const json = await res.json();
        const pollingUrl: string | undefined = json.polling_url;
        const taskId: string | undefined = json.id;
        if (!pollingUrl && !taskId) throw new Error(t('error.flux.noJobId', useSettingsStore.getState().language));
        const effectivePollingUrl = pollingUrl ?? `${FLUX_API_BASE}/get_result?id=${taskId}`;

        try {
            return await pollForResults(effectivePollingUrl, signal);
        } catch (pollErr: any) {
            if (!!(pollErr as any)?.retryable && retryCount < MAX_RETRY_ATTEMPTS) { retryCount++; continue; }
            throw pollErr;
        }
    }

    throw new Error(t('error.flux.retryFailed', useSettingsStore.getState().language));
}

export const fluxProvider: ImageProvider = {
    id: 'flux',

    capabilities: {
        supportsMask: true,
        supportsInpaint: false,
        maxRefImages: 8,
        supportedAspectRatios: SUPPORTED_ASPECT_RATIOS,
        supportedResolutions: ['auto'] as Resolution[],
        supportsAbort: true,
    },

    async generate(params: ProcessImageParams, signal?: AbortSignal): Promise<string[]> {
        if (params.maskImage) {
            return generateFluxFill(params, signal);
        }

        const apiKey = getFluxKey();
        if (!apiKey) throw new Error(t('error.flux.apiKeyMissingFull', useSettingsStore.getState().language));

        const { prompt, inputImages } = buildFluxImageInput(params);
        // When aspect ratio is 'auto', measure the original image's natural dimensions
        let originalAspect: number | null = null;
        if (params.aspectRatio === 'auto' && params.originalImage) {
            const b64 = inputImages[0];
            if (b64) {
                originalAspect = await measureAspect(b64, params.originalImage.mimeType || 'image/png');
            }
        }
        const { width, height } = toPixels(params.aspectRatio, params.fluxOptions?.resolutionMP ?? '1', originalAspect);

        // Build body per Flux2Inputs OpenAPI schema
        const body: Record<string, any> = {
            prompt,
            width,
            height,
            output_format: 'png',
            safety_tolerance: 6,
        };
        if (params.fluxOptions?.promptUpsampling) {
            body.prompt_upsampling = true;
        }

        // Map images to input_image, input_image_2 … input_image_8
        inputImages.forEach((b64, i) => {
            if (!b64) return;
            const key = i === 0 ? 'input_image' : `input_image_${i + 1}`;
            body[key] = b64;
        });

        let retryCount = 0;
        while (retryCount <= MAX_RETRY_ATTEMPTS) {
            if (signal?.aborted) throw new Error('error.cancelled');

            if (retryCount > 0) {
                console.log(`[Flux Generate] Retry ${retryCount}/${MAX_RETRY_ATTEMPTS} — waiting 1s`);
                await new Promise<void>((resolve, reject) => {
                    const tid = setTimeout(resolve, 1000);
                    signal?.addEventListener('abort', () => { clearTimeout(tid); reject(new Error('error.cancelled')); }, { once: true });
                });
            } else {
                console.log(`[Flux Generate] Starting request — ${width}×${height}px`);
            }

            let res: Response;
            try {
                res = await fetch(`${FLUX_API_BASE}/flux-2-max`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-key': apiKey,
                    },
                    body: JSON.stringify(body),
                    signal,
                });
            } catch (fetchErr: any) {
                // Network error — retry if attempts remain
                if (retryCount < MAX_RETRY_ATTEMPTS) {
                    console.warn(`[Flux Generate] Network error on attempt ${retryCount + 1}:`, fetchErr?.message);
                    retryCount++;
                    continue;
                }
                throw fetchErr;
            }

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                // Non-retryable errors
                const lang = useSettingsStore.getState().language;
                if (res.status === 401 || res.status === 403) throw new Error(t('error.flux.apiKeyInvalid', lang));
                if (res.status === 402) throw new Error(t('error.flux.creditInsufficient', lang));
                // Retryable: 429, 503
                if ((res.status === 429 || res.status === 503) && retryCount < MAX_RETRY_ATTEMPTS) {
                    console.warn(`[Flux Generate] HTTP ${res.status} on attempt ${retryCount + 1}, retrying...`);
                    retryCount++;
                    continue;
                }
                if (res.status === 429) throw new Error(t('error.flux.rateLimited', lang));
                throw new Error(t('error.flux.genericError', lang, { status: String(res.status), error: errText }));
            }

            const json = await res.json();
            console.log(`[Flux Generate] Initial response:`, JSON.stringify(json));

            const pollingUrl: string | undefined = json.polling_url;
            const taskId: string | undefined = json.id;
            if (!pollingUrl && !taskId) throw new Error(t('error.flux.noJobId', useSettingsStore.getState().language));
            const effectivePollingUrl = pollingUrl ?? `${FLUX_API_BASE}/get_result?id=${taskId}`;
            if (!pollingUrl) {
                console.warn('[Flux Generate] polling_url missing, using fallback id:', taskId);
            }

            console.log(`[Flux Generate] Task created — polling: ${effectivePollingUrl}`);

            try {
                return await pollForResults(effectivePollingUrl, signal);
            } catch (pollErr: any) {
                const isRetryable = !!(pollErr as any)?.retryable;
                if (isRetryable && retryCount < MAX_RETRY_ATTEMPTS) {
                    console.warn(`[Flux Generate] Polling failed on attempt ${retryCount + 1}, retrying...`, pollErr?.message);
                    retryCount++;
                    continue;
                }
                throw pollErr;
            }
        }

        throw new Error(t('error.flux.retryFailed', useSettingsStore.getState().language));
    },
};
