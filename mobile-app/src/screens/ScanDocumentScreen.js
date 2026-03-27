import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// Camera Illustration Component - matching Figma node 2520:17
const CameraIllustration = () => (
  <View style={styles.cameraIllustration}>
    {/* Camera body */}
    <View style={styles.cameraBody}>
      {/* Flash */}
      <View style={styles.cameraFlash} />
      {/* Viewfinder */}
      <View style={styles.cameraViewfinder} />
      {/* Lens - outer ring */}
      <View style={styles.cameraLensOuter}>
        {/* Lens - inner ring */}
        <View style={styles.cameraLensInner}>
          {/* Lens center - dark pupil */}
          <View style={styles.cameraLensCenter} />
        </View>
      </View>
    </View>
    {/* Camera grip - bottom right curve */}
    <View style={styles.cameraGrip} />
  </View>
);

// Processing Spinner Component
const ProcessingSpinner = ({ message, colors }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();

    const dotAnimations = dotAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(anim, { toValue: -8, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    dotAnimations.forEach(a => a.start());

    return () => {
      spin.stop();
      dotAnimations.forEach(a => a.stop());
    };
  }, []);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.processingCenter}>
      <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
        <View style={[styles.spinnerRing, { borderColor: colors.border, borderTopColor: colors.accent, borderRightColor: colors.accent }]} />
      </Animated.View>
      <Text style={[styles.processingText, { color: colors.text }]}>{message}</Text>
      <View style={styles.dotsRow}>
        {dotAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[styles.bounceDot, { transform: [{ translateY: anim }] }]}
          />
        ))}
      </View>
    </View>
  );
};

