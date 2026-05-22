# PDCA Plan: 장시간 사용 후 이미지 로드 실패 및 메모리 정리/리셋 시 전체 이미지 표시 불가 수정

> **문서 유형**: PDCA (Plan-Do-Check-Act)
> **기능명**: fix-image-load-failure-after-long-session
> **작성일**: 2026-02-04
> **담당**: Claude Agent (Bkit)
> **상태**: ✅ Do 완료 — Check 대기 중

---

## PLAN (계획)

### 1. 개요 (Overview)

장시간 다량의 이미지를 생성/편집하다 보면 생성된 이미지 또는 편집한 이미지의 로드에 실패하는 현상이 발생한다. 콘솔 로그에 에러가 표시되지 않으며, 메모리 정리 버튼 또는 이미지 리셋(Soft Refresh) 버튼 클릭 시 **전체 이미지가 회색 placeholder에 고정**되어 복구 불가 상태에 빠진다.

### 2. 근본 원인 분석 (Root Cause Analysis)

전체 코드를 분석한 결과, 다음 **6개의 근본 원인**이 복합적으로 작용하여 이미지 로드 실패를 유발한다:

| # | 원인 | 심각도 | 파일 | 라인 |
|---|------|--------|------|------|
| RC-1 | `getActiveImageUrls()`에서 `maskSrc`, `highResSrc`, `ktx2Src` 누락 | **P0 치명** | `src/hooks/useMemoryCleanup.ts` | 39-53 |
| RC-2 | `resume-rendering`에서 `isInitialized = true` 복원 누락 | **P0 치명** | `src/features/canvas/rendering.worker.ts` | 1115-1130 |
| RC-3 | Fallback 전체 실패 시 `resource-error` 미전송 (Deadlock) | **P1 높음** | `src/features/canvas/hooks/useCanvasWorker.ts` | 107-165 |
| RC-4 | 모든 에러를 `catch(e) {}` 로 무시 (콘솔 로그 없음) | **P1 높음** | `src/features/canvas/hooks/useCanvasWorker.ts` | 123, 136, 149, 156 |
| RC-5 | Soft Refresh의 `pause→resume` 사이 Race Condition | **P2 중간** | `src/features/canvas/hooks/useCanvasWorker.ts` | 386-421 |
| RC-6 | Worker `workerState.boardImages`와 Main Thread 상태 불일치 | **P2 중간** | `src/features/canvas/rendering.worker.ts` | 1529-1547 |

### 3. 목표 (Goals)

| # | 목표 | 우선순위 |
|---|------|---------|
| 1 | 메모리 정리 시 활성 이미지의 blob URL이 절대 revoke되지 않도록 보장 | P0 |
| 2 | Soft Refresh(이미지 리셋) 후 모든 이미지가 정상적으로 다시 로드되도록 보장 | P0 |
| 3 | 텍스처 요청 실패 시 재시도가 가능하도록 Deadlock 방지 | P1 |
| 4 | 에러 발생 시 콘솔에 최소한의 진단 로그가 출력되도록 개선 | P1 |
| 5 | Soft Refresh의 pause→resume 타이밍을 Worker ACK 기반으로 안전하게 변경 | P2 |

---

### 4. 상세 계획 (Detailed Plan)

---

#### 4.1 [P0] RC-1 수정: `getActiveImageUrls()` 누락 URL 추가

**현재 상태 (AS-IS)**
- 파일: `src/hooks/useMemoryCleanup.ts:39-53`
- `getActiveImageUrls()`가 `boardImages`에서 6개 필드만 수집
- `maskSrc`, `highResSrc`, `ktx2Src` 3개 필드 누락
- 메모리 정리 시 이 URL들이 "미사용"으로 판단되어 revoke됨

