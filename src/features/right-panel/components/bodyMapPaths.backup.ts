import { BodyPart } from '../../../types';

/**
 * Interactive Body Map — SVG path data
 * ViewBox: "0 0 150 345" — front-view human silhouette
 * Coordinates traced from reference image (Justin Yu, LinkedIn article).
 *
 * Image bounding box: x[145–467], y[75–652] → 322×577px
 * Scale: x * 0.466, y * 0.598 (mapped to 150×345 viewBox)
 */

export interface BodyPartPath {
    part: BodyPart;
    d: string;
}

/** Non-interactive neck connector (silhouette base layer only) */
export const NECK_RECT = { x: 67, y: 43, width: 16, height: 12, rx: 3 };

/**
 * 14 selectable body part paths.
 * Mirror axis: center X = 75
 */
export const BODY_PART_PATHS: BodyPartPath[] = [
    {
        part: BodyPart.Hair,
        // Full head oval — outer hair silhouette
        d: 'M 75 1 C 62 1 61 11 61 22 C 61 35 67 43 75 43 C 83 43 89 35 89 22 C 89 11 88 1 75 1 Z',
    },
    {
        part: BodyPart.Face,
        // Inner face oval — slightly inset from hair outline
        d: 'M 75 11 C 66 11 65 18 65 26 C 65 36 69 41 75 41 C 81 41 85 36 85 26 C 85 18 84 11 75 11 Z',
    },
    {
        part: BodyPart.Body,
        // Torso — trapezoid narrowing from shoulder line to waist
        d: 'M 28 55 L 122 55 L 107 138 L 43 138 Z',
    },
    {
        part: BodyPart.LeftShoulder,
        // Left shoulder cap — rounded protrusion from torso left edge
        d: 'M 28 55 C 17 55 7 64 7 75 C 7 87 15 97 26 97 C 37 97 43 88 42 80 L 42 63 C 39 57 34 55 28 55 Z',
    },
    {
        part: BodyPart.RightShoulder,
        // Right shoulder cap — mirror of left
        d: 'M 122 55 C 133 55 143 64 143 75 C 143 87 135 97 124 97 C 113 97 108 88 108 80 L 108 63 C 111 57 116 55 122 55 Z',
    },
    {
        part: BodyPart.LeftArm,
        // Left arm — cylindrical, slightly tapered shoulder→wrist
        d: 'M 7 78 C 6 100 5 140 5 172 L 5 202 C 5 212 10 221 20 221 C 30 221 37 213 37 202 L 38 172 C 39 140 41 100 42 82 Z',
    },
    {
        part: BodyPart.RightArm,
        // Right arm — mirror of left
        d: 'M 143 78 C 144 100 145 140 145 172 L 145 202 C 145 212 140 221 130 221 C 120 221 113 213 113 202 L 112 172 C 111 140 109 100 108 82 Z',
    },
    {
        part: BodyPart.LeftHand,
        // Left hand — rounded base of arm
        d: 'M 4 202 C 2 213 3 228 13 234 C 22 238 38 230 39 218 L 37 202 Z',
    },
    {
        part: BodyPart.RightHand,
        // Right hand — mirror of left
        d: 'M 146 202 C 148 213 147 228 137 234 C 128 238 112 230 111 218 L 113 202 Z',
    },
    {
        part: BodyPart.Pelvis,
        // Pelvis/hip band — curves slightly wider than waist
        d: 'M 43 138 C 41 148 39 162 39 178 L 111 178 C 111 162 109 148 107 138 Z',
    },
    {
        part: BodyPart.LeftLeg,
        // Left leg — thigh tapering into calf
        d: 'M 39 178 L 74 178 C 73 208 72 238 70 258 C 68 282 67 302 66 323 L 42 323 C 42 302 42 282 43 258 C 43 238 42 208 39 178 Z',
    },
    {
        part: BodyPart.RightLeg,
        // Right leg — mirror of left
        d: 'M 111 178 L 76 178 C 77 208 78 238 80 258 C 82 282 83 302 84 323 L 108 323 C 108 302 108 282 107 258 C 107 238 107 208 111 178 Z',
    },
    {
        part: BodyPart.LeftFoot,
        // Left foot — extends slightly outward (left)
        d: 'M 40 323 C 35 325 30 331 30 337 L 30 343 L 66 343 L 66 338 C 66 332 65 327 65 323 Z',
    },
    {
        part: BodyPart.RightFoot,
        // Right foot — mirror of left
        d: 'M 110 323 C 115 325 120 331 120 337 L 120 343 L 84 343 L 84 338 C 85 332 85 327 85 323 Z',
    },
];

/**
 * Decorative joint markers — visual only, pointer-events: none.
 * Shoulder joints are circular; knee joints are oval (matching reference image).
 */
export const JOINT_MARKERS: { cx: number; cy: number; rx: number; ry: number }[] = [
    { cx: 20, cy: 72, rx: 8, ry: 8 },     // left shoulder
    { cx: 130, cy: 72, rx: 8, ry: 8 },    // right shoulder
    { cx: 56, cy: 258, rx: 13, ry: 10 },  // left knee (oval)
    { cx: 94, cy: 258, rx: 13, ry: 10 },  // right knee (oval)
];
