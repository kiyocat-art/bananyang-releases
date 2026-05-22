import React from 'react';
import { TransformControls, ObjectTransform } from './TransformControls';
export type { ObjectTransform };

interface TransformableObjectProps {
    objectId?: string;
    src: string;
    transform: ObjectTransform;
    onTransform: (updater: (prev: ObjectTransform) => ObjectTransform) => void;
    onTransformEnd?: () => void;
    zoom: number;
    isInteractive?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    onDelete?: () => void;
    onFlip?: () => void;
    flipped?: boolean;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export const TransformableObject: React.FC<TransformableObjectProps> = ({ objectId, src, transform, onTransform, onTransformEnd, zoom, isInteractive = true, isSelected = false, onSelect, onDelete, onFlip, flipped = false, onContextMenu }) => {
    return (
        <TransformControls
            transform={transform}
            onTransform={onTransform}
            onTransformEnd={onTransformEnd}
            zoom={zoom}
            isInteractive={isInteractive}
            isSelected={isSelected}
            onMouseDown={(e) => {
                if (onSelect) onSelect();
            }}
            onContextMenu={onContextMenu}
            className={isSelected ? "!border-blue-500" : ""} // Override default yellow border for UnifiedEditor
            style={{ opacity: isSelected ? 1 : 0.7 }}
        >
            <img
                src={src}
                data-object-id={objectId}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
                style={{ transform: `scaleX(${flipped ? -1 : 1})` }}
            />
        </TransformControls>
    );
};
