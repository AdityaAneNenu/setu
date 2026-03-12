import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import { fonts } from '../theme';
import { gapsApi, voiceApi } from '../services/api';
import { uploadService } from '../services/cloudinaryService';
import { resolveAudioUrl } from '../services/audioUtils';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

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

export default function VoiceVerificationScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { gapId } = route.params || {};
  const [gap, setGap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // expo-audio recorder
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 500);
  const duration = isRecording ? Math.floor((recorderState.durationMillis || 0) / 1000) : 0;

  // Audio playback — resolve relative Django paths
  const audioSource = gap?.audio_url ? resolveAudioUrl(gap.audio_url) : null;
  const player = useAudioPlayer(audioSource);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [gapData, logsData] = await Promise.all([
        gapsApi.getById(gapId),
        voiceApi.getVerificationLogs(gapId),
      ]);
      setGap(gapData);
      setLogs(logsData || []);
    } catch (error) {
      console.error('Load error:', error);
      Alert.alert(t('common.error'), t('voiceVerification.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const playOriginalAudio = () => {
    if (!gap?.audio_url || !player) return;
    try {
      if (playerStatus.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('voiceVerification.playError'));
    }
  };

  const handleRecord = async () => {
    if (!isRecording) {
      try {
        const permStatus = await AudioModule.requestRecordingPermissionsAsync();
        if (!permStatus.granted) {
          Alert.alert(t('voiceVerification.permissionRequired'), t('voiceVerification.microphoneAccess'));
          return;
        }
        await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
        setResult(null);
      } catch (error) {
        Alert.alert(t('common.error'), t('voiceVerification.startRecordingError'));
      }
    } else {
      try {
        await audioRecorder.stop();
        await AudioModule.setAudioModeAsync({ allowsRecording: false });
        const uri = audioRecorder.uri;
        setIsRecording(false);
        setRecordingUri(uri);
      } catch (error) {
        setIsRecording(false);
        Alert.alert(t('common.error'), t('voiceVerification.stopRecordingError'));
      }
    }
  };

  const handleSubmitVerification = async () => {
    if (!recordingUri) {
      Alert.alert(t('voiceVerification.recordFirst'), t('voiceVerification.recordFirstMessage'));
      return;
    }
    setSubmitting(true);
    try {
      const audioUrl = await uploadService.uploadVoiceSample(recordingUri, gapId);
      const res = await voiceApi.submitVerification(gapId, {
        audio_url: audioUrl,
        localUri: recordingUri,
      });
      setResult(res);
      setRecordingUri(null);
      loadData();
    } catch (error) {
      Alert.alert(t('common.error'), t('voiceVerification.submissionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    try {
      await voiceApi.resolveGap(gapId);
      Alert.alert(t('common.success'), t('voiceVerification.gapResolved'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(t('common.error'), t('voiceVerification.resolveError'));
    }
  };

  const fmt = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#FA4A0C" /></View>
      </SafeAreaView>
    );
  }

  if (!gap) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('voiceVerification.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Gap Info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardLabel, { color: colors.textLight }]}>{t('voiceVerification.gapDetails')}</Text>
          <Text style={[styles.gapType, { color: colors.text }]}>{(gap?.gap_type || '').replace(/_/g, ' ')}</Text>
          <Text style={styles.gapMeta}>{gap?.village_name} • {gap?.severity} {t('voiceVerification.severity')}</Text>
          {gap?.description ? <Text style={[styles.gapDesc, { color: colors.textLight }]}>{gap.description}</Text> : null}
        </View>

        {/* Original audio */}
        {gap?.audio_url && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.textLight }]}>{t('voiceVerification.originalRecording')}</Text>
            <TouchableOpacity style={[styles.audioPlayer, { backgroundColor: isDark ? colors.surface : '#FFF8F5' }]} onPress={playOriginalAudio}>
              <View style={styles.playBtn}>
                <Ionicons name={playerStatus.playing ? 'pause' : 'play'} size={20} color="#FFF" />
              </View>
              <Text style={[styles.audioText, { color: colors.text }]}>{playerStatus.playing ? t('voiceVerification.tapToPause') : t('voiceVerification.tapToPlay')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Record for verification */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardLabel, { color: colors.textLight }]}>{t('voiceVerification.recordVerificationSample')}</Text>
          <Text style={styles.hint}>{t('voiceVerification.recordHint')}</Text>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.redDot} />
              <Text style={styles.recordingTime}>{fmt(duration)}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
            onPress={handleRecord}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={22} color="#FFF" />
            <Text style={styles.recordBtnText}>{isRecording ? t('voiceVerification.stopRecording') : t('voiceVerification.startRecording')}</Text>
          </TouchableOpacity>

          {recordingUri && !isRecording && (
            <View style={styles.readyRow}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.readyText}>{t('voiceVerification.recordingReady')}</Text>
            </View>
          )}
        </View>

        {/* Submit */}
        {recordingUri && !submitting && (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitVerification}>
            <Ionicons name="shield-checkmark" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.submitBtnText}>{t('voiceVerification.submitForVerification')}</Text>
          </TouchableOpacity>
        )}
        {submitting && (
          <View style={styles.submittingRow}>
            <ActivityIndicator color="#FA4A0C" />
            <Text style={styles.submittingText}>{t('voiceVerification.verifyingVoiceSample')}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <View style={[styles.card, { borderWidth: 2, borderColor: result.is_match ? '#4CAF50' : '#F44336' }]}>
            <View style={styles.resultHeader}>
              <Ionicons name={result.is_match ? 'checkmark-circle' : 'close-circle'} size={28} color={result.is_match ? '#4CAF50' : '#F44336'} />
              <Text style={[styles.resultTitle, { color: result.is_match ? '#4CAF50' : '#F44336' }]}>
                {result.is_match ? t('voiceVerification.voiceMatch') : t('voiceVerification.noMatch')}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>{t('voiceVerification.similarity')}</Text>
              <Text style={styles.resultValue}>{((result.similarity_score || 0) * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>{t('voiceVerification.confidence')}</Text>
              <Text style={styles.resultValue}>{result.confidence || 'N/A'}</Text>
            </View>
            {result.message ? (
              <Text style={[styles.resultLabel, { marginTop: 8, fontSize: 12, lineHeight: 16 }]}>{result.message}</Text>
            ) : null}
            {result.can_resolve && gap?.status !== 'resolved' && (
              <TouchableOpacity style={[styles.resolveBtn]} onPress={handleResolve}>
                <Text style={styles.resolveBtnText}>{t('voiceVerification.resolveGap')}</Text>
              </TouchableOpacity>
            )}
            {result.pending_review && (
              <View style={{ marginTop: 8, backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8 }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#E65100' }}>
                  ⚠ {t('voiceVerification.backendUnavailable')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Verification History */}
        {logs.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.textLight }]}>{t('voiceVerification.verificationHistory')}</Text>
            {logs.map((log, i) => (
              <View key={log.id || i} style={styles.logRow}>
                <Ionicons
                  name={log.confidence === 'pending' || log.pending_review ? 'time-outline' : log.is_match ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={log.confidence === 'pending' || log.pending_review ? '#FF9800' : log.is_match ? '#4CAF50' : '#F44336'}
                />
                <View style={styles.logInfo}>
                  <Text style={styles.logResult}>
                    {log.confidence === 'pending' || log.pending_review
                      ? t('voiceVerification.pendingReview')
                      : `${log.is_match ? t('voiceVerification.match') : t('voiceVerification.noMatch')} • ${((log.similarity_score || 0) * 100).toFixed(0)}%`}
                  </Text>
                  <Text style={styles.logMeta}>
                    {log.confidence === 'pending' ? t('voiceVerification.awaitingBackend') : `${log.confidence || 'N/A'} ${t('voiceVerification.confidenceLabel')}`}
                    {log.used_for_closure ? ` • ${t('voiceVerification.usedForClosure')}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontFamily: fonts.bold, color: '#000' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  cardLabel: { fontSize: 12, fontFamily: fonts.medium, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  gapType: { fontSize: 18, fontFamily: fonts.bold, color: '#000', textTransform: 'capitalize', marginBottom: 4 },
  gapMeta: { fontSize: 13, fontFamily: fonts.regular, color: '#888', marginBottom: 6 },
  gapDesc: { fontSize: 14, fontFamily: fonts.regular, color: '#555', lineHeight: 20 },
  audioPlayer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F5', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FFE8DC' },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FA4A0C', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  audioText: { fontSize: 14, fontFamily: fonts.medium, color: '#333' },
  hint: { fontSize: 13, fontFamily: fonts.regular, color: '#888', marginBottom: 12 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F44336', marginRight: 8 },
  recordingTime: { fontSize: 24, fontFamily: fonts.bold, color: '#F44336' },
  recordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', height: 52, borderRadius: 26 },
  recordBtnActive: { backgroundColor: '#F44336' },
  recordBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: '#FFF', marginLeft: 8 },
  readyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'center' },
  readyText: { fontSize: 13, fontFamily: fonts.medium, color: '#4CAF50', marginLeft: 6 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FA4A0C', height: 56, borderRadius: 28, marginBottom: 12 },
  submitBtnText: { fontSize: 16, fontFamily: fonts.semiBold, color: '#FFF' },
  submittingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  submittingText: { fontSize: 14, fontFamily: fonts.medium, color: '#888', marginLeft: 10 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  resultTitle: { fontSize: 20, fontFamily: fonts.bold, marginLeft: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  resultLabel: { fontSize: 14, fontFamily: fonts.regular, color: '#888' },
  resultValue: { fontSize: 14, fontFamily: fonts.semiBold, color: '#000' },
  resolveBtn: { backgroundColor: '#4CAF50', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  resolveBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: '#FFF' },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  logInfo: { marginLeft: 10, flex: 1 },
  logResult: { fontSize: 13, fontFamily: fonts.semiBold, color: '#000' },
  logMeta: { fontSize: 11, fontFamily: fonts.regular, color: '#888', marginTop: 2 },
});
