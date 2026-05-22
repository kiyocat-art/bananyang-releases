# PDCA Plan: 장시간 사용 시 메모리 누적 방지 — 2차 심층 점검 및 수정

> **문서 유형**: PDCA (Plan-Do-Check-Act)
> **기능명**: fix-memory-accumulation-on-long-session
> **작성일**: 2026-02-04
> **담당**: Claude Agent (Bkit)
> **상태**: ✅ Do 완료 — Check 대기
> **선행 작업**: `fix-memory-leaks` (2026-01-30 완료), `fix-image-load-failure-after-long-session` (2026-02-04 완료)

---

## PLAN (계획)

### 1. 개요 (Overview)

1차 메모리 누수 수정(`fix-memory-leaks`)과 이미지 로드 실패 수정(`fix-image-load-failure-after-long-session`) 이후에도, 장시간(30분~1시간+) 사용 시 메모리가 **점진적으로 누적**되는 잠재적 문제가 남아있다.

전체 코드를 심층 점검한 결과, **6개의 메모리 누적 원인**을 발견했다. 이들은 개별적으로는 크지 않지만 복합적으로 작용하여 장시간 세션에서 1~2GB 규모의 메모리 누수를 유발할 수 있다.

### 2. 근본 원인 분석 (Root Cause Analysis)

| # | 원인 | 심각도 | 파일 | 핵심 문제 |
|---|------|--------|------|-----------|
| ML-1 | `deleteSelection()`에서 `revokeImageResources()` 주석 처리 | **P0 치명** | `src/store/canvasStore.ts:941,972` | Undo 비활성화 상태에서 삭제된 이미지의 blob URL이 영구 잔류 |
| ML-2 | `ImageLoaderService`에서 ImageBitmap `.close()` 미호출 | **P1 높음** | `src/services/ImageLoaderService.ts:130,138` | GPU 메모리에 ImageBitmap이 무한 누적 |
| ML-3 | `imageOptimization` 함수들의 Canvas/Image 클로저 잔류 | **P1 높음** | `src/utils/imageOptimization.ts:98-134,209-251,319-351` | Promise 클로저에 캡처된 DOM 객체 GC 지연 |
| ML-4 | `lastCommittedSnapshot`이 전체 boardImages(+File 객체) 직접 참조 | **P1 높음** | `src/store/canvasStore.ts` (saveHistory) | 이전 snapshot의 모든 File 객체가 GC 불가 |
| ML-5 | `inpaintReferenceImages` 제거/초기화 시 blob URL 미해제 | **P2 중간** | `src/store/canvasStore.ts:1931-1937` | 참조 이미지 추가/제거 반복 시 blob URL 누적 |
| ML-6 | `clearCanvas()`에서 `inpaintReferenceImages`, `lightingClipboard` 미정리 | **P2 중간** | `src/store/canvasStore.ts:1627-1653` | Canvas 초기화 후에도 일부 리소스 잔류 |

### 3. 메모리 누적 추정 (1시간 작업 시나리오)

```
시나리오: 이미지 100개 생성 → 50개 삭제 → 20개 재생성

[ML-1] blob URL 누수:
  삭제된 50개 × 9 URL/image × ~2MB/URL = ~900MB

[ML-2] ImageBitmap 누수:
  120회 로드 × bitmap GC 지연 = 수백 MB (GPU)

[ML-3] Canvas/Image 클로저:
  120회 × ~6개 DOM 객체 = ~720개 DOM 객체 GC 지연

[ML-4] lastCommittedSnapshot:
  전체 boardImages + File 객체 참조 유지 = ~200-500MB

총 추정 누수: 1~2GB (장시간 사용 시)
```

### 4. 목표 (Goals)

| # | 목표 | 우선순위 |
|---|------|---------|
| 1 | 이미지 삭제 시 관련 blob URL이 즉시 해제되도록 보장 | P0 |
| 2 | ImageBitmap이 Worker 전송 후 즉시 `.close()`되도록 보장 | P1 |
| 3 | 이미지 최적화 함수에서 임시 DOM 객체의 조기 GC 유도 | P1 |
| 4 | Undo/Redo 히스토리 snapshot에서 File 객체 참조를 제거하여 메모리 절약 | P1 |
| 5 | inpaint 참조 이미지 제거 시 blob URL 정리 | P2 |
| 6 | Canvas 초기화 시 모든 리소스를 빠짐없이 정리 | P2 |

