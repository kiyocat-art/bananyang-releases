/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/subscribe — public signup endpoint.
   - validates input (zod)
   - IP rate limit (in-memory, per-instance)
   - dedupes by email
   - writes Firestore notify_signups
   - sends welcome email via Resend
   - updates welcomeSentAt on success
   ───────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getResend, getEmailFrom, getSiteUrl } from '@/lib/resend';
import { signUnsubscribeToken } from '@/lib/subscriber-token';
import { WelcomeEmail } from '@/emails/WelcomeEmail';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(16).optional(),
});

/* ─── In-memory rate limit (per Vercel instance) ─── */
const RATE_WINDOW_MS = 60_000;
const ipHits = new Map<string, number>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const last = ipHits.get(ip) ?? 0;
  if (now - last < RATE_WINDOW_MS) return true;
  ipHits.set(ip, now);
  // Garbage-collect old entries when map grows
  if (ipHits.size > 5000) {
    for (const [k, t] of ipHits) {
      if (now - t > RATE_WINDOW_MS) ipHits.delete(k);
    }
  }
  return false;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  /* ─── Parse + validate ─── */
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  const { email, source, locale } = parsed.data;

  /* ─── Rate limit ─── */
  const ip = getClientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  /* ─── Firestore dedupe + write ─── */
  let docId: string;
  let alreadySubscribed = false;
  try {
    const db = getAdminDb();
    const col = db.collection('notify_signups');
    const existing = await col.where('email', '==', email).limit(1).get();

    if (!existing.empty) {
      alreadySubscribed = true;
      docId = existing.docs[0].id;
    } else {
      const ref = await col.add({
        email,
        source: source ?? 'download_section',
        locale: locale ?? null,
        createdAt: FieldValue.serverTimestamp(),
        welcomeSentAt: null,
        broadcastSentAt: null,
        unsubscribedAt: null,
      });
      docId = ref.id;
    }
  } catch (err) {
    console.error('[api/subscribe] firestore error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }

  /* ─── Send welcome email (skip if already subscribed) ─── */
  if (!alreadySubscribed) {
    const siteUrl = getSiteUrl();
    const logoUrl = `${siteUrl}/bananyang-icon.png`;
    const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${signUnsubscribeToken(email)}`;

    try {
      const resend = getResend();
      await resend.emails.send({
        from: getEmailFrom(),
        to: email,
        subject: "You're on the BanaNyang waitlist",
        react: WelcomeEmail({ siteUrl, logoUrl, unsubscribeUrl }),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      await getAdminDb()
        .collection('notify_signups')
        .doc(docId)
        .update({ welcomeSentAt: FieldValue.serverTimestamp() });
    } catch (err) {
      // Don't fail the signup if email send blows up — log + continue.
      console.error('[api/subscribe] resend error:', err);
      try {
        await getAdminDb()
          .collection('notify_signups')
          .doc(docId)
          .update({
            welcomeSentAt: null,
            welcomeError: String((err as Error)?.message ?? err).slice(0, 500),
          });
      } catch {
        /* swallow */
      }
    }
  }

  return NextResponse.json({ ok: true, alreadySubscribed });
}
