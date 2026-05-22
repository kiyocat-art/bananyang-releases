# AI 탭 단일/다중 이미지 옵션 구현 계획

## 개요
베리에이션(variation)과 의상추출(extractOutfit) 옵션 선택시, 단일 이미지 변환과 다중 분할(2x2 grid) 중 선택할 수 있는 이미지 버튼 UI를 추가합니다.

---

## 현재 구조 분석

### 관련 파일
- [AiEditPanel.tsx](src/features/right-panel/components/AiEditPanel.tsx) - AI 편집 패널 UI
- [generationStore.ts](src/store/generationStore.ts) - 상태 관리
- [geminiService.ts](src/services/geminiService.ts) - `getVariationPrompt`, `extractOutfitImage` 함수
- [useImageGeneration.ts](src/hooks/useImageGeneration.ts) - 생성 로직

### 현재 동작
1. **베리에이션**: `getVariationPrompt()`가 항상 "2x2 grid" 프롬프트 생성 (4개 이미지)
2. **의상추출**: `extractOutfitImage()`가 항상 "3x3 grid" 프롬프트 생성 (9개 파츠)

---

## 구현 계획

### 1. 상태 추가 (generationStore.ts)

```typescript
// 새로운 상태 추가
variationOutputMode: 'single' | 'multi';  // 베리에이션 출력 모드
outfitOutputMode: 'single' | 'multi';      // 의상추출 출력 모드

// 새로운 액션 추가
setVariationOutputMode: (mode: 'single' | 'multi') => void;
setOutfitOutputMode: (mode: 'single' | 'multi') => void;
```

### 2. UI 컴포넌트 (AiEditPanel.tsx)

**디자인 컨셉**: 슬라이더 영역 하단에 작은 이미지 버튼 2개를 추가

```
┌─────────────────────────────────────┐
│  [베리에이션 아이콘]                │
│        베리에이션                    │
│  ────────○────────  (슬라이더)      │
│                                      │
│   [1️⃣]  [2x2]   ← 이미지 버튼       │
│   단일   다중                        │
└─────────────────────────────────────┘
```

**구현 방식**:
```tsx
// 선택된 옵션에 따른 이미지 버튼
const OutputModeSelector: React.FC<{
  mode: 'single' | 'multi';
  onChange: (mode: 'single' | 'multi') => void;
}> = ({ mode, onChange }) => (
  <div className="flex gap-2 mt-2 justify-center">
    <button
      onClick={() => onChange('single')}
      className={`w-8 h-8 rounded border-2 transition-all
        ${mode === 'single'
          ? 'border-white bg-white/20'
          : 'border-neutral-600 opacity-50'}`}
    >
      <img src={singleImageIcon} alt="단일" className="w-full h-full" />
    </button>
    <button
      onClick={() => onChange('multi')}
      className={`w-8 h-8 rounded border-2 transition-all
        ${mode === 'multi'
          ? 'border-white bg-white/20'
          : 'border-neutral-600 opacity-50'}`}
    >
      <img src={multiImageIcon} alt="다중" className="w-full h-full" />
    </button>
  </div>
);
```

### 3. 이미지 아이콘 에셋

**필요 파일**:
- `src/assets/icons/ai-tools/icon_single_output.png` - 단일 이미지 (1개 사각형)
- `src/assets/icons/ai-tools/icon_multi_output.png` - 다중 이미지 (2x2 그리드)

**디자인 가이드라인**:
- 크기: 64x64px (고해상도) / 32x32px (표시)
- 스타일: 기존 AI 툴 아이콘과 동일한 스타일
- 색상: 흰색 또는 밝은 회색 (어두운 패널 배경에 맞춤)

### 4. 프롬프트 수정 (geminiService.ts)

#### 베리에이션 프롬프트

```typescript
export const getVariationPrompt = (
  level: number,
  customPrompt?: string,
  outputMode: 'single' | 'multi' = 'multi'  // 새 파라미터
): string => {

  const singlePrompts: Record<number, string> = {
    1: "Make subtle design variations, staying very close to the original image's style, color, and composition. Generate a single refined variation.",
    2: "Introduce subtle design freshness. Keep the overall geometry and proportions exactly as they are. Focus on updating small component shapes. Generate a single refined variation.",
    3: "Create a noticeable design alternative. Maintain the core visual identity and color scheme, but actively vary specific design components. Generate a single high-quality variation.",
    4: "Make a highly creative and imaginative design variation, using the original image as loose inspiration. Generate a single unique interpretation.",
    5: "Explore a diverse design interpretation. Use the original image as a reference for the subject matter only. Generate a single unique design."
  };

  const multiPrompts: Record<number, string> = {
    // 기존 2x2 grid 프롬프트 유지
    1: `Make subtle design variations... Present the output as a 2x2 grid display showing four subtly varied design iterations.`,
    // ... (기존 코드 유지)
  };

  const prompts = outputMode === 'single' ? singlePrompts : multiPrompts;
  let prompt = prompts[level] || prompts[3];

  if (customPrompt && customPrompt.trim()) {
    prompt += `\n\nAdditional user instruction: ${customPrompt.trim()}`;
  }
  return prompt;
};
```

