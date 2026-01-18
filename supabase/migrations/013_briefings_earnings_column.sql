-- ============================================
-- KCU Coach - Add earnings column to briefings
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
