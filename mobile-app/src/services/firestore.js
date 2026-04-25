// Firestore Database Service for SETU Mobile App
// ================================================
// Complete replacement for Django API - all data goes to Firebase Firestore

import { db, auth } from "../config/firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

// Upload service now uses Cloudinary (free) instead of Firebase Storage (paid)
// Re-export from cloudinaryService for backward compatibility
export { uploadService } from "./cloudinaryService";

const getTimestampSeconds = (value) => {
  if (!value) return 0;
  if (typeof value.seconds === "number") return value.seconds;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
  }
  return 0;
};

const getGapPreferenceScore = (gap) => {
  let score = 0;
  if (gap.submitted_by) score += 5;
  if (gap.submitted_by_email) score += 2;
  if (gap.audio_url) score += 1;
  if (gap.image_url) score += 1;
  if (gap.closure_photo_url) score += 1;
  if (gap.django_id && String(gap.id) !== String(gap.django_id)) score += 3;
  score += getTimestampSeconds(gap.updated_at) / 1_000_000_000;
  return score;
};

const dedupeGapRecords = (records) => {
  const deduped = new Map();

  records.forEach((gap) => {
    const key = gap.django_id ? `django:${gap.django_id}` : `doc:${gap.id}`;
    const existing = deduped.get(key);
    if (!existing || getGapPreferenceScore(gap) > getGapPreferenceScore(existing)) {
      deduped.set(key, gap);
    }
  });

  return Array.from(deduped.values()).sort(
    (a, b) => getTimestampSeconds(b.created_at) - getTimestampSeconds(a.created_at),
  );
};

