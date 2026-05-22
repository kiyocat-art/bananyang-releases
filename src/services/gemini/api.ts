import { GoogleGenAI, GenerateContentResponse, FinishReason, Part } from "@google/genai";
import { AuthService } from "../authService";
import { Resolution, AspectRatio, SelectedView, FluxResolutionMP, OpenAIQuality } from "../../types";
import { MODEL_NAMES } from "../../constants";
import { resolveProvider } from "../providers/registry";
import { ProcessImageParams } from "./types";

// ── 다중 API 키 모델 ──────────────────────────────────────────────────────

export interface KeyEntry {
    id: string;
    label: string;
    key: string;
    createdAt: number;
}

function loadKeys(): KeyEntry[] {
    try {
        const raw = localStorage.getItem('gemini-api-keys');
        if (raw) return JSON.parse(raw) as KeyEntry[];
    } catch { /* fallthrough */ }
    return [];
}

function saveKeys(keys: KeyEntry[]): void {
    localStorage.setItem('gemini-api-keys', JSON.stringify(keys));
}

// 레거시 단일 키 → 배열로 1회 마이그레이션
(function migrateSingleKey() {
    if (localStorage.getItem('gemini-api-keys') !== null) return;
    const legacy = localStorage.getItem('gemini-api-key');
    if (legacy) {
        const entry: KeyEntry = { id: crypto.randomUUID(), label: 'Key 1', key: legacy, createdAt: Date.now() };
        saveKeys([entry]);
        localStorage.setItem('gemini-active-key-id', entry.id);
        localStorage.removeItem('gemini-api-key');
    } else {
        saveKeys([]);
    }
})();

export function listApiKeys(): KeyEntry[] {
    return loadKeys();
}

export function addApiKey(label: string, key: string): KeyEntry {
    const keys = loadKeys();
    const entry: KeyEntry = { id: crypto.randomUUID(), label, key, createdAt: Date.now() };
    saveKeys([...keys, entry]);
    if (keys.length === 0) {
        localStorage.setItem('gemini-active-key-id', entry.id);
    }
    return entry;
}

export function updateApiKey(id: string, partial: { label?: string; key?: string }): void {
    const keys = loadKeys();
    saveKeys(keys.map(k => k.id === id ? { ...k, ...partial } : k));
}

export function removeApiKey(id: string): void {
    const keys = loadKeys();
    const remaining = keys.filter(k => k.id !== id);
    saveKeys(remaining);
    if (localStorage.getItem('gemini-active-key-id') === id) {
        const next = remaining[0] ?? null;
        if (next) {
            localStorage.setItem('gemini-active-key-id', next.id);
        } else {
            localStorage.removeItem('gemini-active-key-id');
        }
    }
}

export function getActiveKeyId(): string | null {
    return localStorage.getItem('gemini-active-key-id');
}

export function setActiveKeyId(id: string | null): void {
    if (id) {
        localStorage.setItem('gemini-active-key-id', id);
    } else {
        localStorage.removeItem('gemini-active-key-id');
    }
}

export function getApiKey(): string | undefined {
    const activeId = getActiveKeyId();
    if (activeId) {
        const entry = loadKeys().find(k => k.id === activeId);
        if (entry?.key) return entry.key;
    }
    return process.env.API_KEY;
}

export function setApiKey(key: string) {
    if (!key) {
        const activeId = getActiveKeyId();
        if (activeId) removeApiKey(activeId);
        return;
    }
    const activeId = getActiveKeyId();
    if (activeId) {
        updateApiKey(activeId, { key });
    } else {
        const entry = addApiKey('Key 1', key);
        localStorage.setItem('gemini-active-key-id', entry.id);
    }
}

export function getUseGoogleAuth(): boolean {
    return localStorage.getItem('use_google_auth') === 'true';
}

export function setUseGoogleAuth(use: boolean) {
    localStorage.setItem('use_google_auth', String(use));
    if (use) localStorage.setItem('gemini-apikey-active', 'false');
}

export function getGeminiApiKeyActive(): boolean {
    return localStorage.getItem('gemini-apikey-active') === 'true';
}

export function setGeminiApiKeyActive(active: boolean) {
    localStorage.setItem('gemini-apikey-active', String(active));
    if (active) localStorage.setItem('use_google_auth', 'false');
}

export type GeminiBackend = 'vertex' | 'apiKey' | 'none';

