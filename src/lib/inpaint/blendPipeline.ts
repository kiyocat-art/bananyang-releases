/**
 * Inpaint blend pipeline.
 *
 * preparePaddedRegion: bbox-detect the mask → expand by contextPaddingRatio →
 *   crop both image and mask → return cropped
 *   File pair (image + mask) + a soft (Gaussian-feathered) alpha for compositing.
 *
 * blendInpaintResult: place the AI result back into the cropped region of
 *   the original image, optionally tone-match (LAB Reinhard) the AI pixels
 *   to the surrounding original ring, then alpha-composite with softAlpha.
 *
 * Cost rationale: sending only the cropped region (instead of the full image)
 * to the AI reduces token cost and gives the model focused context. The soft
 * alpha + tone match handle the seam between AI output and original pixels.
 */

import { gaussianBlur } from './gaussian';
import { rgbaToLab, labToRgba, LabBuffers } from './colorSpace';
import { BlendOptions, PaddedRegion } from './types';

const EPS_L = 1.5;
const EPS_AB = 1.0;
const TONE_STRENGTH = 0.2;
const MIN_STD_RATIO = 0.7;
const MAX_STD_RATIO = 1.4;
const MEAN_CAP_L = 8;
const MEAN_CAP_AB = 4;

async function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image load failed'));
        img.src = src;
    });
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file);
    try {
        return await loadImageElement(url);
    } finally {
        URL.revokeObjectURL(url);
    }
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('failed to get 2d context');
    return { canvas, ctx };
}

function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('canvas toBlob failed'));
                return;
            }
            resolve(new File([blob], filename, { type: 'image/png' }));
        }, 'image/png');
    });
}

function detectBBox(maskData: ImageData): { x0: number; y0: number; x1: number; y1: number } | null {
    const { data, width: w, height: h } = maskData;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = (y * w + x) * 4;
            if (data[p] > 8) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    if (x1 < 0) return null;
    return { x0, y0, x1, y1 };
}

function alphaToImageData(alpha: Float32Array, w: number, h: number): ImageData {
    const img = new ImageData(w, h);
    for (let i = 0; i < w * h; i++) {
        const v = Math.round(Math.max(0, Math.min(1, alpha[i])) * 255);
        const p = i * 4;
        img.data[p] = v;
        img.data[p + 1] = v;
        img.data[p + 2] = v;
        img.data[p + 3] = 255;
    }
    return img;
}

