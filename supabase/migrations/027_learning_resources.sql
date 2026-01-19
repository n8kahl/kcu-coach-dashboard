-- ============================================
-- KCU Learning System - Resources Enhancement
-- Adds resources JSONB column for PDFs, links, images
-- ============================================

-- ============================================
-- ADD RESOURCES COLUMN TO LESSONS
-- ============================================

-- Resources column for attaching supplemental materials
ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]'::JSONB;

-- Comment for documentation
COMMENT ON COLUMN course_lessons.resources IS 'Array of supplemental resources: [{type: "pdf"|"link"|"image"|"download", title: string, url: string, description?: string}]';

-- ============================================
-- ADD CLOUDFLARE STREAM SPECIFIC FIELDS
-- ============================================

-- Signed URL expiration for premium content protection
ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS require_signed_urls BOOLEAN DEFAULT FALSE;

-- Video status tracking (for upload workflow)
ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'pending'
CHECK (video_status IN ('pending', 'processing', 'ready', 'error'));

-- Cloudflare Stream playback info
ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS video_playback_hls TEXT; -- HLS URL for adaptive streaming

ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS video_playback_dash TEXT; -- DASH URL

ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS video_thumbnail_animated TEXT; -- Animated thumbnail URL (GIF)

-- ============================================
-- LEARNING PATHS (Guided Curriculum Tracks)
-- ============================================

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,

  -- Target audience
  skill_level TEXT DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all')),
  estimated_hours INTEGER,

  -- Content
  path_modules JSONB NOT NULL DEFAULT '[]'::JSONB, -- [{module_id, order, is_optional}]

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's learning path progress
CREATE TABLE IF NOT EXISTS user_learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  current_module_id UUID REFERENCES course_modules(id),

  -- Progress tracking
  modules_completed INTEGER DEFAULT 0,
  total_modules INTEGER NOT NULL,
  progress_percent DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, path_id)
);

-- ============================================
-- LESSON BOOKMARKS & NOTES
-- ============================================

CREATE TABLE IF NOT EXISTS user_lesson_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE,

  -- Bookmark details
  timestamp_seconds INTEGER NOT NULL, -- Position in video
  title TEXT, -- User's note title
  note TEXT, -- User's note content
  color TEXT DEFAULT 'yellow', -- For UI display

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for fast lookup
  UNIQUE(user_id, lesson_id, timestamp_seconds)
);

-- ============================================
-- VIDEO CHAPTERS (Timeline markers)
-- ============================================

CREATE TABLE IF NOT EXISTS lesson_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  timestamp_seconds INTEGER NOT NULL,
  description TEXT,

  -- For linking to specific concepts
  concept_tag TEXT, -- e.g., "ltp-scoring", "entry-rules"

  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lesson_id, timestamp_seconds)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_learning_paths_published ON learning_paths(is_published);
CREATE INDEX IF NOT EXISTS idx_user_learning_paths_user ON user_learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_bookmarks_user ON user_lesson_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_bookmarks_lesson ON user_lesson_bookmarks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_chapters_lesson ON lesson_chapters(lesson_id);

-- GIN index for searching resources JSONB
CREATE INDEX IF NOT EXISTS idx_course_lessons_resources ON course_lessons USING gin(resources);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_chapters ENABLE ROW LEVEL SECURITY;

-- Learning paths: visible if published
CREATE POLICY "learning_paths_select" ON learning_paths
  FOR SELECT USING (is_published = TRUE);

-- User learning paths: own data only
CREATE POLICY "user_learning_paths_all" ON user_learning_paths
  FOR ALL USING (user_id = auth.uid());

-- Bookmarks: own data only
CREATE POLICY "user_lesson_bookmarks_all" ON user_lesson_bookmarks
  FOR ALL USING (user_id = auth.uid());

