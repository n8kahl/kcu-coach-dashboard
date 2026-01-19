-- ============================================
-- KCU Coach - Practice Mode Enhancements
-- ============================================
-- Adds multi-timeframe data, daily challenges, AI scenarios,
-- and advanced gamification for practice mode.

-- ============================================
-- 1. ENHANCE PRACTICE SCENARIOS FOR MULTI-TIMEFRAME
-- ============================================
-- Add multi-timeframe chart data storage
ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  multi_timeframe_data JSONB; -- { daily: [], hourly: [], fifteenMin: [], fiveMin: [], twoMin: [] }

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  indicators JSONB; -- { ema9: [], ema21: [], vwap: [], emaRibbon: {} }

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  patience_candles JSONB; -- [{ index, timestamp, type, nearLevel }]

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  ideal_entry JSONB; -- { price, stopLoss, target1, target2, riskReward }

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  market_context JSONB; -- { spy_trend, vix_level, sector, premarket }

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  ai_generated BOOLEAN DEFAULT false;

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  generation_prompt TEXT;

-- ============================================
-- 2. DAILY CHALLENGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS practice_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL,
  challenge_type VARCHAR(50) NOT NULL, -- daily_streak, accuracy_target, speed_run, focus_area, weekly_boss
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scenario_requirements JSONB DEFAULT '{}', -- { difficulty, focus_area, min_count, scenario_ids }
  target_count INTEGER DEFAULT 5,
  target_accuracy INTEGER DEFAULT 80,
  time_limit_seconds INTEGER, -- For speed challenges
  xp_reward INTEGER DEFAULT 50,
  badge_reward VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_challenges_date_type
ON practice_challenges(challenge_date, challenge_type);

CREATE INDEX IF NOT EXISTS idx_practice_challenges_active
ON practice_challenges(is_active, challenge_date);

-- ============================================
-- 3. CHALLENGE PROGRESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS practice_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES practice_challenges(id) ON DELETE CASCADE,
  attempts_completed INTEGER DEFAULT 0,
  correct_completed INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  xp_awarded INTEGER DEFAULT 0,
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_user
ON practice_challenge_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge
ON practice_challenge_progress(challenge_id);

-- ============================================
-- 4. PRACTICE ACHIEVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS practice_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type VARCHAR(100) NOT NULL,
  achievement_tier INTEGER DEFAULT 1, -- bronze, silver, gold, platinum
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  context JSONB DEFAULT '{}', -- { streak: 10, accuracy: 95, etc }
  UNIQUE(user_id, achievement_type, achievement_tier)
);

CREATE INDEX IF NOT EXISTS idx_practice_achievements_user
ON practice_achievements(user_id);

CREATE INDEX IF NOT EXISTS idx_practice_achievements_type
ON practice_achievements(achievement_type);

-- ============================================
-- 5. AI GENERATED SCENARIOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_generated_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scenario_id UUID REFERENCES practice_scenarios(id) ON DELETE CASCADE,
  generation_params JSONB NOT NULL, -- { difficulty, focus_area, symbol, setup_type }
  model_used VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  quality_score INTEGER, -- 1-100 based on user feedback
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_scenarios_user
ON ai_generated_scenarios(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_scenarios_quality
ON ai_generated_scenarios(quality_score);

-- ============================================
-- 6. USER XP & LEVELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_practice_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  xp_to_next_level INTEGER DEFAULT 100,
  unlocked_difficulties TEXT[] DEFAULT ARRAY['beginner'],
  unlocked_features TEXT[] DEFAULT ARRAY['standard_mode'],
  last_xp_earned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_xp_level
ON user_practice_xp(current_level DESC, total_xp DESC);

-- ============================================
-- 7. PRACTICE LEADERBOARD VIEW
-- ============================================
CREATE OR REPLACE VIEW practice_leaderboard AS
SELECT
  u.id as user_id,
  u.username,
  u.avatar_url,
  COALESCE(xp.total_xp, 0) as total_xp,
  COALESCE(xp.current_level, 1) as level,
  COUNT(DISTINCT pa.id) as total_attempts,
  COUNT(DISTINCT pa.id) FILTER (WHERE pa.is_correct) as correct_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pa.is_correct) / NULLIF(COUNT(*), 0), 1) as accuracy_percent,
  COALESCE(streak.current_count, 0) as current_streak,
  COALESCE(streak.best_count, 0) as best_streak,
  COUNT(DISTINCT DATE(pa.created_at)) as days_practiced,
  MAX(pa.created_at) as last_active
