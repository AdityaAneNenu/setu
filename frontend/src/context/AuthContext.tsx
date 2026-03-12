'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

// Role hierarchy - higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = ['ground', 'manager', 'admin'];

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  // Permission helpers
  canCreateGaps: boolean;
  canVerifyGaps: boolean;
  canManageGaps: boolean;
  canResolveGaps: boolean;
  canViewAnalytics: boolean;
  hasRole: (role: UserRole) => boolean;
  hasMinRole: (minRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Look up user profile data from Firestore 'users' collection.
 * Falls back to basic Firebase Auth info if no profile exists.
 */
async function getUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  try {
    // Try finding by Firebase UID (document ID)
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      return {
        id: userDocSnap.id,
        username: data.username || firebaseUser.displayName || '',
        email: data.email || firebaseUser.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        role: (data.role as UserRole) || 'ground',
        is_superuser: data.is_superuser || false,
        is_staff: data.is_staff || false,
      };
    }

    // Fallback: find by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', firebaseUser.email));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const data = snap.docs[0].data();
      return {
        id: snap.docs[0].id,
        username: data.username || firebaseUser.displayName || '',
        email: data.email || firebaseUser.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        role: (data.role as UserRole) || 'ground',
        is_superuser: data.is_superuser || false,
        is_staff: data.is_staff || false,
      };
    }
  } catch (err) {
    console.warn('Error fetching user profile from Firestore:', err);
  }

  // Fallback
  return {
    id: 0,
    username: firebaseUser.displayName || firebaseUser.email || '',
    email: firebaseUser.email || '',
    first_name: '',
    last_name: '',
    role: 'ground',
    is_superuser: false,
    is_staff: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser);
        setUser(profile);

        // Store in sessionStorage as backup
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('user', JSON.stringify(profile));
        }
      } else {
        setUser(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Login with email & password via Firebase Auth.
   * The 'username' parameter is treated as email for Firebase Auth.
   * If the username doesn't contain '@', we append a default domain.
   */
  const login = async (username: string, password: string) => {
    const email = username.includes('@') ? username : `${username}@setu.gov.in`;
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged callback will set the user
  };

  const logout = () => {
    signOut(auth);
    setUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
  };

  // Permission helper functions
  const hasRole = (role: UserRole): boolean => {
    return user?.role === role || user?.role === 'admin';
  };

  const hasMinRole = (minRole: UserRole): boolean => {
    if (!user) return false;
    const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role as UserRole);
    const minRoleIndex = ROLE_HIERARCHY.indexOf(minRole);
    if (userRoleIndex === -1 || minRoleIndex === -1) return false;
    return userRoleIndex >= minRoleIndex;
  };

  // Computed permissions based on role
  const canCreateGaps = !!user; // All authenticated users
  const canVerifyGaps = hasMinRole('manager'); // Manager and above
  const canManageGaps = hasMinRole('manager'); // Manager and above (change status)
  const canResolveGaps = hasMinRole('admin'); // Admin only
  const canViewAnalytics = hasMinRole('manager'); // Manager and above

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        canCreateGaps,
        canVerifyGaps,
        canManageGaps,
        canResolveGaps,
        canViewAnalytics,
        hasRole,
        hasMinRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
