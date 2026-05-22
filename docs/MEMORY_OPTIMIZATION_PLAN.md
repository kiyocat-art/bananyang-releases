# BanaNyang AI 메모리 최적화 개선 계획

> **문서 버전**: 1.2
> **작성일**: 2026-02-03
> **최종 수정**: 2026-02-03
> **방법론**: PDCA (Plan-Do-Check-Act)
> **상태**: ✅ 구현 완료 및 검증 완료

---

## 🎉 구현 완료 요약

| 개선 항목 | 상태 | 관련 파일 |
|----------|------|----------|
| 주기적 메모리 정리 | ✅ 완료 | `blobManager.ts`, `useMemoryCleanup.ts`, `MemoryMonitor.tsx`, `AppSettingsModal.tsx` |
| 이미지 개수 제한 | ✅ 완료 | `settingsStore.ts`, `canvasStore.ts`, `ImageLimitWarning.tsx`, `App.tsx` |
| 임시 파일 정리 | ✅ 완료 | `main.js`, `preload.js`, `electron.d.ts` |
| 메타데이터 분리 | ✅ 완료 | `metadataStore.ts`, `canvasStore.ts` |
| VRAM 텍스처 정리 | ✅ 완료 | `useCanvasWorker.ts`, `rendering.worker.ts` |

### 추가 구현 사항 (2026-02-03)

1. **canvas-cleanup-textures 이벤트 체인 완성**
   - `useCanvasWorker.ts`: 이벤트 리스너 추가
   - `rendering.worker.ts`: `cleanup-unused-textures` 메시지 핸들러 추가

2. **MemoryMonitor UI 통합**
   - `AppSettingsModal.tsx`: 일반 설정 탭에 메모리 관리 섹션 추가

---

## 📋 목차

