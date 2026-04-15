import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { fonts } from '../theme';
import { authApi } from '../services/api';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { formatErrorForDisplay } from '../utils/errorDisplay';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { colors } = useTheme();

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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.backgroundLight }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundLight} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with rounded bottom - matches Figma node 7:298 */}
        <View style={[styles.headerArea, { backgroundColor: colors.card, shadowColor: colors.shadowDark }]}>
          {/* SETU Logo - light-mode style per Figma */}
          <View style={styles.logoContainer}>
            <Text style={[styles.setuText, { color: colors.text }]}>S  E  T  U</Text>
            <Text style={[styles.tagline, { color: colors.labelColor }]}>
              Smart Evaluation and Tracking Utility for Village Development
            </Text>
          </View>
        </View>

        {/* Login Tab - matches Figma node 2:3, 2:5 */}
        <View style={styles.loginTabContainer}>
          <Text style={[styles.loginTabText, { color: colors.text }]}>{t('login.title')}</Text>
          <View style={[styles.loginUnderline, { backgroundColor: colors.text }]} />
        </View>

        {/* Form - matches Figma node 6:7, 6:8 */}
        <View style={styles.formContainer}>
          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textPlaceholder }]}>{t('login.emailPlaceholder')}</Text>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder=""
              placeholderTextColor={colors.textLight}
            />
            <View style={[styles.inputLine, { backgroundColor: colors.divider }]} />
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textPlaceholder }]}>{t('login.passwordPlaceholder')}</Text>
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t('login.passwordMask')}
              placeholderTextColor={colors.textPlaceholder}
            />
            <View style={[styles.inputLine, { backgroundColor: colors.divider }]} />
          </View>

          {/* Forgot Passcode - matches Figma node 6:17 with orange color */}
          <TouchableOpacity style={styles.forgotContainer} onPress={handleForgotPassword}>
            <Text style={[styles.forgotText, { color: colors.accent }]}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>
        </View>

        {/* Spacer to push button down */}
        <View style={styles.spacer} />

        {/* Login Button - matches Figma node 6:14 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.buttonPrimaryBg }, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.buttonPrimaryText} size="small" />
            ) : (
              <Text style={[styles.loginButtonText, { color: colors.buttonPrimaryText }]}>{t('login.loginButton')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerArea: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: 100,
    paddingBottom: 60,
    marginTop: -15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 4,
  },
  logoContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  setuText: {
    fontSize: 32,
    fontFamily: fonts.semiBold,
    color: '#000000',
    letterSpacing: 8,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  loginTabContainer: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 50,
  },
  loginTabText: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 17,
  },
  loginUnderline: {
    width: 134,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 40,
    shadowColor: 'rgba(195, 63, 21, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  formContainer: {
    paddingHorizontal: 50,
  },
  inputGroup: {
    marginBottom: 45,
  },
  inputLabel: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#000000',
    opacity: 0.4,
    marginBottom: 20,
  },
  textInput: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    paddingVertical: 0,
  },
  passwordInput: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    paddingVertical: 0,
    letterSpacing: 3,
  },
  inputLine: {
    height: 1,
    backgroundColor: '#000000',
    opacity: 1,
    marginTop: 18,
  },
  forgotContainer: {
    marginTop: -10,
  },
  forgotText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#FA4A0C',
  },
  spacer: {
    flex: 1,
    minHeight: 100,
  },
  buttonContainer: {
    paddingHorizontal: 50,
    paddingBottom: 60,
  },
  loginButton: {
    backgroundColor: '#000000',
    height: 70,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#F6F6F9',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
});
