<<<<<<< HEAD
import React, { useCallback } from "react";
=======
import React, { useCallback, useEffect } from "react";
>>>>>>> 6a0a424 (Many changes in verification modules.)
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import {
  AccessibilityProvider,
  useAccessibility,
} from "./src/context/AccessibilityContext";
import { LanguageProvider } from "./src/context/LanguageContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";

import {
  WelcomeScreen,
  LoginScreen,
  HomeScreen,
  ScanDocumentScreen,
  UploadAudioScreen,
  GapFormScreen,
  ProfileScreen,
  PrivacyPolicyScreen,
  SecurityScreen,
  SettingsScreen,
  NotificationsScreen,
  HelpSupportScreen,
  DocumentProcessingScreen,
  AudioProcessingScreen,
  HistoryScreen,
  DocumentViewerScreen,
  AudioViewerScreen,
  LanguageSettingsScreen,
  StorageCloudScreen,
  OnboardingScreen,
  SearchScreen,
  AccessibilitySettingsScreen,
  TTSSettingsScreen,
  GapDetailScreen,
  ClosurePhotoScreen,
<<<<<<< HEAD
  ComplaintSubmissionScreen,
  ComplaintVerificationScreen,
} from "./src/screens";
import CustomDrawer from "./src/components/CustomDrawer";
=======
  GapVerificationScreen,
} from "./src/screens";
import CustomDrawer from "./src/components/CustomDrawer";
import {
  startOfflineSyncEngine,
  stopOfflineSyncEngine,
} from "./src/services/offlineSyncEngine";
>>>>>>> 6a0a424 (Many changes in verification modules.)

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Drawer Navigator - for all authenticated users
function DrawerNavigator() {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        overlayColor: "transparent",
        drawerStyle: {
          backgroundColor: colors.drawerBg,
          width: 280,
        },
        sceneStyle: {
          backgroundColor: colors.drawerBg,
        },
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="ScanDocument" component={ScanDocumentScreen} />
      <Drawer.Screen name="UploadAudio" component={UploadAudioScreen} />
      <Drawer.Screen name="GapForm" component={GapFormScreen} />
      <Drawer.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Drawer.Screen name="Security" component={SecurityScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} />
      <Drawer.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Drawer.Screen
        name="DocumentProcessing"
        component={DocumentProcessingScreen}
      />
      <Drawer.Screen name="AudioProcessing" component={AudioProcessingScreen} />
      <Drawer.Screen name="History" component={HistoryScreen} />
      <Drawer.Screen name="DocumentViewer" component={DocumentViewerScreen} />
      <Drawer.Screen name="AudioViewer" component={AudioViewerScreen} />
      <Drawer.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
      />
      <Drawer.Screen name="StorageCloud" component={StorageCloudScreen} />
      <Drawer.Screen name="Search" component={SearchScreen} />
      <Drawer.Screen
        name="AccessibilitySettings"
        component={AccessibilitySettingsScreen}
      />
      <Drawer.Screen name="TTSSettings" component={TTSSettingsScreen} />
      <Drawer.Screen name="GapDetail" component={GapDetailScreen} />
      <Drawer.Screen
<<<<<<< HEAD
        name="ComplaintSubmission"
        component={ComplaintSubmissionScreen}
      />
      <Drawer.Screen
        name="ComplaintVerification"
        component={ComplaintVerificationScreen}
=======
        name="GapVerification"
        component={GapVerificationScreen}
>>>>>>> 6a0a424 (Many changes in verification modules.)
      />
    </Drawer.Navigator>
  );
}

// Inner App Component that uses AuthContext (single source of truth for auth state)
function AppContent() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { reduceMotion } = useAccessibility();

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const isLoggedIn = !!user;

  useEffect(() => {
    startOfflineSyncEngine().catch((err) => {
      console.warn("Offline sync engine failed to start:", err?.message || err);
    });
    return () => {
      stopOfflineSyncEngine();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !isAuthLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isAuthLoading]);

  if (!fontsLoaded || isAuthLoading) {
    return null;
  }

  return (
    <NavigationContainer onReady={onLayoutRootView}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? "none" : "default",
        }}
      >
        {isLoggedIn ? (
          // Authenticated user - allow access with role-based data filtering
          <>
            <Stack.Screen name="Main" component={DrawerNavigator} />
            <Stack.Screen name="ClosurePhoto" component={ClosurePhotoScreen} />
          </>
        ) : (
          // User is not authenticated — show onboarding/login flow
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Main App - wraps everything in AuthProvider
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AccessibilityProvider>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </AccessibilityProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
