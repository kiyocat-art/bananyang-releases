import { t } from '../../../localization';
import { useSettingsStore } from '../../../store/settingsStore';

const STORAGE_KEY = 'flux-api-key';
const ORG_ID_STORAGE_KEY = 'flux-org-id';
const FLUX_CREDITS_URL = 'https://api.bfl.ai/v1/credits';
const BFL_DASHBOARD_BASE = 'https://dashboard.bfl.ai';

export function getFluxKey(): string {
    return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setFluxKey(key: string): void {
    localStorage.setItem(STORAGE_KEY, key);
}

export function getFluxOrgId(): string {
    return localStorage.getItem(ORG_ID_STORAGE_KEY) ?? '';
}

export function setFluxOrgId(orgId: string): void {
    localStorage.setItem(ORG_ID_STORAGE_KEY, orgId);
}

export function isValidFluxOrgId(orgId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId);
}

export function buildFluxRechargeUrl(orgId: string): string | null {
    const trimmed = orgId.trim();
    if (!trimmed) return null;
    return `${BFL_DASHBOARD_BASE}/${trimmed}/api/credits`;
}

export async function validateFluxKey(key: string): Promise<boolean> {
    try {
        const res = await fetch(FLUX_CREDITS_URL, {
            method: 'GET',
            headers: { 'x-key': key },
        });
        // 401/403 = invalid key, 200 = valid
        return res.ok;
    } catch {
        return false;
    }
}

export async function getFluxCredits(): Promise<number> {
    const key = getFluxKey();
    const lang = useSettingsStore.getState().language;
    if (!key) throw new Error(t('error.flux.apiKeyMissing', lang));
    const res = await fetch(FLUX_CREDITS_URL, {
        method: 'GET',
        headers: { 'x-key': key },
    });
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new Error(t('error.flux.apiKeyInvalid', lang));
        throw new Error(t('error.flux.creditQueryFailed', lang, { status: String(res.status) }));
    }
    const json = await res.json();
    return Number(json.credits ?? 0);
}
