import React, { useEffect, useState } from 'react';
import { usePromptContextMenu } from '../../../../hooks/usePromptContextMenu';
import { LightSource, LightType } from '../../../../types';
import { t, Language } from '../../../../localization';
import { Tooltip } from '../../../../components/Tooltip';
import { PlusIcon, TrashIcon, CopyIcon, ResetIcon } from '../../../../components/icons'; // Assuming ClipboardIcon exists or use another
import { useCanvasStore } from '../../../../store/canvasStore';
import { AdvancedColorPicker } from '../../../../components/AdvancedColorPicker';

// Inline sub-component for Light Color Picker with toggle
const LightColorPicker: React.FC<{ color: string; onChange: (color: string) => void; language: Language }> = ({ color, onChange, language }) => {
    const [showPicker, setShowPicker] = useState(false);

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t('relight.lightColor', language)}
            </label>
            <button
                onClick={() => setShowPicker(!showPicker)}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full h-10 rounded-md border border-white/20 transition-colors hover:border-white/40"
                style={{ backgroundColor: color }}
            />
            {showPicker && (
                <>
                    {/* Click-away overlay */}
                    <div className="fixed inset-0 z-[100]" onClick={() => setShowPicker(false)} />
                    {/* Dropdown color picker */}
                    <div
                        className="absolute left-0 top-full mt-2 z-[101]"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <AdvancedColorPicker
                            color={color}
                            onChange={onChange}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

interface RelightingPropertiesProps {
    lightSources: LightSource[];
    selectedLightId: string | null;
    onAddLight: () => void;
    onSelectLight: (id: string) => void;
    onUpdateLight: (id: string, updates: Partial<LightSource>) => void;
    onDeleteLight: (id: string) => void;
    onPasteLights: (lights: LightSource[]) => void;
    onReset: () => void;
    language: Language;
    prompt: string;
    onPromptChange: (prompt: string) => void;
}

export const RelightingProperties: React.FC<RelightingPropertiesProps> = ({
    lightSources,
    selectedLightId,
    onAddLight,
    onSelectLight,
    onUpdateLight,
    onDeleteLight,
    onPasteLights,
    onReset,
    language,
    prompt,
    onPromptChange
}) => {
    const selectedLight = lightSources.find(l => l.id === selectedLightId);
    const { copyLighting, lightingClipboard } = useCanvasStore();
    const { ref: promptRef, handleContextMenu, contextMenuPortal } = usePromptContextMenu({
        value: prompt,
        onChange: onPromptChange,
        language,
    });

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedLight) {
                    e.preventDefault();
                    copyLighting('single', [selectedLight]);
                } else if (lightSources.length > 0) {
                    e.preventDefault();
                    copyLighting('all', lightSources);
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (lightingClipboard) {
                    e.preventDefault();
                    onPasteLights(lightingClipboard.data);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLight, lightSources, copyLighting, lightingClipboard, onPasteLights]);

    const handleCopyAll = () => {
        copyLighting('all', lightSources);
    };

    const handlePasteAll = () => {
        if (lightingClipboard) {
            onPasteLights(lightingClipboard.data);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{t('relight.title', language)}</h3>
                <div className="flex items-center gap-1">
                    <Tooltip tip={t('common.reset', language)} position="bottom">
                        <button
                            onClick={onReset}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                        >
                            <ResetIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <Tooltip tip={t('relight.addLight', language)} position="left">
                        <button
                            onClick={onAddLight}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="p-2 bg-sky-500 hover:bg-sky-600 rounded-md transition-colors"
                        >
                            <PlusIcon className="w-4 h-4 text-white" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Light List */}
            <div className="flex flex-col gap-2 max-h-[192px] overflow-y-auto custom-scrollbar">
                {lightSources.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-4">{t('relight.noLights', language)}</p>
                ) : (
                    lightSources.map((light, index) => {
                        const isCopied = lightingClipboard?.type === 'single' && lightingClipboard.data[0].id === light.id;
                        return (
                            <div
                                key={light.id}
                                onClick={() => onSelectLight(light.id)}
                                className={`p-3 rounded-md cursor-pointer transition-colors relative group ${selectedLightId === light.id
                                    ? 'bg-sky-500/20 border border-sky-500'
                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded-full border border-white/20"
                                            style={{ backgroundColor: light.color }}
                                        />
                                        <span className="text-sm text-white">
                                            {t(`relight.type.${light.type}`, language)} {index + 1}
                                        </span>
                                        {isCopied && (
                                            <span className="text-xs bg-zinc-600 text-white px-1.5 py-0.5 rounded-full ml-2">
                                                {t('common.copied', language)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onPasteLights([light]);
                                            }}
                                            className="p-1 hover:bg-white/20 rounded transition-colors text-zinc-400 hover:text-white"
                                            title={t('common.copy', language)}
                                        >
                                            <CopyIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteLight(light.id);
                                            }}
                                            className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                            title={t('common.delete', language)}
                                        >
                                            <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Light Properties */}
            {selectedLight && (
                <div className="flex flex-col gap-4 p-4 bg-white/5 rounded-md border border-white/10">
                    {/* Light Type */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            {t('relight.lightType', language)}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['omni', 'direct', 'sun'] as LightType[]).map((type) => (
                                <Tooltip key={type} tip={t(`tooltip.relight.${type}`, language)} position="top">
                                    <button
                                        onClick={() => onUpdateLight(selectedLight.id, { type })}
                                        className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${selectedLight.type === type
                                            ? 'bg-sky-500 text-white'
                                            : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                                            }`}
                                    >
                                        {t(`relight.type.${type}`, language)}
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    </div>

                    {/* Light Color */}
                    <LightColorPicker
                        color={selectedLight.color}
                        onChange={(color) => onUpdateLight(selectedLight.id, { color })}
                        language={language}
                    />

                    {/* Light Intensity */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            {t('relight.lightIntensity', language)}: {selectedLight.intensity}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={selectedLight.intensity}
                            onChange={(e) => onUpdateLight(selectedLight.id, { intensity: parseInt(e.target.value) })}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full"
                        />
                    </div>

                    {/* Light Direction (for directional lights) */}
                    {(selectedLight.type === 'direct' || selectedLight.type === 'sun') && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                {t('relight.lightDirection', language)}: {selectedLight.direction || 0}°
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="360"
                                value={selectedLight.direction || 0}
                                onChange={(e) => onUpdateLight(selectedLight.id, { direction: parseInt(e.target.value) })}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Prompt Input */}
            <div className="mt-4 border-t border-white/10 pt-4">
                <h4 className="text-sm font-semibold text-zinc-200 mb-2">
                    {t('aiEdit.prompt', language)}
                </h4>
                <textarea
                    ref={promptRef}
                    onContextMenu={handleContextMenu}
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder={t('aiEdit.promptPlaceholder', language)}
                    className="w-full bg-neutral-900 border border-neutral-600 rounded-md py-2 px-3 text-sm text-zinc-200 placeholder-zinc-400 focus:ring-1 focus:ring-white outline-none resize-none"
                    rows={3}
                />
            </div>
            {contextMenuPortal}
        </div>
    );
};
