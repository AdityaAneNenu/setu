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
  getFirebaseAuthHeaders,
  isAuthDeniedStatus,
  AuthSessionError,
} from "./firebaseAuthSession";
import {
  createOfflineComplaint,
  createOfflineResolution,
  getOfflineSyncSummary,
  findComplaintByPhotoHash,
  buildUuid,
} from "./offlineDb";
import { persistCaptureFile } from "./offlineFileStore";
import { triggerOfflineSyncNow } from "./offlineSyncEngine";

const isFiniteCoordinate = (value, min, max) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max;
};

class ApiRequestError extends Error {
  constructor(message, { status = null, url = "", method = "GET", payload = null, raw = "" } = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.url = url;
    this.method = method;
    this.payload = payload;
    this.raw = raw;
  }
}

const parseResponseBody = async (response) => {
  let payload = null;
  let raw = "";

  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
    raw = await response.text().catch(() => "");
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    }
  }

  return { payload, raw };
};

const toApiErrorMessage = ({ status, payload, raw }) => {
  if (payload?.error) return payload.error;
  if (payload?.message) return payload.message;
  if (Number(status) === 401) {
    return "Session expired, please login again";
  }
  if (Number(status) === 403) {
    return "Not authorized to perform this action.";
  }
  if (raw) {
    return raw;
  }
  return `Request failed (${status})`;
};

const buildApiRequestError = ({ status, url, method, payload, raw }) =>
  new ApiRequestError(toApiErrorMessage({ status, payload, raw }), {
    status,
    url,
    method,
    payload,
    raw,
  });

const getAuthorizationHeader = (headers = {}) => {
  if (!headers || typeof headers !== "object") {
    return "";
  }
  return String(headers.Authorization || headers.authorization || "").trim();
};

const previewAuthorizationHeader = (headerValue) => {
  const raw = String(headerValue || "").trim();
  if (!raw) {
    return "<none>";
  }
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return raw.length > 24 ? `${raw.slice(0, 24)}...` : raw;
  }
  const token = raw.slice("Bearer ".length).trim();
  if (!token) {
    return "Bearer <empty>";
  }
  if (token.length <= 16) {
    return `Bearer ${token.slice(0, 4)}...`;
  }
  return `Bearer ${token.slice(0, 12)}...${token.slice(-8)}`;
};

