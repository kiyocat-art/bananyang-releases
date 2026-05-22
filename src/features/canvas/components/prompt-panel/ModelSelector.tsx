import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../../../constants/zIndex';
import { ModelName } from '../../../../types';
import { Language, t, TranslationKey } from '../../../../localization';
import { Tooltip } from '../../../../components/Tooltip';
import { ChevronDownIcon, CheckIcon } from '../../../../components/icons';
import { MODEL_COSTS, MODEL_NAMES } from '../../../../constants';
import { getAllAvailableModels } from '../../../../services/geminiService';
import { getOpenAIKey } from '../../../../services/providers/openai/api';
import { getFluxKey } from '../../../../services/providers/flux/api';
import { useUIStore } from '../../../../store/uiStore';
import openaiIconUrl from '../../../../assets/openai-icon.png';
import fluxIconUrl from '../../../../assets/flux-icon.png';

interface ModelSelectorProps {
    modelName: ModelName;
    isModelSelectorOpen: boolean;
    setIsModelSelectorOpen: (isOpen: boolean) => void;
    modelSelectorRef: React.RefObject<HTMLDivElement>;
    language: Language;
    /** 칩 바용 컴팩트 텍스트 트리거 (h-8 pill) */
    compact?: boolean;
}

const EXTERNAL_MODELS = [
    {
        id: MODEL_NAMES.OPENAI_GPT_IMAGE_2 as ModelName,
        label: 'GPT Image 2',
        subLabel: 'openai/gpt-image-2',
        description: 'OpenAI image generation',
        iconUrl: openaiIconUrl,
        borderColor: 'border-zinc-300/50',
        badgeColor: 'bg-zinc-200/10 text-zinc-300 border-zinc-300/20',
        badgeLabel: 'OpenAI',
        checkColor: 'text-zinc-300',
        subTab: 'openai' as const,
    },
    {
        id: MODEL_NAMES.FLUX_2_MAX as ModelName,
        label: 'FLUX.2 Max',
        subLabel: 'flux/flux-2-max',
        description: 'Black Forest Labs high quality',
        iconUrl: fluxIconUrl,
        borderColor: 'border-orange-400/50',
        badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        badgeLabel: 'BFL',
        checkColor: 'text-orange-400',
        subTab: 'flux' as const,
    },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    modelName,
    isModelSelectorOpen,
    setIsModelSelectorOpen,
    modelSelectorRef,
    language,
    compact,
}) => {
    const openAppSettingsApiTab = useUIStore(state => state.openAppSettingsApiTab);

    const getDisplayName = () => {
        if (modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE) return 'Flash 3.1';
        if (modelName === MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE) return 'Flash 2.5';
        if (modelName === MODEL_NAMES.OPENAI_GPT_IMAGE_2) return 'GPT Image 2';
        if (modelName === MODEL_NAMES.FLUX_2_MAX) return 'FLUX.2 Max';
        return 'Pro 3';
    };

    const availableModels = getAllAvailableModels();
    const showProModel = availableModels.includes(MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW);
    const showNewFlashModel = availableModels.includes(MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE);
    const showBasicModel = availableModels.includes(MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE);
    const hasOpenAIKey = !!getOpenAIKey();
    const hasFluxKey = !!getFluxKey();
    const [position, setPosition] = useState<{ bottom: number; left: number } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isModelSelectorOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInsideTrigger = modelSelectorRef.current?.contains(target);
            const isInsideDropdown = dropdownRef.current?.contains(target);
            if (!isInsideTrigger && !isInsideDropdown) setIsModelSelectorOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isModelSelectorOpen, modelSelectorRef, setIsModelSelectorOpen]);

    useEffect(() => {
        if (isModelSelectorOpen && modelSelectorRef.current) {
            const updatePosition = () => {
                const rect = modelSelectorRef.current!.getBoundingClientRect();
                setPosition({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
            };
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [isModelSelectorOpen, modelSelectorRef]);

    const handleModelChange = (model: string) => {
        window.dispatchEvent(new CustomEvent('model-change', { detail: model }));
        setIsModelSelectorOpen(false);
    };

    const handleLockedModelClick = (subTab: 'openai' | 'flux') => {
        setIsModelSelectorOpen(false);
        openAppSettingsApiTab(subTab);
    };

    const currentIconUrl =
        modelName === MODEL_NAMES.OPENAI_GPT_IMAGE_2 ? openaiIconUrl :
        modelName === MODEL_NAMES.FLUX_2_MAX ? fluxIconUrl : null;

    const currentBorderColor =
        modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW ? 'border-blue-500' :
        modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE ? 'border-yellow-500' :
        modelName === MODEL_NAMES.OPENAI_GPT_IMAGE_2 ? 'border-zinc-300' :
        modelName === MODEL_NAMES.FLUX_2_MAX ? 'border-orange-400' :
        'border-green-500';

    const currentAssetPath =
        modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW ? 'assets/gemini-3-pro-image-preview.png' :
        modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE ? 'assets/gemini-3.1-flash-image-preview.png' :
        'assets/gemini-2.5-flash-image.png';

    const currentAlt =
        modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW ? 'Nano Banana Pro' :
        modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE ? 'Nano Banana2' :
        modelName === MODEL_NAMES.OPENAI_GPT_IMAGE_2 ? 'GPT Image 2' :
        modelName === MODEL_NAMES.FLUX_2_MAX ? 'FLUX.2 Max' : 'Nano Banana1';

    return (
        <div className="relative" ref={modelSelectorRef}>
            <Tooltip tip={t('tooltip.modelSelector' as TranslationKey, language)} position="top">
                <button
                    onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                    className={compact
                        ? `flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer whitespace-nowrap ${isModelSelectorOpen
                            ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-400'
                            : 'bg-white/[0.08] border-white/[0.12] text-white/70 hover:bg-white/[0.12] hover:text-white hover:border-white/20'
                        }`
                        : 'flex items-center gap-2 transition-colors cursor-pointer'
                    }
                >
                    {compact ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 flex-shrink-0 ${isModelSelectorOpen ? 'text-yellow-400' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                            <span>{getDisplayName()}</span>
                            <ChevronDownIcon className={`w-3 h-3 transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''}`} />
                        </>
                    ) : (
                        <>
                            <div className={`w-12 h-12 rounded-lg border-2 overflow-hidden bg-black p-0.5 hover:border-white transition-colors ${currentBorderColor}`}>
                                {currentIconUrl ? (
                                    <img src={currentIconUrl} alt={currentAlt} className="w-full h-full object-contain" />
                                ) : (
                                    <img src={currentAssetPath} alt={currentAlt} className="w-full h-full object-contain" />
                                )}
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 text-zinc-400 transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''}`} />
                        </>
                    )}
                </button>
            </Tooltip>

            {isModelSelectorOpen && position && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed w-72 bg-neutral-900/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-xl overflow-hidden"
                    style={{ bottom: position.bottom, left: position.left, zIndex: Z_INDEX.DROPDOWN }}
                >
                    <div className="p-1 space-y-1">
                        {/* ── Gemini Models ── */}
                        {showNewFlashModel && (
                            <button
                                onClick={() => handleModelChange(MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE)}
                                className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <div className="w-12 h-12 rounded-lg border-2 border-yellow-500/50 bg-black overflow-hidden p-0.5 flex-shrink-0">
                                    <img src="assets/gemini-3.1-flash-image-preview.png" alt="Nano Banana2" className="w-full h-full object-contain" />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-sm font-semibold ${modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE ? 'text-white' : 'text-zinc-200'}`}>Nano Banana2</span>
                                        {modelName === MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE && <CheckIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">gemini-3.1-flash-image-preview</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">Fast generation, low latency</p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/20">Fastest</span>
                                        <span className="text-xs text-zinc-500">~${MODEL_COSTS[MODEL_NAMES.GEMINI_3_1_FLASH_IMAGE]()}/img</span>
                                    </div>
                                </div>
                            </button>
                        )}

                        {showProModel && (
                            <button
                                onClick={() => handleModelChange(MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW)}
                                className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <div className="w-12 h-12 rounded-lg border-2 border-blue-500/50 bg-black overflow-hidden p-0.5 flex-shrink-0">
                                    <img src="assets/gemini-3-pro-image-preview.png" alt="Nano Banana Pro" className="w-full h-full object-contain" />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-sm font-semibold ${modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW ? 'text-white' : 'text-zinc-200'}`}>Nano Banana Pro</span>
                                        {modelName === MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW && <CheckIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">gemini-3-pro-image-preview</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">High quality, best for production</p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">Pro</span>
                                        <span className="text-xs text-zinc-500">~${MODEL_COSTS[MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW]()}/img</span>
                                    </div>
                                </div>
                            </button>
                        )}

                        {showBasicModel && (
                            <button
                                onClick={() => handleModelChange(MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE)}
                                className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${modelName === MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <div className="w-12 h-12 rounded-lg border-2 border-green-500/50 bg-black overflow-hidden p-0.5 flex-shrink-0">
                                    <img src="assets/gemini-2.5-flash-image.png" alt="Nano Banana1" className="w-full h-full object-contain" />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-sm font-semibold ${modelName === MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE ? 'text-white' : 'text-zinc-200'}`}>Nano Banana1</span>
                                        {modelName === MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE && <CheckIcon className="w-4 h-4 text-green-400 flex-shrink-0" />}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">gemini-2.5-flash-image</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">Fast generation, good for testing</p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">Fastest</span>
                                        <span className="text-xs text-zinc-500">~${MODEL_COSTS[MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE]()}/img</span>
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* ── Divider ── */}
                        <div className="border-t border-white/[0.06] my-1" />

                        {/* ── External Models ── */}
                        {EXTERNAL_MODELS.map((ext) => {
                            const hasKey = ext.subTab === 'openai' ? hasOpenAIKey : hasFluxKey;
                            const isActive = modelName === ext.id;
                            return (
                                <Tooltip
                                    key={ext.id}
                                    tip={hasKey ? '' : 'API 키를 설정에서 입력하세요'}
                                    position="top"
                                    tipZIndex={Z_INDEX.TOOLTIP_OVER_DROPDOWN}
                                >
                                    <button
                                        onClick={() => hasKey ? handleModelChange(ext.id) : handleLockedModelClick(ext.subTab)}
                                        className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                                            isActive ? 'bg-white/10' : hasKey ? 'hover:bg-white/5' : 'opacity-50 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-lg border-2 bg-black overflow-hidden p-0.5 flex-shrink-0 ${ext.borderColor}`}>
                                            <img src={ext.iconUrl} alt={ext.label} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-zinc-200'}`}>{ext.label}</span>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {!hasKey && (
                                                        <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                                        </svg>
                                                    )}
                                                    {isActive && <CheckIcon className={`w-4 h-4 ${ext.checkColor}`} />}
                                                </div>
                                            </div>
                                            <p className="text-xs text-zinc-500 mt-0.5 font-mono truncate">{ext.subLabel}</p>
                                            <p className="text-xs text-zinc-400 mt-0.5">{ext.description}</p>
                                            <div className="mt-1.5 flex items-center gap-2">
                                                <span className={`text-xs px-1.5 py-0.5 rounded border ${ext.badgeColor}`}>{ext.badgeLabel}</span>
                                                {MODEL_COSTS[ext.id] && (
                                                    <span className="text-xs text-zinc-500">~${MODEL_COSTS[ext.id]()}/img</span>
                                                )}
                                                {!hasKey && (
                                                    <span className="text-xs text-zinc-500">설정 필요</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                </Tooltip>
                            );
                        })}

                        {!showProModel && !showNewFlashModel && !showBasicModel && (
                            <div className="p-4 text-center text-zinc-400 text-sm">
                                No models available. Please enable models in settings.
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
