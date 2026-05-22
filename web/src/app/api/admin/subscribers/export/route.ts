/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/admin/subscribers/export — CSV download. Admin-only.
   ───────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAdminToken, AdminAuthError } from '@/lib/admin-auth';

export const runtime = 'nodejs';

function tsToIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return '';
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
  } catch (e) {
    const err = e as AdminAuthError;
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 401 });
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection('notify_signups').orderBy('createdAt', 'desc').get();

    const header = [
      'email',
      'source',
      'locale',
      'createdAt',
      'welcomeSentAt',
      'broadcastSentAt',
      'unsubscribedAt',
    ];
    const rows: string[] = [header.join(',')];
    snap.forEach(d => {
      const x = d.data();
      rows.push(
        [
          csvEscape(x.email),
          csvEscape(x.source ?? ''),
          csvEscape(x.locale ?? ''),
          csvEscape(tsToIso(x.createdAt)),
          csvEscape(tsToIso(x.welcomeSentAt)),
          csvEscape(tsToIso(x.broadcastSentAt)),
          csvEscape(tsToIso(x.unsubscribedAt)),
        ].join(',')
      );
    });

    const csv = rows.join('\n');
    const filename = `bananyang-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[api/admin/export] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
