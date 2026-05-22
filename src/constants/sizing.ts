/**
 * 사이징 상수 중앙화
 *
 * Windows OS DPI/폰트 설정을 그대로 따른다 (커스텀 스케일러 제거됨, v35).
 * 좌표 계산(드래그/스냅) 코드에서 이 상수를 직접 사용.
 * CSS에서는 동일 값을 `--app-header-height` 같은 변수로도 노출 (index.css).
 */

// ── App layout ────────────────────────────────────────────────────────────────
/** 앱 상단 헤더 (DraggableHeader) 베이스 높이 */
export const APP_HEADER_HEIGHT_BASE = 36;
/** 워크스페이스 탭 바 높이 */
export const WORKSPACE_TAB_BAR_HEIGHT_BASE = 36;
/** App 헤더 + 워크스페이스 탭바 합계 */
export const APP_TOTAL_HEADER_HEIGHT_BASE = APP_HEADER_HEIGHT_BASE + WORKSPACE_TAB_BAR_HEIGHT_BASE;

// ── Panel ────────────────────────────────────────────────────────────────────
/** PanelShell 헤더(타이틀바/탭바) 높이 */
export const PANEL_HEADER_HEIGHT_BASE = 48; // PanelShell의 h-12 (=48px)
/** 도킹 시 사이드바 안쪽 여유 */
export const DOCK_MARGIN = 16;

// ── Sidebar / Columns / Frames ───────────────────────────────────────────────
/** 사이드바 컬럼 최소 너비 */
export const SIDEBAR_COLUMN_MIN_WIDTH = 200;
/** 단일 사이드바 최소 너비 (사이드바 전체 = sum(columns.width)) */
export const SIDEBAR_MIN_WIDTH = 192;
/** 사이드바 기본 너비 — 뷰포트 14% 또는 [192, 360] 범위 */
export const SIDEBAR_DEFAULT_WIDTH_MIN = 192;
export const SIDEBAR_DEFAULT_WIDTH_MAX = 360;
export const SIDEBAR_DEFAULT_WIDTH_RATIO = 0.14;
/** 사이드바 스택 프레임 최소 높이 */
export const FRAME_MIN_HEIGHT = 120;
/** 탭 최소 너비 */
export const TAB_MIN_WIDTH = 80;

// ── Drop Zones ───────────────────────────────────────────────────────────────
/** 프레임 외곽 드롭존(상/하/좌/우) 두께 — 가장자리 N px 진입 시 활성 */
export const DROP_ZONE_EDGE_PX = 12;
/** 탭 그룹화 드롭존 — 프레임 중앙 N 비율 */
export const DROP_ZONE_TAB_RATIO = 0.6;

// ── Snapping ─────────────────────────────────────────────────────────────────
export const EDGE_SNAP_THRESHOLD = 20;
export const SNAP_THRESHOLD = 20;
export const UNDOCK_THRESHOLD = 50;

// ── Colors ───────────────────────────────────────────────────────────────────
/** SnapIndicator 색상 (Amber 톤). index.css의 --snap-color 와 동기화. */
export const SNAP_COLOR = '#FFC107';
/** 드래그 중 패널 투명도 (data-dragging="true" 시 적용) */
export const DRAGGING_OPACITY = 0.55;

