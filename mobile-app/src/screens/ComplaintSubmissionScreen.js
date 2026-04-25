import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { complaintsApi } from "../services/api";

export default function ComplaintSubmissionScreen() {
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
      Alert.alert("Permission required", "Camera permission is required.");
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
      Alert.alert("Permission required", "Location permission is required.");
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
      Alert.alert("Error", e.message || "Failed to submit complaint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Register Complaint (Complaintee Photo + GPS)</Text>
      <TextInput style={styles.input} placeholder="Villager name" value={villagerName} onChangeText={setVillagerName} />
      <TextInput style={styles.input} placeholder="Village ID" value={villageId} onChangeText={setVillageId} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Post Office ID (optional)" value={postOfficeId} onChangeText={setPostOfficeId} keyboardType="numeric" />
      <TextInput
        style={[styles.input, { height: 110 }]}
        multiline
        placeholder="Complaint details"
        value={complaintText}
        onChangeText={setComplaintText}
      />

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={pickPhoto}>
          <Ionicons name="camera" size={16} color="#fff" />
          <Text style={styles.btnText}>
            {photoUri ? "Retake complaintee photo" : "Capture complaintee photo"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={captureGps}>
          <Ionicons name="location" size={16} color="#fff" />
          <Text style={styles.btnText}>{gps ? "GPS captured" : "Capture GPS location"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.statusText}>
        Photo: {photoUri ? "Captured" : "Required"} | GPS: {gps ? "Captured" : "Required"}
      </Text>

      <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Register complaint</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F7F7F7" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    backgroundColor: "#FFF",
    padding: 12,
    marginBottom: 10,
  },
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  btn: {
    flex: 1,
    backgroundColor: "#2563EB",
    borderRadius: 10,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#16A34A",
    borderRadius: 10,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnText: { color: "#fff", fontWeight: "600" },
  statusText: { color: "#4B5563", fontSize: 12, marginBottom: 12 },
  submitBtn: {
    backgroundColor: "#111827",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
