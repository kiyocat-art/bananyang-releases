'use client';

/* ─────────────────────────────────────────────────────────────────────────────
   /admin/subscribers — admin UI for the notify_signups list.
   Auth: Firebase ID token sent as Bearer. Server-side allowlist check.
   ───────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getFirebaseAuth } from '@/lib/firebase';

interface Subscriber {
  id: string;
  email: string;
  source: string | null;
  locale: string | null;
  createdAt: string | null;
  welcomeSentAt: string | null;
  broadcastSentAt: string | null;
  unsubscribedAt: string | null;
}

interface Stats {
  total: number;
  active: number;
  welcomed: number;
  broadcasted: number;
  unsubscribed: number;
}

interface ListResponse {
  ok: boolean;
  items?: Subscriber[];
  hasMore?: boolean;
  nextCursor?: string | null;
  stats?: Stats;
  error?: string;
}

interface DiagResponse {
  ok: boolean;
  env: Array<{ name: string; present: boolean; hint?: string }>;
  missingEnv: string[];
  resend: {
    reachable: boolean;
    domains: Array<{ name: string; status: string; region?: string }>;
    error: string | null;
  };
  hints: string[];
}

const dark = {
  bg: '#0d0d0d',
  card: '#161616',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f0f0f0',
  textSecondary: '#a0a0a0',
  textMuted: '#5a5a5a',
  accent: '#f5c542',
  danger: '#ef4444',
  success: '#6ee7b7',
};

export default function AdminSubscribersPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiagResponse | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      return (await getFirebaseAuth().currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }, []);

  const loadPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        setError('Not signed in');
        setLoading(false);
        return;
      }
      try {
        const url = reset
          ? '/api/admin/subscribers/list?pageSize=50'
          : `/api/admin/subscribers/list?pageSize=50&cursor=${encodeURIComponent(cursor ?? '')}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = (await res.json()) as ListResponse;
        if (!res.ok || !json.ok) {
          setError(json.error ?? `HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        const newItems = json.items ?? [];
        setItems(prev => (reset ? newItems : [...prev, ...newItems]));
        setHasMore(Boolean(json.hasMore));
        setCursor(json.nextCursor ?? null);
        if (json.stats) setStats(json.stats);
      } catch (e) {
        setError(String((e as Error).message));
      } finally {
        setLoading(false);
      }
    },
    [cursor, getToken]
  );

  useEffect(() => {
    if (!authLoading && user) {
      void loadPage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function runDiagnostics() {
    const token = await getToken();
    if (!token) return;
    setBusy('diag');
    setDiag(null);
    try {
      const res = await fetch('/api/admin/diag', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as DiagResponse;
      setDiag(json);
    } catch (e) {
      setActionResult(`Diag failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadCsv() {
    const token = await getToken();
    if (!token) return;
    setBusy('csv');
    try {
      const res = await fetch('/api/admin/subscribers/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(`Export HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bananyang-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function sendTestBroadcast() {
    const email = user?.email;
    if (!email) return;
    if (!window.confirm(`Send test broadcast to ${email}?`)) return;
    const token = await getToken();
    if (!token) return;
    setBusy('test');
    setActionResult(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testEmail: email }),
      });
      const json = await res.json();
      setActionResult(
        res.ok && json.ok ? `Test sent to ${email}` : `Test failed: ${json.error ?? res.status}`
      );
    } catch (e) {
      setActionResult(`Test failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function runFullBroadcast() {
    const token = await getToken();
    if (!token) return;
    setBusy('dryrun');
    setActionResult(null);

    // Step 1: dry run to get count
    const dryRes = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dryRun: true }),
    });
    const dry = await dryRes.json();
    if (!dryRes.ok || !dry.ok) {
      setActionResult(`Dry run failed: ${dry.error ?? dryRes.status}`);
      setBusy(null);
      return;
    }
    const count = dry.activeRecipients ?? 0;

    if (
      !window.confirm(
        `BROADCAST to ${count} subscribers?\n\nThis sends the launch announcement email to ALL active recipients.`
      )
    ) {
      setBusy(null);
      setActionResult('Cancelled');
      return;
    }

    // Step 2: paginated broadcast
    setBusy('broadcast');
    let nextCursor: string | null = null;
    let totalSent = 0;
    let totalFailed = 0;
    let pages = 0;

    interface BroadcastResp {
      ok: boolean;
      sent?: number;
      failed?: number;
      nextCursor?: string | null;
      done?: boolean;
      error?: string;
    }

    do {
      pages++;
      const broadcastRes: Response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: true, cursor: nextCursor }),
      });
      const broadcastJson = (await broadcastRes.json()) as BroadcastResp;
      if (!broadcastRes.ok || !broadcastJson.ok) {
        setActionResult(
          `Broadcast failed mid-flight: ${broadcastJson.error ?? broadcastRes.status}`
        );
        setBusy(null);
        return;
      }
      totalSent += broadcastJson.sent ?? 0;
      totalFailed += broadcastJson.failed ?? 0;
      nextCursor = broadcastJson.nextCursor ?? null;
      if (broadcastJson.done) break;
      // small client-side breather between page calls
      await new Promise(r => setTimeout(r, 200));
      if (pages > 200) break; // safety stop at 10k subs
    } while (nextCursor);

    setActionResult(`Broadcast complete. Sent: ${totalSent}, Failed: ${totalFailed}`);
    setBusy(null);
    void loadPage(true);
  }

  /* ─── Render ─── */

  if (authLoading) {
    return <PageShell><p style={pStyle}>Loading…</p></PageShell>;
  }

  if (!user) {
    return (
      <PageShell>
        <h1 style={h1Style}>Admin · Subscribers</h1>
        <p style={pStyle}>You must sign in to view this page.</p>
        <a href="/auth/signin" style={linkStyle}>
          Sign in →
        </a>
      </PageShell>
    );
  }

  if (error === 'Forbidden' || error === 'Admin whitelist not configured') {
    return (
      <PageShell>
        <h1 style={h1Style}>Admin · Subscribers</h1>
        <p style={{ ...pStyle, color: dark.danger }}>
          403 — {error}. Your account ({user.email}) is not on the admin allowlist.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 style={h1Style}>Subscribers</h1>
      <p style={{ ...pStyle, color: dark.textSecondary, marginTop: 0 }}>
        notify_signups · launch waitlist for bananyang.app
      </p>

      {/* Stats */}
      {stats && (
        <div style={statsGrid}>
          <Stat label="Total" value={stats.total} />
          <Stat label="Active" value={stats.active} />
          <Stat label="Welcomed" value={stats.welcomed} />
          <Stat label="Broadcasted" value={stats.broadcasted} />
          <Stat label="Unsubscribed" value={stats.unsubscribed} accent={dark.danger} />
        </div>
      )}

      {/* Actions */}
      <div style={actionsRow}>
        <button
          style={btnSecondary}
          onClick={() => runDiagnostics()}
          disabled={!!busy || loading}
        >
          {busy === 'diag' ? 'Checking…' : 'Run diagnostics'}
        </button>
        <button
          style={btnSecondary}
          onClick={() => downloadCsv()}
          disabled={!!busy || loading}
        >
          {busy === 'csv' ? 'Exporting…' : 'Download CSV'}
        </button>
        <button
          style={btnSecondary}
          onClick={() => sendTestBroadcast()}
          disabled={!!busy || loading}
        >
          {busy === 'test' ? 'Sending…' : 'Send test broadcast to me'}
        </button>
        <button
          style={btnPrimary}
          onClick={() => runFullBroadcast()}
          disabled={!!busy || loading}
        >
          {busy === 'broadcast'
            ? 'Broadcasting…'
            : busy === 'dryrun'
              ? 'Counting…'
              : 'Send launch broadcast to ALL'}
        </button>
      </div>

      {actionResult && (
        <p
          style={{
            ...pStyle,
            color: actionResult.startsWith('Broadcast complete') || actionResult.startsWith('Test sent')
              ? dark.success
              : dark.danger,
            marginTop: 8,
          }}
        >
          {actionResult}
        </p>
      )}

      {error && error !== 'Forbidden' && (
        <p style={{ ...pStyle, color: dark.danger }}>Error: {error}</p>
      )}

      {/* Diagnostics panel */}
      {diag && (
        <div
          style={{
            background: dark.card,
            border: `1px solid ${diag.ok ? dark.border : dark.danger}`,
            borderRadius: 10,
            padding: '16px 18px',
            marginTop: 16,
            fontSize: 13,
            lineHeight: '20px',
          }}
        >
          <div style={{ fontWeight: 600, color: diag.ok ? dark.success : dark.danger, marginBottom: 10 }}>
            {diag.ok ? '✓ Email pipeline healthy' : '✗ Email pipeline has issues'}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ color: dark.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Environment variables
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, color: dark.textSecondary }}>
              {diag.env.map(e => (
                <li key={e.name}>
                  <span style={{ color: e.present ? dark.success : dark.danger }}>
                    {e.present ? '✓' : '✗'}
                  </span>{' '}
                  <code style={{ color: dark.text }}>{e.name}</code>
                  {e.hint && <span style={{ color: dark.textMuted }}> · {e.hint}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ color: dark.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Resend
            </div>
            <div style={{ color: dark.textSecondary }}>
              Reachable:{' '}
              <span style={{ color: diag.resend.reachable ? dark.success : dark.danger }}>
                {diag.resend.reachable ? 'yes' : 'no'}
              </span>
              {diag.resend.error && (
                <span style={{ color: dark.danger }}> · {diag.resend.error}</span>
              )}
            </div>
            {diag.resend.domains.length > 0 && (
              <ul style={{ margin: '6px 0 0 0', paddingLeft: 16, color: dark.textSecondary }}>
                {diag.resend.domains.map(d => (
                  <li key={d.name}>
                    <code style={{ color: dark.text }}>{d.name}</code>{' '}
                    <span
                      style={{
                        color: d.status === 'verified' ? dark.success : dark.danger,
                      }}
                    >
                      [{d.status}]
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {diag.hints.length > 0 && (
            <div>
              <div style={{ color: dark.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Next steps
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, color: dark.textSecondary }}>
                {diag.hints.map((h, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Locale</th>
              <th style={thStyle}>Joined</th>
              <th style={thStyle}>Welcomed</th>
              <th style={thStyle}>Broadcast</th>
              <th style={thStyle}>Unsub</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={tdStyle}>{it.email}</td>
                <td style={tdMutedStyle}>{it.source ?? '—'}</td>
                <td style={tdMutedStyle}>{it.locale ?? '—'}</td>
                <td style={tdMutedStyle}>{fmtDate(it.createdAt)}</td>
                <td style={tdMutedStyle}>{it.welcomeSentAt ? '✓' : '—'}</td>
                <td style={tdMutedStyle}>{it.broadcastSentAt ? '✓' : '—'}</td>
                <td style={tdMutedStyle}>{it.unsubscribedAt ? '✓' : '—'}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdMutedStyle, textAlign: 'center', padding: 28 }}>
                  No subscribers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <button style={btnSecondary} onClick={() => loadPage(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </PageShell>
  );
}

/* ─── Sub-components ─── */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={mainStyle}>
      <div style={containerStyle}>{children}</div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={statCard}>
      <div style={{ color: dark.textMuted, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: accent ?? dark.text, fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/* ─── Styles ─── */

const mainStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: dark.bg,
  color: dark.text,
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  padding: '48px 16px',
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
};

const h1Style: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 600,
  margin: '0 0 4px 0',
  letterSpacing: '-0.01em',
};

const pStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: '22px',
  margin: '12px 0',
};

const linkStyle: React.CSSProperties = {
  color: dark.accent,
  textDecoration: 'none',
  fontSize: 14,
};

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
  margin: '24px 0',
};

const statCard: React.CSSProperties = {
  background: dark.card,
  border: `1px solid ${dark.border}`,
  borderRadius: 10,
  padding: '16px 18px',
};

const actionsRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  margin: '12px 0 8px 0',
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: dark.text,
  border: `1px solid ${dark.border}`,
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  background: dark.accent,
  color: '#1a1a1a',
  border: 'none',
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const tableWrap: React.CSSProperties = {
  background: dark.card,
  border: `1px solid ${dark.border}`,
  borderRadius: 10,
  overflow: 'auto',
  marginTop: 16,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 14px',
  color: dark.textMuted,
  fontWeight: 500,
  borderBottom: `1px solid ${dark.border}`,
  textTransform: 'uppercase',
  fontSize: 11,
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  color: dark.text,
  borderBottom: `1px solid ${dark.border}`,
};

const tdMutedStyle: React.CSSProperties = {
  ...tdStyle,
  color: dark.textSecondary,
};
