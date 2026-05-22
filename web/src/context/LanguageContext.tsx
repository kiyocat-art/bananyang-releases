'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { translations, type Locale, type Translations } from '@/lib/i18n';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'ko',
  setLocale: () => {},
  t: translations.ko,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ko');

  useEffect(() => {
    // 1. Check localStorage
    const saved = localStorage.getItem('bananyang_locale') as Locale | null;
    if (saved && saved in translations) {
      setLocaleState(saved);
      return;
    }
    // 2. Detect from browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'en') setLocaleState('en');
    else if (browserLang === 'ja') setLocaleState('ja');
    else if (browserLang === 'id') setLocaleState('id');
    else if (browserLang === 'es') setLocaleState('es');
    else if (browserLang === 'fr') setLocaleState('fr');
    // else default stays 'ko'
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('bananyang_locale', l);
    // Update <html lang="..."> attribute
    document.documentElement.lang = l;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
