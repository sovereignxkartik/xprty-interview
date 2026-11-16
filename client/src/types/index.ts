export type UserRole = 'super_admin' | 'interviewer' | 'candidate';

export type InterviewStatus = 
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ProctoringSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ProctoringEventType =
  | 'tab_hidden'
  | 'tab_visible'
  | 'window_blur'
  | 'window_focus'
  | 'fullscreen_exit'
  | 'fullscreen_enter'
  | 'camera_disabled'
  | 'camera_enabled'
  | 'mic_muted'
  | 'mic_unmuted'
  | 'screenshare_stopped'
  | 'screenshare_started'
  | 'network_offline'
  | 'network_online'
  | 'unauthorized_domain_attempt'
  | 'dev_tools_opened'
  | 'multiple_displays_detected';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
}

export interface InterviewerProfile {
  id: string;
  user_id: string;
  organization_name: string;
  organization_id?: string;
  title: string;
  verification_status: 'pending' | 'verified' | 'suspended';
  total_interviews_conducted: number;
  is_busy?: boolean;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  phone?: string;
  resume_url?: string;
  portfolio_url?: string;
  skills: string[];
}

export interface InterviewSession {
  id: string;
  session_code: string;
  title: string;
  description: string;
  organization_id?: string;
  interviewer_id: string;
  candidate_id: string;
  jitsi_room_name: string;
  jitsi_room_url: string;
  meeting_provider?: 'jitsi';
  status: InterviewStatus;
  scheduled_start_time: string;
  scheduled_end_time: string;
  actual_start_time?: string;
  actual_end_time?: string;
  candidate_attempted_at?: string;
  require_screen_share: boolean;
  require_fullscreen: boolean;
  require_webcam: boolean;
  require_audio: boolean;
  code_workspace_enabled: boolean;
  interviewer?: {
    id: string;
    full_name: string;
    email: string;
    title?: string;
  };
  candidate?: {
    id: string;
    full_name: string;
    email: string;
  };
  candidate_profile?: CandidateProfile | null;
  feedback?: InterviewFeedback | null;
}

export interface QueueStatus {
  inQueue: boolean;
  position: number;
  totalInQueue: number;
  interviewerBusy: boolean;
  canJoinNow: boolean;
  interviewerName?: string;
  title?: string;
}

export interface ResourcePermission {
  id: string;
  session_id: string;
  domain: string;
  title: string;
  include_subdomains: boolean;
  is_active: boolean;
  added_by: string;
  created_at: string;
}

export interface ProctoringEvent {
  id: string;
  session_id: string;
  user_id: string;
  event_type: ProctoringEventType;
  severity: ProctoringSeverity;
  metadata: Record<string, any>;
  detected_at: string;
}

export interface InterviewFeedback {
  id?: string;
  session_id: string;
  interviewer_id: string;
  technical_score: number;
  problem_solving_score: number;
  communication_score: number;
  overall_rating: number;
  recommendation: 'strong_hire' | 'hire' | 'neutral' | 'reject';
  summary_notes: string;
  detailed_scores?: Record<string, unknown>;
  submitted_at?: string;
}

export interface InterviewNote {
  id: string;
  session_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface PlatformMetrics {
  total_users: number;
  super_admins: number;
  interviewers: number;
  candidates: number;
  total_interviews: number;
  in_progress_interviews: number;
  completed_interviews: number;
  scheduled_interviews: number;
}
