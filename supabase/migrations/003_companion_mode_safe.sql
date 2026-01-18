-- ============================================
-- KCU Coach - Companion Mode Schema (Safe Version)
-- ============================================
-- Uses IF NOT EXISTS and handles existing tables
-- Run this after 001_base_schema.sql

-- ============================================
-- ROLE & PERMISSION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles (ignore if exists)
INSERT INTO user_roles (name, description, permissions) VALUES
  ('super_admin', 'Full system access, strategy configuration', '{
    "manage_roles": true,
    "manage_users": true,
    "manage_watchlists": true,
    "manage_configs": true,
    "post_alerts": true,
    "view_analytics": true,
    "manage_knowledge": true,
    "configure_ltp": true
  }'),
  ('admin', 'Alert posting, user management, shared watchlist', '{
    "manage_users": true,
    "manage_watchlists": true,
    "post_alerts": true,
    "view_analytics": true
  }'),
  ('coach', 'Educational content, trade review', '{
    "post_alerts": true,
    "review_trades": true,
    "view_analytics": true
  }'),
  ('member', 'Standard user access', '{
    "view_watchlists": true,
    "view_setups": true,
    "use_coach": true,
    "log_trades": true
  }'),
  ('viewer', 'Read-only access (trial)', '{
    "view_watchlists": true,
    "view_setups": true
  }')
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
-- WATCHLIST SYSTEM (handle existing table)
-- The existing watchlists table uses user_id (not owner_id)
-- We'll add missing columns if they don't exist
-- ============================================

DO $$
BEGIN
  -- Add name column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchlists' AND column_name = 'name') THEN
    ALTER TABLE watchlists ADD COLUMN name TEXT DEFAULT 'My Watchlist';
  END IF;

  -- Add description column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchlists' AND column_name = 'description') THEN
    ALTER TABLE watchlists ADD COLUMN description TEXT;
  END IF;

  -- Add is_shared column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchlists' AND column_name = 'is_shared') THEN
    ALTER TABLE watchlists ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add is_admin_watchlist column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchlists' AND column_name = 'is_admin_watchlist') THEN
    ALTER TABLE watchlists ADD COLUMN is_admin_watchlist BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add symbols column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchlists' AND column_name = 'symbols') THEN
    ALTER TABLE watchlists ADD COLUMN symbols TEXT[] DEFAULT '{}';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists(user_id);

-- ============================================
-- KEY LEVELS
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
-- DETECTED SETUPS
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

CREATE INDEX IF NOT EXISTS idx_detected_setups_symbol ON detected_setups(symbol);
CREATE INDEX IF NOT EXISTS idx_detected_setups_stage ON detected_setups(setup_stage);
CREATE INDEX IF NOT EXISTS idx_detected_setups_score ON detected_setups(confluence_score DESC);

-- ============================================
-- SETUP SUBSCRIPTIONS
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
-- MTF ANALYSIS
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
-- MARKET CONTEXT
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
-- ECONOMIC EVENTS
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
-- EVENT ALERTS
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
-- ADMIN ALERTS
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
-- STRATEGY CONFIGURATION
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

-- Insert default configs
INSERT INTO strategy_configs (name, category, config) VALUES
  ('ltp_detection_thresholds', 'ltp', '{
    "confluence_threshold": 70,
    "level_proximity_percent": 0.3,
    "patience_candle_max_size_percent": 0.5,
    "trend_ema_alignment_required": true,
    "orb_break_required": false,
    "min_level_strength": 50
  }'),
  ('mtf_timeframes', 'mtf', '{
    "enabled_timeframes": ["2m", "5m", "15m", "1h", "4h", "daily", "weekly"],
    "weights": {
      "weekly": 0.15,
      "daily": 0.20,
      "4h": 0.15,
      "1h": 0.20,
      "15m": 0.15,
      "5m": 0.10,
      "2m": 0.05
    }
  }'),
  ('key_levels_config', 'ltp', '{
    "intraday_levels": ["pdh", "pdl", "pdc", "orb_high", "orb_low", "vwap", "ema_9", "ema_21", "premarket_high", "premarket_low"],
    "htf_levels": ["weekly_high", "weekly_low", "monthly_high", "monthly_low", "sma_200"],
    "recalculate_interval_minutes": 1
  }'),
  ('ai_coach_settings', 'ai', '{
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.7,
    "max_tokens": 1024,
    "include_market_context": true,
    "include_user_trades": true
  }')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ALERT TEMPLATES
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
  ('setup_ready', 'setup_ready', '{{symbol}} Setup Ready!',
   'LTP Confluence: {{confluence_score}}%\nDirection: {{direction}}\nEntry: ${{entry}}\nStop: ${{stop}}\nTarget: ${{target}}'),
  ('admin_entering', 'entering', 'ENTERING {{symbol}} {{direction}}',
   '{{admin_name}} is entering {{symbol}}\nEntry: ${{entry}}\nStop: ${{stop}}\nTargets: {{targets}}'),
  ('earnings_reminder', 'earnings', '{{symbol}} Earnings {{time}}',
   '{{symbol}} reports earnings {{when}}\nExpected EPS: {{expected_eps}}\nConsider adjusting positions.')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- MARKET DATA CACHE
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
-- YOUTUBE VIDEOS (Knowledge Base)
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
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS key_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS detected_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS setup_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mtf_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS economic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS event_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS strategy_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alert_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS youtube_videos ENABLE ROW LEVEL SECURITY;

-- Service role policies
DROP POLICY IF EXISTS "Service role full access" ON user_roles;
CREATE POLICY "Service role full access" ON user_roles FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON user_role_assignments;
CREATE POLICY "Service role full access" ON user_role_assignments FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON watchlists;
CREATE POLICY "Service role full access" ON watchlists FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON key_levels;
CREATE POLICY "Service role full access" ON key_levels FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON detected_setups;
CREATE POLICY "Service role full access" ON detected_setups FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON setup_subscriptions;
CREATE POLICY "Service role full access" ON setup_subscriptions FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON mtf_analysis;
CREATE POLICY "Service role full access" ON mtf_analysis FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON market_context;
CREATE POLICY "Service role full access" ON market_context FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON economic_events;
CREATE POLICY "Service role full access" ON economic_events FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON event_alerts;
CREATE POLICY "Service role full access" ON event_alerts FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON admin_alerts;
CREATE POLICY "Service role full access" ON admin_alerts FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON strategy_configs;
CREATE POLICY "Service role full access" ON strategy_configs FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON alert_templates;
CREATE POLICY "Service role full access" ON alert_templates FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON market_data_cache;
CREATE POLICY "Service role full access" ON market_data_cache FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access" ON youtube_videos;
CREATE POLICY "Service role full access" ON youtube_videos FOR ALL TO service_role USING (true);

-- Authenticated read policies
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

DROP POLICY IF EXISTS "Authenticated read active" ON admin_alerts;
CREATE POLICY "Authenticated read active" ON admin_alerts FOR SELECT TO authenticated USING (is_active = true);

-- User's own data policies
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

-- Enable realtime (safe - ignore if already added)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE detected_setups; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE key_levels; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE market_context; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE admin_alerts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
