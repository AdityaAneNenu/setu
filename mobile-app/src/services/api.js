// API Service Layer for SETU Mobile App
// =======================================
// Uses Firebase Firestore directly with Django sync
// Primary: Firebase Firestore, Secondary: Django/Railway PostgreSQL

import { villagesService, gapsService, uploadService } from "./firestore";
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  onAuthStateChange,
} from "./authService";
import { API_CONFIG } from "../config/api";
import {
  addToSyncQueue,
  processSyncQueue,
  getSyncQueueStatus,
} from "./syncQueue";

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
      description: gapData.description || "",
      gap_type: gapData.gap_type || "other",
      severity: gapData.severity || "medium",
      input_method: gapData.input_method || "text",
      recommendations: gapData.recommendations || "",
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
    const currentUser = getCurrentUser();
    const syncPayload = {
      firestore_id: firestoreId,
      ...gapPayload,
      submitted_by: currentUser?.uid || null,
      submitted_by_email: currentUser?.email || null,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const headers = await getFirebaseAuthHeaders();

      const response = await fetch(
        `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/sync/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(syncPayload),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (response.ok) {
        const syncResult = await response.json();
        if (syncResult.success) {
          djangoId = syncResult.django_id;
          console.log(`Gap synced to Django: ID ${djangoId}`);
          // Write django_id back to Firestore so ClosurePhotoScreen can use it
          try {
            await gapsService.updateDjangoId(firestoreId, djangoId);
          } catch (fsErr) {
            console.warn(
              "Could not store django_id on Firestore:",
              fsErr.message,
            );
          }
        }
      } else {
        // Log response status for debugging
        const errorText = await response.text().catch(() => "Unknown error");
        console.warn(`Django sync failed (${response.status}): ${errorText}`);
        // Server responded with error - add to retry queue
        await addToSyncQueue({
          type: "gap_create",
          payload: syncPayload,
        });
      }
    } catch (syncError) {
      // Network error or timeout - add to retry queue
      await addToSyncQueue({
        type: "gap_create",
        payload: syncPayload,
      });
      console.warn(
        "Django sync error, added to retry queue:",
        syncError.message,
      );
    }

    return {
      success: true,
      message: "Gap created successfully",
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
// COMPLAINT VERIFICATION API (mobile)
// ============================================
export const complaintsApi = {
  submitWithVerification: async (payload) => {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (key === "complaintee_photo" || key === "audio_file") {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    });

    const headers = await getFirebaseAuthHeaders({ includeContentType: false });
    const response = await fetch(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/submit/`,
      {
        method: "POST",
        headers,
        body: formData,
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || `Complaint submit failed (${response.status})`);
    }
    return result;
  },

  verifyAndClose: async (complaintId, payload) => {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (key === "closure_selfie") {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    });

    const headers = await getFirebaseAuthHeaders({ includeContentType: false });
    const response = await fetch(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/${complaintId}/verify-close/`,
      {
        method: "POST",
        headers,
        body: formData,
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || `Complaint verify failed (${response.status})`);
    }
    return result;
  },

  getInProgress: async () => {
    const headers = await getFirebaseAuthHeaders();
    const response = await fetch(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/in-progress/`,
      { headers },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(
        result?.error || `Failed to fetch in-progress complaints (${response.status})`,
      );
    }
    const inProgressFromNew = result.in_progress || [];
    const resolvedFromNew = result.resolved || [];

    // Backward compatibility: older backend returned a flat `complaints` list.
    if (
      inProgressFromNew.length === 0 &&
      resolvedFromNew.length === 0 &&
      Array.isArray(result.complaints)
    ) {
      const all = result.complaints;
      return {
        inProgress: all.filter((item) => item?.status !== "case_closed"),
        resolved: all.filter((item) => item?.status === "case_closed"),
      };
    }

    return {
      inProgress: inProgressFromNew,
      resolved: resolvedFromNew,
    };
  },

  resolvePhotoComplaint: async (complaintId, payload) => {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (key === "resolution_letter_image") {
        formData.append(key, value);
      } else {
        formData.append(key, String(value));
      }
    });

    const headers = await getFirebaseAuthHeaders({ includeContentType: false });
    const response = await fetch(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/${complaintId}/resolve-photo/`,
      {
        method: "POST",
        headers,
        body: formData,
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(
        result?.error || `Photo complaint resolution failed (${response.status})`,
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
  // Process all pending sync operations
  processQueue: () => processSyncQueue(),

  // Get sync queue status
  getStatus: () => getSyncQueueStatus(),
};

export default {
  villagesApi,
  gapsApi,
  authApi,
  closureApi,
  complaintsApi,
  dashboardApi,
  syncApi,
};
