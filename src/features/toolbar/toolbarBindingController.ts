import { useCanvasStore, canvasStoreRegistry, canvasTabRouter } from '../../store/canvasStore';
import { useToolbarStore } from './useToolbarStore';
import { useSettingsStore } from '../../store/settingsStore';

/**
 * 툴바가 바인드되어야 할 이미지 ID를 계산하는 순수 함수.
 * 모든 바인딩 규칙은 이 함수 한 곳에서 결정된다.
 *
 * returns null   → 언바인드 (설정 OFF 또는 대상 없음)
 * returns string → 해당 이미지로 바인드/유지
 */
function computeBindTarget(): string | null {
    const { autoBindToolbarToOriginal } = useSettingsStore.getState();
    if (!autoBindToolbarToOriginal) return null; // 절대 게이트: 설정 OFF 시 즉시 null

    const { toolbarDockedTo, toolbarBoundImageId } = useToolbarStore.getState();
    if (toolbarDockedTo !== null) return toolbarBoundImageId; // 도킹 중 → 현재 유지

    const { boardImages } = useCanvasStore.getState();
    // 항상 현재 원본 이미지에 바인드 — 원본 변경 시 즉시 추적
    const currentOriginal = boardImages.find(img => img.role === 'original') ?? null;
    return currentOriginal ? currentOriginal.id : null;
}

// prevTarget: 마지막으로 컨트롤러가 적용한 바인드 타겟.
// undefined = 초기화 전 (아직 한 번도 평가 안 됨)
let prevTarget: string | null | undefined = undefined;

// 재진입 방지 플래그: syncBinding이 toolbarStore/settingsStore를 변경할 때 발생할 수 있는
// 재귀 호출을 차단한다. try/finally로 반드시 해제.
let isSyncing = false;

// 모듈 레벨 구독 해제 참조 (HMR 및 중복 초기화 방지)
let _unsubCanvas: (() => void) | null = null;
let _unsubSettings: (() => void) | null = null;
let _unsubRouter: (() => void) | null = null;

function syncBinding(): void {
    if (isSyncing) return; // 재진입 차단
    isSyncing = true;

    try {
        const newTarget = computeBindTarget();

        // prevTarget과 실제 store 값이 어긋난 경우(외부에서 setToolbarBoundImageId 직접 호출 등)
        // 실제 store 값을 기준으로 prevTarget을 보정한다.
        const actualBound = useToolbarStore.getState().toolbarBoundImageId;
        if (prevTarget !== undefined && prevTarget !== actualBound) {
            // 외부(예: 사용자가 언바인드 버튼 클릭)에서 바인드 상태가 바뀐 것을 감지
            prevTarget = actualBound;
        }

        if (newTarget === prevTarget) return; // 변화 없음 → no-op
        prevTarget = newTarget;

        const store = useToolbarStore.getState();

        if (newTarget === null) {
            if (store.toolbarBoundImageId === null) return;
            // 단일 setState → 단일 Zustand 알림 → 단일 React 렌더 (PixiJS 이벤트 배치 보장)
            useToolbarStore.setState({
                toolbarBoundImageId: null,
                toolbarPosition: store.toolbarFloatingPosition, // 마지막 자유 위치 복원
            });
        } else {
            if (store.toolbarBoundImageId === newTarget) return;
            // 단일 setState → 단일 Zustand 알림 → 단일 React 렌더 (PixiJS 이벤트 배치 보장)
            // 4개 분리 호출 시 중간 렌더에서 useToolbarPositionSync RAF가 잘못된 위치로 덮어쓰는
            // 타이밍 문제를 방지한다. (더블클릭 = PixiJS 이벤트, React 배치 외부)
            useToolbarStore.setState({
                toolbarUserWidth: null,
                toolbarDockedTo: null,
                isPopoverDetached: false,
                toolbarBoundImageId: newTarget,
                // 초기 위치는 useToolbarPositionSync 훅이 다음 렌더에서 설정
            });
            // 툴바 방향(가로/세로)은 useToolbarStore.orientation의 auto-derive 로직(FloatingToolbar.tsx)에 위임.
        }
    } finally {
        isSyncing = false;
    }
}

function _cleanup(): void {
    _unsubCanvas?.();
    _unsubSettings?.();
    _unsubRouter?.();
    _unsubCanvas = null;
    _unsubSettings = null;
    _unsubRouter = null;
    prevTarget = undefined;
    isSyncing = false;
}

/**
 * 현재 활성 canvasStore 인스턴스에 syncBinding을 재구독한다.
 * 탭 전환 시 옛 인스턴스 구독을 해제하고 새 인스턴스에 다시 attach.
 */
function attachCanvasSubscription(): void {
    _unsubCanvas?.();
    const inst = canvasStoreRegistry.getActiveInstance();
    _unsubCanvas = inst.subscribe(syncBinding);
}

/**
 * 외부에서 바인딩 상태를 즉시 강제 동기화할 때 호출.
 * (예: 설정 토글 직후 구독 알림을 기다리지 않고 즉시 반영)
 */
export function forceSyncBinding(): void {
    syncBinding();
}

/**
 * 앱 시작 시 한 번 호출. canvasStore + settingsStore 변화를 구독한다.
 * toolbarStore는 구독하지 않음(무한 루프 방지 — syncBinding 내부에서 실제 값 보정으로 대체).
 *
 * @returns cleanup 함수 (컴포넌트 언마운트 시 호출)
 */
export function initToolbarBindingController(): () => void {
    // 기존 구독이 있으면 먼저 해제 (중복 init, StrictMode 재마운트, HMR 대응)
    _cleanup();

    // 초기 상태 즉시 평가: 앱 로드 시 이미 이미지가 선택되어 있는 경우 대응
    syncBinding();

    // 활성 canvasStore 인스턴스에 직접 구독 (탭마다 인스턴스가 다르므로 프록시 우회)
    attachCanvasSubscription();
    _unsubSettings = useSettingsStore.subscribe(syncBinding);

    // 활성 탭 변경 시 prevTarget 리셋 + 새 인스턴스 재구독 + 즉시 sync
    // → 탭마다 다른 원본 이미지에 툴바가 즉시 추적됨
    _unsubRouter = canvasTabRouter.subscribe(() => {
        prevTarget = undefined;
        attachCanvasSubscription();
        syncBinding();
    });

    return _cleanup;
}

// HMR: 이 모듈이 교체될 때 구독을 정리해 구버전 코드가 계속 실행되지 않도록 한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _hot = (import.meta as any).hot;
if (_hot) {
    _hot.dispose(() => {
        _cleanup();
    });
}
