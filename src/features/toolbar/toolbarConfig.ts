import React from 'react';
import {
    HangerIcon, CameraIcon, BodyIcon, PaintBrushIcon, PaletteIcon,
    ScissorsIcon, LightIcon, ObjectIcon,
} from '../../components/icons';
import { ModelName } from '../../types';
import { getModelCapabilities } from '../../models/modelCapabilities';

export type ToolbarGroup = 'generation' | 'editor';

export interface ToolbarItem {
    key: string;
    /** SVG 아이콘 컴포넌트. null이면 textIcon을 사용 */
    icon: React.FC<{ className?: string }> | null;
    /** icon이 null일 때 렌더링할 텍스트 (예: "AI") */
    textIcon?: string;
    labelKo: string;
    labelEn: string;
    shortcut: string;
    component: null; // Phase 1: 실제 컴포넌트는 FloatingToolbar에서 lazy import
    group: ToolbarGroup;
    /** false를 반환하면 버튼 비활성화 */
    enabledCondition?: (ctx: { modelName: ModelName; hasOriginalImage: boolean }) => boolean;
    defaultSize: { w: number; h: number };
}

export const TOOLBAR_ITEMS: ToolbarItem[] = [
    // ── Generation 도구 (1~5) ──────────────────────────────────────────────
    {
        key: 'concept',
        icon: HangerIcon,
        labelKo: '컨셉 디자인',
        labelEn: 'Concept Design',
        shortcut: '1',
        component: null,
        group: 'generation',
        defaultSize: { w: 300, h: 460 },
    },
    {
        key: 'aiEdit',
        icon: null,
        textIcon: 'AI',
        labelKo: 'AI 편집',
        labelEn: 'AI Edit',
        shortcut: '2',
        component: null,
        group: 'generation',
        defaultSize: { w: 300, h: 460 },
    },
    {
        key: 'camera',
        icon: CameraIcon,
        labelKo: '카메라',
        labelEn: 'Camera',
        shortcut: '3',
        component: null,
        group: 'generation',
        defaultSize: { w: 300, h: 460 },
    },
    {
        key: 'pose',
        icon: BodyIcon,
        labelKo: '포즈',
        labelEn: 'Pose',
        shortcut: '4',
        component: null,
        group: 'generation',
        defaultSize: { w: 300, h: 460 },
    },
    {
        key: 'painting',
        icon: PaletteIcon,
        labelKo: '팔레트',
        labelEn: 'Palette',
        shortcut: '5',
        component: null,
        group: 'generation',
        defaultSize: { w: 300, h: 460 },
    },

    // ── Editor 도구 (6~9) ─────────────────────────────────────────────────
    // 이미지 뷰어(720) + 도구 사이드 패널(288) = 1008
    {
        key: 'crop',
        icon: ScissorsIcon,
        labelKo: '크롭',
        labelEn: 'Crop',
        shortcut: '6',
        component: null,
        group: 'editor',
        enabledCondition: ({ modelName, hasOriginalImage }) => getModelCapabilities(modelName).crop && hasOriginalImage,
        defaultSize: { w: 860, h: 500 },
    },
    {
        key: 'object',
        icon: ObjectIcon,
        labelKo: '객체삽입',
        labelEn: 'Object Insert',
        shortcut: '7',
        component: null,
        group: 'editor',
        enabledCondition: ({ modelName, hasOriginalImage }) => getModelCapabilities(modelName).objectInsertion && hasOriginalImage,
        defaultSize: { w: 860, h: 500 },
    },
    {
        key: 'inpaint',
        icon: PaintBrushIcon,
        labelKo: '인페인팅',
        labelEn: 'Inpaint',
        shortcut: '8',
        component: null,
        group: 'editor',
        enabledCondition: ({ modelName, hasOriginalImage }) => getModelCapabilities(modelName).inpainting && hasOriginalImage,
        defaultSize: { w: 860, h: 500 },
    },
    {
        key: 'relight',
        icon: LightIcon,
        labelKo: '리라이트',
        labelEn: 'Relight',
        shortcut: '9',
        component: null,
        group: 'editor',
        enabledCondition: ({ hasOriginalImage }) => hasOriginalImage,
        defaultSize: { w: 860, h: 500 },
    },
];
