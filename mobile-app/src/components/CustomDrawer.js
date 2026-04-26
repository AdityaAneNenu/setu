import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { authApi } from '../services/api';
import { useAccessibility } from '../context/AccessibilityContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

// Menu items for Ground Level Workers only
const menuItems = [
  { icon: 'person-circle-outline', labelKey: 'drawer.profile', screen: 'Profile' },
  { icon: 'scan-outline', labelKey: 'drawer.scanDocument', screen: 'ScanDocument' },
  { icon: 'mic-outline', labelKey: 'drawer.recordAudio', screen: 'UploadAudio' },
  { icon: 'time-outline', labelKey: 'drawer.history', screen: 'History' },
  { icon: 'search-outline', labelKey: 'drawer.search', screen: 'Search' },
  { icon: 'checkmark-done-circle-outline', labelKey: 'drawer.resolveComplaints', screen: 'GapVerification' },
  { icon: 'settings-outline', labelKey: 'drawer.settings', screen: 'Settings' },
];

export default function CustomDrawer({ navigation }) {
  const { triggerHaptic } = useAccessibility();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const handleSignOut = async () => {
    triggerHaptic('medium');
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert(t('common.error'), t('drawer.signOutError'));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.drawerBg }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.drawerBg} />
      
      <View style={styles.decorativeContainer}>
        <View style={styles.decorativeImage1} />
        <View style={styles.decorativeImage2} />
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <View key={index}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                triggerHaptic('light');
                navigation.navigate(item.screen);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={24} color={colors.drawerText} />
              <Text style={[styles.menuLabel, { color: colors.drawerText }]}>
                {item.labelKey.startsWith("drawer.") ? t(item.labelKey) : item.labelKey}
              </Text>
            </TouchableOpacity>
            {index < menuItems.length - 1 && (
              <View
                style={[
                  styles.menuDivider,
                  { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
                ]}
              />
            )}
          </View>
        ))}
      </View>

      <View style={styles.signOutContainer}>
        <TouchableOpacity 
          style={styles.signOutButton} 
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Text style={[styles.signOutText, { color: colors.drawerText }]}>{t('drawer.signOut')}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.drawerText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  decorativeContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '60%',
    height: '100%',
    zIndex: 0,
    overflow: 'hidden',
  },
  decorativeImage1: {
    position: 'absolute',
    right: -30,
    top: 156,
    width: 248,
    height: 553,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 32,
    opacity: 0.2,
  },
  decorativeImage2: {
    position: 'absolute',
    right: -10,
    top: 207,
    width: 246,
    height: 531,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 30,
    opacity: 0.2,
  },
  menuContainer: {
    paddingHorizontal: 38,
    paddingTop: Platform.OS === 'ios' ? 161 : 140,
    zIndex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
  },
  menuLabel: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    marginLeft: 18,
  },
  menuDivider: {
    height: 0.6,
    marginLeft: 42,
    width: 132,
  },
  signOutContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 38,
    zIndex: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    marginRight: 12,
  },
});
