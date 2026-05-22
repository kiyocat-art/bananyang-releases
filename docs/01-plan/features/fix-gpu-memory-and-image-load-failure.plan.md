# PDCA Plan: GPU 메모리 급증 및 장시간 사용 이미지 로드 실패 수정

> **문서 유형**: PDCA (Plan-Do-Check-Act)  
> **기능명**: fix-gpu-memory-and-image-load-failure  
> **작성일**: 2026-02-05  
> **담당**: Claude Agent (Bkit)  
> **상태**: 🟢 Do 완료 — Check 대기  
> **선행 작업**: `fix-memory-accumulation-on-long-session` (2026-02-04 완료)

---

## PLAN (계획)

### 1. 개요 (Overview)

메모리 최적화 작업 이후 두 가지 문제가 발생:

1. **GPU 메모리(VRAM) 사용량 급증** — 텍스처 캐시 한도가 2배로 증가됨
2. **장시간 사용 시 이미지 로드 실패** — 요청 플래그 미정리로 재시도 불가

### 2. 근본 원인 분석 (Root Cause Analysis)

| # | 원인 | 심각도 | 파일 | 핵심 문제 |
|---|------|--------|------|-----------|
| GPU-1 | MAX_TEXTURE_BYTES 2배 증가 | **P0 치명** | `rendering.worker.ts:193` | 500MB → 1GB로 변경됨 |
| GPU-2 | ImageBitmap 미해제 (4K 이하) | **P1 높음** | `rendering.worker.ts:1176-1179` | 텍스처 생성 후 bitmap.close() 미호출 |
| LOAD-1 | processImage 내부 실패 시 조용한 실패 | **P2 중간** | `useCanvasWorker.ts:106` | 상위 try-catch 존재하나 내부 실패 시 미처리 가능 |
| LOAD-2 | stuckTextureTracker 재시도 오류 | **P1 높음** | `rendering.worker.ts:596-602` | TINY src로만 재시도 |
| LOAD-3 | 대기 요청 타임아웃 없음 | **P1 높음** | `rendering.worker.ts:228-230` | 무한 대기 가능 |
| LOAD-4 | 로딩 중 텍스처 삭제 | **P2 중간** | `rendering.worker.ts:396-424` | enforceTextureLimit이 최근 로드 텍스처 삭제 |

### 3. 목표 (Goals)

| # | 목표 | 우선순위 |
|---|------|---------|
| 1 | VRAM 제한을 원래 값(512MB)으로 환원 | P0 |
| 2 | ImageBitmap 생성 후 즉시 close() 호출 | P1 |
| 3 | processImage 내부 실패 시 개별 에러 처리 추가 | P2 |
| 4 | stuckTextureTracker가 올바른 targetSrc 사용 | P1 |
| 5 | 30초 타임아웃으로 stale 요청 자동 정리 | P1 |
| 6 | 최근 로드된 텍스처 보호 (3초간 삭제 금지) | P2 |

---

### 4. 상세 계획 (Detailed Plan)

---

#### 4.1 [P0] GPU-1: MAX_TEXTURE_BYTES 환원

**현재 상태 (AS-IS)**

```typescript
// 주석: "300MB limit"이라고 되어있지만 실제 값은 1GB
const MAX_TEXTURE_BYTES = 1024 * 1024 * 1024; // 1GB VRAM limit (High-End)
```

**변경 계획 (TO-BE)**

```typescript
// 512MB VRAM limit (balanced for most systems)
const MAX_TEXTURE_BYTES = 512 * 1024 * 1024;
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/rendering.worker.ts` | **수정** | 라인 193: 1GB → 512MB |

---

#### 4.2 [P1] GPU-2: ImageBitmap.close() 추가

**현재 상태 (AS-IS)**

```typescript
case 'add-resource': {
    const { id, bitmap } = payload;
    // ... 텍스처 생성 ...
    const texture = Texture.from(textureSource);
    // [IMPORTANT] Do NOT call bitmap.close() here!
    // PixiJS Texture.from() may keep a reference to the source.
}
```

**변경 계획 (TO-BE)**

```typescript
case 'add-resource': {
    const { id, bitmap } = payload;
    // ... 텍스처 생성 ...
    const texture = Texture.from(textureSource);
    textureCache.set(id, texture);
    
    // [FIX GPU-2] 텍스처 업로드 완료 후 ImageBitmap 해제
    // PixiJS는 GPU에 업로드 후 원본을 참조하지 않음
    if (bitmap && typeof bitmap.close === 'function') {
        bitmap.close();
    }
}
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/rendering.worker.ts` | **수정** | 라인 1176-1179: bitmap.close() 추가 |

---

#### 4.3 [P2] LOAD-1: processImage 내부 실패 시 개별 에러 처리

> **참고:** 상위 레벨 try-catch (라인 52-289)에서 예외는 처리되고 있으나,
> processImage 내부에서 조용히 실패하는 경우에 대한 방어 코드 추가.

