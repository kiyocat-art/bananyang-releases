const STORAGE_KEY = 'openai-api-key';

export function getOpenAIKey(): string {
    return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setOpenAIKey(key: string): void {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
}

export function buildOpenAIHeaders(
    apiKey: string,
    base: Record<string, string> = {}
): Record<string, string> {
    return { ...base, Authorization: `Bearer ${apiKey}` };
}

export async function validateOpenAIKey(key: string): Promise<boolean> {
    try {
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok;
    } catch {
        return false;
    }
}

export function buildOpenAIBillingUrl(): string {
    return 'https://platform.openai.com/settings/organization/billing/overview';
}
