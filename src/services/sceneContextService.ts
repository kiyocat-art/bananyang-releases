import { generateContentUnified } from './gemini/api';
import { fileToBase64 } from './gemini/imageUtils';
import { BodyPart } from '../types';
import type { MaskIntent, MaskIntentResult, MaskStats } from './maskIntentService';

export type SceneType = 'portrait-fashion' | 'portrait-character' | 'environment' | 'product-object' | 'unknown';
export type RefRole = 'poseRef' | 'costumeRef' | 'generalRef';

export interface AnatomyHit {
    part: BodyPart;
    coverage: number;   // 0.0-1.0, share of mask area within this body part
    confidence: number; // 0.0-1.0
}

export interface SceneAnatomy {
    detected: boolean;
    bodyParts: AnatomyHit[];
    boundaryDescription: string; // e.g. "mask edge crosses deltoid-trapezius boundary"
}

export interface SceneContext {
    // Intent (kept compatible with MaskIntentResult)
    intent: MaskIntent;
    inferredPrompt: string;
    confidence: number;
    suggestedStrategy: 'full-image' | 'cropped';
    reasoning: string;

    // Anatomy
    anatomy: SceneAnatomy;

    // Scene
    sceneType: SceneType;
    perspectiveHint: string;
    lightingHint: string;
    materialHint: string;

    // Recommendations (used by UI to highlight AI suggestions)
    recommendedPresetId?: string | null;
    recommendedRefRole?: RefRole | null;
}

export interface SceneContextOptions {
    anatomyEnabled?: boolean;
    sceneEnabled?: boolean;
}

const VALID_BODY_PARTS = new Set<string>(Object.values(BodyPart));
const VALID_SCENE_TYPES: SceneType[] = ['portrait-fashion', 'portrait-character', 'environment', 'product-object', 'unknown'];
const VALID_REF_ROLES: RefRole[] = ['poseRef', 'costumeRef', 'generalRef'];

async function computeMaskStats(maskFile: File): Promise<MaskStats> {
    const url = URL.createObjectURL(maskFile);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('mask load failed'));
            el.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2d context failed');
        ctx.drawImage(img, 0, 0);
        const { data, width: w, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let whiteCount = 0;
        let touchesEdge = false;
        const edgeThreshold = 8;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const p = (y * w + x) * 4;
                if (data[p] > edgeThreshold) {
                    whiteCount++;
                    if (!touchesEdge && (x < 2 || y < 2 || x > w - 3 || y > h - 3)) {
                        touchesEdge = true;
                    }
                }
            }
        }

        return {
            coverageRatio: whiteCount / (w * h),
            touchesEdge,
            width: w,
            height: h,
        };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function buildAnalyzerPrompt(
    userText: string | undefined,
    stats: MaskStats,
    refRoles: RefRole[],
    options: Required<SceneContextOptions>,
): string {
    const userTextBlock = userText && userText.trim()
        ? `\nUser provided optional hint: "${userText.trim()}"`
        : '\nUser provided NO text instruction.';

    const refBlock = refRoles.length > 0
        ? `\nReference images provided (in order after Image 2 mask): ${refRoles.map((r, i) => `Image ${i + 3} = ${r}`).join(', ')}.`
        : '\nNo reference images provided.';

    const bodyPartList = Object.values(BodyPart).join(', ');

    const anatomyBlock = options.anatomyEnabled
        ? `
ANATOMY ANALYSIS (required):
- Identify if the masked region overlaps any human body part. Only include parts where the mask clearly covers that region.
- Valid BodyPart enum values: ${bodyPartList}.
- For each, return coverage (0.0-1.0, share of the masked region that lies within that body part) and confidence (0.0-1.0).
- boundaryDescription: one short sentence describing what muscles/joints/garment-features the mask edge crosses. If no anatomy, return empty string.
- If the image is not a human/character, set "anatomy.detected": false and "anatomy.bodyParts": [].`
        : '';

    const sceneBlock = options.sceneEnabled
        ? `
SCENE ANALYSIS (required):
- sceneType: one of ${VALID_SCENE_TYPES.map(s => `"${s}"`).join(' | ')}.
- perspectiveHint: camera angle + subject orientation. One short phrase (e.g. "low-angle, three-quarter view, subject leaning right").
- lightingHint: key light direction + shadow quality. One short phrase (e.g. "key light from upper-left, soft diffuse shadows").
- materialHint: dominant material/texture at the mask boundary. One short phrase (e.g. "matte cotton with vertical pleats", "smooth metallic chrome", "rough concrete").`
        : '';

    const refRecommendationBlock = refRoles.length > 0
        ? `
REF ROLE RECOMMENDATION:
- recommendedRefRole: which of [${refRoles.map(r => `"${r}"`).join(', ')}] should be emphasized most for this edit. Return null if no preference.`
        : '\n- recommendedRefRole: null (no refs provided).';

    return `You are a Context-Aware image edit analyzer. The user drew a mask on an image and may have provided optional text and reference images. Produce a structured analysis that downstream prompt builders will use to generate anatomically and scene-aware inpainting instructions.

Inputs:
- Image 1: Original image (full scene).
- Image 2: Binary mask where WHITE pixels = the region the user highlighted (region of interest).${refBlock}
- Mask coverage: ${(stats.coverageRatio * 100).toFixed(1)}% of the image.
- Mask touches image edge: ${stats.touchesEdge ? 'YES' : 'NO'}.${userTextBlock}

INTENT CLASSIFICATION (required):
- Choose ONE of:
  - "remove": user wants the masked content gone; background reconstructed.
  - "replace": user wants to swap masked content for something specific.
  - "touchup": small refinement / correction inside the mask (typically small coverage).
  - "extend": user wants to outpaint / extend the image; mask typically touches an edge.
- inferredPrompt: concise English direct instruction to the editor model (1-2 sentences). Do NOT include meta words like "the user wants".
- confidence: 0.0-1.0.
- suggestedStrategy: "full-image" if broad context needed, else "cropped".
- reasoning: one short sentence.
${anatomyBlock}
${sceneBlock}

PRESET RECOMMENDATION:
- recommendedPresetId: one of "clothing-edit" | "bg-edit" | "object-edit" | "fine-edit" | "object-removal" | "bg-removal" | "fine-removal", or null.
${refRecommendationBlock}

Respond with ONLY a single JSON object, no markdown, no code fence. Use this exact schema:
{
  "intent": "remove|replace|touchup|extend",
  "inferredPrompt": "...",
  "confidence": 0.0,
  "suggestedStrategy": "full-image|cropped",
  "reasoning": "...",
  "anatomy": {
    "detected": true,
    "bodyParts": [{"part": "LeftShoulder", "coverage": 0.0, "confidence": 0.0}],
    "boundaryDescription": "..."
  },
  "sceneType": "portrait-fashion|portrait-character|environment|product-object|unknown",
  "perspectiveHint": "...",
  "lightingHint": "...",
  "materialHint": "...",
  "recommendedPresetId": "clothing-edit",
  "recommendedRefRole": "poseRef"
}`;
}

