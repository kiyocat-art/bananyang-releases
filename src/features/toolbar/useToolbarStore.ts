import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOOLBAR_ITEMS } from './toolbarConfig';

interface PopoverSize { w: number; h: number }
interface Position { x: number; y: number }

export type ToolbarDockTargetId = 'left-panel' | 'batch-queue-panel' | 'batch-history-panel' | 'original-image-panel' | 'screen-left' | 'screen-right';
export interface ToolbarDockedTo {
    panelId: ToolbarDockTargetId;
    side: 'left' | 'right' | 'bottom';
}

export type ToolbarOrientation = 'vertical' | 'horizontal';

interface ToolbarState {
    /** 현재 열린 도구 키. null이면 팝오버 닫힘 */
    activeToolId: string | null;
    /** 팝오버 최소화 여부 (헤더만 표시) */
    isMinimized: boolean;
    /** 팝오버 위치 (px, fixed) - 자유 부유 상태에서만 사용 */
    popoverPosition: Position;
    /** 팝오버 크기 */
    popoverSize: PopoverSize;
    /** 툴바 자체 위치 */
    toolbarPosition: Position;
    /** 팝오버 방향 판단 소스 */
    toolbarSide: 'left' | 'right';
    /** 현재 hover 중인 tool 키 (툴팁 표시용) */
    tooltipVisible: string | null;
    /** 탭별 기본 팝오버 크기 캐시 */
    popoverDefaultSizes: Record<string, PopoverSize>;
    /** 사용자가 리사이즈한 도구별 크기 캐시 */
    popoverUserSizes: Record<string, PopoverSize>;
    /** 툴바가 도킹된 패널 + 방향 (null이면 자유 부유) */
    toolbarDockedTo: ToolbarDockedTo | null;
    /** 언도킹 시 복원할 마지막 자유 부유 위치 */
    toolbarFloatingPosition: Position;
    /** 팝오버가 툴바에서 분리(자유 부유)된 상태인지 여부 */
    isPopoverDetached: boolean;
    /** 도킹 상태에서 패널 높이 (팝오버 높이 동기화용). null이면 미도킹 */
    toolbarDockedHeight: number | null;
    /** 사용자가 수동 조절한 툴바 높이 (세로 모드, null=auto) */
    toolbarUserHeight: number | null;
    /** 사용자가 수동 조절한 툴바 너비 (가로 모드, null=auto) */
    toolbarUserWidth: number | null;
    /** 실제 렌더링된 툴바 높이 (팝오버 y 계산용) */
    toolbarRenderedHeight: number;
    /** 실제 렌더링된 툴바 너비 (팝오버 x 계산용, 2열 모드 대응) */
    toolbarRenderedWidth: number;
    /** 이미지 선택바에 종속된 이미지 ID (null이면 자유 부유) */
    toolbarBoundImageId: string | null;
    /** 바인딩 모드에서 팝오버가 붙을 이미지 측면 앵커 좌표 (null = 미계산/언바인드) */
    boundPopoverAnchor: { x: number; y: number; side: 'left' | 'right' } | null;
    /** 바인드된 이미지가 캔버스 viewport 밖으로 완전히 나간 상태 */
    toolbarBoundImageOffScreen: boolean;
    /** 툴바 방향 — dockedTo.side에 따라 auto-derive (side=bottom → horizontal, 그 외 → vertical).
     *  도킹 해제 시 마지막 방향 유지. 수동 토글 UI는 없음. */
    orientation: ToolbarOrientation;

    // Actions
    setActiveToolId: (id: string | null) => void;
    toggleTool: (id: string) => void;
    setIsMinimized: (v: boolean) => void;
    setPopoverPosition: (pos: Position) => void;
    setPopoverSize: (size: PopoverSize) => void;
    setToolbarPosition: (pos: Position) => void;
    setToolbarSide: (side: 'left' | 'right') => void;
    setTooltipVisible: (id: string | null) => void;
    /** 팝오버를 특정 도구 크기로 리셋 */
    resetPopoverSizeForTool: (toolId: string) => void;
    setToolbarDockedTo: (target: ToolbarDockedTo | null) => void;
    setToolbarFloatingPosition: (pos: Position) => void;
    setIsPopoverDetached: (val: boolean) => void;
    setToolbarDockedHeight: (h: number | null) => void;
    setToolbarUserHeight: (h: number | null) => void;
    setToolbarUserWidth: (w: number | null) => void;
    setToolbarRenderedHeight: (h: number) => void;
    setToolbarRenderedWidth: (w: number) => void;
    setToolbarBoundImageId: (id: string | null) => void;
    setBoundPopoverAnchor: (anchor: { x: number; y: number; side: 'left' | 'right' } | null) => void;
    setToolbarBoundImageOffScreen: (v: boolean) => void;
    setOrientation: (o: ToolbarOrientation) => void;
}

const buildDefaultSizes = (): Record<string, PopoverSize> =>
    Object.fromEntries(TOOLBAR_ITEMS.map(item => [item.key, item.defaultSize]));

