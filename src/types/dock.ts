/**
 * Photoshop-style 도킹 시스템 데이터 모델
 *
 * 계층 구조:
 *   SidebarState
 *     └─ columns: DockColumn[]
 *           └─ frames: DockFrame[]   (수직 스택)
 *                 └─ tabs: string[]  (탭 그룹 — 동일 영역에 묶인 패널들)
 *
 * 불변식:
 *   - tabs.length >= 1 (빈 프레임 제거)
 *   - activeTabId ∈ tabs
 *   - frames.length >= 1 (빈 컬럼 제거)
 *   - splitRatios.length === frames.length - 1, 값은 0~1 사이 (누적 분할 비율)
 *
 * v1 호환:
 *   - 마이그레이션은 useDockLayout 내 migrateSidebarV1ToV2 에서 처리
 *   - 구 SidebarState ({ width, panels: string[], splitRatios: number[] }) →
 *     단일 column / N frame / 1 tab 구조로 변환
 */

/** 탭 그룹 (한 영역에 묶인 패널들). 최소 1개의 panelId 포함. */
export type DockFrame = {
    id: string;
    tabs: string[];          // panelId 배열 (좌→우 순서)
    activeTabId: string;     // 현재 표시 중인 탭 (tabs에 포함되어야 함)
};

/** 수직 스택을 담는 컬럼. 최소 1개의 frame 포함. */
export type DockColumn = {
    id: string;
    width: number;           // px (전체 사이드바 너비 = sum(columns[].width))
    frames: DockFrame[];     // 위→아래 순서
    splitRatios: number[];   // frames.length - 1 개의 누적 분할 위치 (각 0~1)
};

/** 한쪽(left|right) 사이드바 상태. columns가 비어있으면 도킹된 패널 없음. */
export type SidebarStateV2 = {
    columns: DockColumn[];
};

/** 구 v1 SidebarState. 마이그레이션용으로만 유지. */
export type SidebarStateV1 = {
    width: number;
    panels: string[];
    splitRatios: number[];
};

/**
 * 드롭존 액션 — 드래그 종료 시 어떤 도킹 동작을 수행할지.
 */
export type DockAction =
    | { type: 'tab'; side: 'left' | 'right'; frameId: string }
    | { type: 'stack-above'; side: 'left' | 'right'; columnId: string; frameId: string }
    | { type: 'stack-below'; side: 'left' | 'right'; columnId: string; frameId: string }
    | { type: 'new-column-left'; side: 'left' | 'right'; columnId: string }
    | { type: 'new-column-right'; side: 'left' | 'right'; columnId: string };

export type DropZoneKind = 'tab' | 'stack-above' | 'stack-below' | 'new-column-left' | 'new-column-right';

/** 짧은 ID 생성 — frame/column 식별용. crypto.randomUUID 대신 가벼움 우선. */
export function makeDockId(prefix: 'frame' | 'col'): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** 빈 컬럼/프레임을 정리하고 splitRatios를 재정규화. 모든 도킹 액션 후 호출. */
export function cleanupSidebar(state: SidebarStateV2): SidebarStateV2 {
    const cleanedColumns = state.columns
        .map(col => {
            // 빈 탭의 프레임 제거
            const validFrames = col.frames.filter(f => f.tabs.length > 0);
            if (validFrames.length === 0) return null;

            // activeTabId가 tabs 배열에 없으면 첫 번째 탭으로 보정
            const fixedFrames = validFrames.map(f =>
                f.tabs.includes(f.activeTabId) ? f : { ...f, activeTabId: f.tabs[0] }
            );

            // splitRatios 재정규화 (frames 수가 변했을 가능성)
            const expectedRatioCount = Math.max(0, fixedFrames.length - 1);
            let ratios = col.splitRatios.slice(0, expectedRatioCount);
            if (ratios.length < expectedRatioCount) {
                // 모자라면 균등 분할로 채움
                ratios = Array.from({ length: expectedRatioCount }, (_, i) => (i + 1) / fixedFrames.length);
            }

            return { ...col, frames: fixedFrames, splitRatios: ratios };
        })
        .filter((c): c is DockColumn => c !== null);

    return { columns: cleanedColumns };
}

/** 사이드바 내 모든 panelId를 flat 배열로 반환 (스냅 후보 추적용). */
export function flattenPanelIds(state: SidebarStateV2): string[] {
    const ids: string[] = [];
    for (const col of state.columns) {
        for (const frame of col.frames) {
            for (const panelId of frame.tabs) {
                ids.push(panelId);
            }
        }
    }
    return ids;
}

/** panelId가 속한 frame/column 찾기. 없으면 null. */
export function findFrameByPanelId(
    state: SidebarStateV2,
    panelId: string
): { column: DockColumn; columnIndex: number; frame: DockFrame; frameIndex: number } | null {
    for (let ci = 0; ci < state.columns.length; ci++) {
        const column = state.columns[ci];
        for (let fi = 0; fi < column.frames.length; fi++) {
            const frame = column.frames[fi];
            if (frame.tabs.includes(panelId)) {
                return { column, columnIndex: ci, frame, frameIndex: fi };
            }
        }
    }
    return null;
}
