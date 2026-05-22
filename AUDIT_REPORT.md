# BanaNyang 캔버스 시스템 종합 점검 리포트

**점검일:** 2026-01-30
**점검 범위:** 무한 캔버스의 모든 이미지 처리 경로, 최적화, VRAM/메모리 관리

---

## CRITICAL (즉시 수정 필요)

### 1. `runWithLimit` 이중 실행 버그

- **파일:** `src/workers/data.worker.ts` (line 131~205)
- **증상:** 함수 내부에 **두 개의 완전한 구현**이 직렬로 존재. 첫 번째 구현이 최대 8개 태스크를 실행한 뒤, 두 번째 구현이 모든 태스크를 0번부터 **다시 실행**
- **영향:** 워크스페이스 로드 시 처음 8개 이미지가 2번 처리됨 → CPU/메모리 낭비

### 2. `currentTotalBytes` VRAM 과다 계산

- **파일:** `src/features/canvas/rendering.worker.ts` (line 1178~1184)
- **증상:** 같은 ID로 `add-resource`가 두 번 호출되면 (재요청 시), 기존 byte 크기를 빼지 않고 새 값만 더함
- **영향:** `currentTotalBytes`가 실제보다 크게 집계 → 조기 LRU 제거 발생 가능

### 3. `addNewCanvasImage`에서 `tinySrc` 미생성

- **파일:** `src/store/canvasStore.ts` (line 269)
- **증상:** 다른 4개 입력 경로(uploadImages, addImagesToCenter, addHistoryImage)는 모두 `tinySrc` 생성하지만 이 경로만 누락
- **영향:** 3-Stage LOD 시스템 파손, placeholder 없이 원본이 그대로 표시됨

### 4. 워크스페이스 로드 시 롤백 없음

- **파일:** `src/App.tsx` (line 1081)
- **증상:** `clearCanvas()` 호출 후 역직렬화 수행. 역직렬화 실패 시 기존 캔버스 데이터는 이미 삭제됨
- **영향:** 로드 실패 = 현재 작업 전량 유실, 복구 불가

---

## HIGH (성능/안정성 영향)

### 5. WASM 로딩만 하고 미사용

- **파일:** `src/workers/data.worker.ts` (line 6)
- **증상:** `process_image_lod`, `ProcessedLOD`를 import하고 `ensureWasm()`으로 초기화하지만 단 한번도 호출하지 않음. 모든 LOD 처리는 JS Canvas API로 수행
- **영향:** WASM 모듈이 메모리에 상주하면서 아무 일도 하지 않음

### 6. `generateTinySrc` Blob URL 미추적 (메모리 누수)

- **파일:** `src/utils/imageUtils.ts` (line ~161)
- **증상:** `URL.createObjectURL(blob)`으로 생성하지만 `blobManager`에 등록하지 않음
- **영향:** `blobManager.release()`로 정리 불가. 앱 사용 시간이 길어질수록 누적

### 7. `revokeImageResources`에서 `originalSrc` 누락

- **파일:** `src/utils/canvasUtils.ts` (line ~4-15)
- **증상:** `src`, `thumbnailSrc`, `maskSrc`, `tinySrc`, `previewSrc`, `proxySrc`, `ktx2Src`, `highResSrc`는 해제하지만 `originalSrc`만 빠짐
- **영향:** 이미지 삭제/교체 시 originalSrc의 blob URL이 영구 잔류

### 8. `updateImageWithHistory` 히스토리 2중 저장

- **파일:** `src/store/canvasStore.ts` (line 259~262)
- **증상:** `saveHistory()` 호출 후 `updateImage()` 호출 → `updateImage()` 내부에서 다시 `saveHistory()`
- **영향:** 하나의 변경에 대해 Undo 항목이 2개 생김

### 9. `process-media-for-canvas` LOD 미생성 (4번째 파이프라인)

- **파일:** `src/workers/data.worker.ts` (line 432~463)
- **증상:** CLAUDE.md에 없는 4번째 파이프라인. Tiny/Preview LOD 미생성, `thumbnailSrc`에 Worker 전용 Blob URL 설정 (메인 스레드에서 무효)
- **영향:** 이 경로로 추가된 미디어는 LOD 없이 원본만 표시, 썸네일 깨짐

### 10. settingsStore `version: 9`이지만 `migrate` 함수 없음

- **파일:** `src/store/settingsStore.ts` (line 121)
- **증상:** 버전 변경마다 Zustand persist가 기존 설정을 전부 삭제하고 기본값으로 초기화
- **영향:** 사용자 설정 (자동저장 간격, 글래스 효과 등) 버전 올릴 때마다 유실

### 11. `pendingAbortControllers` 성공 시에도 정리 안 됨

- **파일:** `src/features/canvas/rendering.worker.ts` (line 298~300 vs 1143~1212)
- **증상:** 텍스처 요청 시 AbortController 생성, 성공 응답(`add-resource`) 시 삭제하지 않음
- **영향:** AbortController 객체가 Map에 계속 누적

---

## MEDIUM (개선 권장)

### 12. ImageBitmap 3중 디코딩

