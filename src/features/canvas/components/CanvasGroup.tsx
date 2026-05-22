import React, { useState, useEffect, useRef } from 'react';
import { BoardGroup } from '../../../types';
import { useCanvasStore } from '../../../store/canvasStore';
import { DownloadIcon } from '../../../components/icons';

interface CanvasGroupProps {
    group: BoardGroup;
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>, groupId: string) => void;
    onContextMenu: (e: React.MouseEvent<HTMLDivElement>, groupId: string, type: 'group') => void;
    isSuspended: boolean;
    onDoubleClick: (groupId: string) => void;
    isZKeyDown?: boolean;
    onDownloadGroup: (groupId: string) => void;
}

const areGroupPropsEqual = (prevProps: Readonly<CanvasGroupProps>, nextProps: Readonly<CanvasGroupProps>) => {
    // onMouseDown, onDownloadGroup are intentionally ignored because new inline functions are passed on every render.
    return prevProps.group === nextProps.group &&
        prevProps.onContextMenu === nextProps.onContextMenu &&
        prevProps.isSuspended === nextProps.isSuspended &&
        prevProps.onDoubleClick === nextProps.onDoubleClick &&
        prevProps.isZKeyDown === nextProps.isZKeyDown;
};

export const CanvasGroup: React.FC<CanvasGroupProps> = React.memo(({ group, onMouseDown, onContextMenu, isSuspended, onDoubleClick, isZKeyDown, onDownloadGroup }) => {
    const zoom = useCanvasStore(state => state.zoom);
    const isSelected = useCanvasStore(state => state.selectedGroupIds.has(group.id));
    const groupEditModeId = useCanvasStore(state => state.groupEditModeId);
    const editingGroupId = useCanvasStore(state => state.editingGroupId);
    const setGroupName = useCanvasStore(state => state.setGroupName);
    const setEditingGroupId = useCanvasStore(state => state.setEditingGroupId);
    const [name, setName] = useState(group.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const isEditingName = editingGroupId === group.id;
    const isInEditMode = groupEditModeId === group.id;

    // [Drag Sync] Override position during drag for real-time UI sync
    const [overridePosition, setOverridePosition] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleMove = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.groupId === group.id) {
                setOverridePosition({ x: detail.x, y: detail.y });
            }
        };
        const handleMoveEnd = () => setOverridePosition(null);

        window.addEventListener('canvas-group-move', handleMove);
        window.addEventListener('mouseup', handleMoveEnd);
        return () => {
            window.removeEventListener('canvas-group-move', handleMove);
            window.removeEventListener('mouseup', handleMoveEnd);
        };
    }, [group.id]);

    // Use override position during drag, otherwise use store position
    const displayX = overridePosition?.x ?? group.x;
    const displayY = overridePosition?.y ?? group.y;

    const handleNameDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingGroupId(group.id);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);

    const handleNameBlur = () => {
        setGroupName(group.id, name);
        setEditingGroupId(null);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleNameBlur();
        } else if (e.key === 'Escape') {
            setName(group.name);
            setEditingGroupId(null);
        }
    };

    useEffect(() => {
        if (isEditingName) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditingName]);

    useEffect(() => {
        setName(group.name);
    }, [group.name]);

    return (
        <div
            draggable={false}
            data-group-id={group.id}
            className={`absolute select-none bg-white/5 border-2 ${isSuspended ? 'border-dotted opacity-50 pointer-events-none' : (isInEditMode ? 'border-solid' : 'border-dashed')}`}
            style={{
                left: displayX,
                top: displayY,
                width: group.width,
                height: group.height,
                zIndex: group.zIndex,
                borderColor: isInEditMode ? '#facc15' : (isSelected ? 'white' : 'rgba(255, 255, 255, 0.2)'),
                boxShadow: isInEditMode ? `0 0 ${20 / zoom}px #facc15b3` : 'none',
                cursor: isInEditMode ? 'default' : (isZKeyDown ? 'zoom-in' : 'grab'),
                pointerEvents: (isInEditMode || isZKeyDown) ? 'none' : 'auto',
            }}
            onMouseDown={(e) => {
                if (!isInEditMode) {
                    e.preventDefault(); // Prevent ghost image during drag
                    onMouseDown(e, group.id);
                }
            }}
            onDoubleClick={(e) => { e.stopPropagation(); e.preventDefault(); onDoubleClick(group.id); }}
            onContextMenu={(e) => onContextMenu(e, group.id, 'group')}
        >
            <div
                className="absolute text-xs px-2 py-1 rounded-md pointer-events-auto group flex items-center gap-1"
                style={{
                    top: -24 / zoom,
                    left: 0,
                    transform: `scale(${1 / zoom})`,
                    transformOrigin: 'top left',
                    backgroundColor: isSelected || isInEditMode ? '#facc15' : 'rgba(0,0,0,0.5)',
                    color: isSelected || isInEditMode ? 'black' : 'white',
                }}
                onDoubleClick={handleNameDoubleClick}
            >
                {isEditingName ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        onBlur={handleNameBlur}
                        onKeyDown={handleNameKeyDown}
                        onClick={e => e.stopPropagation()}
                        className="bg-transparent outline-none border-none p-0"
                        style={{ width: `${name.length + 2}ch`, color: 'black' }}
                    />
                ) : (
                    <>
                        <span>{group.name}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDownloadGroup(group.id); }}
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity flex-shrink-0 ml-2 px-1 py-0.5 rounded"
                            title="Download group images"
                        >
                            <DownloadIcon className="w-3 h-3" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}, areGroupPropsEqual);
