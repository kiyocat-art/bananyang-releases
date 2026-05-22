import React from 'react';
import { usePromptContextMenu } from '../../../../../hooks/usePromptContextMenu';
import { PbrSourceImage } from '../types';
import { Tooltip } from '../../../../../components/Tooltip';
import { ResetIcon, UploadIcon, PlusIcon, CloseIcon } from '../../../../../components/icons';
import { Language, TranslationKey } from '../../../../../localization';

interface PbrTabProps {
    t: (key: string, lang: string) => string;
    language: Language;
    pbrSourceImages: (PbrSourceImage | null)[];
    setPbrSourceImages: React.Dispatch<React.SetStateAction<(PbrSourceImage | null)[]>>;
    handlePbrUploadChange: (e: React.ChangeEvent<HTMLInputElement>, index: number) => void;
    updatePbrImageType: (index: number, type: string) => void;
    pbrFileInputRef2: React.RefObject<HTMLInputElement>;
    pbrFileInputRef3: React.RefObject<HTMLInputElement>;
    pbrPrompt: string;
    setPbrPrompt: (prompt: string) => void;
    selectedMapIds: string[];
    toggleMapSelection: (id: string) => void;
    toggleAllMaps: () => void;
}

// Image type options for dropdown selection
const IMAGE_TYPE_OPTIONS = [
    { value: 'front', labelKo: '정면', labelEn: 'Front' },
    { value: 'back', labelKo: '뒷면', labelEn: 'Back' },
    { value: 'albedo', labelKo: '알베도', labelEn: 'Albedo' },
    { value: 'normal', labelKo: '노말', labelEn: 'Normal' },
    { value: 'roughness', labelKo: '러프니스', labelEn: 'Roughness' },
    { value: 'metallic', labelKo: '메탈릭', labelEn: 'Metallic' },
    { value: 'height', labelKo: '하이트', labelEn: 'Height' },
    { value: 'ao', labelKo: 'AO', labelEn: 'AO' },
    { value: 'structure', labelKo: '구조', labelEn: 'Structure' },
    { value: 'reference', labelKo: '참고', labelEn: 'Reference' },
];

// Default types for each slot
const DEFAULT_SLOT_TYPES = ['structure', 'front', 'back'];

