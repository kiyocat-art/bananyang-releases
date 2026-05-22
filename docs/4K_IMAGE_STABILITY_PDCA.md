# 4K 이미지 연속 생성 시 앱 크래시 해결 PDCA 플랜

## 현상 분석

### 관찰된 증상
- 4K 이미지 연속 생성 중 앱이 중지됨
- DevTools 메시지: "Debugging connection was closed - Render process gone"
- VRAM 사용량 급격한 증가 후 크래시
- Worker가 텍스처 정리 중에도 크래시 발생

### 로그 분석 (스크린샷 기반)
```
[Worker] Cleaned 160 textures, freed -475.0 MB VRAM
[ViewportCleanup] Released 102 off-screen blobs (-7.1MB)
[BlobManager] Allocated: -11.77MB (total: 175 URLs)
```

### 크래시 원인 추정
1. **GPU VRAM 고갈**: 4K 이미지 1장 = ~64MB VRAM (4096x4096x4 RGBA)
2. **렌더러 프로세스 OOM**: Chromium 렌더러 메모리 한계 초과
3. **텍스처 업로드 병목**: 동시 다수 4K 텍스처 GPU 업로드 시 병목
4. **GC 지연**: Blob URL 해제 후 실제 메모리 반환 지연

---

## PDCA 사이클

### Phase 1: Plan (계획)

#### 1.1 근본 원인 진단 도구 구현
| 항목 | 설명 | 우선순위 |
|------|------|----------|
| GPU VRAM 실시간 모니터링 | 작업관리자 수준의 정확한 VRAM 추적 | ✅ 완료 |
| 렌더러 메모리 추적 | `performance.memory` API 활용 | 높음 |
| 텍스처 업로드 큐 모니터링 | PixiJS 텍스처 업로드 상태 추적 | 높음 |
| 크래시 직전 상태 덤프 | 크래시 전 메모리 스냅샷 저장 | 중간 |

#### 1.2 예방 메커니즘 설계
| 기능 | 설명 | 예상 효과 |
|------|------|----------|
| VRAM 사용량 기반 생성 제한 | VRAM 80% 초과 시 생성 일시 중지 | 크래시 방지 |
| 적응형 LOD 강제 전환 | VRAM 압박 시 FULL→PREVIEW 자동 전환 | 메모리 확보 |
| 텍스처 업로드 속도 제한 | 동시 업로드 수 제한 (예: 2개) | GPU 병목 방지 |
| 생성 간 쿨다운 | 연속 생성 시 최소 대기 시간 | 메모리 정리 시간 확보 |

#### 1.3 목표 지표
- 4K 이미지 연속 50장 생성 시 크래시 0회
- VRAM 사용량 최대 80% 유지
- 생성 후 10초 내 메모리 안정화

---

### Phase 2: Do (실행)

#### 2.1 즉시 구현 항목 (긴급)

##### A. VRAM 사용량 기반 생성 제어
```typescript
// 구현 위치: src/hooks/useImageGeneration.ts
interface VRAMGuard {
  maxVRAMUsagePercent: 80;  // VRAM 80% 초과 시 대기
  cooldownMs: 2000;          // 생성 후 최소 2초 대기
  maxConcurrent4K: 1;        // 동시 4K 생성 1개 제한
}
```

##### B. 텍스처 업로드 큐 시스템
```typescript
// 구현 위치: src/features/canvas/rendering.worker.ts
interface TextureUploadQueue {
  maxConcurrentUploads: 2;   // 동시 GPU 업로드 2개
  uploadDelayMs: 100;        // 업로드 간 100ms 간격
  priorityQueue: boolean;    // 뷰포트 내 이미지 우선
}
```

##### C. 긴급 메모리 해제 트리거
```typescript
// 구현 위치: src/hooks/useMemoryCleanup.ts
interface EmergencyCleanup {
  vramThresholdPercent: 85;  // VRAM 85% 초과 시 긴급 정리
  forceDownscale: true;      // 화면 밖 이미지 강제 축소
  flushGPU: true;            // WebGL 컨텍스트 flush
}
```

