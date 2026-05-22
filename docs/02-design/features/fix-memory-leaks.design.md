# Design: Fix Memory Leaks (Blob URL Management)

## 1. 개요
이 문서는 Worker에서 생성되는 무제한 Blob URL 누수 문제를 해결하기 위한 기술 설계를 다룹니다.

## 2. 변경 범위 및 상세 설계

### 2.1 Worker (`src/workers/data.worker.ts`)
- **변경 사항**: `URL.createObjectURL` 사용 금지.
- **`generateTiles`**:
    - 반환 타입: `{ src: string, ... }` -> `{ blob: Blob, ... }`
    - `src` 필드를 제거하거나 빈 문자열로 설정하고, 실제 데이터는 `blob` 필드에 담아 반환.
- **`encode-ktx2`**:
    - 반환 타입: `{ ktx2Src: string }` -> `{ ktx2Blob: Blob }`

### 2.2 메인 스레드 수신부 (`src/features/canvas/hooks/useCanvasWorker.ts`)
- `data.worker.ts`에서 메시지를 받는 `onmessage` 핸들러 수정.
- **Tile 처리**:
    - `payload.tiles` 배열 순회.
    - 각 tile의 `blob`을 꺼내 `blobManager.create(tile.blob)` 실행.
    - 반환된 URL을 `tile.src`에 할당.
- **KTX2 처리**:
    - `payload.ktx2Blob`이 있으면 `blobManager.create(payload.ktx2Blob)` 실행.
    - `ktx2Src`에 URL 할당.

### 2.3 Store 및 컴포넌트 (`src/store/canvasStore.ts`, `src/features/canvas/Canvas.tsx`)
- **`canvasStore`**:
    - `deleteImage`: 이미지 삭제 시, 해당 이미지의 `src`, `tinySrc`, `previewSrc`, `ktx2Src` 및 `tiles` 배열의 모든 `src`에 대해 `blobManager.release()` 호출.
    - `updateImage`: 이미지가 교체될 때(예: 고해상도 로드 완료), 이전 URL 해제.
    - `setBoardImages`: 워크스페이스 로드/초기화 시 기존 이미지들의 URL 일괄 해제(`blobManager.revokeAll()` 또는 개별 해제).

### 2.4 유틸리티 (`src/utils/blobManager.ts`)
- 기존 코드 유지하되, 자동 정리(`autoCleanup`)는 비활성화 상태 유지 (명시적 관리가 더 안전).
- 필요 시 `release(url)` 메서드가 `undefined`나 `null`을 안전하게 무시하도록 보강.

## 3. 데이터 흐름 변경 (Before vs After)

**Before:**
Worker (createObjectURL) -> URL 문자열 -> Main Thread -> Canvas (사용) -> 삭제 시 (GC만 믿음 -> 누수)

**After:**
Worker (Blob 반환) -> Main Thread (BlobManager.create) -> URL 문자열 -> Canvas (사용) -> 삭제 시 (BlobManager.release) -> 메모리 해제

## 4. 검증 계획
1.  앱 실행 및 이미지 로드.
2.  `blobManager.getStats()`를 콘솔에 출력하여 추적 중인 URL 수 확인.
3.  이미지 삭제 후 URL 수가 감소하는지 확인.
4.  줌인/아웃 반복(타일 생성) 후, 다른 작업 시 메모리 해제 여부 확인.