export const useToolbarStore = create<ToolbarState>()(
  persist(
    (set, get) => ({
    activeToolId: null,
    isMinimized: false,
    popoverPosition: { x: 80, y: 80 },
    popoverSize: { w: 300, h: 460 },
    toolbarPosition: { x: window.innerWidth - 60, y: 60 },
    toolbarSide: 'left',
    tooltipVisible: null,
    popoverDefaultSizes: buildDefaultSizes(),
    popoverUserSizes: {},
    toolbarDockedTo: null,
    toolbarFloatingPosition: { x: window.innerWidth - 60, y: 60 },
    isPopoverDetached: false,
    toolbarDockedHeight: null,
    toolbarUserHeight: null,
    toolbarUserWidth: null,
    toolbarRenderedHeight: 52,
    toolbarRenderedWidth: 52,
    toolbarBoundImageId: null,
    boundPopoverAnchor: null,
    toolbarBoundImageOffScreen: false,
    orientation: 'vertical',

    setActiveToolId: (id) => set({ activeToolId: id, isMinimized: false }),

    toggleTool: (id) => {
        const { activeToolId, popoverDefaultSizes, popoverUserSizes } = get();
        if (activeToolId === id) {
            // 같은 도구 재클릭 → 닫기
            set({ activeToolId: null });
        } else {
            // 다른 도구 클릭 → 그룹 공유 크기 우선, 없으면 기본값
            const group = TOOLBAR_ITEMS.find(item => item.key === id)?.group;
            const groupKey = group === 'generation' ? '__generation__' : group === 'editor' ? '__editor__' : null;
            const size = (groupKey ? popoverUserSizes[groupKey] : null)
                ?? popoverDefaultSizes[id]
                ?? { w: 280, h: 420 };
            set({ activeToolId: id, isMinimized: false, popoverSize: size });
        }
    },

    setIsMinimized: (v) => set({ isMinimized: v }),
    setPopoverPosition: (pos) => set({ popoverPosition: pos }),
    setPopoverSize: (size) => {
        const { activeToolId } = get();
        const update: Partial<ToolbarState> = { popoverSize: size };
        if (activeToolId) {
            const group = TOOLBAR_ITEMS.find(item => item.key === activeToolId)?.group;
            const groupKey = group === 'generation' ? '__generation__' : group === 'editor' ? '__editor__' : null;
            // 그룹 키에만 저장 — 같은 그룹의 모든 도구가 공유
            const userSizes = { ...get().popoverUserSizes };
            if (groupKey) userSizes[groupKey] = size;
            else userSizes[activeToolId] = size;
            update.popoverUserSizes = userSizes;
        }
        set(update);
    },
    setToolbarPosition: (pos) => set({ toolbarPosition: pos }),

    setToolbarSide: (side) => set({ toolbarSide: side }),

    setTooltipVisible: (id) => set({ tooltipVisible: id }),

    resetPopoverSizeForTool: (toolId) => {
        const { popoverDefaultSizes, popoverUserSizes } = get();
        const size = popoverDefaultSizes[toolId] ?? { w: 280, h: 420 };
        const group = TOOLBAR_ITEMS.find(item => item.key === toolId)?.group;
        const groupKey = group === 'generation' ? '__generation__' : group === 'editor' ? '__editor__' : toolId;

        const newUserSizes = { ...popoverUserSizes };
        delete newUserSizes[groupKey];

        set({ popoverSize: size, popoverUserSizes: newUserSizes });
    },

    setToolbarDockedTo: (target) => set({ toolbarDockedTo: target }),
    setToolbarFloatingPosition: (pos) => set({ toolbarFloatingPosition: pos }),
    setIsPopoverDetached: (val) => set({ isPopoverDetached: val }),
    setToolbarDockedHeight: (h) => set({ toolbarDockedHeight: h }),
    setToolbarUserHeight: (h) => set({ toolbarUserHeight: h }),
    setToolbarUserWidth: (w) => set({ toolbarUserWidth: w }),
    setToolbarRenderedHeight: (h) => set({ toolbarRenderedHeight: h }),
    setToolbarRenderedWidth: (w) => set({ toolbarRenderedWidth: w }),
    setToolbarBoundImageId: (id) => set({ toolbarBoundImageId: id }),
    setBoundPopoverAnchor: (anchor) => set({ boundPopoverAnchor: anchor }),
    setToolbarBoundImageOffScreen: (v) => set({ toolbarBoundImageOffScreen: v }),
    setOrientation: (o) => set({ orientation: o }),
  }),
  {
    name: 'bananyang-toolbar',
    version: 2,  // v2: settingsStore에서 orientation 이동 (auto-derive 단순화)
    migrate: (persistedState: any, version: number) => {
      // v1→v2: orientation 필드 추가. 기존 dockedTo.side === 'bottom' 이면 horizontal, 그 외 vertical.
      if (version < 2 && persistedState) {
        const side = persistedState.toolbarDockedTo?.side;
        return {
          ...persistedState,
          orientation: side === 'bottom' ? 'horizontal' : 'vertical',
        };
      }
      return persistedState;
    },
    partialize: (state) => ({
      toolbarPosition: state.toolbarPosition,
      toolbarFloatingPosition: state.toolbarFloatingPosition,
      toolbarSide: state.toolbarSide,
      toolbarDockedTo: state.toolbarDockedTo,
      toolbarUserHeight: state.toolbarUserHeight,
      toolbarUserWidth: state.toolbarUserWidth,
      popoverPosition: state.popoverPosition,
      popoverSize: state.popoverSize,
      popoverUserSizes: state.popoverUserSizes,
      orientation: state.orientation,
    }),
  }
));
