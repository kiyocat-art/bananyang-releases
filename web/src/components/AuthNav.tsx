'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   AuthNav — top-right navigation auth buttons
   Shows login/signup when logged out; user menu when logged in.
   ───────────────────────────────────────────────────────────────────────────── */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export function AuthNav() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading) {
    return <div style={{ width: 80, height: 32 }} />;
  }

  /* ─── Logged-out state ─── */
  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link
          href="/auth/login"
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            transition: 'color 0.15s',
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          {t.auth.login}
        </Link>
        <Link
          href="/auth/signup"
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: '#0d0d0d',
            textDecoration: 'none',
            background: 'var(--accent-yellow)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'var(--accent-yellow-hover)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'var(--accent-yellow)';
          }}
        >
          {t.auth.signup}
        </Link>
      </div>
    );
  }

  /* ─── Logged-in state — user avatar + dropdown ─── */
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const initial = displayName[0].toUpperCase();

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 8,
          background: menuOpen ? 'var(--bg-card-hover)' : 'transparent',
          border: '1px solid var(--border-subtle)',
          cursor: 'pointer',
          transition: 'background 0.15s',
          color: 'var(--text-primary)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)';
        }}
        onMouseLeave={(e) => {
          if (!menuOpen) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }
        }}
      >
        {/* Avatar */}
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={displayName}
            width={24}
            height={24}
            referrerPolicy="no-referrer"
            style={{ borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--accent-yellow)',
              color: '#0d0d0d',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}
        <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M2 4l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 160,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 200,
          }}
        >
          <Link
            href="/account"
            onClick={() => setMenuOpen(false)}
            style={{
              display: 'block',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            {t.auth.myAccount}
          </Link>
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />
          <button
            onClick={async () => {
              setMenuOpen(false);
              await signOut();
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            {t.auth.logout}
          </button>
        </div>
      )}
    </div>
  );
}
