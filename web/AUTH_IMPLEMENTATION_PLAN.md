# BanaNyang 웹 - 회원 인증 및 계정 관리 구현 계획

> 작성일: 2026-02-20
> 대상: `web/` Next.js 마케팅 사이트

---

## 1. 목표 및 범위

### 구현할 기능
- 우측 상단 네비게이션에 로그인 / 회원가입 / 로그아웃 버튼
- 이메일+비밀번호 및 Google 소셜 로그인
- 회원가입 페이지 (`/auth/signup`)
- 로그인 페이지 (`/auth/login`)
- 내 계정 페이지 (`/account`) — 구매 이력, 인보이스, 라이선스 키 확인
- Paddle 구매 이력과 Firebase 계정 연동
- 라이선스 키 발급 및 서버사이드 검증

### 현재 구조의 문제점
| 현재 방식 | 문제점 |
|---|---|
| localStorage에만 purchase_token 저장 | 기기 변경 시 재인증 불가 |
| 라이선스 키 서버 검증 없음 | 아무 형식이면 통과 (보안 취약) |
| 구매자 이메일/계정 연결 없음 | 환불 처리, 재발급 불가 |
| 인보이스 없음 | 법적 요건 미충족 가능 |

---

## 2. 기술 스택 결정

### Firebase 선택 이유
- **Electron 앱이 이미 Firebase Auth 사용 중** → 동일 프로젝트 연결로 단일 계정 시스템
- Firebase Auth: Email/Password + Google 기본 제공
- Firestore: NoSQL, 실시간 업데이트, 서버리스
- Firebase Admin SDK: Next.js API Routes에서 사용 가능
- 무료 티어(Spark)로 시작 가능

### 추가 라이브러리
```
firebase           # Client SDK (Auth + Firestore)
firebase-admin     # Server SDK (API routes)
```

---

## 3. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                         브라우저                              │
│                                                             │
│  Landing Page    →    /auth/login    →    /account          │
│  (Nav: 로그인 버튼)    (로그인/가입)       (구매이력, 인보이스)  │
│       ↓                    ↓                   ↓            │
│  Firebase Auth Client SDK (google, email/password)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ ID Token (JWT)
┌──────────────────────▼──────────────────────────────────────┐
│                   Next.js API Routes                         │
│                                                             │
│  /api/auth/me          # 현재 유저 정보 조회                  │
│  /api/paddle/webhook   # 구매 완료 → Firestore 저장          │
│  /api/paddle/verify    # 트랜잭션 검증 + 유저 연결            │
│  /api/license/verify   # 라이선스 키 서버 검증               │
│  /api/account/invoices # 인보이스 목록 조회                   │
│       ↓                                                     │
│  Firebase Admin SDK                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Firebase                                  │
│                                                             │
│  Authentication          Firestore                          │
│  - Email/Password        - users/{uid}                      │
│  - Google OAuth          - purchases/{txnId}                │
│                          - licenses/{key}                   │
└─────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   Paddle Billing                            │
│  - 결제 처리                                                 │
│  - 트랜잭션 조회                                              │
│  - 인보이스 PDF URL 제공                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Firestore 데이터베이스 스키마

### Collection: `users`
```
users/{uid}
  ├── email: string
  ├── displayName: string | null
  ├── photoURL: string | null
  ├── locale: 'ko' | 'en' | 'ja'
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

### Collection: `purchases`
```
purchases/{paddleTransactionId}
  ├── uid: string                    # Firebase UID (null if purchased without account)
  ├── email: string                  # 구매자 이메일 (Paddle에서)
  ├── transactionId: string
  ├── status: 'completed' | 'refunded' | 'disputed'
  ├── amount: number                 # e.g. 1499 (cents)
  ├── currency: string               # 'USD'
  ├── purchasedAt: Timestamp
  ├── refundedAt: Timestamp | null
  ├── licenseKey: string             # 발급된 라이선스 키
  ├── invoiceUrl: string | null      # Paddle 인보이스 PDF URL
  └── items: Array<{
      │   priceId: string
      │   productName: string
      │   quantity: number
      └── }>
```

### Collection: `licenses`
```
licenses/{licenseKey}              # 키 = XXXX-XXXX-XXXX-XXXX
  ├── uid: string | null           # 사용자 계정 연결 시 설정
  ├── transactionId: string
  ├── email: string
  ├── isActive: boolean
  ├── issuedAt: Timestamp
  ├── revokedAt: Timestamp | null
  └── activatedAt: Timestamp | null
