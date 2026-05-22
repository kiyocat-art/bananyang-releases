import React from 'react';
import { ImageSizeType } from '../EditorImageViewer';

interface InpaintMaskOverlayProps {
    imageSize: ImageSizeType;
    zoom: number;
    isNavigateMode: boolean;
    isZKeyDown?: boolean;
    maskSrc?: string | null;
    livePoints: { x: number; y: number }[];
    cursorPos?: { x: number; y: number } | null;
    brushSize: number;
    overlayRef: React.RefObject<HTMLDivElement>;
    isEraserMode?: boolean;
    isDrawingEraser?: boolean;
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => void;
}

// Mask overlay color: red tint for better visibility on most images
const MASK_COLOR = 'rgba(255, 50, 50, 0.45)';
const STROKE_COLOR = 'rgba(255, 60, 60, 0.7)';
const ERASER_STROKE_COLOR = 'rgba(100, 160, 255, 0.7)';
const CURSOR_FILL = 'rgba(255, 50, 50, 0.15)';
const CURSOR_STROKE = 'rgba(255, 50, 50, 0.9)';
const ERASER_CURSOR_FILL = 'rgba(100, 160, 255, 0.12)';
const ERASER_CURSOR_STROKE = 'rgba(100, 160, 255, 0.9)';

export const InpaintMaskOverlay: React.FC<InpaintMaskOverlayProps> = ({
    imageSize,
    zoom,
    isNavigateMode,
    isZKeyDown = false,
    maskSrc,
    livePoints,
    cursorPos,
    brushSize,
    overlayRef,
    isEraserMode = false,
    isDrawingEraser = false,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
}) => {
    const { width: dW, height: dH } = imageSize;
    // SVG brush dimensions in display-space (inverse of zoom so physical size stays constant)
    const svgStrokeWidth = brushSize / zoom;
    const cursorRadius = brushSize / 2 / zoom;

    // Use eraser color if in eraser mode or actively drawing an eraser stroke
    const activeEraser = isEraserMode || isDrawingEraser;
    const strokeColor = isDrawingEraser ? ERASER_STROKE_COLOR : STROKE_COLOR;

    const livePolyline = livePoints.length > 1
        ? livePoints.map(p => `${p.x},${p.y}`).join(' ')
        : null;
    const liveCircle = livePoints.length === 1 ? livePoints[0] : null;

    return (
        <div
            ref={overlayRef}
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: (isNavigateMode || isZKeyDown) ? 'none' : 'auto',
                cursor: (isNavigateMode || isZKeyDown) ? undefined : 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
        >
            {/* Existing committed mask — red tint via CSS mask */}
            {maskSrc && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: MASK_COLOR,
                        WebkitMaskImage: `url(${maskSrc})`,
                        maskImage: `url(${maskSrc})`,
                        WebkitMaskMode: 'luminance',
                        maskMode: 'luminance',
                        WebkitMaskSize: '100% 100%',
                        maskSize: '100% 100%',
                        pointerEvents: 'none',
                    } as React.CSSProperties}
                />
            )}

            {/* Live stroke SVG (display-space coordinates) */}
            <svg
                style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
                viewBox={`0 0 ${dW} ${dH}`}
                width={dW}
                height={dH}
            >
                {/* Soft brush cursor gradient definition */}
                <defs>
                    <radialGradient id="brush-cursor-gradient">
                        <stop offset="0%" stopColor={activeEraser ? ERASER_CURSOR_FILL : CURSOR_FILL} />
                        <stop offset="70%" stopColor={activeEraser ? ERASER_CURSOR_FILL : CURSOR_FILL} />
                        <stop offset="100%" stopColor="transparent" />
                    </radialGradient>
                </defs>

                {/* Live stroke polyline */}
                {livePolyline && (
                    <polyline
                        points={livePolyline}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={svgStrokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {/* Single-point stroke as circle */}
                {liveCircle && (
                    <circle
                        cx={liveCircle.x}
                        cy={liveCircle.y}
                        r={svgStrokeWidth / 2}
                        fill={strokeColor}
                    />
                )}

                {/* Brush cursor circle — soft gradient fill */}
                {cursorPos && !isNavigateMode && !isZKeyDown && (
                    <>
                        <circle
                            cx={cursorPos.x}
                            cy={cursorPos.y}
                            r={cursorRadius}
                            fill="url(#brush-cursor-gradient)"
                            stroke={activeEraser ? ERASER_CURSOR_STROKE : CURSOR_STROKE}
                            strokeWidth={1 / zoom}
                        />
                        {/* Eraser mode: crosshair indicator inside cursor */}
                        {activeEraser && (
                            <>
                                <line
                                    x1={cursorPos.x - cursorRadius * 0.35}
                                    y1={cursorPos.y}
                                    x2={cursorPos.x + cursorRadius * 0.35}
                                    y2={cursorPos.y}
                                    stroke={ERASER_CURSOR_STROKE}
                                    strokeWidth={1.2 / zoom}
                                />
                                <line
                                    x1={cursorPos.x}
                                    y1={cursorPos.y - cursorRadius * 0.35}
                                    x2={cursorPos.x}
                                    y2={cursorPos.y + cursorRadius * 0.35}
                                    stroke={ERASER_CURSOR_STROKE}
                                    strokeWidth={1.2 / zoom}
                                />
                            </>
                        )}
                    </>
                )}
            </svg>
        </div>
    );
};