---

### 5. 상세 계획 (Detailed Plan)

---

#### 5.1 [P0] ML-1 수정: `deleteSelection()`에서 `revokeImageResources()` 복원

**현재 상태 (AS-IS)**

- 파일: `src/store/canvasStore.ts:939-942, 964-973`
- `revokeImageResources(img)` 호출이 주석 처리됨
- 주석 사유: "Undo 지원을 위해 즉시 revoke하지 않음"
- 그러나 Undo/Redo 자체가 비활성화 상태 (라인 1811-1819: `return state;`)

```typescript
// AS-IS (라인 972)
// revokeImageResources(img);  // ← 주석 = 메모리 누수
```

**변경 계획 (TO-BE)**

```typescript
// TO-BE: Undo/Redo가 비활성화 상태이므로 즉시 해제
boardImages.forEach(img => {
    if (allImageIdsToDelete.has(img.id)) {
        revokeImageResources(img);
    }
});
```

두 곳 모두 수정:

1. **그룹 편집 모드 삭제** (라인 939-942): 주석 해제
2. **일반 삭제** (라인 964-973): 주석 해제

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/store/canvasStore.ts` | **수정** | 2곳의 `revokeImageResources()` 주석 해제 |

**성공 기준**

- [ ] 이미지 삭제 후 `blobManager.getTrackedCount()`가 삭제된 이미지 URL 수만큼 감소
- [ ] 50개 이미지 생성 → 30개 삭제 후 메모리 사용량이 비례적으로 감소

---

#### 5.2 [P1] ML-2 수정: ImageBitmap `.close()` 호출 추가

**현재 상태 (AS-IS)**

- 파일: `src/services/ImageLoaderService.ts:130,138`
- `processImage()` 함수가 `bitmap`을 `ProcessedImage` 반환값에 포함
- Worker에 전달(이벤트 dispatch) 후에도 bitmap 참조가 유지됨
- 호출부에서 `.close()` 호출 없음

```typescript
// AS-IS (라인 130)
window.dispatchEvent(new CustomEvent('canvas-add-resource', { detail: { id, bitmap } }));
return { src, file, width, height, thumbnailSrc, bitmap }; // bitmap이 영구 참조됨
```

**변경 계획 (TO-BE)**

ImageLoaderService에서 bitmap을 이벤트로 전송한 후, 호출부에서 사용 완료 시 `.close()`를 호출하도록 수정한다. Worker의 `add-resource` 핸들러에서도 bitmap을 텍스처로 변환한 후 `.close()`를 호출한다.

```typescript
// ImageLoaderService.ts — bitmap 전송 후 즉시 close
// (Worker에 전달 시 structured clone이 되므로 원본은 close 가능)
window.dispatchEvent(new CustomEvent('canvas-add-resource', { detail: { id, bitmap } }));

