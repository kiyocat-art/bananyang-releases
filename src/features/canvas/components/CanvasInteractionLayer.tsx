// FIX: Import React to resolve namespace errors for event types.
import React from 'react';
import { Z_INDEX } from '../../../constants/zIndex';
import { GeneratedMedia, GenerationParams, BoardImage, ShortcutAction } from '../../../types';
import { useCanvasInteractions } from '../hooks/useCanvasInteractions';
// FIX: Import the 't' function for localization.
import { t } from '../../../localization';
// FIX: Corrected the import path for SelectionBox to point to the file with content, resolving the 'not a module' error caused by an empty file at the original path.
import { SelectionBox } from './SelectionBox';
import { ContextMenu } from './ContextMenu';
import { useCanvasStore } from '../../../store/canvasStore';


// FIX: Add missing props to the interface.
interface CanvasInteractionLayerProps {
    children: React.ReactNode;
    allHistoryMedia: GeneratedMedia[];
    onSaveWorkspace: () => void;
    onSaveWorkspaceAs: () => void;
    onLoadWorkspace: (content?: string, filePath?: string) => void;
    handleUploadAndPositionImages: (files: File[], position?: { x: number, y: number }) => void;
    onPasteFromClipboard: (position: { x: number; y: number; }) => void;
    onNotification: (message: string, type: 'success' | 'error') => void;
    language: 'ko';
    onCopySelection: () => Promise<Blob | null>;
    onZoomSelection: (media: File | string | null) => void;
    onEditSelection: (imageId: string) => void;
    onLoadGenerationParams: (params: GenerationParams) => void;
    saveDirectoryHandle: FileSystemDirectoryHandle | null;
    isLowZoomMode: boolean;
    hitTest: (x: number, y: number) => { type: 'image' | 'group' | 'memo'; id: string } | null;
    onNewWorkspace: () => void;
}

// FIX: Add missing `onPasteFromClipboard` prop to destructuring and pass it to the `useCanvasInteractions` hook.
export const CanvasInteractionLayer: React.FC<CanvasInteractionLayerProps> = (props) => {
    // FIX: Destructure children and spread the rest of the props to be passed to the hook, resolving the type error.
    const { children, ...hookProps } = props;
    const {
        canvasRef,
        fileInputRef,
        cursorClass,
        isDraggingOver,
        handleDrop,
        handleDragEnter,
        handleDragLeave,
        handleMouseDownOnCanvas,
        handleContextMenu,
        contextMenu,
    } = useCanvasInteractions(hookProps);


    return (
        <div
            ref={canvasRef}
            className={`flex-grow w-full h-full relative bg-transparent overflow-hidden ${cursorClass}`}
            onDragOver={(e) => e.preventDefault()}
            // FIX: Use handlers returned from the hook.
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseDown={handleMouseDownOnCanvas}
            onContextMenu={handleContextMenu}
            tabIndex={0}
        >
            {isDraggingOver && (
                <div className="absolute inset-0 bg-sky-500/20 border-4 border-dashed border-sky-500 pointer-events-none flex items-center justify-center transition-all duration-200" style={{ zIndex: Z_INDEX.CANVAS_INTERACTION }}>
                    <p className="text-2xl font-bold text-white bg-black/50 px-4 py-2 rounded-lg">{t('uploader.orDragAndDrop', 'ko')}</p>
                </div>
            )}

            {children}

            {/* Render context menu if it exists */}
            {contextMenu && <ContextMenu {...contextMenu} />}

            <input type="file" ref={fileInputRef} multiple accept="image/*,.nyang,.rfy,.bananyang" className="hidden" onChange={async (e) => {
                if (e.target.files) {
                    const files: File[] = Array.from(e.target.files);
                    const workspaceFiles = files.filter(f => f.name.endsWith('.nyang') || f.name.endsWith('.rfy') || f.name.endsWith('.bananyang'));
                    if (workspaceFiles.length > 0) {
                        for (const wf of workspaceFiles) {
                            try {
                                await new Promise<void>((resolve) => {
                                    const fileReader = new FileReader();
                                    fileReader.onload = (event) => {
                                        if (typeof event.target?.result === 'string') {
                                            props.onLoadWorkspace(event.target.result);
                                        }
                                        resolve();
                                    };
                                    fileReader.onerror = () => resolve();
                                    fileReader.readAsText(wf);
                                });
                                await new Promise(r => setTimeout(r, 0));
                            } catch (err) {
                                console.error('Failed to read workspace file:', err instanceof Error ? err.message : String(err));
                            }
                        }
                    } else {
                        props.handleUploadAndPositionImages(files);
                    }
                }
                // Reset input value to allow selecting the same file again
                e.target.value = '';
            }} />
        </div>
    );
};