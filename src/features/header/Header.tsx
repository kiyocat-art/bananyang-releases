import React from 'react';
import { t, Language } from '../../localization';

interface HeaderProps {
    language: Language;
}

export const Header: React.FC<HeaderProps> = ({ language }) => {
    return (
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-xl border-b border-white/10">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-[#2B2B2B] border-2 border-white rounded-lg">
                    <span className="font-black text-white text-3xl">B</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-lg">{t('appTitle', language)}</h1>
            </div>
        </header>
    );
};
