import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function PrivacyPolicyScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('privacy.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('privacy.dataCollection')}</Text>
        <Text style={[styles.paragraph, { color: colors.textLight }]}>
          {t('privacy.dataCollectionContent')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('privacy.dataUsage')}</Text>
        <Text style={[styles.paragraph, { color: colors.textLight }]}>
          {t('privacy.dataUsageContent')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('privacy.dataStorage')}</Text>
        <Text style={[styles.paragraph, { color: colors.textLight }]}>
          {t('privacy.dataStorageContent')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('privacy.dataSharing')}</Text>
        <Text style={[styles.paragraph, { color: colors.textLight }]}>
          {t('privacy.dataSharingContent')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('privacy.yourRights')}</Text>
        <Text style={[styles.paragraph, { color: colors.textLight }]}>
          {t('privacy.yourRightsContent')}
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('privacy.contactUs')}</Text>
        <Text style={[styles.paragraph, { color: colors.textLight }]}>
          {t('privacy.contactContent')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#000000',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 10,
  },
});
