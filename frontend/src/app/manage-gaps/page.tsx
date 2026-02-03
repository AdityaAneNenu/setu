'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import { gapsApi, villagesApi } from '@/lib/api';
import { Gap, Village } from '@/types';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function ManageGapsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, canManageGaps, canResolveGaps, canVerifyGaps } = useAuth();
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filters, setFilters] = useState({
    village: '',
    status: '',
    severity: '',
    gap_type: '',
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [gapsResponse, villagesResponse] = await Promise.all([
        gapsApi.getAll(filters),
        villagesApi.getAll(),
      ]);
      setGaps(gapsResponse.gaps || gapsResponse || []);
      setVillages(villagesResponse.villages || villagesResponse || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setErrorMessage('Failed to load gaps data');
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

  const handleStatusChange = async (gapId: number, newStatus: string, hasAudioFile: boolean) => {
    // If trying to resolve a voice gap, redirect to voice verification
    if (newStatus === 'resolved' && hasAudioFile) {
      router.push(`/voice-verification/${gapId}`);
      return;
    }

    // Check permissions
    if (newStatus === 'resolved' && !canResolveGaps) {
      setErrorMessage('Only Authority or Admin can mark gaps as resolved');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    if (!canManageGaps) {
      setErrorMessage('You do not have permission to change gap status');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    
    try {
      await gapsApi.updateStatus(gapId, newStatus);
      setGaps(prev => 
        prev.map(gap => 
          gap.id === gapId ? { ...gap, status: newStatus as Gap['status'] } : gap
        )
      );
      setSuccessMessage(`Gap #${gapId} status updated to ${newStatus.replace('_', ' ')}`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Failed to update status:', err);
      setErrorMessage('Failed to update status. Check your permissions.');
      setTimeout(() => setErrorMessage(''), 5000);
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

  const getInputMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'image': return styles.methodImage;
      case 'voice': return styles.methodVoice;
      default: return styles.methodText;
    }
  };

  const getInputMethodIcon = (method: string) => {
    switch (method) {
      case 'image': return '📷';
      case 'voice': return '🎤';
      default: return '📝';
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

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="main-wrapper">
        <div className="container">
          {/* Messages */}
          {successMessage && (
            <div className={styles.successMessage}>
              ✓ {successMessage}
              <button onClick={() => setSuccessMessage('')}>×</button>
            </div>
          )}
          {errorMessage && (
            <div className={styles.errorMessage}>
              ⚠ {errorMessage}
              <button onClick={() => setErrorMessage('')}>×</button>
            </div>
          )}

          <div className={styles.pageHeader}>
            <h1>Manage Infrastructure Gaps</h1>
            <div className={styles.filterGroup}>
              <select
                className={styles.filterSelect}
                value={filters.village}
                onChange={(e) => handleFilterChange('village', e.target.value)}
              >
                <option value="">All Villages</option>
                {villages.map((village) => (
                  <option key={village.id} value={village.id}>
                    {village.name}
                  </option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                className={styles.filterSelect}
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
              >
                <option value="">All Severity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                className={styles.filterSelect}
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
                <option value="agriculture">Agriculture</option>
                <option value="housing">Housing</option>
                <option value="communication">Communication</option>
                <option value="employment">Employment</option>
                <option value="social_welfare">Social Welfare</option>
                <option value="environment">Environment</option>
                <option value="other">Other</option>
              </select>
              <button className="btn btn-primary" onClick={applyFilters}>
                Apply Filters
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className="spinner"></div>
              <p>Loading gaps...</p>
            </div>
          ) : (
            <div className={styles.gapsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Village</th>
                    <th>Gap Type</th>
                    <th>Description</th>
                    <th>Input</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Voice</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.length > 0 ? (
                    gaps.map((gap) => (
                      <tr key={gap.id}>
                        <td><strong>{gap.village_name || gap.village?.name || 'N/A'}</strong></td>
                        <td className={styles.typeCell}>{gap.gap_type?.replace('_', ' ')}</td>
                        <td className={styles.descriptionCell}>
                          {gap.description?.substring(0, 80)}
                          {gap.description && gap.description.length > 80 && '...'}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${getInputMethodBadgeClass(gap.input_method)}`}>
                            {getInputMethodIcon(gap.input_method)} {gap.input_method}
                          </span>
                        </td>
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
                        <td className={styles.dateCell}>{new Date(gap.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>
                          {gap.audio_file ? (
                            <Link 
                              href={`/voice-verification/${gap.id}`}
                              className={styles.recordBtn}
                              title="Record voice for verification"
                            >
                              🎙️ Record
                            </Link>
                          ) : (
                            <span className={styles.naText}>N/A</span>
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionButtons}>
                            {gap.status === 'resolved' ? (
                              <div className={styles.resolvedInfo}>
                                <span className={`${styles.badge} ${styles.statusResolved}`}>
                                  ✓ Resolved
                                </span>
                                {gap.resolved_by && (
                                  <small className={styles.resolvedBy}>by {gap.resolved_by}</small>
                                )}
                              </div>
                            ) : (
                              <>
                                {canManageGaps ? (
                                  <select
                                    className={styles.statusSelect}
                                    value={gap.status}
                                    onChange={(e) => handleStatusChange(gap.id, e.target.value, !!gap.audio_file)}
                                  >
                                    <option value="open">Open</option>
                                    <option value="in_progress">In Progress</option>
                                    {canResolveGaps ? (
                                      <option value="resolved">
                                        {gap.audio_file ? '🎤 Resolve (Voice Verify)' : 'Resolved'}
                                      </option>
                                    ) : (
                                      <option value="resolved" disabled>
                                        🔒 Resolved (Need Authority)
                                      </option>
                                    )}
                                  </select>
                                ) : (
                                  <span className={`${styles.badge} ${getStatusBadgeClass(gap.status)}`}>
                                    {gap.status.replace('_', ' ')}
                                  </span>
                                )}
                                {gap.audio_file && (
                                  <Link 
                                    href={`/voice-verification/${gap.id}`}
                                    className={styles.voiceBtn}
                                    title="Voice verification required"
                                  >
                                    🎤
                                  </Link>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className={styles.emptyState}>
                        No gaps found. Upload an image or audio to create new gap entries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
