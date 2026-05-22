import React from 'react';
import { Z_INDEX } from '../constants/zIndex';
import { t } from '../localization';
import { useSettingsStore } from '../store/settingsStore';

interface GenerationLoginPromptProps {
    onClose: () => void;
    onOpenApiSettings: () => void;
}

export const GenerationLoginPrompt: React.FC<GenerationLoginPromptProps> = ({ onClose, onOpenApiSettings }) => {
    const language = useSettingsStore(state => state.language);
    return (
    <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX.HEADER_DROPDOWN,
        backdropFilter: 'blur(6px)',
    }}>
        <div style={{
            background: '#151515',
            border: '1px solid #1F1F1F',
            borderRadius: '16px',
            padding: '36px 32px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            <div className="text-4xl" style={{ marginBottom: '12px' }}>🍌</div>
            <h2 className="text-3xl" style={{ margin: '0 0 8px', color: '#fff', fontWeight: 700 }}>
                {t('loginPrompt.title', language)}
            </h2>
            <p className="text-base" style={{ color: '#aaa', margin: '0 0 12px', lineHeight: 1.6 }}>
                {t('loginPrompt.body', language).split('\n').map((line, i) => (
                    <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>
                ))}
            </p>
            <p className="text-sm" style={{
                color: 'rgba(245,197,24,0.8)',
                margin: '0 0 20px',
                lineHeight: 1.5,
                background: 'rgba(245,197,24,0.07)',
                border: '1px solid rgba(245,197,24,0.2)',
                borderRadius: '8px',
                padding: '8px 12px',
            }}>
                {t('loginPrompt.apiKeyNote', language)}
            </p>
            <button
                onClick={onOpenApiSettings}
                className="text-lg"
                style={{
                    background: '#F5C518',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    marginBottom: '10px',
                }}
            >
                {t('loginPrompt.goToSettings', language)}
            </button>
            <button
                onClick={onClose}
                className="text-base"
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                }}
            >
                {t('loginPrompt.skip', language)}
            </button>
        </div>
    </div>
    );
};
