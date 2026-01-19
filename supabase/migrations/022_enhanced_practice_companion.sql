-- ============================================
-- KCU Coach - Enhanced Practice & Companion Migration
-- ============================================
-- Adds comprehensive practice scenarios, AI coaching integration,
-- companion messaging, session tracking, and social features.

-- ============================================
-- 1. ENHANCE PRACTICE SCENARIOS TABLE
-- ============================================
-- Add new columns for richer scenario data
ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  source_type VARCHAR(50) DEFAULT 'manual'; -- manual, historical, live, companion

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  source_date TIMESTAMPTZ;

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  chart_timeframe VARCHAR(10) DEFAULT '5m';

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  related_lesson_slug VARCHAR(255);

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  ai_coaching_prompt TEXT;

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  community_attempts INTEGER DEFAULT 0;

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  community_accuracy DECIMAL(5,2) DEFAULT 0;

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  focus_area VARCHAR(50); -- level, trend, patience, mtf, psychology

ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS
  category VARCHAR(100); -- level_identification, trend_analysis, entry_timing, etc.

-- ============================================
-- 2. PRACTICE SESSIONS TABLE
-- ============================================
-- Track user practice sessions for analytics
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL DEFAULT 'standard', -- quick_drill, deep_analysis, live_replay, companion, adaptive
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  scenarios_attempted INTEGER DEFAULT 0,
  scenarios_correct INTEGER DEFAULT 0,
  avg_decision_time_seconds INTEGER,
  focus_area VARCHAR(50), -- level, trend, patience, all
  streak_at_end INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_mode ON practice_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_started ON practice_sessions(started_at);

-- ============================================
-- 3. COMPANION SESSIONS TABLE
-- ============================================
-- Track companion mode usage for reporting
CREATE TABLE IF NOT EXISTS companion_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  setups_detected INTEGER DEFAULT 0,
  setups_traded INTEGER DEFAULT 0,
  alerts_set INTEGER DEFAULT 0,
  alerts_triggered INTEGER DEFAULT 0,
  practice_attempts INTEGER DEFAULT 0,
  symbols_watched TEXT[],
  best_setup_symbol VARCHAR(20),
  best_setup_confluence INTEGER,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_companion_sessions_user ON companion_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_sessions_started ON companion_sessions(started_at);

-- ============================================
-- 4. AI COMPANION MESSAGES TABLE
-- ============================================
-- Store AI-generated coaching messages for companion mode
CREATE TABLE IF NOT EXISTS companion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES companion_sessions(id) ON DELETE SET NULL,
  message_type VARCHAR(50) NOT NULL, -- info, warning, action, education, milestone, risk, coaching
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  title VARCHAR(255),
  message TEXT NOT NULL,
  rich_content TEXT, -- [[LESSON:...]] format markers
  symbol VARCHAR(20),
  setup_id UUID,
  context JSONB DEFAULT '{}', -- Additional context data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_companion_messages_user ON companion_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_messages_type ON companion_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_companion_messages_created ON companion_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_companion_messages_symbol ON companion_messages(symbol);

-- ============================================
-- 5. PRACTICE STREAKS TABLE
-- ============================================
-- Track practice streaks for gamification
CREATE TABLE IF NOT EXISTS practice_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  streak_type VARCHAR(50) NOT NULL, -- daily, correct_in_row, session
  current_count INTEGER DEFAULT 0,
  best_count INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_streaks_user_type ON practice_streaks(user_id, streak_type);

-- ============================================
-- 6. PRACTICE WIN CARDS TABLE
-- ============================================
-- Link practice achievements to win cards
CREATE TABLE IF NOT EXISTS practice_win_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  win_card_type VARCHAR(50) NOT NULL, -- streak, accuracy, milestone, perfect_session
  title VARCHAR(255) NOT NULL,
  description TEXT,
  stats JSONB NOT NULL, -- { streak: 10, accuracy: 95, etc }
  template VARCHAR(50) DEFAULT 'practice_streak',
  shared_at TIMESTAMPTZ,
  share_platforms TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_win_cards_user ON practice_win_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_win_cards_type ON practice_win_cards(win_card_type);

