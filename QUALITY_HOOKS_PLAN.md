# Claude Forge 품질 향상 훅 — 설치 플랜

> Scope: **User 스코프 `~/.claude` 전역**  
> Pattern: **정적 게이트 + 경량 LLM 리뷰어** (full GAN 루프 X)  
> OS: **Windows PowerShell 우선**, Git Bash `.sh` 보조  
> Status: 안전망(P0~P1 Guardrails) 적용 완료 → 이 문서는 **그 위에 얹는 품질 레이어**

---

## 0. 목표와 비목표

### 목표
1. Edit/Write 직후 **정적 게이트(lint · typecheck · 관습 위반)**로 회귀 유입 차단.
2. 변경 diff가 일정 규모를 넘을 때 **경량 LLM 리뷰어(Haiku)**가 4기준 점수 + 비평 반환.
3. 컨텍스트 사용량 50% 초과 시 **세션 상태 알림** → Forge `golden-principles.md`의 "50% 원칙" 자기모순 해소.
4. 모든 훅은 **matcher 명시**해 불필요한 I/O 제거(하네스 표준 준수).

### 비목표
- Playwright MCP 기반 시각 검증 루프(영상의 9~10회차 3D 도약 케이스) — 비용/시간 과도.
- 생성자/평가자 무한 자동 반복 — 사람 확인 단계 유지.
- Project 스코프 룰(Z_INDEX, Gemini 모델명 화이트리스트 등) — 본 플랜은 전역만 다룸. 프로젝트별 룰은 `.claude/settings.json`에 따로 레이어링하도록 훅 구조를 오픈엔드로 설계.

---

## 1. 아키텍처 개요

```
Tool Call
   │
   ├─ PreToolUse (Bash)           → guardrails.ps1       [이미 적용: 안전망]
   │
   ├─ PostToolUse (Edit|Write)    → quality-gate.ps1     [P0 신규]
   │                                 ├─ detect-lang
   │                                 ├─ lint
   │                                 ├─ typecheck (필요 시)
   │                                 └─ convention-check
   │
   ├─ PostToolUse (Edit|Write)    → reviewer-trigger.ps1 [P1 신규, 샘플링]
   │                                 └─ diff 규모 임계 초과 시만
   │                                     └─ Task(code-reviewer-lite)
   │
   ├─ SessionStart                → context-budget.ps1   [P2 신규]
   │
   └─ PreCompact                  → compact-log.ps1      [P2 신규]
```

**핵심 설계 원칙**
- 훅은 **stdout JSON**으로만 소통(`{"permissionDecision": "allow|deny", "reason": "..."}`).
- 훅 내부는 **빠르고 결정론적**이어야 함(>3초 걸리는 작업은 전부 백그라운드 enqueue).
- 리뷰어 LLM 호출은 **샘플링 + 캐시**로 비용 방어.

---

## 2. 정적 게이트 (`quality-gate.ps1`)

### 2-A. 트리거 조건
- matcher: `Edit|Write` (MultiEdit 포함)
- tool_input에 `file_path`가 있을 때만 실행.
- 파일 경로가 `.gitignore`, `node_modules/**`, `dist/**`, `build/**`에 속하면 즉시 종료.

### 2-B. 언어별 체크 매트릭스

| 확장자 | Lint | Typecheck | 관습 체크 |
|---|---|---|---|
| `.ts`, `.tsx` | `eslint --max-warnings 0` | `tsc --noEmit` (workspace) | no-console, no-any 드리프트 |
| `.js`, `.jsx` | `eslint` | (N/A) | — |
| `.py` | `ruff check` | `mypy --follow-imports=silent` | — |
| `.md` | `markdownlint` (선택) | (N/A) | H1 단일성 |
| `.json` | `jq .` 파싱 검증 | (N/A) | trailing comma 탐지 |

### 2-C. 실행 정책
1. **있으면 실행, 없으면 스킵** — 프로젝트에 eslint가 없으면 lint 스킵. 전역 설치 강제 X.
2. **타임아웃 5초** — 그 이상은 `exit 0`으로 비막힘 처리 + 로그만 남김.
3. **결과 전달** — 실패 시 `permissionDecision: allow` 유지 + `reason` 필드에 경고 메시지(차단 대신 경고만. 이유: 정적 체크는 false positive 잦음).
4. **차단은 오직 "심각(critical)"일 때**: 예컨대 `tsc`가 syntax error를 찍으면 `deny`. 단순 lint warning은 통과.

