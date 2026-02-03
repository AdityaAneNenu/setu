'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { publicApi } from '@/lib/api';
import styles from './page.module.css';

// Import Map dynamically to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import('@/components/Map/MapComponent'), { 
  ssr: false,
  loading: () => <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: '16px' }}>Loading map...</div>
});

interface PublicData {
  total_gaps: number;
  pending_gaps: number;
  in_progress_gaps: number;
  resolved_gaps: number;
  resolution_rate: number;
  total_budget: number;
  spent_budget: number;
  villages: any[];
  gap_types: Record<string, number>;
  recent_gaps: any[];
}

const gapTypeLabels: Record<string, string> = {
  water: 'Water Supply',
  road: 'Road Infrastructure',
  sanitation: 'Sanitation',
  electricity: 'Electricity',
  education: 'Education',
  health: 'Healthcare',
  housing: 'Housing',
  agriculture: 'Agriculture',
  connectivity: 'Connectivity',
  employment: 'Employment',
  community_center: 'Community Center',
  drainage: 'Drainage',
  other: 'Other',
};

export default function PublicDashboardPage() {
  const [data, setData] = useState<PublicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    village: '',
    status: '',
    gap_type: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const response = await publicApi.getDashboard(filters);
      setData(response);
    } catch (err) {
      console.error('Failed to load public dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    loadData();
  };

  const resetFilters = () => {
    setFilters({ village: '', status: '', gap_type: '' });
  };

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <h1>Development Progress Dashboard</h1>
            <p>PM Adarsh Gram Yojana - Public View</p>
          </div>
          <Link href="/" className={styles.backBtn}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <div className={styles.container}>
        {/* Filters */}
        <div className={styles.filtersContainer}>
          <h3 className={styles.filtersTitle}>
            Filter Data
          </h3>
          <div className={styles.filtersGrid}>
            <div className={styles.filterGroup}>
              <label>Village</label>
              <select
                value={filters.village}
                onChange={(e) => handleFilterChange('village', e.target.value)}
              >
                <option value="">All Villages</option>
                {data?.villages?.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label>Gap Type</label>
              <select
                value={filters.gap_type}
                onChange={(e) => handleFilterChange('gap_type', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="water">Water</option>
                <option value="road">Road</option>
                <option value="sanitation">Sanitation</option>
                <option value="electricity">Electricity</option>
                <option value="education">Education</option>
                <option value="health">Health</option>
              </select>
            </div>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.btnApply} onClick={applyFilters}>
              Apply Filters
            </button>
            <button className={styles.btnReset} onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Statistics */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statInfo}>
                  <div className={styles.statValue}>{data?.total_gaps || 0}</div>
                  <div className={styles.statLabel}>Total Issues</div>
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.pending}`}>
                <div className={styles.statInfo}>
                  <div className={styles.statValue}>{data?.pending_gaps || 0}</div>
                  <div className={styles.statLabel}>Pending</div>
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.progress}`}>
                <div className={styles.statInfo}>
                  <div className={styles.statValue}>{data?.in_progress_gaps || 0}</div>
                  <div className={styles.statLabel}>In Progress</div>
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.resolved}`}>
                <div className={styles.statInfo}>
                  <div className={styles.statValue}>{data?.resolved_gaps || 0}</div>
                  <div className={styles.statLabel}>Resolved</div>
                </div>
              </div>
            </div>

            {/* Gap Types Distribution */}
            <div className={styles.chartSection}>
              <h3>Issues by Category</h3>
              <div className={styles.categoryGrid}>
                {data?.gap_types && Object.entries(data.gap_types).map(([type, count]) => (
                  <div key={type} className={styles.categoryCard}>
                    <div className={styles.categoryInfo}>
                      <div className={styles.categoryValue}>{count}</div>
                      <div className={styles.categoryLabel}>{gapTypeLabels[type] || type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map Section */}
            <div className={styles.chartSection}>
              <h3>Project Locations Map</h3>
              <p className={styles.mapSubtitle}>
                Black circles indicate PM-AJAY operational states. Red markers show active projects.
              </p>
              <MapComponent projects={[]} height="500px" />
            </div>

            {/* Villages Summary */}
            <div className={styles.chartSection}>
              <h3>Villages Overview</h3>
              <div className={styles.villagesTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Village</th>
                      <th>Total</th>
                      <th>Pending</th>
                      <th>In Progress</th>
                      <th>Resolved</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.villages?.map((village: any) => (
                      <tr key={village.id}>
                        <td><strong>{village.name}</strong></td>
                        <td>{village.total_gaps || 0}</td>
                        <td>{village.pending_gaps || 0}</td>
                        <td>{village.in_progress_gaps || 0}</td>
                        <td>{village.resolved_gaps || 0}</td>
                        <td>
                          <div className={styles.progressBar}>
                            <div 
                              className={styles.progressFill}
                              style={{ 
                                width: `${village.total_gaps > 0 ? (village.resolved_gaps / village.total_gaps) * 100 : 0}%` 
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2024 SETU - PM Adarsh Gram Yojana | Government of India</p>
      </footer>
    </div>
  );
}