-- Chapters: visible if parent lesson is accessible
CREATE POLICY "lesson_chapters_select" ON lesson_chapters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_lessons cl
      WHERE cl.id = lesson_chapters.lesson_id
      AND cl.is_published = TRUE
    )
  );

-- Service role full access
CREATE POLICY "service_learning_paths_all" ON learning_paths FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_user_learning_paths_all" ON user_learning_paths FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_user_lesson_bookmarks_all" ON user_lesson_bookmarks FOR ALL TO service_role USING (TRUE);
CREATE POLICY "service_lesson_chapters_all" ON lesson_chapters FOR ALL TO service_role USING (TRUE);

-- ============================================
-- ADMIN WRITE POLICIES
-- ============================================

-- Allow admins to manage learning paths
CREATE POLICY "admin_learning_paths_all" ON learning_paths
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments ura
      JOIN user_roles ur ON ura.role_id = ur.id
      WHERE ura.user_id = auth.uid()
      AND ur.name IN ('admin', 'super_admin')
    )
  );

-- Allow admins to manage chapters
CREATE POLICY "admin_lesson_chapters_all" ON lesson_chapters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments ura
      JOIN user_roles ur ON ura.role_id = ur.id
      WHERE ura.user_id = auth.uid()
      AND ur.name IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get lesson with all related data (chapters, resources)
CREATE OR REPLACE FUNCTION get_lesson_details(p_lesson_id UUID)
RETURNS TABLE (
  lesson JSONB,
  chapters JSONB,
  resource_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(cl.*) as lesson,
    COALESCE(
      (SELECT jsonb_agg(lc.* ORDER BY lc.timestamp_seconds)
       FROM lesson_chapters lc
       WHERE lc.lesson_id = p_lesson_id),
      '[]'::JSONB
    ) as chapters,
    COALESCE(jsonb_array_length(cl.resources), 0)::INTEGER as resource_count
  FROM course_lessons cl
  WHERE cl.id = p_lesson_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update learning path progress
CREATE OR REPLACE FUNCTION update_learning_path_progress(p_user_id UUID, p_path_id UUID)
RETURNS VOID AS $$
DECLARE
  v_path RECORD;
  v_completed_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_module_id UUID;
  v_module_ids UUID[];
BEGIN
  -- Get path details
  SELECT * INTO v_path FROM learning_paths WHERE id = p_path_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Extract module IDs from path_modules JSONB
  SELECT array_agg((elem->>'module_id')::UUID)
  INTO v_module_ids
  FROM jsonb_array_elements(v_path.path_modules) AS elem;

  v_total_count := array_length(v_module_ids, 1);

  IF v_total_count IS NULL OR v_total_count = 0 THEN
    RETURN;
  END IF;

  -- Count completed modules
  FOR i IN 1..v_total_count LOOP
    v_module_id := v_module_ids[i];

    -- Check if all required lessons in this module are completed
    IF NOT EXISTS (
      SELECT 1 FROM course_lessons cl
      LEFT JOIN course_lesson_progress clp ON clp.lesson_id = cl.id AND clp.user_id = p_user_id
      WHERE cl.module_id = v_module_id
      AND cl.is_required = TRUE
      AND (clp.completed IS NULL OR clp.completed = FALSE)
    ) THEN
      v_completed_count := v_completed_count + 1;
    END IF;
  END LOOP;

  -- Update user's path progress
  INSERT INTO user_learning_paths (user_id, path_id, modules_completed, total_modules, progress_percent)
  VALUES (
    p_user_id,
    p_path_id,
    v_completed_count,
    v_total_count,
    (v_completed_count::DECIMAL / v_total_count * 100)
  )
  ON CONFLICT (user_id, path_id)
  DO UPDATE SET
    modules_completed = EXCLUDED.modules_completed,
    progress_percent = EXCLUDED.progress_percent,
    completed_at = CASE
      WHEN EXCLUDED.modules_completed = EXCLUDED.total_modules THEN NOW()
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
