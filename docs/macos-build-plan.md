# BanaNyang AI - macOS 빌드 구현 계획

> **목표**: BanaNyang AI를 macOS (Intel x64 + Apple Silicon arm64)에서 네이티브로 구동 가능한 Mac 전용 빌드 버전 제작

---

## 현황 분석 (As-Is)

| 항목 | 현재 상태 | macOS 필요 상태 |
|------|-----------|----------------|
| electron-builder mac 타겟 | `"mac": { "target": "dmg" }` 선언됨 (미완성) | DMG + 코드서명 완전 구성 필요 |
| 앱 아이콘 | `.ico` (Windows) + `.png` 생성 | `.icns` (macOS 네이티브 포맷) 필요 |
| GPU 모니터링 | `nvidia-smi` + PowerShell WMI (Windows 전용) | macOS용 대체 로직 필요 |
| 코드 서명 | 없음 | Apple Developer 인증서 필요 |
| 공증(Notarization) | 없음 | macOS 배포 필수 요건 |
| Apple Silicon 지원 | 없음 | arm64 / universal 바이너리 필요 |
| 파일 연결 | NSIS 레지스트리 (Windows 전용) | `CFBundleDocumentTypes` 설정 필요 |
| PixiJS WebGL | Windows Chrome GPU 플래그 최적화됨 | macOS Metal/OpenGL 호환성 확인 필요 |

---

## PLAN (계획)

### P-1. 개발 환경 요건 정의

- **필수 환경**: macOS Ventura 13+ 또는 Sequoia 15+ 탑재 Mac
- **Apple Developer 계정**: 연간 $99 (코드서명 + 공증 필수)
- **인증서 종류**:
  - `Developer ID Application` — 직배포(DMG) 시 필요
  - `Mac App Store Distribution` — MAS 등록 시 별도 필요
- **Build tools**:
  - Xcode Command Line Tools (`xcode-select --install`)
  - `create-dmg` 또는 `appdmg` (DMG 커스터마이징)
  - `sharp` 라이브러리 — `.icns` 생성 (기존 `scripts/create-icon.js` 확장)

### P-2. 타겟 아키텍처 결정

```
Option A: Universal Binary (권장)
  - x64 (Intel) + arm64 (Apple Silicon) 단일 DMG
  - electron-builder: target arch "universal"
  - 배포 단순화, 파일 크기 약 1.5~2배 증가

Option B: 별도 배포
  - intel.dmg / arm64.dmg 분리 배포
  - CI/CD 복잡, 사용자 혼동 가능성
```

**결정: Option A (Universal Binary)** — DMG 하나로 전 Mac 사용자 지원

### P-3. 구현 태스크 목록

| 우선순위 | 태스크 | 대상 파일 |
|---------|--------|-----------|
| 1 | `.icns` 아이콘 생성 스크립트 추가 | `scripts/create-icon.js` |
| 2 | macOS GPU 모니터링 대체 로직 구현 | `main.js` |
| 3 | electron-builder macOS 완전 구성 | `package.json` |
| 4 | GPU/Chromium 플래그 플랫폼 분기 | `main.js` |
| 5 | 파일 연결 (`CFBundleDocumentTypes`) | `package.json` |
| 6 | 코드서명 + 공증 환경변수 설정 | `.env.mac` / CI |
| 7 | `npm run dist:mac` 빌드 스크립트 추가 | `package.json` |
| 8 | PixiJS WebGL macOS 호환성 검증 | `rendering.worker.ts` |

---

## DO (실행)

### D-1. `.icns` 아이콘 생성 (`scripts/create-icon.js` 수정)

```javascript
// scripts/create-icon.js 에 추가할 내용
const { execSync } = require('child_process');
const sizes = [16, 32, 64, 128, 256, 512, 1024];

async function createIcns(srcPng, outputPath) {
  const iconsetDir = outputPath.replace('.icns', '.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const size of sizes) {
    await sharp(srcPng).resize(size, size).png()
      .toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));
    if (size <= 512) {
      await sharp(srcPng).resize(size * 2, size * 2).png()
        .toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
    }
  }
  // macOS에서만: iconutil로 변환
  if (process.platform === 'darwin') {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${outputPath}"`);
  }
  // 크로스 플랫폼 대안: png2icons 또는 electron-icon-maker npm 패키지
}
```

> **Note**: Windows CI 환경에서는 `iconutil` 미지원 → `png2icons` npm 패키지 대안 사용

### D-2. macOS GPU 모니터링 대체 (`main.js`)

현재 코드:
```javascript
// Windows 전용 (nvidia-smi + PowerShell WMI)
const result = await execAsync('nvidia-smi ...');
const result2 = await execAsync('powershell ... Win32_VideoController ...');
```

수정 방향:
```javascript
async function getGpuInfo() {
  if (process.platform === 'win32') {
    return getGpuInfoWindows();   // 기존 nvidia-smi + PowerShell 로직
  } else if (process.platform === 'darwin') {
    return getGpuInfoMac();       // system_profiler SPDisplaysDataType
  } else {
    return getGpuInfoLinux();     // glxinfo 또는 /sys/class/drm
  }
}

