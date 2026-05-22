import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SettingsIcon } from './icons';
import bananyangIcon from '../assets/bananyang-icon.png';
import { MenuBar, MenuDef } from './MenuBar';
import { t, Language, TranslationKey } from '../localization';
import { useSettingsStore } from '../store/settingsStore';
import { useCanvasStore } from '../store/canvasStore';
import { useToolbarStore } from '../features/toolbar/useToolbarStore';
import { Z_INDEX } from '../constants/zIndex';
import { WorkspaceTabBar } from './workspaceTabs/WorkspaceTabBar';
import { HeaderUpdateButton } from './HeaderUpdateButton';

const PinIcon = ({ active }: { active: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="17" x2="12" y2="22"></line>
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
    </svg>
);

const RestartIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const GlobeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
);

const LayersIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
    </svg>
);

const WorkspaceMenuIcon = () => (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 1.5h5l3.5 3.5v7.5H3z"/>
        <path d="M8 1.5V5h3.5"/>
    </svg>
);

const PresetMenuIcon = () => (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="1.5" width="11" height="11" rx="1.5"/>
        <path d="M4.5 10V4h3a1.5 1.5 0 0 1 0 3H4.5"/>
    </svg>
);

interface DraggableHeaderProps {
    language: Language;
    onOpenSettings: (tab?: 'general' | 'api' | 'shortcuts' | 'presets') => void;
    onResetUI: () => void;
    // File menu
    onUploadImage: () => void;
    onNewWorkspace: () => void;
    onSaveWorkspace: () => void;
    onSaveWorkspaceAs: () => void;
    onLoadWorkspace: () => void;
    onLoadWorkspaceInCurrentTab?: () => void;
    onExportPromptPresets: () => void;
    onImportPromptPresets: () => void;

    // Edit menu
    onCopy: () => void;
    onPaste: () => void;
    onDelete: () => void;
    onAlignImages: () => void;
    onAiSortImages: () => void;
    onGroupSelection: () => void;
    onUngroupSelection: () => void;
    onRenameGroup: () => void;
    onEditGroup: () => void;
    // Image menu
    onZoomImage: () => void;
    onEditImage: () => void;
    onFlipHorizontal: () => void;
    onDownloadImage: () => void;
    onAiAutoColoring: () => void;
    onAiVariation: () => void;
    onAiExtractPose: () => void;
    onAiExtractOutfit: () => void;
    onAiRemoveBackground: () => void;
    onAiKeepBackground: () => void;
    onAiInsertObject: () => void;
    onAiExpand: () => void;
    onAiInpainting: () => void;
    onAiPbr: () => void;
    onAiRelight: () => void;
    onSetRoleOriginal: () => void;
    onSetRoleGeneralRef: () => void;
    onSetRoleCostumeRef: () => void;
    onSetRolePoseRef: () => void;
    onSetRoleBackground: () => void;
    onCutImage?: () => void;
    onAddMemo: () => void;
    onLoadWorkflow: () => void;
    // View menu
    onToggleGlassEffect: () => void;
    isGlassEffectEnabled: boolean;
    isAlwaysOnTop: boolean;
    onOpenLeftPanel?: () => void;
    onOpenOriginalImagePanel?: () => void;
    workspaceName?: string | null;
    onRequestCloseTab?: (tabId: string) => void;
    // Disabled states
    hasSelection: boolean;
    hasGroupSelection: boolean;
    hasImageSelection: boolean;
    isOriginalImageSelected: boolean;
    hasOriginalImage: boolean;
}

