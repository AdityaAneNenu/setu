'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { budgetApi, villagesApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface BudgetItem {
  id: number;
  village_name: string;
  category: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  fiscal_year: string;
  status: string;
}

interface BudgetSummary {
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  utilization_percentage: number;
}

export default function BudgetManagementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, canManageBudget } = useAuth();
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [filter, setFilter] = useState({
    category: '',
    village: '',
    year: '2024',
  });

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!canManageBudget) {
        setAccessDenied(true);
      }
    }
  }, [authLoading, isAuthenticated, canManageBudget, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, filter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [itemsRes, summaryRes] = await Promise.all([
        budgetApi.getBudgets(filter),
        budgetApi.getSummary(filter),
      ]);
      setBudgetItems(itemsRes);
      setSummary(summaryRes);
    } catch (err) {
      console.error('Failed to load budget data:', err);
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

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'under_budget':
        return styles.badgeSuccess;
      case 'on_track':
        return styles.badgeInfo;
      case 'over_budget':
        return styles.badgeDanger;
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
          <h1>Budget Management</h1>
          <p>Track and manage allocations and expenditures</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>

          <div className={styles.summaryInfo}>
            <div className={styles.summaryValue}>
              {formatCurrency(summary?.total_allocated || 0)}
            </div>
            <div className={styles.summaryLabel}>Total Allocated</div>
          </div>
        </div>
        <div className={`${styles.summaryCard} ${styles.spent}`}>

          <div className={styles.summaryInfo}>
            <div className={styles.summaryValue}>
              {formatCurrency(summary?.total_spent || 0)}
            </div>
            <div className={styles.summaryLabel}>Total Spent</div>
          </div>
        </div>
        <div className={`${styles.summaryCard} ${styles.remaining}`}>

          <div className={styles.summaryInfo}>
            <div className={styles.summaryValue}>
              {formatCurrency(summary?.total_remaining || 0)}
            </div>
            <div className={styles.summaryLabel}>Remaining</div>
          </div>
        </div>
        <div className={`${styles.summaryCard} ${styles.utilization}`}>

          <div className={styles.summaryInfo}>
            <div className={styles.summaryValue}>
              {(summary?.utilization_percentage || 0).toFixed(1)}%
            </div>
            <div className={styles.summaryLabel}>Utilization</div>
          </div>
          <div className={styles.progressRing}>
            <svg viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(139, 92, 246, 0.2)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeDasharray={`${summary?.utilization_percentage || 0}, 100`}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <label>Category</label>
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          >
            <option value="">All Categories</option>
            <option value="water">Water</option>
            <option value="road">Road</option>
            <option value="sanitation">Sanitation</option>
            <option value="electricity">Electricity</option>
            <option value="education">Education</option>
            <option value="health">Health</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>Fiscal Year</label>
          <select
            value={filter.year}
            onChange={(e) => setFilter({ ...filter, year: e.target.value })}
          >
            <option value="2024">2024-25</option>
            <option value="2023">2023-24</option>
            <option value="2022">2022-23</option>
          </select>
        </div>
      </div>

      {/* Budget Table */}
      <div className={styles.tableContainer}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className="spinner"></div>
            <p>Loading budget data...</p>
          </div>
        ) : budgetItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No budget data found</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Village</th>
                <th>Category</th>
                <th>Allocated</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>Utilization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {budgetItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.village_name}</strong>
                  </td>
                  <td>
                    <span className={styles.categoryTag}>{item.category}</span>
                  </td>
                  <td>{formatCurrency(item.allocated_amount)}</td>
                  <td>{formatCurrency(item.spent_amount)}</td>
                  <td>{formatCurrency(item.remaining_amount)}</td>
                  <td>
                    <div className={styles.utilizationBar}>
                      <div
                        className={styles.utilizationFill}
                        style={{
                          width: `${Math.min(
                            (item.spent_amount / item.allocated_amount) * 100,
                            100
                          )}%`,
                        }}
                      />
                      <span>
                        {((item.spent_amount / item.allocated_amount) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${getStatusBadgeClass(item.status)}`}
                    >
                      {item.status?.replace('_', ' ')}
                    </span>
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
