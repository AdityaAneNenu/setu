import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  Image,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function DocumentViewerScreen({ navigation, route }) {
  const { document } = route.params || {};
  const [expandText, setExpandText] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsRate, setTtsRate] = useState(1.0);
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    AsyncStorage.getItem('@tts_prefs').then(saved => {
      if (saved) {
        const prefs = JSON.parse(saved);
        const speeds = { slow: 0.75, normal: 1.0, fast: 1.25, faster: 1.5 };
        setTtsRate(speeds[prefs.selectedSpeed] || 1.0);
      }
    }).catch(() => {});
  }, []);

  const imageUri = document?.image_url || document?.imageUri || null;
  const extractedText =
    document?.description || document?.extracted_text ||
    t('docViewer.noText');

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${document?.title || t('docViewer.scannedDocument')}\n\n${extractedText}`,
      });
    } catch (e) {
      Alert.alert(t('common.error'), t('docViewer.shareError'));
    }
  };

  const handleDownload = () => {
    const url = document?.image_url;
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert(t('docViewer.download'), t('docViewer.noDownloadUrl'));
    }
  };

  const handleReadAloud = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    const textToRead = extractedText || t('docViewer.noTextToRead');
    setIsSpeaking(true);
    Speech.speak(textToRead, {
      language: document?.language || 'en',
      rate: ttsRate,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('docViewer.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Document Preview */}
        <View style={styles.previewCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Ionicons name="document-text" size={64} color={colors.emptyIconColor} />
              <Text style={styles.previewLabel}>{t('docViewer.noPreview')}</Text>
            </View>
          )}
        </View>

        {/* Document Info */}
        <Text style={styles.sectionLabel}>{t('docViewer.details')}</Text>
        <View style={styles.card}>
          <View style={styles.optionRow}>
            <Ionicons name="document-text-outline" size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{t('docViewer.titleLabel')}</Text>
            <Text style={styles.valueText}>{document?.title || t('docViewer.untitled')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.optionRow}>
            <Ionicons name="calendar-outline" size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{t('docViewer.date')}</Text>
            <Text style={styles.valueText}>{document?.date || t('common.na')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.optionRow}>
            <Ionicons name="server-outline" size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{t('docViewer.size')}</Text>
            <Text style={styles.valueText}>{document?.size || t('common.na')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.optionRow}>
            <Ionicons name="language-outline" size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{t('docViewer.language')}</Text>
            <Text style={styles.valueText}>{document?.language || t('docViewer.english')}</Text>
          </View>
        </View>

        {/* Extracted Text */}
        <Text style={styles.sectionLabel}>{t('docViewer.extractedText')}</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setExpandText(!expandText)}
          >
            <Ionicons name="text-outline" size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{t('docViewer.extractedContent')}</Text>
            <Ionicons
              name={expandText ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textLight}
            />
          </TouchableOpacity>
          {expandText && (
            <>
              <View style={styles.divider} />
              <View style={styles.textContent}>
                <Text style={styles.extractedText}>{extractedText}</Text>
              </View>
            </>
          )}
        </View>

        {/* Actions */}
        <Text style={styles.sectionLabel}>{t('docViewer.actions')}</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.optionRow} onPress={handleReadAloud}>
            <Ionicons name={isSpeaking ? 'stop-circle-outline' : 'volume-medium-outline'} size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{isSpeaking ? t('docViewer.stopReading') : t('docViewer.readAloud')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.optionRow} onPress={handleDownload}>
            <Ionicons name="download-outline" size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{t('docViewer.download')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.optionRow} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color={colors.iconDefault} />
            <Text style={styles.optionTitle}>{t('docViewer.share')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('DocumentProcessing', { imageUri: imageUri })}
        >
          <Text style={styles.primaryButtonText}>{t('docViewer.editDocument')}</Text>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 2,
  },
  previewPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  previewLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
    marginTop: 8,
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
  extractedText: {
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
