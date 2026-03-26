/**
 * Firebase-backed API layer for the Next.js frontend
 * ====================================================
 * Replaces Axios-based Django REST API calls with direct Firestore queries.
 * All exports return data shapes matching what the frontend pages expect.
 * 
 * ROLE-BASED ACCESS CONTROL
 * ==========================
 * The system implements hierarchical role-based access control:
 * 
 * Role Hierarchy (ascending permissions):
 * 1. GROUND - Field workers who submit gaps
 * 2. MANAGER - Team managers who verify and manage gaps  
 * 3. ADMIN - System administrators with full access
 * 
 * DATA VISIBILITY:
 * - Ground workers: Only see gaps THEY submitted (filtered by submitted_by)
 * - Managers: See ALL gaps (needed to manage the entire system)
 * - Admins: See ALL gaps (full system access)
 * 
 * PERMISSIONS (defined in AuthContext):
 * - canCreateGaps: All authenticated users
 * - canVerifyGaps: Manager and above
 * - canManageGaps: Manager and above (change status)
 * - canResolveGaps: Admin only
 * - canViewAnalytics: Manager and above
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { uploadAudio, uploadImage, uploadVoiceSample } from './cloudinary';
import { auth } from './firebase';

// =========================================
// Helper: load gaps with role-based filtering
// =========================================
async function loadAllGaps(userId?: string | null) {
  let q = query(collection(db, 'gaps'), orderBy('created_at', 'desc'));
  
  // If userId provided, filter to only that user's gaps (for ground workers)
  if (userId) {
    q = query(collection(db, 'gaps'), 
      where('submitted_by', '==', userId),
      orderBy('created_at', 'desc')
    );
  }
  
  const gapsSnap = await getDocs(q);
  return gapsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllVillages() {
  const snap = await getDocs(query(collection(db, 'villages'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function computeVillageStats(village: any, allGaps: any[]) {
  const vGaps = allGaps.filter(
    (g: any) => g.village_id === village.id || g.village_name === village.name
  );
  const openGaps = vGaps.filter((g: any) => g.status === 'open').length;
  const inProgressGaps = vGaps.filter((g: any) => g.status === 'in_progress').length;
  const resolvedGaps = vGaps.filter((g: any) => g.status === 'resolved').length;
  const highSeverity = vGaps.filter((g: any) => g.severity === 'high').length;
  const mediumSeverity = vGaps.filter((g: any) => g.severity === 'medium').length;
  const lowSeverity = vGaps.filter((g: any) => g.severity === 'low').length;

  return {
    id: village.id,
    name: village.name || '',
    district: village.district || '',
    state: village.state || '',
    population: village.population || 0,
    total_gaps: vGaps.length,
    open_gaps: openGaps,
    pending_gaps: openGaps, // alias
    in_progress_gaps: inProgressGaps,
    resolved_gaps: resolvedGaps,
    high_severity: highSeverity,
    medium_severity: mediumSeverity,
    low_severity: lowSeverity,
    gaps: vGaps,
  };
}

// =========================================
// Dashboard API
// =========================================
// Role-based access:
// - Ground workers: Only their own gaps (filtered by submitted_by)
// - Manager/Admin: All gaps (no filter)
export const dashboardApi = {
  getStats: async (userRole?: string, userId?: string) => {
    // Filter gaps by user for ground workers only
    const filterUserId = (userRole === 'ground' && userId) ? userId : null;
    const gaps = await loadAllGaps(filterUserId);
    const villages = await loadAllVillages();

    const openCount = gaps.filter((g: any) => g.status === 'open').length;
    const inProgressCount = gaps.filter((g: any) => g.status === 'in_progress').length;
    const resolvedCount = gaps.filter((g: any) => g.status === 'resolved').length;

    const highCount = gaps.filter((g: any) => g.severity === 'high').length;
    const mediumCount = gaps.filter((g: any) => g.severity === 'medium').length;
    const lowCount = gaps.filter((g: any) => g.severity === 'low').length;

    // Gap types distribution (as array for charts)
    const gapsByType: Record<string, number> = {};
    gaps.forEach((g: any) => {
      const t = g.gap_type || 'other';
      gapsByType[t] = (gapsByType[t] || 0) + 1;
    });
    const gaps_by_type = Object.entries(gapsByType).map(([gap_type, count]) => ({ gap_type, count }));

    // Recent gaps (sorted by date, top 5)
    const sortedGaps = [...gaps]
      .sort((a: any, b: any) => {
        const aDate = a.created_at || '';
        const bDate = b.created_at || '';
        return String(bDate).localeCompare(String(aDate));
      })
      .slice(0, 5);

    const recent_gaps = sortedGaps.map((data: any) => ({
      id: data.id,
      village_name: data.village_name || 'N/A',
      gap_type: data.gap_type,
      severity: data.severity,
      status: data.status,
      created_at: data.created_at,
      description: data.description,
      audio_url: data.audio_url || null,
    }));

    // Villages with computed stats
    const villagesWithStats = villages.map((v: any) => computeVillageStats(v, gaps));

    // Resolution rate
    const resolution_rate = gaps.length > 0 ? Math.round((resolvedCount / gaps.length) * 100) : 0;

    return {
      total_gaps: gaps.length,
      open_gaps: openCount,
      pending_gaps: openCount, // alias for pages using pending_gaps
      in_progress_gaps: inProgressCount,
      resolved_gaps: resolvedCount,
      high_severity: highCount,
      medium_severity: mediumCount,
      low_severity: lowCount,
      resolution_rate,
      gaps_by_type,
      gap_types: gapsByType, // Record form for public-dashboard
      recent_gaps,
      villages: villagesWithStats,
    };
  },
};

// =========================================
// Gaps API
// =========================================
// Role-based data access:
// - Ground: Only gaps they submitted (submitted_by filter)
// - Manager: All gaps (needed to manage the system)
// - Admin: All gaps (full system access)
export const gapsApi = {
  getAll: async (filters?: Record<string, string>) => {
    const gapsRef = collection(db, 'gaps');
    const constraints: any[] = [];

    // Role-based filtering: ground workers only see their own gaps
    if (filters?.submitted_by) {
      constraints.push(where('submitted_by', '==', filters.submitted_by));
    }

    constraints.push(orderBy('created_at', 'desc'));
    let q = query(gapsRef, ...constraints);

    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    // Apply additional filters client-side
    if (filters) {
      if (filters.status) {
        results = results.filter((g: any) => g.status === filters.status);
      }
      if (filters.severity) {
        results = results.filter((g: any) => g.severity === filters.severity);
      }
      if (filters.gap_type) {
        results = results.filter((g: any) => g.gap_type === filters.gap_type);
      }
      if (filters.village) {
        results = results.filter((g: any) =>
          g.village_name?.toLowerCase().includes(filters.village.toLowerCase()) ||
          g.village_id === filters.village
        );
      }
    }

    return results;
  },

  getById: async (id: string | number) => {
    const docRef = doc(db, 'gaps', String(id));
    const snap = await getDoc(docRef);

    if (!snap.exists()) throw new Error('Gap not found');

    return { id: snap.id, ...snap.data() };
  },

  updateStatus: async (id: number | string, status: string) => {
    const docRef = doc(db, 'gaps', String(id));
    await updateDoc(docRef, {
      status,
      updated_at: serverTimestamp(),
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    });
    return { success: true, message: `Gap status updated to ${status}`, id, status };
  },
};

// =========================================
// Villages API
// =========================================
export const villagesApi = {
  getAll: async (userRole?: string, userId?: string) => {
    const villages = await loadAllVillages();
    // Filter gaps by user for ground workers only
    const filterUserId = (userRole === 'ground' && userId) ? userId : null;
    const gaps = await loadAllGaps(filterUserId);
    return villages.map((v: any) => computeVillageStats(v, gaps));
  },

  getById: async (id: string | number, userRole?: string, userId?: string) => {
    const docRef = doc(db, 'villages', String(id));
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Village not found');

    const village = { id: snap.id, ...snap.data() };

    // Filter gaps by user for ground workers only
    const filterUserId = (userRole === 'ground' && userId) ? userId : null;
    const allGaps = await loadAllGaps(filterUserId);
    const stats = computeVillageStats(village, allGaps);

    return stats; // includes gaps array and all computed fields
  },

  getReport: async (id: string | number) => {
    // Get village data
    const villageDoc = await getDoc(doc(db, 'villages', String(id)));
    if (!villageDoc.exists()) throw new Error('Village not found');
    const village = { id: villageDoc.id, ...villageDoc.data() };

    // Get all gaps and compute stats
    const allGaps = await loadAllGaps();
    const stats = computeVillageStats(village, allGaps);

    // Gaps by type distribution
    const gaps_by_type: Record<string, number> = {};
    stats.gaps.forEach((g: any) => {
      const t = g.gap_type || 'other';
      gaps_by_type[t] = (gaps_by_type[t] || 0) + 1;
    });

    // Priority gaps (high severity, not resolved)
    const priority_gaps = stats.gaps
      .filter((g: any) => g.severity === 'high' && g.status !== 'resolved')
      .slice(0, 5)
      .map((g: any) => ({
        id: g.id,
        description: g.description || '',
        gap_description: g.description || '',
        gap_type: g.gap_type,
        severity: g.severity,
        status: g.status,
      }));

    // Completion rate
    const completion_rate = stats.total_gaps > 0
      ? Math.round((stats.resolved_gaps / stats.total_gaps) * 100 * 10) / 10
      : 0;

    return {
      id: stats.id,
      name: stats.name,
      district: stats.district,
      state: stats.state,
      total_gaps: stats.total_gaps,
      pending_gaps: stats.pending_gaps,
      in_progress_gaps: stats.in_progress_gaps,
      resolved_gaps: stats.resolved_gaps,
      completion_rate,
      gaps_by_type,
      priority_gaps,
      monthly_progress: [],
      village: stats,
      gaps: stats.gaps,
    };
  },
};

// =========================================
// Analytics API
// =========================================
export const analyticsApi = {
  getData: async () => {
    const gaps = await loadAllGaps();
    const villages = await loadAllVillages();

    // Gap types distribution as array (page expects Array<{gap_type, count}>)
    const gapTypesMap: Record<string, number> = {};
    gaps.forEach((g: any) => {
      const t = g.gap_type || 'other';
      gapTypesMap[t] = (gapTypesMap[t] || 0) + 1;
    });
    const gaps_by_type = Object.entries(gapTypesMap).map(([gap_type, count]) => ({ gap_type, count }));

    // Severity distribution
    const severity_distribution: Record<string, number> = { high: 0, medium: 0, low: 0 };
    gaps.forEach((g: any) => {
      const s = g.severity || 'medium';
      if (severity_distribution[s] !== undefined) severity_distribution[s]++;
    });

    // Status distribution
    const status_distribution: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 };
    gaps.forEach((g: any) => {
      const s = g.status || 'open';
      if (status_distribution[s] !== undefined) status_distribution[s]++;
    });

    // Village gaps
    const village_gaps = villages.map((v: any) => {
      const vGaps = gaps.filter(
        (g: any) => g.village_id === v.id || g.village_name === v.name
      );
      return {
        id: v.id,
        name: v.name,
        total: vGaps.length,
        open: vGaps.filter((g: any) => g.status === 'open').length,
        in_progress: vGaps.filter((g: any) => g.status === 'in_progress').length,
        resolved: vGaps.filter((g: any) => g.status === 'resolved').length,
      };
    });

    // Monthly trend
    const monthCounts: Record<string, number> = {};
    gaps.forEach((g: any) => {
      if (g.created_at) {
        const month = String(g.created_at).substring(0, 7); // YYYY-MM
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
    });
    const monthly_trend = Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    return {
      total_gaps: gaps.length,
      gaps_by_type,
      severity_distribution,
      status_distribution,
      village_gaps,
      monthly_trend,
    };
  },
};

// =========================================
// Upload API
// =========================================
export const uploadApi = {
  submitGap: async (formData: FormData) => {
    const villageId = formData.get('village') as string;
    const description = formData.get('description') as string || '';
    const gapType = formData.get('gap_type') as string || 'other';
    const severity = formData.get('severity') as string || 'medium';
    const inputMethod = formData.get('submission_type') as string || 'text';
    const latitude = formData.get('latitude') as string;
    const longitude = formData.get('longitude') as string;

    let audioUrl = null;
    let imageUrl = null;

    // Upload audio file if present (via Cloudinary)
    const audioFile = formData.get('audio_file') as File;
    if (audioFile && audioFile.size > 0) {
      audioUrl = await uploadAudio(audioFile);
    }

    // Upload image if present (via Cloudinary)
    const imageFile = formData.get('image') as File;
    if (imageFile && imageFile.size > 0) {
      imageUrl = await uploadImage(imageFile);
    }

    // Get village name
    let villageName = 'Unknown';
    if (villageId) {
      try {
        const villageDoc = await getDoc(doc(db, 'villages', villageId));
        if (villageDoc.exists()) {
          villageName = villageDoc.data().name;
        }
      } catch (e) {
        console.warn('Could not fetch village name:', e);
      }
    }

    const gapData = {
      village_id: villageId,
      village_name: villageName,
      description,
      gap_type: gapType,
      severity,
      status: 'open',
      input_method: inputMethod === 'audio' ? 'voice' : inputMethod,
      recommendations: '',
      audio_url: audioUrl,
      image_url: imageUrl,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      submitted_by: auth.currentUser?.uid || null,
      submitted_by_email: auth.currentUser?.email || null,
      created_at: new Date().toISOString(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'gaps'), gapData);

    return {
      success: true,
      message: 'Gap created successfully',
      id: docRef.id,
      gap_type: gapType,
      severity,
      description,
    };
  },
};

// =========================================
// Complaints / Workflow API
// =========================================
export const workflowApi = {
  getComplaints: async (filters?: Record<string, string>) => {
    const snap = await getDocs(
      query(collection(db, 'complaints'), orderBy('created_at', 'desc'))
    );
    let results = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        gap_description: data.complaint_text || data.description || data.gap_description || '',
        village_name: data.village_name || '',
        category: data.complaint_type || data.category || '',
        status: data.status || 'pending',
        created_at: data.created_at || '',
        assigned_agent: data.assigned_to || data.assigned_agent || null,
      };
    });

    if (filters) {
      if (filters.status && filters.status !== '') {
        results = results.filter((c: any) => {
          if (filters.status === 'pending') {
            return ['pending', 'received_post', 'pending_verification'].includes(c.status);
          }
          return c.status === filters.status;
        });
      }
      if (filters.priority) results = results.filter((c: any) => c.priority_level === filters.priority);
    }

    return results;
  },

  getStats: async () => {
    const snap = await getDocs(collection(db, 'complaints'));
    const complaints = snap.docs.map(d => d.data());

    const pending = complaints.filter(c =>
      c.status === 'pending' || c.status === 'received_post' || c.status === 'pending_verification'
    ).length;
    const assigned = complaints.filter(c =>
      c.status === 'assigned' || c.status === 'in_progress'
    ).length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;

    return {
      total_complaints: complaints.length,
      pending_complaints: pending,
      assigned_complaints: assigned,
      resolved_complaints: resolved,
    };
  },

  submitComplaint: async (data: Record<string, string | number>) => {
    const complaintData = {
      ...data,
      status: 'received_post',
      created_at: new Date().toISOString(),
      updated_at: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, 'complaints'), complaintData);
    return { success: true, id: docRef.id, message: 'Complaint submitted successfully' };
  },

  getComplaintDetail: async (id: string) => {
    const docSnap = await getDoc(doc(db, 'complaints', id));
    if (!docSnap.exists()) throw new Error('Complaint not found');
    return { id: docSnap.id, ...docSnap.data() };
  },

  updateComplaintStatus: async (id: string, status: string, notes?: string) => {
    const updateData: Record<string, any> = { status, updated_at: serverTimestamp() };
    if (notes) updateData.notes = notes;
    await updateDoc(doc(db, 'complaints', id), updateData);
    return { success: true, message: `Complaint status updated to ${status}` };
  },

  assignComplaint: async (id: string, agentId: string) => {
    await updateDoc(doc(db, 'complaints', id), {
      assigned_to: agentId,
      status: 'assigned',
      updated_at: serverTimestamp(),
    });
    return { success: true, message: 'Complaint assigned' };
  },

  getAgents: async () => {
    const q = query(collection(db, 'users'), where('role', 'in', ['ground', 'manager']));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
};

// =========================================
// Voice Verification API
// =========================================
export const voiceApi = {
  getGapDetails: async (gapId: string | number) => {
    const docSnap = await getDoc(doc(db, 'gaps', String(gapId)));
    if (!docSnap.exists()) throw new Error('Gap not found');
    const data = docSnap.data();
    return {
      id: docSnap.id,
      village_name: data.village_name || '',
      description: data.description || '',
      gap_type: data.gap_type || '',
      severity: data.severity || 'medium',
      status: data.status || 'open',
      input_method: data.input_method || 'text',
      has_audio: !!(data.audio_url),
      audio_url: data.audio_url || null,
      voice_code: data.voice_code || null,
      created_at: data.created_at || '',
      can_verify: !!(data.audio_url) && data.status !== 'resolved',
    };
  },

  getVerificationLogs: async (gapId: string | number) => {
    const gapDoc = await getDoc(doc(db, 'gaps', String(gapId)));
    const gapData = gapDoc.exists() ? gapDoc.data() : {};

    let logs: any[] = [];
    try {
      const q = query(
        collection(db, 'voice_verifications'),
        where('gap_id', '==', String(gapId)),
        orderBy('verification_date', 'desc')
      );
      const snap = await getDocs(q);
      logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      // Collection may not exist yet
      console.warn('voice_verifications query failed:', e);
    }

    return {
      logs,
      has_original_audio: !!(gapData?.audio_url),
      original_audio_url: gapData?.audio_url || null,
    };
  },

  submitVerification: async (gapId: string | number, data: FormData) => {
    // Upload audio to Cloudinary
    const audioFile = data.get('audio_file') as File;
    let audioUrl = null;

    if (audioFile && audioFile.size > 0) {
      audioUrl = await uploadVoiceSample(audioFile, gapId);
    }

    // Create verification log
    const logData = {
      gap_id: String(gapId),
      audio_url: audioUrl,
      is_match: false,
      confidence_score: 0,
      similarity_score: 0,
      similarity_percentage: 0,
      confidence: 'pending',
      verification_date: new Date().toISOString(),
      verified_by: data.get('verified_by') || 'Unknown',
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'voice_verifications'), logData);
    return {
      success: true,
      id: docRef.id,
      verification: {
        is_match: logData.is_match,
        similarity_score: logData.similarity_score,
        similarity_percentage: logData.similarity_percentage,
        confidence: logData.confidence,
        threshold: 0.7,
        message: 'Voice sample recorded. Server-side voice comparison is not yet integrated. The sample has been saved for future analysis.',
      },
      can_resolve: false,
    };
  },

  resolveGap: async (gapId: string | number) => {
    await updateDoc(doc(db, 'gaps', String(gapId)), {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: serverTimestamp(),
    });
    return { success: true, message: 'Gap resolved successfully' };
  },
};

// =========================================
// Public Dashboard API
// =========================================
export const publicApi = {
  getDashboard: async (filters?: Record<string, string>) => {
    const stats = await dashboardApi.getStats();
    // Apply client-side filters if provided
    if (filters && stats.recent_gaps) {
      if (filters.village) {
        stats.recent_gaps = stats.recent_gaps.filter((g: any) =>
          g.village_name?.toLowerCase().includes(filters.village.toLowerCase())
        );
      }
      if (filters.status) {
        stats.recent_gaps = stats.recent_gaps.filter((g: any) => g.status === filters.status);
      }
      if (filters.gap_type) {
        stats.recent_gaps = stats.recent_gaps.filter((g: any) => g.gap_type === filters.gap_type);
      }
    }
    return stats;
  },
};
