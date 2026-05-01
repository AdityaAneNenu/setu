// AI Analysis Service
// Calls Django backend for AI-powered image/audio analysis
// Files are uploaded directly to Django — NO Firebase Storage needed

import { API_CONFIG } from '../config/api';
import { getFirebaseAuthHeaders } from './firebaseAuthSession';

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

const isLowSignalTranscription = (transcription) => {
  const text = String(transcription || '').trim();
  if (!text) return true;

  const words = text.split(/\s+/).filter(Boolean);
  const alphaChars = (text.match(/[A-Za-z\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/g) || []).length;

  if (text.length <= 2 || alphaChars <= 1) return true;
  if (words.length <= 1 && text.length < 8) return true;

  return false;
};

const runAnalyzeRequest = async ({ fileUri, mediaType, language, authHeaders }) => {
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
      headers: authHeaders || {},
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
    const authHeaders = await getFirebaseAuthHeaders({
      includeContentType: false,
      forceRefresh: false,
      required: true,
    });

    const preferredLanguage = normalizeLanguage(language);
    const languageAttempts = mediaType === 'audio'
      ? Array.from(new Set([preferredLanguage, 'hi', 'en']))
      : [preferredLanguage];

    let data = null;
    let lastError = null;

    for (const lang of languageAttempts) {
      try {
        data = await runAnalyzeRequest({ fileUri, mediaType, language: lang, authHeaders });

        if (mediaType === 'audio' && isLowSignalTranscription(data?.transcription)) {
          throw new Error(`Transcription quality is too low for language: ${lang}`);
        }

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
      transcription_language: data.transcription_language,
      transcription_confidence: data.transcription_confidence,
    };
  } catch (error) {
    console.error('AI processing error:', error);
    const isTimeout = error.name === 'AbortError';
    const isNetwork = error.message === 'Network request failed';
    const timeoutSeconds = mediaType === 'audio' ? 180 : 90;
    let errorMsg = error.message || 'Failed to analyze media';
    const normalizedError = String(errorMsg).toLowerCase();

    if (normalizedError.includes('application not found')) {
      errorMsg = `Backend deployment not found at ${API_CONFIG.DJANGO_URL}. Update PRODUCTION_API_URL to an active Railway URL (current default: https://setu.up.railway.app).`;
    }

    if (isNetwork) {
      errorMsg = `Cannot reach backend at ${API_CONFIG.DJANGO_URL}. Check network connectivity and verify the Railway domain is active.`;
    } else if (isTimeout) {
      errorMsg = `AI analysis timed out after ${timeoutSeconds} seconds. Please try again.`;
    } else if (
      normalizedError.includes('quota exceeded') ||
      normalizedError.includes('rate limit') ||
      normalizedError.includes('429')
    ) {
      errorMsg = 'AI service is temporarily busy (rate limit reached). Please retry after a few seconds.';
    } else if (
      normalizedError.includes('transcription quality is too low') ||
      normalizedError.includes('transcription too short') ||
      normalizedError.includes('speak clearly')
    ) {
      errorMsg = 'Audio was not clear enough for transcription. Please re-record in a quieter place and speak clearly for 8-12 seconds.';
    } else if (!errorMsg || errorMsg.trim().split(/\s+/).length < 3) {
      errorMsg = 'Unable to analyze media right now. Please try again.';
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
