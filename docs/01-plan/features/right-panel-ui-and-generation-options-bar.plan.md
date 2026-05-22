# PDCA Plan: 우측패널 UI 변경, 탭 전환 기능, 생성옵션바 구현

> **문서 유형**: PDCA (Plan-Do-Check-Act)
> **기능명**: right-panel-ui-and-generation-options-bar
> **작성일**: 2026-02-04
> **담당**: Claude Agent (Bkit)

---

## PLAN (계획)

### 1. 개요 (Overview)

우측패널의 탭 네비게이션 UI를 개선하고, 이미지 역할 지정 시 자동 탭 전환 기능을 추가하며, 프롬프트 입력창 상단에 현재 선택된 생성 옵션들을 한눈에 확인할 수 있는 **생성옵션바(Generation Options Bar)** 를 신규 구현한다.

### 2. 목표 (Goals)

| # | 목표 | 우선순위 |
|---|------|---------|
| 1 | 우측패널 탭 네비게이션을 아이콘 전용(2배 크기)으로 변경, AI탭만 텍스트("AI")로 대체 | P0 |
| 2 | 이미지 선택바(SelectionBar/ActionRing)에서 "원본" 역할 선택 시 우측패널 AI탭으로 자동 전환 | P0 |
| 3 | 프롬프트 입력창 상단에 생성옵션바를 신규 구현하여 선택된 모든 옵션을 실시간 표시 | P0 |

### 3. 요구사항 상세 분석

---

#### 3.1 요구사항 1: 우측패널 탭 네비게이션 아이콘 전용화

**현재 상태 (AS-IS)**
- 파일: `src/features/right-panel/index.tsx:106-143`
- 5개 탭 각각 아이콘(`w-5 h-5`) + 텍스트 라벨(`text-[11px]`) 수직 배치
- 탭 구성: 컨셉(HangerIcon) | AI편집(LightIcon) | 카메라(CameraIcon) | 포즈(BodyIcon) | 팔레트(PaintBrushIcon)

**변경 계획 (TO-BE)**

| 탭 | 현재 | 변경 후 |
|----|------|---------|
| 컨셉 디자인 | HangerIcon(w-5 h-5) + "컨셉 디자인" 텍스트 | HangerIcon(`w-10 h-10`) 아이콘만 |
| AI 편집 | LightIcon(w-5 h-5) + "AI 편집" 텍스트 | 아이콘 삭제, **"AI"** 텍스트(`text-base font-bold`)로 대체 |
| 카메라 옵션 | CameraIcon(w-5 h-5) + "카메라" 텍스트 | CameraIcon(`w-10 h-10`) 아이콘만 |
| 포즈 옵션 | BodyIcon(w-5 h-5) + "포즈" 텍스트 | BodyIcon(`w-10 h-10`) 아이콘만 |
| 팔레트 옵션 | PaintBrushIcon(w-5 h-5) + "팔레트" 텍스트 | PaintBrushIcon(`w-10 h-10`) 아이콘만 |

**수정 대상 파일**
- `src/features/right-panel/index.tsx` — 탭 네비게이션 바 렌더링 영역 (lines 106~143)

**변경 상세**
```
각 탭 버튼 구조:
- 기존: <Icon className="w-5 h-5" /> + <span>{text}</span>
- 변경: <Icon className="w-10 h-10" /> (텍스트 span 삭제)
- AI탭만: <LightIcon> 삭제 → <span className="text-base font-bold">AI</span>
```

---

#### 3.2 요구사항 2: 원본 역할 선택 시 AI탭 자동 전환

**현재 상태 (AS-IS)**
- 파일: `src/features/canvas/components/ActionRing.tsx`(SelectionBar)
- `setRoleForSelection('original')` 호출 시 역할만 설정되고, 우측패널 탭 전환은 발생하지 않음
- 기존 자동전환: 레퍼런스 이미지가 새로 추가되면 `concept` 탭으로 전환되는 로직만 존재 (`right-panel/index.tsx:40-47`)

**변경 계획 (TO-BE)**
- `setRoleForSelection('original')` 실행 시 `useGenerationStore.setActiveRightPanelTab('aiEdit')` 를 함께 호출
- 구현 위치 선택지:
  - **방안 A (권장)**: `SelectionBar.tsx`(ActionRing.tsx)의 `setRoleForSelection` 호출부에서 역할이 `original`일 때 직접 `setActiveRightPanelTab('aiEdit')` 호출
  - **방안 B**: `canvasStore`의 `setRole` 내부에서 side-effect로 처리 (store 간 결합도 증가 — 비권장)

