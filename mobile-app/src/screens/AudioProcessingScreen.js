import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { fonts } from '../theme';
import { analyzeMedia } from '../services/aiService';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

// Supported languages (backend AssemblyAI)
const LANGUAGES = [
  { id: 'hi', label: 'Hindi', native: 'हिंदी' },
  { id: 'en', label: 'English', native: 'English' },
  { id: 'bn', label: 'Bengali', native: 'বাংলা' },
  { id: 'te', label: 'Telugu', native: 'తెలుగు' },
  { id: 'mr', label: 'Marathi', native: 'मराठी' },
  { id: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { id: 'ur', label: 'Urdu', native: 'اردو' },
  { id: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { id: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { id: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { id: 'as', label: 'Assamese', native: 'অসমীয়া' },
];

export default function AudioProcessingScreen({ navigation, route }) {
  const { audioUri, language: initialLang } = route.params || {};
  const [selectedLanguage, setSelectedLanguage] = useState(initialLang || 'hi');
  const [processing, setProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  // Audio playback via expo-audio
  const player = useAudioPlayer(audioUri || null);
  const playerStatus = useAudioPlayerStatus(player);

  // Time values from expo-audio are in seconds
  const positionMs = Math.round((playerStatus.currentTime || 0) * 1000);
  const durationMs = Math.round((playerStatus.duration || 0) * 1000);
  const isPlaying = playerStatus.playing;

  const handlePlayPause = () => {
    if (!player) {
      Alert.alert(t('audioProcessing.noAudio'), t('audioProcessing.noAudioFileLoaded'));
      return;
    }
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleSkip = (ms) => {
    if (!player) return;
    const currentSec = playerStatus.currentTime || 0;
    const durationSec = playerStatus.duration || 0;
    const newSec = Math.max(0, Math.min(currentSec + ms / 1000, durationSec));
    player.seekTo(newSec);
  };

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleProcess = async () => {
    if (!audioUri) {
      Alert.alert(t('audioProcessing.noAudio'), t('audioProcessing.noAudioFileToProcess'));
      return;
    }
    setProcessing(true);
    setTranscription('');
    try {
      // Send audio file directly to Django for AI analysis (no Firebase Storage needed)
      const result = await analyzeMedia(audioUri, 'audio', selectedLanguage || 'hi');

      if (result.success) {
        setAiResult(result);
        setTranscription(result.transcription || result.description || t('audioProcessing.audioProcessedSuccess'));
        Alert.alert(t('audioProcessing.success'), t('audioProcessing.successMsg'), [
          {
            text: t('audioProcessing.submitAsGap'), onPress: () => navigation.navigate('GapForm', {
              mediaUri: audioUri,
              mediaType: 'audio',
              language: selectedLanguage,
              prefill: {
                description: result.description,
                gap_type: result.gap_type,
                severity: result.severity,
                input_method: 'voice',
              },
            }),
          },
          { text: t('common.ok') },
        ]);
      } else {
        setTranscription(t('audioProcessing.processingFailedPrefix') + result.error);
        Alert.alert(t('audioProcessing.processingFailed'), result.error);
      }
    } catch (e) {
      setTranscription(t('common.error') + ': ' + e.message);
      Alert.alert(t('common.error'), e.message);
    } finally {
      setProcessing(false);
    }
  };

  // Waveform bars
  const bars = useMemo(() => {
    const heights = [];
    for (let i = 0; i < 60; i++) {
      const centerDistance = Math.abs(i - 30) / 30;
      const baseHeight = 15 + (1 - centerDistance) * 45;
      const variation = Math.sin(i * 0.5) * 12;
      heights.push(Math.max(8, baseHeight + variation));
    }
    return heights;
  }, []);

  const progress = durationMs > 0 ? (positionMs / durationMs) * 60 : 0;

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('audioProcessing.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language Selector */}
        <View style={styles.langSection}>
          <Text style={styles.langSectionTitle}>{t('audioProcessing.processingLanguage')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.langScrollContent}
          >
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLanguage === lang.id;
              return (
                <TouchableOpacity
                  key={lang.id}
                  style={[styles.langPill, isSelected && styles.langPillSelected]}
                  onPress={() => setSelectedLanguage(lang.id)}
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
        </View>

        {/* Waveform */}
        <View style={styles.waveformContainer}>
          <View style={styles.waveform}>
            {bars.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  { height: h },
                  i < progress && { backgroundColor: colors.accent },
                ]}
              />
            ))}
          </View>
          <Text style={styles.timeText}>
            {formatTime(positionMs)} / {formatTime(durationMs)}
          </Text>
        </View>

        {/* Audio Title */}
        <Text style={styles.audioTitle}>{t('audioProcessing.audio')}</Text>
        <Text style={styles.audioSubtitle}>
          {LANGUAGES.find(l => l.id === selectedLanguage)?.label || t('audioProcessing.hindi')} · {formatTime(durationMs)}
        </Text>

        {/* Playback Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={() => handleSkip(-10000)}>
            <Ionicons name="play-skip-back" size={24} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSkip(10000)}>
            <Ionicons name="play-skip-forward" size={24} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Transcription */}
        {(transcription || processing) && (
          <View style={styles.transcriptionSection}>
            <Text style={styles.sectionTitle}>{t('audioProcessing.transcription')}</Text>
            <View style={styles.transcriptionCard}>
              {processing ? (
                <View style={styles.processingRow}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.processingText}>{t('audioProcessing.analyzingAudio')}</Text>
                </View>
              ) : (
                <Text style={styles.transcriptionText}>{transcription}</Text>
              )}
            </View>
          </View>
        )}

        {/* AI Result Details */}
        {aiResult && aiResult.success && (
          <View style={styles.transcriptionSection}>
            <Text style={styles.sectionTitle}>{t('audioProcessing.aiAnalysis')}</Text>
            <View style={styles.transcriptionCard}>
              <Text style={styles.transcriptionText}>
                {t('audioProcessing.category')}: {aiResult.gap_type}{'\n'}
                {t('audioProcessing.severity')}: {aiResult.severity}{'\n'}
                {t('audioProcessing.confidence')}: {Math.round(aiResult.confidence * 100)}%
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.processButton, processing && { opacity: 0.6 }]}
          onPress={handleProcess}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.processButtonText}>{t('audioProcessing.title')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>{t('audioProcessing.goBack')}</Text>
        </TouchableOpacity>
      </View>
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
  langSection: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  langSectionTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 10,
    paddingHorizontal: 21,
  },
  langScrollContent: {
    paddingBottom: 4,
    gap: 10,
  },
  langPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
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
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 1,
  },
  langPillNativeSelected: {
    color: '#FFFFFF',
  },
  langPillLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  langPillLabelSelected: {
    color: '#CCCCCC',
  },
  // Waveform - exact same as UploadAudioScreen
  waveformContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingVertical: 30,
    paddingHorizontal: 41,
    opacity: 0.5,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 100,
    width: 332,
    justifyContent: 'center',
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#888888',
    marginHorizontal: 1.5,
    borderRadius: 1.5,
  },
  timeText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginTop: 10,
    textAlign: 'center',
  },
  audioTitle: {
    fontSize: 28,
    fontFamily: fonts.semiBold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  audioSubtitle: {
    fontSize: 17,
    fontFamily: fonts.regular,
    color: '#000000',
    opacity: 0.57,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 40,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptionSection: {
    paddingHorizontal: 41,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 16,
  },
  transcriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 2,
  },
  transcriptionText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#000000',
    lineHeight: 24,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textLight,
  },
  bottomSection: {
    paddingHorizontal: 50,
    paddingBottom: 55,
  },
  processButton: {
    backgroundColor: '#000000',
    height: 70,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  processButtonText: {
    color: '#F6F6F9',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
  secondaryText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    textAlign: 'center',
  },
});
