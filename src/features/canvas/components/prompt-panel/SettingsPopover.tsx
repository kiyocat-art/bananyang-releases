import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../../../constants/zIndex';
import { Resolution, AspectRatio, ModelName, FluxResolutionMP, OpenAIQuality } from '../../../../types';
import { t, Language, TranslationKey } from '../../../../localization';
import { MODEL_NAMES } from '../../../../constants';
import { useGenerationStore } from '../../../../store/generationStore';

import { ASPECT_RATIOS } from '../../../../constants';

// Visual aspect ratio preview — small rectangle scaled to represent the ratio
const RatioPreview: React.FC<{ ratio: string; active: boolean }> = ({ ratio, active }) => {
    const MAX = 22;
    const [wStr, hStr] = ratio.split(':');
    const w = parseInt(wStr, 10);
    const h = parseInt(hStr, 10);
    const displayW = w >= h ? MAX : Math.round(MAX * w / h);
    const displayH = h >= w ? MAX : Math.round(MAX * h / w);
    return (
        <div style={{ width: MAX, height: MAX }} className="flex items-center justify-center flex-shrink-0">
            <div
                style={{ width: displayW, height: displayH }}
                className={`rounded-[1px] border ${active ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-zinc-500/80 bg-white/5'}`}
            />
        </div>
    );
};

const FLUX_ASPECT_RATIOS: AspectRatio[] = ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '9:21'];
const FLUX_MP_OPTIONS: { value: FluxResolutionMP; label: string }[] = [
    { value: '0.6', label: '0.6 MP' },
    { value: '1',   label: '1 MP' },
    { value: '2',   label: '2 MP' },
    { value: '4',   label: '4 MP' },
];

interface SettingsPopoverProps {
    language: Language;
    resolutions: Resolution[];
    selectedResolution: Resolution;
    setSelectedResolution: (res: Resolution) => void;
    selectedAspectRatio: AspectRatio;
    setSelectedAspectRatio: (ratio: AspectRatio) => void;
    triggerRef: React.RefObject<Element>;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    section?: 'resolution' | 'ratio';
    centered?: boolean;
    modelName?: ModelName;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({
    language, resolutions, selectedResolution, setSelectedResolution, selectedAspectRatio, setSelectedAspectRatio, triggerRef, isOpen, setIsOpen, section, centered, modelName
}) => {
    const [position, setPosition] = useState<{ bottom: number; left?: number; right?: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isFluxModel = modelName === MODEL_NAMES.FLUX_2_MAX;
    const isOpenAIModel = modelName === MODEL_NAMES.OPENAI_GPT_IMAGE_2;
    const { fluxOptions, setFluxOptions } = useGenerationStore(s => ({ fluxOptions: s.fluxOptions, setFluxOptions: s.setFluxOptions }));
    const { openAIOptions, setOpenAIOptions } = useGenerationStore(s => ({ openAIOptions: s.openAIOptions, setOpenAIOptions: s.setOpenAIOptions }));

    // Click-outside handler that checks both trigger and portal
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInsideTrigger = triggerRef.current?.contains(target);
            const isInsideDropdown = dropdownRef.current?.contains(target);

            if (!isInsideTrigger && !isInsideDropdown) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, triggerRef, setIsOpen]);

