import React from 'react';
import { GenerationParams, AiAction, ActionPose } from '../types';
import { Language, t, TranslationKey } from '../localization';
import {
    CameraIcon, LightIcon, HangerIcon, BodyIcon,
    PencilIcon, PaintBrushIcon, ScissorsIcon, FitToScreenIcon,
    PlusIcon, GadgetsIcon,
    LayersIcon, MotionIcon, FrameIcon, MagnifyIcon,
} from './icons';

// AI-tool PNG icons (same assets used in AiEditPanel)
import iconAutoColoring from '../assets/icons/ai-tools/icon_auto_coloring.png';
import iconVariation    from '../assets/icons/ai-tools/icon_variation.png';
import iconPose         from '../assets/icons/ai-tools/icon_pose.png';
import iconOutfit       from '../assets/icons/ai-tools/icon_outfit.png';
import iconRemoveBg     from '../assets/icons/ai-tools/icon_remove_bg.png';
import iconKeepBg       from '../assets/icons/ai-tools/icon_keep_bg.png';


// ─── types ────────────────────────────────────────────────────────────────────

type IconFC  = React.FC<{ className?: string }>;
type IconImg = string; // PNG src

interface ActionCfg {
    iconSvg?: IconFC;
    iconPng?: IconImg;
    ko: string;
    en: string;
}

interface BadgeRow {
    iconSvg?: IconFC;
    iconPng?: IconImg;
    label: string;
    detail?: string;
}

// ─── static config ────────────────────────────────────────────────────────────

const AI_ACTION_CFG: Record<AiAction, ActionCfg> = {
    removeBackground:   { iconPng: iconRemoveBg,     ko: '배경 제거',     en: 'Remove BG' },
    keepBackgroundOnly: { iconPng: iconKeepBg,       ko: '배경만 유지',   en: 'Keep BG' },
    extractPose:        { iconPng: iconPose,          ko: '포즈 추출',     en: 'Extract Pose' },
    extractOutfit:      { iconPng: iconOutfit,        ko: '의상 추출',     en: 'Extract Outfit' },
    autoColoring:       { iconPng: iconAutoColoring,  ko: '자동 채색',     en: 'Auto Coloring' },
    variation:          { iconPng: iconVariation,     ko: '디자인 베리에이션', en: 'Design Variation' },
    insertObject:       { iconSvg: PlusIcon,          ko: '오브젝트 삽입', en: 'Insert Object' },
    expand:             { iconSvg: FitToScreenIcon,   ko: '이미지 확장',   en: 'Expand' },
    pbr:                { iconSvg: LayersIcon,        ko: 'PBR 맵',       en: 'PBR Map' },
    pbr_advanced:       { iconSvg: LayersIcon,        ko: 'PBR 고급',     en: 'PBR Advanced' },
    relight:            { iconSvg: LightIcon,         ko: '리라이팅',      en: 'Relight' },
    inpainting:         { iconSvg: PaintBrushIcon,    ko: '인페인팅',      en: 'Inpainting' },
    inpaintInsert:      { iconSvg: PaintBrushIcon,    ko: '인페인팅 삽입', en: 'Inpaint Insert' },
    inpaintRemove:      { iconSvg: PaintBrushIcon,    ko: '인페인팅 제거', en: 'Inpaint Remove' },
};

const POSE_LABEL: Record<ActionPose, { ko: string; en: string }> = {
    [ActionPose.General]:       { ko: '일반', en: 'General' },
    [ActionPose.Attack]:        { ko: '공격', en: 'Attack' },
    [ActionPose.StandingModel]: { ko: 'A-Pose', en: 'A-Pose' },
};

// ─── sub-components ───────────────────────────────────────────────────────────

/** Render either a PNG img or an SVG icon component at the specified size */
const RowIcon: React.FC<{ svg?: IconFC; png?: string; sizeCls: string }> = ({ svg: Svg, png, sizeCls }) => {
    if (png) {
        return <img src={png} alt="" className={`${sizeCls} object-contain flex-shrink-0`} />;
    }
    if (Svg) {
        return <Svg className={sizeCls} />;
    }
    return null;
};

