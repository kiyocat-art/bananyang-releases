# Plan: Fix Build and Type Errors

## 1. 개요 (Overview)
- **기능명**: fix-build-and-type-errors
- **목적**: 현재 프로젝트의 빌드 실패 및 TypeScript 컴파일 오류를 모두 해결하여 안정적인 빌드 상태를 확보한다.
- **담당자**: Gemini Agent

## 2. 목표 (Goals)
- `tsc` 실행 시 발생하는 모든 모듈 찾기 오류 및 타입 불일치 오류 해결.
- `npm run build` 실행 시 발생하는 `esbuild` WASM 로더 오류 및 포맷 경고 해결.

## 3. 요구사항 (Requirements)
### 3.1 TypeScript 오류 수정
- **상대 경로 수정**:
    - `components/ImageViewerModal.tsx`
    - `components/PresetManagerModal.tsx`
    - `components/SavePresetModal.tsx`
    - `services/geminiService.ts`
    - 위 파일들에서 `../types`, `../localization`, `../constants` 등을 올바른 경로로 수정.
- **타입 정의 추가**:
    - `IElectronAPI` 인터페이스에 `setWindowTitle`, `saveWorkspaceThumbnail` 메서드 추가.
- **Export 수정**:
    - `services/geminiService.ts`에서 `askBanaNyang` 함수 export 확인 및 수정.

### 3.2 빌드 오류 수정
- **WASM 로더 설정**:
    - `package.json`의 `data.worker.ts` 빌드 스크립트에 `.wasm` 파일에 대한 로더 설정(`--loader:.wasm=file` 등) 추가.
- **Worker 포맷 수정**:
    - `wasm-image-processor`가 `esm` 기능을 사용하므로, 워커 빌드 포맷을 `esm`으로 변경하거나 WASM 로딩 방식 개선.

## 4. 성공 기준 (Success Metrics)
- `tsc` (또는 프로젝트의 타입 체크 명령) 실행 시 "Found 0 errors" 출력.
- `npm run build` 실행 시 에러 없이 `bundle.js`, `data.worker.js` 등이 생성됨.

## 5. 일정 (Schedule)
- **Start Date**: 2026-01-30
- **Deadline**: 2026-01-30
