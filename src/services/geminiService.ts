import { GenerateContentResponse } from "@google/genai";
import { SelectedView, CameraSize, BodyPart, ClothingItem, ActionPose, ObjectItem, ColorPalette, ChatMessage, Resolution, AspectRatio, GridLayout, InpaintWorkType, FluxResolutionMP, OpenAIQuality } from '../types';
import * as api from './gemini/api';
import * as imageUtils from './gemini/imageUtils';
import * as promptBuilder from './gemini/promptBuilder';
import { ChatImage, ProcessImageParams } from './gemini/types';
import { BANANYANG_SYSTEM_INSTRUCTION } from '../constants/prompts';
import { pLimit } from '../utils/concurrency';
import { resolveProvider } from './providers/registry';
import { buildCameraPrompt } from './cameraPromptHelper';

// 1. 모델 매핑 정의 (UI 라벨 -> 실제 Model ID)
// Vertex AI 프로젝트에서 사용 가능한 모델
export const GEMINI_MODELS = {
    'gemini-flash': {
        id: 'gemini-2.5-flash', // Vertex AI 호환 (GA 버전)
        label: 'Gemini 2.5 Flash',
        desc: '빠른 응답과 균형 잡힌 성능'
    },
    'gemini-pro': {
        id: 'gemini-3-pro-preview', // Vertex AI 호환 (Pro 버전)
        label: 'Gemini 3.0 Pro',
        desc: '복잡한 추론과 고급 분석에 최적화'
    }
};

export type GeminiModelType = keyof typeof GEMINI_MODELS;

// Export Auth & Model Management
export const getApiKey = api.getApiKey;
export const setApiKey = api.setApiKey;
export const getUseGoogleAuth = api.getUseGoogleAuth;
export const setUseGoogleAuth = api.setUseGoogleAuth;
export const getGeminiApiKeyActive = api.getGeminiApiKeyActive;
export const setGeminiApiKeyActive = api.setGeminiApiKeyActive;
export const getGeminiBackend = api.getGeminiBackend;
export type { GeminiBackend } from './gemini/api';
export const hasValidAuth = api.hasValidAuth;
export const getVertexProjectId = api.getVertexProjectId;
export const setVertexProjectId = api.setVertexProjectId;
export const getApiKeyAvailableModels = api.getApiKeyAvailableModels;
export const setApiKeyAvailableModels = api.setApiKeyAvailableModels;
export const getVertexAiAvailableModels = api.getVertexAiAvailableModels;
export const setVertexAiAvailableModels = api.setVertexAiAvailableModels;
export const getAllAvailableModels = api.getAllAvailableModels;
export const getChatbotModel = api.getChatbotModel;
export const setChatbotModel = api.setChatbotModel;

// Export Image Utils
export const fileToBase64 = imageUtils.fileToBase64;

// Export Image Edit API
export const callImageEditModel = api.callImageEditModel;
export const callImageEditModelWithRefs = api.callImageEditModelWithRefs;

// Image Search function
export const imageSearch = async (file: File, prompt: string, modelKey: GeminiModelType = 'gemini-flash'): Promise<any> => {
    try {
        const base64Data = await imageUtils.fileToBase64(file);
        const image = { data: base64Data, mimeType: file.type };

        const parts: any[] = [
            { inlineData: { data: image.data, mimeType: image.mimeType } },
            { text: prompt }
        ];

        const config = {
            tools: [{ googleSearch: {} }],
        };

        const modelId = GEMINI_MODELS[modelKey].id;
        const { response } = await api.generateContentUnified(modelId, { parts }, config);
        return response;
    } catch (e) {
        return api.handleApiError(e);
    }
};

// Re-implement Service Functions using new modules

export const translateToEnglish = async (text: string): Promise<string> => {
    try {
        const promptText = `Translate the following text into English. Just return the translated text, nothing else. If the text is already in English, return it unchanged. Text: "${text}"`;
        const { response } = await api.generateContentUnified('gemini-2.5-flash-lite',
            [{ role: 'user', parts: [{ text: promptText }] }],
            {
                systemInstruction: 'You are an expert translator. You only return the translated English text, without any introductory phrases or explanations.',
            }
        );

        const translatedText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text)?.trim();
        if (!translatedText) {
            throw new Error('error.translationFailed');
        }
        return translatedText;
    } catch (e: any) {
        console.error("Translation failed:", e);
        if (e.message && e.message.includes('API key not valid')) {
            throw new Error('error.apiKeyInvalid');
        }
        if (e.message && (e.message.includes('quota') || e.message.includes('billing'))) {
            throw new Error('error.quotaExceeded');
        }
        throw new Error('error.translationFailed');
    }
};

export const askBanaNyang = async (
    history: ChatMessage[],
    images: ChatImage[],
    modelKey: GeminiModelType = 'gemini-flash',
    systemInstruction?: string
): Promise<GenerateContentResponse> => {
    try {
        const { contents } = await promptBuilder.buildChatRequest(history, images);

        // Get model ID with fallback to gemini-2.5-flash (same as image generation approach)
        const modelConfig = GEMINI_MODELS[modelKey];
        const modelId = modelConfig?.id || 'gemini-2.5-flash';

        // Chatbot uses standard generation with Google Search tool
        const config = {
            tools: [{ googleSearch: {} }],
            systemInstruction: systemInstruction || BANANYANG_SYSTEM_INSTRUCTION
        };

        const { response } = await api.generateContentUnified(modelId, contents, config);
        return response;
    } catch (e) {
        return api.handleApiError(e);
    }
};

type FluxOpts = { resolutionMP: FluxResolutionMP; promptUpsampling: boolean } | undefined;
type OpenAIOpts = { quality: OpenAIQuality } | undefined;

export const removeImageBackground = (image: { data: string, mimeType: string }, modelName: string, signal: AbortSignal, resolution?: Resolution, aspectRatio?: AspectRatio, fluxOptions?: FluxOpts, openAIOptions?: OpenAIOpts): Promise<string[]> => {
    const prompt = 'Remove the background from the image. The output should be the main subject with a transparent background.';
    return api.callImageEditModel(image, prompt, modelName, signal, resolution, aspectRatio, fluxOptions, openAIOptions);
};

export const keepBackgroundOnly = (image: { data: string, mimeType: string }, modelName: string, signal: AbortSignal, resolution?: Resolution, aspectRatio?: AspectRatio, fluxOptions?: FluxOpts, openAIOptions?: OpenAIOpts): Promise<string[]> => {
    const prompt = 'Identify the main subject in the foreground of the image. Remove the subject completely and realistically fill in the area behind it with the surrounding background texture and context. The output should be only the background.';
    return api.callImageEditModel(image, prompt, modelName, signal, resolution, aspectRatio, fluxOptions, openAIOptions);
};

export const expandImage = (image: { data: string, mimeType: string }, modelName: string, signal: AbortSignal, resolution?: Resolution, aspectRatio?: AspectRatio, customPrompt?: string, fluxOptions?: FluxOpts, openAIOptions?: OpenAIOpts): Promise<string[]> => {
    let prompt = 'This image has transparent areas around the edges. Expand the existing image to fill these transparent areas completely. Generate new content that seamlessly and realistically continues the scene, style, colors, and lighting of the original image. The output should be a single, complete image with no transparency.';

    if (customPrompt && customPrompt.trim()) {
        prompt += `\n\nAdditional user instruction: ${customPrompt.trim()}`;
    }

    return api.callImageEditModel(image, prompt, modelName, signal, resolution, aspectRatio, fluxOptions, openAIOptions);
};