export function getGeminiBackend(): GeminiBackend {
    if (localStorage.getItem('use_google_auth') === 'true') return 'vertex';
    if (localStorage.getItem('gemini-apikey-active') === 'true') return 'apiKey';
    return 'none';
}

// 기존 사용자 데이터를 새 플래그 구조로 1회 마이그레이션
(function migrateGeminiBackendFlags() {
    if (localStorage.getItem('gemini-apikey-active') !== null) return;
    const useVertex = localStorage.getItem('use_google_auth') === 'true';
    const hasApiKey = loadKeys().length > 0;
    localStorage.setItem('gemini-apikey-active', useVertex ? 'false' : (hasApiKey ? 'true' : 'false'));
})();

let vertexProjectIdFromStorage: string | null = localStorage.getItem('vertex-project-id');

export function getVertexProjectId(): string | null {
    return vertexProjectIdFromStorage;
}

export function setVertexProjectId(pid: string | null) {
    vertexProjectIdFromStorage = pid;
    if (pid) localStorage.setItem('vertex-project-id', pid);
    else localStorage.removeItem('vertex-project-id');
}

export async function getClient(): Promise<GoogleGenAI> {
    const backend = getGeminiBackend();
    if (backend === 'vertex') {
        const authService = AuthService.getInstance();
        const token = await authService.getAccessToken();
        if (!token) throw new Error("error.vertexAuthFailed");
        return new GoogleGenAI({ apiKey: token });
    }
    if (backend === 'apiKey') {
        const key = getApiKey();
        if (!key) throw new Error("error.apiKeyInvalid");
        return new GoogleGenAI({ apiKey: key });
    }
    throw new Error("error.noGeminiBackend");
}

export function hasValidAuth(): boolean {
    return getGeminiBackend() !== 'none';
}

// Model availability management per authentication method
const REQUIRED_MODELS = [
    MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE,
    MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE,
    MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW,
    'gemini-2.5-flash-latest',
    'models/gemini-3-pro-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    // Vertex AI compatible chatbot models
    'gemini-2.5-flash-preview-05-20',
    'gemini-3-pro-preview'
];

export function getApiKeyAvailableModels(): string[] {
    const saved = localStorage.getItem('api-key-available-models');
    const savedModels = saved ? JSON.parse(saved) : [];
    // Always merge REQUIRED_MODELS to ensure they are available even if localStorage is stale
    return Array.from(new Set([...savedModels, ...REQUIRED_MODELS]));
}

export function setApiKeyAvailableModels(models: string[]) {
    localStorage.setItem('api-key-available-models', JSON.stringify(models));
}

export function getVertexAiAvailableModels(): string[] {
    const saved = localStorage.getItem('vertex-ai-available-models');
    const savedModels = saved ? JSON.parse(saved) : [];
    // Always merge REQUIRED_MODELS to ensure they are available even if localStorage is stale
    return Array.from(new Set([...savedModels, ...REQUIRED_MODELS]));
}

export function setVertexAiAvailableModels(models: string[]) {
    localStorage.setItem('vertex-ai-available-models', JSON.stringify(models));
}

export function getAllAvailableModels(): string[] {
    const apiKeyModels = getApiKeyAvailableModels();
    const vertexAiModels = getVertexAiAvailableModels();
    // Return unique models from both sources (OR condition)
    return Array.from(new Set([...apiKeyModels, ...vertexAiModels]));
}

// Chatbot model selection
export function getChatbotModel(): string {
    const saved = localStorage.getItem('chatbot-model');
    return saved || 'gemini-flash'; // Default to gemini-flash (matches GEMINI_MODELS key)
}

export function setChatbotModel(model: string) {
    localStorage.setItem('chatbot-model', model);
}

export const handleApiError = (e: any): never => {
    console.error("API call failed:", e);
    if (e.message?.includes('aborted')) throw new Error('error.cancelled');
    if (e.message) {
        if (e.message.includes('API key not valid')) throw new Error('error.apiKeyInvalid');
        if (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('rate limit')) throw new Error('error.rateLimited');
        if (e.message.includes('quota') || e.message.includes('billing')) throw new Error('error.quotaExceeded');
        if (e.message.includes('prompt was blocked')) throw new Error('error.promptBlocked');
        if (e.message.startsWith('error.')) throw e;
    }
    if (e.status === 429 || (e.error && e.error.code === 429)) throw new Error('error.rateLimited');
    throw new Error('error.apiGeneric');
};

