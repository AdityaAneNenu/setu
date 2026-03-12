// Django API Configuration
// Some features (like AI processing) still require Django backend

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ======================================================================
// CONFIGURATION: Set your computer's LAN IP here for physical devices
// Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find it.
// ======================================================================
const DEV_MACHINE_IP = '192.168.1.6';
const DEV_PORT = '8000';

// For production, set PRODUCTION_API_URL in app.json extra or eas.json
// e.g. 'https://api.setu-app.in'
const PRODUCTION_URL = Constants.expoConfig?.extra?.PRODUCTION_API_URL || null;

const getDjangoUrl = () => {
  // Use production URL if set
  if (PRODUCTION_URL) {
    return PRODUCTION_URL;
  }

  // Development mode detection
  if (__DEV__) {
    const isEmulator = !Constants.isDevice;

    if (Platform.OS === 'android') {
      if (isEmulator) {
        return `http://10.0.2.2:${DEV_PORT}`;
      }
      return `http://${DEV_MACHINE_IP}:${DEV_PORT}`;
    }

    if (Platform.OS === 'ios') {
      if (isEmulator) {
        return `http://localhost:${DEV_PORT}`;
      }
      return `http://${DEV_MACHINE_IP}:${DEV_PORT}`;
    }

    return `http://localhost:${DEV_PORT}`;
  }

  // Production fallback - must be configured
  console.warn('No PRODUCTION_API_URL configured. Set it in app.json extra.');
  return `http://${DEV_MACHINE_IP}:${DEV_PORT}`;
};

export const API_CONFIG = {
  DJANGO_URL: getDjangoUrl(),
  AI_ANALYZE_ENDPOINT: '/api/analyze-media/',
};

export default API_CONFIG;
