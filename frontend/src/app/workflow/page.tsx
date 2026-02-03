'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { workflowApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface Complaint {
  id: number;
  gap_description: string;
  village_name: string;
  category: string;
  status: string;
  created_at: string;
  assigned_agent: string | null;
}

interface WorkflowStats {
  total_complaints: number;
  pending_complaints: number;
  assigned_complaints: number;
  resolved_complaints: number;
}

export default function WorkflowDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, filter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [complaintsRes, statsRes] = await Promise.all([
        workflowApi.getComplaints({ status: filter === 'all' ? '' : filter }),
        workflowApi.getStats(),
      ]);
      setComplaints(complaintsRes);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load workflow data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return styles.badgePending;
      case 'assigned':
        return styles.badgeAssigned;
      case 'in_progress':
        return styles.badgeInProgress;
      case 'resolved':
        return styles.badgeResolved;
      default:
        return '';
    }
  };

  if (authLoading || !user) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Workflow Dashboard</h1>
          <p>Manage complaints and assignments</p>
        </div>
        <Link href="/workflow/submit" className={styles.btnSubmit}>
          <span>+</span> Submit Complaint
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats?.total_complaints || 0}</div>
            <div className={styles.statLabel}>Total Complaints</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.pending}`}>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats?.pending_complaints || 0}</div>
            <div className={styles.statLabel}>Pending</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.assigned}`}>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats?.assigned_complaints || 0}</div>
            <div className={styles.statLabel}>Assigned</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.resolved}`}>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats?.resolved_complaints || 0}</div>
            <div className={styles.statLabel}>Resolved</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterContainer}>
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'pending' ? styles.active : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'assigned' ? styles.active : ''}`}
            onClick={() => setFilter('assigned')}
          >
            Assigned
          </button>
          <button
            className={`${styles.filterTab} ${filter === 'resolved' ? styles.active : ''}`}
            onClick={() => setFilter('resolved')}
          >
            Resolved
          </button>
        </div>
        <Link href="/workflow/agents" className={styles.btnAgents}>
          View Agents →
        </Link>
      </div>

      {/* Complaints Table */}
      <div className={styles.tableContainer}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className="spinner"></div>
            <p>Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No complaints found</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Village</th>
                <th>Category</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td>#{complaint.id}</td>
                  <td className={styles.descriptionCell}>
                    {complaint.gap_description?.substring(0, 50)}...
                  </td>
                  <td>{complaint.village_name}</td>
                  <td>{complaint.category}</td>
                  <td>
                    <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                      {complaint.status}
                    </span>
                  </td>
                  <td>{complaint.assigned_agent || '-'}</td>
                  <td>{new Date(complaint.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link href={`/workflow/complaint/${complaint.id}`} className={styles.btnView}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
