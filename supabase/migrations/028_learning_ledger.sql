-- ============================================
-- KCU Coach - Learning Ledger Migration
-- ============================================
-- Creates the "Black Box" compliance audit trail
-- for tracking all significant learning actions

-- ============================================
-- LEARNING AUDIT LOGS TABLE
-- ============================================
-- Core compliance table tracking every significant action
CREATE TABLE IF NOT EXISTS learning_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Resource identification
  resource_id UUID,
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('lesson', 'quiz', 'module', 'course', 'video', 'practice')
  ),

  -- Action tracking
  action TEXT NOT NULL CHECK (
    action IN (
      'started',
      'completed',
      'quiz_attempt',
      'quiz_passed',
      'quiz_failed',
      'video_segment_watched',
      'video_paused',
      'video_resumed',
      'video_seeked',
      'video_speed_changed',
      'module_unlocked',
      'certificate_earned',
      'bookmark_created',
      'note_added'
    )
  ),

  -- Duration tracking (for compliance)
  duration_seconds INTEGER DEFAULT 0,

  -- Flexible metadata for action-specific data
  -- Examples:
  --   quiz_attempt: { score: 85, passed: true, attempt_number: 2, questions_correct: 17, questions_total: 20 }
  --   video_segment_watched: { start_time: 120, end_time: 180, playback_speed: 1.0 }
  --   video_seeked: { from_time: 30, to_time: 120, direction: 'forward' }
  --   video_speed_changed: { old_speed: 1.0, new_speed: 1.5 }
  metadata JSONB DEFAULT '{}',

  -- Resource context (denormalized for fast reporting)
  resource_title TEXT,
  module_id UUID,
  module_title TEXT,
  course_id UUID,
  course_title TEXT,

  -- Client information (for debugging/compliance)
  client_info JSONB DEFAULT '{}',
  -- { device_type: 'desktop', browser: 'Chrome', ip_hash: 'abc123', user_agent: '...' }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id UUID -- Group related actions in a viewing session
);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_learning_audit_user_id
  ON learning_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_learning_audit_created_at
  ON learning_audit_logs(created_at DESC);

-- Composite index for user timeline queries
CREATE INDEX IF NOT EXISTS idx_learning_audit_user_timeline
  ON learning_audit_logs(user_id, created_at DESC);

-- Resource-specific lookups
CREATE INDEX IF NOT EXISTS idx_learning_audit_resource
  ON learning_audit_logs(resource_type, resource_id);

-- Action-based filtering
CREATE INDEX IF NOT EXISTS idx_learning_audit_action
  ON learning_audit_logs(action);

-- Session grouping
CREATE INDEX IF NOT EXISTS idx_learning_audit_session
  ON learning_audit_logs(session_id)
  WHERE session_id IS NOT NULL;

-- Module/Course aggregation
CREATE INDEX IF NOT EXISTS idx_learning_audit_module
  ON learning_audit_logs(module_id)
  WHERE module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_audit_course
  ON learning_audit_logs(course_id)
  WHERE course_id IS NOT NULL;

-- Date-based reporting (for analytics)
CREATE INDEX IF NOT EXISTS idx_learning_audit_date
  ON learning_audit_logs(DATE(created_at));

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE learning_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON learning_audit_logs;
CREATE POLICY "Users can view own audit logs"
ON learning_audit_logs FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON learning_audit_logs;
CREATE POLICY "Admins can view all audit logs"
ON learning_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Service role can manage all audit logs
DROP POLICY IF EXISTS "Service role manages audit logs" ON learning_audit_logs;
CREATE POLICY "Service role manages audit logs"
ON learning_audit_logs FOR ALL
TO service_role
USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate user's total study time
CREATE OR REPLACE FUNCTION get_user_total_study_time(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(duration_seconds), 0)::INTEGER
  FROM learning_audit_logs
  WHERE user_id = p_user_id
    AND action IN ('video_segment_watched', 'quiz_attempt', 'completed')
$$ LANGUAGE SQL STABLE;

