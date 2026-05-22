/**
 * build-with-env.js
 * .env.local 또는 .env.production 파일을 읽어
 * esbuild --define 플래그로 Firebase 환경변수를 번들에 주입합니다.
 *
 * 사용법:
 *   node scripts/build-with-env.js              → .env.local 사용 (개발)
 *   node scripts/build-with-env.js production   → .env.production 사용 (배포)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// 1) 환경변수 파일 로드
// ──────────────────────────────────────────────────────────────
const mode = process.argv[2] ?? 'local';
const envFileName = mode === 'production' ? '.env.production' : '.env.local';
const envPath = path.join(__dirname, '..', envFileName);

const env = {};

// 파일에서 로드
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = value;
    }
    console.log(`[build-with-env] Loaded ${envFileName}`);
} else {
    console.warn(`[build-with-env] WARNING: ${envFileName} not found. Using shell environment.`);
}

// 쉘 환경변수가 파일보다 우선
const INJECT_KEYS = ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'DEV_BYPASS_AUTH'];
for (const key of INJECT_KEYS) {
    if (process.env[key]) {
        env[key] = process.env[key];
    }
}

// ──────────────────────────────────────────────────────────────
// 2) 필수 변수 검증
// ──────────────────────────────────────────────────────────────
const REQUIRED_KEYS = ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'];
const missing = REQUIRED_KEYS.filter(k => !env[k]);
if (missing.length > 0) {
    console.error(`[build-with-env] ERROR: Missing required env vars: ${missing.join(', ')}`);
    console.error(`  → ${envFileName} 파일에 해당 값을 입력하세요.`);
    process.exit(1);
}
if (!env['GOOGLE_OAUTH_CLIENT_ID']) {
    console.warn('[build-with-env] WARNING: GOOGLE_OAUTH_CLIENT_ID not set — Google DRM 로그인이 작동하지 않습니다.');
}
if (!env['GOOGLE_OAUTH_CLIENT_SECRET']) {
    console.warn('[build-with-env] WARNING: GOOGLE_OAUTH_CLIENT_SECRET not set — Google 토큰 교환이 실패합니다.');
}

// ──────────────────────────────────────────────────────────────
// 3) esbuild --define 플래그 생성
// ──────────────────────────────────────────────────────────────
const nodeEnv = mode === 'production' ? 'production' : 'development';
const defineFlags = [
    `--define:process.env.NODE_ENV='"${nodeEnv}"'`,
    ...INJECT_KEYS.map(k => `--define:process.env.${k}='"${env[k] ?? ''}"'`),
].join(' ');

console.log('[build-with-env] Injecting:', INJECT_KEYS.map(k => `${k}=***`).join(', '));

// ──────────────────────────────────────────────────────────────
// 4) 빌드 실행
// ──────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const opts = { cwd: ROOT, stdio: 'inherit', shell: true };

// 4-1) 아이콘 생성
console.log('\n[build-with-env] Step 1: make-icon');
execSync('node scripts/create-icon.js', opts);

// 4-2) Tailwind CSS
console.log('\n[build-with-env] Step 2: Tailwind CSS');
execSync('npx tailwindcss -i ./src/index.css -o ./bundle.css', opts);

// 4-3) 메인 번들 (Firebase 환경변수 주입)
console.log('\n[build-with-env] Step 3: esbuild main bundle');
execSync(
    `npx esbuild src/index.tsx \
        --bundle \
        --outfile=bundle.js \
        --loader:.ts=ts \
        --loader:.tsx=tsx \
        --loader:.png=file \
        --platform=browser \
        --format=esm \
        --external:react \
        --external:react-dom \
        --external:react-dom/* \
        --external:zustand \
        --external:pixi.js \
        --external:@pixi/react \
        --external:react-is \
        ${defineFlags}`,
    opts
);

// 4-4) 렌더링 워커
console.log('\n[build-with-env] Step 4: esbuild rendering worker');
execSync(
    `npx esbuild src/features/canvas/rendering.worker.ts \
        --bundle \
        --outfile=rendering.worker.js \
        --loader:.ts=ts \
        --platform=browser \
        --format=esm`,
    opts
);

// 4-5) 데이터 워커
console.log('\n[build-with-env] Step 5: esbuild data worker');
execSync(
    `npx esbuild src/workers/data.worker.ts \
        --bundle \
        --outfile=data.worker.js \
        --loader:.ts=ts \
        --loader:.wasm=file \
        --platform=browser \
        --format=esm`,
    opts
);

console.log('\n[build-with-env] Build complete!');