const Row: React.FC<BadgeRow> = ({ iconSvg, iconPng, label, detail }) => (
    <div className="flex items-center gap-2.5 text-sm text-white">
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            <RowIcon svg={iconSvg} png={iconPng} sizeCls="w-4 h-4" />
        </span>
        <span className="font-semibold leading-none">{label}</span>
        {detail && (
            <span className="text-white/70 text-xs leading-none ml-0.5">{detail}</span>
        )}
    </div>
);

const MetaRow: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center gap-2 text-sm text-white/75">
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {icon}
        </span>
        <span className="font-medium">{label}</span>
    </div>
);

// ─── main component ───────────────────────────────────────────────────────────

export const GenerationSummaryContent: React.FC<{
    params: GenerationParams;
    language: Language;
}> = ({ params, language }) => {
    const ko = language === 'ko';
    const rows: BadgeRow[] = [];

    // 1. AI Edit Action
    if (params.aiEditAction) {
        const cfg = AI_ACTION_CFG[params.aiEditAction];
        let detail: string | undefined;
        if (params.aiEditAction === 'variation' && params.variationCreativity !== undefined) {
            detail = `Lv.${params.variationCreativity}`;
        } else if (params.aiEditAction === 'autoColoring' && params.autoColoringIntensity !== undefined) {
            detail = `Lv.${params.autoColoringIntensity}`;
        } else if ((params.aiEditAction === 'pbr' || params.aiEditAction === 'pbr_advanced') && params.pbrMapTypes?.length) {
            detail = params.pbrMapTypes.join(', ');
        }
        rows.push({ iconSvg: cfg.iconSvg, iconPng: cfg.iconPng, label: ko ? cfg.ko : cfg.en, detail });
    }

    // 2. Camera View
    if (params.cameraView) {
        const v = params.cameraView;
        const hasCustom = v.yaw !== 0 || v.pitch !== 0 || v.fov !== 50 || v.cameraAnglePreset;
        if (hasCustom) {
            let detail = '';
            if (v.cameraAnglePreset) {
                detail = v.cameraAnglePreset;
            } else {
                if (v.yaw !== 0 || v.pitch !== 0) detail = `Y${v.yaw}° P${v.pitch}°`;
                if (v.fov !== 50) detail += (detail ? ' ' : '') + `FOV${v.fov}`;
            }
            rows.push({ iconSvg: CameraIcon, label: ko ? '카메라' : 'Camera', detail });
        }
    }

    // 3. Light Direction
    if (params.lightDirection && (params.lightDirection.yaw !== 0 || params.lightDirection.pitch !== 0)) {
        const intensStr = (params.lightIntensity !== undefined && params.lightIntensity !== 1)
            ? ` ${(params.lightIntensity * 100).toFixed(0)}%` : '';
        rows.push({
            iconSvg: LightIcon,
            label: ko ? '조명' : 'Light',
            detail: `Y${params.lightDirection.yaw}° P${params.lightDirection.pitch}°${intensStr}`,
        });
    }

    // 4. Clothing Items (concept tab)
    if (params.selectedClothingItems && params.selectedClothingItems.length > 0) {
        const firstName = t(`clothing.${params.selectedClothingItems[0]}` as TranslationKey, language);
        const extra = params.selectedClothingItems.length - 1;
        rows.push({
            iconSvg: HangerIcon,
            label: ko ? '의상 컨셉' : 'Outfit',
            detail: extra > 0 ? `${firstName} +${extra}` : firstName,
        });
    }

    // 5. Body Part Reference Map
    const bpCount = params.bodyPartReferenceMap ? Object.keys(params.bodyPartReferenceMap).length : 0;
    if (bpCount > 0) {
        let detail = `×${bpCount}`;
        if (params.synthesisControlMode === 'original' && params.originalPreservationLevel !== undefined) {
            detail += ` · Orig Lv.${params.originalPreservationLevel}`;
        } else if (params.synthesisControlMode === 'reference' && params.costumeCreativityLevel !== undefined) {
            detail += ` · Ref Lv.${params.costumeCreativityLevel}`;
        }
        rows.push({ iconSvg: BodyIcon, label: ko ? '부위 참조' : 'Body Ref', detail });
    }

    // 6. Action Pose
    if (params.selectedActionPose) {
        rows.push({
            iconSvg: MotionIcon,
            label: ko ? '액션 포즈' : 'Pose',
            detail: ko ? POSE_LABEL[params.selectedActionPose]?.ko : POSE_LABEL[params.selectedActionPose]?.en,
        });
    }

    // 7. Object Items
    if (params.selectedObjectItems && params.selectedObjectItems.length > 0) {
        const name = t(`object.${params.selectedObjectItems[0]}` as TranslationKey, language);
        rows.push({ iconSvg: GadgetsIcon, label: ko ? '오브젝트' : 'Object', detail: name });
    }

    // 8. Grid Layout
    if (params.gridLayout) {
        rows.push({ iconSvg: FrameIcon, label: ko ? '그리드' : 'Grid', detail: params.gridLayout });
    }

    // 9. Grounding Tools (Google Search / Image Search)
    if (params.groundingTools?.length) {
        const toolLabels = params.groundingTools.map(t =>
            t === 'googleSearch' ? (ko ? 'G검색' : 'G·Search') : (ko ? '이미지검색' : 'Img·Search')
        ).join(', ');
        rows.push({ iconSvg: MagnifyIcon, label: ko ? '검색 그라운딩' : 'Grounding', detail: toolLabels });
    }

    // 10. Custom Prompt
    if (params.customPrompt?.trim()) {
        const short = params.customPrompt.length > 42
            ? params.customPrompt.substring(0, 42) + '…'
            : params.customPrompt;
        rows.push({ iconSvg: PencilIcon, label: `"${short}"` });
    }

    if (rows.length === 0) {
        return (
            <span className="text-white/75 text-sm italic">
                {ko ? '기본 생성' : 'Default Generation'}
            </span>
        );
    }

    // ── meta section: model / resolution / ratio ──
    const modelName = params.modelName ?? '';
    const is31      = modelName === 'gemini-3.1-flash-image-preview';
    const is30Pro   = modelName === 'models/gemini-3-pro-image-preview';
    const is25      = modelName === 'gemini-2.5-flash-image';

    const modelImg = is30Pro ? 'assets/gemini-3-pro-image-preview.png'
                   : is31    ? 'assets/gemini-3.1-flash-image-preview.png'
                   : is25    ? 'assets/gemini-2.5-flash-image.png'
                   : null;

    const modelLabel = is30Pro ? 'Nano Banana Pro'
                     : is31    ? 'Nano Banana2'
                     : is25    ? 'Nano Banana1'
                     : (modelName || null);

    const resolution  = params.resolution;
    const aspectRatio = params.aspectRatio;
    const hasMeta     = modelLabel || resolution || aspectRatio;

    return (
        <div className="flex flex-col gap-2.5 min-w-[190px]">
            {rows.map((row, i) => (
                <Row key={i} {...row} />
            ))}

            {hasMeta && (
                <>
                    <div className="h-px bg-white/15 my-0.5" />

                    {modelLabel && (
                        <MetaRow
                            icon={
                                modelImg
                                    ? <img src={modelImg} alt={modelLabel} className="w-4 h-4 object-contain" />
                                    : <span className="text-xs font-bold leading-none">AI</span>
                            }
                            label={modelLabel}
                        />
                    )}

                    {(resolution || aspectRatio) && (
                        <MetaRow
                            icon={<FrameIcon className="w-4 h-4" />}
                            label={[
                                resolution ? resolution.toUpperCase() : null,
                                aspectRatio ?? null,
                            ].filter(Boolean).join('  ·  ')}
                        />
                    )}
                </>
            )}
        </div>
    );
};
