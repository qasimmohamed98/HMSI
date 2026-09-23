import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ar } from './ar';
import { en } from './en';

export type AppLanguage = 'ar' | 'en';

export const DEFAULT_LANG: AppLanguage = 'ar';

const stored = (() => {
  try {
    const v = localStorage.getItem('hmsi.lang');
    return v === 'ar' || v === 'en' ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
})();

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: stored,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

function applyLang(lang: AppLanguage) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('data-language', lang);
}
applyLang(stored);

export function setLanguage(lang: AppLanguage) {
  localStorage.setItem('hmsi.lang', lang);
  applyLang(lang);
  i18n.changeLanguage(lang);
}

export const currentLang = (): AppLanguage =>
  (document.documentElement.getAttribute('data-language') as AppLanguage) || DEFAULT_LANG;

export default i18n;