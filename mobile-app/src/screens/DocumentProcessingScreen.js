import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, FlipType, SaveFormat } from 'expo-image-manipulator';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function DocumentProcessingScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { imageUri } = route.params || {};
  const [currentUri, setCurrentUri] = useState(imageUri);
  const [processing, setProcessing] = useState(false);
  const [toolBusy, setToolBusy] = useState(false);

  const handleRotate = async () => {
    if (toolBusy || !currentUri) return;
    setToolBusy(true);
    try {
      const result = await manipulateAsync(currentUri, [{ rotate: 90 }], { format: SaveFormat.JPEG });
      setCurrentUri(result.uri);
    } catch (e) {
      Alert.alert(t('common.error'), t('docProcessing.rotateError'));
    } finally {
      setToolBusy(false);
    }
  };

  const handleFlipH = async () => {
    if (toolBusy || !currentUri) return;
    setToolBusy(true);
    try {
      const result = await manipulateAsync(currentUri, [{ flip: FlipType.Horizontal }], { format: SaveFormat.JPEG });
      setCurrentUri(result.uri);
    } catch (e) {
      Alert.alert(t('common.error'), t('docProcessing.flipError'));
    } finally {
      setToolBusy(false);
    }
  };

  const handleFlipV = async () => {
    if (toolBusy || !currentUri) return;
    setToolBusy(true);
    try {
      const result = await manipulateAsync(currentUri, [{ flip: FlipType.Vertical }], { format: SaveFormat.JPEG });
      setCurrentUri(result.uri);
    } catch (e) {
      Alert.alert(t('common.error'), t('docProcessing.flipError'));
    } finally {
      setToolBusy(false);
    }
  };

  const handleReset = () => {
    setCurrentUri(imageUri);
  };

  const handleSave = () => {
    if (processing) return;
    setProcessing(true);
    // Navigate to GapForm with the processed image
    navigation.navigate('GapForm', {
      mediaUri: currentUri,
      mediaType: 'image',
      language: 'en',
    });
    setProcessing(false);
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('docProcessing.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Document Preview */}
      <View style={styles.previewContainer}>
        <View style={styles.previewCard}>
          {currentUri ? (
            <Image source={{ uri: currentUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.placeholderPreview}>
              <Ionicons name="document-outline" size={80} color="#CCCCCC" />
              <Text style={styles.placeholderText}>{t('docProcessing.documentPreview')}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Edit Tools */}
      <View style={styles.toolsContainer}>
        <TouchableOpacity style={styles.toolButton} onPress={handleRotate} disabled={toolBusy}>
          <View style={[styles.toolIconBg, toolBusy && { opacity: 0.5 }]}>
            <Ionicons name="refresh-outline" size={22} color="#000000" />
          </View>
          <Text style={styles.toolLabel}>{t('docProcessing.rotate')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolButton} onPress={handleFlipH} disabled={toolBusy}>
          <View style={[styles.toolIconBg, toolBusy && { opacity: 0.5 }]}>
            <Ionicons name="swap-horizontal-outline" size={22} color="#000000" />
          </View>
          <Text style={styles.toolLabel}>{t('docProcessing.flipH')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolButton} onPress={handleFlipV} disabled={toolBusy}>
          <View style={[styles.toolIconBg, toolBusy && { opacity: 0.5 }]}>
            <Ionicons name="swap-vertical-outline" size={22} color="#000000" />
          </View>
          <Text style={styles.toolLabel}>{t('docProcessing.flipV')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolButton} onPress={handleReset} disabled={toolBusy}>
          <View style={[styles.toolIconBg, toolBusy && { opacity: 0.5 }]}>
            <Ionicons name="arrow-undo-outline" size={22} color="#000000" />
          </View>
          <Text style={styles.toolLabel}>{t('docProcessing.reset')}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={processing}>
          <Text style={styles.saveButtonText}>
            {processing ? t('docProcessing.processing') : t('docProcessing.continueToForm')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.retakeText}>{t('docProcessing.retakePhoto')}</Text>
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
  previewContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: 'center',
  },
  previewCard: {
    width: width - 48,
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholderPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#888888',
    marginTop: 12,
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  toolButton: {
    alignItems: 'center',
  },
  toolIconBg: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 2,
  },
  toolLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: '#888888',
    marginTop: 8,
  },
  bottomSection: {
    paddingHorizontal: 50,
    paddingBottom: 55,
  },
  saveButton: {
    backgroundColor: '#000000',
    height: 70,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  saveButtonText: {
    color: '#F6F6F9',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
  retakeText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    textAlign: 'center',
  },
});
