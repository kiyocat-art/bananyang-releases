# Design: Fix Rendering Crash and Build Errors

## 1. PixiJS GC Configuration (rendering.worker.ts)
```typescript
// Move to the absolute top of the file
import { TextureGCSystem } from 'pixi.js';
(TextureGCSystem as any).defaultMode = 'manual';

// Inside app.init() callback or initialization logic
if (app.renderer.textureGC) {
    app.renderer.textureGC.mode = 'manual';
    app.renderer.textureGC.checkCountMax = Number.MAX_SAFE_INTEGER;
}
```

## 2. Build Script Updates (package.json)
```json
"build": "... esbuild src/workers/data.worker.ts --bundle --outfile=data.worker.js --loader:.ts=ts --loader:.wasm=file --platform=browser --format=esm"
```
*Note: Changed format from iife to esm to fix `import.meta` warning.*

## 3. Electron API Definitions (src/electron.d.ts)
```typescript
interface IElectronAPI {
    // ... existing
    setWindowTitle: (title: string) => void;
    saveWorkspaceThumbnail: (id: string, thumbnail: string) => Promise<void>;
}
```

## 4. TSConfig Path Mapping
Verify `compilerOptions.baseUrl` and `compilerOptions.paths` in `tsconfig.json`.
Current errors suggest `../localization` style imports are failing, possibly because they should be `@/localization` or similar if paths are configured.
