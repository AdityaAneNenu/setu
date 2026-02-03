'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated, canManageBudget, canViewAnalytics } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  // All authenticated users can see these
  const baseItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/upload', label: 'Upload' },
    { href: '/manage-gaps', label: 'Manage Gaps' },
    { href: '/villages', label: 'Villages' },
  ];

  // Build nav items based on role
  const navItems = [
    ...baseItems,
    // Only show analytics for manager and above
    ...(canViewAnalytics ? [{ href: '/analytics', label: 'Analytics' }] : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className={styles.topNav}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.navBrand}>
          <div className={styles.navLogo}>
            <img 
              src={theme === 'dark' ? '/images/dark-mode.png' : '/images/light-mode.png'} 
              alt="SETU Logo" 
            />
          </div>
          <div className={styles.navBrandText}>
            <h1>SETU</h1>
            <p>Village Development Tracker</p>
          </div>
        </Link>

        {isAuthenticated && (
          <button className={styles.menuToggle} onClick={() => setMenuOpen(!menuOpen)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
        )}

        {isAuthenticated && (
          <ul className={`${styles.navMenu} ${menuOpen ? styles.active : ''}`}>
            {navItems.map((item) => (
              <li key={item.href} className={styles.navItem}>
                <Link 
                  href={item.href} 
                  className={isActive(item.href) ? styles.active : ''}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.navUser}>
          <button 
            className={styles.themeToggle} 
            onClick={toggleTheme}
            title="Toggle light/dark mode"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          {isAuthenticated && user ? (
            <>
              <div className={styles.userInfo}>
                <div className={styles.userAvatar}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className={styles.userDetails}>
                  <span className={styles.userName}>{user.username}</span>
                  <span className={`${styles.userRole} ${styles[`role_${user.role}`]}`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button className={`btn btn-secondary ${styles.logoutBtn}`} onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className={`btn btn-primary ${styles.loginBtn}`}>
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
