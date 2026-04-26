// API Service Layer for SETU Mobile App
// =======================================
// Uses Firebase Firestore directly with Django sync
// Primary: Firebase Firestore, Secondary: Django/Railway PostgreSQL

import { villagesService, gapsService } from "./firestore";
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  onAuthStateChange,
} from "./authService";
import { API_CONFIG } from "../config/api";
import {
  createOfflineComplaint,
  createOfflineResolution,
  getOfflineSyncSummary,
  findComplaintByPhotoHash,
} from "./offlineDb";
import { persistCaptureFile } from "./offlineFileStore";
import { triggerOfflineSyncNow } from "./offlineSyncEngine";

// Helper to get Firebase auth token for Django API calls
const getFirebaseAuthHeaders = async ({ includeContentType = true } = {}) => {
  const headers = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const currentUser = getCurrentUser();
    if (currentUser) {
      const token = await currentUser.getIdToken();
      headers.Authorization = `Firebase ${token}`;
    }
  } catch (error) {
    console.warn("Could not get Firebase token:", error.message);
  }

  return headers;
};

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
  // Offline-first complaint capture.
  // Captures locally first and syncs in background when network is available.
  submit: async (gapData) => {
    if (!gapData?.imageUri) {
      throw new Error("Surrounding photo is required before saving complaint offline.");
    }
    if (gapData?.latitude == null || gapData?.longitude == null) {
      throw new Error("GPS location is required before saving complaint offline.");
    }

    const offlineLocalId = gapData.local_id || `cmp_${Date.now()}`;

    const persistedPhoto = await persistCaptureFile({
      sourceUri: gapData.imageUri,
      bucket: "complaint_photos",
      localId: `${offlineLocalId}_photo`,
      fallbackExt: "jpg",
    });

    let persistedAudio = null;
    if (gapData.audioUri) {
      persistedAudio = await persistCaptureFile({
        sourceUri: gapData.audioUri,
        bucket: "complaint_audio",
        localId: `${offlineLocalId}_audio`,
        fallbackExt: "m4a",
      });
    }

    const duplicatePhoto = await findComplaintByPhotoHash(persistedPhoto.md5);

    const capture = await createOfflineComplaint({
      local_id: offlineLocalId,
      village_id: gapData.village_id,
      village_name: gapData.village_name,
      description: gapData.description || "",
      gap_type: gapData.gap_type || "other",
      severity: gapData.severity || "medium",
      input_method: gapData.input_method || "image",
      photo_uri: persistedPhoto.uri,
      photo_md5: persistedPhoto.md5,
      audio_uri: persistedAudio?.uri || null,
      latitude: gapData.latitude,
      longitude: gapData.longitude,
      gps_accuracy: gapData.gps_accuracy ?? null,
      gps_samples_json: gapData.gps_samples_json || null,
    });

    triggerOfflineSyncNow().catch(() => {});

    return {
      success: true,
      message: "Captured offline. Will sync automatically when internet is available.",
      local_id: capture.local_id,
      sync_status: capture.sync_status,
      warning: duplicatePhoto
        ? "Same image appears to be reused from a previous complaint."
        : null,
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
        const headers = await getFirebaseAuthHeaders();

        const response = await fetch(
          `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/${id}/status/`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              status,
              django_id: djangoId,
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);

        if (response.ok) {
          console.log(`Gap status synced to Django: ${status}`);
        }
      } catch (syncError) {
        console.warn("Django status sync warning:", syncError.message);
      }
    }

    return { success: true, status };
  },

  getMobileGaps: async () => {
    const headers = await getFirebaseAuthHeaders();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const endpoint = `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/`;
    console.log("Fetching mobile gaps from:", endpoint);
    const response = await fetch(endpoint, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const result = await response.json().catch(() => ({}));
    console.log("API RESPONSE:", result);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || `Failed to fetch gaps (${response.status})`);
    }

    return {
      open: result.open || [],
      in_progress: result.in_progress || [],
      inProgress: result.in_progress || [],
      resolved: result.resolved || [],
    };
  },

  resolveMobileGap: async (
    gapId,
    {
      proofPhotoUri,
      latitude,
      longitude,
      personPhotoUri = null,
      gpsAccuracy = null,
      gpsSamples = null,
      complaintLocalId = null,
    } = {},
  ) => {
    if (!proofPhotoUri) {
      throw new Error("Proof photo is required before resolving a gap.");
    }
    if (latitude == null || longitude == null) {
      throw new Error("GPS coordinates are required before resolving a gap.");
    }

    const localId = `res_${Date.now()}`;
    const closurePhoto = await persistCaptureFile({
      sourceUri: proofPhotoUri,
      bucket: "resolution_photos",
      localId: `${localId}_proof`,
      fallbackExt: "jpg",
    });

    let personPhoto = null;
    if (personPhotoUri) {
      personPhoto = await persistCaptureFile({
        sourceUri: personPhotoUri,
        bucket: "resolution_people",
        localId: `${localId}_person`,
        fallbackExt: "jpg",
      });
    }

    const capture = await createOfflineResolution({
      local_id: localId,
      complaint_local_id: complaintLocalId || null,
      complaint_server_id: gapId || null,
      closure_photo_uri: closurePhoto.uri,
      closure_photo_md5: closurePhoto.md5,
      person_photo_uri: personPhoto?.uri || null,
      latitude,
      longitude,
      gps_accuracy: gpsAccuracy,
      gps_samples_json: gpsSamples ? JSON.stringify(gpsSamples) : null,
    });

    triggerOfflineSyncNow().catch(() => {});

    return {
      success: true,
      status: "PENDING_UPLOAD",
      message: "Resolution captured offline and queued for sync.",
      local_id: capture.local_id,
      sync_status: capture.sync_status,
    };
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
// CLOSURE API - Close gap with geo-tagged photo proof
// ============================================
export const closureApi = {
  closeWithPhotoProof: async (
    djangoGapId,
    { closurePhotoUrl, closureSelfieUrl = null, latitude, longitude },
  ) => {
    if (!djangoGapId) {
      throw new Error(
        "Gap has not synced to server yet. Please wait and try again.",
      );
    }
    if (!closurePhotoUrl) {
      throw new Error("Closure photo URL is required.");
    }

    const headers = await getFirebaseAuthHeaders();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      `${API_CONFIG.DJANGO_URL}/api/gaps/${djangoGapId}/close-with-proof/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          closure_photo_url: closurePhotoUrl,
          closure_selfie_url: closureSelfieUrl,
          closure_latitude: latitude,
          closure_longitude: longitude,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    let result = null;
    let rawText = "";
    try {
      result = await response.json();
    } catch (_) {
      result = null;
      rawText = await response.text().catch(() => "");
    }

    if (!response.ok || !result?.success) {
      if (response.status === 404) {
        throw new Error(
          `Gap closure failed (404). Gap ${djangoGapId} was not found on ${API_CONFIG.DJANGO_URL}. ` +
            "This usually means the app is pointing to a different backend than the one where the gap was synced.",
        );
      }
      throw new Error(
        result?.error ||
          result?.message ||
          rawText ||
          `Failed to close gap (${response.status})`,
      );
    }

    return result;
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
  processQueue: () => triggerOfflineSyncNow(),

  getStatus: () => getOfflineSyncSummary(),
};

export default {
  villagesApi,
  gapsApi,
  authApi,
  closureApi,
  dashboardApi,
  syncApi,
};
