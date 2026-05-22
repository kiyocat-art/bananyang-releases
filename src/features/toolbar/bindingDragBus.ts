/**
 * Binding Drag Bus — 바인딩된 요소 일체 이동을 위한 이벤트 버스
 *
 * 바인딩된 요소(툴바, 팝오버, 캔버스 이미지 등)의 어떤 헤더를 드래그하든
 * 모든 바인딩 멤버가 함께 이동한다.
 *
 * 드래그 소스: emitBindingDrag(screenDx, screenDy) 호출
 * 드래그 수신: window.addEventListener('binding-drag', handler)
 *
 * 좌표계: 항상 screen pixel delta.
 * 캔버스 이미지 등 다른 좌표계는 수신 측(App.tsx)에서 변환.
 */

let _active = false;

/** 바인딩 드래그 시작 (내부 플래그 설정) */
export function emitBindingDragStart(): void {
    _active = true;
}

/** 바인딩 드래그 이동 — screen pixel delta 전달 */
export function emitBindingDrag(screenDx: number, screenDy: number): void {
    if (!_active) return;
    window.dispatchEvent(new CustomEvent('binding-drag', {
        detail: { dx: screenDx, dy: screenDy },
    }));
}

/** 바인딩 드래그 종료 */
export function emitBindingDragEnd(): void {
    if (!_active) return;
    _active = false;
    window.dispatchEvent(new CustomEvent('binding-drag-end'));
}

/** 현재 바인딩 드래그가 진행 중인지 여부 */
export function isBindingDragActive(): boolean {
    return _active;
}
