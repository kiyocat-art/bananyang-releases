import { Resolution } from '../types';

const BFL_API_BASE = 'https://api.bfl.ml/v1';
const BFL_API_KEY_STORAGE_KEY = 'bfl-api-key';

export const getBflApiKey = (): string | null => {
    return localStorage.getItem(BFL_API_KEY_STORAGE_KEY);
};

export const setBflApiKey = (key: string) => {
    localStorage.setItem(BFL_API_KEY_STORAGE_KEY, key);
};

export interface BflGenerationResult {
    id: string;
    status: 'Ready' | 'Pending' | 'Processing' | 'Failed';
    result?: {
        sample: string; // URL to the image
    };
    error?: string;
}

export const generateBflImage = async (
    prompt: string,
    model: string,
    width: number,
    height: number,
    apiKey: string
): Promise<string> => {
    // Map model names to BFL endpoints if necessary, or use directly if they match
    // BFL endpoints: flux-pro-1.1, flux-pro, flux-dev, flux-schnell
    const endpoint = `${BFL_API_BASE}/${model}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Key': apiKey,
        },
        body: JSON.stringify({
            prompt,
            width,
            height,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BFL API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.id;
};

export const getBflResult = async (requestId: string, apiKey: string): Promise<BflGenerationResult> => {
    const response = await fetch(`${BFL_API_BASE}/get_result?id=${requestId}`, {
        method: 'GET',
        headers: {
            'X-Key': apiKey,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BFL Result Error (${response.status}): ${errorText}`);
    }

    return await response.json();
};

export const pollBflResult = async (requestId: string, apiKey: string): Promise<string> => {
    const POLLING_INTERVAL = 1000; // 1 second
    const MAX_ATTEMPTS = 60; // 1 minute timeout

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
            const result = await getBflResult(requestId, apiKey);

            if (result.status === 'Ready' && result.result?.sample) {
                return result.result.sample;
            }

            if (result.status === 'Failed') {
                throw new Error(result.error || 'Generation failed');
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        } catch (error) {
            console.error('Polling error:', error);
            throw error;
        }
    }

    throw new Error('Generation timed out');
};