function clamp01(n: unknown, fallback = 0.5): number {
    if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
}

function asString(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback;
}

function parseAnatomy(raw: unknown): SceneAnatomy {
    const empty: SceneAnatomy = { detected: false, bodyParts: [], boundaryDescription: '' };
    if (!raw || typeof raw !== 'object') return empty;
    const obj = raw as Record<string, unknown>;
    const detected = obj.detected === true;
    const partsRaw = Array.isArray(obj.bodyParts) ? obj.bodyParts : [];
    const bodyParts: AnatomyHit[] = [];
    for (const p of partsRaw) {
        if (!p || typeof p !== 'object') continue;
        const r = p as Record<string, unknown>;
        const partName = asString(r.part);
        if (!VALID_BODY_PARTS.has(partName)) continue;
        bodyParts.push({
            part: partName as BodyPart,
            coverage: clamp01(r.coverage, 0),
            confidence: clamp01(r.confidence, 0.5),
        });
    }
    return {
        detected: detected && bodyParts.length > 0,
        bodyParts: bodyParts.slice(0, 5),
        boundaryDescription: asString(obj.boundaryDescription),
    };
}

function parseAnalyzerResponse(text: string): SceneContext | null {
    if (!text) return null;
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < 0 || end <= start) return null;
    const jsonStr = cleaned.slice(start, end + 1);
    try {
        const parsed = JSON.parse(jsonStr);

        const intent: MaskIntent = (['remove', 'replace', 'touchup', 'extend'] as MaskIntent[]).includes(parsed.intent)
            ? parsed.intent
            : 'replace';
        const suggestedStrategy: 'full-image' | 'cropped' = parsed.suggestedStrategy === 'cropped' ? 'cropped' : 'full-image';

        const sceneType: SceneType = VALID_SCENE_TYPES.includes(parsed.sceneType)
            ? parsed.sceneType
            : 'unknown';

        const recommendedRefRole = VALID_REF_ROLES.includes(parsed.recommendedRefRole as RefRole)
            ? (parsed.recommendedRefRole as RefRole)
            : null;

        return {
            intent,
            inferredPrompt: asString(parsed.inferredPrompt),
            confidence: clamp01(parsed.confidence, 0.5),
            suggestedStrategy,
            reasoning: asString(parsed.reasoning),
            anatomy: parseAnatomy(parsed.anatomy),
            sceneType,
            perspectiveHint: asString(parsed.perspectiveHint),
            lightingHint: asString(parsed.lightingHint),
            materialHint: asString(parsed.materialHint),
            recommendedPresetId: typeof parsed.recommendedPresetId === 'string' ? parsed.recommendedPresetId : null,
            recommendedRefRole,
        };
    } catch (e) {
        console.warn('[sceneContext] JSON parse failed:', e);
        return null;
    }
}

