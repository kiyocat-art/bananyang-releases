"use strict";
/**
 * batchJobProcessor.ts
 *
 * Cloud Function: batch_jobs/{jobId} onCreate
 * → 항목별 Gemini 이미지 생성 → Firebase Storage 업로드 → 완료 상태 기록
 *
 * 설정 필요:
 *   firebase functions:secrets:set GEMINI_SERVER_API_KEY
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
exports.retryBatchJob = exports.processBatchJob = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
// ── Storage 입력 이미지 다운로드 ──────────────────────────────────────────────
async function downloadInputImage(storagePath) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return {
        data: buffer.toString('base64'),
        mimeType: metadata.contentType ?? 'image/jpeg',
    };
}
// ── 이미지 생성 ───────────────────────────────────────────────────────────────
async function generateImage(item, apiKey) {
    const ai = new genai_1.GoogleGenAI({ apiKey });
    const textPart = item.negativePrompt
        ? `${item.prompt}\n\n(Avoid: ${item.negativePrompt})`
        : item.prompt;
    const parts = [];
    // Storage 경로 우선, 없으면 레거시 base64 사용
    let imageB64 = item.originalImageB64;
    let imageMime = item.originalImageMime;
    if (item.originalImagePath) {
        const downloaded = await downloadInputImage(item.originalImagePath);
        imageB64 = downloaded.data;
        imageMime = downloaded.mimeType;
    }
    if (imageB64 && imageMime) {
        parts.push({
            inlineData: {
                mimeType: imageMime,
                data: imageB64,
            },
        });
    }
    parts.push({ text: textPart });
    const response = await ai.models.generateContent({
        model: item.modelName ?? 'gemini-2.0-flash-preview-image-generation',
        contents: [{ parts }],
        config: {
            responseModalities: ['IMAGE', 'TEXT'],
        },
    });
    const responseParts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of responseParts) {
        const inlineData = part.inlineData;
        if (inlineData?.mimeType?.startsWith('image/')) {
            return Buffer.from(inlineData.data, 'base64');
        }
    }
    throw new Error('No image data in Gemini response');
}
// ── Storage 업로드 + 공개 URL 반환 ────────────────────────────────────────────
async function uploadImage(buffer, storagePath) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, {
        metadata: { contentType: 'image/webp' },
        public: false,
    });
    // 7일 유효 서명 URL 생성
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    return signedUrl;
}
// ── 공통 처리 로직 ────────────────────────────────────────────────────────────
async function runJob(jobId, jobRef, job, apiKey) {
    await jobRef.update({
        status: 'processing',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const results = [];
    for (let i = 0; i < job.items.length; i++) {
        const item = job.items[i];
        try {
            const imageBuffer = await generateImage(item, apiKey);
            const storagePath = `batch_results/${job.uid}/${jobId}/${i}.webp`;
            const storageUrl = await uploadImage(imageBuffer, storagePath);
            results.push({ storageUrl, storagePath, itemIndex: i });
            functions.logger.info(`[runJob] ${jobId} item ${i} done`);
        }
        catch (err) {
            functions.logger.error(`[runJob] ${jobId} item ${i} failed:`, err?.message);
        }
        await jobRef.update({ completedItems: i + 1 });
    }
    const finalStatus = results.length > 0 ? 'completed' : 'failed';
    await jobRef.update({
        status: finalStatus,
        results,
        notified: false,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(results.length === 0 && { error: 'All items failed to generate' }),
        // [Security] 잡 완료 후 사용자 API 키를 Firestore에서 즉시 삭제
        userApiKey: admin.firestore.FieldValue.delete(),
    });
    functions.logger.info(`[runJob] ${jobId} ${finalStatus} (${results.length}/${job.items.length})`);
    const hasStorageInputs = job.items.some(i => i.originalImagePath);
    if (hasStorageInputs) {
        try {
            await admin.storage().bucket().deleteFiles({
                prefix: `batch_inputs/${job.uid}/${jobId}/`,
            });
            functions.logger.info(`[runJob] Cleaned up batch_inputs/${job.uid}/${jobId}/`);
        }
        catch (err) {
            functions.logger.warn(`[runJob] Failed to cleanup batch_inputs:`, err);
        }
    }
}
// ── Cloud Functions ───────────────────────────────────────────────────────────
const RUN_WITH_CONFIG = {
    timeoutSeconds: 540,
    memory: '1GB',
};
function resolveApiKey(label, job) {
    const apiKey = job.userApiKey;
    if (!apiKey) {
        functions.logger.error(`[${label}] userApiKey not found in job document. User must provide a Gemini API key.`);
    }
    return apiKey ?? null;
}
/** 신규 잡 생성 시 처리 */
exports.processBatchJob = functions
    .runWith(RUN_WITH_CONFIG)
    .firestore.document('batch_jobs/{jobId}')
    .onCreate(async (snap, context) => {
    const jobData = snap.data();
    const apiKey = resolveApiKey('processBatchJob', jobData);
    if (!apiKey) {
        await snap.ref.update({
            status: 'failed',
            error: 'Gemini API key not provided. Please set your API key in app settings.',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            userApiKey: admin.firestore.FieldValue.delete(),
        });
        return;
    }
    await runJob(context.params.jobId, snap.ref, jobData, apiKey);
});
/**
 * 막힌 잡 재시도 트리거.
 * detectStuckJobs가 _retryAt을 갱신하거나 status를 pending으로 리셋할 때 실행.
 */
exports.retryBatchJob = functions
    .runWith(RUN_WITH_CONFIG)
    .firestore.document('batch_jobs/{jobId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // 트리거 조건:
    // 1) status가 non-pending → pending 전환 (processing 타임아웃 복구)
    // 2) status가 pending이고 _retryAt이 새로 설정됨 (stuck pending 복구)
    const statusChangedToPending = before.status !== 'pending' && after.status === 'pending';
    const retryRequested = after.status === 'pending' &&
        after._retryAt != null &&
        before._retryAt?.toMillis() !== after._retryAt?.toMillis();
    if (!statusChangedToPending && !retryRequested)
        return;
    if (after.status !== 'pending')
        return; // 안전 가드
    const apiKey = resolveApiKey('retryBatchJob', after);
    if (!apiKey) {
        await change.after.ref.update({
            status: 'failed',
            error: 'Gemini API key not provided. Please set your API key in app settings.',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            userApiKey: admin.firestore.FieldValue.delete(),
        });
        return;
    }
    functions.logger.info(`[retryBatchJob] Retrying job ${context.params.jobId}`);
    await runJob(context.params.jobId, change.after.ref, after, apiKey);
});
//# sourceMappingURL=batchJobProcessor.js.map