import React, { useState, useEffect, useRef } from 'react';
import { Z_INDEX } from '../constants/zIndex';
import { PromptFolder } from '../types';
import { t, Language } from '../localization';

export interface SavePresetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, folderId: string) => void;
    folders: PromptFolder[];
    language: Language;
    initialFolderId: string | null;
}

export const SavePresetModal: React.FC<SavePresetModalProps> = ({ isOpen, onClose, onSave, folders, language, initialFolderId }) => {
    const [name, setName] = useState('');
    const [folderId, setFolderId] = useState<string>('');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(t('presets.untitled', language));
            if (initialFolderId) {
                setFolderId(initialFolderId);
            } else if (folders.length > 0) {
                setFolderId(folders[0].id);
            }
        }
    }, [isOpen, folders, initialFolderId, language]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);
    
    if (!isOpen) return null;

    const handleSave = () => {
        if (name.trim() && folderId) {
            onSave(name.trim(), folderId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: Z_INDEX.MODAL_ELEVATED }}>
            <div
                ref={modalRef}
                className="bg-neutral-800/50 backdrop-blur-xl border border-white/10 rounded-lg p-6 max-w-sm w-full shadow-lg animate-category-fade-in"
            >
                <h3 className="text-lg font-bold mb-4">{t('presets.saveModalTitle', language)}</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="preset-name" className="block text-sm font-medium text-zinc-300 mb-1">{t('presets.presetNameLabel', language)}</label>
                        <input
                            id="preset-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            className="w-full bg-neutral-900 border border-neutral-600 rounded-md py-2 px-3 text-sm text-zinc-200 focus:ring-1 focus:ring-white focus:border-white outline-none"
                            placeholder={t('presets.presetNamePlaceholder', language)}
                            autoFocus
                        />
                    </div>
                    <div>
                         <label htmlFor="folder-select" className="block text-sm font-medium text-zinc-300 mb-1">{t('presets.folderSelectLabel', language)}</label>
                         <select
                            id="folder-select"
                            value={folderId}
                            onChange={e => setFolderId(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-600 rounded-md py-2 px-3 text-sm text-zinc-200 focus:ring-1 focus:ring-white focus:border-white outline-none"
                         >
                            <option value="" disabled>{t('presets.selectFolder', language)}</option>
                            {folders.map(folder => (
                                <option key={folder.id} value={folder.id}>{folder.name}</option>
                            ))}
                         </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors">{t('presets.cancel', language)}</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold rounded-md bg-white hover:bg-zinc-200 text-zinc-800 transition-colors">{t('presets.save', language)}</button>
                </div>
            </div>
        </div>
    );
};