function extractTextFromResponse(response: any): string {
    try {
        const candidates = response?.candidates ?? [];
        for (const cand of candidates) {
            const parts = cand?.content?.parts ?? [];
            for (const part of parts) {
                if (typeof part?.text === 'string' && part.text.trim()) {
                    return part.text;
                }
            }
        }
        if (typeof response?.text === 'string') return response.text;
        if (typeof response?.text === 'function') return response.text();
    } catch (e) {
        console.warn('[sceneContext] text extraction failed:', e);
    }
    return '';
}

export async function analyzeSceneContext(params: {
    originalFile: File;
    maskFile: File;
    referenceImages?: Array<{ file: File; role: RefRole }>;
    userText?: string;
    modelName: string;
    signal?: AbortSignal;
    options?: SceneContextOptions;
}): Promise<SceneContext> {
    const options: Required<SceneContextOptions> = {
        anatomyEnabled: params.options?.anatomyEnabled ?? true,
        sceneEnabled: params.options?.sceneEnabled ?? true,
    };

    const stats = await computeMaskStats(params.maskFile);
    const refs = (params.referenceImages ?? []).slice(0, 4);
    const refRoles = refs.map(r => r.role);

    const [origData, maskData, ...refDatas] = await Promise.all([
        fileToBase64(params.originalFile),
        fileToBase64(params.maskFile),
        ...refs.map(r => fileToBase64(r.file)),
    ]);

    const prompt = buildAnalyzerPrompt(params.userText, stats, refRoles, options);

    const parts: any[] = [
        { inlineData: { data: origData, mimeType: params.originalFile.type || 'image/png' } },
        { inlineData: { data: maskData, mimeType: 'image/png' } },
    ];
    refDatas.forEach((data, idx) => {
        parts.push({ inlineData: { data, mimeType: refs[idx].file.type || 'image/png' } });
    });
    parts.push({ text: prompt });

    const config: any = {
        responseModalities: ['TEXT', 'IMAGE'],
    };

    try {
        const { response } = await generateContentUnified(params.modelName, { parts }, config, params.signal);
        const text = extractTextFromResponse(response);
        const parsed = parseAnalyzerResponse(text);
        if (parsed) {
            console.info('[sceneContext] analyzed', {
                intent: parsed.intent,
                confidence: parsed.confidence,
                strategy: parsed.suggestedStrategy,
                anatomyDetected: parsed.anatomy.detected,
                bodyParts: parsed.anatomy.bodyParts.map(b => b.part),
                sceneType: parsed.sceneType,
                recommendedPresetId: parsed.recommendedPresetId,
                recommendedRefRole: parsed.recommendedRefRole,
            });
            return parsed;
        }
        console.warn('[sceneContext] parse failed, using heuristic fallback. raw:', text?.slice(0, 200));
    } catch (e) {
        console.warn('[sceneContext] analyzer call failed, using heuristic fallback:', e);
    }

    return heuristicFallback(params.userText, stats, refRoles);
}

function heuristicFallback(userText: string | undefined, stats: MaskStats, refRoles: RefRole[]): SceneContext {
    const txt = (userText ?? '').toLowerCase().trim();
    const removeKeywords = ['제거', '지워', '삭제', '없애', 'remove', 'erase', 'delete', 'get rid'];
    const touchupKeywords = ['보정', '수정', '미세', '톤', 'fix', 'correct', 'touch', 'adjust', 'enhance'];

    let intent: MaskIntent;
    if (stats.touchesEdge && stats.coverageRatio > 0.05) {
        intent = 'extend';
    } else if (removeKeywords.some(k => txt.includes(k))) {
        intent = 'remove';
    } else if (txt.length === 0 || touchupKeywords.some(k => txt.includes(k))) {
        intent = stats.coverageRatio < 0.03 ? 'touchup' : 'replace';
    } else {
        intent = 'replace';
    }

    const recommendedRefRole: RefRole | null = refRoles.includes('costumeRef') ? 'costumeRef'
        : refRoles.includes('poseRef') ? 'poseRef'
        : refRoles[0] ?? null;

    return {
        intent,
        inferredPrompt: userText?.trim() ?? '',
        confidence: 0.3,
        suggestedStrategy: intent === 'touchup' ? 'cropped' : 'full-image',
        reasoning: 'Heuristic fallback (analyzer unavailable).',
        anatomy: { detected: false, bodyParts: [], boundaryDescription: '' },
        sceneType: 'unknown',
        perspectiveHint: '',
        lightingHint: '',
        materialHint: '',
        recommendedPresetId: null,
        recommendedRefRole,
    };
}

// Backward-compatible adapter — callers using classifyMaskIntent shape get the intent subset.
export function toMaskIntentResult(ctx: SceneContext): MaskIntentResult {
    return {
        intent: ctx.intent,
        inferredPrompt: ctx.inferredPrompt,
        confidence: ctx.confidence,
        suggestedStrategy: ctx.suggestedStrategy,
        reasoning: ctx.reasoning,
    };
}
