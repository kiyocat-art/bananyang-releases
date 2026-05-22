import React, { useRef, useCallback } from 'react';

interface WipeSliderProps {
    originalSrc: string;
    generatedSrc: string;
    position: number;
    onPositionChange: (pos: number) => void;
}

export const WipeSlider = React.memo(function WipeSlider({
    originalSrc,
    generatedSrc,
    position,
    onPositionChange,
}: WipeSliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    const getPositionFromEvent = useCallback((clientX: number): number => {
        const container = containerRef.current;
        if (!container) return position;
        const rect = container.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }, [position]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        isDraggingRef.current = true;

        const handleMouseMove = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            onPositionChange(getPositionFromEvent(ev.clientX));
        };
        const handleMouseUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [getPositionFromEvent, onPositionChange]);

    const clipPercent = `${(1 - position) * 100}%`;

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden select-none cursor-col-resize"
        >
            {/* Generated image (right side) */}
            <img
                src={generatedSrc}
                alt="Generated"
                className="absolute inset-0 w-full h-full object-contain"
                style={{ clipPath: `inset(0 0 0 ${position * 100}%)` }}
                draggable={false}
            />
            {/* Original image (left side) */}
            <img
                src={originalSrc}
                alt="Original"
                className="absolute inset-0 w-full h-full object-contain"
                style={{ clipPath: `inset(0 ${clipPercent} 0 0)` }}
                draggable={false}
            />
            {/* Divider line */}
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.8)] pointer-events-none"
                style={{ left: `calc(${position * 100}% - 1px)` }}
            />
            {/* Handle */}
            <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-lg border-2 border-zinc-300 flex items-center justify-center cursor-col-resize z-10"
                style={{ left: `${position * 100}%` }}
                onMouseDown={handleMouseDown}
            >
                <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M4 2l-3 5 3 5M10 2l3 5-3 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            {/* Labels */}
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/50 text-white/80 pointer-events-none">
                원본
            </div>
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/50 text-white/80 pointer-events-none">
                생성
            </div>
        </div>
    );
});