#### 의상추출 프롬프트

```typescript
export const extractOutfitImage = (
  image: { data: string, mimeType: string },
  modelName: string,
  signal: AbortSignal,
  resolution?: Resolution,
  aspectRatio?: AspectRatio,
  outputMode: 'single' | 'multi' = 'multi'  // 새 파라미터
): Promise<string[]> => {

  const singlePrompt = `<instruction>
Analyze the character's outfit. Isolate the COMPLETE outfit from the human body.
Create a SINGLE "Ghost Mannequin" style display showing the full outfit as one piece.
The clothes should retain their 3D volume and shape as if worn, but the human body is invisible.
Background: Neutral Grey (Hex #808080) studio background.
Display the complete outfit (top, bottom, accessories) together in one cohesive image.
</instruction>`;

  const multiPrompt = `<instruction>
Analyze the character's outfit. Isolate the clothing items from the human body entirely.
Create a 3x3 "Game Asset Breakdown" grid...
(기존 프롬프트 유지)
</instruction>`;

  const prompt = outputMode === 'single' ? singlePrompt : multiPrompt;
  return api.callImageEditModel(image, prompt, modelName, signal, resolution, aspectRatio);
};
```

### 5. 생성 로직 수정 (useImageGeneration.ts)

```typescript
// task에 outputMode 전달
else if (task.aiEditAction === 'variation') {
  const prompt = getVariationPrompt(
    task.variationCreativity ?? 3,
    task.customPrompt,
    task.variationOutputMode ?? 'multi'  // 새 파라미터
  );
  // ...
}
```

### 6. 타입 수정 (types.ts)

```typescript
// GenerationTask에 추가
variationOutputMode?: 'single' | 'multi';
outfitOutputMode?: 'single' | 'multi';
```

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|----------|
| `generationStore.ts` | `variationOutputMode`, `outfitOutputMode` 상태 및 setter 추가 |
| `AiEditPanel.tsx` | OutputModeSelector 컴포넌트 추가, variation/extractOutfit 버튼에 통합 |
| `geminiService.ts` | `getVariationPrompt`, `extractOutfitImage` 함수에 outputMode 파라미터 추가 |
| `useImageGeneration.ts` | outputMode를 generation task에 전달 |
| `types.ts` | GenerationTask/GenerationParams에 outputMode 타입 추가 |
| `assets/icons/ai-tools/` | 아이콘 이미지 2개 추가 필요 |

---

## 예상 레이아웃

### 비활성 상태
```
┌────────────┐  ┌────────────┐
│   자동     │  │  베리에이션 │
│  컬러링    │  │            │
└────────────┘  └────────────┘
┌────────────┐  ┌────────────┐
│  포즈추출  │  │  의상추출   │
│            │  │            │
└────────────┘  └────────────┘
```

### 베리에이션 활성 상태 (슬라이더 + 출력 모드 선택)
```
┌────────────┐  ┌────────────────┐
│   자동     │  │   베리에이션    │
│  컬러링    │  │  ────○───────  │
└────────────┘  │   [1] [2x2]    │ ← 이미지 버튼
               └────────────────┘
```

---

## 대안 디자인 (오버레이 방식)

버튼 클릭 시 작은 팝오버로 표시:

```tsx
// Popover 방식
<Popover>
  <PopoverTrigger>
    <div className="text-xs text-neutral-400 cursor-pointer">
      {mode === 'single' ? '단일 출력' : '2x2 출력'} ▼
    </div>
  </PopoverTrigger>
  <PopoverContent>
    <div className="flex gap-2">
      <img src={singleIcon} onClick={() => setMode('single')} />
      <img src={multiIcon} onClick={() => setMode('multi')} />
    </div>
  </PopoverContent>
</Popover>
```

---

## 구현 우선순위

1. **필수**: 상태 추가 (generationStore)
2. **필수**: 프롬프트 분기 (geminiService)
3. **필수**: UI 버튼 (AiEditPanel)
4. **필수**: 생성 로직 연결 (useImageGeneration)
5. **권장**: 아이콘 에셋 제작
6. **선택**: 툴팁 및 다국어 지원

---

## 예상 작업 시간

- 상태 및 타입 추가: 15분
- 프롬프트 수정: 20분
- UI 컴포넌트: 30분
- 아이콘 제작 (간단한 SVG): 15분
- 테스트 및 조정: 20분

**총 예상 시간: 1.5~2시간**
