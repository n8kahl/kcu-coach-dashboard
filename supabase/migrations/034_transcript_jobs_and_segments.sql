-- ============================================
-- KCU Coach - Transcript Jobs & Polymorphic Segments
-- Migration: 034_transcript_jobs_and_segments.sql
-- ============================================
--
-- This migration introduces a durable job queue for transcript processing
-- and replaces the old transcript_segments table with a polymorphic version.
--
-- Changes:
--   1. Creates transcript_jobs table (durable job queue)
--   2. Drops old transcript_segments and related objects (FK to dropped lessons table)
--   3. Creates new polymorphic transcript_segments table
--   4. Updates search_transcript_segments function for polymorphic queries
--
-- See: docs/specs/transcripts_v1.md
-- ============================================

-- ============================================
-- 1. TRANSCRIPT_JOBS TABLE (Job Queue)
-- ============================================

CREATE TABLE IF NOT EXISTS transcript_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Polymorphic reference (no FK constraints for flexibility)
    content_type TEXT NOT NULL,       -- 'course_lesson', 'youtube_video', etc.
    content_id TEXT NOT NULL,         -- UUID or external ID as text

    -- Job state machine
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    -- Error tracking
    error TEXT,
    error_code TEXT,

    -- Locking for concurrent workers (SKIP LOCKED pattern)
    locked_at TIMESTAMPTZ,
    locked_by TEXT,                   -- Worker identifier (hostname, pod name, etc.)

    -- Retry scheduling with exponential backoff
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),

    -- Job metadata
    priority INTEGER DEFAULT 0,       -- Higher = process first
    metadata JSONB DEFAULT '{}',      -- video_uid, lesson_title, course info, etc.

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- One job per content item
    UNIQUE(content_type, content_id)
);

-- Index for worker polling: find pending/retry-ready jobs
CREATE INDEX idx_transcript_jobs_pending
    ON transcript_jobs(status, next_retry_at, priority DESC)
    WHERE status IN ('pending', 'failed');

-- Index for admin queries by status
CREATE INDEX idx_transcript_jobs_status
    ON transcript_jobs(status);

-- Index for looking up job by content
CREATE INDEX idx_transcript_jobs_content
    ON transcript_jobs(content_type, content_id);

COMMENT ON TABLE transcript_jobs IS 'Durable job queue for transcript processing. Replaces fire-and-forget webhook pattern.';
COMMENT ON COLUMN transcript_jobs.content_type IS 'Type of content: course_lesson, youtube_video, etc.';
COMMENT ON COLUMN transcript_jobs.content_id IS 'ID of the content (lesson UUID, YouTube video ID, etc.)';
COMMENT ON COLUMN transcript_jobs.locked_at IS 'When a worker claimed this job. NULL if not locked.';
COMMENT ON COLUMN transcript_jobs.locked_by IS 'Identifier of the worker holding the lock.';
COMMENT ON COLUMN transcript_jobs.next_retry_at IS 'When this job is eligible for retry. Used with exponential backoff.';
COMMENT ON COLUMN transcript_jobs.metadata IS 'Additional context: video_uid, lesson_title, course_slug, etc.';

-- ============================================
-- 2. DROP OLD TRANSCRIPT_SEGMENTS AND DEPENDENCIES
-- ============================================
-- The old table has FK to lessons(id) which was dropped in migration 030.
-- We need to drop views, triggers, and the table itself.

-- Drop views that reference old tables
DROP VIEW IF EXISTS v_transcript_coverage CASCADE;
DROP VIEW IF EXISTS v_remediation_stats CASCADE;

-- Drop triggers on old table
DROP TRIGGER IF EXISTS transcript_segments_updated_at ON transcript_segments;

-- Drop old table
DROP TABLE IF EXISTS transcript_segments CASCADE;

-- Also drop the old processing status table (has same FK issue)
DROP TRIGGER IF EXISTS transcript_processing_status_updated_at ON transcript_processing_status;
DROP TABLE IF EXISTS transcript_processing_status CASCADE;