    useEffect(() => {
        if (triggerRef.current) {
            const updatePosition = () => {
                const rect = triggerRef.current!.getBoundingClientRect();
                if (centered) {
                    setPosition({
                        bottom: window.innerHeight - rect.top + 8,
                        left: rect.left + rect.width / 2,
                    });
                } else {
                    setPosition({
                        bottom: window.innerHeight - rect.top + 8,
                        right: window.innerWidth - rect.right,
                    });
                }
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [triggerRef]);

    // Wait until position is calculated before rendering
    if (!position) return null;

    const ratiosToShow = isFluxModel ? FLUX_ASPECT_RATIOS : ASPECT_RATIOS;

    return createPortal(
        <div
            ref={dropdownRef}
            className="fixed bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[280px] p-4 flex flex-col gap-4"
            style={centered
                ? { bottom: position.bottom, left: position.left, transform: 'translateX(-50%)', zIndex: Z_INDEX.DROPDOWN }
                : { bottom: position.bottom, right: position.right, zIndex: Z_INDEX.DROPDOWN }
            }
        >

            {/* Resolution Section — hidden for Flux (uses MP buttons instead) */}
            {!isFluxModel && (!section || section === 'resolution') && (
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">{t('resolution', language)}</div>
                    <div className="grid grid-cols-2 gap-2">
                        {resolutions.map((res) => {
                            const nonAutoCount = resolutions.filter(r => r !== 'auto').length;
                            const isFullWidth = res === 'auto' || nonAutoCount === 1;
                            return (
                                <button
                                    key={res}
                                    onClick={() => setSelectedResolution(res)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${isFullWidth ? 'col-span-2' : ''} ${selectedResolution === res
                                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-lg'
                                        : 'bg-white/5 border-transparent text-zinc-300 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    {res === 'auto' ? 'Auto' : t(`resolution.${res}` as TranslationKey, language)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Flux: Resolution as Megapixels */}
            {isFluxModel && (!section || section === 'resolution') && (
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">Resolution</div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {FLUX_MP_OPTIONS.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setFluxOptions({ resolutionMP: value })}
                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                                    fluxOptions.resolutionMP === value
                                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-lg'
                                        : 'bg-white/5 border-transparent text-zinc-300 hover:bg-white/10 hover:border-white/10'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {isFluxModel && (
                        <p className="text-[10px] text-zinc-500 px-1">
                            {t('flux.qualityHint' as TranslationKey, language)}
                        </p>
                    )}
                </div>
            )}

            {!section && <div className="h-px bg-white/10 w-full"></div>}

            {/* Aspect Ratio Section */}
            {(!section || section === 'ratio') && (
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">{t('aspectRatio', language)}</div>
                    <div className={`grid gap-1.5 ${isFluxModel ? 'grid-cols-4' : 'grid-cols-5'}`}>
                        {ratiosToShow.map((ratio) => {
                            const isActive = selectedAspectRatio === ratio;
                            const isAuto = ratio === 'auto';
                            return (
                                <button
                                    key={ratio}
                                    onClick={() => setSelectedAspectRatio(ratio)}
                                    className={`
                                        flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1 transition-all border cursor-pointer
                                        ${isAuto ? 'col-span-full flex-row gap-2 py-2' : ''}
                                        ${isActive
                                            ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-lg'
                                            : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10 hover:border-white/10 hover:text-zinc-200'}
                                    `}
                                >
                                    {isAuto ? (
                                        <span className="text-sm font-medium">Auto</span>
                                    ) : (
                                        <>
                                            <RatioPreview ratio={ratio} active={isActive} />
                                            <span className="text-xs font-mono leading-none">{ratio}</span>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Flux-specific options */}
            {isFluxModel && (
                <>
                    <div className="h-px bg-white/10 w-full"></div>

                    {/* Prompt Upsampling toggle */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Prompt Upsampling</span>
                        <button
                            onClick={() => setFluxOptions({ promptUpsampling: !fluxOptions.promptUpsampling })}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                                fluxOptions.promptUpsampling ? 'bg-yellow-500' : 'bg-white/10'
                            }`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    fluxOptions.promptUpsampling ? 'translate-x-4' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </>
            )}

            {/* OpenAI-specific options: Quality */}
            {isOpenAIModel && (
                <>
                    <div className="h-px bg-white/10 w-full"></div>
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                            {t('quality', language)}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {(['auto', 'high', 'medium', 'low'] as OpenAIQuality[]).map(q => (
                                <button
                                    key={q}
                                    onClick={() => setOpenAIOptions({ quality: q })}
                                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                                        openAIOptions.quality === q
                                            ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-lg'
                                            : 'bg-white/5 border-transparent text-zinc-300 hover:bg-white/10 hover:border-white/10'
                                    }`}
                                >
                                    {t(`quality.${q}` as TranslationKey, language)}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

        </div>,
        document.body
    );
};
