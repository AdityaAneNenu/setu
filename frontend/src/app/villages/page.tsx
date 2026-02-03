'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { villagesApi } from '@/lib/api';
import { Village } from '@/types';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function VillagesPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [villages, setVillages] = useState<Village[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadVillages();
    }
  }, [isAuthenticated]);

  const loadVillages = async () => {
    try {
      setIsLoading(true);
      const response = await villagesApi.getAll();
      setVillages(response.villages || response || []);
    } catch (err) {
      console.error('Failed to load villages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalSeverity = (village: Village) => {
    return (village.high_severity || 0) + (village.medium_severity || 0) + (village.low_severity || 0);
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

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="main-wrapper">
          <div className="container">
            <div className={styles.loadingContainer}>
              <div className="spinner"></div>
              <p>Loading villages...</p>
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
            <h1>Villages</h1>
            <p>Overview of all villages under PM-AJAY initiative</p>
          </div>

          <div className={styles.villagesGrid}>
            {villages.length > 0 ? (
              villages.map((village) => (
                <div key={village.id} className={styles.villageCard}>
                  <div className={styles.villageHeader}>
                    <div className={styles.villageIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                    </div>
                    <div className={styles.villageInfo}>
                      <h3 className={styles.villageName}>{village.name}</h3>
                      <p className={styles.villageMeta}>
                        {village.district || 'District'}, {village.state || 'State'}
                      </p>
                    </div>
                  </div>

                  <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{village.total_gaps || 0}</div>
                      <div className={styles.statLabel}>Total</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{village.pending_gaps || 0}</div>
                      <div className={styles.statLabel}>Pending</div>
                    </div>
                    <div className={styles.statItem}>
                      <div className={styles.statValue}>{village.resolved_gaps || 0}</div>
                      <div className={styles.statLabel}>Resolved</div>
                    </div>
                  </div>

                  <div className={styles.statusIndicators}>
                    <div className={`${styles.statusPill} ${styles.open}`}>
                      {village.pending_gaps || 0} Open
                    </div>
                    <div className={`${styles.statusPill} ${styles.progress}`}>
                      {village.in_progress_gaps || 0} In Progress
                    </div>
                    <div className={`${styles.statusPill} ${styles.resolved}`}>
                      {village.resolved_gaps || 0} Resolved
                    </div>
                  </div>

                  <div className={styles.severitySection}>
                    <div className={styles.severityLabel}>Severity Distribution</div>
                    <div className={styles.severityBar}>
                      {(village.high_severity || 0) > 0 && (
                        <div 
                          className={`${styles.severitySegment} ${styles.high}`}
                          style={{ 
                            flex: village.high_severity || 0,
                          }}
                        />
                      )}
                      {(village.medium_severity || 0) > 0 && (
                        <div 
                          className={`${styles.severitySegment} ${styles.medium}`}
                          style={{ 
                            flex: village.medium_severity || 0,
                          }}
                        />
                      )}
                      {(village.low_severity || 0) > 0 && (
                        <div 
                          className={`${styles.severitySegment} ${styles.low}`}
                          style={{ 
                            flex: village.low_severity || 0,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <div className={styles.villageActions}>
                    <Link 
                      href={`/villages/${village.id}`} 
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      View Details
                    </Link>
                    <Link 
                      href={`/villages/${village.id}/report`} 
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      View Report
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-state-title">No Villages Found</div>
                <div className="empty-state-text">
                  Villages will appear here once they are added to the system.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