// ============================================
// VILLAGES
// ============================================
export const villagesService = {
  // Get all villages
  getAll: async () => {
    try {
      const snapshot = await getDocs(collection(db, "villages"));
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Failed to fetch villages:", error.message);
      throw error;
    }
  },

  // Get single village
  getById: async (villageId) => {
    try {
      const docRef = doc(db, "villages", villageId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Village not found");
      return { id: docSnap.id, ...docSnap.data() };
    } catch (error) {
      console.error("Failed to fetch village:", error.message);
      throw error;
    }
  },

  // Get village stats (gaps count etc.)
  getWithStats: async () => {
    try {
      const villages = await villagesService.getAll();
      const gapsSnap = await getDocs(collection(db, "gaps"));
      const gaps = dedupeGapRecords(
        gapsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );

      return villages.map((village) => {
        const villageGaps = gaps.filter((g) => g.village_id === village.id);
        return {
          ...village,
          total_gaps: villageGaps.length,
          open_gaps: villageGaps.filter((g) => g.status === "open").length,
          in_progress_gaps: villageGaps.filter(
            (g) => g.status === "in_progress",
          ).length,
          resolved_gaps: villageGaps.filter((g) => g.status === "resolved")
            .length,
          high_severity: villageGaps.filter((g) => g.severity === "high")
            .length,
          medium_severity: villageGaps.filter((g) => g.severity === "medium")
            .length,
          low_severity: villageGaps.filter((g) => g.severity === "low").length,
        };
      });
    } catch (error) {
      console.error("Failed to fetch village stats:", error.message);
      throw error;
    }
  },
};

// ============================================
// GAPS
// ============================================
export const gapsService = {
  // Create a new gap
  create: async (gapData) => {
    try {
      const currentUser = auth.currentUser;
      const docRef = await addDoc(collection(db, "gaps"), {
        village_id: gapData.village_id,
        village_name: gapData.village_name || "",
        description: gapData.description || "",
        gap_type: gapData.gap_type || "other",
        severity: gapData.severity || "medium",
        status: "open",
        input_method: gapData.input_method || "text",
        recommendations: gapData.recommendations || "",
        audio_url: gapData.audio_url || null,
        image_url: gapData.image_url || null,
        django_id: null,
        latitude: gapData.latitude || null,
        longitude: gapData.longitude || null,
        start_date: null,
        expected_completion: null,
        actual_completion: null,
        resolved_by: null,
        resolved_at: null,
        submitted_by: currentUser?.uid || null,
        submitted_by_email: currentUser?.email || null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      return { id: docRef.id, ...gapData };
    } catch (error) {
      console.error("Failed to create gap:", error.message);
      throw error;
    }
  },

  // Get all gaps (with optional filters)
  getAll: async (filters = {}) => {
    try {
      let q = collection(db, "gaps");
      const constraints = [];

      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }
      if (filters.severity) {
        constraints.push(where("severity", "==", filters.severity));
      }
      if (filters.gap_type) {
        constraints.push(where("gap_type", "==", filters.gap_type));
      }
      if (filters.village_id) {
        constraints.push(where("village_id", "==", filters.village_id));
      }
      if (filters.submitted_by) {
        constraints.push(where("submitted_by", "==", filters.submitted_by));
      }

      // Only add orderBy if no equality filters are combined with it
      // to avoid Firestore composite index requirements
      if (
        !filters.submitted_by &&
        !filters.status &&
        !filters.severity &&
        !filters.gap_type &&
        !filters.village_id
      ) {
        constraints.push(orderBy("created_at", "desc"));
      }

      const snapshot = await getDocs(query(q, ...constraints));
      const results = dedupeGapRecords(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
      );

      // Client-side sort when Firestore orderBy was skipped
      results.sort((a, b) => {
        const aTime = a.created_at?.seconds || 0;
        const bTime = b.created_at?.seconds || 0;
        return bTime - aTime;
      });

      return results;
    } catch (error) {
      console.error("Failed to fetch gaps:", error.message);
      throw error;
    }
  },

  // Get single gap
  getById: async (gapId) => {
    try {
      const docRef = doc(db, "gaps", gapId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }

      const djangoLookupValue =
        typeof gapId === "string" && gapId.trim() !== "" && !Number.isNaN(Number(gapId))
          ? Number(gapId)
          : gapId;
      const gapQuery = query(
        collection(db, "gaps"),
        where("django_id", "==", djangoLookupValue),
      );
      const snapshot = await getDocs(gapQuery);
      const matches = dedupeGapRecords(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
      if (matches.length > 0) {
        return matches[0];
      }

      throw new Error("Gap not found");
    } catch (error) {
      console.error("Failed to fetch gap:", error.message);
      throw error;
    }
  },

  // Update gap status
  updateStatus: async (gapId, newStatus) => {
    try {
      const docRef = doc(db, "gaps", gapId);
      await updateDoc(docRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      return { id: gapId, status: newStatus };
    } catch (error) {
      console.error("Failed to update gap status:", error.message);
      throw error;
    }
  },

  // Get dashboard stats
  getStats: async (userId = null) => {
    try {
      let snapshot;
      if (userId) {
        const q = query(
          collection(db, "gaps"),
          where("submitted_by", "==", userId),
        );
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, "gaps"));
      }
      const gaps = dedupeGapRecords(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
      );

      return {
        total_gaps: gaps.length,
        open_gaps: gaps.filter((g) => g.status === "open").length,
        in_progress_gaps: gaps.filter((g) => g.status === "in_progress").length,
        resolved_gaps: gaps.filter((g) => g.status === "resolved").length,
        high_severity: gaps.filter((g) => g.severity === "high").length,
        medium_severity: gaps.filter((g) => g.severity === "medium").length,
        low_severity: gaps.filter((g) => g.severity === "low").length,
        gaps_by_type: gaps.reduce((acc, g) => {
          acc[g.gap_type] = (acc[g.gap_type] || 0) + 1;
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error("Failed to fetch gap stats:", error.message);
      throw error;
    }
  },

  // Store Django ID on Firestore gap document after successful backend sync
  updateDjangoId: async (gapId, djangoId) => {
    try {
      const docRef = doc(db, "gaps", gapId);
      await updateDoc(docRef, {
        django_id: djangoId,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      // Non-critical — log and continue
      console.warn(
        "Failed to update django_id on Firestore gap:",
        error.message,
      );
    }
  },
};

// ============================================
// FILE UPLOAD — Migrated to Cloudinary (see cloudinaryService.js)
// uploadService is re-exported at the top of this file
// ============================================

// ============================================
// USERS
// ============================================
export const usersService = {
  // Create/update user profile in Firestore after auth
  createProfile: async (uid, userData) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(doc(db, "users", uid), {
          uid,
          username: userData.username || "",
          email: userData.email || "",
          role: userData.role || "ground",
          first_name: userData.first_name || "",
          last_name: userData.last_name || "",
          created_at: serverTimestamp(),
        });
      }

      return { uid, ...userData };
    } catch (error) {
      console.error("Failed to create user profile:", error.message);
      throw error;
    }
  },

  // Get user profile
  getProfile: async (uid) => {
    try {
      // Try direct document lookup by UID first
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }

      // Fallback: query by uid field
      const q = query(collection(db, "users"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const userDoc = snapshot.docs[0];
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error("Failed to fetch user profile:", error.message);
      throw error;
    }
  },
};
