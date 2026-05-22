import React from 'react';
import { CameraAnglePreset, LensFocusPreset, ShotSizePreset } from '../../../types';
import extremeLongShotImg from '../../../assets/icons/shot-size/extreme-long-shot.png';
import longShotImg from '../../../assets/icons/shot-size/long-shot.png';
import fullShotImg from '../../../assets/icons/shot-size/full-shot.png';
import kneeShotImg from '../../../assets/icons/shot-size/knee-shot.png';
import waistShotImg from '../../../assets/icons/shot-size/waist-shot.png';
import bustShotImg from '../../../assets/icons/shot-size/bust-shot.png';

const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.5',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

// ── Camera Angle Icons ──────────────────────────────────────────────────────

export const CameraAngleIcons: Record<CameraAnglePreset, React.ReactNode> = {
    eyeLevel: (
        <svg {...base}>
            {/* Camera dot — pivot at left-center */}
            <circle cx="3" cy="12" r="1.8" fill="currentColor" stroke="none" />
            {/* Fan sector: ±28° around horizontal (eye-level view cone) */}
            <path d="M 3 12 L 17 4.5 A 16 16 0 0 1 17 19.5 Z" />
        </svg>
    ),
    highAngle: (
        <svg {...base}>
            {/* Camera dot — pivot at top-left */}
            <circle cx="4" cy="4" r="1.8" fill="currentColor" stroke="none" />
            {/* Fan sector: 20°–70° below horizontal (high-angle view cone) */}
            <path d="M 4 4 L 20 10 A 17 17 0 0 1 10 20 Z" />
        </svg>
    ),
    lowAngle: (
        <svg {...base}>
            {/* Camera dot — pivot at bottom-left */}
            <circle cx="4" cy="20" r="1.8" fill="currentColor" stroke="none" />
            {/* Fan sector: 20°–70° above horizontal (low-angle view cone) */}
            <path d="M 4 20 L 10 4 A 17 17 0 0 1 20 14 Z" />
        </svg>
    ),
    birdsEye: (
        <svg {...base}>
            {/* Top-down view: overhead circle */}
            <circle cx="12" cy="14" r="6" />
            <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none" />
            <line x1="12" y1="2" x2="12" y2="8" />
            <polyline points="9.5,5 12,2 14.5,5" />
        </svg>
    ),
    wormsEye: (
        <svg {...base}>
            {/* Bottom-up view */}
            <circle cx="12" cy="10" r="6" />
            <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
            <line x1="12" y1="22" x2="12" y2="16" />
            <polyline points="9.5,19 12,22 14.5,19" />
        </svg>
    ),
    dutchAngle: (
        <svg {...base}>
            {/* Tilted camera rectangle */}
            <rect x="8" y="8" width="8" height="8" rx="1.5" transform="rotate(25 12 12)" />
            {/* Horizon level indicator (straight) */}
            <line x1="3" y1="12" x2="7" y2="12" strokeOpacity="0.4" strokeDasharray="1.5,1" />
            <line x1="17" y1="12" x2="21" y2="12" strokeOpacity="0.4" strokeDasharray="1.5,1" />
        </svg>
    ),
    overTheShoulder: (
        <svg {...base}>
            {/* Subject (facing) - prominent */}
            <circle cx="15" cy="7" r="3" />
            <path d="M12 19v-3a3 3 0 016 0v3" />
            {/* Camera-side person (back) - dimmed */}
            <circle cx="6" cy="10" r="2.2" strokeOpacity="0.35" />
            <path d="M4 20v-2.5a2.2 2.2 0 014.4 0V20" strokeOpacity="0.35" />
        </svg>
    ),
};

// ── Lens & Focus Icons ──────────────────────────────────────────────────────

