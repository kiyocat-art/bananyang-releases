import React from 'react';
import { Z_INDEX } from '../constants/zIndex';

export const LoadingSpinner: React.FC<{ fullScreen?: boolean; className?: string }> = ({ fullScreen = false, className = "h-8 w-8" }) => (
  <div
    className={`flex justify-center items-center ${fullScreen ? 'fixed inset-0 bg-black/80 backdrop-blur-sm' : ''}`}
    style={fullScreen ? { zIndex: Z_INDEX.MODAL } : undefined}
  >
    <div
      className={`animate-spin rounded-full ${className} border-t-2 border-b-2 border-white`}
      style={{ willChange: 'transform', transform: 'translate3d(0, 0, 0)' }}
    ></div>
  </div>
);