**수정 대상 파일**
- `src/features/canvas/components/ActionRing.tsx` — `setRoleForSelection` 호출부 (line 62 근처)
- 또는 `SelectionBar.tsx`가 별도 존재할 경우 해당 파일도 동시 수정

**변경 상세**
```tsx
// ActionRing.tsx / SelectionBar.tsx 내 역할 버튼 클릭 핸들러
onClick={() => {
    setRoleForSelection(btn.role);
    if (btn.role === 'original') {
        useGenerationStore.getState().setActiveRightPanelTab('aiEdit');
    }
}
```

---

#### 3.3 요구사항 3: 생성옵션바 (Generation Options Bar) 신규 구현

**현재 상태 (AS-IS)**
- 파일: `src/features/canvas/components/RoleThumbnails.tsx` — 프롬프트 입력창 상단에 역할 썸네일만 표시
- 프롬프트 패널: `src/features/canvas/components/prompt-panel/index.tsx`
- 해상도/비율: `SettingsPopover.tsx`에서 팝오버로만 확인 가능
- 사용자가 어떤 옵션을 선택했는지 한눈에 볼 수 없음

**변경 계획 (TO-BE)**
RoleThumbnails 우측(또는 하단)에 **생성옵션바** 영역을 추가하여, 현재 활성화된 생성 옵션들을 아이콘/썸네일 형태로 실시간 표시한다.

##### 3.3.1 표시 대상 및 아이콘 매핑

**우측패널 탭 관련 옵션** (탭 네비 아이콘 활용)

| 옵션 | 활성 조건 | 표시 아이콘 | 소스 |
|------|----------|------------|------|
| 컨셉 디자인 | `selectedClothingConcept !== null` | HangerIcon | `generationStore` |
| 카메라 옵션 | `isCameraViewActive === true` | CameraIcon | `generationStore` |
| 포즈 옵션 | `poseControlImage !== null` | BodyIcon | `generationStore` |
| 팔레트 옵션 | `selectedPalette !== null` | PaintBrushIcon | `generationStore` |

**AI탭 하위 옵션** (AI 도구 전용 아이콘 활용)

| 옵션 | 활성 조건 | 표시 아이콘 | 소스 파일 |
|------|----------|------------|----------|
| 자동채색 | `selectedAiEditAction === 'autoColoring'` | `icon_auto_coloring.png` | `assets/icons/ai-tools/` |
| 디자인 베리에이션 | `selectedAiEditAction === 'variation'` | `icon_variation.png` | `assets/icons/ai-tools/` |
| 포즈 추출 | `selectedAiEditAction === 'extractPose'` | `icon_pose.png` | `assets/icons/ai-tools/` |
| 의상 추출 | `selectedAiEditAction === 'extractOutfit'` | `icon_outfit.png` | `assets/icons/ai-tools/` |
| 배경 제거 | `selectedAiEditAction === 'removeBackground'` | `icon_remove_bg.png` | `assets/icons/ai-tools/` |
| 배경만 남기기 | `selectedAiEditAction === 'keepBackgroundOnly'` | `icon_keep_bg.png` | `assets/icons/ai-tools/` |

**이미지편집창 옵션** (에디터 도구 아이콘 활용)

| 옵션 | 활성 조건 | 표시 아이콘 | 비고 |
|------|----------|------------|------|
| 이미지 편집(Crop) | `isEditorOpen && editorMode === 'crop'` | ScissorsIcon | `EditorSidebar.tsx` |
| 객체 삽입 | `isEditorOpen && editorMode === 'object'` | UploadIcon | `EditorSidebar.tsx` |
| 조명 | `isEditorOpen && editorMode === 'relight'` | LightIcon | `EditorSidebar.tsx` |
| PBR | `isEditorOpen && editorMode === 'pbr'` | "PBR" 텍스트 테두리 박스 | 아이콘 없음 → 문구 아이콘화 |

**해상도 & 비율 표시**

| 항목 | 값 | 표시 형식 |
|------|---|----------|
| 해상도 | `selectedResolution` (auto/1k/2k/4k) | 텍스트 뱃지 (예: "2K") |
| 비율 | `selectedAspectRatio` (auto/1:1/16:9 등) | 텍스트 뱃지 (예: "16:9") |

##### 3.3.2 생성옵션바 UI/UX 설계

