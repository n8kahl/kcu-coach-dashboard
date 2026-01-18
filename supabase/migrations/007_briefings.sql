-- ============================================
-- KCU Coach - Daily Briefing System Migration
-- ============================================
-- Adds tables for briefing configuration and storage.

-- ============================================
-- 1. BRIEFING CONFIGURATION TABLE
-- ============================================
-- Stores configuration for different briefing types
CREATE TABLE IF NOT EXISTS briefing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_type TEXT NOT NULL UNIQUE, -- 'morning', 'eod', 'weekly'
  enabled BOOLEAN DEFAULT true,
  schedule_time TIME NOT NULL,
  schedule_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- 1=Mon, 5=Fri, 0=Sun
  template JSONB DEFAULT '{}',
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. BRIEFINGS TABLE
-- ============================================
-- Stores generated briefings
CREATE TABLE IF NOT EXISTS briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_type TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  content JSONB NOT NULL, -- Main briefing content
  market_context JSONB, -- SPY/QQQ status, VIX, etc.
  key_levels JSONB, -- Key levels for major symbols
  setups JSONB, -- Detected LTP setups
  economic_events JSONB, -- Today's economic events
  lesson_of_day JSONB, -- Selected lesson/tip
  generated_by TEXT DEFAULT 'system' -- 'system' or admin userId
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_briefings_type ON briefings(briefing_type);
CREATE INDEX IF NOT EXISTS idx_briefings_generated ON briefings(generated_at);

-- ============================================
-- 3. ECONOMIC EVENTS TABLE
-- ============================================
-- Stores economic calendar events
CREATE TABLE IF NOT EXISTS economic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  event_time TIME,
  event_name TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  impact TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  previous_value TEXT,
  forecast_value TEXT,
  actual_value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date lookup
CREATE INDEX IF NOT EXISTS idx_economic_events_date ON economic_events(event_date);

-- ============================================
-- 4. INSERT DEFAULT CONFIGS
-- ============================================
INSERT INTO briefing_configs (briefing_type, schedule_time, schedule_days, enabled) VALUES
  ('morning', '09:00:00', '{1,2,3,4,5}', true),
  ('eod', '16:30:00', '{1,2,3,4,5}', true),
  ('weekly', '18:00:00', '{0}', true) -- Sunday evening
ON CONFLICT (briefing_type) DO NOTHING;

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE briefing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_events ENABLE ROW LEVEL SECURITY;

-- Everyone can read briefings and events
DROP POLICY IF EXISTS "Anyone can read briefings" ON briefings;
CREATE POLICY "Anyone can read briefings"
ON briefings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can read economic events" ON economic_events;
CREATE POLICY "Anyone can read economic events"
ON economic_events FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can read briefing configs" ON briefing_configs;
CREATE POLICY "Anyone can read briefing configs"
ON briefing_configs FOR SELECT
TO authenticated
USING (true);

-- Admins can manage
DROP POLICY IF EXISTS "Admins can manage briefing configs" ON briefing_configs;
CREATE POLICY "Admins can manage briefing configs"
ON briefing_configs FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

DROP POLICY IF EXISTS "Admins can manage briefings" ON briefings;
CREATE POLICY "Admins can manage briefings"
ON briefings FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

DROP POLICY IF EXISTS "Admins can manage economic events" ON economic_events;
CREATE POLICY "Admins can manage economic events"
ON economic_events FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

-- ============================================
-- 6. HELPER FUNCTION: Get Latest Briefing
-- ============================================
CREATE OR REPLACE FUNCTION get_latest_briefing(p_type TEXT DEFAULT 'morning')
RETURNS TABLE (
  id UUID,
  briefing_type TEXT,
  generated_at TIMESTAMPTZ,
  content JSONB,
  market_context JSONB,
  key_levels JSONB,
  setups JSONB,
  economic_events JSONB,
  lesson_of_day JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.briefing_type,
    b.generated_at,
    b.content,
    b.market_context,
    b.key_levels,
    b.setups,
    b.economic_events,
    b.lesson_of_day
  FROM briefings b
  WHERE b.briefing_type = p_type
    AND b.generated_at >= CURRENT_DATE
  ORDER BY b.generated_at DESC
  LIMIT 1;
END;
$$;
