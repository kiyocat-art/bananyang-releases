/**
 * release-firebase.mjs
 * Firebase Storage에 빌드 산출물을 업로드하고 Firestore `app_releases/latest`
 * 메타데이터를 갱신한다. release.js에서 체이닝되어 호출.
 *
 * 사용법:
 *   node scripts/release-firebase.mjs --version=1.0.6 --severity=optional
 *     [--notes-ko="..." --notes-en="..." --notes-ja="..."]
 *     [--min-supported=0.0.0]
 *
 * 산출물 탐색:
 *   - Windows: release/*.exe, release/latest.yml, release/*.blockmap
 *   - macOS:   release/mac/*.dmg, release/mac/latest-mac.yml, *.blockmap
 *
 * Storage 대상:
 *   gs://{bucket}/releases/{win|mac}/{filename}
 *
 * Firestore 문서 형식: 플랜의 ReleaseDoc 스키마 참조.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── argv parse ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
        const m = a.match(/^--([^=]+)=(.*)$/);
        return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
    }),
);

const versionFromPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8')).version;
const version = args.version || versionFromPkg;
const severity = args.severity || 'optional';
const validSeverities = ['optional', 'recommended', 'critical'];
if (!validSeverities.includes(severity)) {
    console.error(`Invalid severity: ${severity}. Allowed: ${validSeverities.join(', ')}`);
    process.exit(1);
}

// ── .env.local 파싱 (process.env 우선, 파일은 fallback) ──────────────────────
const envPath = resolve(root, 'web', '.env.local');
const envVars = {};
if (existsSync(envPath)) {
    readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    });
}

const pickEnv = (key) => process.env[key] || envVars[key];
const privateKey = pickEnv('FIREBASE_ADMIN_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const clientEmail = pickEnv('FIREBASE_ADMIN_CLIENT_EMAIL');
const projectId = pickEnv('FIREBASE_ADMIN_PROJECT_ID');
const storageBucket = pickEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');

if (!privateKey || !clientEmail || !projectId || !storageBucket) {
    console.error('Firebase Admin 환경변수가 부족합니다. process.env 또는 web/.env.local을 확인하세요.');
    process.exit(1);
}

// ── Admin SDK 초기화 ──────────────────────────────────────────────────────────
initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
});
const bucket = getStorage().bucket();
const db = getFirestore();

// ── 업로드 ────────────────────────────────────────────────────────────────────
async function uploadPlatform(platform, releaseDir, patterns) {
    if (!existsSync(releaseDir)) {
        console.warn(`[${platform}] 디렉토리 없음 (${releaseDir}). skip.`);
        return null;
    }

    const files = readdirSync(releaseDir);
    const binary = files.find(f => patterns.binary.test(f));
    const yaml = files.find(f => patterns.yaml.test(f));
    const blockmap = files.find(f => patterns.blockmap.test(f));

    if (!binary || !yaml) {
        console.warn(`[${platform}] 산출물 누락 (binary=${binary}, yaml=${yaml}). skip.`);
        return null;
    }

    const uploads = [binary, yaml, blockmap].filter(Boolean);
    let meta = null;

    for (const filename of uploads) {
        const src = resolve(releaseDir, filename);
        const dest = `releases/${platform}/${filename}`;
        await bucket.upload(src, {
            destination: dest,
            // latest.yml은 짧은 캐시, .exe/.dmg는 길게 캐시 (해시 기반 무효화).
            metadata: {
                contentType: filename.endsWith('.yml') ? 'application/x-yaml' : 'application/octet-stream',
                cacheControl: filename.endsWith('.yml') ? 'public, max-age=60' : 'public, max-age=86400',
            },
            public: true,
        });
        await bucket.file(dest).makePublic();

        if (filename === binary) {
            const buf = readFileSync(src);
            meta = {
                url: `https://storage.googleapis.com/${bucket.name}/${dest}`,
                yamlUrl: `https://storage.googleapis.com/${bucket.name}/releases/${platform}/${yaml}`,
                sha512: createHash('sha512').update(buf).digest('base64'),
                size: buf.length,
            };
        }
        console.log(`  ✓ gs://${bucket.name}/${dest}`);
    }
    return meta;
}

console.log(`\n📦 Firebase 업로드 시작: v${version} (severity=${severity})`);

const winMeta = await uploadPlatform('win', resolve(root, 'release'), {
    binary: /^.*-Setup-v.*\.exe$/i,
    yaml: /^latest\.yml$/i,
    blockmap: /\.exe\.blockmap$/i,
});

const macMeta = await uploadPlatform('mac', resolve(root, 'release', 'mac'), {
    binary: /\.dmg$/i,
    yaml: /^latest-mac\.yml$/i,
    blockmap: /\.dmg\.blockmap$/i,
});

// ── Firestore 갱신 ────────────────────────────────────────────────────────────
const releaseDoc = {
    version,
    channel: 'stable',
    severity,
    releasedAt: FieldValue.serverTimestamp(),
    releaseNotes: {
        ko: args['notes-ko'] || '',
        en: args['notes-en'] || '',
        ja: args['notes-ja'] || '',
    },
    minSupportedVersion: args['min-supported'] || '0.0.0',
    win: winMeta,
    mac: macMeta,
};

await db.collection('app_releases').doc('latest').set(releaseDoc, { merge: false });

console.log(`\n✅ Firestore app_releases/latest 갱신 완료: v${version}`);
console.log(`   severity=${severity}, win=${winMeta ? 'OK' : 'skipped'}, mac=${macMeta ? 'OK' : 'skipped'}`);
