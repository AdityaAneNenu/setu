/**
 * Cloudinary Upload Service for Next.js Frontend
 * =================================================
 * Free alternative to Firebase Storage.
 * 
 * SETUP:
 * 1. Go to https://cloudinary.com → Sign up (free)
 * 2. Go to Settings → Upload → Upload Presets
 * 3. Click "Add upload preset" → Set "Signing Mode" to "Unsigned"
 * 4. Set folder to "setu-gaps" (optional)
 * 5. Save and copy the preset name
 * 6. Update UPLOAD_PRESET below
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'djbelxket';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'setu_unsigned'; // Create this in Cloudinary Dashboard

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

/**
 * Upload a File object to Cloudinary (browser/Next.js)
 * @param file - File or Blob object
 * @param resourceType - 'image', 'video' (for audio), or 'auto'
 * @param folder - Cloudinary folder
 * @returns Promise<string> - Secure URL of uploaded file
 */
export async function uploadFile(
  file: File | Blob,
  resourceType: 'image' | 'video' | 'auto' = 'auto',
  folder: string = 'setu-gaps'
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const url = `${CLOUDINARY_URL}/${resourceType}/upload`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Cloudinary upload failed (${response.status})`);
  }

  return data.secure_url;
}

/**
 * Upload audio file → returns URL
 */
export async function uploadAudio(file: File, gapId?: string | number): Promise<string> {
  const folder = gapId ? `setu-gaps/audio/gap_${gapId}` : 'setu-gaps/audio';
  return uploadFile(file, 'video', folder); // Cloudinary treats audio as 'video'
}

/**
 * Upload image file → returns URL
 */
export async function uploadImage(file: File, gapId?: string | number): Promise<string> {
  const folder = gapId ? `setu-gaps/images/gap_${gapId}` : 'setu-gaps/images';
  return uploadFile(file, 'image', folder);
}

/**
 * Upload voice verification sample → returns URL
 */
export async function uploadVoiceSample(file: File, gapId: string | number): Promise<string> {
  const folder = `setu-gaps/voice_samples/gap_${gapId}`;
  return uploadFile(file, 'video', folder);
}
