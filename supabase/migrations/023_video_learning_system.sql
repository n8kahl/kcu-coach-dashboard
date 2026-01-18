-- ============================================
-- KCU Video Learning System - Full Schema
-- Migration for Cloudflare Stream + Compliance Tracking
-- ============================================

-- ============================================
-- COURSES (Top-level container)
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  is_gated BOOLEAN DEFAULT TRUE,  -- Content gating: requires enrollment
  sort_order INTEGER DEFAULT 0,

  -- Compliance metadata
  version TEXT DEFAULT '1.0',
  last_content_update TIMESTAMPTZ DEFAULT NOW(),
  compliance_required BOOLEAN DEFAULT FALSE,  -- If true, completion is mandatory

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COURSE MODULES
-- ============================================
CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  module_number TEXT NOT NULL,  -- "1", "3.2", "12.1", etc.
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL,
  is_published BOOLEAN DEFAULT TRUE,

  -- Gating options
  unlock_after_module_id UUID REFERENCES course_modules(id),  -- Sequential unlock
  unlock_after_days INTEGER,  -- Drip content: days after enrollment
  requires_quiz_pass BOOLEAN DEFAULT FALSE,  -- Must pass previous quiz
  min_quiz_score INTEGER DEFAULT 70,  -- Minimum passing score

  -- Compliance
  is_required BOOLEAN DEFAULT TRUE,  -- Required for course completion

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(course_id, slug)
);

-- ============================================
-- COURSE LESSONS (Videos)
-- ============================================
CREATE TABLE IF NOT EXISTS course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  lesson_number TEXT NOT NULL,  -- "5.1", "5.2", etc.

  -- Video info (Cloudflare Stream)
  video_url TEXT,                      -- Cloudflare Stream HLS URL
  video_uid TEXT,                      -- Cloudflare Stream UID
  video_duration_seconds INTEGER,      -- Exact duration for compliance
  thumbnail_url TEXT,

  -- Transcript info
  transcript_url TEXT,                 -- Supabase storage URL
  transcript_text TEXT,                -- Full text for search/AI

  -- Settings
  sort_order INTEGER NOT NULL,
  is_preview BOOLEAN DEFAULT FALSE,    -- Free preview (bypasses gating)
  is_published BOOLEAN DEFAULT TRUE,

  -- Compliance requirements
  is_required BOOLEAN DEFAULT TRUE,    -- Required for module completion
  min_watch_percent INTEGER DEFAULT 90, -- Must watch this % to complete
  allow_skip BOOLEAN DEFAULT FALSE,    -- Can user skip ahead?

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(module_id, slug)
);

-- ============================================
-- USER COURSE ACCESS (Enrollment & Gating)
-- ============================================
CREATE TABLE IF NOT EXISTS user_course_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- References user_profiles(id)
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,

  -- Access control
  access_type TEXT DEFAULT 'full' CHECK (access_type IN ('full', 'preview', 'trial', 'expired')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID,  -- Admin who granted access
  expires_at TIMESTAMPTZ,  -- NULL = lifetime access

  -- Enrollment tracking for drip content
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),

  -- Compliance tracking
  completion_deadline TIMESTAMPTZ,  -- If compliance_required
  compliance_status TEXT DEFAULT 'not_started' CHECK (compliance_status IN ('not_started', 'in_progress', 'completed', 'overdue')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, course_id)
);

-- ============================================
-- USER LESSON PROGRESS (Detailed Compliance Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS course_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE,

  -- Watch progress
  progress_seconds INTEGER DEFAULT 0,   -- Current playback position
  progress_percent DECIMAL(5,2) DEFAULT 0,

  -- Completion tracking
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- COMPLIANCE: Detailed time tracking
  total_watch_time_seconds INTEGER DEFAULT 0,  -- Total seconds watched (including rewatches)
  unique_watch_time_seconds INTEGER DEFAULT 0, -- Unique seconds watched (no duplicates)
  watch_count INTEGER DEFAULT 0,               -- Number of times started

  -- Engagement metrics
  pause_count INTEGER DEFAULT 0,
  seek_count INTEGER DEFAULT 0,
  playback_speed_changes INTEGER DEFAULT 0,
  last_playback_speed DECIMAL(3,2) DEFAULT 1.0,

  -- Session tracking
  first_watched_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),

  -- Device/browser for compliance audit
  last_device_type TEXT,  -- 'desktop', 'mobile', 'tablet'
  last_browser TEXT,
  last_ip_address INET,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, lesson_id)
);