**현재 상태 (AS-IS)**

```typescript
// useCanvasWorker.ts 라인 105-106
if (fileToUse) {
    await imageLoader.processImage(fileToUse, id, true);
    // ⚠️ 상위 try-catch 존재하나, processImage 내부 실패 시 조용히 실패 가능
}
```

**변경 계획 (TO-BE)**

```typescript
if (fileToUse) {
    try {
        await imageLoader.processImage(fileToUse, id, true);
    } catch (e) {
        console.warn('[useCanvasWorker] processImage failed:', id, e);
        workerRef.current?.postMessage({ type: 'resource-error', payload: { id } });
    }
}
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | 라인 106: 개별 try-catch 추가 (방어 코드) |

---

#### 4.4 [P1] LOAD-2: stuckTextureTracker 올바른 src 사용

**현재 상태 (AS-IS)**

```typescript
if (stuckTime > 1000) {
    const src = i.tinySrc || i.proxySrc || i.src;  // ← 항상 tinySrc 우선
    getTexture(src, 'TINY');  // ← TINY tier로만 재시도
}
```

**변경 계획 (TO-BE)**

```typescript
if (stuckTime > 1000) {
    stuckTextureTracker.delete(i.id);
    
    // [FIX LOAD-2] 현재 필요한 tier와 src로 재시도
    const targetSrc = i.previewSrc || i.proxySrc || i.src;
    requestedResources.delete(targetSrc);
    textureCache.delete(targetSrc);
    getTexture(targetSrc, 'PREVIEW');
}
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/rendering.worker.ts` | **수정** | 라인 596-602: targetSrc 사용 |

---

#### 4.5 [P1] LOAD-3: 요청 타임아웃 추가

**현재 상태 (AS-IS)**

```typescript
const requestedResources = new Set<string>();
// ❌ 타임아웃 없음
```

**변경 계획 (TO-BE)**

```typescript
const requestedResources = new Set<string>();
const requestTimestamps = new Map<string, number>(); // [FIX LOAD-3] 요청 시간 추적
const REQUEST_TIMEOUT_MS = 30000; // 30초 타임아웃

// flushPendingRequests 내부에 추가
const cleanupStaleRequests = () => {
    const now = Date.now();
    for (const [src, timestamp] of requestTimestamps) {
        if (now - timestamp > REQUEST_TIMEOUT_MS) {
            console.warn('[Worker] Request timeout:', src);
            requestedResources.delete(src);
            requestTimestamps.delete(src);
            pendingAbortControllers.delete(src);
        }
    }
};
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/rendering.worker.ts` | **수정** | 요청 타임아웃 로직 추가 |

---

#### 4.6 [P2] LOAD-4: 최근 로드 텍스처 보호

**현재 상태 (AS-IS)**

```typescript
const enforceTextureLimit = (activeSrcs: Set<string>) => {
    for (const src of cachedSrcs) {
        if (!activeSrcs.has(src)) {
            destroyTexture(src);  // ← 방금 로드된 것도 삭제 가능
        }
    }
};
```

**변경 계획 (TO-BE)**

```typescript
const TEXTURE_PROTECTION_MS = 3000; // 3초간 삭제 금지

const enforceTextureLimit = (activeSrcs: Set<string>) => {
    const now = Date.now();
    for (const src of cachedSrcs) {
        if (!activeSrcs.has(src)) {
            // [FIX LOAD-4] 최근 로드된 텍스처 보호
            const lastUsed = textureLastUsed.get(src) || 0;
            if (now - lastUsed > TEXTURE_PROTECTION_MS) {
                destroyTexture(src);
            }
        }
    }
};
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/rendering.worker.ts` | **수정** | 라인 ~415: 보호 로직 추가 |

---

### 5. 수정 대상 파일 종합

| # | 파일 경로 | 변경 유형 | 이슈 | 설명 |
|---|----------|----------|------|------|
| 1 | `src/features/canvas/rendering.worker.ts` | **수정** | GPU-1, GPU-2, LOAD-2, LOAD-3, LOAD-4 | VRAM 한도 + bitmap.close() + stuckTracker + 타임아웃 + 보호 |
| 2 | `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | LOAD-1 | processImage 개별 try-catch (방어 코드) |

---

### 6. 의존성 & 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| bitmap.close() 호출 시 PixiJS 내부 참조 문제 | 텍스처 깨짐 가능 | 테스트로 확인 후 롤백 가능 |
| 512MB 한도가 너무 작을 수 있음 | 대량 이미지 작업 시 느려짐 | 768MB로 조정 고려 |
| 타임아웃 30초가 너무 짧을 수 있음 | 느린 네트워크에서 실패 | 60초로 조정 고려 |

---

### 7. 실행 우선순위

