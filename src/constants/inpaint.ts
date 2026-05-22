export const DEFAULT_INPAINT_BRUSH_SIZE = 30;
export const DEFAULT_MASK_FEATHER_RADIUS = 2;
export const DEFAULT_INPAINT_CONTEXT_PADDING = 0.6;
export const DEFAULT_INPAINT_TONE_MATCH = true;
export const DEFAULT_INPAINT_VARIATION_STRENGTH = 0.5;
export const DEFAULT_INPAINT_MODE: 'insert' | 'remove' = 'insert';

export interface InpaintOverrides {
    mode: boolean;
    workType: boolean;
    brushSize: boolean;
    maskFeatherRadius: boolean;
    contextPadding: boolean;
    toneMatch: boolean;
    preset: boolean;
    variationStrength: boolean;
}

export const DEFAULT_INPAINT_OVERRIDES: InpaintOverrides = {
    mode: false,
    workType: false,
    brushSize: false,
    maskFeatherRadius: false,
    contextPadding: false,
    toneMatch: false,
    preset: false,
    variationStrength: false,
};

export type InpaintOverrideKey = keyof InpaintOverrides;
