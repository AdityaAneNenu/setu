// LanguageContext — provides app-wide translation support
// Usage: const { t, currentLanguage, changeLanguage } = useTranslation();

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, LANGUAGES } from '../i18n';
import { parseObject } from '../utils/safeJSON';

const STORAGE_KEY = 'language_settings';

const LanguageContext = createContext({
  currentLanguage: 'en',
  changeLanguage: () => {},
  t: (key, params) => key,
  languages: LANGUAGES,
  isLoaded: false,
});

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const prefs = parseObject(saved);
          if (prefs.appLang && LANGUAGES.some(l => l.id === prefs.appLang)) {
            setCurrentLanguage(prefs.appLang);
          }
        }
      } catch (e) {
        // fallback to en
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const changeLanguage = useCallback(async (langId) => {
    if (!LANGUAGES.some(l => l.id === langId)) return;
    setCurrentLanguage(langId);
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const prefs = parseObject(saved);
      prefs.appLang = langId;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      // non-critical
    }
  }, []);

  const t = useCallback((key, params) => {
    return translate(currentLanguage, key, params);
  }, [currentLanguage]);

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, t, languages: LANGUAGES, isLoaded }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}

export default LanguageContext;
