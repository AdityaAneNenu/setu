'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { workflowApi, villagesApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface Village {
  id: number;
  name: string;
}

export default function SubmitComplaintPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [villages, setVillages] = useState<Village[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    village: '',
    category: '',
    gap_description: '',
    priority: 'medium',
    location_details: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    loadVillages();
  }, []);

  const loadVillages = async () => {
    try {
      const response = await villagesApi.getAll();
      setVillages(response);
    } catch (err) {
      console.error('Failed to load villages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.village || !formData.category || !formData.gap_description) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      await workflowApi.submitComplaint(formData);
      setSuccess(true);
      setTimeout(() => {
        router.push('/workflow');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit complaint');
    } finally {
      setIsSubmitting(false);
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
        <Link href="/workflow" className={styles.backBtn}>
          ← Back
        </Link>
        <h1>Submit New Complaint</h1>
      </div>

      <div className={styles.formCard}>
        {success ? (
          <div className={styles.successMessage}>
            <span></span>
            <h3>Complaint Submitted Successfully!</h3>
            <p>Redirecting to workflow dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Village *</label>
                <select
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Village</option>
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="water">Water</option>
                  <option value="road">Road</option>
                  <option value="sanitation">Sanitation</option>
                  <option value="electricity">Electricity</option>
                  <option value="education">Education</option>
                  <option value="health">Health</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Location Details</label>
                <input
                  type="text"
                  name="location_details"
                  value={formData.location_details}
                  onChange={handleChange}
                  placeholder="e.g., Near the school, Main road..."
                />
              </div>
            </div>

            <div className={styles.formGroupFull}>
              <label>Description *</label>
              <textarea
                name="gap_description"
                value={formData.gap_description}
                onChange={handleChange}
                rows={5}
                placeholder="Describe the issue in detail..."
                required
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => router.push('/workflow')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