// Helper function to call Vertex AI via IPC
async function callVertexAI(model: string, prompt: any, config?: any, safetySettings?: any) {
    if (!(window as any).electronAPI || !(window as any).electronAPI.generateContentVertex) {
        throw new Error("Vertex AI integration is not available in this environment.");
    }
    const result = await (window as any).electronAPI.generateContentVertex({
        model,
        prompt,
        config,
        safetySettings,
        projectId: getVertexProjectId(),
    });

    if (!result.success) {
        throw new Error(result.error || 'Vertex AI generation failed');
    }
    return result.response;
}

export type Backend = 'vertex' | 'apiKey';

export interface UnifiedResult {
    response: GenerateContentResponse;
    backend: Backend;
}

export async function generateContentUnified(
    model: string,
    contents: any,
    config?: any,
    signal?: AbortSignal
): Promise<UnifiedResult> {
    // Strict routing: the user-selected backend is the single source of truth.
    // No silent cross-backend fallback — failures surface explicitly so the user can correct settings.
    const useVertex = getGeminiBackend() === 'vertex';

    if (useVertex) {
        const vertexAiModels = getVertexAiAvailableModels();
        if (!vertexAiModels.includes(model)) {
            console.error(`[Vertex AI] Model not available: ${model}`);
            throw new Error('error.vertexModelUnavailable');
        }

        // Vertex AI doesn't support aspectRatio, sampleImageSize, and systemInstruction in config
        const vertexConfig = config ? { ...config } : {};
        delete vertexConfig.aspectRatio;
        delete vertexConfig.sampleImageSize;

        // Extract systemInstruction and convert it to a system message
        const systemInstruction = vertexConfig.systemInstruction;
        delete vertexConfig.systemInstruction;

        let vertexContents = contents;
        if (systemInstruction) {
            vertexContents = [
                { role: 'user', parts: [{ text: systemInstruction }] },
                { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
                ...contents
            ];
        }

        try {
            const response = await callVertexAI(model, vertexContents, vertexConfig);
            return { response, backend: 'vertex' };
        } catch (e: any) {
            console.error('[Vertex AI] Generation failed:', e?.message || e);
            throw new Error('error.vertexFailed');
        }
    }

    // API Key path (Google AI Studio)
    const apiKeyModels = getApiKeyAvailableModels();
    if (!apiKeyModels.includes(model) || !getApiKey()) {
        throw new Error("error.apiKeyMissing");
    }

    const ai = await getClient();

    let apiContents = contents;
    let apiConfig = config;

    // Strip personGeneration from imageConfig — not supported in Gemini API (API key path)
    if (apiConfig?.imageConfig?.personGeneration) {
        apiConfig = { ...apiConfig, imageConfig: { ...apiConfig.imageConfig } };
        delete apiConfig.imageConfig.personGeneration;
    }

    if (config?.systemInstruction) {
        apiConfig = { ...config };
        const systemInstruction = apiConfig.systemInstruction;
        delete apiConfig.systemInstruction;

        apiContents = [
            { role: 'user', parts: [{ text: systemInstruction }] },
            { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] },
            ...contents
        ];
    }

    const response = await ai.models.generateContent({
        model: model,
        contents: apiContents,
        config: apiConfig,
        ...(signal ? { abortSignal: signal } : {}),
    });
    return { response, backend: 'apiKey' };
}

export const processImageEditResponse = (response: GenerateContentResponse, signal: AbortSignal): string[] => {
    if (signal.aborted) throw new Error('error.cancelled');

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error('error.noResponse');

    if (candidate.finishReason && candidate.finishReason !== FinishReason.STOP) {
        console.warn(`Image Edit FinishReason: ${candidate.finishReason}`);
        switch (candidate.finishReason) {
            case FinishReason.SAFETY: throw new Error('error.finishSafety');
            case FinishReason.RECITATION: throw new Error('error.finishSafety'); // Treat recitation as safety/policy block
            default: throw new Error(`error.finishUnspecified`);
        }
    }

    // Filter out thought parts (Gemini thinking tokens, not actionable output)
    const actionableParts = (candidate.content?.parts ?? []).filter((p: any) => !p.thought);

    const imagePart = actionableParts.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('image/'));
    if (!imagePart || !imagePart.inlineData) {
        const textPart = actionableParts.find((p: any) => p.text);
        if (textPart && textPart.text) {
            console.warn("Model returned text instead of image:", textPart.text);
            throw new Error('error.textResponse');
        }
        throw new Error('error.noImage');
    }

    return [`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`];
};

