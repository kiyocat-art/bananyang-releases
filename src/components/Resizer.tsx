import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface ResizerProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onToggle: () => void;
  isCollapsed: boolean;
  panel: 'left' | 'right';
}

export const Resizer: React.FC<ResizerProps> = ({ onMouseDown, onToggle, isCollapsed, panel }) => {
  const Icon = panel === 'left' 
    ? (isCollapsed ? ChevronRightIcon : ChevronLeftIcon) 
    : (isCollapsed ? ChevronLeftIcon : ChevronRightIcon);
  
  return (
    <div
      onMouseDown={onMouseDown}
      className={`relative flex-shrink-0 w-1.5 group transition-colors duration-200 ${isCollapsed ? 'bg-zinc-800' : 'cursor-col-resize bg-zinc-700/50 hover:bg-zinc-500'}`}
    >
        <button
            onMouseDown={(e) => e.stopPropagation()} // Prevent drag from starting
            onClick={onToggle}
            className="absolute top-1/2 -translate-y-1/2 w-6 h-12 bg-zinc-800 hover:bg-zinc-600 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all duration-200 z-10 border border-zinc-700 cursor-pointer"
            style={{
                ...(panel === 'left' ? { left: '50%', transform: 'translate(-50%, -50%)' } : { right: '50%', transform: 'translate(50%, -50%)' })
            }}
        >
            <Icon className="w-5 h-5" />
        </button>
    </div>
  );
};