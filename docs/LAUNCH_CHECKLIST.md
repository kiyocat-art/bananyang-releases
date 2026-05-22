# BanaNyang AI — 출시 종합 체크리스트

> **목표 출시일**: 2026-06-30 (D-39)
> **최종 업데이트**: 2026-05-22
> **비즈니스 모델**: BYOK (Bring Your Own Key) — UI 일회성 $19.99 USD, 생성 비용 사용자 부담
>
> 상태 표기: ✅ 완료 | 🚧 진행중 | ❓ 미확인 | ⛔ 블로커

---

## 📋 체크리스트 사용법

이 문서는 출시 준비 상태의 단일 진실 공급원(Single Source of Truth)입니다.
- 항목 완료 시 `[ ]` → `[x]` 로 변경하고 상태를 ✅로 업데이트
- 새 이슈 발견 시 해당 섹션에 항목 추가
- Claude에게 출시 일정 문의 시 이 파일 기반으로 답변함

---

## 1. 📍 자산 인벤토리 (Asset Registry)

> 관리하는 모든 서비스와 자산 목록. "내가 무엇을 쓰고 있나" 한눈에 파악.

| 자산 | 서비스 | 값 / URL | 상태 |
|------|--------|----------|------|
| **도메인** | Cloudflare | `bananyang.app` | ✅ |
| **도메인 만료일** | Cloudflare 대시보드 | ❓ 확인 필요 | ❓ |
| **웹 호스팅** | Vercel | `prj_7AZK7QitSyD3JYcDXqVLBtv9YFBh` | ✅ |
| **웹 URL** | Vercel | `https://bananyang.app` | ✅ |
| **Firebase 프로젝트** | Firebase | `bananyang-b9237` (prod, dev 미분리) | ✅ |
| **Cloud Functions URL** | Firebase us-central1 | `https://us-central1-bananyang-b9237.cloudfunctions.net/` | ✅ |
| **Cloud Storage** | Firebase Storage | `bananyang-ai.firebasestorage.app` | ✅ |
| **인스톨러 배포 경로** | Firebase Storage | `releases/{os}/` | ✅ |
| **자동 업데이트 URL** | Firebase Storage generic | `storage.googleapis.com/bananyang-ai.firebasestorage.app/releases/${os}` | ✅ |
| **GitHub Releases** | GitHub | `github.com/kiyocat-art/bananyang-releases` (최신 v1.0.5) | ✅ |
| **인증** | Firebase Auth | Google OAuth + Email/Password | ✅ |
| **데이터베이스** | Firestore | `bananyang-b9237` | ✅ |
| **이메일 발송** | Resend | API 키 발급 ❓ / 발신 도메인 ❓ | ❓ |
| **결제** | Paddle | `pkm0911@gmail.com` 계정, 연결 상태 ❓ | ❓ |
| **레거시 결제** | Lemon Squeezy | 코드 마이그레이션 완료, 계정 비활성화 필요 | 🚧 |
| **CI/CD** | — | 없음 (수동 배포) | ❓ |
| **크래시 리포팅** | — | 없음 | ❓ |

---

## 2. 💳 결제 & 라이선스

> **결정**: Paddle 단일화. Lemon Squeezy 코드 마이그레이션은 완료됨 — 대시보드 설정 + 키 등록이 남아 있음.

### Paddle 설정 (사용자 직접 — Paddle 대시보드)

- [ ] **Paddle 계정 로그인 확인** (`pkm0911@gmail.com`)
  - 상태: ❓
  - 현황: 계정 존재 확인됨, Live 모드 활성화 여부 미확인
  - 다음 액션: paddle.com 로그인 → 계정 상태 확인

- [ ] **Paddle Live 상품 생성**
  - 상태: ❓
  - 현황: Sandbox 상품 여부 미확인
  - 다음 액션: Catalog > Products > 새 상품 생성 (일회성, $19.99 USD)
  - 산출물: `pri_xxx` (Price ID) → Vercel 환경변수에 등록

