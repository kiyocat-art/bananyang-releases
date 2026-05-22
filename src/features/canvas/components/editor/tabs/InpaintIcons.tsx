import React from 'react';

type Props = { className?: string };
const baseProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

// Brain — Scene Analyzer master icon
export const BrainIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.6}>
        <path d="M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5.3 3 3 0 0 0 .2 5 3 3 0 0 0 5 2.5A3 3 0 0 0 12 21V3.5A3 3 0 0 0 9.5 3z" />
        <path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5.3 3 3 0 0 1-.2 5 3 3 0 0 1-5 2.5A3 3 0 0 1 12 21" />
        <path d="M9 11h2M13 11h2M9 15h2M13 15h2" />
    </svg>
);

// Body silhouette — anatomy constraint
export const BodySilhouetteIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.6}>
        <circle cx="12" cy="5" r="2.2" />
        <path d="M7 11.5c0-1.5 2.2-2.5 5-2.5s5 1 5 2.5v3c0 .8-.6 1.5-1.4 1.5H8.4c-.8 0-1.4-.7-1.4-1.5z" />
        <path d="M9 16v4M15 16v4M5 12l1 2M19 12l-1 2" />
    </svg>
);

// Sun rays — scene/lighting awareness
export const SunRayIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.6}>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
);

// Sparkles — variation strength
export const SparklesIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.6}>
        <path d="M12 3l1.6 4.5L18 9l-4.4 1.5L12 15l-1.6-4.5L6 9l4.4-1.5z" />
        <path d="M18.5 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7zM5.5 4.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
    </svg>
);

// Wand — AI chip / AI-controlled marker
export const WandIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-3 h-3'} strokeWidth={2}>
        <path d="M15 4l2 2-11 11H4v-2L15 4z" />
        <path d="M14 5l2 2M19 8l.6 1.4L21 10l-1.4.6L19 12l-.6-1.4L17 10l1.4-.6zM5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6z" />
    </svg>
);

// Sliders — Custom chip (user-controlled marker)
export const SlidersIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-3 h-3'} strokeWidth={2}>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="1.6" />
        <circle cx="10" cy="12" r="1.6" />
        <circle cx="18" cy="18" r="1.6" />
    </svg>
);

// Reset to AI — counter-clockwise rotation
export const RotateCcwIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-3 h-3'} strokeWidth={2}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
    </svg>
);

// Brush tip — brush size
export const BrushTipIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.7}>
        <path d="M14 4l6 6-8 8c-1 1-3 2-5 2s-3-1-3-3 1-4 2-5z" />
        <path d="M8 16l-3 3M14 4l6 6" />
    </svg>
);

// Feather — edge feathering
export const FeatherTipIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.6}>
        <path d="M20 4c-7 0-13 6-13 13v3h3c7 0 13-6 13-13z" />
        <path d="M14 10l-4 4M16 13l-4 4M20 4L4 20" />
    </svg>
);

// Expand outward — context padding
export const ExpandIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.8}>
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        <path d="M9 9l-4-4M15 9l4-4M15 15l4 4M9 15l-4 4" />
    </svg>
);

// Droplet — tone match
export const DropletIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.7}>
        <path d="M12 3s7 7 7 12a7 7 0 1 1-14 0c0-5 7-12 7-12z" />
        <path d="M8 14a4 4 0 0 0 4 4" />
    </svg>
);

// Plus circle — generate/insert mode
export const PlusCircleIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8M12 8v8" />
    </svg>
);

// Eraser path — remove mode pictogram (dashed box + X)
export const EraserPathIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.8}>
        <path d="M4 4h3M10 4h3M16 4h3M20 7v3M20 13v3M16 20h3M10 20h3M4 20h3M4 13v3M4 7v3" strokeDasharray="0 0" />
        <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
);

// Layers — preset stack
export const LayersIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.7}>
        <path d="M12 3l8 4-8 4-8-4z" />
        <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
    </svg>
);

// Running person — pose reference role
export const RunningPersonIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-3.5 h-3.5'} strokeWidth={1.8}>
        <circle cx="13" cy="4.5" r="1.6" />
        <path d="M9 12l4-3 3 2-1 4M14 17l3 3M7 10l-2 4M9 12l-2 6" />
    </svg>
);

// Hanger — costume reference role
export const HangerIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-3.5 h-3.5'} strokeWidth={1.7}>
        <path d="M12 7a2 2 0 1 1 2-2" />
        <path d="M12 7v2M3 16l9-7 9 7H3z" />
    </svg>
);

// Image stack — general reference role
export const ImageStackIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-3.5 h-3.5'} strokeWidth={1.7}>
        <rect x="3" y="6" width="14" height="11" rx="1.5" />
        <path d="M7 3h14v11" />
        <circle cx="8" cy="11" r="1.2" />
        <path d="M3 14l3-3 4 3 3-2 4 3" />
    </svg>
);

// Message + dots — user hint
export const MessageDotsIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.7}>
        <path d="M4 5h16v11H7l-3 3z" />
        <circle cx="9" cy="10.5" r="0.7" fill="currentColor" />
        <circle cx="12" cy="10.5" r="0.7" fill="currentColor" />
        <circle cx="15" cy="10.5" r="0.7" fill="currentColor" />
    </svg>
);

// Settings sliders — mode tab section
export const Settings2Icon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-4 h-4'} strokeWidth={1.7}>
        <path d="M14 6h7M3 6h7M10 12h11M3 12h3M17 18h4M3 18h10" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="8" cy="12" r="2" />
        <circle cx="14" cy="18" r="2" />
    </svg>
);

// Target — intent center
export const TargetIcon: React.FC<Props> = ({ className }) => (
    <svg {...baseProps} className={className || 'w-3.5 h-3.5'} strokeWidth={1.6}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
);