**변경 계획 (TO-BE)**
```typescript
function getActiveImageUrls(): Set<string> {
    const { boardImages } = useCanvasStore.getState();
    const activeUrls = new Set<string>();

    for (const img of boardImages) {
        if (img.src) activeUrls.add(img.src);
        if (img.thumbnailSrc) activeUrls.add(img.thumbnailSrc);
        if (img.tinySrc) activeUrls.add(img.tinySrc);
        if (img.proxySrc) activeUrls.add(img.proxySrc);
        if (img.originalSrc) activeUrls.add(img.originalSrc);
        if (img.previewSrc) activeUrls.add(img.previewSrc);
        // [FIX RC-1] 누락된 3개 필드 추가
        if (img.maskSrc) activeUrls.add(img.maskSrc);
        if (img.highResSrc) activeUrls.add(img.highResSrc);
        if (img.ktx2Src) activeUrls.add(img.ktx2Src);
    }

    return activeUrls;
}
```

**수정 대상 파일**
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/hooks/useMemoryCleanup.ts` | **수정** | `getActiveImageUrls()`에 3개 필드 추가 |

**성공 기준**
- [ ] `safeCleanup()` 호출 후에도 `maskSrc`, `highResSrc`, `ktx2Src` URL이 유효
- [ ] 메모리 정리 후 모든 이미지가 정상 표시

---

#### 4.2 [P0] RC-2 수정: `resume-rendering`에서 `isInitialized` 복원

**현재 상태 (AS-IS)**
- 파일: `src/features/canvas/rendering.worker.ts`
- `pause-rendering` 핸들러 (line 1053-1112): `isPaused = true; isInitialized = false;`
- `resume-rendering` 핸들러 (line 1115-1130): `isPaused = false;` 만 설정
- `isInitialized`가 `false`로 남아 렌더링 파이프라인이 차단됨

**변경 계획 (TO-BE)**
```typescript
case 'resume-rendering': {
    console.log('[Worker] Resuming PixiJS rendering');
    isPaused = false;
    isInitialized = true;  // [FIX RC-2] pause에서 false로 설정한 것을 복원

    // Clear requestedResources to allow fresh texture loading
    requestedResources.clear();

    // Reset grey placeholder
    greyPlaceholderTexture = null;

    // Start ticker
    if (app && app.ticker && !app.ticker.started) {
        app.ticker.start();
        console.log('[Worker] Ticker restarted');
    }

    // [FIX RC-2] 즉시 렌더 요청하여 화면 갱신
    requestRender();
    break;
}
```

**수정 대상 파일**
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/rendering.worker.ts` | **수정** | `resume-rendering`에 `isInitialized = true` 및 `requestRender()` 추가 |

**성공 기준**
- [ ] Soft Refresh 후 Worker가 정상 렌더링 재개
- [ ] 모든 이미지에 대해 `getTexture()` 호출이 `Texture.EMPTY` 대신 정상 텍스처 반환

---

#### 4.3 [P1] RC-3 수정: Fallback 전체 실패 시 `resource-error` 전송

**현재 상태 (AS-IS)**
- 파일: `src/features/canvas/hooks/useCanvasWorker.ts:107-165`
- Blob URL fetch가 모든 fallback에서 실패해도 `resource-error`를 보내지 않는 경로 존재
- Worker의 `requestedResources` Set에 실패한 src가 남아 영구적으로 재요청 불가 (Deadlock)

**변경 계획 (TO-BE)**
```typescript
if (image) {
    // ... 기존 fallback 로직 ...
    if (fileToUse) {
        await imageLoader.processImage(fileToUse, id, true);
    } else {
        // Fallback chain...
        let success = false;
        // Try 1~4...

        // [FIX RC-3] 모든 fallback 실패 시 resource-error 전송
        if (!success) {
            console.warn('[useCanvasWorker] All fallback attempts failed for:', id);
            workerRef.current?.postMessage({
                type: 'resource-error',
                payload: { id }
            });
        }
    }
} else {
    // imageByAnySrc 경로에서도 동일하게 처리
    // ... 기존 로직 ...
    if (!loaded) {
        console.warn('[useCanvasWorker] Found image but all load attempts failed:', id);
        // [FIX RC-3] resource-error 전송 추가
        workerRef.current?.postMessage({
            type: 'resource-error',
            payload: { id }
        });
    }
}
```