export const PbrTab: React.FC<PbrTabProps> = ({
    t, language, pbrSourceImages, setPbrSourceImages, handlePbrUploadChange,
    updatePbrImageType, pbrFileInputRef2, pbrFileInputRef3, pbrPrompt, setPbrPrompt,
    selectedMapIds, toggleMapSelection, toggleAllMaps
}) => {
    // Create file input ref for slot 0 (structure)
    const pbrFileInputRef1 = React.useRef<HTMLInputElement>(null);
    const { ref: promptRef, handleContextMenu, contextMenuPortal } = usePromptContextMenu({
        value: pbrPrompt,
        onChange: setPbrPrompt,
        language,
    });

    const MAP_TYPES = [
        { id: 'albedo', label: 'Albedo (Diffuse)' },
        { id: 'normal', label: 'Normal Map' },
        { id: 'roughness', label: 'Roughness Map' },
        { id: 'metallic', label: 'Metallic Map' },
        { id: 'height', label: 'Height Map' },
        { id: 'ao', label: 'AO Map' },
    ];

    // Get current type for a slot, with fallback to default
    const getSlotType = (index: number): string => {
        return pbrSourceImages[index]?.type || DEFAULT_SLOT_TYPES[index] || 'reference';
    };

    // Helper to get label for a type value
    const getTypeLabel = (value: string, lang: Language): string => {
        const option = IMAGE_TYPE_OPTIONS.find(opt => opt.value === value);
        return option ? (lang === 'ko' ? option.labelKo : option.labelEn) : value;
    };

    // Handle type change for a slot
    const handleTypeChange = (index: number, newType: string) => {
        updatePbrImageType(index, newType);
        // If there's no image yet, create a placeholder entry with just the type
        if (!pbrSourceImages[index]) {
            setPbrSourceImages(prev => {
                const newImages = [...prev];
                newImages[index] = { src: '', type: newType };
                return newImages;
            });
        }
    };

    // Handle removing an image from a slot
    const handleRemoveImage = (index: number) => {
        setPbrSourceImages(prev => {
            const newImages = [...prev];
            newImages[index] = null;
            return newImages;
        });
    };

    // Render a single image slot with dropdown on the right
    const renderSlot = (index: number, fileInputRef: React.RefObject<HTMLInputElement>) => {
        const slotType = getSlotType(index);
        const hasImage = pbrSourceImages[index]?.src;

        return (
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex items-center gap-3">
                {/* Thumbnail / Upload Area (Left) */}
                <div
                    className="w-16 h-16 flex-shrink-0 bg-black/30 rounded-lg flex items-center justify-center border border-dashed border-white/20 overflow-hidden relative cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {hasImage ? (
                        <>
                            <img src={pbrSourceImages[index]!.src} alt={slotType} className="w-full h-full object-cover" />
                            {/* Hover overlay with upload icon */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <UploadIcon className="w-5 h-5 text-white" />
                            </div>
                            {/* Remove button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <CloseIcon className="w-2.5 h-2.5" />
                            </button>
                        </>
                    ) : (
                        <PlusIcon className="w-5 h-5 text-zinc-500" />
                    )}
                </div>

                {/* Dropdown Selector (Right) */}
                <select
                    value={slotType}
                    onChange={(e) => handleTypeChange(index, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-black/40 border border-white/10 rounded-md py-2 px-3 text-sm text-zinc-200 font-medium outline-none cursor-pointer hover:bg-black/60 transition-colors"
                >
                    {IMAGE_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {language === 'ko' ? opt.labelKo : opt.labelEn}
                        </option>
                    ))}
                </select>
            </div>
        );
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-100">
                    {t('pbr.multiViewTitle' as TranslationKey, language)}
                </h3>
                <Tooltip tip={t('common.reset', language)} position="left">
                    <button
                        onClick={() => setPbrSourceImages([null, null, null])}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                        <ResetIcon className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>

            <p className="text-xs text-zinc-400">
                {t('pbr.multiViewDescription' as TranslationKey, language)}
            </p>

            {/* Hidden file inputs */}
            <input type="file" ref={pbrFileInputRef1} onChange={(e) => handlePbrUploadChange(e, 0)} className="hidden" accept="image/*" />
            <input type="file" ref={pbrFileInputRef2} onChange={(e) => handlePbrUploadChange(e, 1)} className="hidden" accept="image/*" />
            <input type="file" ref={pbrFileInputRef3} onChange={(e) => handlePbrUploadChange(e, 2)} className="hidden" accept="image/*" />

            {/* Image Slots - Vertical List */}
            <div className="flex flex-col gap-2">
                {renderSlot(0, pbrFileInputRef1)}
                {renderSlot(1, pbrFileInputRef2)}
                {renderSlot(2, pbrFileInputRef3)}
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-zinc-200">
                        {t('pbr.selectMapTypes' as TranslationKey, language)}
                    </h4>
                    <button
                        onClick={toggleAllMaps}
                        className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded border border-white/10 transition-colors"
                    >
                        {t('pbr.toggleAll' as TranslationKey, language)}
                    </button>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                    {MAP_TYPES.map(map => (
                        <label key={map.id} className="flex items-center gap-3 py-1 cursor-pointer hover:bg-white/5 rounded px-2 -mx-2 transition-colors">
                            <input
                                type="checkbox"
                                checked={selectedMapIds.includes(map.id)}
                                onChange={() => toggleMapSelection(map.id)}
                                className="w-4 h-4 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                            />
                            <span className="text-sm text-zinc-200">{map.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="border-t border-white/10 pt-3">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                    {t('aiEdit.prompt', language)}
                </h4>
                <textarea
                    ref={promptRef}
                    onContextMenu={handleContextMenu}
                    value={pbrPrompt}
                    onChange={(e) => setPbrPrompt(e.target.value)}
                    placeholder={t('aiEdit.promptPlaceholder', language)}
                    className="w-full bg-neutral-900 border border-neutral-600 rounded-md py-2 px-3 text-sm text-zinc-200 placeholder-zinc-400 focus:ring-1 focus:ring-white outline-none resize-none"
                    rows={3}
                />
            </div>
            {contextMenuPortal}
        </div>
    );
};
