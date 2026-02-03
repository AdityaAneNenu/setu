'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { villagesApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface VillageReport {
  id: number;
  name: string;
  district: string;
  state: string;
  total_gaps: number;
  pending_gaps: number;
  in_progress_gaps: number;
  resolved_gaps: number;
  completion_rate: number;
  total_budget: number;
  spent_budget: number;
  gaps_by_type: Record<string, number>;
  monthly_progress: Array<{ month: string; resolved: number; new: number }>;
  priority_gaps: any[];
}

export default function VillageReportPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [report, setReport] = useState<VillageReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user && id) {
      loadReport();
    }
  }, [user, id]);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const response = await villagesApi.getReport(id);
      setReport(response);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const printReport = () => {
    window.print();
  };

  if (authLoading || !user) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Generating report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span></span>
          <h3>Report Not Available</h3>
          <Link href="/villages" className={styles.btnBack}>Go Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href={`/villages/${id}`} className={styles.backBtn}>
            ← Back to Village
          </Link>
          <h1>Village Progress Report</h1>
          <p>{report.name}, {report.district}</p>
        </div>
        <button className={styles.printBtn} onClick={printReport}>
          Print Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{report.total_gaps}</div>
          <div className={styles.summaryLabel}>Total Gaps</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.pending}`}>
          <div className={styles.summaryValue}>{report.pending_gaps}</div>
          <div className={styles.summaryLabel}>Pending</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.progress}`}>
          <div className={styles.summaryValue}>{report.in_progress_gaps}</div>
          <div className={styles.summaryLabel}>In Progress</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.resolved}`}>
          <div className={styles.summaryValue}>{report.resolved_gaps}</div>
          <div className={styles.summaryLabel}>Resolved</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.completion}`}>
          <div className={styles.summaryValue}>{(report.completion_rate || 0).toFixed(1)}%</div>
          <div className={styles.summaryLabel}>Completion</div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Gap Type Distribution */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Gaps by Category</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.categoryList}>
              {report.gaps_by_type && Object.entries(report.gaps_by_type).map(([type, count]) => (
                <div key={type} className={styles.categoryItem}>
                  <div className={styles.categoryInfo}>
                    <span className={styles.categoryIcon}>
                      {type === 'water' && ''}
                      {type === 'road' && ''}
                      {type === 'sanitation' && ''}
                      {type === 'electricity' && ''}
                      {type === 'education' && ''}
                      {type === 'health' && ''}
                    </span>
                    <span className={styles.categoryName}>{type}</span>
                  </div>
                  <div className={styles.categoryBar}>
                    <div
                      className={styles.categoryFill}
                      style={{
                        width: `${Math.min((count / report.total_gaps) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className={styles.categoryCount}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Budget Overview */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Budget Overview</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.budgetStats}>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}>Total Allocated</span>
                <span className={styles.budgetValue}>
                  {formatCurrency(report.total_budget)}
                </span>
              </div>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}>Amount Spent</span>
                <span className={styles.budgetValue}>
                  {formatCurrency(report.spent_budget)}
                </span>
              </div>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}>Remaining</span>
                <span className={styles.budgetValue}>
                  {formatCurrency((report.total_budget || 0) - (report.spent_budget || 0))}
                </span>
              </div>
            </div>
            <div className={styles.utilizationProgress}>
              <div className={styles.utilizationHeader}>
                <span>Budget Utilization</span>
                <span>
                  {report.total_budget > 0
                    ? ((report.spent_budget / report.total_budget) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className={styles.utilizationBar}>
                <div
                  className={styles.utilizationFill}
                  style={{
                    width: `${
                      report.total_budget > 0
                        ? Math.min((report.spent_budget / report.total_budget) * 100, 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Priority Gaps */}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <div className={styles.cardHeader}>
            <h3>Priority Gaps</h3>
          </div>
          <div className={styles.cardBody}>
            {report.priority_gaps && report.priority_gaps.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.priority_gaps.slice(0, 5).map((gap: any) => (
                    <tr key={gap.id}>
                      <td>#{gap.id}</td>
                      <td>{gap.gap_description?.substring(0, 50)}...</td>
                      <td>{gap.gap_type}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[gap.severity || 'medium']}`}>
                          {gap.severity}
                        </span>
                      </td>
                      <td>{gap.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <p>No priority gaps found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <p>Report generated on {new Date().toLocaleDateString()}</p>
        <p>PM Adarsh Gram Yojana - SETU System</p>
      </div>
    </div>
  );
}
