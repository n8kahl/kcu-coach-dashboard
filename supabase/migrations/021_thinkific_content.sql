-- Thinkific Content Tables
-- Stores synced content from Thinkific LMS API for the Learning section
-- Migration: 021_thinkific_content.sql

-- ============================================
-- Thinkific Courses (cached from API)
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thinkific_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  description TEXT,
  instructor_id INTEGER,
  reviews_enabled BOOLEAN DEFAULT false,
  course_card_image_url TEXT,
  banner_image_url TEXT,
  intro_video_youtube TEXT,
  contact_information TEXT,
  keywords TEXT,
  duration VARCHAR(50),
  chapter_count INTEGER DEFAULT 0,
  content_count INTEGER DEFAULT 0,

  -- Mapping to local modules (optional)
  local_module_slug VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Thinkific Chapters (sections within courses)
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thinkific_id INTEGER UNIQUE NOT NULL,
  course_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  content_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Thinkific Contents (lessons, videos, quizzes)
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thinkific_id INTEGER UNIQUE NOT NULL,
  chapter_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- video, quiz, text, download, etc.
  position INTEGER DEFAULT 0,

  -- Video-specific
  video_duration INTEGER, -- seconds
  video_url TEXT,
  video_provider VARCHAR(50), -- youtube, vimeo, wistia

  -- Quiz-specific
  passing_score INTEGER,
  time_limit INTEGER, -- minutes

  -- Text content
  text_content TEXT,

  -- General
  free_preview BOOLEAN DEFAULT false,
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- User Progress on Thinkific Content
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,

  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,

  -- For videos: last watched position
  progress_seconds INTEGER DEFAULT 0,

  -- For quizzes: score achieved
  quiz_score INTEGER,
  quiz_passed BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, content_id)
);

-- ============================================
-- Thinkific Sync Log
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50) NOT NULL, -- full, courses, chapters, contents
  status VARCHAR(20) NOT NULL, -- running, completed, failed
  courses_synced INTEGER DEFAULT 0,
  chapters_synced INTEGER DEFAULT 0,
  contents_synced INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_thinkific_courses_slug ON thinkific_courses(slug);
CREATE INDEX IF NOT EXISTS idx_thinkific_courses_synced ON thinkific_courses(synced_at);

CREATE INDEX IF NOT EXISTS idx_thinkific_chapters_course ON thinkific_chapters(course_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_chapters_position ON thinkific_chapters(course_id, position);

CREATE INDEX IF NOT EXISTS idx_thinkific_contents_chapter ON thinkific_contents(chapter_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_contents_course ON thinkific_contents(course_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_contents_type ON thinkific_contents(content_type);
CREATE INDEX IF NOT EXISTS idx_thinkific_contents_position ON thinkific_contents(chapter_id, position);

CREATE INDEX IF NOT EXISTS idx_thinkific_user_progress_user ON thinkific_user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_user_progress_content ON thinkific_user_progress(content_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_user_progress_course ON thinkific_user_progress(course_id);

CREATE INDEX IF NOT EXISTS idx_thinkific_sync_log_status ON thinkific_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_thinkific_sync_log_started ON thinkific_sync_log(started_at DESC);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE thinkific_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_sync_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Courses: All authenticated users can read
CREATE POLICY "thinkific_courses_select_authenticated" ON thinkific_courses
  FOR SELECT TO authenticated USING (true);

-- Courses: Only service role can insert/update
CREATE POLICY "thinkific_courses_insert_service" ON thinkific_courses
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "thinkific_courses_update_service" ON thinkific_courses
  FOR UPDATE TO service_role USING (true);

-- Chapters: All authenticated users can read
CREATE POLICY "thinkific_chapters_select_authenticated" ON thinkific_chapters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "thinkific_chapters_insert_service" ON thinkific_chapters
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "thinkific_chapters_update_service" ON thinkific_chapters
  FOR UPDATE TO service_role USING (true);

-- Contents: All authenticated users can read
CREATE POLICY "thinkific_contents_select_authenticated" ON thinkific_contents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "thinkific_contents_insert_service" ON thinkific_contents
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "thinkific_contents_update_service" ON thinkific_contents
  FOR UPDATE TO service_role USING (true);

-- User Progress: Users can read/write their own progress
CREATE POLICY "thinkific_user_progress_select_own" ON thinkific_user_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "thinkific_user_progress_insert_own" ON thinkific_user_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "thinkific_user_progress_update_own" ON thinkific_user_progress
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Service role can manage all progress (for webhook updates)
CREATE POLICY "thinkific_user_progress_all_service" ON thinkific_user_progress
  FOR ALL TO service_role USING (true);

-- Sync Log: Only service role
CREATE POLICY "thinkific_sync_log_all_service" ON thinkific_sync_log
  FOR ALL TO service_role USING (true);

-- Admins can view sync logs
CREATE POLICY "thinkific_sync_log_select_admin" ON thinkific_sync_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ============================================
-- Function: Get Course with Chapters and Contents
-- ============================================
CREATE OR REPLACE FUNCTION get_thinkific_course_full(p_course_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'course', (
      SELECT row_to_json(c)
      FROM thinkific_courses c
      WHERE c.thinkific_id = p_course_id
    ),
    'chapters', (
      SELECT json_agg(
        json_build_object(
          'id', ch.id,
          'thinkific_id', ch.thinkific_id,
          'name', ch.name,
          'description', ch.description,
          'position', ch.position,
          'contents', (
            SELECT COALESCE(json_agg(
              json_build_object(
                'id', co.id,
                'thinkific_id', co.thinkific_id,
                'name', co.name,
                'content_type', co.content_type,
                'position', co.position,
                'video_duration', co.video_duration,
                'video_provider', co.video_provider,
                'free_preview', co.free_preview,
                'description', co.description
              ) ORDER BY co.position
            ), '[]'::json)
            FROM thinkific_contents co
            WHERE co.chapter_id = ch.thinkific_id
          )
        ) ORDER BY ch.position
      )
      FROM thinkific_chapters ch
      WHERE ch.course_id = p_course_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- Function: Get User's Course Progress
-- ============================================
CREATE OR REPLACE FUNCTION get_user_course_progress(p_user_id UUID, p_course_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_contents INTEGER;
  completed_contents INTEGER;
  result JSON;
BEGIN
  -- Count total contents in course
  SELECT COUNT(*) INTO total_contents
  FROM thinkific_contents
  WHERE course_id = p_course_id;

  -- Count completed contents for user
  SELECT COUNT(*) INTO completed_contents
  FROM thinkific_user_progress
  WHERE user_id = p_user_id
    AND course_id = p_course_id
    AND completed = true;

  SELECT json_build_object(
    'course_id', p_course_id,
    'total_contents', total_contents,
    'completed_contents', completed_contents,
    'percentage', CASE WHEN total_contents > 0
                       THEN ROUND((completed_contents::numeric / total_contents::numeric) * 100, 2)
                       ELSE 0 END,
    'completed_content_ids', (
      SELECT COALESCE(json_agg(content_id), '[]'::json)
      FROM thinkific_user_progress
      WHERE user_id = p_user_id
        AND course_id = p_course_id
        AND completed = true
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================
-- Notify PostgREST to reload schema
-- ============================================
NOTIFY pgrst, 'reload schema';