// Success State Component
const SuccessState = ({ imageUri, fileName, fileSize, onViewDocument, onScanAnother, t, colors, isDark }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.successContainer}>
      {/* Animated Success Checkmark */}
      <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.successInnerCircle}>
          <Ionicons name="checkmark" size={44} color="#FFFFFF" />
        </View>
      </Animated.View>

      <Text style={[styles.successTitle, { color: colors.text }]}>{t('scanDocument.capturedSuccess')}</Text>

      {/* Document Preview Card */}
      <Animated.View style={[styles.docPreviewCard, { backgroundColor: colors.card, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.docThumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.docThumbnailPlaceholder, { backgroundColor: isDark ? '#3D2800' : '#FFF3E0' }]}>
            <Ionicons name="document-text" size={40} color="#FA4A0C" />
          </View>
        )}
        <View style={styles.docInfo}>
          <Text style={[styles.docName, { color: colors.text }]} numberOfLines={1}>{fileName}</Text>
          <Text style={[styles.docSize, { color: colors.textLight }]}>{fileSize}</Text>
          <View style={styles.docStatusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Ready</Text>
          </View>
        </View>
        <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View style={[styles.successActions, { opacity: fadeAnim }]}>
        <TouchableOpacity style={[styles.processDocButton, { backgroundColor: colors.buttonPrimaryBg }]} onPress={onViewDocument}>
          <Ionicons name="eye-outline" size={20} color={colors.buttonPrimaryText} style={{ marginRight: 8 }} />
          <Text style={[styles.processDocButtonText, { color: colors.buttonPrimaryText }]}>{t('scanDocument.viewProcess')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.scanAnotherButton, { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.buttonSecondaryBorder }]} onPress={onScanAnother}>
          <Ionicons name="camera-outline" size={20} color={colors.buttonSecondaryText} style={{ marginRight: 8 }} />
          <Text style={[styles.scanAnotherText, { color: colors.buttonSecondaryText }]}>{t('scanDocument.scanAnother')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// Screen states: 'idle' | 'processing' | 'success'
export default function ScanDocumentScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [screenState, setScreenState] = useState('idle');
  const [capturedImage, setCapturedImage] = useState(null);
  const [fileInfo, setFileInfo] = useState({ name: '', size: '' });
  const [userLanguage, setUserLanguage] = useState('hi');
  const processingTimerRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('language_settings').then(saved => {
      if (saved) {
        const prefs = JSON.parse(saved);
        setUserLanguage(prefs.scanLang || prefs.appLang || 'hi');
      }
    }).catch(() => {});
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
    };
  }, []);

  const resetScreen = () => {
    setScreenState('idle');
    setCapturedImage(null);
    setFileInfo({ name: '', size: '' });
  };

  const processDocument = (uri, name, fileSize) => {
    setCapturedImage(uri);
    setFileInfo({
      name: name || `Document_${new Date().toISOString().slice(0, 10)}.jpg`,
      size: fileSize || 'Unknown',
    });
    setScreenState('processing');

    // Simulate processing then show success
    processingTimerRef.current = setTimeout(() => {
      setScreenState('success');
    }, 2200);
  };

  const handleCaptureDocument = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('scanDocument.permissionRequired'), t('scanDocument.cameraPermission'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const name = asset.fileName || `Scan_${Date.now()}.jpg`;
      const size = asset.fileSize ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown';
      processDocument(asset.uri, name, size);
    }
  };

  const handleUploadDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const name = asset.fileName || `Upload_${Date.now()}.jpg`;
      const size = asset.fileSize ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown';
      processDocument(asset.uri, name, size);
    }
  };

  const handleViewDocument = () => {
    navigation.navigate('GapForm', {
      mediaUri: capturedImage,
      mediaType: 'image',
      language: userLanguage,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (screenState !== 'idle') {
              resetScreen();
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('scanDocument.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* ---- IDLE STATE ---- */}
      {screenState === 'idle' && (
        <>
          <View style={styles.content}>
            <CameraIllustration />
            <Text style={[styles.cameraTitle, { color: colors.text }]}>{t('scanDocument.camera')}</Text>
            <Text style={[styles.cameraSubtitle, { color: colors.textLight }]}>
              {t('scanDocument.cameraPrompt')}
            </Text>
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: colors.buttonPrimaryBg }]}
              onPress={handleCaptureDocument}
            >
              <Text style={[styles.captureButtonText, { color: colors.buttonPrimaryText }]}>{t('scanDocument.captureDoc')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleUploadDocument}>
              <Text style={[styles.uploadText, { color: colors.text }]}>{t('scanDocument.orUpload')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ---- PROCESSING STATE ---- */}
      {screenState === 'processing' && (
        <View style={styles.processingWrapper}>
          {capturedImage && (
            <View style={styles.processingImageContainer}>
              <Image
                source={{ uri: capturedImage }}
                style={styles.processingImage}
                resizeMode="contain"
                blurRadius={4}
              />
              <View style={styles.processingOverlay} />
            </View>
          )}
          <ProcessingSpinner message={t('scanDocument.processing')} colors={colors} />
          
        </View>
      )}

      {/* ---- SUCCESS STATE ---- */}
      {screenState === 'success' && (
        <SuccessState
          imageUri={capturedImage}
          fileName={fileInfo.name}
          fileSize={fileInfo.size}
          onViewDocument={handleViewDocument}
          onScanAnother={resetScreen}
          t={t}
          colors={colors}
          isDark={isDark}
        />
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 65,
    marginTop: -50,
  },
  // Camera illustration styles - matching Figma exactly
  cameraIllustration: {
    width: 276,
    height: 182,
    marginBottom: 30,
    opacity: 0.5,
  },
  cameraBody: {
    width: 220,
    height: 140,
    borderWidth: 3,
    borderColor: '#888888',
    borderRadius: 24,
    alignSelf: 'center',
    position: 'relative',
  },
  cameraFlash: {
    position: 'absolute',
    top: 18,
    left: 22,
    width: 35,
    height: 22,
    borderWidth: 2.5,
    borderColor: '#888888',
    borderRadius: 5,
  },
  cameraViewfinder: {
    position: 'absolute',
    top: -18,
    right: 50,
    width: 45,
    height: 28,
    borderWidth: 2.5,
    borderColor: '#888888',
    borderRadius: 8,
    backgroundColor: '#F5F5F8',
  },
  cameraLensOuter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -35,
    marginLeft: -35,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#888888',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLensInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
    borderColor: '#888888',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLensCenter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#888888',
  },
  cameraGrip: {
    position: 'absolute',
    bottom: 25,
    right: 35,
    width: 18,
    height: 45,
    borderWidth: 2.5,
    borderColor: '#888888',
    borderRadius: 8,
  },
  cameraTitle: {
    fontSize: 28,
    fontFamily: fonts.semiBold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
  },
  cameraSubtitle: {
    fontSize: 17,
    fontFamily: fonts.regular,
    color: '#000000',
    opacity: 0.57,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 50,
    paddingBottom: 55,
  },
  captureButton: {
    backgroundColor: '#000000',
    height: 70,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  captureButtonText: {
    color: '#F6F6F9',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
  uploadText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    textAlign: 'center',
  },

  // ---- Processing State ----
  processingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingImageContainer: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: 24,
    bottom: 80,
    borderRadius: 20,
    overflow: 'hidden',
  },
  processingImage: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 245, 248, 0.78)',
  },
  processingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  spinnerRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#E8E8E8',
    borderTopColor: '#FA4A0C',
    borderRightColor: '#FA4A0C',
  },
  processingText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginTop: 24,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 6,
  },
  bounceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FA4A0C',
  },

  // ---- Success State ----
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  successCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 34,
  },
  docPreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    width: width - 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 40,
    alignItems: 'center',
  },
  docThumbnail: {
    width: 60,
    height: 70,
    borderRadius: 12,
  },
  docThumbnailPlaceholder: {
    width: 60,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    marginLeft: 14,
  },
  docName: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 4,
  },
  docSize: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#888888',
    marginBottom: 6,
  },
  docStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#4CAF50',
  },
  successActions: {
    width: '100%',
    paddingHorizontal: 20,
  },
  processDocButton: {
    backgroundColor: '#000000',
    height: 70,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    flexDirection: 'row',
  },
  processDocButtonText: {
    color: '#F6F6F9',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
  scanAnotherButton: {
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  scanAnotherText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
  },
});
