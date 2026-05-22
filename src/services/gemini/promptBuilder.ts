import { Part } from "@google/genai";
import { BodyPart, ChatMessage } from "../../types";
import { ProcessImageParams, ChatImage } from "./types";
import { OBJECT_ITEM_TO_CATEGORY_MAP } from "../../constants";
import { fileToBase64 } from "./imageUtils";
import { buildCameraPrompt } from "../cameraPromptHelper";

const getEnglishBodyPartName = (part: BodyPart): string => {
    switch (part) {
        case BodyPart.Face: return "the entire face";
        case BodyPart.Hair: return "the entire head including the face and hair";
        case BodyPart.Body: return "the entire torso area, from the neck to the waist";
        case BodyPart.Pelvis: return "the pelvis and hip area";
        case BodyPart.LeftShoulder: return "the left shoulder";
        case BodyPart.RightShoulder: return "the right shoulder";
        case BodyPart.LeftArm: return "the entire left arm, from shoulder to wrist";
        case BodyPart.RightArm: return "the entire right arm, from shoulder to wrist";
        case BodyPart.BothArms: return "both arms, from shoulders to wrists";
        case BodyPart.LeftHand: return "the left hand";
        case BodyPart.RightHand: return "the right hand";
        case BodyPart.BothHands: return "both hands";
        case BodyPart.LeftLeg: return "the entire left leg, from hip to ankle";
        case BodyPart.RightLeg: return "the entire right leg, from hip to ankle";
        case BodyPart.BothLegs: return "both legs, from hips to ankles";
        case BodyPart.LeftFoot: return "the left foot";
        case BodyPart.RightFoot: return "the right foot";
        case BodyPart.BothFeet: return "both feet";
        default: return part;
    }
};

const toOrdinal = (n: number): string => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// DELETED - Original Preservation Control Removed
// function getOriginalPreservationPrompt(level: number): string { ... }


// 5단계 참조 디자인 제어 프롬프트 생성 (Reference Design Control)
function getReferenceDesignPrompt(level: number | undefined, targetArea?: string): string {
    // 공통 시스템 프롬프트 (System Instruction)
    // If the target area includes the head (face/hair), the face constraint is lifted so the AI applies the design to the full head.
    const isHeadTarget = targetArea ? /head|face|hair/i.test(targetArea) : false;
    const preserveConstraint = isHeadTarget ? "body shape and pose" : "face, body shape, and pose";
    const baseRules = `"You are a Master Costume Designer. Constraint: DO NOT change the character's ${preserveConstraint}. Logic: Apply the Reference Outfit based on the cumulative logic defined below."`;

    // [FIX] Resolve target area: use provided value or default to full outfit
    const area = targetArea || 'the FULL OUTFIT';

    // [FIX] If level is undefined (disabled), use Standard Application mode.
    // This ensures Target Area instructions are always included.
    const effectiveLevel = level ?? 3;
    const isStandardMode = level === undefined;

    let prompt: string;

    if (isStandardMode) {
        prompt = `${baseRules}

**Mode: Standard Application**
* **Task:** Apply the Reference Design to the **[Target Area]**.
* **Instruction:** Accurately transfer the design, materials, and style of the reference outfit to the target area while maintaining the character's original pose and identity.`;
    } else {
        switch (effectiveLevel) {
            case 1:
                // 1단계: Natural Physics Integration
                prompt = `${baseRules}

**Mode: Natural Physics Integration (Creativity 1/5)**
* **Action:** **LOCALIZED REPLACEMENT ONLY.** Replace the clothing design **strictly inside** the **[Target Area]**.
* **Instruction:** Do NOT redress the entire character. Only the selected **[Target Area]** must change to match the Reference Design.
* **Physics:** The new design must seamlessly connect to the *unchanged* surrounding parts of the Original Outfit. Simulate natural cloth interaction at the boundaries of the Target Area.`;
                break;
            case 2:
                // 2단계: High-End Material Remaster
                prompt = `${baseRules}

**Mode: High-End Material Remaster (Creativity 2/5)**
* **Task:** Apply the Reference Design to the **[Target Area]** realistically, but upgrade the material definition.
* **Instruction:** The Reference Image is a rough draft. Render the **[Target Area]** with **High-Fidelity Surface Properties** (Reflection, Refraction, Roughness) suitable for the character's world.
* **Creative Improvement:** You are allowed to subtly "reinterpret" the material quality. Add **cinematic lighting interactions, micro-scratches, or rich texture details** that might not be visible in the reference, making it look like a luxury version of the original.
* **Rule:** Maintain the silhouette exactly, but make the surface textures look significantly more tangible and rich than the reference.`;
                break;
            case 3:
                // 3단계: Detail Refinement
                prompt = `${baseRules}

**Mode: Detail Refinement (Creativity 3/5)**
* **Task:** Apply the Reference Design to the **[Target Area]** realistically, then polish and finish the design.
* **Instruction:** Add **Structural Elements** that are implied but missing in the Reference. Highlight **Assembly Lines, Fastening Mechanisms, and Structural Depth** to increase information density.
* **Rule:** It looks like the "High-Resolution/Production-Ready" version of the Reference Design.`;
                break;
            case 4:
                // 4단계: Silhouette Evolution
                prompt = `${baseRules}

**Mode: Silhouette Evolution (Creativity 4/5)**
* **Task:** Apply the Reference Design to the **[Target Area]** realistically, but evolve the design to fit the era of the Original Image.
* **Instruction:** Keep the "Core Identity" (Color Palette, Graphic Elements) of the Reference, but **evolve the Form**.
* **Creative Evolution:** **Remix the Style.** If the reference is classic, reimagine it as **Future-Modern**. If it's plain, restructure it with **Avant-Garde Layering**. Change the length, volume, and cut of the outfit in the **[Target Area]** to create a "Director's Cut" version.
* **Rule:** 60% Reference DNA, 40% New Structure.`;
                break;
            case 5:
                // 5단계: Avant-Garde Reconstruction
                prompt = `${baseRules}

**Mode: Avant-Garde Reconstruction (Creativity 5/5)**
* **Task:** Create a Masterpiece inspired by the Reference in the **[Target Area]**.
* **Instruction:** **IGNORE the specific geometry of the Reference.** Deconstruct its "Abstract Essence" (Atmosphere, Shape Language).
* **Action:** Create a **Brand New Structure** that is bold, artistic, and exaggerated. It should look like a unique concept piece that only shares the "Soul" of the reference.
* **Rule:** Do not be safe. Be radical. Create a unique structural fusion that didn't exist in either image.`;
                break;
            default:
                // Default to Level 3 if unknown
                prompt = `${baseRules}

**Mode: Detail Refinement (Creativity 3/5)**
* **Task:** Polish and finish the design in the **[Target Area]**.
* **Instruction:** Add **Structural Components** that are implied but missing in the Reference. Enhance the **Assembly Lines, Fastening Mechanisms, and Construction Depth** to increase the information density.`;
                break;
        }
    }

    // [FIX A-2] Replace [Target Area] placeholder with actual target area description
    return prompt.replace(/\[Target Area\]/g, area);
}

