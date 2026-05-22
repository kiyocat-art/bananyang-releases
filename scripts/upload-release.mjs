/**
 * upload-release.mjs
 * Firebase Storage에 릴리즈 파일을 업로드하고 공개 다운로드 URL을 출력합니다.
 *
 * 사용법: node scripts/upload-release.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── .env.local 파싱 (web/.env.local) ──────────────────────────────────────────
const envPath = resolve(root, 'web', '.env.local');
const envVars = {};
readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
});

const privateKey = envVars['FIREBASE_ADMIN_PRIVATE_KEY']?.replace(/\\n/g, '\n');
const clientEmail = envVars['FIREBASE_ADMIN_CLIENT_EMAIL'];
const projectId = envVars['FIREBASE_ADMIN_PROJECT_ID'];
const storageBucket = envVars['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'];

if (!privateKey || !clientEmail || !projectId) {
    console.error('Firebase Admin 환경변수가 없습니다. web/.env.local을 확인하세요.');
    process.exit(1);
}

// ── Firebase 초기화 ────────────────────────────────────────────────────────────
initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
});

// ── 업로드 대상 파일 ────────────────────────────────────────────────────────────
const releaseDir = resolve(root, 'release');
const files = readFileSync(releaseDir + '/.', 'utf-8').split('\n').filter(f => f.endsWith('.exe') && !f.includes('uninstaller')).map(f => f.trim()).filter(Boolean);

// release 디렉토리에서 .exe 찾기
import { readdirSync } from 'fs';
const exeFiles = readdirSync(releaseDir).filter(f => f.endsWith('.exe') && !f.includes('uninstaller'));

if (exeFiles.length === 0) {
    console.error('release/ 폴더에 .exe 파일이 없습니다.');
    process.exit(1);
}

const exeFile = exeFiles[0];
const exePath = resolve(releaseDir, exeFile);
const destination = `releases/${exeFile}`;

console.log(`\n업로드 시작: ${exeFile} (${(readFileSync(exePath).length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`대상 경로: gs://${storageBucket}/${destination}\n`);

// ── 업로드 ────────────────────────────────────────────────────────────────────
const bucket = getStorage().bucket();
const [file] = await bucket.upload(exePath, {
    destination,
    metadata: {
        contentType: 'application/octet-stream',
        cacheControl: 'public, max-age=31536000',
    },
    public: true,
});

await file.makePublic();

const publicUrl = `https://storage.googleapis.com/${storageBucket}/${destination}`;
console.log('업로드 완료!');
console.log('');
console.log('다운로드 URL:');
console.log(publicUrl);
console.log('');
console.log('web/.env.local에 추가할 내용:');
console.log(`NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL=${publicUrl}`);