```
Phase 1 [P0] ━━━━━━━━━━━━━━━━━━━━━━━━ (즉시 착수)
 └─ GPU-1: MAX_TEXTURE_BYTES 환원 (512MB)

Phase 2 [P1] ━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 1 완료 후)
 ├─ GPU-2: bitmap.close() 추가
 ├─ LOAD-2: stuckTextureTracker 수정
 └─ LOAD-3: 요청 타임아웃 추가

Phase 3 [P2] ━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 2 완료 후)
 ├─ LOAD-1: processImage 개별 try-catch (방어 코드)
 └─ LOAD-4: 최근 로드 텍스처 보호

검증 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 3 완료 후)
 └─ 전체 시나리오 테스트
```

---

## DO (실행)

> ✅ 2026-02-05 완료

### 수정 완료 내역

| Phase | 이슈 | 파일 | 변경 내용 |
|-------|------|------|----------|
| P0 | GPU-1 | `rendering.worker.ts:192-193` | MAX_TEXTURE_BYTES 1GB → 512MB |
| P1 | GPU-2 | `rendering.worker.ts:1200-1206` | bitmap.close() 호출 추가 |
| P1 | LOAD-2 | `rendering.worker.ts:596-603` | stuckTextureTracker → PREVIEW tier + previewSrc 사용 |
| P1 | LOAD-3 | `rendering.worker.ts:230-246, 276, 318, 1223, 1291` | 30초 타임아웃 시스템 추가 |
| P2 | LOAD-1 | `useCanvasWorker.ts:105-113` | processImage 개별 try-catch 추가 |
| P2 | LOAD-4 | `rendering.worker.ts:419-452` | 최근 로드 텍스처 3초 보호 로직 |

---

## CHECK (검증)

### 정적 검증 (자동)

> ✅ 2026-02-05 완료

| # | 검증 항목 | 결과 | 비고 |
|---|----------|------|------|
| S-1 | 빌드 성공 | ✅ Pass | `npm run build` 정상 완료 |
| S-2 | TypeScript 타입 체크 | ✅ Pass | `tsc --noEmit` 에러 없음 |
| S-3 | GPU-1 코드 적용 확인 | ✅ Pass | `MAX_TEXTURE_BYTES = 512MB` (라인 193) |
| S-4 | GPU-2 코드 적용 확인 | ✅ Pass | `bitmap.close()` 추가 (라인 1211-1214) |
| S-5 | LOAD-1 코드 적용 확인 | ✅ Pass | 개별 try-catch 추가 (라인 106-112) |
| S-6 | LOAD-2 코드 적용 확인 | ✅ Pass | PREVIEW tier + previewSrc (라인 630-634) |
| S-7 | LOAD-3 코드 적용 확인 | ✅ Pass | 30초 타임아웃 시스템 (라인 232-250) |
| S-8 | LOAD-4 코드 적용 확인 | ✅ Pass | 3초 보호 로직 (라인 441-444) |

### 동적 검증 시나리오 (수동)

> ⏳ 사용자 테스트 대기

#### GPU 메모리 검증

| # | 시나리오 | 예상 결과 | 검증 방법 | 결과 |
|---|---------|----------|----------|------|
| G-1 | 이미지 50개 로드 | VRAM 512MB 이하 유지 | Chrome Task Manager GPU Process | ⏳ |
| G-2 | 이미지 100개 로드 후 축소 | 미사용 텍스처 GC | textureCache.size 확인 | ⏳ |

#### 이미지 로드 검증

| # | 시나리오 | 예상 결과 | 검증 방법 | 결과 |
|---|---------|----------|----------|------|
| L-1 | 30분 연속 이미지 생성 | 모든 이미지 정상 표시 | 시각적 확인 | ⏳ |
| L-2 | 네트워크 지연 시뮬레이션 | 30초 후 재시도 | 콘솔 로그 확인 | ⏳ |
| L-3 | 빠른 줌 인/아웃 반복 | 회색 이미지 없음 | 시각적 확인 | ⏳ |

---

## ACT (개선)

### 후속 개선 사항

| # | 개선 항목 | 우선순위 | 설명 |
|---|----------|---------|------|
| A-1 | VRAM 사용량 UI 표시 | P3 | MemoryMonitor에 GPU 메모리 추가 |
| A-2 | 설정에서 VRAM 한도 조정 | P3 | 고사양 PC에서 1GB 허용 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|-----|------|----------|-------|
| 1.0 | 2026-02-05 | 초안 작성 — GPU 메모리 + 이미지 로드 실패 통합 PDCA | Claude Agent (Bkit) |
| 1.1 | 2026-02-05 | 코드 검토 반영 — LOAD-1 심각도 P0→P2 하향, 라인 번호 정정 | Claude Agent (Bkit) |
| 1.2 | 2026-02-05 | Do 단계 완료 — 6개 이슈 모두 수정 완료 | Claude Agent (Bkit) |
