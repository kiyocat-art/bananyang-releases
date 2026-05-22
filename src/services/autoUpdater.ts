/**
 * autoUpdater.ts — Renderer 측 자동 업데이트 서비스
 *
 * Main 프로세스의 electron-updater 이벤트를 IPC로 받아 UI에 전달한다.
 * 추가로 정책(silent/prompt)과 critical 적용 트리거를 main에 통지한다.
 */

export type UpdateSeverity = 'optional' | 'recommended' | 'critical';
export type UpdatePolicy = 'silent' | 'prompt';

export type UpdateStatus =
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'available'; version: string; severity?: UpdateSeverity }
    | { state: 'not-available' }
    | { state: 'downloading'; percent: number }
    | { state: 'downloaded'; version: string; severity?: UpdateSeverity }
    | { state: 'error'; message: string };

type UpdateListener = (status: UpdateStatus) => void;

const listeners = new Set<UpdateListener>();
let ipcAttached = false;

/**
 * 업데이트 상태 변경 리스너 등록.
 */
export function onUpdateStatus(listener: UpdateListener): () => void {
    listeners.add(listener);

    if (!ipcAttached) {
        setupIpcListeners();
    }

    return () => {
        listeners.delete(listener);
    };
}

/**
 * 업데이트 확인 요청 — main이 electron-updater.checkForUpdates() 호출.
 */
export async function checkForUpdates(): Promise<void> {
    try {
        await window.electronAPI?.checkForUpdates?.();
    } catch (e) {
        console.error('[AutoUpdater] checkForUpdates failed:', e);
    }
}

/**
 * 사용자 선택에 의한 명시적 다운로드 (prompt 모드).
 */
export async function downloadUpdate(): Promise<void> {
    try {
        await window.electronAPI?.downloadUpdate?.();
    } catch (e) {
        console.error('[AutoUpdater] downloadUpdate failed:', e);
    }
}

/**
 * 다운로드된 업데이트를 즉시 설치 (앱 재시작).
 * silent 모드는 종료 시 자동 적용되므로 보통 호출 불필요.
 */
export async function installUpdate(): Promise<void> {
    try {
        await window.electronAPI?.installUpdate?.();
    } catch (e) {
        console.error('[AutoUpdater] installUpdate failed:', e);
    }
}

/**
 * main에 정책(silent/prompt) + severity 전달.
 * - silent: update-available 시 main이 즉시 downloadUpdate 호출.
 * - prompt: 사용자가 토스트에서 '지금 설치' 선택 시에만 downloadUpdate.
 * - severity='critical'은 토글과 무관하게 main이 강제 다운로드.
 */
export async function setUpdatePolicy(
    policy: UpdatePolicy,
    severity?: UpdateSeverity,
): Promise<void> {
    try {
        await window.electronAPI?.setUpdatePolicy?.(policy, severity);
    } catch (e) {
        console.error('[AutoUpdater] setUpdatePolicy failed:', e);
    }
}

/**
 * 다운로드 완료 후 즉시 재시작하여 적용.
 * '지금 재시작' 버튼이 호출. (silent 모드의 자동 종료-시-적용과 다른 경로.)
 */
export async function applyUpdateNow(): Promise<void> {
    try {
        await window.electronAPI?.applyUpdateNow?.();
    } catch (e) {
        console.error('[AutoUpdater] applyUpdateNow failed:', e);
    }
}

// ──────────────────────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────────────────────

function emit(status: UpdateStatus): void {
    listeners.forEach((fn) => {
        try {
            fn(status);
        } catch (e) {
            console.error('[AutoUpdater] listener error:', e);
        }
    });
}

function setupIpcListeners(): void {
    const api = window.electronAPI;
    if (!api?.onUpdateStatus) return;
    ipcAttached = true;
    api.onUpdateStatus((status: UpdateStatus) => {
        emit(status);
    });
}