```

### Collection: `email_to_purchases` (보조 인덱스)
```
email_to_purchases/{email_hash}
  └── transactionIds: string[]      # 이메일로 구매 이력 조회용
```

---

## 5. 신규 파일 및 폴더 구조

```
web/src/
├── app/
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx          # 로그인 페이지
│   │   └── signup/
│   │       └── page.tsx          # 회원가입 페이지
│   ├── account/
│   │   └── page.tsx              # 내 계정 (구매이력, 인보이스)
│   ├── api/
│   │   ├── auth/
│   │   │   └── me/route.ts       # 현재 유저 정보
│   │   ├── paddle/
│   │   │   ├── verify/route.ts   # (기존, 수정)
│   │   │   └── webhook/route.ts  # (기존, 수정 - Firestore 저장)
│   │   ├── license/
│   │   │   └── verify/route.ts   # 라이선스 키 서버 검증
│   │   └── account/
│   │       └── invoices/route.ts # 인보이스 목록
│   ├── layout.tsx                # (수정 - AuthProvider 추가)
│   └── page.tsx                  # (수정 - 네비 버튼)
├── components/
│   ├── AuthNav.tsx               # 네비 우측 로그인/로그아웃/아바타
│   ├── LoginGate.tsx             # (수정 - Firebase 계정 연동)
│   └── (기존 파일들)
├── context/
│   ├── AuthContext.tsx           # Firebase Auth 상태 관리
│   └── LanguageContext.tsx       # (기존)
├── lib/
│   ├── firebase.ts               # Client Firebase 초기화
│   ├── firebase-admin.ts         # Server Firebase Admin 초기화
│   ├── license.ts                # 라이선스 키 생성 유틸
│   ├── i18n.ts                   # (수정 - auth 번역 추가)
│   └── paddle.ts                 # (기존)
└── middleware.ts                  # 인증 필요 라우트 보호
```

---

## 6. 구현 단계별 상세 계획

---

### Phase 1: Firebase 설정

**작업 목록:**

1. **Firebase 프로젝트 설정**
   - 기존 Electron 앱의 Firebase 프로젝트 확인 및 동일 프로젝트 사용 여부 결정
   - Authentication 공급자 활성화: Email/Password, Google
   - Firestore 데이터베이스 생성 (production mode)
   - Firebase Admin SDK 서비스 계정 키 발급

2. **환경 변수 추가** (`.env.local`)
   ```bash
   # Firebase Client (공개 가능)
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=

   # Firebase Admin (서버 전용, 절대 공개 금지)
   FIREBASE_ADMIN_PROJECT_ID=
   FIREBASE_ADMIN_CLIENT_EMAIL=
   FIREBASE_ADMIN_PRIVATE_KEY=
   ```

3. **`lib/firebase.ts` 생성** — 클라이언트 SDK 초기화
   ```ts
   import { initializeApp, getApps } from 'firebase/app';
   import { getAuth, GoogleAuthProvider } from 'firebase/auth';
   import { getFirestore } from 'firebase/firestore';

   const firebaseConfig = {
     apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
     authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
     projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
     appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
   };

   const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
   export const auth = getAuth(app);
   export const db = getFirestore(app);
   export const googleProvider = new GoogleAuthProvider();
   ```

4. **`lib/firebase-admin.ts` 생성** — 서버 SDK 초기화
   ```ts
   import { initializeApp, getApps, cert } from 'firebase-admin/app';
   import { getAuth } from 'firebase-admin/auth';
   import { getFirestore } from 'firebase-admin/firestore';

   if (!getApps().length) {
     initializeApp({
       credential: cert({
         projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
         clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
         privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
       }),
     });
   }

   export const adminAuth = getAuth();
   export const adminDb = getFirestore();
   ```

5. **Firestore Security Rules** 설정
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // 유저는 자신의 데이터만 읽기 가능
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       // 구매 이력은 서버(Admin SDK)만 쓰기 가능, 본인만 읽기
       match /purchases/{txnId} {
         allow read: if request.auth != null && request.auth.uid == resource.data.uid;
         allow write: if false; // Admin SDK만 허용
       }
       // 라이선스는 서버만 쓰기
       match /licenses/{key} {
         allow read: if request.auth != null && request.auth.uid == resource.data.uid;
         allow write: if false;
       }
     }
   }
   ```

---

### Phase 2: AuthContext 및 네비게이션

**작업 목록:**

