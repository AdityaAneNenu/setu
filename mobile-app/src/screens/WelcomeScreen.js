import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../context/LanguageContext';

const { width, height } = Dimensions.get('window');

// Responsive positioning based on screen height
const AVATAR_TOP = height * 0.45; // 45% from top for woman
const MAN_TOP = height * 0.52; // 52% from top for man
const GRADIENT_TOP = height * 0.75; // 75% from top for gradients

// Avatar images from Figma (nodes 2551:57 and 2551:60)
const AVATAR_IMAGES = {
  womanInSaree: require('../../images/woman-saree.png'),
  manInTurban: require('../../images/man-turban.png'),
};

// SETU Logo Component - white circle with spaced text per Figma
const SetuLogo = () => (
  <View style={styles.setuLogoContainer}>
    <View style={styles.logoCircle}>
      <Text style={styles.logoText}>S E T U</Text>
    </View>
  </View>
);

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" />
      
      {/* Main content wrapper */}
      <View style={styles.contentWrapper}>
        {/* SETU Logo */}
        <SetuLogo />

        {/* Welcome Text */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>{t('welcome.title')}</Text>
          <Text style={styles.toSetuText}>{t('welcome.toSetu')}</Text>
        </View>

        {/* Avatar Section - positioned absolutely from screen top */}
        <View style={styles.avatarSection}>
          {/* Woman in saree - Figma position: left -174, top 241 */}
          <View style={styles.leftAvatarWrapper}>
            <Image
              source={AVATAR_IMAGES.womanInSaree}
              style={styles.leftAvatarImage}
              resizeMode="contain"
            />
          </View>
          
          {/* Man in turban - Figma position: left 167, top 388 */}
          <View style={styles.rightAvatarWrapper}>
            <Image
              source={AVATAR_IMAGES.manInTurban}
              style={styles.rightAvatarImage}
              resizeMode="contain"
            />
          </View>

          {/* Gradient overlays */}
          <View style={styles.gradientWrapper1}>
            <LinearGradient
              colors={['rgba(255, 71, 11, 0.51)', 'rgba(0, 0, 0, 1)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradient1}
            />
          </View>

          <View style={styles.gradientWrapper2}>
            <LinearGradient
              colors={['rgba(255, 71, 11, 0.10)', 'rgba(0, 0, 0, 1)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradient2}
            />
          </View>
        </View>
      </View>

      {/* Get Started Button - fixed at bottom */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 30 }]}>
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.9}
        >
          <Text style={styles.getStartedText}>{t('welcome.getStarted')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  setuLogoContainer: {
    paddingHorizontal: 49,
    paddingTop: 56,
  },
  logoCircle: {
    width: 73,
    height: 73,
    borderRadius: 36.5,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 3,
  },
  welcomeContainer: {
    paddingHorizontal: 51,
    marginTop: 31,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 65,
    fontWeight: '900',
    lineHeight: 56,
    letterSpacing: -1.95,
  },
  toSetuText: {
    color: '#FFFFFF',
    fontSize: 65,
    fontWeight: '900',
    lineHeight: 65,
    letterSpacing: -1.95,
  },
  avatarSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Woman in saree - responsive positioning
  leftAvatarWrapper: {
    position: 'absolute',
    left: -width * 0.35,
    top: AVATAR_TOP,
    width: width * 1.25,
    height: width * 1.25,
    transform: [{ rotate: '-12deg' }],
    zIndex: 2,
  },
  leftAvatarImage: {
    width: '100%',
    height: '100%',
  },
  // Man in turban - responsive positioning
  rightAvatarWrapper: {
    position: 'absolute',
    right: -width * 0.15,
    top: MAN_TOP,
    width: width * 0.95,
    height: width * 0.95,
    transform: [{ rotate: '8.57deg' }],
    zIndex: 3,
  },
  rightAvatarImage: {
    width: '100%',
    height: '100%',
  },
  // Gradient overlays - responsive
  gradientWrapper1: {
    position: 'absolute',
    left: -width * 0.18,
    top: GRADIENT_TOP,
    width: width * 0.98,
    height: height * 0.22,
    zIndex: 1,
    opacity: 0.06,
  },
  gradient1: {
    flex: 1,
    borderRadius: 200,
  },
  gradientWrapper2: {
    position: 'absolute',
    right: -width * 0.12,
    top: GRADIENT_TOP + 20,
    width: width * 0.69,
    height: height * 0.20,
    transform: [{ rotate: '-2deg' }],
    zIndex: 1,
    opacity: 0.04,
  },
  gradient2: {
    flex: 1,
    borderRadius: 200,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 30,
    paddingHorizontal: 51,
    zIndex: 10,
  },
  getStartedButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    borderRadius: 30,
    alignItems: 'center',
  },
  getStartedText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
  },
});
