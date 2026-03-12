// AccessibilityContext — provides app-wide accessibility features
// =================================================================
// Features:
//   - Large Text: respects system font scaling (maxFontSizeMultiplier)
//   - Haptic Feedback: triggers device vibration on interactions
//   - Reduce Motion: disables navigation animations
//
// Usage:
//   const { triggerHaptic, reduceMotion, largeText } = useAccessibility();

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { parseObject } from '../utils/safeJSON';

const STORAGE_KEY = '@accessibility_prefs';

const AccessibilityContext = createContext({
  largeText: false,
  hapticEnabled: true,
  reduceMotion: false,
  updateLargeText: () => {},
  updateHaptic: () => {},
  updateReduceMotion: () => {},
  triggerHaptic: () => {},
  isLoaded: false,
});

export function AccessibilityProvider({ children }) {
  const [largeText, setLargeText] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const prefs = parseObject(saved);
          setLargeText(prefs.largeText ?? false);
          setHapticEnabled(prefs.hapticFeedback ?? true);
          setReduceMotion(prefs.reduceMotion ?? false);
        }
      } catch (e) {
        // Fallback to defaults — non-critical
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Apply font scaling based on Large Text preference
  useEffect(() => {
    const multiplier = largeText ? 1.6 : 1.0;

    // Text component
    if (!Text.defaultProps) Text.defaultProps = {};
    Text.defaultProps.allowFontScaling = true;
    Text.defaultProps.maxFontSizeMultiplier = multiplier;

    // TextInput component
    if (!TextInput.defaultProps) TextInput.defaultProps = {};
    TextInput.defaultProps.allowFontScaling = true;
    TextInput.defaultProps.maxFontSizeMultiplier = multiplier;
  }, [largeText]);

  const savePrefs = useCallback(async (overrides) => {
    const prefs = {
      largeText,
      hapticFeedback: hapticEnabled,
      reduceMotion,
      ...overrides,
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      // Non-critical
    }
  }, [largeText, hapticEnabled, reduceMotion]);

  const updateLargeText = useCallback((value) => {
    setLargeText(value);
    savePrefs({ largeText: value });
  }, [savePrefs]);

  const updateHaptic = useCallback((value) => {
    setHapticEnabled(value);
    savePrefs({ hapticFeedback: value });
  }, [savePrefs]);

  const updateReduceMotion = useCallback((value) => {
    setReduceMotion(value);
    savePrefs({ reduceMotion: value });
  }, [savePrefs]);

  /**
   * Trigger haptic feedback if the user has it enabled.
   * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'|'selection'} type
   */
  const triggerHaptic = useCallback((type = 'light') => {
    if (!hapticEnabled) return;
    try {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          Haptics.selectionAsync();
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      // Haptics not available on this device — ignore silently
    }
  }, [hapticEnabled]);

  return (
    <AccessibilityContext.Provider
      value={{
        largeText,
        hapticEnabled,
        reduceMotion,
        updateLargeText,
        updateHaptic,
        updateReduceMotion,
        triggerHaptic,
        isLoaded,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}

export default AccessibilityContext;
