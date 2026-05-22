/**
 * BanaNyang Cloud Functions
 *
 * 1) paddleWebhook — Paddle 결제 이벤트 수신 + Firestore 구매 활성화
 * 2) onUserCreated — 신규 사용자 → pending_purchases 확인 후 자동 활성화
 *
 * 설정 필요:
 *   firebase functions:secrets:set PADDLE_WEBHOOK_SECRET
 *   firebase functions:secrets:set PADDLE_API_KEY
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createHmac, timingSafeEqual } from 'crypto';
export { processBatchJob, retryBatchJob } from './batchJobProcessor';
export { detectStuckJobs, cleanupExpiredJobs } from './batchMaintenance';

admin.initializeApp();
const db = admin.firestore();

// ──────────────────────────────────────────────────────────────
// Paddle Webhook 서명 검증
// 헤더 형식: Paddle-Signature: ts=<timestamp>;h1=<hex_signature>
// 서명 대상: `${ts}:${rawBody}`
// ──────────────────────────────────────────────────────────────
function verifyPaddleSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
    if (!signatureHeader || !secret || !rawBody) return false;
    try {
        const parts = signatureHeader.split(';');
        const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
        const h1 = parts.find(p => p.startsWith('h1='))?.split('=')[1];
        if (!ts || !h1) return false;

        const toSign = `${ts}:${rawBody.toString('utf8')}`;
        const expected = createHmac('sha256', secret).update(toSign).digest('hex');

        const expectedBuf = Buffer.from(expected, 'hex');
        const h1Buf = Buffer.from(h1, 'hex');
        if (expectedBuf.length !== h1Buf.length) return false;
        return timingSafeEqual(expectedBuf, h1Buf);
    } catch (e) {
        functions.logger.error('Paddle signature verification error:', e);
        return false;
    }
}

// ──────────────────────────────────────────────────────────────
// Paddle 고객 이메일 조회 (API)
// ──────────────────────────────────────────────────────────────
async function getPaddleCustomerEmail(customerId: string, apiKey: string): Promise<string | null> {
    try {
        const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return null;
        const json = await res.json() as { data?: { email?: string } };
        return json.data?.email?.toLowerCase() ?? null;
    } catch (e) {
        functions.logger.error('Paddle customer lookup error:', e);
        return null;
    }
}

// ──────────────────────────────────────────────────────────────
// 1) Paddle Webhook Endpoint
// ──────────────────────────────────────────────────────────────
export const paddleWebhook = functions
    .runWith({ secrets: ['PADDLE_WEBHOOK_SECRET', 'PADDLE_API_KEY'] })
    .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const signatureHeader = req.headers['paddle-signature'] as string;
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    const apiKey = process.env.PADDLE_API_KEY;

    if (!webhookSecret) {
        functions.logger.error('[paddleWebhook] PADDLE_WEBHOOK_SECRET not configured');
        res.status(500).send('Webhook secret not configured');
        return;
    }

    if (!verifyPaddleSignature(req.rawBody, signatureHeader, webhookSecret)) {
        functions.logger.error('[paddleWebhook] Invalid signature');
        res.status(401).send('Invalid signature');
        return;
    }

    const payload = req.body as Record<string, any>;
    const eventType: string = payload.event_type ?? '';
    const data = payload.data as Record<string, any>;

    functions.logger.info('[paddleWebhook] Received event:', eventType);

    // ─── 구매 완료: transaction.completed ───
    if (eventType === 'transaction.completed') {
        const transactionId: string = data?.id ?? '';
        const customerId: string = data?.customer_id ?? '';
        const subscriptionId: string | null = data?.subscription_id ?? null;
        const customData = data?.custom_data as Record<string, any> | null;

        // 금액 검증 — $19.99 USD 외 결제는 활성화 거부
        const totals = data?.details?.totals as Record<string, any> | undefined;
        const total = parseInt(totals?.total ?? '0', 10) / 100;
        const currency: string = totals?.currency_code ?? 'USD';
        const EXPECTED_CENTS = 1999;
        if (Math.round(total * 100) !== EXPECTED_CENTS || currency !== 'USD') {
            functions.logger.warn('[paddleWebhook] Amount mismatch — skipping activation', {
                transactionId, total, currency, expectedUsd: 19.99,
            });
            res.status(200).send('OK - Amount mismatch');
            return;
        }

        // 이메일: custom_data 우선, 없으면 Paddle API 조회
        let email = (customData?.email as string | undefined)?.toLowerCase() ?? null;
        if (!email && customerId && apiKey) {
            email = await getPaddleCustomerEmail(customerId, apiKey);
        }

        if (!email) {
            functions.logger.error('[paddleWebhook] Could not resolve customer email', { transactionId, customerId });
            res.status(200).send('OK - No email');
            return;
        }

        const plan = subscriptionId ? 'subscription' : 'lifetime';

        try {
            let uid: string | null = null;
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                uid = userRecord.uid;
            } catch {
                uid = null;
            }

            if (uid) {
                await db.doc(`users/${uid}`).set({
                    email,
                    uid,
                    hasPurchased: true,
                    purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
                    plan,
                    paddleTransactionId: transactionId,
                }, { merge: true });

                functions.logger.info(`[paddleWebhook] Activated for ${email} (uid: ${uid})`);
            } else {
                await db.collection('pending_purchases').doc(email).set({
                    email,
                    hasPurchased: true,
                    purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
                    plan,
                    paddleTransactionId: transactionId,
                    activatedAt: null,
                });

                functions.logger.info(`[paddleWebhook] Saved pending purchase for ${email}`);
            }

            res.status(200).send('OK');
        } catch (error) {
            functions.logger.error('[paddleWebhook] Processing error:', error);
            res.status(500).send('Internal Error');
        }
        return;
    }

    // ─── 구독 생성: subscription.created ───
    if (eventType === 'subscription.created') {
        const subscriptionId: string = data?.id ?? '';
        const customerId: string = data?.customer_id ?? '';
        const transactionId: string = data?.transaction_id ?? subscriptionId;

        let email: string | null = null;
        if (customerId && apiKey) {
            email = await getPaddleCustomerEmail(customerId, apiKey);
        }

        if (!email) {
            functions.logger.error('[paddleWebhook] Could not resolve customer email for subscription', { subscriptionId });
            res.status(200).send('OK - No email');
            return;
        }

        try {
            let uid: string | null = null;
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                uid = userRecord.uid;
            } catch {
                uid = null;
            }

            if (uid) {
                await db.doc(`users/${uid}`).set({
                    email,
                    uid,
                    hasPurchased: true,
                    purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
                    plan: 'subscription',
                    paddleTransactionId: transactionId,
                }, { merge: true });

                functions.logger.info(`[paddleWebhook] Subscription activated for ${email}`);
            } else {
                await db.collection('pending_purchases').doc(email).set({
                    email,
                    hasPurchased: true,
                    purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
                    plan: 'subscription',
                    paddleTransactionId: transactionId,
                    activatedAt: null,
                });

                functions.logger.info(`[paddleWebhook] Saved pending subscription for ${email}`);
            }

            res.status(200).send('OK');
        } catch (error) {
            functions.logger.error('[paddleWebhook] Subscription processing error:', error);
            res.status(500).send('Internal Error');
        }
        return;
    }

    // ─── 환불: transaction.updated (status: refunded) ───
    if (eventType === 'transaction.updated') {
        const status: string = data?.status ?? '';
        if (status !== 'refunded') {
            res.status(200).send('OK - Ignored');
            return;
        }

        const transactionId: string = data?.id ?? '';
        const customerId: string = data?.customer_id ?? '';

        let email: string | null = null;
        if (customerId && apiKey) {
            email = await getPaddleCustomerEmail(customerId, apiKey);
        }

        if (!email || !transactionId) {
            res.status(200).send('OK - No data');
            return;
        }

        try {
            let uid: string | null = null;
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                uid = userRecord.uid;
            } catch {
                uid = null;
            }

            if (uid) {
                await db.doc(`users/${uid}`).set({
                    hasPurchased: false,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

                functions.logger.info(`[paddleWebhook] Refund processed for ${email}`);
            }

            res.status(200).send('OK');
        } catch (error) {
            functions.logger.error('[paddleWebhook] Refund processing error:', error);
            res.status(500).send('Internal Error');
        }
        return;
    }

    res.status(200).send('OK - Ignored event');
});

// ──────────────────────────────────────────────────────────────
// 2) onUserCreated — 신규 유저 생성 시 pending_purchases 확인
// ──────────────────────────────────────────────────────────────
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
    const email = user.email?.toLowerCase();
    const uid = user.uid;

    functions.logger.info(`[onUserCreated] New user: ${email} (${uid})`);

    if (!email) return;

    try {
        const pendingDoc = await db.doc(`pending_purchases/${email}`).get();

        if (pendingDoc.exists && pendingDoc.data()?.hasPurchased) {
            const pendingData = pendingDoc.data()!;

            await db.doc(`users/${uid}`).set({
                email,
                uid,
                hasPurchased: true,
                purchasedAt: pendingData.purchasedAt,
                plan: pendingData.plan ?? 'lifetime',
                paddleTransactionId: pendingData.paddleTransactionId ?? null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await db.doc(`pending_purchases/${email}`).update({
                activatedAt: admin.firestore.FieldValue.serverTimestamp(),
                activatedUid: uid,
            });

            functions.logger.info(`[onUserCreated] Auto-activated purchase for ${email}`);
        } else {
            await db.doc(`users/${uid}`).set({
                email,
                uid,
                hasPurchased: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.info(`[onUserCreated] Created profile for ${email} (no purchase)`);
        }
    } catch (error) {
        functions.logger.error(`[onUserCreated] Error processing user ${email}:`, error);
    }
});
