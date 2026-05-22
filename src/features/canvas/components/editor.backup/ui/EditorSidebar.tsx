import React from 'react';
import { Tooltip } from '../../../../../components/Tooltip';
import { ScissorsIcon, UploadIcon, LightIcon, PaintBrushIcon } from '../../../../../components/icons';
import { Language, t, TranslationKey } from '../../../../../localization';

type EditTool = 'crop' | 'object' | 'relight' | 'pbr';

interface EditorSidebarProps {
    activeTool: EditTool;
    setActiveTool: (tool: EditTool) => void;
    t: (key: string, lang: string) => string;
    language: Language;
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({ activeTool, setActiveTool, t, language }) => {
    return (
        <div className="flex border-b border-white/10">
            <Tooltip tip={t('editModal.title', language)} position="bottom" className="flex-1">
                <button onClick={() => setActiveTool('crop')} className={`w-full py-3 flex items-center justify-center transition-colors relative ${activeTool === 'crop' ? 'text-key bg-key/[0.07]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                    <ScissorsIcon className="w-5 h-5" />
                    {activeTool === 'crop' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-key shadow-[0_0_8px_var(--key-glow)]" />}
                </button>
            </Tooltip>
            <Tooltip tip={t('aiEdit.insertObject', language)} position="bottom" className="flex-1">
                <button onClick={() => setActiveTool('object')} className={`w-full py-3 flex items-center justify-center transition-colors relative ${activeTool === 'object' ? 'text-key bg-key/[0.07]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                    <UploadIcon className="w-5 h-5" />
                    {activeTool === 'object' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-key shadow-[0_0_8px_var(--key-glow)]" />}
                </button>
            </Tooltip>

            <Tooltip tip={t('editModal.relight', language)} position="bottom" className="flex-1">
                <button onClick={() => setActiveTool('relight')} className={`w-full py-3 flex items-center justify-center transition-colors relative ${activeTool === 'relight' ? 'text-key bg-key/[0.07]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                    <LightIcon className="w-5 h-5" />
                    {activeTool === 'relight' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-key shadow-[0_0_8px_var(--key-glow)]" />}
                </button>
            </Tooltip>
            <Tooltip tip={t('editor.pbrMapGeneration' as TranslationKey, language)} position="bottom" className="flex-1">
                <button onClick={() => setActiveTool('pbr')} className={`w-full py-3 flex items-center justify-center transition-colors relative ${activeTool === 'pbr' ? 'text-key bg-key/[0.07]' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                    <span className="font-bold text-xs uppercase">PBR</span>
                    {activeTool === 'pbr' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-key shadow-[0_0_8px_var(--key-glow)]" />}
                </button>
            </Tooltip>
        </div>
    );
};
