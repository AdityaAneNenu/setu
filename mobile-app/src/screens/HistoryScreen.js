import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  FlatList, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { gapsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function HistoryScreen({ route, navigation }) {
  const { user, userRole } = useAuth();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const TABS = [t('history.all'), t('history.images'), t('history.audio'), t('history.text')];
  const TAB_KEYS = ['all', 'images', 'audio', 'text'];
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialFilter = route?.params?.filter || null;

  const loadGaps = async () => {
    try {
      // Ground workers only see their own gaps, others see all
      const filters = (userRole === 'ground' && user?.uid) ? { submitted_by: user.uid } : {};
      // Apply status filter from navigation params if present
      if (initialFilter) {
        filters.status = initialFilter;
      }
      const data = await gapsApi.getAll(filters);
      setGaps(data || []);
    } catch (error) {
      console.error('History load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadGaps(); }, [route?.params?.filter]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadGaps(); }, [userRole, user?.uid, initialFilter]);

  const filteredData = gaps.filter((item) => {
    const tabKey = TAB_KEYS[activeTab];
    const matchesTab =
      tabKey === 'all' ||
      (tabKey === 'images' && item.input_method === 'image') ||
      (tabKey === 'audio' && item.input_method === 'voice') ||
      (tabKey === 'text' && item.input_method === 'text');
    const matchesSearch =
      !searchQuery ||
      (item.gap_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.village_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getIcon = (method) => {
    switch (method) {
      case 'image': return 'camera-outline';
      case 'voice': return 'mic-outline';
      default: return 'document-text-outline';
    }
  };

  const statusColors = { open: '#F44336', in_progress: '#FF9800', resolved: '#4CAF50', under_review: '#2196F3', verified: '#009688', rejected: '#F44336' };

  const formatDate = (ts) => {
    if (!ts) return '';
    let d;
    if (ts.toDate) d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: colors.card }]}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GapDetail', { gapId: item.id })}
    >
      <View style={[styles.iconBg, { backgroundColor: `${statusColors[item.status] || '#999'}15` }]}>
        <Ionicons name={getIcon(item.input_method)} size={20} color={statusColors[item.status] || '#999'} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
          {(item.gap_type || 'other').replace(/_/g, ' ')}
        </Text>
        <Text style={[styles.itemMeta, { color: colors.textLight }]} numberOfLines={1}>
          {item.village_name || 'Unknown'} · {formatDate(item.created_at)} · {item.input_method || 'text'}
        </Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] || '#999' }]} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('history.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search-outline" size={18} color={colors.textLight} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('history.searchPlaceholder')}
            placeholderTextColor={colors.textPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.tabContainer}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.tab, { backgroundColor: colors.card }, activeTab === index && { backgroundColor: colors.buttonPrimaryBg }]}
            onPress={() => setActiveTab(index)}
          >
            <Text style={[styles.tabText, { color: colors.textLight }, activeTab === index && { color: colors.buttonPrimaryText }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>{t('history.noGapsFound')}</Text>
              <Text style={styles.emptySubText}>{t('history.submitFirst')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingHorizontal: 41, paddingBottom: 16 },
  backButton: { padding: 0 },
  headerTitle: { fontSize: 18, fontFamily: fonts.semiBold, color: '#000000' },
  placeholder: { width: 24 },
  searchContainer: { paddingHorizontal: 24, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 20, height: 50, elevation: 2 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: fonts.regular, color: '#000000', marginLeft: 12 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 20, gap: 10 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF' },
  activeTab: { backgroundColor: '#000000' },
  tabText: { fontSize: 14, fontFamily: fonts.medium, color: colors.textLight },
  activeTabText: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 12, elevation: 2 },
  iconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemContent: { flex: 1, marginLeft: 14 },
  itemTitle: { fontSize: 16, fontFamily: fonts.medium, color: '#000000', marginBottom: 2, textTransform: 'capitalize' },
  itemMeta: { fontSize: 13, fontFamily: fonts.regular, color: colors.textLight },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontFamily: fonts.medium, color: colors.textLight, marginTop: 12 },
  emptySubText: { fontSize: 13, fontFamily: fonts.regular, color: '#CCC', marginTop: 4 },
});
