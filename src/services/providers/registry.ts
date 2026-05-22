import { ImageProvider, ProviderId, ProviderCapabilities } from './types';
import { openAIProvider } from './openai/service';
import { fluxProvider } from './flux/service';
import { getOpenAIKey } from './openai/api';
import { getFluxKey } from './flux/api';

const PROVIDER_MAP: Map<ProviderId, ImageProvider> = new Map([
    ['openai', openAIProvider],
    ['flux', fluxProvider],
]);

export function resolveProvider(modelId: string): ImageProvider | null {
    if (modelId.startsWith('openai/')) return PROVIDER_MAP.get('openai') ?? null;
    if (modelId.startsWith('flux/')) return PROVIDER_MAP.get('flux') ?? null;
    return null; // gemini or unknown → caller handles
}

export function getCapabilities(modelId: string): ProviderCapabilities | null {
    const provider = resolveProvider(modelId);
    return provider?.capabilities ?? null;
}

export function isExternalModel(modelId: string): boolean {
    return modelId.startsWith('openai/') || modelId.startsWith('flux/');
}

export function hasExternalAuth(modelId: string): boolean {
    if (modelId.startsWith('openai/')) return !!getOpenAIKey();
    if (modelId.startsWith('flux/')) return !!getFluxKey();
    return false;
}

export function supportsInpaint(modelId: string): boolean {
    const provider = resolveProvider(modelId);
    if (provider) return provider.capabilities.supportsInpaint;
    return true;
}
