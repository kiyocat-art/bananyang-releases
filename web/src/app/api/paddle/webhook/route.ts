import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { generateLicenseKey } from '@/lib/license';
import { getAdminDb } from '@/lib/firebase-admin';
import { EXPECTED_PURCHASE_AMOUNT_USD, isAmountValid } from '@/lib/pricing';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

/* ─── Paddle 서명 검증 ───
 * 헤더 형식: Paddle-Signature: ts=<timestamp>;h1=<hex>
 * 서명 대상: `${ts}:${rawBody}`
 */
function verifyPaddleSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return false;

  const parts = signatureHeader.split(';');
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
  const h1 = parts.find(p => p.startsWith('h1='))?.split('=')[1];
  if (!ts || !h1) return false;

  const toSign = `${ts}:${rawBody}`;
  const expected = createHmac('sha256', secret).update(toSign).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(h1, 'hex'));
  } catch {
    return false;
  }
}

/* ─── Paddle 고객 이메일 조회 ─── */
async function getPaddleCustomerEmail(customerId: string): Promise<string | null> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey || !customerId) return null;

  try {
    const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { email?: string } };
    return json.data?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('paddle-signature') ?? '';

  if (!verifyPaddleSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.event_type as string | undefined;
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return NextResponse.json({ ok: true });

  const db = getAdminDb();

  /* ─── transaction.completed ─── */
  if (eventType === 'transaction.completed') {
    const transactionId = data.id as string;
    const customerId = data.customer_id as string;
    const subscriptionId = data.subscription_id as string | null ?? null;
    const customData = data.custom_data as Record<string, unknown> | null;

    let email = (customData?.email as string | undefined)?.toLowerCase() ?? null;
    if (!email) email = await getPaddleCustomerEmail(customerId);
    if (!email) return NextResponse.json({ ok: true });

    /* Idempotency */
    const purchaseRef = db.collection('purchases').doc(transactionId);
    const existing = await purchaseRef.get();
    if (existing.exists) return NextResponse.json({ ok: true });

    /* Find user by email */
    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    const uid = usersSnap.empty ? null : usersSnap.docs[0].id;

    const plan = subscriptionId ? 'subscription' : 'lifetime';
    const totalDetails = (data.details as Record<string, unknown> | undefined)?.totals as Record<string, unknown> | undefined;
    const total = parseInt((totalDetails?.total as string | undefined) ?? '0', 10) / 100;
    const currency = (totalDetails?.currency_code as string | undefined) ?? 'USD';

    /* 금액 검증 — 기대값 외 결제는 라이선스 미발급 */
    if (!isAmountValid(total, currency)) {
      console.error('[paddleWebhook] Amount mismatch — refusing license issue', {
        transactionId, total, currency, expected: EXPECTED_PURCHASE_AMOUNT_USD,
      });
      await purchaseRef.set({
        uid: uid ?? null,
        email,
        customerId: customerId ?? null,
        status: 'rejected_amount_mismatch',
        amount: total,
        currency,
        licenseKey: null,
        invoiceUrl: null,
        items: [{ productName: 'BanaNyang', quantity: 1 }],
        purchasedAt: FieldValue.serverTimestamp(),
        provider: 'paddle',
        plan,
      });
      return NextResponse.json({ ok: true });
    }

    const licenseKey = generateLicenseKey();

    await purchaseRef.set({
      uid: uid ?? null,
      email,
      customerId: customerId ?? null,
      status: 'completed',
      amount: total,
      currency,
      licenseKey,
      invoiceUrl: null,
      items: [{ productName: 'BanaNyang', quantity: 1 }],
      purchasedAt: FieldValue.serverTimestamp(),
      provider: 'paddle',
      plan,
    });

    await db.collection('licenses').doc(licenseKey).set({
      uid: uid ?? null,
      email,
      orderId: transactionId,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (uid) {
      await db.collection('users').doc(uid).update({
        hasPurchased: true,
        paddleTransactionId: transactionId,
        plan,
        purchasedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  }

  /* ─── transaction.updated (환불) ─── */
  if (eventType === 'transaction.updated') {
    const status = data.status as string;
    if (status !== 'refunded') return NextResponse.json({ ok: true });

    const transactionId = data.id as string;
    const purchaseRef = db.collection('purchases').doc(transactionId);
    const snap = await purchaseRef.get();
    if (!snap.exists) return NextResponse.json({ ok: true });

    const purchaseData = snap.data()!;
    const { uid, licenseKey } = purchaseData;

    if (licenseKey) {
      await db.collection('licenses').doc(licenseKey).update({ active: false });
    }

    await purchaseRef.update({ status: 'refunded' });

    if (uid) {
      await db.collection('users').doc(uid).update({
        hasPurchased: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
