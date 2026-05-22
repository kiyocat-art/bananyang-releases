import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { BodyPart, BoardImage } from '../../../types';
import { t, Language, TranslationKey } from '../../../localization';
import { useCanvasStore } from '../../../store/canvasStore';
import { REF_COLORS, ROLE_COLORS } from '../../../constants';

export const BodyPartSelector: React.FC<{
    bodyPartReferenceMap: Partial<Record<BodyPart, number>>;
    onAssign: (part: BodyPart) => void;
    language: Language;
    boardImages: BoardImage[];
}> = ({ bodyPartReferenceMap, onAssign, language, boardImages }) => {
    const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const activeReferenceIndex = useCanvasStore(state => state.activeReferenceIndex);

    const getPartStyle = (part: BodyPart) => {
        const refIndex = bodyPartReferenceMap[part];
        const isSelectedForActiveRef = activeReferenceIndex !== null && refIndex === activeReferenceIndex;

        let fillColor = 'rgba(113, 113, 122, 0.4)'; // neutral-500/40
        let strokeColor = 'rgb(82, 82, 91)'; // neutral-600

        if (refIndex !== undefined) {
            // Find the image associated with this refIndex
            const refImage = boardImages.find(img => img.refIndex === refIndex && (img.role === 'reference' || img.role === 'costumeRef' || img.role === 'poseRef' || img.role === 'generalRef'));

            if (refImage && (refImage.role === 'costumeRef' || (refImage.role === 'reference' && refImage.referenceType === 'costume'))) {
                // Use Costume Reference Color
                fillColor = ROLE_COLORS.costumeRef + 'BF';
                strokeColor = ROLE_COLORS.costumeRef;
            } else {
                // Use default cycling colors for other references
                fillColor = REF_COLORS[refIndex % REF_COLORS.length] + 'BF'; // Add alpha
                strokeColor = REF_COLORS[refIndex % REF_COLORS.length];
            }
        }

        return { fill: fillColor, stroke: strokeColor, strokeWidth: isSelectedForActiveRef ? 3 : 2 };
    };

    const handleMouseOver = (e: React.MouseEvent<SVGElement>, part: BodyPart) => {
        const tip = t(`tooltip.bodyPart.${part}` as TranslationKey, language);
        if (tip) {
            // Get bounding rect of the hovered SVG element for positioning above it
            const target = e.currentTarget as SVGElement;
            const targetRect = target.getBoundingClientRect();
            // Position tooltip at top-center of the element (fixed viewport coordinates)
            const x = targetRect.left + targetRect.width / 2;
            const y = targetRect.top - 10;
            setTooltip({ text: tip, x, y });
        }
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

    const partsData = [
        { part: BodyPart.Hair, shape: 'path' as const, key: 'hair', props: { d: "M 55 15 C 40 10, 40 50, 55 55 L 75 55 L 95 55 C 110 50, 110 10, 95 15 Z" } },
        { part: BodyPart.Face, shape: 'rect' as const, key: 'face', props: { x: 60, y: 25, width: 30, height: 25, rx: 5 } },
        { part: BodyPart.Body, shape: 'path' as const, key: 'body', props: { d: "M 45 65 C 45 55, 105 55, 105 65 L 95 150 H 55 Z" } },
        { part: BodyPart.Pelvis, shape: 'rect' as const, key: 'pelvis', props: { x: 50, y: 155, width: 50, height: 25, rx: 5 } },
        { part: BodyPart.LeftShoulder, shape: 'circle' as const, key: 'l-shoulder', props: { cx: 35, cy: 75, r: 12 } },
        { part: BodyPart.LeftArm, shape: 'rect' as const, key: 'l-arm', props: { x: 27, y: 90, width: 16, height: 70, rx: 8 } },
        { part: BodyPart.LeftHand, shape: 'rect' as const, key: 'l-hand', props: { x: 22, y: 165, width: 26, height: 20, rx: 10 } },
        { part: BodyPart.RightShoulder, shape: 'circle' as const, key: 'r-shoulder', props: { cx: 115, cy: 75, r: 12 } },
        { part: BodyPart.RightArm, shape: 'rect' as const, key: 'r-arm', props: { x: 107, y: 90, width: 16, height: 70, rx: 8 } },
        { part: BodyPart.RightHand, shape: 'rect' as const, key: 'r-hand', props: { x: 102, y: 165, width: 26, height: 20, rx: 10 } },
        { part: BodyPart.LeftLeg, shape: 'rect' as const, key: 'l-leg', props: { x: 50, y: 185, width: 20, height: 100, rx: 10 } },
        { part: BodyPart.LeftFoot, shape: 'path' as const, key: 'l-foot', props: { d: "M45 290 H 70 L 75 305 H 40 Z" } },
        { part: BodyPart.RightLeg, shape: 'rect' as const, key: 'r-leg', props: { x: 80, y: 185, width: 20, height: 100, rx: 10 } },
        { part: BodyPart.RightFoot, shape: 'path' as const, key: 'r-foot', props: { d: "M75 290 H 100 L 105 305 H 70 Z" } },
    ];

    return (
        <div className="relative flex flex-col items-center w-full h-full">
            {/* Portal tooltip to document body for visibility beyond panel */}
            {tooltip && ReactDOM.createPortal(
                <div
                    className="fixed w-max max-w-xs bg-neutral-900 text-zinc-200 text-sm rounded-md py-2 px-4 pointer-events-none z-[9999] shadow-lg whitespace-pre-wrap border border-neutral-700"
                    style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%) translateY(-100%)' }}
                >
                    {tooltip.text}
                </div>,
                document.getElementById('tooltip-root') || document.body
            )}
            <div className="flex-grow w-full flex items-center justify-center">
                <svg ref={svgRef} viewBox="0 0 150 345" className="w-32 lg:w-36" onMouseLeave={handleMouseLeave}>
                    <g className="hover:[&>*]:stroke-white hover:[&>*]:fill-white/20">
                        {partsData.map(data => {
                            const ShapeComponent = data.shape;
                            return (
                                <ShapeComponent
                                    key={data.key}
                                    {...data.props}
                                    onClick={() => onAssign(data.part)}
                                    className={"transition-all duration-200 cursor-pointer"}
                                    style={getPartStyle(data.part)}
                                    onMouseOver={(e: React.MouseEvent<SVGElement>) => handleMouseOver(e, data.part)}
                                />
                            );
                        })}
                    </g>
                </svg>
            </div>
        </div>
    );
};
