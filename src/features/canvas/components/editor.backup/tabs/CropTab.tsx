import React from 'react';
import { usePromptContextMenu } from '../../../../../hooks/usePromptContextMenu';
import { ResetIcon } from '../../../../../components/icons';
import { Tooltip } from '../../../../../components/Tooltip';
import { Language } from '../../../../../localization';

interface CropTabProps {
    t: (key: string, lang: string) => string;
    language: Language;
    isExpanding: boolean;
    imageSize: { width: number, height: number };
    setEditBox: (box: { x: number, y: number, width: number, height: number }) => void;
    cropPrompt: string;
    setCropPrompt: (prompt: string) => void;
}

export const CropTab: React.FC<CropTabProps> = ({ t, language, isExpanding, imageSize, setEditBox, cropPrompt, setCropPrompt }) => {
    const { ref: promptRef, handleContextMenu, contextMenuPortal } = usePromptContextMenu({
        value: cropPrompt,
        onChange: setCropPrompt,
        language,
    });
    return (
        <div className="p-4 space-y-4">
            <h3 className="text-base font-semibold text-zinc-100">{isExpanding ? t('aiEdit.expand', language) : t('editModal.title', language)}</h3>
            <div className="flex justify-between items-start">
                <p className="text-xs text-zinc-400">
                    {t('aiEdit.cropExpandDescription', language)}
                </p>
                <Tooltip tip={t('common.reset', language)} position="left">
                    <button
                        onClick={() => {
                            setEditBox({ x: 0, y: 0, width: imageSize.width, height: imageSize.height });
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                        <ResetIcon className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300">{t('aiEdit.prompt', language)}</label>
                <textarea
                    ref={promptRef}
                    onContextMenu={handleContextMenu}
                    className="w-full bg-zinc-800 text-zinc-200 text-xs rounded p-2 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                    rows={3}
                    placeholder={t('aiEdit.promptPlaceholder', language)}
                    value={cropPrompt}
                    onChange={(e) => setCropPrompt(e.target.value)}
                />
            </div>
            {contextMenuPortal}
        </div>
    );
};
