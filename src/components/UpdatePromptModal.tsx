/**
 * UpdatePromptModal.tsx — severity='critical' 강제 업데이트 모달
 *
 * 표시 조건: severity=critical 이고 state가 available|downloading|downloaded.
 * 차단형 — ESC/backdrop 클릭 무시, 닫기 버튼 없음.
 * 다운로드 완료 시 '지금 재시작' 버튼만 활성. 사용자가 작업 저장 후 직접 클릭.
 */
import React, { useEffect, useState } from 'react';
import {
    onUpdateStatus,
    applyUpdateNow,
    UpdateStatus,
} from '../services/autoUpdater';
import { useSettingsStore } from '../store/settingsStore';
import { t, TranslationKey } from '../localization';
import { Z_INDEX } from '../constants/zIndex';

export const UpdatePromptModal: React.FC = () => {
    const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
    const language = useSettingsStore((s) => s.language);

    useEffect(() => onUpdateStatus(setStatus), []);

    const severity =
        (status.state === 'available' || status.state === 'downloaded')
            ? status.severity
            : undefined;

    const isCritical =
        severity === 'critical' &&
        (status.state === 'available' ||
            status.state === 'downloading' ||
            status.state === 'downloaded');

    if (!isCritical) return null;

    const percent = status.state === 'downloading' ? status.percent : 100;
    const downloaded = status.state === 'downloaded';

    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center"
            style={{ zIndex: Z_INDEX.SESSION_RECOVERY }}
            role="alertdialog"
            aria-modal="true"
        >
            <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
                <h2 className="text-lg font-semibold text-red-400">
                    {t('update.critical.title' as TranslationKey, language)}
                </h2>
                <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
                    {t('update.critical.body' as TranslationKey, language)}
                </p>
                <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-red-400 transition-all duration-200"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <button
                    onClick={() => { void applyUpdateNow(); }}
                    disabled={!downloaded}
                    className="mt-4 w-full py-2.5 rounded-lg bg-red-500 hover:bg-red-400 disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-medium cursor-pointer disabled:cursor-not-allowed transition-colors duration-150"
                    type="button"
                >
                    {t('update.critical.restart' as TranslationKey, language)}
                </button>
            </div>
        </div>
    );
};