#### 2.2 단계별 구현 순서

```
Week 1: 진단 및 모니터링
├── [x] GPU VRAM 실시간 모니터링 (완료)
├── [ ] 렌더러 프로세스 메모리 추적
├── [ ] 크래시 직전 상태 로깅
└── [ ] 메모리 압박 경고 UI

Week 2: 예방 메커니즘
├── [ ] VRAM 기반 생성 제어
├── [ ] 텍스처 업로드 큐 시스템
├── [ ] 적응형 LOD 강제 전환
└── [ ] 생성 쿨다운 시스템

Week 3: 안정화 및 테스트
├── [ ] 스트레스 테스트 (100장 연속 생성)
├── [ ] 메모리 누수 프로파일링
├── [ ] 엣지 케이스 처리
└── [ ] 성능 최적화
```

---

### Phase 3: Check (점검)

#### 3.1 테스트 시나리오
| 테스트 | 조건 | 성공 기준 |
|--------|------|-----------|
| 연속 생성 테스트 | 4K 이미지 50장 연속 생성 | 크래시 0회 |
| VRAM 한계 테스트 | VRAM 90% 도달 유도 | 자동 정리 작동 |
| 장시간 사용 테스트 | 2시간 연속 작업 | 메모리 누수 없음 |
| 빠른 생성 테스트 | 1초 간격 10장 생성 | 큐잉 정상 작동 |

#### 3.2 모니터링 메트릭
```typescript
interface StabilityMetrics {
  // 실시간 모니터링
  vramUsagePercent: number;
  rendererMemoryMB: number;
  activeTextureCount: number;
  pendingUploadCount: number;

  // 세션 통계
  totalImagesGenerated: number;
  cleanupTriggerCount: number;
  nearCrashEventCount: number;  // VRAM > 90% 발생 횟수
}
```

#### 3.3 성공 지표
- [ ] VRAM 사용량 80% 이하 유지율 95% 이상
- [ ] 연속 생성 시 크래시율 0%
- [ ] 메모리 정리 후 5초 내 안정화
- [ ] 사용자 체감 지연 500ms 이하

---

### Phase 4: Act (개선)

#### 4.1 피드백 루프
```
모니터링 → 이상 감지 → 자동 조치 → 로깅 → 분석 → 개선
     ↑                                              ↓
     └──────────────────────────────────────────────┘
```

#### 4.2 단계적 개선 계획
| 버전 | 개선 사항 | 예상 효과 |
|------|-----------|-----------|
| v1.0 | VRAM 모니터링 + 경고 | 사용자 인지 |
| v1.1 | 생성 제어 + 쿨다운 | 크래시 80% 감소 |
| v1.2 | 텍스처 큐 + 적응형 LOD | 크래시 95% 감소 |
| v2.0 | 예측 기반 선제적 정리 | 크래시 99% 감소 |

#### 4.3 장기 아키텍처 개선
1. **WebGPU 마이그레이션**: 더 효율적인 GPU 메모리 관리
2. **스트리밍 텍스처**: 필요 시에만 GPU 업로드
3. **타일 기반 렌더링**: 4K 이미지를 타일로 분할 렌더링
4. **오프스크린 캔버스 풀링**: Worker 메모리 재사용

---

## 구현 우선순위 매트릭스

```
긴급도 높음
    │
    │  ┌─────────────────────┐  ┌─────────────────────┐
    │  │ VRAM 기반 생성 제어  │  │ 텍스처 업로드 큐    │
    │  │ (크래시 직접 방지)   │  │ (GPU 병목 해소)     │
    │  └─────────────────────┘  └─────────────────────┘
    │
    │  ┌─────────────────────┐  ┌─────────────────────┐
    │  │ 긴급 메모리 해제    │  │ 적응형 LOD 전환     │
    │  │ (85% 초과 시)       │  │ (메모리 압박 시)    │
    │  └─────────────────────┘  └─────────────────────┘
    │
긴급도 낮음 ────────────────────────────────────────────→ 영향도 높음
```

