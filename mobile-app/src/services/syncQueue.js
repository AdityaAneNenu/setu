// Sync Queue Service for Django sync retries
// ============================================
// Handles failed sync operations with exponential backoff retry

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_CONFIG } from '../config/api';

const SYNC_QUEUE_KEY = '@pending_django_syncs';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000; // 1 second

/**
 * Add a failed sync operation to the retry queue
 */
export const addToSyncQueue = async (operation) => {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue = stored ? JSON.parse(stored) : [];
    
    queue.push({
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      lastAttempt: null,
    });
    
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.log('Added to sync queue:', operation.type);
  } catch (error) {
    console.error('Failed to add to sync queue:', error);
  }
};

/**
 * Get all pending sync operations
 */
export const getPendingSyncs = async () => {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
};

/**
 * Remove a sync operation from the queue
 */
export const removeFromSyncQueue = async (syncId) => {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue = stored ? JSON.parse(stored) : [];
    const filtered = queue.filter(item => item.id !== syncId);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from sync queue:', error);
  }
};

/**
 * Update retry count for a sync operation
 */
export const updateSyncRetry = async (syncId) => {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue = stored ? JSON.parse(stored) : [];
    const updated = queue.map(item => {
      if (item.id === syncId) {
        return {
          ...item,
          retryCount: (item.retryCount || 0) + 1,
          lastAttempt: new Date().toISOString(),
        };
      }
      return item;
    });
    // Remove items that exceeded max retries
    const filtered = updated.filter(item => item.retryCount <= MAX_RETRIES);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to update sync retry:', error);
  }
};

/**
 * Perform a single sync operation with retry
 */
const performSync = async (syncItem) => {
  const { type, payload } = syncItem;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    
    let url, method, body;
    
    if (type === 'gap_create') {
      url = `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/sync/`;
      method = 'POST';
      body = JSON.stringify(payload);
    } else if (type === 'gap_status_update') {
      url = `${API_CONFIG.DJANGO_URL}/api/mobile/gaps/${payload.firestore_id}/status/`;
      method = 'POST';
      body = JSON.stringify(payload);
    } else {
      console.warn('Unknown sync type:', type);
      return { success: false, error: 'Unknown sync type' };
    }
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      const result = await response.json();
      return { success: result.success, data: result };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Process the sync queue with exponential backoff
 */
export const processSyncQueue = async () => {
  // Check network connectivity first
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('No network - skipping sync queue processing');
    return { processed: 0, failed: 0 };
  }
  
  const queue = await getPendingSyncs();
  if (queue.length === 0) {
    return { processed: 0, failed: 0 };
  }
  
  let processed = 0;
  let failed = 0;
  
  for (const item of queue) {
    // Check if we should wait (exponential backoff)
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, item.retryCount), 60000);
    const lastAttempt = item.lastAttempt ? new Date(item.lastAttempt).getTime() : 0;
    const timeSinceLastAttempt = Date.now() - lastAttempt;
    
    if (timeSinceLastAttempt < delay) {
      continue; // Skip this item, not ready for retry yet
    }
    
    const result = await performSync(item);
    
    if (result.success) {
      await removeFromSyncQueue(item.id);
      processed++;
      console.log(`Sync succeeded: ${item.type}`);
    } else {
      await updateSyncRetry(item.id);
      failed++;
      console.warn(`Sync failed (attempt ${item.retryCount + 1}): ${item.type}`, result.error);
    }
  }
  
  return { processed, failed };
};

/**
 * Get sync queue status
 */
export const getSyncQueueStatus = async () => {
  const queue = await getPendingSyncs();
  return {
    pendingCount: queue.length,
    items: queue.map(item => ({
      type: item.type,
      retryCount: item.retryCount,
      createdAt: item.createdAt,
    })),
  };
};

export default {
  addToSyncQueue,
  getPendingSyncs,
  removeFromSyncQueue,
  processSyncQueue,
  getSyncQueueStatus,
};
