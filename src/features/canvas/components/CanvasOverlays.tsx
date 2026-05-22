import React from 'react';
import { SelectionBar } from './ActionRing';
import { ContextMenu, ContextMenuProps } from './ContextMenu';
import { useCanvasStore } from '../../../store/canvasStore';
import { Z_INDEX } from '../../../constants/zIndex';

interface CanvasOverlaysProps {
    contextMenu: ContextMenuProps | null;
    selectionBarPosition: { x: number, y: number } | null;
    onZoomSelection: (media: File | string | null) => void;
    onEditSelection: (imageId: string) => void;
    onDelete: () => void;
    onDownload: (format: 'png' | 'webp') => void;
    onHideSelectionBar: () => void;
    language: string;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export const CanvasOverlays: React.FC<CanvasOverlaysProps> = React.memo(({
    contextMenu,
    selectionBarPosition,
    onZoomSelection,
    onEditSelection,
    onDelete,
    onDownload,
    onHideSelectionBar,
    language,
    onContextMenu,
}) => {
    const { selectedImageIds } = useCanvasStore();
    const selectedImageId = selectedImageIds.size === 1 ? Array.from(selectedImageIds)[0] : null;

    if (contextMenu) {
        return <ContextMenu {...contextMenu} />;
    }

    if (selectionBarPosition) {
        return (
            <div
                className="fixed pointer-events-auto"
                style={{
                    zIndex: Z_INDEX.SELECTION_BAR,
                    top: 0,
                    left: 0,
                    transform: `translate3d(${selectionBarPosition.x}px, ${selectionBarPosition.y}px, 0) translate(-50%, -100%) translateY(-8px)`,
                    willChange: 'transform',
                    animation: 'selection-toolbar-fade-in 0.15s ease-out forwards',
                }}
                onContextMenu={onContextMenu}
            >
                <SelectionBar
                    onZoom={(media) => { onZoomSelection(media); onHideSelectionBar(); }}
                    language={language as 'ko'}
                    onDelete={onDelete}
                    onDownload={onDownload}

                />
            </div>
        )
    }

    return null;
});
