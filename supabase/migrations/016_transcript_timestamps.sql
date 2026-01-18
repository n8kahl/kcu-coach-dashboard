-- ============================================
-- KCU Coach - Transcript Timestamp Integration
-- ============================================
-- This migration adds timestamp support to the knowledge system
-- enabling video timestamp linking in AI chat, quiz remediation, etc.

-- ============================================
-- Extend knowledge_chunks with timestamp columns
-- ============================================
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS start_timestamp_ms INTEGER,
ADD COLUMN IF NOT EXISTS end_timestamp_ms INTEGER,
ADD COLUMN IF NOT EXISTS segment_indices INTEGER[];

-- Create index for timestamp range queries on transcript chunks
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_timestamps
ON knowledge_chunks(source_id, start_timestamp_ms, end_timestamp_ms)
WHERE source_type = 'transcript';

COMMENT ON COLUMN knowledge_chunks.start_timestamp_ms IS 'Start timestamp in milliseconds (for video transcripts)';
COMMENT ON COLUMN knowledge_chunks.end_timestamp_ms IS 'End timestamp in milliseconds (for video transcripts)';
COMMENT ON COLUMN knowledge_chunks.segment_indices IS 'Array of original transcript segment indexes included in this chunk';

-- ============================================
-- Transcript Segments Table
-- Granular storage of individual transcript segments
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id VARCHAR(100) NOT NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    segment_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    start_formatted VARCHAR(20), -- "MM:SS" or "HH:MM:SS"
    speaker VARCHAR(100), -- For future multi-speaker support
    confidence FLOAT, -- Transcript confidence score if available
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, segment_index)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_transcript_segments_video
ON transcript_segments(video_id);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_lesson
ON transcript_segments(lesson_id);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_time
ON transcript_segments(video_id, start_ms);

-- Full-text search index on segment text
CREATE INDEX IF NOT EXISTS idx_transcript_segments_text_search
ON transcript_segments USING gin(to_tsvector('english', text));

COMMENT ON TABLE transcript_segments IS 'Individual transcript segments with precise timestamps from video transcripts';