### 2-D. 관습 체크 훅 포인트
이 플랜은 전역이지만, **사용자 프로젝트별 룰을 플러그인화할 수 있도록** 훅 내부에서 `~/.claude/quality-rules/*.ps1`을 디렉터리 스캔해 순회 실행. 예:
```
~/.claude/quality-rules/
  ├─ no-hardcoded-zindex.ps1   (사용자가 프로젝트별로 추가)
  ├─ no-console-log.ps1
  └─ gemini-model-whitelist.ps1
```
→ **본 플랜 범위에서는 디렉터리만 준비**, 실제 룰 파일은 사용자가 프로젝트 특성에 따라 추가.

---

## 3. 경량 LLM 리뷰어 (`reviewer-trigger.ps1` + `code-reviewer-lite` 서브에이전트)

### 3-A. 목적
영상의 **생성/평가 분리** 철학을 저비용으로 구현. 생성(메인 세션) ↔ 평가(별도 Haiku 서브에이전트)를 분리해 셀프평가 편향 제거.

### 3-B. 트리거 조건 (비용 방어)
- matcher: `Edit|Write`
- **모든 조건 동시 충족 시만 실행**:
  1. 단일 파일 diff ≥ 40 lines **또는** 누적 세션 diff ≥ 200 lines
  2. 확장자 ∈ {`.ts`, `.tsx`, `.js`, `.jsx`, `.py`}
  3. 최근 10분 내 동일 파일 리뷰 이력 없음 (쿨다운)
  4. `~/.claude/reviewer/enabled` 플래그 파일 존재 (off 스위치)

### 3-C. 리뷰어 서브에이전트 정의
파일: `~/.claude/agents/code-reviewer-lite.md`

```yaml
---
name: code-reviewer-lite
description: Lightweight code reviewer. Reviews a diff using 4 criteria and returns structured JSON. Use when triggered by quality hook.
model: haiku
tools: [Read, Grep]
---

너는 diff만 보고 평가하는 독립 리뷰어다. 생성자의 변경 의도에 동조하지 말고 비판적으로 본다.

입력:
- diff_text: 변경된 diff
- file_path: 파일 경로
- context_hint: (선택) 주변 함수/클래스 1개까지 Read로 확인 가능

출력은 반드시 다음 JSON 스키마:
{
  "quality":       { "score": 1-5, "note": "≤2문장" },
  "originality":   { "score": 1-5, "note": "≤2문장" },
  "craft":         { "score": 1-5, "note": "≤2문장" },
  "functionality": { "score": 1-5, "note": "≤2문장" },
  "verdict": "approve" | "revise" | "block",
  "top_issue": "단일 최우선 이슈 1문장"
}

규칙:
- 전체 150 토큰 이내로 답한다.
- 템플릿성 칭찬("좋은 변경입니다") 금지. score≥4에는 구체 근거 필수.
- 추측성 "~일 수 있다" 금지. diff에 근거 있는 사실만.
- `verdict: block`은 실제로 런타임 에러·보안 결함·명백한 회귀일 때만.
```

### 3-D. 리뷰 결과 라우팅
- `approve` → 콘솔 로그만.
- `revise` → 메인 세션에 **알림 메시지**로 삽입(차단 안 함). Claude가 다음 턴에 스스로 판단.
- `block` → `permissionDecision: deny` + `reason`에 `top_issue` 전달. (단, 사용자가 `/review-override` 커맨드로 덮어쓰기 가능)

### 3-E. 샘플링/캐시
- 같은 `file_path + content_hash` 조합은 **최근 10분 캐시**.
- 세션 총 리뷰 호출 수 **20회 상한** 도달 시 이후는 경고만.

---

## 4. 컨텍스트 예산 감시 (`context-budget.ps1`)

### 4-A. 문제의식
Forge `golden-principles.md`는 "컨텍스트 50% 이내 완료" 원칙을 선언하지만 프레임워크 자체가 세션 시작부터 이를 위반 중(분석 문서 P0-B 참조). 훅으로 **실측·경고**를 붙여 자기모순을 가시화.

