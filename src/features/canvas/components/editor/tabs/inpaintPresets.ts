import { InpaintWorkType } from '../../../../../types';

export interface InpaintPreset {
    id: string;
    labelKo: string;
    labelEn: string;
    isBuiltIn: boolean;
    mode: 'insert' | 'remove';
    workType: InpaintWorkType | null;
    maskFeatherRadius: number;
    brushSize: number;
    promptHintKo?: string;
    promptHintEn?: string;
    defaultPromptKo?: string;
    defaultPromptEn?: string;
}

export const BUILT_IN_PRESETS: InpaintPreset[] = [
    {
        id: 'clothing-edit',
        labelKo: '의상 편집',
        labelEn: 'Clothing Edit',
        isBuiltIn: true,
        mode: 'insert',
        workType: 'clothing',
        maskFeatherRadius: 8,
        brushSize: 30,
        promptHintKo: '예: 빨간 드레스로 교체',
        promptHintEn: 'e.g. replace with a red dress',
        defaultPromptKo: '마스크 영역의 의상을 자연스럽게 편집하세요. 인물의 신체 비율, 자세, 피부톤을 그대로 유지하고, 새 의상의 원단 질감과 광택을 주변 조명 방향에 맞게 표현하세요. 의상의 주름과 음영은 인체 구조를 따르도록 하고 기존 배경과의 경계를 자연스럽게 처리하세요.',
        defaultPromptEn: 'Edit the clothing in the masked area naturally. Preserve the subject\'s body proportions, pose, and skin tone. Render the new clothing\'s fabric texture and sheen in accordance with the surrounding lighting direction. Ensure folds and shadows follow the body structure, and blend the boundary with the existing background seamlessly.',
    },
    {
        id: 'bg-edit',
        labelKo: '배경 편집',
        labelEn: 'Background Edit',
        isBuiltIn: true,
        mode: 'insert',
        workType: 'backgroundFill',
        maskFeatherRadius: 12,
        brushSize: 50,
        promptHintKo: '예: 따뜻한 카페 인테리어로 변경',
        promptHintEn: 'e.g. change to warm cafe interior',
        defaultPromptKo: '마스크 영역의 배경을 자연스럽게 수정하세요. 인물과 주요 피사체는 그대로 유지하고, 조명 방향과 색온도를 주변과 일치시켜 위화감 없이 통합하세요. 그림자와 원근감도 자연스럽게 맞추고, 마스크 경계에서 픽셀이 부드럽게 이어지도록 처리하세요.',
        defaultPromptEn: 'Naturally edit the background in the masked area. Keep the subject and foreground intact. Match the lighting direction and color temperature to the surroundings for a seamless blend. Ensure shadows and perspective align naturally, and process the mask boundary so pixels blend smoothly.',
    },
    {
        id: 'object-edit',
        labelKo: '오브젝트 편집',
        labelEn: 'Object Edit',
        isBuiltIn: true,
        mode: 'insert',
        workType: null,
        maskFeatherRadius: 6,
        brushSize: 25,
        promptHintKo: '예: 빨간 꽃다발로 교체',
        promptHintEn: 'e.g. replace with a red bouquet',
        defaultPromptKo: '마스크 영역의 오브젝트를 편집하세요. 주변 환경의 조명, 원근감, 색상 팔레트를 분석하여 새 오브젝트가 장면에 자연스럽게 녹아들도록 생성하세요. 마스크 경계 안쪽의 콘텐츠만 변경하고 외부 픽셀은 픽셀 단위로 보존하세요.',
        defaultPromptEn: 'Edit the object in the masked area. Analyze the surrounding lighting, perspective, and color palette to generate the new object so it blends naturally into the scene. Modify only the content inside the mask boundary and preserve all pixels outside pixel-for-pixel.',
    },
    {
        id: 'fine-edit',
        labelKo: '정밀 수정',
        labelEn: 'Fine Edit',
        isBuiltIn: true,
        mode: 'insert',
        workType: 'characterEdit',
        maskFeatherRadius: 3,
        brushSize: 12,
        promptHintKo: '예: 눈썹 모양 다듬기, 피부 보정',
        promptHintEn: 'e.g. refine eyebrows, skin correction',
        defaultPromptKo: '마스크 영역을 정밀하게 수정하세요. 인물의 피부톤, 선 품질, 아트 스타일을 그대로 유지하면서 디테일을 섬세하게 조정하세요. 마스크 경계는 1픽셀 단위로 부드럽게 처리하고, 수정 범위를 마스크 안으로 엄격하게 제한하세요.',
        defaultPromptEn: 'Precisely refine the masked area. Maintain the subject\'s skin tone, line quality, and art style while subtly adjusting the details. Process the mask boundary with pixel-level smoothness and strictly limit any modifications within the mask boundary.',
    },
    {
        id: 'object-removal',
        labelKo: '오브젝트 제거',
        labelEn: 'Object Removal',
        isBuiltIn: true,
        mode: 'remove',
        workType: null,
        maskFeatherRadius: 4,
        brushSize: 25,
        defaultPromptKo: '마스크 영역의 오브젝트를 완전히 제거하고 자연스러운 배경으로 복원하세요. 오브젝트가 없었던 것처럼 주변 텍스처, 패턴, 그림자, 반사를 연속적으로 재구성하세요.',
        defaultPromptEn: 'Completely remove the object in the masked area and restore the background naturally, as if the object never existed. Reconstruct surrounding textures, patterns, shadows, and reflections seamlessly.',
    },
    {
        id: 'bg-removal',
        labelKo: '배경 제거',
        labelEn: 'Background Removal',
        isBuiltIn: true,
        mode: 'remove',
        workType: null,
        maskFeatherRadius: 8,
        brushSize: 40,
        defaultPromptKo: '마스크 영역의 배경을 제거하고 인물이나 주요 피사체를 유지하면서 빈 영역을 자연스럽게 복원하세요. 인물 경계를 정밀하게 처리하고, 제거된 배경 영역은 주변 환경과 자연스럽게 이어지도록 재구성하세요.',
        defaultPromptEn: 'Remove the background in the masked area while keeping the subject intact, and naturally restore the empty region. Process the subject boundary precisely, and reconstruct the removed background region to blend naturally with the surrounding environment.',
    },
    {
        id: 'fine-removal',
        labelKo: '정밀 제거',
        labelEn: 'Fine Removal',
        isBuiltIn: true,
        mode: 'remove',
        workType: null,
        maskFeatherRadius: 2,
        brushSize: 10,
        defaultPromptKo: '마스크 영역의 세밀한 요소(텍스트, 워터마크, 잡티, 노이즈 등)를 정밀하게 제거하고 주변 픽셀로 매끄럽게 복원하세요. 제거 후 경계 흔적이 남지 않도록 주변 텍스처와 색상을 정밀하게 맞추세요.',
        defaultPromptEn: 'Precisely remove fine elements (text, watermarks, blemishes, noise, etc.) in the masked area and restore seamlessly with surrounding pixels. After removal, precisely match surrounding textures and colors so no boundary artifacts remain.',
    },
];
