'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { User, UserRole } from '@/types';
import { authApi } from '@/lib/api';

// Role hierarchy - higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = ['ground', 'manager', 'authority', 'admin'];

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
  canManageBudget: boolean;
  canViewAnalytics: boolean;
  hasRole: (role: UserRole) => boolean;
  hasMinRole: (minRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Prevent double initialization
    if (isInitialized) return;
    setIsInitialized(true);

    // Check for existing auth token
    const token = Cookies.get('authToken');
    if (token) {
      // Validate token and get user info
      authApi.getCurrentUser()
        .then((userData) => {
          setUser(userData);
          // Store user in sessionStorage as backup
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('user', JSON.stringify(userData));
          }
        })
        .catch((error) => {
          console.error('Auth validation failed:', error);
          Cookies.remove('authToken', { path: '/' });
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('user');
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // Try to get user from sessionStorage (in case cookie was cleared)
      if (typeof window !== 'undefined') {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            setUser(userData);
          } catch (e) {
            sessionStorage.removeItem('user');
          }
        }
      }
      setIsLoading(false);
    }
  }, [isInitialized]);

  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password);
      // Set cookie with proper options for persistence across refreshes
      Cookies.set('authToken', response.token, { 
        expires: 7, // 7 days
        path: '/',  // Available across entire site
        sameSite: 'lax', // CSRF protection while allowing normal navigation
      });
      setUser(response.user);
      // Store user in sessionStorage as backup
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('user', JSON.stringify(response.user));
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    Cookies.remove('authToken', { path: '/' });
    setUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('user');
    }
    authApi.logout();
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
  const canResolveGaps = hasMinRole('authority'); // Authority and Admin only
  const canManageBudget = hasMinRole('authority'); // Authority and Admin only
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
        canManageBudget,
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