**수정 대상 파일**
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | 모든 fallback 실패 경로에 `resource-error` 전송 추가 |

**성공 기준**
- [ ] 리소스 로드 실패 후 `requestedResources`에서 해당 src 제거됨
- [ ] 다음 렌더 사이클에서 재요청 가능
- [ ] 회색 placeholder에 영구 고정되지 않음

---

#### 4.4 [P1] RC-4 수정: 에러 무시 `catch(e) {}` → 진단 로그 추가

**현재 상태 (AS-IS)**
- 파일: `src/features/canvas/hooks/useCanvasWorker.ts`
- 4곳에서 `catch (e) { /* Continue to next fallback */ }` 패턴 사용
- blob URL revoke 후 `fetch()` 실패 시 `TypeError: Failed to fetch` 발생하지만 무시됨
- 사용자 콘솔에 **아무 에러도 표시되지 않는** 원인

**변경 계획 (TO-BE)**
```typescript
// line 123, 136, 149, 156 각각:
} catch (e) {
    console.warn('[useCanvasWorker] Fallback fetch failed:', id,
        (e as Error)?.message || e);
}
```

**수정 대상 파일**
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | 4곳의 `catch(e) {}` → `catch(e) { console.warn(...) }` |

**성공 기준**
- [ ] blob URL 만료 시 콘솔에 경고 메시지 출력
- [ ] 어느 이미지에서 어떤 URL이 실패했는지 추적 가능

---

#### 4.5 [P2] RC-5 수정: Soft Refresh Race Condition 해소

**현재 상태 (AS-IS)**
- 파일: `src/features/canvas/hooks/useCanvasWorker.ts:386-421`
- `pause-rendering` 전송 후 200ms 고정 딜레이로 `resume-rendering` 전송
- Worker의 pause 처리 완료 전에 resume이 도착할 수 있음
- `sync-data`가 resume과 동시에 전송되어 Worker 상태 불일치 가능

**변경 계획 (TO-BE)**

```typescript
// 방안: Worker에서 pause 완료 ACK 전송 → Main Thread가 ACK 수신 후 resume

// rendering.worker.ts - pause-rendering 핸들러 끝에 추가:
self.postMessage({ type: 'pause-complete' });

// useCanvasWorker.ts - handleSoftRefresh 수정:
const handleSoftRefresh = () => {
    console.log('[useCanvasWorker] Soft refresh - clearing VRAM and reloading all images');

    // [FIX RC-5] Worker pause 완료를 대기하는 1회용 리스너
    const handlePauseComplete = (event: MessageEvent) => {
        if (event.data.type !== 'pause-complete') return;
        workerRef.current?.removeEventListener('message', handlePauseComplete);

        console.log('[useCanvasWorker] Soft refresh - pause confirmed, resuming');
        workerRef.current?.postMessage({ type: 'resume-rendering' });

        // Full resync
        isFirstSyncRef.current = true;
        lastSyncedImagesRef.current.clear();
        lastSyncedGroupsRef.current.clear();

        const { boardImages, boardGroups } = useCanvasStore.getState();
        workerRef.current?.postMessage({
            type: 'sync-data',
            payload: {
                boardImages: boardImages.map(img => ({
                    ...img, file: undefined, originalFile: undefined,
                })),
                boardGroups
            }
        });
    };

    workerRef.current?.addEventListener('message', handlePauseComplete);
    workerRef.current?.postMessage({ type: 'pause-rendering' });

    // [SAFETY] 5초 타임아웃 - ACK가 오지 않으면 강제 resume
    setTimeout(() => {
        workerRef.current?.removeEventListener('message', handlePauseComplete);
    }, 5000);
};
```

**수정 대상 파일**
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/rendering.worker.ts` | **수정** | `pause-rendering` 끝에 `pause-complete` ACK 전송 |
| `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | ACK 기반 soft refresh 로직으로 변경 |

