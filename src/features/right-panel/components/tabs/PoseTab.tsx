import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Language, t } from '../../../../localization';
import { useCanvasStore } from '../../../../store/canvasStore';
import { useGenerationStore } from '../../../../store/generationStore';
import { DrawingCanvas, DrawingCanvasRef } from '../DrawingCanvas';
import { Section } from '../../../../components/Section';
import { BodyIcon } from '../../../../components/icons';

interface PoseTabProps {
    language: Language;
}

export const PoseTab: React.FC<PoseTabProps> = ({ language }) => {
    const { setPoseControlImage } = useGenerationStore();
    const { boardImages, setBoardImages } = useCanvasStore();
    const drawingCanvasRef = useRef<DrawingCanvasRef>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(0.4);

    const poseImage = useMemo(() => boardImages.find(img => img.role === 'pose'), [boardImages]);

    // poseRef 이미지: 밑그림 오버레이 소스
    const poseRefImage = useMemo(() =>
        boardImages.find(img => img.role === 'poseRef' || img.role === 'pose'),
        [boardImages]
    );
    const overlayUrl = poseRefImage?.src ?? null;

    const handleDrawEnd = (file: File | null) => {
        setPoseControlImage(file);
        if (file) {
            // A drawing was made, check if a pose image exists and clear its role.
            const currentPoseImage = useCanvasStore.getState().boardImages.find(img => img.role === 'pose');
            if (currentPoseImage) {
                setBoardImages(prev =>
                    prev.map(img =>
                        img.id === currentPoseImage.id ? { ...img, role: 'none' } : img
                    )
                );
            }
        }
    };

    useEffect(() => {
        // A pose image was selected/assigned. If a drawing exists, clear it.
        if (poseImage && useGenerationStore.getState().poseControlImage) {
            drawingCanvasRef.current?.clear();
        }
    }, [poseImage]);

    return (
        <Section
            title={t('section.poseControl.title', language)}
            tooltipText={t('tooltip.poseSection', language)}
            icon={<BodyIcon className="w-4 h-4" />}
        >
            <DrawingCanvas
                ref={drawingCanvasRef}
                onDrawEnd={handleDrawEnd}
                language={language}
                referenceOverlayUrl={overlayUrl}
                overlayOpacity={overlayOpacity}
            />
            {/* 오버레이 불투명도 슬라이더 (poseRef 이미지가 있을 때만 표시) */}
            {overlayUrl && (
                <div className="flex items-center gap-2 px-1 py-1">
                    <span className="text-xs text-zinc-400 whitespace-nowrap">
                        {language === 'ko' ? '밑그림 투명도' : 'Guide Opacity'}
                    </span>
                    <input
                        type="range"
                        min="0.05"
                        max="0.9"
                        step="0.05"
                        value={overlayOpacity}
                        onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
                        className="w-full"
                    />
                    <span className="text-xs text-zinc-500 w-8 text-right">
                        {Math.round(overlayOpacity * 100)}%
                    </span>
                </div>
            )}
        </Section>
    );
};
