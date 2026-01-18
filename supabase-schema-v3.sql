-- KCU Trading Coach - Schema V3 (Companion Mode & Enhanced Features)
-- Run this AFTER supabase-schema.sql and supabase-schema-v2.sql

-- ============================================
-- ROLE & PERMISSION SYSTEM
-- ============================================

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
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
  }');

CREATE TABLE user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES user_profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_role_assignments_user ON user_role_assignments(user_id);

-- ============================================
-- WATCHLIST SYSTEM
-- ============================================

CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT FALSE,
  is_admin_watchlist BOOLEAN DEFAULT FALSE,
  symbols TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_watchlists_owner ON watchlists(owner_id);
CREATE INDEX idx_watchlists_shared ON watchlists(is_shared) WHERE is_shared = TRUE;

-- ============================================
-- KEY LEVELS
-- ============================================

CREATE TABLE key_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  level_type TEXT NOT NULL,  -- pdh, pdl, pdc, orb_high, orb_low, vwap, ema_9, ema_21, sma_200, etc.
  timeframe TEXT,  -- intraday, daily, weekly, monthly
  price DECIMAL(12, 4) NOT NULL,
  strength INTEGER DEFAULT 50,  -- 0-100 strength of level
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_key_levels_symbol ON key_levels(symbol);
CREATE INDEX idx_key_levels_type ON key_levels(level_type);
CREATE INDEX idx_key_levels_expires ON key_levels(expires_at);

-- ============================================
-- DETECTED SETUPS
-- ============================================

CREATE TABLE detected_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,  -- bullish, bearish
  setup_stage TEXT NOT NULL DEFAULT 'forming',  -- forming, ready, triggered, expired

  -- Scoring
  confluence_score INTEGER DEFAULT 0,  -- 0-100 overall score
  level_score INTEGER DEFAULT 0,  -- L score
  trend_score INTEGER DEFAULT 0,  -- T score
  patience_score INTEGER DEFAULT 0,  -- P score
  mtf_score INTEGER DEFAULT 0,  -- Multi-timeframe alignment score

  -- Level info
  primary_level_type TEXT,
  primary_level_price DECIMAL(12, 4),
  patience_candles INTEGER DEFAULT 0,

  -- Trade parameters
  suggested_entry DECIMAL(12, 4),
  suggested_stop DECIMAL(12, 4),
  target_1 DECIMAL(12, 4),
  target_2 DECIMAL(12, 4),
  target_3 DECIMAL(12, 4),  -- HTF target
  risk_reward DECIMAL(5, 2),

  -- AI coaching
  coach_note TEXT,

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  triggered_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,

  -- Source
  detected_by TEXT DEFAULT 'system'  -- 'system' or user_id for manual
);

CREATE INDEX idx_detected_setups_symbol ON detected_setups(symbol);
CREATE INDEX idx_detected_setups_stage ON detected_setups(setup_stage);
CREATE INDEX idx_detected_setups_score ON detected_setups(confluence_score DESC);

-- ============================================
-- SETUP SUBSCRIPTIONS
-- ============================================

CREATE TABLE setup_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  setup_id UUID REFERENCES detected_setups(id) ON DELETE CASCADE,
  notify_on_ready BOOLEAN DEFAULT TRUE,
  notify_on_trigger BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, setup_id)
);

CREATE INDEX idx_setup_subscriptions_user ON setup_subscriptions(user_id);
CREATE INDEX idx_setup_subscriptions_setup ON setup_subscriptions(setup_id);

-- ============================================
-- MTF ANALYSIS
-- ============================================

CREATE TABLE mtf_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,  -- 2m, 5m, 10m, 15m, 1h, 4h, daily, weekly

  trend TEXT,  -- bullish, bearish, neutral
  structure TEXT,  -- uptrend, downtrend, range
  ema_position TEXT,  -- above_all, below_all, mixed
  orb_status TEXT,  -- above, below, inside
  vwap_position TEXT,  -- above, below
  key_level_proximity DECIMAL(5, 2),  -- Distance to nearest level (%)
  momentum TEXT,  -- strong, moderate, weak

  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_mtf_analysis_symbol ON mtf_analysis(symbol);
CREATE INDEX idx_mtf_analysis_timeframe ON mtf_analysis(timeframe);
CREATE UNIQUE INDEX idx_mtf_analysis_unique ON mtf_analysis(symbol, timeframe);

-- ============================================
-- MARKET CONTEXT
-- ============================================

CREATE TABLE market_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_status TEXT,  -- pre, open, after, closed
  spy_trend TEXT,  -- bullish, bearish, neutral
  qqq_trend TEXT,
  vix_level DECIMAL(6, 2),
  vix_trend TEXT,  -- rising, falling, stable
  market_breadth TEXT,  -- strong, weak, mixed
  sector_leaders JSONB,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ECONOMIC EVENTS
-- ============================================

CREATE TABLE economic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,  -- earnings, fed, economic, dividend
  symbol TEXT,  -- NULL for macro events
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  importance TEXT DEFAULT 'medium',  -- high, medium, low

  expected_value TEXT,
  actual_value TEXT,
  surprise TEXT,  -- beat, miss, inline

  notes TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_economic_events_date ON economic_events(event_date);
CREATE INDEX idx_economic_events_symbol ON economic_events(symbol);
CREATE INDEX idx_economic_events_type ON economic_events(event_type);

-- ============================================
-- EVENT ALERTS
-- ============================================

CREATE TABLE event_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES economic_events(id) ON DELETE CASCADE,
  alert_before INTERVAL DEFAULT '1 hour',
  notified BOOLEAN DEFAULT FALSE,

  UNIQUE(user_id, event_id)
);

