# Report: Fix Memory Leaks

## 1. 개요
- **기능명**: fix-memory-leaks
- **상태**: **완료 (Completed)**
- **완료 일시**: 2026-01-30

## 2. 작업 요약
앱 사용 중(특히 줌/팬, 이미지 생성 시) 발생하는 메모리 누수 및 크래시 문제를 해결하기 위해 Blob URL 관리 체계를 전면 수정했습니다.

1.  **Worker 누수 차단**:
    - `src/workers/data.worker.ts`에서 `URL.createObjectURL` 사용을 제거했습니다.
    - 대신 `File` 또는 `Blob` 객체를 메인 스레드로 직접 전송(Transferable)하도록 변경했습니다.
2.  **중앙 집중식 URL 관리**:
    - `src/services/dataWorkerService.ts`에 `hydrateBlobUrls` 헬퍼를 도입했습니다.
    - Worker에서 받은 Blob을 `blobManager.create()`를 통해 URL로 변환하여, 모든 URL이 추적되고 관리되도록 했습니다.
3.  **데이터 흐름 개선**:
    - 기존: Worker(URL생성) -> Main(사용) -> 해제불가
    - 변경: Worker(Blob전송) -> Main(URL생성 & 등록) -> 사용 -> Main(삭제 시 해제)

## 3. 기대 효과
- **안정성 향상**: 장시간 사용해도 브라우저 메모리가 고갈되어 탭이 죽는(Aw, Snap!) 현상이 대폭 감소할 것입니다.
- **성능 유지**: 불필요한 가비지 컬렉션 부하를 줄이고, 메모리 점유율을 적정 수준으로 유지합니다.

## 4. 향후 제언
- 앱을 장시간 실행하며 작업 관리자를 통해 메모리 사용량을 모니터링하여, 예상치 못한 다른 누수(예: DOM 요소 누수, Event Listener 누수)가 없는지 추가 확인이 필요할 수 있습니다.