```
┌─────────────────────────────────────────────────────────────┐
│          RoleThumbnails (기존 역할 썸네일)                      │
│  [원본] [참조1] [의상] [포즈] [배경]                             │
│                                                             │
│  ──────── 생성옵션바 (신규) ────────                            │
│  [🎨컨셉] [📷카메라] [🎨팔레트] [AI:자동채색] [2K] [16:9]         │
└─────────────────────────────────────────────────────────────┘
                    [프롬프트 입력창]
                    [생성 버튼]
```

**레이아웃 규칙**
- RoleThumbnails 하단, 프롬프트 패널 상단에 위치
- 가로 스크롤 가능한 플렉스 컨테이너
- 옵션 아이템: 32x32px 아이콘 + 배경 라운드 박스
- 실시간 업데이트: 옵션 클릭 즉시 반영
- 선택 항목이 없으면 생성옵션바 자체가 숨김 처리

##### 3.3.3 컴포넌트 설계

**신규 컴포넌트**: `GenerationOptionsBar.tsx`
- 위치: `src/features/canvas/components/GenerationOptionsBar.tsx`
- 역할: generationStore + uiStore 상태를 구독하여 현재 활성 옵션 목록 계산 및 표시

```tsx
// 의사코드 (Pseudocode)
const GenerationOptionsBar: React.FC = ({ language }) => {
    // generationStore에서 모든 옵션 상태 구독
    const {
        selectedClothingConcept, isCameraViewActive,
        poseControlImage, selectedPalette,
        selectedAiEditAction, selectedResolution, selectedAspectRatio
    } = useGenerationStore();

    // uiStore에서 에디터 상태 구독
    const { isEditorOpen, editorMode } = useUIStore();

    // 활성 옵션 목록 계산
    const activeOptions = useMemo(() => {
        const options = [];
        if (selectedClothingConcept) options.push({ type: 'concept', icon: <HangerIcon/> });
        if (isCameraViewActive) options.push({ type: 'camera', icon: <CameraIcon/> });
        if (poseControlImage) options.push({ type: 'pose', icon: <BodyIcon/> });
        if (selectedPalette) options.push({ type: 'palette', icon: <PaintBrushIcon/> });
        if (selectedAiEditAction) options.push({ type: 'ai', icon: getAiIcon(selectedAiEditAction) });
        if (isEditorOpen) options.push({ type: 'editor', icon: getEditorIcon(editorMode) });
        // 해상도, 비율은 항상 표시
        options.push({ type: 'resolution', label: selectedResolution });
        options.push({ type: 'ratio', label: selectedAspectRatio });
        return options;
    }, [dependencies]);

    if (activeOptions.length <= 2) return null; // 해상도+비율만이면 숨김

    return (
        <div className="flex items-center gap-1 ...">
            {activeOptions.map(opt => <OptionBadge key={opt.type} {...opt} />)}
        </div>
    );
};
```

##### 3.3.4 실시간 업데이트 규칙 (추가규칙)

| 트리거 이벤트 | 업데이트 내용 |
|-------------|-------------|
| 우측패널 탭에서 옵션 클릭/변경 | 해당 옵션 아이콘이 생성옵션바에 즉시 추가/제거 |
| AI탭 액션 선택/해제 | AI 하위 아이콘 즉시 추가/제거 |
| 이미지편집창 모드 전환 | 에디터 아이콘 즉시 변경 |
| 해상도/비율 변경 | 뱃지 텍스트 즉시 업데이트 |
| 역할 썸네일과 함께 프롬프트 입력창 상단에 항상 표시 | 생성 버튼 클릭 전 전체 설정 한눈에 확인 가능 |

**핵심 원칙**: Zustand store subscription을 활용하여 별도의 이벤트 전달 없이 상태 변경 → 자동 리렌더링으로 실시간 반영

---

### 4. 수정 대상 파일 종합

| # | 파일 경로 | 변경 유형 | 설명 |
|---|----------|----------|------|
| 1 | `src/features/right-panel/index.tsx` | **수정** | 탭 네비게이션 아이콘 전용화 (아이콘 2배, 텍스트 삭제, AI탭 텍스트 대체) |
| 2 | `src/features/canvas/components/ActionRing.tsx` | **수정** | 원본 역할 선택 시 `setActiveRightPanelTab('aiEdit')` 호출 추가 |
| 3 | `src/features/canvas/components/GenerationOptionsBar.tsx` | **신규** | 생성옵션바 컴포넌트 |
| 4 | `src/features/canvas/components/RoleThumbnails.tsx` | **수정** | 생성옵션바를 RoleThumbnails 하단에 통합 렌더링하거나 별도 배치 |
| 5 | `src/features/canvas/index.tsx` (InfiniteCanvas) | **수정** | GenerationOptionsBar 컴포넌트 마운트 |

