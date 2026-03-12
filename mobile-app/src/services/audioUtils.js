import { API_CONFIG } from '../config/api';

/**
 * Resolves an audio URL to a full URL.
 * - If the URL is already absolute (http/https), return as-is.
 * - If the URL is a relative Django media path (e.g. "/media/gap_audio/recording.webm"),
 *   prepend the Django server base URL.
 * - Returns null if url is falsy.
 */
export function resolveAudioUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path — prepend Django server URL
  const base = API_CONFIG.DJANGO_URL.replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}
