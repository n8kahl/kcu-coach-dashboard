-- ============================================
-- KCU Coach - Safe Full Schema Migration
-- ============================================
-- This migration safely handles existing tables and columns.
-- It can be run multiple times without errors.
-- Run this FIRST before any other migrations.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HELPER: Add column if not exists
-- ============================================
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
  p_table TEXT,
  p_column TEXT,
  p_type TEXT,
  p_default TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table AND column_name = p_column
  ) THEN
    IF p_default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s DEFAULT %s', p_table, p_column, p_type, p_default);
    ELSE
      EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', p_table, p_column, p_type);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. USER PROFILES (Base table)
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  discord_username TEXT,
  subscription_tier TEXT DEFAULT 'free',
  is_admin BOOLEAN DEFAULT false,
  current_module TEXT DEFAULT 'fundamentals',
  experience_level TEXT DEFAULT 'beginner',
  preferred_symbols TEXT[] DEFAULT ARRAY['SPY'],
  notification_preferences JSONB DEFAULT '{"daily_briefing": true, "quiz_reminders": false}',
  total_questions INTEGER DEFAULT 0,
  total_quizzes INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add any missing columns to user_profiles
SELECT add_column_if_not_exists('user_profiles', 'email', 'TEXT');
SELECT add_column_if_not_exists('user_profiles', 'username', 'TEXT');
SELECT add_column_if_not_exists('user_profiles', 'avatar_url', 'TEXT');
SELECT add_column_if_not_exists('user_profiles', 'subscription_tier', 'TEXT', '''free''');
SELECT add_column_if_not_exists('user_profiles', 'is_admin', 'BOOLEAN', 'false');

CREATE INDEX IF NOT EXISTS idx_user_discord ON user_profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON user_profiles(email);

-- ============================================
-- 2. KNOWLEDGE BASE
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  source_type TEXT NOT NULL DEFAULT 'transcript',
  source_id TEXT,
  source_title TEXT,
  topic TEXT,
  subtopic TEXT,
  difficulty TEXT DEFAULT 'beginner',
  ltp_relevance FLOAT DEFAULT 0.5,
  chunk_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON knowledge_chunks(topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_difficulty ON knowledge_chunks(difficulty);

-- ============================================
-- 3. LEARNING PROGRESS
-- ============================================

CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT DEFAULT 'not_started',
  completion_percentage INTEGER DEFAULT 0,
  quiz_attempts INTEGER DEFAULT 0,
  quiz_best_score INTEGER,
  quiz_average_score FLOAT,
  time_spent_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_accessed TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, module, topic)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON learning_progress(user_id);

-- ============================================
-- 4. QUIZ ATTEMPTS
-- ============================================

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  difficulty TEXT DEFAULT 'mixed',
  questions JSONB NOT NULL DEFAULT '[]',
  user_answers JSONB NOT NULL DEFAULT '[]',
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_topic ON quiz_attempts(topic);

-- ============================================
-- 5. CONVERSATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  thread_id TEXT,
  messages JSONB[] DEFAULT ARRAY[]::JSONB[],
  context JSONB DEFAULT '{}',
  quiz_state JSONB,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_channel ON conversations(channel_id);

-- ============================================
-- 6. TRADE JOURNAL
-- ============================================

CREATE TABLE IF NOT EXISTS trade_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT 'SPY',
  direction TEXT NOT NULL DEFAULT 'long',
  entry_price DECIMAL(10, 2),
  exit_price DECIMAL(10, 2),
  shares INTEGER DEFAULT 1,
  is_options BOOLEAN DEFAULT FALSE,
  option_type TEXT,
  strike DECIMAL(10, 2),
  expiration DATE,
  entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exit_time TIMESTAMP WITH TIME ZONE,
  pnl DECIMAL(10, 2),
  pnl_percent DECIMAL(5, 2),
  setup_type TEXT,
  had_level BOOLEAN,
  had_trend BOOLEAN,
  had_patience_candle BOOLEAN,
  followed_rules BOOLEAN,
  emotions TEXT,
  notes TEXT,
  screenshot_url TEXT,
  ltp_grade JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user ON trade_journal(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_symbol ON trade_journal(symbol);
CREATE INDEX IF NOT EXISTS idx_journal_entry_time ON trade_journal(entry_time);

-- ============================================
-- 7. LEADERBOARDS
-- ============================================

CREATE TABLE IF NOT EXISTS leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rankings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(period_type, period_start)
);