-- Function to calculate user's average quiz score
CREATE OR REPLACE FUNCTION get_user_average_quiz_score(p_user_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(AVG((metadata->>'score')::NUMERIC), 0)
  FROM learning_audit_logs
  WHERE user_id = p_user_id
    AND action = 'quiz_attempt'
    AND metadata->>'score' IS NOT NULL
$$ LANGUAGE SQL STABLE;

-- Function to get user's lesson completion count
CREATE OR REPLACE FUNCTION get_user_lessons_completed(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT resource_id)::INTEGER
  FROM learning_audit_logs
  WHERE user_id = p_user_id
    AND resource_type = 'lesson'
    AND action = 'completed'
$$ LANGUAGE SQL STABLE;

-- Function to calculate consistency score (0-100)
-- Based on unique days with activity over last 30 days
CREATE OR REPLACE FUNCTION get_user_consistency_score(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT LEAST(100, (
    COUNT(DISTINCT DATE(created_at))::INTEGER * 100 / 30
  ))
  FROM learning_audit_logs
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '30 days'
$$ LANGUAGE SQL STABLE;

-- Function to get user's study rank (percentile among all users)
CREATE OR REPLACE FUNCTION get_user_study_rank(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  user_time INTEGER;
  total_users INTEGER;
  users_below INTEGER;
BEGIN
  -- Get this user's total time
  SELECT get_user_total_study_time(p_user_id) INTO user_time;

  -- Get total active users
  SELECT COUNT(DISTINCT user_id)::INTEGER INTO total_users
  FROM learning_audit_logs;

  IF total_users = 0 THEN RETURN 100; END IF;

  -- Count users with less study time
  SELECT COUNT(*)::INTEGER INTO users_below
  FROM (
    SELECT user_id, SUM(duration_seconds) as total_time
    FROM learning_audit_logs
    WHERE action IN ('video_segment_watched', 'quiz_attempt', 'completed')
    GROUP BY user_id
    HAVING SUM(duration_seconds) < user_time
  ) sub;

  -- Return percentile rank (1 = top, 100 = bottom)
  RETURN GREATEST(1, 100 - ((users_below * 100) / GREATEST(total_users, 1)));
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get module time breakdown
CREATE OR REPLACE FUNCTION get_user_module_time_breakdown(p_user_id UUID)
RETURNS TABLE (
  module_id UUID,
  module_title TEXT,
  total_seconds INTEGER,
  lesson_count INTEGER,
  quiz_count INTEGER
) AS $$
  SELECT
    l.module_id,
    l.module_title,
    COALESCE(SUM(l.duration_seconds), 0)::INTEGER as total_seconds,
    COUNT(DISTINCT CASE WHEN l.action IN ('started', 'completed') THEN l.resource_id END)::INTEGER as lesson_count,
    COUNT(CASE WHEN l.action = 'quiz_attempt' THEN 1 END)::INTEGER as quiz_count
  FROM learning_audit_logs l
  WHERE l.user_id = p_user_id
    AND l.module_id IS NOT NULL
  GROUP BY l.module_id, l.module_title
  ORDER BY total_seconds DESC
$$ LANGUAGE SQL STABLE;

-- Function to get transcript summary
CREATE OR REPLACE FUNCTION get_user_transcript_summary(p_user_id UUID)
RETURNS TABLE (
  total_time INTEGER,
  lessons_completed INTEGER,
  average_quiz_score NUMERIC,
  consistency_score INTEGER,
  global_rank INTEGER,
  modules_completed INTEGER,
  quizzes_passed INTEGER,
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ
) AS $$
  SELECT
    get_user_total_study_time(p_user_id) as total_time,
    get_user_lessons_completed(p_user_id) as lessons_completed,
    get_user_average_quiz_score(p_user_id) as average_quiz_score,
    get_user_consistency_score(p_user_id) as consistency_score,
    get_user_study_rank(p_user_id) as global_rank,
    (
      SELECT COUNT(DISTINCT module_id)::INTEGER
      FROM learning_audit_logs
      WHERE user_id = p_user_id
        AND action = 'completed'
        AND resource_type = 'module'
    ) as modules_completed,
    (
      SELECT COUNT(*)::INTEGER
      FROM learning_audit_logs
      WHERE user_id = p_user_id
        AND action = 'quiz_passed'
    ) as quizzes_passed,
    (SELECT MIN(created_at) FROM learning_audit_logs WHERE user_id = p_user_id) as first_activity_at,
    (SELECT MAX(created_at) FROM learning_audit_logs WHERE user_id = p_user_id) as last_activity_at
$$ LANGUAGE SQL STABLE;

-- ============================================
-- COMPLETED ACHIEVEMENTS TRACKING
-- ============================================

-- Table to track which achievements/badges user has earned
CREATE TABLE IF NOT EXISTS user_learning_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_slug TEXT NOT NULL,
  achievement_title TEXT NOT NULL,
  achievement_description TEXT,
  achievement_icon TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_learning_achievements(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_earned
  ON user_learning_achievements(earned_at DESC);

ALTER TABLE user_learning_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own achievements" ON user_learning_achievements;
CREATE POLICY "Users can view own achievements"
ON user_learning_achievements FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages achievements" ON user_learning_achievements;
CREATE POLICY "Service role manages achievements"
ON user_learning_achievements FOR ALL
TO service_role
USING (true);

-- ============================================
-- Done
-- ============================================
SELECT 'Learning Ledger migration completed!' AS status;
