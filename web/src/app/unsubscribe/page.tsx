/* ─────────────────────────────────────────────────────────────────────────────
   /unsubscribe — public page reached from email footer link.
   Server component: verifies the token + updates Firestore on the server.
   ───────────────────────────────────────────────────────────────────────────── */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUnsubscribeToken } from '@/lib/subscriber-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

async function applyUnsubscribe(token: string): Promise<
  | { status: 'ok'; email: string }
  | { status: 'invalid' }
  | { status: 'error' }
> {
  const email = verifyUnsubscribeToken(token);
  if (!email) return { status: 'invalid' };

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('notify_signups')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ unsubscribedAt: FieldValue.serverTimestamp() });
    }
    return { status: 'ok', email };
  } catch (e) {
    console.error('[unsubscribe] error:', e);
    return { status: 'error' };
  }
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const result = token ? await applyUnsubscribe(token) : { status: 'invalid' as const };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        color: '#f0f0f0',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          background: '#161616',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '40px 36px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 36,
            height: 3,
            backgroundColor: '#f5c542',
            borderRadius: 2,
            margin: '0 auto 24px auto',
          }}
        />
        {result.status === 'ok' ? (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 14px 0' }}>
              You're unsubscribed.
            </h1>
            <p style={{ color: '#a0a0a0', fontSize: 14, lineHeight: '22px', margin: 0 }}>
              We won't send any more emails to <strong style={{ color: '#f0f0f0' }}>{result.email}</strong>.
              You're welcome to sign up again anytime at{' '}
              <a href="/" style={{ color: '#f5c542', textDecoration: 'none' }}>
                bananyang.app
              </a>
              .
            </p>
          </>
        ) : result.status === 'invalid' ? (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 14px 0' }}>
              Invalid link
            </h1>
            <p style={{ color: '#a0a0a0', fontSize: 14, lineHeight: '22px', margin: 0 }}>
              This unsubscribe link is missing or has been tampered with. If you keep receiving
              emails, please{' '}
              <a href="/contact" style={{ color: '#f5c542', textDecoration: 'none' }}>
                contact us
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 14px 0' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#a0a0a0', fontSize: 14, lineHeight: '22px', margin: 0 }}>
              We couldn't process your request right now. Please try again in a few minutes, or{' '}
              <a href="/contact" style={{ color: '#f5c542', textDecoration: 'none' }}>
                contact us
              </a>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
