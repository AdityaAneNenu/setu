'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { voiceApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

interface GapDetail {
  id: number;
  village_name: string;
  description: string;
  gap_type: string;
  severity: string;
  status: string;
  input_method: string;
  has_audio: boolean;
  audio_url: string | null;
  voice_code: string | null;
  created_at: string;
  can_verify: boolean;
}

interface VerificationLog {
  id: number;
  verified_by: string;
  verified_at: string;
  is_match: boolean;
  similarity_score: number;
  similarity_percentage: number;
  confidence: string;
  notes: string;
  used_for_closure: boolean;
  audio_url: string | null;
}

interface VerificationResult {
  success: boolean;
  verification?: {
    is_match: boolean;
    similarity_score: number;
    similarity_percentage: number;
    confidence: string;
    threshold: number;
    message: string;
  };
  can_resolve?: boolean;
  error?: string;
}

export default function VoiceVerificationPage() {
  const router = useRouter();
  const params = useParams();
  const { user, canResolveGaps } = useAuth();
  const [gap, setGap] = useState<GapDetail | null>(null);
  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>([]);
  const [logsData, setLogsData] = useState<{has_original_audio: boolean; original_audio_url: string | null} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const id = params.id as string;

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [gapRes, logsRes] = await Promise.all([
        voiceApi.getGapDetails(id),
        voiceApi.getVerificationLogs(id),
      ]);
      
      setGap(gapRes);
      setVerificationLogs(logsRes.logs || []);
      setLogsData({
        has_original_audio: logsRes.has_original_audio,
        original_audio_url: logsRes.original_audio_url
      });
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.response?.data?.error || 'Failed to load gap data');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setVerificationResult(null);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Failed to access microphone. Please ensure you have granted microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setVerificationResult(null);
  };

  const handleSubmitVerification = async () => {
    if (!audioBlob) {
      alert('Please record a voice sample first');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'verification.webm');
      formData.append('verified_by', user?.username || 'Anonymous');

      const result = await voiceApi.submitVerification(id, formData);
      setVerificationResult(result);
      
      // Reload logs to show the new verification
      const logsRes = await voiceApi.getVerificationLogs(id);
      setVerificationLogs(logsRes.logs || []);
      
    } catch (err: any) {
      console.error('Failed to submit verification:', err);
      setError(err.response?.data?.error || 'Failed to submit verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveGap = async () => {
    if (!verificationResult?.can_resolve) {
      alert('Voice verification must pass before resolving');
      return;
    }

    try {
      setIsResolving(true);
      setError(null);
      
      const result = await voiceApi.resolveGap(id);
      
      if (result.success) {
        alert('Gap resolved successfully!');
        router.push('/manage-gaps');
      } else {
        setError(result.error || 'Failed to resolve gap');
      }
    } catch (err: any) {
      console.error('Failed to resolve gap:', err);
      setError(err.response?.data?.error || 'Failed to resolve gap');
    } finally {
      setIsResolving(false);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence?.toLowerCase()) {
      case 'high':
        return { class: styles.badgeHigh, icon: '', label: 'High Confidence' };
      case 'medium':
        return { class: styles.badgeMedium, icon: '', label: 'Medium Confidence' };
      case 'low':
        return { class: styles.badgeLow, icon: '', label: 'Low Confidence' };
      default:
        return { class: styles.badgeUnknown, icon: '', label: 'Unknown' };
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Loading verification data...</p>
      </div>
    );
  }

  if (error && !gap) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span></span>
          <h3>Error</h3>
          <p>{error}</p>
          <Link href="/manage-gaps" className={styles.btnBack}>Go Back</Link>
        </div>
      </div>
    );
  }

  if (!gap) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span></span>
          <h3>Gap Not Found</h3>
          <Link href="/manage-gaps" className={styles.btnBack}>Go Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/manage-gaps" className={styles.backBtn}>
          ← Back to Gaps
        </Link>
        <h1>Voice Verification</h1>
        <p>Biometric voice verification for Gap #{gap.id}</p>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          {error}
        </div>
      )}

      <div className={styles.content}>
        {/* Gap Details */}
        <div className={styles.gapCard}>
          <div className={styles.cardHeader}>
            <h3>Gap Details</h3>
            <span className={`${styles.statusBadge} ${styles[`status_${gap.status}`]}`}>
              {gap.status}
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Village</label>
                <span>{gap.village_name}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Type</label>
                <span>{gap.gap_type}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Severity</label>
                <span>{gap.severity}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Input Method</label>
                <span>{gap.input_method}</span>
              </div>
            </div>
            <div className={styles.description}>
              <label>Description</label>
              <p>{gap.description}</p>
            </div>
            
            {/* Original Audio */}
            {gap.has_audio && logsData?.original_audio_url && (
              <div className={styles.originalAudio}>
                <label>Original Recording</label>
                <audio src={`http://localhost:8000${logsData.original_audio_url}`} controls />
              </div>
            )}
          </div>
        </div>

        {/* Verification Section */}
        {!gap.can_verify ? (
          <div className={styles.warningCard}>
            <h4>Cannot Verify</h4>
            <p>
              {gap.status === 'resolved' 
                ? 'This gap has already been resolved.' 
                : 'This gap has no original audio recording to verify against.'}
            </p>
          </div>
        ) : (
          <div className={styles.recordingCard}>
            <div className={styles.cardHeader}>
              <h3>Voice Biometric Verification</h3>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.instructions}>
                Record your voice to verify your identity. The system compares voice characteristics (not words) 
                to confirm you are the same person who reported this gap.
              </p>

              <div className={styles.recorderContainer}>
                {!audioUrl ? (
                  <button
                    className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? (
                      <>
                        <span className={styles.recordingIndicator}></span>
                        Stop Recording
                      </>
                    ) : (
                      <>Start Recording</>
                    )}
                  </button>
                ) : (
                  <div className={styles.audioPreview}>
                    <audio src={audioUrl} controls />
                    <button className={styles.btnClear} onClick={clearRecording}>
                      Re-record
                    </button>
                  </div>
                )}
              </div>

              {audioBlob && !verificationResult && (
                <button
                  className={styles.btnSubmit}
                  onClick={handleSubmitVerification}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Voice'}
                </button>
              )}

              {/* Verification Result */}
              {verificationResult && (
                <div className={`${styles.resultCard} ${verificationResult.verification?.is_match ? styles.resultSuccess : styles.resultFailed}`}>
                  <div className={styles.resultHeader}>
                    {verificationResult.verification?.is_match ? (
                      <>
                        <span className={styles.resultIcon}>Match</span>
                        <h4>Voice Match Confirmed!</h4>
                      </>
                    ) : (
                      <>
                        <span className={styles.resultIcon}></span>
                        <h4>Voice Not Matched</h4>
                      </>
                    )}
                  </div>
                  
                  <div className={styles.resultDetails}>
                    <div className={styles.similarityMeter}>
                      <label>Similarity Score</label>
                      <div className={styles.meterBar}>
                        <div 
                          className={styles.meterFill} 
                          style={{width: `${verificationResult.verification?.similarity_percentage || 0}%`}}
                        />
                      </div>
                      <span className={styles.percentage}>
                        {verificationResult.verification?.similarity_percentage || 0}%
                      </span>
                    </div>
                    
                    <div className={styles.confidenceRow}>
                      <label>Confidence Level:</label>
                      <span className={getConfidenceBadge(verificationResult.verification?.confidence || '').class}>
                        {getConfidenceBadge(verificationResult.verification?.confidence || '').icon}{' '}
                        {getConfidenceBadge(verificationResult.verification?.confidence || '').label}
                      </span>
                    </div>
                    
                    {verificationResult.verification?.message && (
                      <p className={styles.resultMessage}>{verificationResult.verification.message}</p>
                    )}
                  </div>

                  {verificationResult.can_resolve && (
                    <div className={styles.resolveSection}>
                      {canResolveGaps ? (
                        <>
                          <p>Voice verification passed! You can now resolve this gap.</p>
                          <button
                            className={styles.btnResolve}
                            onClick={handleResolveGap}
                            disabled={isResolving}
                          >
                            {isResolving ? 'Resolving...' : '✓ Resolve Gap'}
                          </button>
                        </>
                      ) : (
                        <p className={styles.noPermission}>
                          Voice verified successfully! Only Authority or Admin users can resolve gaps.
                        </p>
                      )}
                    </div>
                  )}

                  <button className={styles.btnRetry} onClick={clearRecording}>
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Verification History */}
      <div className={styles.historyCard}>
        <div className={styles.cardHeader}>
          <h3>Verification History ({verificationLogs.length} attempts)</h3>
        </div>
        <div className={styles.cardBody}>
          {verificationLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No verification attempts yet</p>
            </div>
          ) : (
            <div className={styles.historyList}>
              {verificationLogs.map((log) => (
                <div key={log.id} className={`${styles.historyItem} ${log.is_match ? styles.historyMatch : styles.historyNoMatch}`}>
                  <div className={styles.historyHeader}>
                    <span className={log.is_match ? styles.badgeMatch : styles.badgeNoMatch}>
                      {log.is_match ? 'Match' : 'No Match'}
                    </span>
                    <span className={styles.historyDate}>
                      {new Date(log.verified_at).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.historyDetails}>
                    <span>Similarity: {log.similarity_percentage}%</span>
                    <span className={getConfidenceBadge(log.confidence).class}>
                      {getConfidenceBadge(log.confidence).label}
                    </span>
                    {log.used_for_closure && (
                      <span className={styles.usedForClosure}>Used for closure</span>
                    )}
                  </div>
                  <p className={styles.historyBy}>Verified by: {log.verified_by}</p>
                  {log.notes && <p className={styles.historyNotes}>{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
