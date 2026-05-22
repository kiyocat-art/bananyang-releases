import React, { useState } from 'react';
import { Tooltip } from '../../../../../components/Tooltip';
import { WandIcon, SlidersIcon, RotateCcwIcon } from './InpaintIcons';
import { Language, t } from '../../../../../localization';

// ─── StatusChip ─────────────────────────────────────────────────────────────
export const StatusChip: React.FC<{
    state: 'ai' | 'custom';
    onResetToAI?: () => void;
    aiSuggestion?: string;
    language: Language;
}> = ({ state, onResetToAI, aiSuggestion, language }) => {
    const isAI = state === 'ai';
    const aiTip = aiSuggestion
        ? `${t('editor.inpaint.aiChip.tip' as any, language)} · ${aiSuggestion}`
        : t('editor.inpaint.aiChip.tip' as any, language);
    const customTip = t('editor.inpaint.customChip.tip' as any, language);

    return (
        <div className="flex items-center gap-0.5 motion-reduce:transition-none">
            <Tooltip tip={isAI ? aiTip : customTip} position="top">
                <span
                    className={`inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[9px] font-bold uppercase tracking-wider transition-colors duration-200
                        ${isAI
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}`}
                    aria-live="polite"
                >
                    {isAI ? <WandIcon className="w-2.5 h-2.5" /> : <SlidersIcon className="w-2.5 h-2.5" />}
                    {isAI ? 'AI' : 'Custom'}
                </span>
            </Tooltip>
            {!isAI && onResetToAI && (
                <Tooltip tip={t('editor.inpaint.resetToAI' as any, language)} position="top">
                    <button
                        onClick={onResetToAI}
                        className="p-0.5 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer motion-reduce:transition-none"
                        aria-label={t('editor.inpaint.resetToAI' as any, language)}
                    >
                        <RotateCcwIcon className="w-3 h-3" />
                    </button>
                </Tooltip>
            )}
        </div>
    );
};

// ─── HelpIcon ───────────────────────────────────────────────────────────────
export const HelpIcon: React.FC<{ help: string }> = ({ help }) => (
    <Tooltip tip={help} position="right" tipClassName="max-w-xs">
        <span
            className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-600 text-[9px] font-bold cursor-help align-middle leading-none transition-colors motion-reduce:transition-none"
            aria-label="help"
        >?</span>
    </Tooltip>
);

// ─── MiniToggle (compact 30x14px) ──────────────────────────────────────────
export const MiniToggle: React.FC<{
    checked: boolean;
    onChange: (next: boolean) => void;
    ariaLabel?: string;
}> = ({ checked, onChange, ariaLabel }) => (
    <button
        onClick={() => onChange(!checked)}
        aria-label={ariaLabel}
        aria-pressed={checked}
        className={`relative w-7 h-3.5 rounded-full transition-colors duration-200 cursor-pointer motion-reduce:transition-none
            ${checked ? 'bg-emerald-500' : 'bg-zinc-700'}`}
    >
        <div
            className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all duration-200 motion-reduce:transition-none
                ${checked ? 'left-[14px]' : 'left-0.5'}`}
        />
    </button>
);

// ─── InpaintCard — unified card replacing Section helper ────────────────────
export interface InpaintCardProps {
    icon: React.ReactNode;
    title: string;
    chip?: 'ai' | 'custom' | null;
    onResetToAI?: () => void;
    aiSuggestion?: string;
    help?: string;
    collapsible?: boolean;
    defaultExpanded?: boolean;
    accent?: string;          // optional accent color for icon (Tailwind class e.g. 'text-emerald-400')
    language: Language;
    children: React.ReactNode;
}

export const InpaintCard: React.FC<InpaintCardProps> = ({
    icon, title, chip, onResetToAI, aiSuggestion, help, collapsible, defaultExpanded = true, accent, language, children,
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const showBody = !collapsible || expanded;

    return (
        <section
            className="rounded-xl border border-white/[0.06] bg-zinc-800/40 hover:bg-zinc-800/55 hover:border-white/10
                       p-2.5 mb-2 transition-colors duration-200 motion-reduce:transition-none"
        >
            <header className="flex items-center gap-1.5">
                <span className={`flex-shrink-0 ${accent ?? 'text-zinc-400'}`}>{icon}</span>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-200 leading-none truncate">
                    {title}
                </h4>
                {help && <HelpIcon help={help} />}
                <div className="ml-auto flex items-center gap-1">
                    {chip && <StatusChip state={chip} onResetToAI={onResetToAI} aiSuggestion={aiSuggestion} language={language} />}
                    {collapsible && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer motion-reduce:transition-none"
                            aria-label={expanded ? 'Collapse' : 'Expand'}
                            aria-expanded={expanded}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                                className={`w-3 h-3 transition-transform duration-200 motion-reduce:transition-none ${expanded ? '' : '-rotate-90'}`}
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                    )}
                </div>
            </header>
            {showBody && <div className="mt-2">{children}</div>}
        </section>
    );
};
