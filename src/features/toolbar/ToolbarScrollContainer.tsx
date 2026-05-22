import React, { useRef, useCallback, useEffect } from 'react';
import { useHoverEdgeAutoScroll } from '../../hooks/useHoverEdgeAutoScroll';

interface ToolbarScrollContainerProps {
    orientation: 'horizontal' | 'vertical';
    children: React.ReactNode;
}

const SCROLL_STEP = 40;

export const ToolbarScrollContainer: React.FC<ToolbarScrollContainerProps> = ({
    orientation,
    children,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const panStartPos = useRef(0);
    const panStartScroll = useRef(0);

    const isH = orientation === 'horizontal';
    const axis = isH ? 'horizontal' as const : 'vertical' as const;

    const { startProps, endProps, canScrollStart, canScrollEnd } =
        useHoverEdgeAutoScroll(scrollRef, { axis });

    const scrollBy = useCallback((delta: number) => {
        const el = scrollRef.current;
        if (!el) return;
        if (isH) el.scrollBy({ left: delta, behavior: 'smooth' });
        else el.scrollBy({ top: delta, behavior: 'smooth' });
    }, [isH]);

    // Middle-mouse-button pan
    const handleScrollMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 1) return;
        e.preventDefault();
        isPanning.current = true;
        panStartPos.current = isH ? e.clientX : e.clientY;
        panStartScroll.current = isH
            ? (scrollRef.current?.scrollLeft ?? 0)
            : (scrollRef.current?.scrollTop ?? 0);
        if (scrollRef.current) scrollRef.current.style.cursor = 'grabbing';

        const onMove = (ev: MouseEvent) => {
            if (!isPanning.current || !scrollRef.current) return;
            const delta = (isH ? ev.clientX : ev.clientY) - panStartPos.current;
            if (isH) scrollRef.current.scrollLeft = panStartScroll.current - delta;
            else scrollRef.current.scrollTop = panStartScroll.current - delta;
        };
        const onUp = () => {
            isPanning.current = false;
            if (scrollRef.current) scrollRef.current.style.cursor = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [isH]);

    // Wheel: route vertical wheel → horizontal scroll on horizontal toolbar
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!isH) return;
            const rawDelta = e.deltaY || e.deltaX;
            if (rawDelta === 0) return;
            e.preventDefault();
            // Mouse wheel (large delta) → fixed SCROLL_STEP; trackpad hi-res → raw delta
            const delta = Math.abs(rawDelta) >= 50
                ? Math.sign(rawDelta) * SCROLL_STEP
                : rawDelta;
            el.scrollBy({ left: delta, behavior: 'smooth' });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [isH]);

    const arrowClass = `toolbar-scroll-arrow ${isH ? 'arrow-h' : 'arrow-v'}`;

    return (
        <div className={`toolbar-scroll-wrapper ${isH ? 'toolbar-scroll-wrapper--h' : 'toolbar-scroll-wrapper--v'}`}>
            {/* Back arrow (◀ or ▲) — hover triggers auto-scroll, click single-steps */}
            <button
                className={`${arrowClass} arrow-back`}
                disabled={!canScrollStart}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); scrollBy(-SCROLL_STEP); }}
                {...startProps}
                tabIndex={-1}
                aria-label={isH ? 'Scroll left' : 'Scroll up'}
            >
                {isH ? (
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                        <path d="M7 1L1 6l6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                ) : (
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                        <path d="M1 7L6 1l5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>

            {/* Scrollable content */}
            <div
                ref={scrollRef}
                className={`toolbar-scroll-content ${isH ? 'toolbar-scroll-content--h' : 'toolbar-scroll-content--v'}`}
                onMouseDown={handleScrollMouseDown}
            >
                {children}
            </div>

            {/* Forward arrow (▶ or ▼) — hover triggers auto-scroll, click single-steps */}
            <button
                className={`${arrowClass} arrow-forward`}
                disabled={!canScrollEnd}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); scrollBy(SCROLL_STEP); }}
                {...endProps}
                tabIndex={-1}
                aria-label={isH ? 'Scroll right' : 'Scroll down'}
            >
                {isH ? (
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                        <path d="M1 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                ) : (
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                        <path d="M1 1l5 6 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>
        </div>
    );
};
