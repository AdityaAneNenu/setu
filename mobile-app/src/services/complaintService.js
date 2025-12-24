import api from '../config/api';
import storageService from './storageService';

class ComplaintService {
  // Get complaint by complaint ID (e.g., PMC2024001)
  async getComplaintById(complaintId) {
    try {
      // Try to get from API first
      const response = await api.get(`/api/complaints/by_complaint_id/${complaintId}/`);
      
      // Save to local storage for offline access
      await storageService.saveSyncedComplaint(response.data);
      
      return { success: true, data: response.data };
    } catch (error) {
      console.log('API failed, trying offline storage...');
      
      // If API fails, try to get from local storage
      const offlineData = await storageService.getComplaintById(complaintId);
      
      if (offlineData) {
        return { success: true, data: offlineData, offline: true };
      }
      
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Complaint not found',
        offline: true 
      };
    }
  }

  // Search complaints
  async searchComplaints(query) {
    try {
      const response = await api.get('/api/complaints/search/', {
        params: { q: query }
      });
      
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Search failed' 
      };
    }
  }

  // Get all complaints
  async getAllComplaints() {
    try {
      const response = await api.get('/api/complaints/');
      
      // Save to local storage
      if (response.data.results) {
        for (const complaint of response.data.results) {
          await storageService.saveSyncedComplaint(complaint);
        }
      }
      
      return { success: true, data: response.data };
    } catch (error) {
      // Try to get from local storage
      const offlineData = await storageService.getSyncedComplaints();
      
      if (offlineData.length > 0) {
        return { success: true, data: { results: offlineData }, offline: true };
      }
      
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Failed to fetch complaints' 
      };
    }
  }

  // Get complaint photos (including offline ones)
  async getComplaintPhotos(complaintId) {
    try {
      // Get online photos from complaint data
      const complaintResult = await this.getComplaintById(complaintId);
      const onlinePhotos = complaintResult.data?.geotagged_photos || [];
      
      // Get offline photos
      const offlinePhotos = await storageService.getOfflinePhotosByComplaint(complaintId);
      
      return {
        success: true,
        online: onlinePhotos,
        offline: offlinePhotos,
        total: onlinePhotos.length + offlinePhotos.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        online: [],
        offline: []
      };
    }
  }
}

export default new ComplaintService();