// 호출부에서 bitmap 사용 완료 후 정리하도록 안내
return { src, file, width, height, thumbnailSrc, bitmap };
```

```typescript
// rendering.worker.ts — add-resource 핸들러 (라인 1144-1199)
case 'add-resource': {
    const { id, bitmap } = payload;
    // ... 텍스처 생성 로직 ...
    const texture = Texture.from(textureSource);
    textureCache.set(id, texture);

    // [FIX ML-2] 텍스처 생성 완료 후 ImageBitmap 명시적 해제
    // (4K 이하 원본은 PixiJS가 내부 참조할 수 있으므로, 리사이즈된 경우만 close)
    // 4K 초과로 리사이즈된 경우: bitmap은 이미 line 1165에서 close됨
    // 4K 이하 원본: PixiJS Texture.from()이 source로 사용하므로 close 불가
    // → 호출부(Main Thread)에서 이벤트 dispatch 후 close하는 것이 안전
    break;
}
```

```typescript
// useCanvasWorker.ts — canvas-add-resource 이벤트 핸들러
// Main Thread에서 bitmap을 Worker로 postMessage 한 후 close
const handleAddResource = (e: CustomEvent) => {
    const { id, bitmap } = e.detail;
    workerRef.current?.postMessage({ type: 'add-resource', payload: { id, bitmap } }, [bitmap]);
    // [FIX ML-2] postMessage with transfer로 전송하면 소유권 이전됨 → 자동 해제
};
```

**핵심 전략**: `postMessage`의 **Transferable Objects** 리스트에 `bitmap`을 포함시키면, Main Thread에서 자동으로 소유권이 이전되어 양쪽의 중복 참조를 방지한다.

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | `canvas-add-resource` 핸들러에서 bitmap을 Transferable로 전송 |
| `src/features/canvas/rendering.worker.ts` | **수정** | 4K 초과 리사이즈 시 원본 bitmap.close() 확인 (이미 존재하나 누락 경로 보완) |

**성공 기준**

- [ ] Chrome DevTools Memory 탭에서 ImageBitmap 객체 수가 활성 이미지 수와 비례
- [ ] 100개 이미지 로드 후 GPU 메모리가 안정적으로 유지

---

#### 5.3 [P1] ML-3 수정: imageOptimization 임시 DOM 객체 조기 해제

**현재 상태 (AS-IS)**

- 파일: `src/utils/imageOptimization.ts`
- `resizeImage()` (라인 98-134), `optimizeImageForCanvas()` (라인 209-251), `convertToWebP()` (라인 319-351) 모두 동일 패턴
- Promise 클로저 안에서 `canvas`, `ctx`, `img` 객체가 캡처되어 GC 지연

```typescript
// AS-IS 패턴 (3개 함수 공통)
img.onload = () => {
    URL.revokeObjectURL(url); // URL은 정리
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, ...);
    canvas.toBlob((blob) => {
        resolve(file); // canvas, ctx, img가 클로저에 캡처되어 GC 지연
    });
};
```

**변경 계획 (TO-BE)**

```typescript
// TO-BE 패턴: toBlob 콜백 내에서 명시적 null 할당
img.onload = () => {
    URL.revokeObjectURL(url);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, ...);
    canvas.toBlob((blob) => {
        // [FIX ML-3] 임시 DOM 객체 명시적 해제 유도
        canvas.width = 0;
        canvas.height = 0;

        resolve(file);
    });
};
```

`canvas.width = 0; canvas.height = 0;`을 설정하면 브라우저가 내부 비트맵 메모리를 즉시 해제한다. 이는 DOM에 추가되지 않은 offscreen canvas에서 특히 효과적이다.

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/utils/imageOptimization.ts` | **수정** | `resizeImage()`, `optimizeImageForCanvas()`, `convertToWebP()` 3곳에 canvas 크기 0 설정 추가 |

**성공 기준**

- [ ] 이미지 50개 일괄 업로드 후 중간 DOM 객체가 빠르게 GC됨
- [ ] Chrome Performance Monitor에서 DOM Nodes 카운트가 안정적

---

#### 5.4 [P1] ML-4 수정: lastCommittedSnapshot에서 File 객체 참조 제거

**현재 상태 (AS-IS)**

- 파일: `src/store/canvasStore.ts` (saveHistory 함수)
- `lastCommittedSnapshot.boardImages = state.boardImages` — 직접 참조
- 각 BoardImage에는 `file`, `originalFile`, `proxyFile`, `tinyFile`, `previewFile` 등 다수의 File 객체 포함
- snapshot이 갱신되기 전까지 이전 전체 boardImages(+File)가 GC 불가

**변경 계획 (TO-BE)**

```typescript
// TO-BE: snapshot 저장 시 File 객체를 제외한 경량 복사
lastCommittedSnapshot: {
    boardImages: state.boardImages.map(img => ({
        ...img,
        file: undefined,
        originalFile: undefined,
        proxyFile: undefined,
        tinyFile: undefined,
        previewFile: undefined,
    })),
    boardGroups: state.boardGroups,
    memos: state.memos,
    selectedImageIds: new Set(state.selectedImageIds),
    selectedGroupIds: new Set(state.selectedGroupIds),
    selectedMemoIds: new Set(state.selectedMemoIds),
    zIndexCounter: state.zIndexCounter
}
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/store/canvasStore.ts` | **수정** | `saveHistory()` 내 `lastCommittedSnapshot` 생성 시 File 객체 제외 |

**성공 기준**

- [ ] `saveHistory()` 호출 후 이전 File 객체가 GC 가능 상태
- [ ] 이미지 50개 상태에서 히스토리 5회 저장 후 메모리가 이전 대비 500MB+ 감소

