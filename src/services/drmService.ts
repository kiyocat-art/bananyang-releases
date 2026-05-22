/**
 * drmService.ts
 * BanaNyang 7일 주기 DRM 인증 서비스
 *
 * 흐름:
 * 1) 앱 실행 → silentAuthenticate() 호출
 * 2) safeStorage에 refreshToken + 마지막 검증 날짜 저장
 * 3) 온라인: Firebase REST API로 구매 상태 검증 + 갱신
 * 4) 오프라인: 7일 이내면 Grace Period 허용, 초과 시 잠금
 */

import {
    signInWithEmailPassword,
    signInWithGoogleToken,
    refreshIdToken,
    getFirestoreUser,
    updateLastVerified,
    FirebaseError,
    FirebaseAuthResult,
} from './firebaseRestClient';

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────
export const GRACE_PERIOD_DAYS = 7;

const KEY_REFRESH_TOKEN = 'bn_refresh_token';
const KEY_ID_TOKEN = 'bn_id_token';
const KEY_UID = 'bn_uid';
const KEY_EMAIL = 'bn_email';
const KEY_LAST_VERIFIED = 'bn_last_verified';

// ──────────────────────────────────────────────────────────────
// 결과 타입
// ──────────────────────────────────────────────────────────────
export type DRMStatus =
    | { status: 'ok'; uid: string; email: string }
    | { status: 'not_purchased'; email: string }
    | { status: 'offline_grace'; daysLeft: number; uid: string; email: string }
    | { status: 'grace_expired' }
    | { status: 'needs_login' }
    | { status: 'error'; message: string };

// ──────────────────────────────────────────────────────────────
// safeStorage helper (preload.js에서 contextBridge로 노출)
// ──────────────────────────────────────────────────────────────
const safe = {
    set: (key: string, value: string) => window.electronAPI.safeStorageSet(key, value),
    get: (key: string) => window.electronAPI.safeStorageGet(key),
    delete: (key: string) => window.electronAPI.safeStorageDelete(key),
};

// ──────────────────────────────────────────────────────────────
// 내부: 구매 검증 + 로컬 저장
// ──────────────────────────────────────────────────────────────
async function verifyAndStore(auth: FirebaseAuthResult): Promise<DRMStatus> {
    // Firestore에서 구매 상태 확인
    const userDoc = await getFirestoreUser(auth.localId, auth.idToken);

    if (!userDoc || !userDoc.hasPurchased) {
        return { status: 'not_purchased', email: auth.email };
    }

    // 인증 정보 safeStorage에 저장
    const now = Date.now().toString();
    await safe.set(KEY_REFRESH_TOKEN, auth.refreshToken);
    await safe.set(KEY_ID_TOKEN, auth.idToken);
    await safe.set(KEY_UID, auth.localId);
    await safe.set(KEY_EMAIL, auth.email);
    await safe.set(KEY_LAST_VERIFIED, now);

    // Firestore lastVerifiedAt 서버 기록 (시계 조작 방지)
    try {
        await updateLastVerified(auth.localId, auth.idToken);
    } catch {
        // non-critical: 로컬 인증은 성공으로 처리
    }

    return { status: 'ok', uid: auth.localId, email: auth.email };
}

// ──────────────────────────────────────────────────────────────
// 이메일/패스워드 로그인
// ──────────────────────────────────────────────────────────────
export async function loginWithEmail(
    email: string,
    password: string
): Promise<DRMStatus> {
    try {
        const auth = await signInWithEmailPassword(email, password);
        return verifyAndStore(auth);
    } catch (err) {
        if (err instanceof FirebaseError) {
            return { status: 'error', message: err.message };
        }
        return { status: 'error', message: 'Login failed. Please check your connection.' };
    }
}

// ──────────────────────────────────────────────────────────────
// Google 로그인 (Electron OAuth → Google access_token → Firebase)
// ──────────────────────────────────────────────────────────────
export async function loginWithGoogle(): Promise<DRMStatus> {
    try {
        // 1) 기존 Electron OAuth 서버 시작 (main.js의 startAuthServer 재활용)
        const result = await window.electronAPI.startGoogleOAuth?.() ??
            await startGoogleOAuthForFirebase();

        if (!result.success || !result.accessToken) {
            return { status: 'error', message: result.error ?? 'Google sign-in was cancelled.' };
        }

        // 2) Google access_token → Firebase ID token
        const auth = await signInWithGoogleToken(result.accessToken);
        return verifyAndStore(auth);
    } catch (err) {
        if (err instanceof FirebaseError) return { status: 'error', message: err.message };
        return { status: 'error', message: 'Google sign-in failed. Please try again.' };
    }
}

// Google OAuth (Firebase DRM 전용) — PKCE 방식, client_secret 불필요
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_REDIRECT_URI = 'http://localhost:3000/callback';
const OAUTH_CLIENT_ID: string =
    (window as any).__GOOGLE_OAUTH_CLIENT_ID__ ??
    (typeof process !== 'undefined' ? (process.env as any).GOOGLE_OAUTH_CLIENT_ID : '') ??
    '';
const OAUTH_CLIENT_SECRET: string =
    (typeof process !== 'undefined' ? (process.env as any).GOOGLE_OAUTH_CLIENT_SECRET : '') ??
    '';

