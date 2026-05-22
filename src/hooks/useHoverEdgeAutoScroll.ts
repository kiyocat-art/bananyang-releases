import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

type Axis = 'vertical' | 'horizontal' | 'both';

interface Options {
  axis?: Axis;
  speed?: number;
  enabled?: boolean;
}

interface ZoneHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export interface HoverEdgeAutoScrollResult {
  startProps: ZoneHandlers;
  endProps: ZoneHandlers;
  canScrollStart: boolean;
  canScrollEnd: boolean;
}

export function useHoverEdgeAutoScroll(
  scrollRef: React.RefObject<HTMLElement | null>,
  options: Options = {}
): HoverEdgeAutoScrollResult {
  const { axis = 'vertical', speed = 6, enabled = true } = options;

  const rafRef = useRef<number | null>(null);
  const activeEdgeRef = useRef<'start' | 'end' | null>(null);
  const [canScrollStart, setCanScrollStart] = useState(false);
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  // Refs for values read inside RAF loop to avoid stale closures
  const speedRef = useRef(speed);
  const axisRef = useRef(axis);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { axisRef.current = axis; }, [axis]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ax = axisRef.current;
    if (ax === 'horizontal') {
      setCanScrollStart(el.scrollLeft > 0);
      setCanScrollEnd(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    } else {
      setCanScrollStart(el.scrollTop > 0);
      setCanScrollEnd(el.scrollTop < el.scrollHeight - el.clientHeight - 1);
    }
  }, [scrollRef]);

  const stopScroll = useCallback(() => {
    activeEdgeRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // loopRef holds the current loop body — reassigned each render so it always captures fresh state
  const loopRef = useRef<() => void>(() => {});
  useEffect(() => {
    loopRef.current = () => {
      const el = scrollRef.current;
      const edge = activeEdgeRef.current;
      if (!el || !edge) { rafRef.current = null; return; }

      const sp = speedRef.current;
      const ax = axisRef.current;
      const sign = edge === 'start' ? -1 : 1;

      if (ax === 'horizontal' || ax === 'both') {
        el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + sign * sp, el.scrollWidth - el.clientWidth));
      }
      if (ax === 'vertical' || ax === 'both') {
        el.scrollTop = Math.max(0, Math.min(el.scrollTop + sign * sp, el.scrollHeight - el.clientHeight));
      }

      let atBoundary: boolean;
      if (ax === 'horizontal') {
        atBoundary = edge === 'start' ? el.scrollLeft <= 0 : el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      } else {
        atBoundary = edge === 'start' ? el.scrollTop <= 0 : el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
      }

      if (!atBoundary) {
        rafRef.current = requestAnimationFrame(loopRef.current);
      } else {
        rafRef.current = null;
      }
    };
  });

  const startScroll = useCallback((edge: 'start' | 'end') => {
    if (!enabled) return;
    activeEdgeRef.current = edge;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [enabled]);

  // ResizeObserver + scroll listener → keeps canScroll* in sync
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateScrollState);
    };
  }, [scrollRef, updateScrollState]);

  // Stop on window blur or tab hidden
  useEffect(() => {
    const onBlur = () => stopScroll();
    const onVisibility = () => { if (document.hidden) stopScroll(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopScroll();
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [stopScroll]);

  return {
    startProps: { onMouseEnter: () => startScroll('start'), onMouseLeave: stopScroll },
    endProps: { onMouseEnter: () => startScroll('end'), onMouseLeave: stopScroll },
    canScrollStart,
    canScrollEnd,
  };
}
