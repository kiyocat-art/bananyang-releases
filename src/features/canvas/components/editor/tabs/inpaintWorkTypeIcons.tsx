import React from 'react';

export const ClothingIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 2L3 5.5l2.5 1.5V17h9V7l2.5-1.5L13 2" />
        <path d="M7 2c0 1.3 6 1.3 6 0" />
    </svg>
);

export const CharacterEditIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="5" r="2.5" />
        <path d="M2 17v-1a5.5 5.5 0 0111 0v1" />
        <path d="M14 10.5l1.5 1.5-3.5 3.5H10.5v-1.5L14 10.5z" />
    </svg>
);

export const BgFillIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="16" height="12" rx="1.5" />
        <path d="M2 13l4-4 3 3 3-3 3 3" />
        <circle cx="14" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </svg>
);

export const RemoveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M7 10h6" />
        <circle cx="10" cy="10" r="7" />
        <path d="M7 7l6 6M13 7l-6 6" />
    </svg>
);

export const FaceCloseUpIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="9.5" r="7" />
        <circle cx="7.5" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="12.5" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
        <path d="M10 10.5v1.5" />
        <path d="M7.5 13.5c0.7 1 4.3 1 5 0" />
    </svg>
);
