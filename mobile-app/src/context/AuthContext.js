// AuthContext for SETU Mobile App
// =================================
// Stores user role and provides role-based data access
// 
// ROLE-BASED ACCESS CONTROL:
// - Ground workers: Only see gaps THEY submitted
// - Managers: See ALL gaps (to manage the system)
// - Admins: See ALL gaps (full system access)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

// Role constants
export const ROLES = {
  GROUND: 'ground',
  MANAGER: 'manager',
  ADMIN: 'admin',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authApi.onAuthStateChange((userData) => {
      if (userData) {
        setUser(userData);
        const role = userData.role || ROLES.GROUND;
        setUserRole(role);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Check if user is a ground worker (for role-based filtering)
  const isGroundWorker = userRole === ROLES.GROUND;

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        isLoading,
        isGroundWorker,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

// Alias for convenience
export const useAuth = useAuthContext;

export default AuthContext;