export const buildCharacterGenerationRequest = (params: ProcessImageParams): { parts: Part[], config: any } => {
    const {
        originalImage, maskImage, prompt, textureImages, poseImage, backgroundImage,
        backgroundImageAspectRatio, poseControlImage, cameraView, bodyPartReferenceMap,
        selectedClothingItems, selectedObjectItems, selectedActionPose, useAposeForViews,
        isApplyingFullOutfit, isApplyingTop, isApplyingBottom, lightDirection, lightIntensity,
        selectedPalette, numPaletteColors, isAutoColorizeSketch, resolution, aspectRatio,
        // Synthesis Control
        costumeCreativityLevel,
        // 스케치 기반 포즈 여부
        isPoseSketch,
        // 5단계 의상참조 합성 (체형/성별은 원본 이미지에서 자동 감지)
    } = params;

    const parts: Part[] = [];
    let textPrompt = '';

    if (!originalImage) {
        // Text-to-Image
        let cameraPrompt = '';

        // Generate camera view prompt if cameraView is active
        if (cameraView) {
            cameraPrompt = ' ' + buildCameraPrompt(cameraView, { formatStyle: 'sentence' });
        }

        if (selectedPalette) {
            const numColors = numPaletteColors ? `the first ${numPaletteColors}` : 'all';
            textPrompt = `Create an image based on the following prompt: "${prompt.trim()}".${cameraPrompt} For any characters, use natural skin and hair colors. For all other elements like clothing, objects, and background, you MUST strictly use ${numColors} colors from this color palette: ${selectedPalette.name} (${selectedPalette.colors.join(', ')}).`;
        } else {
            textPrompt = prompt.trim() + cameraPrompt;
        }
        if (!textPrompt) {
            throw new Error("error.invalidRequest");
        }
        parts.push({ text: textPrompt });
    } else if (maskImage) {
        // Masking / Inpainting
        // NOTE: Normal flow should not reach here with maskImage set — mask routing
        // (preparePaddedRegion + blendInpaintResult) strips the mask before API calls.
        // If this fires outside of inpainting flows, it is a bug.
        console.warn('[promptBuilder] mask reached promptBuilder — expected client-side routing to strip it first');
        parts.push({ inlineData: { data: originalImage.data, mimeType: originalImage.mimeType } });
        parts.push({ inlineData: { data: maskImage.data, mimeType: maskImage.mimeType } });

        const validTextureImages = textureImages.filter(img => img !== null);
        let editTaskInstruction = "";
        let scenarioDescription = "";

        if (validTextureImages.length > 0) {
            const referenceImage = validTextureImages[0];
            parts.push({ inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } });

            {
                // Scenario B: Texture/Style Transfer
                scenarioDescription = "Scenario B: Texture/Style Transfer";
                const refImageIndex = 3;

                editTaskInstruction = `
**Reference Input:**
- **Image ${refImageIndex}:** The Reference Image for texture, material, and style.

**Your Task (Texture & Style Transfer):**
1.  **ANALYZE:** Analyze the 3D form, lighting, and structure of the character/object currently visible within the **Target Mask (WHITE area of Image 2)** on the Main Image (Image 1).
2.  **TRANSFER:** Apply the material, texture, pattern, and artistic style from **Image ${refImageIndex}** onto this existing form.
3.  **PRESERVE FORM:** You must RETAIN the underlying 3D shape and folds of the content in Image 1 (e.g., if it's a shirt, keep the shirt's folds but change the fabric to match the reference).
4.  **BLEND:** Ensure the new texture follows the original lighting direction and intensity.
`;
            }
        } else {
            // Scenario A: Text Edit (Prompt only)
            scenarioDescription = "Scenario A: Text Inpainting";

            if (prompt.trim()) {
                editTaskInstruction = `
**Your Task:**
Fill the **Target Mask area (WHITE part of Image 2)** on **Image 1** based on this instruction: "${prompt.trim()}".
-   Analyze the surrounding pixels, lighting, and perspective of Image 1.
-   Generate new content that fits seamlessly into this context.
-   Ensure the new object/content is realistically lit and shadowed according to the scene.
`;
            } else {
                // Fallback for empty prompt (Content Aware Fill)
                editTaskInstruction = `
**Your Task:**
Perform a high-quality content-aware fill on the **Target Mask area (WHITE part of Image 2)**.
-   Analyze the surrounding context of Image 1.
-   Seamlessly extend the background or surrounding elements to fill the hole realistically.
`;
            }
        }

        const userRequest = prompt.trim() ? `\n**Additional User Instruction:** "${prompt.trim()}"` : '';

        textPrompt = `You are an expert digital artist performing precise mask-based image editing (${scenarioDescription}).

**Input Specification:**
- **Image 1:** The Main Image to be edited.
- **Image 2:** The Target Mask. **WHITE** = Edit Area, **BLACK** = Protected Area.
${validTextureImages.length > 0 ? `- **Reference Images:** Provided for style/content transfer.` : ''}

**ABSOLUTE RULES (SAFETY CONSTRAINTS):**
1.  **PROTECT UNMASKED AREAS:** The **BLACK** area of Image 2 matches the output pixel-for-pixel. Do NOT modify any pixel in the black region. This is the most critical rule.
2.  **STRICT CONTAINMENT:** All new content, edits, or transfers must be strictly contained within the **WHITE** area of Image 2. Do not hallucinate objects extending outside this boundary.
3.  **REALISTIC INTEGRATION:** The result must account for the lighting, shadows, depth of field, and perspective of Image 1.
4.  **SHAPE AS DESIGN INTENT:** The spatial geometry of the white mask region — its boundary contour, proportional distribution, and overall form — represents the user's intended design specification. The content you generate must conform to and occupy this exact shape. Do not replace it with a generic or canonical default form.
5.  **SEAMLESS BOUNDARY CONTINUITY:** The transition between WHITE and BLACK regions must be IMPERCEPTIBLE. Sample colors, lighting direction, and color temperature from pixels immediately adjacent to the white boundary in Image 1. Match the surface texture grain, film noise, and sharpness/defocus level of the surrounding area. Avoid any visible "cut-and-paste" artifacts: no halos, no contrast jumps, no chromatic shift. The pixels at the inner edge of the white area must blend smoothly from the adjacent black-area pixels.

${editTaskInstruction}
${userRequest}

**FINAL OUTPUT:**
Return only the complete, edited version of Image 1.
`;
        parts.push({ text: textPrompt.trim() });
    } else if (poseImage && prompt.trim() && !selectedActionPose && !cameraView && !lightDirection && !selectedPalette && !isAutoColorizeSketch && selectedObjectItems.length === 0 && textureImages.length === 0) {
        // Insert Object / Edit with Guide Path
        parts.push({ inlineData: { data: poseImage.data, mimeType: poseImage.mimeType } });

        textPrompt = `
**Task: Object Insertion & Image Editing**
- **Input Image:** The provided image contains a background scene with rough drawings, sketches, or text memos indicating where and what to insert or modify.
- **User Instruction:** "${prompt.trim()}"

**Your Goal:**
Transform the rough drawings and sketches in the input image into realistic, high-quality objects or details that blend seamlessly with the existing background.
- **Drawings/Sketches:** Interpret the colored strokes as the approximate shape, color, and placement of the new objects.
- **Memos/Text:** Read the text annotations (if any) to understand specific details, materials, or characteristics required. Remove the text annotations from the final output.
- **Background:** Preserve the existing high-quality parts of the background. Only modify the areas indicated by drawings or necessary for the insertion to look natural (shadows, reflections, lighting adjustments).
- **Style:** Match the lighting, perspective, and artistic style of the original background.

**Output:**
A single, high-quality image with the requested objects inserted realistically.
`;
        parts.push({ text: textPrompt.trim() });
    } else {
        // Role-based Prompting Path
        const roleDescriptions: string[] = [];
        const roleNames: { [key: string]: string } = {};

        // 1. Define roles for all input images
        parts.push({ inlineData: { data: originalImage.data, mimeType: originalImage.mimeType } });
        roleNames['original'] = 'base character';
        roleDescriptions.push(`- The ${toOrdinal(parts.length)} image is the '${roleNames['original']}'.`);

        const validTextureImages = textureImages.filter(img => img !== null);
        validTextureImages.forEach((textureImage, index) => {
            parts.push({ inlineData: { data: textureImage.data, mimeType: textureImage.mimeType } });
            roleNames[`ref-${index}`] = `synthesis reference ${index + 1}`;
            roleDescriptions.push(`- The ${toOrdinal(parts.length)} image is the '${roleNames[`ref-${index}`]}', used ONLY for its texture, color, and style.`);
        });

        if (poseImage) {
            parts.push({ inlineData: { data: poseImage.data, mimeType: poseImage.mimeType } });
            if (isPoseSketch) {
                roleNames['pose'] = 'pose sketch';
                roleDescriptions.push(
                    `- The ${toOrdinal(parts.length)} image is the '${roleNames['pose']}', ` +
                    `a hand-drawn sketch that defines ONLY the desired body pose geometry. ` +
                    `Use it SOLELY for joint positions, limb angles, and body orientation. ` +
                    `Do NOT interpret it as a realistic character or copy any appearance from it.`
                );
            } else {
                roleNames['pose'] = 'pose reference';
                roleDescriptions.push(`- The ${toOrdinal(parts.length)} image is the '${roleNames['pose']}', used ONLY for its pose, facial expression, and camera angle.`);
            }
        }

        if (backgroundImage) {
            parts.push({ inlineData: { data: backgroundImage.data, mimeType: backgroundImage.mimeType } });
            roleNames['background'] = 'background';
            roleDescriptions.push(`- The ${toOrdinal(parts.length)} image is the '${roleNames['background']}', to be used as the final background.`);
        }

        // 2. Construct the main prompt with role definitions
        textPrompt = `As a professional character designer, your task is to create a high-quality, artistic image suitable for all ages.\n\n`;
        if (roleDescriptions.length > 0) {
            textPrompt += "Here are the roles for the images you've received:\n";
            textPrompt += roleDescriptions.join('\n') + '\n\n';
        }

        // 3. Check for specific, high-priority automatic synthesis scenarios
        const hasNoOtherInstructions =
            !prompt.trim() &&
            Object.keys(bodyPartReferenceMap).length === 0 &&
            selectedClothingItems.length === 0 &&
            selectedObjectItems.length === 0 &&
            !selectedActionPose &&
            !cameraView &&
            !lightDirection &&
            !selectedPalette &&
            !isAutoColorizeSketch &&
            !isApplyingFullOutfit && !isApplyingTop && !isApplyingBottom;

        if (validTextureImages.length > 0 && hasNoOtherInstructions) {
            // Automatic Synthesis (Costume, Pose, General)
            const costumeRefs = validTextureImages.filter(img => img.referenceType === 'costume');
            const generalRefs = validTextureImages.filter(img => img.referenceType === 'general');
            const poseRefs = validTextureImages.filter(img => img.referenceType === 'pose');

            textPrompt += `\n**Task: Automatic Synthesis**\n`;
            textPrompt += `- Your primary goal is to apply modifications from the 'synthesis reference' image(s) to the '${roleNames['original']}' character.\n`;

            if (poseImage) {
                textPrompt += `- **Pose & Expression Transfer:** Apply the pose, expression, and camera angle from the '${roleNames['pose']}' image.\n`;
            }

            if (costumeRefs.length > 0) {
                textPrompt += `- ${getReferenceDesignPrompt(costumeCreativityLevel, 'the FULL OUTFIT')}\n`;
            }
            if (poseRefs.length > 0) {
                textPrompt += `- **Pose Adaptation:** Adjust the character's pose to match the body positioning shown in the pose reference image(s).\n`;
            }
            if (generalRefs.length > 0) {
                textPrompt += `- **General Reference:** Use general reference image(s) for overall visual guidance.\n`;
            }

            textPrompt += `\n- **CRITICAL RULE 1 (Preserve Original Character Identity):** Maintain the exact character identity (face, body shape) from the '${roleNames['original']}' image.\n`;
            textPrompt += `- **CRITICAL RULE 2 (Apply Pose Details):** Replicate the pose, facial expression, and camera angle from the '${roleNames['pose']}' image with extreme precision.\n`;
            textPrompt += `- **CRITICAL RULE 3 (Do Not Copy Other Elements):** Do not copy character identity from the '${roleNames['pose']}' or reference images.\n`;
        } else if (poseImage && validTextureImages.length === 0 && hasNoOtherInstructions) {
            // Automatic Pose & Expression Transfer
            textPrompt += `\n**Task: Automatic Pose & Expression Transfer**\n`;
            textPrompt += `\n**Primary Goal:**\n`;
            textPrompt += `Redraw the character from the '${roleNames['original']}' image, precisely matching the pose, action, and camera angle of the '${roleNames['pose']}' image.\n`;

            textPrompt += `\n**EXECUTION RULES (MUST FOLLOW):**\n`;

            textPrompt += `\n1.  **Identity & Style Source (The Master):**\n`;
            textPrompt += `    * You must strictly maintain the character's identity, facial features, hair color, and body proportions from the '${roleNames['original']}' image.\n`;
            textPrompt += `    * **Visual Style:** The rendering style (brush strokes, lighting, texture quality) MUST come 100% from the '${roleNames['original']}' image.\n`;
            textPrompt += `    * **COLOR OUTPUT:** The final image MUST use the FULL VIBRANT COLOR PALETTE from the '${roleNames['original']}' image. Skin tones, clothing colors, and all elements must match the original's color scheme exactly.\n`;

            textPrompt += `\n2.  **Pose & Structure Source (The Guide):**\n`;
            textPrompt += `    * Replicate the following elements from the '${roleNames['pose']}' image with extreme precision:\n`;
            textPrompt += `        * Full body pose and limb positioning.\n`;
            textPrompt += `        * Hand gestures and finger placement.\n`;
            textPrompt += `        * Facial expression emotion (e.g., smile, anger) and gaze direction.\n`;
            textPrompt += `        * Camera angle (Low/High angle) and shot composition.\n`;

            textPrompt += `\n3.  **⚡ POSE-ONLY EXTRACTION PROTOCOL:**\n`;
            textPrompt += `    * **EXTRACT ONLY GEOMETRY:** From the '${roleNames['pose']}' image, extract ONLY the skeletal structure, joint positions, and body angles. This is pure geometric/positional data.\n`;
            textPrompt += `    * **APPLY ORIGINAL'S APPEARANCE:** Apply the '${roleNames['original']}' image's complete visual appearance (colors, textures, materials, lighting) to this pose structure.\n`;
            textPrompt += `    * **Mental Model:** Imagine tracing an invisible wireframe from the '${roleNames['pose']}', then rendering it using ONLY the '${roleNames['original']}' as your texture/color source.\n`;

            textPrompt += `\n4.  **Costume Consistency:**\n`;
            textPrompt += `    * The character must wear the EXACT outfit from the '${roleNames['original']}' image with the same colors and materials.\n`;
            textPrompt += `    * Adapt the clothing naturally to fit the new pose while maintaining its original design.\n`;

            textPrompt += `\n**OUTPUT QUALITY REQUIREMENTS:**\n`;
            textPrompt += `* Output must be FULLY COLORED with rich, vibrant tones matching the '${roleNames['original']}'.\n`;
            textPrompt += `* Skin must have natural, lifelike color and texture from the '${roleNames['original']}'.\n`;
            textPrompt += `* All materials (fabric, metal, leather, etc.) must match the '${roleNames['original']}' image's quality and finish.\n`;
            textPrompt += `* The rendering style must be identical to the '${roleNames['original']}' (if it's illustration style, output illustration; if it's realistic, output realistic).\n`;
        } else if (validTextureImages.length > 0 && !poseImage && hasNoOtherInstructions) {
            // Automatic Costume Synthesis
            const costumeRefs = validTextureImages.filter(img => img.referenceType === 'costume');
            const generalRefs = validTextureImages.filter(img => img.referenceType === 'general');

            textPrompt += `\n**Task: Automatic Synthesis**\n`;
            textPrompt += `- Your primary goal is to modify the subject from the '${roleNames['original']}' based on the 'synthesis reference' image(s).\n\n`;

            if (costumeRefs.length > 0) {
                const refPrompt = getReferenceDesignPrompt(costumeCreativityLevel, 'the FULL OUTFIT');
                if (refPrompt) textPrompt += `- ${refPrompt}\n`;
            }
            if (generalRefs.length > 0) {
                textPrompt += `- **General Reference:** Use the general reference image(s) for overall visual guidance on style, texture, and mood.\n`;
            }

            textPrompt += `\n- **CRITICAL RULE 1 (Preserve Identity & Pose):** Maintain the exact pose, body shape, and facial identity of the subject in the '${roleNames['original']}'.\n`;
            if (costumeRefs.length === 0) {
                textPrompt += `- **CRITICAL RULE 2 (Preserve Clothing):** Keep the original clothing unless a costume reference is provided.\n`;
            }
            textPrompt += `- **CRITICAL RULE 3 (Do Not Blend Subjects):** Do not merge or blend the subjects. The subject from the '${roleNames['original']}' is the only subject that should appear in the output.\n`;
        } else {
            // 4. Fallback to generic, modular instruction building
            if (poseImage) {
                textPrompt += `**Pose and Composition:**
- Thoroughly analyze the pose, facial expression${!cameraView ? ", camera angle, and precise image composition" : ""} from the '${roleNames['pose']}'. The generated character's final output must replicate these spatial properties with extreme precision.
- From the '${roleNames['pose']}', extract ONLY the skeletal structure and body positioning - treat it as pure geometric/spatial data.

**⚡ POSE-ONLY EXTRACTION PROTOCOL:**
- **EXTRACT GEOMETRY ONLY:** From the '${roleNames['pose']}' image, extract ONLY joint positions, limb angles, and body orientation.
- **APPLY ORIGINAL'S FULL APPEARANCE:** Render the output using 100% of the '${roleNames['original']}' image's colors, textures, materials, and lighting.
- **COLOR OUTPUT:** The final image MUST use the FULL VIBRANT COLOR PALETTE from the '${roleNames['original']}' with natural skin tones and rich material colors.
- **Identity Source:** Maintain the character's identity, facial features, and artistic style from the '${roleNames['original']}' image.
`;
            }

            if (cameraView) {
                const cameraSentence = buildCameraPrompt(cameraView, {
                    subjectLabel: `the subject from the '${roleNames['original']}'`,
                    formatStyle: 'sentence',
                });
                const viewPrompt = useAposeForViews
                    ? `Render the subject from the '${roleNames['original']}' in a standard A-pose for character creation sheet, showing the FULL BODY from head to toe. ${cameraSentence} This MUST be a full-body shot that includes the entire figure - do not crop any body parts. Maintain artistic style, maintain style. Preserve the subject's design, but change the pose to A-pose and the camera angle.`
                    : `${cameraSentence} CRITICAL: You must preserve the subject's appearance, style, and original pose. The ONLY change is the camera's viewpoint.`;
                textPrompt += viewPrompt + '\n';
            }

            if (lightDirection && lightIntensity !== null) {
                const { yaw: lightYaw, pitch: lightPitch } = lightDirection;

                // Normalize Yaw to 0-360
                const normalizedYaw = (Math.round(lightYaw) % 360 + 360) % 360;
                const roundedPitch = Math.round(lightPitch);

                let lightingType = "Studio Lighting";

                // Intensity
                const intensityDesc = lightIntensity < 0.8 ? "Soft, diffused" : lightIntensity > 1.2 ? "Hard, high-contrast" : "Balanced studio";

                // Pitch Logic
                const isOverhead = roundedPitch > 60;
                const isHigh = roundedPitch > 20 && roundedPitch <= 60;
                const isLevel = roundedPitch >= -20 && roundedPitch <= 20;
                const isLow = roundedPitch < -20;
                const isUnder = roundedPitch < -60;

                // Yaw Logic (Professional Cinematic Terms)
                if (normalizedYaw >= 337.5 || normalizedYaw < 22.5) {
                    // Front
                    if (isOverhead) lightingType = "Top Lighting";
                    else if (isHigh) lightingType = "Butterfly Lighting (Paramount Lighting)";
                    else if (isUnder) lightingType = "Ghostly Under-lighting";
                    else if (isLow) lightingType = "Low-Angle Front Lighting";
                    else lightingType = "Flat Front Lighting";
                } else if ((normalizedYaw >= 22.5 && normalizedYaw < 67.5) || (normalizedYaw >= 292.5 && normalizedYaw < 337.5)) {
                    // Front-Side
                    if (isHigh) lightingType = "Rembrandt Lighting";
                    else if (isLevel) lightingType = "Loop Lighting";
                    else lightingType = "Front-Side Lighting";
                } else if ((normalizedYaw >= 67.5 && normalizedYaw < 112.5) || (normalizedYaw >= 247.5 && normalizedYaw < 292.5)) {
                    // Side
                    lightingType = "Split Lighting (Chiaroscuro effect)";
                } else if ((normalizedYaw >= 112.5 && normalizedYaw < 157.5) || (normalizedYaw >= 202.5 && normalizedYaw < 247.5)) {
                    // Back-Side
                    lightingType = "Rim Lighting (Kicker Light)";
                } else {
                    // Back
                    lightingType = "Backlighting (Silhouette effect)";
                }

                textPrompt += `Lighting Setup: Apply ${intensityDesc} ${lightingType} to emphasize the 3D form.\n`;
            }

            if (selectedPalette) {
                const numColors = numPaletteColors ? `the first ${numPaletteColors}` : 'all';
                textPrompt += `For all elements like clothing, objects, and background, you MUST strictly use ${numColors} colors from this color palette: ${selectedPalette.name} (${selectedPalette.colors.join(', ')}). `;
                if (isAutoColorizeSketch) {
                    textPrompt += `This is a line art sketch, so you need to color it completely. Use the provided palette for coloring, but you can use natural colors for skin and hair.`;
                }
                textPrompt += '\n';
            }
            if (selectedActionPose) { textPrompt += `Generate a full-body image of the character in a dynamic "${selectedActionPose}" action pose.\n`; }

            // --- Partial Style Synthesis with Mutually Exclusive Logic ---
            const hasStyleRef = (bodyPartReferenceMap && Object.values(bodyPartReferenceMap).some(refIdx => refIdx !== undefined)) || isApplyingFullOutfit || isApplyingTop || isApplyingBottom;

            if (hasStyleRef) {
                // [Logic Check] Determine which mode the user selected
                // FORCED to 'Reference Design' Mode (User Request)
                const mode = 'reference';

                // [FIX A-1] Compute target area description FIRST, then pass to creativity prompt
                let targetPartsDescription = "";
                if (isApplyingFullOutfit) {
                    targetPartsDescription = "the FULL OUTFIT (Top, Bottom, Shoes, Accessories)";
                } else if (isApplyingTop) {
                    targetPartsDescription = "the UPPER BODY ONLY (Top, Outerwear)";
                } else if (isApplyingBottom) {
                    targetPartsDescription = "the LOWER BODY ONLY (Pants, Skirt, Shoes)";
                } else {
                    // Individual parts from map
                    const partNames = Object.keys(bodyPartReferenceMap).map(p => getEnglishBodyPartName(p as BodyPart)).join(", ");
                    targetPartsDescription = partNames;
                }

                // [FIX A-2] Pass actual target area to replace [Target Area] placeholder
                const creativityPrompt = getReferenceDesignPrompt(costumeCreativityLevel, targetPartsDescription);

                if (creativityPrompt) {
                    textPrompt += `\n\n=== COSTUME SYNTHESIS INSTRUCTIONS (${mode.toUpperCase()} MODE) ===\n`;
                    textPrompt += `${creativityPrompt}\n\n`;

                    textPrompt += `**CRITICAL RULE 2 (SCOPE OF MODIFICATION):**\n`;
                    textPrompt += `You must apply the costume synthesis logic ONLY to the specific body parts listed in the **TARGET AREA** below.\n`;
                    textPrompt += `**STRICT PROHIBITION:** Do NOT change any part of the outfit, skin, or body that is NOT listed in the Target Area. Unlisted parts must remain 100% identical to the Original Image.\n`;
                    textPrompt += `- Prioritize the reference's cut/shape and design logic.\n`;

                    const targetAreaSentence = isApplyingFullOutfit
                        ? `Apply the style to ${targetPartsDescription}.`
                        : isApplyingTop
                            ? `Apply the style to ${targetPartsDescription}. Keep the lower body unchanged.`
                            : isApplyingBottom
                                ? `Apply the style to ${targetPartsDescription}. Keep the upper body unchanged.`
                                : `Apply the style specifically to: ${targetPartsDescription}.`;
                    textPrompt += `\n**TARGET AREA:** ${targetAreaSentence}\n`;
                    textPrompt += `(Apply the "${mode.toUpperCase()} MODE" logic strictly within this area.)\n`;

                    // Add User Prompt if provided
                    if (prompt && prompt.trim()) {
                        textPrompt += `\n**ADDITIONAL USER INSTRUCTION:**\n`;
                        textPrompt += `"${prompt.trim()}"\n`;
                        textPrompt += `(Apply this instruction strictly within the defined Target Area and Mode constraints.)\n`;
                    }
                } else {
                    // Check if there is prompt even if creativity level is disabled?
                    // Usually this whole block is for Synthesis Mode which relies on the prompt.
                    // If disabled, just append user prompt normally?
                    if (prompt && prompt.trim()) {
                        textPrompt += `\n**User Instruction:** "${prompt.trim()}"\n`;
                    }
                }
            }
            else if (selectedObjectItems.length > 0) {
                const item = selectedObjectItems[0];
                textPrompt += `Generate concept art for a ${item}.Use the '${roleNames['original']}' and any other reference images as style and theme references, but create a new object.The background should be simple and neutral.\n`;
                if (prompt.trim()) { textPrompt += `Incorporate these details into the design: "${prompt}".\n`; }
            }
            else if (validTextureImages.length > 0) {
                const costumeRefs = validTextureImages.filter(img => img.referenceType === 'costume');
                const generalRefs = validTextureImages.filter(img => img.referenceType === 'general');
                const poseRefs = validTextureImages.filter(img => img.referenceType === 'pose');

                let hasSpecificInstruction = false;

                if (costumeRefs.length > 0) {
                    textPrompt += `** Task: Costume Synthesis **\n`;
                    const refPrompt = getReferenceDesignPrompt(costumeCreativityLevel, 'the FULL OUTFIT');
                    if (refPrompt) textPrompt += `- ${refPrompt} \n`;
                    hasSpecificInstruction = true;
                }

                // 2. Pose Reference
                if (poseRefs.length > 0) {
                    textPrompt += `** Task: Pose Adaptation **\n`;
                    textPrompt += `- **Primary Goal:** Adjust the character's pose to match the body positioning shown in the pose reference image(s).\n`;
                    textPrompt += `- **POSE-ONLY EXTRACTION:** From the pose reference, extract ONLY the skeletal structure and body angles - treat it as pure geometric/positional data.\n`;
                    textPrompt += `- **PRESERVE COLORS & STYLE:** Apply 100% of the '${roleNames['original']}' image's colors, textures, and artistic style. Output must be FULLY COLORED matching the original's palette.\n`;
                    textPrompt += `- **Identity Preservation:** Maintain the original identity and clothing from '${roleNames['original']}' (unless costume reference is also provided).\n`;
                    hasSpecificInstruction = true;
                }

                // 3. General Reference (or default behavior if no specific types)
                if (generalRefs.length > 0 || !hasSpecificInstruction) {
                    if (generalRefs.length > 0) {
                        textPrompt += `**Task: General Visual Reference**\n`;
                        textPrompt += `- Use the 'synthesis reference' image(s) labeled as general references for overall visual guidance on style, texture, and mood.\n`;
                    }

                    if (prompt.trim()) {
                        textPrompt += `\n**User Instruction:** "${prompt.trim()}"\n`;
                        textPrompt += `- Modify the character in '${roleNames['original']}' based on this instruction.\n`;
                    } else if (!hasSpecificInstruction) {
                        // Fallback if no specific types and no prompt
                        textPrompt += `Using the '${roleNames['original']}' and all 'synthesis reference' images purely as inspiration, generate a new concept art.\n`;
                    }
                }

                // Global Critical Rules
                textPrompt += `\n**Global Critical Rules:**\n`;
                textPrompt += `- **Preserve Identity:** Maintain the subject's original identity from '${roleNames['original']}' unless explicitly instructed to change it.\n`;
                if (costumeRefs.length === 0) {
                    textPrompt += `- **Preserve Clothing:** Keep the original clothing unless a costume reference is provided or the prompt specifies a change.\n`;
                }
                if (poseRefs.length === 0) {
                    textPrompt += `- **Preserve Pose:** Keep the original pose unless a pose reference is provided.\n`;
                }
            }
            else if (isAutoColorizeSketch) {
                textPrompt += `**Task: Sketch Colorization**\n`;
                textPrompt += `The provided image is a sketch/line art. Your task is to colorize and render it fully based on the following style instructions:\n`;
                if (prompt.trim()) {
                    textPrompt += `"${prompt.trim()}"\n`;
                }
                textPrompt += `Ensure the final output is a high-quality, fully colored illustration/render retaining the original composition.\n`;
            }
            else {
                if (prompt.trim()) {
                    textPrompt += `Apply this global instruction to the character from '${roleNames['original']}': "${prompt.trim()}".\n`;
                }
            }
        }

        // Final background instruction
        if (backgroundImage) {
            textPrompt += `Finally, place the resulting character seamlessly onto the background provided in the '${roleNames['background']}'.\n`;
        } else {
            textPrompt += `CRITICAL: You MUST ignore the backgrounds of all reference images and keep the background from the '${roleNames['original']}' (or create a simple, neutral background if it has none).\n`;
        }

        if (resolution && resolution !== 'auto') {
            textPrompt += `\nIMPORTANT: Generate the image in high resolution (${resolution.toUpperCase()}).`;
        }
        if (aspectRatio && aspectRatio !== 'auto') {
            textPrompt += `\nGenerate the image with an aspect ratio of ${aspectRatio}.`;
        }

        parts.push({ text: textPrompt.trim() });
    }

    if (parts.length === 0 || (parts.length === 1 && 'text' in parts[0] && !parts[0].text)) {
        throw new Error("error.invalidRequest");
    }

    const config: any = {
        responseModalities: ["TEXT", "IMAGE"],
    };

    const imageConfig: any = {
        imageOutputOptions: { mimeType: "image/png" },
        personGeneration: "ALLOW_ALL"
    };

    if (resolution && resolution !== 'auto') {
        imageConfig.imageSize = resolution.toUpperCase();
    }

    if (aspectRatio && aspectRatio !== 'auto') {
        imageConfig.aspectRatio = aspectRatio;
    }

    (config as any).imageConfig = imageConfig;

    // ThinkingConfig (Gemini 3.1 Flash / Pro 3 only)
    if (params.thinkingLevel) {
        config.thinkingConfig = {
            thinkingLevel: params.thinkingLevel === 'high' ? 'High' : 'Minimal',
        };
    }

    // Grounding tools
    if (params.groundingTools && params.groundingTools.length > 0) {
        const hasImageSearch = params.groundingTools.includes('imageSearch');
        config.tools = [{
            googleSearch: hasImageSearch ? { searchTypes: { imageSearch: {} } } : {},
        }];
    }

    return { parts, config };
};

