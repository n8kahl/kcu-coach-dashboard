-- ============================================
-- Video Performance Indexes
-- ============================================
-- Adds indexes to improve video-related query performance
-- for the learning and admin content systems.
-- ============================================

-- Index for looking up lessons by video UID (used in Cloudflare webhooks)
CREATE INDEX IF NOT EXISTS idx_course_lessons_video_uid
ON course_lessons (video_uid)
WHERE video_uid IS NOT NULL;

-- Index for filtering lessons by video status (used in admin library)
CREATE INDEX IF NOT EXISTS idx_course_lessons_video_status
ON course_lessons (video_status)
WHERE video_status IS NOT NULL;

-- Index for looking up lessons by video URL (used for YouTube video usage counts)
CREATE INDEX IF NOT EXISTS idx_course_lessons_video_url
ON course_lessons (video_url)
WHERE video_url IS NOT NULL;

-- Composite index for lesson lookups by slug with module (common query pattern)
CREATE INDEX IF NOT EXISTS idx_course_lessons_slug_module
ON course_lessons (slug, module_id)
WHERE is_published = true;

-- Index for transcript segments content lookup
CREATE INDEX IF NOT EXISTS idx_transcript_segments_content
ON transcript_segments (content_type, content_id);

-- Index for pending transcript jobs (used by worker)
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_pending
ON transcript_jobs (status, priority DESC, created_at ASC)
WHERE status = 'pending';

-- Add comment documenting these indexes
COMMENT ON INDEX idx_course_lessons_video_uid IS 'Speeds up Cloudflare webhook lesson lookups';
COMMENT ON INDEX idx_course_lessons_video_status IS 'Speeds up admin library filtering by video status';
COMMENT ON INDEX idx_course_lessons_video_url IS 'Speeds up YouTube video usage counting';
COMMENT ON INDEX idx_course_lessons_slug_module IS 'Speeds up lesson page lookups by slug';
COMMENT ON INDEX idx_transcript_segments_content IS 'Speeds up transcript segment retrieval';
COMMENT ON INDEX idx_transcript_jobs_pending IS 'Speeds up transcript worker job claiming';
