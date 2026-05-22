/**
 * batchMaintenance.ts
 *
 * Cloud Functions for batch_jobs 유지관리:
 *
 * 1) detectStuckJobs  — Cloud Scheduler (매 30분)
 *    processing 상태에서 멈춘 잡을 복구하거나 48시간 초과 시 실패 처리
 *
 * 2) cleanupExpiredJobs — Cloud Scheduler (매일 02:00 KST)
 *    완료/실패 잡 7일 후 삭제 + 48시간 초과 미처리 잡 강제 실패
 *
 * 배포:
 *   firebase deploy --only functions:detectStuckJobs,functions:cleanupExpiredJobs
 *
 * Cloud Scheduler 설정 (Firebase Console > Functions > Scheduler):
 *   detectStuckJobs  : "every 30 minutes"
 *   cleanupExpiredJobs: "every day 17:00" (= KST 02:00)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const STUCK_TIMEOUT_MS = 15 * 60 * 1000;        // 15분
const GOOGLE_BATCH_TTL_MS = 48 * 60 * 60 * 1000; // 48시간 (Google Batch API 보관 기간)
const JOB_RETENTION_DAYS = 7;                    // 완료 잡 보관 기간

const db = () => admin.firestore();

// ──────────────────────────────────────────────────────────────
// 1) detectStuckJobs
// ──────────────────────────────────────────────────────────────

/**
 * 멈춘 잡을 탐지하여 복구:
 *
 * [processing stuck] startedAt < 15분 전
 *   - 48h 미만: status → 'pending' 리셋 → retryBatchJob onUpdate 트리거 실행
 *   - 48h 초과: status → 'failed'
 *
 * [pending stuck] createdAt < 15분 전 (onCreate가 한 번도 실행되지 않은 경우)
 *   - 48h 미만: _retryAt 갱신 → retryBatchJob onUpdate 트리거 실행
 *   - 48h 초과: status → 'failed'
 */