// Inpainting: Fill masked region with AI-generated content
export const inpaintImage = async (
    originalImage: { data: string, mimeType: string },
    maskImage: { data: string, mimeType: string },
    prompt: string,
    modelName: string,
    signal: AbortSignal,
    resolution?: Resolution,
    aspectRatio?: AspectRatio,
    referenceImages?: { data: string, mimeType: string, role?: 'poseRef' | 'costumeRef' | 'generalRef' }[],
    workType?: InpaintWorkType,
    mode?: 'insert' | 'remove',       // Step 5: 신규 — insert(기본) 또는 remove
    numberOfImages?: number,           // Step 5: 신규 — 향후 sampleCount 호환 (현재 1 고정)
    sceneContext?: import('./sceneContextService').SceneContext | null,
    variationStrength?: number,
    anatomyConstraintsEnabled?: boolean,
    sceneAwareEnabled?: boolean,
): Promise<string[]> => {
    const hasReference = referenceImages && referenceImages.length > 0;
    const effectiveMode = mode ?? 'insert';

    // ── Step 4: 압축 프롬프트 (Imagen 문서 패턴 차용) ─────────────────────────
    const styleHint = (() => {
        if (workType === 'clothing') return 'Style hint: maintain the art style, fabric behavior, and color palette of Image 1.';
        if (workType === 'characterEdit') return 'Style hint: maintain the character\'s skin tone, hair, linework, and art style of Image 1.';
        if (workType === 'backgroundFill') return 'Style hint: maintain the perspective, lighting, and scene atmosphere of Image 1.';
        return 'Style hint: maintain the art style and color palette of Image 1.';
    })();

    // ── Step 3: parts 구조 빌드 + ref/mask 인덱스 추적 ─────────────────────
    // orig, mask 우선 push 후, 각 ref 뒤에 해당 ref의 mask part를 즉시 push (interleaved)
    const parts: any[] = [
        { inlineData: { data: originalImage.data, mimeType: originalImage.mimeType } },
        { inlineData: { data: maskImage.data, mimeType: maskImage.mimeType } },
    ];

    const refIndexInfo: { refIndex: number; maskIndex: number | null; role?: 'poseRef' | 'costumeRef' | 'generalRef' }[] = [];
    if (referenceImages && referenceImages.length > 0) {
        referenceImages.forEach((img) => {
            parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
            const refIndex = parts.length;
            refIndexInfo.push({ refIndex, maskIndex: null, role: img.role });
        });
    }

    const refsWithMaskCount = refIndexInfo.filter(r => r.maskIndex !== null).length;

    // Semantic role labeling — make Gemini understand WHY each ref is provided
    const ROLE_SEMANTIC: Record<'poseRef' | 'costumeRef' | 'generalRef', string> = {
        poseRef:    'POSE/ANATOMY reference (use for body structure, skeleton, gesture, and limb orientation)',
        costumeRef: 'GARMENT/MATERIAL reference (use for fabric, texture, pattern, stitching, color of the clothing)',
        generalRef: 'APPEARANCE reference (use for general look, blending, and visual cues at the masked region)',
    };

    // Ref 매핑 라인 동적 생성 — mask 동반 시 "Scenario C" 스타일 추출 지시 명시
    const refMappingLines = refIndexInfo.map((info, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C...
        const semantic = info.role ? ROLE_SEMANTIC[info.role] : `Reference Image ${letter} (no specific role)`;
        const head = info.role ? `${semantic}` : `Reference Image ${letter}`;
        if (info.maskIndex !== null) {
            return `- Image ${info.refIndex} = ${head}. Image ${info.maskIndex} = Reference Mask for Image ${info.refIndex}. **WHITE** area of Image ${info.maskIndex} defines EXACTLY which region of Image ${info.refIndex} to use as visual source; BLACK area of Image ${info.maskIndex} must be IGNORED entirely.`;
        }
        return `- Image ${info.refIndex} = ${head} (no sub-mask — use full image).`;
    }).join('\n');

    const refSection = hasReference
        ? (refsWithMaskCount > 0
            ? `\n\nReference Image Mapping:\n${refMappingLines}\n\n**REFERENCE MASK RULE:** For every reference image that has an accompanying mask, use ONLY the content inside the white-area of that mask. Do NOT pull any color, texture, shape, or detail from outside the white-area of a reference mask. Treat the black-area of a reference mask as if those pixels did not exist in the reference image.`
            : `\n\nReference Image Mapping:\n${refMappingLines}`)
        : '';

    // ── Anatomy-aware constraints (only if Scene Analyzer detected anatomy AND toggle enabled) ──
    const anatomyOn = anatomyConstraintsEnabled !== false;
    const anatomyBlock = (anatomyOn && sceneContext?.anatomy.detected && sceneContext.anatomy.bodyParts.length > 0)
        ? (() => {
            const parts = sceneContext.anatomy.bodyParts
                .map(b => `${b.part} (coverage ${(b.coverage * 100).toFixed(0)}%, conf ${(b.confidence * 100).toFixed(0)}%)`)
                .join(', ');
            const boundary = sceneContext.anatomy.boundaryDescription
                ? `Mask boundary anatomy: ${sceneContext.anatomy.boundaryDescription}.`
                : '';
            return `\n\nANATOMICAL CONSTRAINTS (HIGH PRIORITY):
The masked region overlaps these body parts: ${parts}. ${boundary}
- Generated content MUST follow the existing skeletal and muscular structure visible at the mask boundary edges.
- Do NOT generate a torso, secondary face, or unrelated body part inside the masked area. Preserve overall anatomy.
- When using a reference image, WARP and DEFORM it to follow the underlying anatomy's perspective, curvature, and limb orientation. Do NOT paste the reference verbatim.
- Match the masked body part's actual proportions, skin tone (if visible at edges), and pose of the original subject.`;
        })()
        : '';

    // ── Scene context constraints (perspective/lighting/material) ──
    const sceneOn = sceneAwareEnabled !== false;
    const sceneBlock = (sceneOn && sceneContext && (sceneContext.perspectiveHint || sceneContext.lightingHint || sceneContext.materialHint || sceneContext.sceneType !== 'unknown'))
        ? `\n\nSCENE CONTEXT (HIGH PRIORITY):
- Scene type: ${sceneContext.sceneType}.
${sceneContext.perspectiveHint ? `- Perspective: ${sceneContext.perspectiveHint}.\n` : ''}${sceneContext.lightingHint ? `- Lighting: ${sceneContext.lightingHint}.\n` : ''}${sceneContext.materialHint ? `- Material at boundary: ${sceneContext.materialHint}.\n` : ''}- All generated content MUST match these scene properties so the result is visually indistinguishable from the original capture.`
        : '';

    // ── Variation strength block (only meaningful when user prompt empty + refs provided) ──
    const trimmedPrompt = prompt.trim();
    const variationBlock = (!trimmedPrompt && hasReference && typeof variationStrength === 'number')
        ? `\n\nVARIATION STRENGTH: ${variationStrength.toFixed(2)} (0.0 = preserve reference faithfully, 1.0 = creative reinterpretation).
The user did not provide a text prompt. Re-interpret the reference imagery to fit the anatomical and scene context above with a deviation magnitude of ${(variationStrength * 100).toFixed(0)}%.`
        : '';

    const modeInstruction = effectiveMode === 'remove'
        ? `TASK: Treat this as if the user said: "Please remove the object inside the highlighted area in Image 1, and naturally restore the scene as if that object had never existed." The white pixels in Image 2 are a HIGHLIGHT HINT showing the region of interest — NOT a literal hole to fill with empty content.

INTERPRETATION:
- Image 1 is the FULL ORIGINAL SCENE. Use the ENTIRE image as context — not only the cropped region near the mask.
- Image 2 is a Region-of-Interest hint: pixels inside the white area are what the user wants gone.
- Your job: re-render the image with that object/content removed, intelligently inferring what was behind/around it from the full surrounding scene.

REMOVAL RULES:
- Reason about what would naturally be there if the object never existed (background continuation, ground plane, sky, walls, environment, etc.).
- Reconstruct it with photorealistic seamless detail — continue patterns, textures, shadows, reflections, and depth.
- Match lighting direction, ambient color temperature, shadow softness, and perspective EXACTLY with surrounding pixels.
- If the masked region overlaps structured patterns (tiles, bricks, fabric, foliage), continue the pattern coherently across the boundary.
- Cast/remove shadows and reflections of the removed object across the scene if they extend outside the mask.
- Avoid any "blanked", "blurred", "smudged", or "patched" appearance. The result must look like a NEW PHOTO of the scene without the object.
- Pixels OUTSIDE the white area must be preserved pixel-for-pixel — only the highlighted region's content changes.${trimmedPrompt ? `\n- Additional scene hint from user: ${trimmedPrompt}` : ''}`
        : `Insert/Generate the requested content within the white-masked area, blending seamlessly with the surrounding scene. The white area must be the ONLY modified region. Request: "${prompt || (hasReference ? 'Use the provided Reference Images to fill the masked area, matching their style and details, while strictly respecting the anatomical and scene constraints above.' : 'Fill the masked area contextually, blending seamlessly with the surrounding image.')}"${hasReference ? ' Reference images are provided per the mapping above.' : ''}`;

    const inpaintPrompt = `Image 1 = Main Image. Image 2 = Mask (WHITE = edit area, BLACK = preserve pixel-for-pixel).${refSection}${anatomyBlock}${sceneBlock}${variationBlock}

ABSOLUTE RULES:
1. BLACK area of the mask must be preserved pixel-for-pixel — do NOT modify a single pixel outside the white region.
2. The white area is the ONLY region you may modify.
3. Do NOT change the overall composition, camera angle, perspective, or layout of the image. Only the masked region content may change.

${modeInstruction}

${styleHint}`;

    parts.push({ text: inpaintPrompt });

    // ── Step 7: 진단 로깅 ────────────────────────────────────────────────────
    console.info('[inpaint] request', {
        model: modelName,
        partsCount: parts.length,
        refsCount: referenceImages?.length ?? 0,
        refsWithMaskCount,
        mode: effectiveMode,
        workType,
        anatomyInjected: !!anatomyBlock,
        sceneInjected: !!sceneBlock,
        variationInjected: !!variationBlock,
        sceneType: sceneContext?.sceneType,
        bodyParts: sceneContext?.anatomy.bodyParts.map(b => b.part),
    });

    try {
        const config: any = {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
                imageOutputOptions: { mimeType: "image/png" },
                personGeneration: "ALLOW_ALL"
            }
        };

        if (resolution && resolution !== 'auto') {
            config.imageConfig.imageSize = resolution.toUpperCase();
        }

        if (aspectRatio && aspectRatio !== 'auto') {
            config.imageConfig.aspectRatio = aspectRatio;
        }

        let response: any;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            if (signal.aborted) throw new Error('error.cancelled');
            try {
                ({ response } = await api.generateContentUnified(modelName, { parts }, config, signal));
                break;
            } catch (err: any) {
                if (signal.aborted) throw new Error('error.cancelled');
                const is503 = err.status === 503 ||
                    (err.error && err.error.code === 503) ||
                    (err.message && (err.message.includes('503') || err.message.includes('overloaded')));

                if (is503 && retryCount < maxRetries) {
                    retryCount++;
                    console.warn(`[inpaint] Gemini API 503 (Attempt ${retryCount}/${maxRetries}). Retrying in ${retryCount * 2}s...`);
                    await new Promise<void>((resolve, reject) => {
                        const timer = setTimeout(resolve, 2000 * retryCount);
                        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('error.cancelled')); }, { once: true });
                    });
                } else {
                    throw err;
                }
            }
        }

        return api.processImageEditResponse(response, signal);
    } catch (e) {
        console.error('[inpaint] failed', e);
        return api.handleApiError(e);
    }
};

