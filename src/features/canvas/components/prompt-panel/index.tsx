import React, { memo, useState, useRef, useEffect } from 'react';
import { BoardImage, GenerationTask, ModelName, PromptFolder, GridLayout } from '../../../../types';
import { Language, t } from '../../../../localization';
import { PresetManagerModal } from '../../../../components/PresetManagerModal';
import { usePromptPanel } from './usePromptPanel';
import { PromptInput } from './PromptInput';
import { ActionButtons } from './ActionButtons';
import { ToolChipBar } from './ToolChipBar';
import { ModelSelector } from './ModelSelector';
import { useUIStore } from '../../../../store/uiStore';
import { useGenerationStore } from '../../../../store/generationStore';
import { useCanvasStore } from '../../../../store/canvasStore';
import { useToolbarStore } from '../../../../features/toolbar/useToolbarStore';
import { Z_INDEX } from '../../../../constants/zIndex';

interface PromptPanelProps {
    customPrompt: string;
    onCustomPromptChange: (prompt: string) => void;
    onQueueGeneration: (task: GenerationTask) => void;
    isProcessing: boolean;
    generationQueue: GenerationTask[];
    originalImage: BoardImage | undefined;
    modelName: ModelName;
    language: Language;
    mainPanelRef: React.RefObject<HTMLElement>;
    onNotification: (message: string, type: 'success' | 'error') => void;
    folders: PromptFolder[];
    onSavePreset: () => void;
    saveFolders: (folders: PromptFolder[]) => void;
    onPresetDropdownStateChange?: (isOpen: boolean) => void;
    panelRef?: React.RefObject<HTMLDivElement>;
}

