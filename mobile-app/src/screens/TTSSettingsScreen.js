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
import * as Speech from 'expo-speech';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEY = '@tts_prefs';

const VOICES = [
  { id: 'default', labelKey: 'tts.defaultVoice', previewKey: 'tts.defaultVoiceDesc' },
  { id: 'female', labelKey: 'tts.femaleVoice', previewKey: 'tts.femaleVoiceDesc' },
  { id: 'male', labelKey: 'tts.maleVoice', previewKey: 'tts.maleVoiceDesc' },
];

const SPEEDS = [
  { id: 'slow', label: '0.75x', rate: 0.75 },
  { id: 'normal', label: '1.0x', rate: 1.0 },
  { id: 'fast', label: '1.25x', rate: 1.25 },
  { id: 'faster', label: '1.5x', rate: 1.5 },
];

export default function TTSSettingsScreen({ navigation }) {
  const { t, currentLanguage, languages } = useTranslation();
  const { colors, isDark } = useTheme();
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('default');
  const [selectedSpeed, setSelectedSpeed] = useState('normal');
  const [autoRead, setAutoRead] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const prefs = JSON.parse(saved);
          setTtsEnabled(prefs.ttsEnabled ?? true);
          setSelectedVoice(prefs.selectedVoice ?? 'default');
          setSelectedSpeed(prefs.selectedSpeed ?? 'normal');
          setAutoRead(prefs.autoRead ?? false);
        }
      } catch (e) {}
    };
    loadPrefs();
  }, []);

  const savePrefs = (overrides = {}) => {
    const prefs = { ttsEnabled, selectedVoice, selectedSpeed, autoRead, ...overrides };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {});
  };

  const handlePreview = (voiceLabel) => {
    const speedConfig = SPEEDS.find(s => s.id === selectedSpeed) || { rate: 1.0 };
    Speech.stop();
    Speech.speak(t('tts.testVoice', { voice: voiceLabel }), {
      rate: speedConfig.rate,
      language: currentLanguage,
    });
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('tts.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* General */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('tts.general')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="volume-medium-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('tts.enableTTS')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('tts.enableTTSDesc')}</Text>
            </View>
            <Switch
              value={ttsEnabled}
              onValueChange={(v) => { setTtsEnabled(v); savePrefs({ ttsEnabled: v }); }}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.optionRow}>
            <Ionicons name="reader-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('tts.autoRead')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('tts.autoReadDesc')}</Text>
            </View>
            <Switch
              value={autoRead}
              onValueChange={(v) => { setAutoRead(v); savePrefs({ autoRead: v }); }}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Voice Selection */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('tts.voiceSection')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {VOICES.map((voice, index) => (
            <React.Fragment key={voice.id}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => { setSelectedVoice(voice.id); savePrefs({ selectedVoice: voice.id }); }}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.radioOuter,
                  selectedVoice === voice.id && styles.radioOuterSelected,
                ]}>
                  {selectedVoice === voice.id && (
                    <View style={styles.radioInner} />
                  )}
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{t(voice.labelKey)}</Text>
                  <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t(voice.previewKey)}</Text>
                </View>
                <TouchableOpacity onPress={() => handlePreview(t(voice.labelKey))}>
                  <Ionicons name="play-circle-outline" size={24} color={colors.textLight} />
                </TouchableOpacity>
              </TouchableOpacity>
              {index < VOICES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Speed */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('tts.speed')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.speedRow}>
            {SPEEDS.map((speed) => (
              <TouchableOpacity
                key={speed.id}
                style={[
                  styles.speedPill,
                  selectedSpeed === speed.id && styles.speedPillActive,
                ]}
                onPress={() => { setSelectedSpeed(speed.id); savePrefs({ selectedSpeed: speed.id }); }}
              >
                <Text
                  style={[
                    styles.speedText,
                    selectedSpeed === speed.id && styles.speedTextActive,
                  ]}
                >
                  {speed.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Language */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('tts.ttsLanguage')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => navigation.navigate('LanguageSettings')}
          >
            <Ionicons name="language-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitleSimple, { color: colors.text }]}>{t('tts.voiceLanguage')}</Text>
            <View style={styles.valueContainer}>
              <Text style={styles.valueText}>{languages.find(l => l.id === currentLanguage)?.label || currentLanguage}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </View>
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
  optionInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#000000',
  },
  optionTitleSimple: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#000000',
    marginLeft: 14,
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#888888',
    marginTop: 2,
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
  // Radio button - same as UploadAudioScreen
  radioOuter: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#FA4A0C',
  },
  radioInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FA4A0C',
  },
  // Speed pills
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  speedPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F8',
  },
  speedPillActive: {
    backgroundColor: '#000000',
  },
  speedText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#888888',
  },
  speedTextActive: {
    color: '#FFFFFF',
  },
});
