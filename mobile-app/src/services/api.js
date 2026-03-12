// API Service Layer for SETU Mobile App
// =======================================
// Uses Firebase Firestore directly with Django sync
// Primary: Firebase Firestore, Secondary: Django/Railway PostgreSQL

import {
  villagesService,
  gapsService,
  uploadService,
  voiceService,
} from './firestore';
import { loginUser, logoutUser, getCurrentUser, onAuthStateChange } from './authService';
import { API_CONFIG } from '../config/api';
import { addToSyncQueue, processSyncQueue, getSyncQueueStatus } from './syncQueue';

// ============================================
// VILLAGE API
// ============================================
export const villagesApi = {
  getAll: () => villagesService.getAll(),
  getById: (id) => villagesService.getById(id),
  getWithStats: () => villagesService.getWithStats(),
};

// ============================================
// GAPS API
// ============================================
export const gapsApi = {
  // Submit a new gap (with optional media upload)
  // Dual-write: Creates in Firestore first, then syncs to Django/Railway PostgreSQL
  submit: async (gapData) => {
    let audioUrl = null;
    let imageUrl = null;
    const tempId = `temp_${Date.now()}`;

    // Use already uploaded URLs if provided (from AI processing)
    if (gapData.audioUrl) {
      audioUrl = gapData.audioUrl;
    } else if (gapData.audioUri) {
      // Upload audio file if URI provided and not already uploaded
      audioUrl = await uploadService.uploadAudio(gapData.audioUri, tempId);
    }

    if (gapData.imageUrl) {
      imageUrl = gapData.imageUrl;
    } else if (gapData.imageUri) {
      // Upload image file if URI provided and not already uploaded
      imageUrl = await uploadService.uploadImage(gapData.imageUri, tempId);
    }

    // Prepare gap data
    const gapPayload = {
      village_id: gapData.village_id,
      village_name: gapData.village_name,
      description: gapData.description || '',
      gap_type: gapData.gap_type || 'other',
      severity: gapData.severity || 'medium',
      input_method: gapData.input_method || 'text',
      recommendations: gapData.recommendations || '',
      audio_url: audioUrl,
      image_url: imageUrl,
      latitude: gapData.latitude || null,
      longitude: gapData.longitude || null,
    };

    // Step 1: Create gap in Firestore (primary storage)
    const result = await gapsService.create(gapPayload);
    const firestoreId = result.id;

    // Step 2: Sync to Django/Railway PostgreSQL (secondary storage)
    // This ensures data is in the main database for analytics and web dashboard
    let djangoId = null;
    const currentUser = await getCurrentUser();
    const syncPayload = {
      firestore_id: firestoreId,
      ...gapPayload,
      submitted_by: currentUser?.uid || null,
      submitted_by_email: currentUser?.email || null,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/sync/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(syncPayload),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (response.ok) {
        const syncResult = await response.json();
        if (syncResult.success) {
          djangoId = syncResult.django_id;
          console.log(`Gap synced to Django: ID ${djangoId}`);
        }
      } else {
        // Server responded with error - add to retry queue
        await addToSyncQueue({
          type: 'gap_create',
          payload: syncPayload,
        });
        console.warn('Django sync failed, added to retry queue');
      }
    } catch (syncError) {
      // Network error or timeout - add to retry queue
      await addToSyncQueue({
        type: 'gap_create',
        payload: syncPayload,
      });
      console.warn('Django sync error, added to retry queue:', syncError.message);
    }

    return {
      success: true,
      message: 'Gap created successfully',
      id: firestoreId,
      django_id: djangoId,
      gap_type: gapData.gap_type,
      severity: gapData.severity,
      description: gapData.description,
    };
  },

  getAll: (filters) => gapsService.getAll(filters),
  getDetail: (id) => gapsService.getById(id),
  getById: (id) => gapsService.getById(id),
  
  // Update gap status with dual-write to Django
  updateStatus: async (id, status, djangoId = null) => {
    // Step 1: Update in Firestore
    await gapsService.updateStatus(id, status);

    // Step 2: Sync to Django if we have the django_id
    if (djangoId) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/${id}/status/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status,
              django_id: djangoId,
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (response.ok) {
          console.log(`Gap status synced to Django: ${status}`);
        }
      } catch (syncError) {
        console.warn('Django status sync warning:', syncError.message);
      }
    }

    return { success: true, status };
  },
  
  getStats: () => gapsService.getStats(),
};

