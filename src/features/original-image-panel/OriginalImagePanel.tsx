import React, { useState, useEffect, useMemo } from 'react';
import { GeneratedMedia } from '../../types';
import { t, Language } from '../../localization';
import { useCanvasStore } from '../../store/canvasStore';
import { WipeSlider } from './WipeSlider';
import { ResultThumbnailStrip } from './ResultThumbnailStrip';

interface OriginalImagePanelProps {
    language: Language;
    allHistoryMedia: GeneratedMedia[];
    comparedMediaId: string | null;
    onSelectComparedMedia: (id: string) => void;
    panelWidth: number;
}

export function OriginalImagePanel({
    language,
    allHistoryMedia,
    comparedMediaId,
    onSelectComparedMedia,
    panelWidth,
}: OriginalImagePanelProps) {
    const [wipePosition, setWipePosition] = useState(0.5);

    const originalImage = useCanvasStore(
        (s) => s.boardImages.find((img) => img.role === 'original')
    );

    const comparedMedia = useMemo(
        () => allHistoryMedia.find((m) => m.id === comparedMediaId) ?? null,
        [allHistoryMedia, comparedMediaId]
    );

    // Reset comparedMediaId when it no longer exists or is unrelated to current original
    useEffect(() => {
        if (comparedMediaId && !comparedMedia) {
            onSelectComparedMedia('');
            return;
        }
        if (comparedMedia && originalImage && comparedMedia.sourceImageId !== originalImage.id) {
            onSelectComparedMedia('');
        }
    }, [comparedMediaId, comparedMedia, originalImage, onSelectComparedMedia]);

    const relatedResults = useMemo(
        () =>
            originalImage
                ? allHistoryMedia.filter((m) => m.sourceImageId === originalImage.id)
                : [],
        [allHistoryMedia, originalImage]
    );

    const isCompareMode =
        !!comparedMedia &&
        !!originalImage &&
        comparedMedia.sourceImageId === originalImage.id;

    const originalSrc = originalImage?.proxySrc || originalImage?.src || '';
    const generatedSrc = comparedMedia?.proxySrc || comparedMedia?.src || '';

    return (
        <div className="flex flex-col h-full">

            {/* Main image area */}
            <div className="flex-grow relative min-h-0 bg-zinc-900">
                {!originalImage ? (
                    <div className="absolute inset-0 flex items-center justify-center text-center">
                        <p className="text-zinc-500 text-xs px-4">
                            {t('section.originalImage.noOriginal', language)}
                        </p>
                    </div>
                ) : isCompareMode ? (
                    <WipeSlider
                        originalSrc={originalSrc}
                        generatedSrc={generatedSrc}
                        position={wipePosition}
                        onPositionChange={setWipePosition}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <img
                            src={originalSrc}
                            alt="Original"
                            className="max-w-full max-h-full object-contain"
                            draggable={false}
                        />
                    </div>
                )}
            </div>

            {/* Thumbnail strip */}
            {relatedResults.length > 0 ? (
                <ResultThumbnailStrip
                    mediaList={relatedResults}
                    currentMediaId={comparedMediaId}
                    onSelect={onSelectComparedMedia}
                />
            ) : originalImage ? (
                <div className="flex-shrink-0 px-2 py-1.5 text-center">
                    <p className="text-zinc-600 text-[10px]">
                        {t('section.originalImage.noResults', language)}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
