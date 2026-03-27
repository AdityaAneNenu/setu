import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEY = '@notification_prefs';

export default function NotificationsScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [gapAlerts, setGapAlerts] = useState(true);
  const [complaintUpdates, setComplaintUpdates] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  // Load saved prefs
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const prefs = JSON.parse(saved);
          setPushEnabled(prefs.pushEnabled ?? true);
          setEmailEnabled(prefs.emailEnabled ?? true);
          setSmsEnabled(prefs.smsEnabled ?? false);
          setGapAlerts(prefs.gapAlerts ?? true);
          setComplaintUpdates(prefs.complaintUpdates ?? true);
          setWeeklyReport(prefs.weeklyReport ?? false);
        }
      } catch (e) {}
    };
    loadPrefs();
  }, []);

  const savePrefs = async (key, value) => {
    const current = { pushEnabled, emailEnabled, smsEnabled, gapAlerts, complaintUpdates, weeklyReport };
    current[key] = value;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {}
  };

  const toggle = (key, setter, value) => {
    setter(value);
    savePrefs(key, value);
  };

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('notifications.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info Banner */}
        <View style={{ backgroundColor: isDark ? '#3E2723' : '#FFF3E0', borderRadius: 12, padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="information-circle-outline" size={20} color={isDark ? '#FFB74D' : '#E65100'} style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, fontSize: 13, fontFamily: fonts.regular, color: isDark ? '#FFB74D' : '#E65100' }}>{t('notifications.infoBanner')}</Text>
        </View>

        {/* Notification Channels Section */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('notifications.channels')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('notifications.pushNotifications')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('notifications.pushSubtitle')}</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={(v) => toggle('pushEnabled', setPushEnabled, v)}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('notifications.emailNotifications')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('notifications.emailSubtitle')}</Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={(v) => toggle('emailEnabled', setEmailEnabled, v)}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('notifications.smsNotifications')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('notifications.smsSubtitle')}</Text>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={(v) => toggle('smsEnabled', setSmsEnabled, v)}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Alert Types Section */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('notifications.alertTypes')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('notifications.gapAlerts')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('notifications.gapAlertsSubtitle')}</Text>
            </View>
            <Switch
              value={gapAlerts}
              onValueChange={(v) => toggle('gapAlerts', setGapAlerts, v)}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('notifications.complaintUpdates')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('notifications.complaintUpdatesSubtitle')}</Text>
            </View>
            <Switch
              value={complaintUpdates}
              onValueChange={(v) => toggle('complaintUpdates', setComplaintUpdates, v)}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('notifications.weeklyReport')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('notifications.weeklyReportSubtitle')}</Text>
            </View>
            <Switch
              value={weeklyReport}
              onValueChange={(v) => toggle('weeklyReport', setWeeklyReport, v)}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
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
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  optionInfo: {
    flex: 1,
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#000000',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
});
