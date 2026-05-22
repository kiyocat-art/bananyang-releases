/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/admin/broadcast — sends LaunchAnnouncement email.
   Modes:
     { testEmail: "x@y" }       → send 1 email to test address
     { dryRun: true }           → just count recipients, no send
     { confirm: true }          → real broadcast to all active subscribers
   Admin-only. Chunks Firestore reads + Resend calls to stay under Vercel 10s.
   ───────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAdminToken, AdminAuthError } from '@/lib/admin-auth';
import { getResend, getEmailFrom, getSiteUrl } from '@/lib/resend';
import { signUnsubscribeToken } from '@/lib/subscriber-token';
import { LaunchAnnouncement } from '@/emails/LaunchAnnouncement';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  testEmail: z.string().email().max(254).optional(),
  dryRun: z.boolean().optional(),
  confirm: z.boolean().optional(),
  cursor: z.string().optional(),
  chunkSize: z.number().int().positive().max(100).optional(),
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  /* ─── Auth ─── */
  try {
    await verifyAdminToken(req);
  } catch (e) {
    const err = e as AdminAuthError;
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 401 });
  }

  /* ─── Parse ─── */
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    /* empty body allowed */
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const { testEmail, dryRun, confirm, cursor, chunkSize } = parsed.data;

  const db = getAdminDb();
  const siteUrl = getSiteUrl();
  const logoUrl = `${siteUrl}/bananyang-icon.png`;

  /* ─── Test mode ─── */
  if (testEmail) {
    try {
      const resend = getResend();
      const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${signUnsubscribeToken(testEmail)}`;
      await resend.emails.send({
        from: getEmailFrom(),
        to: testEmail,
        subject: 'BanaNyang is now available',
        react: LaunchAnnouncement({ siteUrl, logoUrl, unsubscribeUrl }),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      return NextResponse.json({ ok: true, mode: 'test', sentTo: testEmail });
    } catch (err) {
      console.error('[api/admin/broadcast] test send error:', err);
      return NextResponse.json(
        { ok: false, error: 'send_failed', detail: String((err as Error)?.message ?? err) },
        { status: 500 }
      );
    }
  }

  /* ─── Dry run — count only ─── */
  if (dryRun) {
    const snap = await db.collection('notify_signups').get();
    let active = 0;
    snap.forEach(d => {
      const x = d.data();
      if (!x.unsubscribedAt && x.email) active++;
    });
    return NextResponse.json({ ok: true, mode: 'dry_run', activeRecipients: active });
  }

  /* ─── Real broadcast — paginated ─── */
  if (!confirm) {
    return NextResponse.json(
      { ok: false, error: 'confirm_required' },
      { status: 400 }
    );
  }

  const CHUNK = chunkSize ?? 50;
  let query = db
    .collection('notify_signups')
    .orderBy('createdAt', 'asc')
    .limit(CHUNK);

  if (cursor) {
    const cursorDoc = await db.collection('notify_signups').doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  if (snap.empty) {
    return NextResponse.json({ ok: true, mode: 'broadcast', done: true, sent: 0, failed: 0 });
  }

  const resend = getResend();
  const recipients = snap.docs.filter(d => {
    const x = d.data();
    return x.email && !x.unsubscribedAt && !x.broadcastSentAt;
  });

  let sent = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  // Resend batch supports up to 100 emails per request — we send our chunk in one batch
  if (recipients.length > 0) {
    const payload = recipients.map(d => {
      const email = String(d.data().email);
      const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${signUnsubscribeToken(email)}`;
      return {
        from: getEmailFrom(),
        to: email,
        subject: 'BanaNyang is now available',
        react: LaunchAnnouncement({ siteUrl, logoUrl, unsubscribeUrl }),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    });

    try {
      const batchResult = await resend.batch.send(payload);
      const data = (batchResult as { data?: { data?: Array<{ id?: string }> } }).data;
      const items = data?.data ?? [];
      // Mark each doc; if Resend partial-failed, batch.send throws — treat as all-or-nothing
      const updates = recipients.map((d, idx) => {
        const okItem = items[idx];
        if (okItem?.id) {
          sent++;
          return d.ref.update({
            broadcastSentAt: FieldValue.serverTimestamp(),
            broadcastMessageId: okItem.id,
          });
        }
        failed++;
        return d.ref.update({
          broadcastError: 'no_id_returned',
        });
      });
      await Promise.allSettled(updates);
    } catch (err) {
      failed = recipients.length;
      errors.push({ email: 'batch', error: String((err as Error)?.message ?? err) });
      console.error('[api/admin/broadcast] batch error:', err);
    }

    await sleep(50);
  }

  const lastDocId = snap.docs[snap.docs.length - 1].id;
  const done = snap.docs.length < CHUNK;
  return NextResponse.json({
    ok: true,
    mode: 'broadcast',
    sent,
    failed,
    skipped: snap.docs.length - recipients.length,
    nextCursor: done ? null : lastDocId,
    done,
    errors,
  });
}
