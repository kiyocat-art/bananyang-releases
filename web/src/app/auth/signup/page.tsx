'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   /auth/signup — Sign-up page
   ───────────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, Suspense, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const { t } = useLanguage();
  const { user, signInWithGoogle, signUpWithEmail, error, clearError, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/account';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  /* Redirect if already logged in */
  useEffect(() => {
    if (!loading && user) {
      router.replace(redirect);
    }
  }, [user, loading, router, redirect]);

  async function handleEmailSignup(e: FormEvent) {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    const ok = await signUpWithEmail(email, password, name);
    setSubmitting(false);
    if (ok) setVerificationSent(true);
  }

  async function handleGoogleSignup() {
    clearError();
    setSubmitting(true);
    await signInWithGoogle();
    setSubmitting(false);
  }

  const errorMsg = error ? (t.auth.errors[error as keyof typeof t.auth.errors] ?? t.auth.errors.unknown) : null;

  return (
    <>
      <div className="dark-grid-bg" aria-hidden="true" />
      <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Nav */}
        <nav style={{ padding: '20px 32px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Image src="/bananyang-icon.png" alt="BanaNyang" width={28} height={28} style={{ borderRadius: 7 }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>BanaNyang</span>
          </Link>
        </nav>

        {/* Form card */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div
            style={{
              width: '100%',
              maxWidth: 400,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              borderRadius: 20,
              padding: '40px 36px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 24px rgba(0, 0, 0, 0.25)',
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 28, letterSpacing: '-0.02em' }}>
              {t.auth.signup}
            </h1>

            {/* Verification sent success */}
            {verificationSent && (
              <div style={successBoxStyle}>{t.auth.verificationEmailSent}</div>
            )}

            {/* Error message */}
            {errorMsg && (
              <div style={errorBoxStyle}>{errorMsg}</div>
            )}

            {/* Google signup */}
            <button
              onClick={handleGoogleSignup}
              disabled={submitting}
              style={googleBtnStyle}
            >
              <GoogleIcon />
              {t.auth.continueWithGoogle}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.auth.or}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>

            {/* Email/password signup form */}
            <form onSubmit={handleEmailSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t.auth.name}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError(); }}
                  required
                  autoComplete="name"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.auth.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  required
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t.auth.password}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    required
                    autoComplete="new-password"
                    minLength={6}
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  {t.auth.errors.weak_password}
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{ ...submitBtnStyle, marginTop: 4 }}
              >
                {submitting ? '...' : t.auth.signup}
              </button>
            </form>

            {/* Login link */}
            <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              {t.auth.alreadyHaveAccount}{' '}
              <Link href={`/auth/login${redirect !== '/account' ? `?redirect=${redirect}` : ''}`} style={{ color: 'var(--accent-yellow)', textDecoration: 'none', fontWeight: 600 }}>
                {t.auth.login}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

/* ─── Shared styles ─── */
const googleBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  padding: '11px 16px',
  borderRadius: 10,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
};
const submitBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--accent-yellow)',
  color: '#0d0d0d',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};
const errorBoxStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(255,77,77,0.1)',
  border: '1px solid rgba(255,77,77,0.25)',
  color: '#ff6b6b',
  fontSize: 13,
  marginBottom: 12,
};
const successBoxStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(0,200,100,0.1)',
  border: '1px solid rgba(0,200,100,0.25)',
  color: '#00c864',
  fontSize: 13,
  marginBottom: 12,
};

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.9 29.3 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.4 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.5 20-21 0-1.3-.2-2.7-.4-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.4 5.1 29.5 3 24 3 16.3 3 9.6 7.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 45c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 36.5 26.8 37 24 37c-5.2 0-9.6-3-11.3-7.4L6 34.5C9.4 41.3 16.2 45 24 45z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.5 4.6-4.6 6.1l6.2 5.2C40.7 36.1 44 30.5 44 24c0-1.3-.2-2.7-.4-4z"/>
    </svg>
  );
}
