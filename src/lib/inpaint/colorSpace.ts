/**
 * sRGB ↔ CIE L*a*b* color space conversion.
 * D65 illuminant. IEC 61966-2-1 gamma.
 * Used by inpaint blend pipeline for tone matching (LAB Reinhard transfer).
 */

const REF_X = 0.95047;
const REF_Y = 1.0;
const REF_Z = 1.08883;

function srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function xyzToLabF(t: number): number {
    const d = 6 / 29;
    return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

function labFToXyz(f: number): number {
    const d = 6 / 29;
    return f > d ? f * f * f : 3 * d * d * (f - 4 / 29);
}

export interface LabBuffers {
    L: Float32Array;
    a: Float32Array;
    b: Float32Array;
}

export function rgbaToLab(rgba: Uint8ClampedArray, n: number): LabBuffers {
    const L = new Float32Array(n);
    const a = new Float32Array(n);
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const p = i * 4;
        const r = srgbToLinear(rgba[p] / 255);
        const g = srgbToLinear(rgba[p + 1] / 255);
        const bl = srgbToLinear(rgba[p + 2] / 255);
        const x = (r * 0.4124564 + g * 0.3575761 + bl * 0.1804375) / REF_X;
        const y = (r * 0.2126729 + g * 0.7151522 + bl * 0.0721750) / REF_Y;
        const z = (r * 0.0193339 + g * 0.1191920 + bl * 0.9503041) / REF_Z;
        const fx = xyzToLabF(x);
        const fy = xyzToLabF(y);
        const fz = xyzToLabF(z);
        L[i] = 116 * fy - 16;
        a[i] = 500 * (fx - fy);
        b[i] = 200 * (fy - fz);
    }
    return { L, a, b };
}

export function labToRgba(lab: LabBuffers, alphaSource: Uint8ClampedArray, n: number): Uint8ClampedArray {
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
        const fy = (lab.L[i] + 16) / 116;
        const fx = lab.a[i] / 500 + fy;
        const fz = fy - lab.b[i] / 200;
        const x = labFToXyz(fx) * REF_X;
        const y = labFToXyz(fy) * REF_Y;
        const z = labFToXyz(fz) * REF_Z;
        const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
        const g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
        const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
        const p = i * 4;
        out[p] = Math.round(Math.max(0, Math.min(1, linearToSrgb(r))) * 255);
        out[p + 1] = Math.round(Math.max(0, Math.min(1, linearToSrgb(g))) * 255);
        out[p + 2] = Math.round(Math.max(0, Math.min(1, linearToSrgb(bl))) * 255);
        out[p + 3] = alphaSource[p + 3];
    }
    return out;
}