-- ============================================
-- 7. COMPANION SETUP SHARES TABLE
-- ============================================
-- Track shared companion setups
CREATE TABLE IF NOT EXISTS companion_setup_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setup_id UUID NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  confluence_score INTEGER,
  shared_platforms TEXT[],
  caption TEXT,
  image_url TEXT,
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  engagement_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_companion_setup_shares_user ON companion_setup_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_setup_shares_symbol ON companion_setup_shares(symbol);

-- ============================================
-- 8. ENHANCED PRACTICE ATTEMPTS
-- ============================================
-- Add AI coaching fields to practice attempts
ALTER TABLE practice_attempts ADD COLUMN IF NOT EXISTS
  ai_coaching_response TEXT;

ALTER TABLE practice_attempts ADD COLUMN IF NOT EXISTS
  rich_content JSONB;

ALTER TABLE practice_attempts ADD COLUMN IF NOT EXISTS
  session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL;

ALTER TABLE practice_attempts ADD COLUMN IF NOT EXISTS
  source VARCHAR(50) DEFAULT 'practice'; -- practice, companion, adaptive

ALTER TABLE practice_attempts ADD COLUMN IF NOT EXISTS
  emotion_tag VARCHAR(50); -- confident, uncertain, rushed, patient

-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_win_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_setup_shares ENABLE ROW LEVEL SECURITY;

-- Practice sessions policies
DROP POLICY IF EXISTS "Users can manage own practice sessions" ON practice_sessions;
CREATE POLICY "Users can manage own practice sessions"
ON practice_sessions FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Companion sessions policies
DROP POLICY IF EXISTS "Users can manage own companion sessions" ON companion_sessions;
CREATE POLICY "Users can manage own companion sessions"
ON companion_sessions FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Companion messages policies
DROP POLICY IF EXISTS "Users can read own companion messages" ON companion_messages;
CREATE POLICY "Users can read own companion messages"
ON companion_messages FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "System can create companion messages" ON companion_messages;
CREATE POLICY "System can create companion messages"
ON companion_messages FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own companion messages" ON companion_messages;
CREATE POLICY "Users can update own companion messages"
ON companion_messages FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Practice streaks policies
DROP POLICY IF EXISTS "Users can manage own practice streaks" ON practice_streaks;
CREATE POLICY "Users can manage own practice streaks"
ON practice_streaks FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Practice win cards policies
DROP POLICY IF EXISTS "Users can manage own practice win cards" ON practice_win_cards;
CREATE POLICY "Users can manage own practice win cards"
ON practice_win_cards FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Companion setup shares policies
DROP POLICY IF EXISTS "Users can manage own companion setup shares" ON companion_setup_shares;
CREATE POLICY "Users can manage own companion setup shares"
ON companion_setup_shares FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Admins can read all
DROP POLICY IF EXISTS "Admins can read all practice sessions" ON practice_sessions;
CREATE POLICY "Admins can read all practice sessions"
ON practice_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

DROP POLICY IF EXISTS "Admins can read all companion sessions" ON companion_sessions;
CREATE POLICY "Admins can read all companion sessions"
ON companion_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
);

-- ============================================
-- 10. FUNCTIONS FOR PRACTICE ANALYTICS
-- ============================================

-- Function to update community stats on practice attempts
CREATE OR REPLACE FUNCTION update_scenario_community_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE practice_scenarios
  SET
    community_attempts = (
      SELECT COUNT(*) FROM practice_attempts WHERE scenario_id = NEW.scenario_id
    ),
    community_accuracy = (
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE is_correct) / NULLIF(COUNT(*), 0), 2)
      FROM practice_attempts WHERE scenario_id = NEW.scenario_id
    )
  WHERE id = NEW.scenario_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scenario_stats_trigger ON practice_attempts;
