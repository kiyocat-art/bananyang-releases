import React, { useState } from 'react';
import { t } from '../localization';
import type { Language } from '../localization';
import type { TranslationKey } from '../localization/types';
import type { AxisMode } from '../services/aiSortService';
import { Z_INDEX } from '../constants/zIndex';

interface AiSortConfirmModalProps {
    language: Language;
    ungroupedCount: number;
    initialAxis: AxisMode;
    initialMaxGroups: number | 'auto';
    initialVerify: boolean;
    onConfirm: (axis: AxisMode, maxGroups: number | 'auto', verify: boolean) => void;
    onCancel: () => void;
}

const MAX_GROUPS_OPTIONS: Array<number | 'auto'> = ['auto', 2, 3, 4, 5, 6];

export const AiSortConfirmModal: React.FC<AiSortConfirmModalProps> = ({
    language,
    ungroupedCount,
    initialAxis,
    initialMaxGroups,
    initialVerify,
    onConfirm,
    onCancel,
}) => {
    const [axis, setAxis] = useState<AxisMode>(initialAxis);
    const [maxGroups, setMaxGroups] = useState<number | 'auto'>(initialMaxGroups);
    const [verify, setVerify] = useState(initialVerify);

    const axes: Array<{ value: AxisMode; labelKey: TranslationKey; descKey: TranslationKey }> = [
        { value: 'shape',   labelKey: 'aiSort.axis.shape',   descKey: 'aiSort.axis.shape.desc' },
        { value: 'concept', labelKey: 'aiSort.axis.concept', descKey: 'aiSort.axis.concept.desc' },
        { value: 'color',   labelKey: 'aiSort.axis.color',   descKey: 'aiSort.axis.color.desc' },
        { value: 'auto',    labelKey: 'aiSort.axis.auto',    descKey: 'aiSort.axis.auto.desc' },
    ];

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center"
            style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
        >
            <div className="glass-panel rounded-2xl p-6 max-w-md w-full shadow-2xl">

                {/* Header */}
                <div className="text-center mb-5">
                    <h2 className="text-xl font-semibold text-sky-400">
                        {t('aiSort.confirmTitle', language)}
                    </h2>
                    <p className="text-zinc-500 text-xs mt-1">
                        {(t('aiSort.confirmBody', language) as string).replace('{count}', String(ungroupedCount))}
                    </p>
                </div>

                <div className="border-t border-white/10 mb-4" />

                {/* Axis card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-2.5">
                    <p className="text-zinc-500 text-xs font-medium mb-2">
                        {t('aiSort.axis.label', language)}
                    </p>
                    <div className="flex gap-0.5 bg-black/30 rounded-lg p-0.5">
                        {axes.map(({ value, labelKey, descKey }) => (
                            <button
                                key={value}
                                onClick={() => setAxis(value)}
                                className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                                    axis === value
                                        ? 'bg-sky-500 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                }`}
                            >
                                <div>{t(labelKey, language)}</div>
                                <div className="text-[10px] font-normal opacity-70 mt-0.5 leading-tight">
                                    {t(descKey, language)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Max groups card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-2.5">
                    <p className="text-zinc-500 text-xs font-medium mb-2">
                        {t('aiSort.maxGroups.label', language)}
                    </p>
                    <div className="flex gap-0.5 bg-black/30 rounded-lg p-0.5">
                        {MAX_GROUPS_OPTIONS.map(opt => (
                            <button
                                key={String(opt)}
                                onClick={() => setMaxGroups(opt)}
                                className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                                    maxGroups === opt
                                        ? 'bg-sky-500 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                                }`}
                            >
                                {opt === 'auto' ? t('aiSort.maxGroups.auto', language) : String(opt)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Verify toggle card */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-5 flex items-center justify-between gap-3">
                    <span className="text-zinc-300 text-sm">
                        {t('aiSort.verifyToggle', language)}
                    </span>
                    <button
                        onClick={() => setVerify(v => !v)}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${verify ? 'bg-sky-500' : 'bg-zinc-700'}`}
                        aria-pressed={verify}
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${verify ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>

                {/* Footer */}
                <div className="border-t border-white/10 pt-4 flex justify-center gap-3">
                    <button
                        onClick={onCancel}
                        className="glass-button px-5 py-2 text-sm font-semibold rounded-lg text-white"
                    >
                        {t('aiSort.confirmCancel', language)}
                    </button>
                    <button
                        onClick={() => onConfirm(axis, maxGroups, verify)}
                        className="px-5 py-2 text-sm font-semibold rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 shadow-lg transition-all"
                    >
                        {t('aiSort.confirmRun', language)}
                    </button>
                </div>

            </div>
        </div>
    );
};
