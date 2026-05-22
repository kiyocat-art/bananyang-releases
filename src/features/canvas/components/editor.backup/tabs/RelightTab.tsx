import React from 'react';
import { RelightingProperties } from '../RelightingProperties';
import { LightSource } from '../../../../../types';
import { Language } from '../../../../../localization';

interface RelightTabProps {
    lightSources: LightSource[];
    selectedLightId: string | null;
    handleAddLight: () => void;
    setSelectedLightId: (id: string | null) => void;
    handleUpdateLight: (id: string, updates: Partial<LightSource>) => void;
    handleDeleteLight: (id: string) => void;
    handlePasteLights: (lights: LightSource[]) => void;
    setLightSources: (lights: LightSource[]) => void;
    language: Language;
    lightingPrompt: string;
    setLightingPrompt: (prompt: string) => void;
}

export const RelightTab: React.FC<RelightTabProps> = ({
    lightSources, selectedLightId, handleAddLight, setSelectedLightId,
    handleUpdateLight, handleDeleteLight, handlePasteLights, setLightSources,
    language, lightingPrompt, setLightingPrompt
}) => {
    return (
        <div className="p-4">
            <RelightingProperties
                lightSources={lightSources}
                selectedLightId={selectedLightId}
                onAddLight={handleAddLight}
                onSelectLight={setSelectedLightId}
                onUpdateLight={handleUpdateLight}
                onDeleteLight={handleDeleteLight}
                onPasteLights={handlePasteLights}
                onReset={() => {
                    setLightSources([]);
                    setSelectedLightId(null);
                }}
                language={language}
                prompt={lightingPrompt}
                onPromptChange={setLightingPrompt}
            />
        </div>
    );
};
