-- ============================================
-- KCU Coach - Earnings Calendar Migration
-- ============================================
-- Adds earnings calendar tracking for watchlist symbols

-- ============================================
-- 0. ADD EARNINGS COLUMN TO BRIEFINGS TABLE
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'briefings' AND column_name = 'earnings'
  ) THEN
    ALTER TABLE briefings ADD COLUMN earnings JSONB;
  END IF;
END $$;

-- Drop and recreate get_latest_briefing function to include earnings
DROP FUNCTION IF EXISTS get_latest_briefing(TEXT);
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
  earnings JSONB,
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
    b.earnings,
    b.lesson_of_day
  FROM briefings b
  WHERE b.briefing_type = p_type
    AND b.generated_at >= CURRENT_DATE
  ORDER BY b.generated_at DESC
  LIMIT 1;
END;
$$;

-- ============================================
-- 1. EARNINGS CALENDAR TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS earnings_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  company_name TEXT,
  report_date DATE NOT NULL,
  fiscal_quarter TEXT,
  fiscal_year INTEGER,
  report_time TEXT DEFAULT 'amc', -- 'bmo', 'amc', 'dmh'
  estimated_eps DECIMAL(10, 4),
  actual_eps DECIMAL(10, 4),
  estimated_revenue DECIMAL(20, 2),
  actual_revenue DECIMAL(20, 2),
  surprise DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, report_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_earnings_symbol ON earnings_calendar(symbol);
CREATE INDEX IF NOT EXISTS idx_earnings_date ON earnings_calendar(report_date);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE earnings_calendar ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read earnings data
DROP POLICY IF EXISTS "Authenticated users can read earnings" ON earnings_calendar;
CREATE POLICY "Authenticated users can read earnings"
ON earnings_calendar FOR SELECT
TO authenticated
USING (true);

-- Service role can manage earnings data
DROP POLICY IF EXISTS "Service role can manage earnings" ON earnings_calendar;
CREATE POLICY "Service role can manage earnings"
ON earnings_calendar FOR ALL
TO service_role
USING (true);

-- ============================================
-- 3. SAMPLE DATA (Popular symbols)
-- ============================================
-- Add some upcoming earnings for common symbols
-- Note: These are placeholder dates - would be updated by the sync job

-- You can manually add earnings or set up a scheduled job to fetch from API
