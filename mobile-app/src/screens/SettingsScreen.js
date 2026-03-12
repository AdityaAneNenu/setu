import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { fonts } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTranslation } from '../context/LanguageContext';
import { authApi } from '../services/api';

export default function SettingsScreen({ navigation }) {
  const { triggerHaptic } = useAccessibility();
  const { t, currentLanguage, languages } = useTranslation();
  const { isDark, colors, themeMode, setThemeMode } = useTheme();
  const currentLangName = languages.find(l => l.id === currentLanguage)?.name || 'English';

  const handleClearCache = () => {
    triggerHaptic('medium');
    Alert.alert(
      t('settings.clearCache'),
      t('settings.clearCacheMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearCache'),
          style: 'destructive',
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(k =>
                !k.startsWith('language_') &&
                !k.startsWith('storage_cloud') &&
                !k.startsWith('@accessibility') &&
                !k.startsWith('@notification') &&
                !k.startsWith('@tts') &&
                !k.startsWith('@theme')
              );
              if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
              triggerHaptic('success');
              Alert.alert('Done', t('settings.cacheCleared'));
            } catch (e) {
              triggerHaptic('error');
              Alert.alert('Error', t('settings.clearCacheError'));
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    triggerHaptic('medium');
    Alert.alert(
      t('drawer.signOut'),
      t('settings.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('drawer.signOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await authApi.logout();
            } catch (error) {
              triggerHaptic('error');
              Alert.alert(t('common.error'), t('drawer.signOutError'));
            }
          },
        },
      ]
    );
  };

  const themeModes = [
    { key: 'system', label: t('settings.themeSystem'), icon: 'phone-portrait-outline' },
    { key: 'light', label: t('settings.themeLight'), icon: 'sunny-outline' },
    { key: 'dark', label: t('settings.themeDark'), icon: 'moon-outline' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>      
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      <View style={[styles.header, { backgroundColor: colors.backgroundGray }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: colors.textLight }]}>{t('settings.account')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.profile')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('Security')}>
            <Ionicons name="key-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.securityPassword')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('LanguageSettings')}>
            <Ionicons name="language-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.language')}</Text>
            <View style={styles.valueContainer}>
              <Text style={[styles.valueText, { color: colors.textLight }]}>{currentLangName}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Appearance Section - Dark Mode */}
        <Text style={[styles.sectionLabel, { color: colors.textLight }]}>{t('settings.appearance')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.darkMode')}</Text>
          </View>
          <View style={styles.themePicker}>
            {themeModes.map((mode) => (
              <TouchableOpacity
                key={mode.key}
                style={[
                  styles.themeOption,
                  { backgroundColor: colors.backgroundGray, borderColor: colors.border },
                  themeMode === mode.key && { backgroundColor: colors.buttonPrimaryBg, borderColor: colors.buttonPrimaryBg },
                ]}
                onPress={() => {
                  triggerHaptic('light');
                  setThemeMode(mode.key);
                }}
              >
                <Ionicons
                  name={mode.icon}
                  size={16}
                  color={themeMode === mode.key ? colors.buttonPrimaryText : colors.textLight}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.themeOptionText,
                  { color: themeMode === mode.key ? colors.buttonPrimaryText : colors.textLight },
                ]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy & Security */}
        <Text style={[styles.sectionLabel, { color: colors.textLight }]}>{t('settings.privacySecurity')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('PrivacyPolicy')}>
            <Ionicons name="document-text-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.privacyPolicy')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <Text style={[styles.sectionLabel, { color: colors.textLight }]}>{t('settings.preferences')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.notifications')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('AccessibilitySettings')}>
            <Ionicons name="accessibility-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.accessibility')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate('StorageCloud')}>
            <Ionicons name="cloud-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.storageCloud')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* App Section */}
        <Text style={[styles.sectionLabel, { color: colors.textLight }]}>{t('settings.app')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="information-circle-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.appVersion')}</Text>
            <Text style={[styles.valueText, { color: colors.textLight }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity style={styles.optionRow} onPress={handleClearCache}>
            <Ionicons name="trash-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('settings.clearCache')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.signOutCard, { backgroundColor: colors.card }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={22} color="#E53935" />
          <Text style={styles.signOutText}>{t('drawer.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingHorizontal: 41, paddingBottom: 16 },
  backButton: { padding: 0 },
  headerTitle: { fontSize: 18, fontFamily: fonts.semiBold },
  placeholder: { width: 24 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontFamily: fonts.semiBold, letterSpacing: 0.5, marginBottom: 12, marginLeft: 4 },
  card: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  optionTitle: { flex: 1, fontSize: 16, fontFamily: fonts.medium, marginLeft: 14 },
  valueContainer: { flexDirection: 'row', alignItems: 'center' },
  valueText: { fontSize: 14, fontFamily: fonts.regular, marginRight: 4 },
  divider: { height: 1, marginLeft: 36 },
  themePicker: { flexDirection: 'row', paddingBottom: 16, paddingTop: 4, gap: 10 },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  themeOptionText: { fontSize: 13, fontFamily: fonts.semiBold },
  signOutCard: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  signOutText: { flex: 1, fontSize: 16, fontFamily: fonts.semiBold, color: '#E53935', marginLeft: 14 },
});