function generateVerifier(): string {
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...Array.from(arr)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function startGoogleOAuthForFirebase(): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    try {
        if (!OAUTH_CLIENT_ID) {
            return { success: false, error: 'Google OAuth Client ID가 설정되지 않았습니다. .env.local에 GOOGLE_OAUTH_CLIENT_ID를 추가하세요.' };
        }
        if (!OAUTH_CLIENT_SECRET) {
            return { success: false, error: 'Google OAuth Client Secret이 설정되지 않았습니다. .env.local에 GOOGLE_OAUTH_CLIENT_SECRET을 추가하세요.' };
        }

        const verifier = generateVerifier();
        const challenge = await generateChallenge(verifier);

        const authUrl = new URL(GOOGLE_AUTH_URL);
        authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'email profile');
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'online');
        authUrl.searchParams.set('prompt', 'select_account');

        // 1) 콜백 서버 시작 (포트 3000)
        const authPromise = window.electronAPI.startAuthServer();

        // 2) 브라우저에서 Google 로그인 페이지 열기 (서버 바인딩 대기 후)
        setTimeout(() => {
            window.electronAPI.openExternal(authUrl.toString());
        }, 600);

        // 3) 콜백 코드 수신 대기
        const result = await authPromise;
        if (!result.success || !result.code) {
            return { success: false, error: result.error ?? 'OAuth 취소됨' };
        }

        // 4) Authorization Code → Access Token 교환
        const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: OAUTH_CLIENT_ID,
                client_secret: OAUTH_CLIENT_SECRET,
                code: result.code,
                code_verifier: verifier,
                grant_type: 'authorization_code',
                redirect_uri: OAUTH_REDIRECT_URI,
            }),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.json().catch(() => ({}));
            return { success: false, error: (err as any).error_description ?? 'Token 교환 실패' };
        }

        const tokenData = await tokenRes.json();
        return { success: true, accessToken: tokenData.access_token };
    } catch (e) {
        return { success: false, error: `OAuth 오류: ${String(e)}` };
    }
}

// ──────────────────────────────────────────────────────────────
// 앱 실행 시 조용한 인증 (Silent Authentication)
// ──────────────────────────────────────────────────────────────
export async function silentAuthenticate(): Promise<DRMStatus> {
    // 1) 로컬 인증 정보 조회
    const [refreshToken, lastVerifiedStr, uid, email] = await Promise.all([
        safe.get(KEY_REFRESH_TOKEN),
        safe.get(KEY_LAST_VERIFIED),
        safe.get(KEY_UID),
        safe.get(KEY_EMAIL),
    ]);

    if (!refreshToken || !lastVerifiedStr || !uid) {
        return { status: 'needs_login' };
    }

    const lastVerified = parseInt(lastVerifiedStr, 10);
    const elapsedMs = Date.now() - lastVerified;
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

    // 2) 온라인 갱신 시도
    try {
        const refreshResult = await refreshIdToken(refreshToken);
        const newIdToken = refreshResult.id_token;
        const newRefresh = refreshResult.refresh_token;
        const currentUid = refreshResult.user_id;

        // Firestore 구매 상태 재확인
        const userDoc = await getFirestoreUser(currentUid, newIdToken);

        if (!userDoc || !userDoc.hasPurchased) {
            await clearLocalCredentials();
            return { status: 'not_purchased', email: email ?? '' };
        }

        // 토큰 + 날짜 갱신
        const now = Date.now().toString();
        await safe.set(KEY_REFRESH_TOKEN, newRefresh);
        await safe.set(KEY_ID_TOKEN, newIdToken);
        await safe.set(KEY_LAST_VERIFIED, now);

        // 서버에도 갱신 (non-critical)
        updateLastVerified(currentUid, newIdToken).catch(() => { });

        return { status: 'ok', uid: currentUid, email: email ?? userDoc.email };

    } catch (networkErr) {
        // 3) 네트워크 오류 → Grace Period 적용
        return applyGracePeriod(elapsedDays, uid, email ?? '');
    }
}

// ──────────────────────────────────────────────────────────────
// Grace Period 판별
// ──────────────────────────────────────────────────────────────
function applyGracePeriod(elapsedDays: number, uid: string, email: string): DRMStatus {
    if (elapsedDays <= GRACE_PERIOD_DAYS) {
        const daysLeft = Math.ceil(GRACE_PERIOD_DAYS - elapsedDays);
        return { status: 'offline_grace', daysLeft, uid, email };
    }
    return { status: 'grace_expired' };
}

// ──────────────────────────────────────────────────────────────
// 로컬 인증 정보 전체 삭제 (로그아웃)
// ──────────────────────────────────────────────────────────────
export async function clearLocalCredentials(): Promise<void> {
    await Promise.all([
        safe.delete(KEY_REFRESH_TOKEN),
        safe.delete(KEY_ID_TOKEN),
        safe.delete(KEY_UID),
        safe.delete(KEY_EMAIL),
        safe.delete(KEY_LAST_VERIFIED),
    ]);
}

// ──────────────────────────────────────────────────────────────
// 현재 저장된 사용자 정보 조회 (캐시, 네트워크 없음)
// ──────────────────────────────────────────────────────────────
export async function getCachedUser(): Promise<{ uid: string; email: string } | null> {
    const [uid, email] = await Promise.all([
        safe.get(KEY_UID),
        safe.get(KEY_EMAIL),
    ]);
    if (!uid) return null;
    return { uid, email: email ?? '' };
}

// ──────────────────────────────────────────────────────────────
// 캐시된 ID Token 조회 (최신 인증 완료 후 저장된 값)
// ──────────────────────────────────────────────────────────────
export async function getCachedIdToken(): Promise<string | null> {
    return safe.get(KEY_ID_TOKEN);
}
