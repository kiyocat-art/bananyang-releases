import { AspectRatio, Resolution } from '../../types';
import { ProcessImageParams } from '../gemini/types';

export type ProviderId = 'gemini' | 'openai' | 'flux';

export interface ProviderCapabilities {
    supportsMask: boolean;
    supportsInpaint: boolean;
    maxRefImages: number;
    supportedAspectRatios: AspectRatio[];
    supportedResolutions: Resolution[];
    supportsAbort: boolean;
}

export interface ImageProvider {
    id: ProviderId;
    generate(params: ProcessImageParams, signal?: AbortSignal): Promise<string[]>;
    capabilities: ProviderCapabilities;
}
