import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GeneratedMedia } from '../../types';
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons';
import { HoverEdgeAutoScroll } from '../../components/HoverEdgeAutoScroll';

interface ResultThumbnailStripProps {
    mediaList: GeneratedMedia[];
    currentMediaId: string | null;
    onSelect: (id: string) => void;
}

export const ResultThumbnailStrip = React.memo(function ResultThumbnailStrip({
    mediaList,
    currentMediaId,
    onSelect,
}: ResultThumbnailStripProps) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // drag state — using refs to avoid re-renders mid-drag
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragStartScrollRef = useRef(0);
    const movedRef = useRef(false);

    const updateScrollState = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        updateScrollState();
        el.addEventListener('scroll', updateScrollState, { passive: true });

        const observer = new ResizeObserver(updateScrollState);
        observer.observe(el);

        return () => {
            el.removeEventListener('scroll', updateScrollState);
            observer.disconnect();
        };
    }, [mediaList.length, updateScrollState]);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        const el = scrollerRef.current;
        if (!el) return;
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        if (delta === 0) return;
        e.preventDefault();
        el.scrollLeft += delta;
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse') return;
        const el = scrollerRef.current;
        if (!el) return;
        isDraggingRef.current = true;
        movedRef.current = false;
        dragStartXRef.current = e.clientX;
        dragStartScrollRef.current = el.scrollLeft;

        const handleMouseMove = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const dx = ev.clientX - dragStartXRef.current;
            if (Math.abs(dx) > 3) movedRef.current = true;
            el.scrollLeft = dragStartScrollRef.current - dx;
        };
        const handleMouseUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            requestAnimationFrame(() => { movedRef.current = false; });
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, []);

    const scrollBy = useCallback((direction: 'left' | 'right') => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollBy({ left: direction === 'right' ? el.clientWidth * 0.8 : -el.clientWidth * 0.8, behavior: 'smooth' });
    }, []);

    if (mediaList.length === 0) return null;

    return (
        <div className="relative flex-shrink-0">
            {/* left fade + arrow */}
            {canScrollLeft && (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-zinc-900/80 to-transparent pointer-events-none z-10" />
                    <button
                        onClick={() => scrollBy('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                        tabIndex={-1}
                    >
                        <ChevronLeftIcon className="w-3 h-3" />
                    </button>
                </>
            )}

            {/* right fade + arrow */}
            {canScrollRight && (
                <>
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-zinc-900/80 to-transparent pointer-events-none z-10" />
                    <button
                        onClick={() => scrollBy('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                        tabIndex={-1}
                    >
                        <ChevronRightIcon className="w-3 h-3" />
                    </button>
                </>
            )}

            {/* scrollable thumbnail row */}
            <div
                ref={scrollerRef}
                className="flex gap-1.5 overflow-x-auto py-1 px-1 dark-glass-scrollbar select-none"
                style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
            >
                {mediaList.map((media) => {
                    const isActive = media.id === currentMediaId;
                    return (
                        <button
                            key={media.id}
                            onClick={() => {
                                if (movedRef.current) {
                                    movedRef.current = false;
                                    return;
                                }
                                onSelect(media.id);
                            }}
                            className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden transition-all ${
                                isActive
                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900'
                                    : 'ring-1 ring-white/10 hover:ring-white/40'
                            }`}
                        >
                            <img
                                src={media.tinySrc || media.thumbnailSrc || media.src}
                                alt=""
                                className="w-full h-full object-cover"
                                draggable={false}
                            />
                        </button>
                    );
                })}
            </div>
            <HoverEdgeAutoScroll targetRef={scrollerRef} axis="horizontal" />
        </div>
    );
});
