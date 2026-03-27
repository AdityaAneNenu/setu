import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  FlatList, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { gapsApi, villagesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function SearchScreen({ navigation }) {
  const { user, userRole } = useAuth();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [allGaps, setAllGaps] = useState([]);
  const [results, setResults] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Ground workers only see their own gaps, others see all
        const filters = (userRole === 'ground' && user?.uid) ? { submitted_by: user.uid } : {};
        const [g, v] = await Promise.all([gapsApi.getAll(filters), villagesApi.getAll()]);
        setAllGaps(g || []);
        setVillages(v || []);
      } catch (e) {
        console.error('Search load error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSearch = (text) => {
    setQuery(text);
    if (text.length > 0) {
      const term = text.toLowerCase();
      const filtered = allGaps.filter((g) =>
        (g.gap_type || '').toLowerCase().includes(term) ||
        (g.description || '').toLowerCase().includes(term) ||
        (g.village_name || '').toLowerCase().includes(term) ||
        (g.severity || '').toLowerCase().includes(term) ||
        (g.status || '').toLowerCase().includes(term)
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  };

  const statusColors = { open: '#F44336', in_progress: '#FF9800', resolved: '#4CAF50' };
  const inputIcons = { image: 'camera-outline', voice: 'mic-outline', text: 'document-text-outline' };

  const quickSearches = [
    { label: t('search.openGaps'), value: 'open' },
    { label: t('search.highSeverity'), value: 'high' },
    { label: t('search.water'), value: 'water' },
    { label: t('search.road'), value: 'road' },
    { label: t('search.resolved'), value: 'resolved' },
    { label: t('search.electricity'), value: 'electricity' },
  ];

  const renderResult = ({ item }) => (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: colors.card }]}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GapDetail', { gapId: item.id })}
    >
      <View style={[styles.iconBg, { backgroundColor: `${statusColors[item.status] || '#999'}15` }]}>
        <Ionicons name={inputIcons[item.input_method] || 'document-text-outline'} size={20} color={statusColors[item.status] || '#999'} />
      </View>
      <View style={styles.resultContent}>
        <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
          {(item.gap_type || 'other').replace(/_/g, ' ')}
        </Text>
        <Text style={[styles.resultMeta, { color: colors.textLight }]} numberOfLines={1}>
          {item.village_name || 'Unknown'} · {item.severity} · {(item.status || 'open').replace(/_/g, ' ')}
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('search.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search-outline" size={18} color={colors.textLight} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.textPlaceholder}
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
          {query ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : query.length === 0 ? (
        <View style={styles.quickSection}>
          <Text style={[styles.sectionLabel, { color: colors.textLight }]}>{t('search.quickSearches')}</Text>
          <View style={styles.chipContainer}>
            {quickSearches.map((item) => (
              <TouchableOpacity key={item.value} style={[styles.chip, { backgroundColor: colors.card }]} onPress={() => handleSearch(item.value)}>
                <Text style={[styles.chipText, { color: colors.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 24, color: colors.textLight }]}>{t('search.summary')}</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <View style={[styles.summaryRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{t('search.totalGaps')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{allGaps.length}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{t('search.villagesCovered')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{villages.length}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{t('search.openIssues')}</Text>
              <Text style={[styles.summaryValue, { color: '#F44336' }]}>{allGaps.filter(g => g.status === 'open').length}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomColor: 'transparent' }]}>
              <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{t('search.resolved')}</Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{allGaps.filter(g => g.status === 'resolved').length}</Text>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: colors.textLight }]}>{results.length} {t('search.results')}</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={colors.textLight} />
              <Text style={[styles.emptyText, { color: colors.textLight }]}>{t('search.noResults')}</Text>
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
  quickSection: { paddingHorizontal: 24 },
  sectionLabel: { fontSize: 12, fontFamily: fonts.semiBold, color: '#888888', letterSpacing: 0.5, marginBottom: 12, marginLeft: 4 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, elevation: 1 },
  chipText: { fontSize: 14, fontFamily: fonts.medium, color: '#333' },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, elevation: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  summaryLabel: { fontSize: 14, fontFamily: fonts.regular, color: '#666' },
  summaryValue: { fontSize: 14, fontFamily: fonts.semiBold, color: '#000' },
  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  resultCount: { fontSize: 13, fontFamily: fonts.medium, color: '#888888', marginBottom: 12 },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 12, elevation: 2 },
  iconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  resultContent: { flex: 1, marginLeft: 14 },
  resultTitle: { fontSize: 16, fontFamily: fonts.medium, color: '#000000', marginBottom: 2, textTransform: 'capitalize' },
  resultMeta: { fontSize: 13, fontFamily: fonts.regular, color: '#888888', textTransform: 'capitalize' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontFamily: fonts.medium, color: '#888888', marginTop: 12 },
});