-- ============================================
-- Quiz Remediation Links Table
-- Maps quiz questions to relevant video timestamps
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_remediation_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id VARCHAR(100) NOT NULL, -- ID within quiz JSON
    video_id VARCHAR(100) NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    concept_keywords TEXT[], -- Keywords for relevance matching
    relevance_score FLOAT DEFAULT 0.0, -- How well the video segment matches the question
    manually_verified BOOLEAN DEFAULT false, -- Admin can verify/override
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_remediation_quiz
ON quiz_remediation_links(quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_remediation_video
ON quiz_remediation_links(video_id);

COMMENT ON TABLE quiz_remediation_links IS 'Links quiz questions to relevant video timestamps for remediation';

-- ============================================
-- Transcript Processing Status Table
-- Track processing status for each video
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_processing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id VARCHAR(100) UNIQUE NOT NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    segments_count INTEGER DEFAULT 0,
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_status_video
ON transcript_processing_status(video_id);

CREATE INDEX IF NOT EXISTS idx_transcript_status_status
ON transcript_processing_status(status);

COMMENT ON TABLE transcript_processing_status IS 'Tracks transcript processing status for each video';

-- ============================================
-- Enhanced Vector Search Function with Timestamps
-- ============================================
CREATE OR REPLACE FUNCTION match_knowledge_chunks_with_timestamps(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_source_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source_type TEXT,
    source_id TEXT,
    source_title TEXT,
    topic TEXT,
    subtopic TEXT,
    difficulty TEXT,
    ltp_relevance FLOAT,
    start_timestamp_ms INTEGER,
    end_timestamp_ms INTEGER,
    segment_indices INTEGER[],
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        kc.source_type,
        kc.source_id,
        kc.source_title,
        kc.topic,
        kc.subtopic,
        kc.difficulty,
        kc.ltp_relevance,
        kc.start_timestamp_ms,
        kc.end_timestamp_ms,
        kc.segment_indices,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks kc
    WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
        AND (filter_source_type IS NULL OR kc.source_type = filter_source_type)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_knowledge_chunks_with_timestamps IS 'Vector similarity search with timestamp data for video linking';

-- ============================================
-- Function to get chunks at a specific timestamp
-- ============================================
CREATE OR REPLACE FUNCTION get_chunks_at_timestamp(
    p_video_id TEXT,
    p_timestamp_ms INTEGER
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source_title TEXT,
    topic TEXT,
    start_timestamp_ms INTEGER,
    end_timestamp_ms INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        kc.source_title,
        kc.topic,
        kc.start_timestamp_ms,
        kc.end_timestamp_ms
    FROM knowledge_chunks kc
    WHERE kc.source_id = p_video_id
        AND kc.source_type = 'transcript'
        AND kc.start_timestamp_ms <= p_timestamp_ms
        AND kc.end_timestamp_ms >= p_timestamp_ms
    ORDER BY kc.start_timestamp_ms;
END;
$$;

COMMENT ON FUNCTION get_chunks_at_timestamp IS 'Get knowledge chunks that contain a specific video timestamp';

-- ============================================
-- Function to search transcript segments
-- ============================================
CREATE OR REPLACE FUNCTION search_transcript_segments(
    p_search_query TEXT,
    p_video_id TEXT DEFAULT NULL,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    video_id VARCHAR(100),
    segment_index INTEGER,
    text TEXT,
    start_ms INTEGER,
    end_ms INTEGER,
    start_formatted VARCHAR(20),
    rank FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ts.id,
        ts.video_id,
        ts.segment_index,
        ts.text,
        ts.start_ms,
        ts.end_ms,
        ts.start_formatted,
        ts_rank(to_tsvector('english', ts.text), plainto_tsquery('english', p_search_query)) AS rank
    FROM transcript_segments ts
    WHERE to_tsvector('english', ts.text) @@ plainto_tsquery('english', p_search_query)
        AND (p_video_id IS NULL OR ts.video_id = p_video_id)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_transcript_segments IS 'Full-text search across transcript segments';

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_remediation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_processing_status ENABLE ROW LEVEL SECURITY;

-- Public read access for authenticated users
CREATE POLICY "Segments viewable by authenticated users"
ON transcript_segments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Remediation links viewable by authenticated users"
ON quiz_remediation_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Processing status viewable by authenticated users"
ON transcript_processing_status FOR SELECT TO authenticated USING (true);

-- Service role full access for API operations
CREATE POLICY "Service role manages segments"
ON transcript_segments FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages remediation"
ON quiz_remediation_links FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages processing status"
ON transcript_processing_status FOR ALL TO service_role USING (true);

-- ============================================
-- Updated At Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transcript_segments_updated_at ON transcript_segments;
CREATE TRIGGER transcript_segments_updated_at
BEFORE UPDATE ON transcript_segments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS quiz_remediation_links_updated_at ON quiz_remediation_links;
CREATE TRIGGER quiz_remediation_links_updated_at
BEFORE UPDATE ON quiz_remediation_links
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS transcript_processing_status_updated_at ON transcript_processing_status;
CREATE TRIGGER transcript_processing_status_updated_at
BEFORE UPDATE ON transcript_processing_status
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Analytics Views
-- ============================================

-- View: Transcript coverage by module
CREATE OR REPLACE VIEW v_transcript_coverage AS
SELECT
    lm.title AS module_title,
    lm.slug AS module_slug,
    COUNT(DISTINCT l.id) AS total_lessons,
    COUNT(DISTINCT tps.video_id) FILTER (WHERE tps.status = 'completed') AS transcribed_lessons,
    COALESCE(SUM(tps.segments_count), 0) AS total_segments,
    COALESCE(SUM(tps.chunks_count), 0) AS total_chunks
FROM learning_modules lm
LEFT JOIN lessons l ON l.module_id = lm.id
LEFT JOIN transcript_processing_status tps ON tps.lesson_id = l.id
GROUP BY lm.id, lm.title, lm.slug
ORDER BY lm.order_index;

-- View: Most referenced video timestamps in remediation
CREATE OR REPLACE VIEW v_remediation_stats AS
SELECT
    qrl.video_id,
    l.title AS lesson_title,
    COUNT(*) AS times_linked,
    AVG(qrl.relevance_score) AS avg_relevance,
    MIN(qrl.start_ms) AS earliest_timestamp,
    MAX(qrl.end_ms) AS latest_timestamp
FROM quiz_remediation_links qrl
LEFT JOIN lessons l ON l.video_id = qrl.video_id
GROUP BY qrl.video_id, l.title
ORDER BY times_linked DESC;

COMMENT ON VIEW v_transcript_coverage IS 'Shows transcript processing coverage by module';
COMMENT ON VIEW v_remediation_stats IS 'Analytics on quiz remediation video links';
