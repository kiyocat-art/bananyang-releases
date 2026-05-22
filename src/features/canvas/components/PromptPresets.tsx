import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Z_INDEX } from '../../../constants/zIndex';
import { PromptFolder, PromptItem } from '../../../types';
import { t, Language } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';
import { HoverEdgeAutoScroll } from '../../../components/HoverEdgeAutoScroll';

interface PromptPresetsProps {
    currentPrompt: string;
    onLoadPrompt: (prompt: string) => void;
    language: Language;
    onManageClick: () => void;
    onSaveClick: () => void;
    folders: PromptFolder[];
    selectedFolderId: string | null;
    setSelectedFolderId: (id: string | null) => void;
    onDropdownStateChange?: (isOpen: boolean) => void;
    promptPanelRef?: React.RefObject<HTMLDivElement>;
    /** 칩 바에서 사용할 컴팩트 칩 스타일 트리거 */
    chipMode?: boolean;
}

export const PromptPresets: React.FC<PromptPresetsProps> = ({
    currentPrompt,
    onLoadPrompt,
    language,
    onManageClick,
    onSaveClick,
    folders,
    selectedFolderId,
    setSelectedFolderId,
    onDropdownStateChange,
    promptPanelRef,
    chipMode,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const presetsDropdownRef = useRef<HTMLDivElement>(null);
    const categoryRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const presetListScrollRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ bottom: number; left: number } | null>(null);

    useEffect(() => {
        if (folders.length > 0 && !folders.some(f => f.id === selectedFolderId)) {
            setSelectedFolderId(folders[0].id);
        } else if (folders.length === 0) {
            setSelectedFolderId(null);
        }
    }, [folders, selectedFolderId, setSelectedFolderId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInsideButton = buttonRef.current?.contains(target);
            const isInsidePanel = panelRef.current?.contains(target);
            const isInsidePresetsDropdown = presetsDropdownRef.current?.contains(target);

            if (!isInsideButton && !isInsidePanel && !isInsidePresetsDropdown) {
                setIsOpen(false);
                setActiveFolderId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        onDropdownStateChange?.(isOpen);
    }, [isOpen, onDropdownStateChange]);

    // Update dropdown position when active folder changes
    useEffect(() => {
        if (activeFolderId) {
            const categoryButton = categoryRefs.current.get(activeFolderId);
            if (categoryButton && panelRef.current) {
                const panelRect = panelRef.current.getBoundingClientRect();
                const buttonRect = categoryButton.getBoundingClientRect();
                setDropdownPosition({
                    bottom: window.innerHeight - panelRect.top + 12,
                    left: buttonRect.left
                });
            }
        } else {
            setDropdownPosition(null);
        }
    }, [activeFolderId]);

    const handleCategoryClick = (folderId: string) => {
        if (activeFolderId === folderId) {
            setActiveFolderId(null);
        } else {
            setActiveFolderId(folderId);
        }
    };

    const handlePresetClick = (preset: PromptItem) => {
        onLoadPrompt(preset.prompt);
        setIsOpen(false);
        setActiveFolderId(null);
    };

    const visibleFolders = folders.filter(f => f.showInQuickBar ?? true);
    const activeFolder = visibleFolders.find(f => f.id === activeFolderId);

    return (
        <>
            {/* Main Toggle Button */}
            <Tooltip tip={t('presets.quickAccess', language)} position="top">
                <button
                    ref={buttonRef}
                    onClick={() => {
                        setIsOpen(!isOpen);
                        if (isOpen) setActiveFolderId(null);
                    }}
                    className={chipMode
                        ? `flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer whitespace-nowrap ${isOpen
                            ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-400'
                            : 'bg-white/[0.08] border-white/[0.12] text-white/70 hover:bg-white/[0.12] hover:text-white hover:border-white/20'
                        }`
                        : `h-12 w-12 flex items-center justify-center rounded-full border transition-all duration-300 ${isOpen
                            ? 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`
                    }
                >
                    {chipMode ? (
                        <>
                            {/* Clipboard pictogram — grayscale */}
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 flex-shrink-0 ${isOpen ? 'text-yellow-400' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{language === 'ko' ? '프리셋' : language === 'ja' ? 'プリセット' : 'Preset'}</span>
                        </>
                    ) : (
                        <span className="text-xl font-bold text-white">P</span>
                    )}
                </button>
            </Tooltip>

            {/* Horizontal Category Bar */}
            {isOpen && buttonRef.current && ReactDOM.createPortal(
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        bottom: `${window.innerHeight - buttonRef.current.getBoundingClientRect().top + 12}px`,
                        left: `${buttonRef.current.getBoundingClientRect().left + buttonRef.current.getBoundingClientRect().width / 2}px`,
                        transform: 'translateX(-50%)',
                        zIndex: Z_INDEX.IMAGE_VIEWER,
                    }}
                    className="bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-visible"
                >
                    {/* Category Buttons Row */}
                    <div className="flex items-center gap-1 p-2">
                        {visibleFolders.map(folder => (
                            <button
                                key={folder.id}
                                ref={el => {
                                    if (el) categoryRefs.current.set(folder.id, el);
                                    else categoryRefs.current.delete(folder.id);
                                }}
                                onClick={() => handleCategoryClick(folder.id)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${activeFolderId === folder.id
                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                    : 'bg-white/5 text-zinc-300 border border-transparent hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {folder.name}
                            </button>
                        ))}

                        {/* Save Button */}
                        <div className="ml-2 pl-2 border-l border-white/10">
                            <Tooltip tip={t('presets.saveNewPreset', language)} position="top">
                                <button
                                    onClick={() => {
                                        onSaveClick();
                                        setIsOpen(false);
                                        setActiveFolderId(null);
                                    }}
                                    disabled={!currentPrompt.trim()}
                                    className="px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap bg-white/5 text-white hover:bg-white/10 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('presets.save', language)}
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Preset Titles Dropdown (appears above active category) */}
                    {activeFolder && activeFolder.presets.length > 0 && dropdownPosition && ReactDOM.createPortal(
                        <div
                            ref={presetsDropdownRef}
                            style={{
                                position: 'fixed',
                                bottom: dropdownPosition.bottom,
                                left: dropdownPosition.left,
                                zIndex: Z_INDEX.IMAGE_VIEWER,
                            }}
                            className="bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[200px] max-w-[320px]"
                        >
                            <div className="relative">
                            <div ref={presetListScrollRef} className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                                {activeFolder.presets.map(preset => (
                                    <Tooltip
                                        key={preset.id}
                                        tip={<div className="max-w-xs max-h-48 overflow-y-auto p-1 text-xs whitespace-pre-wrap">{preset.prompt}</div>}
                                        position="right"
                                    >
                                        <button
                                            onClick={() => handlePresetClick(preset)}
                                            className="w-full text-left px-3 py-2 text-sm rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white transition-colors truncate"
                                        >
                                            {preset.name}
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                            <HoverEdgeAutoScroll targetRef={presetListScrollRef} />
                            </div>
                        </div>,
                        document.body
                    )}
                </div>,
                document.body
            )}
        </>
    );
};