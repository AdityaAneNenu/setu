// i18n engine — lightweight translation system for SETU mobile app
// Usage: const { t } = useTranslation();  t('home.hello')

import en from './translations/en';
import hi from './translations/hi';
import bn from './translations/bn';
import te from './translations/te';
import mr from './translations/mr';
import ta from './translations/ta';
import ur from './translations/ur';
import gu from './translations/gu';
import kn from './translations/kn';
import or_lang from './translations/or';
import pa from './translations/pa';
import as_lang from './translations/as';

export const translations = {
  en,
  hi,
  bn,
  te,
  mr,
  ta,
  ur,
  gu,
  kn,
  or: or_lang,
  pa,
  as: as_lang,
};

/**
 * Get translated string by dot-notated key with optional interpolation.
 * Falls back to English if key missing in target language.
 * @param {string} lang - language code (e.g. 'hi')
 * @param {string} key  - dot path (e.g. 'home.hello')
 * @param {object} params - interpolation params (e.g. { name: 'Ajay' })
 */
export function translate(lang, key, params = {}) {
  const keys = key.split('.');
  let value = translations[lang];
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }

  // Fallback to English
  if (value === undefined) {
    value = translations.en;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
  }

  // Final fallback: return key
  if (typeof value !== 'string') return key;

  // Interpolation: replace {param} with values
  return value.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? `{${p}}`);
}

export const LANGUAGES = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'hi', label: 'Hindi', native: 'हिंदी' },
  { id: 'bn', label: 'Bengali', native: 'বাংলা' },
  { id: 'te', label: 'Telugu', native: 'తెలుగు' },
  { id: 'mr', label: 'Marathi', native: 'मराठी' },
  { id: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { id: 'ur', label: 'Urdu', native: 'اردو' },
  { id: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { id: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { id: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { id: 'as', label: 'Assamese', native: 'অসমীয়া' },
];
