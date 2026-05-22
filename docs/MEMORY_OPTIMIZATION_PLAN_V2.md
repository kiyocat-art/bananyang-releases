# BanaNyang AI 메모리 최적화 추가 개선 계획 (V2)

> **문서 버전**: 2.1
> **작성일**: 2026-02-03
> **최종 수정**: 2026-02-03
> **방법론**: PDCA (Plan-Do-Check-Act)
> **상태**: ✅ 구현 완료

---

## 🎉 구현 완료 요약

| 개선 항목 | 상태 | 관련 파일 |
|----------|------|----------|
| 임시 파일 복구 UI | ✅ 완료 | `main.js`, `preload.js`, `electron.d.ts`, `SessionRecoveryModal.tsx`, `App.tsx` |
| 메모리 그래프 | ✅ 완료 | `useMemoryHistory.ts`, `MemoryGraph.tsx`, `MemoryMonitor.tsx` |
| 프로파일링 모드 | ✅ 완료 | `useProfilingMode.ts`, `ProfilerOverlay.tsx`, `App.tsx` |
| 이미지 압축 | ⏭️ 제외 | 사용자 요청으로 제외 |

### 사용 방법

1. **임시 파일 복구**: 앱 시작 시 복구 가능 세션 자동 감지, 모달 표시
2. **메모리 그래프**: 설정 > 일반 > 메모리 관리에서 그래프 확인
3. **프로파일링 모드**: `Ctrl+Shift+P`로 토글

---

## 📋 목차