**성공 기준**
- [ ] Soft Refresh 시 Worker pause가 확실히 완료된 후 resume 실행
- [ ] Race Condition으로 인한 텍스처 로드 누락 없음

---

#### 4.6 [P2] RC-6 수정: Worker `cleanup-unused-textures`의 상태 동기화 보강

**현재 상태 (AS-IS)**
- 파일: `src/features/canvas/rendering.worker.ts:1529-1547`
- `cleanup-unused-textures` 처리 시 `workerState.boardImages` 기반으로 `activeSrcs` 구성
- Delta Sync (100ms debounce) 때문에 Worker 상태가 Main Thread 최신 상태와 다를 수 있음
- 유효한 텍스처가 "미사용"으로 판단되어 삭제될 수 있음

**변경 계획 (TO-BE)**
```typescript
case 'cleanup-unused-textures': {
    const { activeImageIds, activeSrcs: mainThreadActiveSrcs } = payload;
    // [FIX RC-6] Main Thread에서 직접 activeSrcs를 전달받아 사용
    const activeSrcs = new Set<string>(mainThreadActiveSrcs || []);

    // Fallback: Main Thread에서 activeSrcs를 전달하지 않은 경우 workerState 기반
    if (activeSrcs.size === 0) {
        const activeIdSet = new Set(activeImageIds || []);
        workerState.boardImages.forEach(img => {
            if (activeIdSet.has(img.id)) {
                if (img.src) activeSrcs.add(img.src);
                if (img.proxySrc) activeSrcs.add(img.proxySrc);
                if (img.previewSrc) activeSrcs.add(img.previewSrc);
                if (img.tinySrc) activeSrcs.add(img.tinySrc);
                if (img.originalSrc) activeSrcs.add(img.originalSrc);
                if (img.ktx2Src) activeSrcs.add(img.ktx2Src);
            }
        });
    }
    // ... 나머지 cleanup 로직 동일
}
```

호출부(`useMemoryCleanup.ts`)에서도 `activeSrcs`를 함께 전달:
```typescript
const cleanup = useCallback(async () => {
    const activeUrls = getActiveImageUrls();
    const result = blobManager.safeCleanup(activeUrls);

    // [FIX RC-6] Worker에 activeImageIds와 activeSrcs 모두 전달
    window.dispatchEvent(new CustomEvent('canvas-cleanup-textures', {
        detail: {
            activeImageIds: Array.from(useCanvasStore.getState().boardImages.map(img => img.id)),
            activeSrcs: Array.from(activeUrls)  // Main Thread의 최신 URL 목록
        }
    }));
    // ...
}, []);
```

**수정 대상 파일**
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/hooks/useMemoryCleanup.ts` | **수정** | cleanup 이벤트에 `activeSrcs` 추가 전달 |
| `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | 이벤트 핸들러에서 `activeSrcs` 전달 |
| `src/features/canvas/rendering.worker.ts` | **수정** | `cleanup-unused-textures`에서 Main Thread `activeSrcs` 우선 사용 |

**성공 기준**
- [ ] Main Thread와 Worker 간 상태 불일치로 인한 텍스처 오삭제 방지
- [ ] 메모리 정리 후에도 보이는 이미지의 텍스처가 유지됨

---

### 5. 수정 대상 파일 종합