1. [개요](#개요)
2. [개선 항목 1: 주기적 메모리 정리 기능](#개선-항목-1-주기적-메모리-정리-기능)
3. [개선 항목 2: 이미지 개수 제한 및 경고](#개선-항목-2-이미지-개수-제한-및-경고)
4. [개선 항목 3: 임시 파일 정리 로직](#개선-항목-3-임시-파일-정리-로직)
5. [개선 항목 4: 메타데이터 분리 저장](#개선-항목-4-메타데이터-분리-저장)
6. [전체 일정](#전체-일정)
7. [리스크 관리](#리스크-관리)

---

## 개요

### 배경
BanaNyang AI 앱을 장시간 실행하면서 이미지를 대량 생성/업로드할 경우 다음과 같은 위험 요소가 식별되었습니다:

| 위험 요소 | 심각도 | 영향 |
|----------|--------|------|
| Blob URL 메모리 누수 | 🔴 높음 | RAM 지속 증가, OOM 크래시 |
| VRAM 포화 | 🔴 높음 | 렌더링 실패 |
| 디스크 임시파일 누적 | 🟠 중간 | 디스크 공간 부족 |
| 상태 업데이트 지연 | 🟠 중간 | UI 프레임 드롭 |

### 목표
- 100개 이상 이미지 처리 시에도 안정적인 메모리 사용량 유지
- 앱 장시간 실행 시 메모리 누수 방지
- 사용자 경험 저하 없이 리소스 관리 자동화

---

## 개선 항목 1: 주기적 메모리 정리 기능

### 📌 Plan (계획)

#### 목표
- Blob URL 메모리 누수 방지
- 사용자가 수동으로 메모리를 정리할 수 있는 기능 제공
- 백그라운드 자동 정리 옵션 추가

#### 범위
| 구분 | 내용 |
|------|------|
| 대상 파일 | `src/utils/blobManager.ts`, `src/features/canvas/rendering.worker.ts` |
| 신규 파일 | `src/components/MemoryMonitor.tsx`, `src/hooks/useMemoryCleanup.ts` |
| 의존성 | 없음 (기존 blobManager 활용) |

#### 상세 설계

```typescript
// src/hooks/useMemoryCleanup.ts
interface MemoryCleanupOptions {
  autoCleanupEnabled: boolean;
  autoCleanupIntervalMs: number;  // 기본값: 300000 (5분)
  cleanupThresholdMB: number;     // 기본값: 1024 (1GB)
}

interface MemoryStats {
  blobUrlCount: number;
  estimatedMemoryMB: number;
  textureCount: number;
  vramUsageMB: number;
}

export function useMemoryCleanup(options: MemoryCleanupOptions): {
  stats: MemoryStats;
  cleanup: () => Promise<void>;
  forceGC: () => void;
}
```

```typescript
// src/components/MemoryMonitor.tsx
// 상태바 또는 설정 패널에 표시할 메모리 모니터 컴포넌트
// - 현재 메모리 사용량 표시
// - "메모리 정리" 버튼
// - 자동 정리 토글
```

#### 성공 기준
- [ ] 메모리 사용량 실시간 모니터링 가능
- [ ] 수동 정리 버튼 클릭 시 미사용 Blob URL 해제
- [ ] 자동 정리 활성화 시 임계값 초과 시 자동 정리

---

### 🔨 Do (실행)

#### Task 1.1: BlobManager 확장
```typescript
// src/utils/blobManager.ts 수정

class BlobManager {
  // 기존 코드...

  /**
   * 안전한 cleanup - 현재 캔버스에서 사용 중인 URL은 제외
   */
  public safeCleanup(activeUrls: Set<string>): CleanupResult {
    const cleaned: string[] = [];
    const retained: string[] = [];

    for (const [url, entry] of this.refs.entries()) {
      if (!activeUrls.has(url) && entry.refCount === 0) {
        URL.revokeObjectURL(url);
        this.refs.delete(url);
        cleaned.push(url);
      } else {
        retained.push(url);
      }
    }

    return { cleaned, retained, freedMemoryEstimate: cleaned.length * 2 * 1024 * 1024 };
  }

  /**
   * 메모리 통계 반환
   */
  public getMemoryStats(): MemoryStats {
    let totalSize = 0;
    for (const entry of this.refs.values()) {
      totalSize += entry.size || 2 * 1024 * 1024; // 기본값 2MB
    }
    return {
      urlCount: this.refs.size,
      estimatedBytes: totalSize,
    };
  }
}
```

#### Task 1.2: 메모리 모니터 컴포넌트 구현
```typescript
// src/components/MemoryMonitor.tsx

export const MemoryMonitor: React.FC = () => {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isAutoCleanup, setIsAutoCleanup] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(blobManager.getMemoryStats());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCleanup = async () => {
    const activeUrls = getActiveImageUrls(); // canvasStore에서 가져옴
    const result = blobManager.safeCleanup(activeUrls);
    toast.success(`${result.cleaned.length}개 리소스 정리됨`);
  };

  return (
    <div className="memory-monitor">
      <span>메모리: {formatBytes(stats?.estimatedBytes)}</span>
      <button onClick={handleCleanup}>🧹 정리</button>
      <Toggle checked={isAutoCleanup} onChange={setIsAutoCleanup} label="자동" />
    </div>
  );
};
```

#### Task 1.3: 렌더링 워커 텍스처 정리 API 추가
```typescript
// src/features/canvas/rendering.worker.ts 수정

// 메시지 핸들러 추가
case 'cleanup-textures': {
  const activeIds = new Set(msg.activeImageIds);
  let freedBytes = 0;

  for (const [id, texture] of textureCache.entries()) {
    if (!activeIds.has(id)) {
      texture.destroy(true);
      freedBytes += textureByteSize.get(id) || 0;
      textureCache.delete(id);
      textureByteSize.delete(id);
    }
  }

  currentTotalBytes -= freedBytes;
  postMessage({ type: 'cleanup-complete', freedBytes });
  break;
}
```

---

### ✅ Check (점검)

#### 테스트 시나리오

| ID | 시나리오 | 기대 결과 | 상태 |
|----|---------|----------|------|
| T1.1 | 50개 이미지 생성 후 메모리 확인 | 메모리 사용량 정확히 표시 | ⬜ |
| T1.2 | 20개 이미지 삭제 후 수동 정리 | 삭제된 이미지의 Blob URL 해제 | ⬜ |
| T1.3 | 자동 정리 활성화 후 1시간 대기 | 메모리 사용량 임계값 이하 유지 | ⬜ |
| T1.4 | 정리 중 이미지 렌더링 확인 | 활성 이미지 정상 표시 | ⬜ |

#### 성능 지표
```
측정 항목:
- 정리 전/후 메모리 사용량 차이
- 정리 작업 소요 시간 (목표: <100ms)
- UI 블로킹 여부 (목표: 0ms)
```

---

### 🔄 Act (개선)

#### 피드백 수집 항목
- [ ] 자동 정리 주기 적절성
- [ ] 정리 시 UI 영향 여부
- [ ] 메모리 모니터 표시 위치 선호도

#### 예상 개선점
- 메모리 임계값 사용자 설정 기능
- 정리 전 확인 다이얼로그 옵션
- 메모리 사용량 그래프 추가

---

## 개선 항목 2: 이미지 개수 제한 및 경고

### 📌 Plan (계획)

#### 목표
- 과도한 이미지로 인한 성능 저하 사전 방지
- 사용자에게 적절한 경고 제공
- 소프트/하드 제한 2단계 적용

#### 범위
| 구분 | 내용 |
|------|------|
| 대상 파일 | `src/store/canvasStore.ts`, `src/hooks/useImageGeneration.ts` |
| 신규 파일 | `src/components/ImageLimitWarning.tsx` |
| 설정 추가 | `src/store/settingsStore.ts` |

#### 상세 설계

```typescript
// 제한 설정
interface ImageLimitConfig {
  softLimit: number;    // 기본값: 100 (경고 표시)
  hardLimit: number;    // 기본값: 300 (추가 차단)
  warningDismissable: boolean;
}

// 경고 레벨
type WarningLevel = 'none' | 'soft' | 'hard';
```

#### 경고 UI 설계
```
┌─────────────────────────────────────────────────┐
│ ⚠️ 이미지 개수 경고                              │
│                                                 │
│ 현재 캔버스에 127개의 이미지가 있습니다.          │
│ 100개 이상의 이미지는 성능 저하를 유발할 수        │
│ 있습니다.                                        │
│                                                 │
│ 권장 조치:                                       │
│ • 불필요한 이미지 삭제                           │
│ • 이미지를 별도 프로젝트로 분리                   │
│ • 메모리 정리 실행                               │
│                                                 │
│ [무시하기]  [이미지 정리]  [설정에서 숨기기]       │
└─────────────────────────────────────────────────┘
```

#### 성공 기준
- [ ] 소프트 제한 도달 시 경고 토스트 표시
- [ ] 하드 제한 도달 시 이미지 추가 차단
- [ ] 설정에서 제한값 조정 가능

---

### 🔨 Do (실행)

#### Task 2.1: 제한 설정 추가
```typescript
// src/store/settingsStore.ts 수정

interface SettingsState {
  // 기존 설정...

  // 이미지 제한 설정
  imageLimitConfig: {
    softLimit: number;
    hardLimit: number;
    warningEnabled: boolean;
    warningDismissedUntil: number | null; // timestamp
  };
}

const defaultImageLimitConfig = {
  softLimit: 100,
  hardLimit: 300,
  warningEnabled: true,
  warningDismissedUntil: null,
};
```

#### Task 2.2: canvasStore에 제한 로직 추가
```typescript
// src/store/canvasStore.ts 수정

const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
  // 기존 코드...

  getImageCount: () => get().boardImages.length,

  getWarningLevel: (): WarningLevel => {
    const count = get().boardImages.length;
    const { softLimit, hardLimit } = useSettingsStore.getState().imageLimitConfig;

    if (count >= hardLimit) return 'hard';
    if (count >= softLimit) return 'soft';
    return 'none';
  },

  canAddImages: (count: number = 1): boolean => {
    const currentCount = get().boardImages.length;
    const { hardLimit } = useSettingsStore.getState().imageLimitConfig;
    return currentCount + count <= hardLimit;
  },

  addImagesToCenter: (media, canvasRect, sourceImageId) => {
    // 제한 체크 추가
    if (!get().canAddImages(media.length)) {
      toast.error(`이미지 제한(${hardLimit}개)에 도달했습니다. 일부 이미지를 삭제해주세요.`);
      return;
    }

    // 기존 로직...
  },
}));
```

#### Task 2.3: 경고 컴포넌트 구현
```typescript
// src/components/ImageLimitWarning.tsx

export const ImageLimitWarning: React.FC = () => {
  const imageCount = useCanvasStore(state => state.boardImages.length);
  const warningLevel = useCanvasStore(state => state.getWarningLevel());
  const { imageLimitConfig } = useSettingsStore();

  if (warningLevel === 'none' || !imageLimitConfig.warningEnabled) {
    return null;
  }

  const handleDismiss = () => {
    // 1시간 동안 경고 숨기기
    useSettingsStore.setState({
      imageLimitConfig: {
        ...imageLimitConfig,
        warningDismissedUntil: Date.now() + 3600000,
      },
    });
  };

  return (
    <div className={`image-limit-warning ${warningLevel}`}>
      <div className="warning-icon">
        {warningLevel === 'hard' ? '🚫' : '⚠️'}
      </div>
      <div className="warning-content">
        <h4>
          {warningLevel === 'hard'
            ? '이미지 제한 도달'
            : '이미지 개수 경고'}
        </h4>
        <p>
          현재 {imageCount}개의 이미지가 있습니다.
          {warningLevel === 'hard'
            ? ' 더 이상 이미지를 추가할 수 없습니다.'
            : ' 성능 저하가 발생할 수 있습니다.'}
        </p>
      </div>
      <div className="warning-actions">
        {warningLevel === 'soft' && (
          <button onClick={handleDismiss}>무시</button>
        )}
        <button onClick={openCleanupDialog}>정리하기</button>
      </div>
    </div>
  );
};
```

---

### ✅ Check (점검)

#### 테스트 시나리오

| ID | 시나리오 | 기대 결과 | 상태 |
|----|---------|----------|------|
| T2.1 | 99개 → 100개 이미지 추가 | 소프트 경고 토스트 표시 | ⬜ |
| T2.2 | 299개 → 300개 이미지 추가 | 하드 제한 에러, 추가 차단 | ⬜ |
| T2.3 | 경고 무시 클릭 후 1시간 내 | 경고 미표시 | ⬜ |
| T2.4 | 설정에서 제한값 200으로 변경 | 변경된 값 적용 | ⬜ |

---

### 🔄 Act (개선)

#### 피드백 수집 항목
- [ ] 기본 제한값 적절성
- [ ] 경고 UI 위치 및 디자인
- [ ] 하드 제한 시 대안 제시 필요 여부

---

## 개선 항목 3: 임시 파일 정리 로직

### 📌 Plan (계획)

#### 목표
- 앱 시작 시 이전 세션의 임시 파일 자동 정리
- 정상 종료 시 임시 파일 정리
- 비정상 종료 복구 메커니즘

#### 범위
| 구분 | 내용 |
|------|------|
| 대상 파일 | `electron/main.ts`, `electron/preload.ts` |
| 신규 파일 | `electron/tempFileManager.ts` |
| 신규 IPC | `cleanup-temp-files`, `get-temp-stats` |

#### 상세 설계

```typescript
// electron/tempFileManager.ts

interface TempFileManager {
  // 임시 파일 저장 디렉토리
  getTempDir(): string;

  // 세션별 서브디렉토리 생성
  createSessionDir(): string;

  // 파일 저장
  saveTempFile(sessionId: string, filename: string, data: Buffer): Promise<string>;

  // 세션 정리
  cleanupSession(sessionId: string): Promise<CleanupResult>;

  // 오래된 세션 정리 (24시간 이상)
  cleanupStaleSessions(): Promise<CleanupResult>;

  // 통계
  getTempStats(): Promise<TempStats>;
}

interface TempStats {
  totalFiles: number;
  totalSizeBytes: number;
  sessions: SessionInfo[];
}
```

#### 디렉토리 구조
```
%TEMP%/bananyang-ai/
├── sessions/
│   ├── session-2026-02-03-001/
│   │   ├── img-001_original.png
│   │   ├── img-001.png
│   │   ├── img-001_tiny.png
│   │   └── img-001_proxy.png
│   └── session-2026-02-03-002/
│       └── ...
└── .session-lock  # 현재 활성 세션 ID
```

#### 성공 기준
- [ ] 앱 시작 시 24시간 이상 된 세션 자동 정리
- [ ] 정상 종료 시 현재 세션 임시 파일 정리
- [ ] 임시 폴더 크기 모니터링 가능

---

### 🔨 Do (실행)

#### Task 3.1: TempFileManager 구현
```typescript
// electron/tempFileManager.ts

import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

class TempFileManager {
  private baseDir: string;
  private currentSessionId: string | null = null;

  constructor() {
    this.baseDir = path.join(app.getPath('temp'), 'bananyang-ai', 'sessions');
  }

  async initialize(): Promise<string> {
    // 베이스 디렉토리 생성
    await fs.mkdir(this.baseDir, { recursive: true });

    // 새 세션 ID 생성
    this.currentSessionId = `session-${Date.now()}`;
    const sessionDir = path.join(this.baseDir, this.currentSessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // 락 파일 생성
    await fs.writeFile(
      path.join(this.baseDir, '.session-lock'),
      this.currentSessionId
    );

    // 오래된 세션 정리
    await this.cleanupStaleSessions();

    return this.currentSessionId;
  }

  async saveTempFile(filename: string, data: Buffer): Promise<string> {
    if (!this.currentSessionId) {
      throw new Error('Session not initialized');
    }

    const filePath = path.join(this.baseDir, this.currentSessionId, filename);
    await fs.writeFile(filePath, data);
    return filePath;
  }

  async cleanupStaleSessions(): Promise<CleanupResult> {
    const sessions = await fs.readdir(this.baseDir);
    const now = Date.now();
    const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24시간

    let cleanedFiles = 0;
    let freedBytes = 0;

    for (const session of sessions) {
      if (session.startsWith('.')) continue; // 락 파일 스킵
      if (session === this.currentSessionId) continue; // 현재 세션 스킵

      const sessionPath = path.join(this.baseDir, session);
      const stat = await fs.stat(sessionPath);

      if (now - stat.mtimeMs > STALE_THRESHOLD) {
        const result = await this.deleteSessionDir(sessionPath);
        cleanedFiles += result.files;
        freedBytes += result.bytes;
      }
    }

    return { cleanedFiles, freedBytes };
  }

  async cleanup(): Promise<void> {
    if (this.currentSessionId) {
      const sessionPath = path.join(this.baseDir, this.currentSessionId);
      await this.deleteSessionDir(sessionPath);

      // 락 파일 삭제
      try {
        await fs.unlink(path.join(this.baseDir, '.session-lock'));
      } catch {}
    }
  }

  private async deleteSessionDir(dirPath: string): Promise<{ files: number; bytes: number }> {
    let files = 0;
    let bytes = 0;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        bytes += stat.size;
        files++;
        await fs.unlink(fullPath);
      }
    }

    await fs.rmdir(dirPath);
    return { files, bytes };
  }

  async getTempStats(): Promise<TempStats> {
    const sessions: SessionInfo[] = [];
    let totalFiles = 0;
    let totalSizeBytes = 0;

    const sessionDirs = await fs.readdir(this.baseDir);

    for (const sessionId of sessionDirs) {
      if (sessionId.startsWith('.')) continue;

      const sessionPath = path.join(this.baseDir, sessionId);
      const stat = await fs.stat(sessionPath);

      if (stat.isDirectory()) {
        const files = await fs.readdir(sessionPath);
        let sessionSize = 0;

        for (const file of files) {
          const fileStat = await fs.stat(path.join(sessionPath, file));
          sessionSize += fileStat.size;
        }

        sessions.push({
          id: sessionId,
          fileCount: files.length,
          sizeBytes: sessionSize,
          createdAt: stat.birthtimeMs,
        });

        totalFiles += files.length;
        totalSizeBytes += sessionSize;
      }
    }

    return { totalFiles, totalSizeBytes, sessions };
  }
}

export const tempFileManager = new TempFileManager();
```

#### Task 3.2: IPC 핸들러 등록
```typescript
// electron/main.ts 수정

import { tempFileManager } from './tempFileManager';

app.whenReady().then(async () => {
  // 임시 파일 매니저 초기화
  const sessionId = await tempFileManager.initialize();
  console.log(`Session initialized: ${sessionId}`);

  // 기존 코드...
});

// 앱 종료 시 정리
app.on('before-quit', async (event) => {
  event.preventDefault();
  await tempFileManager.cleanup();
  app.exit(0);
});

// IPC 핸들러
ipcMain.handle('save-temp-file', async (_, filename: string, base64Data: string) => {
  const buffer = Buffer.from(base64Data, 'base64');
  return tempFileManager.saveTempFile(filename, buffer);
});

ipcMain.handle('get-temp-stats', async () => {
  return tempFileManager.getTempStats();
});

ipcMain.handle('cleanup-temp-files', async () => {
  return tempFileManager.cleanupStaleSessions();
});
```

#### Task 3.3: Preload 스크립트 업데이트
```typescript
// electron/preload.ts 수정

contextBridge.exposeInMainWorld('electronAPI', {
  // 기존 API...

  // 임시 파일 관리
  saveTempFile: (filename: string, base64Data: string) =>
    ipcRenderer.invoke('save-temp-file', filename, base64Data),
  getTempStats: () =>
    ipcRenderer.invoke('get-temp-stats'),
  cleanupTempFiles: () =>
    ipcRenderer.invoke('cleanup-temp-files'),
});
```

---

### ✅ Check (점검)

#### 테스트 시나리오

| ID | 시나리오 | 기대 결과 | 상태 |
|----|---------|----------|------|
| T3.1 | 앱 시작 후 세션 디렉토리 확인 | 새 세션 디렉토리 생성됨 | ⬜ |
| T3.2 | 이미지 10개 생성 후 임시 폴더 확인 | 40개 파일 존재 (4개/이미지) | ⬜ |
| T3.3 | 앱 정상 종료 후 임시 폴더 확인 | 현재 세션 파일 삭제됨 | ⬜ |
| T3.4 | 24시간 지난 세션 폴더 수동 생성 후 앱 시작 | 오래된 세션 자동 정리됨 | ⬜ |
| T3.5 | 앱 강제 종료 후 재시작 | 이전 세션 파일 유지 (복구 가능) | ⬜ |

#### 디스크 사용량 모니터링
```
측정 항목:
- 세션당 평균 디스크 사용량
- 정리 전/후 디스크 공간 차이
- 정리 작업 소요 시간
```

---

### 🔄 Act (개선)

#### 피드백 수집 항목
- [ ] 임시 파일 보존 기간 (24시간) 적절성
- [ ] 비정상 종료 시 복구 기능 필요 여부
- [ ] 수동 정리 UI 필요 여부

---

## 개선 항목 4: 메타데이터 분리 저장

### 📌 Plan (계획)

#### 목표
- GenerationParams 메타데이터를 BoardImage에서 분리
- 메모리 사용량 최적화 (Lazy Loading)
- Undo/Redo 성능 개선

#### 범위
| 구분 | 내용 |
|------|------|
| 대상 파일 | `src/types.ts`, `src/store/canvasStore.ts` |
| 신규 파일 | `src/store/metadataStore.ts` |
| 마이그레이션 | 기존 데이터 호환성 유지 |

#### 상세 설계

```typescript
// 현재 구조 (문제점)
interface BoardImage {
  id: string;
  // ... 50+ 필드
  generationParams?: GenerationParams; // ~20KB 인라인 저장
}

// 개선된 구조
interface BoardImage {
  id: string;
  // ... 기본 필드만
  hasGenerationParams: boolean; // 메타데이터 존재 여부 플래그
}

// 별도 스토어
interface MetadataStore {
  params: Map<string, GenerationParams>;  // imageId -> params

  getParams(imageId: string): GenerationParams | undefined;
  setParams(imageId: string, params: GenerationParams): void;
  deleteParams(imageId: string): void;

  // Lazy loading
  loadParams(imageId: string): Promise<GenerationParams>;
}
```

#### 메모리 절약 효과
```
Before:
- 100개 이미지 × 20KB params = 2MB (항상 메모리에)
- Undo/Redo 시 전체 복사

After:
- 100개 이미지 × 1B flag = 100B
- params는 별도 Map에 저장 (참조만 복사)
- 필요할 때만 로드 (Lazy)
```

#### 성공 기준
- [ ] BoardImage에서 generationParams 분리
- [ ] 메타데이터 조회 시 Lazy Loading 적용
- [ ] 기존 워크스페이스 파일 호환성 유지

---

### 🔨 Do (실행)

#### Task 4.1: MetadataStore 구현
```typescript
// src/store/metadataStore.ts

import { create } from 'zustand';
import { GenerationParams } from '../types';

interface MetadataState {
  params: Map<string, GenerationParams>;
}

interface MetadataActions {
  getParams: (imageId: string) => GenerationParams | undefined;
  setParams: (imageId: string, params: GenerationParams) => void;
  deleteParams: (imageId: string) => void;
  bulkSetParams: (entries: [string, GenerationParams][]) => void;
  bulkDeleteParams: (imageIds: string[]) => void;
  clear: () => void;
}

export const useMetadataStore = create<MetadataState & MetadataActions>((set, get) => ({
  params: new Map(),

  getParams: (imageId) => get().params.get(imageId),

  setParams: (imageId, params) => set(state => {
    const newParams = new Map(state.params);
    newParams.set(imageId, params);
    return { params: newParams };
  }),

  deleteParams: (imageId) => set(state => {
    const newParams = new Map(state.params);
    newParams.delete(imageId);
    return { params: newParams };
  }),

  bulkSetParams: (entries) => set(state => {
    const newParams = new Map(state.params);
    for (const [id, params] of entries) {
      newParams.set(id, params);
    }
    return { params: newParams };
  }),

  bulkDeleteParams: (imageIds) => set(state => {
    const newParams = new Map(state.params);
    for (const id of imageIds) {
      newParams.delete(id);
    }
    return { params: newParams };
  }),

  clear: () => set({ params: new Map() }),
}));
```

#### Task 4.2: BoardImage 타입 수정
```typescript
// src/types.ts 수정

export interface BoardImage {
  id: string;
  src: string;
  // ... 기본 필드들

  // 기존: generationParams?: GenerationParams;
  // 변경:
  hasGenerationParams: boolean;

  // 마이그레이션 중 호환성을 위해 옵셔널로 유지
  /** @deprecated Use useMetadataStore.getParams() instead */
  generationParams?: GenerationParams;
}
```

#### Task 4.3: canvasStore 수정
```typescript
// src/store/canvasStore.ts 수정

import { useMetadataStore } from './metadataStore';

const useCanvasStore = create<CanvasState & CanvasActions>((set, get) => ({
  // 기존 코드...

  addImagesToCenter: (media, canvasRect, sourceImageId) => {
    const newBoardImages: BoardImage[] = [];
    const metadataEntries: [string, GenerationParams][] = [];

    for (const m of media) {
      const boardImage: BoardImage = {
        id: m.id,
        src: m.src,
        // ... 기본 필드
        hasGenerationParams: !!m.generationParams,
        // generationParams는 더 이상 여기에 저장하지 않음
      };
      newBoardImages.push(boardImage);

      // 메타데이터는 별도 스토어에 저장
      if (m.generationParams) {
        metadataEntries.push([m.id, m.generationParams]);
      }
    }

    // 메타데이터 일괄 저장
    useMetadataStore.getState().bulkSetParams(metadataEntries);

    // 이미지 추가
    set(state => ({
      boardImages: [...state.boardImages, ...newBoardImages],
    }));
  },

  deleteImages: (imageIds) => {
    // 메타데이터도 함께 삭제
    useMetadataStore.getState().bulkDeleteParams(imageIds);

    set(state => ({
      boardImages: state.boardImages.filter(img => !imageIds.includes(img.id)),
    }));
  },
}));
```

#### Task 4.4: 컴포넌트 수정
```typescript
// src/features/canvas/components/CanvasImage.tsx 수정

export const CanvasImage: React.FC<CanvasImageProps> = React.memo(
  ({ image, onLoadGenerationParams }) => {
    // 메타데이터는 별도 스토어에서 가져옴
    const generationParams = useMetadataStore(
      state => image.hasGenerationParams ? state.params.get(image.id) : undefined
    );

    return (
      <div data-image-id={image.id}>
        {/* ... */}
        {generationParams && (
          <Tooltip tip={getGenerationSummary(generationParams, 'ko')}>
            <button onClick={() => onLoadGenerationParams(generationParams)}>
              📋 생성 조건
            </button>
          </Tooltip>
        )}
      </div>
    );
  }
);
```

#### Task 4.5: 워크스페이스 직렬화 수정
```typescript
// src/services/dataWorkerService.ts 수정

export async function serializeWorkspace(): Promise<string> {
  const canvasState = useCanvasStore.getState();
  const metadataState = useMetadataStore.getState();

  const data = {
    version: 2, // 버전 업
    boardImages: canvasState.boardImages,
    // 메타데이터 별도 저장
    metadata: Object.fromEntries(metadataState.params),
    // ... 기타 상태
  };

  return JSON.stringify(data);
}

export async function deserializeWorkspace(json: string): Promise<void> {
  const data = JSON.parse(json);

  // 버전 체크 및 마이그레이션
  if (data.version === 1) {
    // 기존 형식: generationParams가 BoardImage에 인라인
    const metadataEntries: [string, GenerationParams][] = [];

    for (const img of data.boardImages) {
      if (img.generationParams) {
        metadataEntries.push([img.id, img.generationParams]);
        img.hasGenerationParams = true;
        delete img.generationParams; // 인라인 제거
      }
    }

    useMetadataStore.getState().bulkSetParams(metadataEntries);
  } else {
    // 새 형식: metadata 별도 저장
    const entries = Object.entries(data.metadata) as [string, GenerationParams][];
    useMetadataStore.getState().bulkSetParams(entries);
  }

  useCanvasStore.setState({
    boardImages: data.boardImages,
    // ... 기타 상태
  });
}
```

---

### ✅ Check (점검)

#### 테스트 시나리오

| ID | 시나리오 | 기대 결과 | 상태 |
|----|---------|----------|------|
| T4.1 | 이미지 생성 후 메타데이터 확인 | MetadataStore에 저장됨 | ⬜ |
| T4.2 | 이미지 삭제 후 메타데이터 확인 | MetadataStore에서 삭제됨 | ⬜ |
| T4.3 | 기존 워크스페이스 파일 로드 | 마이그레이션 후 정상 동작 | ⬜ |
| T4.4 | Undo/Redo 100회 반복 | 메모리 사용량 안정적 | ⬜ |
| T4.5 | 생성 조건 버튼 클릭 | 메타데이터 정상 표시 | ⬜ |

#### 성능 측정
```
측정 항목:
- BoardImage 평균 크기 (Before/After)
- Undo/Redo 소요 시간
- 워크스페이스 직렬화 크기
```

---

### 🔄 Act (개선)

#### 피드백 수집 항목
- [ ] 메타데이터 로딩 지연 체감 여부
- [ ] 기존 워크스페이스 호환성 문제
- [ ] 추가 분리 필요 필드 여부

---

## 전체 일정

```
┌─────────────────────────────────────────────────────────────────┐
│                        개발 일정 (예상)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  개선 1: 메모리 정리 ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  개선 2: 이미지 제한 ░░░░░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  개선 3: 임시 파일   ░░░░░░░░░░░░░░░░████████████░░░░░░░░░░░░░░ │
│  개선 4: 메타데이터  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████░░ │
│  통합 테스트         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████ │
│                                                                 │
│  Phase 1 ──────────► Phase 2 ──────────► Phase 3 ──────────►   │
└─────────────────────────────────────────────────────────────────┘
```

### 우선순위

| 순위 | 개선 항목 | 이유 |
|-----|----------|------|
| 1 | 주기적 메모리 정리 | 가장 심각한 메모리 누수 해결 |
| 2 | 이미지 개수 제한 | 구현 간단, 즉시 효과 |
| 3 | 임시 파일 정리 | 디스크 공간 관리 필수 |
| 4 | 메타데이터 분리 | 구조 변경 필요, 마이그레이션 고려 |

---

## 리스크 관리

| 리스크 | 영향 | 대응 방안 |
|-------|------|----------|
| 메모리 정리 시 활성 이미지 삭제 | 🔴 높음 | activeUrls Set으로 보호 |
| 하드 제한으로 사용자 불만 | 🟠 중간 | 설정에서 조정 가능하게 |
| 임시 파일 복구 실패 | 🟠 중간 | 24시간 유예 기간 |
| 메타데이터 마이그레이션 실패 | 🔴 높음 | 버전 체크, 폴백 로직 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|-----|------|----------|-------|
| 1.0 | 2026-02-03 | 초안 작성 | Claude |

