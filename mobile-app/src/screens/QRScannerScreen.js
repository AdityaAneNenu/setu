import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../config/theme';
import complaintService from '../services/complaintService';

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return;

    setScanned(true);
    setScanning(false);

    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Vibration.vibrate(100);

    console.log('QR Code scanned:', data);

    // Verify the complaint ID
    const result = await complaintService.getComplaintById(data);

    if (result.success) {
      Alert.alert(
        'Complaint Found!',
        `ID: ${result.data.complaint_id}\nVillager: ${result.data.villager_name}\nStatus: ${result.data.status}`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setScanned(false);
              setScanning(true);
            }
          },
          {
            text: 'Add Photos',
            onPress: () => {
              navigation.navigate('PhotoUpload', {
                complaint: result.data,
                complaintId: data
              });
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Complaint Not Found',
        result.offline
          ? 'No internet connection and complaint not found in offline storage.'
          : `Complaint ID "${data}" not found in the system.`,
        [
          {
            text: 'Scan Again',
            onPress: () => {
              setScanned(false);
              setScanning(true);
            }
          }
        ]
      );
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-off" size={64} color={theme.colors.textSecondary} />
        <Text style={styles.message}>Camera permission denied</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        facing="back"
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.scanArea}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Position the QR code within the frame
          </Text>
          <Text style={styles.instructionSubtext}>
            Scan complaint QR codes to add photos
          </Text>
        </View>

        {scanned && (
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => {
              setScanned(false);
              setScanning(true);
            }}
          >
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.rescanText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: '#FFF',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Corner styles for scan frame
  cornerTopLeft: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.colors.primary,
  },
  cornerTopRight: {
    position: 'absolute',
    top: '30%',
    right: '15%',
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.colors.primary,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: '30%',
    left: '15%',
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.colors.primary,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: '30%',
    right: '15%',
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.colors.primary,
  },
  instructions: {
    padding: 30,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionSubtext: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.full,
    marginBottom: 40,
    alignSelf: 'center',
  },
  rescanText: {
    color: '#FFF',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginLeft: 8,
  },
  message: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.md,
  },
  buttonText: {
    color: '#FFF',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});

