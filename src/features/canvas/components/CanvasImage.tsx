import React, { useState, useEffect } from 'react';
import { BoardImage, GenerationParams } from '../../../types';
import { useCanvasStore } from '../../../store/canvasStore';
import { REF_COLORS } from '../../../constants';
import { RoleIndicator } from './RoleIndicator';
import { ROLE_COLORS } from '../../../constants';
import { Tooltip } from '../../../components/Tooltip';
import { useAllReferenceTypes } from '../../../hooks/useAllReferenceTypes';
import { useSettingsStore } from '../../../store/settingsStore';
import { GenerationSummaryContent } from '../../../components/GenerationSummaryContent';


interface CanvasImageProps {
    image: BoardImage;
    onContextMenu: (e: React.MouseEvent<HTMLDivElement>, imageId: string, type: 'image') => void;
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>, imageId: string) => void;
    onDoubleClick?: (imageId: string) => void;
    onLoadGenerationParams: (params: GenerationParams) => void;
    onZoomImage?: (image: BoardImage) => void;
    onDownloadImage?: (image: BoardImage) => void;
}

const areImagePropsEqual = (prevProps: Readonly<CanvasImageProps>, nextProps: Readonly<CanvasImageProps>) => {
    // onMouseDown and onDoubleClick are intentionally ignored because new inline functions are passed on every render.
    // The component will always use the latest handlers from props for its event handlers anyway.
    // We only re-render if the image data itself or other stable handlers change.
    return prevProps.image === nextProps.image &&
        prevProps.onContextMenu === nextProps.onContextMenu &&
        prevProps.onLoadGenerationParams === nextProps.onLoadGenerationParams &&
        prevProps.onZoomImage === nextProps.onZoomImage &&
        prevProps.onDownloadImage === nextProps.onDownloadImage;
};

export const CanvasImage: React.FC<CanvasImageProps> = React.memo(({ image, onContextMenu, onMouseDown, onDoubleClick, onLoadGenerationParams, onZoomImage, onDownloadImage }) => {
    const isSelected = useCanvasStore(state => state.selectedImageIds.has(image.id));
    const groupEditModeId = useCanvasStore(state => state.groupEditModeId);
    const isObjectInsertMode = useCanvasStore(state => state.isObjectInsertMode);
    const isShiftDown = useCanvasStore(state => state.isShiftDown);
    const language = useSettingsStore(state => state.language);

    // [Drag Sync] Override position during drag for real-time UI sync
    const [overridePosition, setOverridePosition] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleMove = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.id === image.id) {
                setOverridePosition({ x: detail.x, y: detail.y });
            }
        };
        const handleMoveEnd = () => setOverridePosition(null);

        window.addEventListener('canvas-element-move', handleMove);
        window.addEventListener('mouseup', handleMoveEnd);
        return () => {
            window.removeEventListener('canvas-element-move', handleMove);
            window.removeEventListener('mouseup', handleMoveEnd);
        };
    }, [image.id]);

    // Use override position during drag, otherwise use store position
    const displayX = overridePosition?.x ?? image.x;
    const displayY = overridePosition?.y ?? image.y;

    const hasRole = image.role !== 'none';

    const isInEditMode = !!groupEditModeId;
    const isPartOfEditingGroup = image.groupId === groupEditModeId;
    const isDimmed = isInEditMode && !isPartOfEditingGroup;

    // Get all active reference types using shared hook
    const allReferenceTypes = useAllReferenceTypes();

    const getRoleColor = () => {
        if (image.role === 'original') return ROLE_COLORS.original;
        if (image.role === 'background') return ROLE_COLORS.background;
        if (image.role === 'pose') return ROLE_COLORS.pose;
        if (image.role === 'reference' && image.refIndex !== undefined) {
            return REF_COLORS[image.refIndex % REF_COLORS.length];
        }
        return 'transparent';
    };

    // Border and shadow are now handled by the GPU worker

    return (
        <div
            draggable={false}
            data-image-id={image.id}
            className={`group absolute select - none transition - opacity duration - 300`}
            style={{
                left: displayX,
                top: displayY,
                width: image.width,
                height: image.height,
                zIndex: image.zIndex,
                cursor: 'grab',
                opacity: isDimmed ? 0.3 : 1,
            }}
            onMouseDown={(e) => onMouseDown(e, image.id)}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(image.id); }}
            onContextMenu={(e) => onContextMenu(e, image.id, 'image')}
        >
            <RoleIndicator role={image.role} refIndex={image.refIndex} referenceType={image.referenceType} allReferenceTypes={allReferenceTypes} language={language} />
            {/* Image rendering is now handled by the WebGL worker. This div serves as the interaction layer. */}
            {/* Icon overlay */}
            {/* P button — zoom-compensated so it doesn't grow when canvas is zoomed in */}
            <div
                className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ transform: `scale(min(1, calc(1 / var(--canvas-zoom))))`, transformOrigin: 'top right' }}
            >
                {image.generationParams && (
                    <Tooltip
                        tip={<GenerationSummaryContent params={image.generationParams} language={language} />}
                        position="top"
                        className="text-left"
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); onLoadGenerationParams(image.generationParams!); }}
                            className="w-7 h-7 flex items-center justify-center bg-black/60 rounded-md text-white font-bold text-sm hover:bg-white/40 hover:text-black transition-colors cursor-pointer"
                            aria-label="Load Generation Parameters"
                        >
                            P
                        </button>
                    </Tooltip>
                )}
            </div>
            {/* Mask overlay could also be moved to GPU, but keeping it here for now if it's simple CSS */}
            {image.maskSrc && (
                <div
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{
                        zIndex: 1,
                        maskImage: `url(${image.maskSrc})`,
                        WebkitMaskImage: `url(${image.maskSrc})`,
                        maskSize: '100% 100%',
                        WebkitMaskSize: '100% 100%',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                        backgroundColor: 'rgba(255, 50, 50, 0.45)', // red tint — matches inpaint editor
                        maskMode: 'luminance',
                        transform: image.scaleX === -1 ? 'scaleX(-1)' : undefined,
                    }}
                />
            )}
            {/* Object Insertion Mode Overlay */}
            {isObjectInsertMode && !isShiftDown && (
                <div className="absolute inset-0 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg pointer-events-none z-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/70 px-2 py-1 rounded text-white text-xs font-bold">
                        + Insert
                    </div>
                </div>
            )}
        </div>
    );
}, areImagePropsEqual);