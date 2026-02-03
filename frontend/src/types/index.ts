// User Types
export type UserRole = 'ground' | 'manager' | 'authority' | 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  is_superuser?: boolean;
  is_staff?: boolean;
}

// Village Types
export interface Village {
  id: number;
  name: string;
  district: string;
  state: string;
  population: number;
  total_gaps: number;
  pending_gaps: number;
  in_progress_gaps: number;
  resolved_gaps: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
}

// Gap Types
export type GapStatus = 'open' | 'in_progress' | 'resolved';
export type GapSeverity = 'low' | 'medium' | 'high';
export type GapType = 'water' | 'road' | 'sanitation' | 'electricity' | 'education' | 'health' | 'other';
export type InputMethod = 'image' | 'voice' | 'text';

export interface Gap {
  id: number;
  village?: Village;
  village_id: number;
  village_name?: string;
  gap_type: GapType;
  description: string;
  severity: GapSeverity;
  status: GapStatus;
  input_method: InputMethod;
  recommendations: string;
  budget_allocated: number;
  budget_spent: number;
  expected_completion: string;
  actual_completion: string;
  created_at: string;
  updated_at: string;
  audio_file?: string;
  voice_code?: string;
}

// Complaint Types
export type ComplaintStatus = 'submitted' | 'verified' | 'in_progress' | 'resolved' | 'closed';

export interface Complaint {
  id: string;
  complaint_id: string;
  title: string;
  description: string;
  category: string;
  status: ComplaintStatus;
  priority: GapSeverity;
  village: Village;
  submitted_by: User;
  assigned_to?: User;
  resolution_proof?: string;
  created_at: string;
  updated_at: string;
}

// Dashboard Stats
export interface DashboardStats {
  total_gaps: number;
  pending_gaps: number;
  in_progress_gaps: number;
  resolved_gaps: number;
}

// Analytics Data
export interface AnalyticsData {
  gap_types: Record<string, number>;
  severity_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  monthly_trend: Array<{ month: string; count: number }>;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

// Auth Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