export const callImageEditModelWithRefs = async (
    image: { data: string; mimeType: string },
    referenceImages: { data: string; mimeType: string }[],
    textPrompt: string,
    modelName: string,
    signal: AbortSignal,
    resolution?: Resolution,
    aspectRatio?: AspectRatio,
    fluxOptions?: { resolutionMP: FluxResolutionMP; promptUpsampling: boolean },
    openAIOptions?: { quality: OpenAIQuality },
    cameraView?: SelectedView | null,
    lightDirection?: { yaw: number; pitch: number } | null,
    lightIntensity?: number | null,
): Promise<string[]> => {
    if (signal.aborted) throw new Error('error.cancelled');

    // Route to external provider (Flux, OpenAI) if applicable
    const externalProvider = resolveProvider(modelName);
    if (externalProvider) {
        const params: ProcessImageParams = {
            originalImage: image,
            maskImage: null,
            prompt: textPrompt,
            textureImages: referenceImages.map(r => ({ ...r, referenceType: 'general' as const })),
            poseImage: null,
            backgroundImage: null,
            backgroundImageAspectRatio: null,
            poseControlImage: null,
            cameraView: cameraView ?? null,
            bodyPartReferenceMap: {} as Record<string, number>,
            selectedClothingItems: [],
            selectedObjectItems: [],
            selectedActionPose: null,
            useAposeForViews: false,
            isApplyingFullOutfit: false,
            isApplyingTop: false,
            isApplyingBottom: false,
            lightDirection: lightDirection ?? null,
            lightIntensity: lightIntensity ?? null,
            selectedPalette: null,
            numPaletteColors: 0,
            isAutoColorizeSketch: false,
            modelName,
            signal,
            resolution,
            aspectRatio,
            fluxOptions,
            openAIOptions,
        } as unknown as ProcessImageParams;
        return externalProvider.generate(params, signal);
    }

    const parts: Part[] = [
        { inlineData: { data: image.data, mimeType: image.mimeType } },
        ...referenceImages.map(ref => ({
            inlineData: { data: ref.data, mimeType: ref.mimeType },
        })),
        { text: textPrompt },
    ];

    try {
        const config: any = { responseModalities: ["TEXT", "IMAGE"] };
        const imageConfig: any = {
            imageOutputOptions: { mimeType: "image/png" },
            personGeneration: "ALLOW_ALL",
        };
        if (resolution && resolution !== 'auto') imageConfig.imageSize = resolution.toUpperCase();
        if (aspectRatio && aspectRatio !== 'auto') imageConfig.aspectRatio = aspectRatio;
        config.imageConfig = imageConfig;

        console.log('[callImageEditModelWithRefs] API Call Config:', {
            modelName, resolution, aspectRatio, refCount: referenceImages.length,
            configSent: JSON.stringify(config, null, 2)
        });

        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount <= maxRetries) {
            if (signal.aborted) throw new Error('error.cancelled');
            try {
                const { response } = await generateContentUnified(modelName, { parts }, config, signal);
                return processImageEditResponse(response, signal);
            } catch (err: any) {
                if (signal.aborted) throw new Error('error.cancelled');
                const is503 = err.status === 503 ||
                    (err.error && err.error.code === 503) ||
                    (err.message && (err.message.includes('503') || err.message.includes('overloaded')));
                const is429 = err.status === 429 ||
                    (err.error && err.error.code === 429) ||
                    (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('rate limit')));
                const isNoImage = err instanceof Error && err.message === 'error.noImage';
                if ((is503 || is429 || isNoImage) && retryCount < maxRetries) {
                    retryCount++;
                    const delay = is429 ? 10000 * retryCount : isNoImage ? 5000 * retryCount : 2000 * retryCount;
                    console.warn(`[callImageEditModelWithRefs] ${is429 ? '429' : isNoImage ? 'no-image' : '503'} retry ${retryCount}/${maxRetries} in ${delay}ms`);
                    await new Promise<void>((resolve, reject) => {
                        const timer = setTimeout(resolve, delay);
                        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('error.cancelled')); }, { once: true });
                    });
                } else {
                    throw err;
                }
            }
        }
        throw new Error('error.noImage');
    } catch (e) {
        return handleApiError(e);
    }
};