// Memoized to prevent re-renders during canvas zoom/pan operations
export const PromptPanel = memo<PromptPanelProps>((props) => {
    const {
        customPrompt, onCustomPromptChange, isProcessing, generationQueue,
        modelName, language, onNotification, folders, onSavePreset, saveFolders
    } = props;

    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const gridLayout = useGenerationStore(state => state.gridLayout);
    const setGridLayout = useGenerationStore(state => state.setGridLayout);
    const modelSelectorRef = useRef<HTMLDivElement>(null);

    const {
        textareaRef, isTranslating, selectedFolderId, setSelectedFolderId,
        isPresetManagerOpen, setIsPresetManagerOpen,
        canGenerate, handleDoQueue, handleTranslate, handlePromptKeyDown,
        selectedResolution, setSelectedResolution,
        selectedAspectRatio, setSelectedAspectRatio,
        selectedAiEditAction, isAutoColoringActive, isVariationActive,
        setIsPresetDropdownOpen,
        thinkingLevel, setThinkingLevel,
        groundingTools, toggleGroundingTool,
        inpaintModelUnsupported,
    } = usePromptPanel({ ...props });

    // 프롬프트에서 그리드 패턴 자동 감지 (예: "2x2", "1×3", "3x3 grid")
    useEffect(() => {
        if (!props.customPrompt) return;
        const lower = props.customPrompt.toLowerCase();
        const GRID_PATTERNS: Array<[RegExp, GridLayout]> = [
            [/\b3[x×]3\b/, '3x3'],
            [/\b2[x×]3\b/, '2x3'],
            [/\b3[x×]2\b/, '3x2'],
            [/\b2[x×]2\b/, '2x2'],
            [/\b1[x×]3\b/, '1x3'],
            [/\b3[x×]1\b/, '3x1'],
            [/\b1[x×]2\b/, '1x2'],
            [/\b2[x×]1\b/, '2x1'],
        ];
        for (const [pattern, layout] of GRID_PATTERNS) {
            if (pattern.test(lower)) {
                if (gridLayout !== layout) setGridLayout(layout);
                return;
            }
        }
    }, [props.customPrompt]);

    const showSpinner = isProcessing && generationQueue.length === 0;
    const showProgressBar = isProcessing && generationQueue.length > 0;

    const isEditorOpen = useUIStore(state => state.isEditorOpen);
    const editorMode = useUIStore(state => state.editorMode);

    const toolbarActiveToolId = useToolbarStore(s => s.activeToolId);
    const { inpaintMode, inpaintWorkType, maskFeatherRadius, selectedImageIds, boardImages, updateImage } = useCanvasStore();
    const isInpaintMode = toolbarActiveToolId === 'inpaint';
    const selectedInpaintImage = boardImages.find(img => img.role === 'original' && img.maskFile != null);
    const hasMask = !!selectedInpaintImage;

    return (
        <div className="absolute w-full max-w-4xl left-1/2 -translate-x-1/2 bottom-10 flex items-end gap-4 transition-all duration-300 ease-out" style={{ zIndex: Z_INDEX.PROMPT_PANEL }}>
            {/* Main Prompt Panel — 2-row glass panel */}
            <div className="flex-grow flex flex-col">
                <div ref={props.panelRef} className="glass-panel rounded-[24px] overflow-hidden">

                    {/* ── 인페인팅 미지원 모델 경고 배너 ── */}
                    {isInpaintMode && inpaintModelUnsupported && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-400/10 border-b border-amber-400/30">
                            <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-amber-300 text-xs font-semibold truncate">
                                    {t('inpaint.unsupported_model.title', language)}
                                </div>
                                <div className="text-amber-200/70 text-[11px] truncate">
                                    {t('inpaint.unsupported_model.body', language)}
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModelSelectorOpen(true)}
                                className="text-amber-300 hover:text-amber-200 text-xs font-medium px-2 py-1 rounded border border-amber-400/30 hover:border-amber-400/50 transition-colors flex-shrink-0"
                            >
                                {t('inpaint.unsupported_model.change_action', language)}
                            </button>
                        </div>
                    )}

                    {/* ── 인페인팅 모드 인디케이터 바 ── */}
                    {hasMask && (() => {
                        const isRemove = inpaintMode === 'remove';
                        const barBg = isRemove ? 'bg-rose-400/10 border-b border-rose-400/20' : 'bg-yellow-400/10 border-b border-yellow-400/20';
                        const dotColor = isRemove ? 'bg-rose-400' : 'bg-yellow-400';
                        const textColor = isRemove ? 'text-rose-300' : 'text-yellow-300';
                        const btnColor = isRemove ? 'text-rose-300/60 hover:text-rose-300' : 'text-yellow-300/60 hover:text-yellow-300';
                        return (
                        <div className={`flex items-center gap-2 px-4 py-2 ${barBg}`}>
                            <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
                            <span className={`${textColor} text-xs font-medium flex-1 truncate`}>
                                {isRemove
                                    ? (language === 'ko' ? '🗑️ AI 제거 모드 — 프롬프트 없이 바로 실행 가능' : '🗑️ AI Remove mode — no prompt needed')
                                    : t('editor.inpaint.modeIndicator', language)
                                        .replace('{workType}', inpaintWorkType ? t(`editor.inpaint.workType.${inpaintWorkType}` as any, language) : '')
                                        .replace('{mode}', t(`editor.inpaint.mode.${inpaintMode}` as any, language))
                                        .replace('{feather}', String(maskFeatherRadius))}
                            </span>
                            <button
                                onClick={() => selectedInpaintImage && updateImage(selectedInpaintImage.id, { maskFile: null, maskSrc: null } as any)}
                                className={`${btnColor} transition-colors text-xs`}
                                title="마스크 해제"
                            >✕</button>
                        </div>
                        );
                    })()}

                    {/* ── Row 1: Model selector + PromptInput + ActionButtons ── */}
                    <div className="flex items-center gap-2 px-4 py-0">
                        {/* Model selector */}
                        <div ref={modelSelectorRef} className="flex-shrink-0">
                            <ModelSelector
                                modelName={modelName}
                                isModelSelectorOpen={isModelSelectorOpen}
                                setIsModelSelectorOpen={setIsModelSelectorOpen}
                                modelSelectorRef={modelSelectorRef}
                                language={language}
                            />
                        </div>
                        <PromptInput
                            customPrompt={customPrompt}
                            onCustomPromptChange={onCustomPromptChange}
                            isTranslating={isTranslating}
                            handleTranslate={handleTranslate}
                            handlePromptKeyDown={handlePromptKeyDown}
                            textareaRef={textareaRef}
                            language={language}
                        />
                        <ActionButtons
                            canGenerate={canGenerate}
                            showSpinner={showSpinner}
                            showProgressBar={showProgressBar}
                            handleDoQueue={() => handleDoQueue()}
                            language={language}
                            selectedAiEditAction={selectedAiEditAction}
                            isAutoColoringActive={isAutoColoringActive}
                            isVariationActive={isVariationActive}
                            generationQueueLength={generationQueue.length}
                            isProcessing={isProcessing}
                            modelName={modelName}
                            isEditorOpen={isEditorOpen}
                            editorMode={editorMode}
                            inpaintModelUnsupported={inpaintModelUnsupported}
                        />
                    </div>

                    {/* ── Separator — 항상 표시 ── */}
                    <div className="h-px bg-white/[0.07] mx-4" />

                    {/* ── Row 2: Tool Chip Bar — 항상 표시 ── */}
                    <div className="px-3 py-2">
                        <ToolChipBar
                            modelName={modelName}
                            language={language}
                            selectedResolution={selectedResolution}
                            setSelectedResolution={setSelectedResolution}
                            selectedAspectRatio={selectedAspectRatio}
                            setSelectedAspectRatio={setSelectedAspectRatio}
                            folders={folders}
                            currentPrompt={customPrompt}
                            onLoadPrompt={onCustomPromptChange}
                            onManagePreset={() => setIsPresetManagerOpen(true)}
                            onSavePreset={onSavePreset}
                            selectedFolderId={selectedFolderId}
                            setSelectedFolderId={setSelectedFolderId}
                            onPresetDropdownStateChange={setIsPresetDropdownOpen}
                            promptPanelRef={props.panelRef}
                            thinkingLevel={thinkingLevel}
                            onThinkingLevelChange={setThinkingLevel}
                            groundingTools={groundingTools}
                            onGroundingToolToggle={toggleGroundingTool}
                            gridLayout={gridLayout}
                            onGridLayoutChange={setGridLayout}
                        />
                    </div>

                </div>
            </div>

            <PresetManagerModal
                isOpen={isPresetManagerOpen}
                onClose={() => setIsPresetManagerOpen(false)}
                currentPrompt={customPrompt}
                onLoadPrompt={onCustomPromptChange}
                onNotification={(message, type) => onNotification(message, type)}
                language={language}
                folders={folders}
                saveFolders={saveFolders}
            />
        </div>
    );
});