---

#### 5.5 [P2] ML-5 수정: inpaintReferenceImages 제거 시 blob URL 정리

**현재 상태 (AS-IS)**

- 파일: `src/store/canvasStore.ts:1931-1937`
- `removeInpaintReferenceImage()`, `clearInpaintReferenceImages()` 모두 `blobManager.revoke()` 미호출

```typescript
// AS-IS
removeInpaintReferenceImage: (id) => set((state) => ({
    inpaintReferenceImages: state.inpaintReferenceImages.filter(img => img.id !== id)
})),
clearInpaintReferenceImages: () => set({ inpaintReferenceImages: [] }),
```

**변경 계획 (TO-BE)**

```typescript
// TO-BE
removeInpaintReferenceImage: (id) => set((state) => {
    const toRemove = state.inpaintReferenceImages.find(img => img.id === id);
    if (toRemove?.src) blobManager.revoke(toRemove.src);
    return {
        inpaintReferenceImages: state.inpaintReferenceImages.filter(img => img.id !== id)
    };
}),
clearInpaintReferenceImages: () => set((state) => {
    state.inpaintReferenceImages.forEach(img => {
        if (img.src) blobManager.revoke(img.src);
    });
    return { inpaintReferenceImages: [] };
}),
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/store/canvasStore.ts` | **수정** | 2개 함수에 `blobManager.revoke()` 추가 |

**성공 기준**

- [ ] inpaint 참조 이미지 5회 추가/제거 반복 후 blob URL 수가 증가하지 않음

---

#### 5.6 [P2] ML-6 수정: `clearCanvas()`에서 누락 리소스 정리

**현재 상태 (AS-IS)**

- 파일: `src/store/canvasStore.ts:1627-1653`
- `boardImages`는 `revokeImageResources()` 호출하지만:
  - `inpaintReferenceImages`의 blob URL 미정리
  - `lightingClipboard` 명시적 null 미처리
  - `insertTargetImage`의 참조 미정리

**변경 계획 (TO-BE)**

```typescript
clearCanvas: () => set(state => {
    // [기존] boardImages 리소스 정리
    state.boardImages.forEach(img => {
        revokeImageResources(img);
    });

    // [FIX ML-6] inpaintReferenceImages blob URL 정리
    state.inpaintReferenceImages.forEach(img => {
        if (img.src) blobManager.revoke(img.src);
    });

    useMetadataStore.getState().clear();

    setTimeout(() => get().resetHistory(), 0);
    return {
        boardImages: [],
        boardGroups: [],
        memos: [],
        selectedImageIds: new Set(),
        selectedGroupIds: new Set(),
        selectedMemoIds: new Set(),
        chatHistory: [...],
        zIndexCounter: 10,
        activeReferenceIndex: null,
        editingGroupId: null,
        groupEditModeId: null,
        marquee: null,
        // [FIX ML-6] 누락 필드 명시적 초기화
        lightingClipboard: null,
        insertTargetImage: null,
        inpaintReferenceImages: [],
        isObjectInsertMode: false,
        isInpaintSelectMode: false,
    };
}),
```

**수정 대상 파일**

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `src/store/canvasStore.ts` | **수정** | `clearCanvas()`에 inpaint blob 정리 + 누락 필드 초기화 추가 |

**성공 기준**

- [ ] `clearCanvas()` 실행 후 `blobManager.getTrackedCount()`가 0 또는 최소값
- [ ] 모든 상태가 초기값으로 복원됨

---

### 6. 수정 대상 파일 종합

| # | 파일 경로 | 변경 유형 | ML | 설명 |
|---|----------|----------|-----|------|
| 1 | `src/store/canvasStore.ts` | **수정** | ML-1, ML-4, ML-5, ML-6 | deleteSelection revoke 복원 + snapshot File 제외 + inpaint 정리 + clearCanvas 보완 |
| 2 | `src/features/canvas/hooks/useCanvasWorker.ts` | **수정** | ML-2 | bitmap Transferable 전송으로 변경 |
| 3 | `src/features/canvas/rendering.worker.ts` | **수정** | ML-2 | 리사이즈 bitmap.close() 보완 |
| 4 | `src/utils/imageOptimization.ts` | **수정** | ML-3 | 3개 함수에 canvas.width/height = 0 추가 |

---