async function getGpuInfoMac() {
  // system_profiler는 macOS 기본 내장 명령어
  const result = await execAsync(
    'system_profiler SPDisplaysDataType -json'
  );
  const data = JSON.parse(result.stdout);
  // spdisplays_vram 파싱하여 VRAM 용량 추출
  return parseMacGpuData(data);
}
```

### D-3. `package.json` electron-builder macOS 완전 구성

```json
{
  "build": {
    "appId": "com.kiyocat.bananyang",
    "productName": "BanaNyang AI",
    "mac": {
      "target": [
        { "target": "dmg", "arch": ["universal"] }
      ],
      "icon": "build/icon.icns",
      "category": "public.app-category.graphics-design",
      "minimumSystemVersion": "13.0",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "extendInfo": {
        "CFBundleDocumentTypes": [
          {
            "CFBundleTypeName": "BanaNyang Project",
            "CFBundleTypeExtensions": ["bananyang"],
            "CFBundleTypeRole": "Editor",
            "LSHandlerRank": "Owner"
          },
          {
            "CFBundleTypeName": "Nyang File",
            "CFBundleTypeExtensions": ["nyang"],
            "CFBundleTypeRole": "Editor",
            "LSHandlerRank": "Owner"
          },
          {
            "CFBundleTypeName": "RFY File",
            "CFBundleTypeExtensions": ["rfy"],
            "CFBundleTypeRole": "Editor",
            "LSHandlerRank": "Owner"
          }
        ]
      }
    },
    "dmg": {
      "title": "BanaNyang AI",
      "icon": "build/icon.icns",
      "contents": [
        { "x": 130, "y": 220, "type": "file" },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ],
      "window": { "width": 540, "height": 380 }
    },
    "afterSign": "scripts/notarize.js"
  }
}
```

### D-4. Entitlements 파일 생성 (`build/entitlements.mac.plist`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
  <key>com.apple.security.files.user-selected.read-write</key><true/>
  <key>com.apple.security.network.client</key><true/>
</dict>
</plist>
```

> WebGL(GPU 가속) 사용을 위해 `allow-jit` + `allow-unsigned-executable-memory` 필수

### D-5. 공증 스크립트 (`scripts/notarize.js`)

```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  await notarize({
    tool: 'notarytool',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

### D-6. Chromium GPU 플래그 플랫폼 분기 (`main.js`)

```javascript
// 현재: Windows 전용 플래그들
app.commandLine.appendSwitch('--max-old-space-size', '8192');
app.commandLine.appendSwitch('--gpu-memory-buffer-count', '256');

// 수정: 플랫폼별 분기
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('--gpu-memory-buffer-count', '256');
}
// 공통 플래그 (모든 플랫폼)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

// macOS 특화: Metal 백엔드 강제 (PixiJS WebGL 안정성)
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'metal');
}
```

### D-7. 빌드 스크립트 추가 (`package.json`)

```json
{
  "scripts": {
    "dist": "npm run build && npm run make-icon && electron-builder",
    "dist:win": "npm run build && npm run make-icon && electron-builder --win",
    "dist:mac": "npm run build && npm run make-icon && electron-builder --mac --universal",
    "dist:linux": "npm run build && npm run make-icon && electron-builder --linux",
    "make-icon:mac": "node scripts/create-icon.js --mac"
  }
}
```

---

## CHECK (검증)

### C-1. 기능 검증 체크리스트

#### 설치 / 실행
- [ ] DMG 마운트 → Applications 폴더 드래그 설치 정상 동작
- [ ] 최초 실행 시 Gatekeeper 경고 없음 (코드서명 + 공증 완료 후)
- [ ] Intel Mac (x86_64) 정상 실행
- [ ] Apple Silicon Mac (arm64, M1/M2/M3) 정상 실행
- [ ] macOS Ventura (13.x), Sonoma (14.x), Sequoia (15.x) 호환

#### 핵심 기능
- [ ] PixiJS WebGL 렌더링 정상 (GPU 가속 활성화 확인)
- [ ] Gemini API 연결 정상 (네트워크 엔타이틀먼트)
- [ ] 이미지 200장 이상 로드 시 VRAM 안정성 (vramGuard 동작)
- [ ] 4K 이미지 생성 후 메모리 정리 정상 동작
- [ ] `.nyang` / `.rfy` / `.bananyang` 파일 열기 (파일 연결 등록 확인)
- [ ] 파일 저장 경로 (`app.getPath('userData')`) 정상 — `~/Library/Application Support/BanaNyang AI/`
- [ ] KTX2 인코딩 Worker (`data.worker.ts`) 정상 동작

#### macOS 특화
- [ ] GPU 정보 표시 — `system_profiler`로 VRAM 읽기 정상
- [ ] 앱 종료 후 재실행 시 세션 복구 정상
- [ ] 다크 모드 / 라이트 모드 전환 시 UI 깨짐 없음
- [ ] Retina 디스플레이 고해상도 렌더링 정상

### C-2. 성능 벤치마크

| 지표 | 목표치 | 측정 방법 |
|------|--------|----------|
| 앱 초기 실행 시간 | < 5초 | 스톱워치 |
| 이미지 200장 로드 후 VRAM 사용 | < 512MB | Activity Monitor > GPU History |
| 4K 이미지 생성 시간 | Windows 대비 ±20% 이내 | 생성 완료까지 시간 측정 |
| 앱 전체 메모리 사용 | < 4GB (일반 사용 기준) | Activity Monitor |

### C-3. 배포 전 공증 확인

```bash
# 공증 상태 확인
spctl --assess --type exec --verbose "BanaNyang AI.app"
# 예상 출력: "source=Notarized Developer ID"