| # | 파일 경로 | 변경 유형 | RC | 설명 |
|---|----------|----------|-----|------|
| 1 | `src/hooks/useMemoryCleanup.ts` | **수정** | RC-1, RC-6 | `getActiveImageUrls()` 누락 필드 추가 + cleanup 이벤트에 activeSrcs 전달 |
| 2 | `src/features/canvas/rendering.worker.ts` | **수정** | RC-2, RC-5, RC-6 | `resume-rendering` 시 `isInitialized` 복원 + `pause-complete` ACK + activeSrcs 처리 |
| 3 | `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | RC-3, RC-4, RC-5, RC-6 | fallback 실패 시 resource-error 전송 + catch 로그 추가 + ACK 기반 soft refresh |

---

### 6. 의존성 & 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| `isInitialized = true` 복원 시 app이 실제로 파괴된 경우 | 렌더링 에러 | `app && app.renderer` 체크를 `isInitialized` 의존부에 유지 |
| `pause-complete` ACK가 오지 않는 경우 | Soft Refresh 영구 대기 | 5초 타임아웃 안전장치 |
| `activeSrcs` 전달 시 메시지 크기 증가 | Worker 통신 지연 | URL 문자열 Set이므로 직렬화 비용 무시 가능 (이미지 100개 기준 ~10KB) |
| 에러 로그 추가 시 콘솔 노이즈 | 개발 경험 저하 | `console.warn` 레벨 사용, 정상 fallback 시에는 출력 안 함 |

---

### 7. 실행 우선순위 및 일정

```
Phase 1 [P0] ━━━━━━━━━━━━━━━━━━━━━━━━ (즉시 착수)
 ├─ RC-1: getActiveImageUrls 누락 필드 추가        (~5분)
 └─ RC-2: resume-rendering에 isInitialized 복원     (~5분)

Phase 2 [P1] ━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 1 완료 후)
 ├─ RC-3: fallback 실패 시 resource-error 전송       (~15분)
 └─ RC-4: catch(e) {} → console.warn 추가            (~10분)

Phase 3 [P2] ━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 2 완료 후)
 ├─ RC-5: Soft Refresh ACK 기반 변경                  (~30분)
 └─ RC-6: cleanup-unused-textures activeSrcs 전달     (~20분)

검증 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 3 완료 후)
 └─ 전체 시나리오 테스트                               (~30분)
