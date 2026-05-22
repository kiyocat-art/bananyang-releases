import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

/* ─── POST /api/license/verify ───────────────────────────────────────────────
   Body: { key: string }
   Headers (optional): Authorization: Bearer <Firebase ID Token>

   Returns:
     200 { valid: true, transactionId: string }
     400 { valid: false, error: 'invalid_format' }
     403 { valid: false, error: 'revoked' }
     404 { valid: false, error: 'not_found' }
   ─────────────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: 'invalid_body' }, { status: 400 });
  }

  const { key } = body;

  /* Format validation */
  if (!key || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
    return NextResponse.json({ valid: false, error: 'invalid_format' }, { status: 400 });
  }

  const db = getAdminDb();

  /* Look up license */
  const licenseRef = db.collection('licenses').doc(key);
  const licenseSnap = await licenseRef.get();

  if (!licenseSnap.exists) {
    return NextResponse.json({ valid: false, error: 'not_found' }, { status: 404 });
  }

  const license = licenseSnap.data()!;

  if (!license.active) {
    return NextResponse.json({ valid: false, error: 'revoked' }, { status: 403 });
  }

  /* If caller is logged in, link license to their account */
  const idToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (idToken) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      const uid = decoded.uid;

      /* Only link if not already linked to another user */
      if (!license.uid || license.uid === uid) {
        if (!license.uid) {
          await licenseRef.update({ uid, activatedAt: FieldValue.serverTimestamp() });

          /* Also update the purchase record */
          if (license.orderId) {
            await db.collection('purchases').doc(license.orderId).update({ uid });
          }

          /* Set hasPurchase flag on user */
          await db.collection('users').doc(uid).set(
            { hasPurchase: true, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }
      }
    } catch {
      /* Token verification failure is non-fatal — just skip linking */
    }
  }

  return NextResponse.json({ valid: true, transactionId: license.orderId ?? null });
}
