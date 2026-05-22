/**
 * updateChannel.ts — OTA 업데이트 감지 채널
 *
 * Firestore REST API로 `app_releases/latest` 문서를 앱 시작 시 1회만 확인.
 * 폴링(interval/focus) 없음 — version 변경 감지 시 등록된 리스너 호출.
 *
 * Firestore SDK 미사용 — 프로젝트 정책. REST fields 포맷 디코더 포함.
 */

export type Severity = 'optional' | 'recommended' | 'critical';

export interface ReleaseDoc {
    version: string;
    channel?: string;
    severity: Severity;
    releaseNotes?: { ko?: string; en?: string; ja?: string };
    minSupportedVersion?: string;
    win?: { url?: string; yamlUrl?: string; sha512?: string; size?: number } | null;
    mac?: { url?: string; yamlUrl?: string; sha512?: string; size?: number } | null;
    releasedAt?: string;
}

type Listener = (doc: ReleaseDoc) => void;

const FIRESTORE_HOST = 'https://firestore.googleapis.com/v1';

let lastVersion: string | null = null;
const listeners = new Set<Listener>();

function getProjectId(): string {
    return (
        (window as any).__FIREBASE_PROJECT_ID__ ??
        process.env.FIREBASE_PROJECT_ID ??
        ''
    );
}

/**
 * Firestore REST의 fields 포맷({stringValue, mapValue, ...})을 평범한 JS 값으로 변환.
 * export하여 단위 테스트에서 검증 가능.
 */
export function decodeFirestoreFields(fields: any): any {
    if (!fields || typeof fields !== 'object') return null;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries<any>(fields)) {
        out[k] = decodeFirestoreValue(v);
    }
    return out;
}

function decodeFirestoreValue(v: any): any {
    if (v == null || typeof v !== 'object') return null;
    if ('nullValue' in v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('mapValue' in v) return decodeFirestoreFields(v.mapValue?.fields);
    if ('arrayValue' in v) {
        const values = v.arrayValue?.values ?? [];
        return values.map(decodeFirestoreValue);
    }
    return null;
}

async function fetchLatest(): Promise<ReleaseDoc | null> {
    const projectId = getProjectId();
    if (!projectId) return null;

    const url = `${FIRESTORE_HOST}/projects/${projectId}/databases/(default)/documents/app_releases/latest`;

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const json = await res.json();
        const decoded = decodeFirestoreFields(json.fields);
        if (!decoded || typeof decoded.version !== 'string') return null;
        return decoded as ReleaseDoc;
    } catch (e) {
        console.warn('[updateChannel] fetch failed:', e);
        return null;
    }
}

async function poll(): Promise<void> {
    const doc = await fetchLatest();
    if (!doc) return;
    if (doc.version !== lastVersion) {
        lastVersion = doc.version;
        listeners.forEach((fn) => {
            try {
                fn(doc);
            } catch (e) {
                console.error('[updateChannel] listener error:', e);
            }
        });
    }
}

/**
 * 채널 구독 시작. 첫 가입자 등록 시 1회만 fetch — 이후 interval/focus 폴링 없음.
 * 모든 리스너 해제 시 lastVersion 초기화.
 */
export function startUpdateChannel(listener: Listener): () => void {
    listeners.add(listener);

    if (listeners.size === 1) {
        void poll();
    }

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            lastVersion = null;
        }
    };
}
