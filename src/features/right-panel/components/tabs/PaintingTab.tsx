import React from 'react';
import { Language } from '../../../../localization';
import { ColorPalettePanel } from '../ColorPalettePanel';

interface PaintingTabProps {
    language: Language;
}

export const PaintingTab: React.FC<PaintingTabProps> = ({ language }) => {
    return <ColorPalettePanel language={language} />;
};
