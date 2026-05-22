# Design: Fix Build and Type Errors

## 1. 개요
이 문서는 프로젝트의 빌드 및 타입 오류를 해결하기 위한 상세 설계 내용을 담고 있습니다.

## 2. 변경 계획

### 2.1 타입 정의 충돌 해결 (IElectronAPI)
- **문제**: `tsc`가 `IElectronAPI`의 메서드(`setWindowTitle`, `saveWorkspaceThumbnail`)를 찾지 못함. 루트와 `src`에 중복된 `electron.d.ts`가 존재하여 혼란 야기 가능성.
- **해결**:
    - `C:\bananyang-ai\electron.d.ts` (루트 파일) 삭제.
    - `src/electron.d.ts`가 유일한 소스가 되도록 함.
    - `src/App.tsx`에서 `window.electronAPI` 사용 시 올바른 타입을 참조하는지 확인.

### 2.2 TypeScript 모듈 경로 및 Export 수정
- **문제**: `tsc`가 `../types`, `../localization` 등을 찾지 못함. `geminiService`의 `askBanaNyang` export 누락.
- **해결**:
    - `src/services/geminiService.ts`: `export const askbananyang` -> `export const askBanaNyang`으로 이름 변경 (호출부 `BanaNyangChat.tsx`와 일치시킴).
    - `tsconfig.json`: `paths` 설정이 현재 `@/*: ["./*"]`로 되어 있어, `src` 내부 파일 간 참조가 매끄럽지 않을 수 있음.
    - **전략**: 상대 경로(`../types`)가 논리적으로 맞으므로, 파일 내용을 다시 저장하여 컴파일러가 인식하도록 유도하거나, 필요 시 `tsconfig.json`의 `baseUrl`을 `.`으로 명시.

### 2.3 Build & Worker 구성 수정
- **문제**:
    1. `esbuild`가 `.wasm` 파일을 처리하지 못함.
    2. `data.worker.ts`가 `iife` 포맷으로 빌드되지만 `import.meta`를 사용함 (WASM 로딩).
- **해결**:
    - **`package.json`**:
        - `data.worker.ts` 빌드 커맨드 수정:
            - `--format=esm` (모듈 포맷 사용)
            - `--loader:.wasm=file` (WASM 파일을 파일로 로드)
    - **`src/services/dataWorkerService.ts`**:
        - Worker 생성자 수정: `new Worker('./data.worker.js', { type: 'module' })` 옵션 추가.

## 3. 작업 순서
1.  루트 `electron.d.ts` 삭제.
2.  `src/services/geminiService.ts` 수정 (함수명 변경).
3.  `src/services/dataWorkerService.ts` 수정 (Worker type module).
4.  `package.json` 수정 (esbuild 옵션 변경).
5.  `tsc` 오류가 났던 컴포넌트 파일들(`ImageViewerModal.tsx` 등)을 열어서 import 문 확인 및 재저장 (경로 문제는 실제 파일 유무 확인됨).
6.  빌드 테스트 (`npm run build`).

## 4. 검증 계획
- `npm run build` 실행 시 에러 코드 0으로 종료.
- `bundle.js`, `data.worker.js` 생성 확인.
