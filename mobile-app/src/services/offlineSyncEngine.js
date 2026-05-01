import * as Network from "expo-network";
import * as FileSystem from "expo-file-system/legacy";
import {
  getQueueDueItems,
  getComplaintByLocalId,
  getResolutionByLocalId,
  markQueueUploading,
  markQueueFailed,
  markComplaintSynced,
  markResolutionSynced,
  initOfflineDb,
  resetFailedSyncItems,
  getRetainedLocalFileUris,
} from "./offlineDb";
import { API_CONFIG } from "../config/api";
import { getCurrentUser } from "./authService";
import { cleanupOfflineFiles, deleteOfflineFile } from "./offlineFileStore";
import { getFirebaseAuthHeaders, isAuthDeniedStatus } from "./firebaseAuthSession";

let running = false;
let timer = null;
let unsubscribeNetwork = null;

const SYNC_POLL_MS = 60 * 1000;
const UPLOAD_TIMEOUT_MS = 45000;

const fetchWithTimeout = async (url, options = {}, timeoutMs = UPLOAD_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const toFilePart = (uri, namePrefix) => {
  const clean = String(uri || "").split("?")[0];
  const ext = clean.includes(".") ? clean.split(".").pop().toLowerCase() : "jpg";
  const isPng = ext === "png";
  const isM4a = ext === "m4a";
  const isWav = ext === "wav";

  let type = "image/jpeg";
  if (isPng) type = "image/png";
  if (isM4a) type = "audio/m4a";
  if (isWav) type = "audio/wav";

  return {
    uri,
    name: `${namePrefix}.${ext || "bin"}`,
    type,
  };
};

const getAuthHeaders = async () =>
  getFirebaseAuthHeaders({
    includeContentType: false,
    forceRefresh: true,
    required: true,
  });

const isOnline = async () => {
  const state = await Network.getNetworkStateAsync();
  return !!(state?.isConnected && state?.isInternetReachable !== false);
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    const raw = await response.text().catch(() => "");
    return { raw };
  }
};

const assertLocalFileExists = async (uri, label) => {
  if (!uri) {
    throw new Error(`${label} file path is missing`);
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info?.exists) {
    throw new Error(`${label} file is missing on device storage`);
  }
};

