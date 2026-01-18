-- ============================================
-- KCU Coach - Update get_latest_briefing function
-- ============================================
-- Now returns the most recent briefing and includes earnings column

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
  lesson_of_day JSONB,
  earnings JSONB
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
    b.lesson_of_day,
    b.earnings
  FROM briefings b
  WHERE b.briefing_type = p_type
  ORDER BY b.generated_at DESC
  LIMIT 1;
END;
$$;
