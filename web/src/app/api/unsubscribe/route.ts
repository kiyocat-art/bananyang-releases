/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/unsubscribe?token=... — one-click unsubscribe (mail header)
   POST /api/unsubscribe { token } — same, via form
   Marks the matching notify_signups doc with unsubscribedAt; broadcast filters it.
   ───────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUnsubscribeToken } from '@/lib/subscriber-token';

export const runtime = 'nodejs';

async function unsubscribe(token: string): Promise<{ ok: boolean; status: number }> {
  const email = verifyUnsubscribeToken(token);
  if (!email) return { ok: false, status: 400 };

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('notify_signups')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (snap.empty) {
      // Idempotent: treat unknown email as success so user sees confirmation
      return { ok: true, status: 200 };
    }
    await snap.docs[0].ref.update({ unsubscribedAt: FieldValue.serverTimestamp() });
    return { ok: true, status: 200 };
  } catch (err) {
    console.error('[api/unsubscribe] error:', err);
    return { ok: false, status: 500 };
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const r = await unsubscribe(token);
  return NextResponse.json({ ok: r.ok }, { status: r.status });
}

export async function POST(req: NextRequest) {
  let token = '';
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = await req.json();
      token = typeof body?.token === 'string' ? body.token : '';
    } catch {
      /* noop */
    }
  } else {
    const form = await req.formData().catch(() => null);
    if (form) token = String(form.get('token') ?? '');
  }

  const r = await unsubscribe(token);
  return NextResponse.json({ ok: r.ok }, { status: r.status });
}
