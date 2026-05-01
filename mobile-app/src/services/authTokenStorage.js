import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = '@setu_firebase_id_token';

export const saveAuthToken = async (token) => {
  const normalized = String(token || '').trim();
  if (!normalized) {
    throw new Error('Cannot persist empty Firebase auth token.');
  }
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, normalized);
  return normalized;
};

export const getStoredAuthToken = async () => {
  const token = String((await AsyncStorage.getItem(TOKEN_STORAGE_KEY)) || '').trim();
  return token || null;
};

export const clearStoredAuthToken = async () => {
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
};

