# Bananyang AI — Workspace App

Electron-based workspace for AI-assisted image generation and editing using Google Gemini image models.

## Deployment

- **Build & release:** `npm run dist:win:prod` → upload the generated `.exe` installer to Firebase Storage.

## Model Strategy

Complex/architectural work → Opus; implementation → Sonnet. The `/model` command cannot be auto-executed — prompt the user to run it manually.

## Post-Plan Model Switch Hard Rule (절대 규칙, 예외 없음)

**플랜 작성(`ExitPlanMode` 호출) 직후 구현을 즉시 중단하고 모델 전환을 요청해야 한다.** 사용자가 플랜을 승인하더라도, 모델 전환 확인 전까지 단 한 줄의 코드도 작성하지 마라.

### 필수 절차

1. `ExitPlanMode` 호출 → 사용자가 플랜 승인.
2. **구현을 시작하지 말고** 아래 메시지 중 하나를 출력:

   **기본 (Sonnet 권장):**
   > "플랜 승인 완료. 구현은 Sonnet으로 진행합니다. `/model claude-sonnet-4-6` 을 실행해주세요. 전환 후 'go' 또는 '진행'이라고 알려주시면 이어서 구현하겠습니다."

   **복잡/위험 작업 (Opus 유지 권장):**
   > "이 작업은 [복잡도/위험 사유]로 Sonnet 구현 시 위험 부담이 있습니다. Opus 4.7로 그대로 진행하는 것을 권장합니다. Sonnet 전환을 원하시면 `/model claude-sonnet-4-6`을, Opus 유지를 원하시면 'opus 유지'라고 알려주세요."

3. 사용자 확인 전까지 **모든 파일 편집/생성/삭제 도구 호출 금지**. Read, Grep, Glob 같은 읽기 전용 도구만 허용.

### "복잡/위험 작업" 판단 기준

다음 중 하나라도 해당하면 Opus 유지를 권장:
- 동시성/비동기 로직 (race condition, deadlock 위험)
- 아키텍처 전반에 영향을 주는 리팩토링 (5개 이상 파일 + 핵심 모듈)
- 보안 민감 코드 (인증, 암호화, 시크릿 처리)
- 데이터 마이그레이션/스키마 변경 (롤백 어려움)
- 성능 최적화 (정확성 트레이드오프 동반)
- IPC/네이티브 통합 (Electron main↔renderer, preload)

### 합리화 금지

- "간단한 구현이라 Sonnet 전환 없이 바로 하겠다" → 금지
- "사용자가 'go'라고 했으니 모델 확인 생략" → 금지 (모델 전환 확인 ≠ 일반 진행 승인)
- "플랜 자체가 작아서 절차 생략" → 금지. 트리비얼 수정은 애초에 플랜 모드를 거치지 않음. 플랜이 작성된 이상 절차 준수.

## Plan-Approval Hard Rule

No file edits, creations, or deletions until `ExitPlanMode` is called and the user explicitly approves. Trivial fixes (1–2 files, typos, obvious bugs) may proceed without plan mode, but always describe the change in text first and wait for implicit approval.

---

## Behavioral Guidelines

Reduce common LLM coding mistakes. **Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
