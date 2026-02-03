'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { villagesApi } from '@/lib/api';
import { Village, Gap } from '@/types';
import styles from './page.module.css';

interface VillageDetail extends Village {
  gaps: Gap[];
}

export default function VillageDetailPage() {
  const params = useParams();
  const villageId = params.id as string;
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (villageId) {
      loadVillage();
    }
  }, [villageId]);

  const loadVillage = async () => {
    try {
      setIsLoading(true);
      const response = await villagesApi.getById(Number(villageId));
      setVillage(response);
    } catch (err) {
      console.error('Failed to load village:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'high': return styles.severityHigh;
      case 'medium': return styles.severityMedium;
      default: return styles.severityLow;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'resolved': return styles.statusResolved;
      case 'in_progress': return styles.statusProgress;
      default: return styles.statusOpen;
    }
  };

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="main-wrapper">
          <div className="container">
            <div className={styles.loadingContainer}>
              <div className="spinner"></div>
              <p>Loading village details...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!village) {
    return (
      <>
        <Navbar />
        <div className="main-wrapper">
          <div className="container">
            <div className={styles.errorContainer}>
              <p>Village not found</p>
              <Link href="/villages" className="btn btn-primary">
                Back to Villages
              </Link>
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
          <Link href="/villages" className={styles.backLink}>
            ← Back to Villages
          </Link>

          <div className={styles.pageHeader}>
            <div className={styles.villageTitle}>
              <div className={styles.villageIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div>
                <h1>{village.name}</h1>
                <p>{village.district || 'District'}, {village.state || 'State'}</p>
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={`${styles.statCard} ${styles.total}`}>
                <div className={styles.statValue}>{village.total_gaps || 0}</div>
                <div className={styles.statLabel}>Total Gaps</div>
              </div>
              <div className={`${styles.statCard} ${styles.open}`}>
                <div className={styles.statValue}>{village.pending_gaps || 0}</div>
                <div className={styles.statLabel}>Open</div>
              </div>
              <div className={`${styles.statCard} ${styles.progress}`}>
                <div className={styles.statValue}>{village.in_progress_gaps || 0}</div>
                <div className={styles.statLabel}>In Progress</div>
              </div>
              <div className={`${styles.statCard} ${styles.resolved}`}>
                <div className={styles.statValue}>{village.resolved_gaps || 0}</div>
                <div className={styles.statLabel}>Resolved</div>
              </div>
            </div>
          </div>

          {/* Gaps Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Development Gaps</h2>
              <Link href={`/villages/${villageId}/report`} className="btn btn-primary">
                View Full Report
              </Link>
            </div>

            <div className="card">
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Description</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {village.gaps && village.gaps.length > 0 ? (
                      village.gaps.map((gap) => (
                        <tr key={gap.id}>
                          <td><strong>#{gap.id}</strong></td>
                          <td style={{ textTransform: 'capitalize' }}>{gap.gap_type}</td>
                          <td>
                            <span className={`${styles.badge} ${getSeverityBadgeClass(gap.severity)}`}>
                              {gap.severity}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${getStatusBadgeClass(gap.status)}`}>
                              {gap.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className={styles.descriptionCell}>
                            {gap.description?.substring(0, 80)}
                            {gap.description?.length > 80 && '...'}
                          </td>
                          <td>{new Date(gap.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-state">
                          No gaps reported for this village.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