```

---

## DO (실행)

### Phase 1: [P0] 치명적 버그 수정

**Step 1.1**: `src/hooks/useMemoryCleanup.ts` — `getActiveImageUrls()` 수정
- [ ] `img.maskSrc` 를 `activeUrls`에 추가
- [ ] `img.highResSrc` 를 `activeUrls`에 추가
- [ ] `img.ktx2Src` 를 `activeUrls`에 추가

**Step 1.2**: `src/features/canvas/rendering.worker.ts` — `resume-rendering` 수정
- [ ] `isPaused = false;` 아래에 `isInitialized = true;` 추가
- [ ] 핸들러 끝에 `requestRender();` 추가 (즉시 화면 갱신)

### Phase 2: [P1] Deadlock 방지 및 진단 로그

**Step 2.1**: `src/features/canvas/hooks/useCanvasWorker.ts` — resource-error 전송
- [ ] line 165 근처: `fileToUse`가 없고 모든 fallback 실패 시 `resource-error` 전송
- [ ] line 222 근처: `imageByAnySrc` 경로에서 `!loaded` 시 `resource-error` 전송 (이미 존재하는지 확인)
- [ ] line 236 근처: `imageByAnySrc`도 없는 경우 `resource-error` 전송 (이미 존재하는지 확인)

**Step 2.2**: `src/features/canvas/hooks/useCanvasWorker.ts` — catch 로그 추가
- [ ] line 123: `catch (e) { console.warn('[useCanvasWorker] src fetch failed:', id, (e as Error)?.message); }`
- [ ] line 136: `catch (e) { console.warn('[useCanvasWorker] proxySrc fetch failed:', id, (e as Error)?.message); }`
- [ ] line 149: `catch (e) { console.warn('[useCanvasWorker] originalSrc fetch failed:', id, (e as Error)?.message); }`
- [ ] line 156: `catch (e) { console.warn('[useCanvasWorker] highResSrc fetch failed:', id, (e as Error)?.message); }`

### Phase 3: [P2] Race Condition 및 동기화

**Step 3.1**: `src/features/canvas/rendering.worker.ts` — pause-complete ACK
- [ ] `pause-rendering` case 끝 (line 1112 이전)에 `self.postMessage({ type: 'pause-complete' });` 추가

**Step 3.2**: `src/features/canvas/hooks/useCanvasWorker.ts` — ACK 기반 Soft Refresh
- [ ] `handleSoftRefresh` 함수를 ACK 대기 방식으로 재작성
- [ ] Worker `message` 이벤트에서 `pause-complete` 타입 처리
- [ ] 5초 타임아웃 안전장치 추가

**Step 3.3**: Worker 텍스처 정리 동기화
- [ ] `src/hooks/useMemoryCleanup.ts`: cleanup 이벤트 detail에 `activeSrcs: Array.from(activeUrls)` 추가
- [ ] `src/features/canvas/hooks/useCanvasWorker.ts`: `handleCleanupTextures`에서 `activeSrcs` 전달
- [ ] `src/features/canvas/rendering.worker.ts`: `cleanup-unused-textures`에서 `mainThreadActiveSrcs` 우선 사용

---

## CHECK (검증)

### 검증 시나리오

#### Phase 1 검증: 메모리 정리 후 이미지 유지

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| C1-1 | 20개 이미지 생성 후 메모리 정리 버튼 클릭 | 모든 이미지 정상 표시 유지 | 육안 확인 |
| C1-2 | ktx2Src가 있는 이미지에서 메모리 정리 실행 | ktx2 텍스처 유지 | 개발자 도구에서 texture cache 확인 |
| C1-3 | mask가 있는 이미지에서 메모리 정리 실행 | mask blob URL 유효 | `blobManager.isTracked()` 확인 |
| C1-4 | Soft Refresh 버튼 클릭 | 전체 이미지가 회색→정상 텍스처로 재로드 | 육안 확인 |
| C1-5 | Soft Refresh 후 줌인/줌아웃 | LOD 전환 정상 | 줌 레벨별 확인 |

#### Phase 2 검증: Deadlock 방지

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| C2-1 | blob URL revoke 후 Worker가 해당 텍스처 요청 | 콘솔에 warn 로그 출력 + 재요청 가능 | 콘솔 로그 확인 |
| C2-2 | 모든 fallback 실패하는 이미지 | `resource-error` 전송 → 회색이 아닌 재시도 가능 | Worker 로그 확인 |
| C2-3 | 50개 이미지 일괄 로드 실패 후 Soft Refresh | 모든 이미지 정상 복구 | 육안 확인 |

#### Phase 3 검증: Race Condition

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| C3-1 | Soft Refresh 5회 연속 빠르게 클릭 | 마지막 refresh가 정상 완료 | 모든 이미지 로드 확인 |
| C3-2 | Soft Refresh 중 이미지 생성 시도 | 생성 완료 후 정상 표시 | 타이밍 테스트 |
| C3-3 | 메모리 정리 직후 Soft Refresh 실행 | 모든 이미지 정상 | 연속 동작 테스트 |

### 장시간 안정성 테스트

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| S-1 | 50개 이미지 생성 → 메모리 정리 → 20개 추가 생성 → Soft Refresh | 70개 전체 정상 표시 | 장시간 시뮬레이션 |
| S-2 | 100개 이미지 상태에서 30분간 편집 작업 후 메모리 정리 | 모든 이미지 유지 | 장시간 테스트 |
| S-3 | 탭 전환(다른 앱) → 복귀 → 메모리 정리 → Soft Refresh | 모든 이미지 정상 | 백그라운드 + 복구 |

### 성능 검증

| # | 항목 | 허용 기준 |
|---|------|----------|
| P-1 | 메모리 정리 작업 소요 시간 | < 100ms |
| P-2 | Soft Refresh 전체 소요 시간 (ACK 대기 포함) | < 1000ms |
| P-3 | Soft Refresh 후 전체 이미지 로드 완료 시간 (50개 기준) | < 5000ms |
| P-4 | 메모리 정리 후 메모리 감소량 | 비활성 blob URL 대비 > 90% 회수 |

---

## ACT (개선)

### 후속 개선 사항

| # | 개선 항목 | 우선순위 | 설명 |
|---|----------|---------|------|
| A-1 | BlobManager refCount 정규화 | P2 | 현재 모든 URL이 `refCount=1`로 시작하여 사실상 미사용. 생성/참조/해제 패턴을 재설계하여 실질적인 참조 카운팅 구현 |
| A-2 | Worker 텍스처 로드 재시도 메커니즘 | P2 | `resource-error` 수신 시 exponential backoff로 3회까지 재시도 |
| A-3 | Blob URL 만료 알림 UI | P3 | 이미지 로드 실패 시 사용자에게 "새로고침 필요" 알림 표시 |
| A-4 | ImageBitmap `.close()` 호출 | P2 | Worker에서 Texture 생성 후 ImageBitmap을 명시적으로 close하여 GPU 메모리 누수 방지 |
| A-5 | 디스크 기반 이미지 캐시 | P3 | 장시간 세션에서 blob URL 대신 디스크 캐시를 활용하여 메모리 사용량 근본적 감소 |
| A-6 | 메모리 정리 실행 전 확인 다이얼로그 | P3 | "정리 시 X개의 캐시된 리소스가 삭제됩니다. 계속하시겠습니까?" |

### 회고 체크리스트

- [ ] 수정 후 동일 증상이 재발하지 않는가?
- [ ] 콘솔에 불필요한 로그 노이즈가 발생하지 않는가?
- [ ] Soft Refresh의 ACK 기반 전환이 사용자 체감 속도에 영향을 주지 않는가?
- [ ] 신규 에러 로그가 향후 디버깅에 실질적으로 도움이 되는가?
- [ ] `getActiveImageUrls()`에서 향후 추가되는 새로운 URL 필드가 자동으로 포함되는 구조로 개선 필요한가?

---

## 부록: 이미지 로드 실패 재현 시나리오

### 재현 조건
1. 앱을 장시간 (30분 이상) 실행
2. 다량의 이미지 (30개 이상) 생성 또는 편집
3. 메모리 정리 버튼 클릭 또는 이미지 리셋 버튼 클릭

### 장애 흐름 (수정 전)
```
1. 사용자: 30개+ 이미지 생성 (각 이미지당 ~9개 blob URL 생성)
   → blobManager에 270개+ blob URL 누적 (모두 refCount=1)

