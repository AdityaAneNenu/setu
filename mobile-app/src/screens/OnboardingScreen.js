import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const SLIDES = [
    {
      id: '1',
      icon: 'document-text-outline',
      title: t('onboarding.slide1Title'),
      subtitle: t('onboarding.slide1Desc'),
    },
    {
      id: '2',
      icon: 'mic-outline',
      title: t('onboarding.slide2Title'),
      subtitle: t('onboarding.slide2Desc'),
    },
    {
      id: '3',
      icon: 'cloud-upload-outline',
      title: t('onboarding.slide3Title'),
      subtitle: t('onboarding.slide3Desc'),
    },
  ];

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.replace('Login');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={80} color={colors.iconInactive} />
      </View>
      <Text style={[styles.slideTitle, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.slideSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      {/* Skip */}
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <TouchableOpacity onPress={() => navigation.replace('Login')}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentIndex === index && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.buttonPrimaryBg }]} onPress={handleNext}>
          <Text style={[styles.nextButtonText, { color: colors.buttonPrimaryText }]}>
            {currentIndex === SLIDES.length - 1 ? t('onboarding.getStarted') : t('onboarding.next')}
          </Text>
        </TouchableOpacity>
      </View>
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
  placeholder: {
    width: 24,
  },
  skipText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: '#888888',
  },
  slide: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 65,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 2,
  },
  slideTitle: {
    fontSize: 28,
    fontFamily: fonts.semiBold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 17,
    fontFamily: fonts.regular,
    color: '#000000',
    opacity: 0.57,
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#000000',
    borderRadius: 4,
  },
  bottomSection: {
    paddingHorizontal: 50,
    paddingBottom: 55,
  },
  nextButton: {
    backgroundColor: '#000000',
    height: 70,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#F6F6F9',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
});
