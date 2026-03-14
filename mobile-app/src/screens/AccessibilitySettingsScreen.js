import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Switch,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function AccessibilitySettingsScreen({ navigation }) {
  const {
    largeText, updateLargeText,
    hapticEnabled, updateHaptic,
    reduceMotion, updateReduceMotion,
    triggerHaptic,
  } = useAccessibility();
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const handleOpenDeviceAccessibility = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      try {
        Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS');
      } catch (e) {
        Alert.alert(t('accessibility.title'), t('accessibility.openDeviceSettingsMsg'));
      }
    }
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('accessibility.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Display */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('accessibility.display')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="text-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('accessibility.largeText')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('accessibility.largeTextDesc')}</Text>
            </View>
            <Switch
              value={largeText}
              onValueChange={(v) => {
                updateLargeText(v);
                triggerHaptic('selection');
              }}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.optionRow}>
            <Ionicons name="flash-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('accessibility.reduceMotion')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('accessibility.reduceMotionDesc')}</Text>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={(v) => {
                updateReduceMotion(v);
                triggerHaptic('selection');
              }}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Interaction */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('accessibility.interaction')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.optionRow}>
            <Ionicons name="hand-left-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('accessibility.hapticFeedback')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('accessibility.hapticFeedbackDesc')}</Text>
            </View>
            <Switch
              value={hapticEnabled}
              onValueChange={(v) => {
                updateHaptic(v);
                if (v) {
                  // Give immediate feedback so user feels it
                  setTimeout(() => triggerHaptic('success'), 100);
                }
              }}
              trackColor={{ false: '#E0E0E0', true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Voice */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('accessibility.voice')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => {
              triggerHaptic('light');
              navigation.navigate('TTSSettings');
            }}
          >
            <Ionicons name="volume-medium-outline" size={22} color={colors.text} />
            <Text style={[styles.optionTitleSimple, { color: colors.text }]}>{t('accessibility.ttsSettings')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Device Settings */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('accessibility.device')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => {
              triggerHaptic('light');
              handleOpenDeviceAccessibility();
            }}
          >
            <Ionicons name="phone-portrait-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('accessibility.deviceAccessibility')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('accessibility.deviceAccessibilityDesc')}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#888888',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  optionInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#000000',
  },
  optionTitleSimple: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#000000',
    marginLeft: 14,
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#888888',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 36,
  },
});
