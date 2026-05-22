# Plan: Fix Rendering Crash and Build Errors

## 1. Goal
- Resolve the `_resourceId` crash in `rendering.worker.ts`.
- Fix `esbuild` errors for `data.worker.ts` (WASM loader & IIFE format).
- Address TypeScript path mapping and Electron API definition errors.

## 2. Tasks
### Task 1: Fix Rendering Crash (High Priority)
- Update `rendering.worker.ts` to strictly disable PixiJS auto-GC.
- Move `TextureGCSystem.defaultMode = 'manual'` to the very top.
- Set `checkCountMax` to `Number.MAX_SAFE_INTEGER`.

### Task 2: Fix Build Scripts (Medium Priority)
- Update `package.json` build scripts:
    - Add `--loader:.wasm=file` for `data.worker.ts`.
    - Change `--format=iife` to `--format=esm` for `data.worker.ts` to support `import.meta`.

### Task 3: Resolve TS Errors (Medium Priority)
- Update `src/electron.d.ts` to include missing `setWindowTitle` and `saveWorkspaceThumbnail`.
- Investigate `tsconfig.json` for path mapping issues.

## 3. Success Criteria
- `npm run build` completes without errors.
- No `_resourceId` crash during canvas operations.
- `data.worker.js` loads WASM successfully.
