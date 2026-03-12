import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { authApi } from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    // Use onAuthStateChange which fetches the full Firestore profile
    const unsubscribe = authApi.onAuthStateChange((user) => {
      if (user) {
        setUserName(user.displayName || user.username || user.email?.split('@')[0] || t('common.user'));
        setUserEmail(user.email || '');
        setUserRole(user.role || '');
      }
    });
    return () => unsubscribe();
  }, []);

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profile.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Profile Content */}
      <View style={styles.content}>
        {/* Profile Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={50} color="#FFFFFF" />
          </View>
        </View>

        {/* User Info */}
        <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
        <Text style={[styles.userEmail, { color: colors.textLight }]}>{userEmail}</Text>
        {userRole ? (
          <Text style={styles.userRole}>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</Text>
        ) : null}

        {/* Profile Options */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="person-outline" size={24} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>{t('profile.accountSettings')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>{t('profile.notifications')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>{t('profile.settings')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => navigation.navigate('HelpSupport')}
          >
            <Ionicons name="help-circle-outline" size={24} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>{t('profile.helpSupport')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => navigation.navigate('AccessibilitySettings')}
          >
            <Ionicons name="accessibility-outline" size={24} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>{t('profile.accessibility')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => navigation.navigate('StorageCloud')}
          >
            <Ionicons name="cloud-outline" size={24} color={colors.text} />
            <Text style={[styles.optionText, { color: colors.text }]}>{t('profile.storageCloud')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.iconInactive} />
          </TouchableOpacity>
        </View>
      </View>
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
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: '#000000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
    marginBottom: 8,
  },
  userRole: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#FA4A0C',
    backgroundColor: '#FA4A0C15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 32,
  },
  optionsContainer: {
    width: '100%',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#000000',
    marginLeft: 16,
  },
});
