'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { analyticsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface AnalyticsData {
  total_gaps: number;
  status_distribution: {
    open: number;
    in_progress: number;
    resolved: number;
  };
  severity_distribution: {
    high: number;
    medium: number;
    low: number;
  };
  gaps_by_type: Array<{ gap_type: string; count: number }>;
  village_gaps: Array<{
    id: number;
    name: string;
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
  }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, canViewAnalytics, user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Check authentication and permissions
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!canViewAnalytics) {
        setAccessDenied(true);
      }
    }
  }, [authLoading, isAuthenticated, canViewAnalytics, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAnalytics();
    }
  }, [isAuthenticated]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await analyticsApi.getData();
      setData(response);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getBarWidth = (value: number, max: number) => {
    return max > 0 ? (value / max) * 100 : 0;
  };

  const gapTypeColors: Record<string, string> = {
    water: 'water',
    road: 'road',
    sanitation: 'sanitation',
    electricity: 'electricity',
    education: 'education',
    health: 'health',
  };

  const gapTypeLabels: Record<string, string> = {
    water: 'Water Supply',
    road: 'Road Infrastructure',
    sanitation: 'Sanitation',
    electricity: 'Electricity',
    education: 'Education',
    health: 'Healthcare',
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="main-wrapper">
        <div className="container">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '1rem' }}>
            <div className="spinner"></div>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Show access denied if user doesn't have permission
  if (accessDenied) {
    return (
      <>
        <Navbar />
        <div className="main-wrapper">
          <div className="container">
            <div style={{ textAlign: 'center', padding: '100px 20px' }}>
              <h2>Access Denied</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>
                You need Manager role or higher to view Analytics.
              </p>
              <p style={{ color: 'var(--text-muted)', marginTop: '5px' }}>
                Your current role: <strong>{user?.role}</strong>
              </p>
              <button 
                onClick={() => router.push('/dashboard')} 
                className="btn btn-primary"
                style={{ marginTop: '30px' }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="main-wrapper">
          <div className="container">
            <div className={styles.loadingContainer}>
              <div className="spinner"></div>
              <p>Loading analytics...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const maxGapTypeValue = data?.gaps_by_type 
    ? Math.max(...data.gaps_by_type.map(item => item.count)) 
    : 0;

  return (
    <>
      <Navbar />
      <div className="main-wrapper">
        <div className="container">
          <div className="page-header">
            <h1>Analytics</h1>
            <p>Visual insights into village development progress</p>
          </div>

          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Gaps</div>
              <div className="stat-value">{data?.total_gaps || 0}</div>
              <p className="stat-subtitle">All reported gaps</p>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open</div>
              <div className="stat-value">{data?.status_distribution?.open || 0}</div>
              <p className="stat-subtitle">Awaiting action</p>
            </div>
            <div className="stat-card">
              <div className="stat-label">In Progress</div>
              <div className="stat-value">{data?.status_distribution?.in_progress || 0}</div>
              <p className="stat-subtitle">Currently working</p>
            </div>
            <div className="stat-card">
              <div className="stat-label">Resolved</div>
              <div className="stat-value">{data?.status_distribution?.resolved || 0}</div>
              <p className="stat-subtitle">Completed</p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className={styles.chartsGrid}>
            {/* Gap Types Chart */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Gaps by Type</h3>
              </div>
              <div className={styles.barChart}>
                {data?.gaps_by_type && data.gaps_by_type.map((item) => (
                  <div key={item.gap_type} className={styles.barItem}>
                    <span className={styles.barLabel}>
                      {gapTypeLabels[item.gap_type] || item.gap_type}
                    </span>
                    <div className={styles.barContainer}>
                      <div 
                        className={`${styles.barFill} ${styles[gapTypeColors[item.gap_type] || 'water']}`}
                        style={{ width: `${getBarWidth(item.count, maxGapTypeValue)}%` }}
                      >
                        {item.count}
                      </div>
                    </div>
                    <div className={styles.tooltip}>
                      <div className={styles.tooltipTitle}>{gapTypeLabels[item.gap_type] || item.gap_type}</div>
                      <div className={styles.tooltipText}>{item.count} gaps reported</div>
                    </div>
                  </div>
                ))}
                {(!data?.gaps_by_type || data.gaps_by_type.length === 0) && (
                  <div className="empty-state">No data available</div>
                )}
              </div>
            </div>

            {/* Severity Distribution */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Severity Distribution</h3>
              </div>
              <div className={styles.severityChart}>
                {data?.severity_distribution && (
                  <>
                    <div className={styles.severityItem}>
                      <div className={styles.severityLabel}>High</div>
                      <div className={styles.severityBar}>
                        <div 
                          className={`${styles.severityFill} ${styles.high}`}
                          style={{ 
                            width: `${(data.severity_distribution.high || 0) / (data.total_gaps || 1) * 100}%` 
                          }}
                        />
                      </div>
                      <div className={styles.severityValue}>{data.severity_distribution.high || 0}</div>
                    </div>
                    <div className={styles.severityItem}>
                      <div className={styles.severityLabel}>Medium</div>
                      <div className={styles.severityBar}>
                        <div 
                          className={`${styles.severityFill} ${styles.medium}`}
                          style={{ 
                            width: `${(data.severity_distribution.medium || 0) / (data.total_gaps || 1) * 100}%` 
                          }}
                        />
                      </div>
                      <div className={styles.severityValue}>{data.severity_distribution.medium || 0}</div>
                    </div>
                    <div className={styles.severityItem}>
                      <div className={styles.severityLabel}>Low</div>
                      <div className={styles.severityBar}>
                        <div 
                          className={`${styles.severityFill} ${styles.low}`}
                          style={{ 
                            width: `${(data.severity_distribution.low || 0) / (data.total_gaps || 1) * 100}%` 
                          }}
                        />
                      </div>
                      <div className={styles.severityValue}>{data.severity_distribution.low || 0}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Status Overview</h3>
              </div>
              <div className={styles.statusGrid}>
                <div className={`${styles.statusCard} ${styles.statusOpen}`}>
                  <div className={styles.statusValue}>{data?.status_distribution?.open || 0}</div>
                  <div className={styles.statusLabel}>Open</div>
                </div>
                <div className={`${styles.statusCard} ${styles.statusProgress}`}>
                  <div className={styles.statusValue}>{data?.status_distribution?.in_progress || 0}</div>
                  <div className={styles.statusLabel}>In Progress</div>
                </div>
                <div className={`${styles.statusCard} ${styles.statusResolved}`}>
                  <div className={styles.statusValue}>{data?.status_distribution?.resolved || 0}</div>
                  <div className={styles.statusLabel}>Resolved</div>
                </div>
              </div>
            </div>

            {/* Completion Rate */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Resolution Rate</h3>
              </div>
              <div className={styles.completionChart}>
                <div className={styles.completionRing}>
                  <svg viewBox="0 0 100 100">
                    <circle
                      className={styles.ringBg}
                      cx="50"
                      cy="50"
                      r="40"
                    />
                    <circle
                      className={styles.ringFill}
                      cx="50"
                      cy="50"
                      r="40"
                      style={{
                        strokeDasharray: `${((data?.status_distribution?.resolved || 0) / (data?.total_gaps || 1)) * 251.2} 251.2`
                      }}
                    />
                  </svg>
                  <div className={styles.completionValue}>
                    {data?.total_gaps 
                      ? Math.round(((data.status_distribution?.resolved || 0) / data.total_gaps) * 100) 
                      : 0}%
                  </div>
                </div>
                <p className={styles.completionText}>
                  {data?.status_distribution?.resolved || 0} of {data?.total_gaps || 0} gaps resolved
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
