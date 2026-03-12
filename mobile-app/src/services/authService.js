// Firebase Authentication Service for SETU Mobile App
// ====================================================

import { auth } from '../config/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { usersService } from './firestore';

// Login with email and password
export const loginUser = async (emailInput, password) => {
  try {
    // Auto-append domain if user enters just a username
    const email = emailInput.includes('@') ? emailInput : `${emailInput}@setu.gov.in`;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Get user profile from Firestore
    const profile = await usersService.getProfile(firebaseUser.uid);

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      ...profile,
    };
  } catch (error) {
    let message = 'Login failed';
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'No account found with this email';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/invalid-email':
        message = 'Invalid email address';
        break;
      case 'auth/invalid-credential':
        message = 'Invalid email or password';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Try again later.';
        break;
      default:
        message = error.message;
    }
    throw new Error(message);
  }
};

// Logout
export const logoutUser = async () => {
  await signOut(auth);
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Listen for auth state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const profile = await usersService.getProfile(firebaseUser.uid);
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          ...profile,
        });
      } catch (error) {
        console.warn('Failed to fetch user profile, using basic auth info:', error.message);
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: 'ground',
        });
      }
    } else {
      callback(null);
    }
  });
};
