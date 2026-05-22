import React, { useRef } from 'react';
import { RelightingProperties } from '../RelightingProperties';
import { Language } from '../../../../../localization';
import { useEditorStore } from '../../../../../features/toolbar/useEditorStore';
import { EditorImageViewer } from '../EditorImageViewer';
import { RelightingOverlay } from '../RelightingOverlay';
import { useResizableSidebar } from '../hooks/useResizableSidebar';
import { HoverEdgeAutoScroll } from '../../../../../components/HoverEdgeAutoScroll';

interface RelightTabProps {
    language: Language;
    localImageSrc?: string | null;
    onSetLightingPrompt?: (hint: string) => void;
}

export const RelightTab: React.FC<RelightTabProps> = ({ language, localImageSrc, onSetLightingPrompt }) => {
    const {
        lightSources, selectedLightId,
        addLight, setSelectedLightId,
        updateLight, deleteLight, pasteLights,
        setLightSources,
        resetLights,
    } = useEditorStore();
    const { sidebarWidth, handleResizeMouseDown } = useResizableSidebar();
    const sidebarScrollRef = useRef<HTMLDivElement>(null);

    return (
        <div className="absolute inset-0 flex overflow-hidden bg-[#0e0e0e]">
            <EditorImageViewer
                className="flex-1 min-w-0 h-full"
                localImageSrc={localImageSrc}
                renderAtViewport={({ imageSize, zoom, pan, isZKeyDown }) => (
                    <RelightingOverlay
                        lightSources={lightSources}
                        selectedLightId={selectedLightId}
                        imageSize={imageSize}
                        zoom={zoom}
                        pan={pan}
                        onSelectLight={setSelectedLightId}
                        onUpdateLight={updateLight}
                        isZKeyDown={isZKeyDown}
                    />
                )}
            />

            <div
                className="relative flex-shrink-0 h-full bg-zinc-900/85 backdrop-blur-sm border-l border-white/10"
                style={{ width: sidebarWidth }}
            >
                {/* 리사이즈 핸들 */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group/rh"
                    onMouseDown={handleResizeMouseDown}
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-px rounded-full bg-white/0 group-hover/rh:bg-white/30 transition-colors duration-150" />
                </div>
                <div ref={sidebarScrollRef} className="h-full overflow-y-auto p-4">
                <RelightingProperties
                    lightSources={lightSources}
                    selectedLightId={selectedLightId}
                    onAddLight={addLight}
                    onSelectLight={setSelectedLightId}
                    onUpdateLight={updateLight}
                    onDeleteLight={deleteLight}
                    onPasteLights={pasteLights}
                    onReset={() => { resetLights(); }}
                    onSetLightingPrompt={onSetLightingPrompt}
                    language={language}
                />
                </div>
                <HoverEdgeAutoScroll targetRef={sidebarScrollRef} />
            </div>
        </div>
    );
};
