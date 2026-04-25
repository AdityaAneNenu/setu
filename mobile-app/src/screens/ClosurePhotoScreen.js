import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { uploadToCloudinary } from '../services/cloudinaryService';
import { closureApi } from '../services/api';
import { gapsService } from '../services/firestore';
import { useTheme } from '../context/ThemeContext';

export default function ClosurePhotoScreen({ route, navigation }) {
  const { gapFirestoreId, djangoGapId, gapType, villageName } = route.params || {};
  const { colors } = useTheme();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);

  // 'camera' | 'preview' | 'processing' | 'success'
  const [screenState, setScreenState] = useState('camera');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedSelfie, setCapturedSelfie] = useState(null);
  const [captureMode, setCaptureMode] = useState('site'); // 'site' | 'selfie'
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [processingStep, setProcessingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const cameraRef = useRef(null);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initPermissions();
  }, []);

  const initPermissions = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status);
    if (status === 'granted') {
      fetchGPS();
    } else {
      setGpsLoading(false);
    }
  };

  const fetchGPS = async () => {
    setGpsLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setGpsLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      });
    } catch (err) {
      console.warn('GPS fetch failed:', err.message);
      setGpsLocation(null);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: false,
      });
      if (captureMode === 'selfie') {
        setCapturedSelfie(photo);
      } else {
        setCapturedPhoto(photo);
      }
      setScreenState('preview');
      // Refresh GPS at exact capture moment
      if (locationPermission === 'granted') fetchGPS();
    } catch (err) {
      Alert.alert('Camera Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleRetake = () => {
    if (captureMode === 'selfie') {
      setCapturedSelfie(null);
    } else {
      setCapturedPhoto(null);
    }
    setErrorMessage('');
    setScreenState('camera');
  };

  const handleNextToSelfie = () => {
    setCaptureMode('selfie');
    setScreenState('camera');
  };

  const handleConfirmSubmit = async () => {
    if (!capturedPhoto?.uri) {
      Alert.alert('Error', 'No photo captured. Please retake.');
      return;
    }
    if (!gpsLocation) {
      Alert.alert(
        'GPS Required',
        'GPS coordinates are required as tamper-evident proof. Please enable location and retry.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry GPS', onPress: fetchGPS },
        ]
      );
      return;
    }

    setScreenState('processing');
    setErrorMessage('');

    try {
      // Step 1: Upload photo to Cloudinary
      setProcessingStep('uploading');
      const uploadResult = await uploadToCloudinary(
        capturedPhoto.uri,
        'image',
        `setu-gaps/closure-proofs/gap_${djangoGapId || gapFirestoreId}`
      );
      const closurePhotoUrl = uploadResult.url;

      // Optional: upload selfie (recommended)
      let closureSelfieUrl = null;
      if (capturedSelfie?.uri) {
        const selfieUpload = await uploadToCloudinary(
          capturedSelfie.uri,
          'image',
          `setu-gaps/closure-proofs/gap_${djangoGapId || gapFirestoreId}_selfie`
        );
        closureSelfieUrl = selfieUpload.url;
      }

      // Step 2: Call Django API to close gap with proof
      setProcessingStep('submitting');
      await closureApi.closeWithPhotoProof(djangoGapId, {
        closurePhotoUrl,
        closureSelfieUrl,
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
      });

      // Step 3: Update Firestore status to resolved
      if (gapFirestoreId) {
        await gapsService.updateStatus(gapFirestoreId, 'resolved');
      }

      // Step 4: Success!
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScreenState('success');
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      console.error('Closure submission error:', err);
      setErrorMessage(err.message || 'Submission failed. Please try again.');
      setScreenState('preview');
    }
  };

  const formatCoord = (val) =>
    val !== null && val !== undefined ? Number(val).toFixed(5) : '--';

  const formatGapType = (type) =>
    (type || 'gap').replace(/_/g, ' ');

  // ─── Loading permissions ───
  if (!cameraPermission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
        <ActivityIndicator size="large" color={colors.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // ─── Camera permission denied ───
  if (!cameraPermission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.textLight} />
          <Text style={[styles.permTitle, { color: colors.text }]}>Camera Access Needed</Text>
          <Text style={[styles.permSubtext, { color: colors.textLight }]}>
            Camera permission is required to capture geo-tagged closure proof.
          </Text>
          <TouchableOpacity
            style={[styles.permButton, { backgroundColor: colors.buttonPrimaryBg }]}
            onPress={requestCameraPermission}
          >
            <Text style={[styles.permButtonText, { color: colors.buttonPrimaryText }]}>
              Grant Permission
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16, padding: 12 }} onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 15, fontFamily: fonts.medium, color: colors.textLight }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Success state ───
  if (screenState === 'success') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />
        <Animated.View
          style={[
            styles.successContainer,
            { opacity: successOpacity, transform: [{ scale: successScale }] },
          ]}
        >
          <View style={[styles.successRing, { backgroundColor: 'rgba(250,74,12,0.15)' }]}>
            <View style={[styles.successCircle, { backgroundColor: colors.buttonPrimaryBg }]}> 
              <Ionicons name="checkmark" size={48} color={colors.buttonPrimaryText} />
            </View>
          </View>

          <Text style={[styles.successTitle, { color: colors.text }]}>Gap Closed!</Text>
          <Text style={[styles.successSubtitle, { color: colors.textLight }] }>
            {formatGapType(gapType)} in {villageName || 'village'} has been
            resolved with photo proof.
          </Text>

          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }] }>
            <View style={styles.successRow}>
              <Ionicons name="location" size={18} color={colors.buttonPrimaryBg} />
              <Text style={[styles.successRowText, { color: colors.text }] }>
                GPS: {formatCoord(gpsLocation?.latitude)},{' '}
                {formatCoord(gpsLocation?.longitude)}
              </Text>
            </View>
            <View style={styles.successRow}>
              <Ionicons name="time-outline" size={18} color={colors.buttonPrimaryBg} />
              <Text style={[styles.successRowText, { color: colors.text }] }>
                {new Date().toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.successRow}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.buttonPrimaryBg} />
              <Text style={[styles.successRowText, { color: colors.text }] }>Photo saved to cloud</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.buttonPrimaryBg }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.doneBtnText, { color: colors.buttonPrimaryText }]}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ─── Preview / Processing state ───
  if (screenState === 'preview' || screenState === 'processing') {
    const isProcessing = screenState === 'processing';
    const previewUri =
      captureMode === 'selfie' ? capturedSelfie?.uri : capturedPhoto?.uri;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        <View style={styles.previewWrapper}>
          {!!previewUri && (
            <Image
              source={{ uri: previewUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )}

          {/* GPS stamp overlay */}
          <View style={styles.stampOverlay}>
            <View style={styles.stampRow}>
              <Ionicons name="location" size={13} color="#FFF" />
              <Text style={styles.stampText}>
                {gpsLocation
                  ? `${formatCoord(gpsLocation.latitude)}, ${formatCoord(gpsLocation.longitude)}`
                  : 'GPS unavailable'}
              </Text>
            </View>
            <Text style={styles.stampTime}>{new Date().toLocaleString('en-IN')}</Text>
            <Text style={styles.stampGap} numberOfLines={1}>
              {formatGapType(gapType)} · {villageName || ''}
            </Text>
          </View>

          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.processingText}>
                {processingStep === 'uploading'
                  ? 'Uploading photo...'
                  : 'Submitting closure proof...'}
              </Text>
            </View>
          )}
        </View>

        {!!errorMessage && (
          <View style={styles.errorBar}>
            <Ionicons name="alert-circle" size={16} color="#FFF" />
            <Text style={styles.errorText} numberOfLines={2}>{errorMessage}</Text>
          </View>
        )}

        {!isProcessing && (
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
            {captureMode === 'site' && !capturedSelfie?.uri ? (
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.buttonPrimaryBg }]}
                onPress={handleNextToSelfie}
              >
                <Ionicons
                  name="person-circle"
                  size={20}
                  color={colors.buttonPrimaryText}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.confirmBtnText, { color: colors.buttonPrimaryText }]}>Next: Selfie (Recommended)</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: colors.buttonPrimaryBg },
                  !gpsLocation && { backgroundColor: colors.textLight },
                ]}
                onPress={handleConfirmSubmit}
                disabled={!gpsLocation}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.buttonPrimaryText}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.confirmBtnText, { color: colors.buttonPrimaryText }] }>
                  {gpsLocation ? 'Confirm & Submit' : 'Waiting for GPS...'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ─── Camera state (default) ───
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.camHeader}>
        <TouchableOpacity style={styles.camBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.camTitle}>Closure Photo</Text>
          <Text style={styles.camSubtitle} numberOfLines={1}>
            {formatGapType(gapType)}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* GPS status */}
      <View style={styles.gpsBar}>
        <Ionicons
          name={
            gpsLocation ? 'location' : gpsLoading ? 'locate-outline' : 'location-outline'
          }
          size={14}
          color={gpsLocation ? '#4CAF50' : gpsLoading ? '#FF9800' : '#F44336'}
        />
        <Text
          style={[
            styles.gpsBarText,
            {
              color: gpsLocation ? '#4CAF50' : gpsLoading ? '#FF9800' : '#F44336',
            },
          ]}
        >
          {gpsLocation
            ? `${formatCoord(gpsLocation.latitude)}, ${formatCoord(gpsLocation.longitude)}`
            : gpsLoading
            ? 'Acquiring GPS signal...'
            : 'GPS unavailable'}
        </Text>
        {!gpsLocation && !gpsLoading && (
          <TouchableOpacity onPress={fetchGPS} style={{ marginLeft: 8 }}>
            <Ionicons name="refresh" size={14} color="#FF9800" />
          </TouchableOpacity>
        )}
      </View>

      {/* Camera */}
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={captureMode === 'selfie' ? 'front' : 'back'}
        />
        {/* CameraView does not support children; render overlay separately */}
        <View style={styles.guides} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      {/* Instruction */}
      <View style={styles.instrBar}>
        <Text style={styles.instrText}>
          {captureMode === 'selfie'
            ? 'Take a clear selfie of the person for verification. GPS is stamped automatically.'
            : 'Frame the completed work clearly. GPS coordinates are stamped automatically.'}
        </Text>
      </View>

      {/* Shutter */}
      <View style={styles.shutterContainer}>
        <TouchableOpacity
          style={[styles.shutterBtn, gpsLoading && styles.shutterBtnWaiting]}
          onPress={handleCapture}
          activeOpacity={0.8}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>
        {gpsLoading && (
          <Text style={styles.shutterWaitText}>Waiting for GPS...</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Permission
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  permTitle: { fontSize: 22, fontFamily: fonts.bold, marginTop: 20, marginBottom: 12, textAlign: 'center' },
  permSubtext: { fontSize: 15, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permButton: { height: 56, borderRadius: 28, paddingHorizontal: 36, justifyContent: 'center', alignItems: 'center' },
  permButtonText: { fontSize: 16, fontFamily: fonts.semiBold },

  // Camera
  camHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  camBackBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  camTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: '#FFF' },
  camSubtitle: { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.65)', textTransform: 'capitalize' },
  gpsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  gpsBarText: { fontSize: 12, fontFamily: fonts.medium, marginLeft: 6 },
  cameraWrap: { flex: 1, position: 'relative' },
  camera: { ...StyleSheet.absoluteFillObject },
  guides: { ...StyleSheet.absoluteFillObject, margin: 44 },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: 'rgba(255,255,255,0.75)', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  instrBar: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.65)' },
  instrText: { fontSize: 13, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  shutterContainer: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#000' },
  shutterBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  shutterBtnWaiting: { borderColor: 'rgba(255,255,255,0.35)' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF' },
  shutterWaitText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: fonts.regular, marginTop: 8 },

  // Preview
  previewWrapper: { flex: 1, backgroundColor: '#000', position: 'relative' },
  stampOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.62)', padding: 14 },
  stampRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stampText: { fontSize: 13, fontFamily: fonts.medium, color: '#FFF', marginLeft: 6 },
  stampTime: { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)' },
  stampGap: { fontSize: 12, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.65)', textTransform: 'capitalize', marginTop: 3 },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', alignItems: 'center' },
  processingText: { color: '#FFF', fontSize: 16, fontFamily: fonts.semiBold, marginTop: 16 },
  errorBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#C62828', padding: 12, paddingHorizontal: 16 },
  errorText: { color: '#FFF', fontSize: 13, fontFamily: fonts.medium, marginLeft: 8, flex: 1 },
  previewActions: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#000' },
  retakeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  retakeBtnText: { color: '#FFF', fontSize: 15, fontFamily: fonts.semiBold, marginLeft: 6 },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 26 },
  confirmBtnDisabled: { backgroundColor: '#555' },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontFamily: fonts.semiBold },

  // Success
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successRing: { width: 130, height: 130, borderRadius: 65, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  successCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  successTitle: { fontSize: 30, fontFamily: fonts.bold, marginBottom: 10 },
  successSubtitle: { fontSize: 15, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22, marginBottom: 28, textTransform: 'capitalize' },
  successCard: { width: '100%', borderRadius: 18, borderWidth: 1, padding: 20, marginBottom: 32, elevation: 2 },
  successRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  successRowText: { fontSize: 14, fontFamily: fonts.medium, marginLeft: 10 },
  doneBtn: { width: '100%', height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
  doneBtnText: { color: '#FFF', fontSize: 17, fontFamily: fonts.semiBold },
});
