/**
 * LoginGate.tsx
 * Electron 앱 실행 시 가장 먼저 표시되는 인-앱 로그인 + DRM 게이트.
 *
 * 로직 흐름:
 *   mount → silentAuthenticate()
 *     ok / offline_grace → children 렌더 (앱 사용 가능)
 *     needs_login       → EmailLogin / GoogleLogin 폼 표시
 *     not_purchased     → '구매 필요' 안내 + 웹사이트 리다이렉트
 *     grace_expired     → '재로그인 필요' 안내
 *     error             → 에러 메시지 + 재시도
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    silentAuthenticate,
    loginWithEmail,
    loginWithGoogle,
    clearLocalCredentials,
    DRMStatus,
} from '../services/drmService';
import { Z_INDEX } from '../constants/zIndex';

/* ─── Types ─── */
type GateView =
    | 'loading'
    | 'login'
    | 'not_purchased'
    | 'grace_expired'
    | 'error';

interface LoginGateProps {
    children: React.ReactNode;
    /** 웹사이트 URL (미구매 시 리다이렉트) */
    purchaseUrl?: string;
}

/* ─── Styles ─── */
const styles = {
    overlay: {
        position: 'fixed' as const,
        inset: 0,
        zIndex: Z_INDEX.WINDOW_HANDLES,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d0d0d',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    card: {
        width: 400,
        maxWidth: '90vw',
        padding: 40,
        borderRadius: 20,
        background: 'rgba(26, 26, 26, 0.95)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        textAlign: 'center' as const,
        color: '#f5f5f5',
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: 14,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 700,
        marginBottom: 6,
        letterSpacing: '-0.02em',
    },
    subtitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 28,
        lineHeight: 1.5,
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        color: '#f5f5f5',
        fontSize: 14,
        outline: 'none',
        marginBottom: 12,
        transition: 'border-color 0.2s',
    },
    btnPrimary: {
        width: '100%',
        padding: '12px 0',
        borderRadius: 10,
        border: 'none',
        background: '#FFD700',
        color: '#0d0d0d',
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginBottom: 10,
    },
    btnGoogle: {
        width: '100%',
        padding: '12px 0',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        color: '#f5f5f5',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.2s',
    },
    btnLink: {
        background: 'none',
        border: 'none',
        color: '#FFD700',
        fontSize: 13,
        cursor: 'pointer',
        textDecoration: 'underline',
        marginTop: 16,
        padding: 0,
    },
    errorText: {
        color: '#FF6B6B',
        fontSize: 13,
        marginBottom: 12,
        minHeight: 20,
    },
    spinner: {
        width: 36,
        height: 36,
        border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #FFD700',
        borderRadius: '50%',
        animation: 'login-spin 0.8s linear infinite',
        margin: '0 auto 16px',
    },
    graceBar: {
        height: 4,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.06)',
        marginTop: 16,
        overflow: 'hidden',
    },
};

/* ─── Spinner keyframe (injected once) ─── */
const SPINNER_CSS = `@keyframes login-spin { to { transform: rotate(360deg); } }`;

