export interface BlendOptions {
    featherRadius: number;
    contextPaddingRatio: number;
    toneMatch: boolean;
}

export interface PaddedRegion {
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
    imageW: number;
    imageH: number;
    paddedImageFile: File;
    paddedMaskFile: File;
    softAlpha: Float32Array;
}

export const DEFAULT_BLEND_OPTIONS: BlendOptions = {
    featherRadius: 2,
    contextPaddingRatio: 0.6,
    toneMatch: true,
};
