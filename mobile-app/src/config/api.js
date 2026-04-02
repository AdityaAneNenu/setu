// Django API Configuration
// Some features (like AI processing) still require Django backend

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ======================================================================
// Railway Production URL - ALWAYS used when available
// ======================================================================
const PRODUCTION_URL = Constants.expoConfig?.extra?.PRODUCTION_API_URL 
  || 'https://setu-pm-django-production.up.railway.app';

// Local development fallback (only for emulators when production unavailable)
const DEV_MACHINE_IP = '192.168.1.114';
const DEV_PORT = '8000';

const getDjangoUrl = () => {
  // ALWAYS prefer production URL - it's more reliable than local dev
  if (PRODUCTION_URL) {
    console.log('Using production API:', PRODUCTION_URL);
    return PRODUCTION_URL;
  }

  // Fallback for local development only (rare case)
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${DEV_PORT}`;
    }
    return `http://localhost:${DEV_PORT}`;
  }

  return `http://${DEV_MACHINE_IP}:${DEV_PORT}`;
};

export const API_CONFIG = {
  DJANGO_URL: getDjangoUrl(),
  AI_ANALYZE_ENDPOINT: '/api/analyze-media/',
};

export default API_CONFIG;
