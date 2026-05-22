/**
 * firebaseRestClient.ts
 * Firebase REST API 클라이언트 — npm firebase SDK 없이 동작
 * Endpoints: Identity Toolkit (Auth) + Firestore REST v1
 */

// ──────────────────────────────────────────────────────────────
// 환경 변수 (esbuild define 또는 env.ts에서 주입)
// ──────────────────────────────────────────────────────────────
const getConfig = () => ({
    apiKey: (window as any).__FIREBASE_API_KEY__ ?? process.env.FIREBASE_API_KEY ?? '',
    projectId: (window as any).__FIREBASE_PROJECT_ID__ ?? process.env.FIREBASE_PROJECT_ID ?? '',
});

const AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';
const TOKEN_BASE = 'https://securetoken.googleapis.com/v1/token';
const FIRESTORE_BASE = (projectId: string) =>
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

// ──────────────────────────────────────────────────────────────
// Auth 타입 정의
// ──────────────────────────────────────────────────────────────
export interface FirebaseAuthResult {
    idToken: string;
    refreshToken: string;
    expiresIn: string;  // seconds string
    localId: string;  // uid
    email: string;
    displayName?: string;
}

export interface FirebaseTokenRefreshResult {
    id_token: string;
    refresh_token: string;
    expires_in: string;
    user_id: string;
}

// ──────────────────────────────────────────────────────────────
// 공통 에러 핸들러
// ──────────────────────────────────────────────────────────────
async function checkResponse(res: Response): Promise<any> {
    const data = await res.json();
    if (!res.ok) {
        const code = data?.error?.message ?? 'UNKNOWN_ERROR';
        const message = mapFirebaseError(code);
        throw new FirebaseError(code, message);
    }
    return data;
}

export class FirebaseError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'FirebaseError';
    }
}

function mapFirebaseError(code: string): string {
    const MAP: Record<string, string> = {
        'EMAIL_NOT_FOUND': 'No account found with this email address.',
        'INVALID_PASSWORD': 'Incorrect password. Please try again.',
        'INVALID_EMAIL': 'The email address is not valid.',
        'USER_DISABLED': 'This account has been disabled.',
        'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many failed attempts. Please try again later.',
        'INVALID_LOGIN_CREDENTIALS': 'Invalid email or password.',
        'TOKEN_EXPIRED': 'Session expired. Please sign in again.',
        'USER_NOT_FOUND': 'Account not found.',
    };
    return MAP[code] ?? `Authentication error: ${code}`;
}

// ──────────────────────────────────────────────────────────────
// 이메일/패스워드 로그인
// ──────────────────────────────────────────────────────────────
export async function signInWithEmailPassword(
    email: string,
    password: string
): Promise<FirebaseAuthResult> {
    const { apiKey } = getConfig();
    const res = await fetch(`${AUTH_BASE}:signInWithPassword?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    return checkResponse(res);
}

// ──────────────────────────────────────────────────────────────
// Google OAuth Access Token으로 Firebase 로그인
// (Electron OAuth 흐름에서 얻은 access_token 사용)
// ──────────────────────────────────────────────────────────────
export async function signInWithGoogleToken(
    googleAccessToken: string
): Promise<FirebaseAuthResult> {
    const { apiKey } = getConfig();
    const res = await fetch(`${AUTH_BASE}:signInWithIdp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            postBody: `access_token=${googleAccessToken}&providerId=google.com`,
            requestUri: 'http://localhost',
            returnIdpCredential: true,
            returnSecureToken: true,
        }),
    });
    return checkResponse(res);
}

// ──────────────────────────────────────────────────────────────
// ID Token 갱신
// ──────────────────────────────────────────────────────────────
export async function refreshIdToken(
    refreshToken: string
): Promise<FirebaseTokenRefreshResult> {
    const { apiKey } = getConfig();
    const res = await fetch(`${TOKEN_BASE}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    return checkResponse(res);
}

// ──────────────────────────────────────────────────────────────
// Firestore 문서 읽기
// ──────────────────────────────────────────────────────────────
export interface FirestoreUserDoc {
    hasPurchased: boolean;
    email: string;
    uid: string;
    purchasedAt?: string;
    plan?: string;
}

function parseFirestoreDoc(raw: any): FirestoreUserDoc {
    const fields = raw?.fields ?? {};
    return {
        hasPurchased: fields.hasPurchased?.booleanValue ?? false,
        email: fields.email?.stringValue ?? '',
        uid: fields.uid?.stringValue ?? '',
        purchasedAt: fields.purchasedAt?.timestampValue,
        plan: fields.plan?.stringValue,
    };
}

export async function getFirestoreUser(
    uid: string,
    idToken: string
): Promise<FirestoreUserDoc | null> {
    const { projectId } = getConfig();
    const url = `${FIRESTORE_BASE(projectId)}/users/${uid}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.status === 404) return null;
    const data = await checkResponse(res);
    return parseFirestoreDoc(data);
}

// ──────────────────────────────────────────────────────────────
// Firestore 문서 업데이트 (lastVerifiedAt 갱신)
// ──────────────────────────────────────────────────────────────
export async function updateLastVerified(
    uid: string,
    idToken: string
): Promise<void> {
    const { projectId } = getConfig();
    const now = new Date().toISOString();
    const url =
        `${FIRESTORE_BASE(projectId)}/users/${uid}` +
        `?updateMask.fieldPaths=lastVerifiedAt`;

    await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            fields: {
                lastVerifiedAt: { timestampValue: now },
            },
        }),
    });
}