---

### 5. 의존성 & 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 아이콘 2배 크기 시 탭 영역 높이 증가 | 우측패널 콘텐츠 영역 축소 | 탭 버튼 padding 조절 (`py-1` → `py-0.5`) |
| AI탭 텍스트 전용 시 다른 탭과 시각적 불일치 | 일관성 저하 | AI 텍스트에 동일한 active/inactive 스타일 적용 |
| 생성옵션바 아이템 과다 시 가로 오버플로우 | 레이아웃 깨짐 | `overflow-x-auto`로 가로 스크롤 처리 |
| 이미지편집창 모드 + AI액션 동시 활성화 | 표시 혼란 | 에디터 열림 시 AI액션 뱃지는 dim 처리 또는 에디터 뱃지 우선 표시 |
| store subscription 과다 리렌더링 | 성능 저하 | `useMemo`, `memo`, 선택적 구독으로 최적화 |

---

## DO (실행)

### Phase 1: 우측패널 탭 네비게이션 UI 변경

**Step 1.1**: `src/features/right-panel/index.tsx` 수정
- [ ] 컨셉 탭: `<HangerIcon className="w-5 h-5" />` → `<HangerIcon className="w-10 h-10" />`
- [ ] 컨셉 탭: `<span>` 텍스트 라벨 삭제
- [ ] AI 편집 탭: `<LightIcon>` 삭제, `<span className="text-base font-bold tracking-wide">AI</span>` 으로 대체
- [ ] AI 편집 탭: `<span>` 기존 텍스트 라벨 삭제
- [ ] 카메라 탭: 아이콘 `w-10 h-10`, 텍스트 삭제
- [ ] 포즈 탭: 아이콘 `w-10 h-10`, 텍스트 삭제
- [ ] 팔레트 탭: 아이콘 `w-10 h-10`, 텍스트 삭제
- [ ] 탭 버튼 패딩 조절: `py-1 lg:py-1.5` → `py-2 lg:py-2.5` (아이콘 크기 증가에 맞춤)
- [ ] Tooltip은 유지 (마우스 오버 시 탭 이름 확인 가능)

### Phase 2: 원본 역할 선택 시 AI탭 자동 전환

**Step 2.1**: `src/features/canvas/components/ActionRing.tsx` 수정
- [ ] `useGenerationStore`에서 `setActiveRightPanelTab` import 추가
- [ ] 역할 버튼 `onClick` 핸들러에서 `btn.role === 'original'` 조건 분기 추가
- [ ] 조건 충족 시 `setActiveRightPanelTab('aiEdit')` 호출

**Step 2.2**: 동일 로직을 `SelectionBar.tsx`에도 적용 (해당 컴포넌트가 사용되는 경우)
- [ ] `SelectionBar.tsx`에서도 `setRoleForSelection('original')` 호출부에 동일 로직 추가

### Phase 3: 생성옵션바 구현

**Step 3.1**: `GenerationOptionsBar.tsx` 신규 컴포넌트 생성
- [ ] `src/features/canvas/components/GenerationOptionsBar.tsx` 파일 생성
- [ ] generationStore 구독: `selectedClothingConcept`, `isCameraViewActive`, `poseControlImage`, `selectedPalette`, `selectedAiEditAction`, `selectedResolution`, `selectedAspectRatio`
- [ ] uiStore 구독: `isEditorOpen`, `editorMode`
- [ ] 아이콘 매핑 함수 구현 (`getAiActionIcon`, `getEditorModeIcon`)
- [ ] PBR 모드용 텍스트-박스 아이콘 컴포넌트 구현
- [ ] 해상도/비율 텍스트 뱃지 컴포넌트 구현
- [ ] `useMemo`로 활성 옵션 목록 최적화
- [ ] `memo`로 불필요한 리렌더링 방지

**Step 3.2**: 생성옵션바를 캔버스 레이아웃에 통합
- [ ] `RoleThumbnails.tsx` 또는 `InfiniteCanvas/index.tsx`에 `GenerationOptionsBar` import 및 배치
- [ ] 프롬프트 패널 상단, RoleThumbnails 하단 위치에 렌더링
- [ ] 위치 계산: `bottomOffset` 기반으로 프롬프트 패널 위에 올바르게 배치

