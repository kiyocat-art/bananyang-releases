# Plan: Fix Memory Leaks (Blob URL Management)

## 1. 개요
- **기능명**: fix-memory-leaks
- **목적**: 무한 캔버스 및 이미지 편집 시 발생하는 메모리 누수(Blob URL 미해제)를 해결하여 앱 성능 저하 및 크래시를 방지한다.
- **담당자**: Gemini Agent

## 2. 목표 (Goals)
- Worker에서 무분별하게 생성되는 `URL.createObjectURL` 제거.
- 모든 Blob URL 생성을 `BlobManager`를 통해 중앙 집중 관리.
- 이미지가 더 이상 필요 없을 때(캔버스 제거, 이미지 교체 등) 명시적으로 `blobManager.release()` 호출.

## 3. 상세 계획 (Detailed Plan)

### 3.1 Worker 로직 변경 (`src/workers/data.worker.ts`)
- **현재**: Worker 내부에서 `generateTiles`, `encode-ktx2` 실행 시 `URL.createObjectURL`을 사용하여 `src` 문자열을 반환.
- **변경**: URL을 생성하지 않고 `File` 또는 `Blob` 객체 그대로 반환. (Transferable Objects 활용 권장)
- **대상 함수**:
    - `generateTiles`: `src: tileUrl` 대신 `blob: tileBlob` 형태로 반환하도록 구조 변경.
    - `encode-ktx2`: `ktx2Src` 대신 `ktx2Blob` 반환.

### 3.2 메인 스레드 수신부 변경 (`src/hooks/useCanvasWorker.ts` 등)
- Worker로부터 받은 메시지를 처리하는 부분에서 `blobManager.create(blob)`을 사용하여 URL 생성.
- 생성된 URL은 `BoardImage` 객체 등에 저장되어 `canvasStore`에서 관리됨.

### 3.3 명시적 해제 로직 강화
- **`canvasStore`**: 이미지를 삭제(`deleteImage`)하거나 업데이트(`updateImage`)할 때 이전 URL에 대해 `blobManager.release()` 호출.
- **`BoardImageNode`**: 타일(Tile) 이미지가 렌더링 범위 밖으로 나가거나 해제될 때 URL 해제 (PixiJS 텍스처 관리와 연동).

## 4. 성공 기준
- Worker에서 `URL.createObjectURL` 사용 0건.
- 앱 사용(줌인/아웃, 팬, 이미지 생성) 후 메모리 사용량이 지속적으로 증가하지 않고 일정 수준 유지.
- `blobManager.getStats()` 확인 시 추적되는 URL 개수가 캔버스에 존재하는 이미지 수와 비례해야 함(무한정 증가 X).

## 5. 일정
- **Start**: 2026-01-30
- **Deadline**: 2026-01-30
