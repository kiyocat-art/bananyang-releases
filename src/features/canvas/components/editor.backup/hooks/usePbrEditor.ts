import { useState, useRef, useEffect, useCallback } from 'react';
import { PbrSourceImage } from '../types';
import { blobManager } from '../../../../../utils/blobManager';
import { BoardImage } from '../../../../../types';
import { Language, t, TranslationKey } from '../../../../../localization';

// Define known map types
export const PBR_MAP_TYPES = [
    { id: 'albedo', label: 'Albedo' },
    { id: 'normal', label: 'Normal' },
    { id: 'roughness', label: 'Roughness' },
    { id: 'metallic', label: 'Metallic' },
    { id: 'height', label: 'Height' },
    { id: 'ao', label: 'AO' },
];

interface UsePbrEditorProps {
    image: BoardImage;
    activeTool: string;
    onNotification: (message: string, type: 'success' | 'error') => void;
    language: Language;
}

export const usePbrEditor = ({ image, activeTool, onNotification, language }: UsePbrEditorProps) => {
    // 3 Slots: [Structure, Front, Back]
    const [pbrSourceImages, setPbrSourceImages] = useState<(PbrSourceImage | null)[]>([null, null, null]);
    const fileInputRef1 = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);
    const fileInputRef3 = useRef<HTMLInputElement>(null);
    const [pbrPrompt, setPbrPrompt] = useState('');

    // Controlled Map Selection (Default: Albedo, Normal, Roughness)
    const [selectedMapIds, setSelectedMapIds] = useState<string[]>(['albedo', 'normal', 'roughness']);

    // Initialize Slot 0 with current image if empty
    useEffect(() => {
        if (activeTool === 'pbr' && !pbrSourceImages[0] && !pbrSourceImages[1] && !pbrSourceImages[2]) {
            const initialSrc = image.originalSrc || image.src;
            // Add Ref for this component's usage
            if (initialSrc.startsWith('blob:')) blobManager.addRef(initialSrc);

            setPbrSourceImages([
                { src: initialSrc, type: 'albedo' }, // Default to albedo/structure
                null,
                null
            ]);
        }
    }, [activeTool, image]);

    // Cleanup Refs when images change or component unmounts
    useEffect(() => {
        return () => {
            pbrSourceImages.forEach(img => {
                if (img?.src && img.src.startsWith('blob:')) {
                    blobManager.release(img.src);
                }
            });
        };
    }, []);

    // Handle Upload
    const handlePbrUploadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const blobUrl = blobManager.create(file); // Create managed blob

            setPbrSourceImages(prev => {
                const newImages = [...prev];
                // Release old blob if distinct
                const oldImg = newImages[index];
                if (oldImg?.src && oldImg.src.startsWith('blob:')) {
                    blobManager.release(oldImg.src);
                }

                // Determine Type based on slot
                let type = 'albedo';
                if (index === 1) type = 'front';
                if (index === 2) type = 'back';

                newImages[index] = { file, src: blobUrl, type };
                return newImages;
            });

            // Reset input
            e.target.value = '';
        }
    }, []);

    const updatePbrImageType = useCallback((index: number, type: string) => {
        setPbrSourceImages(prev => {
            const newImages = [...prev];
            if (newImages[index]) {
                newImages[index] = { ...newImages[index]!, type };
            }
            return newImages;
        });
    }, []);

    const toggleMapSelection = useCallback((id: string) => {
        setSelectedMapIds(prev => {
            if (prev.includes(id)) return prev.filter(m => m !== id);
            return [...prev, id];
        });
    }, []);

    const toggleAllMaps = useCallback(() => {
        setSelectedMapIds(prev => {
            if (prev.length === PBR_MAP_TYPES.length) return [];
            return PBR_MAP_TYPES.map(m => m.id);
        });
    }, []);

    // Get Params for Generation
    const getGenerationParams = useCallback(() => {
        if (selectedMapIds.length === 0) {
            return { valid: false, error: t('pbr.noMapSelected' as TranslationKey, language) };
        }

        let structureSource = pbrSourceImages[0];
        const frontSource = pbrSourceImages[1];
        const backSource = pbrSourceImages[2];

        // [FALLBACK] If no images set, assume current canvas image is Structure
        if (!structureSource && !frontSource && !backSource) {
            console.log('[usePbrEditor] No explicit images set. Using fallback.');
            const defaultSrc = image.originalSrc || image.src;
            // Helper object, file might be undefined if it's a remote URL
            // We use 'albedo' type as default structure
            structureSource = { src: defaultSrc, file: image.file, type: 'albedo' };
        }

        console.log('[usePbrEditor] Params Check:', { structureSource, frontSource, backSource });

        if (!structureSource && !frontSource && !backSource) {
            console.error('[usePbrEditor] Fallback failed or no images.');
            return { valid: false, error: t('pbr.needOneImage' as TranslationKey, language) };
        }

        // Add Refs for the Task Queue (Task will own these refs now)
        const taskSourceImages = pbrSourceImages.map(img => {
            if (img?.src && img.src.startsWith('blob:')) blobManager.addRef(img.src);
            return img;
        });

        return {
            valid: true,
            params: {
                pbrStructureImage: structureSource?.file,
                pbrFrontImage: frontSource?.file,
                pbrBackImage: backSource?.file,
                pbrMapTypes: selectedMapIds,
                prompt: pbrPrompt,
                pbrSourceImages: taskSourceImages
            },
            filePayload: structureSource?.file || frontSource?.file || image.file
        };
    }, [pbrSourceImages, selectedMapIds, pbrPrompt, language, image]);

    const resetPbr = useCallback(() => {
        setPbrSourceImages([null, null, null]);
        setPbrPrompt('');
    }, []);

    return {
        pbrSourceImages,
        setPbrSourceImages,
        pbrPrompt,
        setPbrPrompt,
        selectedMapIds,
        toggleMapSelection,
        toggleAllMaps,
        fileInputRefs: [fileInputRef1, fileInputRef2, fileInputRef3],
        handlePbrUploadChange,
        updatePbrImageType,
        getGenerationParams,
        resetPbr
    };
};
