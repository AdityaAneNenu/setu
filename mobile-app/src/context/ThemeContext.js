import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../theme';

const STORAGE_KEY = '@theme_preference';

// Default context value with real colors as fallback
const defaultContextValue = {
  isDark: false,
  colors: lightColors,
  themeMode: 'system',
  setThemeMode: () => {},
  toggleTheme: () => {},
  isLoaded: false,
};

const ThemeContext = createContext(defaultContextValue);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
          setThemeModeState(saved);
        }
      } catch (e) {
        // fallback to system
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
      // non-critical
    }
  }, []);

  // Compute isDark and colors BEFORE toggleTheme to avoid TDZ
  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');

  const colors = isDark ? darkColors : lightColors;

  const toggleTheme = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setThemeMode(next);
  }, [isDark, setThemeMode]);

  const value = { isDark, colors, themeMode, setThemeMode, toggleTheme, isLoaded };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  // Defensive: if context is somehow undefined, return defaults
  if (!context || !context.colors) {
    return defaultContextValue;
  }
  return context;
}

export default ThemeContext;
