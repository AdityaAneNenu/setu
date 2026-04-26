import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { fonts } from "../theme";
import { gapsApi } from "../services/api";
import { resolveAudioUrl } from "../services/audioUtils";
import { useAuthContext } from "../context/AuthContext";
import { useTranslation } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

const severityColors = { high: "#F44336", medium: "#FF9800", low: "#4CAF50" };
const statusColors = {
  open: "#F44336",
  in_progress: "#FF9800",
  resolved: "#4CAF50",
  under_review: "#2196F3",
  verified: "#009688",
  rejected: "#F44336",
};

export default function GapDetailScreen({ route, navigation }) {
  const { gapId } = route.params || {};
  const [gap, setGap] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isGroundWorker } = useAuthContext();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  // Audio playback via expo-audio
  const audioSource = gap?.audio_url ? resolveAudioUrl(gap.audio_url) : null;
  const player = useAudioPlayer(audioSource);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    loadGap();
  }, []);

  const loadGap = async () => {
    try {
      const data = await gapsApi.getById(gapId);

      // SECURITY: Ground workers can only view gaps they submitted
      if (
        isGroundWorker &&
        data.submitted_by &&
        data.submitted_by !== user?.uid
      ) {
        Alert.alert(
          t("gapDetail.accessDenied"),
          t("gapDetail.accessDeniedMsg"),
        );
        navigation.goBack();
        return;
      }

      setGap(data);
    } catch (error) {
      console.error("Gap load error:", error);
      Alert.alert(t("common.error"), t("gapDetail.loadError"));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const playAudio = () => {
    if (!gap?.audio_url || !player) return;
    try {
      if (playerStatus.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.error("Playback error:", error);
      Alert.alert(t("common.error"), t("gapDetail.playError"));
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await gapsApi.updateStatus(gapId, newStatus, gap?.django_id || null);
      setGap((prev) => ({ ...prev, status: newStatus }));
      Alert.alert(t("common.success"), t("gapDetail.statusUpdated"));
    } catch (error) {
      Alert.alert(t("common.error"), t("gapDetail.updateStatusError"));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!gap) return null;

  const createdAt = gap.created_at?.toDate
    ? gap.created_at.toDate().toLocaleDateString("en-IN")
    : gap.created_at?.seconds
      ? new Date(gap.created_at.seconds * 1000).toLocaleDateString("en-IN")
      : typeof gap.created_at === "string"
        ? new Date(gap.created_at).toLocaleDateString("en-IN")
        : "N/A";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.backgroundGray }]}
    >
      <StatusBar
        barStyle={colors.statusBarStyle}
        backgroundColor={colors.backgroundGray}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("gapDetail.title")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: `${statusColors[gap.status]}15` },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: statusColors[gap.status] },
            ]}
          />
          <Text
            style={[styles.statusLabel, { color: statusColors[gap.status] }]}
          >
            {t(`gapDetail.status_${gap.status || "open"}`)}
          </Text>
          {gap.resolved_by && (
            <Text style={styles.resolvedBy}>
              {t("gapDetail.by")} {gap.resolved_by}
            </Text>
          )}
        </View>

        {/* Type & Severity */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardRow}>
            <View style={styles.cardItem}>
              <Text style={[styles.cardLabel, { color: colors.textLight }]}>
                {t("gapDetail.typeLabel")}
              </Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>
                {(gap.gap_type || "other").replace(/_/g, " ")}
              </Text>
            </View>
            <View style={styles.cardItem}>
              <Text style={[styles.cardLabel, { color: colors.textLight }]}>
                {t("gapDetail.severityLabel")}
              </Text>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: `${severityColors[gap.severity]}20` },
                ]}
              >
                <View
                  style={[
                    styles.sevDot,
                    { backgroundColor: severityColors[gap.severity] },
                  ]}
                />
                <Text
                  style={[
                    styles.severityText,
                    { color: severityColors[gap.severity] },
                  ]}
                >
                  {gap.severity?.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.cardRow}>
            <View style={styles.cardItem}>
              <Text style={[styles.cardLabel, { color: colors.textLight }]}>
                {t("gapDetail.villageLabel")}
              </Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>
                {gap.village_name || t("gapDetail.unknown")}
              </Text>
            </View>
            <View style={styles.cardItem}>
              <Text style={[styles.cardLabel, { color: colors.textLight }]}>
                {t("gapDetail.inputMethodLabel")}
              </Text>
              <View style={styles.inputMethodRow}>
                <Ionicons
                  name={
                    gap.input_method === "image"
                      ? "camera"
                      : gap.input_method === "voice"
                        ? "mic"
                        : "document-text"
                  }
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.inputMethodText, { color: colors.text }]}>
                  {gap.input_method || "text"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.cardRow}>
            <View style={styles.cardItem}>
              <Text style={[styles.cardLabel, { color: colors.textLight }]}>
                {t("gapDetail.reportedLabel")}
              </Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>
                {createdAt}
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {gap.description ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.textLight }]}>
              {t("gapDetail.details")}
            </Text>
            <Text style={[styles.description, { color: colors.text }]}>
              {gap.description}
            </Text>
          </View>
        ) : null}

        {/* Recommendations */}
        {gap.recommendations ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.textLight }]}>
              {t("gapDetail.recommendations")}
            </Text>
            <Text style={[styles.description, { color: colors.text }]}>
              {gap.recommendations}
            </Text>
          </View>
        ) : null}

        {/* Audio Player */}
        {gap.audio_url ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.textLight }]}>
              {t("gapDetail.audioEvidence")}
            </Text>
            <TouchableOpacity
              style={[
                styles.audioPlayer,
                {
                  backgroundColor: isDark ? "#2A1A12" : "#FFF8F5",
                  borderColor: isDark ? "#4A2A16" : "#FFE8DC",
                },
              ]}
              onPress={playAudio}
            >
              <View style={styles.playButton}>
                <Ionicons
                  name={playerStatus.playing ? "pause" : "play"}
                  size={24}
                  color="#FFF"
                />
              </View>
              <View style={styles.audioInfo}>
                <Text style={[styles.audioTitle, { color: colors.text }]}>
                  {t("gapDetail.originalRecording")}
                </Text>
                <Text
                  style={[styles.audioSubtext, { color: colors.textLight }]}
                >
                  {playerStatus.playing
                    ? t("gapDetail.tapToPause")
                    : t("gapDetail.tapToPlay")}
                </Text>
              </View>
              <Ionicons name="volume-high" size={20} color="#FA4A0C" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 10, alignItems: "center" }}
              onPress={() =>
                navigation.navigate("AudioViewer", {
                  audio: {
                    title: (gap.gap_type || "Gap").replace(/_/g, " "),
                    audio_url: gap.audio_url,
                    description: gap.description,
                    language: gap.language || "en",
                    date: createdAt,
                    gapId: gap.id,
                  },
                })
              }
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: fonts.semiBold,
                  color: colors.accent,
                }}
              >
                {t("gapDetail.openFullViewer")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Image */}
        {gap.image_url ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.textLight }]}>
              {t("gapDetail.photoEvidence")}
            </Text>
            <TouchableOpacity
              style={styles.imageLink}
              onPress={() =>
                navigation.navigate("DocumentViewer", {
                  document: {
                    title: (gap.gap_type || "Gap").replace(/_/g, " "),
                    image_url: gap.image_url,
                    description: gap.description,
                    language: gap.language || "en",
                    date: createdAt,
                  },
                })
              }
            >
              <Ionicons name="image" size={20} color="#2196F3" />
              <Text style={styles.imageLinkText}>
                {t("gapDetail.viewPhoto")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Action Buttons - hidden for ground workers (view-only) */}
        {!isGroundWorker && (
          <View style={styles.actions}>
            {gap.status === "open" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#FF9800" }]}
                onPress={() => handleStatusChange("in_progress")}
              >
                <Ionicons
                  name="play"
                  size={18}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.actionBtnText}>
                  {t("gapDetail.markInProgress")}
                </Text>
              </TouchableOpacity>
            )}
            {gap.status === "in_progress" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#4CAF50" }]}
                onPress={() => {
                  if (!gap.django_id) {
                    Alert.alert(
                      t("gapDetail.syncRequiredTitle"),
                      t("gapDetail.syncRequiredMessage"),
                      [{ text: t("common.ok") }],
                    );
                    return;
                  }
                  navigation.navigate("ClosurePhoto", {
                    gapFirestoreId: gap.id,
                    djangoGapId: gap.django_id,
                    gapType: gap.gap_type,
                    villageName: gap.village_name,
                  });
                }}
              >
                <Ionicons
                  name="camera"
                  size={18}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.actionBtnText}>{t("gapDetail.closeWithPhotoProof")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F8" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: fonts.bold, color: "#000" },
  scroll: { flex: 1, paddingHorizontal: 20 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusLabel: { fontSize: 14, fontFamily: fonts.bold, flex: 1 },
  resolvedBy: { fontSize: 12, fontFamily: fonts.regular, color: "#888" },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  cardRow: { flexDirection: "row", marginBottom: 12 },
  cardItem: { flex: 1 },
  cardLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#888",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#000",
    textTransform: "capitalize",
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sevDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  severityText: { fontSize: 12, fontFamily: fonts.bold },
  inputMethodRow: { flexDirection: "row", alignItems: "center" },
  inputMethodText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#333",
    marginLeft: 6,
    textTransform: "capitalize",
  },
  description: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#333",
    lineHeight: 22,
  },
  audioPlayer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8F5",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FFE8DC",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FA4A0C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  audioInfo: { flex: 1 },
  audioTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: "#000" },
  audioSubtext: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#888",
    marginTop: 2,
  },
  imageLink: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
  },
  imageLinkText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: "#2196F3",
    marginLeft: 8,
  },
  actions: { gap: 10, marginTop: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 20,
  },
  actionBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: "#FFF" },
});