1. [개요](#개요)
2. [개선 항목 1: 메모리 사용량 시각화 그래프](#개선-항목-1-메모리-사용량-시각화-그래프)
3. [개선 항목 2: 임시 파일 복구 UI](#개선-항목-2-임시-파일-복구-ui)
4. [개선 항목 3: 개발자 프로파일링 모드](#개선-항목-3-개발자-프로파일링-모드)
5. [~~개선 항목 4: 이미지 품질/압축 옵션~~](#개선-항목-4-이미지-품질압축-옵션) (제외)
6. [전체 일정 및 우선순위](#전체-일정-및-우선순위)
7. [리스크 관리](#리스크-관리)

---

## 개요

### 배경

V1 메모리 최적화 구현이 완료되었으나, 사용자 경험과 개발 효율성을 위한 추가 개선이 필요합니다.

### V2 개선 목표

| 개선 항목 | 우선순위 | 목표 | 상태 |
|----------|----------|------|------|
| 복구 UI | 🟠 중간 | 비정상 종료 후 작업 복구 지원 | ✅ 완료 |
| 메모리 그래프 | 🟡 낮음 | 메모리 사용 패턴 시각적 모니터링 | ✅ 완료 |
| 프로파일링 | 🟡 낮음 | 성능 병목 분석 도구 제공 | ✅ 완료 |
| ~~이미지 압축~~ | ~~🟠 중간~~ | ~~메모리 사용량 최적화 옵션~~ | ⏭️ 제외 |

---

## 개선 항목 1: 메모리 사용량 시각화 그래프

### 📌 Plan (계획)

#### 목표

- 시간에 따른 메모리 사용량 변화 시각화
- 메모리 스파이크 및 누수 패턴 식별 지원
- 정리 이벤트 표시로 효과 확인

#### 범위

| 구분 | 내용 |
|------|------|
| 대상 파일 | `src/components/MemoryMonitor.tsx` |
| 신규 파일 | `src/components/MemoryGraph.tsx`, `src/hooks/useMemoryHistory.ts` |
| 의존성 | 없음 (Canvas API 사용) |

#### 상세 설계

```typescript
// src/hooks/useMemoryHistory.ts
interface MemoryDataPoint {
  timestamp: number;
  blobMemoryMB: number;
  vramMB: number;
  imageCount: number;
  event?: 'cleanup' | 'add' | 'delete';
}

interface MemoryHistoryOptions {
  maxDataPoints: number;      // 기본값: 60 (최근 5분, 5초 간격)
  sampleIntervalMs: number;   // 기본값: 5000
}

export function useMemoryHistory(options: MemoryHistoryOptions): {
  history: MemoryDataPoint[];
  currentStats: MemoryDataPoint;
  addEvent: (event: MemoryDataPoint['event']) => void;
  clear: () => void;
}
```

```typescript
// src/components/MemoryGraph.tsx
interface MemoryGraphProps {
  history: MemoryDataPoint[];
  width?: number;
  height?: number;
  showLegend?: boolean;
  thresholds?: {
    warning: number;  // MB
    critical: number; // MB
  };
}

// 시각화 요소:
// - 라인 차트: Blob Memory (파란색), VRAM (녹색)
// - 배경 영역: 경고 구간 (노란색), 위험 구간 (빨간색)
// - 마커: 정리 이벤트 (🧹), 이미지 추가 (➕)
```

#### UI 와이어프레임

```
┌─────────────────────────────────────────────────────────────┐
│ 메모리 사용량 추이                              [5분] [1시간] │
├─────────────────────────────────────────────────────────────┤
│ 2GB ┬─────────────────────────────────────────────── 위험 ──│
│     │                                    ╱╲                 │
│ 1GB ┼─────────────────────────────────╱──╲────── 경고 ────│
│     │                    ╱╲          ╱    ╲ 🧹              │
│     │              ╱╲  ╱  ╲        ╱      ╲___             │
│ 0MB ┼─────╱╲────╱  ╲╱    ╲______╱                         │
│     └──────────────────────────────────────────────────────│
│     -5분               -2.5분               현재            │
├─────────────────────────────────────────────────────────────┤
│ ● Blob Memory  ● VRAM  🧹 정리 이벤트                       │
└─────────────────────────────────────────────────────────────┘
```

#### 성공 기준

- [ ] 최근 5분간 메모리 사용량 그래프 표시
- [ ] 정리 이벤트 마커 표시
- [ ] 경고/위험 임계값 시각적 표시
- [ ] 그래프 시간 범위 전환 (5분/1시간)

---

### 🔨 Do (실행)

#### Task 1.1: 메모리 히스토리 훅 구현

```typescript
// src/hooks/useMemoryHistory.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { blobManager } from '../utils/blobManager';
import { useCanvasStore } from '../store/canvasStore';

interface MemoryDataPoint {
  timestamp: number;
  blobMemoryMB: number;
  imageCount: number;
  event?: 'cleanup' | 'add' | 'delete';
}

interface MemoryHistoryOptions {
  maxDataPoints?: number;
  sampleIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<MemoryHistoryOptions> = {
  maxDataPoints: 60,
  sampleIntervalMs: 5000,
};

export function useMemoryHistory(options: MemoryHistoryOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [history, setHistory] = useState<MemoryDataPoint[]>([]);
  const eventQueue = useRef<MemoryDataPoint['event'][]>([]);

  // 샘플링 인터벌
  useEffect(() => {
    const sample = () => {
      const stats = blobManager.getMemoryStats();
      const imageCount = useCanvasStore.getState().boardImages.length;

      const dataPoint: MemoryDataPoint = {
        timestamp: Date.now(),
        blobMemoryMB: stats.estimatedBytes / (1024 * 1024),
        imageCount,
        event: eventQueue.current.shift(),
      };

      setHistory(prev => {
        const newHistory = [...prev, dataPoint];
        // 최대 개수 초과 시 오래된 항목 제거
        if (newHistory.length > opts.maxDataPoints) {
          return newHistory.slice(-opts.maxDataPoints);
        }
        return newHistory;
      });
    };

    // 초기 샘플
    sample();

    const interval = setInterval(sample, opts.sampleIntervalMs);
    return () => clearInterval(interval);
  }, [opts.maxDataPoints, opts.sampleIntervalMs]);

  // 이벤트 기록
  const addEvent = useCallback((event: MemoryDataPoint['event']) => {
    eventQueue.current.push(event);
  }, []);

  // 히스토리 초기화
  const clear = useCallback(() => {
    setHistory([]);
    eventQueue.current = [];
  }, []);

  const currentStats = history[history.length - 1] || {
    timestamp: Date.now(),
    blobMemoryMB: 0,
    imageCount: 0,
  };

  return { history, currentStats, addEvent, clear };
}
```

#### Task 1.2: 메모리 그래프 컴포넌트 구현

```typescript
// src/components/MemoryGraph.tsx

import React, { useRef, useEffect, useMemo } from 'react';

interface MemoryDataPoint {
  timestamp: number;
  blobMemoryMB: number;
  imageCount: number;
  event?: 'cleanup' | 'add' | 'delete';
}

interface MemoryGraphProps {
  history: MemoryDataPoint[];
  width?: number;
  height?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export const MemoryGraph: React.FC<MemoryGraphProps> = ({
  history,
  width = 300,
  height = 120,
  warningThreshold = 1024,
  criticalThreshold = 2048,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 최대값 계산 (Y축 스케일링용)
  const maxValue = useMemo(() => {
    const dataMax = Math.max(...history.map(d => d.blobMemoryMB), 0);
    return Math.max(dataMax * 1.2, criticalThreshold);
  }, [history, criticalThreshold]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 배경 클리어
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 10, right: 10, bottom: 20, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 경고/위험 구간 배경
    const warningY = padding.top + chartHeight * (1 - warningThreshold / maxValue);
    const criticalY = padding.top + chartHeight * (1 - criticalThreshold / maxValue);

    // 위험 구간 (빨간색)
    ctx.fillStyle = 'rgba(248, 113, 113, 0.1)';
    ctx.fillRect(padding.left, padding.top, chartWidth, criticalY - padding.top);

    // 경고 구간 (노란색)
    ctx.fillStyle = 'rgba(250, 204, 21, 0.1)';
    ctx.fillRect(padding.left, criticalY, chartWidth, warningY - criticalY);

    // 임계선 그리기
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, criticalY);
    ctx.lineTo(width - padding.right, criticalY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.beginPath();
    ctx.moveTo(padding.left, warningY);
    ctx.lineTo(width - padding.right, warningY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 데이터 라인 그리기
    const timeRange = history[history.length - 1].timestamp - history[0].timestamp;

    ctx.beginPath();
    ctx.strokeStyle = '#60a5fa'; // 파란색
    ctx.lineWidth = 2;

    history.forEach((point, i) => {
      const x = padding.left + (point.timestamp - history[0].timestamp) / timeRange * chartWidth;
      const y = padding.top + chartHeight * (1 - point.blobMemoryMB / maxValue);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 이벤트 마커 그리기
    history.forEach((point) => {
      if (!point.event) return;

      const x = padding.left + (point.timestamp - history[0].timestamp) / timeRange * chartWidth;
      const y = padding.top + chartHeight * (1 - point.blobMemoryMB / maxValue);

      ctx.fillStyle = point.event === 'cleanup' ? '#4ade80' : '#f87171';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Y축 레이블
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(maxValue)}MB`, padding.left - 4, padding.top + 10);
    ctx.fillText('0MB', padding.left - 4, height - padding.bottom);

    // X축 레이블
    ctx.textAlign = 'center';
    const timeSpanMin = timeRange / 60000;
    ctx.fillText(`-${timeSpanMin.toFixed(0)}분`, padding.left, height - 4);
    ctx.fillText('현재', width - padding.right, height - 4);

  }, [history, width, height, maxValue, warningThreshold, criticalThreshold]);

  if (history.length < 2) {
    return (
      <div style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        color: '#666',
        fontSize: 12
      }}>
        데이터 수집 중...
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, borderRadius: 8 }}
    />
  );
};

