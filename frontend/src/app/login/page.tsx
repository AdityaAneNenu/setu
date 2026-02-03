'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.container}>
        {/* Info Panel */}
        <div className={styles.infoPanel}>
          <div className={styles.logoSection}>
            <img src="/images/dark-mode.png" alt="SETU Logo" />
          </div>
          <div className={styles.infoContent}>
            <p>
              SETU - Satellite Enabled Tracking Utility for PM-AJAY villages. 
              Monitor and track development gaps in Adarsh Gram Yojana villages.
            </p>
            <div className={styles.features}>
              <div className={styles.featureItem}>
                <span className={styles.featureText}>
                  <strong>Real-time Analytics</strong> - Track village development progress
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureText}>
                  <strong>Voice Input</strong> - Submit issues in your language
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureText}>
                  <strong>Mobile Ready</strong> - Access from any device
                </span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureText}>
                  <strong>Secure</strong> - Role-based access control
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Login Panel */}
        <div className={styles.loginPanel}>
          <div className={styles.loginHeader}>
            <h2>Welcome Back</h2>
            <p>Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <button 
              type="submit" 
              className={styles.submitBtn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner}></span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className={styles.loginFooter}>
            <p>Government of India Initiative</p>
            <p>PM Adarsh Gram Yojana</p>
          </div>
        </div>
      </div>
    </div>
  );
}
