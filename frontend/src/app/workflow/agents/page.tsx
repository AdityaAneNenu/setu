'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { workflowApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface Agent {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  assigned_villages: string[];
  active_complaints: number;
  resolved_complaints: number;
  is_active: boolean;
}

export default function AgentsDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      loadAgents();
    }
  }, [user]);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const response = await workflowApi.getAgents();
      setAgents(response);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Link href="/workflow" className={styles.backBtn}>
            ← Back to Workflow
          </Link>
          <h1>Survey Agents</h1>
          <p>Manage and monitor field agents</p>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search agents by name, username, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Stats Summary */}
      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{agents.length}</span>
          <span className={styles.statLabel}>Total Agents</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {agents.filter((a) => a.is_active).length}
          </span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {agents.reduce((acc, a) => acc + (a.active_complaints || 0), 0)}
          </span>
          <span className={styles.statLabel}>Total Active Cases</span>
        </div>
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className="spinner"></div>
          <p>Loading agents...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No agents found</p>
        </div>
      ) : (
        <div className={styles.agentsGrid}>
          {filteredAgents.map((agent) => (
            <div key={agent.id} className={styles.agentCard}>
              <div className={styles.agentHeader}>
                <div className={styles.avatar}>
                  {agent.full_name?.[0] || agent.username[0]}
                </div>
                <div className={styles.agentInfo}>
                  <h3>{agent.full_name || agent.username}</h3>
                  <span className={styles.username}>@{agent.username}</span>
                </div>
                <span
                  className={`${styles.statusBadge} ${
                    agent.is_active ? styles.active : styles.inactive
                  }`}
                >
                  {agent.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className={styles.agentDetails}>
                {agent.email && (
                  <div className={styles.detailItem}>
                    <span>{agent.email}</span>
                  </div>
                )}
                {agent.phone && (
                  <div className={styles.detailItem}>
                    <span>{agent.phone}</span>
                  </div>
                )}
              </div>

              <div className={styles.agentStats}>
                <div className={styles.agentStat}>
                  <span className={styles.agentStatValue}>
                    {agent.active_complaints || 0}
                  </span>
                  <span className={styles.agentStatLabel}>Active</span>
                </div>
                <div className={styles.agentStat}>
                  <span className={styles.agentStatValue}>
                    {agent.resolved_complaints || 0}
                  </span>
                  <span className={styles.agentStatLabel}>Resolved</span>
                </div>
                <div className={styles.agentStat}>
                  <span className={styles.agentStatValue}>
                    {agent.assigned_villages?.length || 0}
                  </span>
                  <span className={styles.agentStatLabel}>Villages</span>
                </div>
              </div>

              {agent.assigned_villages && agent.assigned_villages.length > 0 && (
                <div className={styles.villagesList}>
                  <label>Assigned Villages</label>
                  <div className={styles.villagesTags}>
                    {agent.assigned_villages.slice(0, 3).map((village, idx) => (
                      <span key={idx} className={styles.villageTag}>
                        {village}
                      </span>
                    ))}
                    {agent.assigned_villages.length > 3 && (
                      <span className={styles.villageTag}>
                        +{agent.assigned_villages.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
