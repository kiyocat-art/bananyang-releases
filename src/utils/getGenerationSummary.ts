import { GenerationParams, AiAction, ActionPose, CameraSize } from '../types';
import { Language, t, TranslationKey } from '../localization';

/**
 * AI 편집 액션 이름을 반환
 */
const getAiActionName = (action: AiAction, language: Language): string => {
    const actionMap: Record<AiAction, { ko: string; en: string }> = {
        removeBackground: { ko: '배경 제거', en: 'Remove Background' },
        keepBackgroundOnly: { ko: '배경만 유지', en: 'Keep Background Only' },
        extractPose: { ko: '포즈 추출', en: 'Extract Pose' },
        extractOutfit: { ko: '의상 추출', en: 'Extract Outfit' },
        autoColoring: { ko: '자동 채색', en: 'Auto Coloring' },
        variation: { ko: '변형 생성', en: 'Variation' },
        insertObject: { ko: '오브젝트 삽입', en: 'Insert Object' },
        expand: { ko: '이미지 확장', en: 'Expand Image' },
        pbr: { ko: 'PBR 맵', en: 'PBR Map' },
        pbr_advanced: { ko: 'PBR 고급', en: 'PBR Advanced' },
        relight: { ko: '리라이팅', en: 'Relight' },
        inpainting: { ko: '인페인팅', en: 'Inpainting' },
        inpaintInsert: { ko: '인페인팅 삽입', en: 'Inpaint Insert' },
        inpaintRemove: { ko: '인페인팅 제거', en: 'Inpaint Remove' },
    };
    return language === 'ko' ? actionMap[action].ko : actionMap[action].en;
};

/**
 * 샷 크기 이름을 반환
 */
const getCameraSizeName = (size: CameraSize | string, language: Language): string => {
    // CameraSize enum has only Full, but we handle other string values too
    const sizeMap: Record<string, { ko: string; en: string }> = {
        'Full': { ko: '전신', en: 'Full' },
        'Upper': { ko: '상반신', en: 'Upper Body' },
        'Bust': { ko: '바스트', en: 'Bust' },
        'CloseUp': { ko: '클로즈업', en: 'Close Up' },
        'Face': { ko: '얼굴', en: 'Face' },
    };
    const key = String(size);
    return language === 'ko' ? sizeMap[key]?.ko || key : sizeMap[key]?.en || key;
};

/**
 * 액션 포즈 이름을 반환
 */
const getActionPoseName = (pose: ActionPose, language: Language): string => {
    const poseMap: Record<ActionPose, { ko: string; en: string }> = {
        [ActionPose.General]: { ko: '일반 포즈', en: 'General Pose' },
        [ActionPose.Attack]: { ko: '공격 포즈', en: 'Attack Pose' },
        [ActionPose.StandingModel]: { ko: 'A-Pose', en: 'A-Pose' },
    };
    return language === 'ko' ? poseMap[pose]?.ko || pose : poseMap[pose]?.en || pose;
};

/**
 * GenerationParams에서 사용된 기능의 요약을 생성
 * @param params GenerationParams 객체
 * @param language 언어 설정
 * @returns 기능 요약 문자열 (줄바꿈으로 구분)
 */
