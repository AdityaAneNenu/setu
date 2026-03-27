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

// Resolve Expo config across Expo Go / dev builds / EAS builds.
const resolvedExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest?.extra ||
  Constants.manifest2?.extra ||
  {};

// Fallback values keep dev/client builds from crashing if Expo resolves fallback app config.
// These are non-secret Firebase client identifiers and match app.json values.
const fallbackFirebase = {
  firebaseApiKey: 'AIzaSyB9-QbV4n5eJWBXuQUvXenbAegT2NlF5Ps',
  firebaseAuthDomain: 'setu-pm.firebaseapp.com',
  firebaseProjectId: 'setu-pm',
  firebaseStorageBucket: 'setu-pm.firebasestorage.app',
  firebaseMessagingSenderId: '144967126794',
  firebaseAppId: '1:144967126794:web:96553929a14b125e12b4f3',
  firebaseMeasurementId: 'G-LVK997NFHH',
};

const cfg = { ...fallbackFirebase, ...resolvedExtra };

const firebaseConfig = {
  apiKey: cfg.firebaseApiKey,
  authDomain: cfg.firebaseAuthDomain,
  projectId: cfg.firebaseProjectId,
  storageBucket: cfg.firebaseStorageBucket,
  messagingSenderId: cfg.firebaseMessagingSenderId,
  appId: cfg.firebaseAppId,
  measurementId: cfg.firebaseMeasurementId,
};

// Validate configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Firebase configuration missing. Check app config and EAS extra values.');
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
