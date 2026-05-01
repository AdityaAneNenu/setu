import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Linking,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authApi, complaintsApi } from "../services/api";
import { API_CONFIG } from "../config/api";
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

export default function ComplaintVerificationScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [complaints, setComplaints] = useState([]);
  const [resolvedComplaints, setResolvedComplaints] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [letterUri, setLetterUri] = useState(null);
  const [gps, setGps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState("in_progress");
  const [backendHealth, setBackendHealth] = useState("checking");
  const resolveInFlightRef = useRef(false);

  const loadInProgress = async () => {
    setFetching(true);
    try {
      const data = await complaintsApi.getInProgress();
      setComplaints(data.inProgress || []);
      setResolvedComplaints(data.resolved || []);
      if (selected) {
        const refreshed = (data.inProgress || []).find(
          (item) => item.complaint_id === selected.complaint_id,
        );
        setSelected(refreshed || null);
      }
    } catch (e) {
      logApiErrorStatus("ComplaintVerification.loadInProgress", e);
      if (isPermissionDeniedError(e)) {
        Alert.alert("Not authorized", "You are not authorized to view complaints.");
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
        Alert.alert("Error", statusMessage || e.message || "Could not load in-progress complaints.");
      }
    } finally {
      setFetching(false);
    }
  };

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_CONFIG.DJANGO_URL}/api/test/`, {
        method: "GET",
      });
      setBackendHealth(response.ok ? "online" : `error:${response.status}`);
    } catch (_) {
      setBackendHealth("offline");
    }
  };

  useEffect(() => {
    loadInProgress();
    checkBackendHealth();
  }, []);

  const captureSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is required.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: openSettingsSafe },
      ]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled) setSelfieUri(result.assets[0].uri);
  };

  const captureLetter = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is required.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: openSettingsSafe },
      ]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });
    if (!result.canceled) setLetterUri(result.assets[0].uri);
  };

  const captureGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Location permission is required.", [
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

  const resolveSelectedComplaint = async () => {
    if (resolveInFlightRef.current) return;
    if (!selected) {
      Alert.alert("Select complaint", "Please select an in-progress complaint first.");
      return;
    }
    if (selected.resolution_ready === false) {
      Alert.alert(
        "Submission proof incomplete",
        selected.banner || "This complaint cannot be closed until the original photo and GPS proof are available.",
      );
      return;
    }

    resolveInFlightRef.current = true;
    setLoading(true);
    try {
      if (selected.resolution_mode === "resolution_letter") {
        if (!letterUri) {
          Alert.alert("Missing image", "Capture the Resolution Letter image first.");
          return;
        }
        const letterFile = {
          uri: letterUri,
          name: `resolution_letter_${Date.now()}.jpg`,
          type: "image/jpeg",
        };
        const res = await complaintsApi.resolvePhotoComplaint(selected.complaint_id, {
          resolution_letter_image: letterFile,
        });
        Alert.alert(
          "Closed",
          `Complaint ${res.complaint_id} closed with Resolution Letter.`,
        );
      } else {
        if (!selfieUri || !gps) {
          Alert.alert(
            "Missing verification data",
            "Capture Complaintee selfie and GPS location first.",
          );
          return;
        }
        const selfieFile = {
          uri: selfieUri,
          name: `closure_selfie_${Date.now()}.jpg`,
          type: "image/jpeg",
        };
        const res = await complaintsApi.verifyAndClose(selected.complaint_id, {
          closure_selfie: selfieFile,
          closure_latitude: gps.latitude,
          closure_longitude: gps.longitude,
        });
        Alert.alert(
          "Verified & Closed",
          `Complaint ${res.complaint_id}\nDistance: ${res.distance_m ?? "N/A"}m\nScore: ${res.match_score ?? "N/A"}`,
        );
      }
      setSelfieUri(null);
      setLetterUri(null);
      setGps(null);
      await loadInProgress();
    } catch (e) {
      logApiErrorStatus("ComplaintVerification.resolveSelectedComplaint", e);
      if (isPermissionDeniedError(e)) {
        Alert.alert("Not authorized", "You are not authorized to resolve this complaint.");
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
        Alert.alert("Resolution failed", statusMessage || e.message || "Could not resolve complaint.");
      }
    } finally {
      resolveInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.backgroundGray, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Resolve In-Progress Complaints</Text>
      <View style={[styles.healthBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.healthText, { color: colors.textLight }]}>
          API: {API_CONFIG.DJANGO_URL}
        </Text>
        <Text
          style={[
            styles.healthStatus,
            backendHealth === "online"
              ? styles.healthOnline
              : backendHealth === "checking"
                ? styles.healthChecking
                : styles.healthOffline,
          ]}
        >
          {backendHealth === "online"
            ? "Online"
            : backendHealth === "checking"
              ? "Checking..."
              : "Offline"}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.refreshBtn, { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.border }]}
        onPress={loadInProgress}
        disabled={fetching}
      >
        <Ionicons name="refresh" size={16} color={colors.text} />
        <Text style={[styles.actionBtnText, { color: colors.text }]}>
          {fetching ? "Loading..." : "Refresh list"}
        </Text>
      </TouchableOpacity>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            { borderColor: colors.border, backgroundColor: colors.surface },
            activeTab === "in_progress" && [styles.tabBtnActive, { backgroundColor: colors.pillSelectedBg, borderColor: colors.pillSelectedBg }],
          ]}
          onPress={() => setActiveTab("in_progress")}
        >
          <Text style={[styles.tabText, { color: colors.textLight }, activeTab === "in_progress" && [styles.tabTextActive, { color: colors.pillSelectedText }]]}>
            In Progress ({complaints.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            { borderColor: colors.border, backgroundColor: colors.surface },
            activeTab === "resolved" && [styles.tabBtnActive, { backgroundColor: colors.pillSelectedBg, borderColor: colors.pillSelectedBg }],
          ]}
          onPress={() => setActiveTab("resolved")}
        >
          <Text style={[styles.tabText, { color: colors.textLight }, activeTab === "resolved" && [styles.tabTextActive, { color: colors.pillSelectedText }]]}>
            Resolved ({resolvedComplaints.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === "resolved" ? resolvedComplaints : complaints}
        keyExtractor={(item) => item.complaint_id}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        ListEmptyComponent={
          fetching ? null : (
            <Text style={[styles.emptyText, { color: colors.textLight }]}>
              {activeTab === "resolved"
                ? "No resolved complaints found."
                : "No in-progress complaints found."}
            </Text>
          )
        }
        renderItem={({ item }) => {
          const selectedItem = selected?.complaint_id === item.complaint_id;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                { borderColor: colors.border, backgroundColor: colors.surface },
                selectedItem && [styles.cardSelected, { borderColor: colors.accent, backgroundColor: colors.primaryLight }],
              ]}
              onPress={() => setSelected(item)}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {item.complaint_id} - {item.villager_name}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textLight }]}>{item.village_name}</Text>
              <Text style={[styles.cardMeta, { color: colors.textLight }]}>
                Resolution Mode:{" "}
                {item.resolution_mode === "resolution_letter"
                  ? "Resolution Letter"
                  : "Complaintee Selfie + GPS"}
              </Text>
              <Text
                style={[
                  styles.statusPill,
                  item.status === "case_closed"
                    ? styles.statusResolved
                    : styles.statusInProgress,
                ]}
              >
                {item.status === "case_closed" ? "Resolved" : "In Progress"}
              </Text>
              {!!item.banner && <Text style={styles.banner}>{item.banner}</Text>}
            </TouchableOpacity>
          );
        }}
      />

      {!!selected && activeTab === "in_progress" && (
        <View style={[styles.actionBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.selectedText, { color: colors.text }]}>Selected: {selected.complaint_id}</Text>
          {selected.resolution_ready === false && (
            <Text style={styles.banner}>
              {selected.banner || "Original submission proof is incomplete."}
            </Text>
          )}
          {selected.resolution_mode === "resolution_letter" ? (
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: colors.buttonPrimaryBg },
                selected.resolution_ready === false && styles.disabledBtn,
              ]}
              onPress={captureLetter}
              disabled={selected.resolution_ready === false}
            >
              <Ionicons name="document" size={16} color={colors.buttonPrimaryText} />
              <Text style={[styles.btnText, { color: colors.buttonPrimaryText }]}>
                {letterUri
                  ? "Retake Resolution Letter image"
                  : "Capture Resolution Letter"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: colors.buttonPrimaryBg },
                  selected.resolution_ready === false && styles.disabledBtn,
                ]}
                onPress={captureSelfie}
                disabled={selected.resolution_ready === false}
              >
                <Ionicons name="camera" size={16} color={colors.buttonPrimaryText} />
                <Text style={[styles.btnText, { color: colors.buttonPrimaryText }]}>
                  {selfieUri ? "Retake complaintee selfie" : "Capture complaintee selfie"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnSecondary,
                  { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.border },
                  selected.resolution_ready === false && styles.disabledBtn,
                ]}
                onPress={captureGps}
                disabled={selected.resolution_ready === false}
              >
                <Ionicons name="location" size={16} color={colors.text} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>
                  {gps ? "GPS captured" : "Capture GPS location"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.buttonPrimaryBg }]}
        onPress={resolveSelectedComplaint}
        disabled={
          loading ||
          !selected ||
          activeTab !== "in_progress" ||
          selected?.resolution_ready === false
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.buttonPrimaryText} />
        ) : (
          <Text style={[styles.submitText, { color: colors.buttonPrimaryText }]}>Resolve selected complaint</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontFamily: fonts.bold, marginBottom: 14 },
  refreshBtn: {
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  healthBar: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  healthText: { fontFamily: fonts.regular, fontSize: 11, flex: 1, marginRight: 8 },
  healthStatus: { fontFamily: fonts.semiBold, fontSize: 11 },
  healthOnline: { color: "#16A34A" },
  healthChecking: { color: "#CA8A04" },
  healthOffline: { color: "#DC2626" },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tabBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  tabBtnActive: {},
  tabText: { fontFamily: fonts.medium, fontSize: 13 },
  tabTextActive: { fontFamily: fonts.semiBold },
  list: { flex: 1, marginBottom: 10 },
  listContent: { paddingBottom: 12 },
  emptyText: { color: "#6B7280", textAlign: "center", marginTop: 30 },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardSelected: {},
  cardTitle: { fontFamily: fonts.semiBold, marginBottom: 4 },
  cardMeta: { fontFamily: fonts.regular, fontSize: 12, marginBottom: 2 },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  statusResolved: { backgroundColor: "#DCFCE7", color: "#166534" },
  statusInProgress: { backgroundColor: "#FEF3C7", color: "#92400E" },
  banner: { color: "#B91C1C", fontSize: 12, fontWeight: "700", marginTop: 4 },
  actionBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  selectedText: { fontFamily: fonts.semiBold, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  btn: {
    flex: 1,
    borderRadius: 10,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnText: { fontFamily: fonts.semiBold },
  actionBtnText: { fontFamily: fonts.medium },
  disabledBtn: { opacity: 0.5 },
  submitBtn: {
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  submitText: { fontSize: 15, fontFamily: fonts.bold },
});