const summarizeHeadersForLog = (headers = {}) => {
  if (!headers || typeof headers !== "object") {
    return {};
  }
  const summary = { ...headers };
  const authHeader = getAuthorizationHeader(headers);
  if (authHeader) {
    if ("Authorization" in summary) {
      summary.Authorization = previewAuthorizationHeader(authHeader);
    }
    if ("authorization" in summary) {
      summary.authorization = previewAuthorizationHeader(authHeader);
    }
  }
  return summary;
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const method = String(options?.method || "GET").toUpperCase();
  try {
    const requestHeaders = options?.headers || {};
    const authorizationHeader = getAuthorizationHeader(requestHeaders);
    console.info("[api-debug] Request headers:", {
      url,
      method,
      hasAuthorization: Boolean(authorizationHeader),
      authorizationPreview: previewAuthorizationHeader(authorizationHeader),
      headers: summarizeHeadersForLog(requestHeaders),
    });
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    console.info("[api-debug] Response status:", {
      url,
      method,
      status: response.status,
      ok: response.ok,
    });
    const { payload, raw } = await parseResponseBody(response);
    if (!response.ok || payload?.success === false) {
      const context = {
        status: response.status,
        url,
        method,
        payload: payload || null,
        raw: raw || "",
      };
      console.warn("[api] Request failed:", context);
      throw buildApiRequestError(context);
    }
    return payload || {};
  } catch (error) {
    if (error instanceof ApiRequestError || error instanceof AuthSessionError) {
      throw error;
    }
    if (error?.name === "AbortError") {
      throw new ApiRequestError(`Request timed out after ${timeoutMs}ms`, {
        status: null,
        url,
        method,
      });
    }
    throw new ApiRequestError(error?.message || "Network request failed", {
      status: null,
      url,
      method,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const toErrorText = (error) =>
  [
    error?.message,
    error?.payload?.detail,
    error?.payload?.error,
    error?.payload?.message,
    error?.raw,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const looksLikePermissionDenied = (error) => {
  if (Number(error?.status) !== 403) return false;
  const text = toErrorText(error);
  const permissionHints = [
    "forbidden",
    "not authorized",
    "not authorised",
    "permission",
    "access denied",
    "insufficient",
  ];
  const authHints = [
    "token",
    "credential",
    "session expired",
    "login",
    "signature",
    "auth",
    "expired",
  ];
  const hasPermissionHint = permissionHints.some((hint) => text.includes(hint));
  const hasAuthHint = authHints.some((hint) => text.includes(hint));
  return hasPermissionHint && !hasAuthHint;
};

const fetchJsonWithAuthRetry = async (url, requestBuilder, timeoutMs = 30000) => {
  try {
    const request = await requestBuilder(false);
    return await fetchJsonWithTimeout(url, request, timeoutMs);
  } catch (error) {
    if (!isAuthDeniedStatus(error?.status)) {
      throw error;
    }
    if (looksLikePermissionDenied(error)) {
      throw buildApiRequestError({
        status: 403,
        url,
        method: error?.method || "GET",
        payload: error?.payload || null,
        raw: error?.raw || "",
      });
    }
    console.warn("[api] Auth rejected, retrying with refreshed Firebase token:", {
      url,
      status: error?.status,
    });
    const retryRequest = await requestBuilder(true);
    try {
      return await fetchJsonWithTimeout(url, retryRequest, timeoutMs);
    } catch (retryError) {
      if (isAuthDeniedStatus(retryError?.status)) {
        throw new AuthSessionError("Session expired, please login again", {
          code: "AUTH_RETRY_FAILED",
          cause: retryError,
          status: retryError?.status || null,
        });
      }
      throw retryError;
    }
  }
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
    if (
      !isFiniteCoordinate(gapData?.latitude, -90, 90) ||
      !isFiniteCoordinate(gapData?.longitude, -180, 180)
    ) {
      throw new Error("GPS location is required before saving complaint offline.");
    }

    const clientSubmissionId = gapData.client_submission_id || gapData.local_id || `cmp_${buildUuid()}`;
    const offlineLocalId = clientSubmissionId;

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
      idempotency_key: clientSubmissionId,
      village_id: gapData.village_id,
      village_name: gapData.village_name,
      description: gapData.description || "",
      gap_type: gapData.gap_type || "other",
      severity: gapData.severity || "medium",
      input_method: gapData.input_method || "image",
      photo_uri: persistedPhoto.uri,
      photo_md5: persistedPhoto.md5,
      audio_uri: persistedAudio?.uri || null,
      latitude: Number(gapData.latitude),
      longitude: Number(gapData.longitude),
      gps_accuracy: gapData.gps_accuracy ?? null,
      gps_samples_json: gapData.gps_samples_json || null,
    });

    triggerOfflineSyncNow().catch((error) => {
      console.warn("Background sync trigger failed after offline capture:", error?.message || error);
    });

    return {
      success: true,
      message: "Captured offline. Will sync automatically when internet is available.",
      local_id: capture.local_id,
      client_submission_id: clientSubmissionId,
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
    if (status === "resolved") {
      throw new Error("Resolved status requires proof photo and GPS verification.");
    }

    if (djangoId) {
      await fetchJsonWithAuthRetry(
        `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/${id}/status/`,
        async (forceRefresh) => ({
          method: "POST",
          headers: await getFirebaseAuthHeaders({ forceRefresh }),
          body: JSON.stringify({
            status,
            django_id: djangoId,
          }),
        }),
        10000,
      );
    }

    await gapsService.updateStatus(id, status);

    return { success: true, status };
  },

  getMobileGaps: async () => {
    const endpoint = `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/`;
    const result = await fetchJsonWithAuthRetry(
      endpoint,
      async (forceRefresh) => ({
        headers: await getFirebaseAuthHeaders({ forceRefresh }),
      }),
      20000,
    );

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
    if (
      !isFiniteCoordinate(latitude, -90, 90) ||
      !isFiniteCoordinate(longitude, -180, 180)
    ) {
      throw new Error("GPS coordinates are required before resolving a gap.");
    }

    const clientSubmissionId = `res_${buildUuid()}`;
    const localId = clientSubmissionId;
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
      idempotency_key: clientSubmissionId,
      complaint_local_id: complaintLocalId || null,
      complaint_server_id: gapId || null,
      closure_photo_uri: closurePhoto.uri,
      closure_photo_md5: closurePhoto.md5,
      person_photo_uri: personPhoto?.uri || null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      gps_accuracy: gpsAccuracy,
      gps_samples_json: gpsSamples ? JSON.stringify(gpsSamples) : null,
    });

    triggerOfflineSyncNow().catch((error) => {
      console.warn("Background sync trigger failed after resolution capture:", error?.message || error);
    });

    return {
      success: true,
      status: "PENDING_UPLOAD",
      message: "Resolution captured offline and queued for sync.",
      local_id: capture.local_id,
      client_submission_id: clientSubmissionId,
      sync_status: capture.sync_status,
    };
  },

  getStats: () => gapsService.getStats(),
};

// ============================================
// AUTH API
// ============================================
export const authApi = {
  login: async (email, password) => {
    const user = await loginUser(email, password);
    triggerOfflineSyncNow({ resetFailed: true }).catch((error) => {
      console.warn("Background sync trigger failed after login:", error?.message || error);
    });
    return user;
  },
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

    const endpoint = `${API_CONFIG.DJANGO_URL}/api/gaps/${djangoGapId}/close-with-proof/`;
    try {
      return await fetchJsonWithAuthRetry(
        endpoint,
        async (forceRefresh) => ({
          method: "POST",
          headers: await getFirebaseAuthHeaders({ forceRefresh }),
          body: JSON.stringify({
            closure_photo_url: closurePhotoUrl,
            closure_selfie_url: closureSelfieUrl,
            closure_latitude: latitude,
            closure_longitude: longitude,
          }),
        }),
        30000,
      );
    } catch (error) {
      if (error?.status === 404) {
        throw new Error(
          `Gap closure failed (404). Gap ${djangoGapId} was not found on ${API_CONFIG.DJANGO_URL}. ` +
            "This usually means the app is pointing to a different backend than the one where the gap was synced.",
        );
      }
      throw error;
    }
  },
};

