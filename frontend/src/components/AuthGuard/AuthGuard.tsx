'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  minRole?: UserRole;
}

const ROLE_HIERARCHY: UserRole[] = ['ground', 'manager', 'authority', 'admin'];

export default function AuthGuard({ children, requiredRole, minRole }: AuthGuardProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
      }}>
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Not authenticated - will redirect
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check role if required
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <span style={{ fontSize: '4rem' }}>🚫</span>
        <h2>Access Denied</h2>
        <p>You need <strong>{requiredRole}</strong> role to access this page.</p>
        <p>Your current role: <strong>{user.role}</strong></p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="btn btn-primary"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Check minimum role if specified
  if (minRole) {
    const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role as UserRole);
    const minRoleIndex = ROLE_HIERARCHY.indexOf(minRole);
    
    if (userRoleIndex < minRoleIndex && user.role !== 'admin') {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '1rem',
          textAlign: 'center',
          padding: '2rem',
        }}>
          <span style={{ fontSize: '4rem' }}>🚫</span>
          <h2>Access Denied</h2>
          <p>You need at least <strong>{minRole}</strong> role to access this page.</p>
          <p>Your current role: <strong>{user.role}</strong></p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="btn btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
}
