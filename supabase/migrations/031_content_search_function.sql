-- ============================================
-- KCU Content Search Function
-- Migration: 031_content_search_function.sql
--
-- Adds full-text search function for course_lessons
-- to support AI Coach knowledge retrieval.
-- ============================================

-- ============================================
-- STEP 1: Ensure full-text search indexes exist
-- ============================================

-- Index on transcript_text (already exists from 023, but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_course_lessons_transcript_search
  ON course_lessons USING gin(to_tsvector('english', COALESCE(transcript_text, '')));

-- Index on description
CREATE INDEX IF NOT EXISTS idx_course_lessons_description_search
  ON course_lessons USING gin(to_tsvector('english', COALESCE(description, '')));

-- Index on title
CREATE INDEX IF NOT EXISTS idx_course_lessons_title_search
  ON course_lessons USING gin(to_tsvector('english', title));

-- Combined index for weighted search
CREATE INDEX IF NOT EXISTS idx_course_lessons_combined_search
  ON course_lessons USING gin((
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(transcript_text, '')), 'C')
  ));

-- ============================================
-- STEP 2: Create search function
-- ============================================

CREATE OR REPLACE FUNCTION search_course_content(
  search_query TEXT,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  description TEXT,
  transcript_text TEXT,
  video_duration_seconds INTEGER,
  module_title TEXT,
  module_slug TEXT,
  rank REAL,
  match_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_lessons AS (
    SELECT
      cl.id,
      cl.title,
      cl.slug,
      cl.description,
      cl.transcript_text,
      cl.video_duration_seconds,
      cm.title AS module_title,
      cm.slug AS module_slug,
      -- Calculate relevance score using ts_rank
      ts_rank(
        setweight(to_tsvector('english', COALESCE(cl.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(cl.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(cl.transcript_text, '')), 'C'),
        to_tsquery('english', search_query)
      ) AS rank_score,
      -- Determine where the match occurred
      CASE
        WHEN to_tsvector('english', COALESCE(cl.title, '')) @@ to_tsquery('english', search_query) THEN 'title'
        WHEN to_tsvector('english', COALESCE(cl.description, '')) @@ to_tsquery('english', search_query) THEN 'description'
        WHEN to_tsvector('english', COALESCE(cl.transcript_text, '')) @@ to_tsquery('english', search_query) THEN 'transcript'
        ELSE 'unknown'
      END AS match_location
    FROM course_lessons cl
    JOIN course_modules cm ON cm.id = cl.module_id
    WHERE
      cl.is_published = TRUE
      AND (
        to_tsvector('english', COALESCE(cl.title, '')) @@ to_tsquery('english', search_query)
        OR to_tsvector('english', COALESCE(cl.description, '')) @@ to_tsquery('english', search_query)
        OR to_tsvector('english', COALESCE(cl.transcript_text, '')) @@ to_tsquery('english', search_query)
      )
  )
  SELECT
    rl.id,
    rl.title,
    rl.slug,
    rl.description,
    rl.transcript_text,
    rl.video_duration_seconds,
    rl.module_title,
    rl.module_slug,
    rl.rank_score::REAL AS rank,
    rl.match_location::TEXT AS match_type
  FROM ranked_lessons rl
  ORDER BY rl.rank_score DESC
  LIMIT result_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_course_content(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_course_content(TEXT, INTEGER) TO service_role;

-- ============================================
-- STEP 3: Create headline function for snippets
-- ============================================

CREATE OR REPLACE FUNCTION get_lesson_headline(
  lesson_id UUID,
  search_query TEXT,
  max_words INTEGER DEFAULT 50
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_headline TEXT;
BEGIN
  SELECT ts_headline(
    'english',
    COALESCE(cl.transcript_text, cl.description, ''),
    to_tsquery('english', search_query),
    'MaxWords=' || max_words || ', MinWords=25, StartSel=**, StopSel=**, HighlightAll=FALSE'
  )
  INTO result_headline
  FROM course_lessons cl
  WHERE cl.id = lesson_id;

  RETURN result_headline;
END;
$$;

GRANT EXECUTE ON FUNCTION get_lesson_headline(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lesson_headline(UUID, TEXT, INTEGER) TO service_role;

-- ============================================
-- STEP 4: Add search statistics view (optional)
-- ============================================

CREATE OR REPLACE VIEW v_course_content_stats AS
SELECT
  COUNT(*) AS total_lessons,
  COUNT(CASE WHEN transcript_text IS NOT NULL AND transcript_text != '' THEN 1 END) AS lessons_with_transcripts,
  COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) AS lessons_with_descriptions,
  SUM(COALESCE(video_duration_seconds, 0)) / 3600 AS total_hours_content
FROM course_lessons
WHERE is_published = TRUE;

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';
