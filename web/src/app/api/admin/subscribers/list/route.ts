/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/admin/subscribers/list?cursor=<docId>&pageSize=50
   Returns paginated subscriber list. Admin-only.
   ───────────────────────────────────────────────────────────────────────────── */

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAdminToken, AdminAuthError } from '@/lib/admin-auth';

export const runtime = 'nodejs';

function tsToIso(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);
  } catch (e) {
    const err = e as AdminAuthError;
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 401 });
  }

  const pageSize = Math.min(
    Number(req.nextUrl.searchParams.get('pageSize') ?? '50') || 50,
    200
  );
  const cursor = req.nextUrl.searchParams.get('cursor') ?? '';

  try {
    const db = getAdminDb();
    let query = db
      .collection('notify_signups')
      .orderBy('createdAt', 'desc')
      .limit(pageSize + 1);

    if (cursor) {
      const cursorDoc = await db.collection('notify_signups').doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snap = await query.get();
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map(d => {
      const data = d.data();
      return {
        id: d.id,
        email: String(data.email ?? ''),
        source: data.source ?? null,
        locale: data.locale ?? null,
        createdAt: tsToIso(data.createdAt),
        welcomeSentAt: tsToIso(data.welcomeSentAt),
        broadcastSentAt: tsToIso(data.broadcastSentAt),
        unsubscribedAt: tsToIso(data.unsubscribedAt),
      };
    });

    // Aggregate stats (small collection — full scan acceptable for now)
    const allSnap = await db.collection('notify_signups').get();
    let total = 0;
    let active = 0;
    let welcomed = 0;
    let broadcasted = 0;
    let unsubscribed = 0;
    allSnap.forEach(d => {
      total++;
      const x = d.data();
      if (x.unsubscribedAt) unsubscribed++;
      else active++;
      if (x.welcomeSentAt) welcomed++;
      if (x.broadcastSentAt) broadcasted++;
    });

    return NextResponse.json({
      ok: true,
      items,
      hasMore,
      nextCursor: hasMore ? docs[pageSize - 1].id : null,
      stats: { total, active, welcomed, broadcasted, unsubscribed },
    });
  } catch (err) {
    console.error('[api/admin/list] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