export const buildChatRequest = async (history: ChatMessage[], images: ChatImage[]): Promise<{ contents: any[] }> => {
    const conversationHistoryPromises = history.map(async (msg) => {
        const parts: Part[] = [];
        if (msg.content) {
            parts.push({ text: msg.content });
        }
        if (msg.images && msg.images.length > 0) {
            const imageParts = await Promise.all(
                msg.images.map(async (file) => {
                    const base64Data = await fileToBase64(file);
                    return {
                        inlineData: {
                            data: base64Data,
                            mimeType: file.type,
                        },
                    };
                })
            );
            parts.push(...imageParts);
        }
        if (msg.functionCall) {
            parts.push({ functionCall: msg.functionCall });
        }
        return { role: msg.role, parts };
    });

    const conversationHistory = await Promise.all(conversationHistoryPromises);

    const lastUserMessage = conversationHistory.pop();
    if (!lastUserMessage || lastUserMessage.role !== 'user') {
        throw new Error('Invalid chat history');
    }

    const userParts: Part[] = [];

    for (const image of images) {
        const base64Data = await fileToBase64(image.file);
        userParts.push({
            inlineData: {
                data: base64Data,
                mimeType: image.file.type,
            }
        });
    }

    let imageDescriptions = '';
    if (images.length > 0) {
        const roleTranslations: Record<string, string> = {
            original: '원본', reference: '참조', pose: '포즈', background: '배경', none: '역할 없음'
        };
        imageDescriptions = '[역할이 부여된 이미지 목록]\n';
        images.forEach((img) => {
            let roleName = roleTranslations[img.role] || img.role;
            if (img.role === 'reference' && img.refIndex !== undefined) {
                roleName = `${roleName} ${img.refIndex + 1}`;
            }
            imageDescriptions += `- 이미지 ID: ${img.id}, 역할: ${roleName}\n`;
        });
        imageDescriptions += '\n';
    } else {
        imageDescriptions = '[역할이 부여된 이미지가 없습니다.]\n\n';
    }

    const textPart = lastUserMessage.parts.find(p => 'text' in p) as Part & { text: string } | undefined;
    if (textPart) {
        textPart.text = imageDescriptions + (textPart.text || '');
    } else {
        lastUserMessage.parts.unshift({ text: imageDescriptions });
    }
    userParts.push(...lastUserMessage.parts);

    // Reconstruct contents with modified last user message
    return {
        contents: [...conversationHistory, { role: 'user', parts: userParts }]
    };
};