-- ============================================
-- 3. NEW POLYMORPHIC TRANSCRIPT_SEGMENTS TABLE
-- ============================================

CREATE TABLE transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Polymorphic reference (no FK for flexibility)
    content_type TEXT NOT NULL,       -- 'course_lesson', 'youtube_video'
    content_id TEXT NOT NULL,         -- Lesson UUID or external video ID

    -- Segment data
    segment_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    start_formatted VARCHAR(20),      -- "MM:SS" or "HH:MM:SS" for display

    -- Optional metadata
    speaker VARCHAR(100),             -- For future multi-speaker support
    confidence FLOAT,                 -- Transcription confidence score

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One segment per index per content item
    UNIQUE(content_type, content_id, segment_index)
);

-- Primary lookup index: find all segments for a content item, ordered by time
CREATE INDEX idx_transcript_segments_lookup
    ON transcript_segments(content_type, content_id, start_ms);

-- Full-text search index for searching across all transcripts
CREATE INDEX idx_transcript_segments_fts
    ON transcript_segments USING gin(to_tsvector('english', text));

-- Index for time-range queries
CREATE INDEX idx_transcript_segments_time_range
    ON transcript_segments(content_type, content_id, start_ms, end_ms);

COMMENT ON TABLE transcript_segments IS 'Timestamped transcript segments with polymorphic content references.';
COMMENT ON COLUMN transcript_segments.content_type IS 'Type of content: course_lesson, youtube_video, etc.';
COMMENT ON COLUMN transcript_segments.content_id IS 'ID of the content (lesson UUID, YouTube video ID, etc.)';
COMMENT ON COLUMN transcript_segments.segment_index IS 'Zero-based index of this segment within the transcript.';
COMMENT ON COLUMN transcript_segments.start_ms IS 'Start time in milliseconds from video start.';
COMMENT ON COLUMN transcript_segments.end_ms IS 'End time in milliseconds from video start.';

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE transcript_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;

-- transcript_jobs: authenticated users can view, service_role manages
CREATE POLICY "Jobs viewable by authenticated users"
    ON transcript_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages jobs"
    ON transcript_jobs FOR ALL TO service_role USING (true);

-- transcript_segments: authenticated users can view, service_role manages
CREATE POLICY "Segments viewable by authenticated users"
    ON transcript_segments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages segments"
    ON transcript_segments FOR ALL TO service_role USING (true);

-- ============================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================

-- Reuse existing function if available, otherwise create
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcript_jobs_updated_at
    BEFORE UPDATE ON transcript_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER transcript_segments_updated_at
    BEFORE UPDATE ON transcript_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. SEARCH FUNCTION (Polymorphic)
-- ============================================

-- Drop old function signature if exists
DROP FUNCTION IF EXISTS search_transcript_segments(TEXT, TEXT, INT);

