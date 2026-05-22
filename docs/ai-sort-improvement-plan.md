# AI 이미지 자동 정렬 개선 계획

## 현재 문제점
- 그룹이 너무 세분화됨 (10개 초과 가능)
- 그룹 이름이 길고 복잡함
- 정렬 기준이 단일 (컨셉 기반만)

## 개선 목표
1. **그룹 수 제한**: 최대 10개
2. **그룹 이름 간결화**: 2-4 단어 이내
3. **포괄적 그룹화**: 잘게 쪼개지 않고 넓은 범주로 묶기
4. **정렬 기준 선택**: 3가지 모드 제공

---

## 변경 사항

### 1. 메뉴 UI 변경

**파일**: `DraggableHeader.tsx`

```tsx
// 기존
{ label: t('menu.edit.aiSortImages', language), onClick: onAiSortImages }

// 변경
{
    label: t('menu.edit.aiSortImages', language),
    children: [
        { label: t('menu.edit.aiSort.artStyle', language), onClick: () => onAiSortImages('artStyle') },
        { label: t('menu.edit.aiSort.concept', language), onClick: () => onAiSortImages('concept') },
        { label: t('menu.edit.aiSort.function', language), onClick: () => onAiSortImages('function') },
    ],
}
```

### 2. 정렬 모드 정의

**파일**: `aiSortService.ts`

| 모드 | 설명 | 그룹화 기준 |
|------|------|-------------|
| `artStyle` | 화풍 우선 | 그림체, 채색 스타일, 선 굵기, 렌더링 방식 |
| `concept` | 컨셉 우선 | 캐릭터 특징, 테마, 분위기, 장르 |
| `function` | 기능 우선 | 원본/참조/포즈/배경 등 역할 기준 |

### 3. Gemini 프롬프트 개선

**파일**: `aiSortService.ts`

```typescript
const getPromptByMode = (mode: SortMode): string => {
  const baseRules = `
STRICT RULES:
- Maximum 10 groups (combine similar items if needed)
- Group names: 2-4 words only, in Korean
- Be INCLUSIVE: prefer fewer, broader groups over many specific ones
- Every image MUST belong to exactly one group
`;

  switch (mode) {
    case 'artStyle':
      return `${baseRules}
Group by ART STYLE:
- Painting technique (수채화, 유화, 디지털, 셀쉐이딩, etc.)
- Line art style (선화, 두꺼운 선, 얇은 선, 선 없음)
- Coloring (채색, 흑백, 모노톤, 파스텔, 비비드)
- Rendering (3D, 2D, 픽셀아트, 벡터)`;

    case 'concept':
      return `${baseRules}
Group by CONCEPT:
- Character type (인간, 판타지, SF, 동물)
- Theme/mood (밝음, 어두움, 액션, 로맨스)
- Setting (현대, 중세, 미래, 자연)
- Genre (애니메이션, 리얼리스틱, 카툰)`;

    case 'function':
      return `${baseRules}
Group by FUNCTION/ROLE:
- Original designs (원본 디자인)
- Reference images (참조 이미지)
- Pose references (포즈 참조)
- Background/Environment (배경)
- Variations (바리에이션)
- Sketches/Drafts (스케치/초안)`;
  }
};
```

### 4. 콜백 시그니처 변경

**파일**: `DraggableHeaderProps` (DraggableHeader.tsx)
```typescript
// 기존
onAiSortImages: () => void;

// 변경
onAiSortImages: (mode: 'artStyle' | 'concept' | 'function') => void;
```

**파일**: `App.tsx`
```typescript
onAiSortImages={(mode) => aiSortImages(mode, (percent, status) => {
  setLoadingState({ isLoading: true, message: status, progress: percent, ... });
}).finally(() => setLoadingState({ isLoading: false, ... }))}
```

### 5. canvasStore 액션 변경

**파일**: `canvasStore.ts`
```typescript
// 기존
aiSortImages: (onProgress?: (percent: number, status: string) => void) => Promise<void>;

// 변경
aiSortImages: (
  mode: 'artStyle' | 'concept' | 'function',
  onProgress?: (percent: number, status: string) => void
) => Promise<void>;
```

### 6. 번역 키 추가

**파일**: `localization.ts`
```typescript
// TranslationKey에 추가
| 'menu.edit.aiSort.artStyle'
| 'menu.edit.aiSort.concept'
| 'menu.edit.aiSort.function'

// translations에 추가
'menu.edit.aiSort.artStyle': '화풍 우선',
'menu.edit.aiSort.concept': '컨셉 우선',
'menu.edit.aiSort.function': '기능 우선',
```

---

## 구현 순서

1. **localization.ts** - 번역 키 추가
2. **aiSortService.ts** - 모드별 프롬프트 및 그룹 제한 로직
3. **canvasStore.ts** - `aiSortImages` 액션 시그니처 변경
4. **DraggableHeader.tsx** - 메뉴 UI를 서브메뉴로 변경
5. **App.tsx** - 콜백 연결 업데이트
6. **TypeScript 빌드 검증**

---

## 예상 결과

### Before (현재)
- 그룹 수: 15-20개
- 그룹 이름: "파란 머리 캐릭터 전신 일러스트"
- 정렬 기준: 단일 (컨셉만)

### After (개선 후)
- 그룹 수: 최대 10개
- 그룹 이름: "셀쉐이딩", "수채화풍", "라인아트"
- 정렬 기준: 화풍/컨셉/기능 선택 가능