FROM users u
LEFT JOIN practice_attempts pa ON u.id = pa.user_id
LEFT JOIN user_practice_xp xp ON u.id = xp.user_id
LEFT JOIN practice_streaks streak ON u.id = streak.user_id AND streak.streak_type = 'correct_in_row'
GROUP BY u.id, u.username, u.avatar_url, xp.total_xp, xp.current_level, streak.current_count, streak.best_count
HAVING COUNT(DISTINCT pa.id) > 0
ORDER BY accuracy_percent DESC, total_xp DESC;

-- ============================================
-- 8. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE practice_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_practice_xp ENABLE ROW LEVEL SECURITY;

-- Challenges are public read
DROP POLICY IF EXISTS "Anyone can read active challenges" ON practice_challenges;
CREATE POLICY "Anyone can read active challenges"
ON practice_challenges FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can manage challenges
DROP POLICY IF EXISTS "Admins can manage challenges" ON practice_challenges;
CREATE POLICY "Admins can manage challenges"
ON practice_challenges FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

-- Users manage own challenge progress
DROP POLICY IF EXISTS "Users can manage own challenge progress" ON practice_challenge_progress;
CREATE POLICY "Users can manage own challenge progress"
ON practice_challenge_progress FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Users can read own achievements, everyone can see others
DROP POLICY IF EXISTS "Users can read achievements" ON practice_achievements;
CREATE POLICY "Users can read achievements"
ON practice_achievements FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can earn achievements" ON practice_achievements;
CREATE POLICY "Users can earn achievements"
ON practice_achievements FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- AI scenarios
DROP POLICY IF EXISTS "Users can manage own AI scenarios" ON ai_generated_scenarios;
CREATE POLICY "Users can manage own AI scenarios"
ON ai_generated_scenarios FOR ALL
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- XP table
DROP POLICY IF EXISTS "Users can manage own XP" ON user_practice_xp;
CREATE POLICY "Users can manage own XP"
ON user_practice_xp FOR ALL
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read all XP for leaderboard" ON user_practice_xp;
CREATE POLICY "Users can read all XP for leaderboard"
ON user_practice_xp FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- 9. FUNCTIONS FOR XP & LEVELING
-- ============================================

-- Calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level_from_xp(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Level formula: level = floor(sqrt(xp / 50)) + 1
  -- Level 1: 0-49 XP
  -- Level 2: 50-199 XP
  -- Level 3: 200-449 XP
  -- etc.
  RETURN FLOOR(SQRT(xp::FLOAT / 50)) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate XP needed for next level
CREATE OR REPLACE FUNCTION calculate_xp_for_level(level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Inverse of level formula
  RETURN 50 * POWER(level, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Award XP and update level
CREATE OR REPLACE FUNCTION award_xp(p_user_id UUID, p_xp_amount INTEGER)
RETURNS TABLE(new_total INTEGER, new_level INTEGER, leveled_up BOOLEAN) AS $$
DECLARE
  old_level INTEGER;
  new_total_xp INTEGER;
  new_user_level INTEGER;
BEGIN
  -- Ensure user has XP record
  INSERT INTO user_practice_xp (user_id, total_xp, current_level)
  VALUES (p_user_id, 0, 1)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current level
  SELECT current_level INTO old_level
  FROM user_practice_xp WHERE user_id = p_user_id;

  -- Update XP
  UPDATE user_practice_xp
  SET
    total_xp = total_xp + p_xp_amount,
    current_level = calculate_level_from_xp(total_xp + p_xp_amount),
    xp_to_next_level = calculate_xp_for_level(calculate_level_from_xp(total_xp + p_xp_amount) + 1) - (total_xp + p_xp_amount),
    last_xp_earned_at = NOW()
  WHERE user_id = p_user_id
  RETURNING total_xp, current_level INTO new_total_xp, new_user_level;

  -- Unlock difficulties based on level
  IF new_user_level >= 3 THEN
    UPDATE user_practice_xp
    SET unlocked_difficulties = ARRAY['beginner', 'intermediate']
    WHERE user_id = p_user_id AND NOT ('intermediate' = ANY(unlocked_difficulties));
  END IF;

  IF new_user_level >= 7 THEN
    UPDATE user_practice_xp
    SET unlocked_difficulties = ARRAY['beginner', 'intermediate', 'advanced']
    WHERE user_id = p_user_id AND NOT ('advanced' = ANY(unlocked_difficulties));
  END IF;

  RETURN QUERY SELECT new_total_xp, new_user_level, (new_user_level > old_level);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. TRIGGER TO AUTO-AWARD XP ON PRACTICE
-- ============================================
CREATE OR REPLACE FUNCTION auto_award_practice_xp()
RETURNS TRIGGER AS $$
DECLARE
  xp_amount INTEGER;
  scenario_difficulty TEXT;
BEGIN
  -- Get scenario difficulty
  SELECT difficulty INTO scenario_difficulty
  FROM practice_scenarios WHERE id = NEW.scenario_id;

  -- Calculate XP based on correctness and difficulty
  IF NEW.is_correct THEN
    CASE scenario_difficulty
      WHEN 'beginner' THEN xp_amount := 10;
      WHEN 'intermediate' THEN xp_amount := 20;
      WHEN 'advanced' THEN xp_amount := 35;
      ELSE xp_amount := 15;
    END CASE;
  ELSE
    xp_amount := 3; -- Participation XP
  END IF;

  -- Award XP
  PERFORM award_xp(NEW.user_id, xp_amount);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_award_xp_trigger ON practice_attempts;
CREATE TRIGGER auto_award_xp_trigger
AFTER INSERT ON practice_attempts
FOR EACH ROW
EXECUTE FUNCTION auto_award_practice_xp();

-- ============================================
-- 11. SEED INITIAL DAILY CHALLENGES
-- ============================================
INSERT INTO practice_challenges (challenge_date, challenge_type, title, description, target_count, target_accuracy, xp_reward)
VALUES
  (CURRENT_DATE, 'daily_streak', 'Daily Practice', 'Complete 5 practice scenarios today', 5, 0, 50),
  (CURRENT_DATE, 'accuracy_target', 'Accuracy Challenge', 'Achieve 80% accuracy on 10 scenarios', 10, 80, 100),
  (CURRENT_DATE, 'focus_area', 'Level Master', 'Practice 5 level-focused scenarios', 5, 0, 75)
ON CONFLICT (challenge_date, challenge_type) DO NOTHING;

-- Function to generate daily challenges (run via cron)
CREATE OR REPLACE FUNCTION generate_daily_challenges()
RETURNS void AS $$
BEGIN
  INSERT INTO practice_challenges (challenge_date, challenge_type, title, description, target_count, target_accuracy, xp_reward)
  VALUES
    (CURRENT_DATE, 'daily_streak', 'Daily Practice', 'Complete 5 practice scenarios today', 5, 0, 50),
    (CURRENT_DATE, 'accuracy_target', 'Accuracy Challenge', 'Achieve 80% accuracy on 10 scenarios', 10, 80, 100),
    (CURRENT_DATE, 'focus_area', 'Level Master', 'Practice 5 level-focused scenarios', 5, 0, 75)
  ON CONFLICT (challenge_date, challenge_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
