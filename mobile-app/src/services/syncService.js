import * as Network from 'expo-network';
import api, { API_BASE_URL } from '../config/api';
import storageService from './storageService';

class SyncService {
  constructor() {
    this.isSyncing = false;
  }

  // Check if device is connected to WiFi
  async isConnectedToWiFi() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected && networkState.type === Network.NetworkStateType.WIFI;
    } catch (error) {
      console.error('Error checking WiFi:', error);
      return false;
    }
  }

  // Check if device has internet connection
  async isOnline() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected && networkState.isInternetReachable;
    } catch (error) {
      console.error('Error checking online status:', error);
      return false;
    }
  }

  // Sync all unsynced photos
  async syncPhotos(onProgress) {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    try {
      this.isSyncing = true;
      
      // Check if connected to WiFi
      const hasWiFi = await this.isConnectedToWiFi();
      if (!hasWiFi) {
        return { success: false, message: 'WiFi connection required for syncing' };
      }

      const unsyncedPhotos = await storageService.getUnsyncedPhotos();
      
      if (unsyncedPhotos.length === 0) {
        return { success: true, message: 'No photos to sync', count: 0 };
      }

      console.log(`Starting sync of ${unsyncedPhotos.length} photos...`);
      
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < unsyncedPhotos.length; i++) {
        const photo = unsyncedPhotos[i];
        
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: unsyncedPhotos.length,
            photo: photo,
          });
        }

        try {
          await this.uploadPhoto(photo);
          await storageService.markPhotoAsSynced(photo.id);
          successCount++;
        } catch (error) {
          console.error(`Failed to sync photo ${photo.id}:`, error);
          failCount++;
        }
      }

      await storageService.updateLastSync();
      await storageService.cleanupSyncedPhotos();

      return {
        success: true,
        message: `Synced ${successCount} photos${failCount > 0 ? `, ${failCount} failed` : ''}`,
        successCount,
        failCount,
      };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, message: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  // Upload a single photo
  async uploadPhoto(photo) {
    try {
      // First, test if we can reach the server
      console.log('Testing server connection to:', `${API_BASE_URL}/api/complaints/`);
      try {
        const testResponse = await api.get('/api/complaints/', { timeout: 5000 });
        console.log('✅ Server is reachable! Status:', testResponse.status);
        console.log('✅ Response data:', JSON.stringify(testResponse.data).substring(0, 200));
      } catch (testError) {
        console.error('❌ Cannot reach server:', testError.message);
        console.error('❌ Error details:', {
          code: testError.code,
          status: testError.response?.status,
          data: testError.response?.data,
        });
        throw new Error(`Cannot reach server at ${API_BASE_URL}. Error: ${testError.message}. Please check your WiFi connection and ensure you're on the same network as the server.`);
      }

      // Create FormData for multipart upload
      const formData = new FormData();

      const fileName = photo.fileName || `photo_${Date.now()}.jpg`;

      // Add complaint ID
      formData.append('complaint_id', photo.complaintId);

      // Add photo file - React Native FormData format
      formData.append('photo', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: fileName,
      });

      // Add location data if available
      if (photo.latitude && photo.longitude) {
        formData.append('latitude', photo.latitude.toString());
        formData.append('longitude', photo.longitude.toString());
      }

      // Add timestamp if available
      if (photo.timestamp) {
        formData.append('timestamp', photo.timestamp);
      }

      console.log('Uploading photo:', {
        complaintId: photo.complaintId,
        fileName: fileName,
        uri: photo.uri,
        hasLocation: !!(photo.latitude && photo.longitude),
      });

      // Upload with axios
      // The interceptor will automatically handle Content-Type for FormData
      const response = await api.post('/api/upload-photo/', formData, {
        timeout: 60000, // Increase timeout for photo uploads
      });

      console.log('Photo uploaded successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error uploading photo:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  // Auto-sync when WiFi is detected
  async autoSync(onProgress) {
    const hasWiFi = await this.isConnectedToWiFi();
    
    if (hasWiFi) {
      console.log('WiFi detected, starting auto-sync...');
      return await this.syncPhotos(onProgress);
    }
    
    return { success: false, message: 'No WiFi connection' };
  }

  // Get sync status
  async getSyncStatus() {
    const unsyncedPhotos = await storageService.getUnsyncedPhotos();
    const lastSync = await storageService.getLastSync();
    const isOnline = await this.isOnline();
    const hasWiFi = await this.isConnectedToWiFi();

    return {
      unsyncedCount: unsyncedPhotos.length,
      lastSync: lastSync,
      isOnline: isOnline,
      hasWiFi: hasWiFi,
      isSyncing: this.isSyncing,
    };
  }
}

export default new SyncService();

