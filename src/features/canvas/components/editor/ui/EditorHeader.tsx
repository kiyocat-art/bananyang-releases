import React from 'react';

interface EditorHeaderProps {
    title: string;
    onCancel: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
    title, onCancel, onMouseDown
}) => {
    return (
        <div
            className="flex-shrink-0 h-10 px-4 bg-white/5 border-b border-white/10 flex items-center justify-between rounded-t-2xl cursor-move"
            onMouseDown={onMouseDown}
        >
            <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
            <button
                onClick={onCancel}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors"
                title="Close"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
            </button>
        </div>
    );
};
