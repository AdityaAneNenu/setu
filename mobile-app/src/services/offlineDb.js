import * as SQLite from "expo-sqlite";

const DB_NAME = "setu_offline.db";
const MAX_RETRY_STEPS_MINUTES = [1, 5, 15, 30, 60, 120];
const MAX_SYNC_ATTEMPTS = 8;

let dbPromise = null;
let initialized = false;

const isoNow = () => new Date().toISOString();

export const buildUuid = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const rnd = Math.random().toString(16).slice(2, 10);
  return `local_${Date.now()}_${rnd}`;
};

const toIsoAfterMinutes = (minutes) => {
  const next = new Date(Date.now() + minutes * 60 * 1000);
  return next.toISOString();
};

const nextBackoffMinutes = (retryCount) => {
  const idx = Math.max(0, Math.min(retryCount, MAX_RETRY_STEPS_MINUTES.length - 1));
  return MAX_RETRY_STEPS_MINUTES[idx];
};

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
};

export const initOfflineDb = async () => {
  if (initialized) {
    return;
  }

  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS complaints_offline (
      local_id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      server_id INTEGER,
      firestore_id TEXT,
      village_id TEXT NOT NULL,
      village_name TEXT,
      description TEXT,
      gap_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      input_method TEXT NOT NULL,
      photo_uri TEXT NOT NULL,
      photo_md5 TEXT,
      audio_uri TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      gps_accuracy REAL,
      gps_samples_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS resolutions_offline (
      local_id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      complaint_local_id TEXT,
      complaint_server_id INTEGER,
      closure_photo_uri TEXT NOT NULL,
      closure_photo_md5 TEXT,
      person_photo_uri TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      gps_accuracy REAL,
      gps_samples_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      synced_at TEXT,
      decision_status TEXT,
      resolution_type TEXT,
      review_reason TEXT,
      distance_m REAL,
      resolution_time_minutes REAL,
      ai_score REAL,
      ai_method TEXT,
      ai_threshold REAL,
      needs_retry INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (complaint_local_id) REFERENCES complaints_offline(local_id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_local_id TEXT NOT NULL,
      depends_on_local_id TEXT,
      sync_status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(entity_type, entity_local_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_due
      ON sync_queue(sync_status, next_retry_at, created_at);
  `);

  const now = isoNow();
  await db.runAsync(
    `UPDATE sync_queue
     SET sync_status = 'PENDING', updated_at = ?
     WHERE sync_status = 'UPLOADING'`,
    [now],
  );
  await db.runAsync(
    `UPDATE complaints_offline
     SET sync_status = 'PENDING', updated_at = ?
     WHERE sync_status = 'UPLOADING'`,
    [now],
  );
  await db.runAsync(
    `UPDATE resolutions_offline
     SET sync_status = 'PENDING', updated_at = ?
     WHERE sync_status = 'UPLOADING'`,
    [now],
  );

  initialized = true;
};

export const createOfflineComplaint = async (payload) => {
  await initOfflineDb();
  const db = await getDb();

  const localId = payload.local_id || buildUuid();
  const idempotencyKey = payload.idempotency_key || localId;
  const now = isoNow();

  await db.runAsync(
    `INSERT INTO complaints_offline (
      local_id, idempotency_key, server_id, firestore_id,
      village_id, village_name, description, gap_type, severity, input_method,
      photo_uri, photo_md5, audio_uri,
      latitude, longitude, gps_accuracy, gps_samples_json,
      created_at, updated_at, sync_status, retry_count
    ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0)`,
    [
      localId,
      idempotencyKey,
      String(payload.village_id),
      payload.village_name || "",
      payload.description || "",
      payload.gap_type || "other",
      payload.severity || "medium",
      payload.input_method || "image",
      payload.photo_uri,
      payload.photo_md5 || null,
      payload.audio_uri || null,
      payload.latitude,
      payload.longitude,
      payload.gps_accuracy ?? null,
      payload.gps_samples_json || null,
      now,
      now,
    ],
  );

  await enqueueSyncItem({
    entityType: "complaint",
    entityLocalId: localId,
    dependsOnLocalId: null,
  });

  return {
    local_id: localId,
    sync_status: "PENDING",
  };
};

export const createOfflineResolution = async (payload) => {
  await initOfflineDb();
  const db = await getDb();

  const localId = payload.local_id || buildUuid();
  const idempotencyKey = payload.idempotency_key || localId;
  const now = isoNow();

  await db.runAsync(
    `INSERT INTO resolutions_offline (
      local_id, idempotency_key, complaint_local_id, complaint_server_id,
      closure_photo_uri, closure_photo_md5, person_photo_uri,
      latitude, longitude, gps_accuracy, gps_samples_json,
      created_at, updated_at, sync_status, retry_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0)`,
    [
      localId,
      idempotencyKey,
      payload.complaint_local_id || null,
      payload.complaint_server_id || null,
      payload.closure_photo_uri,
      payload.closure_photo_md5 || null,
      payload.person_photo_uri || null,
      payload.latitude,
      payload.longitude,
      payload.gps_accuracy ?? null,
      payload.gps_samples_json || null,
      now,
      now,
    ],
  );

  await enqueueSyncItem({
    entityType: "resolution",
    entityLocalId: localId,
    dependsOnLocalId: payload.complaint_local_id || null,
  });

  return {
    local_id: localId,
    sync_status: "PENDING",
  };
};

export const enqueueSyncItem = async ({ entityType, entityLocalId, dependsOnLocalId }) => {
  await initOfflineDb();
  const db = await getDb();
  const now = isoNow();
  await db.runAsync(
    `INSERT OR IGNORE INTO sync_queue (
      entity_type, entity_local_id, depends_on_local_id, sync_status,
      retry_count, created_at, updated_at
    ) VALUES (?, ?, ?, 'PENDING', 0, ?, ?)` ,
    [entityType, entityLocalId, dependsOnLocalId || null, now, now],
  );
};

export const getQueueDueItems = async () => {
  await initOfflineDb();
  const db = await getDb();
  const now = isoNow();

  const rows = await db.getAllAsync(
    `SELECT *
     FROM sync_queue
     WHERE sync_status IN ('PENDING', 'FAILED')
       AND retry_count < ?
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY created_at ASC`,
    [MAX_SYNC_ATTEMPTS, now],
  );

  return rows;
};

export const getComplaintByLocalId = async (localId) => {
  await initOfflineDb();
  const db = await getDb();
  return db.getFirstAsync(`SELECT * FROM complaints_offline WHERE local_id = ?`, [localId]);
};

export const getResolutionByLocalId = async (localId) => {
  await initOfflineDb();
  const db = await getDb();
  return db.getFirstAsync(`SELECT * FROM resolutions_offline WHERE local_id = ?`, [localId]);
};

export const markQueueUploading = async (queueId) => {
  await initOfflineDb();
  const db = await getDb();
  const now = isoNow();
  const row = await db.getFirstAsync(`SELECT * FROM sync_queue WHERE id = ?`, [queueId]);
  if (!row) return;

  await db.runAsync(
    `UPDATE sync_queue
     SET sync_status = 'UPLOADING', last_attempt_at = ?, updated_at = ?
     WHERE id = ?`,
    [now, now, queueId],
  );

  const table = row.entity_type === "complaint" ? "complaints_offline" : "resolutions_offline";
  await db.runAsync(
    `UPDATE ${table}
     SET sync_status = 'UPLOADING',
         last_attempt_at = ?,
         updated_at = ?
     WHERE local_id = ?`,
    [now, now, row.entity_local_id],
  );
};

export const markQueueFailed = async (queueRow, reason) => {
  await initOfflineDb();
  const db = await getDb();
  const now = isoNow();
  const retryCount = (queueRow.retry_count || 0) + 1;
  const delayMinutes = nextBackoffMinutes(retryCount - 1);
  const nextRetryAt = retryCount >= MAX_SYNC_ATTEMPTS
    ? null
    : toIsoAfterMinutes(delayMinutes);
  const message = retryCount >= MAX_SYNC_ATTEMPTS
    ? `${reason || "Sync failed"} Reached retry limit; use manual retry after fixing the issue.`
    : reason || "Sync failed";

  await db.runAsync(
    `UPDATE sync_queue
     SET sync_status = 'FAILED',
         retry_count = ?,
         last_error = ?,
         last_attempt_at = ?,
         next_retry_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [retryCount, message, now, nextRetryAt, now, queueRow.id],
  );

  const table = queueRow.entity_type === "complaint" ? "complaints_offline" : "resolutions_offline";
  await db.runAsync(
    `UPDATE ${table}
     SET sync_status = 'FAILED',
         retry_count = ?,
         last_error = ?,
         last_attempt_at = ?,
         next_retry_at = ?,
         updated_at = ?
     WHERE local_id = ?`,
    [retryCount, message, now, nextRetryAt, now, queueRow.entity_local_id],
  );
};

export const resetFailedSyncItems = async () => {
  await initOfflineDb();
  const db = await getDb();
  const now = isoNow();

  await db.runAsync(
    `UPDATE sync_queue
     SET sync_status = 'PENDING',
         retry_count = 0,
         next_retry_at = NULL,
         updated_at = ?
     WHERE sync_status = 'FAILED'`,
    [now],
  );
  await db.runAsync(
    `UPDATE complaints_offline
     SET sync_status = 'PENDING',
         retry_count = 0,
         next_retry_at = NULL,
         updated_at = ?
     WHERE sync_status = 'FAILED'`,
    [now],
  );
  await db.runAsync(
    `UPDATE resolutions_offline
     SET sync_status = 'PENDING',
         retry_count = 0,
         next_retry_at = NULL,
         updated_at = ?
     WHERE sync_status = 'FAILED'`,
    [now],
  );
};

export const markComplaintSynced = async ({ localId, serverId, firestoreId = null }) => {
  await initOfflineDb();
  const db = await getDb();
  const now = isoNow();

  await db.runAsync(
    `UPDATE complaints_offline
     SET server_id = ?, firestore_id = COALESCE(?, firestore_id),
         sync_status = 'SYNCED', synced_at = ?, updated_at = ?, last_error = NULL
     WHERE local_id = ?`,
    [serverId, firestoreId, now, now, localId],
  );

  await db.runAsync(
    `UPDATE resolutions_offline
     SET complaint_server_id = COALESCE(complaint_server_id, ?), updated_at = ?
     WHERE complaint_local_id = ?`,
    [serverId, now, localId],
  );

  await db.runAsync(
    `UPDATE sync_queue
     SET sync_status = 'SYNCED', updated_at = ?, last_error = NULL
     WHERE entity_type = 'complaint' AND entity_local_id = ?`,
    [now, localId],
  );
};

export const markResolutionSynced = async ({ localId, result }) => {
  await initOfflineDb();
  const db = await getDb();
  const now = isoNow();
  const isNeedsRetry = String(result?.status || "").toUpperCase() === "NEEDS_RETRY";

  await db.runAsync(
    `UPDATE resolutions_offline
     SET sync_status = 'SYNCED',
         synced_at = ?,
         updated_at = ?,
         last_error = NULL,
         decision_status = ?,
         resolution_type = ?,
         review_reason = ?,
         distance_m = ?,
         resolution_time_minutes = ?,
         ai_score = ?,
         ai_method = ?,
         ai_threshold = ?,
         needs_retry = ?
     WHERE local_id = ?`,
    [
      now,
      now,
      result?.status || null,
      result?.resolution_type || null,
      result?.review_reason || "",
      result?.distance_m ?? null,
      result?.resolution_time_minutes ?? null,
      result?.ai_score ?? null,
      result?.ai_method || null,
      result?.ai_threshold ?? null,
      isNeedsRetry ? 1 : 0,
      localId,
    ],
  );

  await db.runAsync(
    `UPDATE sync_queue
     SET sync_status = 'SYNCED', updated_at = ?, last_error = NULL
     WHERE entity_type = 'resolution' AND entity_local_id = ?`,
    [now, localId],
  );
};

export const getOfflineSyncSummary = async () => {
  await initOfflineDb();
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT sync_status, COUNT(*) AS count FROM (
       SELECT sync_status FROM complaints_offline
       UNION ALL
       SELECT sync_status FROM resolutions_offline
     ) GROUP BY sync_status`,
  );

  const summary = { PENDING: 0, UPLOADING: 0, SYNCED: 0, FAILED: 0 };
  rows.forEach((r) => {
    summary[r.sync_status] = r.count;
  });

  const needsRetryRow = await db.getFirstAsync(
    `SELECT COUNT(*) AS count FROM resolutions_offline WHERE needs_retry = 1`,
  );

  return {
    ...summary,
    needsRetry: needsRetryRow?.count || 0,
    pendingTotal: summary.PENDING + summary.UPLOADING + summary.FAILED,
  };
};

export const findComplaintByPhotoHash = async (photoMd5) => {
  if (!photoMd5) return null;
  await initOfflineDb();
  const db = await getDb();
  return db.getFirstAsync(
    `SELECT local_id, created_at FROM complaints_offline
     WHERE photo_md5 = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [photoMd5],
  );
};

export const listNeedsRetryResolutions = async () => {
  await initOfflineDb();
  const db = await getDb();
  return db.getAllAsync(
    `SELECT *
     FROM resolutions_offline
     WHERE needs_retry = 1
     ORDER BY updated_at DESC`,
  );
};

export const getRetainedLocalFileUris = async () => {
  await initOfflineDb();
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT photo_uri AS uri FROM complaints_offline WHERE sync_status != 'SYNCED'
     UNION
     SELECT audio_uri AS uri FROM complaints_offline WHERE sync_status != 'SYNCED' AND audio_uri IS NOT NULL
     UNION
     SELECT closure_photo_uri AS uri FROM resolutions_offline WHERE sync_status != 'SYNCED'
     UNION
     SELECT person_photo_uri AS uri FROM resolutions_offline WHERE sync_status != 'SYNCED' AND person_photo_uri IS NOT NULL`,
  );
  return rows.map((row) => row.uri).filter(Boolean);
};

export default {
  initOfflineDb,
  createOfflineComplaint,
  createOfflineResolution,
  enqueueSyncItem,
  getQueueDueItems,
  getComplaintByLocalId,
  getResolutionByLocalId,
  markQueueUploading,
  markQueueFailed,
  resetFailedSyncItems,
  markComplaintSynced,
  markResolutionSynced,
  getOfflineSyncSummary,
  findComplaintByPhotoHash,
  listNeedsRetryResolutions,
  getRetainedLocalFileUris,
};