export const generatePbrMap = (image: { data: string, mimeType: string }, modelName: string, signal: AbortSignal, resolution?: Resolution, aspectRatio?: AspectRatio, customPrompt?: string, fluxOptions?: FluxOpts, openAIOptions?: OpenAIOpts): Promise<string[]> => {
    let prompt = 'Generate a PBR map from this image.';
    if (customPrompt && customPrompt.trim()) {
        prompt = customPrompt.trim();
    }
    return api.callImageEditModel(image, prompt, modelName, signal, resolution, aspectRatio, fluxOptions, openAIOptions);
};

export const extractPoseImage = (image: { data: string, mimeType: string }, modelName: string, signal: AbortSignal, resolution?: Resolution, aspectRatio?: AspectRatio, fluxOptions?: FluxOpts, openAIOptions?: OpenAIOpts): Promise<string[]> => {
    const prompt = 'Generate a simple grey 3D mannequin in the exact same pose as the reference image. White background';
    return api.callImageEditModel(image, prompt, modelName, signal, resolution, aspectRatio, fluxOptions, openAIOptions);
};

export const extractOutfitImage = (image: { data: string, mimeType: string }, modelName: string, signal: AbortSignal, resolution?: Resolution, aspectRatio?: AspectRatio, gridLayout: GridLayout | null = null, fluxOptions?: FluxOpts, openAIOptions?: OpenAIOpts): Promise<string[]> => {
    const SUFFIX = `\nUnreal Engine 5 style render, volumetric lighting on fabrics, clear seam lines, studio lighting.`;
    const CONSTRAINT = `\n**Strict Constraint:** NO SKIN, NO FACES, NO BODY PARTS visible. Only clothing and accessories.`;
    const BG = `Background: Neutral Grey (Hex #808080) studio background.`;

    let prompt: string;

    if (gridLayout === null) {
        // Single — Ghost Mannequin flat-lay
        prompt = `<instruction>
Analyze the character's outfit. Deconstruct the outfit into its individual components (Top, Bottom, Outerwear, Shoes, Accessories).
Create a "Ghost Mannequin" style product display where each item is SEPARATED and ARRANGED NEATLY on the screen.
The clothes should retain their 3D volume and shape as if worn (invisible mannequin), but they must be placed side-by-side or in a grid layout, NOT worn together as one piece.
Think of it as a high-end online fashion store product page showing all items included in the set.
${BG}

**Display Requirements:**
- **Separation:** Every item (Shirt, Pants, Coat, Boots, Gloves) must be spatially separated with clear gaps between them.
- **Arrangement:** Organize them neatly (Knolling style or clean grid).
- **Presentation:** Front-facing view for all items.
- **Volume:** Maintain 3D volume (Ghost Mannequin effect), do not flatten them.
- **Completeness:** Include all parts of the outfit visible in the reference.
${CONSTRAINT}
</instruction>

A professional ghost mannequin clothing set display, separated items, product photography.${SUFFIX}`;

    } else if (gridLayout === '1x2' || gridLayout === '2x1') {
        const layout = gridLayout === '1x2' ? '1×2 grid (1 row, 2 columns side by side)' : '2×1 grid (2 rows, 1 column stacked)';
        const cell1dir = gridLayout === '1x2' ? 'Left cell' : 'Top cell';
        const cell2dir = gridLayout === '1x2' ? 'Right cell' : 'Bottom cell';
        prompt = `<instruction>
Analyze the character's outfit and create a ${layout} clothing breakdown.
${BG}

**${cell1dir} — Upper Body:**
Show the primary upper body clothing (top, shirt, armor torso, vest) AND any outerwear (coat, jacket, cloak) as Ghost Mannequin items floating in the cell. Front-facing view, 3D volume maintained.

**${cell2dir} — Lower Body & Footwear:**
Show the bottom clothing (trousers, skirt, shorts) AND footwear (boots, shoes) as Ghost Mannequin items floating in the cell. Maintain 3D volume and show front-facing view.

**Layout:** Arrange both cells in a uniform ${layout} with no borders, gaps, or margins between cells. Each cell has equal dimensions.
${CONSTRAINT}
</instruction>

A professional 2-cell clothing asset breakdown.${SUFFIX}`;

    } else if (gridLayout === '1x3' || gridLayout === '3x1') {
        const layout = gridLayout === '1x3' ? '1×3 grid (1 row, 3 columns side by side)' : '3×1 grid (3 rows, 1 column stacked)';
        const [c1, c2, c3] = gridLayout === '1x3'
            ? ['Left cell', 'Center cell', 'Right cell']
            : ['Top cell', 'Middle cell', 'Bottom cell'];
        prompt = `<instruction>
Analyze the character's outfit and create a ${layout} clothing breakdown.
${BG}

**${c1} — Upper Body (Top & Outerwear):**
Show the primary upper body clothing (shirt, armor torso, vest) as Ghost Mannequin. If outerwear (coat, jacket, cloak) exists, include it alongside. Front-facing, 3D volume maintained.

**${c2} — Waist & Legs:**
Show the bottom clothing (trousers, skirt, shorts) AND belt or waist accessories as Ghost Mannequin items. Maintain 3D volume, front-facing view.

**${c3} — Footwear & Accessories:**
Show footwear (boots, shoes) pair in 3/4 view, plus any small accessories (gloves, jewelry, badges) arranged neatly beside them.

**Layout:** Arrange all three cells in a uniform ${layout} with no borders, gaps, or margins between cells. Each cell has equal dimensions.
${CONSTRAINT}
</instruction>

A professional 3-cell clothing asset breakdown.${SUFFIX}`;

    } else if (gridLayout === '2x2') {
        prompt = `<instruction>
Analyze the character's outfit and create a 2×2 grid clothing breakdown (4 cells total).
${BG}

**Cell [Row 1, Col 1] — Top/Torso:** The primary upper body clothing (shirt, armor torso, vest) as a Ghost Mannequin item. Front-facing view, show neckline and chest details.
**Cell [Row 1, Col 2] — Outerwear:** Coat, jacket, or cloak as a Ghost Mannequin item. If no outerwear, show the back view of the top instead.
**Cell [Row 2, Col 1] — Bottom/Legs:** Trousers, skirt, or shorts as a Ghost Mannequin item. Show knee structure and front silhouette.
**Cell [Row 2, Col 2] — Footwear & Accessories:** Boots or shoes pair standing, plus any small accessories (belt, gloves, jewelry) arranged neatly beside them.

**Layout:** Arrange all four items in a uniform 2×2 grid with no borders, gaps, or margins. Each cell must have equal dimensions.
${CONSTRAINT}
</instruction>

A professional 2×2 clothing asset sheet.${SUFFIX}`;

    } else if (gridLayout === '2x3') {
        prompt = `<instruction>
Analyze the character's outfit and create a 2×3 grid clothing breakdown (6 cells total, 2 rows × 3 columns).
${BG}

**Row 1:**
- Cell [1,1] — Main Top/Torso (Front): Primary upper body clothing, Ghost Mannequin, front view.
- Cell [1,2] — Shoulder Pad/Pauldron: A single shoulder piece isolated in 3/4 view, OR belt/waist accessory if no shoulder armor.
- Cell [1,3] — Outerwear (Back): Coat or cloak shown from the back, OR outerwear front if back is less distinctive, OR headgear if present.

**Row 2:**
- Cell [2,1] — Belt & Waist: Belt assembly floating, showing buckle and waist details.
- Cell [2,2] — Bottom/Pants (Front): Trousers or skirt, Ghost Mannequin, front view with volume.
- Cell [2,3] — Boots (3/4 View): Footwear pair shown from a 3/4 angle, showing overall shape and design details.

**Layout:** Arrange all 6 items in a uniform 2×3 grid (2 rows, 3 columns) with no borders, gaps, or margins. Equal cell dimensions.
${CONSTRAINT}
</instruction>

A professional 2×3 clothing asset breakdown sheet.${SUFFIX}`;

    } else if (gridLayout === '3x2') {
        prompt = `<instruction>
Analyze the character's outfit and create a 3×2 grid clothing breakdown (6 cells total, 3 rows × 2 columns).
${BG}

**Row 1:**
- Cell [1,1] — Main Top/Torso: Primary upper body clothing as Ghost Mannequin, front-facing.
- Cell [1,2] — Outerwear/Coat: Jacket, coat, or cloak as Ghost Mannequin. Use back view of top if no outerwear.

**Row 2:**
- Cell [2,1] — Belt & Waist Decoration: Belt assembly with buckle, pouches, and waist accessories.
- Cell [2,2] — Bottom/Pants: Trousers or skirt as Ghost Mannequin, front view showing silhouette.

**Row 3:**
- Cell [3,1] — Boots/Footwear: A pair of boots or shoes in 3/4 view showing design details.
- Cell [3,2] — Accessories: Gloves, shoulder pads, jewelry, or other small accessories arranged neatly.

**Layout:** Arrange all 6 items in a uniform 3×2 grid (3 rows, 2 columns) with no borders, gaps, or margins. Equal cell dimensions.
${CONSTRAINT}
</instruction>

A professional 3×2 clothing asset breakdown sheet.${SUFFIX}`;

    } else {
        // 3x3 — full 9-cell breakdown
        prompt = `<instruction>
Analyze the character's outfit. Isolate the clothing items from the human body entirely.
Create a 3×3 "Game Asset Breakdown" grid displaying the clothing parts as standalone 3D objects.
Use the "Ghost Mannequin" effect: The clothes should retain their 3D volume and shape as if worn, but the human body is invisible.
${BG}

**Row 1 (Upper Body & Head Options):**
1. **Main Top/Torso (Front):** The primary upper body clothing floating frontally. Show neckline and chest details.
2. **Shoulder Pad/Pauldron:** A single shoulder armor piece or pad isolated in 3/4 view.
3. **Alternative Slot (Back/Coat/Head):** EITHER the Outerwear (Coat/Cloak), OR the Back View of the top, OR the Headgear. Choose the most distinct element.

**Row 2 (Waist, Legs & Arms):**
4. **Belt & Waist Decoration:** The belt assembly floating in a circle. Show buckle, pouches, and hanging details.
5. **Bottoms/Pants (Front):** Trousers or skirt floating with leg volume. Show knee structure clearly.
6. **Gloves/Gauntlets:** A pair of gloves or arm bracers floating. Show back-of-hand design.

**Row 3 (Footwear & Accessories):**
7. **Boots (3/4 View):** A pair of boots standing. Show overall shape, laces, and ankle protection.
8. **Underside Detail (Sole/Palm):** A boot tilted to show tread pattern, OR a glove turned to show palm grip.
9. **Accessories/Ornaments:** Isolated small details — necklaces, badges, jewelry, or holsters arranged neatly.

**Layout:** Arrange all 9 items in a uniform 3×3 grid with no borders, gaps, or margins between cells. Equal cell dimensions.
${CONSTRAINT}
</instruction>

A professional 3×3 clothing asset sheet.
**Top Row:** Main Top Front, Isolated Shoulder Pad, Outerwear OR Top Back OR Headgear.
**Middle Row:** Belt Assembly, Pants Front, Gloves pair.
**Bottom Row:** Boots 3/4 view, Boot Sole or Glove Palm detail, Isolated Accessories.${SUFFIX}`;
    }

    return api.callImageEditModel(image, prompt, modelName, signal, resolution, aspectRatio, fluxOptions, openAIOptions);
};

