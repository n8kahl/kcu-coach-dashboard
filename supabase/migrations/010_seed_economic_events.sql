-- ============================================
-- KCU Coach - Seed Economic Events
-- ============================================
-- Adds sample economic events for the dashboard

-- First ensure all columns exist
DO $$
BEGIN
  -- Add country column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'economic_events' AND column_name = 'country'
  ) THEN
    ALTER TABLE economic_events ADD COLUMN country TEXT DEFAULT 'US';
  END IF;

  -- Add impact column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'economic_events' AND column_name = 'impact'
  ) THEN
    ALTER TABLE economic_events ADD COLUMN impact TEXT DEFAULT 'medium';
  END IF;

  -- Add description column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'economic_events' AND column_name = 'description'
  ) THEN
    ALTER TABLE economic_events ADD COLUMN description TEXT;
  END IF;

  -- Drop NOT NULL constraint on event_type if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'economic_events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE economic_events ALTER COLUMN event_type DROP NOT NULL;
  END IF;
END $$;

-- Clear existing events
DELETE FROM economic_events;

-- Add upcoming key economic events
-- January 2026
INSERT INTO economic_events (event_date, event_time, event_name, country, impact, description)
VALUES
  ('2026-01-23', '08:30', 'Initial Jobless Claims', 'US', 'medium', 'Weekly unemployment claims'),
  ('2026-01-24', '10:00', 'Consumer Sentiment', 'US', 'medium', 'University of Michigan Survey'),
  ('2026-01-28', '10:00', 'New Home Sales', 'US', 'medium', 'Housing market indicator'),
  ('2026-01-29', '14:00', 'FOMC Interest Rate Decision', 'US', 'high', 'Federal Reserve rate decision'),
  ('2026-01-29', '14:30', 'Fed Chair Powell Press Conference', 'US', 'high', 'Fed policy guidance'),
  ('2026-01-30', '08:30', 'GDP', 'US', 'high', 'Q4 GDP Advance'),
  ('2026-01-30', '08:30', 'Initial Jobless Claims', 'US', 'medium', 'Weekly unemployment claims'),
  ('2026-01-31', '08:30', 'PCE Price Index', 'US', 'high', 'Fed preferred inflation measure'),

  -- February 2026
  ('2026-02-03', '10:00', 'ISM Manufacturing PMI', 'US', 'medium', 'Manufacturing sector health'),
  ('2026-02-05', '10:00', 'ISM Services PMI', 'US', 'medium', 'Services sector health'),
  ('2026-02-06', '08:30', 'Initial Jobless Claims', 'US', 'medium', 'Weekly unemployment claims'),
  ('2026-02-07', '08:30', 'Non-Farm Payrolls', 'US', 'high', 'Jobs report - major market mover'),
  ('2026-02-07', '08:30', 'Unemployment Rate', 'US', 'high', 'Monthly unemployment rate'),
  ('2026-02-12', '08:30', 'CPI (Consumer Price Index)', 'US', 'high', 'Key inflation indicator'),
  ('2026-02-13', '08:30', 'Initial Jobless Claims', 'US', 'medium', 'Weekly unemployment claims'),
  ('2026-02-14', '08:30', 'Retail Sales', 'US', 'medium', 'Consumer spending indicator'),
  ('2026-02-19', '14:00', 'FOMC Minutes', 'US', 'high', 'Federal Reserve meeting minutes'),
  ('2026-02-20', '08:30', 'Initial Jobless Claims', 'US', 'medium', 'Weekly unemployment claims'),
  ('2026-02-27', '08:30', 'Initial Jobless Claims', 'US', 'medium', 'Weekly unemployment claims'),
  ('2026-02-28', '08:30', 'PCE Price Index', 'US', 'high', 'Fed preferred inflation measure')
ON CONFLICT (event_date, event_name) DO NOTHING;