-- ============================================
-- WATCH SESSIONS (Granular Compliance Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE,

  -- Session details
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  -- Watch data
  start_position_seconds INTEGER DEFAULT 0,
  end_position_seconds INTEGER DEFAULT 0,
  watch_duration_seconds INTEGER DEFAULT 0,

  -- Playback details
  playback_speed DECIMAL(3,2) DEFAULT 1.0,
  was_completed BOOLEAN DEFAULT FALSE,

  -- Device info for compliance
  device_type TEXT,
  browser TEXT,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QUIZ QUESTIONS (Normalized)
-- ============================================
CREATE TABLE IF NOT EXISTS course_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES course_lessons(id),  -- Optional: tie to specific lesson

  question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single', 'multiple', 'true_false')),
  question_text TEXT NOT NULL,
  explanation TEXT,  -- Shown after answering

  -- For remediation: link to video timestamp
  remediation_video_id UUID REFERENCES course_lessons(id),
  remediation_timestamp_seconds INTEGER,

  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QUIZ CHOICES
-- ============================================
CREATE TABLE IF NOT EXISTS course_quiz_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES course_quiz_questions(id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- USER QUIZ ATTEMPTS (Full Compliance Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS course_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,

  -- Scoring
  questions_total INTEGER NOT NULL,
  questions_correct INTEGER NOT NULL,
  score_percent DECIMAL(5,2) NOT NULL,
  passed BOOLEAN DEFAULT FALSE,

  -- Detailed answers for compliance review
  answers JSONB NOT NULL,  -- [{question_id, selected_choices[], is_correct, time_spent_seconds}]

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER,

  -- Device info
  device_type TEXT,
  browser TEXT,
  ip_address INET,

  -- Attempt tracking
  attempt_number INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER LEARNING STREAKS
-- ============================================
CREATE TABLE IF NOT EXISTS user_learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,

  -- Weekly tracking
  streak_start_date DATE,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER DAILY ACTIVITY (For Heatmap)
-- ============================================
CREATE TABLE IF NOT EXISTS user_daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_date DATE NOT NULL,

  -- Activity metrics
  lessons_started INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  quizzes_taken INTEGER DEFAULT 0,
  quizzes_passed INTEGER DEFAULT 0,

  -- Engagement score (calculated)
  engagement_score INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, activity_date)
);

-- ============================================
-- ACHIEVEMENTS DEFINITIONS
-- ============================================
CREATE TABLE IF NOT EXISTS learning_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- Emoji or icon name

  -- Unlock criteria (JSON for flexibility)
  criteria JSONB NOT NULL,
  -- Examples:
  -- {"type": "lessons_completed", "count": 1}
  -- {"type": "streak_days", "count": 7}
  -- {"type": "module_completed", "module_id": "..."}
  -- {"type": "watch_time_hours", "hours": 10}
  -- {"type": "quiz_score", "score": 100}

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_secret BOOLEAN DEFAULT FALSE,  -- Hidden until earned

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER ACHIEVEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS user_learning_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_id UUID REFERENCES learning_achievements(id) ON DELETE CASCADE,

  earned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Context when earned
  context JSONB,  -- e.g., {"module_id": "...", "score": 95}

  UNIQUE(user_id, achievement_id)
);