-- New polymorphic search function
CREATE OR REPLACE FUNCTION search_transcript_segments(
    p_content_type TEXT,
    p_content_id TEXT,
    p_query TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    content_type TEXT,
    content_id TEXT,
    segment_index INTEGER,
    text TEXT,
    start_ms INTEGER,
    end_ms INTEGER,
    start_formatted VARCHAR(20),
    rank FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ts.id,
        ts.content_type,
        ts.content_id,
        ts.segment_index,
        ts.text,
        ts.start_ms,
        ts.end_ms,
        ts.start_formatted,
        ts_rank(to_tsvector('english', ts.text), plainto_tsquery('english', p_query)) AS rank
    FROM transcript_segments ts
    WHERE to_tsvector('english', ts.text) @@ plainto_tsquery('english', p_query)
        AND (p_content_type IS NULL OR ts.content_type = p_content_type)
        AND (p_content_id IS NULL OR ts.content_id = p_content_id)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_transcript_segments IS 'Full-text search across transcript segments with optional content filtering.';

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to claim a pending job (FOR UPDATE SKIP LOCKED pattern)
CREATE OR REPLACE FUNCTION claim_transcript_job(
    p_worker_id TEXT,
    p_lock_timeout_minutes INT DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    content_type TEXT,
    content_id TEXT,
    attempts INTEGER,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id UUID;
BEGIN
    -- Find and lock a single pending job
    SELECT tj.id INTO v_job_id
    FROM transcript_jobs tj
    WHERE tj.status IN ('pending', 'failed')
      AND tj.next_retry_at <= NOW()
      AND tj.attempts < tj.max_attempts
      AND (tj.locked_at IS NULL OR tj.locked_at < NOW() - (p_lock_timeout_minutes || ' minutes')::INTERVAL)
    ORDER BY tj.priority DESC, tj.next_retry_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If no job found, return empty
    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    -- Mark as processing and lock
    UPDATE transcript_jobs tj
    SET
        status = 'processing',
        locked_at = NOW(),
        locked_by = p_worker_id,
        attempts = tj.attempts + 1,
        updated_at = NOW()
    WHERE tj.id = v_job_id;

    -- Return the claimed job
    RETURN QUERY
    SELECT
        tj.id,
        tj.content_type,
        tj.content_id,
        tj.attempts,
        tj.metadata
    FROM transcript_jobs tj
    WHERE tj.id = v_job_id;
END;
$$;

COMMENT ON FUNCTION claim_transcript_job IS 'Atomically claim a pending transcript job for processing. Uses SKIP LOCKED for concurrent workers.';

-- Function to complete a job
CREATE OR REPLACE FUNCTION complete_transcript_job(
    p_job_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE transcript_jobs
    SET
        status = 'completed',
        locked_at = NULL,
        locked_by = NULL,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

COMMENT ON FUNCTION complete_transcript_job IS 'Mark a transcript job as successfully completed.';

-- Function to fail a job with retry scheduling
CREATE OR REPLACE FUNCTION fail_transcript_job(
    p_job_id UUID,
    p_error TEXT,
    p_error_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_attempts INTEGER;
    v_max_attempts INTEGER;
    v_backoff_seconds INTEGER;
BEGIN
    -- Get current attempt count
    SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
    FROM transcript_jobs WHERE id = p_job_id;

    -- Calculate exponential backoff: 60s * 2^(attempts-1), max 1 hour
    v_backoff_seconds := LEAST(60 * POWER(2, v_attempts - 1), 3600);

    -- Update job
    UPDATE transcript_jobs
    SET
        status = CASE WHEN v_attempts >= v_max_attempts THEN 'failed' ELSE 'pending' END,
        error = p_error,
        error_code = p_error_code,
        locked_at = NULL,
        locked_by = NULL,
        next_retry_at = NOW() + (v_backoff_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

COMMENT ON FUNCTION fail_transcript_job IS 'Mark a transcript job as failed with exponential backoff retry scheduling.';

-- ============================================
-- 8. ADMIN VIEWS
-- ============================================

-- View: Job queue status summary
CREATE OR REPLACE VIEW v_transcript_job_stats AS
SELECT
    status,
    COUNT(*) AS job_count,
    AVG(attempts)::NUMERIC(3,1) AS avg_attempts,
    MIN(created_at) AS oldest_job,
    MAX(updated_at) AS latest_activity
FROM transcript_jobs
GROUP BY status;

COMMENT ON VIEW v_transcript_job_stats IS 'Summary statistics for transcript job queue.';

-- View: Recent job activity
CREATE OR REPLACE VIEW v_transcript_jobs_recent AS
SELECT
    id,
    content_type,
    content_id,
    status,
    attempts,
    error,
    COALESCE(metadata->>'lesson_title', metadata->>'title', content_id) AS title,
    created_at,
    updated_at,
    completed_at
FROM transcript_jobs
ORDER BY updated_at DESC
LIMIT 50;

COMMENT ON VIEW v_transcript_jobs_recent IS 'Recent transcript job activity for admin dashboard.';
