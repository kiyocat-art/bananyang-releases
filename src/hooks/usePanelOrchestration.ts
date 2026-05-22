import { useRef, useState, useCallback } from 'react';
import type { PanelRegistry } from './usePanelRegistry';

/**
 * 패널 간 조율 로직 훅.
 * - snapLinks (수직 스냅 그룹) 관리
 * - dragDelta / splitterResize 핸들러 팩토리
 *
 * 새 패널 추가 시 App.tsx에서 각 핸들러를 makeDragDeltaHandler / makeSplitterResizeHandler로
 * 1줄씩 생성하면 됨. 이 훅은 수정 불필요.
 */
export function usePanelOrchestration(registry: PanelRegistry) {
    // [PARENT-CHILD] parentId → childId 매핑
    const snapLinksRef = useRef<Map<string, string>>(new Map());
    // [CHAIN ICON] 렌더 트리거용 React state 복사본
    const [snapLinksDisplay, setSnapLinksDisplay] = useState<[string, string][]>([]);

    // [GROUP DRAG] 주어진 패널의 부모 ID 조회
    const getParentIdOf = useCallback((childId: string): string | null => {
        for (const [parentId, cId] of snapLinksRef.current) {
            if (cId === childId) return parentId;
        }
        return null;
    }, []);

    // [PARENT-CHILD] 수직 스냅 확정 — 부모-자식 링크 설정
    const handleVerticalSnapWith = useCallback((myId: string, candidateId: string, amBelow: boolean) => {
        for (const [k, v] of snapLinksRef.current) {
            if (k === myId || v === myId || k === candidateId || v === candidateId) {
                const kRef = registry.get(k)?.getIsSnappedRef();
                const vRef = registry.get(v)?.getIsSnappedRef();
                if (kRef) kRef.current = false;
                if (vRef) vRef.current = false;
                snapLinksRef.current.delete(k);
            }
        }
        const parentId = amBelow ? candidateId : myId;
        const childId = amBelow ? myId : candidateId;
        if (parentId && childId) {
            snapLinksRef.current.set(parentId, childId);
            const pRef = registry.get(parentId)?.getIsSnappedRef();
            const cRef = registry.get(childId)?.getIsSnappedRef();
            if (pRef) pRef.current = true;
            if (cRef) cRef.current = true;
        }
        setSnapLinksDisplay(Array.from(snapLinksRef.current.entries()));
    }, [registry]);

    // [PARENT-CHILD] 수직 스냅 해제
    const handleVerticalUnsnap = useCallback((myId: string) => {
        for (const [k, v] of snapLinksRef.current) {
            if (k === myId || v === myId) {
                const kRef = registry.get(k)?.getIsSnappedRef();
                const vRef = registry.get(v)?.getIsSnappedRef();
                if (kRef) kRef.current = false;
                if (vRef) vRef.current = false;
                snapLinksRef.current.delete(k);
            }
        }
        setSnapLinksDisplay(Array.from(snapLinksRef.current.entries()));
    }, [registry]);

    /**
     * 드래그 델타 핸들러 팩토리.
     * 반환된 함수는 부모→자식, 자식→부모 방향 모두 전파한다.
     *
     * 사용법:
     *   const handleLeftDragDelta = useMemo(() => makeDragDeltaHandler('left-panel'), [makeDragDeltaHandler]);
     */
    const makeDragDeltaHandler = useCallback(
        (panelId: string) => (dx: number, dy: number) => {
            // 자식 이동
            const childId = snapLinksRef.current.get(panelId);
            if (childId) registry.get(childId)?.applyDelta(dx, dy);
            // 부모 이동 (역방향 그룹 드래그)
            const parentId = getParentIdOf(panelId);
            if (parentId) registry.get(parentId)?.applyDelta(dx, dy);
        },
        [registry, getParentIdOf],
    );

    /**
     * 스플리터 리사이즈 핸들러 팩토리.
     * 부모의 남쪽 경계 리사이즈 시 자식 높이를 역수로 조정한다.
     *
     * 사용법:
     *   const handleLeftSplitterResize = useMemo(() => makeSplitterResizeHandler('left-panel'), [makeSplitterResizeHandler]);
     */
    const makeSplitterResizeHandler = useCallback(
        (panelId: string) => (heightDelta: number) => {
            const childId = snapLinksRef.current.get(panelId);
            if (childId) registry.get(childId)?.applyHeightDelta(heightDelta);
        },
        [registry],
    );

    return {
        snapLinksRef,
        snapLinksDisplay,
        handleVerticalSnapWith,
        handleVerticalUnsnap,
        makeDragDeltaHandler,
        makeSplitterResizeHandler,
    };
}
