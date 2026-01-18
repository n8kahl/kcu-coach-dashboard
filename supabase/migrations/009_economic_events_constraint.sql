-- ============================================
-- KCU Coach - Economic Events Constraint
-- ============================================
-- Adds unique constraint for upsert operations

-- Add unique constraint on event_date and event_name for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'economic_events_date_name_unique'
  ) THEN
    ALTER TABLE economic_events
    ADD CONSTRAINT economic_events_date_name_unique
    UNIQUE (event_date, event_name);
  END IF;
END $$;
