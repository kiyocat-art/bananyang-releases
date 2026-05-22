# Firebase Commercialization PDCA Plan (파이어베이스 상용화 계획안)

## 현재 앱 구현 상태 (Current State)
1. **Firebase 설정 (`firebase.json`)**: Hosting(웹 페이지 보팅), Functions, Firestore 설정이 완료되어 있으며, 로컬 에뮬레이터 설정도 되어있음.
2. **Firestore 보안 규칙 (`firestore.rules`)**: `users`, `purchases`, `licenses`, `pending_purchases` 컬렉션에 대한 접근 권한이 설계되어 있음. DRM(구매 내역) 관련 민감한 필드는 클라이언트에서 수정할 수 없도록 방어되어 있음.
3. **Cloud Functions (`functions/src/index.ts`)**: 
   - `paddleWebhook`: Paddle 결제 웹훅을 수신하고 서명을 검증한 뒤 Firestore에 결제 상태 업데이트 (`hasPurchased: true`).
   - `onUserCreated`: 신규 가입 시 `pending_purchases`를 확인하여 사전 결제 내역을 사용자 계정에 동기화하는 로직 구현.
4. **문제점 / 확인 필요 사항**:
   - Webhook 서명 검증 로직이 Paddle 버전에 맞게 완벽히 동작하는지 검증 필요 (코드 상 주석으로 간이 구현 여부 언급됨).
   - 실제 상용화(Production) 환경에서 필요한 설정(커스텀 도메인, 실결제 환경의 환경변수, 프로덕션 DB 격리) 등이 요구됨.

---

## PDCA (Plan - Do - Check - Act) 싸이클

### 1. Plan (계획)
상용 서비스를 위해 개발/테스트 환경을 프로덕션(Production) 환경으로 전환하고 보안 및 안정성을 확보합니다.

* **인프라/설정 분리**: 개발용 Firebase 프로젝트와 상용(Production) Firebase 프로젝트를 분리할지 결정(또는 기존 프로젝트를 상용으로 전환).
* **결제 연동 (Paddle)**:
  - Paddle Sandbox 환경에서 Paddle Live 환경으로 전환.
  - Live 환경의 Webhook Secret 발급 및 Firebase Functions 환경변수(액세스 키)로 등록.
  - Live 상품(Product) 및 가격(Price) ID 생성.
* **보안 및 규정**:
  - `firestore.rules` 재검토 (현재 잘 되어 있으나, 출시 전 최종 검열).
  - 클라이언트 앱 환경변수(`.env.production`)에 상용 Firebase Config 및 상용 Paddle ID 세팅.
* **호스팅 및 도메인**: Firebase Hosting에 커스텀 도메인(예: bananyang.ai) 연결 및 SSL 클라우드 플레어 설정 검토.

### 2. Do (실행)
계획한 사항을 실제 프로젝트 코드베이스와 콘솔에 적용 및 배포합니다.

1. **환경 변수 구성**:
   - `firebase functions:config:set paddle.webhook_secret="LIVE_SECRET"` 설정 적용.
   - 앱 내 `.env.production` 파일 생성 후 프로덕션 키 기입.
2. **Cloud Functions 배포**: 
   - `npm run deploy --prefix functions` 또는 `firebase deploy --only functions` 실행.
3. **Firestore 규칙 배포**: 
   - `firebase deploy --only firestore:rules` 실행.
4. **웹 호스팅 배포 (Next.js 웹페이지)**:
   - 커스텀 도메인 연결 후 `npm run build` (in `web`), 그리고 `firebase deploy --only hosting` 실행.
5. **클라이언트 앱 빌드 (Electron)**:
   - 프로덕션 환경변수를 물고 빌드 (`npm run dist` 등).

### 3. Check (점검 - QA)
상용 환경 배포 후, 실제 유저 시나리오를 바탕으로 시스템이 정상 작동하는지 검증합니다.

* **결제 & 웹훅 통합 테스트 (Real / 100% Coupon)**:
  - 라이브 빌드된 앱에서 실제 결제를 진행(또는 100% 할인 쿠폰 적용) 후 Cloud Functions가 정상적으로 웹훅을 수신하고 `users/{uid}`에 `hasPurchased: true`를 반영하는지 확인.
* **사전 결제 후 가입 테스트**:
  - 앱 설치 없이 웹사이트에서 먼저 결제 후(이메일 기반), 앱에 동일한 이메일로 최초 로그인(가입) 시 DRM이 자동 활성화되는지(`onUserCreated` 함수 작동 여부) 확인.
* **접근 보안 (Firestore)**:
  - 클라이언트 스크립트를 조작하여 `users/{uid}`의 본인 `hasPurchased` 필드를 강제로 쓰려고 시도했을 때 `Permission Denied` 에러가 발생하는지 확인.
* **에러 로그 모니터링**: 
  - Firebase 콘솔의 Functions Logs 탭을 확인하여 서명 오류나 Unhandled Exception이 없는지 집중 모니터링.

### 4. Act (조치 및 개선)
Check(점검) 단계에서 발생한 문제점을 수정하고, 모니터링 체계를 고도화합니다.

* 결제 웹훅 누락 시나리오 대비: Paddle 서버 오류나 일시적 장애로 Webhook 수신이 누락될 경우, 클라이언트나 관리자 페이지에서 거래 ID(Transaction ID)를 통해 수동으로 결제를 확인·복구할 수 있는 로직 구상 및 추가 구현.
* Analytics 연동 체크: 상용화 버전에 맞게 사용자들의 가입, 결제 퍼널(Funnel)이 Google Analytics/Firebase Analytics에 정상적으로 수집되는지 확인하고 이벤트 트래킹 개선.
* (이후 스프린트에 반영) 발견된 버그 픽스 후 Hotfix 배포 파이프라인 정립.
