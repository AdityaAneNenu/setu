import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Dimensions, Platform, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDrawerProgress } from '@react-navigation/drawer';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { fonts } from '../theme';
import { authApi, gapsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { parseArray } from '../utils/safeJSON';

const { width } = Dimensions.get('window');

// ─── Quick Tips Data ────────────────────────────────────────
const TIPS = [
  { icon: 'camera', color: '#2196F3', key: 'home.tip1' },
  { icon: 'location', color: '#4CAF50', key: 'home.tip2' },
  { icon: 'mic', color: '#FF9800', key: 'home.tip3' },
  { icon: 'document-text', color: '#9C27B0', key: 'home.tip4' },
  { icon: 'time', color: '#E91E63', key: 'home.tip5' },
  { icon: 'shield-checkmark', color: '#009688', key: 'home.tip6' },
];

export default function HomeScreen({ navigation }) {
  const { user, userRole } = useAuth();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [userName, setUserName] = useState('');
  const [recentGaps, setRecentGaps] = useState([]);
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [nearbyGaps, setNearbyGaps] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);
  const [locationName, setLocationName] = useState(null);
  const insets = useSafeAreaInsets();
  const progress = useDrawerProgress();
  const tipTimer = useRef(null);

  // ─── Rotate tips every 6 seconds ───────────────────────
  useEffect(() => {
    tipTimer.current = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % TIPS.length);
    }, 6000);
    return () => clearInterval(tipTimer.current);
  }, []);

  // ─── Check pending offline submissions ──────────────────
  const checkPendingSync = async () => {
    try {
      const pending = await AsyncStorage.getItem('pendingSubmissions');
      const items = parseArray(pending);
      setPendingCount(Array.isArray(items) ? items.length : 0);
    } catch {
      setPendingCount(0);
    }
  };

  // ─── Get current location for nearby gaps ───────────────
  const fetchNearbyGaps = async (allGaps) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNearbyGaps([]);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      // Reverse geocode for display
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        setLocationName(place.subregion || place.city || place.district || place.region || 'Your Area');
      }

      // Filter gaps that have coordinates within ~5km radius
      const nearby = allGaps.filter(g => {
        if (!g.latitude || !g.longitude) return false;
        const dist = getDistanceKm(latitude, longitude, g.latitude, g.longitude);
        return dist <= 5;
      });
      setNearbyGaps(nearby.slice(0, 5));
    } catch {
      setNearbyGaps([]);
    }
  };

  // ─── Haversine distance (km) ────────────────────────────
  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ─── Derive status updates from gaps ────────────────────
  const deriveStatusUpdates = (gaps) => {
    const statusMessages = {
      in_progress: { icon: 'hammer', color: '#FF9800', label: t('home.statusWorkStarted') },
      under_review: { icon: 'eye', color: '#2196F3', label: t('home.statusUnderReview') },
      resolved: { icon: 'checkmark-circle', color: '#4CAF50', label: t('home.statusResolved') },
      verified: { icon: 'shield-checkmark', color: '#009688', label: t('home.statusVerified') },
      rejected: { icon: 'close-circle', color: '#F44336', label: t('home.statusUpdateNeeded') },
    };

    return gaps
      .filter(g => g.status && g.status !== 'open' && g.status !== 'submitted')
      .slice(0, 5)
      .map(g => {
        const meta = statusMessages[g.status] || { icon: 'information-circle', color: '#999', label: t('home.statusUpdated') };
        const typeName = (g.gap_type || 'issue').replace(/_/g, ' ');
        return {
          id: g.id,
          icon: meta.icon,
          color: meta.color,
          message: `${meta.label} ${typeName} in ${g.village_name || 'Unknown'}`,
          status: g.status,
          time: g.updated_at,
        };
      });
  };

  // ─── Load all data ──────────────────────────────────────
  const loadData = async () => {
    try {
      const userId = (userRole === 'ground' && user?.uid) ? user.uid : null;
      const filters = userId ? { submitted_by: userId } : {};
      const gapsData = await gapsApi.getAll(filters);
      const allGaps = gapsData || [];

      setRecentGaps(allGaps.slice(0, 3));
      setStatusUpdates(deriveStatusUpdates(allGaps));
      await Promise.all([checkPendingSync(), fetchNearbyGaps(allGaps)]);
    } catch (error) {
      console.error('Home load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = authApi.onAuthStateChange((authUser) => {
      if (authUser) {
        setUserName(authUser.displayName || authUser.email?.split('@')[0] || 'User');
      }
    });
    loadData();
    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 0.8]);
    const rotate = interpolate(progress.value, [0, 1], [0, -5]);
    return { transform: [{ scale }, { rotate: `${rotate}deg` }] };
  });

  const severityColors = { high: '#F44336', medium: '#FF9800', low: '#4CAF50' };
  const statusColors = { open: '#F44336', in_progress: '#FF9800', resolved: '#4CAF50', verified: '#009688', under_review: '#2196F3' };
  const inputIcons = { image: 'camera', voice: 'mic', text: 'document-text' };
  const tip = TIPS[currentTip];

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.backgroundGray }, animatedStyle]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()} activeOpacity={0.7}>
          <View style={[styles.menuLine, { backgroundColor: colors.text }]} />
          <View style={[styles.menuLine, styles.menuLineShort, { backgroundColor: colors.text }]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
          <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#3D2200' : '#FFF3E0' }]}>
            <Ionicons name="person" size={18} color={colors.accent} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Greeting */}
      <View style={styles.greetingContainer}>
        <Text style={[styles.helloText, { color: colors.text }]}>{t('home.hello')}</Text>
        <Text style={[styles.userText, { color: colors.text }]}>{userName},</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
      >
        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('ScanDocument')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: isDark ? '#1A3A5C' : '#E3F2FD' }]}>
              <Ionicons name="camera" size={24} color="#2196F3" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{t('home.scanPhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('UploadAudio')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: isDark ? '#3D2800' : '#FFF3E0' }]}>
              <Ionicons name="mic" size={24} color="#FF9800" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{t('home.recordAudio')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('GapForm', { mediaUri: null, mediaType: null, language: null })} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: isDark ? '#1B3D1F' : '#E8F5E9' }]}>
              <Ionicons name="create" size={24} color="#4CAF50" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{t('home.textReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: isDark ? '#3D1A24' : '#FCE4EC' }]}>
              <Ionicons name="time" size={24} color="#E91E63" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>{t('home.myHistory')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* ── Pending Sync Banner ────────────────────── */}
            <TouchableOpacity
              style={[
                styles.syncBanner,
                pendingCount > 0
                  ? {
                    backgroundColor: isDark ? '#3A2A12' : '#FFF8E1',
                    borderWidth: 1,
                    borderColor: isDark ? '#6E4B1A' : '#FFE0B2',
                  }
                  : {
                    backgroundColor: isDark ? '#163321' : '#F1F8E9',
                    borderWidth: 1,
                    borderColor: isDark ? '#2A5A3D' : '#DCEDC8',
                  },
              ]}
              activeOpacity={0.8}
              onPress={() => pendingCount > 0 && navigation.navigate('History')}
            >
              <View style={[styles.syncIconBg, { backgroundColor: pendingCount > 0 ? (isDark ? '#3D2800' : '#FFF3E0') : (isDark ? '#1B3D1F' : '#E8F5E9') }]}>
                <Ionicons
                  name={pendingCount > 0 ? 'cloud-upload' : 'cloud-done'}
                  size={20}
                  color={pendingCount > 0 ? '#FF9800' : '#4CAF50'}
                />
              </View>
              <View style={styles.syncInfo}>
                <Text style={[styles.syncTitle, { color: colors.text }]}>
                  {pendingCount > 0 ? t('home.pendingSync', { count: pendingCount }) : t('home.allSynced')}
                </Text>
                <Text style={[styles.syncSubtext, { color: colors.textLight }]}>
                  {pendingCount > 0 ? t('home.willUpload') : t('home.upToDate')}
                </Text>
              </View>
              {pendingCount > 0 && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── Status Updates ──────────────────────────── */}
            {statusUpdates.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.statusUpdates')}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                    <Text style={[styles.viewAllText, { color: colors.accent }]}>{t('home.seeAll')}</Text>
                  </TouchableOpacity>
                </View>
                {statusUpdates.map((update, idx) => (
                  <TouchableOpacity
                    key={update.id || idx}
                    style={[styles.updateRow, { backgroundColor: colors.card }]}
                    onPress={() => navigation.navigate('GapDetail', { gapId: update.id })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.updateIconBg, { backgroundColor: `${update.color}15` }]}>
                      <Ionicons name={update.icon} size={16} color={update.color} />
                    </View>
                    <Text style={[styles.updateMessage, { color: colors.text }]} numberOfLines={2}>{update.message}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.iconInactive} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Recent Submissions ─────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.myRecentReports')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('History')}>
                  <Text style={[styles.viewAllText, { color: colors.accent }]}>{t('home.seeAll')}</Text>
                </TouchableOpacity>
              </View>
              {recentGaps.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
                  <Ionicons name="document-text-outline" size={40} color={colors.emptyIconColor} />
                  <Text style={[styles.emptyText, { color: colors.emptyTextColor }]}>{t('home.noReportsYet')}</Text>
                  <Text style={[styles.emptySubText, { color: colors.emptySubTextColor }]}>{t('home.noReportsDesc')}</Text>
                </View>
              ) : (
                recentGaps.map(gap => (
                  <TouchableOpacity
                    key={gap.id}
                    style={[styles.gapRow, { backgroundColor: colors.card }]}
                    onPress={() => navigation.navigate('GapDetail', { gapId: gap.id })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.gapIcon, { backgroundColor: `${severityColors[gap.severity] || '#999'}15` }]}>
                      <Ionicons name={inputIcons[gap.input_method] || 'document-text'} size={16} color={severityColors[gap.severity] || '#999'} />
                    </View>
                    <View style={styles.gapInfo}>
                      <Text style={[styles.gapType, { color: colors.text }]} numberOfLines={1}>{(gap.gap_type || 'other').replace(/_/g, ' ')}</Text>
                      <Text style={[styles.gapVillage, { color: colors.textLight }]} numberOfLines={1}>{gap.village_name || 'Unknown'}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: `${statusColors[gap.status] || '#999'}15` }]}>
                      <Text style={[styles.statusPillText, { color: statusColors[gap.status] || '#999' }]}>
                        {(gap.status || 'open').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* ── Nearby Gaps ────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.nearbyHeader}>
                  <Ionicons name="location" size={16} color="#FA4A0C" />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}> {t('home.nearby')}{locationName ? ` · ${locationName}` : ''}</Text>
                </View>
              </View>
              {nearbyGaps.length === 0 ? (
                <View style={[styles.nearbyEmpty, { backgroundColor: colors.card }]}>
                  <Ionicons name="navigate-circle-outline" size={32} color={colors.emptyIconColor} />
                  <Text style={[styles.nearbyEmptyText, { color: colors.emptyTextColor }]}>{t('home.noNearbyGaps')}</Text>
                  <Text style={[styles.nearbyEmptySubText, { color: colors.emptySubTextColor }]}>{t('home.nearbyRadius')}</Text>
                </View>
              ) : (
                nearbyGaps.map(gap => (
                  <TouchableOpacity
                    key={gap.id}
                    style={[styles.gapRow, { backgroundColor: colors.card }]}
                    onPress={() => navigation.navigate('GapDetail', { gapId: gap.id })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.gapIcon, { backgroundColor: `${severityColors[gap.severity] || '#999'}15` }]}>
                      <Ionicons name="location" size={16} color={severityColors[gap.severity] || '#999'} />
                    </View>
                    <View style={styles.gapInfo}>
                      <Text style={[styles.gapType, { color: colors.text }]} numberOfLines={1}>{(gap.gap_type || 'other').replace(/_/g, ' ')}</Text>
                      <Text style={[styles.gapVillage, { color: colors.textLight }]} numberOfLines={1}>{gap.village_name || 'Unknown'}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: `${statusColors[gap.status] || '#999'}15` }]}>
                      <Text style={[styles.statusPillText, { color: statusColors[gap.status] || '#999' }]}>
                        {(gap.status || 'open').replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* ── Quick Tip Card ──────────────────────────── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.quickTip')}</Text>
              <View style={[styles.tipCard, { backgroundColor: colors.card }]}>
                <View style={[styles.tipIconBg, { backgroundColor: `${tip.color}15` }]}>
                  <Ionicons name={tip.icon} size={20} color={tip.color} />
                </View>
                <Text style={[styles.tipText, { color: colors.textLight }]}>{t(tip.key)}</Text>
                <View style={styles.tipDots}>
                  {TIPS.map((_, i) => (
                    <View key={i} style={[styles.tipDot, { backgroundColor: colors.border }, i === currentTip && styles.tipDotActive]} />
                  ))}
                </View>
              </View>
            </View>

            {/* ── Quick Links ─────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.moreGrid}>
                <TouchableOpacity style={[styles.moreCard, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('Search')} activeOpacity={0.7}>
                  <Ionicons name="search" size={22} color={colors.accent} />
                  <Text style={[styles.moreLabel, { color: colors.text }]}>{t('home.searchLabel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.moreCard, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('HelpSupport')} activeOpacity={0.7}>
                  <Ionicons name="help-circle" size={22} color={colors.accent} />
                  <Text style={[styles.moreLabel, { color: colors.text }]}>{t('home.helpLabel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.tabBarBg, borderTopColor: colors.tabBarBorder }]}>
        <TouchableOpacity style={styles.tabItem} activeOpacity={0.7} onPress={() => navigation.navigate('Home')}>
          <View style={styles.homeIconWrapper}>
            <Ionicons name="home" size={24} color={colors.text} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('ScanDocument')} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={24} color={colors.iconInactive} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('UploadAudio')} activeOpacity={0.7}>
          <Ionicons name="mic-outline" size={24} color={colors.iconInactive} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
          <Ionicons name="person-outline" size={24} color={colors.iconInactive} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F8' },
  header: { paddingTop: 10, paddingHorizontal: 24, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuButton: { width: 22, height: 15, justifyContent: 'space-between' },
  menuLine: { width: 22, height: 2, backgroundColor: '#000000', borderRadius: 1 },
  menuLineShort: { width: 14 },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  greetingContainer: { paddingHorizontal: 24, marginTop: 16, marginBottom: 20 },
  helloText: { fontSize: 28, fontFamily: fonts.bold, color: '#000', lineHeight: 34 },
  userText: { fontSize: 28, fontFamily: fonts.bold, color: '#000', lineHeight: 34 },
  scroll: { flex: 1 },

  // Quick Actions
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  quickAction: { alignItems: 'center', width: (width - 64) / 4 },
  quickIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 12, fontFamily: fonts.medium, color: '#333', textAlign: 'center', lineHeight: 16 },

  // Sync Banner
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16,
    padding: 14, borderRadius: 14, elevation: 1,
  },
  syncBannerPending: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE0B2' },
  syncBannerOk: { backgroundColor: '#F1F8E9', borderWidth: 1, borderColor: '#DCEDC8' },
  syncIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  syncInfo: { flex: 1 },
  syncTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: '#333' },
  syncSubtext: { fontSize: 11, fontFamily: fonts.regular, color: '#888', marginTop: 2 },
  syncBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#FF9800',
    justifyContent: 'center', alignItems: 'center',
  },
  syncBadgeText: { fontSize: 11, fontFamily: fonts.bold, color: '#FFF' },

  // Status Updates
  updateRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12,
    padding: 12, marginBottom: 6, elevation: 1,
  },
  updateIconBg: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  updateMessage: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: '#333', lineHeight: 18 },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: '#000' },
  viewAllText: { fontSize: 13, fontFamily: fonts.semiBold, color: '#FA4A0C' },

  // Empty States
  emptyState: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#FFF', borderRadius: 16, padding: 24 },
  emptyText: { fontSize: 15, fontFamily: fonts.semiBold, color: '#999', marginTop: 12 },
  emptySubText: { fontSize: 13, fontFamily: fonts.regular, color: '#BBB', marginTop: 4, textAlign: 'center' },

  // Gap Rows
  gapRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14,
    padding: 12, marginBottom: 6, elevation: 1,
  },
  gapIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  gapInfo: { flex: 1 },
  gapType: { fontSize: 14, fontFamily: fonts.semiBold, color: '#000', textTransform: 'capitalize' },
  gapVillage: { fontSize: 11, fontFamily: fonts.regular, color: '#888', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontFamily: fonts.semiBold, textTransform: 'capitalize' },

  // Nearby Gaps
  nearbyHeader: { flexDirection: 'row', alignItems: 'center' },
  nearbyEmpty: { alignItems: 'center', paddingVertical: 20, backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  nearbyEmptyText: { fontSize: 14, fontFamily: fonts.semiBold, color: '#999', marginTop: 10 },
  nearbyEmptySubText: { fontSize: 12, fontFamily: fonts.regular, color: '#BBB', marginTop: 4 },

  // Quick Tip
  tipCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 18, elevation: 1, alignItems: 'center',
  },
  tipIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  tipText: { fontSize: 13, fontFamily: fonts.regular, color: '#555', textAlign: 'center', lineHeight: 20 },
  tipDots: { flexDirection: 'row', marginTop: 12 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E0E0E0', marginHorizontal: 3 },
  tipDotActive: { backgroundColor: '#FA4A0C', width: 18 },

  // More Grid
  moreGrid: { flexDirection: 'row', gap: 10 },
  moreCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 1,
  },
  moreLabel: { fontSize: 13, fontFamily: fonts.medium, color: '#333', marginTop: 8 },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 14, backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  tabItem: { padding: 8 },
  homeIconWrapper: {
    shadowColor: 'rgba(215, 56, 0, 0.4)', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1, shadowRadius: 20, elevation: 6,
  },
});