**Step 3.3**: 스타일링
- [ ] 옵션 뱃지: `w-8 h-8` 아이콘 + `bg-neutral-800/50 backdrop-blur-md` 배경 + `rounded-lg` + `border border-white/10`
- [ ] PBR 뱃지: `border border-white/30 rounded px-1.5 py-0.5 text-[10px] font-bold` 텍스트 박스
- [ ] 해상도/비율 뱃지: `bg-yellow-500/20 border-yellow-500/30 text-yellow-400 text-[10px] font-bold rounded px-1.5`
- [ ] 전체 컨테이너: `bg-neutral-800/50 backdrop-blur-md border border-white/10 rounded-xl p-1.5`
- [ ] 가로 오버플로우 시: `overflow-x-auto scrollbar-hide`
- [ ] Tooltip으로 각 뱃지의 상세 이름 표시

---

## CHECK (검증)

### 검증 항목

#### 3.1 탭 네비게이션 UI 검증

| # | 검증 항목 | 예상 결과 | 검증 방법 |
|---|----------|----------|----------|
| C1-1 | 컨셉/카메라/포즈/팔레트 탭에 아이콘만 표시되는가 | 텍스트 없이 아이콘(10x10)만 표시 | 육안 확인 |
| C1-2 | AI탭에 "AI" 텍스트만 표시되는가 | LightIcon 대신 "AI" 텍스트만 표시 | 육안 확인 |
| C1-3 | 아이콘 크기가 기존 대비 2배인가 | w-5→w-10 (20px→40px) | 개발자도구 측정 |
| C1-4 | 활성 탭 하단 인디케이터 정상 작동하는가 | 흰색 밑줄 + 그림자 효과 | 각 탭 클릭 |
| C1-5 | 탭 영역 높이가 적절한가 | 콘텐츠 영역이 과도하게 줄어들지 않음 | 다양한 화면 크기 |
| C1-6 | Tooltip이 정상 표시되는가 | 마우스 호버 시 탭 이름 표시 | 호버 테스트 |

#### 3.2 원본 역할 → AI탭 자동 전환 검증

| # | 검증 항목 | 예상 결과 | 검증 방법 |
|---|----------|----------|----------|
| C2-1 | 원본 역할 선택 시 AI탭으로 전환되는가 | 자동으로 AI탭 활성화 | 이미지 선택 → 원본 클릭 |
| C2-2 | 다른 역할(참조/의상/포즈/배경) 선택 시 탭 변환 없는가 | 현재 탭 유지 | 각 역할 클릭 |
| C2-3 | 원본 해제 후 재선택 시 동작하는가 | 매번 AI탭으로 전환 | 토글 테스트 |
| C2-4 | ActionRing과 SelectionBar 양쪽 모두 동작하는가 | 동일 동작 | 두 컴포넌트에서 각각 테스트 |

#### 3.3 생성옵션바 검증

| # | 검증 항목 | 예상 결과 | 검증 방법 |
|---|----------|----------|----------|
| C3-1 | 컨셉 선택 시 HangerIcon 뱃지 표시되는가 | 즉시 표시 | 컨셉탭에서 의상 선택 |
| C3-2 | 카메라 활성화 시 CameraIcon 뱃지 표시되는가 | 즉시 표시 | 카메라탭에서 활성화 |
| C3-3 | 포즈 이미지 설정 시 BodyIcon 뱃지 표시되는가 | 즉시 표시 | 포즈탭에서 드로잉 |
| C3-4 | 팔레트 선택 시 PaintBrushIcon 뱃지 표시되는가 | 즉시 표시 | 팔레트탭에서 선택 |
| C3-5 | AI 액션 선택 시 해당 AI 아이콘 뱃지 표시되는가 | 6종 각각 정확한 아이콘 | AI탭에서 각 액션 클릭 |
| C3-6 | 에디터 모드 전환 시 에디터 아이콘 변경되는가 | crop/object/relight/pbr 각각 | 에디터 내 탭 전환 |
| C3-7 | PBR 모드 시 "PBR" 텍스트 박스로 표시되는가 | 테두리 박스 안에 "PBR" 텍스트 | PBR 탭 클릭 |
| C3-8 | 해상도 변경 시 뱃지 즉시 업데이트되는가 | "Auto"→"2K" 등 즉시 반영 | 해상도 변경 |
| C3-9 | 비율 변경 시 뱃지 즉시 업데이트되는가 | "Auto"→"16:9" 등 즉시 반영 | 비율 변경 |
| C3-10 | 옵션 없을 때 생성옵션바 숨김 처리되는가 | 해상도/비율만이면 미표시 | 모든 옵션 해제 |
| C3-11 | 역할 썸네일과 생성옵션바가 동시에 올바르게 표시되는가 | 겹침/간섭 없음 | 복합 시나리오 |
| C3-12 | 생성 버튼 클릭 전 모든 선택 항목 확인 가능한가 | 한눈에 확인 가능 | 복합 옵션 선택 후 확인 |