const syncComplaint = async (queueRow) => {
  const complaint = await getComplaintByLocalId(queueRow.entity_local_id);
  if (!complaint) {
    throw new Error("Complaint record not found for queue item");
  }

  const payload = new FormData();
  payload.append("local_id", complaint.local_id);
  payload.append("idempotency_key", complaint.idempotency_key);
  payload.append("client_submission_id", complaint.idempotency_key);
  payload.append("village_id", String(complaint.village_id));
  payload.append("village_name", complaint.village_name || "");
  payload.append("description", complaint.description || "");
  payload.append("gap_type", complaint.gap_type || "other");
  payload.append("severity", complaint.severity || "medium");
  payload.append("input_method", complaint.input_method || "image");
  payload.append("latitude", String(complaint.latitude));
  payload.append("longitude", String(complaint.longitude));
  if (complaint.gps_accuracy != null) {
    payload.append("gps_accuracy", String(complaint.gps_accuracy));
  }
  if (complaint.gps_samples_json) {
    payload.append("gps_samples", complaint.gps_samples_json);
  }
  payload.append("submitted_by", getCurrentUser()?.uid || "offline_worker");
  payload.append("submitted_by_email", getCurrentUser()?.email || "");

  await assertLocalFileExists(complaint.photo_uri, "Complaint photo");
  payload.append("image_file", toFilePart(complaint.photo_uri, `${complaint.local_id}_photo`));

  if (complaint.audio_uri) {
    await assertLocalFileExists(complaint.audio_uri, "Complaint audio");
    payload.append("audio_file", toFilePart(complaint.audio_uri, `${complaint.local_id}_audio`));
  }

  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${API_CONFIG.DJANGO_URL}/api/mobile/gaps/sync/`, {
    method: "POST",
    headers,
    body: payload,
  });
  const result = await parseJsonSafe(response);

  if (!response.ok || !result?.success) {
    console.warn("[offline-sync] Complaint sync failed:", {
      status: response.status,
      result,
      localId: complaint.local_id,
    });
    if (isAuthDeniedStatus(response.status)) {
      throw new Error("Session expired, please login again");
    }
    throw new Error(result?.error || `Complaint sync failed (${response.status})`);
  }

  await markComplaintSynced({
    localId: complaint.local_id,
    serverId: result.django_id,
    firestoreId: result.firestore_id || null,
  });
  await Promise.all([
    deleteOfflineFile(complaint.photo_uri),
    deleteOfflineFile(complaint.audio_uri),
  ]);
};

const syncResolution = async (queueRow) => {
  const resolution = await getResolutionByLocalId(queueRow.entity_local_id);
  if (!resolution) {
    throw new Error("Resolution record not found for queue item");
  }

  let serverGapId = resolution.complaint_server_id;
  if (!serverGapId && resolution.complaint_local_id) {
    const linkedComplaint = await getComplaintByLocalId(resolution.complaint_local_id);
    if (linkedComplaint?.server_id) {
      serverGapId = linkedComplaint.server_id;
    }
  }

  if (!serverGapId) {
    throw new Error("Resolution blocked until complaint sync completes");
  }

  const payload = new FormData();
  payload.append("local_id", resolution.local_id);
  payload.append("idempotency_key", resolution.idempotency_key);
  payload.append("client_submission_id", resolution.idempotency_key);
  await assertLocalFileExists(resolution.closure_photo_uri, "Resolution proof");
  payload.append("photo", toFilePart(resolution.closure_photo_uri, `${resolution.local_id}_proof`));
  payload.append("latitude", String(resolution.latitude));
  payload.append("longitude", String(resolution.longitude));
  if (resolution.gps_accuracy != null) {
    payload.append("gps_accuracy", String(resolution.gps_accuracy));
  }
  if (resolution.gps_samples_json) {
    payload.append("gps_samples", resolution.gps_samples_json);
  }

  if (resolution.person_photo_uri) {
    await assertLocalFileExists(resolution.person_photo_uri, "Resolution person photo");
    payload.append("person_photo", toFilePart(resolution.person_photo_uri, `${resolution.local_id}_person`));
  }

  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${API_CONFIG.DJANGO_URL}/api/mobile/gaps/${serverGapId}/resolve/`, {
    method: "POST",
    headers,
    body: payload,
  });
  const result = await parseJsonSafe(response);

  if (!response.ok || !result?.success) {
    console.warn("[offline-sync] Resolution sync failed:", {
      status: response.status,
      result,
      localId: resolution.local_id,
      serverGapId,
    });
    if (isAuthDeniedStatus(response.status)) {
      throw new Error("Session expired, please login again");
    }
    throw new Error(result?.error || `Resolution sync failed (${response.status})`);
  }

  await markResolutionSynced({
    localId: resolution.local_id,
    result,
  });
  await Promise.all([
    deleteOfflineFile(resolution.closure_photo_uri),
    deleteOfflineFile(resolution.person_photo_uri),
  ]);
};

const runOnePass = async () => {
  if (running) {
    return;
  }

  running = true;
  try {
    if (!getCurrentUser()) {
      return;
    }

    const online = await isOnline();
    if (!online) {
      return;
    }

    await initOfflineDb();
    const dueItems = await getQueueDueItems();

    for (const row of dueItems) {
      try {
        await markQueueUploading(row.id);
        if (row.entity_type === "complaint") {
          await syncComplaint(row);
        } else if (row.entity_type === "resolution") {
          await syncResolution(row);
        } else {
          throw new Error(`Unknown queue type: ${row.entity_type}`);
        }
      } catch (err) {
        await markQueueFailed(row, err?.message || "Sync failed");
      }
    }
  } finally {
    running = false;
  }
};

export const startOfflineSyncEngine = async () => {
  await initOfflineDb();
  getRetainedLocalFileUris()
    .then((retainedUris) => cleanupOfflineFiles(retainedUris))
    .catch((error) => {
      console.warn("Offline file cleanup failed during startup:", error?.message || error);
    });

  if (timer) {
    return;
  }

  timer = setInterval(() => {
    runOnePass().catch((err) => console.warn("Background sync pass failed:", err?.message || err));
  }, SYNC_POLL_MS);

  if (!unsubscribeNetwork) {
    const subscription = Network.addNetworkStateListener((state) => {
      if (state?.isConnected && state?.isInternetReachable !== false) {
        runOnePass().catch((err) => console.warn("Online sync pass failed:", err?.message || err));
      }
    });
    unsubscribeNetwork = () => subscription?.remove?.();
  }

  await runOnePass();
};

export const stopOfflineSyncEngine = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (unsubscribeNetwork) {
    unsubscribeNetwork();
    unsubscribeNetwork = null;
  }
};

export const triggerOfflineSyncNow = async ({ resetFailed = false } = {}) => {
  if (resetFailed) {
    await resetFailedSyncItems();
  }
  return runOnePass();
};

export default {
  startOfflineSyncEngine,
  stopOfflineSyncEngine,
  triggerOfflineSyncNow,
};
