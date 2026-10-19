/**
 * StashMind Database & Entity Types
 * Generated and synchronized with supabase/migrations/20261017000000_stashmind_core_schema.sql
 */

import type { AudiencePreset, LessonStyle, LessonLengthMinutes } from '../config/index.ts';

export type UserTier = 'free' | 'student' | 'pro' | 'team';
export type SourceType = 'text' | 'pdf' | 'url' | 'youtube';
export type LessonStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type PracticeMode = 'text' | 'voice';
export type PracticeSessionStatus = 'active' | 'completed' | 'abandoned';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  audience_preset: AudiencePreset;
  timezone: string;
  tier: UserTier;
  age_confirmed: boolean;
  data_saver: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface Source {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  source_type: SourceType;
  title: string;
  original_url?: string | null;
  content_hash: string;
  char_count: number;
  is_private: boolean;
  created_at: string;
}

export interface HostDialogueLine {
  speaker: 'Alex' | 'Sam';
  text: string;
  speechMetadata?: {
    style?: string;
    vocalBurst?: '<laugh>' | '<gasp>' | '<breath>';
    backchannel?: '|yeah|' | '|mhm|' | '|right|';
  };
  sectionMarkerId?: string;
}

export interface LessonSectionMarker {
  id: string;
  title: string;
  start_second: number;
  end_second: number;
  summary: string;
  source_excerpt: string;
}

export interface Lesson {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  source_id?: string | null;
  content_hash: string;
  title: string;
  summary: string;
  audience_preset: AudiencePreset;
  style: LessonStyle;
  target_duration_minutes: LessonLengthMinutes;
  status: LessonStatus;
  error_message?: string | null;
  audio_url?: string | null;
  audio_duration_seconds: number;
  tts_provider: string;
  script: HostDialogueLine[];
  sections: LessonSectionMarker[];
  prompt_version: string;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  lesson_id: string;
  user_id: string;
  headline: string;
  insight: string;
  actionable_takeaway: string;
  source_section_pointer: string;
  audio_timestamp_seconds: number;
  card_order: number;
  tags: string[];
  created_at: string;
}

export interface SavedCard {
  id: string;
  user_id: string;
  card_id: string;
  notes?: string | null;
  saved_at: string;
  card?: Card;
}

export interface PracticeTurn {
  id: string;
  turn_number: number;
  user_input: string;
  agent_reply: string;
  feedback: string; // STRICTLY <= 30 words
  clarity_score: number; // 0-100
  tone_score: number; // 0-100
  structure_score: number; // 0-100
  timestamp: string;
}

export interface PracticeScorecard {
  overall_score: number; // 0-100
  clarity_average: number;
  tone_average: number;
  structure_average: number;
  summary: string;
  strengths: string[];
  growth_areas: string[];
  recommended_next_scenario: string;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  lesson_id?: string | null;
  scenario_id: string;
  scenario_title: string;
  audience_preset: AudiencePreset;
  persona: string;
  mode: PracticeMode;
  status: PracticeSessionStatus;
  turns: PracticeTurn[];
  final_scorecard?: PracticeScorecard | null;
  created_at: string;
  updated_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_local_date: string;
  freezes_available: number;
  freezes_used_this_week: number;
  freeze_last_reset_week: string;
  updated_at: string;
}

export interface SpacedReview {
  id: string;
  user_id: string;
  card_id: string;
  interval_days: number;
  ease_factor: number;
  repetition_number: number;
  due_date: string;
  last_reviewed_at?: string | null;
  created_at: string;
  card?: Card;
}

export interface UsageCounter {
  id: string;
  user_id: string;
  usage_date: string;
  lessons_created: number;
  tts_seconds_used: number;
  input_tokens: number;
  output_tokens: number;
}

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  rate_limit_per_minute: number;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface WebhookRecord {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  target_url: string;
  signing_secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status?: number | null;
  response_body?: string | null;
  attempt_count: number;
  delivered_at: string;
}

export interface AuditLogRecord {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
}