### 성능 검증

| # | 항목 | 허용 기준 |
|---|------|----------|
| P-1 | 옵션 변경 → 생성옵션바 반영 지연 | < 16ms (1 프레임) |
| P-2 | 캔버스 줌/팬 시 생성옵션바 리렌더링 | 발생하지 않아야 함 (memo 적용) |
| P-3 | 다수 옵션 활성 시 레이아웃 성능 | 부드러운 스크롤 |

---

## ACT (개선)

### 후속 개선 사항

| # | 개선 항목 | 우선순위 | 설명 |
|---|----------|---------|------|
| A-1 | 생성옵션바 뱃지 클릭 시 해당 옵션 패널로 이동 | P1 | 뱃지를 클릭하면 해당 우측패널 탭으로 자동 전환 |
| A-2 | 생성옵션바 뱃지 롱프레스 시 옵션 해제 | P2 | 빠른 옵션 해제 UX |
| A-3 | 생성옵션바 애니메이션 | P2 | 뱃지 추가/제거 시 슬라이드 인/아웃 애니메이션 |
| A-4 | 생성옵션바 프리셋 저장 | P3 | 현재 옵션 조합을 프리셋으로 저장/불러오기 |
| A-5 | 원본 이외 역할에 대한 탭 자동 전환 확장 | P2 | 의상참조→컨셉탭, 포즈참조→포즈탭 등 |

### 회고 체크리스트

- [ ] 탭 네비게이션 변경 후 사용자 접근성(a11y) 문제 없는가?
- [ ] 아이콘 전용 UI에서 신규 사용자가 탭 기능을 이해할 수 있는가? (Tooltip 충분성)
- [ ] 생성옵션바가 프롬프트 입력을 방해하지 않는가?
- [ ] 모바일/태블릿 환경에서 생성옵션바 가독성은 적절한가?

---

## 부록: 아이콘 매핑 참조표

### 우측패널 탭 아이콘 (SVG, icons.tsx)
| 탭 | 컴포넌트 | import |
|----|---------|--------|
| 컨셉 | `HangerIcon` | `src/components/icons.tsx` |
| 카메라 | `CameraIcon` | `src/components/icons.tsx` |
| 포즈 | `BodyIcon` | `src/components/icons.tsx` |
| 팔레트 | `PaintBrushIcon` | `src/components/icons.tsx` |

### AI 도구 아이콘 (PNG, assets)
| 액션 | 파일명 | 경로 |
|------|--------|------|
| 자동채색 | `icon_auto_coloring.png` | `src/assets/icons/ai-tools/` |
| 디자인 베리에이션 | `icon_variation.png` | `src/assets/icons/ai-tools/` |
| 포즈 추출 | `icon_pose.png` | `src/assets/icons/ai-tools/` |
| 의상 추출 | `icon_outfit.png` | `src/assets/icons/ai-tools/` |
| 배경 제거 | `icon_remove_bg.png` | `src/assets/icons/ai-tools/` |
| 배경만 남기기 | `icon_keep_bg.png` | `src/assets/icons/ai-tools/` |

### 이미지편집창 아이콘 (SVG, icons.tsx)
| 모드 | 컴포넌트 | 비고 |
|------|---------|------|
| Crop (이미지편집) | `ScissorsIcon` | SVG 아이콘 |
| Object (객체삽입) | `UploadIcon` | SVG 아이콘 |
| Relight (조명) | `LightIcon` | SVG 아이콘 |
| PBR | 없음 | "PBR" 텍스트 테두리 박스로 아이콘화 |

---

## 일정

- **Start Date**: 2026-02-04
- **Phase 1 (탭 UI)**: 즉시 착수 가능
- **Phase 2 (자동 전환)**: Phase 1 완료 후
- **Phase 3 (생성옵션바)**: Phase 1, 2 완료 후 (가장 큰 작업)