export const callImageEditModel = async (
    image: { data: string, mimeType: string },
    textPrompt: string,
    modelName: string,
    signal: AbortSignal,
    resolution?: Resolution,
    aspectRatio?: AspectRatio,
    fluxOptions?: { resolutionMP: FluxResolutionMP; promptUpsampling: boolean },
    openAIOptions?: { quality: OpenAIQuality },
    cameraView?: SelectedView | null,
    lightDirection?: { yaw: number; pitch: number } | null,
    lightIntensity?: number | null,
): Promise<string[]> => {
    if (signal.aborted) throw new Error('error.cancelled');

    // Route to external provider (Flux, OpenAI) if applicable
    const externalProvider = resolveProvider(modelName);
    if (externalProvider) {
        const params: ProcessImageParams = {
            originalImage: image,
            maskImage: null,
            prompt: textPrompt,
            textureImages: [],
            poseImage: null,
            backgroundImage: null,
            backgroundImageAspectRatio: null,
            poseControlImage: null,
            cameraView: cameraView ?? null,
            bodyPartReferenceMap: {} as Record<string, number>,
            selectedClothingItems: [],
            selectedObjectItems: [],
            selectedActionPose: null,
            useAposeForViews: false,
            isApplyingFullOutfit: false,
            isApplyingTop: false,
            isApplyingBottom: false,
            lightDirection: lightDirection ?? null,
            lightIntensity: lightIntensity ?? null,
            selectedPalette: null,
            numPaletteColors: 0,
            isAutoColorizeSketch: false,
            modelName,
            signal,
            resolution,
            aspectRatio,
            fluxOptions,
            openAIOptions,
        } as unknown as ProcessImageParams;
        return externalProvider.generate(params, signal);
    }

    // AI client handled in generateContentUnified
    const parts: Part[] = [
        { inlineData: { data: image.data, mimeType: image.mimeType } },
        { text: textPrompt }
    ];

    try {
        const config: any = {
            responseModalities: ["TEXT", "IMAGE"],
        };

        const imageConfig: any = {
            imageOutputOptions: { mimeType: "image/png" },
            personGeneration: "ALLOW_ALL"
        };

        // Apply resolution and aspect ratio settings (same as processCharacterImage)
        if (resolution && resolution !== 'auto') {
            imageConfig.imageSize = resolution.toUpperCase();
        }

        if (aspectRatio && aspectRatio !== 'auto') {
            imageConfig.aspectRatio = aspectRatio;
        }

        (config as any).imageConfig = imageConfig;

        console.log('[callImageEditModel] API Call Config:', {
            modelName,
            resolution,
            aspectRatio,
            configSent: JSON.stringify(config, null, 2)
        });

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            if (signal.aborted) throw new Error('error.cancelled');
            try {
                const { response } = await generateContentUnified(modelName, { parts }, config, signal);
                return processImageEditResponse(response, signal);
            } catch (err: any) {
                if (signal.aborted) throw new Error('error.cancelled');
                const is503 = err.status === 503 ||
                    (err.error && err.error.code === 503) ||
                    (err.message && (err.message.includes('503') || err.message.includes('overloaded')));
                const is429 = err.status === 429 ||
                    (err.error && err.error.code === 429) ||
                    (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('rate limit')));
                const isNoImage = err instanceof Error && err.message === 'error.noImage';

                if ((is503 || is429 || isNoImage) && retryCount < maxRetries) {
                    retryCount++;
                    const delay = is429 ? 10000 * retryCount : isNoImage ? 5000 * retryCount : 2000 * retryCount;
                    console.warn(`Gemini API ${is429 ? '429' : isNoImage ? 'no-image' : '503'} Error (Attempt ${retryCount}/${maxRetries}). Retrying in ${delay / 1000}s...`);
                    await new Promise<void>((resolve, reject) => {
                        const timer = setTimeout(resolve, delay);
                        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('error.cancelled')); }, { once: true });
                    });
                } else {
                    throw err;
                }
            }
        }
        throw new Error('error.noImage');
    } catch (e) {
        return handleApiError(e);
    }
};
