import { useRef, useEffect } from 'react';
import { useEditorStore } from '../../../../../features/toolbar/useEditorStore';

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface InteractionState {
    type: string;
    startX: number;
    startY: number;
    startCropBox: CropBox;
}

interface UseCropInteractionParams {
    zoomRef: React.RefObject<number>;
}

export const useCropInteraction = ({ zoomRef }: UseCropInteractionParams) => {
    const interactionRef = useRef<InteractionState | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!interactionRef.current) return;
            const { type, startX, startY, startCropBox } = interactionRef.current;
            const zoom = zoomRef.current ?? 1;
            const dx = (e.clientX - startX) / zoom;
            const dy = (e.clientY - startY) / zoom;
            const minSize = 20 / zoom;

            let next = { ...startCropBox };

            if (type === 'move') {
                next.x = startCropBox.x + dx;
                next.y = startCropBox.y + dy;
            } else {
                const rightEdge = startCropBox.x + startCropBox.width;
                const bottomEdge = startCropBox.y + startCropBox.height;

                if (type.includes('w')) {
                    let newX = startCropBox.x + dx;
                    let newW = rightEdge - newX;
                    if (newW < minSize) { newW = minSize; newX = rightEdge - minSize; }
                    next.x = newX;
                    next.width = newW;
                }
                if (type.includes('e')) {
                    let newW = startCropBox.width + dx;
                    if (newW < minSize) newW = minSize;
                    next.width = newW;
                }
                if (type.includes('n')) {
                    let newY = startCropBox.y + dy;
                    let newH = bottomEdge - newY;
                    if (newH < minSize) { newH = minSize; newY = bottomEdge - minSize; }
                    next.y = newY;
                    next.height = newH;
                }
                if (type.includes('s')) {
                    let newH = startCropBox.height + dy;
                    if (newH < minSize) newH = minSize;
                    next.height = newH;
                }
            }

            useEditorStore.getState().setCropBox(next);
        };

        const handleMouseUp = () => {
            interactionRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [zoomRef]);

    const handleCropMouseDown = (e: React.MouseEvent, type: string) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const cropBox = useEditorStore.getState().cropBox;
        if (!cropBox) return;
        interactionRef.current = {
            type,
            startX: e.clientX,
            startY: e.clientY,
            startCropBox: { ...cropBox },
        };
    };

    return { handleCropMouseDown };
};