export const LensFocusIcons: Record<LensFocusPreset, React.ReactNode> = {
    deepFocus: (
        <svg {...base}>
            {/* All horizontal lines sharp = everything in focus */}
            <circle cx="12" cy="12" r="7" />
            <line x1="5" y1="9" x2="19" y2="9" />
            <line x1="5" y1="12" x2="19" y2="12" />
            <line x1="5" y1="15" x2="19" y2="15" />
        </svg>
    ),
    shallowFocus: (
        <svg {...base}>
            {/* Center sharp dot, outer blurred */}
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
            <line x1="5" y1="9" x2="8.5" y2="9" strokeOpacity="0.25" strokeDasharray="1.5,1" />
            <line x1="15.5" y1="9" x2="19" y2="9" strokeOpacity="0.25" strokeDasharray="1.5,1" />
            <line x1="5" y1="15" x2="8.5" y2="15" strokeOpacity="0.25" strokeDasharray="1.5,1" />
            <line x1="15.5" y1="15" x2="19" y2="15" strokeOpacity="0.25" strokeDasharray="1.5,1" />
        </svg>
    ),
    rackFocus: (
        <svg {...base}>
            {/* Two subjects, focus arrow shifting */}
            <circle cx="6.5" cy="12" r="3.5" fill="currentColor" fillOpacity="0.9" stroke="none" />
            <circle cx="17.5" cy="12" r="3.5" strokeOpacity="0.3" strokeDasharray="2,1.5" />
            <line x1="10" y1="12" x2="14" y2="12" />
            <polyline points="12,10 14,12 12,14" />
        </svg>
    ),
    fisheyeLens: (
        <svg {...base}>
            {/* Barrel distortion curve */}
            <path d="M3 12 Q12 3 21 12 Q12 21 3 12" />
            <path d="M3 12 Q12 7 21 12" strokeOpacity="0.35" />
            <path d="M3 12 Q12 17 21 12" strokeOpacity="0.35" />
        </svg>
    ),
    telephotoLens: (
        <svg {...base}>
            {/* Long narrow view frustum */}
            <path d="M2 9.5 L13 7 L13 17 L2 14.5 Z" />
            <line x1="13" y1="7" x2="22" y2="5" />
            <line x1="13" y1="17" x2="22" y2="19" />
            <line x1="22" y1="5" x2="22" y2="19" />
        </svg>
    ),
    wideAngleLens: (
        <svg {...base}>
            {/* Wide spread lines */}
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="4" y1="20" x2="12" y2="12" />
            <line x1="4" y1="12" x2="12" y2="12" />
            <line x1="12" y1="12" x2="22" y2="2" strokeOpacity="0.35" />
            <line x1="12" y1="12" x2="22" y2="22" strokeOpacity="0.35" />
            <line x1="12" y1="12" x2="22" y2="12" strokeOpacity="0.35" />
        </svg>
    ),
};

// ── Shot Size Icons ─────────────────────────────────────────────────────────
// Body reference: head circle (12,4,r=3), torso (12,7→12,15),
// arms (7,10)↔(17,10), hips→knees→feet

const dim = (o: number) => ({ strokeOpacity: o });
const cropLine = (y: number) => (
    <line x1="1" y1={y} x2="23" y2={y} strokeDasharray="3,2" strokeOpacity="0.65" strokeWidth="1.2" />
);

export const ShotSizeIcons: Record<ShotSizePreset, React.ReactNode> = {
    extremeLongShot: (
        <img src={extremeLongShotImg} alt="" className="w-full h-full object-contain" />
    ),
    longShot: (
        <img src={longShotImg} alt="" className="w-full h-full object-contain" />
    ),
    fullShot: (
        <img src={fullShotImg} alt="" className="w-full h-full object-contain" />
    ),
    kneeShot: (
        <img src={kneeShotImg} alt="" className="w-full h-full object-contain" />
    ),
    waistShot: (
        <img src={waistShotImg} alt="" className="w-full h-full object-contain" />
    ),
    bustShot: (
        <img src={bustShotImg} alt="" className="w-full h-full object-contain" />
    ),
    closeUp: (
        <svg {...base}>
            {/* Large head, face features */}
            <circle cx="12" cy="10" r="7" />
            <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
            <path d="M9 13 Q12 15.5 15 13" strokeOpacity="0.5" />
            {/* Below head - dimmed */}
            <line x1="12" y1="17" x2="12" y2="21" {...dim(0.15)} />
            {cropLine(17)}
        </svg>
    ),
    extremeCloseUp: (
        <svg {...base}>
            {/* Just eyes */}
            <ellipse cx="7.5" cy="12" rx="4" ry="2.8" />
            <ellipse cx="16.5" cy="12" rx="4" ry="2.8" />
            <circle cx="7.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="16.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            {/* Eyebrows */}
            <path d="M4 9 Q7.5 7.5 11 9" strokeOpacity="0.6" />
            <path d="M13 9 Q16.5 7.5 20 9" strokeOpacity="0.6" />
        </svg>
    ),
};
