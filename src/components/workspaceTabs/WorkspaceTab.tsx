import React, { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorkspaceTab } from '../../store/workspaceTabsStore';
import { t } from '../../localization';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
    tab: WorkspaceTab;
    isActive: boolean;
    isLocked?: boolean;
    onActivate: () => void;
    onClose: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onRename: (newTitle: string) => void;
}

export const WorkspaceTabItem: React.FC<Props> = ({
    tab,
    isActive,
    isLocked = false,
    onActivate,
    onClose,
    onContextMenu,
    onRename,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
    const language = useSettingsStore(state => state.language);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(tab.title);
    const inputRef = useRef<HTMLInputElement>(null);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleDoubleClick = () => {
        setEditValue(tab.title);
        setIsEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commitRename = () => {
        const trimmed = editValue.trim();
        if (!trimmed) {
            setIsEditing(false);
            return;
        }
        if (trimmed !== tab.title) onRename(trimmed);
        setIsEditing(false);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setIsEditing(false);
    };

    const handleCloseClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    const handleMiddleClick = (e: React.MouseEvent) => {
        if (e.button === 1) {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            data-tab-handle="true"
            className={[
                'group flex items-center h-full px-3 gap-1.5 text-sm select-none shrink-0 relative',
                'border-r border-white/10 max-w-[180px] min-w-[80px]',
                isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                isActive
                    ? 'bg-white/12 text-white'
                    : 'bg-transparent text-white/50 hover:text-white/80 hover:bg-white/6',
            ].join(' ')}
            onClick={onActivate}
            onAuxClick={handleMiddleClick}
            onContextMenu={onContextMenu}
            onDoubleClick={handleDoubleClick}
            title={tab.title}
            {...attributes}
            {...listeners}
            onMouseDown={(e) => {
                e.stopPropagation(); // Prevent DraggableHeader window-drag
                listeners?.onMouseDown?.(e as any);
            }}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleInputKeyDown}
                    onClick={e => e.stopPropagation()}
                    className="bg-transparent outline-none border-b border-white/40 text-white text-sm w-full min-w-0"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                />
            ) : (
                <span className="truncate flex-1 min-w-0">{tab.title}</span>
            )}

            {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" title={t('tab.unsavedChanges', language)} />
            )}

            <button
                onClick={handleCloseClick}
                onMouseDown={e => e.stopPropagation()}
                className={[
                    'shrink-0 w-4 h-4 rounded flex items-center justify-center',
                    'text-white/40 hover:text-white hover:bg-white/15',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    isActive ? 'opacity-100' : '',
                ].join(' ')}
                tabIndex={-1}
                title={t('tab.close', language)}
            >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>

            {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />
            )}
        </div>
    );
};

