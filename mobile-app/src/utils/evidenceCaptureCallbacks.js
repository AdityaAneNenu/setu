import AsyncStorage from '@react-native-async-storage/async-storage';

const callbacks = new Map();
const STORAGE_PREFIX = '@setu_pending_evidence:';
const LATEST_EVIDENCE_KEY = '@setu_pending_evidence:last';

export const registerEvidenceCaptureCallback = (id, callback) => {
  if (!id || typeof callback !== 'function') return;
  callbacks.set(id, callback);
};

export const unregisterEvidenceCaptureCallback = (id) => {
  if (!id) return;
  callbacks.delete(id);
};

export const completeEvidenceCapture = (id, evidence) => {
  const callback = callbacks.get(id);
  if (typeof callback !== 'function') return false;
  try {
    callback(evidence);
    return true;
  } catch (error) {
    console.warn('Evidence callback delivery failed:', error?.message || error);
    return false;
  }
};

export const persistEvidenceCaptureDraft = async (id, evidence) => {
  if (!evidence) return;

  const envelope = JSON.stringify({
    callbackId: id || null,
    saved_at: new Date().toISOString(),
    evidence,
  });

  if (id) {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(evidence));
  }
  await AsyncStorage.setItem(LATEST_EVIDENCE_KEY, envelope);
};

export const consumeEvidenceCaptureDraft = async (id) => {
  if (!id) return null;
  const key = `${STORAGE_PREFIX}${id}`;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  await AsyncStorage.removeItem(key);
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse evidence draft for callback:', id, error?.message || error);
    return null;
  }
};

export const consumeLatestEvidenceCaptureDraft = async () => {
  const raw = await AsyncStorage.getItem(LATEST_EVIDENCE_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(LATEST_EVIDENCE_KEY);
  try {
    const parsed = JSON.parse(raw);
    return parsed?.evidence || null;
  } catch (error) {
    console.warn('Failed to parse latest evidence draft:', error?.message || error);
    return null;
  }
};
