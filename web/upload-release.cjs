/**
 * upload-release.cjs — Firebase Storage 릴리즈 업로드 스크립트
 * web/ 디렉토리에서 실행: node upload-release.cjs
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── .env.local 파싱 ──────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env.local');
const envVars = {};
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
});

const privateKey   = envVars['FIREBASE_ADMIN_PRIVATE_KEY']?.replace(/\\n/g, '\n');
const clientEmail  = envVars['FIREBASE_ADMIN_CLIENT_EMAIL'];
const projectId    = envVars['FIREBASE_ADMIN_PROJECT_ID'];
const storageBucket = envVars['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'];

if (!privateKey || !clientEmail || !projectId || !storageBucket) {
    console.error('web/.env.local에 Firebase Admin 환경변수가 없습니다.');
    process.exit(1);
}

// ── Firebase 초기화 ──────────────────────────────────────────────────────────
// Firebase Storage 버킷명 후보 (신형 firebasestorage.app → 구형 appspot.com 순 시도)
const bucketCandidates = [
    storageBucket,
    `${projectId}.appspot.com`,
];

admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

// ── 업로드 대상 파일 탐색 ────────────────────────────────────────────────────
const releaseDir = path.join(__dirname, '..', 'release');
const exeFiles = fs.readdirSync(releaseDir)
    .filter(f => f.endsWith('.exe') && !f.includes('uninstaller'));

if (exeFiles.length === 0) {
    console.error('release/ 폴더에 .exe 파일이 없습니다.');
    process.exit(1);
}

const exeFile = exeFiles[0];
const exePath = path.join(releaseDir, exeFile);
const destination = `releases/${exeFile}`;
const fileSizeMB = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1);

console.log(`\n업로드 시작: ${exeFile} (${fileSizeMB} MB)`);
console.log(`대상: gs://${storageBucket}/${destination}\n`);

// ── 업로드 ───────────────────────────────────────────────────────────────────
async function tryUpload() {
    for (const bucketName of bucketCandidates) {
        try {
            const bucket = admin.storage().bucket(bucketName);
            const [exists] = await bucket.exists();
            if (!exists) {
                console.log(`버킷 없음: ${bucketName}, 다음 시도...`);
                continue;
            }
            console.log(`버킷 확인: ${bucketName}`);
            const [file] = await bucket.upload(exePath, {
                destination,
                metadata: {
                    contentType: 'application/octet-stream',
                    cacheControl: 'public, max-age=31536000',
                },
                public: true,
            });
            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
            console.log('\n업로드 완료!\n');
            console.log('다운로드 URL:');
            console.log(publicUrl);
            console.log('\nweb/.env.local에 추가할 내용:');
            console.log(`NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL=${publicUrl}`);
            return;
        } catch(err) {
            console.log(`버킷 ${bucketName} 실패: ${err.message.slice(0, 100)}`);
        }
    }
    console.error('\n모든 버킷 시도 실패. Firebase Console에서 Storage 활성화 여부를 확인하세요.');
    process.exit(1);
}

tryUpload();