### 4-B. 동작
- SessionStart 훅에서 **현재 로드된 rules/memory/CLAUDE.md 토큰 합산 추정치** 산출.
  - 근사: `[chars] / 3.5`
- 합산이 **세션 예산 30% 초과** → `reason`에 경고 배너 출력.
- **50% 초과** → 메인 세션에 삽입할 하드 제안 메시지:
  > "[경고] 세션 시작 컨텍스트 점유율 N%. `/compact` 또는 불필요 규칙 파일 비활성화를 권장합니다."

### 4-C. 실측 리포트
- `~/.claude/logs/context-budget.jsonl`에 누적 기록.
- 주간 리포트 커맨드 `/forge-context-report` 추가(이 플랜 범위에서는 커맨드 파일 스켈레톤만 준비).

---

## 5. 파일 구조 (설치 후)

```
~/.claude/
├── settings.json                      # 병합 패치 적용
├── hooks/
│   ├── guardrails.ps1                 # [기존]
│   ├── guardrails.sh                  # [기존]
│   ├── quality-gate.ps1               # [신규]
│   ├── quality-gate.sh                # [신규, Git Bash 폴백]
│   ├── reviewer-trigger.ps1           # [신규]
│   ├── reviewer-trigger.sh            # [신규]
│   ├── context-budget.ps1             # [신규]
│   ├── compact-log.ps1                # [신규]
│   └── lib/
│       ├── detect-lang.ps1
│       ├── run-lint.ps1
│       ├── run-typecheck.ps1
│       ├── emit-result.ps1            # JSON stdout 헬퍼
│       └── diff-stats.ps1
├── quality-rules/                     # [신규, 사용자 확장 슬롯]
│   └── .gitkeep
├── agents/
│   └── code-reviewer-lite.md          # [신규]
├── commands/
│   ├── review-override.md             # [신규] block 된 결과 덮어쓰기
│   └── forge-context-report.md        # [신규, 스켈레톤]
├── reviewer/
│   ├── enabled                        # [플래그 파일] 존재 = on
│   └── cache/                         # [런타임 캐시]
└── logs/
    ├── quality-gate.jsonl
    ├── reviewer.jsonl
    └── context-budget.jsonl
```

---

## 6. `settings.json` 병합 패치

기존 Forge `settings.json`을 **덮어쓰지 말고 병합**. `jq -s '.[0] * .[1]'` 방식(분석 문서 P2-C 참고).

병합할 블록(추가):
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "powershell -NoProfile -File ~/.claude/hooks/quality-gate.ps1" },
          { "type": "command", "command": "powershell -NoProfile -File ~/.claude/hooks/reviewer-trigger.ps1" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "powershell -NoProfile -File ~/.claude/hooks/context-budget.ps1" }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          { "type": "command", "command": "powershell -NoProfile -File ~/.claude/hooks/compact-log.ps1" }
        ]
      }
    ]
  }
}
```

**Windows + Git Bash 동시 대응**: 실제 설치 스크립트에서 `$env:TERM_PROGRAM` / `uname` 감지 후 `.ps1` 또는 `.sh` 경로 중 하나를 선택해 `command` 필드를 채움.

---

## 7. PowerShell 훅 스켈레톤 (참고)

### 7-A. `quality-gate.ps1` 골격
```powershell
# ~/.claude/hooks/quality-gate.ps1
$ErrorActionPreference = 'Stop'
$input_json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$file = $input_json.tool_input.file_path
if (-not $file) { '{"permissionDecision":"allow"}'; exit 0 }

# skip paths
if ($file -match '\\node_modules\\|\\dist\\|\\build\\|\.min\.') {
  '{"permissionDecision":"allow"}'; exit 0
}

$ext = [IO.Path]::GetExtension($file).ToLower()
$warnings = @()

switch ($ext) {
  { $_ -in '.ts','.tsx' } {
    $lintOut = & npx --no-install eslint $file 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { $warnings += "eslint: $lintOut" }
    # typecheck는 프로젝트 tsconfig 있을 때만
    if (Test-Path (Join-Path (Split-Path $file) 'tsconfig.json')) {
      & npx --no-install tsc --noEmit 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { $warnings += 'tsc: type errors (run `tsc --noEmit`)' }
    }
  }
  '.py' {
    & ruff check $file 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $warnings += 'ruff: violations' }
  }
}

