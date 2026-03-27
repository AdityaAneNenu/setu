// AI Analysis Service
// Calls Django backend for AI-powered image/audio analysis
// Files are uploaded directly to Django — NO Firebase Storage needed

import { API_CONFIG } from '../config/api';
import { auth } from '../config/firebase';

const SUPPORTED_AUDIO_LANGUAGES = new Set([
  'hi', 'en', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'or', 'pa', 'as',
]);

const AUDIO_MIME_BY_EXT = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
};

const getFileExtension = (uri = '', fallback = 'bin') => {
  const cleanUri = uri.split('?')[0] || '';
  const filePart = cleanUri.split('/').pop() || '';
  const ext = filePart.includes('.') ? filePart.split('.').pop().toLowerCase() : '';
  return ext || fallback;
};

const inferUploadMeta = (fileUri, mediaType) => {
  if (mediaType === 'audio') {
    const ext = getFileExtension(fileUri, 'm4a');
    const mimeType = AUDIO_MIME_BY_EXT[ext] || 'audio/mp4';
    return {
      fileName: `recording_${Date.now()}.${ext}`,
      mimeType,
    };
  }

  const ext = getFileExtension(fileUri, 'jpg');
  const imageMime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return {
    fileName: `photo_${Date.now()}.${ext}`,
    mimeType: imageMime,
  };
};

const normalizeLanguage = (language) => {
  const lang = (language || 'hi').toLowerCase().trim();
  return SUPPORTED_AUDIO_LANGUAGES.has(lang) ? lang : 'hi';
};

const parseResponseBody = async (response) => {
  const raw = await response.text();
  if (!raw) return { data: null, rawText: '' };

  try {
    return { data: JSON.parse(raw), rawText: raw };
  } catch {
    return { data: null, rawText: raw };
  }
};

const runAnalyzeRequest = async ({ fileUri, mediaType, language, idToken }) => {
  const url = `${API_CONFIG.DJANGO_URL}${API_CONFIG.AI_ANALYZE_ENDPOINT}`;
  const formData = new FormData();
  const { fileName, mimeType } = inferUploadMeta(fileUri, mediaType);

  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  });
  formData.append('media_type', mediaType);
  formData.append('language', language);

  // Audio transcription + LLM analysis can take longer than images.
  const timeoutMs = mediaType === 'audio' ? 180000 : 90000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(idToken && { Authorization: `Bearer ${idToken}` }),
      },
      body: formData,
      signal: controller.signal,
    });

    const { data, rawText } = await parseResponseBody(response);

    if (!response.ok) {
      const serverError =
        data?.error ||
        data?.detail ||
        data?.message ||
        (rawText && rawText.slice(0, 240)) ||
        `AI analysis failed with HTTP ${response.status}`;
      throw new Error(serverError);
    }

    return data || {};
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Analyze media (image or audio) by uploading file directly to Django backend
 * @param {string} fileUri - Local file URI (e.g., file:///...)
 * @param {string} mediaType - 'image' or 'audio'
 * @param {string} language - Language code for audio transcription (default: 'hi')
 * @returns {Promise<Object>} AI analysis result
 */
export const analyzeMedia = async (fileUri, mediaType, language = 'hi') => {
  try {
    // Get Firebase Auth token for authenticated request
    const user = auth.currentUser;
    const idToken = user ? await user.getIdToken() : null;

    const preferredLanguage = normalizeLanguage(language);
    const languageAttempts = mediaType === 'audio'
      ? Array.from(new Set([preferredLanguage, 'hi', 'en']))
      : [preferredLanguage];

    let data = null;
    let lastError = null;

    for (const lang of languageAttempts) {
      try {
        data = await runAnalyzeRequest({ fileUri, mediaType, language: lang, idToken });
        break;
      } catch (attemptError) {
        lastError = attemptError;
        // Retry audio transcription with a safe fallback language.
        if (mediaType === 'audio' && lang !== languageAttempts[languageAttempts.length - 1]) {
          console.warn(`AI analysis retry with fallback language. Previous language: ${lang}`);
          continue;
        }
      }
    }

    if (!data) {
      throw lastError || new Error('AI analysis failed');
    }

    return {
      success: true,
      description: data.description || '',
      gap_type: data.gap_type || 'other',
      severity: data.severity || 'medium',
      confidence: data.confidence || 0.7,
      transcription: data.transcription, // Only for audio
    };
  } catch (error) {
    console.error('AI processing error:', error);
    const isTimeout = error.name === 'AbortError';
    const isNetwork = error.message === 'Network request failed';
    let errorMsg = error.message || 'Failed to analyze media';
    if (isNetwork) {
      errorMsg = `Cannot reach server at ${API_CONFIG.DJANGO_URL}. Make sure Django is running and your device is on the same Wi-Fi network.`;
    } else if (isTimeout) {
      errorMsg = 'AI analysis timed out after 60 seconds. Please try again.';
    }
    return {
      success: false,
      error: errorMsg,
      description: '',
      gap_type: 'other',
      severity: 'medium',
      confidence: 0,
    };
  }
};

export default {
  analyzeMedia,
};
