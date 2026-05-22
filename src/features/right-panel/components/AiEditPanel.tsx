import React, { useMemo } from 'react';
import { AiAction, GenerationTask } from '../../../types';
import { TranslationKey, t, Language } from '../../../localization';
import { Section } from '../../../components/Section';
import { useCanvasStore } from '../../../store/canvasStore';
import { useGenerationStore } from '../../../store/generationStore';
import { Tooltip } from '../../../components/Tooltip';
import generateIcon from '../../../assets/generate-icon.png';

// Import AI Tool Icons
import iconAutoColoring from '../../../assets/icons/ai-tools/icon_auto_coloring.png';
import iconKeepBg from '../../../assets/icons/ai-tools/icon_keep_bg.png';
import iconVariation from '../../../assets/icons/ai-tools/icon_variation.png';
import iconPose from '../../../assets/icons/ai-tools/icon_pose.png';
import iconOutfit from '../../../assets/icons/ai-tools/icon_outfit.png';
import iconRemoveBg from '../../../assets/icons/ai-tools/icon_remove_bg.png';

interface AiEditPanelProps {
  language: Language;
  onNotification: (message: string, type: 'success' | 'error') => void;
  queueGeneration: (task: GenerationTask) => void;
}

export const AiEditPanel: React.FC<AiEditPanelProps> = ({ language, onNotification, queueGeneration }) => {
  const { boardImages } = useCanvasStore();
  const {
    selectedAiEditAction, setSelectedAiEditAction,
    isAutoColoringActive, setIsAutoColoringActive,
    isVariationActive, setIsVariationActive,
    variationCreativity, setVariationCreativity,
    autoColoringIntensity, setAutoColoringIntensity,
  } = useGenerationStore();

  const originalImage = boardImages.find(img => img.role === 'original');

  const actionButtons: { action: AiAction, labelKey: TranslationKey, descriptionKey: TranslationKey, icon: string, needsParam?: 'variation' | 'autoColoring' }[] = [
    { action: 'autoColoring', labelKey: 'aiEdit.autoColoring', descriptionKey: 'aiEdit.autoColoringDescription', icon: iconAutoColoring, needsParam: 'autoColoring' },
    { action: 'variation', labelKey: 'aiEdit.variation', descriptionKey: 'aiEdit.variationDescription', icon: iconVariation, needsParam: 'variation' },
    { action: 'extractPose', labelKey: 'aiEdit.extractPose', descriptionKey: 'aiEdit.extractPoseDescription', icon: iconPose },
    { action: 'extractOutfit', labelKey: 'aiEdit.extractOutfit', descriptionKey: 'aiEdit.extractOutfitDescription', icon: iconOutfit },
    { action: 'removeBackground', labelKey: 'removeBackground.button', descriptionKey: 'aiEdit.removeBackgroundDescription', icon: iconRemoveBg },
    { action: 'keepBackgroundOnly', labelKey: 'editModal.keepBackgroundOnly', descriptionKey: 'aiEdit.keepBackgroundOnlyDescription', icon: iconKeepBg },
  ];



  const [hoveredSliderAction, setHoveredSliderAction] = React.useState<AiAction | null>(null);

  const handleActionClick = (action: AiAction) => {
    if (!originalImage) {
      onNotification(t('error.noOriginalImage', language), 'error');
      return;
    }
    if (action === 'autoColoring') {
      setIsAutoColoringActive(!isAutoColoringActive);
    } else if (action === 'variation') {
      setIsVariationActive(!isVariationActive);
    } else {
      setSelectedAiEditAction(selectedAiEditAction === action ? null : action);
    }
  };

  return (
    <>
      <Section title={t('aiEdit.title', language)} icon={<img src={generateIcon} alt="" className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-3">
          {actionButtons.map(({ action, labelKey, descriptionKey, icon, needsParam }) => {
            const isActive =
              action === 'autoColoring' ? isAutoColoringActive :
              action === 'variation'  ? isVariationActive :
              selectedAiEditAction === action;
            const isClickable = !!originalImage;
            // Visual state depends ONLY on active status, regardless of clickability
            // It always looks "dimmed/disabled" unless it is explicitly active.
            const isDimmed = !isActive;
            const isSliderHovered = hoveredSliderAction === action;

            // Calculate description key for the slider tooltip
            let sliderTooltipText = '';
            if (needsParam === 'variation') {
              sliderTooltipText = t(`aiEdit.variationLevel${variationCreativity}Description` as any, language);
            } else if (needsParam === 'autoColoring') {
              sliderTooltipText = t(`aiEdit.coloringIntensity${autoColoringIntensity}Description` as any, language);
            }

            return (
              <Tooltip
                key={action}
                tip={isActive && !isSliderHovered ? (
                  <div className="max-w-[220px] whitespace-normal text-center leading-relaxed break-keep">
                    {t(descriptionKey, language)}
                  </div>
                ) : null}
                position="bottom"
              >
                <div
                  onClick={() => isClickable && handleActionClick(action)}
                  className={`
                    relative p-2 rounded-lg transition-all duration-200
                    flex flex-col items-center justify-center gap-2
                    ${isClickable ? 'cursor-pointer hover:bg-neutral-800/50' : 'cursor-not-allowed'}
                    ${isDimmed ? 'opacity-30 mix-blend-luminosity' : 'opacity-100'}
                    ${isActive ? 'pb-2' : ''} 
                  `}
                >
                  <div className="flex flex-col items-center justify-center gap-2 w-full">
                    {/* Icon Area - Enlarged */}
                    <div className="relative">
                      <img
                        src={icon}
                        alt=""
                        className={`
                          w-20 h-20 object-contain transition-transform duration-200
                          ${isActive ? 'scale-105 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : ''}
                        `}
                      />
                    </div>

                    {/* Title */}
                    <h4 className={`text-sm text-center leading-tight ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                      {t(labelKey, language)}
                    </h4>
                  </div>

                  {/* Active Indicator (Underline) */}
                  {isActive && !needsParam && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  )}

                  {/* Compact Slider Control */}
                  {isActive && needsParam && (
                    <div
                      className="mt-2 w-[120%] flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 z-10"
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={() => setHoveredSliderAction(action)}
                      onMouseLeave={() => setHoveredSliderAction(null)}
                    >
                      <Tooltip
                        tip={
                          <div className="max-w-[200px] whitespace-normal text-center break-keep">
                            {sliderTooltipText}
                          </div>
                        }
                        position="bottom"
                      >
                        <div className="w-full flex items-center justify-center relative py-2">
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={needsParam === 'variation' ? variationCreativity : autoColoringIntensity}
                            onChange={e => {
                              const val = Number(e.target.value);
                              if (needsParam === 'variation') setVariationCreativity(val);
                              else setAutoColoringIntensity(val);
                            }}
                            className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-white hover:accent-brand-400 focus:outline-none focus:ring-1 focus:ring-white/50"
                          />
                        </div>
                      </Tooltip>
                    </div>
                  )}

                </div>
              </Tooltip>
            );
          })}
        </div>
      </Section>
    </>
  );
};
