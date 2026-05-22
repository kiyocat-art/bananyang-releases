import React from 'react';
import { useHoverEdgeAutoScroll } from '../hooks/useHoverEdgeAutoScroll';

interface HoverEdgeAutoScrollProps {
  targetRef: React.RefObject<HTMLElement | null>;
  axis?: 'vertical' | 'horizontal';
  zoneSize?: number;
  speed?: number;
  enabled?: boolean;
}

export const HoverEdgeAutoScroll: React.FC<HoverEdgeAutoScrollProps> = ({
  targetRef,
  axis = 'vertical',
  zoneSize = 36,
  speed = 6,
  enabled = true,
}) => {
  const { startProps, endProps, canScrollStart, canScrollEnd } =
    useHoverEdgeAutoScroll(targetRef, { axis, speed, enabled });

  const isH = axis === 'horizontal';

  const startStyle: React.CSSProperties = isH
    ? { position: 'absolute', left: 0, top: 0, bottom: 0, width: zoneSize, pointerEvents: canScrollStart ? 'auto' : 'none', zIndex: 1 }
    : { position: 'absolute', top: 0, left: 0, right: 0, height: zoneSize, pointerEvents: canScrollStart ? 'auto' : 'none', zIndex: 1 };

  const endStyle: React.CSSProperties = isH
    ? { position: 'absolute', right: 0, top: 0, bottom: 0, width: zoneSize, pointerEvents: canScrollEnd ? 'auto' : 'none', zIndex: 1 }
    : { position: 'absolute', bottom: 0, left: 0, right: 0, height: zoneSize, pointerEvents: canScrollEnd ? 'auto' : 'none', zIndex: 1 };

  return (
    <>
      <div style={startStyle} {...startProps} />
      <div style={endStyle} {...endProps} />
    </>
  );
};