2. 사용자: 메모리 정리 버튼 클릭
   → getActiveImageUrls()가 maskSrc/highResSrc/ktx2Src 누락
   → safeCleanup()이 이 URL들을 revoke
   → Worker에 cleanup-unused-textures 전달

3. Worker: 텍스처 정리 실행
   → workerState.boardImages가 구식일 수 있음 (Delta Sync 지연)
   → 유효한 텍스처까지 삭제될 가능성

4. 사용자: 이미지 리셋(Soft Refresh) 버튼 클릭
   → pause-rendering: 모든 텍스처 파괴, isInitialized=false
   → 200ms 후 resume-rendering: isPaused=false (isInitialized는 false로 잔류!)
   → sync-data로 전체 이미지 재전송
   → Worker reconcile() → getTexture() 호출
   → blob URL이 이미 revoke되어 fetch 실패
   → catch(e) {}로 에러 무시 → 콘솔 로그 없음
   → requestedResources에 실패한 src가 남아 재요청 불가
   → 전체 이미지가 회색 placeholder에 고정
```

### 복구 흐름 (수정 후)
```
1. 메모리 정리: getActiveImageUrls()가 모든 URL 필드를 보호
2. Soft Refresh: pause-complete ACK 대기 → resume → isInitialized=true
3. 텍스처 요청: 실패 시 resource-error 전송 → requestedResources 정리 → 재요청 가능
4. 진단 로그: fetch 실패 시 console.warn으로 원인 파악 가능
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|-----|------|----------|-------|
| 1.0 | 2026-02-04 | 초안 작성 — 6개 근본 원인 분석 및 PDCA 플랜 수립 | Claude Agent (Bkit) |
