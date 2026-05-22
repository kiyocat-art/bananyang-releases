/**
 * Separable Gaussian blur on Float32Array.
 * Truncated kernel: radius = ceil(3 * sigma) covers ~99.7% of weights.
 * Used to produce soft alpha mask edges for natural blending.
 */

function buildKernel(sigma: number): Float32Array {
    if (sigma <= 0) return new Float32Array([1]);
    const r = Math.max(1, Math.ceil(sigma * 3));
    const size = r * 2 + 1;
    const k = new Float32Array(size);
    const twoSigmaSq = 2 * sigma * sigma;
    let sum = 0;
    for (let i = -r; i <= r; i++) {
        const v = Math.exp(-(i * i) / twoSigmaSq);
        k[i + r] = v;
        sum += v;
    }
    for (let i = 0; i < size; i++) k[i] /= sum;
    return k;
}

export function gaussianBlur(alpha: Float32Array, w: number, h: number, sigma: number): Float32Array {
    if (sigma <= 0) return alpha;
    const kernel = buildKernel(sigma);
    const r = (kernel.length - 1) / 2;
    const tmp = new Float32Array(alpha.length);
    const out = new Float32Array(alpha.length);

    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            let s = 0;
            for (let k = -r; k <= r; k++) {
                const xi = Math.max(0, Math.min(w - 1, x + k));
                s += alpha[row + xi] * kernel[k + r];
            }
            tmp[row + x] = s;
        }
    }

    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let s = 0;
            for (let k = -r; k <= r; k++) {
                const yi = Math.max(0, Math.min(h - 1, y + k));
                s += tmp[yi * w + x] * kernel[k + r];
            }
            out[y * w + x] = s;
        }
    }

    return out;
}
