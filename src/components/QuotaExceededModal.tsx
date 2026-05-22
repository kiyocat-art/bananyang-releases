import React from 'react';
import { t } from '../localization';
import type { Language } from '../localization';
import { Z_INDEX } from '../constants/zIndex';

interface QuotaExceededModalProps {
    language: Language;
    onStop: () => void;
    onContinue: () => void;
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({ language, onStop, onContinue }) => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: Z_INDEX.IMAGE_VIEWER }}>
        <div className="glass-panel rounded-3xl p-8 max-w-md w-full shadow-2xl text-center animate-shake">
            <h2 className="text-2xl font-bold mb-4 text-amber-400">{t('quotaModal.title', language)}</h2>
            <p className="text-zinc-300 mb-8 whitespace-pre-wrap">{t('quotaModal.body', language)}</p>
            <div className="flex justify-center gap-4">
                <button onClick={onStop} className="glass-button px-6 py-2 font-semibold rounded-xl text-white hover:text-white/90">
                    {t('quotaModal.stop', language)}
                </button>
                <button onClick={onContinue} className="px-6 py-2 font-semibold rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 shadow-lg">
                    {t('quotaModal.continue', language)}
                </button>
            </div>
        </div>
    </div>
);
