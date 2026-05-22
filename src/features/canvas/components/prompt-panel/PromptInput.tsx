// PromptInput Component — Row 1 textarea + translate button only
// Settings (resolution/ratio) moved to ToolChipBar (Row 2)
import React from 'react';
import { t, Language } from '../../../../localization';
import { Tooltip } from '../../../../components/Tooltip';
import { usePromptContextMenu } from '../../../../hooks/usePromptContextMenu';
import { useToolbarStore } from '../../../toolbar/useToolbarStore';
import { useCanvasStore } from '../../../../store/canvasStore';

interface PromptInputProps {
    customPrompt: string;
    onCustomPromptChange: (prompt: string) => void;
    isTranslating: boolean;
    handleTranslate: () => void;
    handlePromptKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    language: Language;
}

export const PromptInput: React.FC<PromptInputProps> = ({
    customPrompt, onCustomPromptChange, isTranslating, handleTranslate, handlePromptKeyDown,
    textareaRef, language
}) => {
    const { handleContextMenu, contextMenuPortal } = usePromptContextMenu({
        value: customPrompt,
        onChange: onCustomPromptChange,
        language,
        textareaRef,
    });

    return (
        <div className="relative flex-grow py-1 flex items-center gap-2">
            <textarea
                ref={textareaRef}
                value={customPrompt}
                onChange={(e) => onCustomPromptChange(e.target.value)}
                onKeyDown={handlePromptKeyDown}
                onContextMenu={handleContextMenu}
                placeholder={isTranslating ? '' : (() => {
                    const isInpaint = useToolbarStore.getState().activeToolId === 'inpaint';
                    const mode = useCanvasStore.getState().inpaintMode;
                    if (isInpaint && mode === 'remove') {
                        return language === 'ko' ? '(선택사항) 힌트를 입력하면 더 정확한 제거가 가능합니다...' : '(Optional) Add hints for more accurate removal...';
                    }
                    return t('section.prompt.placeholder', language);
                })()}
                disabled={isTranslating}
                className={`flex-1 bg-transparent border-none focus:ring-0 resize-none text-base text-white placeholder-white/30 py-3 pr-2 max-h-[200px] overflow-y-auto leading-relaxed scrollbar-hide font-medium transition-all ${isTranslating ? 'opacity-0 cursor-not-allowed' : ''}`}
                rows={1}
                style={{ minHeight: '48px' }}
            />
            {isTranslating && (
                <div className="absolute inset-0 flex items-center pl-0 pointer-events-none">
                    <span className="text-white text-base font-medium">
                        {t('translation.inProgress', language)}
                    </span>
                </div>
            )}
            <Tooltip tip={t('tooltip.translatePrompt', language)} position="top">
                <button
                    onClick={handleTranslate}
                    disabled={isTranslating || !customPrompt.trim()}
                    className={`h-12 w-12 flex items-center justify-center rounded-full transition-colors ${isTranslating || !customPrompt.trim()
                        ? 'text-white/20 cursor-not-allowed'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                </button>
            </Tooltip>
            {contextMenuPortal}
        </div>
    );
};
