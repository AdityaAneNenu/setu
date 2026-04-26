// API Service Layer for SETU Mobile App
// =======================================
// Uses Firebase Firestore directly with Django sync
// Primary: Firebase Firestore, Secondary: Django/Railway PostgreSQL

<<<<<<< HEAD
import { villagesService, gapsService, uploadService } from "./firestore";
=======
import { villagesService, gapsService } from "./firestore";
>>>>>>> 6a0a424 (Many changes in verification modules.)
import {
  loginUser,
  logoutUser,
  getCurrentUser,
  onAuthStateChange,
} from "./authService";
import { API_CONFIG } from "../config/api";
import {
<<<<<<< HEAD
  addToSyncQueue,
  processSyncQueue,
  getSyncQueueStatus,
} from "./syncQueue";
=======
  createOfflineComplaint,
  createOfflineResolution,
  getOfflineSyncSummary,
  findComplaintByPhotoHash,
} from "./offlineDb";
import { persistCaptureFile } from "./offlineFileStore";
import { triggerOfflineSyncNow } from "./offlineSyncEngine";
>>>>>>> 6a0a424 (Many changes in verification modules.)

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
<<<<<<< HEAD
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
=======
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
>>>>>>> 6a0a424 (Many changes in verification modules.)
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

<<<<<<< HEAD
=======
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

>>>>>>> 6a0a424 (Many changes in verification modules.)
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
<<<<<<< HEAD
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
=======
>>>>>>> 6a0a424 (Many changes in verification modules.)
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
<<<<<<< HEAD
  // Process all pending sync operations
  processQueue: () => processSyncQueue(),

  // Get sync queue status
  getStatus: () => getSyncQueueStatus(),
=======
  processQueue: () => triggerOfflineSyncNow(),

  getStatus: () => getOfflineSyncSummary(),
>>>>>>> 6a0a424 (Many changes in verification modules.)
};

export default {
  villagesApi,
  gapsApi,
  authApi,
  closureApi,
<<<<<<< HEAD
  complaintsApi,
=======
>>>>>>> 6a0a424 (Many changes in verification modules.)
  dashboardApi,
  syncApi,
};
