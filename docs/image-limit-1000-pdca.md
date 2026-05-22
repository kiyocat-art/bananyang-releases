# 이미지 제한 1000장 확장 PDCA 실행 계획

> **문서 버전:** v1.0
> **작성일:** 2026-02-06
> **목표:** 현재 300장 → 1000장으로 안정적 확장
> **핵심 원칙:** 메모리 안전성을 유지하면서 점진적으로 한도 상향

---

## 목차

1. [현황 요약](#1-현황-요약)
2. [Phase 1 — P0: 계층적 Blob URL 관리](#phase-1--p0-계층적-blob-url-관리)
3. [Phase 2 — P1: 연속 생성 Flow Control + 점진적 한도](#phase-2--p1-연속-생성-flow-control--점진적-한도)
4. [Phase 3 — P2: VRAM 동적 조정 + Display Object 가상화](#phase-3--p2-vram-동적-조정--display-object-가상화)
5. [위험 요소 매트릭스](#위험-요소-매트릭스)
6. [성공 지표](#성공-지표)

---

## 1. 현황 요약

### 현재 메모리 구조

| 계층 | 한도 | 위치 |
|---|---|---|
| VRAM (GPU 텍스처) | 512MB 고정 | `rendering.worker.ts:193` |
| RAM (Blob URL) | 200개 초과 시 aggressive cleanup | `blobManager.ts:16` |
| Auto-cleanup 임계값 | 1GB | `useMemoryCleanup.ts:27` |
| 이미지 수 제한 | 300장 hard / 270장 soft | `settingsStore.ts:87-93` |

### 이미지 1장당 메모리 사용량

| 리소스 | 해상도 | 크기 |
|---|---|---|
| tinySrc | 128×128 | ~64KB |
| previewSrc | 1024×1024 | ~4MB |
| proxySrc | ~1024px | ~3-4MB |
| originalSrc | 원본 | ~2-10MB |
| thumbnailSrc | 소형 | ~100-200KB |
| ktx2Src | GPU 압축 | ~1-2MB |
| **합계 (전체 LOD)** | | **~8-15MB** |
| **합계 (tiny+preview만)** | | **~4MB** |

### 300장 vs 1000장 예상 메모리

| 항목 | 300장 (현재) | 1000장 (개선 전) | 1000장 (개선 후 목표) |
|---|---|---|---|
| Blob URL RAM | ~1.2-4.5GB | ~4-15GB | **~300MB** |
| VRAM (뷰포트 50장) | ~200MB | ~200MB | ~200MB |
| JS Heap | ~3MB | ~10MB | ~10MB |
| Progressive Load | ~2.3초 | ~7.5초 | ~4초 |

---

## Phase 1 — P0: 계층적 Blob URL 관리

> **예상 효과:** RAM ~90% 절감
> **대상 파일:**
> - `src/hooks/useMemoryCleanup.ts`
> - `src/utils/blobManager.ts`
> - `src/store/canvasStore.ts`

---

### Plan (계획)

#### 방안 1-A: 뷰포트 기반 Blob URL 3-Zone 관리

**문제 정의:**
현재 `getActiveImageUrls()`가 **모든 이미지의 모든 LOD URL을 active로 표시**하여 `safeCleanup()`이 아무것도 해제하지 못함. 1000장 시 최대 9000개 blob URL이 메모리에 상주.

**목표 구조:**

```
┌──────────────────────────────────────────────────────────┐
│  Zone 1: 뷰포트 내 (Visible)                              │
│  보유: tinySrc + previewSrc                               │
│  조건: 선택된 이미지만 originalSrc 추가 로드                 │
│                                                          │
│  Zone 2: 뷰포트 근처 (Nearby, 1.5x padding)               │
│  보유: tinySrc만                                          │
│  해제: previewSrc, originalSrc, proxySrc                  │
│  복원: 뷰포트 진입 시 디스크 캐시에서 재로드                  │
│                                                          │
│  Zone 3: 먼 이미지 (Far)                                  │
│  보유: tinySrc만 (128px = 64KB)                           │
│  해제: 나머지 모든 blob URL                                │
│  복원: 뷰포트 접근 시 workspace 파일에서 복원                │
└──────────────────────────────────────────────────────────┘
```

**메모리 예산:**

| Zone | 이미지 수 (예상) | 이미지당 메모리 | Zone 합계 |
|---|---|---|---|
| Zone 1 (Visible) | ~50장 | ~4MB (tiny+preview) | ~200MB |
| Zone 2 (Nearby) | ~100장 | ~64KB (tiny만) | ~6.4MB |
| Zone 3 (Far) | ~850장 | ~64KB (tiny만) | ~54MB |
| **합계** | **1000장** | | **~260MB** |

---

### Do (실행)

#### 1-A: 뷰포트 기반 Blob URL Zone 관리

**Step 1.** `useMemoryCleanup.ts` — `getActiveImageUrls()` 뷰포트 기반 필터링

```typescript
// 변경 전: 모든 이미지의 모든 URL을 active로 표시
// 변경 후: 뷰포트 기반 Zone 분류

function getActiveImageUrls(): Set<string> {
    const { boardImages, pan, zoom } = useCanvasStore.getState();
    const activeUrls = new Set<string>();

    // 뷰포트 계산
    const mainPanel = document.getElementById('main-panel');
    const vw = mainPanel?.clientWidth || window.innerWidth;
    const vh = mainPanel?.clientHeight || window.innerHeight;

    const viewRect = {
        x: -pan.x / zoom,
        y: -pan.y / zoom,
        width: vw / zoom,
        height: vh / zoom,
    };

    // Nearby padding (1.5x)
    const pad = Math.max(viewRect.width, viewRect.height) * 0.5;

    for (const img of boardImages) {
        const isVisible = (
            img.x < viewRect.x + viewRect.width + pad &&
            img.x + img.width > viewRect.x - pad &&
            img.y < viewRect.y + viewRect.height + pad &&
            img.y + img.height > viewRect.y - pad
        );

        // tinySrc는 항상 보호 (Zone 1/2/3 공통)
        if (img.tinySrc) activeUrls.add(img.tinySrc);

        if (isVisible) {
            // Zone 1 + Zone 2: preview 보호
            if (img.previewSrc) activeUrls.add(img.previewSrc);
            if (img.proxySrc) activeUrls.add(img.proxySrc);
            if (img.src) activeUrls.add(img.src);
            if (img.maskSrc) activeUrls.add(img.maskSrc);
            // originalSrc/highResSrc/ktx2Src는 선택된 이미지만
        }
        // Zone 3 (Far): tinySrc만 보호 → 나머지 자동 해제 대상
    }

    return activeUrls;
}
```

**Step 2.** `blobManager.ts` — Zone 기반 cleanup 활성화

```typescript
// BlobManager에 뷰포트 기반 주기적 cleanup 추가
// 기존 자동 cleanup이 비활성화된 이유(시간 기반이라 위험) 해소:
// → 시간이 아닌 "뷰포트 거리" 기반이므로 안전

startViewportCleanup(intervalMs: number = 10000): void {
    // 10초 간격으로 뷰포트 기반 cleanup 실행
    // getActiveImageUrls()가 Zone 정보를 반영하므로
    // safeCleanup()만 호출하면 Zone 3 blob이 자동 해제
}
```

**Step 3.** `canvasStore.ts` — off-screen 이미지 blob 복원 메커니즘

```typescript
// 뷰포트 진입 시 해제된 previewSrc 복원
// workspace 파일 내 이미지 경로에서 blob 재생성
// 이미 존재하는 tinySrc → previewSrc 전환은 기존 progressive upgrade 로직 활용
```

---

### Check (검증)

| 검증 항목 | 방법 | 합격 기준 |
|---|---|---|
| Blob URL 수 (1000장) | Memory Monitor에서 확인 | 뷰포트 외 이미지 URL 해제 확인 |
| RAM 사용량 (1000장) | Chrome Task Manager | < 2GB (전체 프로세스) |
| blob 복원 정상 동작 | 뷰포트 이동 후 이미지 표시 확인 | 깨진 이미지 0건 |
| 기존 300장 워크스페이스 호환 | 기존 .nyang 파일 로드 | 정상 로드 + 성능 저하 없음 |

**테스트 시나리오:**

```
시나리오 1: 대량 로드 테스트
  1. 1000장 이미지가 포함된 workspace 로드
  2. Memory Monitor에서 blob URL 수 확인
  3. 전체 줌아웃 → 줌인 반복 5회
  4. RAM/VRAM 모니터링

시나리오 2: 연속 스크롤 테스트
  1. 500장 상태에서 캔버스 좌→우 빠른 패닝
  2. off-screen 이미지 blob 해제 확인
  3. 패닝 중 FPS 측정
  4. 복원된 이미지 품질 확인

```

---

### Act (조치)

| 결과 | 조치 |
|---|---|
| 합격 | Phase 2 진행, hardLimit 500으로 1차 상향 |
| blob 복원 지연 > 2초 | Zone 2 패딩 확대 (1.5x → 2.0x) |
| RAM > 2GB | cleanup 주기 단축 (10초 → 5초) |
| 깨진 이미지 발생 | blob 해제 전 refCount 재검증 로직 추가 |
| 기존 workspace 호환 실패 | migration 로직 추가 (settings version 12) |

---

## Phase 2 — P1: 연속 생성 Flow Control + 점진적 한도

> **예상 효과:** 연속 생성 시 메모리 스파이크 방지, UX 개선
> **대상 파일:**
> - `src/hooks/useImageGeneration.ts`
> - `src/store/canvasStore.ts`
> - `src/store/settingsStore.ts`
> - `src/components/ImageLimitWarning.tsx`

---

### Plan (계획)

#### 방안 2-A: 생성 큐 Backpressure 시스템

**문제 정의:**
`addImagesToCenter`에서 `Promise.all(media.map(...))`으로 동시 처리.
10장 동시 생성 시 ~150MB 순간 할당 → GC 부담 + VRAM 스파이크.

**목표:**

```
┌────────────────────────────────────────────────┐
│  Generation Queue with Backpressure             │
│                                                │
│  1. 생성 요청 → 큐에 추가                        │
│  2. 동시 처리 최대 2장 (concurrency = 2)         │
│  3. 완료 → VRAM 사용량 체크                      │
│  4. VRAM > 80% (410MB) → cleanup 후 대기        │
│  5. VRAM < 70% (358MB) → 다음 배치 시작          │
│  6. 총 큐 크기 > 20 → 초과분 거부 + 알림          │
└────────────────────────────────────────────────┘
```

#### 방안 2-B: 점진적 한도 + 메모리 기반 동적 조절

**목표 한도 체계:**

```
┌──────────┬──────────────────────────────────────┐
│ 이미지 수 │ 동작                                  │
├──────────┼──────────────────────────────────────┤
│ 0-699    │ 정상 동작, 제한 없음                    │
│ 700-899  │ 노란색 soft warning (5장 간격 팝업)     │
│ 900-999  │ 주황색 strong warning (매 추가 시 팝업)  │
│ 1000     │ 빨간색 hard limit (추가 차단)           │
├──────────┼──────────────────────────────────────┤
│ 보조 조건  │ RAM > 3GB 시 이미지 수와 무관하게 경고  │
│          │ RAM > 4GB 시 hard block                │
└──────────┴──────────────────────────────────────┘
```

---

### Do (실행)

#### 2-A: 생성 큐 Backpressure

**Step 1.** `canvasStore.ts` — `addImagesToCenter` 동시 처리 제한

```typescript
// 변경 전: Promise.all(media.map(...)) — 전체 동시 처리
// 변경 후: runWithLimit 패턴으로 concurrency 제한

const GENERATION_CONCURRENCY = 2;

const processedNewImages = await runWithConcurrency(
    media.map(item => () => processImage(item)),
    GENERATION_CONCURRENCY,
    async () => {
        // 각 이미지 처리 후 VRAM 체크
        // Worker에 메모리 상태 요청 → backpressure 적용
    }
);
```

**Step 2.** `rendering.worker.ts` — 메모리 상태 보고 채널 추가

```typescript
// Worker → Main Thread: 현재 VRAM 상태 보고
// 기존 이벤트 시스템 활용
case 'query-memory-status':
    self.postMessage({
        type: 'memory-status',
        data: {
            vramUsageMB: currentTotalBytes / (1024 * 1024),
            textureCount: textureCache.size,
            isUnderPressure: currentTotalBytes > MAX_TEXTURE_BYTES * 0.8,
        }
    });
    break;
```

#### 2-B: 점진적 한도 시스템

**Step 3.** `settingsStore.ts` — 3단계 warning + 메모리 기반 동적 한도

```typescript
imageLimitConfig: {
    softLimit: 700,           // 70%: 노란색 경고
    strongLimit: 900,         // 90%: 주황색 강한 경고
    hardLimit: 1000,          // 100%: 빨간색 차단
    warningEnabled: true,
    warningDismissedUntil: null,
    lastShownAtCount: 0,
    // 신규 필드
    memoryBasedLimitEnabled: true,
    maxMemoryMB: 4096,        // 4GB RAM 한도
    memoryWarningMB: 3072,    // 3GB RAM 경고
}
```

**Step 4.** `ImageLimitWarning.tsx` — 3단계 UI + 메모리 경고

```typescript
// 기존 'soft' | 'hard' → 'soft' | 'strong' | 'hard' | 'memory' 확장
// 주황색(strong): "이미지가 매우 많습니다. 성능 저하가 발생할 수 있습니다."
// 메모리 경고: "시스템 메모리 사용량이 높습니다. (현재: 3.2GB / 4GB)"
```

---

### Check (검증)

| 검증 항목 | 방법 | 합격 기준 |
|---|---|---|
| 연속 생성 10장 메모리 | 생성 중 RAM 모니터링 | 순간 스파이크 < 300MB |
| 연속 생성 중 FPS | DevTools Performance | > 20fps 유지 |
| Backpressure 동작 | VRAM 80% 상태에서 생성 | cleanup 후 재개 확인 |
| 3단계 warning UI | 이미지 수 단계별 증가 | 각 단계 정확한 UI 표시 |
| 메모리 기반 경고 | 의도적 메모리 부하 | 3GB 초과 시 경고 표시 |
| 한도 설정 migration | 기존 v11 설정 로드 | v12로 정상 마이그레이션 |

**테스트 시나리오:**

```
시나리오 4: 연속 생성 스트레스 테스트
  1. 이미지 500장 상태에서 AI 생성 20장 연속 요청
  2. 생성 중 RAM/VRAM 추이 모니터링
  3. backpressure 발동 시점 기록
  4. 최종 생성 완료까지 소요 시간 측정

시나리오 5: 한도 단계별 전환 테스트
  1. 이미지 0장부터 10장씩 추가
  2. 700, 900, 1000장에서 warning 전환 확인
  3. 1000장에서 추가 차단 확인
  4. 이미지 삭제 후 warning 해제 확인
```

---

### Act (조치)

| 결과 | 조치 |
|---|---|
| 합격 | Phase 3 진행, hardLimit 1000 정식 적용 |
| 생성 중 FPS < 20 | concurrency 2 → 1로 하향 |
| backpressure 미작동 | Worker 메시지 채널 동기화 점검 |
| 메모리 경고 과민 반응 | 임계값 3GB → 3.5GB 상향 조정 |
| 기존 사용자 혼란 | 설정 UI에 한도 조절 슬라이더 추가 |

---

## Phase 3 — P2: VRAM 동적 조정 + Display Object 가상화

> **예상 효과:** GPU별 최적 성능, JS heap 절감, FPS 개선
> **대상 파일:**
> - `src/features/canvas/rendering.worker.ts`
> - `src/hooks/useCanvasWorker.ts` (또는 Worker 통신 계층)

---

### Plan (계획)

#### 방안 3-A: GPU VRAM 동적 감지 및 한도 조정

**문제 정의:**
`MAX_TEXTURE_BYTES = 512MB` 고정값. GPU VRAM 4GB인 시스템과 24GB인 시스템이 동일 한도.

**목표:**

```
┌──────────────┬─────────────────────────────────┐
│ 감지된 VRAM    │ MAX_TEXTURE_BYTES 설정           │
├──────────────┼─────────────────────────────────┤
│ 감지 실패      │ 512MB (현재 기본값, 안전)         │
│ 2GB 이하      │ 384MB (보수적)                   │
│ 2-4GB        │ 512MB (현재와 동일)               │
│ 4-8GB        │ 1024MB                          │
│ 8GB 이상      │ 1536MB (최대 상한)               │
├──────────────┼─────────────────────────────────┤
│ 공통 규칙      │ 전체 VRAM의 25% 이하             │
└──────────────┴─────────────────────────────────┘
```

#### 방안 3-B: Display Object 가상화

**문제 정의:**
현재 1000장 모두 Pixi `Container` + `Sprite` + `Graphics` 생성.
`updateContent()`에서 매 프레임 1000회 반복.

**목표:**

```
활성 객체:  뷰포트 + 1.5x 패딩 내 이미지만 Pixi 객체 보유
비활성 객체: 메타데이터(x, y, width, height)만 유지
전환:       뷰포트 진입 시 즉시 생성 + TINY 텍스처 할당
            뷰포트 이탈 시 30초 후 Pixi 객체 destroy

예상 활성 객체 수: ~100-150개 (뷰포트 + 패딩)
매 프레임 반복: 1000 → ~150 (85% 감소)
```

---

### Do (실행)

#### 3-A: VRAM 동적 감지

**Step 1.** `rendering.worker.ts` — 초기화 시 VRAM 감지

```typescript
// OffscreenCanvas → WebGL2 context에서 GPU 정보 추출
const detectGPUMemory = (gl: WebGL2RenderingContext): number => {
    // 1차: WEBGL_debug_renderer_info 확장
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        // GPU 모델명에서 VRAM 추정 (알려진 모델 DB)
    }

    // 2차: gl.getParameter로 최대 텍스처 크기 기반 추정
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

    // 3차: Electron API로 시스템 GPU 정보 접근
    // (Main Process에서 app.getGPUInfo() 호출 후 전달)

    return estimatedVRAM; // bytes
};

// MAX_TEXTURE_BYTES를 동적으로 설정
let MAX_TEXTURE_BYTES = 512 * 1024 * 1024; // 기본값

const initVRAMLimit = (gl: WebGL2RenderingContext) => {
    const vram = detectGPUMemory(gl);
    if (vram <= 2 * 1024 * 1024 * 1024) {
        MAX_TEXTURE_BYTES = 384 * 1024 * 1024;
    } else if (vram <= 4 * 1024 * 1024 * 1024) {
        MAX_TEXTURE_BYTES = 512 * 1024 * 1024;
    } else if (vram <= 8 * 1024 * 1024 * 1024) {
        MAX_TEXTURE_BYTES = 1024 * 1024 * 1024;
    } else {
        MAX_TEXTURE_BYTES = 1536 * 1024 * 1024;
    }
    // 절대 상한: 전체 VRAM의 25%
    MAX_TEXTURE_BYTES = Math.min(MAX_TEXTURE_BYTES, vram * 0.25);
};
```

#### 3-B: Display Object 가상화

**Step 2.** `rendering.worker.ts` — 가상화 컨테이너 시스템

```typescript
// 새로운 자료구조: 활성/비활성 분리
const activeDisplayObjects = new Map<string, Container>();  // 뷰포트 내
const dormantMetadata = new Map<string, { x: number; y: number; w: number; h: number }>();

// updateContent() 변경:
// 1. 뷰포트 기반 활성 목록 계산 (O(n) 1회)
// 2. 활성 목록에만 Pixi 객체 생성/업데이트
// 3. 비활성 전환 시 지연 destroy (30초)
```

**Step 3.** `rendering.worker.ts` — `reconcile()` 최적화

```typescript
// 변경 전: 매 프레임 모든 boardImages 순회
// 변경 후: 뷰포트 변경 시에만 활성 목록 재계산
//          프레임마다는 활성 목록만 순회

let lastViewRect = { x: 0, y: 0, w: 0, h: 0 };
const VIEWPORT_CHANGE_THRESHOLD = 50; // 50px 이상 이동 시에만 재계산

const hasViewportChanged = (newRect: ViewRect): boolean => {
    return Math.abs(newRect.x - lastViewRect.x) > VIEWPORT_CHANGE_THRESHOLD ||
           Math.abs(newRect.y - lastViewRect.y) > VIEWPORT_CHANGE_THRESHOLD;
};
```

---

### Check (검증)

| 검증 항목 | 방법 | 합격 기준 |
|---|---|---|
| VRAM 감지 정확도 | 다양한 GPU에서 테스트 | ±50% 이내 정확도 |
| 동적 한도 적용 | 로그에서 MAX_TEXTURE_BYTES 확인 | GPU별 차별화 확인 |
| 가상화 FPS 개선 | 1000장 줌아웃 상태 FPS | > 45fps (개선 전 대비 +50%) |
| 가상화 진입/이탈 | 빠른 패닝 시 깜빡임 확인 | 깜빡임 없음 (TINY 즉시 표시) |
| JS Heap 절감 | Chrome Heap Snapshot | < 5MB (1000장 기준) |

**테스트 시나리오:**

```
시나리오 6: GPU별 VRAM 한도 테스트
  1. Intel iGPU (2GB) / NVIDIA RTX 3060 (6GB) / RTX 4090 (24GB) 각각 테스트
  2. 자동 감지된 MAX_TEXTURE_BYTES 확인
  3. 1000장 로드 후 VRAM 사용 패턴 비교

시나리오 7: 가상화 스트레스 테스트
  1. 1000장 분포된 대형 캔버스
  2. 한쪽 끝에서 반대쪽까지 빠르게 패닝 (5회)
  3. 이미지 표시 지연 측정 (TINY 표시까지)
  4. 프레임 드랍 발생 구간 기록
```

---

### Act (조치)

| 결과 | 조치 |
|---|---|
| 합격 | 전체 시스템 통합 테스트 후 정식 릴리스 |
| VRAM 감지 실패율 높음 | 기본값 512MB 유지, 감지 성공 시에만 조정 |
| 가상화 깜빡임 발생 | 패딩 영역 확대 (1.5x → 2.5x) |
| 패닝 시 FPS 드랍 | 가상화 전환 디바운스 추가 (100ms) |
| 특정 GPU 크래시 | 해당 GPU 블랙리스트 + 기본값 fallback |

---

## 위험 요소 매트릭스

| 위험 요소 | 발생 확률 | 영향도 | 대응 방안 |
|---|---|---|---|
| Blob URL 해제 후 이미지 깨짐 | 중간 | 높음 | refCount 이중 검증 + fallback 이미지 |
| 연속 생성 시 backpressure 지연 | 중간 | 중간 | 진행률 표시 + 예상 시간 안내 |
| VRAM 감지 부정확 | 중간 | 중간 | 안전한 기본값 유지 + 수동 설정 옵션 |
| 기존 workspace 호환 문제 | 낮음 | 높음 | settings migration v12 + 롤백 로직 |
| Electron 메모리 제한 (V8 heap) | 낮음 | 높음 | `--max-old-space-size=8192` 플래그 |

---

## 성공 지표

### Phase 1 완료 기준

- [ ] 1000장 workspace 로드 성공 (크래시 없음)
- [ ] RAM 사용량 < 2GB (1000장 기준)
- [ ] 뷰포트 외 blob URL 자동 해제 동작 확인
- [ ] blob 복원 시 깨진 이미지 0건
- [ ] 기존 300장 workspace 100% 호환

### Phase 2 완료 기준

- [ ] 연속 생성 20장 시 메모리 스파이크 < 300MB
- [ ] 3단계 warning UI 정상 동작
- [ ] 메모리 기반 동적 한도 정상 동작
- [ ] hardLimit 1000 정식 적용

### Phase 3 완료 기준

- [ ] GPU별 VRAM 한도 자동 조정
- [ ] 1000장 줌아웃 FPS > 45fps
- [ ] 가상화 진입/이탈 깜빡임 없음
- [ ] 전체 시스템 48시간 안정성 테스트 통과

### 최종 목표

```
┌─────────────────────────────────────────────────────────────┐
│  1000장 이미지 안정 운영                                      │
│                                                             │
│  RAM: < 2GB          (현재 300장 수준과 유사)                  │
│  VRAM: 자동 최적화     (GPU별 동적 조정)                       │
│  FPS: > 30fps        (1000장 줌아웃)                         │
│  로드 시간: < 10초     (progressive load)                    │
│  생성 안정성: 스파이크 없음 (backpressure)                     │
└─────────────────────────────────────────────────────────────┘
```
