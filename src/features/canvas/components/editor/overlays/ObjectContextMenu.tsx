
import React from 'react';
import { Z_INDEX } from '../../../../../constants/zIndex';

interface ObjectContextMenuProps {
    menu: { x: number; y: number; objectId: string };
    onClose: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onFlip: (id: string) => void;
    onDelete: (id: string) => void;
}

export const ObjectContextMenu: React.FC<ObjectContextMenuProps> = ({
    menu, onClose, onCopy, onPaste, onFlip, onDelete
}) => {
    return (
        <div
            className="absolute bg-neutral-800 border border-neutral-700 rounded-lg shadow-2xl py-1"
            style={{ left: menu.x, top: menu.y, zIndex: Z_INDEX.HEADER_DROPDOWN }}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => { onCopy(); onClose(); }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-key/10 transition-colors whitespace-nowrap"
            >
                복사
            </button>
            <button
                onClick={() => { onPaste(); onClose(); }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-key/10 transition-colors whitespace-nowrap"
            >
                붙여넣기
            </button>
            <div className="border-t border-white/10 my-1" />
            <button
                onClick={() => { onFlip(menu.objectId); onClose(); }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-key/10 transition-colors whitespace-nowrap"
            >
                좌우 반전
            </button>
            <button
                onClick={() => { onDelete(menu.objectId); onClose(); }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-key/10 transition-colors whitespace-nowrap"
            >
                삭제
            </button>
        </div>
    );
};
