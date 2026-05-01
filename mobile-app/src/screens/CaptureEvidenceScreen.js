import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { fonts } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  completeEvidenceCapture,
  persistEvidenceCaptureDraft,
} from '../utils/evidenceCaptureCallbacks';

const LOCATION_TIMEOUT_MS = 15000;

const getCurrentPositionWithTimeout = () =>
  Promise.race([
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('GPS request timed out')), LOCATION_TIMEOUT_MS);
    }),
  ]);

const openSettingsSafe = () =>
  Linking.openSettings().catch((error) => {
    console.warn('Failed to open app settings:', error?.message || error);
  });

export default function CaptureEvidenceScreen({ route, navigation }) {
  const { callbackId, initialPhotoUri = null, initialLocation = null } = route.params || {};
  const { colors, isDark } = useTheme();

  const [photoUri, setPhotoUri] = useState(initialPhotoUri);
  const [location, setLocation] = useState(initialLocation);
  const [capturing, setCapturing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);

  const showPermissionAlert = (title, message) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: openSettingsSafe },
    ]);
    setPermissionMessage(message);
    setSettingsVisible(true);
  };

  const capturePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    setPermissionMessage('');
    setSettingsVisible(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        const message = permission.canAskAgain === false
          ? 'Camera access is blocked. Enable camera permission in device settings, then try again.'
          : 'Camera access is required to capture complaint evidence.';
        showPermissionAlert(
          'Camera permission required',
          message,
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setPhotoUri(result.assets[0].uri);
    } catch (error) {
      Alert.alert('Camera error', 'Unable to capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const fetchLocation = async () => {
    if (locating) return;
    setLocating(true);
    setPermissionMessage('');
    setSettingsVisible(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        const message = permission.canAskAgain === false
          ? 'Location access is blocked. Enable location permission in device settings, then try again.'
          : 'Location access is required to attach GPS coordinates.';
        showPermissionAlert(
          'Location permission required',
          message,
        );
        return;
      }

      const loc = await getCurrentPositionWithTimeout();

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        captured_at: new Date().toISOString(),
      });
    } catch (error) {
      Alert.alert('Location unavailable', 'Unable to fetch GPS location. Please try again.');
    } finally {
      setLocating(false);
    }
  };

  const captureEvidence = async () => {
    await capturePhoto();
    await fetchLocation();
  };

  const handleUseEvidence = async () => {
    if (!photoUri || !location) {
      Alert.alert('Photo and location are required', 'Please capture evidence before continuing.');
      return;
    }
    const evidence = { photoUri, location };
    const delivered = callbackId ? completeEvidenceCapture(callbackId, evidence) : false;
    if (!delivered) {
      try {
        await persistEvidenceCaptureDraft(callbackId, evidence);
      } catch (error) {
        console.warn('Unable to persist captured evidence draft:', error?.message || error);
        Alert.alert('Unable to return evidence', 'Please go back and open evidence capture again.');
        return;
      }
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main', {
      screen: 'GapForm',
      params: { evidence, evidence_returned_at: new Date().toISOString() },
    });
  };

  const formatCoord = (value) =>
    value !== null && value !== undefined ? Number(value).toFixed(5) : '--';

  const hasLocation =
    !!location &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude));
  const ready = !!photoUri && hasLocation;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Capture Evidence</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.emptyPreview}>
              <Ionicons name="camera-outline" size={56} color={colors.textLight} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No photo captured</Text>
              <Text style={[styles.emptyText, { color: colors.textLight }]}>
                Capture a clear photo of the complaint location.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <Ionicons
              name={photoUri ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={photoUri ? '#4CAF50' : colors.textLight}
            />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {photoUri ? 'Photo captured' : 'Photo pending'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Ionicons
              name={hasLocation ? 'checkmark-circle' : 'location-outline'}
              size={20}
              color={hasLocation ? '#4CAF50' : colors.textLight}
            />
            <Text style={[styles.statusText, { color: colors.text }]}>
              {hasLocation
                ? `${formatCoord(location.latitude)}, ${formatCoord(location.longitude)}`
                : locating
                ? 'Fetching GPS...'
                : 'GPS pending'}
            </Text>
          </View>
        </View>

        {!!permissionMessage && (
          <View style={[styles.noticeCard, { backgroundColor: isDark ? '#3A1C16' : '#FFF3EE', borderColor: colors.border }]}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.buttonPrimaryBg} />
            <Text style={[styles.noticeText, { color: colors.text }]}>{permissionMessage}</Text>
            {settingsVisible && (
              <TouchableOpacity style={styles.settingsButton} onPress={openSettingsSafe}>
                <Text style={[styles.settingsButtonText, { color: colors.buttonPrimaryBg }]}>Open Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.captureButton,
            { backgroundColor: colors.buttonPrimaryBg },
            (capturing || locating) && styles.disabledButton,
          ]}
          onPress={captureEvidence}
          disabled={capturing || locating}
        >
          {capturing || locating ? (
            <ActivityIndicator color={colors.buttonPrimaryText} />
          ) : (
            <>
              <Ionicons name="camera" size={20} color={colors.buttonPrimaryText} style={styles.buttonIcon} />
              <Text style={[styles.captureButtonText, { color: colors.buttonPrimaryText }]}>
                {ready ? 'Retake Evidence' : 'Capture Evidence'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.retryRow}>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={capturePhoto}
            disabled={capturing}
          >
            <Ionicons name="camera-reverse-outline" size={18} color={colors.text} />
            <Text style={[styles.retryButtonText, { color: colors.text }]}>Retake Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={fetchLocation}
            disabled={locating}
          >
            <Ionicons name="locate-outline" size={18} color={colors.text} />
            <Text style={[styles.retryButtonText, { color: colors.text }]}>Retry Location</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.useButton,
            { borderColor: ready ? colors.buttonPrimaryBg : colors.border },
            !ready && styles.disabledButton,
          ]}
          onPress={handleUseEvidence}
          disabled={!ready}
        >
          <Text style={[styles.useButtonText, { color: ready ? colors.buttonPrimaryBg : colors.textLight }]}>
            Use This Evidence
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    padding: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  previewCard: {
    height: 360,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    marginTop: 18,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginTop: 18,
    gap: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    marginLeft: 10,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    lineHeight: 18,
    marginLeft: 10,
  },
  settingsButton: {
    paddingVertical: 6,
    paddingLeft: 10,
  },
  settingsButtonText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 12,
  },
  captureButton: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  captureButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  retryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    marginLeft: 6,
  },
  useButton: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