1. **`context/AuthContext.tsx` 생성**
   ```ts
   interface AuthContextValue {
     user: FirebaseUser | null;
     loading: boolean;
     signInWithGoogle: () => Promise<void>;
     signInWithEmail: (email: string, pw: string) => Promise<void>;
     signUpWithEmail: (email: string, pw: string, name: string) => Promise<void>;
     signOut: () => Promise<void>;
   }
   ```
   - `onAuthStateChanged` 리스너로 세션 유지
   - 로그인 성공 시 Firestore `users/{uid}` 문서 생성/업데이트

2. **`app/layout.tsx` 수정** — AuthProvider 추가
   ```tsx
   <LanguageProvider>
     <AuthProvider>          {/* 추가 */}
       <PaddleScript />
       {children}
     </AuthProvider>
   </LanguageProvider>
   ```

3. **`components/AuthNav.tsx` 생성** — 네비 우측 버튼
   ```
   [로그인하지 않은 상태]
   [ 로그인 ]  [ 회원가입 ]

   [로그인한 상태]
   [ 👤 user@email.com ▾ ]
     ├── 내 계정
     └── 로그아웃
   ```
   - 드롭다운 메뉴 (CSS-only, 라이브러리 없이)
   - 반응형: 모바일에서 아이콘만 표시

4. **`app/page.tsx` 및 `app/download/page.tsx` 수정** — 네비에 `<AuthNav />` 추가

---

### Phase 3: 로그인 / 회원가입 페이지

**`/auth/login/page.tsx`**
```
┌─────────────────────────────────────┐
│            BanaNyang 로그인          │
│                                     │
│  [ Google로 계속하기  ]              │
│  ─────────── 또는 ───────────       │
│  이메일  [________________]          │
│  비밀번호 [________________]         │
│  [ 로그인 ]                         │
│                                     │
│  계정이 없으신가요? 회원가입 →        │
│  비밀번호를 잊으셨나요? 재설정 →      │
└─────────────────────────────────────┘
```
- 에러 처리: 잘못된 비밀번호, 존재하지 않는 이메일 등
- 로그인 성공 → `?redirect` 파라미터 또는 `/account`로 이동

**`/auth/signup/page.tsx`**
```
┌─────────────────────────────────────┐
│          BanaNyang 회원가입          │
│                                     │
│  [ Google로 계속하기  ]              │
│  ─────────── 또는 ───────────       │
│  이름     [________________]         │
│  이메일   [________________]         │
│  비밀번호 [________________] (8자+)  │
│  [ 회원가입 ]                        │
│                                     │
│  이미 계정이 있으신가요? 로그인 →     │
└─────────────────────────────────────┘
```
- 이메일 중복 확인
- 비밀번호 강도 표시
- 회원가입 후 이메일 인증 발송

**비밀번호 재설정**: Firebase 기본 제공 (`sendPasswordResetEmail`) — 별도 페이지 불필요

---

### Phase 4: 내 계정 페이지 (`/account`)

**레이아웃:**
```
┌────────────────────────────────────────────────────┐
│  BanaNyang                        user@email  [≡]  │
├────────────────────────────────────────────────────┤
│                                                    │
│  안녕하세요, {이름}님 👋                             │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ 🛒 구매 이력                                   │ │
│  │                                              │ │
│  │  v1.0.0  ·  $14.99  ·  2025-01-15           │ │
│  │  txn_xxxxx            [인보이스 PDF ↓]        │ │
│  │  라이선스 키: XXXX-XXXX-XXXX-XXXX  [복사]     │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ 👤 계정 정보                                   │ │
│  │  이름: [__________] [저장]                    │ │
│  │  이메일: user@email.com (변경 불가)            │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ ⚠️ 기기 변경이나 문제가 있으신가요?              │ │
│  │  이미 구매하셨다면 라이선스 키로 재활성화하세요.  │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**구현 사항:**
- 로그인 필요 (미로그인 시 `/auth/login?redirect=/account` 리다이렉트)
- 구매 이력: Firestore `purchases` 컬렉션 조회
- 인보이스 PDF: Paddle API에서 받은 URL 또는 자체 생성
- 라이선스 키 표시 및 복사 버튼
- 이름 변경 (Firebase Auth + Firestore 업데이트)

---

### Phase 5: Paddle 연동 강화

**`/api/paddle/webhook/route.ts` 수정:**
```ts
// transaction.completed 이벤트 처리
async function handleTransactionCompleted(data: PaddleTransactionData) {
  // 1. 라이선스 키 생성
  const licenseKey = generateLicenseKey(); // XXXX-XXXX-XXXX-XXXX

  // 2. 구매자 이메일로 Firebase 유저 조회 시도
  let uid: string | null = null;
  try {
    const firebaseUser = await adminAuth.getUserByEmail(data.customer.email);
    uid = firebaseUser.uid;
  } catch {
    // 계정 없음 — uid는 null, 나중에 연결 가능
  }

  // 3. Firestore에 구매 저장
  await adminDb.collection('purchases').doc(data.id).set({
    uid,
    email: data.customer.email,
    transactionId: data.id,
    status: 'completed',
    amount: data.details.totals.total,
    currency: data.currencyCode,
    purchasedAt: new Date(),
    licenseKey,
    invoiceUrl: data.invoice_url ?? null,
    items: data.items.map(item => ({...})),
  });

  // 4. 라이선스 저장
  await adminDb.collection('licenses').doc(licenseKey).set({
    uid,
    transactionId: data.id,
    email: data.customer.email,
    isActive: true,
    issuedAt: new Date(),
  });

  // 5. (선택) 환영 이메일 발송
}

