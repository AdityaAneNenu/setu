import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Animated,
  StatusBar,
  BackHandler,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { authApi, gapsApi, syncApi } from "../services/api";
import { API_CONFIG } from "../config/api";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme";
import { getStoredAuthToken } from "../services/authTokenStorage";
import {
  getStatusCodeMessage,
  isFinalAuthFailure,
  isPermissionDeniedError,
  logApiErrorStatus,
} from "../services/authErrorUtils";

const LOCATION_TIMEOUT_MS = 15000;
const AUTH_READY_WAIT_MS = 2500;
const AUTH_READY_POLL_MS = 150;
const AUTH_RETRY_DELAY_MS = 600;

const getCurrentPositionWithTimeout = () =>
  Promise.race([
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("GPS request timed out")), LOCATION_TIMEOUT_MS);
    }),
  ]);

const openSettingsSafe = () =>
  Linking.openSettings().catch((error) => {
    console.warn("Failed to open app settings:", error?.message || error);
  });

export default function GapVerificationScreen({ navigation }) {
  const { colors } = useTheme();
  const isDark = colors.statusBarStyle === "light-content";
  const insets = useSafeAreaInsets();
  const [openGaps, setOpenGaps] = useState([]);
  const [inProgressGaps, setInProgressGaps] = useState([]);
  const [resolvedGaps, setResolvedGaps] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("IN_PROGRESS");
  const [backendHealth, setBackendHealth] = useState("checking");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [personPhoto, setPersonPhoto] = useState(null);
  const [gpsProof, setGpsProof] = useState(null);
  const [syncSummary, setSyncSummary] = useState({
    PENDING: 0,
    UPLOADING: 0,
    SYNCED: 0,
    FAILED: 0,
    needsRetry: 0,
    pendingTotal: 0,
  });
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const listAnim = React.useRef(new Animated.Value(1)).current;
  const refreshScale = React.useRef(new Animated.Value(1)).current;
  const ctaScale = React.useRef(new Animated.Value(1)).current;
  const tabScaleOpen = React.useRef(new Animated.Value(1)).current;
  const tabScaleProgress = React.useRef(new Animated.Value(1)).current;
  const tabScaleResolved = React.useRef(new Animated.Value(1)).current;
  const resolveInFlightRef = React.useRef(false);
  const authRetryTimerRef = React.useRef(null);
  const authRetryCountRef = React.useRef(0);
  const [authChecking, setAuthChecking] = useState(true);

  const clearSelection = () => {
    setSelected(null);
    setVerificationOpen(false);
    setProofPhoto(null);
    setPersonPhoto(null);
    setGpsProof(null);
  };

  const normalizeStatus = (statusValue) =>
    String(statusValue || "")
      .trim()
      .toLowerCase();

  const getCardGradient = (isSelected = false) => {
    if (isDark) {
      return isSelected ? ["#33261D", "#252536"] : ["#252536", "#1E1E2D"];
    }
    return isSelected ? ["#FFF5F0", "#FFFFFF"] : ["#FFFFFF", "#F8F8FB"];
  };

  const ensureAuthReadyBeforeApi = async ({ allowRetryWait = true } = {}) => {
    let user = authApi.getCurrentUser();
    let token = await getStoredAuthToken();
    if (user || token) {
      setAuthChecking(false);
      return true;
    }

    if (!allowRetryWait) {
      setAuthChecking(true);
      return false;
    }

    const startedAt = Date.now();
    while (!user && !token && Date.now() - startedAt < AUTH_READY_WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, AUTH_READY_POLL_MS));
      user = authApi.getCurrentUser();
      token = await getStoredAuthToken();
    }

    const ready = !!(user || token);
    setAuthChecking(!ready);
    return ready;
  };

  const loadGaps = async ({ allowAuthRetry = true } = {}) => {
    const authReady = await ensureAuthReadyBeforeApi({ allowRetryWait: true });
    if (!authReady) {
      if (allowAuthRetry && authRetryCountRef.current < 1) {
        authRetryCountRef.current += 1;
        if (authRetryTimerRef.current) {
          clearTimeout(authRetryTimerRef.current);
        }
        authRetryTimerRef.current = setTimeout(() => {
          loadGaps({ allowAuthRetry: false }).catch((error) => {
            console.warn("Delayed gap reload failed:", error?.message || error);
          });
        }, AUTH_RETRY_DELAY_MS);
      } else {
        setAuthChecking(false);
        setLoaded(true);
      }
      if (allowAuthRetry) {
        setLoaded(false);
      }
      setFetching(false);
      return;
    }

    authRetryCountRef.current = 0;
    if (authRetryTimerRef.current) {
      clearTimeout(authRetryTimerRef.current);
      authRetryTimerRef.current = null;
    }

    setFetching(true);
    try {
      const response = await gapsApi.getMobileGaps();
      const openItems = (response.open || []).filter((item) => !!item?.id);
      const inProgressItems = (response.in_progress || response.inProgress || []).filter(
        (item) => !!item?.id,
      );
      const resolvedItems = (response.resolved || []).filter((item) => !!item?.id);

      setOpenGaps(openItems);
      setInProgressGaps(inProgressItems);
      setResolvedGaps(resolvedItems);

      if (selected) {
        const refreshed = [...openItems, ...inProgressItems, ...resolvedItems].find(
          (item) => item.id === selected.id,
        );
        setSelected(refreshed || null);
      }

      const summary = await syncApi.getStatus();
      setSyncSummary(summary);
      setLastSyncedAt(new Date());
    } catch (e) {
      logApiErrorStatus("GapVerification.loadGaps", e);
      if (isPermissionDeniedError(e)) {
        Alert.alert("Not authorized", "You are not authorized to view these gaps.");
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
        Alert.alert("Error", statusMessage || e.message || "Could not load gaps.");
      }
    } finally {
      setLoaded(true);
      setFetching(false);
      setAuthChecking(false);
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

  const getSyncMetaLabel = () => {
    if (fetching || Number(syncSummary.UPLOADING) > 0) {
      return "Syncing...";
    }
    if (!lastSyncedAt) {
      return "Not synced yet";
    }
    const diffMs = Date.now() - lastSyncedAt.getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    return mins <= 0 ? "Last synced just now" : `Last synced ${mins} min ago`;
  };

  const animatePress = (animValue, pressed) => {
    Animated.timing(animValue, {
      toValue: pressed ? 0.98 : 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const getTabCountStyle = (count, isActive) => {
    if (isActive) return null;
    return count > 0 ? styles.countTextStrong : styles.countTextMuted;
  };

  const retryFailedSync = async () => {
    const authReady = await ensureAuthReadyBeforeApi({ allowRetryWait: true });
    if (!authReady) {
      return;
    }
    setFetching(true);
    try {
      await syncApi.processQueue();
      await loadGaps();
      Alert.alert("Retry started", "Failed offline items have been queued for another sync attempt.");
    } catch (error) {
      logApiErrorStatus("GapVerification.retryFailedSync", error);
      if (isPermissionDeniedError(error)) {
        Alert.alert("Not authorized", "You are not authorized to retry this sync.");
      } else if (isFinalAuthFailure(error)) {
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
        const statusMessage = getStatusCodeMessage(error);
        Alert.alert("Retry failed", statusMessage || error.message || "Could not retry failed sync items.");
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadGaps();
    checkBackendHealth();
    return () => {
      if (authRetryTimerRef.current) {
        clearTimeout(authRetryTimerRef.current);
        authRetryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    listAnim.setValue(0.96);
    Animated.timing(listAnim, {
      toValue: 1,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [activeTab, listAnim]);

  useFocusEffect(
    React.useCallback(() => {
      loadGaps();
      return () => {};
    }, []),
  );

  useEffect(() => {
    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove", (event) => {
      if (!selected) {
        return;
      }
      event.preventDefault();
      clearSelection();
    });

    const backHandlerSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selected) {
        clearSelection();
        return true;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => {
      unsubscribeBeforeRemove();
      backHandlerSubscription.remove();
    };
  }, [navigation, selected]);

  const currentTabData =
    activeTab === "OPEN" ? openGaps : activeTab === "RESOLVED" ? resolvedGaps : inProgressGaps;
  const hasAnyGaps = openGaps.length > 0 || inProgressGaps.length > 0 || resolvedGaps.length > 0;
  const showAuthLoader = authChecking && !loaded;
  const hasRetryFooter = syncSummary.needsRetry > 0 || Number(syncSummary.FAILED) > 0;
  const bottomSafeInset = insets.bottom + 20;
  const bottomCtaBaseHeight = 88;
  const bottomCtaSyncHeight = hasAnyGaps ? 44 : 0;
  const bottomCtaRetryHeight = hasAnyGaps && hasRetryFooter ? 40 : 0;
  const contentBottomInset =
    bottomSafeInset + bottomCtaBaseHeight + bottomCtaSyncHeight + bottomCtaRetryHeight;

  const resolveSelectedGap = async () => {
    if (resolveInFlightRef.current) return;

    if (!selected) {
      Alert.alert("Select gap", "Please select an in-progress gap first.");
      return;
    }
    const selectedInProgress = inProgressGaps.find((item) => item.id === selected.id);
    if (!selectedInProgress) {
      Alert.alert("Select gap", "Please select an in-progress gap first.");
      return;
    }

    if (!proofPhoto?.uri) {
      Alert.alert("Proof required", "Please capture a proof photo before resolving.");
      return;
    }

    if (gpsProof?.latitude == null || gpsProof?.longitude == null) {
      Alert.alert("GPS required", "Please capture current location before resolving.");
      return;
    }

    resolveInFlightRef.current = true;
    setLoading(true);
    try {
      const res = await gapsApi.resolveMobileGap(selectedInProgress.id, {
        proofPhotoUri: proofPhoto.uri,
        personPhotoUri: personPhoto?.uri || null,
        latitude: gpsProof.latitude,
        longitude: gpsProof.longitude,
        gpsAccuracy: gpsProof.accuracy,
        gpsSamples: gpsProof.samples,
      });
      Alert.alert(
        "Captured Offline",
        `Resolution captured and queued. Sync status: ${res.sync_status}. It will auto-upload when internet is available.`,
      );
      setSelected(null);
      setVerificationOpen(false);
      setProofPhoto(null);
      setPersonPhoto(null);
      setGpsProof(null);
      await loadGaps();
    } catch (e) {
      logApiErrorStatus("GapVerification.resolveSelectedGap", e);
      if (isPermissionDeniedError(e)) {
        Alert.alert("Not authorized", "You are not authorized to resolve this gap.");
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
        Alert.alert("Resolution failed", statusMessage || e.message || "Could not resolve gap.");
      }
    } finally {
      resolveInFlightRef.current = false;
      setLoading(false);
    }
  };

  const openVerification = () => {
    const selectedInProgress = inProgressGaps.find((item) => item.id === selected?.id);
    if (!selectedInProgress) {
      Alert.alert("Select gap", "Please select an in-progress gap first.");
      return;
    }
    setVerificationOpen(true);
  };

  const pickPhoto = async (target) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera permission required",
          "Camera permission is required to capture proof photos.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: openSettingsSafe },
          ],
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      if (target === "person") {
        setPersonPhoto(asset);
      } else {
        setProofPhoto(asset);
      }
    } catch (err) {
      Alert.alert("Camera error", err.message || "Could not capture photo.");
    }
  };

  const captureLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Location permission is required for proof-based resolution.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: openSettingsSafe },
          ],
        );
        return;
      }

      const location = await getCurrentPositionWithTimeout();

      const samples = [
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          captured_at: new Date().toISOString(),
        },
      ];

      for (let i = 0; i < 2; i += 1) {
        const sample = await getCurrentPositionWithTimeout();
        samples.push({
          latitude: sample.coords.latitude,
          longitude: sample.coords.longitude,
          accuracy: sample.coords.accuracy,
          captured_at: new Date().toISOString(),
        });
      }

      const average = {
        latitude: samples.reduce((sum, s) => sum + s.latitude, 0) / samples.length,
        longitude: samples.reduce((sum, s) => sum + s.longitude, 0) / samples.length,
        accuracy:
          samples.reduce((sum, s) => sum + (Number.isFinite(s.accuracy) ? s.accuracy : 0), 0) /
          samples.length,
      };

      setGpsProof({
        ...average,
        samples,
      });

      if (average.accuracy > 50) {
        Alert.alert(
          "Low GPS accuracy",
          `Current GPS accuracy is ±${Math.round(average.accuracy)}m. You can continue, but backend may mark this as Needs Retry.`,
        );
      }
    } catch (err) {
      Alert.alert("Location error", err.message || "Could not capture location.");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      <View style={styles.header}> 
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Gaps</Text>
        </View>

        <View style={styles.headerSide}>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <View style={styles.healthInline}> 
        <View style={styles.healthStatusRow}>
          <Ionicons
            name={backendHealth === "online" ? "ellipse" : backendHealth === "checking" ? "time-outline" : "alert-circle"}
            size={10}
            color={
              backendHealth === "online"
                ? "#16A34A"
                : backendHealth === "checking"
                  ? "#CA8A04"
                  : "#DC2626"
            }
          />
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
        <Text style={[styles.healthMeta, { color: colors.textLight }]}>{getSyncMetaLabel()}</Text>
      </View>

      {showAuthLoader ? (
        <View style={styles.emptyModeRoot}>
          <View style={styles.emptyModeContainer}>
            <ActivityIndicator color={colors.accent} />
          </View>
        </View>
      ) : hasAnyGaps ? (
        <View style={[styles.dataModeContainer, { paddingBottom: contentBottomInset }]}>
          <View style={styles.primaryFocusSection}>
            <Text style={[styles.primarySummary, { color: colors.text }]}>Select a gap to begin verification</Text>
          </View>

          <View style={styles.tabsHeaderRow}>
            <View style={[styles.segmentedControl, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Animated.View style={[styles.tabAnimWrap, { transform: [{ scale: tabScaleOpen }] }]}>
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    { backgroundColor: "transparent" },
                    activeTab === "OPEN" && [styles.tabBtnActive, { backgroundColor: colors.buttonPrimaryBg }],
                  ]}
                  activeOpacity={0.92}
                  onPress={() => setActiveTab("OPEN")}
                  onPressIn={() => animatePress(tabScaleOpen, true)}
                  onPressOut={() => animatePress(tabScaleOpen, false)}
                >
                  <View style={styles.tabContentRow}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={12}
                      color={activeTab === "OPEN" ? colors.buttonPrimaryText : colors.textLight}
                    />
                    <Text style={[styles.tabText, { color: colors.textLight }, activeTab === "OPEN" && [styles.tabTextActive, { color: colors.buttonPrimaryText }]]}>
                      Open <Text style={getTabCountStyle(openGaps.length, activeTab === "OPEN")}>({openGaps.length})</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.tabAnimWrap, { transform: [{ scale: tabScaleProgress }] }]}>
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    { backgroundColor: "transparent" },
                    activeTab === "IN_PROGRESS" && [styles.tabBtnActive, { backgroundColor: colors.buttonPrimaryBg }],
                  ]}
                  activeOpacity={0.92}
                  onPress={() => setActiveTab("IN_PROGRESS")}
                  onPressIn={() => animatePress(tabScaleProgress, true)}
                  onPressOut={() => animatePress(tabScaleProgress, false)}
                >
                  <View style={styles.tabContentRow}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={activeTab === "IN_PROGRESS" ? colors.buttonPrimaryText : colors.textLight}
                    />
                    <Text style={[styles.tabText, { color: colors.textLight }, activeTab === "IN_PROGRESS" && [styles.tabTextActive, { color: colors.buttonPrimaryText }]]}>
                      In Progress <Text style={getTabCountStyle(inProgressGaps.length, activeTab === "IN_PROGRESS")}>({inProgressGaps.length})</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.tabAnimWrap, { transform: [{ scale: tabScaleResolved }] }]}>
                <TouchableOpacity
                  style={[
                    styles.tabBtn,
                    { backgroundColor: "transparent" },
                    activeTab === "RESOLVED" && [styles.tabBtnActive, { backgroundColor: colors.buttonPrimaryBg }],
                  ]}
                  activeOpacity={0.92}
                  onPress={() => setActiveTab("RESOLVED")}
                  onPressIn={() => animatePress(tabScaleResolved, true)}
                  onPressOut={() => animatePress(tabScaleResolved, false)}
                >
                  <View style={styles.tabContentRow}>
                    <Ionicons
                      name="checkmark-done-outline"
                      size={12}
                      color={activeTab === "RESOLVED" ? colors.buttonPrimaryText : colors.textLight}
                    />
                    <Text style={[styles.tabText, { color: colors.textLight }, activeTab === "RESOLVED" && [styles.tabTextActive, { color: colors.buttonPrimaryText }]]}>
                      Resolved <Text style={getTabCountStyle(resolvedGaps.length, activeTab === "RESOLVED")}>({resolvedGaps.length})</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>

            <Animated.View style={{ transform: [{ scale: refreshScale }] }}>
              <TouchableOpacity
                style={[styles.refreshIconBtn, { backgroundColor: colors.surface }]}
                onPress={loadGaps}
                disabled={fetching}
                activeOpacity={0.9}
                onPressIn={() => animatePress(refreshScale, true)}
                onPressOut={() => animatePress(refreshScale, false)}
              >
                <Ionicons name="refresh" size={16} color={colors.textLight} />
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View
            style={{
              flex: 1,
              opacity: listAnim,
              transform: [
                {
                  translateY: listAnim.interpolate({
                    inputRange: [0.96, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            }}
          >
            <FlatList
              data={currentTabData}
              keyExtractor={(item) => String(item.id)}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: bottomSafeInset },
                currentTabData.length === 0 && styles.listContentEmpty,
              ]}
              ListEmptyComponent={
                !loaded || fetching ? null : (
                  <View style={styles.emptyState}> 
                    <Ionicons name="folder-open-outline" size={38} color={colors.emptyIconColor} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No gaps to verify right now</Text>
                    <Text style={[styles.emptyText, { color: colors.textLight }]}>
                      {activeTab === "IN_PROGRESS"
                        ? "You're all caught up 👍"
                        : activeTab === "OPEN"
                          ? "No open gaps right now."
                          : "No resolved gaps available."}
                    </Text>
                  </View>
                )
              }
              renderItem={({ item }) => {
                const selectedItem = selected?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.card,
                      { borderColor: selectedItem ? colors.accent : "transparent", backgroundColor: colors.surface },
                      selectedItem && styles.cardSelected,
                    ]}
                    activeOpacity={0.88}
                    onPress={() => {
                      if (selected?.id === item.id) {
                        clearSelection();
                        return;
                      }
                      setSelected(item);
                      setVerificationOpen(false);
                      setProofPhoto(null);
                      setPersonPhoto(null);
                      setGpsProof(null);
                    }}
                  >
                    <LinearGradient
                      colors={getCardGradient(selectedItem)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardInner}
                    >
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>Gap #{item.id}</Text>
                      <Text style={[styles.cardMetaVillage, { color: colors.textLight }]} numberOfLines={1}>Village: {item.village || "N/A"}</Text>
                      <Text style={[styles.cardMeta, { color: colors.textLight }]}>Severity: {item.severity || "N/A"}</Text>
                      <Text style={[styles.cardDescription, { color: colors.textLight }]} numberOfLines={2}>
                        {item.description || "No description available."}
                      </Text>
                      {!!item.resolution_type && (
                        <Text style={[styles.cardMeta, { color: colors.textLight }]} numberOfLines={2}>
                          {String(item.resolution_type).toLowerCase() === "auto"
                            ? `AI Verified${item.ai_score != null ? ` (${Number(item.ai_score).toFixed(3)})` : ""}`
                            : `Needs Retry${item.review_reason ? `: ${item.review_reason}` : ""}`}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.statusPill,
                          normalizeStatus(item.raw_status) === "needs_review"
                            ? styles.statusNeedsReview
                            : normalizeStatus(item.status) === "open"
                            ? styles.statusOpen
                            : normalizeStatus(item.status) === "resolved"
                              ? styles.statusResolved
                              : styles.statusInProgress,
                        ]}
                      >
                        {normalizeStatus(item.raw_status) === "needs_review"
                          ? "Needs Retry"
                          : normalizeStatus(item.status) === "open"
                          ? "Open"
                          : normalizeStatus(item.status) === "resolved"
                            ? "Resolved"
                            : "In Progress"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>

          {!!selected && activeTab === "IN_PROGRESS" && (
            <LinearGradient
              colors={getCardGradient(true)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionBox, { borderColor: colors.accent }]}
            >
              <Text style={[styles.selectedText, { color: colors.text }]}>Selected Gap: #{selected.id}</Text>

              {!verificationOpen ? (
                <Text style={[styles.selectionHint, { color: colors.textLight }]}>Tap Start Verification below to continue.</Text>
              ) : (
                <View style={styles.verificationBox}>
                  <Text style={[styles.verificationTitle, { color: colors.text }]}>Verification required before resolve</Text>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.border }]}
                    onPress={() => pickPhoto("proof")}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Capture proof photo (required)</Text>
                  </TouchableOpacity>

                  {!!proofPhoto?.uri && <Image source={{ uri: proofPhoto.uri }} style={styles.previewImage} />}

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.border }]}
                    onPress={captureLocation}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Capture GPS location (required)</Text>
                  </TouchableOpacity>

                  <Text style={[styles.verificationMeta, { color: colors.textLight }]}> 
                    {gpsProof
                      ? `Lat ${Number(gpsProof.latitude).toFixed(5)}, Lng ${Number(gpsProof.longitude).toFixed(5)}${gpsProof.accuracy ? ` (±${Math.round(gpsProof.accuracy)}m)` : ""}`
                      : "GPS not captured yet"}
                  </Text>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.border }]}
                    onPress={() => pickPhoto("person")}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Capture person photo (optional)</Text>
                  </TouchableOpacity>

                  {!!personPhoto?.uri && <Image source={{ uri: personPhoto.uri }} style={styles.previewImage} />}

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: colors.buttonPrimaryBg },
                      (!proofPhoto?.uri || !gpsProof) && styles.actionButtonDisabled,
                    ]}
                    onPress={resolveSelectedGap}
                    disabled={loading || !proofPhoto?.uri || !gpsProof}
                    activeOpacity={0.88}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={[styles.actionButtonText, { color: colors.buttonPrimaryText }]}>Submit verification and resolve</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.buttonSecondaryBg, borderColor: colors.border }]}
                    onPress={() => {
                      setProofPhoto(null);
                      setPersonPhoto(null);
                      setGpsProof(null);
                      Alert.alert("Retry Capture", "Capture proof again with clearer photo and better GPS accuracy.");
                    }}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Retry Capture</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>
          )}
        </View>
      ) : (
        <View style={styles.emptyModeRoot}>
          <View style={styles.emptyModeContainer}>
            {!loaded || fetching ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View style={styles.emptyStateCentered}>
                <Ionicons name="folder-open-outline" size={42} color={colors.emptyIconColor} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No gaps to verify right now</Text>
                <Text style={[styles.emptyText, { color: colors.textLight }]}>You're all caught up 👍</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View
        style={[
          styles.bottomCtaWrap,
          styles.footerFixed,
          {
            paddingBottom: bottomSafeInset,
            backgroundColor: colors.backgroundGray,
            borderTopColor: colors.border,
          },
        ]}
      > 
        {hasAnyGaps && (
          <View style={styles.syncFooterSection}>
            <View style={styles.syncPillsRow}>
              <View style={[styles.syncPill, styles.syncPendingPill]}>
                <Ionicons name="cloud-offline-outline" size={11} color="#FFFFFF" />
                <Text style={styles.syncPillText}>{syncSummary.PENDING}</Text>
              </View>
              <View style={[styles.syncPill, styles.syncUploadingPill]}>
                <Ionicons name="sync-outline" size={11} color="#FFFFFF" />
                <Text style={styles.syncPillText}>{syncSummary.UPLOADING}</Text>
              </View>
              <View style={[styles.syncPill, styles.syncSyncedPill]}>
                <Ionicons name="checkmark-circle-outline" size={11} color="#FFFFFF" />
                <Text style={styles.syncPillText}>{syncSummary.SYNCED}</Text>
              </View>
              <View style={[styles.syncPill, styles.syncFailedPill]}>
                <Ionicons name="warning-outline" size={11} color="#FFFFFF" />
                <Text style={styles.syncPillText}>{syncSummary.FAILED}</Text>
              </View>
            </View>
            {syncSummary.needsRetry > 0 && (
              <Text style={styles.retryText}>Needs Retry {syncSummary.needsRetry}</Text>
            )}
            {Number(syncSummary.FAILED) > 0 && (
              <TouchableOpacity
                style={styles.retryAllButton}
                onPress={retryFailedSync}
                disabled={fetching}
              >
                <Text style={styles.retryAllText}>
                  {fetching ? "Retrying..." : "Retry failed sync"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.buttonPrimaryBg },
              !hasAnyGaps && styles.submitBtnLowEmphasis,
            ]}
            onPress={openVerification}
            disabled={loading || !selected || activeTab !== "IN_PROGRESS"}
            activeOpacity={0.9}
            onPressIn={() => animatePress(ctaScale, true)}
            onPressOut={() => animatePress(ctaScale, false)}
          >
            <Text style={[styles.submitText, { color: colors.buttonPrimaryText }]}>Start Verification</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerSide: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  title: { fontSize: 22, fontFamily: fonts.bold },
  healthInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 18,
  },
  healthStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  healthMeta: { fontFamily: fonts.regular, fontSize: 12 },
  healthStatus: { fontFamily: fonts.semiBold, fontSize: 12 },
  dataModeContainer: {
    flex: 1,
    paddingHorizontal: 18,
  },
  emptyModeRoot: {
    flex: 1,
    paddingHorizontal: 18,
  },
  primaryFocusSection: {
    marginBottom: 10,
  },
  primarySummary: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  primaryMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    opacity: 0.8,
  },
  tabsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  syncPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  syncPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  syncPillText: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  syncPendingPill: { backgroundColor: "#FF9800" },
  syncUploadingPill: { backgroundColor: "#3B82F6" },
  syncSyncedPill: { backgroundColor: "#16A34A" },
  syncFailedPill: { backgroundColor: "#EF4444" },
  retryBar: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#FFF3CD",
  },
  retryText: { fontFamily: fonts.semiBold, fontSize: 12, color: "#92400E" },
  retryReason: { fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  retryAllButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    backgroundColor: "#EF4444",
  },
  retryAllText: {
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  healthOnline: { color: "#16A34A" },
  healthChecking: { color: "#CA8A04" },
  healthOffline: { color: "#DC2626" },
  segmentedControl: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
  },
  tabBtn: {
    width: "100%",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    height: 34,
    backgroundColor: "#fff",
  },
  tabAnimWrap: {
    flex: 1,
  },
  tabBtnActive: { backgroundColor: "#111827" },
  tabContentRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tabText: { fontFamily: fonts.medium, fontSize: 11 },
  tabTextActive: { fontFamily: fonts.semiBold },
  countTextStrong: { opacity: 0.95, fontFamily: fonts.semiBold },
  countTextMuted: { opacity: 0.75, fontFamily: fonts.medium },
  list: { flex: 1 },
  listContent: { paddingBottom: 8 },
  listContentEmpty: { flexGrow: 1, justifyContent: "center" },
  emptyModeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateCentered: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    marginTop: 0,
    marginBottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    marginTop: 12,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "#FFF",
    marginBottom: 10,
    overflow: "hidden",
    elevation: 0,
  },
  cardInner: {
    padding: 14,
  },
  cardSelected: {
    shadowColor: "#FA4A0C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: { fontFamily: fonts.bold, marginBottom: 4, fontSize: 15 },
  cardMetaVillage: { fontFamily: fonts.medium, fontSize: 12, marginBottom: 2 },
  cardMeta: { fontFamily: fonts.regular, fontSize: 12, marginBottom: 2 },
  cardDescription: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2, marginBottom: 2 },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10,
    fontFamily: fonts.semiBold,
  },
  statusOpen: { backgroundColor: "#FEE2E2", color: "#B91C1C" },
  statusResolved: { backgroundColor: "#DCFCE7", color: "#166534" },
  statusInProgress: { backgroundColor: "#FEF3C7", color: "#92400E" },
  statusNeedsReview: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  actionBox: {
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginTop: 8,
    marginBottom: 10,
    elevation: 2,
  },
  selectedText: { fontFamily: fonts.semiBold, marginBottom: 10, fontSize: 14 },
  selectionHint: { fontFamily: fonts.regular, fontSize: 12 },
  verificationBox: { gap: 10 },
  verificationTitle: { fontFamily: fonts.semiBold, fontSize: 14, marginBottom: 2 },
  verificationMeta: { fontFamily: fonts.regular, fontSize: 12 },
  actionButton: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    width: "100%",
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontFamily: fonts.semiBold, fontSize: 14 },
  previewImage: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F3F4F6",
  },
  actionBtnText: { fontFamily: fonts.medium, fontSize: 13 },
  syncFooterSection: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  submitBtn: {
    backgroundColor: "#111827",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
    shadowColor: "#FA4A0C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  bottomCtaWrap: {
    paddingTop: 8,
    paddingHorizontal: 18,
  },
  footerFixed: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
  },
  submitBtnLowEmphasis: {
    opacity: 0.7,
  },
  submitText: { fontSize: 15, fontFamily: fonts.semiBold },
});
