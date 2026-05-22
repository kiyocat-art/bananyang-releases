/**
 * UpdateNotificationToast.tsx — 우측 하단 OTA 업데이트 토스트
 *
 * 표시 조건:
 *   - state=available  + autoUpdateEnabled=false  → '지금 설치 / 나중에'
 *   - state=downloading + (모드 무관)             → 진행률 표시
 *   - state=downloaded  + (모드 무관)             → '지금 재시작 / 다음 종료 시 적용'
 *   - state=error                                 → 오류 메시지
 *
 * 비표시 조건:
 *   - state=idle | checking | not-available
 *   - severity=critical (UpdatePromptModal이 처리)
 *   - silent 모드 + state=available (백그라운드 다운로드 중)
 */
import React, { useEffect, useState } from 'react';
import {
    onUpdateStatus,
    downloadUpdate,
    applyUpdateNow,
    UpdateStatus,
} from '../services/autoUpdater';
import { useSettingsStore } from '../store/settingsStore';
import { t, TranslationKey } from '../localization';
import { Z_INDEX } from '../constants/zIndex';

export const UpdateNotificationToast: React.FC = () => {
    const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
    const [dismissed, setDismissed] = useState(false);
    const language = useSettingsStore((s) => s.language);
    const autoUpdateEnabled = useSettingsStore((s) => s.autoUpdateEnabled);

    useEffect(() => onUpdateStatus(setStatus), []);

    // 상태가 새로 바뀌면 사용자가 닫았던 토스트를 다시 보여준다.
    useEffect(() => {
        setDismissed(false);
    }, [status.state]);

    if (dismissed) return null;
    if (status.state === 'idle' || status.state === 'checking' || status.state === 'not-available') {
        return null;
    }

    const severity =
        (status.state === 'available' || status.state === 'downloaded')
            ? status.severity
            : undefined;

    // critical → 차단형 모달에서 처리.
    if (severity === 'critical') return null;

    // silent 모드 + available → 토스트 미표시 (백그라운드 다운로드 중).
    if (autoUpdateEnabled && status.state === 'available') return null;

    const renderTitle = (): string => {
        switch (status.state) {
            case 'available':
                return t('update.toast.available' as TranslationKey, language);
            case 'downloading':
                return t('update.toast.downloading' as TranslationKey, language);
            case 'downloaded':
                return t('update.toast.ready' as TranslationKey, language);
            case 'error':
                return t('update.toast.error' as TranslationKey, language);
            default:
                return '';
        }
    };

    return (
        <div
            className="fixed bottom-4 right-4 w-[360px] rounded-2xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur p-4 shadow-2xl"
            style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-100">{renderTitle()}</div>
                    {status.state === 'available' && (
                        <p className="text-xs text-zinc-400 mt-1">v{status.version}</p>
                    )}
                    {status.state === 'downloaded' && (
                        <p className="text-xs text-zinc-400 mt-1">v{status.version}</p>
                    )}
                    {status.state === 'downloading' && (
                        <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-yellow-400 transition-all duration-200"
                                style={{ width: `${status.percent}%` }}
                            />
                        </div>
                    )}
                    {status.state === 'error' && (
                        <p className="text-xs text-red-400 mt-1 break-words">{status.message}</p>
                    )}
                </div>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                    aria-label="dismiss"
                    type="button"
                >
                    ✕
                </button>
            </div>

            {status.state === 'available' && !autoUpdateEnabled && (
                <div className="mt-3 flex gap-2 justify-end">
                    <button
                        onClick={() => setDismissed(true)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 cursor-pointer"
                        type="button"
                    >
                        {t('update.toast.later' as TranslationKey, language)}
                    </button>
                    <button
                        onClick={() => { void downloadUpdate(); }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-900 font-medium cursor-pointer"
                        type="button"
                    >
                        {t('update.toast.installNow' as TranslationKey, language)}
                    </button>
                </div>
            )}

            {status.state === 'downloaded' && (
                <div className="mt-3 flex gap-2 justify-end">
                    <button
                        onClick={() => setDismissed(true)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 cursor-pointer"
                        type="button"
                    >
                        {t('update.toast.installOnQuit' as TranslationKey, language)}
                    </button>
                    <button
                        onClick={() => { void applyUpdateNow(); }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-900 font-medium cursor-pointer"
                        type="button"
                    >
                        {t('update.toast.restartNow' as TranslationKey, language)}
                    </button>
                </div>
            )}
        </div>
    );
};