# user-defined rules
Get-ChildItem ~/.claude/quality-rules/*.ps1 -ErrorAction SilentlyContinue | ForEach-Object {
  $r = & $_.FullName $file 2>&1
  if ($LASTEXITCODE -ne 0) { $warnings += "$($_.Name): $r" }
}

$decision = if ($warnings.Count -eq 0) { 'allow' } else { 'allow' }  # 경고만, 차단 X
$reason = if ($warnings.Count -gt 0) { ($warnings -join "`n") } else { '' }

@{ permissionDecision = $decision; reason = $reason } | ConvertTo-Json -Compress
```

### 7-B. `reviewer-trigger.ps1` 골격
```powershell
# 핵심: 조건 판정 후 Task 도구로 subagent 스폰 요청을 stdout 메시지로 전달
$in = [Console]::In.ReadToEnd() | ConvertFrom-Json
$file = $in.tool_input.file_path

$diffSize = (Get-DiffLineCount $file)   # lib/diff-stats.ps1
$shouldReview = $diffSize -ge 40 -and (Test-Path ~/.claude/reviewer/enabled)
if (-not $shouldReview) { '{"permissionDecision":"allow"}'; exit 0 }

# 캐시 체크
$hash = Get-FileHash $file -Algorithm SHA1
$cacheFile = "~/.claude/reviewer/cache/$($hash.Hash).json"
if (Test-Path $cacheFile -NewerThan (Get-Date).AddMinutes(-10)) {
  '{"permissionDecision":"allow"}'; exit 0
}

# 메인 세션에 리뷰 요청 주입
$msg = "code-reviewer-lite 서브에이전트로 다음 diff 리뷰: $file"
@{
  permissionDecision = 'allow'
  reason = $msg
  hookSpecificOutput = @{ suggestSubagent = 'code-reviewer-lite' }
} | ConvertTo-Json -Compress
```

> 주의: 현 Claude Code 훅 스펙상 **훅에서 직접 서브에이전트를 스폰할 수는 없음**. 따라서 실제 구현은 `reason` 필드에 힌트 문자열을 실어 Claude가 다음 턴에 Task 툴을 자발적으로 호출하도록 유도하는 방식. 이 제약은 실험 단계(8-B)에서 검증 필요 항목.

---

## 8. 단계별 롤아웃

### Phase 1 — 정적 게이트 (1주차)
1. `quality-gate.ps1` + `.sh` 작성, matcher `Edit|Write` 등록.
2. `~/.claude/quality-rules/` 디렉터리 생성.
3. settings.json 병합 스크립트로 훅 등록.
4. **검증**: 의도적 lint 위반 커밋 유도 → `reason` 경고 관찰.

### Phase 2 — 경량 리뷰어 (2주차)
1. `code-reviewer-lite.md` 에이전트 추가.
2. `reviewer-trigger.ps1` + 캐시 디렉터리.
3. 플래그 파일 `~/.claude/reviewer/enabled` 기본 OFF로 출하.
4. **검증**: 40줄 이상 diff 만들고 수동 ON → Task 툴이 code-reviewer-lite 호출 유도되는지 확인 → 제약(7-B 주의 참조) 실측. 직접 스폰 불가 시 대체안: PostToolUse에서 diff만 캐시 후, 메인 세션에 서브에이전트 요청 텍스트를 삽입.

### Phase 3 — 컨텍스트 예산 (3주차)
1. `context-budget.ps1` + `/forge-context-report` 커맨드 스켈레톤.
2. `logs/context-budget.jsonl` 스키마 확정.
3. **검증**: 대형 rules 세트 로드 시 SessionStart에서 경고 배너 뜨는지 확인.

### Phase 4 — 측정 및 튜닝 (4주차)
1. 로그 집계: false-positive 비율, 리뷰어 verdict 분포, 캐시 히트율.
2. 임계값 조정(40 lines, 10분 쿨다운, 20회 상한).
3. 사용자 피드백 반영 → 룰 폴더에 자주 필요한 체크를 기본 제공 룰로 승격.

---

## 9. 검증 방법

| 구성 | 테스트 시나리오 | 기대 결과 |
|---|---|---|
| quality-gate / ts | `eslint` 위반 코드 Write | 파일은 기록됨, PostToolUse `reason`에 eslint 메시지 포함 |
| quality-gate / py | `ruff` 위반 Edit | 동일 |
| quality-gate 타임아웃 | 대형 repo에서 tsc 5초 초과 | `exit 0`로 비막힘, 로그에 timeout 기록 |
| quality-rules 확장 | 사용자 `.ps1` 하나 투입 | 훅이 룰 순회하며 실행 |
| reviewer 트리거 off | 플래그 파일 부재 | 리뷰어 호출 없음 |
| reviewer 트리거 on | 40+줄 diff | Task 툴이 다음 턴에 호출되거나, 대체 경로 작동 |
| reviewer 캐시 | 같은 파일 30초 내 재편집 | 리뷰어 재호출 없음 |
| context-budget | 초대형 CLAUDE.md 로드 | SessionStart `reason`에 30/50% 경고 |
| settings.json 병합 | 기존 커스텀 훅 존재 상태에서 설치 | 기존 훅 유지 + 신규 훅 추가 |

---

## 10. 리스크와 롤백

### 리스크
1. **훅에서 서브에이전트 직접 스폰 불가 제약**(7-B 주의) — Phase 2 설계 전제가 무너질 경우 대체: PostToolUse는 신호만, 실제 리뷰는 `/review-last-diff` 슬래시 커맨드로 수동 실행.
2. **PowerShell 실행 정책** — ExecutionPolicy Restricted 환경이면 `-NoProfile -ExecutionPolicy Bypass` 필요. 설치 스크립트에 명시.
3. **프로젝트별 lint 설정 충돌** — npx가 존재하지 않는 eslint를 부르면 오류. `--no-install` 플래그로 방어.
4. **Haiku 비용 누적** — 20회 상한 + 샘플링으로 방어하지만, 팀 단위 배포 시 재튜닝 필수.

### 롤백 절차
1. `settings.json`에서 신규 hook 엔트리 제거(설치 시 백업된 `settings.json.backup`로 복원 가능).
2. `~/.claude/hooks/quality-gate.*`, `reviewer-trigger.*`, `context-budget.*` 파일 삭제.
3. `~/.claude/agents/code-reviewer-lite.md` 삭제.
4. `~/.claude/reviewer/`, `~/.claude/quality-rules/` 디렉터리는 보존(사용자 커스텀 포함 가능).

---

## 11. 미해결 결정사항 (Phase 1 진입 전 확정 필요)

1. **리뷰어 모델** — Haiku 4.5 확정? 혹은 Sonnet 4.6으로 품질 우선?
2. **.sh 폴백 범위** — Git Bash만 지원? macOS/Linux까지?
3. **설치 스크립트 위치** — Forge 포크 리포에 PR로 올릴지, 별도 `forge-quality-addon` 리포로 분리할지.
4. **사용자 룰 공유 방식** — `~/.claude/quality-rules/`에 기본 제공 룰 세트(예: no-console, no-todo-in-commit)를 같이 배포할지.

---

## 12. 본 플랜과 이전 안전망의 경계

| 레이어 | 목적 | 방식 | 차단 강도 |
|---|---|---|---|
| **안전망**(기존) | 복구 불가 상황 방지 | PreToolUse + guardrails.ps1 | **hard deny** (bypassPermissions에서도 작동) |
| **품질 게이트**(본 플랜 P0) | 회귀·lint·관습 위반 조기 발견 | PostToolUse + quality-gate | **경고 중심**, critical만 deny |
| **경량 리뷰어**(본 플랜 P1) | 셀프평가 편향 제거 | PostToolUse 트리거 → 별도 Haiku 서브에이전트 | 주입 메시지, 사용자 판단 |
| **컨텍스트 예산**(본 플랜 P2) | Forge 자기모순 가시화 | SessionStart 경고 | 알림만 |

---

## 13. 다음 액션 (Sonnet 이관 지점)

1. 본 플랜 승인 후 **Sonnet으로 전환**(프로젝트 규칙).
2. Sonnet이 아래 순서로 구현:
   - `~/.claude/hooks/quality-gate.ps1` + `lib/*.ps1` 작성.
   - `settings.json` 병합 스크립트 작성(기존 Forge settings.json 백업 + 병합).
   - Phase 1 검증 시나리오 수동 수행 + `logs/quality-gate.jsonl` 관찰.
3. Phase 1 안정화 후 Phase 2 진입 여부 재논의(→ 필요 시 다시 Opus).