const CAMERA_PRESERVE_PREFIX =
    "카메라 유지. **CRITICAL: Maintain the EXACT same camera angle, shooting distance, " +
    "viewing direction, and overall composition as the original image. " +
    "Do not alter the framing, perspective, or field of view in any way. " +
    "The character's body pose and limb positions must also remain unchanged.**";

export const getAutoColoringPrompt = (intensity: number): string => {
    const prefix = CAMERA_PRESERVE_PREFIX + "\n\n";
    switch (intensity) {
        case 1: return prefix +
            "Apply a rough pencil sketch coloring style in the manner of yoshida akihiko. " +
            "Use soft, desaturated color washes with visible pencil grain and hatching. " +
            "Keep the illustration feel — do not add photorealistic detail.";
        case 2: return prefix +
            "Re-color this character with intricate material textures and subtle environmental " +
            "reflections. Apply the illustration style of yoshida akihiko: slightly stylized " +
            "shading, visible brush texture, and muted but intentional color palette. " +
            "Add fabric weave, leather grain, or metal sheen to each material zone as appropriate.";
        case 3: return prefix +
            "Apply a fully rendered, high-quality illustration coloring in the style of Adam Hughes. " +
            "Use rich, luminous color with precise specular highlights on all surfaces. " +
            "Render fabric folds with detailed light and shadow, and give metallic parts " +
            "sharp chrome-like reflections. Overall finish should be polished and print-ready.";
        case 4: return prefix +
            "Render this as a photorealistic photograph — the quality of a cinematic movie still " +
            "or high-end editorial photo. Apply photorealistic materials: natural fabric textures, " +
            "metallic sheen on accessories, realistic skin tones and surface detail. " +
            "Cinematic lighting with a soft key light, subtle rim accent, and natural ambient fill. " +
            "Film-grade color grading, sharp focus with natural depth of field. " +
            "Photorealistic masterwork, hyper-detailed, indistinguishable from a real photograph, " +
            "award-winning cinematography.";
        case 5: return prefix +
            "Create a stunning full-body photoshoot of a real model cosplaying this character. " +
            "Recreate every costume element in real fabric, accessories, and makeup. " +
            "Professional photography lighting: dramatic key light with colored rim accents. " +
            "Film-like cinematic feel, location photoshoot backdrop. " +
            "Photorealistic masterwork, indistinguishable from reality, hyper-detailed and " +
            "extremely sharp focus, film-grade color grading, Unreal Engine 5, award-winning photography.";
        default: return prefix +
            "Add fine details to maximize the sense of materiality and more precisely express " +
            "the interplay of light and shadow. 8K, advanced material definition, " +
            "complex light interplay, volumetric lighting, precise shadow casting, " +
            "ultra-realistic render. Adam Hughes style illustration.";
    }
};

