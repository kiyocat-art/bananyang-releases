import React from 'react';
import { BoardImage } from '../../../types';
import { ROLE_COLORS } from '../../../constants';
import { LandscapeIcon, BodyIcon, HangerIcon, PaletteIcon } from '../../../components/icons';

import { t, Language } from '../../../localization';

export const RoleIndicator: React.FC<{
    role: BoardImage['role'],
    refIndex?: number,
    referenceType?: 'general' | 'costume' | 'pose',
    allReferenceTypes?: Set<'general' | 'costume' | 'pose'>,
    language: Language
}> = ({ role, refIndex, referenceType, language }) => {
    if (role === 'none') return null;
    let bgColor = '';
    let content: React.ReactNode = null;
    let customClasses = 'w-5 h-5 rounded-full';
    // [PERF] Use CSS custom property --canvas-zoom (set on world div via DOM subscribe)
    // so this component never re-renders on pan/zoom changes.
    let transform = `scale(calc(1 / var(--canvas-zoom))) translate(-50%, -50%)`;

    if (role === 'original') {
        bgColor = ROLE_COLORS.original;
        content = <span className="text-xs font-bold text-white leading-none whitespace-nowrap">{t('role.badge.original', language)}</span>;
        customClasses = 'w-auto px-1.5 h-5 rounded-md';
        transform = `scale(calc(1 / var(--canvas-zoom))) translate(-25%, -25%)`;
    } else if (role === 'background') {
        bgColor = ROLE_COLORS.background;
        content = <LandscapeIcon className="w-3 h-3 text-white" />;
    } else if (role === 'pose') {
        bgColor = ROLE_COLORS.pose;
        content = <BodyIcon className="w-3 h-3 text-white" />;
    }
    // New independent reference role types
    else if (role === 'generalRef') {
        bgColor = ROLE_COLORS.generalRef;
        const label = refIndex !== undefined ? `${t('role.badge.generalRef', language)} ${refIndex + 1}` : t('role.badge.generalRef', language);
        content = <span className="text-xs font-bold text-white leading-none whitespace-nowrap">{label}</span>;
        customClasses = 'w-auto px-1.5 h-5 rounded-md';
        transform = `scale(calc(1 / var(--canvas-zoom))) translate(-25%, -25%)`;
    } else if (role === 'costumeRef') {
        bgColor = ROLE_COLORS.costumeRef;
        content = <span className="text-xs font-bold text-white leading-none whitespace-nowrap">{t('role.badge.costumeRef', language)}</span>;
        customClasses = 'w-auto px-1.5 h-5 rounded-md';
        transform = `scale(calc(1 / var(--canvas-zoom))) translate(-25%, -25%)`;
    } else if (role === 'poseRef') {
        bgColor = ROLE_COLORS.poseRef;
        content = <span className="text-xs font-bold text-white leading-none whitespace-nowrap">{t('role.badge.poseRef', language)}</span>;
        customClasses = 'w-auto px-1.5 h-5 rounded-md';
        transform = `scale(calc(1 / var(--canvas-zoom))) translate(-25%, -25%)`;
    }
    // Legacy reference role (for backward compatibility)
    else if (role === 'reference') {
        bgColor = referenceType ? ROLE_COLORS[`${referenceType}Ref` as keyof typeof ROLE_COLORS] as string || '#3b82f6' : '#3b82f6';

        let label = '';
        if (referenceType === 'general') label = refIndex !== undefined ? `${t('role.badge.generalRef', language)} ${refIndex + 1}` : t('role.badge.generalRef', language);
        else if (referenceType === 'costume') label = t('role.badge.costumeRef', language);
        else if (referenceType === 'pose') label = t('role.badge.poseRef', language);
        else label = refIndex !== undefined ? `${t('role.badge.generalRef', language)} ${refIndex + 1}` : t('role.badge.generalRef', language);

        content = <span className="text-xs font-bold text-white leading-none whitespace-nowrap">{label}</span>;
        customClasses = 'w-auto px-1.5 h-5 rounded-md';
        transform = `scale(calc(1 / var(--canvas-zoom))) translate(-25%, -25%)`;
    }

    if (!content) return null;

    const commonClasses = `absolute top-0 left-0 flex items-center justify-center shadow-lg pointer-events-none z-10`;

    return (
        <div
            className={`${commonClasses} ${customClasses}`}
            style={{
                backgroundColor: bgColor,
                transform: transform,
                transformOrigin: 'top left'
            }}
        >
            {content}
        </div>
    );
};