export default MemoryGraph;
```

#### Task 1.3: MemoryMonitor에 그래프 통합

```typescript
// src/components/MemoryMonitor.tsx 수정

import { MemoryGraph } from './MemoryGraph';
import { useMemoryHistory } from '../hooks/useMemoryHistory';

// MemoryMonitor 컴포넌트 내부에 추가:
export const MemoryMonitor: React.FC<MemoryMonitorProps> = ({ compact }) => {
  const { history, addEvent } = useMemoryHistory();

  const handleCleanup = async () => {
    // ... 기존 정리 로직
    addEvent('cleanup'); // 정리 이벤트 기록
  };

  // ... 기존 코드

  return (
    <div>
      {/* 기존 UI */}

      {!compact && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
            메모리 사용량 추이
          </div>
          <MemoryGraph
            history={history}
            width={280}
            height={100}
          />
        </div>
      )}
    </div>
  );
};
```

---

### ✅ Check (점검)

#### 테스트 시나리오

| ID | 시나리오 | 기대 결과 | 상태 |
|----|---------|----------|------|
| T1.1 | 앱 시작 후 5분 대기 | 그래프에 60개 데이터 포인트 표시 | ⬜ |
| T1.2 | 메모리 정리 실행 | 그래프에 정리 마커(🧹) 표시 | ⬜ |
| T1.3 | 이미지 100개 생성 | 그래프 상승 곡선 표시 | ⬜ |
| T1.4 | 경고 임계값 초과 | 노란색 배경 영역 진입 | ⬜ |

---

### 🔄 Act (개선)

#### 향후 개선 방향

- [ ] 그래프 줌/패닝 기능
- [ ] 데이터 내보내기 (CSV)
- [ ] 알림 임계값 설정

---

## 개선 항목 2: 임시 파일 복구 UI

### 📌 Plan (계획)

#### 목표

- 비정상 종료 후 이전 세션 작업 복구 지원
- 복구 가능한 세션 목록 및 미리보기 제공
- 선택적 복구 기능

#### 범위

| 구분 | 내용 |
|------|------|
| 대상 파일 | `main.js`, `App.tsx` |
| 신규 파일 | `src/components/SessionRecoveryModal.tsx` |
| 신규 IPC | `get-recoverable-sessions`, `recover-session` |

#### 상세 설계

```typescript
// IPC 인터페이스
interface RecoverableSession {
  id: string;
  createdAt: number;
  fileCount: number;
  sizeBytes: number;
  thumbnails: string[];  // Base64 미리보기 (최대 4개)
  workspaceFile?: string; // 자동저장된 워크스페이스 파일 경로
}

