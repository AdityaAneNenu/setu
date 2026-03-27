import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { authApi } from '../services/api';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function SecurityScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const handleChangePassword = async () => {
    const user = authApi.getCurrentUser();
    if (user?.email) {
      try {
        await sendPasswordResetEmail(auth, user.email);
        Alert.alert(t('security.resetEmailSent'), t('security.resetEmailSentMsg', { email: user.email }));
      } catch (error) {
        Alert.alert(t('common.error'), error.message || t('security.resetEmailFailed'));
      }
    } else {
      Alert.alert(t('common.error'), t('security.noEmailFound'));
    }
  };

  const handleLoginHistory = () => {
    const user = authApi.getCurrentUser();
    const lastLogin = user?.metadata?.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).toLocaleString()
      : t('common.unknown');
    const created = user?.metadata?.creationTime
      ? new Date(user.metadata.creationTime).toLocaleDateString()
      : t('common.unknown');
    Alert.alert(t('security.loginHistory'), `${t('security.lastLogin')}: ${lastLogin}\n${t('security.accountCreated')}: ${created}`);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('security.deleteAccount'),
      t('security.deleteConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('security.contactSupport'), t('security.deleteContactMsg'));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('security.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={[styles.optionItem, { borderBottomColor: colors.border }]} onPress={handleChangePassword}>
          <View style={styles.optionLeft}>
            <Ionicons name="key-outline" size={24} color={colors.text} />
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('security.changePassword')}</Text>
              <Text style={[styles.optionDescription, { color: colors.textLight }]}>{t('security.changePasswordDesc')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionItem, { borderBottomColor: colors.border }]} onPress={handleLoginHistory}>
          <View style={styles.optionLeft}>
            <Ionicons name="time-outline" size={24} color={colors.text} />
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{t('security.loginHistory')}</Text>
              <Text style={[styles.optionDescription, { color: colors.textLight }]}>{t('security.loginHistoryDesc')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionItem, { borderBottomColor: colors.border }]} onPress={handleDeleteAccount}>
          <View style={styles.optionLeft}>
            <Ionicons name="trash-outline" size={24} color={colors.accentAlt} />
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.accentAlt }]}>{t('security.deleteAccount')}</Text>
              <Text style={[styles.optionDescription, { color: colors.textLight }]}>{t('security.deleteAccountDesc')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: '#000000' },
  placeholder: { width: 36 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  optionTextContainer: { marginLeft: 16, flex: 1 },
  optionTitle: { fontSize: 16, fontFamily: fonts.medium, color: '#000000', marginBottom: 2 },
  optionDescription: { fontSize: 12, fontFamily: fonts.regular, color: '#888888' },
});
