'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi } from '@/lib/api';
import { Village } from '@/types';
import styles from './page.module.css';

interface RecentGap {
  id: string | number;
  village_name: string;
  gap_type: string;
  status: string;
  created_at: string;
  description: string;
}

interface DashboardData {
  total_gaps: number;
  open_gaps: number;
  in_progress_gaps: number;
  resolved_gaps: number;
  recent_gaps: RecentGap[];
  villages: Village[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, canViewAnalytics } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!canViewAnalytics) {
      setAccessDenied(true);
    }
  }, [authLoading, isAuthenticated, canViewAnalytics, router]);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await dashboardApi.getStats(user?.role, user?.id?.toString());
      setData(response);
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (isAuthenticated && canViewAnalytics) {
      loadDashboard();
    }
  }, [isAuthenticated, canViewAnalytics, loadDashboard]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'resolved';
      case 'in_progress':
        return 'inProgress';
      default:
        return 'pending';
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.mainWrapper}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (accessDenied) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.mainWrapper}>
          <div className={styles.accessDenied}>
            <h2>Access Restricted</h2>
            <p>Dashboard access is limited to Managers and Administrators.</p>
            <Link href="/upload" className="btn btn-primary">
              Go to Upload
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.mainWrapper}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.mainWrapper}>
          <div className={styles.errorContainer}>
            <h3>Dashboard Error</h3>
            <p>{error}</p>
            <button onClick={loadDashboard} className={styles.retryButton}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.mainWrapper}>
        <div className={styles.pageHeader}>
          <h1>Dashboard</h1>
          <p className={styles.pageSubtitle}>
            Welcome back, {user?.username}! Here is an overview of your infrastructure gaps.
          </p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statTitle}>Total Gaps</span>
              <div className={styles.statIcon}>📊</div>
            </div>
            <div className={styles.statValue}>{data?.total_gaps || 0}</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statTitle}>Open Issues</span>
              <div className={styles.statIcon}>⚠️</div>
            </div>
            <div className={styles.statValue}>{data?.open_gaps || 0}</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statTitle}>In Progress</span>
              <div className={styles.statIcon}>🔄</div>
            </div>
            <div className={styles.statValue}>{data?.in_progress_gaps || 0}</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.statTitle}>Resolved</span>
              <div className={styles.statIcon}>✅</div>
            </div>
            <div className={styles.statValue}>{data?.resolved_gaps || 0}</div>
          </div>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.recentActivity}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recent Activity</h2>
              <Link href="/manage-gaps" className={styles.viewAllLink}>
                View All
              </Link>
            </div>

            <div className={styles.activityList}>
              {data?.recent_gaps?.length ? (
                data.recent_gaps.slice(0, 5).map((gap) => (
                  <div key={gap.id} className={styles.activityItem}>
                    <div className={styles.activityHeader}>
                      <span className={styles.activityTitle}>
                        {gap.gap_type.charAt(0).toUpperCase() + gap.gap_type.slice(1)} - {gap.village_name}
                      </span>
                      <span className={`${styles.statusBadge} ${styles[getStatusBadgeClass(gap.status)]}`}>
                        {gap.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className={styles.activityMeta}>
                      {gap.description.length > 60 ? `${gap.description.substring(0, 60)}...` : gap.description}
                    </p>
                    <p className={styles.activityMeta}>{new Date(gap.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              ) : (
                <p className={styles.activityMeta}>No recent activity</p>
              )}
            </div>
          </div>

          <div className={styles.quickActions}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Quick Actions</h3>
            </div>

            <div className={styles.quickActionsList}>
              <Link href="/upload" className={styles.actionButton}>
                <span className={styles.actionIcon}>⬆️</span>
                Upload New Gap
              </Link>

              <Link href="/manage-gaps" className={styles.actionButton}>
                <span className={styles.actionIcon}>📋</span>
                Manage Gaps
              </Link>

              <Link href="/analytics" className={styles.actionButton}>
                <span className={styles.actionIcon}>📈</span>
                View Analytics
              </Link>

              <Link href="/villages" className={styles.actionButton}>
                <span className={styles.actionIcon}>🏘️</span>
                Browse Villages
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
