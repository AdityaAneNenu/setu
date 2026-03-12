'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import LanguageSelector from '@/components/LanguageSelector/LanguageSelector';
import { villagesApi, uploadApi } from '@/lib/api';
import { Village } from '@/types';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

type SubmissionType = 'image' | 'audio' | 'text';

export default function UploadPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, canCreateGaps, user } = useAuth();
  const [villages, setVillages] = useState<Village[]>([]);
  const [submissionType, setSubmissionType] = useState<SubmissionType>('image');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [gapType, setGapType] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [languageCode, setLanguageCode] = useState('hi');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
      // Pass user role and ID for role-based filtering
      const response = await villagesApi.getAll(user?.role, user?.id?.toString());
      setVillages(response as Village[]);
    } catch (err) {
      console.error('Failed to load villages:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
        setAudioFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('village', selectedVillage);
      formData.append('submission_type', submissionType);
      formData.append('gap_type', gapType);
      formData.append('severity', severity);

      if (submissionType === 'image' && imageFile) {
        formData.append('image', imageFile);
      } else if (submissionType === 'audio' && audioFile) {
        formData.append('audio_file', audioFile);
        formData.append('language_code', languageCode);
      } else if (submissionType === 'text') {
        formData.append('description', description);
        formData.append('language_code', languageCode);
      }

      await uploadApi.submitGap(formData);
      setSuccess('Gap submitted successfully!');
      
      // Reset form
      setSelectedVillage('');
      setGapType('');
      setSeverity('');
      setDescription('');
      setImageFile(null);
      setAudioFile(null);
      
      setTimeout(() => {
        router.push(user?.role === 'ground' ? '/upload' : '/manage-gaps');
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit gap');
    } finally {
      setIsLoading(false);
    }
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

  return (
    <>
      <Navbar />
      <div className="main-wrapper">
        <div className="container">
          <div className={styles.formContainer}>
            <h2>Report a Development Gap</h2>

            {/* Submission Type Selector */}
            <div className={styles.submissionTypeSelector}>
              <div 
                className={`${styles.submissionOption} ${submissionType === 'image' ? styles.active : ''}`}
                onClick={() => setSubmissionType('image')}
              >
                <div className={styles.submissionIcon}>📸</div>
                <div className={styles.submissionLabel}>Image Upload</div>
                <div className={styles.submissionDesc}>Upload a photo</div>
              </div>
              <div 
                className={`${styles.submissionOption} ${submissionType === 'audio' ? styles.active : ''}`}
                onClick={() => setSubmissionType('audio')}
              >
                <div className={styles.submissionIcon}>🎤</div>
                <div className={styles.submissionLabel}>Voice Input</div>
                <div className={styles.submissionDesc}>Record in any language</div>
              </div>
              <div 
                className={`${styles.submissionOption} ${submissionType === 'text' ? styles.active : ''}`}
                onClick={() => setSubmissionType('text')}
              >
                <div className={styles.submissionIcon}>📝</div>
                <div className={styles.submissionLabel}>Text Input</div>
                <div className={styles.submissionDesc}>Manual entry</div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className={styles.errorMessage}>
                  <span>⚠️</span> {error}
                </div>
              )}
              
              {success && (
                <div className={styles.successMessage}>
                  <span>✅</span> {success}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Village</label>
                <select
                  className="form-select"
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value)}
                  required
                >
                  <option value="">Select a village</option>
                  {villages.map((village) => (
                    <option key={village.id} value={village.id}>
                      {village.name}
                    </option>
                  ))}
                </select>
              </div>

              {submissionType === 'image' && (
                <div className="form-group">
                  <label className="form-label">Upload Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className={styles.fileInput}
                    required
                  />
                  {imageFile && (
                    <div className={styles.filePreview}>
                      <span>📎</span> {imageFile.name}
                    </div>
                  )}
                </div>
              )}

              {submissionType === 'audio' && (
                <div className="form-group">
                  <label className="form-label">Select Language</label>
                  <LanguageSelector 
                    value={languageCode} 
                    onChange={setLanguageCode}
                    showLabel={false}
                  />
                  <p className={styles.hint} style={{ marginTop: '8px' }}>
                    Select the language you will speak in for voice transcription
                  </p>
                </div>
              )}

              {submissionType === 'audio' && (
                <div className="form-group">
                  <label className="form-label">Voice Recording</label>
                  <div className={styles.audioRecorder}>
                    {!isRecording ? (
                      <button
                        type="button"
                        className={`btn btn-primary ${styles.recordBtn}`}
                        onClick={startRecording}
                      >
                        <span>🎤</span> Start Recording
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`btn btn-danger ${styles.recordBtn}`}
                        onClick={stopRecording}
                      >
                        <span>⏹️</span> Stop Recording
                      </button>
                    )}
                    {audioFile && (
                      <div className={styles.filePreview}>
                        <span>🎵</span> Recording saved
                      </div>
                    )}
                  </div>
                  <p className={styles.hint}>
                    Speak clearly in your selected language about the development gap
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Gap Type</label>
                <select
                  className="form-select"
                  value={gapType}
                  onChange={(e) => setGapType(e.target.value)}
                  required
                >
                  <option value="">Select gap type</option>
                  <option value="water">Water Supply</option>
                  <option value="road">Road Infrastructure</option>
                  <option value="sanitation">Sanitation</option>
                  <option value="electricity">Electricity</option>
                  <option value="education">Education</option>
                  <option value="health">Healthcare</option>
                  <option value="housing">Housing</option>
                  <option value="agriculture">Agriculture</option>
                  <option value="connectivity">Connectivity</option>
                  <option value="employment">Employment</option>
                  <option value="community_center">Community Center</option>
                  <option value="drainage">Drainage</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Severity</label>
                <select
                  className="form-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  required
                >
                  <option value="">Select severity</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {submissionType === 'text' && (
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the development gap in detail..."
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isLoading}
                style={{ width: '100%', marginTop: '16px' }}
              >
                {isLoading ? 'Submitting...' : 'Submit Gap Report'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