---

## 파일별 수정 계획

| 파일 | 수정 내용 |
|------|-----------|
| `src/hooks/useImageGeneration.ts` | VRAM 체크, 생성 큐, 쿨다운 |
| `src/features/canvas/rendering.worker.ts` | 텍스처 업로드 큐, 긴급 정리 |
| `src/hooks/useMemoryCleanup.ts` | VRAM 기반 자동 정리 트리거 |
| `src/hooks/useGpuMemory.ts` | VRAM 임계값 알림 콜백 |
| `src/components/MemoryMonitor.tsx` | VRAM 경고 UI |
| `main.js` | 렌더러 크래시 복구, 메모리 덤프 |

---

## 다음 단계

1. **즉시**: 렌더러 메모리 추적 구현
2. **이번 주**: VRAM 기반 생성 제어 구현
3. **다음 주**: 텍스처 업로드 큐 시스템 구현
4. **테스트**: 50장 연속 생성 스트레스 테스트

---

---

## 추가 수정 사항 (2026-02-09)

### UI/UX 개선

#### 1. GPU 총 메모리 4GB 제한 문제 해결
- **문제**: `Win32_VideoController.AdapterRAM`은 32비트 정수로 최대 4GB만 표시
- **해결**: `nvidia-smi` 우선 사용하여 정확한 VRAM 용량 조회
- **파일**: `main.js` - `get-gpu-info` IPC 핸들러 수정

#### 2. 메모리 그래프 통합
- **변경 전**: 앱 메모리 그래프와 GPU VRAM 그래프 분리
- **변경 후**: 단일 통합 그래프로 양쪽 메모리를 동시에 표시
- **파일**:
  - `src/components/UnifiedMemoryGraph.tsx` (신규)
  - `src/components/MemoryMonitor.tsx` (수정)

#### 3. GPU 총 메모리 자동 추정
- nvidia-smi 실패 시 현재 사용량 기반으로 총 용량 추정
- 예: 7.7GB 사용 중 → 16GB로 추정 (현재값의 2배, GB 단위로 올림)

---

## Phase 2 구현 완료 (2026-02-09)

### VRAM Guard Service 구현

#### 신규 파일: `src/services/vramGuardService.ts`

VRAM 기반 생성 제어를 위한 싱글톤 서비스:

```typescript
// 주요 기능
- VRAM 80% 초과: 경고 표시
- VRAM 85% 초과: 생성 차단
- VRAM 90% 초과: 긴급 메모리 정리 트리거
- 생성 쿨다운: 기본 2초, 4K 이미지는 5초
```

#### 수정 파일: `src/hooks/useImageGeneration.ts`

생성 전 VRAM 체크 추가:
```typescript
// 생성 전 체크
const vramCheck = await vramGuard.canGenerate(resolution);
if (!vramCheck.allowed) {
    // 차단 또는 대기
}

// 생성 후 기록
vramGuard.recordGeneration(task.resolution);
```

### 구현된 안전장치

| 임계값 | 동작 |
|--------|------|
| VRAM 80% | 경고 표시 (생성 허용) |
| VRAM 85% | 생성 차단 + 사용자 알림 |
| VRAM 90% | 긴급 텍스처 정리 트리거 |
| 생성 직후 | 2초 쿨다운 (4K는 5초) |

### 긴급 정리 동작

VRAM 90% 초과 시 자동으로:
1. `canvas-cleanup-textures` 이벤트 발송 (aggressive 모드)
2. 뷰포트 밖 이미지 LOD 다운그레이드
3. 미사용 텍스처 GPU에서 해제

---

*문서 작성일: 2026-02-09*
*상태: Phase 2 완료 (VRAM 기반 생성 제어)*
