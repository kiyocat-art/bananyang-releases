
import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { BoardImage, ModelName } from '../../../../../types';
import { EditResult } from '../../UnifiedEditorModal';
import { Language } from '../../../../../localization';

// --- Types ---

interface EditorState {
    activeTool: string;
    image: BoardImage;
    language: Language;
    modelName: ModelName;
}

interface EditorHandlers {
    setActiveTool: (tool: string) => void;
    onComplete: (result: EditResult) => void;
    onCancel: () => void;
    onNotification: (message: string, type: 'success' | 'error') => void;
}

interface EditorTransform {
    zoom: number;
    pan: { x: number; y: number };
    imageSize: { width: number; height: number; naturalWidth: number; naturalHeight: number };
}

interface EditorTransformHandlers {
    setZoom: (zoom: number | ((prev: number) => number)) => void;
    setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    setImageSize: (size: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => void;
}

// --- Contexts ---

// 1. State Context (Low frequency updates: Active Tool, Image prop, identifying info)
const EditorStateContext = createContext<(EditorState & EditorHandlers) | null>(null);

// 2. Transform Context (High frequency updates: Zoom, Pan)
// We separate this so Sidebar components doesn't re-render on zoom
const EditorTransformContext = createContext<(EditorTransform & EditorTransformHandlers) | null>(null);


// --- Provider ---

interface EditorProviderProps {
    children: ReactNode;
    initialImage: BoardImage;
    language: Language;
    modelName: ModelName;
    onComplete: (result: EditResult) => void;
    onCancel: () => void;
    onNotification: (message: string, type: 'success' | 'error') => void;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({
    children,
    initialImage,
    language,
    modelName,
    onComplete,
    onCancel,
    onNotification
}) => {
    // State
    const [activeTool, setActiveTool] = useState<string>('crop');

    // Transform State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [imageSize, setImageSize] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

    return (
        <EditorStateContext.Provider value={{
            activeTool,
            image: initialImage,
            language,
            modelName,
            setActiveTool,
            onComplete,
            onCancel,
            onNotification
        }}>
            <EditorTransformContext.Provider value={{
                zoom,
                pan,
                imageSize,
                setZoom,
                setPan,
                setImageSize
            }}>
                {children}
            </EditorTransformContext.Provider>
        </EditorStateContext.Provider>
    );
};

// --- Hooks ---

export const useEditorState = () => {
    const context = useContext(EditorStateContext);
    if (!context) throw new Error('useEditorState must be used within an EditorProvider');
    return context;
};

export const useEditorTransform = () => {
    const context = useContext(EditorTransformContext);
    if (!context) throw new Error('useEditorTransform must be used within an EditorProvider');
    return context;
};