export const getVariationPrompt = (level: number, customPrompt?: string, gridLayout: GridLayout | null = null): string => {
    const poseAndCameraConstraint = "**CRITICAL: Maintain the EXACT same pose, body position, and camera angle as the original image.** Do not change the character's posture, limb positions, or viewing angle.";
    const singleInstruction = "Generate a single high-quality";

    let gridInstruction: string;
    let gridPoseConstraint: string;

    switch (gridLayout) {
        case '1x2':
            gridInstruction = "Present the output as a 1×2 grid display (1 row, 2 columns) showing two";
            gridPoseConstraint = "**CRITICAL for both cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image. (2) Maintain the EXACT same body pose and limb positions. (3) Each cell must have the exact same aspect ratio as the original input image.** Arrange both variations in a uniform 1×2 grid (1 row, 2 columns) with no borders, gaps, or margins between cells.";
            break;
        case '2x1':
            gridInstruction = "Present the output as a 2×1 grid display (2 rows, 1 column) showing two";
            gridPoseConstraint = "**CRITICAL for both cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image. (2) Maintain the EXACT same body pose and limb positions. (3) Each cell must have the exact same aspect ratio as the original input image.** Arrange both variations in a uniform 2×1 grid (2 rows, 1 column) with no borders, gaps, or margins between cells.";
            break;
        case '1x3':
            gridInstruction = "Present the output as a 1×3 grid display (1 row, 3 columns) showing three";
            gridPoseConstraint = "**CRITICAL for all three cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image. (2) Maintain the EXACT same body pose and limb positions. (3) Each cell must have the exact same aspect ratio as the original input image.** Arrange all three variations in a uniform 1×3 grid (1 row, 3 columns) with no borders, gaps, or margins between cells.";
            break;
        case '3x1':
            gridInstruction = "Present the output as a 3×1 grid display (3 rows, 1 column) showing three";
            gridPoseConstraint = "**CRITICAL for all three cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image. (2) Maintain the EXACT same body pose and limb positions. (3) Each cell must have the exact same aspect ratio as the original input image.** Arrange all three variations in a uniform 3×1 grid (3 rows, 1 column) with no borders, gaps, or margins between cells.";
            break;
        case '2x2':
            gridInstruction = "Present the output as a 2×2 grid display showing four";
            gridPoseConstraint = "**CRITICAL for all four cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image — do NOT zoom in/out or change the framing. (2) Maintain the EXACT same body pose and limb positions as the original image. (3) Each cell must have the exact same aspect ratio (width-to-height proportion) as the original input image.** Arrange all four variations in a uniform 2×2 grid with no borders, gaps, or margins between cells.";
            break;
        case '2x3':
            gridInstruction = "Present the output as a 2×3 grid display (2 rows, 3 columns) showing six";
            gridPoseConstraint = "**CRITICAL for all six cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image. (2) Maintain the EXACT same body pose and limb positions. (3) Each cell must have the exact same aspect ratio as the original input image.** Arrange all six variations in a uniform 2×3 grid (2 rows, 3 columns) with no borders, gaps, or margins between cells.";
            break;
        case '3x2':
            gridInstruction = "Present the output as a 3×2 grid display (3 rows, 2 columns) showing six";
            gridPoseConstraint = "**CRITICAL for all six cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image. (2) Maintain the EXACT same body pose and limb positions. (3) Each cell must have the exact same aspect ratio as the original input image.** Arrange all six variations in a uniform 3×2 grid (3 rows, 2 columns) with no borders, gaps, or margins between cells.";
            break;
        case '3x3':
            gridInstruction = "Present the output as a 3×3 grid display showing nine";
            gridPoseConstraint = "**CRITICAL for all nine cells: (1) Maintain the EXACT same camera angle, shooting distance, and viewing direction as the original image. (2) Maintain the EXACT same body pose and limb positions. (3) Each cell must have the exact same aspect ratio as the original input image.** Arrange all nine variations in a uniform 3×3 grid with no borders, gaps, or margins between cells.";
            break;
        default:
            // null — single output, no grid
            gridInstruction = '';
            gridPoseConstraint = '';
    }

    const multiPrompts: Record<number, string> = {
        1: `Make subtle design variations, staying very close to the original image's style, color, and composition. ${gridPoseConstraint} ${gridInstruction} subtly varied design iterations.`,
        2: `Introduce subtle design freshness. Keep the overall geometry and proportions exactly as they are. Focus on updating small component shapes, functional details, or specific surface finishes to add a touch of novelty without altering the main look. ${gridPoseConstraint} ${gridInstruction} subtly different variations.`,
        3: `Create noticeable design alternatives. Maintain the core visual identity and color scheme, but actively vary specific design components. You can modify the construction lines, segmentation patterns, or aesthetic accent elements to propose distinct but consistent design variations. ${gridPoseConstraint} ${gridInstruction} distinct but balanced design options.`,
        4: `Make highly creative and imaginative design variations, using the original image as loose inspiration. Feel free to reinterpret the subject, style, and composition. ${gridPoseConstraint} ${gridInstruction} creatively reinterpreted design options.`,
        5: `Explore diverse design interpretations. Use the original image as a reference for the subject matter only. Feel free to significantly alter the form language, compositional structure, and volumetric flow to present fresh and unique design approaches. ${gridPoseConstraint} ${gridInstruction} diverse and unique design options.`
    };

    const singlePrompts: Record<number, string> = {
        1: `Make a subtle design variation, staying very close to the original image's style, color, and composition. ${poseAndCameraConstraint} ${singleInstruction} refined variation.`,
        2: `Introduce subtle design freshness. Keep the overall geometry and proportions exactly as they are. Focus on updating small component shapes, functional details, or specific surface finishes to add a touch of novelty without altering the main look. ${poseAndCameraConstraint} ${singleInstruction} refined variation.`,
        3: `Create a noticeable design alternative. Maintain the core visual identity and color scheme, but actively vary specific design components. You can modify the construction lines, segmentation patterns, or aesthetic accent elements to propose a distinct but consistent design variation. ${poseAndCameraConstraint} ${singleInstruction} balanced design alternative.`,
        4: `Make a highly creative and imaginative design variation, using the original image as loose inspiration. Feel free to reinterpret the subject, style, and composition while keeping the pose intact. ${poseAndCameraConstraint} ${singleInstruction} creative reinterpretation.`,
        5: `Explore a diverse design interpretation. Use the original image as a reference for the subject matter only. Feel free to significantly alter the form language, compositional structure, and volumetric flow to present a fresh and unique design approach. ${poseAndCameraConstraint} ${singleInstruction} unique design interpretation.`
    };

    const prompts = gridLayout === null ? singlePrompts : multiPrompts;
    let prompt = prompts[level] || prompts[3];

    if (customPrompt && customPrompt.trim()) {
        prompt += `\n\nAdditional user instruction: ${customPrompt.trim()}`;
    }
    return prompt;
};

