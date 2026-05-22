import React, { useState, useEffect, useRef } from 'react';
import { Z_INDEX } from '../constants/zIndex';
import { PromptFolder, PromptItem } from '../types';
import { t, Language } from '../localization';
import { CloseIcon, FolderPlusIcon, PencilIcon, StarIcon, TrashIcon, DownloadIcon, UploadIcon } from './icons';
import { Tooltip } from './Tooltip';
import { SavePresetModal } from './SavePresetModal';
import { HoverEdgeAutoScroll } from './HoverEdgeAutoScroll';

interface PresetManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPrompt: string;
    onLoadPrompt: (prompt: string) => void;
    onNotification: (message: string, type: 'success' | 'error') => void;
    language: Language;
    folders: PromptFolder[];
    saveFolders: (folders: PromptFolder[]) => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({
    isOpen,
    onClose,
    currentPrompt,
    onLoadPrompt,
    onNotification,
    language,
    folders,
    saveFolders
}) => {
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [editingFolder, setEditingFolder] = useState<{ id: string, name: string } | null>(null);
    const [editingPreset, setEditingPreset] = useState<PromptItem | null>(null);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const folderListScrollRef = useRef<HTMLDivElement>(null);
    const presetListScrollRef = useRef<HTMLDivElement>(null);

    // New state for adding presets inside the modal
    const [newPresetName, setNewPresetName] = useState('');
    const [newPresetPrompt, setNewPresetPrompt] = useState('');


    useEffect(() => {
        if (isOpen) {
            const currentSelectionExists = folders.some(f => f.id === selectedFolderId);
            if (!currentSelectionExists && folders.length > 0) {
                setSelectedFolderId(folders[0].id);
            } else if (folders.length === 0) {
                setSelectedFolderId(null);
            }
        }
    }, [isOpen, folders, selectedFolderId]);

    const handleAddFolder = () => {
        const newFolder: PromptFolder = {
            id: crypto.randomUUID(),
            name: `${t('presets.folder', language)} ${folders.length + 1}`,
            presets: [],
            // FIX: Explicitly set showInQuickBar to true for new folders.
            showInQuickBar: true,
        };
        const newFolders = [...folders, newFolder];
        saveFolders(newFolders);
        setSelectedFolderId(newFolder.id);
        setEditingFolder({ id: newFolder.id, name: newFolder.name });
    };

    const handleDeleteFolder = (folderId: string) => {
        if (window.confirm(t('presets.deleteFolderConfirm', language))) {
            const newFolders = folders.filter(f => f.id !== folderId);
            saveFolders(newFolders);
            if (selectedFolderId === folderId) {
                setSelectedFolderId(newFolders.length > 0 ? newFolders[0].id : null);
            }
        }
    };

    const handleRenameFolder = () => {
        if (!editingFolder || !editingFolder.name.trim()) {
            setEditingFolder(null);
            return;
        };
        const newFolders = folders.map(f =>
            f.id === editingFolder.id ? { ...f, name: editingFolder.name.trim() } : f
        );
        saveFolders(newFolders);
        setEditingFolder(null);
    };

    const handleSaveCurrentPrompt = () => {
        if (!selectedFolderId || !currentPrompt.trim()) return;
        setIsSaveModalOpen(true);
    };

    const handleAddNewPreset = () => {
        if (!selectedFolderId || !newPresetName.trim() || !newPresetPrompt.trim()) return;

        const newPreset: PromptItem = {
            id: crypto.randomUUID(),
            name: newPresetName.trim(),
            prompt: newPresetPrompt.trim(),
        };

        const newFolders = folders.map(folder => {
            if (folder.id === selectedFolderId) {
                return { ...folder, presets: [...folder.presets, newPreset] };
            }
            return folder;
        });

        saveFolders(newFolders);
        // Clear the form
        setNewPresetName('');
        setNewPresetPrompt('');
        onNotification(t('presets.promptSaved', language), 'success');
    };

    const handleDeletePreset = (presetId: string) => {
        if (!selectedFolderId || !window.confirm(t('presets.deleteConfirm', language))) return;

        const newFolders = folders.map(folder => {
            if (folder.id === selectedFolderId) {
                return { ...folder, presets: folder.presets.filter(p => p.id !== presetId) };
            }
            return folder;
        });
        saveFolders(newFolders);
    };

    const handleSavePresetEdit = () => {
        if (!editingPreset || !editingPreset.name.trim() || !selectedFolderId) {
            setEditingPreset(null);
            return;
        }

        const newFolders = folders.map(f => {
            if (f.id === selectedFolderId) {
                return {
                    ...f,
                    presets: f.presets.map(p => p.id === editingPreset.id ? editingPreset : p)
                };
            }
            return f;
        });
        saveFolders(newFolders);
        setEditingPreset(null);
    };

    const handleToggleQuickBar = (folderId: string) => {
        const newFolders = folders.map(f =>
            f.id === folderId ? { ...f, showInQuickBar: !(f.showInQuickBar ?? true) } : f
        );
        saveFolders(newFolders);
    };

    // Export all presets to a .prompt file
    const handleExportPresets = async () => {
        try {
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                folders: folders
            };
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });

            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `bananyang-presets-${new Date().toISOString().slice(0, 10)}.prompt`,
                    types: [{ description: 'Prompt Presets', accept: { 'application/json': ['.prompt'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                onNotification(t('presets.exportSuccess', language), 'success');
            } else {
                // Fallback for browsers without File System Access API
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `bananyang-presets-${new Date().toISOString().slice(0, 10)}.prompt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                onNotification(t('presets.exportSuccess', language), 'success');
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Export failed:', error);
                onNotification(t('presets.exportFailed', language), 'error');
            }
        }
    };

    // Import presets from a .prompt file
    const handleImportPresets = async () => {
        try {
            if (window.showOpenFilePicker) {
                const [handle] = await window.showOpenFilePicker({
                    types: [{ description: 'Prompt Presets', accept: { 'application/json': ['.prompt'] } }],
                    multiple: false
                });
                const file = await handle.getFile();
                const content = await file.text();
                const importData = JSON.parse(content);

                if (importData.folders && Array.isArray(importData.folders)) {
                    // Merge or replace folders
                    if (window.confirm(t('presets.importConfirm', language))) {
                        saveFolders(importData.folders);
                        onNotification(t('presets.importSuccess', language), 'success');
                    }
                } else {
                    onNotification(t('presets.importInvalid', language), 'error');
                }
            } else {
                // Fallback using file input
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.prompt';
                input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                        const content = await file.text();
                        const importData = JSON.parse(content);

                        if (importData.folders && Array.isArray(importData.folders)) {
                            if (window.confirm(t('presets.importConfirm', language))) {
                                saveFolders(importData.folders);
                                onNotification(t('presets.importSuccess', language), 'success');
                            }
                        } else {
                            onNotification(t('presets.importInvalid', language), 'error');
                        }
                    }
                };
                input.click();
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Import failed:', error);
                onNotification(t('presets.importFailed', language), 'error');
            }
        }
    };

    if (!isOpen) {
        return null;
    }

    const selectedFolder = folders.find(f => f.id === selectedFolderId);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: Z_INDEX.MODAL_ELEVATED }}>
            {isSaveModalOpen && <SavePresetModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={(name, folderId) => {
                    const newPreset: PromptItem = {
                        id: crypto.randomUUID(),
                        name: name,
                        prompt: currentPrompt,
                    };
                    const newFolders = folders.map(f => f.id === folderId ? { ...f, presets: [...f.presets, newPreset] } : f);
                    saveFolders(newFolders);
                    onNotification(t('presets.promptSaved', language), 'success');
                    setIsSaveModalOpen(false);
                }}
                folders={folders}
                language={language}
                initialFolderId={selectedFolderId}
            />}
            <div className="glass-panel rounded-3xl w-full max-w-4xl h-[70vh] shadow-2xl flex flex-col animate-category-fade-in overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                    <h2 className="text-xl font-bold text-white">{t('presets.modalTitle', language)}</h2>
                    <div className="flex items-center gap-3">
                        <Tooltip tip={t('presets.exportTooltip', language)}>
                            <button
                                onClick={handleExportPresets}
                                disabled={folders.length === 0}
                                className="px-4 py-2 text-sm font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 border border-white/10 flex items-center gap-2"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                {t('presets.export', language)}
                            </button>
                        </Tooltip>
                        <Tooltip tip={t('presets.importTooltip', language)}>
                            <button
                                onClick={handleImportPresets}
                                className="px-4 py-2 text-sm font-semibold rounded-xl bg-white hover:bg-zinc-200 text-black transition-colors shadow-lg flex items-center gap-2"
                            >
                                <UploadIcon className="w-4 h-4" />
                                {t('presets.import', language)}
                            </button>
                        </Tooltip>
                        <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-grow flex min-h-0">
                    {/* Folders List */}
                    <div className="w-1/3 flex-shrink-0 border-r border-white/10 flex flex-col bg-black/10">
                        <div className="p-4 border-b border-white/5">
                            <button onClick={handleAddFolder} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/5">
                                <FolderPlusIcon className="w-5 h-5" />
                                <span>{t('presets.newFolder', language)}</span>
                            </button>
                        </div>
                        <div className="flex-grow relative min-h-0">
                        <div ref={folderListScrollRef} className="h-full overflow-y-auto px-3 py-3 space-y-1">
                            {folders.length === 0 ? (
                                <p className="text-center text-sm text-zinc-500 p-8">{t('presets.noFolders', language)}</p>
                            ) : (
                                folders.map(folder => (
                                    <div key={folder.id} className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${selectedFolderId === folder.id ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-zinc-300'}`}
                                        onClick={() => setSelectedFolderId(folder.id)}>
                                        {editingFolder?.id === folder.id ? (
                                            <input
                                                type="text"
                                                value={editingFolder.name}
                                                onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                                                onBlur={handleRenameFolder}
                                                onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
                                                autoFocus
                                                className="bg-transparent w-full outline-none text-black font-medium"
                                            />
                                        ) : (
                                            <span className="truncate font-medium">{folder.name}</span>
                                        )}
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                            <Tooltip tip={t('presets.toggleQuickBar', language)}>
                                                <button onClick={(e) => { e.stopPropagation(); handleToggleQuickBar(folder.id); }} className={`p-1.5 rounded-md hover:bg-black/10 ${(folder.showInQuickBar ?? true) ? 'text-yellow-500' : 'text-zinc-400'}`}>
                                                    <StarIcon className="w-4 h-4" filled={folder.showInQuickBar ?? true} />
                                                </button>
                                            </Tooltip>
                                            <button onClick={(e) => { e.stopPropagation(); setEditingFolder({ id: folder.id, name: folder.name }); }} className="p-1.5 hover:bg-black/10 rounded-md text-zinc-400 hover:text-black"><PencilIcon className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="p-1.5 hover:bg-red-500/20 rounded-md text-zinc-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <HoverEdgeAutoScroll targetRef={folderListScrollRef} />
                        </div>
                    </div>

                    {/* Presets List */}
                    <div className="w-2/3 flex-grow relative min-h-0">
                    <div ref={presetListScrollRef} className="h-full overflow-y-auto p-6">
                        {!selectedFolder ? (
                            <div className="flex items-center justify-center h-full text-zinc-500">
                                {folders.length > 0 && <p>{t('presets.selectFolder', language)}</p>}
                            </div>
                        ) : (
                            <>
                                {selectedFolder.presets.length === 0 ? (
                                    <p className="text-center text-sm text-zinc-500 pt-8">{t('presets.noPresets', language)}</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedFolder.presets.map(preset => (
                                            editingPreset?.id === preset.id ? (
                                                <div key={preset.id} className="bg-neutral-800/80 p-4 rounded-xl border border-white/10 shadow-lg">
                                                    <div className="flex flex-col gap-3">
                                                        <input
                                                            type="text"
                                                            value={editingPreset.name}
                                                            onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm font-bold text-white placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none"
                                                        />
                                                        <textarea
                                                            value={editingPreset.prompt}
                                                            onChange={(e) => setEditingPreset({ ...editingPreset, prompt: e.target.value })}
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-zinc-300 placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none resize-y"
                                                            rows={4}
                                                        />
                                                        <div className="flex justify-end gap-2 mt-1">
                                                            <button onClick={() => setEditingPreset(null)} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/5">{t('presets.cancel', language)}</button>
                                                            <button onClick={handleSavePresetEdit} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors shadow-md">{t('presets.save', language)}</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={preset.id} className="group bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-200">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-grow mr-4">
                                                            <h4 className="text-sm font-bold text-zinc-100 mb-1">{preset.name}</h4>
                                                            <p className="text-xs text-zinc-400 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">{preset.prompt}</p>
                                                        </div>
                                                        <div className="flex-shrink-0 flex items-center gap-2">
                                                            <button onClick={() => { onLoadPrompt(preset.prompt); onClose(); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white text-white hover:text-black transition-colors border border-white/10">{t('presets.usePreset', language)}</button>
                                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => setEditingPreset(preset)} className="p-1.5 hover:text-white text-zinc-400 rounded-md hover:bg-white/10"><PencilIcon className="w-4 h-4" /></button>
                                                                <button onClick={() => handleDeletePreset(preset.id)} className="p-1.5 hover:text-red-400 text-zinc-400 rounded-md hover:bg-red-500/20"><TrashIcon className="w-4 h-4" /></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                                {/* New Preset Form */}
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <h4 className="text-sm font-bold text-zinc-100 mb-3">{t('presets.addNewPresetTitle', language)}</h4>
                                    <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-xl border border-white/5">
                                        <input
                                            type="text"
                                            placeholder={t('presets.presetNamePlaceholder', language)}
                                            value={newPresetName}
                                            onChange={(e) => setNewPresetName(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none"
                                        />
                                        <textarea
                                            placeholder={t('presets.promptContentPlaceholder', language)}
                                            value={newPresetPrompt}
                                            onChange={(e) => setNewPresetPrompt(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none resize-y"
                                            rows={3}
                                        />
                                        <button
                                            onClick={handleAddNewPreset}
                                            disabled={!selectedFolderId || !newPresetName.trim() || !newPresetPrompt.trim()}
                                            className="mt-1 self-end px-5 py-2 text-sm font-semibold rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors disabled:opacity-50 shadow-md"
                                        >
                                            {t('presets.addPresetButton', language)}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <HoverEdgeAutoScroll targetRef={presetListScrollRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};