export async function preparePaddedRegion(
    originalFile: File,
    maskFile: File,
    opts: BlendOptions
): Promise<PaddedRegion | null> {
    const [origImg, maskImg] = await Promise.all([fileToImage(originalFile), fileToImage(maskFile)]);

    const imageW = origImg.naturalWidth;
    const imageH = origImg.naturalHeight;

    const { canvas: maskCanvas, ctx: maskCtx } = makeCanvas(imageW, imageH);
    maskCtx.drawImage(maskImg, 0, 0, imageW, imageH);
    const maskData = maskCtx.getImageData(0, 0, imageW, imageH);

    const bbox = detectBBox(maskData);
    if (!bbox) return null;

    const bboxW = bbox.x1 - bbox.x0 + 1;
    const bboxH = bbox.y1 - bbox.y0 + 1;
    const padX = Math.round(bboxW * opts.contextPaddingRatio);
    const padY = Math.round(bboxH * opts.contextPaddingRatio);
    const cropX = Math.max(0, bbox.x0 - padX);
    const cropY = Math.max(0, bbox.y0 - padY);
    const cropW = Math.min(imageW, bbox.x1 + padX + 1) - cropX;
    const cropH = Math.min(imageH, bbox.y1 + padY + 1) - cropY;

    const { canvas: imgCrop, ctx: imgCtx } = makeCanvas(cropW, cropH);
    imgCtx.drawImage(origImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const alpha = new Float32Array(cropW * cropH);
    for (let y = 0; y < cropH; y++) {
        for (let x = 0; x < cropW; x++) {
            const srcP = ((cropY + y) * imageW + (cropX + x)) * 4;
            alpha[y * cropW + x] = maskData.data[srcP] / 255;
        }
    }

    const softAlpha = gaussianBlur(alpha, cropW, cropH, opts.featherRadius);

    const hardMaskImageData = alphaToImageData(alpha, cropW, cropH);
    const { canvas: hardMaskCanvas, ctx: hardMaskCtx } = makeCanvas(cropW, cropH);
    hardMaskCtx.putImageData(hardMaskImageData, 0, 0);

    const [paddedImageFile, paddedMaskFile] = await Promise.all([
        canvasToFile(imgCrop, 'padded.png'),
        canvasToFile(hardMaskCanvas, 'mask.png'),
    ]);

    return {
        cropX, cropY, cropW, cropH,
        imageW, imageH,
        paddedImageFile,
        paddedMaskFile,
        softAlpha,
    };
}

function computeStats(lab: LabBuffers, weight: Float32Array, predicate: (w: number) => boolean): { mean: [number, number, number]; std: [number, number, number]; count: number } {
    let sumL = 0, sumA = 0, sumB = 0, count = 0;
    for (let i = 0; i < weight.length; i++) {
        if (predicate(weight[i])) {
            sumL += lab.L[i];
            sumA += lab.a[i];
            sumB += lab.b[i];
            count++;
        }
    }
    if (count === 0) return { mean: [0, 0, 0], std: [1, 1, 1], count: 0 };
    const meanL = sumL / count;
    const meanA = sumA / count;
    const meanB = sumB / count;
    let varL = 0, varA = 0, varB = 0;
    for (let i = 0; i < weight.length; i++) {
        if (predicate(weight[i])) {
            varL += (lab.L[i] - meanL) ** 2;
            varA += (lab.a[i] - meanA) ** 2;
            varB += (lab.b[i] - meanB) ** 2;
        }
    }
    return {
        mean: [meanL, meanA, meanB],
        std: [
            Math.max(EPS_L, Math.sqrt(varL / count)),
            Math.max(EPS_AB, Math.sqrt(varA / count)),
            Math.max(EPS_AB, Math.sqrt(varB / count)),
        ],
        count,
    };
}

export async function blendInpaintResult(
    originalFile: File,
    aiResultDataUrl: string,
    region: PaddedRegion,
    opts: BlendOptions
): Promise<string> {
    const [origImg, aiImg] = await Promise.all([fileToImage(originalFile), loadImageElement(aiResultDataUrl)]);

    const { cropX, cropY, cropW, cropH, imageW, imageH, softAlpha } = region;

    const { canvas: origCanvas, ctx: origCtx } = makeCanvas(imageW, imageH);
    origCtx.drawImage(origImg, 0, 0, imageW, imageH);
    const origCropData = origCtx.getImageData(cropX, cropY, cropW, cropH);

    const { canvas: aiCanvas, ctx: aiCtx } = makeCanvas(cropW, cropH);
    aiCtx.drawImage(aiImg, 0, 0, cropW, cropH);
    const aiCropData = aiCtx.getImageData(0, 0, cropW, cropH);

    const n = cropW * cropH;
    let aiData: Uint8ClampedArray = aiCropData.data as unknown as Uint8ClampedArray;

    if (opts.toneMatch) {
        const origLab = rgbaToLab(origCropData.data as unknown as Uint8ClampedArray, n);
        const aiLab = rgbaToLab(aiData, n);

        const origStats = computeStats(origLab, softAlpha, (w) => w < 0.1);
        // Sample AI stats from transition zone (seam area) only — preserves core AI color intent
        const aiStats = computeStats(aiLab, softAlpha, (w) => w > 0.7 && w < 0.95);

        console.info('[inpaint blend]', {
            toneMatch: opts.toneMatch,
            origCount: origStats.count,
            aiCount: aiStats.count,
            origMean: origStats.mean,
            origStd: origStats.std,
            aiMean: aiStats.mean,
            aiStd: aiStats.std,
        });

        if (origStats.count > 200 && aiStats.count > 200) {
            const ratioL = Math.min(MAX_STD_RATIO, Math.max(MIN_STD_RATIO, origStats.std[0] / aiStats.std[0]));
            const ratioA = Math.min(MAX_STD_RATIO, Math.max(MIN_STD_RATIO, origStats.std[1] / aiStats.std[1]));
            const ratioB = Math.min(MAX_STD_RATIO, Math.max(MIN_STD_RATIO, origStats.std[2] / aiStats.std[2]));

            const adjusted: LabBuffers = {
                L: new Float32Array(n),
                a: new Float32Array(n),
                b: new Float32Array(n),
            };
            for (let i = 0; i < n; i++) {
                const reinhardL = (aiLab.L[i] - aiStats.mean[0]) * ratioL + origStats.mean[0];
                const reinhardA = (aiLab.a[i] - aiStats.mean[1]) * ratioA + origStats.mean[1];
                const reinhardB = (aiLab.b[i] - aiStats.mean[2]) * ratioB + origStats.mean[2];

                // Cap shift to prevent extreme color displacement, blend at TONE_STRENGTH
                const deltaL = Math.max(-MEAN_CAP_L, Math.min(MEAN_CAP_L, reinhardL - aiLab.L[i]));
                const deltaA = Math.max(-MEAN_CAP_AB, Math.min(MEAN_CAP_AB, reinhardA - aiLab.a[i]));
                const deltaB = Math.max(-MEAN_CAP_AB, Math.min(MEAN_CAP_AB, reinhardB - aiLab.b[i]));

                adjusted.L[i] = aiLab.L[i] + deltaL * TONE_STRENGTH;
                adjusted.a[i] = aiLab.a[i] + deltaA * TONE_STRENGTH;
                adjusted.b[i] = aiLab.b[i] + deltaB * TONE_STRENGTH;
            }
            aiData = labToRgba(adjusted, aiData, n);
        }
    }

    const composited = origCtx.createImageData(cropW, cropH);
    for (let i = 0; i < n; i++) {
        const a = Math.max(0, Math.min(1, softAlpha[i]));
        const p = i * 4;
        composited.data[p]     = Math.round(aiData[p]     * a + origCropData.data[p]     * (1 - a));
        composited.data[p + 1] = Math.round(aiData[p + 1] * a + origCropData.data[p + 1] * (1 - a));
        composited.data[p + 2] = Math.round(aiData[p + 2] * a + origCropData.data[p + 2] * (1 - a));
        composited.data[p + 3] = origCropData.data[p + 3];
    }

    origCtx.putImageData(composited, cropX, cropY);
    return origCanvas.toDataURL('image/png');
}
