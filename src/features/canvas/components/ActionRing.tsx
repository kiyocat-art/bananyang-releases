import React, { useState, useRef, useEffect } from 'react';
import { BoardImage } from '../../../types';
import { t, Language } from '../../../localization';
import { Tooltip } from '../../../components/Tooltip';
import { useCanvasStore } from '../../../store/canvasStore';
import { ROLE_COLORS } from '../../../constants';

import {
    BodyIcon, PaintBrushIcon, HangerIcon,
    DownloadIcon, TrashIcon,
} from '../../../components/icons';

interface SelectionBarProps {
    onZoom: (media: File | string | null) => void;
    onDelete: () => void;
    onDownload: (format: 'png' | 'webp') => void;
    language: Language;
}

export const SelectionBar: React.FC<SelectionBarProps> = ({ onZoom, onDelete, onDownload, language }) => {
    const { boardImages, selectedImageIds, setRoleForSelection } = useCanvasStore();
    const [showFormatMenu, setShowFormatMenu] = useState(false);
    const formatMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showFormatMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
                setShowFormatMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFormatMenu]);

    const selectedCount = selectedImageIds.size;
    const selectedImageId = selectedCount === 1 ? Array.from(selectedImageIds)[0] : null;
    const selectedImage = selectedImageId ? boardImages.find(img => img.id === selectedImageId) : null;
    const isMultiSelect = selectedCount > 1;

    if (selectedCount === 0) return null;

    // Define role buttons with new independent reference types
    const roleButtons: {
        key: string;
        role: BoardImage['role'];
        icon?: React.ReactNode;
        content?: string;
        tooltip: string;
        color: string;
    }[] = [
            { key: 'original', role: 'original', content: t('role.original', language), tooltip: t('tooltip.role.original', language), color: ROLE_COLORS.original },
            { key: 'generalRef', role: 'generalRef', content: t('role.generalRef', language), tooltip: t('tooltip.role.generalRef', language), color: ROLE_COLORS.generalRef },
            { key: 'costumeRef', role: 'costumeRef', icon: <HangerIcon className="w-4 h-4" />, tooltip: t('tooltip.role.costumeRef', language), color: ROLE_COLORS.costumeRef },
            { key: 'poseRef', role: 'poseRef', icon: <BodyIcon className="w-4 h-4" />, tooltip: t('tooltip.role.poseRef', language), color: ROLE_COLORS.poseRef },
        ];

    return (
        <div className="flex flex-col items-center gap-2 relative">
            {/* Main Action Bar */}
            <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 p-2 rounded-2xl shadow-2xl animate-selection-toolbar-fade-in whitespace-nowrap">
                {/* Role buttons - single select only */}
                {selectedImage && (
                    <>
                        <div className="flex items-center gap-1">
                            {roleButtons.map(btn => {
                                const isActive = selectedImage.role === btn.role;

                                let activeStyle: React.CSSProperties = {};
                                let activeClass = '';

                                if (isActive) {
                                    activeStyle = { backgroundColor: btn.color, boxShadow: `0 0 15px ${btn.color}66` };
                                    activeClass = 'text-white font-bold';
                                }

                                return (
                                    <Tooltip key={btn.key} tip={btn.tooltip} position="top">
                                        <button
                                            onClick={() => {
                                                setRoleForSelection(btn.role);
                                            }}
                                            className={`px-4 h-9 text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${isActive ? activeClass : 'text-zinc-300 bg-white/5 hover:bg-white/10 hover:text-white'}`}
                                            style={activeStyle}
                                        >
                                            {btn.icon}{btn.content}
                                        </button>
                                    </Tooltip>
                                );
                            })}
                        </div>

                        {/* Separator */}
                        <div className="w-px h-6 bg-neutral-600"></div>
                    </>
                )}

                {/* Multi-select count label */}
                {isMultiSelect && (
                    <span className="px-3 h-9 text-xs text-zinc-300 flex items-center">
                        {selectedCount}개 선택
                    </span>
                )}

                {/* Download Button with format menu */}
                <div className="relative" ref={formatMenuRef}>
                    <Tooltip tip={isMultiSelect ? t('tooltip.downloadSelected', language).replace('{count}', String(selectedCount)) : t('contextMenu.download', language)} position="top">
                        <button
                            onClick={() => setShowFormatMenu(v => !v)}
                            className="px-3 h-9 text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 border border-blue-500/30"
                        >
                            <DownloadIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                    {showFormatMenu && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden flex flex-col min-w-[80px]">
                            <button
                                onClick={() => { onDownload('png'); setShowFormatMenu(false); }}
                                className="px-4 py-2 text-xs text-zinc-200 hover:bg-white/10 transition-colors text-left whitespace-nowrap"
                            >PNG</button>
                            <button
                                onClick={() => { onDownload('webp'); setShowFormatMenu(false); }}
                                className="px-4 py-2 text-xs text-zinc-200 hover:bg-white/10 transition-colors text-left whitespace-nowrap"
                            >WebP</button>
                        </div>
                    )}
                </div>

                {/* Delete Button */}
                <Tooltip tip={isMultiSelect ? t('tooltip.removeSelected', language).replace('{count}', String(selectedCount)) : t('contextMenu.delete', language)} position="top">
                    <button
                        onClick={onDelete}
                        className="px-3 h-9 text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};