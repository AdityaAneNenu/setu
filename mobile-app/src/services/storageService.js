import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  OFFLINE_PHOTOS: 'offline_photos',
  SYNCED_COMPLAINTS: 'synced_complaints',
  LAST_SYNC: 'last_sync',
};

class StorageService {
  // Save photo data offline
  async saveOfflinePhoto(complaintId, photoData) {
    try {
      const existingData = await this.getOfflinePhotos();
      const newPhoto = {
        id: Date.now().toString(),
        complaintId,
        ...photoData,
        timestamp: new Date().toISOString(),
        synced: false,
      };
      
      const updatedData = [...existingData, newPhoto];
      await AsyncStorage.setItem(KEYS.OFFLINE_PHOTOS, JSON.stringify(updatedData));
      
      console.log('Photo saved offline:', newPhoto.id);
      return newPhoto;
    } catch (error) {
      console.error('Error saving offline photo:', error);
      throw error;
    }
  }

  // Get all offline photos
  async getOfflinePhotos() {
    try {
      const data = await AsyncStorage.getItem(KEYS.OFFLINE_PHOTOS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline photos:', error);
      return [];
    }
  }

  // Get offline photos for a specific complaint
  async getOfflinePhotosByComplaint(complaintId) {
    try {
      const allPhotos = await this.getOfflinePhotos();
      return allPhotos.filter(photo => photo.complaintId === complaintId);
    } catch (error) {
      console.error('Error getting offline photos by complaint:', error);
      return [];
    }
  }

  // Get unsynced photos
  async getUnsyncedPhotos() {
    try {
      const allPhotos = await this.getOfflinePhotos();
      return allPhotos.filter(photo => !photo.synced);
    } catch (error) {
      console.error('Error getting unsynced photos:', error);
      return [];
    }
  }

  // Mark photo as synced
  async markPhotoAsSynced(photoId) {
    try {
      const allPhotos = await this.getOfflinePhotos();
      const updatedPhotos = allPhotos.map(photo =>
        photo.id === photoId ? { ...photo, synced: true, syncedAt: new Date().toISOString() } : photo
      );
      await AsyncStorage.setItem(KEYS.OFFLINE_PHOTOS, JSON.stringify(updatedPhotos));
      console.log('Photo marked as synced:', photoId);
    } catch (error) {
      console.error('Error marking photo as synced:', error);
      throw error;
    }
  }

  // Delete synced photos older than 7 days
  async cleanupSyncedPhotos() {
    try {
      const allPhotos = await this.getOfflinePhotos();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const filteredPhotos = allPhotos.filter(photo => {
        if (!photo.synced) return true;
        const syncedDate = new Date(photo.syncedAt);
        return syncedDate > sevenDaysAgo;
      });
      
      await AsyncStorage.setItem(KEYS.OFFLINE_PHOTOS, JSON.stringify(filteredPhotos));
      console.log('Cleaned up old synced photos');
    } catch (error) {
      console.error('Error cleaning up photos:', error);
    }
  }

  // Save complaint data for offline access
  async saveSyncedComplaint(complaint) {
    try {
      const existingComplaints = await this.getSyncedComplaints();
      const index = existingComplaints.findIndex(c => c.complaint_id === complaint.complaint_id);
      
      if (index >= 0) {
        existingComplaints[index] = complaint;
      } else {
        existingComplaints.push(complaint);
      }
      
      await AsyncStorage.setItem(KEYS.SYNCED_COMPLAINTS, JSON.stringify(existingComplaints));
    } catch (error) {
      console.error('Error saving synced complaint:', error);
    }
  }

  // Get all synced complaints
  async getSyncedComplaints() {
    try {
      const data = await AsyncStorage.getItem(KEYS.SYNCED_COMPLAINTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting synced complaints:', error);
      return [];
    }
  }

  // Get complaint by ID
  async getComplaintById(complaintId) {
    try {
      const complaints = await this.getSyncedComplaints();
      return complaints.find(c => c.complaint_id === complaintId);
    } catch (error) {
      console.error('Error getting complaint by ID:', error);
      return null;
    }
  }

  // Update last sync time
  async updateLastSync() {
    try {
      await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error updating last sync:', error);
    }
  }

  // Get last sync time
  async getLastSync() {
    try {
      return await AsyncStorage.getItem(KEYS.LAST_SYNC);
    } catch (error) {
      console.error('Error getting last sync:', error);
      return null;
    }
  }

  // Clear all data (for testing/debugging)
  async clearAll() {
    try {
      await AsyncStorage.multiRemove([KEYS.OFFLINE_PHOTOS, KEYS.SYNCED_COMPLAINTS, KEYS.LAST_SYNC]);
      console.log('All storage cleared');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export default new StorageService();