- [ ] **Paddle Webhook 등록**
  - 상태: ❓
  - 현황: Cloud Function webhook 코드 구현 완료, 대시보드 등록 여부 미확인
  - 다음 액션: Developer tools > Notifications > 새 Webhook
    - URL: `https://us-central1-bananyang-b9237.cloudfunctions.net/paddleWebhook`
    - 이벤트: `transaction.completed`, `subscription.created`, `transaction.updated`
  - 산출물: Webhook Secret → Firebase Functions Secrets 등록

- [ ] **Paddle API Key + Client-side Token 발급**
  - 상태: ❓
  - 다음 액션: Developer tools > Authentication
  - 산출물: API Key (`sk_live_xxx`), Client-side token (`live_xxx`)

- [ ] **Paddle 정산 계좌 등록**
  - 상태: ❓
  - 다음 액션: Account > Payout methods > Wise 계좌 등록 (권장)

- [ ] **환불 정책 페이지 작성/검토**
  - 상태: ❓
  - 현황: `/tos` 페이지 존재, 별도 환불 정책 여부 미확인
  - 다음 액션: BYOK 모델 특성상 "API 키 사용 비용 환불 불가" 명시 필수

### Firebase Functions Secrets 등록 (터미널)

- [ ] **PADDLE_WEBHOOK_SECRET 등록**
  - 상태: ❓
  - 다음 액션: `firebase functions:secrets:set PADDLE_WEBHOOK_SECRET`

- [ ] **PADDLE_API_KEY 등록**
  - 상태: ❓
  - 다음 액션: `firebase functions:secrets:set PADDLE_API_KEY`

- [ ] **Firebase Functions 재배포**
  - 상태: ❓
  - 다음 액션: `firebase deploy --only functions`

### Vercel 환경변수 등록

- [ ] **Paddle 관련 환경변수 등록**
  - 상태: ❓
  - 다음 액션: Vercel 대시보드 > Settings > Environment Variables
  ```
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_xxx
  NEXT_PUBLIC_PADDLE_PRICE_ID=pri_xxx
  PADDLE_WEBHOOK_SECRET=xxx
  PADDLE_API_KEY=xxx
  ```

### Lemon Squeezy 정리

- [ ] **Lemon Squeezy 계정 상태 확인 + 결제 비활성화**
  - 상태: 🚧 (코드 마이그레이션 완료, 대시보드 정리 미완)
  - 다음 액션: Lemon Squeezy 대시보드 → 활성 상품 비활성화 또는 계정 해지

- [ ] **Lemon Squeezy 잔여 코드 제거**
  - 상태: 🚧
  - 현황: 코드 마이그레이션 완료 (layout.tsx에서 이미 PaddleScript로 교체됨), 아래 파일 잔존
  - 제거 대상:
    - `web/src/app/api/lemonsqueezy/webhook/route.ts`
    - `web/src/components/LemonSqueezyScript.tsx`
  - 다음 액션: 별도 PR로 처리

---

## 3. 🔐 보안 & 시크릿

- [x] **DEV_BYPASS_AUTH 프로덕션 제거 확인**
  - 상태: ✅
  - 현황: `.env.production`에 없음 — 확인 완료 (2026-04-11)

- [x] **Google OAuth Client ID — Desktop 앱 타입 확인**
  - 상태: ✅
  - 현황: Desktop 타입, 번들링 허용됨

- [ ] **Google OAuth — Vercel 프로덕션 도메인 승인 등록**
  - 상태: ❓
  - 현황: `bananyang.app` 도메인이 GCP OAuth 허용 도메인에 등록되었는지 미확인
  - 다음 액션: GCP Console > APIs & Services > Credentials > OAuth Client > Authorized origins에 `https://bananyang.app` 추가

- [x] **Firestore Rules 보안 검증**
  - 상태: ✅
  - 현황: `firestore.rules` — `hasPurchased` 등 민감 필드 클라이언트 수정 불가, Admin SDK 전용

- [ ] **Storage Rules 검증**
  - 상태: ❓
  - 현황: `storage.rules` 파일 존재, 내용 최종 검증 미완
  - 다음 액션: Storage Rules 프로덕션 배포 확인 (`firebase deploy --only storage`)

