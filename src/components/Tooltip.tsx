import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Z_INDEX } from '../constants/zIndex';

export const Tooltip: React.FC<{ children: React.ReactNode; tip: React.ReactNode; position?: 'top' | 'bottom' | 'left' | 'right'; className?: string; tipClassName?: string; tipZIndex?: number }> = ({ children, tip, position = 'top', className = '', tipClassName = '', tipZIndex }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  useEffect(() => {
    if (visible && tip && wrapperRef.current && tooltipRef.current) {
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      let top = 0, left = 0;

      switch (position) {
        case 'top':
          top = wrapperRect.top - tooltipRect.height - 8;
          left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = wrapperRect.bottom + 8;
          left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = wrapperRect.top + (wrapperRect.height / 2) - (tooltipRect.height / 2);
          left = wrapperRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = wrapperRect.top + (wrapperRect.height / 2) - (tooltipRect.height / 2);
          left = wrapperRect.right + 8;
          break;
      }

      // Clamp position to be within viewport
      const clampedTop = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));
      const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));

      setPos({ top: clampedTop, left: clampedLeft });
    }
  }, [visible, position, tip]);

  const displayClass = (className.includes('w-') || className.includes('block') || className.includes('flex')) ? '' : 'inline-block';

  const tooltipElement = (visible && tip) ? (
    <div
      ref={tooltipRef}
      className={`fixed glass-tooltip text-white/80 text-sm rounded-md py-2 px-4 whitespace-pre-wrap transition-opacity duration-200 pointer-events-none ${visible ? 'opacity-100' : 'opacity-0'} ${tipClassName}`}
      style={{ top: pos.top, left: pos.left, zIndex: tipZIndex ?? Z_INDEX.TOOLTIP }}
    >
      {tip}
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} onMouseEnter={show} onMouseLeave={hide} className={`${displayClass} ${className}`}>
      {children}
      {tooltipElement && ReactDOM.createPortal(tooltipElement, document.getElementById('tooltip-root')!)}
    </div>
  );
};