-- ============================================
-- ADMIN ALERTS
-- ============================================

CREATE TABLE admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES user_profiles(id),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,  -- long, short

  alert_type TEXT NOT NULL,  -- loading, entering, adding, take_profit, exiting, stopped_out, update

  contract TEXT,  -- For options: "NVDA 150C 1/19"
  entry_price DECIMAL(12, 4),
  stop_loss DECIMAL(12, 4),
  targets DECIMAL(12, 4)[],

  message TEXT,
  ltp_justification TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_admin_alerts_symbol ON admin_alerts(symbol);
CREATE INDEX idx_admin_alerts_created ON admin_alerts(created_at DESC);

-- ============================================
-- STRATEGY CONFIGURATION (Super Admin)
-- ============================================

CREATE TABLE strategy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,  -- ltp, mtf, alerts, ai
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default LTP configuration
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
  }');

-- ============================================
-- ALERT TEMPLATES
-- ============================================

CREATE TABLE alert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  title_template TEXT NOT NULL,  -- Uses {{symbol}}, {{direction}}, etc.
  body_template TEXT NOT NULL,
  channels TEXT[] DEFAULT ARRAY['web', 'discord'],
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default templates
INSERT INTO alert_templates (name, alert_type, title_template, body_template) VALUES
  ('setup_ready', 'setup_ready', '{{symbol}} Setup Ready!',
   'LTP Confluence: {{confluence_score}}%\nDirection: {{direction}}\nEntry: ${{entry}}\nStop: ${{stop}}\nTarget: ${{target}}'),
  ('admin_entering', 'entering', 'ENTERING {{symbol}} {{direction}}',
   '{{admin_name}} is entering {{symbol}}\nEntry: ${{entry}}\nStop: ${{stop}}\nTargets: {{targets}}'),
  ('earnings_reminder', 'earnings', '{{symbol}} Earnings {{time}}',
   '{{symbol}} reports earnings {{when}}\nExpected EPS: {{expected_eps}}\nConsider adjusting positions.');

-- ============================================
-- MARKET DATA CACHE
-- ============================================

CREATE TABLE market_data_cache (
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

CREATE TABLE youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  published_at TIMESTAMP WITH TIME ZONE,
  topics TEXT[],
  transcript_status TEXT DEFAULT 'pending',  -- pending, processing, complete, failed
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_youtube_videos_status ON youtube_videos(transcript_status);
CREATE INDEX idx_youtube_videos_topics ON youtube_videos USING GIN(topics);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtf_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role access" ON user_roles FOR ALL USING (true);
CREATE POLICY "Service role access" ON user_role_assignments FOR ALL USING (true);
CREATE POLICY "Service role access" ON watchlists FOR ALL USING (true);
CREATE POLICY "Service role access" ON key_levels FOR ALL USING (true);
CREATE POLICY "Service role access" ON detected_setups FOR ALL USING (true);
CREATE POLICY "Service role access" ON setup_subscriptions FOR ALL USING (true);
CREATE POLICY "Service role access" ON mtf_analysis FOR ALL USING (true);
CREATE POLICY "Service role access" ON market_context FOR ALL USING (true);
CREATE POLICY "Service role access" ON economic_events FOR ALL USING (true);
CREATE POLICY "Service role access" ON event_alerts FOR ALL USING (true);
CREATE POLICY "Service role access" ON admin_alerts FOR ALL USING (true);
CREATE POLICY "Service role access" ON strategy_configs FOR ALL USING (true);
CREATE POLICY "Service role access" ON alert_templates FOR ALL USING (true);
CREATE POLICY "Service role access" ON market_data_cache FOR ALL USING (true);
CREATE POLICY "Service role access" ON youtube_videos FOR ALL USING (true);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE detected_setups;
ALTER PUBLICATION supabase_realtime ADD TABLE key_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE market_context;
ALTER PUBLICATION supabase_realtime ADD TABLE admin_alerts;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's effective permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
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

-- Check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_permission BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE((get_user_permissions(p_user_id) ->> p_permission)::boolean, false)
  INTO v_has_permission;

  RETURN v_has_permission;
END;
$$;

-- Calculate MTF alignment score
CREATE OR REPLACE FUNCTION calculate_mtf_alignment(p_symbol TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_score INTEGER := 0;
  v_weights JSONB;
  v_primary_trend TEXT;
  rec RECORD;
BEGIN
  -- Get weights from config
  SELECT config -> 'weights' INTO v_weights
  FROM strategy_configs
  WHERE name = 'mtf_timeframes' AND is_active = TRUE;

  IF v_weights IS NULL THEN
    v_weights := '{"weekly": 0.15, "daily": 0.20, "4h": 0.15, "1h": 0.20, "15m": 0.15, "5m": 0.10, "2m": 0.05}';
  END IF;

  -- Get primary trend from daily
  SELECT trend INTO v_primary_trend
  FROM mtf_analysis
  WHERE symbol = p_symbol AND timeframe = 'daily'
  ORDER BY calculated_at DESC
  LIMIT 1;

  IF v_primary_trend IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate weighted alignment
  FOR rec IN
    SELECT timeframe, trend
    FROM mtf_analysis
    WHERE symbol = p_symbol
      AND calculated_at > NOW() - INTERVAL '1 hour'
  LOOP
    IF rec.trend = v_primary_trend THEN
      v_score := v_score + COALESCE((v_weights ->> rec.timeframe)::decimal * 100, 0)::INTEGER;
    END IF;
  END LOOP;

  RETURN v_score;
END;
$$;