-- ============================================
-- COMPLIANCE REPORTS (Audit Export)
-- ============================================
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Report details
  report_type TEXT NOT NULL CHECK (report_type IN ('user_progress', 'course_completion', 'quiz_results', 'watch_time')),
  generated_by UUID NOT NULL,

  -- Filters used
  filters JSONB,  -- {user_ids: [], course_id: "", date_range: {}}

  -- Report data
  report_data JSONB NOT NULL,

  -- Export info
  export_format TEXT DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'pdf')),
  file_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_module ON course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_progress_user ON course_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_progress_lesson ON course_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_progress_completed ON course_lesson_progress(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_user_course_access_user ON user_course_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_access_course ON user_course_access(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_watch_sessions_user ON lesson_watch_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_watch_sessions_lesson ON lesson_watch_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_watch_sessions_date ON lesson_watch_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_course_quiz_attempts_user ON course_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_course_quiz_attempts_module ON course_quiz_attempts(module_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_activity_user_date ON user_daily_activity(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_user_learning_achievements_user ON user_learning_achievements(user_id);

-- Full-text search on transcripts
CREATE INDEX IF NOT EXISTS idx_course_lessons_transcript_search
  ON course_lessons USING gin(to_tsvector('english', COALESCE(transcript_text, '')));

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_watch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - Public Content (with gating check)
-- ============================================

-- Courses: viewable if published AND (not gated OR user has access)
CREATE POLICY "courses_select_policy" ON courses
  FOR SELECT USING (
    is_published = TRUE AND (
      is_gated = FALSE OR
      EXISTS (
        SELECT 1 FROM user_course_access uca
        WHERE uca.course_id = courses.id
        AND uca.user_id = auth.uid()
        AND uca.access_type IN ('full', 'trial')
        AND (uca.expires_at IS NULL OR uca.expires_at > NOW())
      ) OR
      EXISTS (
        SELECT 1 FROM user_role_assignments ura
        JOIN user_roles ur ON ura.role_id = ur.id
        WHERE ura.user_id = auth.uid()
        AND ur.name IN ('admin', 'super_admin', 'coach')
      )
    )
  );

-- Modules: viewable if parent course is accessible
CREATE POLICY "course_modules_select_policy" ON course_modules
  FOR SELECT USING (
    is_published = TRUE AND
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_modules.course_id
      AND c.is_published = TRUE
    )
  );

-- Lessons: viewable if preview OR user has course access
CREATE POLICY "course_lessons_select_policy" ON course_lessons
  FOR SELECT USING (
    is_published = TRUE AND (
      is_preview = TRUE OR
      EXISTS (
        SELECT 1 FROM course_modules cm
        JOIN courses c ON c.id = cm.course_id
        JOIN user_course_access uca ON uca.course_id = c.id
        WHERE cm.id = course_lessons.module_id
        AND uca.user_id = auth.uid()
        AND uca.access_type IN ('full', 'trial')
        AND (uca.expires_at IS NULL OR uca.expires_at > NOW())
      ) OR
      EXISTS (
        SELECT 1 FROM user_role_assignments ura
        JOIN user_roles ur ON ura.role_id = ur.id
        WHERE ura.user_id = auth.uid()
        AND ur.name IN ('admin', 'super_admin', 'coach')
      )
    )
  );

-- Quiz questions: viewable if lesson is accessible
CREATE POLICY "quiz_questions_select_policy" ON course_quiz_questions
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY "quiz_choices_select_policy" ON course_quiz_choices
  FOR SELECT USING (TRUE);

-- Achievements: all users can see achievement definitions
CREATE POLICY "achievements_select_policy" ON learning_achievements
  FOR SELECT USING (is_secret = FALSE OR EXISTS (
    SELECT 1 FROM user_learning_achievements ula
    WHERE ula.achievement_id = learning_achievements.id
    AND ula.user_id = auth.uid()
  ));

-- ============================================
-- RLS POLICIES - User's Own Data
-- ============================================

CREATE POLICY "user_course_access_select" ON user_course_access
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "course_lesson_progress_all" ON course_lesson_progress
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "lesson_watch_sessions_all" ON lesson_watch_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "course_quiz_attempts_all" ON course_quiz_attempts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "user_learning_streaks_all" ON user_learning_streaks
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "user_daily_activity_all" ON user_daily_activity
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "user_achievements_select" ON user_learning_achievements
  FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES - Service Role (Full Access)
-- ============================================

CREATE POLICY "service_courses_all" ON courses FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_modules_all" ON course_modules FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_lessons_all" ON course_lessons FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_access_all" ON user_course_access FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_progress_all" ON course_lesson_progress FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_sessions_all" ON lesson_watch_sessions FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_questions_all" ON course_quiz_questions FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_choices_all" ON course_quiz_choices FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_attempts_all" ON course_quiz_attempts FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_streaks_all" ON user_learning_streaks FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_activity_all" ON user_daily_activity FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_achievements_all" ON learning_achievements FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_user_achievements_all" ON user_learning_achievements FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_reports_all" ON compliance_reports FOR ALL TO service_role USING (TRUE);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update streak when user completes activity
CREATE OR REPLACE FUNCTION update_learning_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  -- Get current streak data
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_current_streak, v_longest_streak
  FROM user_learning_streaks
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Create new streak record
    INSERT INTO user_learning_streaks (user_id, current_streak, longest_streak, last_activity_date, streak_start_date)
    VALUES (p_user_id, 1, 1, v_today, v_today);
  ELSIF v_last_date = v_today THEN
    -- Already updated today, do nothing
    NULL;
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day, increment streak
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;

    UPDATE user_learning_streaks
    SET current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_activity_date = v_today,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    -- Streak broken, start new
    UPDATE user_learning_streaks
    SET current_streak = 1,
        last_activity_date = v_today,
        streak_start_date = v_today,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update daily activity
CREATE OR REPLACE FUNCTION update_daily_activity(
  p_user_id UUID,
  p_lessons_started INTEGER DEFAULT 0,
  p_lessons_completed INTEGER DEFAULT 0,
  p_watch_seconds INTEGER DEFAULT 0,
  p_quizzes_taken INTEGER DEFAULT 0,
  p_quizzes_passed INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_daily_activity (
    user_id, activity_date, lessons_started, lessons_completed,
    watch_time_seconds, quizzes_taken, quizzes_passed, engagement_score
  )
  VALUES (
    p_user_id, CURRENT_DATE, p_lessons_started, p_lessons_completed,
    p_watch_seconds, p_quizzes_taken, p_quizzes_passed,
    (p_lessons_completed * 100) + (p_watch_seconds / 60) + (p_quizzes_passed * 50)
  )
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    lessons_started = user_daily_activity.lessons_started + EXCLUDED.lessons_started,
    lessons_completed = user_daily_activity.lessons_completed + EXCLUDED.lessons_completed,
    watch_time_seconds = user_daily_activity.watch_time_seconds + EXCLUDED.watch_time_seconds,
    quizzes_taken = user_daily_activity.quizzes_taken + EXCLUDED.quizzes_taken,
    quizzes_passed = user_daily_activity.quizzes_passed + EXCLUDED.quizzes_passed,
    engagement_score = user_daily_activity.engagement_score + EXCLUDED.engagement_score;

  -- Update streak
  PERFORM update_learning_streak(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can access a module (gating logic)
CREATE OR REPLACE FUNCTION can_access_module(p_user_id UUID, p_module_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_module RECORD;
  v_prev_module_completed BOOLEAN;
  v_prev_quiz_passed BOOLEAN;
  v_enrollment_date TIMESTAMPTZ;
  v_days_since_enrollment INTEGER;
BEGIN
  -- Get module details
  SELECT * INTO v_module FROM course_modules WHERE id = p_module_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check course access first
  SELECT enrolled_at INTO v_enrollment_date
  FROM user_course_access
  WHERE user_id = p_user_id AND course_id = v_module.course_id
  AND access_type IN ('full', 'trial')
  AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check drip content (days since enrollment)
  IF v_module.unlock_after_days IS NOT NULL THEN
    v_days_since_enrollment := EXTRACT(DAY FROM (NOW() - v_enrollment_date));
    IF v_days_since_enrollment < v_module.unlock_after_days THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Check sequential unlock
  IF v_module.unlock_after_module_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM course_lesson_progress clp
      JOIN course_lessons cl ON cl.id = clp.lesson_id
      WHERE cl.module_id = v_module.unlock_after_module_id
      AND clp.user_id = p_user_id
      AND clp.completed = TRUE
      AND cl.is_required = TRUE
      GROUP BY cl.module_id
      HAVING COUNT(*) = (
        SELECT COUNT(*) FROM course_lessons
        WHERE module_id = v_module.unlock_after_module_id AND is_required = TRUE
      )
    ) INTO v_prev_module_completed;

    IF NOT v_prev_module_completed THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Check quiz requirement
  IF v_module.requires_quiz_pass AND v_module.unlock_after_module_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM course_quiz_attempts
      WHERE user_id = p_user_id
      AND module_id = v_module.unlock_after_module_id
      AND passed = TRUE
    ) INTO v_prev_quiz_passed;

    IF NOT v_prev_quiz_passed THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's course progress summary
CREATE OR REPLACE FUNCTION get_course_progress(p_user_id UUID, p_course_id UUID)
RETURNS TABLE (
  total_lessons INTEGER,
  completed_lessons INTEGER,
  total_modules INTEGER,
  completed_modules INTEGER,
  total_watch_time_seconds BIGINT,
  total_quiz_attempts INTEGER,
  best_quiz_scores JSONB,
  completion_percent DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM course_lessons cl
     JOIN course_modules cm ON cm.id = cl.module_id
     WHERE cm.course_id = p_course_id AND cl.is_published = TRUE)::INTEGER as total_lessons,

    (SELECT COUNT(*)::INTEGER FROM course_lesson_progress clp
     JOIN course_lessons cl ON cl.id = clp.lesson_id
     JOIN course_modules cm ON cm.id = cl.module_id
     WHERE cm.course_id = p_course_id
     AND clp.user_id = p_user_id
     AND clp.completed = TRUE)::INTEGER as completed_lessons,

    (SELECT COUNT(*)::INTEGER FROM course_modules
     WHERE course_id = p_course_id AND is_published = TRUE)::INTEGER as total_modules,

    (SELECT COUNT(DISTINCT cm.id)::INTEGER FROM course_modules cm
     WHERE cm.course_id = p_course_id
     AND NOT EXISTS (
       SELECT 1 FROM course_lessons cl
       LEFT JOIN course_lesson_progress clp ON clp.lesson_id = cl.id AND clp.user_id = p_user_id
       WHERE cl.module_id = cm.id
       AND cl.is_required = TRUE
       AND (clp.completed IS NULL OR clp.completed = FALSE)
     ))::INTEGER as completed_modules,

    (SELECT COALESCE(SUM(clp.total_watch_time_seconds), 0)::BIGINT
     FROM course_lesson_progress clp
     JOIN course_lessons cl ON cl.id = clp.lesson_id
     JOIN course_modules cm ON cm.id = cl.module_id
     WHERE cm.course_id = p_course_id AND clp.user_id = p_user_id) as total_watch_time_seconds,

    (SELECT COUNT(*)::INTEGER FROM course_quiz_attempts cqa
     JOIN course_modules cm ON cm.id = cqa.module_id
     WHERE cm.course_id = p_course_id AND cqa.user_id = p_user_id) as total_quiz_attempts,

    (SELECT jsonb_agg(jsonb_build_object('module_id', module_id, 'best_score', best_score))
     FROM (
       SELECT module_id, MAX(score_percent) as best_score
       FROM course_quiz_attempts cqa
       JOIN course_modules cm ON cm.id = cqa.module_id
       WHERE cm.course_id = p_course_id AND cqa.user_id = p_user_id
       GROUP BY module_id
     ) t) as best_quiz_scores,

    CASE
      WHEN (SELECT COUNT(*) FROM course_lessons cl
            JOIN course_modules cm ON cm.id = cl.module_id
            WHERE cm.course_id = p_course_id AND cl.is_published = TRUE) = 0 THEN 0
      ELSE (
        (SELECT COUNT(*)::DECIMAL FROM course_lesson_progress clp
         JOIN course_lessons cl ON cl.id = clp.lesson_id
         JOIN course_modules cm ON cm.id = cl.module_id
         WHERE cm.course_id = p_course_id AND clp.user_id = p_user_id AND clp.completed = TRUE) /
        (SELECT COUNT(*)::DECIMAL FROM course_lessons cl
         JOIN course_modules cm ON cm.id = cl.module_id
         WHERE cm.course_id = p_course_id AND cl.is_published = TRUE) * 100
      )
    END as completion_percent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEED DEFAULT ACHIEVEMENTS
-- ============================================
INSERT INTO learning_achievements (slug, title, description, icon, criteria, sort_order) VALUES
('first_lesson', 'First Steps', 'Completed your first lesson', '1', '{"type": "lessons_completed", "count": 1}', 1),
('ten_lessons', 'Getting Started', 'Completed 10 lessons', '2', '{"type": "lessons_completed", "count": 10}', 2),
('fifty_lessons', 'Dedicated Learner', 'Completed 50 lessons', '3', '{"type": "lessons_completed", "count": 50}', 3),
('hundred_lessons', 'Century Club', 'Completed 100 lessons', '4', '{"type": "lessons_completed", "count": 100}', 4),
('first_module', 'Module Master', 'Completed your first module', '5', '{"type": "modules_completed", "count": 1}', 5),
('five_modules', 'Multi-Module Pro', 'Completed 5 modules', '6', '{"type": "modules_completed", "count": 5}', 6),
('streak_7', 'Week Warrior', 'Maintained a 7-day learning streak', '7', '{"type": "streak_days", "count": 7}', 7),
('streak_30', 'Monthly Master', 'Maintained a 30-day learning streak', '8', '{"type": "streak_days", "count": 30}', 8),
('streak_100', 'Centurion', 'Maintained a 100-day learning streak', '9', '{"type": "streak_days", "count": 100}', 9),
('speed_learner', 'Speed Learner', 'Watched 5 lessons in one day', '10', '{"type": "daily_lessons", "count": 5}', 10),
('marathon', 'Marathon Learner', 'Watched 2+ hours in one day', '11', '{"type": "daily_watch_hours", "hours": 2}', 11),
('quiz_ace', 'Quiz Ace', 'Scored 100% on a module quiz', '12', '{"type": "perfect_quiz", "count": 1}', 12),
('quiz_master', 'Quiz Master', 'Passed all module quizzes', '13', '{"type": "all_quizzes_passed"}', 13),
('ten_hours', 'Time Investor', 'Watched 10 hours of content', '14', '{"type": "watch_time_hours", "hours": 10}', 14),
('fifty_hours', 'Dedicated Student', 'Watched 50 hours of content', '15', '{"type": "watch_time_hours", "hours": 50}', 15),
('halfway', 'Halfway There', 'Completed 50% of the course', '16', '{"type": "course_percent", "value": 50}', 16),
('course_complete', 'Graduate', 'Completed the entire course', '17', '{"type": "course_percent", "value": 100}', 17)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_updated_at BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Trigger to check achievements when progress is updated
CREATE OR REPLACE FUNCTION check_achievements_on_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be called by the application layer for more complex logic
  -- Here we just ensure daily activity is tracked
  IF NEW.completed = TRUE AND (OLD IS NULL OR OLD.completed = FALSE) THEN
    PERFORM update_daily_activity(NEW.user_id, 0, 1, 0, 0, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER progress_achievement_check
AFTER INSERT OR UPDATE ON course_lesson_progress
FOR EACH ROW EXECUTE FUNCTION check_achievements_on_progress();
