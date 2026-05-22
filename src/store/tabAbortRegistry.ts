/**
 * Per-tab AbortController registry.
 *
 * 워크스페이스 로드/저장 같은 비동기 작업을 탭 단위로 추적하여
 * 탭이 닫힐 때 안전하게 취소할 수 있도록 한다.
 *
 * - register(tabId): 새 AbortController 생성 후 등록, 기존 것은 abort()
 * - get(tabId): 현재 등록된 controller 반환 (없으면 undefined)
 * - abort(tabId, reason?): 해당 탭의 작업 즉시 취소 + 등록 해제
 * - dispose(tabId): abort 호출 (alias). 탭 라이프사이클 종료 시점에서 사용
 */

class TabAbortRegistry {
    private controllers = new Map<string, AbortController>();

    register(tabId: string): AbortController {
        const existing = this.controllers.get(tabId);
        if (existing) {
            try {
                existing.abort(new DOMException('Replaced by new controller', 'AbortError'));
            } catch {
                // ignore — older runtimes may throw on abort with reason
            }
        }
        const controller = new AbortController();
        this.controllers.set(tabId, controller);
        return controller;
    }

    get(tabId: string): AbortController | undefined {
        return this.controllers.get(tabId);
    }

    abort(tabId: string, reason?: any): void {
        const controller = this.controllers.get(tabId);
        if (!controller) return;
        try {
            controller.abort(reason ?? new DOMException('Tab closed', 'AbortError'));
        } catch {
            // ignore
        }
        this.controllers.delete(tabId);
    }

    dispose(tabId: string): void {
        this.abort(tabId);
    }
}

export const tabAbortRegistry = new TabAbortRegistry();

export function isAbortError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'AbortError') return true;
    return false;
}
