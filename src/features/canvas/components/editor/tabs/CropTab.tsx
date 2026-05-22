import React, { useRef } from 'react';
import { Language } from '../../../../../localization';
import { useEditorStore } from '../../../../../features/toolbar/useEditorStore';
import { EditorImageViewer } from '../EditorImageViewer';
import { useCropInteraction } from '../hooks/useCropInteraction';
import { CropOverlay } from '../overlays/CropOverlay';
import { ResetIcon } from '../../../../../components/icons';
import { Tooltip } from '../../../../../components/Tooltip';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { HoverEdgeAutoScroll } from '../../../../../components/HoverEdgeAutoScroll';

interface CropTabProps {
    language: Language;
    localImageSrc?: string | null;
}

const RATIO_TOOLTIPS: Record<string, { ko: string; en: string }> = {
    'Free':  { ko: '비율 제한 없음',  en: 'No aspect ratio constraint' },
    '1:1':   { ko: '정사각형',        en: 'Square' },
    '4:3':   { ko: '가로 4:3',        en: 'Landscape 4:3' },
    '16:9':  { ko: '와이드스크린',    en: 'Widescreen 16:9' },
    '3:4':   { ko: '세로 3:4',        en: 'Portrait 3:4' },
    '9:16':  { ko: '세로 9:16',       en: 'Portrait 9:16' },
};

const ASPECT_RATIOS: { label: string; ratio: number | null }[] = [
    { label: 'Free', ratio: null },
    { label: '1:1', ratio: 1 },
    { label: '4:3', ratio: 4 / 3 },
    { label: '16:9', ratio: 16 / 9 },
    { label: '3:4', ratio: 3 / 4 },
    { label: '9:16', ratio: 9 / 16 },
];

const RATIO_VISUAL: Record<string, { w: number; h: number; dashed?: boolean }> = {
    'Free':  { w: 16, h: 16, dashed: true },
    '1:1':   { w: 16, h: 16 },
    '4:3':   { w: 20, h: 15 },
    '16:9':  { w: 20, h: 11 },
    '3:4':   { w: 15, h: 20 },
    '9:16':  { w: 11, h: 20 },
};

const RatioVisual: React.FC<{ label: string }> = ({ label }) => {
    const VIEWBOX = 24;
    const { w: rw, h: rh, dashed } = RATIO_VISUAL[label] ?? { w: 16, h: 16 };
    const x = (VIEWBOX - rw) / 2;
    const y = (VIEWBOX - rh) / 2;
    return (
        <svg width={VIEWBOX} height={VIEWBOX} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} fill="none" aria-hidden="true">
            <rect
                x={x} y={y} width={rw} height={rh}
                rx={1.5}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray={dashed ? '3 2' : undefined}
            />
        </svg>
    );
};

export const CropTab: React.FC<CropTabProps> = ({ language, localImageSrc }) => {
    const {
        cropBox, resetCrop, setImageDisplaySize,
        imageDisplaySize, setCropBox,
    } = useEditorStore();

    const zoomRef = useRef(1);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);
    const { handleCropMouseDown } = useCropInteraction({ zoomRef });
    const { sidebarWidth, handleResizeMouseDown } = useResizableSidebar();

    const applyAspectRatio = (ratio: number | null) => {
        if (!imageDisplaySize || imageDisplaySize.width === 0) return;
        const { width: imgW, height: imgH } = imageDisplaySize;
        if (ratio === null) {
            resetCrop(imgW, imgH);
            return;
        }
        const imgRatio = imgW / imgH;
        let w: number, h: number;
        if (imgRatio > ratio) {
            h = imgH;
            w = h * ratio;
        } else {
            w = imgW;
            h = w / ratio;
        }
        setCropBox({ x: (imgW - w) / 2, y: (imgH - h) / 2, width: w, height: h });
    };

    return (
        <div className="absolute inset-0 flex overflow-hidden bg-[#0e0e0e]">
            <EditorImageViewer
                className="flex-1 min-w-0 h-full"
                localImageSrc={localImageSrc}
                onZoomChange={(z) => { zoomRef.current = z; }}
                onImageLoad={(size) => { resetCrop(size.width, size.height); setImageDisplaySize(size); }}
                renderInsideTransform={({ imageSize, zoom, isNavigateMode, isZKeyDown }) =>
                    cropBox && (
                        <CropOverlay
                            imageSize={imageSize}
                            editBox={cropBox}
                            zoom={zoom}
                            handleCropMouseDown={handleCropMouseDown}
                            isNavigateMode={isNavigateMode}
                            isZKeyDown={isZKeyDown}
                        />
                    )
                }
            />

            <div
                className="relative flex-shrink-0 h-full bg-zinc-900/85 backdrop-blur-sm border-l border-white/10"
                style={{ width: sidebarWidth }}
            >
                {/* 리사이즈 핸들 */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group/rh"
                    onMouseDown={handleResizeMouseDown}
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-px rounded-full bg-white/0 group-hover/rh:bg-white/30 transition-colors duration-150" />
                </div>
                <div ref={sidebarScrollRef} className="h-full overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-zinc-100">
                        {language === 'ko' ? '크롭' : 'Crop'}
                    </h3>
                    <Tooltip tip={language === 'ko' ? '초기화' : 'Reset'} position="top">
                        <button
                            onClick={() => imageDisplaySize && resetCrop(imageDisplaySize.width, imageDisplaySize.height)}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                        >
                            <ResetIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>

                <div className="border-t border-white/10 pt-3">
                    <h4 className="font-bold text-sm text-zinc-200 mb-2">
                        {language === 'ko' ? '비율' : 'Aspect Ratio'}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {ASPECT_RATIOS.map(({ label, ratio }) => (
                            <Tooltip
                                key={label}
                                tip={RATIO_TOOLTIPS[label]?.[language === 'ko' ? 'ko' : 'en'] ?? label}
                                position="top"
                                className="w-full"
                            >
                                <button
                                    onClick={() => applyAspectRatio(ratio)}
                                    className="w-full flex flex-col items-center justify-center gap-2 py-3 rounded-md bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors border border-white/10 cursor-pointer"
                                >
                                    <RatioVisual label={label} />
                                    <span className="text-xs leading-none">{label}</span>
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>

            </div>
                </div>
                <HoverEdgeAutoScroll targetRef={sidebarScrollRef} />
        </div>
    );
};
