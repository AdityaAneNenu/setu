import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { gapsApi } from '../services/api';
import { fonts } from '../theme';
import { resolveAudioUrl } from '../services/audioUtils';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function AudioViewerScreen({ navigation, route }) {
  const { audio } = route.params || {};
  const [expandTranscription, setExpandTranscription] = useState(true);
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  // Audio playback via expo-audio — resolve relative Django paths
  const audioUrl = resolveAudioUrl(audio?.audio_url || audio?.uri);
  const player = useAudioPlayer(audioUrl);
  const playerStatus = useAudioPlayerStatus(player);

  // Time values from expo-audio are in seconds — convert to ms for display formatting
  const positionMs = Math.round((playerStatus.currentTime || 0) * 1000);
  const durationMs = Math.round((playerStatus.duration || 0) * 1000);
  const isPlaying = playerStatus.playing;

  // Use real description from gap data, fallback to transcription if available
  const transcription =
    audio?.description || audio?.transcription || t('audioViewer.noTranscription');

  // Format ms to mm:ss
  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!player) {
      Alert.alert(t('audioViewer.noAudio'), t('audioViewer.noAudioMsg'));
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

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${audio?.title || t('audioViewer.recording')}\n${audio?.audio_url || ''}`,
      });
    } catch (e) {
      Alert.alert(t('common.error'), t('audioViewer.shareError'));
    }
  };

  const handleDelete = () => {
    Alert.alert(t('audioViewer.confirmDelete'), t('audioViewer.confirmDeleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('audioViewer.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            if (audio?.gapId) {
              await gapsApi.updateStatus(audio.gapId, 'open');
            }
            navigation.goBack();
          } catch (e) {
            Alert.alert(t('common.error'), t('audioViewer.deleteError'));
          }
        },
      },
    ]);
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('audioViewer.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
            {formatTime(positionMs)} / {formatTime(durationMs || (audio?.duration ? parseInt(audio.duration) * 60000 : 0))}
          </Text>
        </View>

        {/* Audio Title */}
        <Text style={styles.audioTitle}>{audio?.title || t('audioViewer.audioRecording')}</Text>
        <Text style={styles.audioSubtitle}>
          {audio?.language || t('audioViewer.hindi')} · {audio?.duration || formatTime(durationMs)}
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

        {/* Details & Transcription */}
        <View style={styles.cardsSection}>
          <Text style={styles.sectionLabel}>{t('audioViewer.details')}</Text>
          <View style={styles.card}>
            <View style={styles.optionRow}>
              <Ionicons name="calendar-outline" size={22} color="#000000" />
              <Text style={styles.optionTitle}>{t('audioViewer.date')}</Text>
              <Text style={styles.valueText}>{audio?.date || audio?.created_at || t('common.na')}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.optionRow}>
              <Ionicons name="server-outline" size={22} color="#000000" />
              <Text style={styles.optionTitle}>{t('audioViewer.size')}</Text>
              <Text style={styles.valueText}>{audio?.size || t('common.na')}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.optionRow}>
              <Ionicons name="language-outline" size={22} color="#000000" />
              <Text style={styles.optionTitle}>{t('audioViewer.language')}</Text>
              <Text style={styles.valueText}>{audio?.language || t('audioViewer.hindi')}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('audioViewer.transcription')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setExpandTranscription(!expandTranscription)}
            >
              <Ionicons name="text-outline" size={22} color="#000000" />
              <Text style={styles.optionTitle}>{t('audioViewer.transcribedContent')}</Text>
              <Ionicons
                name={expandTranscription ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textLight}
              />
            </TouchableOpacity>
            {expandTranscription && (
              <>
                <View style={styles.divider} />
                <View style={styles.textContent}>
                  <Text style={styles.transcriptionText}>{transcription}</Text>
                </View>
              </>
            )}
          </View>

          <Text style={styles.sectionLabel}>{t('audioViewer.actions')}</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.optionRow} onPress={() => {
              const url = audio?.audio_url;
              if (url) Linking.openURL(url);
              else Alert.alert(t('audioViewer.download'), t('audioViewer.noDownloadUrl'));
            }}>
              <Ionicons name="download-outline" size={22} color="#000000" />
              <Text style={styles.optionTitle}>{t('audioViewer.download')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.optionRow} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#000000" />
              <Text style={styles.optionTitle}>{t('audioViewer.share')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.optionRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color="#000000" />
              <Text style={styles.optionTitle}>{t('audioViewer.delete')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('AudioProcessing', { audioUri: audio?.audio_url || audio?.uri, language: audio?.language })}
        >
          <Text style={styles.primaryButtonText}>{t('audioViewer.reProcessAudio')}</Text>
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
    color: '#888888',
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
  cardsSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
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
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
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
  valueText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 36,
  },
  textContent: {
    paddingVertical: 12,
    paddingLeft: 36,
  },
  transcriptionText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#000000',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 50,
    paddingBottom: 55,
  },
  primaryButton: {
    backgroundColor: '#000000',
    height: 70,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#F6F6F9',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
});
