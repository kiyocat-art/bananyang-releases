"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreated = exports.paddleWebhook = exports.cleanupExpiredJobs = exports.detectStuckJobs = exports.retryBatchJob = exports.processBatchJob = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
var batchJobProcessor_1 = require("./batchJobProcessor");
Object.defineProperty(exports, "processBatchJob", { enumerable: true, get: function () { return batchJobProcessor_1.processBatchJob; } });
Object.defineProperty(exports, "retryBatchJob", { enumerable: true, get: function () { return batchJobProcessor_1.retryBatchJob; } });
var batchMaintenance_1 = require("./batchMaintenance");
Object.defineProperty(exports, "detectStuckJobs", { enumerable: true, get: function () { return batchMaintenance_1.detectStuckJobs; } });
Object.defineProperty(exports, "cleanupExpiredJobs", { enumerable: true, get: function () { return batchMaintenance_1.cleanupExpiredJobs; } });
admin.initializeApp();
const db = admin.firestore();
// ──────────────────────────────────────────────────────────────
// Paddle Webhook 서명 검증
// 헤더 형식: Paddle-Signature: ts=<timestamp>;h1=<hex_signature>
// 서명 대상: `${ts}:${rawBody}`
// ──────────────────────────────────────────────────────────────
function verifyPaddleSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret || !rawBody)
        return false;
    try {
        const parts = signatureHeader.split(';');
        const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
        const h1 = parts.find(p => p.startsWith('h1='))?.split('=')[1];
        if (!ts || !h1)
            return false;
        const toSign = `${ts}:${rawBody.toString('utf8')}`;
        const expected = (0, crypto_1.createHmac)('sha256', secret).update(toSign).digest('hex');
        const expectedBuf = Buffer.from(expected, 'hex');
        const h1Buf = Buffer.from(h1, 'hex');
        if (expectedBuf.length !== h1Buf.length)
            return false;
        return (0, crypto_1.timingSafeEqual)(expectedBuf, h1Buf);
    }
    catch (e) {
        functions.logger.error('Paddle signature verification error:', e);
        return false;
    }
}
// ──────────────────────────────────────────────────────────────
// Paddle 고객 이메일 조회 (API)
// ──────────────────────────────────────────────────────────────
async function getPaddleCustomerEmail(customerId, apiKey) {
    try {
        const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok)
            return null;
        const json = await res.json();
        return json.data?.email?.toLowerCase() ?? null;
    }
    catch (e) {
        functions.logger.error('Paddle customer lookup error:', e);
        return null;
    }
}
// ──────────────────────────────────────────────────────────────
// 1) Paddle Webhook Endpoint
// ──────────────────────────────────────────────────────────────
exports.paddleWebhook = functions
    .runWith({ secrets: ['PADDLE_WEBHOOK_SECRET', 'PADDLE_API_KEY'] })
    .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const signatureHeader = req.headers['paddle-signature'];
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
    const payload = req.body;
    const eventType = payload.event_type ?? '';
    const data = payload.data;
    functions.logger.info('[paddleWebhook] Received event:', eventType);
    // ─── 구매 완료: transaction.completed ───
    if (eventType === 'transaction.completed') {
        const transactionId = data?.id ?? '';
        const customerId = data?.customer_id ?? '';
        const subscriptionId = data?.subscription_id ?? null;
        const customData = data?.custom_data;
        // 금액 검증 — $19.99 USD 외 결제는 활성화 거부
        const totals = data?.details?.totals;
        const total = parseInt(totals?.total ?? '0', 10) / 100;
        const currency = totals?.currency_code ?? 'USD';
        const EXPECTED_CENTS = 1999;
        if (Math.round(total * 100) !== EXPECTED_CENTS || currency !== 'USD') {
            functions.logger.warn('[paddleWebhook] Amount mismatch — skipping activation', {
                transactionId, total, currency, expectedUsd: 19.99,
            });
            res.status(200).send('OK - Amount mismatch');
            return;
        }
        // 이메일: custom_data 우선, 없으면 Paddle API 조회
        let email = customData?.email?.toLowerCase() ?? null;
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
            let uid = null;
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                uid = userRecord.uid;
            }
            catch {
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
            }
            else {
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
        }
        catch (error) {
            functions.logger.error('[paddleWebhook] Processing error:', error);
            res.status(500).send('Internal Error');
        }
        return;
    }
    // ─── 구독 생성: subscription.created ───
    if (eventType === 'subscription.created') {
        const subscriptionId = data?.id ?? '';
        const customerId = data?.customer_id ?? '';
        const transactionId = data?.transaction_id ?? subscriptionId;
        let email = null;
        if (customerId && apiKey) {
            email = await getPaddleCustomerEmail(customerId, apiKey);
        }
        if (!email) {
            functions.logger.error('[paddleWebhook] Could not resolve customer email for subscription', { subscriptionId });
            res.status(200).send('OK - No email');
            return;
        }
        try {
            let uid = null;
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                uid = userRecord.uid;
            }
            catch {
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
            }
            else {
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
        }
        catch (error) {
            functions.logger.error('[paddleWebhook] Subscription processing error:', error);
            res.status(500).send('Internal Error');
        }
        return;
    }
    // ─── 환불: transaction.updated (status: refunded) ───
    if (eventType === 'transaction.updated') {
        const status = data?.status ?? '';
        if (status !== 'refunded') {
            res.status(200).send('OK - Ignored');
            return;
        }
        const transactionId = data?.id ?? '';
        const customerId = data?.customer_id ?? '';
        let email = null;
        if (customerId && apiKey) {
            email = await getPaddleCustomerEmail(customerId, apiKey);
        }
        if (!email || !transactionId) {
            res.status(200).send('OK - No data');
            return;
        }
        try {
            let uid = null;
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                uid = userRecord.uid;
            }
            catch {
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
        }
        catch (error) {
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
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    const email = user.email?.toLowerCase();
    const uid = user.uid;
    functions.logger.info(`[onUserCreated] New user: ${email} (${uid})`);
    if (!email)
        return;
    try {
        const pendingDoc = await db.doc(`pending_purchases/${email}`).get();
        if (pendingDoc.exists && pendingDoc.data()?.hasPurchased) {
            const pendingData = pendingDoc.data();
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
        }
        else {
            await db.doc(`users/${uid}`).set({
                email,
                uid,
                hasPurchased: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            functions.logger.info(`[onUserCreated] Created profile for ${email} (no purchase)`);
        }
    }
    catch (error) {
        functions.logger.error(`[onUserCreated] Error processing user ${email}:`, error);
    }
});
//# sourceMappingURL=index.js.map