-- ============================================
-- KCU Coach - Practice Simulator Migration
-- ============================================
-- Adds tables for LTP practice scenarios and user attempts.

-- ============================================
-- 1. PRACTICE SCENARIOS TABLE
-- ============================================
-- Stores historical or custom trading scenarios for practice
CREATE TABLE IF NOT EXISTS practice_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  symbol TEXT NOT NULL,
  scenario_type TEXT NOT NULL, -- 'reversal', 'breakout', 'range', 'continuation', 'custom'
  difficulty TEXT DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced'
  chart_data JSONB NOT NULL, -- Historical OHLCV data up to decision point
  key_levels JSONB, -- Key levels at time of scenario
  decision_point TIMESTAMPTZ, -- The timestamp where trader must decide
  correct_action TEXT NOT NULL, -- 'long', 'short', 'wait'
  outcome_data JSONB, -- What happened after the decision point
  ltp_analysis JSONB, -- Expected LTP checklist evaluation
  explanation TEXT, -- Why this was the correct decision
  tags TEXT[], -- Tags for filtering (e.g., 'SPY', 'gap_fill', 'VWAP_bounce')
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for practice_scenarios
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_type ON practice_scenarios(scenario_type);
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_difficulty ON practice_scenarios(difficulty);
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_symbol ON practice_scenarios(symbol);
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_active ON practice_scenarios(is_active);

-- ============================================
-- 2. PRACTICE ATTEMPTS TABLE
-- ============================================
-- Tracks user practice attempts and their decisions
CREATE TABLE IF NOT EXISTS practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES practice_scenarios(id) ON DELETE CASCADE,
  decision TEXT NOT NULL, -- 'long', 'short', 'wait'
  reasoning TEXT, -- User's explanation
  ltp_checklist JSONB, -- User's LTP evaluation
  is_correct BOOLEAN NOT NULL,
  feedback TEXT, -- AI-generated feedback
  time_taken_seconds INTEGER, -- How long they took to decide
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for practice_attempts
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user ON practice_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_scenario ON practice_attempts(scenario_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_correct ON practice_attempts(is_correct);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_created ON practice_attempts(created_at);

-- ============================================
-- 3. USER PRACTICE STATS VIEW
-- ============================================
-- Aggregated practice statistics per user
CREATE OR REPLACE VIEW user_practice_stats AS
SELECT
  user_id,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE is_correct = true) as correct_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_correct = true) / NULLIF(COUNT(*), 0), 1) as accuracy_percent,
  COUNT(DISTINCT scenario_id) as unique_scenarios,
  AVG(time_taken_seconds) FILTER (WHERE time_taken_seconds IS NOT NULL) as avg_time_seconds,
  MAX(created_at) as last_practice_at
FROM practice_attempts
GROUP BY user_id;

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE practice_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;

-- Everyone can read active scenarios
DROP POLICY IF EXISTS "Anyone can read active scenarios" ON practice_scenarios;
CREATE POLICY "Anyone can read active scenarios"
ON practice_scenarios FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can manage scenarios
DROP POLICY IF EXISTS "Admins can manage scenarios" ON practice_scenarios;
CREATE POLICY "Admins can manage scenarios"
ON practice_scenarios FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

-- Users can read their own attempts
DROP POLICY IF EXISTS "Users can read own attempts" ON practice_attempts;
CREATE POLICY "Users can read own attempts"
ON practice_attempts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create their own attempts
DROP POLICY IF EXISTS "Users can create own attempts" ON practice_attempts;
CREATE POLICY "Users can create own attempts"
ON practice_attempts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can read all attempts
DROP POLICY IF EXISTS "Admins can read all attempts" ON practice_attempts;
CREATE POLICY "Admins can read all attempts"
ON practice_attempts FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

-- ============================================
-- 5. GAMIFICATION INTEGRATION
-- ============================================
-- Function to award XP for practice attempts
CREATE OR REPLACE FUNCTION award_practice_xp()
RETURNS TRIGGER AS $$
DECLARE
  xp_amount INTEGER;
BEGIN
  -- Award XP based on correctness
  IF NEW.is_correct THEN
    xp_amount := 25; -- Correct answer
  ELSE
    xp_amount := 5; -- Participation XP
  END IF;

  -- Update user's practice-related achievements could go here

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for XP (optional, can be handled in API)
DROP TRIGGER IF EXISTS practice_xp_trigger ON practice_attempts;
CREATE TRIGGER practice_xp_trigger
AFTER INSERT ON practice_attempts
FOR EACH ROW
EXECUTE FUNCTION award_practice_xp();
