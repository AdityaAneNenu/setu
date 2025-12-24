import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Platform, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { theme } from '../config/theme';
import syncService from '../services/syncService';
import storageService from '../services/storageService';

export default function HomeScreen({ navigation }) {
  const [syncStatus, setSyncStatus] = useState({
    unsyncedCount: 0,
    lastSync: null,
    isOnline: false,
    hasWiFi: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSyncStatus();
    
    // Auto-check for WiFi and sync every 30 seconds
    const interval = setInterval(() => {
      checkAndAutoSync();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    const status = await syncService.getSyncStatus();
    setSyncStatus(status);
  };

  const checkAndAutoSync = async () => {
    const status = await syncService.getSyncStatus();
    setSyncStatus(status);
    
    if (status.hasWiFi && status.unsyncedCount > 0) {
      console.log('Auto-syncing...');
      await syncService.autoSync();
      await loadSyncStatus();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSyncStatus();
    setRefreshing(false);
  };

  const formatLastSync = (lastSync) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark]}
        style={styles.header}
      >
        <Animatable.View animation="fadeInDown" duration={800}>
          <Text style={styles.headerTitle}>PM-AJAY Mobile</Text>
          <Text style={styles.headerSubtitle}>Complaint Management System</Text>
        </Animatable.View>
        
        {/* Sync Status */}
        <Animatable.View animation="fadeIn" delay={300} style={styles.syncStatusCard}>
          <View style={styles.syncStatusRow}>
            <View style={styles.syncStatusItem}>
              <Ionicons 
                name={syncStatus.hasWiFi ? "wifi" : "wifi-outline"} 
                size={20} 
                color={syncStatus.hasWiFi ? theme.colors.success : theme.colors.textLight} 
              />
              <Text style={styles.syncStatusText}>
                {syncStatus.hasWiFi ? 'WiFi' : 'No WiFi'}
              </Text>
            </View>
            
            <View style={styles.syncStatusItem}>
              <Ionicons 
                name="cloud-upload-outline" 
                size={20} 
                color={syncStatus.unsyncedCount > 0 ? theme.colors.warning : theme.colors.success} 
              />
              <Text style={styles.syncStatusText}>
                {syncStatus.unsyncedCount} pending
              </Text>
            </View>
            
            <View style={styles.syncStatusItem}>
              <Ionicons name="time-outline" size={20} color={theme.colors.textLight} />
              <Text style={styles.syncStatusText}>
                {formatLastSync(syncStatus.lastSync)}
              </Text>
            </View>
          </View>
        </Animatable.View>
      </LinearGradient>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Main Actions */}
        <View style={styles.actionsContainer}>
          <Animatable.View animation="fadeInUp" delay={400}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => navigation.navigate('QRScanner')}
            >
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryDark]}
                style={styles.primaryActionGradient}
              >
                <Ionicons name="qr-code-outline" size={48} color="#FFF" />
                <Text style={styles.primaryActionTitle}>Scan QR Code</Text>
                <Text style={styles.primaryActionSubtitle}>
                  Verify complaint and add photos
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animatable.View>

          {/* Secondary Actions */}
          <View style={styles.secondaryActions}>
            <Animatable.View animation="fadeInLeft" delay={600} style={styles.secondaryActionWrapper}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => navigation.navigate('Complaints')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.info + '20' }]}>
                  <Ionicons name="list-outline" size={28} color={theme.colors.info} />
                </View>
                <Text style={styles.secondaryActionText}>View Complaints</Text>
              </TouchableOpacity>
            </Animatable.View>

            <Animatable.View animation="fadeInRight" delay={600} style={styles.secondaryActionWrapper}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => navigation.navigate('Sync')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.success + '20' }]}>
                  <Ionicons name="sync-outline" size={28} color={theme.colors.success} />
                </View>
                <Text style={styles.secondaryActionText}>Sync Data</Text>
              </TouchableOpacity>
            </Animatable.View>
          </View>
        </View>

        {/* Info Cards */}
        <Animatable.View animation="fadeInUp" delay={800} style={styles.infoSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Scan QR Code</Text>
              <Text style={styles.stepDescription}>
                Scan the QR code on the complaint document to verify the unique ID
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Capture Photos</Text>
              <Text style={styles.stepDescription}>
                Take photos of the complaint site or evidence
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Auto-Sync</Text>
              <Text style={styles.stepDescription}>
                Photos are saved offline and automatically uploaded when WiFi is available
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: theme.fontWeight.bold,
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: theme.fontSize.md,
    color: 'rgba(255,255,255,0.9)',
    marginTop: theme.spacing.xs,
  },
  syncStatusCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  syncStatusItem: {
    alignItems: 'center',
  },
  syncStatusText: {
    color: '#FFF',
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
  },
  actionsContainer: {
    padding: theme.spacing.lg,
  },
  primaryAction: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  primaryActionGradient: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  primaryActionTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: '#FFF',
    marginTop: theme.spacing.md,
  },
  primaryActionSubtitle: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    marginTop: theme.spacing.xs,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  secondaryActionWrapper: {
    flex: 1,
  },
  secondaryAction: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  secondaryActionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  infoSection: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  stepNumberText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: '#FFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  stepDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

