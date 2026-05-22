/**
 * AuthGate.tsx
 * 구매 인증 전까지 앱(작업 공간)을 잠그는 게이트 컴포넌트
 *
 * 상태 흐름:
 * checking → (silentAuthenticate 결과에 따라)
 *   → authenticated: children 렌더링
 *   → login: 로그인 폼
 *   → not_purchased: 구매 안내
 *   → grace_expired: 잠금 화면
 *   → offline_grace: 오프라인 알림 + children
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import appIconSrc from '../assets/bananyang-icon.png';
import bananyangLoadingIcon from '../assets/bananyang-loading.png';
import { Z_INDEX } from '../constants/zIndex';
import {
    silentAuthenticate,
    loginWithGoogle,
    loginWithEmail,
    GRACE_PERIOD_DAYS,
} from '../services/drmService';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { t, Language, TranslationKey } from '../localization';

// ──────────────────────────────────────────────────────────────
// [DEV] 로그인 우회 플래그 — .env.local에 DEV_BYPASS_AUTH=true 설정 시 활성화
// 반드시 NODE_ENV=development 환경에서만 동작 (프로덕션 인증 우회 방지)
// ──────────────────────────────────────────────────────────────
const DEV_AUTO_LOGIN_BYPASS =
    process.env.NODE_ENV === 'development' &&
    process.env.DEV_BYPASS_AUTH === 'true';

// ──────────────────────────────────────────────────────────────
// 스타일 상수
// ──────────────────────────────────────────────────────────────
const COLORS = {
    bg: '#0D0D0D',
    card: '#151515',
    border: '#1F1F1F',
    banana: '#F5C518',
    text: '#FFFFFF',
    textDim: '#888888',
    error: '#FF4444',
};

// UI 폰트 스케일 헬퍼 — 인라인 스타일에서 CSS 변수 calc() 문자열 생성.
// sl: layout-scale (박스/패딩/마진/border-radius), sf: font-scale (텍스트 크기)

const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: 'Inter, system-ui, sans-serif',
};

const cardStyle: React.CSSProperties = {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 40,
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
};

const buttonStyle: React.CSSProperties = {
    background: COLORS.banana,
    color: '#000',
    border: 'none',
    borderRadius: 8,
    padding: `12px 24px`,
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: 12,
    transition: 'opacity 0.15s',
};

const linkStyle: React.CSSProperties = {
    color: COLORS.banana,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '0.8125rem',
    background: 'none',
    border: 'none',
    padding: 0,
};

// ──────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ──────────────────────────────────────────────────────────────

function LoginPromptModal({
    onGoogleLogin,
    onEmailLogin,
    onDismiss,
    error,
    loading,
    language,
}: {
    onGoogleLogin: () => void;
    onEmailLogin: (email: string, password: string) => void;
    onDismiss: () => void;
    error: string | null;
    loading: boolean;
    language: Language;
}) {
    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInput.trim() || !passwordInput) return;
        onEmailLogin(emailInput.trim(), passwordInput);
    };

    const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: `0 -40px` }} />;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,13,13,0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_INDEX.DROPDOWN,
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            <style>{`.auth-btn:hover:not(:disabled) { opacity: 0.80 !important; }`}</style>

            {/* 다크 테마 카드 (배경 없음, 흰색 테두리) */}
            <div style={{
                background: 'transparent',
                borderRadius: 24,
                border: '1px solid rgba(255,255,255,0.22)',
                padding: `40px 40px 32px`,
                maxWidth: 460,
                width: '90%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                overflow: 'hidden',
                textAlign: 'center',
            }}>
                {/* ── 헤더: 아이콘 + 앱 이름 ── */}
                <div style={{ textAlign: 'center', paddingBottom: 28 }}>
                    <img
                        src={appIconSrc}
                        alt="BanaNyang"
                        style={{ width: 128, height: 128, objectFit: 'contain', marginBottom: 16, display: 'block', margin: `0 auto 16px` }}
                    />
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.3px' }}>
                        BanaNyang
                    </p>
                </div>

                {divider}

                {/* ── 안내 문구 ── */}
                <div style={{ padding: `24px 0` }}>
                    <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.72)', margin: `0 0 16px`, lineHeight: 1.65, wordBreak: 'keep-all', textAlign: 'center' }}>
                        {t('auth.modal.canvasFree' as TranslationKey, language)}
                    </p>
                    <div style={{
                        fontSize: '0.9375rem',
                        color: 'rgba(245,197,24,0.95)',
                        background: 'rgba(245,197,24,0.08)',
                        border: '1px solid rgba(245,197,24,0.25)',
                        borderRadius: 10,
                        padding: `12px 16px`,
                        lineHeight: 1.7,
                        wordBreak: 'keep-all',
                        textAlign: 'left',
                    }}>
                        {t('auth.modal.apiKeyNote' as TranslationKey, language)}
                    </div>
                    {error && (
                        <div style={{
                            marginTop: 14,
                            background: 'rgba(255,68,68,0.08)',
                            border: '1px solid rgba(255,68,68,0.3)',
                            borderRadius: 10,
                            padding: `12px 16px`,
                            fontSize: '0.9375rem',
                            color: '#ff6b6b',
                            lineHeight: 1.6,
                            textAlign: 'left',
                        }}>
                            {error}
                        </div>
                    )}
                </div>

                {divider}

                {/* ── 로그인 영역 ── */}
                <div style={{ padding: `24px 0` }}>
                    {/* 이메일/비밀번호 폼 (기본 펼침) */}
                    <form onSubmit={handleEmailSubmit} style={{ textAlign: 'left' }}>
                        <input
                            type="email"
                            placeholder={t('auth.login.emailPlaceholder' as TranslationKey, language)}
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            required
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: `14px 16px`,
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(255,255,255,0.06)',
                                color: '#ffffff',
                                fontSize: '1rem',
                                outline: 'none',
                                marginBottom: 12,
                                boxSizing: 'border-box',
                            }}
                        />
                        <input
                            type="password"
                            placeholder={t('auth.login.passwordPlaceholder' as TranslationKey, language)}
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            required
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: `14px 16px`,
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(255,255,255,0.06)',
                                color: '#ffffff',
                                fontSize: '1rem',
                                outline: 'none',
                                marginBottom: 14,
                                boxSizing: 'border-box',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="auth-btn"
                            style={{
                                background: COLORS.banana,
                                color: '#000',
                                border: 'none',
                                borderRadius: 10,
                                padding: `15px 24px`,
                                fontSize: '1.0625rem',
                                fontWeight: 700,
                                cursor: loading ? 'default' : 'pointer',
                                width: '100%',
                                opacity: loading ? 0.6 : 1,
                                transition: 'opacity 0.15s',
                                boxSizing: 'border-box',
                            }}
                        >
                            {loading ? t('auth.modal.loggingIn' as TranslationKey, language) : t('auth.login.button' as TranslationKey, language)}
                        </button>
                    </form>

                    {/* or 구분 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: `20px 0` }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                        <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)' }}>{t('auth.login.or' as TranslationKey, language)}</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                    </div>

                    {/* Google 로그인 */}
                    <button
                        onClick={onGoogleLogin}
                        disabled={loading}
                        className="auth-btn"
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: '#ffffff',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 10,
                            padding: `14px 24px`,
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: loading ? 'default' : 'pointer',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            opacity: loading ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                            boxSizing: 'border-box',
                        }}
                    >
                        {loading ? t('auth.modal.loggingIn' as TranslationKey, language) : (
                            <>
                                <svg width="22" height="22" viewBox="0 0 48 48">
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                                </svg>
                                {t('auth.modal.loginNow' as TranslationKey, language)}
                            </>
                        )}
                    </button>
                </div>

                {divider}

                {/* ── 건너뛰기 ── */}
                <div style={{ paddingTop: 20, textAlign: 'center' }}>
                    <button
                        onClick={onDismiss}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.38)',
                            fontSize: '0.9375rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: `4px 8px`,
                        }}
                    >
                        {t('auth.modal.skip' as TranslationKey, language)}
                    </button>
                </div>
            </div>
        </div>
    );
}