// ============================================
// MOBILE COMPLAINT VERIFICATION API
// ============================================
export const complaintsApi = {
  submitWithVerification: async (data) => {
    const clientSubmissionId = data.client_submission_id || `cmp_${buildUuid()}`;
    const buildPayload = () => {
      const payload = new FormData();
      payload.append("client_submission_id", clientSubmissionId);
      payload.append("idempotency_key", clientSubmissionId);
      payload.append("villager_name", data.villager_name || "");
      payload.append("village_id", String(data.village_id || ""));
      if (data.post_office_id) {
        payload.append("post_office_id", String(data.post_office_id));
      }
      payload.append("complaint_text", data.complaint_text || "");
      payload.append("submission_latitude", String(data.submission_latitude));
      payload.append("submission_longitude", String(data.submission_longitude));
      payload.append("complaintee_photo", data.complaintee_photo);
      if (data.audio_file) {
        payload.append("audio_file", data.audio_file);
      }
      if (data.complaint_document_image) {
        payload.append("complaint_document_image", data.complaint_document_image);
      }
      return payload;
    };

    return fetchJsonWithAuthRetry(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/submit/`,
      async (forceRefresh) => ({
        method: "POST",
        headers: await getFirebaseAuthHeaders({
          includeContentType: false,
          forceRefresh,
        }),
        body: buildPayload(),
      }),
      30000,
    );
  },

  getInProgress: async () => {
    const result = await fetchJsonWithAuthRetry(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/in-progress/`,
      async (forceRefresh) => ({
        headers: await getFirebaseAuthHeaders({ forceRefresh }),
      }),
      20000,
    );

    return {
      open: result.open || [],
      inProgress: result.in_progress || result.inProgress || [],
      resolved: result.resolved || [],
    };
  },

  verifyAndClose: async (complaintId, data) => {
    const clientSubmissionId = data.client_submission_id || `close_${buildUuid()}`;
    const buildPayload = () => {
      const payload = new FormData();
      payload.append("client_submission_id", clientSubmissionId);
      payload.append("idempotency_key", clientSubmissionId);
      payload.append("closure_selfie", data.closure_selfie);
      payload.append("closure_latitude", String(data.closure_latitude));
      payload.append("closure_longitude", String(data.closure_longitude));
      return payload;
    };

    return fetchJsonWithAuthRetry(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/${complaintId}/verify-close/`,
      async (forceRefresh) => ({
        method: "POST",
        headers: await getFirebaseAuthHeaders({
          includeContentType: false,
          forceRefresh,
        }),
        body: buildPayload(),
      }),
      30000,
    );
  },

  resolvePhotoComplaint: async (complaintId, data) => {
    const clientSubmissionId = data.client_submission_id || `close_${buildUuid()}`;
    const buildPayload = () => {
      const payload = new FormData();
      payload.append("client_submission_id", clientSubmissionId);
      payload.append("idempotency_key", clientSubmissionId);
      payload.append("resolution_letter_image", data.resolution_letter_image);
      return payload;
    };

    return fetchJsonWithAuthRetry(
      `${API_CONFIG.DJANGO_URL}/api/mobile/complaints/${complaintId}/resolve-photo/`,
      async (forceRefresh) => ({
        method: "POST",
        headers: await getFirebaseAuthHeaders({
          includeContentType: false,
          forceRefresh,
        }),
        body: buildPayload(),
      }),
      30000,
    );
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
  processQueue: () => triggerOfflineSyncNow({ resetFailed: true }),

  getStatus: () => getOfflineSyncSummary(),
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
