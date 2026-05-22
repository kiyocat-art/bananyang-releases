import React, { useState } from 'react';
import { BodyPart, BoardImage } from '../../../types';
import { useCanvasStore } from '../../../store/canvasStore';
import { REF_COLORS, ROLE_COLORS } from '../../../constants';
import { BODY_PART_PATHS, SVG_VIEWBOX } from './bodyMapPaths';

export const BodyPartSelector: React.FC<{
    bodyPartReferenceMap: Partial<Record<BodyPart, number>>;
    onAssign: (part: BodyPart) => void;
    boardImages: BoardImage[];
}> = ({ bodyPartReferenceMap, onAssign, boardImages }) => {
    const [hoveredPart, setHoveredPart] = useState<BodyPart | null>(null);
    const activeReferenceIndex = useCanvasStore(state => state.activeReferenceIndex);

    const getPartStyle = (part: BodyPart) => {
        const refIndex = bodyPartReferenceMap[part];
        const isHovered = hoveredPart === part;

        let fillColor = 'rgba(113, 113, 122, 0.4)'; // neutral-500/40
        let strokeColor = 'rgb(82, 82, 91)'; // neutral-600

        if (refIndex !== undefined) {
            const refImage = boardImages.find(img => img.refIndex === refIndex && (img.role === 'reference' || img.role === 'costumeRef' || img.role === 'poseRef' || img.role === 'generalRef'));

            if (refImage && (refImage.role === 'costumeRef' || (refImage.role === 'reference' && refImage.referenceType === 'costume'))) {
                fillColor = ROLE_COLORS.costumeRef + 'BF';
                strokeColor = ROLE_COLORS.costumeRef;
            } else {
                fillColor = REF_COLORS[refIndex % REF_COLORS.length] + 'BF';
                strokeColor = REF_COLORS[refIndex % REF_COLORS.length];
            }
        }

        if (isHovered) {
            return {
                fill: refIndex !== undefined ? fillColor : 'rgba(255, 255, 255, 0.18)',
                stroke: 'white',
                strokeWidth: 22,
            };
        }

        return { fill: fillColor, stroke: strokeColor, strokeWidth: 18 };
    };

    return (
        <div className="relative flex flex-col items-center w-full h-full">
            <div className="flex-grow w-full flex items-center justify-center">
                <svg
                    viewBox={SVG_VIEWBOX}
                    className="w-full min-w-[160px] max-w-[250px]"
                    onMouseLeave={() => setHoveredPart(null)}
                >
                    {BODY_PART_PATHS.map(({ part, d }) => (
                        <path
                            key={part}
                            d={d}
                            onClick={() => { onAssign(part); setHoveredPart(null); }}
                            className="transition-all duration-200 cursor-pointer"
                            style={getPartStyle(part)}
                            onMouseOver={() => setHoveredPart(part)}
                        />
                    ))}
                </svg>
            </div>
        </div>
    );
};
