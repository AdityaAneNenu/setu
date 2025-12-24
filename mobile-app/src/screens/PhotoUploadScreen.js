import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../config/theme';
import storageService from '../services/storageService';
import syncService from '../services/syncService';

export default function PhotoUploadScreen({ route, navigation }) {
  const { complaint, complaintId } = route.params;
  
  const [photos, setPhotos] = useState([]);
  const [location, setLocation] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    requestPermissions();
    loadExistingPhotos();
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    setHasPermission(cameraStatus === 'granted');
    
    if (locationStatus === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    }
  };

  const loadExistingPhotos = async () => {
    const offlinePhotos = await storageService.getOfflinePhotosByComplaint(complaintId);
    setPhotos(offlinePhotos);
  };

  const takePhoto = async () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      await savePhoto(result.assets[0]);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      await savePhoto(result.assets[0]);
    }
  };

  const savePhoto = async (asset) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const photoData = {
        uri: asset.uri,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        latitude: location?.latitude,
        longitude: location?.longitude,
      };

      const savedPhoto = await storageService.saveOfflinePhoto(complaintId, photoData);
      setPhotos([...photos, savedPhoto]);

      Alert.alert('Success', 'Photo saved offline. It will be uploaded when WiFi is available.');
    } catch (error) {
      console.error('Error saving photo:', error);
      Alert.alert('Error', 'Failed to save photo: ' + error.message);
    }
  };

  const deletePhoto = async (photoId) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedPhotos = photos.filter(p => p.id !== photoId);
            setPhotos(updatedPhotos);
            // Note: In production, you'd want to actually delete from storage
          }
        }
      ]
    );
  };

  const syncNow = async () => {
    setUploading(true);
    
    const result = await syncService.syncPhotos((progress) => {
      console.log(`Syncing: ${progress.current}/${progress.total}`);
    });

    setUploading(false);

    if (result.success) {
      Alert.alert('Success', result.message);
      await loadExistingPhotos();
    } else {
      Alert.alert('Sync Failed', result.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Upload Photos</Text>
          <Text style={styles.headerSubtitle}>{complaintId}</Text>
        </View>
        <TouchableOpacity onPress={syncNow} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Ionicons name="cloud-upload" size={24} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Complaint Info */}
      <View style={styles.complaintCard}>
        <Text style={styles.complaintName}>{complaint?.villager_name}</Text>
        <Text style={styles.complaintVillage}>{complaint?.village_name}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{complaint?.status}</Text>
        </View>
      </View>

      {/* Photo Grid */}
      <ScrollView style={styles.photoContainer}>
        <View style={styles.photoGrid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              {!photo.synced && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline" size={16} color="#FFF" />
                </View>
              )}
              {photo.synced && (
                <View style={styles.syncedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                </View>
              )}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deletePhoto(photo.id)}
              >
                <Ionicons name="trash" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {photos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>No photos yet</Text>
            <Text style={styles.emptySubtext}>Take photos to attach to this complaint</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
          <Ionicons name="camera" size={28} color="#FFF" />
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
          <Ionicons name="images" size={28} color={theme.colors.primary} />
          <Text style={styles.galleryButtonText}>Gallery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  headerContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  complaintCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  complaintName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  complaintVillage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginTop: 8,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    color: '#FFF',
    fontWeight: theme.fontWeight.medium,
  },
  photoContainer: {
    flex: 1,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.sm,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    margin: '1%',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  offlineBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.warning,
    borderRadius: theme.borderRadius.full,
    padding: 4,
  },
  syncedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.full,
    padding: 4,
  },
  deleteButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: theme.colors.danger,
    borderRadius: theme.borderRadius.full,
    padding: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginTop: theme.spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.lg,
  },
  cameraButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  galleryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    gap: theme.spacing.sm,
  },
  buttonText: {
    color: '#FFF',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  galleryButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});