/**
 * 다중 그리드 생성 지시문을 반환합니다.
 * variation/extractOutfit 이외의 모든 생성 경로에 프롬프트 끝에 append하여 사용합니다.
 * gridLayout === null이면 빈 문자열을 반환합니다 (단일 출력 모드).
 */
export const buildGridInstruction = (gridLayout: GridLayout | null): string => {
    if (!gridLayout) return '';
    const [rows, cols] = gridLayout.split('x').map(Number);
    const count = rows * cols;
    return `\n\n**[MULTI-GRID OUTPUT — MANDATORY]**\nGenerate a SINGLE image composed of a ${rows}×${cols} grid (${count} equal cells). Each cell must present a distinct variation of the requested output — same subject and style, but with varied details, color choices, or compositional nuances. Layout constraints:\n- Exactly ${rows} row(s) × ${cols} column(s)\n- No borders, gaps, labels, or margins between cells\n- Each cell has equal dimensions and the same aspect ratio\n- Overall image aspect ratio equals the per-cell ratio`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Reference & Camera hint helpers for autoColoring / variation
// ─────────────────────────────────────────────────────────────────────────────

type RefWeight = {
    label: string;
    costume: string;
    general: string;
    fallback: string;
};

/**
 * 멀티이미지 API 호출 시 각 이미지의 역할을 명시적으로 할당하는 preamble.
 * 원본 이미지가 피사체이고 참조 이미지는 텍스처/소재 레퍼런스임을 모델에게 명확히 전달.
 */
export const buildImageContextPreamble = (refCount: number): string => {
    const refRange = refCount === 1 ? 'Position 2' : `Positions 2–${refCount + 1}`;
    return [
        `**IMAGE ROLE ASSIGNMENT:**`,
        `- Position 1 (ORIGINAL SUBJECT): The primary character/design to be processed. Preserve their identity, face, body structure, pose, outfit silhouette, and overall composition EXACTLY. This is the BASE — all generation output must be built upon this image's character and design.`,
        `- ${refRange} (MATERIAL/TEXTURE REFERENCE): These images provide surface material vocabulary ONLY. Extract texture and material qualities from them as instructed below. DO NOT adopt: character designs, outfit shapes, silhouettes, body types, facial features, compositional layouts, or narrative content from these reference image(s).`,
    ].join('\n');
};

const VARIATION_REF_WEIGHTS: Record<number, RefWeight> = {
    1: {
        label: "Minimal Color Echo (1/5)",
        costume:
            "From the costume reference(s): extract COLOR TEMPERATURE and TONAL MOOD only " +
            "(warm/cool shift, dominant hue family). Apply as a subtle color atmosphere to the " +
            "original character's existing outfit. DO NOT extract or adopt: material textures, " +
            "garment structure, seam logic, silhouette, or any design elements.",
        general:
            "From the general reference(s): extract COLOR TEMPERATURE and TONAL MOOD only. " +
            "Apply as a gentle atmospheric color shift to the original subject's rendering. " +
            "No structural, textural, or compositional changes.",
        fallback:
            "From the reference(s): extract the dominant color temperature and tonal quality only. " +
            "Apply as a minimal color mood echo. No textural or structural influence.",
    },
    2: {
        label: "Surface Texture (2/5)",
        costume:
            "From the costume reference(s): extract SURFACE TEXTURE and MATERIAL FINISH only — " +
            "fabric weave density, thread quality, material sheen level (matte/semi-gloss/metallic). " +
            "Apply these surface properties to the original character's EXISTING outfit areas " +
            "without changing the outfit's structure, silhouette, or design elements.",
        general:
            "From the general reference(s): extract RENDERING STYLE only — line weight character, " +
            "shadow softness, highlight quality, edge treatment. Apply to the original subject's " +
            "rendering without altering its composition or content.",
        fallback:
            "From the reference(s): extract surface texture quality and rendering approach. " +
            "Apply to the original's existing surfaces without structural changes.",
    },
    3: {
        label: "Material Integration (3/5)",
        costume:
            "From the costume reference(s): extract the MATERIAL VOCABULARY — fabric texture system " +
            "(weave patterns, grain, nap), surface finish range (matte/sheen/metallic zones), " +
            "color palette relationships, and material weight impression. Integrate these properties " +
            "into the original character's existing costume surfaces while PRESERVING the original's " +
            "outfit structure, silhouette shape, and garment type completely.",
        general:
            "From the general reference(s): extract the VISUAL LANGUAGE — rendering technique, " +
            "color system, surface treatment approach, atmospheric quality. Express the original " +
            "subject through this visual register without modifying the original's content, " +
            "structure, or compositional identity.",
        fallback:
            "From the reference(s): extract the material texture system and visual language. " +
            "Integrate into the original's surfaces and rendering while preserving its structural " +
            "design and character identity.",
    },
    4: {
        label: "Rich Material Adoption (4/5)",
        costume:
            "From the costume reference(s): extensively adopt the MATERIAL SYSTEM — full fabric " +
            "texture vocabulary (weave structures, material layering, surface finishes, hardware " +
            "and trim material details), color relationships, and construction rendering philosophy. " +
            "Apply richly across the original character's costume. The reference's MATERIAL QUALITIES " +
            "must be clearly and extensively present. PRESERVE: the original outfit's silhouette shape, " +
            "garment type, layering structure, and the character's identity.",
        general:
            "From the general reference(s): extensively adopt the AESTHETIC SYSTEM — full rendering " +
            "approach, color world, surface quality range, and visual atmosphere. Express the original " +
            "subject comprehensively through the reference's visual language.",
        fallback:
            "From the reference(s): extensively adopt the material qualities and aesthetic system. " +
            "Apply fully across the original while preserving its fundamental character structure and identity.",
    },
    5: {
        label: "Maximum Material (5/5)",
        costume:
            "From the costume reference(s): adopt the COMPLETE MATERIAL VOCABULARY as the primary " +
            "surface driver — every fabric texture (weave, finish, weathering), hardware and accessory " +
            "material language, color tonal structure, and surface treatment visible in the reference. " +
            "Apply maximally across all of the original character's costume surfaces. The reference " +
            "MATERIAL SYSTEM fully dictates surface expression. PRESERVE ONLY: the original's outfit " +
            "SILHOUETTE and CHARACTER IDENTITY (face, body). All surface and material qualities come " +
            "from the reference.",
        general:
            "From the general reference(s): adopt the COMPLETE AESTHETIC SYSTEM maximally — full " +
            "rendering technique, color world, surface treatment, and visual atmosphere. Express the " +
            "original subject entirely through the reference's visual system. Preserve only the " +
            "original character's identity and fundamental subject matter.",
        fallback:
            "From the reference(s): adopt the complete material and aesthetic system maximally. " +
            "Reference drives all surface and visual expression. Preserve only the original " +
            "character's identity and fundamental structure.",
    },
};

export const buildAutoColoringReferenceHint = (
    textureImages: Array<{ referenceType?: string }>
): string => {
    const preamble = buildImageContextPreamble(textureImages.length);
    const costumeRefs = textureImages.filter(t => t.referenceType === 'costume');
    const generalRefs = textureImages.filter(t => t.referenceType === 'general');

    const instructions: string[] = [`**TEXTURE EXTRACTION INSTRUCTIONS (Auto-Coloring):**`];

    if (costumeRefs.length > 0) {
        instructions.push(
            `From costume reference(s): Extract SURFACE MATERIAL PROPERTIES only — fabric texture ` +
            `(weave pattern, thread density, nap direction, grain character), material finish ` +
            `(matte/sheen/metallic/glossy distribution), and color temperature. Apply these surface ` +
            `properties to the original character's EXISTING outfit surfaces without altering the ` +
            `outfit's structure, silhouette, or design elements.`
        );
    }
    if (generalRefs.length > 0) {
        instructions.push(
            `From general reference(s): Extract RENDERING STYLE only — line quality, shadow rendering ` +
            `technique, highlight treatment, color temperature, and surface finish character. Apply this ` +
            `visual language to the original subject without modifying its content, structure, or composition.`
        );
    }
    if (costumeRefs.length === 0 && generalRefs.length === 0) {
        instructions.push(
            `From reference image(s): Extract surface texture, material finish, and rendering style. ` +
            `Apply these qualities to the original subject's existing surfaces without altering its ` +
            `design or structure.`
        );
    }

    return [preamble, instructions.join('\n')].join('\n\n');
};

export const buildAutoColoringRenderingHint = (intensity: number): string => {
    const styleMap: Record<number, string> = {
        1: "Render the output in a rough pencil sketch style (Yoshida Akihiko-style loose linework, soft desaturated washes). This is the rendering medium for the variation result.",
        2: "Render the output with intricate material textures: visible fabric weave, leather grain, metal sheen. The variation result should appear as a richly detailed illustration.",
        3: "Render the output as a fully rendered, high-quality illustration (Adam Hughes style) with precise highlights and professional coloring.",
        4: "Render the output as a photorealistic collectible figure — painted plastic, chrome, sculpted materials with studio lighting.",
        5: "Render the output as a photorealistic cosplay photograph of a real model with professional photography lighting and physical material accuracy.",
    };
    return `**Rendering Medium (AutoColoring Level ${intensity}):**\n${styleMap[intensity] ?? styleMap[3]}`;
};

export const buildVariationReferenceHint = (
    textureImages: Array<{ referenceType?: string }>,
    level: number = 3
): string => {
    const preamble = buildImageContextPreamble(textureImages.length);
    const clampedLevel = Math.max(1, Math.min(5, Math.round(level)));
    const weight = VARIATION_REF_WEIGHTS[clampedLevel] ?? VARIATION_REF_WEIGHTS[3];
    const costumeCount = textureImages.filter(t => t.referenceType === 'costume').length;
    const generalCount = textureImages.filter(t => t.referenceType === 'general').length;
    const lines: string[] = [`**MATERIAL REFERENCE — ${weight.label}:**`];
    if (costumeCount > 0) lines.push(weight.costume);
    if (generalCount > 0) lines.push(weight.general);
    if (costumeCount === 0 && generalCount === 0) lines.push(weight.fallback);
    return [preamble, lines.join('\n')].join('\n\n');
};

export const buildCameraTabHint = (cameraView: Partial<SelectedView> | null | undefined): string => {
    if (!cameraView) return '';
    const view: SelectedView = {
        yaw: cameraView.yaw ?? 0,
        pitch: cameraView.pitch ?? 0,
        fov: cameraView.fov ?? 50,
        size: cameraView.size ?? CameraSize.Full,
        focalLength: cameraView.focalLength ?? 50,
        cameraAnglePreset: (cameraView.cameraAnglePreset as SelectedView['cameraAnglePreset']) ?? null,
        lensFocusPreset: (cameraView.lensFocusPreset as SelectedView['lensFocusPreset']) ?? null,
        shotSizePreset: (cameraView.shotSizePreset as SelectedView['shotSizePreset']) ?? null,
    };
    return buildCameraPrompt(view, { formatStyle: 'markdown' });
};

// Replaced autoColorImage/callImageEditModel specialized flows with unified prompt helpers above.
// Consumers should use processCharacterImage with these prompts.

export const generateAdvancedPbrMap = async (
    structureImage: { data: string, mimeType: string } | null,
    frontImage: { data: string, mimeType: string } | null,
    backImage: { data: string, mimeType: string } | null,
    mapTypes: string[],
    modelName: string,
    signal: AbortSignal,
    resolution?: Resolution,
    aspectRatio?: AspectRatio,
    customPrompt?: string
): Promise<string[]> => {
    if (!structureImage && !frontImage && !backImage) throw new Error('At least one source image is required');

    // Resolve Model ID
    // @ts-ignore
    const modelId = GEMINI_MODELS[modelName]?.id || modelName;

    // Sequential execution (limit=1) to avoid 429 rate limit errors
    const outcomes = await pLimit(mapTypes, async (mapType) => {
        const parts: any[] = [];
        let imageInstructions = "";

        // Add images with descriptive text
        if (structureImage) {
            parts.push({ inlineData: { data: structureImage.data, mimeType: structureImage.mimeType } });
            imageInstructions += "[Ref: Structure Image] This image provides the UV Layout and Geometry guidance.\n";
        }
        if (frontImage) {
            parts.push({ inlineData: { data: frontImage.data, mimeType: frontImage.mimeType } });
            imageInstructions += "[Ref: Front Concept] This image provides style/color reference for the Front view.\n";
        }
        if (backImage) {
            parts.push({ inlineData: { data: backImage.data, mimeType: backImage.mimeType } });
            imageInstructions += "[Ref: Back Concept] This image provides style/color reference for the Back view.\n";
        }

        const systemPrompt = `[Role] Professional 3D Texture Artist
[Task] Generate a high-quality ${mapType} texture map based on the provided references.

[CRITICAL INSTRUCTION]
Map the textures from the reference concept art (Front & Back) onto the corresponding UV islands provided in the structure image. Use the color information in the structure image to identify body parts and apply the correct reference texture. Strictly maintain the UV layout.

[Map Type] ${mapType} (Linear color space, flat lighting, seamless tiling if applicable).

[References Provided]
${imageInstructions}

[User Request] ${customPrompt || ''}`;

        parts.push({ text: systemPrompt });

        try {
            const config = {
                tools: [{ googleSearch: {} }],
            };

            const { response } = await api.generateContentUnified(modelId, [{ role: 'user', parts }], config);
            const urls = await api.processImageEditResponse(response, signal);
            return urls;
        } catch (e) {
            console.error(`Failed to generate ${mapType} map:`, e);
            return [] as string[];
        }
    }, 1);

    return outcomes.flat();
};

export const processCharacterImage = async (
    originalImage: { data: string, mimeType: string } | null,
    cameraView: SelectedView | null,
    selectedBodyParts: BodyPart[],
    bodyPartReferenceMap: Partial<Record<BodyPart, number>>,
    selectedClothingItems: ClothingItem[],
    selectedObjectItems: ObjectItem[],
    prompt: string,
    poseImage: { data: string, mimeType: string } | null,
    textureImages: ({ data: string; mimeType: string; referenceType?: 'general' | 'costume' | 'pose'; styleIntensity?: number } | null)[],
    backgroundImage: { data: string, mimeType: string } | null,
    selectedActionPose: ActionPose | null,
    useAposeForViews: boolean,
    isApplyingFullOutfit: boolean,
    isApplyingTop: boolean,
    isApplyingBottom: boolean,
    backgroundImageAspectRatio: number | string | null,
    modelName: string,
    signal: AbortSignal,
    lightDirection: { yaw: number; pitch: number; } | null,
    lightIntensity: number | null,
    maskImage: { data: string, mimeType: string } | null,
    selectedPalette: ColorPalette | null,
    numPaletteColors: number,
    isAutoColorizeSketch: boolean,
    resolution?: Resolution,
    aspectRatio?: AspectRatio,
    // 5단계 의상참조 합성
    synthesisControlMode?: 'original' | 'reference',
    originalPreservationLevel?: number,
    costumeCreativityLevel?: number,
    costumeBodyType?: 'slim' | 'average' | 'muscular' | 'curvy',
    costumeGender?: 'male' | 'female' | 'androgynous',
    thinkingLevel?: 'minimal' | 'high' | null,
    groundingTools?: Array<'googleSearch' | 'imageSearch'>,
    isPoseSketch?: boolean,
    fluxOptions?: { resolutionMP: '0.6' | '1' | '2' | '4'; promptUpsampling: boolean },
    openAIOptions?: OpenAIOpts
): Promise<string[]> => {
    // Route to external provider (OpenAI, Flux) if applicable
    const externalProvider = resolveProvider(modelName);
    if (externalProvider) {
        const params: ProcessImageParams = {
            originalImage,
            maskImage,
            prompt,
            textureImages: (textureImages as any[]).filter(Boolean),
            poseImage,
            backgroundImage,
            backgroundImageAspectRatio,
            poseControlImage: poseImage,
            cameraView,
            bodyPartReferenceMap: bodyPartReferenceMap as Record<BodyPart, number>,
            selectedClothingItems,
            selectedObjectItems,
            selectedActionPose,
            useAposeForViews,
            isApplyingFullOutfit,
            isApplyingTop,
            isApplyingBottom,
            lightDirection,
            lightIntensity,
            selectedPalette,
            numPaletteColors,
            isAutoColorizeSketch,
            modelName,
            signal,
            resolution,
            aspectRatio,
            synthesisControlMode,
            originalPreservationLevel,
            costumeCreativityLevel,
            costumeBodyType,
            costumeGender,
            thinkingLevel,
            groundingTools,
            isPoseSketch,
            fluxOptions,
            openAIOptions,
        };
        return externalProvider.generate(params, signal);
    }

    try {
        // Construct params object
        const params: ProcessImageParams = {
            originalImage,
            cameraView,
            // selectedBodyParts is not used in prompt builder directly, but bodyPartReferenceMap is
            bodyPartReferenceMap: bodyPartReferenceMap as Record<BodyPart, number>,
            selectedClothingItems,
            selectedObjectItems,
            prompt,
            poseImage,
            textureImages: textureImages as any[], // Type assertion needed as textureImages can contain nulls in signature but we filter them
            backgroundImage,
            selectedActionPose,
            useAposeForViews,
            isApplyingFullOutfit,
            isApplyingTop,
            isApplyingBottom,
            backgroundImageAspectRatio,
            modelName,
            signal,
            lightDirection,
            lightIntensity,
            maskImage,
            selectedPalette,
            numPaletteColors,
            isAutoColorizeSketch,
            resolution,
            aspectRatio,
            poseControlImage: poseImage, // In insertObject flow, poseImage is used as poseControlImage
            isPoseSketch,
            // 5단계 의상참조 합성
            synthesisControlMode,
            originalPreservationLevel,
            costumeCreativityLevel,
            costumeBodyType,
            costumeGender,
            thinkingLevel,
            groundingTools,
        };

        const { parts, config } = promptBuilder.buildCharacterGenerationRequest(params);

        console.log('[processCharacterImage] API Call Config:', {
            modelName,
            resolution,
            configSent: JSON.stringify(config, null, 2)
        });

        let retryCount = 0;
        const maxRetries = 3;
        let currentParts = parts;

        while (retryCount <= maxRetries) {
            if (signal.aborted) throw new Error('error.cancelled');
            try {
                const { response } = await api.generateContentUnified(modelName, { parts: currentParts }, config, signal);
                return api.processImageEditResponse(response, signal);
            } catch (err: any) {
                if (signal.aborted) throw new Error('error.cancelled');
                const is503 = err.status === 503 ||
                    (err.error && err.error.code === 503) ||
                    (err.message && (err.message.includes('503') || err.message.includes('overloaded')));
                const is429 = err.status === 429 ||
                    (err.error && err.error.code === 429) ||
                    (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('rate limit')));
                const isTextResponse = err instanceof Error && err.message === 'error.textResponse';
                const isNoImage = err instanceof Error && err.message === 'error.noImage';

                if (is429 && retryCount < maxRetries) {
                    retryCount++;
                    const delay = 15000 * retryCount; // 15s, 30s, 45s — Pro 모델 rate limit 여유분 확보
                    console.warn(`Gemini API 429 Rate Limit (Attempt ${retryCount}/${maxRetries}). Retrying in ${delay / 1000}s...`);
                    await new Promise<void>((resolve, reject) => {
                        const timer = setTimeout(resolve, delay);
                        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('error.cancelled')); }, { once: true });
                    });
                } else if (is503 && retryCount < maxRetries) {
                    retryCount++;
                    console.warn(`Gemini API 503 Error (Attempt ${retryCount}/${maxRetries}). Retrying in ${retryCount * 2}s...`);
                    await new Promise<void>((resolve, reject) => {
                        const timer = setTimeout(resolve, 2000 * retryCount);
                        signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('error.cancelled')); }, { once: true });
                    });
                } else if ((isTextResponse || isNoImage) && retryCount < maxRetries) {
                    retryCount++;
                    console.warn(`Model returned ${isNoImage ? 'no image' : 'text'} instead of image. Adding image-generation instruction and retrying (${retryCount}/${maxRetries})...`);
                    const delay = 5000 * retryCount; // 5s, 10s, 15s — rate limit 후 회복 여유
                    currentParts = [
                        { text: 'IMPORTANT: You must output an image directly. Do not ask questions. Do not output explanatory text. Generate the image now.' },
                        ...parts,
                    ];
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
        return api.handleApiError(e);
    }
};