function NotPurchasedScreen({
    email,
    onLogout,
    language,
}: {
    email: string;
    onLogout: () => void;
    language: Language;
}) {
    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔒</div>
                <h2 style={{ margin: `0 0 8px`, fontSize: '1.25rem' }}>
                    {t('auth.notPurchased.title' as TranslationKey, language)}
                </h2>
                <p style={{ color: COLORS.textDim, fontSize: '0.875rem', margin: `0 0 8px` }}>
                    {t('auth.notPurchased.account' as TranslationKey, language)} <strong>{email}</strong>
                </p>
                <p style={{ color: COLORS.textDim, fontSize: '0.8125rem', margin: `0 0 24px` }}>
                    {t('auth.notPurchased.body' as TranslationKey, language)}
                </p>
                <button
                    style={buttonStyle}
                    onClick={() => window.electronAPI.openExternal('https://bananyang.app/#pricing')}
                >
                    {t('auth.notPurchased.button' as TranslationKey, language)}
                </button>
                <button
                    style={{ ...linkStyle, marginTop: 16, display: 'block' }}
                    onClick={onLogout}
                >
                    {t('auth.notPurchased.switchAccount' as TranslationKey, language)}
                </button>
            </div>
        </div>
    );
}

function GraceExpiredScreen({ onRetry, language }: { onRetry: () => void; language: Language }) {
    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⏰</div>
                <h2 style={{ margin: `0 0 8px`, fontSize: '1.25rem' }}>
                    {t('auth.graceExpired.title' as TranslationKey, language)}
                </h2>
                <p style={{ color: COLORS.textDim, fontSize: '0.875rem', margin: `0 0 24px` }}>
                    {t('auth.graceExpired.body' as TranslationKey, language, { days: GRACE_PERIOD_DAYS })}
                </p>
                <button style={buttonStyle} onClick={onRetry}>
                    {t('auth.graceExpired.button' as TranslationKey, language)}
                </button>
            </div>
        </div>
    );
}

