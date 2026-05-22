import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useToolbarStore } from './useToolbarStore';
import { useSettingsStore } from '../../store/settingsStore';

/** 선택바 높이 (h-9=36px + p-2 상하=16px = 52px) */
const SELECTION_BAR_HEIGHT = 52;

interface UseToolbarPositionSyncProps {
    canvasRect: DOMRect | null;
}

/**
 * 바인드된 툴바의 위치만 동기화하는 훅.
 * setToolbarBoundImageId()를 절대 호출하지 않음 — 위치 계산 전담.
 *
 * 툴바를 이미지 측면(우/좌)에 배치. toolbarBindingSide 설정에 따라 방향 결정.
 * 공간 부족 시 반대 방향으로 자동 Flip.
 * 새 바인드(isNewBind)는 즉시 실행, pan/zoom 변화는 zustand.subscribe + RAF로 처리 (React 리렌더 없음).
 */
export function useToolbarPositionSync({
    canvasRect,
}: UseToolbarPositionSyncProps): void {
    const toolbarBoundImageId = useToolbarStore(s => s.toolbarBoundImageId);
    const toolbarRenderedWidth = useToolbarStore(s => s.toolbarRenderedWidth);
    const toolbarRenderedHeight = useToolbarStore(s => s.toolbarRenderedHeight);
    const orientation = useToolbarStore(s => s.orientation);
    const isHorizontal = orientation === 'horizontal';
    const selectedImageId = useCanvasStore(s =>
        s.selectedImageIds.size === 1 ? Array.from(s.selectedImageIds)[0] : null
    );
    const boundImage = useCanvasStore(s =>
        toolbarBoundImageId
            ? s.boardImages.find(img => img.id === toolbarBoundImageId) ?? null
            : null
    );

    const toolbarBindingSide = useSettingsStore(s => s.toolbarBindingSide);

    const prevBoundIdRef = useRef<string | null>(null);
    const rafRef = useRef<number | null>(null);
    // Holds the latest syncPosition fn so the pan/zoom subscribe callback can always call it
    const syncPositionRef = useRef<(() => void) | null>(null);

    // canvasRect는 prop이라 이벤트 핸들러에서 stale closure 방지를 위해 ref로 캐시
    const canvasRectRef = useRef(canvasRect);
    useEffect(() => { canvasRectRef.current = canvasRect; }, [canvasRect]);

    // RAF cleanup
    useEffect(() => () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }, []);

    // [PERF] Subscribe to pan/zoom changes — bypass React re-renders, update via RAF
    useEffect(() => {
        return useCanvasStore.subscribe((state, prev) => {
            if (state.pan === prev.pan && state.zoom === prev.zoom) return;
            if (!useToolbarStore.getState().toolbarBoundImageId) return;
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                syncPositionRef.current?.();
            });
        });
    }, []);

    // canvas-element-move 이벤트 수신 → 드래그 중 실시간 툴바 위치 추적
    // (드래그 중 Zustand store는 아직 갱신 안 됨 — mouseup 시에만 커밋됨)
    useEffect(() => {
        const handler = (e: Event) => {
            const { id, x, y } = (e as CustomEvent<{ id: string; x: number; y: number }>).detail;

            const toolbarState = useToolbarStore.getState();
            if (id !== toolbarState.toolbarBoundImageId) return;

            const rect = canvasRectRef.current;
            if (!rect) return;

            const { zoom: z, pan: p, boardImages, selectedImageIds } = useCanvasStore.getState();
            const img = boardImages.find(i => i.id === id);
            if (!img) return;

            const { toolbarRenderedWidth, toolbarRenderedHeight } = toolbarState;
            const { toolbarBindingSide } = useSettingsStore.getState();
            const isHoriz = toolbarState.orientation === 'horizontal';
            const GAP = 8;

            const imgLeft   = x * z + p.x + rect.left;
            const imgRight  = (x + img.width) * z + p.x + rect.left;
            const imgTop    = y * z + p.y + rect.top;
            const imgBottom = (y + img.height) * z + p.y + rect.top;

            const isOffScreen = imgRight < rect.left || imgLeft > rect.right
                || imgBottom < rect.top || imgTop > rect.bottom;
            if (isOffScreen !== toolbarState.toolbarBoundImageOffScreen) {
                toolbarState.setToolbarBoundImageOffScreen(isOffScreen);
            }

            if (isHoriz) {
                const imgCenterX = (imgLeft + imgRight) / 2;
                const newX = imgCenterX - toolbarRenderedWidth / 2;
                const selectedId = selectedImageIds.size === 1
                    ? Array.from(selectedImageIds)[0] : null;
                const selBarOffset = (selectedId === id) ? SELECTION_BAR_HEIGHT + GAP : 0;
                const newY = imgTop - GAP - selBarOffset - toolbarRenderedHeight;
                toolbarState.setToolbarPosition({ x: newX, y: newY });
                toolbarState.setBoundPopoverAnchor({ x: imgRight, y: imgTop, side: 'right' });
            } else {
                const resolveEffectiveSide = (side: 'left' | 'right'): 'left' | 'right' => {
                    if (side === 'right') {
                        if (imgRight + GAP + toolbarRenderedWidth <= window.innerWidth) return 'right';
                        if (imgLeft - GAP - toolbarRenderedWidth >= 0) return 'left';
                        return 'right';
                    } else {
                        if (imgLeft - GAP - toolbarRenderedWidth >= 0) return 'left';
                        if (imgRight + GAP + toolbarRenderedWidth <= window.innerWidth) return 'right';
                        return 'left';
                    }
                };
                const side = resolveEffectiveSide(toolbarBindingSide);
                const newX = side === 'right' ? imgRight + GAP : imgLeft - GAP - toolbarRenderedWidth;
                const newY = imgTop;
                toolbarState.setToolbarPosition({ x: newX, y: newY });
            }
        };

        window.addEventListener('canvas-element-move', handler);
        return () => window.removeEventListener('canvas-element-move', handler);
    }, []); // 빈 배열: 핸들러 등록/해제 한 번. 모든 값은 내부에서 getState()로 읽음

    useEffect(() => {
        // Define syncPosition first so syncPositionRef is always fresh for the subscribe callback.
        // pan/zoom read via getState() — no React re-render needed for viewport changes.
        function syncPosition() {
            const { pan, zoom } = useCanvasStore.getState();
            const rect = canvasRectRef.current;
            const GAP = 8;

            // 실제 배치 방향 결정 (Flip 방어)
            function resolveEffectiveSide(
                preferredSide: 'left' | 'right',
                imgLeft: number,
                imgRight: number,
                toolbarW: number,
            ): 'left' | 'right' {
                if (preferredSide === 'right') {
                    if (imgRight + GAP + toolbarW <= window.innerWidth) return 'right';
                    if (imgLeft - GAP - toolbarW >= 0) return 'left';
                    return 'right'; // 양쪽 불가 시 preferred 유지
                } else {
                    if (imgLeft - GAP - toolbarW >= 0) return 'left';
                    if (imgRight + GAP + toolbarW <= window.innerWidth) return 'right';
                    return 'left';
                }
            }

            // 항상 canvas 좌표에서 직접 계산 — selectionBarPosition 의존 제거
            if (boundImage && rect) {
                const imgLeft   = boundImage.x * zoom + pan.x + rect.left;
                const imgRight  = (boundImage.x + boundImage.width) * zoom + pan.x + rect.left;
                const imgTop    = boundImage.y * zoom + pan.y + rect.top;
                const imgBottom = (boundImage.y + boundImage.height) * zoom + pan.y + rect.top;

                const isOffScreen = imgRight < rect.left || imgLeft > rect.right
                    || imgBottom < rect.top || imgTop > rect.bottom;
                if (isOffScreen !== useToolbarStore.getState().toolbarBoundImageOffScreen) {
                    useToolbarStore.getState().setToolbarBoundImageOffScreen(isOffScreen);
                }

                if (isHorizontal) {
                    const imgCenterX = (imgLeft + imgRight) / 2;
                    const x = imgCenterX - toolbarRenderedWidth / 2;
                    // 이미지 선택 중이면 선택바(52px)가 표시되므로 툴바를 선택바 위에 배치
                    const selectionBarOffset = (selectedImageId === toolbarBoundImageId)
                        ? SELECTION_BAR_HEIGHT + GAP
                        : 0;
                    const y = imgTop - GAP - selectionBarOffset - toolbarRenderedHeight;
                    useToolbarStore.getState().setToolbarPosition({ x, y });
                    useToolbarStore.getState().setBoundPopoverAnchor({ x: imgRight, y: imgTop, side: 'right' });
                } else {
                    const side = resolveEffectiveSide(toolbarBindingSide, imgLeft, imgRight, toolbarRenderedWidth);
                    const x = side === 'right' ? imgRight + GAP : imgLeft - GAP - toolbarRenderedWidth;
                    const y = imgTop;
                    useToolbarStore.getState().setToolbarSide(side === 'right' ? 'left' : 'right');
                    useToolbarStore.getState().setToolbarPosition({ x, y });
                    useToolbarStore.getState().setBoundPopoverAnchor(null);
                }
            } else {
                useToolbarStore.getState().setBoundPopoverAnchor(null);
            }
        }
        syncPositionRef.current = syncPosition;

        if (!toolbarBoundImageId) {
            prevBoundIdRef.current = null;
            useToolbarStore.getState().setBoundPopoverAnchor(null);
            useToolbarStore.getState().setToolbarBoundImageOffScreen(false);
            return;
        }

        const isNewBind = prevBoundIdRef.current !== toolbarBoundImageId;
        prevBoundIdRef.current = toolbarBoundImageId;

        // 새 바인드(isNewBind)는 즉시 실행, 레이아웃 변화는 RAF로 1프레임 1회 제한
        if (!isNewBind) {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                syncPosition();
            });
            return;
        }
        syncPosition();
    }, [
        toolbarBoundImageId,
        toolbarRenderedWidth,
        toolbarRenderedHeight,
        selectedImageId,
        boundImage,
        canvasRect,
        toolbarBindingSide,
        isHorizontal,
    ]);
}