// ============================================
// AUTH API
// ============================================
export const authApi = {
  login: (email, password) => loginUser(email, password),
  logout: () => logoutUser(),
  getCurrentUser: () => getCurrentUser(),
  onAuthStateChange: (callback) => onAuthStateChange(callback),
};

// ============================================
// VOICE API
// ============================================
export const voiceApi = {
  logVerification: (data) => voiceService.logVerification(data),
  getLogs: (gapId) => voiceService.getLogs(gapId),
  getVerificationLogs: (gapId) => voiceService.getLogs(gapId),
  submitVerification: async (gapId, data) => {
    // Try Django voice verification endpoint for real biometric comparison
    try {
      if (data.localUri) {
        const formData = new FormData();
        formData.append('audio_file', {
          uri: data.localUri,
          name: `verification_${gapId}_${Date.now()}.m4a`,
          type: 'audio/mp4',
        });
        formData.append('verified_by', data.verified_by || 'mobile_user');
        formData.append('notes', data.notes || '');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
          `${API_CONFIG.DJANGO_URL}/api/voice/${gapId}/submit/`,
          {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Django returned real voice comparison results
            const v = result.verification || result;
            // Also log to Firestore for offline access
            await voiceService.logVerification({
              gap_id: gapId,
              audio_url: data.audio_url,
              similarity_score: v.similarity_score || 0,
              is_match: v.is_match || false,
              confidence: v.confidence || 'low',
              verified_by: data.verified_by || 'mobile_user',
              notes: data.notes || '',
            });
            return {
              success: true,
              is_match: v.is_match || false,
              similarity_score: v.similarity_score || 0,
              confidence: v.confidence || 'low',
              message: v.message || 'Voice verification complete',
              can_resolve: result.can_resolve || false,
            };
          }
        }
      }
    } catch (djangoError) {
      // Django unavailable, falling back to Firestore
    }

    // Fallback: Log to Firestore without real comparison
    const logResult = await voiceService.logVerification({
      gap_id: gapId,
      audio_url: data.audio_url,
      similarity_score: 0,
      is_match: false,
      confidence: 'pending',
      verified_by: data.verified_by || '',
      notes: data.notes || 'Pending manual review - Django backend unavailable',
      pending_review: true,
    });
    return {
      success: true,
      is_match: false,
      similarity_score: 0,
      confidence: 'pending',
      message: 'Verification logged for manual review. Voice comparison requires backend connectivity.',
      log_id: logResult.id,
      pending_review: true,
      can_resolve: false,
    };
  },
  resolveGap: async (gapId) => {
    await gapsService.updateStatus(gapId, 'resolved');
    return { success: true, message: 'Gap resolved successfully' };
  },
};

// ============================================
// DASHBOARD API
// ============================================
export const dashboardApi = {
  getStats: async (userId = null) => {
    const stats = await gapsService.getStats(userId);
    return {
      total_gaps: stats.total_gaps || 0,
      open_gaps: stats.open_gaps || 0,
      in_progress_gaps: stats.in_progress_gaps || 0,
      resolved_gaps: stats.resolved_gaps || 0,
      high_severity: stats.high_severity || 0,
      medium_severity: stats.medium_severity || 0,
      low_severity: stats.low_severity || 0,
      gaps_by_type: stats.gaps_by_type || {},
    };
  },
};

// ============================================
// SYNC API - Process pending Django syncs
// ============================================
export const syncApi = {
  // Process all pending sync operations
  processQueue: () => processSyncQueue(),
  
  // Get sync queue status
  getStatus: () => getSyncQueueStatus(),
};

export default {
  villagesApi,
  gapsApi,
  authApi,
  voiceApi,
  dashboardApi,
  syncApi,
};
