/**
 * remoteConfig.ts — Firebase Remote Config (REST API)
 *
 * Firebase SDK 없이 Remote Config REST API를 호출합니다.
 * 12시간 캐시를 safeStorage에 저장합니다.
 */

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────
export interface RemoteConfigValues {
    /** 점검 모드 */
    maintenance_mode: boolean;
    /** 점검 메시지 */
    maintenance_message: string;
    /** 최소 지원 버전 */
    min_version: string;
    /** 기능 플래그 */
    feature_flags: Record<string, boolean>;
}

const DEFAULTS: RemoteConfigValues = {
    maintenance_mode: false,
    maintenance_message: '',
    min_version: '1.0.0',
    feature_flags: {},
};

const CACHE_KEY = 'bn_remote_config';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12시간

// ──────────────────────────────────────────────────────────────
// 내부 상태
// ──────────────────────────────────────────────────────────────
let cachedConfig: RemoteConfigValues = { ...DEFAULTS };
let lastFetchTime = 0;

// ──────────────────────────────────────────────────────────────
// 설정 가져오기
// ──────────────────────────────────────────────────────────────
function getConfig(): { apiKey: string; projectId: string } {
    const apiKey = (typeof process !== 'undefined' && process.env?.FIREBASE_API_KEY) ?? '';
    const projectId = (typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID) ?? '';
    return { apiKey, projectId };
}

/**
 * Remote Config 값 가져오기 (캐시 우선)
 */
export async function fetchRemoteConfig(): Promise<RemoteConfigValues> {
    // 캐시 유효?
    if (Date.now() - lastFetchTime < CACHE_TTL_MS && lastFetchTime > 0) {
        return cachedConfig;
    }

    // safeStorage에서 캐시 복원
    try {
        const stored = await window.electronAPI?.safeStorageGet?.(CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
                cachedConfig = { ...DEFAULTS, ...parsed.values };
                lastFetchTime = parsed.timestamp;
                return cachedConfig;
            }
        }
    } catch {
        /* ignore */
    }

    // REST API 호출
    const { apiKey, projectId } = getConfig();
    if (!apiKey || !projectId) {
        console.warn('[RemoteConfig] Missing Firebase config, using defaults');
        return DEFAULTS;
    }

    try {
        const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/remoteConfig:fetch`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify({
                appId: 'com.kiyocat.bananyang',
                appInstanceId: 'electron',
            }),
        });

        if (res.ok) {
            const data = await res.json();
            const entries = data.entries ?? {};

            cachedConfig = {
                maintenance_mode: entries.maintenance_mode === 'true',
                maintenance_message: entries.maintenance_message ?? '',
                min_version: entries.min_version ?? '1.0.0',
                feature_flags: tryParseJSON(entries.feature_flags, {}),
            };
            lastFetchTime = Date.now();

            // safeStorage에 캐시 저장
            await window.electronAPI?.safeStorageSet?.(
                CACHE_KEY,
                JSON.stringify({ values: cachedConfig, timestamp: lastFetchTime }),
            );
        }
    } catch (e) {
        console.warn('[RemoteConfig] Fetch failed, using cached/defaults:', e);
    }

    return cachedConfig;
}

/**
 * 현재 캐시된 설정 반환 (비동기 x)
 */
export function getRemoteConfig(): RemoteConfigValues {
    return cachedConfig;
}

/**
 * 특정 기능 플래그 확인
 */
export function isFeatureEnabled(flag: string): boolean {
    return cachedConfig.feature_flags[flag] ?? false;
}

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────
function tryParseJSON<T>(str: string | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}