export function getGenerationSummary(params: GenerationParams, language: Language): string {
    const lines: string[] = [];

    // AI 편집 액션
    if (params.aiEditAction) {
        lines.push(`📌 ${getAiActionName(params.aiEditAction, language)}`);

        // 변형 생성 창의성
        if (params.aiEditAction === 'variation' && params.variationCreativity !== undefined) {
            lines.push(`  └ ${t('summary.creativity' as TranslationKey, language)}: ${params.variationCreativity}${t('summary.step' as TranslationKey, language)}`);
        }

        // 자동 채색 강도
        if (params.aiEditAction === 'autoColoring' && params.autoColoringIntensity !== undefined) {
            lines.push(`  └ ${t('summary.intensity' as TranslationKey, language)}: ${params.autoColoringIntensity}${t('summary.step' as TranslationKey, language)}`);
        }

        // PBR 맵 유형
        if ((params.aiEditAction === 'pbr' || params.aiEditAction === 'pbr_advanced') && params.pbrMapTypes?.length) {
            lines.push(`  └ ${t('summary.maps' as TranslationKey, language)}: ${params.pbrMapTypes.join(', ')}`);
        }
    }

    // 카메라 뷰 (3D 컨트롤)
    // SelectedView is an object with yaw, pitch, fov, size
    if (params.cameraView) {
        const view = params.cameraView;
        const hasCustomAngle = view.yaw !== 0 || view.pitch !== 0;

        if (hasCustomAngle || view.fov !== 50) {
            lines.push(`📷 ${t('summary.camera3d' as TranslationKey, language)}`);
            if (hasCustomAngle) {
                lines.push(`  └ Yaw: ${view.yaw}°, Pitch: ${view.pitch}°`);
            }
            if (view.fov !== 50) {
                lines.push(`  └ FOV: ${view.fov}°`);
            }
            lines.push(`  └ ${t('summary.shot' as TranslationKey, language)}: ${getCameraSizeName(view.size, language)}`);
        } else if (view.cameraAnglePreset) {
            // 프리셋 표시
            lines.push(`📷 ${t('summary.camera' as TranslationKey, language)}: ${view.cameraAnglePreset}`);
        }
    }

    // 원본유지제어 / 참조제어 - 의상 참조가 있을 때만 표시
    const hasCostumeSelection = params.bodyPartReferenceMap && Object.keys(params.bodyPartReferenceMap).length > 0;
    if (params.synthesisControlMode && hasCostumeSelection) {
        if (params.synthesisControlMode === 'original' && params.originalPreservationLevel !== undefined) {
            lines.push(`🔧 ${t('summary.detailAttach' as TranslationKey, language)}: ${params.originalPreservationLevel}${t('summary.step' as TranslationKey, language)}`);
        } else if (params.synthesisControlMode === 'reference' && params.costumeCreativityLevel !== undefined) {
            lines.push(`🎨 ${t('summary.referenceControl' as TranslationKey, language)}: ${params.costumeCreativityLevel}${t('summary.step' as TranslationKey, language)}`);
        }
    }

    // 조명 설정
    if (params.lightDirection && (params.lightDirection.yaw !== 0 || params.lightDirection.pitch !== 0)) {
        lines.push(`💡 ${t('summary.light' as TranslationKey, language)}: Yaw ${params.lightDirection.yaw}°, Pitch ${params.lightDirection.pitch}°`);
        if (params.lightIntensity !== undefined && params.lightIntensity !== 1) {
            lines.push(`  └ ${t('summary.intensity' as TranslationKey, language)}: ${(params.lightIntensity * 100).toFixed(0)}%`);
        }
    }

    // 의상 컨셉 아이템
    if (params.selectedClothingItems && params.selectedClothingItems.length > 0) {
        const firstName = t(`clothing.${params.selectedClothingItems[0]}` as TranslationKey, language);
        const extra = params.selectedClothingItems.length - 1;
        const detail = extra > 0 ? `${firstName} +${extra}` : firstName;
        lines.push(`👗 ${language === 'ko' ? '의상 컨셉' : 'Outfit'}: ${detail}`);
    }

    // 부위 참조 수
    const bpCount = params.bodyPartReferenceMap ? Object.keys(params.bodyPartReferenceMap).length : 0;
    if (bpCount > 0) {
        lines.push(`👤 ${language === 'ko' ? `부위 참조 ×${bpCount}` : `Body Ref ×${bpCount}`}`);
    }

    // 액션 포즈
    if (params.selectedActionPose) {
        lines.push(`🏃 ${getActionPoseName(params.selectedActionPose, language)}`);
    }

    // 선택된 오브젝트
    if (params.selectedObjectItems.length > 0) {
        const itemName = params.selectedObjectItems[0];
        lines.push(`🎯 ${t('summary.object' as TranslationKey, language)}: ${itemName}`);
    }

    // 프롬프트 (마지막에 표시)
    if (params.customPrompt && params.customPrompt.trim()) {
        const shortPrompt = params.customPrompt.length > 50
            ? params.customPrompt.substring(0, 50) + '...'
            : params.customPrompt;
        lines.push(`💬 "${shortPrompt}"`);
    }

    // 모델명
    if (params.modelName) {
        const modelShort = params.modelName.includes('gemini-3') ? 'Gemini 3' :
            params.modelName.includes('2.5-flash') ? 'Gemini 2.5' : params.modelName;
        lines.push(`🤖 ${modelShort}`);
    }

    // 해상도/비율
    if (params.resolution || params.aspectRatio) {
        const resParts: string[] = [];
        if (params.resolution) resParts.push(params.resolution);
        if (params.aspectRatio) resParts.push(params.aspectRatio);
        lines.push(`📐 ${resParts.join(' / ')}`);
    }

    return lines.length > 0
        ? lines.join('\n')
        : t('summary.defaultGeneration' as TranslationKey, language);
}