- [ ] **DRM grace period 동작 확인**
  - 상태: ❓
  - 현황: `drmService.ts` 7일 grace period 구현 완료, 실제 동작 테스트 미완
  - 다음 액션: 테스트 계정으로 오프라인 → 7일 경과 → 앱 잠금 시나리오 확인

- [x] **`functions.config()` 폐지 API → Secret Manager 전환**
  - 상태: ✅
  - 현황: 완료 (2026-04-11)

---

## 4. 🌐 웹사이트 (web/)

- [x] **bananyang.app Vercel 배포**
  - 상태: ✅
  - 현황: `https://bananyang.app` Vercel 배포 완료

- [ ] **Cloudflare DNS → Vercel 최종 확인**
  - 상태: ❓
  - 다음 액션: Cloudflare DNS 패널 → Vercel CNAME 레코드 정상 등록 여부 확인

- [ ] **`NEXT_PUBLIC_LAUNCH_MODE=live` 전환**
  - 상태: ❓
  - 현황: `siteConfig.ts` — `IS_COMING_SOON = process.env.NEXT_PUBLIC_LAUNCH_MODE !== 'live'`. 현재 Coming Soon 모드 여부 미확인
  - 다음 액션: Vercel 환경변수에 `NEXT_PUBLIC_LAUNCH_MODE=live` 추가

- [ ] **NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL 실제 URL 등록**
  - 상태: ❓
  - 현황: `siteConfig.ts` — `WINDOWS_URL = process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL ?? '#'`
  - 다음 액션: v1.0.6 빌드 후 Firebase Storage URL 입력

- [ ] **NEXT_PUBLIC_MAC_DOWNLOAD_URL 실제 URL 등록**
  - 상태: ❓
  - 현황: Mac 빌드 완료 여부 미확인 (Apple Developer 계정 필요)

- [ ] **NEXT_PUBLIC_SITE_URL 등록**
  - 상태: ❓
  - 다음 액션: Vercel 환경변수 `NEXT_PUBLIC_SITE_URL=https://bananyang.app`
  - 영향: Resend 발신 링크, 이메일 내 URL

- [ ] **EMAIL_FROM 등록**
  - 상태: ❓
  - 다음 액션: `EMAIL_FROM=noreply@bananyang.app` 또는 `support@bananyang.app`

- [ ] **Firebase Hosting 설정 정리**
  - 상태: 🚧
  - 현황: `firebase.json`에 `hosting` 블록 존재, Vercel 단일화 결정됨 — 충돌 방지를 위해 정리 필요
  - 다음 액션: `firebase.json`의 `hosting` 블록 제거 또는 Firebase Hosting 비활성화

- [ ] **다국어 최종 QA** (ko/en/ja/zh-CN/zh-TW/fr/es/id)
  - 상태: ❓
  - 현황: i18n 파일 8개 언어 구현 완료, 최종 내용 검수 미완

- [ ] **Privacy / ToS / Contact 페이지 법무 검토**
  - 상태: ❓
  - 현황: `/privacy`, `/tos`, `/contact` 페이지 존재, 내용 법무 검토 미완

- [ ] **BYOK 모델 명시 — "API 키 사용자 본인 부담" 문구**
  - 상태: ❓
  - 현황: 중요 — 이 문구 없으면 "왜 이미지 생성에 비용이 드냐"는 환불 분쟁 발생
  - 위치: 홈페이지 Hero/Features 섹션, ToS, FAQ (있다면)

- [ ] **YouTube 영상 ID 입력**
  - 상태: ❓
  - 현황: `web/src/lib/siteConfig.ts` VIDEOS 상수 전부 빈 문자열 `''`
  - 다음 액션: 영상 촬영/편집 완료 후 YouTube ID → Vercel 재배포

---

## 5. 📦 데스크톱 앱 배포

- [x] **Cloud Functions 6개 배포 완료**
  - 상태: ✅
  - 현황: `paddleWebhook`, `onUserCreated`, `processBatchJob`, `retryBatchJob`, `detectStuckJobs`, `cleanupExpiredJobs`

