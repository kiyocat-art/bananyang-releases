import { useMemo } from 'react';
import { useCanvasStore } from '../store/canvasStore';

/**
 * Shared hook to compute all reference types from board images
 * Eliminates duplicate computation across multiple components
 */
export const useAllReferenceTypes = () => {
    const boardImages = useCanvasStore(state => state.boardImages);

    return useMemo(() => {
        const types = new Set<'general' | 'costume' | 'pose'>();
        boardImages.forEach(img => {
            if (img.referenceType) {
                types.add(img.referenceType);
            }
        });
        return types;
    }, [boardImages]);
};