interface SessionRecoveryResult {
  success: boolean;
  restoredImages: number;
  workspacePath?: string;
  error?: string;
}
```

#### UI 와이어프레임

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ 이전 작업 복구                                      [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 비정상 종료된 세션이 감지되었습니다.                          │
│ 아래 세션에서 작업을 복구할 수 있습니다.                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📂 세션 2026-02-03 14:32                               │ │
│ │    ├ 이미지 45개 (128.5 MB)                            │ │
│ │    ├ 생성 시간: 2시간 전                                │ │
│ │    │                                                   │ │
│ │    │ ┌────┐ ┌────┐ ┌────┐ ┌────┐                      │ │
│ │    │ │ 🖼 │ │ 🖼 │ │ 🖼 │ │ +41│                      │ │
│ │    │ └────┘ └────┘ └────┘ └────┘                      │ │
│ │    │                                                   │ │
│ │    └ [🗑️ 삭제]  [📂 복구]                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📂 세션 2026-02-02 09:15                               │ │
│ │    ├ 이미지 12개 (34.2 MB)                             │ │
│ │    └ 생성 시간: 1일 전                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                              [모두 삭제]  [선택 복구]        │
└─────────────────────────────────────────────────────────────┘
```

#### 성공 기준

- [ ] 앱 시작 시 복구 가능 세션 자동 감지
- [ ] 세션별 썸네일 미리보기 표시
- [ ] 선택한 세션 복구 시 캔버스에 이미지 로드
- [ ] 복구 후 임시 파일 자동 정리

---

### 🔨 Do (실행)

#### Task 2.1: main.js에 복구 IPC 추가