/* ─── Component ─── */
export default function LoginGate({ children, purchaseUrl = 'https://bananyang.app' }: LoginGateProps) {
    const [view, setView] = useState<GateView>('loading');
    const [drmResult, setDrmResult] = useState<DRMStatus | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    /* ─── Silent auth on mount ─── */
    const runSilentAuth = useCallback(async () => {
        setView('loading');
        setError('');
        try {
            const result = await silentAuthenticate();
            setDrmResult(result);

            switch (result.status) {
                case 'ok':
                case 'offline_grace':
                    // 인증 성공 → 앱 사용 가능 (view를 변경하지 않으면 children이 렌더됨)
                    break;
                case 'needs_login':
                    setView('login');
                    break;
                case 'not_purchased':
                    setView('not_purchased');
                    break;
                case 'grace_expired':
                    setView('grace_expired');
                    break;
                case 'error':
                    setError(result.message);
                    setView('error');
                    break;
            }
        } catch {
            setView('error');
            setError('Authentication service unavailable.');
        }
    }, []);

    useEffect(() => {
        runSilentAuth();
    }, [runSilentAuth]);

    /* ─── Email login handler ─── */
    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) return;
        setBusy(true);
        setError('');

        const result = await loginWithEmail(email.trim(), password);
        setBusy(false);
        setDrmResult(result);

        switch (result.status) {
            case 'ok':
                break; // will render children
            case 'not_purchased':
                setView('not_purchased');
                break;
            case 'error':
                setError(result.message);
                break;
            default:
                setError('Unexpected authentication state.');
        }
    };

    /* ─── Google login handler ─── */
    const handleGoogleLogin = async () => {
        setBusy(true);
        setError('');

        const result = await loginWithGoogle();
        setBusy(false);
        setDrmResult(result);

        switch (result.status) {
            case 'ok':
                break;
            case 'not_purchased':
                setView('not_purchased');
                break;
            case 'error':
                setError(result.message);
                break;
            default:
                setError('Unexpected authentication state.');
        }
    };

    /* ─── Logout ─── */
    const handleLogout = async () => {
        await clearLocalCredentials();
        setDrmResult(null);
        setEmail('');
        setPassword('');
        setError('');
        setView('login');
    };

    /* ─── Open external URL ─── */
    const openPurchase = () => {
        window.electronAPI?.openExternal?.(purchaseUrl);
    };

    /* ═══ If auth is ok, render children ═══ */
    if (
        drmResult &&
        (drmResult.status === 'ok' || drmResult.status === 'offline_grace')
    ) {
        return <>{children}</>;
    }

    /* ═══ Gate Screens ═══ */
    return (
        <>
            <style>{SPINNER_CSS}</style>
            <div style={styles.overlay}>
                <div style={styles.card}>
                    {/* Logo */}
                    <img
                        src="./assets/BanaNyang-icon.png"
                        alt="BanaNyang"
                        style={styles.logo}
                        onError={(e) => {
                            // fallback if BanaNyang-icon not found at runtime
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />

                    {/* ─── Loading ─── */}
                    {view === 'loading' && (
                        <>
                            <div style={styles.spinner} />
                            <p style={{ fontSize: 14, color: '#999' }}>인증 확인 중…</p>
                        </>
                    )}

                    {/* ─── Login Form ─── */}
                    {view === 'login' && (
                        <>
                            <h2 style={styles.title}>Welcome to BanaNyang</h2>
                            <p style={styles.subtitle}>
                                계정에 로그인하여 워크스페이스를 시작하세요.
                            </p>

                            {error && <p style={styles.errorText}>{error}</p>}

                            <form onSubmit={handleEmailLogin}>
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={styles.input}
                                    disabled={busy}
                                    autoFocus
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={styles.input}
                                    disabled={busy}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        ...styles.btnPrimary,
                                        opacity: busy ? 0.6 : 1,
                                    }}
                                    disabled={busy}
                                >
                                    {busy ? 'Signing in…' : 'Sign In'}
                                </button>
                            </form>

                            <div style={{ position: 'relative', margin: '16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                <span style={{ fontSize: 12, color: '#666' }}>or</span>
                                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                style={styles.btnGoogle}
                                disabled={busy}
                            >
                                <GoogleIcon />
                                Continue with Google
                            </button>

                            <p style={{ marginTop: 20, fontSize: 12, color: '#666' }}>
                                계정이 없으신가요?{' '}
                                <button onClick={openPurchase} style={{ ...styles.btnLink, fontSize: 12 }}>
                                    구매 및 회원가입
                                </button>
                            </p>
                        </>
                    )}

                    {/* ─── Not Purchased ─── */}
                    {view === 'not_purchased' && (
                        <>
                            <h2 style={styles.title}>구매가 필요합니다</h2>
                            <p style={styles.subtitle}>
                                {drmResult?.status === 'not_purchased'
                                    ? `${drmResult.email} 계정에 구매 내역이 없습니다.`
                                    : '이 계정에 구매 내역이 없습니다.'
                                }
                                <br />
                                웹사이트에서 BanaNyang을 구매해 주세요.
                            </p>
                            <button onClick={openPurchase} style={styles.btnPrimary}>
                                구매 페이지로 이동
                            </button>
                            <button onClick={handleLogout} style={styles.btnLink}>
                                다른 계정으로 로그인
                            </button>
                        </>
                    )}

                    {/* ─── Grace Expired ─── */}
                    {view === 'grace_expired' && (
                        <>
                            <h2 style={styles.title}>인증 갱신 필요</h2>
                            <p style={styles.subtitle}>
                                오프라인 사용 기간(7일)이 만료되었습니다.
                                <br />
                                네트워크에 연결한 후 재로그인해 주세요.
                            </p>
                            <button onClick={runSilentAuth} style={styles.btnPrimary}>
                                다시 시도
                            </button>
                            <button onClick={handleLogout} style={styles.btnLink}>
                                다른 계정으로 로그인
                            </button>
                        </>
                    )}

                    {/* ─── Error ─── */}
                    {view === 'error' && (
                        <>
                            <h2 style={styles.title}>인증 오류</h2>
                            <p style={{ ...styles.subtitle, color: '#FF6B6B' }}>
                                {error || '알 수 없는 오류가 발생했습니다.'}
                            </p>
                            <button onClick={runSilentAuth} style={styles.btnPrimary}>
                                다시 시도
                            </button>
                            <button onClick={handleLogout} style={styles.btnLink}>
                                로그인 화면으로
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

/* ─── Google 'G' Icon ─── */
function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}
