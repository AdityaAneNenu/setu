import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '../theme';
import { gapsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function StorageCloudScreen({ navigation }) {
  const { user, userRole } = useAuth();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [autoBackup, setAutoBackup] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState({ audioFiles: 0, imageFiles: 0, totalGaps: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load toggle prefs
      const prefs = await AsyncStorage.getItem('storage_cloud_prefs');
      if (prefs) {
        const p = JSON.parse(prefs);
        setAutoBackup(p.autoBackup !== false);
        setWifiOnly(p.wifiOnly !== false);
      }
      // Get real storage data from Firestore - filter by user for ground workers
      const filters = (userRole === 'ground' && user?.uid) ? { submitted_by: user.uid } : {};
      const gaps = await gapsApi.getAll(filters);
      const audioFiles = gaps.filter(g => g.audio_url).length;
      const imageFiles = gaps.filter(g => g.image_url).length;
      setStorageInfo({ audioFiles, imageFiles, totalGaps: gaps.length });
    } catch (e) {
      // Storage load failed silently
    } finally {
      setLoading(false);
    }
  };

  const saveToggle = async (key, value) => {
    try {
      const current = await AsyncStorage.getItem('storage_cloud_prefs');
      const prefs = current ? JSON.parse(current) : {};
      prefs[key] = value;
      await AsyncStorage.setItem('storage_cloud_prefs', JSON.stringify(prefs));
    } catch (e) { /* save error */ }
  };

  const handleAutoBackup = (val) => { setAutoBackup(val); saveToggle('autoBackup', val); };
  const handleWifiOnly = (val) => { setWifiOnly(val); saveToggle('wifiOnly', val); };

  const handleClearCache = async () => {
    Alert.alert(t('storage.clearCache'), t('storage.confirmClearMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('storage.clear'), style: 'destructive', onPress: async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k =>
              !k.startsWith('storage_cloud') &&
              !k.startsWith('language_') &&
              !k.startsWith('@accessibility') &&
              !k.startsWith('@notification') &&
              !k.startsWith('@tts')
            );
            await AsyncStorage.multiRemove(cacheKeys);
            Alert.alert(t('storage.done'), t('storage.cacheCleared'));
          } catch (e) { Alert.alert(t('common.error'), t('storage.clearCacheFailed')); }
        },
      },
    ]);
  };

  const totalFiles = storageInfo.audioFiles + storageInfo.imageFiles;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('storage.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Storage Usage */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('storage.storageLabel')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: 20 }} />
          ) : (
            <>
              <View style={styles.storageHeader}>
                <Text style={[styles.storageTitle, { color: colors.text }]}>{totalFiles} {t('storage.files')}</Text>
                <Text style={styles.storageSubtitle}>{t('storage.inCloudStorage')}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, totalFiles > 0 ? Math.max(5, (totalFiles / Math.max(storageInfo.totalGaps, 1)) * 100) : 0)}%` }]} />
              </View>
              <View style={styles.storageBreakdown}>
                <View style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.breakdownText}>{t('storage.audioRecordings')}  {storageInfo.audioFiles} {t('storage.files')}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: colors.text }]} />
                  <Text style={styles.breakdownText}>{t('storage.imagesDocuments')}  {storageInfo.imageFiles} {t('storage.files')}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: colors.textLight }]} />
                  <Text style={styles.breakdownText}>{t('storage.totalGaps')}  {storageInfo.totalGaps}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Cloud Sync */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('storage.cloudSync')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.text} />
            <View style={{ flex: 1, marginLeft: 14, marginRight: 10 }}>
              <Text style={{ fontSize: 16, fontFamily: fonts.medium, color: colors.text }}>{t('storage.autoBackup')}</Text>
              <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textLight }}>{t('storage.autoBackupDesc')}</Text>
            </View>
            <Switch
              value={autoBackup}
              onValueChange={handleAutoBackup}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.optionRow}>
            <Ionicons name="wifi-outline" size={22} color={colors.text} />
            <View style={{ flex: 1, marginLeft: 14, marginRight: 10 }}>
              <Text style={{ fontSize: 16, fontFamily: fonts.medium, color: colors.text }}>{t('storage.wifiOnly')}</Text>
              <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.textLight }}>{t('storage.wifiOnlyDesc')}</Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={handleWifiOnly}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.optionRow} onPress={async () => {
            setLoading(true);
            await loadData();
            Alert.alert(t('storage.synced'), t('storage.syncedMsg'));
          }}>
            <Ionicons name="sync-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('storage.syncNow')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Manage */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('storage.manage')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('History')}>
            <Ionicons name="download-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('storage.allFiles')}</Text>
            <View style={styles.valueContainer}>
              <Text style={styles.valueText}>{totalFiles} {t('storage.files')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.optionRow} onPress={handleClearCache}>
            <Ionicons name="trash-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('storage.clearCache')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 41,
    paddingBottom: 16,
  },
  backButton: {
    padding: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: '#000000',
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#888888',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  optionTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#000000',
    marginLeft: 14,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 36,
  },
  // Storage section
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingTop: 16,
    paddingBottom: 12,
    gap: 6,
  },
  storageTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: '#000000',
  },
  storageSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    marginBottom: 16,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#FA4A0C',
    borderRadius: 3,
  },
  storageBreakdown: {
    paddingBottom: 16,
    gap: 10,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  breakdownText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
  },
});
