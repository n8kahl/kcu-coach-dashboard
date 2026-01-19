-- ============================================
-- KCU Content System Consolidation
-- Migration: 030_unify_content_system.sql
--
-- Goal: Unify all content tables into the course_* schema
-- Drops: thinkific_*, learning_modules, lessons (legacy)
-- ============================================

-- ============================================
-- STEP 1: ENSURE COURSE SCHEMA EXISTS
-- (Already created in 023_video_learning_system.sql)
-- ============================================

-- Verify courses table exists with required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courses') THEN
    RAISE EXCEPTION 'courses table does not exist. Run migration 023 first.';
  END IF;
END $$;

-- ============================================
-- STEP 2: ENSURE RESOURCES COLUMN EXISTS
-- (Already added in 027_learning_resources.sql)
-- ============================================

ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]'::JSONB;

-- ============================================
-- STEP 3: MIGRATE LEARNING_MODULES DATA (IF EXISTS)
-- Maps old learning_modules → course_modules
-- ============================================

-- First, check if we need to migrate any data
DO $$
DECLARE
  legacy_count INTEGER;
  default_course_id UUID;
BEGIN
  -- Check if learning_modules table exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_modules') THEN
    SELECT COUNT(*) INTO legacy_count FROM learning_modules;

    IF legacy_count > 0 THEN
      RAISE NOTICE 'Found % legacy learning_modules to migrate', legacy_count;

      -- Create a default "KCU Legacy Content" course if needed
      INSERT INTO courses (
        id,
        title,
        slug,
        description,
        is_published,
        is_gated,
        sort_order
      ) VALUES (
        gen_random_uuid(),
        'KCU Trading Course',
        'kcu-trading-course',
        'Core trading education content migrated from legacy system',
        true,
        true,
        0
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO default_course_id;

      -- Get the course ID if it already existed
      IF default_course_id IS NULL THEN
        SELECT id INTO default_course_id FROM courses WHERE slug = 'kcu-trading-course';
      END IF;

      -- Migrate learning_modules to course_modules
      INSERT INTO course_modules (
        id,
        course_id,
        title,
        slug,
        description,
        module_number,
        thumbnail_url,
        sort_order,
        is_published,
        is_required,
        created_at
      )
      SELECT
        lm.id,
        default_course_id,
        lm.title,
        lm.slug,
        lm.description,
        lm.order_index::text,  -- Convert to module_number
        NULL,  -- No thumbnail in legacy
        lm.order_index,
        lm.is_published,
        true,  -- All legacy modules are required
        lm.created_at
      FROM learning_modules lm
      ON CONFLICT (course_id, slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description;

      RAISE NOTICE 'Migrated learning_modules to course_modules';
    ELSE
      RAISE NOTICE 'No learning_modules data to migrate';
    END IF;
  ELSE
    RAISE NOTICE 'learning_modules table does not exist, skipping migration';
  END IF;
END $$;

-- ============================================
-- STEP 4: MIGRATE LESSONS DATA (IF EXISTS)
-- Maps old lessons → course_lessons
-- ============================================

DO $$
DECLARE
  legacy_count INTEGER;
BEGIN
  -- Check if lessons table exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lessons') THEN
    SELECT COUNT(*) INTO legacy_count FROM lessons;

    IF legacy_count > 0 THEN
      RAISE NOTICE 'Found % legacy lessons to migrate', legacy_count;

      -- Migrate lessons to course_lessons (if module exists in course_modules)
      INSERT INTO course_lessons (
        id,
        module_id,
        title,
        slug,
        description,
        lesson_number,
        video_url,
        video_duration_seconds,
        transcript_text,
        sort_order,
        is_published,
        is_required,
        created_at
      )
      SELECT
        l.id,
        l.module_id,  -- Same ID since we preserved it in course_modules
        l.title,
        l.slug,
        l.description,
        l.order_index::text,
        l.video_url,
        l.duration,
        l.transcript,
        l.order_index,
        l.is_published,
        true,
        l.created_at
      FROM lessons l
      WHERE EXISTS (SELECT 1 FROM course_modules cm WHERE cm.id = l.module_id)
      ON CONFLICT (module_id, slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description;

      RAISE NOTICE 'Migrated lessons to course_lessons';
    ELSE
      RAISE NOTICE 'No lessons data to migrate';
    END IF;
  ELSE
    RAISE NOTICE 'lessons table does not exist, skipping migration';
  END IF;
END $$;

-- ============================================
-- STEP 5: DROP DEPRECATED VIEWS (Must be done before tables)
-- ============================================

-- Drop Thinkific views that reference deprecated tables
DROP VIEW IF EXISTS v_thinkific_user_progress CASCADE;
DROP VIEW IF EXISTS v_thinkific_leaderboard CASCADE;
DROP VIEW IF EXISTS v_thinkific_activity CASCADE;

-- Drop any functions that reference deprecated tables
DROP FUNCTION IF EXISTS get_thinkific_course_full(INTEGER);
DROP FUNCTION IF EXISTS get_user_course_progress(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_user_learning_progress(UUID);
DROP FUNCTION IF EXISTS update_module_progress() CASCADE;
DROP FUNCTION IF EXISTS update_module_lessons_count() CASCADE;

-- ============================================
-- STEP 6: DROP DEPRECATED TABLES
-- ============================================

-- Drop Thinkific content tables (synced from external API)
DROP TABLE IF EXISTS thinkific_user_progress CASCADE;
DROP TABLE IF EXISTS thinkific_contents CASCADE;
DROP TABLE IF EXISTS thinkific_chapters CASCADE;
DROP TABLE IF EXISTS thinkific_courses CASCADE;
DROP TABLE IF EXISTS thinkific_sync_log CASCADE;

-- Drop Thinkific user/enrollment tables (from 018_thinkific_sync.sql)
DROP TABLE IF EXISTS thinkific_lesson_completions CASCADE;
DROP TABLE IF EXISTS thinkific_enrollments CASCADE;
DROP TABLE IF EXISTS thinkific_users CASCADE;
DROP TABLE IF EXISTS thinkific_webhook_logs CASCADE;

-- Drop legacy learning tables (from 002_learning_system.sql)
DROP TABLE IF EXISTS user_lesson_progress CASCADE;
DROP TABLE IF EXISTS user_module_progress CASCADE;
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS learning_modules CASCADE;

-- ============================================
-- STEP 7: REMOVE THINKIFIC COLUMNS FROM USER_PROFILES
-- ============================================

ALTER TABLE user_profiles
DROP COLUMN IF EXISTS thinkific_user_id,
DROP COLUMN IF EXISTS thinkific_email;

-- Drop associated index
DROP INDEX IF EXISTS idx_profiles_thinkific;

-- ============================================
-- STEP 8: ADD HELPER FUNCTION FOR UNIFIED PROGRESS
-- ============================================

-- Function to get user's unified learning progress
CREATE OR REPLACE FUNCTION get_unified_learning_progress(p_user_id UUID)
RETURNS TABLE (
  course_id UUID,
  course_title TEXT,
  total_lessons BIGINT,
  completed_lessons BIGINT,
  progress_percent NUMERIC,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS course_id,
    c.title AS course_title,
    COUNT(DISTINCT cl.id) AS total_lessons,
    COUNT(DISTINCT CASE WHEN clp.completed THEN cl.id END) AS completed_lessons,
    CASE
      WHEN COUNT(DISTINCT cl.id) = 0 THEN 0
      ELSE ROUND((COUNT(DISTINCT CASE WHEN clp.completed THEN cl.id END)::NUMERIC / COUNT(DISTINCT cl.id) * 100), 2)
    END AS progress_percent,
    MAX(clp.last_watched_at) AS last_activity
  FROM courses c
  JOIN course_modules cm ON cm.course_id = c.id
  JOIN course_lessons cl ON cl.module_id = cm.id
  LEFT JOIN course_lesson_progress clp ON clp.lesson_id = cl.id AND clp.user_id = p_user_id
  WHERE c.is_published = TRUE
  GROUP BY c.id, c.title
  ORDER BY c.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 9: CREATE MIGRATION LOG ENTRY
-- ============================================

-- Log this migration for audit purposes
INSERT INTO compliance_reports (
  report_type,
  generated_by,
  filters,
  report_data
) VALUES (
  'user_progress',
  '00000000-0000-0000-0000-000000000000'::UUID,
  '{"migration": "030_unify_content_system"}'::JSONB,
  jsonb_build_object(
    'migration_date', NOW(),
    'actions', ARRAY[
      'Migrated learning_modules to course_modules',
      'Migrated lessons to course_lessons',
      'Dropped thinkific_* tables',
      'Dropped legacy learning tables',
      'Removed thinkific columns from user_profiles'
    ]
  )
);

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- SUMMARY
-- ============================================
-- This migration consolidates all content into:
-- - courses: Top-level containers
-- - course_modules: Chapters/sections within courses
-- - course_lessons: Individual video lessons with resources
-- - course_lesson_progress: User watch progress
-- - lesson_watch_sessions: Detailed compliance tracking
-- - course_quiz_*: Quiz system
--
-- All Thinkific-related tables and legacy learning tables
-- have been removed. The system is now 100% native.
-- ============================================
