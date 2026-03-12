// Firebase Configuration for SETU Mobile App
// ============================================
// 
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use existing)
// 3. Click "Add App" → choose Web (</>)
// 4. Copy the config values below
// 5. Enable Firestore Database in Firebase Console
// 6. Enable Authentication → Email/Password in Firebase Console
// Note: File uploads now use Cloudinary - no Firebase Storage needed

import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// Firebase Storage removed — using Cloudinary (free) for file uploads
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ✅ SECURITY: All credentials loaded from environment variables only
// Configure in EAS Build secrets for production
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
  measurementId: Constants.expoConfig?.extra?.firebaseMeasurementId,
};

// Validate configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Firebase configuration missing. Please set environment variables for production.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence (stays logged in)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };
export default app;
