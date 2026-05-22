/**
 * Z-Index 중앙 관리 파일
 *
 * 모든 z-index 값은 이 파일의 Z_INDEX 상수를 통해서만 사용한다.
 * 컴포넌트에 직접 하드코딩 금지 (Tailwind z-[숫자], 인라인 zIndex: 숫자 모두).
 *
 * 계층 구조 (낮음 → 높음):
 *   canvas_overlay(20) < loading(50) < panels(60) < panel_floating(70) < canvas_interaction(100)
 *   < canvas_lasso(120) < context_menu/prompt_panel/role_thumbnails(150)
 *   < selection_bar/toolbar(151) < toolbar_popover(152) < toolbar_tooltip(153)
 *   < modal(200~400) < auth(1000) < tooltip(9000) < dropdowns(9999) < window_handles(99999)
 *
 * loading(50)은 패널/모달보다 아래에 위치 — 로딩 중에도 패널/앱설정 조작 가능.
 *
 * selection_bar/toolbar/toolbar_popover/toolbar_tooltip은 "항상 보이는 그룹"으로
 * prompt_panel/role_thumbnails과 동일 계층에 배치 — 패널에 가려지지 않음.
 */
export const Z_INDEX = {
  // 캔버스 HTML 오버레이 (WebGL 렌더링 레이어 위 HTML 요소)
  CANVAS_OVERLAY: 20,

  // 플로팅 툴바 — "항상 보이는 그룹" (prompt_panel/role_thumbnails과 동일 계층)
  // selection_bar(151) == toolbar(151) < toolbar_popover(152) < toolbar_tooltip(153)
  SELECTION_BAR: 151,
  TOOLBAR: 151,
  TOOLBAR_POPOVER: 152,
  TOOLBAR_TOOLTIP: 153,

  // 역할 썸네일 바 (하단 고정 바) — PromptPanel과 동일 레벨
  ROLE_THUMBNAILS: 150,

  // 도킹 가능 패널 (사이드바 모드 — 위치 고정)
  PANEL: 60,

  // 플로팅 패널 (이동 가능 — 사이드바 도킹 패널 위에 표시되어야 함)
  PANEL_FLOATING: 70,

  // 캔버스 내 오버레이
  CANVAS_INTERACTION: 100,
  CANVAS_LASSO: 120,

  // 워크스페이스 탭별 로딩 오버레이 — 패널(60/70) 아래로 내려 패널 조작 가능하게 함
  CANVAS_LOADING: 50,

  // 캔버스 컨텍스트 메뉴 & 프롬프트 패널
  CANVAS_CONTEXT_MENU: 150,
  CANVAS_CONTEXT_MENU_SUBMENU: 151, // 서브메뉴는 메인 메뉴보다 1 위
  PROMPT_PANEL: 150,

  // 툴바 우클릭 메뉴 & 배치 모달
  TOOLBAR_CONTEXT_MENU: 200,
  MODAL: 200,

  // 모달 다이얼로그
  MODAL_ELEVATED: 210,
  IMAGE_VIEWER: 250,

  // 패널 리사이즈 핸들
  PANEL_RESIZE_HANDLE: 299,
  PANEL_RESIZE_CORNER: 300,

  // 모달 배경 & 고우선순위 모달
  MODAL_BACKDROP: 300,

  // 세션 복구 모달 (최우선 다이얼로그)
  SESSION_RECOVERY: 400,

  // 인증 게이트
  AUTH: 1000,

  // 풀스크린 로딩 오버레이 — 패널(60/70) 및 모달(200~400) 아래로 내려 조작 가능
  LOADING: 50,

  // 모든 툴팁 공용 (모달/로딩 위, DROPDOWN 아래)
  // 타 앱 표준: Material UI 1500 / Bootstrap 1070 → 우리 앱 스케일에 맞춰 9000
  TOOLTIP: 9000,

  // 워크스페이스 탭바 줄 (헤더 아래 고정 바)
  WORKSPACE_TABS: 9998,

  // 포털 드롭다운 (document.body 렌더링)
  DROPDOWN: 9999,
  HEADER_DROPDOWN: 10000,

  // 드롭다운 위에 올라와야 하는 툴팁 (e.g. ModelSelector 잠금 옵션)
  TOOLTIP_OVER_DROPDOWN: 10001,

  // 시스템 레벨 (Electron 윈도우 리사이즈 핸들)
  WINDOW_HANDLES: 99999,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;

/**
 * 캔버스 이미지 데이터 레이어 z-index 베이스
 *
 * CSS z-index와 별개 — PixiJS/HTML 캔버스 내부의 이미지 겹침 순서.
 * 역할 이미지는 반드시 일반 이미지(none)보다 위에 위치해야 함.
 *
 * 우선순위 (낮음 → 높음):
 *   none/background(0~9999) < poseRef(10001~19999)
 *   < costumeRef(20001~29999) < generalRef(30001~39999) < original(40001~49999)
 */
export const CANVAS_ZINDEX_BASE: Record<string, number> = {
  none: 0,
  background: 0,
  // Legacy
  pose: 10000,
  reference: 30000,
  // Current
  poseRef: 10000,
  costumeRef: 20000,
  generalRef: 30000,
  original: 40000,
};