export const detectStuckJobs = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .pubsub.schedule('every 30 minutes')
    .onRun(async () => {
        const now = Date.now();
        const stuckThreshold = new Date(now - STUCK_TIMEOUT_MS);
        const stuckThresholdISO = stuckThreshold.toISOString();

        const [processingSnap, pendingSnap] = await Promise.all([
            db().collection('batch_jobs')
                .where('status', '==', 'processing')
                .where('startedAt', '<', stuckThreshold)
                .get(),
            db().collection('batch_jobs')
                .where('status', '==', 'pending')
                .where('createdAt', '<', stuckThresholdISO)
                .get(),
        ]);

        const totalStuck = processingSnap.size + pendingSnap.size;
        if (totalStuck === 0) {
            functions.logger.info('[detectStuckJobs] No stuck jobs found.');
            return;
        }

        functions.logger.info(
            `[detectStuckJobs] Found ${processingSnap.size} stuck processing + ${pendingSnap.size} stuck pending job(s).`
        );

        const batch = db().batch();

        // ── stuck processing 복구 ──────────────────────────────────────────
        for (const doc of processingSnap.docs) {
            const data = doc.data();
            const createdAt: Date = data.createdAt
                ? new Date(data.createdAt)
                : new Date(0);
            const ageMs = now - createdAt.getTime();

            if (ageMs > GOOGLE_BATCH_TTL_MS) {
                batch.update(doc.ref, {
                    status: 'failed',
                    error: '48시간 초과로 결과가 만료되었습니다.',
                    failedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                functions.logger.warn(`[detectStuckJobs] Expired processing (>48h): ${doc.id}`);
            } else {
                // pending으로 리셋 → retryBatchJob onUpdate 트리거
                batch.update(doc.ref, {
                    status: 'pending',
                    startedAt: null,
                    error: null,
                });
                functions.logger.info(`[detectStuckJobs] Reset processing → pending: ${doc.id}`);
            }
        }

        // ── stuck pending 복구 ────────────────────────────────────────────
        for (const doc of pendingSnap.docs) {
            const data = doc.data();
            const createdAt: Date = data.createdAt
                ? new Date(data.createdAt)
                : new Date(0);
            const ageMs = now - createdAt.getTime();

            if (ageMs > GOOGLE_BATCH_TTL_MS) {
                batch.update(doc.ref, {
                    status: 'failed',
                    error: '48시간 초과로 처리가 불가능합니다.',
                    failedAt: admin.firestore.FieldValue.serverTimestamp(),
                    completedAt: admin.firestore.FieldValue.serverTimestamp(),
                    notified: false,
                });
                functions.logger.warn(`[detectStuckJobs] Expired pending (>48h): ${doc.id}`);
            } else {
                // _retryAt 갱신 → retryBatchJob onUpdate 트리거
                batch.update(doc.ref, {
                    _retryAt: admin.firestore.FieldValue.serverTimestamp(),
                    error: null,
                });
                functions.logger.info(`[detectStuckJobs] Triggered retry for stuck pending: ${doc.id}`);
            }
        }

        await batch.commit();
        functions.logger.info(`[detectStuckJobs] Processed ${totalStuck} stuck job(s).`);
    });

// ──────────────────────────────────────────────────────────────
// 2) cleanupExpiredJobs
// ──────────────────────────────────────────────────────────────

/**
 * 두 가지 정리 작업:
 * A) 완료/실패 잡 중 7일 이상 지난 것 → Firestore 문서 + Storage 파일 삭제
 * B) pending/processing 잡 중 48시간 초과 → failed 강제 마킹
 */
export const cleanupExpiredJobs = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .pubsub.schedule('every day 17:00')  // UTC 17:00 = KST 02:00
    .timeZone('UTC')
    .onRun(async () => {
        const now = Date.now();
        const retentionThreshold = new Date(now - JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const googleExpireThreshold = new Date(now - GOOGLE_BATCH_TTL_MS);

        await Promise.all([
            deleteOldCompletedJobs(retentionThreshold),
            expireStaleActiveJobs(googleExpireThreshold),
        ]);
    });

async function deleteOldCompletedJobs(retentionThreshold: Date): Promise<void> {
    const snapshot = await db()
        .collection('batch_jobs')
        .where('status', 'in', ['completed', 'failed'])
        .where('completedAt', '<', retentionThreshold)
        .get();

    if (snapshot.empty) {
        functions.logger.info('[cleanupExpiredJobs] No old completed jobs to delete.');
        return;
    }

    functions.logger.info(`[cleanupExpiredJobs] Deleting ${snapshot.size} old job(s).`);

    const bucket = admin.storage().bucket();
    const firestoreBatch = db().batch();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const uid: string = data.uid ?? '';
        const jobId = doc.id;

        // Storage 폴더 삭제: batch_results + batch_inputs 양쪽 정리
        if (uid) {
            await Promise.allSettled([
                bucket.deleteFiles({ prefix: `batch_results/${uid}/${jobId}/` })
                    .then(() => functions.logger.info(`[cleanupExpiredJobs] Deleted batch_results/${uid}/${jobId}/`))
                    .catch(err => functions.logger.warn(`[cleanupExpiredJobs] batch_results delete failed for ${jobId}:`, err)),
                bucket.deleteFiles({ prefix: `batch_inputs/${uid}/${jobId}/` })
                    .then(() => functions.logger.info(`[cleanupExpiredJobs] Deleted batch_inputs/${uid}/${jobId}/`))
                    .catch(err => functions.logger.warn(`[cleanupExpiredJobs] batch_inputs delete failed for ${jobId}:`, err)),
            ]);
        }

        firestoreBatch.delete(doc.ref);
    }

    await firestoreBatch.commit();
    functions.logger.info(`[cleanupExpiredJobs] Deleted ${snapshot.size} Firestore documents.`);
}

async function expireStaleActiveJobs(googleExpireThreshold: Date): Promise<void> {
    const snapshot = await db()
        .collection('batch_jobs')
        .where('status', 'in', ['pending', 'processing'])
        .where('createdAt', '<', googleExpireThreshold)
        .get();

    if (snapshot.empty) {
        functions.logger.info('[cleanupExpiredJobs] No stale active jobs to expire.');
        return;
    }

    functions.logger.warn(`[cleanupExpiredJobs] Expiring ${snapshot.size} stale active job(s) (>48h).`);

    const batch = db().batch();

    for (const doc of snapshot.docs) {
        batch.update(doc.ref, {
            status: 'failed',
            error: 'Google Batch API 48시간 보관 기간 초과로 처리가 불가능합니다.',
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            notified: false,
        });
    }

    await batch.commit();
    functions.logger.info(`[cleanupExpiredJobs] Expired ${snapshot.size} stale job(s).`);
}
