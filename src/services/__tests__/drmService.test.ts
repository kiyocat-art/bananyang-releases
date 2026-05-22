/**
 * drmService.test.ts
 * DRM 서비스 유닛 테스트
 *
 * NOTE: 이 테스트는 vitest로 실행합니다.
 *   npx vitest run src/services/__tests__/drmService.test.ts
 *
 * safeStoage, fetch 등은 모두 mock 처리합니다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────────────────────────────────────────────────
// Mock: window.electronAPI.safeStorage*
// ──────────────────────────────────────────────────────────────
const fakeStore: Record<string, string> = {};

const mockElectronAPI = {
    safeStorageSet: vi.fn(async (key: string, value: string) => {
        fakeStore[key] = value;
    }),
    safeStorageGet: vi.fn(async (key: string) => fakeStore[key] ?? null),
    safeStorageDelete: vi.fn(async (key: string) => {
        delete fakeStore[key];
    }),
    startAuthServer: vi.fn(async () => ({ success: false, error: 'mock' })),
    openExternal: vi.fn(),
};

Object.defineProperty(globalThis, 'window', {
    value: { electronAPI: mockElectronAPI },
    writable: true,
});

// ──────────────────────────────────────────────────────────────
// Mock: fetch (Firebase REST API)
// ──────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// ──────────────────────────────────────────────────────────────
// Mock: process.env
// ──────────────────────────────────────────────────────────────
vi.stubGlobal('process', {
    env: {
        FIREBASE_API_KEY: 'test-key',
        FIREBASE_PROJECT_ID: 'test-project',
    },
});

// Import AFTER mocks are set up
import {
    loginWithEmail,
    silentAuthenticate,
    clearLocalCredentials,
    GRACE_PERIOD_DAYS,
} from '../drmService';

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────
function mockAuthResponse(overrides: Record<string, unknown> = {}) {
    return {
        ok: true,
        json: async () => ({
            idToken: 'mock-id-token',
            refreshToken: 'mock-refresh-token',
            expiresIn: '3600',
            localId: 'uid-123',
            email: 'test@example.com',
            ...overrides,
        }),
    };
}

function mockFirestoreResponse(hasPurchased: boolean) {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            fields: {
                hasPurchased: { booleanValue: hasPurchased },
                email: { stringValue: 'test@example.com' },
                uid: { stringValue: 'uid-123' },
            },
        }),
    };
}

function mockPatchResponse() {
    return { ok: true, json: async () => ({}) };
}

// ──────────────────────────────────────────────────────────────
// 테스트
// ──────────────────────────────────────────────────────────────

describe('drmService', () => {
    beforeEach(() => {
        // Clear mock store
        Object.keys(fakeStore).forEach((k) => delete fakeStore[k]);
        vi.clearAllMocks();
    });

    // ──── loginWithEmail ────

    describe('loginWithEmail', () => {
        it('구매 완료 시 status=ok 반환', async () => {
            mockFetch
                .mockResolvedValueOnce(mockAuthResponse())      // signInWithPassword
                .mockResolvedValueOnce(mockFirestoreResponse(true)) // getFirestoreUser
                .mockResolvedValueOnce(mockPatchResponse());     // updateLastVerified

            const result = await loginWithEmail('test@example.com', 'password123');
            expect(result.status).toBe('ok');
            if (result.status === 'ok') {
                expect(result.uid).toBe('uid-123');
                expect(result.email).toBe('test@example.com');
            }

            // safeStorage에 토큰 저장 확인
            expect(fakeStore['bn_refresh_token']).toBe('mock-refresh-token');
            expect(fakeStore['bn_uid']).toBe('uid-123');
        });

        it('미구매 시 status=not_purchased 반환', async () => {
            mockFetch
                .mockResolvedValueOnce(mockAuthResponse())
                .mockResolvedValueOnce(mockFirestoreResponse(false));

            const result = await loginWithEmail('test@example.com', 'password123');
            expect(result.status).toBe('not_purchased');
        });

        it('잘못된 비밀번호 시 status=error 반환', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: { message: 'INVALID_PASSWORD' } }),
            });

            const result = await loginWithEmail('test@example.com', 'wrong');
            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.message).toContain('Incorrect password');
            }
        });
    });

    // ──── silentAuthenticate ────

    describe('silentAuthenticate', () => {
        it('토큰 없으면 status=needs_login', async () => {
            const result = await silentAuthenticate();
            expect(result.status).toBe('needs_login');
        });

        it('온라인 + 구매 있으면 status=ok', async () => {
            // 사전 조건: safeStorage에 토큰 존재
            fakeStore['bn_refresh_token'] = 'stored-refresh';
            fakeStore['bn_last_verified'] = Date.now().toString();
            fakeStore['bn_uid'] = 'uid-123';
            fakeStore['bn_email'] = 'test@example.com';

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        id_token: 'new-id-token',
                        refresh_token: 'new-refresh',
                        expires_in: '3600',
                        user_id: 'uid-123',
                    }),
                })
                .mockResolvedValueOnce(mockFirestoreResponse(true))
                .mockResolvedValueOnce(mockPatchResponse());

            const result = await silentAuthenticate();
            expect(result.status).toBe('ok');
        });

        it('오프라인 + 7일 이내 → status=offline_grace', async () => {
            // 3일 전에 마지막 검증
            const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
            fakeStore['bn_refresh_token'] = 'stored-refresh';
            fakeStore['bn_last_verified'] = threeDaysAgo.toString();
            fakeStore['bn_uid'] = 'uid-123';
            fakeStore['bn_email'] = 'test@example.com';

            // 네트워크 오류 시뮬레이션
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await silentAuthenticate();
            expect(result.status).toBe('offline_grace');
            if (result.status === 'offline_grace') {
                expect(result.daysLeft).toBeGreaterThan(0);
                expect(result.daysLeft).toBeLessThanOrEqual(GRACE_PERIOD_DAYS);
            }
        });

        it('오프라인 + 7일 초과 → status=grace_expired', async () => {
            // 10일 전에 마지막 검증
            const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
            fakeStore['bn_refresh_token'] = 'stored-refresh';
            fakeStore['bn_last_verified'] = tenDaysAgo.toString();
            fakeStore['bn_uid'] = 'uid-123';
            fakeStore['bn_email'] = 'test@example.com';

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await silentAuthenticate();
            expect(result.status).toBe('grace_expired');
        });
    });

    // ──── clearLocalCredentials ────

    describe('clearLocalCredentials', () => {
        it('모든 DRM 키 삭제', async () => {
            fakeStore['bn_refresh_token'] = 'token';
            fakeStore['bn_id_token'] = 'id';
            fakeStore['bn_uid'] = 'uid';
            fakeStore['bn_email'] = 'email';
            fakeStore['bn_last_verified'] = '123';

            await clearLocalCredentials();

            expect(fakeStore['bn_refresh_token']).toBeUndefined();
            expect(fakeStore['bn_id_token']).toBeUndefined();
            expect(fakeStore['bn_uid']).toBeUndefined();
            expect(fakeStore['bn_email']).toBeUndefined();
            expect(fakeStore['bn_last_verified']).toBeUndefined();
        });
    });
});
