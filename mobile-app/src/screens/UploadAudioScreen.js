import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import { fonts } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

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

// Horizontal Scrollable Language Selector
const LanguageSelector = ({ selectedLanguage, onSelect, t }) => (
  <View style={styles.languageSelectorContainer}>
    <Text style={styles.sectionTitle}>{t('uploadAudio.chooseLanguage')}</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.languageScrollContent}
    >
      {LANGUAGES.map((lang) => {
        const isSelected = selectedLanguage === lang.id;
        return (
          <TouchableOpacity
            key={lang.id}
            style={[styles.languagePill, isSelected && styles.languagePillSelected]}
            onPress={() => onSelect(lang.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.languagePillNative, isSelected && styles.languagePillTextSelected]}>
              {lang.native}
            </Text>
            <Text style={[styles.languagePillLabel, isSelected && styles.languagePillLabelSelected]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

// Audio Waveform with real metering
const AudioWaveform = ({ isRecording, levels }) => {
  const bars = useMemo(() => {
    if (levels && levels.length > 0) {
      const padded = [...Array(Math.max(0, 60 - levels.length)).fill(-160), ...levels].slice(-60);
      return padded.map(l => {
        const normalized = Math.max(0, (l + 60) / 60);
        return 8 + normalized * 52;
      });
    }
    const heights = [];
    for (let i = 0; i < 60; i++) {
      const centerDistance = Math.abs(i - 30) / 30;
      const baseHeight = 15 + (1 - centerDistance) * 45;
      const variation = Math.sin(i * 0.5) * 12;
      heights.push(Math.max(8, baseHeight + variation));
    }
    return heights;
  }, [levels]);

  return (
    <View style={styles.waveformContainer}>
      <View style={styles.waveform}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              { height: h },
              isRecording && { backgroundColor: '#FA4A0C' },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

// Processing Spinner
const AudioProcessingSpinner = ({ message }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    );
    spin.start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => { spin.stop(); pulse.stop(); };
  }, []);

  return (
    <View style={styles.processingCenter}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <View style={styles.micCircle}>
          <Ionicons name="mic" size={32} color="#FA4A0C" />
        </View>
      </Animated.View>
      <View style={{ marginTop: 20 }}>
        <Animated.View style={{ transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
          <View style={styles.spinnerRing} />
        </Animated.View>
      </View>
      <Text style={styles.processingText}>{message}</Text>
    </View>
  );
};

// Success State
const AudioSuccessState = ({ fileName, fileSize, duration, language, onViewProcess, onRecordAnother, t }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const fmt = (ms) => {
    if (!ms) return '';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.successContainer}>
      <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.successInnerCircle}>
          <Ionicons name="checkmark" size={44} color="#FFFFFF" />
        </View>
      </Animated.View>
      <Text style={styles.successTitle}>{t('uploadAudio.recordedSuccess')}</Text>
      <Animated.View style={[styles.audioFileCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.audioIconCircle}>
          <Ionicons name="musical-notes" size={28} color="#FA4A0C" />
        </View>
        <View style={styles.audioFileInfo}>
          <Text style={styles.audioFileName} numberOfLines={1}>{fileName}</Text>
          <Text style={styles.audioFileSize}>{fileSize}{duration ? ` \u2022 ${fmt(duration)}` : ''} \u2022 {language}</Text>
          <View style={styles.audioStatusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Ready</Text>
          </View>
        </View>
        <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
      </Animated.View>
      <Animated.View style={[styles.successActions, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.processAudioButton} onPress={onViewProcess}>
          <Ionicons name="headset-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.processAudioButtonText}>{t('uploadAudio.viewProcess')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.recordAnotherButton} onPress={onRecordAnother}>
          <Ionicons name="mic-outline" size={20} color="#000000" style={{ marginRight: 8 }} />
          <Text style={styles.recordAnotherText}>{t('uploadAudio.recordAnother')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// Recording options matching previous expo-av config
const RECORDING_OPTIONS = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    sampleRate: 44100,
  },
  ios: {
    extension: '.m4a',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 44100,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export default function UploadAudioScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [screenState, setScreenState] = useState('idle');
  const [selectedLanguage, setSelectedLanguage] = useState('hi');

  // Load saved audio language preference from settings
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('language_settings');
        if (saved) {
          const prefs = JSON.parse(saved);
          if (prefs.audioLang) setSelectedLanguage(prefs.audioLang);
        }
      } catch (e) { /* fallback to default */ }
    })();
  }, []);

  const handleLanguageSelect = async (langId) => {
    setSelectedLanguage(langId);
    try {
      const saved = await AsyncStorage.getItem('language_settings');
      const prefs = saved ? JSON.parse(saved) : {};
      prefs.audioLang = langId;
      await AsyncStorage.setItem('language_settings', JSON.stringify(prefs));
    } catch (e) { /* save error */ }
  };
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState(null);
  const [fileInfo, setFileInfo] = useState({ name: '', size: '', duration: 0 });
  const [meterLevels, setMeterLevels] = useState([]);

  // expo-audio recording hook
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 100);

  // Accumulate metering levels for waveform display
  useEffect(() => {
    if (recorderState.isRecording && recorderState.metering != null) {
      setMeterLevels(prev => [...prev, recorderState.metering].slice(-60));
    }
  }, [recorderState.metering, recorderState.isRecording]);

  // Derive recording duration in seconds from recorderState
  const recordingDuration = isRecording ? Math.floor((recorderState.durationMillis || 0) / 1000) : 0;

  const resetScreen = () => {
    setScreenState('idle');
    setIsRecording(false);
    setAudioUri(null);
    setFileInfo({ name: '', size: '', duration: 0 });
    setMeterLevels([]);
  };

  const getSelectedLanguageLabel = () => {
    const lang = LANGUAGES.find(l => l.id === selectedLanguage);
    return lang ? lang.label : 'Hindi';
  };

  const formatDuration = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  const handleStartRecording = async () => {
    if (!isRecording) {
      try {
        const permStatus = await AudioModule.requestRecordingPermissionsAsync();
        if (!permStatus.granted) {
          Alert.alert(t('uploadAudio.permissionRequired'), t('uploadAudio.micPermission'));
          return;
        }

        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();

        setIsRecording(true);
        setMeterLevels([]);
      } catch (error) {
        console.error('Failed to start recording:', error);
        Alert.alert(t('uploadAudio.recordError'), t('uploadAudio.recordErrorMsg'));
      }
    } else {
      // Stop recording
      try {
        await audioRecorder.stop();
        await AudioModule.setAudioModeAsync({ allowsRecording: false });

        const uri = audioRecorder.uri;
        const durationMs = recorderState.durationMillis || 0;

        setIsRecording(false);

        if (uri) {
          const fileName = `Recording_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.m4a`;
          setAudioUri(uri);
          setFileInfo({
            name: fileName,
            size: `${(durationMs / 1000 / 60).toFixed(1)} min`,
            duration: durationMs,
          });
          setScreenState('success');
        } else {
          Alert.alert(t('uploadAudio.uploadError'), t('uploadAudio.noCaptured'));
        }
      } catch (error) {
        console.error('Failed to stop recording:', error);
        setIsRecording(false);
        Alert.alert(t('uploadAudio.uploadError'), t('uploadAudio.saveFailed'));
      }
    }
  };

  const handleUploadAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled) {
        const asset = result.assets[0];
        const name = asset.name || `Audio_${Date.now()}.m4a`;
        const size = asset.size ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : 'Unknown';
        setAudioUri(asset.uri);
        setFileInfo({ name, size, duration: 0 });
        setScreenState('success');
      }
    } catch (error) {
      Alert.alert(t('uploadAudio.uploadError'), t('uploadAudio.saveFailed'));
    }
  };

  const handleViewProcess = () => {
    navigation.navigate('AudioProcessing', {
      audioUri: audioUri,
      language: selectedLanguage,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => screenState !== 'idle' ? resetScreen() : navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('uploadAudio.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      {screenState === 'idle' && (
        <>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <LanguageSelector selectedLanguage={selectedLanguage} onSelect={handleLanguageSelect} t={t} />
            <AudioWaveform isRecording={isRecording} levels={meterLevels} />
            {isRecording ? (
              <>
                <Text style={[styles.audioTitle, { color: colors.text }]}>{t('uploadAudio.recording')}</Text>
                <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.audioTitle, { color: colors.text }]}>{t('uploadAudio.audio')}</Text>
                <Text style={[styles.audioSubtitle, { color: colors.textLight }]}>{t('uploadAudio.tapToStart')}</Text>
              </>
            )}
          </ScrollView>
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              onPress={handleStartRecording}
            >
              {isRecording && <View style={styles.recordingDot} />}
              <Text style={[styles.recordButtonText, isRecording && styles.recordButtonTextActive]}>
                {isRecording ? t('uploadAudio.stopRecording') : t('uploadAudio.startRecording')}
              </Text>
            </TouchableOpacity>
            {!isRecording && (
              <TouchableOpacity onPress={handleUploadAudio}>
                <Text style={[styles.uploadText, { color: colors.text }]}>{t('uploadAudio.orUpload')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {screenState === 'processing' && (
        <View style={styles.processingWrapper}>
          <AudioProcessingSpinner message={t('uploadAudio.processingAudio')} />
        </View>
      )}

      {screenState === 'success' && (
        <AudioSuccessState
          fileName={fileInfo.name}
          fileSize={fileInfo.size}
          duration={fileInfo.duration}
          language={getSelectedLanguageLabel()}
          onViewProcess={handleViewProcess}
          onRecordAnother={resetScreen}
          t={t}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingHorizontal: 41, paddingBottom: 16 },
  backButton: { padding: 0 },
  headerTitle: { fontSize: 18, fontFamily: fonts.semiBold, color: '#000000' },
  placeholder: { width: 24 },
  scrollView: { flex: 1 },
  languageSelectorContainer: { paddingHorizontal: 20, marginTop: 10 },
  sectionTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: '#000000', marginBottom: 12, paddingHorizontal: 21 },
  languageScrollContent: { paddingHorizontal: 0, paddingBottom: 4, gap: 10 },
  languagePill: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minWidth: 80, elevation: 2, shadowColor: 'rgba(0,0,0,0.05)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
  languagePillSelected: { backgroundColor: '#000000' },
  languagePillNative: { fontSize: 15, fontFamily: fonts.semiBold, color: '#000000', marginBottom: 2 },
  languagePillTextSelected: { color: '#FFFFFF' },
  languagePillLabel: { fontSize: 11, fontFamily: fonts.regular, color: '#888888' },
  languagePillLabelSelected: { color: '#CCCCCC' },
  waveformContainer: { alignItems: 'center', marginBottom: 20, paddingVertical: 20, paddingHorizontal: 41, opacity: 0.7 },
  waveform: { flexDirection: 'row', alignItems: 'center', height: 80, width: 332, justifyContent: 'center' },
  waveformBar: { width: 3, backgroundColor: '#888888', marginHorizontal: 1.5, borderRadius: 1.5 },
  audioTitle: { fontSize: 28, fontFamily: fonts.semiBold, color: '#000000', textAlign: 'center', marginBottom: 12 },
  audioSubtitle: { fontSize: 17, fontFamily: fonts.regular, color: '#000000', opacity: 0.57, textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  recordingTime: { fontSize: 48, fontFamily: fonts.bold, color: '#FA4A0C', textAlign: 'center', marginBottom: 20 },
  bottomSection: { paddingHorizontal: 59, paddingBottom: 55 },
  recordButton: { backgroundColor: '#000000', height: 70, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 18, flexDirection: 'row' },
  recordButtonActive: { backgroundColor: '#FA4A0C' },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', marginRight: 10 },
  recordButtonText: { color: '#F6F6F9', fontSize: 17, fontFamily: fonts.semiBold },
  recordButtonTextActive: { color: '#FFFFFF' },
  uploadText: { fontSize: 17, fontFamily: fonts.semiBold, color: '#000000', textAlign: 'center' },
  processingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  processingCenter: { alignItems: 'center', justifyContent: 'center' },
  micCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(250, 74, 12, 0.1)', justifyContent: 'center', alignItems: 'center' },
  spinnerRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#E8E8E8', borderTopColor: '#FA4A0C', borderRightColor: '#FA4A0C' },
  processingText: { fontSize: 17, fontFamily: fonts.semiBold, color: '#000000', marginTop: 24, textAlign: 'center' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  successCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(76, 175, 80, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  successInnerCircle: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
  successTitle: { fontSize: 24, fontFamily: fonts.bold, color: '#000000', textAlign: 'center', marginBottom: 30, lineHeight: 34 },
  audioFileCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, width: width - 60, elevation: 2, marginBottom: 40, alignItems: 'center' },
  audioIconCircle: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
  audioFileInfo: { flex: 1, marginLeft: 14 },
  audioFileName: { fontSize: 15, fontFamily: fonts.semiBold, color: '#000000', marginBottom: 4 },
  audioFileSize: { fontSize: 13, fontFamily: fonts.regular, color: '#888888', marginBottom: 6 },
  audioStatusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 6 },
  statusText: { fontSize: 13, fontFamily: fonts.medium, color: '#4CAF50' },
  successActions: { width: '100%', paddingHorizontal: 20 },
  processAudioButton: { backgroundColor: '#000000', height: 70, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14, flexDirection: 'row' },
  processAudioButtonText: { color: '#F6F6F9', fontSize: 17, fontFamily: fonts.semiBold },
  recordAnotherButton: { backgroundColor: '#FFFFFF', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 1.5, borderColor: '#E0E0E0' },
  recordAnotherText: { fontSize: 17, fontFamily: fonts.semiBold, color: '#000000' },
});
