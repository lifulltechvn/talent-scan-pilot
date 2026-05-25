import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { vi } from './vi';
import { ja } from './ja';

export type Locale = 'en' | 'vi' | 'ja';

const translations: Record<Locale, Record<TranslationKey, string>> = { en, vi, ja };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  ja: '日本語',
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  const saved = localStorage.getItem('locale') as Locale | null;
  if (saved && translations[saved]) return saved;
  const browserLang = navigator.language.slice(0, 2);
  if (browserLang === 'ja') return 'ja';
  if (browserLang === 'vi') return 'vi';
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('locale', l);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    let text = translations[locale][key] ?? translations.en[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
