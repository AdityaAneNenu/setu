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


// Horizontal pill scroller component
const LangScroller = ({ languages, selectedId, onSelect }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.langScrollContent}
  >
    {languages.map((lang) => {
      const isSelected = selectedId === lang.id;
      return (
        <TouchableOpacity
          key={lang.id}
          style={[styles.langPill, isSelected && styles.langPillSelected]}
          onPress={() => onSelect(lang.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.langPillNative, isSelected && styles.langPillNativeSelected]}>
            {lang.native}
          </Text>
          <Text style={[styles.langPillLabel, isSelected && styles.langPillLabelSelected]}>
            {lang.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

export default function LanguageSettingsScreen({ navigation }) {
  const { t, currentLanguage, changeLanguage, languages } = useTranslation();
  const { colors, isDark } = useTheme();
  const [autoDetect, setAutoDetect] = useState(true);
  const [scanLang, setScanLang] = useState('en');
  const [audioLang, setAudioLang] = useState('hi');

  // Load saved preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const saved = await AsyncStorage.getItem('language_settings');
        if (saved) {
          const prefs = JSON.parse(saved);
          setAutoDetect(prefs.autoDetect !== false);
          setScanLang(prefs.scanLang || 'en');
          setAudioLang(prefs.audioLang || 'hi');
        }
      } catch (e) { /* preferences load error */ }
    };
    loadPrefs();
  }, []);

  // Save preferences on change
  const savePrefs = async (key, value) => {
    try {
      const current = await AsyncStorage.getItem('language_settings');
      const prefs = current ? JSON.parse(current) : {};
      prefs[key] = value;
      await AsyncStorage.setItem('language_settings', JSON.stringify(prefs));
    } catch (e) { /* preferences save error */ }
  };

  const handleAppLang = (id) => { changeLanguage(id); };
  const handleScanLang = (id) => { setScanLang(id); savePrefs('scanLang', id); };
  const handleAudioLang = (id) => { setAudioLang(id); savePrefs('audioLang', id); };
  const handleAutoDetect = (val) => { setAutoDetect(val); savePrefs('autoDetect', val); };

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('language.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Auto Detect */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('language.preferences')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="globe-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>{t('language.autoDetect')}</Text>
            <Switch
              value={autoDetect}
              onValueChange={handleAutoDetect}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* App Language */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('language.appLanguage')}</Text>
        <LangScroller languages={languages} selectedId={currentLanguage} onSelect={handleAppLang} />

        {/* Scan Language */}
        <Text style={[styles.sectionLabel, { marginTop: 24, color: colors.text }]}>{t('language.scanLanguage')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="document-text-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {languages.find(l => l.id === scanLang)?.label || 'English'}
            </Text>
            <Text style={styles.nativeText}>
              {languages.find(l => l.id === scanLang)?.native || ''}
            </Text>
          </View>
        </View>
        <LangScroller languages={languages} selectedId={scanLang} onSelect={handleScanLang} />

        {/* Audio Language */}
        <Text style={[styles.sectionLabel, { marginTop: 24, color: colors.text }]}>{t('language.audioLanguage')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="mic-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {languages.find(l => l.id === audioLang)?.label || 'Hindi'}
            </Text>
            <Text style={styles.nativeText}>
              {languages.find(l => l.id === audioLang)?.native || ''}
            </Text>
          </View>
        </View>
        <LangScroller languages={languages} selectedId={audioLang} onSelect={handleAudioLang} />
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#888888',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 12,
    marginHorizontal: 24,
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
  nativeText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 36,
  },
  // Horizontal language scroller pills
  langScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 4,
    gap: 10,
  },
  langPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    elevation: 2,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  langPillSelected: {
    backgroundColor: '#000000',
  },
  langPillNative: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 2,
  },
  langPillNativeSelected: {
    color: '#FFFFFF',
  },
  langPillLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  langPillLabelSelected: {
    color: '#CCCCCC',
  },
});
