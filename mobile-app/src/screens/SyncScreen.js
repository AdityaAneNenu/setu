import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { theme } from '../config/theme';
import syncService from '../services/syncService';
import storageService from '../services/storageService';

export default function SyncScreen({ navigation }) {
  const [syncStatus, setSyncStatus] = useState({
    unsyncedCount: 0,
    lastSync: null,
    isOnline: false,
    hasWiFi: false,
    isSyncing: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [unsyncedPhotos, setUnsyncedPhotos] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const status = await syncService.getSyncStatus();
    setSyncStatus(status);
    
    const photos = await storageService.getUnsyncedPhotos();
    setUnsyncedPhotos(photos);
  };

  const handleSync = async () => {
    if (!syncStatus.hasWiFi) {
      Alert.alert(
        'WiFi Required',
        'Please connect to WiFi to sync your photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSyncing(true);
    
    const result = await syncService.syncPhotos((progress) => {
      setSyncProgress(progress);
    });

    setSyncing(false);
    
    if (result.success) {
      Alert.alert('Success', result.message);
      await loadData();
    } else {
      Alert.alert('Sync Failed', result.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.success, theme.colors.secondaryDark]}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sync Data</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <Animatable.View animation="fadeInDown" style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons 
                name={syncStatus.hasWiFi ? "wifi" : "wifi-outline"} 
                size={32} 
                color={syncStatus.hasWiFi ? theme.colors.success : theme.colors.danger} 
              />
              <Text style={styles.statusLabel}>WiFi</Text>
              <Text style={styles.statusValue}>
                {syncStatus.hasWiFi ? 'Connected' : 'Not Connected'}
              </Text>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.statusItem}>
              <Ionicons 
                name="cloud-upload-outline" 
                size={32} 
                color={syncStatus.unsyncedCount > 0 ? theme.colors.warning : theme.colors.success} 
              />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={styles.statusValue}>{syncStatus.unsyncedCount} photos</Text>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.statusItem}>
              <Ionicons name="time-outline" size={32} color={theme.colors.info} />
              <Text style={styles.statusLabel}>Last Sync</Text>
              <Text style={styles.statusValue}>
                {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleDateString() : 'Never'}
              </Text>
            </View>
          </View>
        </Animatable.View>

        {/* Sync Button */}
        <Animatable.View animation="fadeInUp" delay={200}>
          <TouchableOpacity
            style={[
              styles.syncButton,
              (!syncStatus.hasWiFi || syncing || syncStatus.unsyncedCount === 0) && styles.syncButtonDisabled
            ]}
            onPress={handleSync}
            disabled={!syncStatus.hasWiFi || syncing || syncStatus.unsyncedCount === 0}
          >
            {syncing ? (
              <View style={styles.syncingContainer}>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.syncButtonText}>
                  Syncing {syncProgress.current}/{syncProgress.total}...
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="sync" size={24} color="#FFF" />
                <Text style={styles.syncButtonText}>
                  {syncStatus.unsyncedCount === 0 ? 'All Synced' : 'Sync Now'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animatable.View>

        {/* Unsynced Photos List */}
        {unsyncedPhotos.length > 0 && (
          <Animatable.View animation="fadeInUp" delay={400} style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Pending Photos ({unsyncedPhotos.length})</Text>
            
            {unsyncedPhotos.map((photo, index) => (
              <View key={photo.id} style={styles.photoItem}>
                <View style={styles.photoIcon}>
                  <Ionicons name="image" size={24} color={theme.colors.primary} />
                </View>
                <View style={styles.photoInfo}>
                  <Text style={styles.photoComplaintId}>{photo.complaintId}</Text>
                  <Text style={styles.photoDate}>{formatDate(photo.timestamp)}</Text>
                </View>
                <Ionicons name="cloud-offline" size={20} color={theme.colors.warning} />
              </View>
            ))}
          </Animatable.View>
        )}

        {/* Info Section */}
        <Animatable.View animation="fadeInUp" delay={600} style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={theme.colors.info} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Auto-Sync Enabled</Text>
              <Text style={styles.infoText}>
                Photos will automatically sync when WiFi is detected. You can also manually sync anytime.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={24} color={theme.colors.success} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Offline First</Text>
              <Text style={styles.infoText}>
                All photos are saved locally first, ensuring no data loss even without internet.
              </Text>
            </View>
          </View>
        </Animatable.View>
      </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  statusLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  statusValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    marginHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    ...theme.shadows.md,
  },
  syncButtonDisabled: {
    backgroundColor: theme.colors.textLight,
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  photosSection: {
    margin: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  photoIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  photoInfo: {
    flex: 1,
  },
  photoComplaintId: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  photoDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  infoSection: {
    margin: theme.spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  infoContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  infoTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

