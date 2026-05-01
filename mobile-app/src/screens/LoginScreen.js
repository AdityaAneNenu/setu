import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { authApi } from '../services/api';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { formatErrorForDisplay } from '../utils/errorDisplay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef(null);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Logic (untouched) ──
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('login.enterEmail'), t('login.enterEmailMsg'), [{ text: t('common.ok') }]);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(t('login.resetSent'), t('login.resetSentMsg'), [{ text: t('common.ok') }]);
    } catch (error) {
      const friendly = formatErrorForDisplay(error, {
        action: 'send reset email',
        fallback: t('login.resetError'),
      });
      Alert.alert(t('login.resetError'), friendly.message, [{ text: t('common.ok') }]);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('login.loginFailed'), t('login.emptyFields'), [{ text: t('common.ok') }]);
      return;
    }

    setLoading(true);
    try {
      await authApi.login(email.trim(), password);
      // App.js onAuthStateChanged auto-navigates to Main
    } catch (error) {
      console.error('Login error:', error);
      const friendly = formatErrorForDisplay(error, {
        action: 'sign in',
        fallback: t('login.loginFailedMsg'),
      });
      Alert.alert(
        t('login.loginFailed'),
        friendly.message,
        [{ text: t('common.ok') }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  // ── Dynamic colors ──
  const accentColor = colors.buttonPrimaryBg;
  const headerGradient = isDark
    ? [accentColor, 'rgba(255,107,61,0.6)', colors.backgroundLight]
    : [accentColor, 'rgba(250,74,12,0.65)', colors.backgroundLight];

  const cardBg = isDark ? '#1C1C2E' : '#FFFFFF';
  const fieldBg = isDark ? '#252540' : '#F4F4F8';
  const fieldBorderIdle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundLight }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={headerGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.headerGradient}
      >
        {/* Decorative circles */}
        <View style={[styles.decoCircle, styles.decoCircle1, { borderColor: 'rgba(255,255,255,0.1)' }]} />
        <View style={[styles.decoCircle, styles.decoCircle2, { borderColor: 'rgba(255,255,255,0.06)' }]} />

        <View style={[styles.headerContent, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.logoText}>S E T U</Text>
          <Text style={styles.taglineText}>Smart Evaluation and Tracking Utility</Text>
        </View>
      </LinearGradient>

      {/* ── Form Sheet ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.View
          style={[
            styles.formSheet,
            {
              backgroundColor: cardBg,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Title */}
            <Text style={[styles.formTitle, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}>
              Welcome Back
            </Text>
            <Text style={[styles.formSubtitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}>
              {t('login.title')} to continue
            </Text>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }]}>
                Email
              </Text>
              <View
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: fieldBg,
                    borderColor: isEmailFocused ? accentColor : fieldBorderIdle,
                  },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color={isEmailFocused ? accentColor : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')}
                  style={styles.fieldIcon}
                />
                <TextInput
                  style={[styles.fieldInput, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder={t('login.emailPlaceholder')}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)'}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                {email.trim().length > 4 && email.includes('@') && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }]}>
                Password
              </Text>
              <View
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: fieldBg,
                    borderColor: isPasswordFocused ? accentColor : fieldBorderIdle,
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={isPasswordFocused ? accentColor : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')}
                  style={styles.fieldIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.fieldInput, { color: isDark ? '#FFFFFF' : '#1A1A2E' }]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={t('login.passwordMask')}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)'}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={handleForgotPassword}
              activeOpacity={0.7}
            >
              <Text style={[styles.forgotText, { color: accentColor }]}>
                {t('login.forgotPassword')}
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <Animated.View style={[styles.btnOuter, { transform: [{ scale: buttonScale }] }]}>
              <TouchableOpacity
                style={[
                  styles.loginBtn,
                  { backgroundColor: accentColor },
                  loading && styles.loginBtnDisabled,
                ]}
                onPress={handleLogin}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>{t('login.loginButton')}</Text>
                    <View style={styles.btnArrow}>
                      <Ionicons name="arrow-forward" size={18} color={accentColor} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Footer */}
            <View style={[styles.footerRow, { paddingBottom: insets.bottom + 12 }]}>
              <Text style={[styles.footerText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
                Don't have an account?
              </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={[styles.footerLink, { color: accentColor }]}>
                  {' '}Contact Admin
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const HEADER_HEIGHT = SCREEN_H * 0.30;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  /* ── Gradient Header ── */
  headerGradient: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    paddingTop: 0,
  },
  decoCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  decoCircle1: {
    width: SCREEN_W * 0.9,
    height: SCREEN_W * 0.9,
    top: -SCREEN_W * 0.35,
    right: -SCREEN_W * 0.25,
  },
  decoCircle2: {
    width: SCREEN_W * 0.55,
    height: SCREEN_W * 0.55,
    bottom: -SCREEN_W * 0.1,
    left: -SCREEN_W * 0.2,
  },
  headerContent: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: 10,
  },
  taglineText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    letterSpacing: 0.4,
  },

  /* ── Form Sheet ── */
  formSheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    // Android
    elevation: 12,
  },
  formScroll: {
    paddingHorizontal: 28,
    paddingTop: 32,
  },

  /* ── Title ── */
  formTitle: {
    fontSize: 28,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    marginBottom: 30,
  },

  /* ── Fields ── */
  fieldWrap: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  fieldIcon: {
    marginRight: 10,
    width: 22,
    textAlign: 'center',
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    height: '100%',
    paddingVertical: 0,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Forgot ── */
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 28,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },

  /* ── Button ── */
  btnOuter: {
    width: '100%',
    marginBottom: 24,
  },
  loginBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginBtnText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginRight: 10,
  },
  btnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Footer ── */
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  footerLink: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
});
