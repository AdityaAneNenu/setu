'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { workflowApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface ComplaintDetail {
  id: number;
  gap_description: string;
  village_name: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assigned_agent: any;
  location_details: string;
  resolution_notes: string;
  voice_code: string;
}

interface Agent {
  id: number;
  username: string;
  full_name: string;
}

export default function ComplaintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const id = params.id as string;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user && id) {
      loadComplaint();
      loadAgents();
    }
  }, [user, id]);

  const loadComplaint = async () => {
    try {
      setIsLoading(true);
      const response = await workflowApi.getComplaintDetail(id);
      setComplaint(response);
      setResolutionNotes(response.resolution_notes || '');
    } catch (err) {
      console.error('Failed to load complaint:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await workflowApi.getAgents();
      setAgents(response);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  const handleAssign = async () => {
    if (!selectedAgent) return;
    try {
      setIsUpdating(true);
      await workflowApi.assignComplaint(id, selectedAgent);
      await loadComplaint();
      setShowAssignModal(false);
    } catch (err) {
      console.error('Failed to assign complaint:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setIsUpdating(true);
      await workflowApi.updateComplaintStatus(id, newStatus, resolutionNotes);
      await loadComplaint();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
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

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'low':
        return styles.priorityLow;
      case 'medium':
        return styles.priorityMedium;
      case 'high':
        return styles.priorityHigh;
      case 'critical':
        return styles.priorityCritical;
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

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Loading complaint details...</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span></span>
          <h3>Complaint Not Found</h3>
          <Link href="/workflow" className={styles.btnBack}>Go Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/workflow" className={styles.backBtn}>
          ← Back to Workflow
        </Link>
        <div className={styles.headerInfo}>
          <h1>Complaint #{complaint.id}</h1>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
              {complaint.status}
            </span>
            <span className={`${styles.badge} ${getPriorityBadgeClass(complaint.priority)}`}>
              {complaint.priority} priority
            </span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Main Details */}
        <div className={styles.mainCard}>
          <div className={styles.cardHeader}>
            <h3>Complaint Details</h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Village</label>
                <span>{complaint.village_name}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Category</label>
                <span>{complaint.category}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Created At</label>
                <span>{new Date(complaint.created_at).toLocaleString()}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Last Updated</label>
                <span>{new Date(complaint.updated_at).toLocaleString()}</span>
              </div>
              {complaint.location_details && (
                <div className={styles.detailItem}>
                  <label>Location</label>
                  <span>{complaint.location_details}</span>
                </div>
              )}
              {complaint.voice_code && (
                <div className={styles.detailItem}>
                  <label>Voice Code</label>
                  <span className={styles.voiceCode}>{complaint.voice_code}</span>
                </div>
              )}
            </div>
            <div className={styles.description}>
              <label>Description</label>
              <p>{complaint.gap_description}</p>
            </div>
          </div>
        </div>

        {/* Assignment & Actions */}
        <div className={styles.sidePanel}>
          {/* Agent Assignment */}
          <div className={styles.sideCard}>
            <div className={styles.cardHeader}>
              <h3>Assignment</h3>
            </div>
            <div className={styles.cardBody}>
              {complaint.assigned_agent ? (
                <div className={styles.assignedAgent}>
                  <div className={styles.agentAvatar}>
                    {complaint.assigned_agent.full_name?.[0] || 'A'}
                  </div>
                  <div className={styles.agentInfo}>
                    <span className={styles.agentName}>
                      {complaint.assigned_agent.full_name || complaint.assigned_agent.username}
                    </span>
                    <span className={styles.agentRole}>Assigned Agent</span>
                  </div>
                </div>
              ) : (
                <p className={styles.noAssignment}>No agent assigned yet</p>
              )}
              <button
                className={styles.btnAssign}
                onClick={() => setShowAssignModal(true)}
              >
                {complaint.assigned_agent ? 'Reassign' : 'Assign Agent'}
              </button>
            </div>
          </div>

          {/* Status Update */}
          <div className={styles.sideCard}>
            <div className={styles.cardHeader}>
              <h3>Status Update</h3>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.formGroup}>
                <label>Resolution Notes</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about the resolution..."
                  rows={4}
                />
              </div>
              <div className={styles.statusActions}>
                {complaint.status !== 'in_progress' && (
                  <button
                    className={`${styles.btnStatus} ${styles.inProgress}`}
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={isUpdating}
                  >
                    Mark In Progress
                  </button>
                )}
                {complaint.status !== 'resolved' && (
                  <button
                    className={`${styles.btnStatus} ${styles.resolved}`}
                    onClick={() => handleStatusChange('resolved')}
                    disabled={isUpdating}
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Assign Agent</h3>
              <button onClick={() => setShowAssignModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Select Agent</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                >
                  <option value="">Choose an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.full_name || agent.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btnCancel}
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.btnConfirm}
                onClick={handleAssign}
                disabled={!selectedAgent || isUpdating}
              >
                {isUpdating ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
