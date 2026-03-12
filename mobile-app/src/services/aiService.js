// AI Analysis Service
// Calls Django backend for AI-powered image/audio analysis
// Files are uploaded directly to Django — NO Firebase Storage needed

import { API_CONFIG } from '../config/api';
import { auth } from '../config/firebase';

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
    
    const url = `${API_CONFIG.DJANGO_URL}${API_CONFIG.AI_ANALYZE_ENDPOINT}`;

    // Build multipart form data — upload file directly to Django
    const formData = new FormData();
    
    // Determine file extension and MIME type
    let fileName, mimeType;
    if (mediaType === 'audio') {
      fileName = `recording_${Date.now()}.m4a`;
      mimeType = 'audio/mp4';
    } else {
      fileName = `photo_${Date.now()}.jpg`;
      mimeType = 'image/jpeg';
    }
    
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    });
    formData.append('media_type', mediaType);
    formData.append('language', language);

    // AbortController for timeout (60 seconds for file upload + AI processing)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Do NOT set Content-Type — fetch sets it automatically with boundary for FormData
        ...(idToken && { 'Authorization': `Bearer ${idToken}` }),
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'AI analysis failed');
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
