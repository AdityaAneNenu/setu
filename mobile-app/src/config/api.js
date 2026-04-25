// Django API Configuration
// Some features (like AI processing) still require Django backend

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ======================================================================
// Railway Production URL configuration
// ======================================================================
const DEFAULT_PRODUCTION_URL = 'https://setu.up.railway.app';
const DECOMMISSIONED_PRODUCTION_HOSTS = new Set([
  'setu-pm-django-production.up.railway.app',
]);

const normalizeBaseUrl = (url) => {
  if (typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
};

const getUrlHost = (url) => {
  if (!url) return '';
  return url
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .trim()
    .toLowerCase();
};

const configuredProductionUrl = normalizeBaseUrl(
  Constants.expoConfig?.extra?.PRODUCTION_API_URL
);
const configuredProductionHost = getUrlHost(configuredProductionUrl);
const hasDecommissionedConfiguredUrl =
  configuredProductionHost &&
  DECOMMISSIONED_PRODUCTION_HOSTS.has(configuredProductionHost);

const PRODUCTION_URL = hasDecommissionedConfiguredUrl
  ? DEFAULT_PRODUCTION_URL
  : configuredProductionUrl || DEFAULT_PRODUCTION_URL;
const USE_LOCAL_BACKEND_IN_DEV =
  Constants.expoConfig?.extra?.USE_LOCAL_BACKEND_IN_DEV === true;

// Local development fallback (only for emulators when production unavailable)
const DEV_MACHINE_IP = '192.168.1.114';
const DEV_PORT = '8000';

const getDjangoUrl = () => {
  // If a production URL is configured, always prefer it to avoid accidental
  // local/dev-server drift in mobile complaint and closure flows.
  if (__DEV__ && USE_LOCAL_BACKEND_IN_DEV && !PRODUCTION_URL) {
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${DEV_PORT}`;
    }
    return `http://localhost:${DEV_PORT}`;
  }

  // Prefer production URL for normal usage.
  if (PRODUCTION_URL) {
    if (hasDecommissionedConfiguredUrl) {
      console.warn(
        'Configured PRODUCTION_API_URL points to a retired Railway domain. Falling back to active URL:',
        DEFAULT_PRODUCTION_URL
      );
    }
    console.log('Using production API:', PRODUCTION_URL);
    return PRODUCTION_URL;
  }

  // Fallback for local development only.
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
