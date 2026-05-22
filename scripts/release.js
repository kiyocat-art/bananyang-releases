/**
 * release.js
 * 로컬에서 빌드 후 GitHub Releases + Firebase Storage에 업로드합니다.
 *
 * 사용법:
 *   npm run release                           → Windows patch 증가 (1.0.4 → 1.0.5)
 *   npm run release minor                     → minor 증가    (1.0.4 → 1.1.0)
 *   npm run release major                     → major 증가    (1.0.4 → 2.0.0)
 *   npm run release 1.2.3                     → 직접 지정
 *   npm run release -- --platform=mac         → macOS 빌드 (macOS 호스트 필요)
 *   npm run release -- --platform=both        → Windows + macOS 동시 빌드
 *   npm run release -- --severity=recommended → 업데이트 중요도 설정
 *   npm run release -- --skip-github          → GitHub Release 생략
 *   npm run release -- --skip-firebase        → Firebase 업로드 생략
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const [major, minor, patch] = oldVersion.split('.').map(Number);

// ──────────────────────────────────────────────────────────────
// argv 파싱: --flag=value 와 positional 분리
// ──────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of rawArgs) {
    if (a.startsWith('--')) {
        const m = a.match(/^--([^=]+)(?:=(.*))?$/);
        if (m) flags[m[1]] = m[2] !== undefined ? m[2] : true;
    } else {
        positional.push(a);
    }
}
const skipGithub = !!flags['skip-github'];
const skipFirebase = !!flags['skip-firebase'];
const severity = flags['severity'] || 'optional';
if (!['optional', 'recommended', 'critical'].includes(severity)) {
    console.error(`❌ 잘못된 severity: ${severity} (allowed: optional|recommended|critical)`);
    process.exit(1);
}
const platform = flags['platform'] || 'win';
if (!['win', 'mac', 'both'].includes(platform)) {
    console.error(`❌ 잘못된 platform: ${platform} (allowed: win|mac|both)`);
    process.exit(1);
}
if ((platform === 'mac' || platform === 'both') && process.platform !== 'darwin') {
    console.error('❌ mac 빌드는 macOS 호스트에서만 가능합니다. GitHub Actions macOS runner 사용 권장.');
    process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// 버전 계산
// ──────────────────────────────────────────────────────────────
const arg = positional[0];
let newVersion;

if (!arg || arg === 'patch') {
    newVersion = `${major}.${minor}.${patch + 1}`;
} else if (arg === 'minor') {
    newVersion = `${major}.${minor + 1}.0`;
} else if (arg === 'major') {
    newVersion = `${major + 1}.0.0`;
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
    newVersion = arg;
} else {
    console.error(`❌ 잘못된 인자: "${arg}"`);
    console.error('   사용법: npm run release [patch|minor|major|1.2.3] [--severity=optional|recommended|critical] [--skip-github] [--skip-firebase]');
    process.exit(1);
}

if (oldVersion === newVersion) {
    console.error(`❌ 현재 버전(${oldVersion})과 동일합니다.`);
    process.exit(1);
}

const tag = `v${newVersion}`;

function run(cmd, desc) {
    console.log(`\n▶ ${desc}`);
    try {
        execSync(cmd, { stdio: 'inherit', cwd: root });
    } catch (e) {
        console.error(`\n❌ 실패: ${desc}`);
        process.exit(1);
    }
}

// ──────────────────────────────────────────────────────────────
// 1) package.json 버전 업데이트
// ──────────────────────────────────────────────────────────────
console.log(`\n🚀 BanaNyang 릴리즈: ${oldVersion} → ${newVersion}`);
console.log('─'.repeat(40));

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('   ✓ package.json 수정 완료');

// ──────────────────────────────────────────────────────────────
// 2) release/ 폴더의 이전 산출물 정리
// ──────────────────────────────────────────────────────────────
const releaseDir = path.join(root, 'release');
if (fs.existsSync(releaseDir)) {
    if (platform === 'win' || platform === 'both') {
        const oldFiles = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe') || f.endsWith('.blockmap') || f.endsWith('.yml'));
        oldFiles.forEach(f => {
            fs.rmSync(path.join(releaseDir, f));
            console.log(`   🗑 삭제: ${f}`);
        });
    }
    if (platform === 'mac' || platform === 'both') {
        const macDir = path.join(releaseDir, 'mac');
        if (fs.existsSync(macDir)) {
            const oldMacFiles = fs.readdirSync(macDir).filter(f =>
                f.endsWith('.dmg') || f.endsWith('.zip') || f.endsWith('.blockmap') || f.endsWith('.yml'));
            oldMacFiles.forEach(f => {
                fs.rmSync(path.join(macDir, f));
                console.log(`   🗑 삭제: mac/${f}`);
            });
        }
    }
}

// ──────────────────────────────────────────────────────────────
// 3) 로컬 빌드
// ──────────────────────────────────────────────────────────────
if (platform === 'win' || platform === 'both') {
    run('npm run dist:win:prod', '로컬 Windows 빌드');
}
if (platform === 'mac' || platform === 'both') {
    run('npm run dist:mac:prod', '로컬 macOS 빌드');
}

// ──────────────────────────────────────────────────────────────
// 4) release/ 폴더에서 산출물 찾기
// ──────────────────────────────────────────────────────────────
const uploadPaths = [];

if (platform === 'win' || platform === 'both') {
    const winFiles = fs.readdirSync(releaseDir);
    const exeFile = winFiles.find(f => f.endsWith('.exe') && !f.endsWith('.blockmap'));
    if (!exeFile) {
        console.error('❌ release/ 폴더에서 .exe 파일을 찾을 수 없습니다.');
        process.exit(1);
    }
    uploadPaths.push(path.join(releaseDir, exeFile));
    console.log(`\n✓ 업로드할 Windows 파일: ${exeFile}`);
}

if (platform === 'mac' || platform === 'both') {
    const macDir = path.join(releaseDir, 'mac');
    if (!fs.existsSync(macDir)) {
        console.error('❌ release/mac/ 폴더를 찾을 수 없습니다.');
        process.exit(1);
    }
    const macFiles = fs.readdirSync(macDir);
    const dmgFile = macFiles.find(f => f.endsWith('.dmg') && !f.endsWith('.blockmap'));
    const zipFile = macFiles.find(f => f.endsWith('.zip') && !f.endsWith('.blockmap'));
    if (!dmgFile && !zipFile) {
        console.error('❌ release/mac/ 폴더에서 .dmg/.zip 파일을 찾을 수 없습니다.');
        process.exit(1);
    }
    if (dmgFile) { uploadPaths.push(path.join(macDir, dmgFile)); console.log(`✓ 업로드할 macOS 파일: ${dmgFile}`); }
    if (zipFile) { uploadPaths.push(path.join(macDir, zipFile)); console.log(`✓ 업로드할 macOS 파일: ${zipFile}`); }
}

// ──────────────────────────────────────────────────────────────
// 5) GitHub Release 생성 & 업로드 (옵션)
// ──────────────────────────────────────────────────────────────
if (!skipGithub) {
    const fileArgs = uploadPaths.map(p => `"${p}"`).join(' ');
    const platformLabel = platform === 'win' ? 'Windows' : platform === 'mac' ? 'macOS' : 'Windows + macOS';
    run(
        `gh release create ${tag} ${fileArgs} --title "BanaNyang ${tag}" --notes "BanaNyang ${tag} ${platformLabel} installer"`,
        `GitHub Release 생성 & 업로드: ${tag}`
    );
} else {
    console.log('\n⏭  GitHub Release 단계 건너뜀 (--skip-github)');
}

// ──────────────────────────────────────────────────────────────
// 6) Firebase Storage 업로드 + Firestore 메타데이터 갱신
// ──────────────────────────────────────────────────────────────
if (!skipFirebase) {
    run(
        `node scripts/release-firebase.mjs --version=${newVersion} --severity=${severity}`,
        `Firebase Storage 업로드 + Firestore 갱신`
    );
} else {
    console.log('\n⏭  Firebase 단계 건너뜀 (--skip-firebase)');
}

// ──────────────────────────────────────────────────────────────
// 완료
// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(40));
console.log(`✅ 릴리즈 완료: ${tag} (severity=${severity})`);
if (!skipGithub) console.log(`   https://github.com/kiyocat-art/bananyang-releases/releases`);
if (!skipFirebase) console.log(`   Firebase: gs://bananyang-ai.firebasestorage.app/releases/`);
console.log('');
