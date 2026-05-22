import React from 'react';
import { Tooltip } from './Tooltip';

export const Section: React.FC<{ title?: string; children: React.ReactNode; className?: string; tooltipText?: string; topRightAction?: React.ReactNode; icon?: React.ReactNode; }> = ({ title, children, className, tooltipText, topRightAction: TopRightAction, icon }) => (
  <div className={`glass-section flex flex-col flex-shrink-0 ${className}`}>
    {title && (
      <>
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
                {icon && <div className="text-white/50">{icon}</div>}
                <Tooltip tip={tooltipText || ''}>
                    <h2 className="text-sm font-semibold text-white/80">{title}</h2>
                </Tooltip>
            </div>
            {TopRightAction && <div>{TopRightAction}</div>}
        </div>
        <div className="mx-3 h-px bg-white/10 flex-shrink-0 mb-0.5" />
      </>
    )}
    <div className={`flex flex-col flex-grow min-h-0 p-2`}>
        {children}
    </div>
  </div>
);