CREATE TRIGGER update_scenario_stats_trigger
AFTER INSERT ON practice_attempts
FOR EACH ROW
EXECUTE FUNCTION update_scenario_community_stats();

-- Function to update practice streaks
CREATE OR REPLACE FUNCTION update_practice_streak()
RETURNS TRIGGER AS $$
DECLARE
  current_streak INTEGER;
  best_streak INTEGER;
BEGIN
  -- Get or create streak record
  INSERT INTO practice_streaks (user_id, streak_type, current_count, best_count)
  VALUES (NEW.user_id, 'correct_in_row', 0, 0)
  ON CONFLICT (user_id, streak_type) DO NOTHING;

  IF NEW.is_correct THEN
    -- Increment streak
    UPDATE practice_streaks
    SET
      current_count = current_count + 1,
      best_count = GREATEST(best_count, current_count + 1),
      last_activity_at = NOW()
    WHERE user_id = NEW.user_id AND streak_type = 'correct_in_row';
  ELSE
    -- Reset streak
    UPDATE practice_streaks
    SET
      current_count = 0,
      last_activity_at = NOW()
    WHERE user_id = NEW.user_id AND streak_type = 'correct_in_row';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS practice_streak_trigger ON practice_attempts;
CREATE TRIGGER practice_streak_trigger
AFTER INSERT ON practice_attempts
FOR EACH ROW
EXECUTE FUNCTION update_practice_streak();

-- ============================================
-- 11. VIEWS FOR ANALYTICS
-- ============================================

-- Enhanced practice stats view with session data
CREATE OR REPLACE VIEW user_practice_analytics AS
SELECT
  u.id as user_id,
  u.username,
  COUNT(DISTINCT pa.id) as total_attempts,
  COUNT(DISTINCT pa.id) FILTER (WHERE pa.is_correct) as correct_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pa.is_correct) / NULLIF(COUNT(*), 0), 1) as accuracy_percent,
  COUNT(DISTINCT pa.scenario_id) as unique_scenarios,
  AVG(pa.time_taken_seconds) FILTER (WHERE pa.time_taken_seconds IS NOT NULL) as avg_time_seconds,
  MAX(pa.created_at) as last_practice_at,
  COUNT(DISTINCT ps.id) as total_sessions,
  COALESCE(streak.current_count, 0) as current_streak,
  COALESCE(streak.best_count, 0) as best_streak,
  COUNT(DISTINCT DATE(pa.created_at)) as days_practiced
FROM users u
LEFT JOIN practice_attempts pa ON u.id = pa.user_id
LEFT JOIN practice_sessions ps ON u.id = ps.user_id
LEFT JOIN practice_streaks streak ON u.id = streak.user_id AND streak.streak_type = 'correct_in_row'
GROUP BY u.id, u.username, streak.current_count, streak.best_count;

-- Companion usage analytics view
CREATE OR REPLACE VIEW user_companion_analytics AS
SELECT
  u.id as user_id,
  u.username,
  COUNT(DISTINCT cs.id) as total_sessions,
  SUM(cs.setups_detected) as total_setups_detected,
  SUM(cs.setups_traded) as total_setups_traded,
  SUM(cs.alerts_set) as total_alerts_set,
  SUM(cs.alerts_triggered) as total_alerts_triggered,
  SUM(cs.practice_attempts) as practice_from_companion,
  AVG(EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at))/60) as avg_session_minutes,
  MAX(cs.started_at) as last_session_at
FROM users u
LEFT JOIN companion_sessions cs ON u.id = cs.user_id
GROUP BY u.id, u.username;

-- ============================================
-- 12. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_focus ON practice_scenarios(focus_area);
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_category ON practice_scenarios(category);
CREATE INDEX IF NOT EXISTS idx_practice_scenarios_source ON practice_scenarios(source_type);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_session ON practice_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_source ON practice_attempts(source);
