import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authApi, complaintsApi } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme";
import {
  getStatusCodeMessage,
  isFinalAuthFailure,
  isPermissionDeniedError,
  logApiErrorStatus,
} from "../services/authErrorUtils";

const openSettingsSafe = () =>
  Linking.openSettings().catch((error) => {
    console.warn("Failed to open app settings:", error?.message || error);
  });

export default function ComplaintSubmissionScreen() {
  const { colors } = useTheme();
  const [villagerName, setVillagerName] = useState("");
  const [villageId, setVillageId] = useState("");
  const [postOfficeId, setPostOfficeId] = useState("");
  const [complaintText, setComplaintText] = useState("");
  const [photoUri, setPhotoUri] = useState(null);
  const [gps, setGps] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera permission required", "Camera permission is required.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: openSettingsSafe },
      ]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const captureGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location permission required", "Location permission is required.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: openSettingsSafe },
      ]);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setGps({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  };

  const submit = async () => {
    if (!villagerName || !villageId || !complaintText) {
      Alert.alert(
        "Missing fields",
        "Villager name, village ID and complaint details are required.",
      );
      return;
    }
    if (!photoUri) {
      Alert.alert(
        "Complaintee photo required",
        "Capture the complaintee photo so identity can be verified at closure time.",
      );
      return;
    }
    if (!gps) {
      Alert.alert(
        "GPS required",
        "Capture the submission GPS location before registering the complaint.",
      );
      return;
    }
    setLoading(true);
    try {
      const photoFile = {
        uri: photoUri,
        name: `complaintee_${Date.now()}.jpg`,
        type: "image/jpeg",
      };

      const res = await complaintsApi.submitWithVerification({
        villager_name: villagerName,
        village_id: villageId,
        post_office_id: postOfficeId || undefined,
        complaint_text: complaintText,
        complaintee_photo: photoFile,
        submission_latitude: gps?.latitude,
        submission_longitude: gps?.longitude,
      });
      Alert.alert("Success", `Complaint registered: ${res.complaint_id}`);
      setVillagerName("");
      setVillageId("");
      setPostOfficeId("");
      setComplaintText("");
      setPhotoUri(null);
      setGps(null);
    } catch (e) {
      logApiErrorStatus("ComplaintSubmission.submit", e);
      if (isPermissionDeniedError(e)) {
        Alert.alert("Not authorized", "You are not authorized to submit complaints.");
      } else if (isFinalAuthFailure(e)) {
        Alert.alert("Session expired", "Session expired, please login again", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Login",
            onPress: () => authApi.logout().catch((logoutError) => {
              console.warn("Failed to logout after auth retry failure:", logoutError?.message || logoutError);
            }),
          },
        ]);
      } else {
        const statusMessage = getStatusCodeMessage(e);
        Alert.alert("Error", statusMessage || e.message || "Failed to submit complaint");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <Text style={[styles.title, { color: colors.text }]}>Register Complaint</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textPlaceholder} placeholder="Villager name" value={villagerName} onChangeText={setVillagerName} />
      <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textPlaceholder} placeholder="Village ID" value={villageId} onChangeText={setVillageId} keyboardType="numeric" />
      <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textPlaceholder} placeholder="Post Office ID (optional)" value={postOfficeId} onChangeText={setPostOfficeId} keyboardType="numeric" />
      <TextInput
        style={[styles.input, { height: 110, backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
        multiline
        placeholder="Complaint details"
        placeholderTextColor={colors.textPlaceholder}
        value={complaintText}
        onChangeText={setComplaintText}
      />

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.buttonPrimaryBg }]} onPress={pickPhoto}>
          <Ionicons name="camera" size={16} color={colors.buttonPrimaryText} />
          <Text style={[styles.btnText, { color: colors.buttonPrimaryText }]}>
            {photoUri ? "Retake complaintee photo" : "Capture complaintee photo"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnSecondary, { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.border }]} onPress={captureGps}>
          <Ionicons name="location" size={16} color={colors.text} />
          <Text style={[styles.btnText, { color: colors.text }]}>{gps ? "GPS captured" : "Capture GPS location"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.statusText, { color: colors.textLight }]}>
        Photo: {photoUri ? "Captured" : "Required"} | GPS: {gps ? "Captured" : "Required"}
      </Text>

      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.buttonPrimaryBg }, loading && styles.disabledBtn]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.buttonPrimaryText} /> : <Text style={[styles.submitText, { color: colors.buttonPrimaryText }]}>Register complaint</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  title: { fontSize: 22, fontFamily: fonts.bold, marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    fontFamily: fonts.regular,
  },
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  btn: {
    flex: 1,
    borderRadius: 18,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnText: { fontFamily: fonts.semiBold, fontSize: 13 },
  statusText: { fontFamily: fonts.medium, fontSize: 12, marginBottom: 12 },
  submitBtn: {
    borderRadius: 24,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: { opacity: 0.6 },
  submitText: { fontSize: 15, fontFamily: fonts.bold },
});