function OfflineNoticeScreen({
    daysLeft,
    children,
    language,
}: {
    daysLeft: number;
    children: ReactNode;
    language: Language;
}) {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return <>{children}</>;

    return (
        <>
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: 'rgba(245, 197, 24, 0.15)',
                borderBottom: '1px solid rgba(245, 197, 24, 0.3)',
                padding: `8px 16px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: Z_INDEX.DROPDOWN,
                fontSize: '0.8125rem',
            }}>
                <span>
                    {t('auth.offline.banner' as TranslationKey, language, { days: daysLeft })}
                </span>
                <button
                    onClick={() => setDismissed(true)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: COLORS.text,
                        cursor: 'pointer',
                        fontSize: '1rem',
                    }}
                >
                    ✕
                </button>
            </div>
            {children}
        </>
    );
}

// ──────────────────────────────────────────────────────────────
// AuthGate 메인 컴포넌트
// ──────────────────────────────────────────────────────────────
interface AuthGateProps {
    children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
    const {
        authState, email, daysLeft, loginLoading, loginError,
        showLoginModal, setAuthResult, setLoginLoading, setLoginError,
        openLoginModal, closeLoginModal, logout,
    } = useAuthStore();
    const autoLogin = useSettingsStore(state => state.autoLogin);
    const language = useSettingsStore(state => state.language);

    // 앱 시작 시 조용한 인증
    useEffect(() => {
        async function checkAuth() {
            if (DEV_AUTO_LOGIN_BYPASS) {
                setAuthResult({ status: 'ok', uid: 'dev', email: 'dev@test.com' });
                return;
            }
            if (!autoLogin) {
                // 자동 로그인 OFF: silentAuthenticate 스킵, 바로 login 상태
                setAuthResult({ status: 'needs_login' });
                return;
            }
            const result = await silentAuthenticate();
            setAuthResult(result);
        }
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Google 로그인
    const handleGoogleLogin = useCallback(async () => {
        if (DEV_AUTO_LOGIN_BYPASS) {
            setAuthResult({ status: 'ok', uid: 'dev', email: 'dev@test.com' });
            return;
        }
        setLoginLoading(true);
        setLoginError(null);
        const result = await loginWithGoogle();
        setAuthResult(result);
        setLoginLoading(false);
    }, [setAuthResult, setLoginLoading, setLoginError]);

    // 이메일/비밀번호 로그인
    const handleEmailLogin = useCallback(async (email: string, password: string) => {
        setLoginLoading(true);
        setLoginError(null);
        const result = await loginWithEmail(email, password);
        setAuthResult(result);
        setLoginLoading(false);
    }, [setAuthResult, setLoginLoading, setLoginError]);

    // 로그아웃
    const handleLogout = useCallback(async () => {
        await logout();
        openLoginModal();
    }, [logout, openLoginModal]);

    // 재인증
    const handleRetry = useCallback(async () => {
        setAuthResult({ status: 'needs_login' });
        const result = await silentAuthenticate();
        // grace_expired이면 로그인 모달을 유지 (자동 갱신 실패 → 사용자가 직접 로그인)
        if (result.status !== 'grace_expired') {
            setAuthResult(result);
        }
    }, [setAuthResult]);

    // 구매 필수 화면 (DRM 잠금)
    if (authState === 'not_purchased') {
        return <NotPurchasedScreen email={email} onLogout={handleLogout} language={language} />;
    }
    if (authState === 'grace_expired') {
        return <GraceExpiredScreen onRetry={handleRetry} language={language} />;
    }

    // 오프라인 Grace Period: 캔버스 + 배너
    if (authState === 'offline_grace') {
        return <OfflineNoticeScreen daysLeft={daysLeft} language={language}>{children}</OfflineNoticeScreen>;
    }

    // 인증됨: 캔버스만 렌더링
    if (authState === 'authenticated') {
        return <>{children}</>;
    }

    // checking 상태: 인증 확인 중 로딩 화면 (LoadingOverlay와 동일한 구조/크기)
    if (authState === 'checking') {
        const ringPath = "M 12,128 V 61 a 49,49 0 0 1 49,-49 H 195 a 49,49 0 0 1 49,49 V 195 a 49,49 0 0 1 -49,49 H 61 a 49,49 0 0 1 -49,-49 V 128 Z";
        return (
            <div className="fixed inset-0 bg-neutral-900 flex flex-col items-center justify-center" style={{ zIndex: Z_INDEX.AUTH }}>
                <style>{`
                    @keyframes authSpinRing {
                        from { stroke-dashoffset: 844; }
                        to   { stroke-dashoffset: 0;   }
                    }
                    .auth-ring { animation: authSpinRing 1.8s linear infinite; }
                `}</style>
                <div className="relative w-32 h-32">
                    <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d={ringPath} fill="#2B2B2B" strokeOpacity="0.2" />
                        <image href={bananyangLoadingIcon} x="18" y="18" width="220" height="220" />
                        <path
                            d={ringPath}
                            stroke="#FFFFFF"
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray="253 591"
                            className="auth-ring"
                        />
                    </svg>
                </div>
                <div className="mt-4 text-center">
                    <p className="text-lg font-semibold text-zinc-200">
                        {t('auth.modal.loggingIn' as TranslationKey, language)}
                    </p>
                </div>
            </div>
        );
    }

    // login 상태: 캔버스 접근 가능 + 로그인 모달 오버레이 (건너뛰기 허용)
    // 생성 버튼은 ActionButtons에서 로그인 버튼으로 표시됨
    return (
        <>
            {children}
            {showLoginModal && (
                <LoginPromptModal
                    onGoogleLogin={handleGoogleLogin}
                    onEmailLogin={handleEmailLogin}
                    onDismiss={closeLoginModal}
                    error={loginError}
                    loading={loginLoading}
                    language={language}
                />
            )}
        </>
    );
}
