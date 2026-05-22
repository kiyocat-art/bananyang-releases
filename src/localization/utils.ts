import { Language, TranslationKey } from './types';
import { ko } from './ko';
import { en } from './en';
// import { zhCN } from './zh-CN';
// import { zhTW } from './zh-TW';
import { ja } from './ja';
import { id } from './id';
import { es } from './es';
import { fr } from './fr';

const translations: Record<Language, Record<string, string>> = {
  ko,
  en,
  // 'zh-CN': zhCN,
  // 'zh-TW': zhTW,
  ja,
  id,
  es,
  fr,
};

const generateEnumTranslations = (prefix: string, enumObject: object, target: Record<string, string>) => {
  for (const value of Object.values(enumObject)) {
    // We only want to process string values from the enum, which is safe for both string and numeric enums.
    if (typeof value === 'string') {
      const spacedValue = value.replace(/([A-Z])/g, ' $1').replace(/([0-9]+)/g, ' $1').trim();
      target[prefix + '.' + value] = spacedValue;
    }
  }
};

export const t = (key: TranslationKey, language: Language, options?: Record<string, string | number>): string => {
  let text = translations[language][key] || key;
  if (options) {
    Object.keys(options).forEach(optionKey => {
      text = text.replace(`{${optionKey}}`, String(options[optionKey]));
    });
  }
  return text;
};

// FIX: Changed `value` from `any` to `string` for better type safety.
export const getEnumText = (type: 'bodyPart' | 'cameraAngle' | 'clothing' | 'actionPose' | 'object', value: string, language: Language): string => {
  return t(`${type}.${value}` as TranslationKey, language);
};

// FIX: Changed `value` from `any` to `string` for better type safety.
export const getTooltipText = (type: 'bodyPart' | 'cameraAngle' | 'clothing' | 'actionPose' | 'object', value: string, language: Language): string => {
  return t(`tooltip.${type}.${value} ` as TranslationKey, language);
};

export { generateEnumTranslations };