- [x] **GCP IAM Storage 권한 부여**
  - 상태: ✅
  - 현황: `139576605863-compute@developer.gserviceaccount.com` → `roles/storage.objectViewer`

- [ ] **v1.0.6 Windows 인스톨러 빌드**
  - 상태: ❓
  - 현황: 현재 최신 배포 v1.0.5 (GitHub Releases)
  - 다음 액션: `npm run dist:win:prod`
  - 주의: Windows 코드 사이닝 인증서 없으면 SmartScreen 경고 발생 (⛔ UX 블로커)

- [ ] **Windows 코드 사이닝 인증서**
  - 상태: ❓
  - 현황: NSIS 설정 있으나 서명 인증서 없으면 Windows Defender SmartScreen이 "알 수 없는 게시자" 경고
  - 다음 액션: EV 코드 사이닝 인증서 구매 결정 (Sectigo/DigiCert, ~$200-400/년) 또는 OV 인증서 (더 저렴, SmartScreen 신뢰도 낮음)

- [ ] **macOS 빌드 + Apple 공증**
  - 상태: ❓
  - 현황: `build/entitlements.mac.plist`, `scripts/notarize.js` 존재 — Apple Developer 계정($99/년) 필요
  - 다음 액션: Apple Developer 계정 상태 확인 → `npm run dist:mac:prod`

- [ ] **Firebase Storage 인스톨러 업로드**
  - 상태: ❓
  - 현황: `web/upload-release.cjs` 스크립트 존재
  - 다음 액션: 빌드 후 `node web/upload-release.cjs` 실행
  - URL 패턴: `storage.googleapis.com/bananyang-ai.firebasestorage.app/releases/win/BanaNyang-Setup-v1.0.6.exe`

- [ ] **electron-updater 자동 업데이트 채널 동작 확인**
  - 상태: ❓
  - 현황: `package.json` publish — Firebase Storage generic provider. `latest.yml` 생성/업로드 필요
  - 다음 액션: 이전 버전 앱에서 업데이트 감지 → 다운로드 → 설치 테스트

- [ ] **`app_releases` Firestore 버전 메타데이터 게시**
  - 상태: ❓
  - 현황: `firestore.rules`에 `app_releases` 컬렉션 read public, write Admin only 설정됨
  - 다음 액션: 배포 스크립트에서 Firestore에 버전 정보 업데이트

- [ ] **다운로드 URL ↔ 웹사이트 URL 일치 확인**
  - 상태: ❓
  - 다음 액션: Firebase Storage URL → `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL` 환경변수 등록 → Vercel 재배포

---

## 6. 👥 고객 지원 & 운영

- [ ] **지원 이메일 도메인 설정** (`support@bananyang.app`)
  - 상태: ❓
  - 다음 액션: Cloudflare + Resend에서 `bananyang.app` 이메일 도메인 인증 (MX, SPF, DKIM)

- [ ] **Resend API 키 발급 + 이메일 발송 테스트**
  - 상태: ❓
  - 현황: `web/src/lib/resend.ts` — `RESEND_API_KEY` 환경변수 필요
  - 다음 액션: resend.com 계정 → API 키 발급 → Vercel 환경변수 등록 → 실제 이메일 발송 테스트

- [ ] **문의 응답 SLA 결정**
  - 상태: ❓
  - 권장: 24-48시간 이내 응답 (솔로 운영 기준)

- [ ] **환불 처리 워크플로우 숙지**
  - 상태: ❓
  - 다음 액션: Paddle 대시보드 > Transactions → 환불 버튼 위치 및 절차 확인
  - 코드 측: 환불 시 `hasPurchased: false` 자동 처리됨 (`paddleWebhook transaction.updated` 이벤트)

- [ ] **Admin 페이지 접근 통제 확인**
  - 상태: ❓
  - 현황: `web/src/app/admin/` 존재, `web/src/lib/admin-auth.ts` 존재
  - 다음 액션: 관리자 계정 이외 접근 차단 여부 확인

---

## 7. 📊 분석 & 모니터링

