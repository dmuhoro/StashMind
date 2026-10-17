-- StashMind Production Database Schema
-- Migration: 20261017000000_stashmind_core_schema.sql
-- Enforces Row Level Security (RLS) on all user-owned tables.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (with audience preset, timezone, tier, and age confirmation)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  audience_preset TEXT NOT NULL DEFAULT 'student' CHECK (audience_preset IN ('student', 'learner', 'professional')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'student', 'pro', 'team')),
  age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Workspaces & Workspace Members (Multi-tenancy)
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspaces"
  ON workspaces FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can view workspace membership"
  ON workspace_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- 3. Sources Table (Private by default, raw upload tracking)
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('text', 'pdf', 'url', 'youtube')),
  title TEXT NOT NULL,
  original_url TEXT,
  content_hash TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sources"
  ON sources FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sources_content_hash ON sources(content_hash);

-- 4. Lessons Table (Transformed output, dual-host audio, script)
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  content_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  audience_preset TEXT NOT NULL CHECK (audience_preset IN ('student', 'learner', 'professional')),
  style TEXT NOT NULL CHECK (style IN ('tldr', 'eli5', 'debate', 'deep_dive')),
  target_duration_minutes INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message TEXT,
  audio_url TEXT,
  audio_duration_seconds INTEGER DEFAULT 0,
  tts_provider TEXT DEFAULT 'gemini-3.8-flash-tts',
  script JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lessons"
  ON lessons FOR SELECT
  USING (user_id = auth.uid() OR (workspace_id IS NOT NULL AND workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert own lessons"
  ON lessons FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own lessons"
  ON lessons FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own lessons"
  ON lessons FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_lessons_content_hash ON lessons(content_hash);
CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON lessons(user_id);

-- 5. Cards Table (Grounded insight cards linked to audio timestamps and source sections)
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  insight TEXT NOT NULL,
  actionable_takeaway TEXT NOT NULL,
  source_section_pointer TEXT NOT NULL,
  audio_timestamp_seconds INTEGER NOT NULL DEFAULT 0,
  card_order INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cards"
  ON cards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own cards"
  ON cards FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_cards_lesson_id ON cards(lesson_id);

-- 6. Saved Cards (Library)
CREATE TABLE IF NOT EXISTS saved_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  notes TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage saved cards"
  ON saved_cards FOR ALL
  USING (user_id = auth.uid());

-- 7. Practice Sessions (Roleplay turns, feedback <= 30 words, scorecards)
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  scenario_id TEXT NOT NULL,
  scenario_title TEXT NOT NULL,
  audience_preset TEXT NOT NULL,
  persona TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'text' CHECK (mode IN ('text', 'voice')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  turns JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_scorecard JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage practice sessions"
  ON practice_sessions FOR ALL
  USING (user_id = auth.uid());

-- 8. Streaks Table (Timezone-correct retention)
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_local_date TEXT NOT NULL,
  freezes_available INTEGER NOT NULL DEFAULT 1,
  freezes_used_this_week INTEGER NOT NULL DEFAULT 0,
  freeze_last_reset_week TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and update own streaks"
  ON streaks FOR ALL
  USING (user_id = auth.uid());

-- 9. Spaced Repetition Reviews
CREATE TABLE IF NOT EXISTS spaced_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor NUMERIC(3,2) NOT NULL DEFAULT 2.50,
  repetition_number INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

ALTER TABLE spaced_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage spaced reviews"
  ON spaced_reviews FOR ALL
  USING (user_id = auth.uid());

-- 10. Usage Counters (Daily limits & spend governance)
CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  lessons_created INTEGER NOT NULL DEFAULT 0,
  tts_seconds_used INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage counters"
  ON usage_counters FOR SELECT
  USING (user_id = auth.uid());

-- 11. API Keys (Hashed at rest, visible prefix)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{"lessons:read","lessons:write","cards:read"}'::text[],
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own api keys"
  ON api_keys FOR ALL
  USING (user_id = auth.uid());

-- 12. Webhooks & Deliveries (Signed with HMAC-SHA256)
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{"lesson.ready","practice.completed"}'::text[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own webhooks"
  ON webhooks FOR ALL
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deliveries"
  ON webhook_deliveries FOR SELECT
  USING (webhook_id IN (SELECT id FROM webhooks WHERE user_id = auth.uid()));

-- 13. Audit Log (Immutable security record)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_log FOR SELECT
  USING (user_id = auth.uid());
