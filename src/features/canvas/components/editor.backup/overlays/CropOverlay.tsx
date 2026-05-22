
import React from 'react';

interface CropOverlayProps {
    imageSize: { width: number; height: number };
    editBox: { x: number; y: number; width: number; height: number };
    zoom: number;
    handleCropMouseDown: (e: React.MouseEvent, type: string) => void;
    isNavigateMode?: boolean;
}

// Cursor mapping for resize handles
const getCursorForHandle = (handle: string): string => {
    const cursorMap: Record<string, string> = {
        'nw': 'nw-resize',
        'n': 'ns-resize',
        'ne': 'ne-resize',
        'e': 'ew-resize',
        'se': 'se-resize',
        's': 'ns-resize',
        'sw': 'sw-resize',
        'w': 'ew-resize'
    };
    return cursorMap[handle] || 'default';
};

export const CropOverlay: React.FC<CropOverlayProps> = ({
    imageSize,
    editBox,
    zoom,
    handleCropMouseDown,
    isNavigateMode
}) => {
    if (imageSize.width <= 0) return null;

    // Handle configuration with position styles and correct transform for each position
    const handles = [
        { c: 'nw', top: 0, left: 0, right: undefined, bottom: undefined, tx: -50, ty: -50 },
        { c: 'n', top: 0, left: '50%', right: undefined, bottom: undefined, tx: -50, ty: -50 },
        { c: 'ne', top: 0, left: undefined, right: 0, bottom: undefined, tx: 50, ty: -50 },
        { c: 'e', top: '50%', left: undefined, right: 0, bottom: undefined, tx: 50, ty: -50 },
        { c: 'se', top: undefined, left: undefined, right: 0, bottom: 0, tx: 50, ty: 50 },
        { c: 's', top: undefined, left: '50%', right: undefined, bottom: 0, tx: -50, ty: 50 },
        { c: 'sw', top: undefined, left: 0, right: undefined, bottom: 0, tx: -50, ty: 50 },
        { c: 'w', top: '50%', left: 0, right: undefined, bottom: undefined, tx: -50, ty: -50 }
    ];

    return (
        <div
            className="absolute border-2 border-dashed border-white"
            style={{
                left: editBox.x,
                top: editBox.y,
                width: editBox.width,
                height: editBox.height,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                cursor: 'move',
                pointerEvents: isNavigateMode ? 'none' : 'auto'
            }}
            onMouseDown={(e) => handleCropMouseDown(e, 'move')}
        >
            {handles.map(h => (
                <div
                    key={h.c}
                    className="absolute w-3 h-3 border-2 border-white rounded-full bg-neutral-800"
                    style={{
                        top: h.top,
                        left: h.left,
                        right: h.right,
                        bottom: h.bottom,
                        cursor: getCursorForHandle(h.c),
                        transform: `translate(${h.tx}%, ${h.ty}%) scale(${1 / zoom})`,
                        transformOrigin: 'center',
                        pointerEvents: isNavigateMode ? 'none' : 'auto'
                    }}
                    onMouseDown={(e) => handleCropMouseDown(e, h.c)}
                />
            ))}
        </div>
    );
};