// transaction.refunded 이벤트 처리
async function handleTransactionRefunded(data) {
  // 라이선스 비활성화
  await adminDb.collection('licenses').doc(licenseKey).update({
    isActive: false,
    revokedAt: new Date(),
  });
  // 구매 상태 업데이트
  await adminDb.collection('purchases').doc(data.id).update({
    status: 'refunded',
    refundedAt: new Date(),
  });
}
```

**`/api/license/verify/route.ts` 신규 생성:**
```ts
// POST { key: 'XXXX-XXXX-XXXX-XXXX' }
// 라이선스 키 검증 + 계정 연결
export async function POST(req: Request) {
  const { key } = await req.json();
  const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!keyPattern.test(key)) {
    return NextResponse.json({ valid: false, error: 'invalid_format' }, { status: 400 });
  }

  const licenseDoc = await adminDb.collection('licenses').doc(key).get();
  if (!licenseDoc.exists) {
    return NextResponse.json({ valid: false, error: 'not_found' }, { status: 404 });
  }

  const license = licenseDoc.data()!;
  if (!license.isActive) {
    return NextResponse.json({ valid: false, error: 'revoked' }, { status: 403 });
  }

  // 로그인 상태라면 라이선스와 계정 연결
  const idToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (idToken) {
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      if (!license.uid) {
        await adminDb.collection('licenses').doc(key).update({ uid: decoded.uid });
        await adminDb.collection('purchases').doc(license.transactionId).update({ uid: decoded.uid });
      }
    } catch { /* 토큰 검증 실패는 무시 */ }
  }

  return NextResponse.json({ valid: true, transactionId: license.transactionId });
}
```

**`components/LoginGate.tsx` 수정:**
- 기존 localStorage 방식 유지 + Firebase Auth 상태 확인 추가
- 로그인한 유저: Firestore에서 구매 이력 조회 → 구매 내역 있으면 자동 잠금 해제
- 라이선스 키 검증: `/api/license/verify` API 호출로 서버 검증

---

### Phase 6: 라이선스 키 생성 유틸리티

**`lib/license.ts` 생성:**
```ts
import { randomBytes } from 'crypto';

