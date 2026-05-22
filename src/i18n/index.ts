/**
 * i18n — 경량 다국어 시스템
 *
 * 사용법:
 *   import { t, setLocale } from '@/i18n';
 *   t('drm.login_title');  // "로그인"
 *   setLocale('en');
 *   t('drm.login_title');  // "Login"
 */

import koMessages from './locales/ko.json';
import enMessages from './locales/en.json';
import jaMessages from './locales/ja.json';

export type Locale = 'ko' | 'en' | 'ja';

type Messages = Record<string, string>;
type LocaleMessages = Record<Locale, Messages>;

const messages: LocaleMessages = {
    ko: koMessages as Messages,
    en: enMessages as Messages,
    ja: jaMessages as Messages,
};

// ──────────────────────────────────────────────────────────────
// 현재 로케일 (기본: 시스템 언어 감지)
// ──────────────────────────────────────────────────────────────
let currentLocale: Locale = detectLocale();

function detectLocale(): Locale {
    try {
        // localStorage에서 사용자 설정 읽기
        const saved = localStorage.getItem('bn_locale') as Locale | null;
        if (saved && messages[saved]) return saved;

        // 시스템 언어 자동 감지
        const lang = navigator.language.slice(0, 2).toLowerCase();
        if (lang === 'ko') return 'ko';
        if (lang === 'ja') return 'ja';
        return 'en';
    } catch {
        return 'ko';
    }
}

// ──────────────────────────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────────────────────────

/**
 * 번역 문자열 반환
 * @param key 점(.) 구분 키 (예: "drm.login_title")
 * @param params 치환 파라미터 (예: { days: 3 })
 */
export function t(key: string, params?: Record<string, string | number>): string {
    const locale = messages[currentLocale] ?? messages.ko;
    let text = locale[key] ?? messages.ko[key] ?? key;

    // 파라미터 치환: {days} → 3
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
    }

    return text;
}

/**
 * 현재 로케일 반환
 */
export function getLocale(): Locale {
    return currentLocale;
}

/**
 * 로케일 변경 + localStorage 저장
 */
export function setLocale(locale: Locale): void {
    if (messages[locale]) {
        currentLocale = locale;
        try {
            localStorage.setItem('bn_locale', locale);
        } catch { /* noop */ }
    }
}

/**
 * 지원 로케일 목록
 */
export function getSupportedLocales(): { code: Locale; name: string }[] {
    return [
        { code: 'ko', name: '한국어' },
        { code: 'en', name: 'English' },
        { code: 'ja', name: '日本語' },
    ];
}