-- ============================================
-- 8. ACHIEVEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(user_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

-- ============================================
-- 9. STUDY GROUPS
-- ============================================

CREATE TABLE IF NOT EXISTS study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES user_profiles(id),
  discord_channel_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_group_members (
  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS accountability_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  checkin_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkins_user ON accountability_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_group ON accountability_checkins(group_id);

-- ============================================
-- 10. USER ROLES
-- ============================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO user_roles (name, description, permissions) VALUES
  ('super_admin', 'Full system access', '{"manage_roles": true, "manage_users": true, "manage_watchlists": true, "manage_configs": true, "post_alerts": true, "view_analytics": true, "manage_knowledge": true, "configure_ltp": true}'),
  ('admin', 'Alert posting, user management', '{"manage_users": true, "manage_watchlists": true, "post_alerts": true, "view_analytics": true}'),
  ('coach', 'Educational content, trade review', '{"post_alerts": true, "review_trades": true, "view_analytics": true}'),
  ('member', 'Standard user access', '{"view_watchlists": true, "view_setups": true, "use_coach": true, "log_trades": true}'),
  ('viewer', 'Read-only access', '{"view_watchlists": true, "view_setups": true}')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_user ON user_role_assignments(user_id);

-- ============================================
-- 11. WATCHLISTS (Handle existing table)
-- ============================================

-- Create if not exists
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT DEFAULT 'My Watchlist',
  description TEXT,
  is_shared BOOLEAN DEFAULT FALSE,
  is_admin_watchlist BOOLEAN DEFAULT FALSE,
  symbols TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing watchlists table
SELECT add_column_if_not_exists('watchlists', 'name', 'TEXT', '''My Watchlist''');
SELECT add_column_if_not_exists('watchlists', 'description', 'TEXT');
SELECT add_column_if_not_exists('watchlists', 'is_shared', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('watchlists', 'is_admin_watchlist', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('watchlists', 'symbols', 'TEXT[]', '''{}''');

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists(user_id);

-- ============================================
-- 12. KEY LEVELS
-- ============================================

CREATE TABLE IF NOT EXISTS key_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  level_type TEXT NOT NULL,
  timeframe TEXT,
  price DECIMAL(12, 4) NOT NULL,
  strength INTEGER DEFAULT 50,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_key_levels_symbol ON key_levels(symbol);
CREATE INDEX IF NOT EXISTS idx_key_levels_type ON key_levels(level_type);
CREATE INDEX IF NOT EXISTS idx_key_levels_expires ON key_levels(expires_at);

-- ============================================
-- 13. DETECTED SETUPS (Handle existing table)
-- ============================================

CREATE TABLE IF NOT EXISTS detected_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  setup_stage TEXT NOT NULL DEFAULT 'forming',
  confluence_score INTEGER DEFAULT 0,
  level_score INTEGER DEFAULT 0,
  trend_score INTEGER DEFAULT 0,
  patience_score INTEGER DEFAULT 0,
  mtf_score INTEGER DEFAULT 0,
  primary_level_type TEXT,
  primary_level_price DECIMAL(12, 4),
  patience_candles INTEGER DEFAULT 0,
  suggested_entry DECIMAL(12, 4),
  suggested_stop DECIMAL(12, 4),
  target_1 DECIMAL(12, 4),
  target_2 DECIMAL(12, 4),
  target_3 DECIMAL(12, 4),
  risk_reward DECIMAL(5, 2),
  coach_note TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  triggered_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  detected_by TEXT DEFAULT 'system'
);

-- Add missing columns to existing detected_setups table
SELECT add_column_if_not_exists('detected_setups', 'setup_stage', 'TEXT', '''forming''');
SELECT add_column_if_not_exists('detected_setups', 'confluence_score', 'INTEGER', '0');
SELECT add_column_if_not_exists('detected_setups', 'level_score', 'INTEGER', '0');
SELECT add_column_if_not_exists('detected_setups', 'trend_score', 'INTEGER', '0');
SELECT add_column_if_not_exists('detected_setups', 'patience_score', 'INTEGER', '0');
SELECT add_column_if_not_exists('detected_setups', 'mtf_score', 'INTEGER', '0');
SELECT add_column_if_not_exists('detected_setups', 'primary_level_type', 'TEXT');
SELECT add_column_if_not_exists('detected_setups', 'primary_level_price', 'DECIMAL(12, 4)');
SELECT add_column_if_not_exists('detected_setups', 'patience_candles', 'INTEGER', '0');
SELECT add_column_if_not_exists('detected_setups', 'suggested_entry', 'DECIMAL(12, 4)');
SELECT add_column_if_not_exists('detected_setups', 'suggested_stop', 'DECIMAL(12, 4)');
SELECT add_column_if_not_exists('detected_setups', 'target_1', 'DECIMAL(12, 4)');
SELECT add_column_if_not_exists('detected_setups', 'target_2', 'DECIMAL(12, 4)');
SELECT add_column_if_not_exists('detected_setups', 'target_3', 'DECIMAL(12, 4)');
SELECT add_column_if_not_exists('detected_setups', 'risk_reward', 'DECIMAL(5, 2)');
SELECT add_column_if_not_exists('detected_setups', 'coach_note', 'TEXT');
SELECT add_column_if_not_exists('detected_setups', 'detected_at', 'TIMESTAMP WITH TIME ZONE', 'NOW()');
SELECT add_column_if_not_exists('detected_setups', 'triggered_at', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('detected_setups', 'expired_at', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('detected_setups', 'detected_by', 'TEXT', '''system''');

CREATE INDEX IF NOT EXISTS idx_detected_setups_symbol ON detected_setups(symbol);
CREATE INDEX IF NOT EXISTS idx_detected_setups_stage ON detected_setups(setup_stage);
CREATE INDEX IF NOT EXISTS idx_detected_setups_score ON detected_setups(confluence_score DESC);

-- ============================================
-- 14. SETUP SUBSCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS setup_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  setup_id UUID REFERENCES detected_setups(id) ON DELETE CASCADE,
  notify_on_ready BOOLEAN DEFAULT TRUE,
  notify_on_trigger BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, setup_id)
);

CREATE INDEX IF NOT EXISTS idx_setup_subscriptions_user ON setup_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_setup_subscriptions_setup ON setup_subscriptions(setup_id);

-- ============================================
-- 15. MTF ANALYSIS
-- ============================================

CREATE TABLE IF NOT EXISTS mtf_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  trend TEXT,
  structure TEXT,
  ema_position TEXT,
  orb_status TEXT,
  vwap_position TEXT,
  key_level_proximity DECIMAL(5, 2),
  momentum TEXT,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mtf_analysis_symbol ON mtf_analysis(symbol);
CREATE INDEX IF NOT EXISTS idx_mtf_analysis_timeframe ON mtf_analysis(timeframe);

-- ============================================
-- 16. MARKET CONTEXT
-- ============================================

CREATE TABLE IF NOT EXISTS market_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_status TEXT,
  spy_trend TEXT,
  qqq_trend TEXT,
  vix_level DECIMAL(6, 2),
  vix_trend TEXT,
  market_breadth TEXT,
  sector_leaders JSONB,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 17. ECONOMIC EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS economic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  symbol TEXT,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  importance TEXT DEFAULT 'medium',
  expected_value TEXT,
  actual_value TEXT,
  surprise TEXT,
  notes TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economic_events_date ON economic_events(event_date);
CREATE INDEX IF NOT EXISTS idx_economic_events_symbol ON economic_events(symbol);
CREATE INDEX IF NOT EXISTS idx_economic_events_type ON economic_events(event_type);

-- ============================================
-- 18. EVENT ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS event_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID REFERENCES economic_events(id) ON DELETE CASCADE,
  alert_before INTERVAL DEFAULT '1 hour',
  notified BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, event_id)
);

-- ============================================
-- 19. ADMIN ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  contract TEXT,
  entry_price DECIMAL(12, 4),
  stop_loss DECIMAL(12, 4),
  targets DECIMAL(12, 4)[],
  message TEXT,
  ltp_justification TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_symbol ON admin_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created ON admin_alerts(created_at DESC);

-- ============================================
-- 20. STRATEGY CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS strategy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO strategy_configs (name, category, config) VALUES
  ('ltp_detection_thresholds', 'ltp', '{"confluence_threshold": 70, "level_proximity_percent": 0.3, "patience_candle_max_size_percent": 0.5, "trend_ema_alignment_required": true, "orb_break_required": false, "min_level_strength": 50}'),
  ('mtf_timeframes', 'mtf', '{"enabled_timeframes": ["2m", "5m", "15m", "1h", "4h", "daily", "weekly"], "weights": {"weekly": 0.15, "daily": 0.20, "4h": 0.15, "1h": 0.20, "15m": 0.15, "5m": 0.10, "2m": 0.05}}'),
  ('key_levels_config', 'ltp', '{"intraday_levels": ["pdh", "pdl", "pdc", "orb_high", "orb_low", "vwap", "ema_9", "ema_21", "premarket_high", "premarket_low"], "htf_levels": ["weekly_high", "weekly_low", "monthly_high", "monthly_low", "sma_200"], "recalculate_interval_minutes": 1}'),
  ('ai_coach_settings', 'ai', '{"model": "claude-sonnet-4-20250514", "temperature": 0.7, "max_tokens": 1024, "include_market_context": true, "include_user_trades": true}')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 21. ALERT TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS alert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  alert_type TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  channels TEXT[] DEFAULT ARRAY['web', 'discord'],
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO alert_templates (name, alert_type, title_template, body_template) VALUES
  ('setup_ready', 'setup_ready', '{{symbol}} Setup Ready!', 'LTP Confluence: {{confluence_score}}%\nDirection: {{direction}}\nEntry: ${{entry}}\nStop: ${{stop}}\nTarget: ${{target}}'),
  ('admin_entering', 'entering', 'ENTERING {{symbol}} {{direction}}', '{{admin_name}} is entering {{symbol}}\nEntry: ${{entry}}\nStop: ${{stop}}\nTargets: {{targets}}'),
  ('earnings_reminder', 'earnings', '{{symbol}} Earnings {{time}}', '{{symbol}} reports earnings {{when}}\nExpected EPS: {{expected_eps}}\nConsider adjusting positions.')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 22. MARKET DATA CACHE
-- ============================================

CREATE TABLE IF NOT EXISTS market_data_cache (
  symbol TEXT PRIMARY KEY,
  last_price DECIMAL(12, 4),
  change_percent DECIMAL(6, 2),
  volume BIGINT,
  vwap DECIMAL(12, 4),
  orb_high DECIMAL(12, 4),
  orb_low DECIMAL(12, 4),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 23. YOUTUBE VIDEOS
-- ============================================

CREATE TABLE IF NOT EXISTS youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  published_at TIMESTAMP WITH TIME ZONE,
  topics TEXT[],
  transcript_status TEXT DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_status ON youtube_videos(transcript_status);

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================
-- SERVICE ROLE POLICIES (Full Access)
-- ============================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON %I', t);
    EXECUTE format('CREATE POLICY "Service role full access" ON %I FOR ALL TO service_role USING (true)', t);
  END LOOP;
END $$;

-- ============================================
-- AUTHENTICATED USER POLICIES
-- ============================================

-- Public read access
DROP POLICY IF EXISTS "Authenticated read" ON user_roles;
CREATE POLICY "Authenticated read" ON user_roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read" ON key_levels;
CREATE POLICY "Authenticated read" ON key_levels FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read" ON detected_setups;
CREATE POLICY "Authenticated read" ON detected_setups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read" ON market_context;
CREATE POLICY "Authenticated read" ON market_context FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read" ON economic_events;
CREATE POLICY "Authenticated read" ON economic_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read" ON market_data_cache;
CREATE POLICY "Authenticated read" ON market_data_cache FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read" ON youtube_videos;
CREATE POLICY "Authenticated read" ON youtube_videos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read" ON knowledge_chunks;
CREATE POLICY "Authenticated read" ON knowledge_chunks FOR SELECT TO authenticated USING (true);

-- User's own data access
DROP POLICY IF EXISTS "Users own watchlists" ON watchlists;
CREATE POLICY "Users own watchlists" ON watchlists FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_shared = true);

DROP POLICY IF EXISTS "Users own subscriptions" ON setup_subscriptions;
CREATE POLICY "Users own subscriptions" ON setup_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users own event alerts" ON event_alerts;
CREATE POLICY "Users own event alerts" ON event_alerts FOR ALL TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own roles" ON user_role_assignments;
CREATE POLICY "Users view own roles" ON user_role_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_permissions JSONB := '{}';
BEGIN
  SELECT COALESCE(
    jsonb_object_agg(
      key,
      CASE WHEN bool_or((value)::boolean) THEN true ELSE false END
    ),
    '{}'
  )
  INTO v_permissions
  FROM user_role_assignments ura
  JOIN user_roles ur ON ura.role_id = ur.id,
  LATERAL jsonb_each(ur.permissions)
  WHERE ura.user_id = p_user_id
    AND (ura.expires_at IS NULL OR ura.expires_at > NOW());

  RETURN v_permissions;
END;
$$;

CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((get_user_permissions(p_user_id) ->> p_permission)::boolean, false);
END;
$$;

-- ============================================
-- REALTIME (Safe)
-- ============================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE detected_setups; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE key_levels; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE market_context; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE admin_alerts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- CLEANUP HELPER FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS add_column_if_not_exists(TEXT, TEXT, TEXT, TEXT);

-- Done!
SELECT 'Schema migration completed successfully!' AS status;
