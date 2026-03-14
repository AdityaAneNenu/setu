import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function HelpSupportScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleEmail = () => {
    Linking.openURL('mailto:support@setu.gov.in');
  };

  const handleCall = () => {
    Linking.openURL('tel:1800-111-555');
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@setu.gov.in?subject=SETU%20App%20Support%20Request');
  };

  const handleUserGuide = () => {
    Alert.alert(t('help.userGuide'), t('help.userGuideContent'));
  };

  const handleVideoTutorials = () => {
    Alert.alert(t('help.tutorials'), t('help.tutorialsContent'));
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const faqs = [
    {
      question: t('help.faq1Q'),
      answer: t('help.faq1A'),
    },
    {
      question: t('help.faq2Q'),
      answer: t('help.faq2A'),
    },
    {
      question: t('help.faq3Q'),
      answer: t('help.faq3A'),
    },
    {
      question: t('help.faq4Q'),
      answer: t('help.faq4A'),
    },
  ];

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('help.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Contact Section */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('help.contactUs')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.optionRow} onPress={handleEmail}>
            <Ionicons name="mail-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('help.emailSupport')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>support@setu.gov.in</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.optionRow} onPress={handleCall}>
            <Ionicons name="call-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('help.callUs')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('help.tollFree')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.optionRow} onPress={handleContactSupport}>
            <Ionicons name="mail-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('help.contactSupport')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('help.contactSupportSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('help.faqs')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {faqs.map((faq, index) => (
            <View key={index}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity 
                style={styles.faqRow}
                onPress={() => toggleFaq(index)}
              >
                <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
                <Ionicons 
                  name={expandedFaq === index ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={colors.textLight} 
                />
              </TouchableOpacity>
              {expandedFaq === index && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Resources Section */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('help.resources')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.optionRow} onPress={handleUserGuide}>
            <Ionicons name="book-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('help.userGuide')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('help.userGuideSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.optionRow} onPress={handleVideoTutorials}>
            <Ionicons name="videocam-outline" size={22} color={colors.text} />
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('help.videoTutorials')}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textLight }]}>{t('help.videoTutorialsSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
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
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#000000',
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
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#000000',
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
    lineHeight: 20,
    paddingBottom: 12,
  },
});
