import React, { useMemo, useCallback } from 'react';
import { BoardImage, ModelName } from '../../../types';
import { t, Language } from '../../../localization';
import { useCanvasStore } from '../../../store/canvasStore';
import { useGenerationStore } from '../../../store/generationStore';
import { useUIStore } from '../../../store/uiStore';
import { REF_COLORS, REFERENCE_TYPE_COLORS, ROLE_COLORS } from '../../../constants';
import { Z_INDEX } from '../../../constants/zIndex';
import { Tooltip } from '../../../components/Tooltip';
import { RoleIndicator } from './RoleIndicator';
import { CloseIcon } from '../../../components/icons';
import { useAllReferenceTypes } from '../../../hooks/useAllReferenceTypes';
import { GenerationOptionsBadges } from './GenerationOptionsBar';
import { SafeImage } from '../../../components/SafeImage';
import { useRegisterPopoverImages } from '../../../hooks/usePopoverImageRegistry';

interface RoleThumbnailsProps {
    language: Language;
    onImageDoubleClick: (image: BoardImage) => void;
    isPresetDropdownOpen?: boolean;
    promptPanelHeight?: number;
    modelName?: ModelName;
}

export const RoleThumbnails: React.FC<RoleThumbnailsProps> = ({ language, onImageDoubleClick, isPresetDropdownOpen = false, promptPanelHeight = 80, modelName }) => {
    // Optimized selector: only subscribe to role images and pre-sort them
    const sortedImages = useCanvasStore(
        useCallback((state) => {
            const roleOrder: Record<BoardImage['role'], number> = {
                'original': 1,
                'generalRef': 2,
                'costumeRef': 3,
                'poseRef': 4,
                'background': 5,
                'reference': 2,
                'pose': 4,
                'none': 99
            };
            return state.boardImages
                .filter(img => img.role !== 'none' || !!img.maskFile)
                .sort((a, b) => {
                    const orderA = roleOrder[a.role];
                    const orderB = roleOrder[b.role];
                    if (orderA !== orderB) return orderA - orderB;
                    if (a.role === 'generalRef' && b.role === 'generalRef') {
                        return (a.refIndex ?? 0) - (b.refIndex ?? 0);
                    }
                    if (a.role === 'reference' && b.role === 'reference') {
                        return (a.refIndex ?? 0) - (b.refIndex ?? 0);
                    }
                    return 0;
                });
        }, [])
    );

    const activeReferenceIndex = useCanvasStore(state => state.activeReferenceIndex);
    const setSelectedImageIds = useCanvasStore(state => state.setSelectedImageIds);
    const setRole = useCanvasStore(state => state.setRole);
    const objectEditorImages = useCanvasStore(state => state.objectEditorImages);
    const removeObjectEditorImage = useCanvasStore(state => state.removeObjectEditorImage);

    // Get all active reference types using shared hook
    const allReferenceTypes = useAllReferenceTypes();

    // Check if any generation options are active (for showing options bar even without role images)
    const hasActiveGenOptions = useGenerationStore(s =>
        s.selectedClothingConcept !== null ||
        s.isCameraViewActive ||
        s.poseControlImage !== null ||
        s.selectedPalette !== null ||
        s.selectedAiEditAction !== null ||
        s.isAutoColoringActive ||
        s.isVariationActive ||
        s.gridLayout !== null
    );
    const hasEditorOption = useUIStore(s => s.isEditorOpen && s.editorMode !== null);

    const allDisplayedIds = useMemo(
        () => [...sortedImages.map(i => i.id), ...objectEditorImages.map(i => i.id)],
        [sortedImages, objectEditorImages]
    );
    useRegisterPopoverImages(allDisplayedIds);

    if (sortedImages.length === 0 && objectEditorImages.length === 0 && !hasActiveGenOptions && !hasEditorOption) return null;

    const getRoleLabel = (image: BoardImage) => {
        switch (image.role) {
            case 'original': return t('role.badge.original', language);
            case 'background': return t('role.badge.background', language);
            case 'costumeRef': return t('role.badge.costumeRef', language);
            case 'poseRef': return t('role.badge.poseRef', language);
            case 'generalRef': return image.refIndex !== undefined ? `${t('role.badge.generalRef', language)} ${image.refIndex + 1}` : t('role.badge.generalRef', language);
            // Deprecated 'reference' role with referenceType (for backward compatibility)
            case 'reference':
                if (image.referenceType === 'costume') return t('role.badge.costumeRef', language);
                if (image.referenceType === 'pose') return t('role.badge.poseRef', language);
                return image.refIndex !== undefined ? `${t('role.badge.generalRef', language)} ${image.refIndex + 1}` : t('role.badge.generalRef', language);
            default: return '';
        }
    };

    const getRoleColor = (image: BoardImage) => {
        switch (image.role) {
            case 'original': return ROLE_COLORS.original;
            case 'background': return ROLE_COLORS.background;
            case 'pose': return ROLE_COLORS.pose;
            case 'generalRef': return ROLE_COLORS.generalRef;
            case 'costumeRef': return ROLE_COLORS.costumeRef;
            case 'poseRef': return ROLE_COLORS.poseRef;
            case 'reference':
                if (image.referenceType && REFERENCE_TYPE_COLORS[image.referenceType]) {
                    return REFERENCE_TYPE_COLORS[image.referenceType];
                }
                return '#4ade80'; // Default light green
            default: return 'transparent';
        }
    }

    // Snap exactly to the top edge of the PromptPanel glass panel
    // PromptPanel: absolute bottom-10 (40px) + glass-panel border 1px top = +41
    const bottomOffset = promptPanelHeight + 41;

    return (
        <div
            className="fixed left-1/2 -translate-x-1/2 flex flex-row items-center gap-1 bg-neutral-800/50 backdrop-blur-md border border-white/10 p-2 rounded-xl transition-all duration-200"
            style={{ bottom: `${bottomOffset}px`, zIndex: Z_INDEX.ROLE_THUMBNAILS }}
        >
            {sortedImages.map((image, index) => {
                const prevImage = index > 0 ? sortedImages[index - 1] : null;
                const showSeparator = prevImage && prevImage.role !== image.role && image.role !== 'reference';

                const isRef = image.role === 'reference';
                const isActiveRef = isRef && image.refIndex === activeReferenceIndex;
                const roleColor = getRoleColor(image);
                const finalBorderColor = isActiveRef ? '#FFFFFF' : roleColor;
                const borderWidthClass = isActiveRef ? 'border-4' : 'border-2';

                const handleClick = () => {
                    if (isRef) {
                        setSelectedImageIds(prev => new Set([image.id]));
                    }
                };

                return (
                    <React.Fragment key={image.id}>
                        {showSeparator && (
                            <div className="w-px h-8 bg-white/20 mx-1" />
                        )}
                        <Tooltip tip={getRoleLabel(image)} position="top">
                            <button
                                onClick={handleClick}
                                onDoubleClick={() => onImageDoubleClick(image)}
                                className={`group relative w-[52px] h-[52px] rounded-lg overflow-hidden bg-zinc-700 transition-all hover:opacity-80 ${isRef ? 'cursor-pointer' : 'cursor-default'} ${borderWidthClass}`}
                                style={{ borderColor: finalBorderColor }}
                            >
                                <RoleIndicator role={image.role} refIndex={image.refIndex} referenceType={image.referenceType} allReferenceTypes={allReferenceTypes} language={language} />
                                <SafeImage srcChain={[image.thumbnailSrc, image.tinySrc, image.src]} alt={getRoleLabel(image)} className="w-full h-full object-cover" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRole([image.id], 'none');
                                    }}
                                    className="absolute top-0 right-0 z-10 p-1 bg-black/50 rounded-bl-md text-white/70 hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            </button>
                        </Tooltip>
                    </React.Fragment>
                );
            })}

            {/* Object editor images — shown in insertion order */}
            {objectEditorImages.length > 0 && (
                <>
                    {(sortedImages.length > 0) && <div className="w-px h-8 bg-white/20 mx-1" />}
                    {objectEditorImages.map((img, idx) => (
                        <Tooltip key={img.id} tip={`객체 ${idx + 1}`} position="top">
                            <button
                                className="group relative w-[52px] h-[52px] rounded-lg overflow-hidden bg-zinc-700 border-2 cursor-default hover:opacity-80"
                                style={{ borderColor: '#a78bfa' }}
                            >
                                <span className="absolute top-0.5 left-0.5 z-10 text-[9px] font-bold px-1 rounded leading-none" style={{ background: '#a78bfa', color: '#fff' }}>
                                    객체 {idx + 1}
                                </span>
                                <SafeImage srcChain={[img.src]} alt={`객체 ${idx + 1}`} className="w-full h-full object-cover" />
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeObjectEditorImage(img.id); }}
                                    className="absolute top-0 right-0 z-10 p-1 bg-black/50 rounded-bl-md text-white/70 hover:text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            </button>
                        </Tooltip>
                    ))}
                </>
            )}

            {/* Generation Options Bar — inline to the right of role thumbnails */}
            <GenerationOptionsBadges language={language} modelName={modelName} />
        </div >
    );
};