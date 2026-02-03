'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi } from '@/lib/api';
import { Gap, Village, DashboardStats } from '@/types';
import styles from './page.module.css';

interface DashboardData {
  total_gaps: number;
  open_gaps: number;
  in_progress_gaps: number;
  resolved_gaps: number;
  recent_gaps: Gap[];
  villages: Village[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
    }
  }, [isAuthenticated]);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const response = await dashboardApi.getStats();
      setData(response);
    } catch (err: any) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'high': return 'badge-danger';
      case 'medium': return 'badge-warning';
      default: return 'badge-info';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'resolved': return 'badge-success';
      case 'in_progress': return 'badge-warning';
      default: return 'badge-info';
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="main-wrapper">
        <div className="container">
          <div className={styles.loadingContainer}>
            <div className="spinner"></div>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="main-wrapper">
          <div className="container">
            <div className={styles.loadingContainer}>
              <div className="spinner"></div>
              <p>Loading dashboard...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="main-wrapper">
          <div className="container">
            <div className={styles.errorContainer}>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={loadDashboard}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="main-wrapper">
        <div className="container">
          <div className="page-header">
            <h1>Dashboard</h1>
            <p>Overview of village development gaps and progress tracking</p>
          </div>

          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Gaps</div>
              <div className="stat-value">{data?.total_gaps || 0}</div>
              <p className="stat-subtitle">Across all villages</p>
            </div>

            <div className="stat-card">
              <div className="stat-label">Open</div>
              <div className="stat-value">{data?.open_gaps || 0}</div>
              <p className="stat-subtitle">Awaiting action</p>
            </div>

            <div className="stat-card">
              <div className="stat-label">In Progress</div>
              <div className="stat-value">{data?.in_progress_gaps || 0}</div>
              <p className="stat-subtitle">Currently working</p>
            </div>

            <div className="stat-card">
              <div className="stat-label">Resolved</div>
              <div className="stat-value">{data?.resolved_gaps || 0}</div>
              <p className="stat-subtitle">Successfully completed</p>
            </div>
          </div>

          {/* Recent Gaps */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Gaps</h2>
              <Link href="/manage-gaps" className="btn btn-secondary btn-sm">
                View All
              </Link>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Village</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recent_gaps && data.recent_gaps.length > 0 ? (
                    data.recent_gaps.map((gap) => (
                      <tr key={gap.id}>
                        <td><strong>#{gap.id}</strong></td>
                        <td>{gap.village?.name || 'N/A'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{gap.gap_type}</td>
                        <td>
                          <span className={`badge ${getSeverityBadgeClass(gap.severity)}`}>
                            {gap.severity}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(gap.status)}`}>
                            {gap.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>{new Date(gap.created_at).toLocaleDateString()}</td>
                        <td>
                          <Link href="/manage-gaps" className="btn btn-secondary btn-sm">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        No gaps found. Upload data to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Villages Overview */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Villages</h2>
              <Link href="/villages" className="btn btn-secondary btn-sm">
                View All
              </Link>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Village Name</th>
                    <th>Total Gaps</th>
                    <th>Open</th>
                    <th>In Progress</th>
                    <th>Resolved</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.villages && data.villages.length > 0 ? (
                    data.villages.map((village) => (
                      <tr key={village.id}>
                        <td><strong>{village.name}</strong></td>
                        <td>{village.total_gaps || 0}</td>
                        <td>{village.pending_gaps || 0}</td>
                        <td>{village.in_progress_gaps || 0}</td>
                        <td>{village.resolved_gaps || 0}</td>
                        <td>
                          <Link 
                            href={`/villages/${village.id}`} 
                            className="btn btn-secondary btn-sm"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        No villages found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
