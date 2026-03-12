// User Types
export type UserRole = 'ground' | 'manager' | 'admin';

export interface User {
  id: number | string;
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
  id: number | string;
  name: string;
  district: string;
  state: string;
  population: number;
  total_gaps: number;
  open_gaps: number;
  pending_gaps: number;
  in_progress_gaps: number;
  resolved_gaps: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  gaps?: any[];
}

// Gap Types
export type GapStatus = 'open' | 'in_progress' | 'resolved';
export type GapSeverity = 'low' | 'medium' | 'high';
export type GapType = 'water' | 'road' | 'sanitation' | 'electricity' | 'education' | 'health' | 'housing' | 'agriculture' | 'connectivity' | 'employment' | 'community_center' | 'drainage' | 'other';
export type InputMethod = 'image' | 'voice' | 'text';

export interface Gap {
  id: number | string;
  village?: Village;
  village_id: number | string;
  village_name?: string;
  gap_type: GapType;
  description: string;
  severity: GapSeverity;
  status: GapStatus;
  input_method: InputMethod;
  recommendations: string;
  expected_completion: string;
  actual_completion: string;
  created_at: string;
  updated_at: string;
  audio_url?: string;
  audio_file?: string; // legacy alias
  voice_code?: string;
  resolved_by?: string;
  image_url?: string;
}