- [ ] **Firebase Analytics 이벤트 트래킹 검증**
  - 상태: ❓
  - 다음 액션: Firebase 콘솔 > Analytics > Events — 기본 이벤트 수집 여부 확인. 결제 퍼널 커스텀 이벤트 추가 검토.

- [ ] **Cloud Functions 로그 모니터링 체계**
  - 상태: ❓
  - 다음 액션: Firebase 콘솔 > Functions > Logs 탭 북마크. 에러 알람 설정 (Cloud Monitoring Alerting Policy 권장)

- [ ] **Paddle 결제 실패/Webhook 누락 알람**
  - 상태: ❓
  - 다음 액션: Paddle 대시보드 > Notifications > 이메일 알람 설정

- [ ] **크래시 리포팅 도입 여부 결정**
  - 상태: ❓
  - 현황: 없음. 출시 전 결정 필요.
  - 옵션: Sentry (무료 티어 있음), Firebase Crashlytics (웹/앱 모두 지원)

---

## 8. ⚖️ 법적 / 정책

- [ ] **사업자등록증 발급**
  - 상태: 🚧 (진행 예정)
  - 현황: Paddle MoR이므로 사업자등록 없이도 글로벌 판매 가능하나, 한국 사용자 대상 통신판매업 신고 시 필요
  - 마감: 출시 전 완료 권장

- [ ] **통신판매업 신고**
  - 상태: ❓
  - 현황: 한국 거주자 대상 판매 시 필요. 사업자등록 완료 후 가능.
  - 참고: 공정거래위원회 사이버몰 통신판매업 신고

- [ ] **개인정보처리방침 (PIPA / GDPR) 최종 검토**
  - 상태: ❓
  - 현황: `/privacy` 페이지 존재, 내용 법무 검토 미완
  - 주의: Firebase Auth로 이메일/Google 계정 수집 → 개인정보 처리 명시 필수

- [ ] **약관 (ToS) 최종 검토**
  - 상태: ❓
  - 현황: `/tos` 페이지 존재, 내용 검토 미완

- [ ] **BYOK 이용 약관 명시**
  - 상태: ❓
  - 필수 문구: "Gemini/OpenAI 등 외부 AI API 키는 사용자가 직접 발급하며, API 사용 비용은 사용자 본인 부담입니다. BanaNyang은 API 비용에 대해 책임지지 않습니다."

- [ ] **환불 정책 (디지털 다운로드 + 라이선스 키)**
  - 상태: ❓
  - 권장: 다운로드 전 환불 가능 / 다운로드 후 환불 불가 (또는 7일 이내 1회) — 법적 요건 확인

---

## 9. 🚀 D-Day 절차

> 이 섹션은 출시 직전에 순서대로 실행. 체크리스트 1-8 모두 완료 후 진행.

**사전 조건**: 섹션 1-8 체크리스트 100% 완료

- [ ] **D-14 (2026-06-16): 전체 체크리스트 점검**
  - 상태: ⏳ 예정
  - 모든 ⛔ 블로커 해소, ❓ 미확인 항목 없어야 함

- [ ] **D-7 (2026-06-23): Sandbox → Live 전환 사전 테스트**
  - 상태: ⏳ 예정
  - Paddle Live 모드에서 100% 할인 쿠폰으로 전체 결제 플로우 테스트
  - Cloud Function → Firestore `hasPurchased: true` 반영 확인
  - DRM 작동 확인 (구매 완료 → 앱 잠금 해제)

- [ ] **D-5 (2026-06-25): 최종 인스톨러 빌드 + 업로드**
  - 상태: ⏳ 예정
  - `npm run dist:win:prod` → Firebase Storage 업로드
  - 다운로드 URL → Vercel 환경변수 업데이트 → 재배포

- [ ] **D-3 (2026-06-27): DNS 최종 확인 + `LAUNCH_MODE=live` 전환**
  - 상태: ⏳ 예정
  - Cloudflare DNS → Vercel CNAME 정상 동작 확인
  - `NEXT_PUBLIC_LAUNCH_MODE=live` → Coming Soon 해제