### 7. 의존성 & 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| ML-1에서 revoke 복원 시 Undo 기능이 추후 복원되면 충돌 | Undo 시 이미 revoke된 URL 접근 | Undo 복원 시 revokeImageResources 다시 주석 처리 필요 → 그때는 히스토리 기반 refCount 체계로 전환 |
| ML-2 Transferable 전송 시 Main Thread에서 bitmap 재사용 불가 | 기존 코드에서 반환된 bitmap 참조 사용 여부 | 호출부 전수 검사 필요 — processImage 반환 후 bitmap 미사용 확인 |
| ML-3 canvas.width=0 설정 후 toBlob 콜백 내에서 canvas 재사용 시 에러 | resolve() 호출 전에 0 설정하면 안됨 | resolve() 직전에 설정하여 안전 보장 |
| ML-4 File 제외 시 Undo가 File을 필요로 할 수 있음 | Undo 기능 비활성화 상태이므로 현재 무관 | Undo 복원 시 File 참조 전략 재검토 |

---

### 8. 실행 우선순위 및 일정

```
Phase 1 [P0] ━━━━━━━━━━━━━━━━━━━━━━━━ (즉시 착수)
 └─ ML-1: deleteSelection revokeImageResources 복원     (~5분)

Phase 2 [P1] ━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 1 완료 후)
 ├─ ML-2: ImageBitmap Transferable 전송 + close          (~15분)
 ├─ ML-3: imageOptimization canvas 0 설정                 (~10분)
 └─ ML-4: lastCommittedSnapshot File 제외                 (~10분)

Phase 3 [P2] ━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 2 완료 후)
 ├─ ML-5: inpaintReferenceImages revoke 추가              (~5분)
 └─ ML-6: clearCanvas 누락 필드 초기화                     (~5분)

검증 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (Phase 3 완료 후)
 └─ 전체 시나리오 테스트                                    (~30분)
```

---

## DO (실행)

### Phase 1: [P0] 치명적 메모리 누수 수정

**Step 1.1**: `src/store/canvasStore.ts` — `deleteSelection()` 수정

- [ ] 라인 941: 그룹 편집 모드 삭제 시 `revokeImageResources(img)` 주석 해제
- [ ] 라인 972: 일반 삭제 시 `revokeImageResources(img)` 주석 해제

### Phase 2: [P1] 주요 메모리 누적 방지

**Step 2.1**: ImageBitmap Transferable 전송

- [ ] `src/features/canvas/hooks/useCanvasWorker.ts`: `canvas-add-resource` 핸들러에서 `postMessage` 호출 시 bitmap을 Transferable 리스트에 포함 (`[bitmap]`)
- [ ] `src/features/canvas/rendering.worker.ts`: 4K 초과 리사이즈 경로에서 원본 `bitmap.close()` 호출 확인 (이미 존재하나 누락 경로 보완)

**Step 2.2**: imageOptimization Canvas 해제

- [ ] `src/utils/imageOptimization.ts`: `resizeImage()` — `canvas.toBlob()` 콜백 내 resolve 직전에 `canvas.width = 0; canvas.height = 0;`
- [ ] `src/utils/imageOptimization.ts`: `optimizeImageForCanvas()` — 동일 패턴 적용
- [ ] `src/utils/imageOptimization.ts`: `convertToWebP()` — 동일 패턴 적용

**Step 2.3**: lastCommittedSnapshot File 제외

- [ ] `src/store/canvasStore.ts`: `saveHistory()` 내 `lastCommittedSnapshot.boardImages` 생성 시 `file`, `originalFile`, `proxyFile`, `tinyFile`, `previewFile`을 `undefined`로 설정

### Phase 3: [P2] 부가 메모리 정리

**Step 3.1**: inpaintReferenceImages 정리

- [ ] `src/store/canvasStore.ts`: `removeInpaintReferenceImage()` — 제거 대상의 `src`를 `blobManager.revoke()`
- [ ] `src/store/canvasStore.ts`: `clearInpaintReferenceImages()` — 전체 순회하며 `blobManager.revoke()`

**Step 3.2**: clearCanvas 보완

- [ ] `src/store/canvasStore.ts`: `clearCanvas()` — `state.inpaintReferenceImages` blob 정리 로직 추가
- [ ] `src/store/canvasStore.ts`: `clearCanvas()` 반환값에 `lightingClipboard: null`, `insertTargetImage: null` 추가

