// Cloudinary Upload Service for SETU Mobile App
// ================================================
// Free alternative to Firebase Storage
// Supports audio, image, and document uploads
//
// SETUP:
// 1. Go to https://cloudinary.com → Sign up (free)
// 2. Go to Settings → Upload → Upload Presets
// 3. Click "Add upload preset"
// 4. Set "Signing Mode" to "Unsigned"
// 5. Set folder to "setu-gaps" (optional)
// 6. Save and copy the preset name
// 7. Update UPLOAD_PRESET below with your preset name

import Constants from 'expo-constants';

// Resolve extra values across Expo Go / dev build / EAS build runtimes.
const resolvedExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest?.extra ||
  Constants.manifest2?.extra ||
  {};

// These are upload preset identifiers (not secrets). Keep defaults to avoid startup crashes.
const DEFAULT_CLOUD_NAME = 'djbelxket';
const DEFAULT_UPLOAD_PRESET = 'setu_unsigned';

const CLOUD_NAME = resolvedExtra.cloudinaryCloudName || DEFAULT_CLOUD_NAME;
const UPLOAD_PRESET = resolvedExtra.cloudinaryUploadPreset || DEFAULT_UPLOAD_PRESET;

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

/**
 * Upload a file to Cloudinary
 * @param {string} fileUri - Local file URI (from camera, recorder, etc.)
 * @param {string} resourceType - 'image', 'video', or 'auto' (use 'video' for audio files)
 * @param {string} folder - Cloudinary folder to organize files
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadToCloudinary = async (fileUri, resourceType = 'auto', folder = 'setu-gaps') => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration missing. Set cloudinaryCloudName and cloudinaryUploadPreset in app config extra.');
  }

  const filename = fileUri.split('/').pop() || `file_${Date.now()}`;

  // Determine content type
  let contentType = 'application/octet-stream';
  if (resourceType === 'image' || filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    contentType = 'image/jpeg';
  } else if (resourceType === 'video' || filename.match(/\.(m4a|mp3|wav|aac|ogg|mp4)$/i)) {
    contentType = 'audio/mp4';
  }

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: filename,
    type: contentType,
  });
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  // Cloudinary treats audio as 'video' resource type
  const uploadType = resourceType === 'audio' ? 'video' : resourceType;
  const url = `${CLOUDINARY_URL}/${uploadType}/upload`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Upload failed (${response.status})`);
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
};

// ============================================
// Convenience wrappers (drop-in replacements for uploadService)
// ============================================

/**
 * Upload audio file → returns download URL
 */
export const uploadAudio = async (fileUri, gapId) => {
  const result = await uploadToCloudinary(fileUri, 'video', `setu-gaps/audio/gap_${gapId}`);
  return result.url;
};

/**
 * Upload image file → returns download URL
 */
export const uploadImage = async (fileUri, gapId) => {
  const result = await uploadToCloudinary(fileUri, 'image', `setu-gaps/images/gap_${gapId}`);
  return result.url;
};

/**
 * Upload voice verification sample → returns download URL
 */
export const uploadVoiceSample = async (fileUri, gapId) => {
  const result = await uploadToCloudinary(fileUri, 'video', `setu-gaps/voice_samples/gap_${gapId}`);
  return result.url;
};

// Drop-in replacement object matching Firebase uploadService interface
export const uploadService = {
  uploadAudio,
  uploadImage,
  uploadVoiceSample,
};

export default uploadService;