# 코드서명 확인
codesign --verify --deep --strict --verbose=2 "BanaNyang AI.app"

# Gatekeeper 통과 확인
codesign -dv --verbose=4 "BanaNyang AI.app" 2>&1 | grep "Authority="
```

---

## ACT (개선 및 확산)

### A-1. 배포 전략

#### Phase 1: 직접 배포 (DMG)
- GitHub Releases에 `BanaNyang-AI-{version}-mac-universal.dmg` 업로드
- SHA256 체크섬 함께 제공
- 공식 웹사이트 다운로드 페이지 macOS 섹션 추가

#### Phase 2: 자동 업데이트 (선택)
- `electron-updater` + GitHub Releases 연동
- `autoUpdater.setFeedURL` macOS DMG 타겟 설정
- 업데이트 알림 UI 구현 (기존 Windows 업데이터 코드 재활용)

#### Phase 3: Mac App Store (장기 검토)
- 샌드박스 제한으로 인한 기능 제약 검토 필요
  - 외부 프로세스 실행(`system_profiler`, `execAsync`) 제한될 수 있음
  - 파일 시스템 접근 범위 제한
- 별도 MAS 빌드 구성 필요 시 독립 브랜치로 관리

### A-2. CI/CD 파이프라인 (GitHub Actions)

```yaml
# .github/workflows/build-mac.yml
name: Build macOS

on:
  push:
    tags: ['v*']

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Import certificates
        env:
          CERTIFICATE_P12: ${{ secrets.MAC_CERTIFICATE_P12 }}
          CERTIFICATE_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
        run: |
          echo "$CERTIFICATE_P12" | base64 --decode > certificate.p12
          security import certificate.p12 -P "$CERTIFICATE_PASSWORD" \
            -A -t cert -f pkcs12 -k ~/Library/Keychains/login.keychain-db
      - run: npm ci
      - run: npm run dist:mac
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.MAC_CERTIFICATE_P12 }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
      - uses: actions/upload-artifact@v4
        with:
          name: mac-dmg
          path: dist/*.dmg
```

### A-3. 크래시 리포팅 및 피드백

- `@electron/remote` 또는 Sentry Electron SDK로 macOS 크래시 로그 수집
- macOS 전용 버그 리포트 채널 구분 (태그: `platform:mac`)
- Apple Silicon 전용 이슈 추적 (태그: `arch:arm64`)

### A-4. 향후 개선 항목 (Backlog)

| 항목 | 우선순위 | 메모 |
|------|---------|------|
| PixiJS Metal 렌더러 최적화 | 중 | macOS에서 WebGL 대신 Metal API 직접 활용 검토 |
| Touch Bar 지원 | 낮 | 구형 MacBook Pro 전용 기능 |
| macOS Handoff / Continuity | 낮 | iOS 확장 시 고려 |
| Rosetta 2 성능 최적화 | 완료 | Universal Binary로 native arm64 지원 |
| Apple Neural Engine 활용 | 낮 | Core ML 연동 검토 (AI 가속) |

---

## 구현 일정 (예시)

```
Week 1: D-1 ~ D-4  아이콘 + main.js GPU분기 + package.json 구성 + entitlements
Week 2: D-5 ~ D-7  공증 스크립트 + 빌드 스크립트 + 로컬 빌드 테스트
Week 3: C-1 ~ C-3  Intel Mac + Apple Silicon 기능 검증 전체
Week 4: A-1        DMG 배포 준비 + GitHub Releases 업로드
Week 5+: A-2       CI/CD 자동화 + 크래시 모니터링 설정
```

---

## 의존성 추가 목록

```bash
# 공증 도구
npm install --save-dev @electron/notarize

# .icns 크로스플랫폼 생성 (Windows CI에서도 가능)
npm install --save-dev png2icons

# (선택) DMG 커스터마이징
npm install --save-dev appdmg
```

---

*작성일: 2026-02-19*
*대상 버전: BanaNyang AI (현재 버전 기준)*
*담당: kiyocat*