- **파일:** `src/workers/data.worker.ts` — `process-files-for-canvas` (line 398) + `generatePreviewFile` (line 271, 286)
- **증상:** 파일당 ImageBitmap을 3번 생성 (치수 확인 1회 + Preview 치수 확인 1회 + Preview 리사이즈 1회)
- **개선:** 이미 알고 있는 치수를 재활용하면 디코딩 2회 절약

### 13. AI 생성 시 `file`과 `originalFile`이 동일 객체

- **파일:** `src/workers/data.worker.ts` (line 590, 605)
- **증상:** 동일한 File이 `filename.png`과 `filename_original.png`으로 2번 저장
- **영향:** 디스크 공간 2배 사용

### 14. Blob URL 미해제 (useImageGeneration RAM 경로)

- **파일:** `src/hooks/useImageGeneration.ts` (line 520~528)
- **증상:** Electron API 미사용 시 (Web 환경) `URL.createObjectURL()`으로 생성한 URL이 어디에서도 `revokeObjectURL()` 안 됨

### 15. `openDB()` 무한 재귀 위험

- **파일:** `src/utils/idb.ts` (line 13~22)
- **증상:** ObjectStore 생성 실패 시 DB 삭제 → 재오픈 → 다시 실패 → 무한 루프. 재귀 깊이 제한 없음

### 16. KTX2 인코딩 불일치

- **파일:** `src/store/canvasStore.ts` (line 751~815)
- **증상:** `addHistoryImage`에서는 KTX2 인코딩 미실행. 다른 경로(uploadImages, addImagesToCenter, addNewCanvasImage)에서는 실행

### 17. Zoom Viewer Blob URL 미해제

- **파일:** `src/App.tsx` (line 1682)
- **증상:** `URL.createObjectURL(media)` 생성, `handleCloseViewer`에서 해제 안 함

---

## LOW (코드 품질)

### 18. 매직넘버 다수 반복 사용

| 값 | 반복 횟수 | 용도 |
|---|---|---|
| `STANDARD_SIZE = 512` | 10+ | 캔버스 표시 크기 정규화 |
| `PADDING = 20` | 4+ | 그룹 패딩 |
| `128` | 3+ | Tiny LOD 크기 |
| `2048` | 4+ | 최대 최적화 해상도 |
| `BULK_THRESHOLD = 2` | 5+ | 벌크 업로드 판정 |

상수로 추출하여 한 곳에서 관리 권장.

### 19. KTX2 인코딩 코드 3중 복사

- **파일:** `src/store/canvasStore.ts` (line 320~345, 556~587, 711~739)
- **증상:** 거의 동일한 IIFE 패턴이 3번 반복
- **개선:** 공용 함수로 추출

### 20. `dataURLtoFile` 헬퍼 중복 정의

- **파일:** `src/App.tsx` (line 79) / `src/hooks/useClipboard.ts` (line 7)
- **증상:** 완전히 동일한 구현이 2곳에 존재

### 21. `maxHistorySize: 50` 미사용 (Dead Code)

- **파일:** `src/store/canvasStore.ts` (line 168)
- **증상:** 실제로는 `MAX_HISTORY_LENGTH = 5` (line 20) 사용. `maxHistorySize`는 선언만 되어 있음

### 22. 레거시 확장자 배열 중복

- **파일:** `src/App.tsx` (line 949)
- **증상:** `['.rfy', '.bananyang', '.bananyang']` — `.bananyang`이 2번 들어감

### 23. Immer `enableMapSet()` 미호출

- **파일:** `src/store/canvasStore.ts` (line 18)
- **증상:** `enablePatches()`만 호출. `saveHistory()`에서 `Set` 객체(selectedImageIds 등) 포함 시 Undo/Redo 패치 오류 가능

### 24. LOD 관련 CLAUDE.md 문서 불일치

- **증상:** 고해상도 줌 설정이 코드에서 제거됨 (`shouldUseHighRes = false`로 하드코딩). CLAUDE.md에는 "줌 400%+ AND 설정 ON 시 Full 로딩"이라고 명시
- **개선:** CLAUDE.md 업데이트 필요

---

## 이미지 입력 경로별 일관성 매트릭스

| 기능 | uploadImages | addImagesToCenter | addHistoryImage | addNewCanvasImage | process-media |
|---|---|---|---|---|---|
| **tinySrc** | O | O | O | **X** | **X** |
| **previewSrc** | - | - | - | - | **X** |
| **KTX2** | O | O | **X** | O | - |
| **originalFile** | O | O | O | O | **X** |
| **proxyFile** | - | O | - | - | O (무효값) |

**X** 표시가 일관성 파손 지점.

---

## 권장 수정 순서

1. `runWithLimit` 이중 실행 버그 제거 (CRITICAL #1)
2. `currentTotalBytes` 중복 계산 방지 (CRITICAL #2)
3. `addNewCanvasImage`에 `tinySrc` 생성 추가 (CRITICAL #3)
4. 워크스페이스 로드 실패 시 롤백 구조 추가 (CRITICAL #4)
5. 미사용 WASM 초기화 제거 (HIGH #5)
6. Blob URL 누수 일괄 수정 (#6, #7, #14, #17)
7. `updateImageWithHistory` 이중 히스토리 수정 (HIGH #8)
8. `process-media-for-canvas` LOD 생성 추가 (HIGH #9)
9. settingsStore migrate 함수 추가 (HIGH #10)
10. 나머지 MEDIUM/LOW 항목 순차 수정