export const DraggableHeader: React.FC<DraggableHeaderProps> = ({
    language,
    onOpenSettings,
    onResetUI,
    onUploadImage,
    onNewWorkspace,
    onSaveWorkspace,
    onSaveWorkspaceAs,
    onLoadWorkspace,
    onLoadWorkspaceInCurrentTab,
    onExportPromptPresets,
    onImportPromptPresets,

    onCopy,
    onPaste,
    onDelete,
    onAlignImages,
    onAiSortImages,
    onGroupSelection,
    onUngroupSelection,
    onRenameGroup,
    onEditGroup,
    onZoomImage,
    onEditImage,
    onFlipHorizontal,
    onDownloadImage,
    onAiAutoColoring,
    onAiVariation,
    onAiExtractPose,
    onAiExtractOutfit,
    onAiRemoveBackground,
    onAiKeepBackground,
    onAiInsertObject,
    onAiExpand,
    onAiInpainting,
    onAiPbr,
    onAiRelight,
    onSetRoleOriginal,
    onSetRoleGeneralRef,
    onSetRoleCostumeRef,
    onSetRolePoseRef,
    onSetRoleBackground,
    onCutImage,
    onAddMemo,
    onLoadWorkflow,
    onToggleGlassEffect,
    isGlassEffectEnabled,
    isAlwaysOnTop: isAlwaysOnTopProp,
    onOpenLeftPanel,
    onOpenOriginalImagePanel,
    workspaceName,
    onRequestCloseTab,
    hasSelection,
    hasGroupSelection,
    hasImageSelection,
    isOriginalImageSelected,
    hasOriginalImage,
}) => {
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(isAlwaysOnTopProp);
    const imageCount = useCanvasStore(state => state.boardImages.length);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.onAlwaysOnTopChanged((value: boolean) => {
                setIsAlwaysOnTop(value);
            });
        }
    }, []);

    useEffect(() => {
        if (!isLangOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isLangOpen]);

    const handleClose = () => window.electronAPI?.closeWindow();
    const handleToggleAlwaysOnTop = () => window.electronAPI?.toggleAlwaysOnTop();

    // [SOFT REFRESH] Clear VRAM and reload images without restarting app
    // [UI RESET] Now also resets panels to default state
    const handleRestart = () => {
        console.log('[DraggableHeader] Soft refresh triggered - clearing VRAM and reloading images');
        window.dispatchEvent(new Event('canvas-soft-refresh'));
        onResetUI();
    };

    // Menu definitions
    const menus: MenuDef[] = useMemo(() => [
        {
            label: t('menu.file', language),
            items: [
                { type: 'group-label', label: t('menu.file.workspaceGroup', language), icon: <WorkspaceMenuIcon /> },
                { label: t('menu.file.newWorkspace', language), onClick: onNewWorkspace, shortcut: 'Ctrl+N' },
                { label: t('menu.file.loadWorkspace', language), onClick: onLoadWorkspace, shortcut: 'Ctrl+O' },
                ...(onLoadWorkspaceInCurrentTab ? [{ label: t('menu.file.loadWorkspaceInCurrentTab', language), onClick: onLoadWorkspaceInCurrentTab }] : []),
                { label: t('menu.file.saveWorkspace', language), onClick: onSaveWorkspace, shortcut: 'Ctrl+S' },
                { label: t('menu.file.saveWorkspaceAs', language), onClick: onSaveWorkspaceAs, shortcut: 'Ctrl+Shift+S' },
                { type: 'separator' },
                { type: 'group-label', label: t('menu.file.promptPresets', language), icon: <PresetMenuIcon /> },
                { label: t('presets.export', language), onClick: onExportPromptPresets },
                { label: t('presets.import', language), onClick: onImportPromptPresets },
                { type: 'separator' },
                { label: t('menu.file.exit', language), onClick: handleClose },
            ],
        },
        {
            label: t('menu.edit', language),
            items: [
                { label: t('menu.edit.copy', language), onClick: onCopy, shortcut: 'Ctrl+C', disabled: !hasSelection },
                { label: t('menu.edit.paste', language), onClick: onPaste, shortcut: 'Ctrl+V' },
                { label: t('menu.edit.delete', language), onClick: onDelete, shortcut: 'Delete', disabled: !hasSelection },
                { type: 'separator' },
                { label: t('menu.edit.alignImages', language), onClick: onAlignImages, disabled: !hasSelection },
                { label: t('menu.edit.aiSortImages', language), onClick: onAiSortImages },
                { type: 'separator' },
                {
                    label: t('menu.edit.group', language),
                    children: [
                        { label: t('menu.edit.group.create', language), onClick: onGroupSelection, shortcut: 'Ctrl+G', disabled: !hasSelection },
                        { label: t('menu.edit.group.ungroup', language), onClick: onUngroupSelection, shortcut: 'Ctrl+Shift+G', disabled: !hasGroupSelection },
                        { label: t('menu.edit.group.rename', language), onClick: onRenameGroup, disabled: !hasGroupSelection },
                        { label: t('menu.edit.group.edit', language), onClick: onEditGroup, disabled: !hasGroupSelection },
                    ],
                },
            ],
        },
        {
            label: t('menu.image', language),
            items: [
                { label: t('menu.file.uploadImage', language), onClick: onUploadImage },
                { type: 'separator' },
                { label: t('menu.image.cutImage' as TranslationKey, language), onClick: onCutImage, disabled: !hasImageSelection },
                { label: t('menu.image.zoom', language), onClick: onZoomImage, disabled: !hasImageSelection },
                { label: t('menu.image.flipHorizontal', language), onClick: onFlipHorizontal, disabled: !hasImageSelection },
                { label: t('menu.image.download', language), onClick: onDownloadImage, disabled: !hasImageSelection },
                { type: 'separator' },
                { label: t('menu.image.addMemo', language), onClick: onAddMemo, disabled: !hasImageSelection },
                { label: t('menu.image.loadWorkflow', language), onClick: onLoadWorkflow, disabled: !hasImageSelection },
            ],
        },
        {
            label: t('menu.view', language),
            items: [
                { label: t('menu.view.history', language), onClick: onOpenLeftPanel },
                { label: t('menu.view.originalImage', language), onClick: onOpenOriginalImagePanel },
                {
                    label: t('menu.view.tools', language),
                    children: [
                        { label: t('menu.view.rightPanel.concept', language), onClick: () => useToolbarStore.getState().setActiveToolId('concept') },
                        { label: t('menu.view.rightPanel.camera', language), onClick: () => useToolbarStore.getState().setActiveToolId('camera') },
                        { label: t('menu.view.rightPanel.pose', language), onClick: () => useToolbarStore.getState().setActiveToolId('pose') },
                        { label: t('menu.view.rightPanel.painting', language), onClick: () => useToolbarStore.getState().setActiveToolId('painting') },
                        { label: t('menu.view.rightPanel.aiEdit', language), onClick: () => useToolbarStore.getState().setActiveToolId('aiEdit') },
                    ],
                },
                {
                    label: t('menu.edit.imageTools' as TranslationKey, language),
                    children: [
                        { label: t('menu.image.crop' as TranslationKey, language), onClick: () => useToolbarStore.getState().setActiveToolId('crop'), disabled: !hasOriginalImage },
                        { label: t('menu.image.object' as TranslationKey, language), onClick: () => useToolbarStore.getState().setActiveToolId('object'), disabled: !hasOriginalImage },
                        { label: t('menu.image.relight' as TranslationKey, language), onClick: () => useToolbarStore.getState().setActiveToolId('relight'), disabled: !hasOriginalImage },
                        { label: t('menu.image.pbr' as TranslationKey, language), onClick: () => useToolbarStore.getState().setActiveToolId('pbr'), disabled: !hasOriginalImage },
                    ],
                },
                { type: 'separator' },
                { label: t('menu.view.glassEffect', language), onClick: onToggleGlassEffect, checked: isGlassEffectEnabled },
                { label: t('menu.view.resetUI', language), onClick: onResetUI },
                {
                    label: t('menu.view.alwaysOnTop', language),
                    onClick: handleToggleAlwaysOnTop,
                    checked: isAlwaysOnTop,
                    icon: <div className={isAlwaysOnTop ? "text-yellow-500" : "text-white/60"}><PinIcon active={isAlwaysOnTop} /></div>
                },
            ],
        },
        {
            label: t('menu.help', language),
            items: [
                { label: t('menu.help.shortcuts', language), onClick: () => onOpenSettings('shortcuts') },
                { label: t('menu.help.settings', language), onClick: () => onOpenSettings() },
                { type: 'separator' },
                {
                    label: t('settings.language', language),
                    children: [
                        { label: '한국어', onClick: () => useSettingsStore.getState().setLanguage('ko'), checked: language === 'ko' },
                        { label: 'English', onClick: () => useSettingsStore.getState().setLanguage('en'), checked: language === 'en' },
                        { label: '日本語', onClick: () => useSettingsStore.getState().setLanguage('ja'), checked: language === 'ja' },
                        { label: 'Bahasa Indonesia', onClick: () => useSettingsStore.getState().setLanguage('id'), checked: language === 'id' },
                        { label: 'Español', onClick: () => useSettingsStore.getState().setLanguage('es'), checked: language === 'es' },
                        { label: 'Français', onClick: () => useSettingsStore.getState().setLanguage('fr'), checked: language === 'fr' },
                    ],
                },
                { type: 'separator' },
                {
                    label: t('menu.help.resetApp', language), onClick: () => {
                        if (confirm(t('menu.help.resetAppConfirm', language))) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }
                },
                { label: t('menu.help.about', language) },
            ],
        },
    ], [language, hasSelection, hasGroupSelection, hasImageSelection, hasOriginalImage,
        isAlwaysOnTop, isGlassEffectEnabled,
        onUploadImage, onNewWorkspace, onSaveWorkspace, onSaveWorkspaceAs, onLoadWorkspace, onLoadWorkspaceInCurrentTab,
        onExportPromptPresets, onImportPromptPresets,
        onCopy, onPaste, onDelete, onAlignImages, onAiSortImages,
        onGroupSelection, onUngroupSelection, onRenameGroup, onEditGroup,
        onZoomImage, onFlipHorizontal, onDownloadImage,
        onAddMemo, onLoadWorkflow,
        onOpenSettings, onToggleGlassEffect, onResetUI, onOpenLeftPanel, onOpenOriginalImagePanel,
        handleClose, handleToggleAlwaysOnTop]);

    const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

    return (
        <>
        {/* Row 1: App Header (logo, menus, OS-overlay-reserved area) */}
        <div
            className="fixed top-0 left-0 right-0 flex items-center justify-between pl-3 select-none glass-header"
            style={{
                height: 36,
                zIndex: Z_INDEX.DROPDOWN,
                WebkitAppRegion: 'drag',
                paddingRight: 138,
            } as React.CSSProperties}
        >
            {/* Left: Logo + Menu Bar */}
            <div className="flex items-center h-full" style={noDrag}>
                <img src={bananyangIcon} alt="Logo" className="w-5 h-5 opacity-80 mr-2 pointer-events-none" />
                <MenuBar menus={menus} />
            </div>

            {/* Right: Custom buttons (window controls handled by OS overlay) */}
            <div className="flex items-center gap-1" style={noDrag}>
                <button
                    onClick={handleRestart}
                    className="p-2 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors"
                    title={t('menu.view.refreshVRAM', language)}
                >
                    <RestartIcon />
                </button>
                {/* Language switcher */}
                <div ref={langDropdownRef} className="relative">
                    <button
                        onClick={() => setIsLangOpen(prev => !prev)}
                        className="p-2 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors"
                        aria-label={t('settings.language', language)}
                        title={t('settings.language', language)}
                    >
                        <GlobeIcon />
                    </button>
                    {isLangOpen && (
                        <div className="absolute top-full right-0 mt-1 bg-zinc-900/95 border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]" style={{ zIndex: Z_INDEX.HEADER_DROPDOWN, isolation: 'isolate', transform: 'translateZ(0)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                            <div className="px-3 pt-2 pb-1.5 text-xs font-semibold text-white/40 uppercase tracking-wider select-none">
                                {t('settings.language', language)}
                            </div>
                            <div className="mx-3 mb-1 border-t border-white/10" />
                            {([
                                { code: 'ko', label: '한국어' },
                                { code: 'en', label: 'English' },
                                { code: 'ja', label: '日本語' },
                                { code: 'id', label: 'Bahasa Indonesia' },
                                { code: 'es', label: 'Español' },
                                { code: 'fr', label: 'Français' },
                            ] as { code: Language; label: string }[]).map(({ code, label }) => (
                                <button
                                    key={code}
                                    onClick={() => {
                                        useSettingsStore.getState().setLanguage(code);
                                        setIsLangOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${language === code ? 'text-yellow-200' : 'text-white/80'}`}
                                >
                                    <span className="w-4 text-center">{language === code ? '✓' : ''}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Image Count Badge */}
                <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-white/50 text-xs font-medium"
                    title={`${t('window.canvasImages', language)}: ${imageCount}`}
                >
                    <LayersIcon />
                    <span>{imageCount}</span>
                </div>
                <HeaderUpdateButton language={language} />
                <button
                    onClick={() => onOpenSettings()}
                    className="p-2 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors"
                    title={t('menu.help.settings', language)}
                >
                    <SettingsIcon className="w-6 h-6" />
                </button>
                <div className="w-px h-3 bg-white/10 mx-1" />
                <button
                    onClick={handleToggleAlwaysOnTop}
                    className={`p-2 rounded-md transition-colors ${isAlwaysOnTop ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                    title={t('menu.view.alwaysOnTop', language)}
                >
                    <PinIcon active={isAlwaysOnTop} />
                </button>
            </div>
        </div>

        {/* Row 2: Workspace Tab Bar (also draggable for window movement) */}
        <div
            className="fixed left-0 right-0 flex items-stretch border-b border-white/10 glass-header"
            style={{
                top: 36,
                height: 36,
                zIndex: Z_INDEX.WORKSPACE_TABS,
                WebkitAppRegion: 'drag',
            } as React.CSSProperties}
        >
            <div style={noDrag} className="flex items-stretch w-full">
                <WorkspaceTabBar onRequestCloseTab={onRequestCloseTab} />
            </div>
        </div>
</>
    );
};