---

## CHECK (검증)

### 검증 시나리오

#### Phase 1 검증: 삭제 시 메모리 해제

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| C1-1 | 이미지 10개 생성 후 5개 삭제 | blobManager 추적 URL 수 ~45개 감소 (5 × 9 URL) | `blobManager.getTrackedCount()` 비교 |
| C1-2 | 이미지 50개 생성 → 전체 삭제 | 추적 URL 0개 | `blobManager.getStats()` 확인 |
| C1-3 | 그룹 편집 모드에서 이미지 삭제 | blob URL 즉시 해제 | DevTools Memory 스냅샷 |

#### Phase 2 검증: GPU 메모리 및 DOM 객체

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| C2-1 | 이미지 30개 연속 로드 | ImageBitmap 누적 없음 | `performance.memory` + GPU Process 모니터 |
| C2-2 | 이미지 50개 일괄 업로드 | DOM Nodes 수 안정적 | Chrome Performance Monitor |
| C2-3 | saveHistory 5회 호출 | 이전 File 객체 GC 가능 | Memory Heap 스냅샷 비교 |

#### Phase 3 검증: 부가 정리

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| C3-1 | Inpaint 참조 이미지 5회 추가/제거 반복 | blob URL 수 증가 없음 | `blobManager.getTrackedCount()` |
| C3-2 | clearCanvas 실행 | 모든 상태 초기화 + 리소스 0 | 전체 상태 검증 |

### 장시간 안정성 테스트

| # | 시나리오 | 예상 결과 | 검증 방법 |
|---|---------|----------|----------|
| S-1 | 1시간 연속 작업 (100개 생성 → 50개 삭제 → 20개 추가) | 메모리 증가량 < 200MB | Chrome Task Manager |
| S-2 | 30분간 생성/삭제 반복 (10개씩 5회) | 메모리가 매 삭제마다 감소 | MemoryMonitor 그래프 |
| S-3 | 메모리 정리 버튼 클릭 후 메모리 확인 | 비활성 blob URL 90%+ 회수 | `blobManager.safeCleanup()` 결과 |

### 성능 검증

| # | 항목 | 허용 기준 |
|---|------|----------|
| P-1 | 이미지 삭제 시 `revokeImageResources()` 소요 시간 | < 5ms (이미지당) |
| P-2 | `saveHistory()` File 제외 매핑 소요 시간 (100개 기준) | < 10ms |
| P-3 | Canvas 0 설정에 의한 이미지 최적화 성능 변화 | 차이 없음 |

---

## ACT (개선)

### 후속 개선 사항

| # | 개선 항목 | 우선순위 | 설명 |
|---|----------|---------|------|
| A-1 | Undo/Redo 복원 시 메모리 전략 재설계 | P2 | Undo 복원 시 refCount 기반으로 전환하여 히스토리 내 이미지 blob 보호 |
| A-2 | BlobManager에 WeakRef 기반 자동 추적 도입 | P3 | GC되는 객체의 blob URL을 자동 감지하여 revoke |
| A-3 | ImageBitmap Pool 도입 | P3 | 재사용 가능한 bitmap pool로 GPU 메모리 최적화 |
| A-4 | imageOptimization 함수를 OffscreenCanvas로 전환 | P3 | DOM canvas 대신 OffscreenCanvas 사용으로 메인 스레드 부하 감소 |
| A-5 | 메모리 사용량 대시보드 강화 | P3 | ImageBitmap 수, DOM Nodes 수, GPU 메모리 추정치를 MemoryMonitor에 표시 |

### 회고 체크리스트

- [ ] 수정 후 동일 시나리오에서 메모리가 안정적으로 유지되는가?
- [ ] `revokeImageResources()` 복원으로 인한 사이드이펙트가 없는가?
- [ ] Transferable 전송 변경 후 이미지 로드가 정상 작동하는가?
- [ ] Canvas 0 설정이 이미지 품질에 영향을 주지 않는가?
- [ ] lastCommittedSnapshot File 제외가 다른 기능에 영향을 주지 않는가?

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|-----|------|----------|-------|
| 1.0 | 2026-02-04 | 초안 작성 — 6개 메모리 누적 원인 분석 및 PDCA 플랜 수립 | Claude Agent (Bkit) |
