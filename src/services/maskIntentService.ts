import { generateContentUnified } from './gemini/api';
import { fileToBase64 } from './gemini/imageUtils';

export type MaskIntent = 'remove' | 'replace' | 'touchup' | 'extend';

export interface MaskIntentResult {
    intent: MaskIntent;
    inferredPrompt: string;
    confidence: number;
    suggestedStrategy: 'full-image' | 'cropped';
    reasoning: string;
}

export interface MaskStats {
    coverageRatio: number;
    touchesEdge: boolean;
    width: number;
    height: number;
}

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

function buildClassifierPrompt(userText: string | undefined, stats: MaskStats): string {
    const userTextBlock = userText && userText.trim()
        ? `\nUser provided text instruction: "${userText.trim()}"`
        : '\nUser provided NO text instruction.';

    return `You are an image-editing intent classifier. The user drew a mask on an image and may have provided optional text. Decide what they want to do.

Inputs:
- Image 1: Original image (full scene).
- Image 2: Binary mask where WHITE pixels = the region the user highlighted (region of interest).
- Mask coverage: ${(stats.coverageRatio * 100).toFixed(1)}% of the image.
- Mask touches image edge: ${stats.touchesEdge ? 'YES' : 'NO'}.${userTextBlock}

Classify the intent into ONE of:
- "remove": user wants the object/content inside the masked region GONE; background should be restored as if it was never there.
- "replace": user wants to swap the masked content for something specific they described in text.
- "touchup": user wants small refinement / correction inside the mask (skin tone, color tweak, minor fix). Usually small coverage.
- "extend": user wants to extend / outpaint the image. Mask typically touches an edge.

Also produce:
- inferredPrompt: a concise, model-ready instruction (English, 1-2 sentences) describing exactly what the image-edit model should do for the masked region. Reference surrounding scene context where helpful. Do NOT include meta words like "the user wants" — write it as a direct instruction to the editor model.
- confidence: 0.0 to 1.0.
- suggestedStrategy: "full-image" if the model needs broad scene context (typical for remove/extend, or large coverage), otherwise "cropped".
- reasoning: one short sentence explaining the choice.

Respond with ONLY a single JSON object, no markdown, no code fence:
{"intent":"remove|replace|touchup|extend","inferredPrompt":"...","confidence":0.0-1.0,"suggestedStrategy":"full-image|cropped","reasoning":"..."}`;
}

function parseClassifierResponse(text: string): MaskIntentResult | null {
    if (!text) return null;
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end < 0 || end <= start) return null;
    const jsonStr = cleaned.slice(start, end + 1);
    try {
        const parsed = JSON.parse(jsonStr);
        const intent: MaskIntent = ['remove', 'replace', 'touchup', 'extend'].includes(parsed.intent)
            ? parsed.intent
            : 'replace';
        const suggestedStrategy: 'full-image' | 'cropped' = parsed.suggestedStrategy === 'cropped'
            ? 'cropped'
            : 'full-image';
        const confidence = typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.5;
        return {
            intent,
            inferredPrompt: typeof parsed.inferredPrompt === 'string' ? parsed.inferredPrompt : '',
            confidence,
            suggestedStrategy,
            reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        };
    } catch (e) {
        console.warn('[maskIntent] JSON parse failed:', e);
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
        console.warn('[maskIntent] text extraction failed:', e);
    }
    return '';
}

export async function classifyMaskIntent({
    originalFile,
    maskFile,
    userText,
    modelName,
    signal,
}: {
    originalFile: File;
    maskFile: File;
    userText?: string;
    modelName: string;
    signal?: AbortSignal;
}): Promise<MaskIntentResult> {
    const stats = await computeMaskStats(maskFile);

    const [origData, maskData] = await Promise.all([
        fileToBase64(originalFile),
        fileToBase64(maskFile),
    ]);

    const prompt = buildClassifierPrompt(userText, stats);

    const parts = [
        { inlineData: { data: origData, mimeType: originalFile.type || 'image/png' } },
        { inlineData: { data: maskData, mimeType: 'image/png' } },
        { text: prompt },
    ];

    const config: any = {
        responseModalities: ['TEXT', 'IMAGE'],
    };

    try {
        const { response } = await generateContentUnified(modelName, { parts }, config, signal);
        const text = extractTextFromResponse(response);
        const parsed = parseClassifierResponse(text);
        if (parsed) {
            console.info('[maskIntent] classified', { intent: parsed.intent, confidence: parsed.confidence, strategy: parsed.suggestedStrategy });
            return parsed;
        }
        console.warn('[maskIntent] parse failed, falling back to heuristic. raw:', text?.slice(0, 200));
    } catch (e) {
        console.warn('[maskIntent] classifier call failed, using heuristic fallback:', e);
    }

    return heuristicFallback(userText, stats);
}

function heuristicFallback(userText: string | undefined, stats: MaskStats): MaskIntentResult {
    const txt = (userText ?? '').toLowerCase().trim();
    const removeKeywords = ['제거', '지워', '삭제', '없애', 'remove', 'erase', 'delete', 'get rid'];
    const touchupKeywords = ['보정', '수정', '미세', '톤', 'fix', 'correct', 'touch', 'adjust', 'enhance'];

    let intent: MaskIntent;
    if (stats.touchesEdge && stats.coverageRatio > 0.05) {
        intent = 'extend';
    } else if (removeKeywords.some(k => txt.includes(k))) {
        intent = 'remove';
    } else if (txt.length === 0 || touchupKeywords.some(k => txt.includes(k))) {
        intent = stats.coverageRatio < 0.03 ? 'touchup' : 'remove';
    } else {
        intent = 'replace';
    }

    return {
        intent,
        inferredPrompt: userText?.trim() ?? '',
        confidence: 0.3,
        suggestedStrategy: intent === 'touchup' ? 'cropped' : 'full-image',
        reasoning: 'Heuristic fallback (classifier failed).',
    };
}
