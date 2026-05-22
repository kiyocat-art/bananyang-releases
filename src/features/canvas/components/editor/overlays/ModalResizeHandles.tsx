
import React from 'react';

interface ModalResizeHandlesProps {
    onResizeStart: (e: React.MouseEvent, direction: 'sw' | 'se') => void;
}

export const ModalResizeHandles: React.FC<ModalResizeHandlesProps> = ({ onResizeStart }) => {
    return (
        <>
            <div
                onMouseDown={(e) => onResizeStart(e, 'se')}
                className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50 flex items-end justify-end p-1.5"
            >
                <svg className="w-2.5 h-2.5 text-white/30" fill="none" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="2"><path d="M 0 8 L 8 0 M 3 8 L 8 3 M 6 8 L 8 6" /></svg>
            </div>
            <div
                onMouseDown={(e) => onResizeStart(e, 'sw')}
                className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-50 flex items-end justify-start p-1.5"
            >
                <svg className="w-2.5 h-2.5 text-white/30" fill="none" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="2"><path d="M 8 8 L 0 0 M 5 8 L 0 3 M 2 8 L 0 6" /></svg>
            </div>
        </>
    );
};