```javascript
// main.js 추가

// 복구 가능한 세션 목록 조회
ipcMain.handle('get-recoverable-sessions', async () => {
  try {
    const sessionsDir = path.join(TEMP_DIR, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      return { success: true, sessions: [] };
    }

    const sessionDirs = fs.readdirSync(sessionsDir)
      .filter(name => name.startsWith('session-') && name !== currentSessionId);

    const sessions = [];

    for (const sessionId of sessionDirs) {
      const sessionPath = path.join(sessionsDir, sessionId);
      const stat = fs.statSync(sessionPath);

      if (!stat.isDirectory()) continue;

      const files = fs.readdirSync(sessionPath);
      const imageFiles = files.filter(f =>
        f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')
      );

      // 썸네일 생성 (tiny 파일 우선, 없으면 일반 파일)
      const thumbnails = [];
      const tinyFiles = files.filter(f => f.includes('_tiny'));
      const previewFiles = tinyFiles.length > 0 ? tinyFiles : imageFiles;

      for (const file of previewFiles.slice(0, 4)) {
        try {
          const filePath = path.join(sessionPath, file);
          const base64 = fs.readFileSync(filePath).toString('base64');
          const ext = path.extname(file).slice(1);
          thumbnails.push(`data:image/${ext};base64,${base64}`);
        } catch (e) {
          // Skip failed thumbnails
        }
      }

      // 워크스페이스 자동저장 파일 확인
      const workspaceFile = files.find(f => f.endsWith('.bny.autosave'));

      // 세션 크기 계산
      let totalSize = 0;
      for (const file of files) {
        try {
          const fileStat = fs.statSync(path.join(sessionPath, file));
          totalSize += fileStat.size;
        } catch (e) {}
      }

      sessions.push({
        id: sessionId,
        createdAt: stat.birthtimeMs,
        fileCount: imageFiles.length,
        sizeBytes: totalSize,
        thumbnails,
        workspaceFile: workspaceFile ? path.join(sessionPath, workspaceFile) : null,
      });
    }

    // 최신순 정렬
    sessions.sort((a, b) => b.createdAt - a.createdAt);

    return { success: true, sessions };
  } catch (error) {
    return { success: false, error: error.message, sessions: [] };
  }
});

// 세션 복구
ipcMain.handle('recover-session', async (_, sessionId) => {
  try {
    const sessionPath = path.join(TEMP_DIR, 'sessions', sessionId);

    if (!fs.existsSync(sessionPath)) {
      return { success: false, error: 'Session not found' };
    }

    const files = fs.readdirSync(sessionPath);

    // 워크스페이스 파일이 있으면 반환
    const workspaceFile = files.find(f => f.endsWith('.bny.autosave'));
    if (workspaceFile) {
      const workspacePath = path.join(sessionPath, workspaceFile);
      const content = fs.readFileSync(workspacePath, 'utf-8');

      return {
        success: true,
        workspaceContent: content,
        restoredImages: 0,
      };
    }

    // 이미지 파일만 반환 (클라이언트에서 로드)
    const imageFiles = files.filter(f =>
      (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) &&
      !f.includes('_tiny') && !f.includes('_proxy')
    );

    const images = [];
    for (const file of imageFiles) {
      const filePath = path.join(sessionPath, file);
      images.push({
        filename: file,
        path: filePath,
        url: `file:///${filePath.replace(/\\/g, '/')}`,
      });
    }

    return {
      success: true,
      images,
      restoredImages: images.length,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 세션 삭제
ipcMain.handle('delete-session', async (_, sessionId) => {
  try {
    const sessionPath = path.join(TEMP_DIR, 'sessions', sessionId);

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

#### Task 2.2: preload.js 업데이트

```javascript
// preload.js 추가
getRecoverableSessions: () => ipcRenderer.invoke('get-recoverable-sessions'),
recoverSession: (sessionId) => ipcRenderer.invoke('recover-session', sessionId),
deleteSession: (sessionId) => ipcRenderer.invoke('delete-session', sessionId),
```

#### Task 2.3: 타입 정의 업데이트

```typescript
// src/electron.d.ts 추가

interface RecoverableSession {
  id: string;
  createdAt: number;
  fileCount: number;
  sizeBytes: number;
  thumbnails: string[];
  workspaceFile: string | null;
}

interface IElectronAPI {
  // ... 기존 API

  getRecoverableSessions: () => Promise<{
    success: boolean;
    sessions: RecoverableSession[];
    error?: string;
  }>;

  recoverSession: (sessionId: string) => Promise<{
    success: boolean;
    workspaceContent?: string;
    images?: Array<{ filename: string; path: string; url: string }>;
    restoredImages: number;
    error?: string;
  }>;

  deleteSession: (sessionId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
}
```

#### Task 2.4: SessionRecoveryModal 컴포넌트

```typescript
// src/components/SessionRecoveryModal.tsx

import React, { useEffect, useState } from 'react';
import { CloseIcon, TrashIcon, FolderIcon } from './icons';

interface RecoverableSession {
  id: string;
  createdAt: number;
  fileCount: number;
  sizeBytes: number;
  thumbnails: string[];
  workspaceFile: string | null;
}

interface SessionRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecover: (sessionId: string) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  if (minutes > 0) return `${minutes}분 전`;
  return '방금 전';
}

export const SessionRecoveryModal: React.FC<SessionRecoveryModalProps> = ({
  isOpen,
  onClose,
  onRecover,
}) => {
  const [sessions, setSessions] = useState<RecoverableSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getRecoverableSessions();
      if (result.success) {
        setSessions(result.sessions);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (sessionId: string) => {
    setRecovering(sessionId);
    try {
      await onRecover(sessionId);
      // 복구 성공 시 목록에서 제거
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (sessions.length === 1) {
        onClose();
      }
    } finally {
      setRecovering(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('이 세션을 삭제하시겠습니까? 복구할 수 없습니다.')) {
      return;
    }

    await window.electronAPI.deleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleDeleteAll = async () => {
    if (!confirm('모든 복구 가능한 세션을 삭제하시겠습니까?')) {
      return;
    }

    for (const session of sessions) {
      await window.electronAPI.deleteSession(session.id);
    }
    setSessions([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[400]">
      <div className="bg-zinc-900 w-[600px] max-h-[80vh] rounded-2xl flex flex-col overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold text-white">이전 작업 복구</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              복구 가능한 세션이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400 mb-4">
                비정상 종료된 세션이 감지되었습니다. 아래 세션에서 작업을 복구할 수 있습니다.
              </p>

              {sessions.map(session => (
                <div
                  key={session.id}
                  className="p-4 bg-white/5 rounded-xl border border-white/10"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FolderIcon className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-white">
                          세션 {new Date(session.createdAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-400 mt-1">
                        이미지 {session.fileCount}개 ({formatBytes(session.sizeBytes)})
                        · {formatTimeAgo(session.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Thumbnails */}
                  {session.thumbnails.length > 0 && (
                    <div className="flex gap-2 mb-3">
                      {session.thumbnails.map((thumb, i) => (
                        <div
                          key={i}
                          className="w-16 h-16 rounded-lg overflow-hidden bg-black/30"
                        >
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {session.fileCount > 4 && (
                        <div className="w-16 h-16 rounded-lg bg-black/30 flex items-center justify-center text-sm text-zinc-400">
                          +{session.fileCount - 4}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      🗑️ 삭제
                    </button>
                    <button
                      onClick={() => handleRecover(session.id)}
                      disabled={recovering === session.id}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white hover:bg-zinc-200 text-black font-medium transition-colors disabled:opacity-50"
                    >
                      {recovering === session.id ? '복구 중...' : '📂 복구'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/10">
            <button
              onClick={handleDeleteAll}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
            >
              모두 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionRecoveryModal;
```

#### Task 2.5: App.tsx에 복구 모달 통합

```typescript
// src/App.tsx 수정

import { SessionRecoveryModal } from './components/SessionRecoveryModal';

// App 컴포넌트 내부:
const [showRecoveryModal, setShowRecoveryModal] = useState(false);

// 앱 시작 시 복구 가능 세션 확인
useEffect(() => {
  const checkRecoverableSessions = async () => {
    if (!window.electronAPI?.getRecoverableSessions) return;

    const result = await window.electronAPI.getRecoverableSessions();
    if (result.success && result.sessions.length > 0) {
      setShowRecoveryModal(true);
    }
  };

  checkRecoverableSessions();
}, []);

const handleRecoverSession = async (sessionId: string) => {
  const result = await window.electronAPI.recoverSession(sessionId);

  if (result.success) {
    if (result.workspaceContent) {
      // 워크스페이스 파일 복구
      await handleLoadWorkspace(result.workspaceContent);
    } else if (result.images) {
      // 이미지 파일들 복구
      for (const img of result.images) {
        // ... 이미지 로드 로직
      }
    }

    showNotification(`${result.restoredImages}개 항목 복구됨`, 'success');
  }
};

// JSX에 추가:
<SessionRecoveryModal
  isOpen={showRecoveryModal}
  onClose={() => setShowRecoveryModal(false)}
  onRecover={handleRecoverSession}
/>
```

---

### ✅ Check (점검)

| ID | 시나리오 | 기대 결과 | 상태 |
|----|---------|----------|------|
| T2.1 | 앱 강제 종료 후 재시작 | 복구 모달 표시 | ⬜ |
| T2.2 | 세션 복구 클릭 | 캔버스에 이미지 로드 | ⬜ |
| T2.3 | 세션 삭제 클릭 | 임시 폴더에서 삭제 | ⬜ |
| T2.4 | 모두 삭제 클릭 | 모든 세션 정리 | ⬜ |

---

## 개선 항목 3: 개발자 프로파일링 모드

### 📌 Plan (계획)

#### 목표

- 성능 병목 구간 식별
- 메모리 누수 추적
- 텍스처 로딩/언로딩 모니터링

#### 범위

| 구분 | 내용 |
|------|------|
| 대상 파일 | `rendering.worker.ts`, `blobManager.ts` |
| 신규 파일 | `src/hooks/useProfilingMode.ts`, `src/components/ProfilerOverlay.tsx` |
| 활성화 | DevTools 또는 설정에서 토글 |

#### 성공 기준

- [ ] 프레임 타임 그래프 표시
- [ ] 텍스처 캐시 상태 표시
- [ ] 메모리 할당/해제 로그

---

### 🔨 Do (실행)

```typescript
// src/hooks/useProfilingMode.ts

interface ProfilerStats {
  fps: number;
  frameTime: number;
  textureCount: number;
  textureMemoryMB: number;
  blobCount: number;
  blobMemoryMB: number;
  gcEvents: number;
}

export function useProfilingMode() {
  const [enabled, setEnabled] = useState(false);
  const [stats, setStats] = useState<ProfilerStats | null>(null);

  // 프로파일링 데이터 수집
  useEffect(() => {
    if (!enabled) return;

    let lastFrameTime = performance.now();
    let frameCount = 0;

    const updateStats = () => {
      const now = performance.now();
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;
      frameCount++;

      // 1초마다 FPS 계산
      // ...
    };

    const rafId = requestAnimationFrame(function loop() {
      updateStats();
      requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return { enabled, setEnabled, stats };
}
```

---

## 개선 항목 4: 이미지 품질/압축 옵션

### 📌 Plan (계획)

#### 목표

- 사용자가 이미지 품질 vs 메모리 트레이드오프 선택 가능
- 저사양 모드에서 자동 압축 적용
- 워크스페이스 저장 시 압축 옵션

#### 범위

| 구분 | 내용 |
|------|------|
| 대상 파일 | `src/store/settingsStore.ts`, `src/utils/imageOptimization.ts` |
| 신규 파일 | 없음 (기존 파일 수정) |
| 설정 추가 | 이미지 품질 프리셋 |

#### 상세 설계

```typescript
// src/store/settingsStore.ts 추가

type ImageQualityPreset = 'high' | 'balanced' | 'performance';

interface ImageQualityConfig {
  preset: ImageQualityPreset;
  maxDisplaySize: number;      // 디스플레이용 최대 크기
  thumbnailSize: number;       // 썸네일 크기
  jpegQuality: number;         // JPEG 품질 (0-100)
  webpQuality: number;         // WebP 품질 (0-100)
  enableKtx2: boolean;         // GPU 압축 사용
}

const QUALITY_PRESETS: Record<ImageQualityPreset, ImageQualityConfig> = {
  high: {
    preset: 'high',
    maxDisplaySize: 4096,
    thumbnailSize: 256,
    jpegQuality: 95,
    webpQuality: 90,
    enableKtx2: true,
  },
  balanced: {
    preset: 'balanced',
    maxDisplaySize: 2048,
    thumbnailSize: 128,
    jpegQuality: 85,
    webpQuality: 80,
    enableKtx2: true,
  },
  performance: {
    preset: 'performance',
    maxDisplaySize: 1024,
    thumbnailSize: 64,
    jpegQuality: 75,
    webpQuality: 70,
    enableKtx2: false,
  },
};
```

#### UI 와이어프레임

```
┌─────────────────────────────────────────────────────────────┐
│ 🖼️ 이미지 품질 설정                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ○ 고품질                                                   │
│    최대 4K, KTX2 압축 사용                                  │
│    메모리 사용량: 높음                                       │
│                                                             │
│  ● 균형 (권장)                                              │
│    최대 2K, KTX2 압축 사용                                  │
│    메모리 사용량: 보통                                       │
│                                                             │
│  ○ 성능 우선                                                │
│    최대 1K, GPU 압축 미사용                                 │
│    메모리 사용량: 낮음                                       │
│                                                             │
│  ℹ️ 변경사항은 새로 추가되는 이미지에만 적용됩니다.           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 성공 기준

- [ ] 3단계 품질 프리셋 설정 가능
- [ ] 설정에 따른 이미지 리사이즈 적용
- [ ] 저사양 모드 자동 감지 시 성능 프리셋 권장

---

## 전체 일정 및 우선순위

```
┌─────────────────────────────────────────────────────────────────┐
│                        개발 일정 (예상)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  개선 1: 메모리 그래프 ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  개선 2: 복구 UI       ░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░░ │
│  개선 3: 프로파일링    ░░░░░░░░░░░░░░░░░░░░████████░░░░░░░░░░░░ │
│  개선 4: 이미지 압축   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████ │
│                                                                 │
│  Phase 1 ──────────────► Phase 2 ──────────► Phase 3 ──────────►│
└─────────────────────────────────────────────────────────────────┘
```

### 우선순위 매트릭스

| 순위 | 개선 항목 | 영향도 | 구현 난이도 | 이유 |
|-----|----------|--------|------------|------|
| 1 | 임시 파일 복구 UI | 🔴 높음 | 🟠 중간 | 사용자 데이터 보호 |
| 2 | 이미지 압축 옵션 | 🟠 중간 | 🟢 낮음 | 기존 로직 수정 |
| 3 | 메모리 그래프 | 🟢 낮음 | 🟢 낮음 | 시각적 개선 |
| 4 | 프로파일링 모드 | 🟢 낮음 | 🟠 중간 | 개발자 전용 |

---

## 리스크 관리

| 리스크 | 영향 | 대응 방안 |
|-------|------|----------|
| 그래프 성능 오버헤드 | 🟡 낮음 | requestAnimationFrame 최적화 |
| 복구 시 이미지 손상 | 🔴 높음 | 복구 전 검증 로직 추가 |
| 압축 품질 저하 불만 | 🟠 중간 | 프리셋 미리보기 제공 |
| 프로파일링 보안 이슈 | 🟡 낮음 | 개발 모드에서만 활성화 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|-----|------|----------|-------|
| 2.0 | 2026-02-03 | V2 계획 수립 | Claude |
ㅞ