- [ ] **D-1 (2026-06-29): 실거래 최종 확인**
  - 상태: ⏳ 예정
  - 실제 소액 결제 테스트 (본인 다른 이메일 계정으로)
  - 인스톨러 다운로드 → 설치 → DRM 로그인 → 앱 사용 전체 플로우

- [ ] **D-Day (2026-06-30): 런칭 발표**
  - 상태: ⏳ 예정
  - 발표 채널: 블로그, SNS, 커뮤니티 (구체적 채널 결정 필요)
  - 지원 채널 오픈 (이메일 상시 모니터링)

- [ ] **롤백 플랜 문서화**
  - 상태: ❓
  - 항목: DNS 되돌리기 절차, Paddle 결제 일시 중단, Firebase 이전 버전 Functions 배포

---

## 10. 🔗 주요 URL & 참조

| 항목 | 값 |
|------|-----|
| 웹앱 | `https://bananyang.app` |
| Firebase 프로젝트 | `bananyang-b9237` |
| Cloud Functions (us-central1) | `https://us-central1-bananyang-b9237.cloudfunctions.net/` |
| paddleWebhook URL | `https://us-central1-bananyang-b9237.cloudfunctions.net/paddleWebhook` |
| Next.js Paddle Webhook | `https://bananyang.app/api/paddle/webhook` |
| Firebase Storage 인스톨러 | `storage.googleapis.com/bananyang-ai.firebasestorage.app/releases/` |
| GitHub Releases | `github.com/kiyocat-art/bananyang-releases` |
| Vercel 프로젝트 | `prj_7AZK7QitSyD3JYcDXqVLBtv9YFBh` |
| Vercel Org | `team_tOo8XcRR1jvKykA0hOyuricR` |
| 도메인 관리 | Cloudflare (`bananyang.app`) |
| Paddle 계정 | `pkm0911@gmail.com` |
| 이메일 발송 | Resend (도메인 ❓) |
| 앱 가격 | $19.99 USD 일회성 (lifetime) |
| DRM | Firebase Auth + Firestore `hasPurchased`, 7일 grace period |
| 비즈니스 모델 | BYOK — UI 판매, API 비용 사용자 부담 |

---

## 📊 진척도 요약

> 아래 수치는 `docs/LAUNCH_CHECKLIST.md` 체크박스 기준. 파일 직접 읽어 카운트.

**섹션별 완료 현황** (2026-05-22 기준):

| 섹션 | 완료 | 전체 | 비율 |
|------|------|------|------|
| 1. 자산 인벤토리 | 9 | 15 | ~60% |
| 2. 결제 & 라이선스 | 0 | 11 | 0% |
| 3. 보안 & 시크릿 | 3 | 7 | ~43% |
| 4. 웹사이트 | 1 | 11 | 9% |
| 5. 데스크톱 앱 | 2 | 8 | 25% |
| 6. 고객 지원 | 0 | 5 | 0% |
| 7. 분석 & 모니터링 | 0 | 4 | 0% |
| 8. 법적 / 정책 | 0 | 6 | 0% |
| 9. D-Day 절차 | 0 | 6 | 0% |
| **합계** | **15** | **73** | **~21%** |

### 현재 블로커 (⛔) — 출시 불가 항목

1. **Paddle 대시보드 미설정** — 상품/Webhook/API Key 없으면 결제 불가
2. **Firebase Functions Secrets 미등록** — Webhook 서명 검증 실패 → 모든 결제 처리 불가
3. **NEXT_PUBLIC_LAUNCH_MODE 미전환** — Coming Soon 모드 해제 안 되면 사용자가 구매 불가
4. **Windows 코드 사이닝** — SmartScreen 경고로 설치율 급감 (UX 블로커)
5. **인스톨러 다운로드 URL 미등록** — 다운로드 버튼이 `#` (빈 링크)

### 즉시 착수 가능한 항목 (외부 의존성 없음)

1. Lemon Squeezy 잔여 코드 제거 PR
2. Firebase Hosting `firebase.json` 정리
3. Vercel 환경변수 등록 (Paddle 키 발급 후)
4. `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM` 등 설정 가능 항목