/**
 * 암호학적으로 안전한 라이선스 키 생성
 * 형식: XXXX-XXXX-XXXX-XXXX (영문 대문자 + 숫자)
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외 (0/O, 1/I)
  const segments = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () =>
      chars[randomBytes(1)[0] % chars.length]
    ).join('')
  );
  return segments.join('-');
}
```

---

### Phase 7: 미들웨어 및 라우트 보호

**`middleware.ts` 생성:**
```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// /account 페이지는 로그인 필요
// 클라이언트 사이드 체크로도 충분하나, 미들웨어로 이중 보호
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/account')) {
    // Firebase session cookie 확인 (선택적 — 쿠키 기반 세션 구현 시)
    // 현재는 클라이언트 사이드 리다이렉트로 처리
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*'],
};
```

---

### Phase 8: i18n 번역 추가

`lib/i18n.ts`에 추가할 섹션:
```ts
auth: {
  login: '로그인',
  signup: '회원가입',
  logout: '로그아웃',
  myAccount: '내 계정',
  email: '이메일',
  password: '비밀번호',
  name: '이름',
  continueWithGoogle: 'Google로 계속하기',
  forgotPassword: '비밀번호를 잊으셨나요?',
  alreadyHaveAccount: '이미 계정이 있으신가요?',
  noAccount: '계정이 없으신가요?',
  errors: {
    emailInUse: '이미 사용 중인 이메일입니다.',
    wrongPassword: '이메일 또는 비밀번호가 올바르지 않습니다.',
    userNotFound: '존재하지 않는 계정입니다.',
    weakPassword: '비밀번호는 8자 이상이어야 합니다.',
  },
},
account: {
  title: '내 계정',
  purchaseHistory: '구매 이력',
  noPurchases: '구매 이력이 없습니다.',
  invoice: '인보이스 PDF',
  licenseKey: '라이선스 키',
  copyKey: '복사',
  keyCopied: '복사됨!',
  profile: '계정 정보',
  saveChanges: '저장',
},
```

---

## 7. 구매 후 계정 연결 흐름

### 케이스 1: 계정 있는 상태에서 구매
```
유저 로그인 → /download 방문 → Paddle 구매
→ webhook: email로 Firebase UID 조회 성공 → uid 저장
→ /download?purchased=true&transaction_id=xxx
→ LoginGate: Firestore에서 uid로 구매 조회 → 자동 잠금 해제
```

### 케이스 2: 비로그인 상태에서 구매
```
유저 미로그인 → /download 방문 → Paddle 구매 (이메일만)
→ webhook: Firebase 유저 없음 → uid=null로 저장
→ /download?purchased=true → 라이선스 키 입력 안내
→ 나중에 회원가입 → 이메일로 기존 구매 이력 자동 연결
```

### 케이스 3: 구매 후 회원가입
```
AuthContext의 signUpWithEmail:
→ 회원가입 성공
→ Firestore `purchases` 컬렉션에서 email 일치하는 미연결 구매 조회
→ uid 업데이트 (계정 연결)
→ /account에서 구매 이력 확인 가능
```

---

## 8. 보안 고려사항

| 항목 | 조치 |
|---|---|
| Firebase Admin 키 노출 | 환경변수만 사용, `.gitignore` 확인 |
| Paddle Webhook 위조 | HMAC-SHA256 서명 검증 유지 |
| 라이선스 키 무차별 대입 | Firestore 규칙 + API Rate Limiting |
| ID Token 위조 | `adminAuth.verifyIdToken()` 항상 서버에서 검증 |
| XSS | Next.js 기본 보호, 인라인 스크립트 금지 |
| 인보이스 접근 | uid 일치 확인 후 URL 반환 |

---

## 9. 구현 순서 (권장)

| 순서 | 작업 | 예상 규모 |
|---|---|---|
| 1 | Firebase 프로젝트 설정 + 환경변수 | 소 |
| 2 | `lib/firebase.ts`, `lib/firebase-admin.ts` | 소 |
| 3 | `context/AuthContext.tsx` | 중 |
| 4 | `layout.tsx` AuthProvider 삽입 | 소 |
| 5 | `components/AuthNav.tsx` (네비 버튼) | 중 |
| 6 | `/auth/login` 페이지 | 중 |
| 7 | `/auth/signup` 페이지 | 중 |
| 8 | Webhook 수정 + `lib/license.ts` | 중 |
| 9 | `/api/license/verify` API | 소 |
| 10 | `LoginGate.tsx` Firebase 연동 수정 | 중 |
| 11 | `/account` 페이지 | 대 |
| 12 | i18n 번역 추가 | 소 |
| 13 | Firestore Security Rules 배포 | 소 |
| 14 | 테스트 (구매 플로우 전체) | 대 |

---

## 10. 추후 개선 사항 (v2)

- **이메일 인증**: `sendEmailVerification()` — 가입 후 인증 강제
- **비밀번호 재설정 페이지**: 커스텀 UI (`/auth/reset-password`)
- **세션 쿠키**: HttpOnly 쿠키로 SSR 인증 지원
- **다중 기기 세션 관리**: Firebase Auth는 기본적으로 지원
- **구매자 이메일 알림**: Paddle의 자동 영수증 이메일 또는 직접 발송
- **관리자 대시보드**: 구매 이력, 라이선스 관리 (별도 `/admin` 페이지)
- **환불 자동화**: Paddle 환불 webhook → 라이선스 자동 비활성화 (Phase 5에 포함)
- **Apple 로그인**: Firebase Auth에 Apple 공급자 추가

---

*이 문서는 구현 가이드입니다. 실제 Firebase 프로젝트 ID 및 API 키는 팀 내부에서 안전하게 공유하세요.*
