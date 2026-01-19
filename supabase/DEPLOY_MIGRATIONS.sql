-- ============================================
-- KCU Coach Dashboard - Combined Migrations
-- Run this in Supabase SQL Editor
-- Migrations: 012, 013, 014, 016, 017, 018
-- ============================================

-- ============================================
-- MIGRATION 012: Seed Daily Briefing
-- ============================================

INSERT INTO briefings (
  briefing_type,
  generated_at,
  content,
  market_context,
  key_levels,
  setups,
  economic_events,
  lesson_of_day
)
SELECT
  'morning',
  NOW(),
  '{
    "headline": "Markets Ready for New Week",
    "summary": "SPY and QQQ showing neutral bias. Focus on key levels for entries.",
    "marketBias": "neutral",
    "actionItems": [
      "Watch SPY and QQQ for trend confirmation",
      "Focus on A-grade setups only",
      "Review your trading plan before the open",
      "Check economic calendar for high-impact events"
    ],
    "warnings": []
  }'::jsonb,
  '{
    "spyPrice": 590.00,
    "spyChange": 0.15,
    "spyTrend": "range",
    "qqqPrice": 520.00,
    "qqqChange": 0.22,
    "qqqTrend": "range",
    "marketPhase": "pre_market",
    "overallSentiment": "neutral"
  }'::jsonb,
  '[
    {
      "symbol": "SPY",
      "currentPrice": 590.00,
      "levels": [
        {"price": 585.00, "type": "support", "strength": 80},
        {"price": 595.00, "type": "resistance", "strength": 75}
      ],
      "ema9": 589.50,
      "ema21": 588.00,
      "trend": "range"
    },
    {
      "symbol": "QQQ",
      "currentPrice": 520.00,
      "levels": [
        {"price": 515.00, "type": "support", "strength": 82},
        {"price": 525.00, "type": "resistance", "strength": 78}
      ],
      "ema9": 519.25,
      "ema21": 518.00,
      "trend": "range"
    }
  ]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{
    "title": "Wait for Confirmation",
    "content": "Never enter a trade without a patience candle confirming your setup. The market rewards patience, not FOMO.",
    "module": "ltp-framework"
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM briefings WHERE briefing_type = 'morning' AND generated_at >= CURRENT_DATE
);

-- ============================================
-- MIGRATION 013: Add earnings column to briefings
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'briefings' AND column_name = 'earnings'
  ) THEN
    ALTER TABLE briefings ADD COLUMN earnings JSONB;
  END IF;
END $$;

-- ============================================
-- MIGRATION 014: Update get_latest_briefing function
-- ============================================

CREATE OR REPLACE FUNCTION get_latest_briefing(p_type TEXT DEFAULT 'morning')
RETURNS TABLE (
  id UUID,
  briefing_type TEXT,
  generated_at TIMESTAMPTZ,
  content JSONB,
  market_context JSONB,
  key_levels JSONB,
  setups JSONB,
  economic_events JSONB,
  lesson_of_day JSONB,
  earnings JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.briefing_type,
    b.generated_at,
    b.content,
    b.market_context,
    b.key_levels,
    b.setups,
    b.economic_events,
    b.lesson_of_day,
    b.earnings
  FROM briefings b
  WHERE b.briefing_type = p_type
  ORDER BY b.generated_at DESC
  LIMIT 1;
END;
$$;

-- ============================================
-- MIGRATION 016: Transcript Timestamp Integration
-- ============================================

-- Extend knowledge_chunks with timestamp columns
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS start_timestamp_ms INTEGER,
ADD COLUMN IF NOT EXISTS end_timestamp_ms INTEGER,
ADD COLUMN IF NOT EXISTS segment_indices INTEGER[];

-- Create index for timestamp range queries on transcript chunks
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_timestamps
ON knowledge_chunks(source_id, start_timestamp_ms, end_timestamp_ms)
WHERE source_type = 'transcript';

-- Transcript Segments Table
CREATE TABLE IF NOT EXISTS transcript_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id VARCHAR(100) NOT NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    segment_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    start_formatted VARCHAR(20),
    speaker VARCHAR(100),
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_video ON transcript_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_lesson ON transcript_segments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_time ON transcript_segments(video_id, start_ms);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_text_search ON transcript_segments USING gin(to_tsvector('english', text));

-- Quiz Remediation Links Table
CREATE TABLE IF NOT EXISTS quiz_remediation_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id VARCHAR(100) NOT NULL,
    video_id VARCHAR(100) NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    concept_keywords TEXT[],
    relevance_score FLOAT DEFAULT 0.0,
    manually_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_remediation_quiz ON quiz_remediation_links(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_remediation_video ON quiz_remediation_links(video_id);

-- Transcript Processing Status Table
CREATE TABLE IF NOT EXISTS transcript_processing_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id VARCHAR(100) UNIQUE NOT NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    segments_count INTEGER DEFAULT 0,
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_status_video ON transcript_processing_status(video_id);
CREATE INDEX IF NOT EXISTS idx_transcript_status_status ON transcript_processing_status(status);

-- Enhanced Vector Search Function with Timestamps
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

-- Function to get chunks at a specific timestamp
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

-- Function to search transcript segments
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

-- Row Level Security for transcript tables
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_remediation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_processing_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Segments viewable by authenticated users" ON transcript_segments;
CREATE POLICY "Segments viewable by authenticated users"
ON transcript_segments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Remediation links viewable by authenticated users" ON quiz_remediation_links;
CREATE POLICY "Remediation links viewable by authenticated users"
ON quiz_remediation_links FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Processing status viewable by authenticated users" ON transcript_processing_status;
CREATE POLICY "Processing status viewable by authenticated users"
ON transcript_processing_status FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manages segments" ON transcript_segments;
CREATE POLICY "Service role manages segments"
ON transcript_segments FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role manages remediation" ON quiz_remediation_links;
CREATE POLICY "Service role manages remediation"
ON quiz_remediation_links FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role manages processing status" ON transcript_processing_status;
CREATE POLICY "Service role manages processing status"
ON transcript_processing_status FOR ALL TO service_role USING (true);

-- Updated At Trigger Function
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
-- MIGRATION 017: YouTube Channel Index
-- ============================================

-- YouTube Videos Table
CREATE TABLE IF NOT EXISTS youtube_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id VARCHAR(20) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    published_at TIMESTAMPTZ,
    thumbnail_url TEXT,
    duration VARCHAR(20),
    view_count INTEGER,
    channel_id VARCHAR(50),
    channel_title VARCHAR(200),
    playlist_id VARCHAR(50),
    playlist_title VARCHAR(200),
    tags TEXT[],
    category VARCHAR(100),
    topics TEXT[],
    ltp_relevance FLOAT DEFAULT 0.0,
    transcript_status VARCHAR(20) DEFAULT 'pending',
    segments_count INTEGER DEFAULT 0,
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,
    last_indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_status ON youtube_videos(transcript_status);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_category ON youtube_videos(category);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_ltp ON youtube_videos(ltp_relevance DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_playlist ON youtube_videos(playlist_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_search ON youtube_videos USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- YouTube Channel Sync Status
CREATE TABLE IF NOT EXISTS youtube_channel_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id VARCHAR(50) UNIQUE NOT NULL,
    channel_name VARCHAR(200),
    last_sync_at TIMESTAMPTZ,
    total_videos INTEGER DEFAULT 0,
    indexed_videos INTEGER DEFAULT 0,
    failed_videos INTEGER DEFAULT 0,
    sync_status VARCHAR(20) DEFAULT 'idle',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- YouTube Playlists Table
CREATE TABLE IF NOT EXISTS youtube_playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_count INTEGER DEFAULT 0,
    channel_id VARCHAR(50),
    category VARCHAR(100),
    is_indexed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_playlists_channel ON youtube_playlists(channel_id);

-- View: Video Search Results
CREATE OR REPLACE VIEW v_youtube_searchable_videos AS
SELECT
    yv.video_id,
    yv.title,
    yv.description,
    yv.thumbnail_url,
    yv.published_at,
    yv.category,
    yv.topics,
    yv.ltp_relevance,
    yv.playlist_title,
    yv.transcript_status,
    yv.segments_count,
    yv.chunks_count,
    CONCAT('https://www.youtube.com/watch?v=', yv.video_id) AS youtube_url
FROM youtube_videos yv
WHERE yv.transcript_status = 'completed'
ORDER BY yv.ltp_relevance DESC, yv.published_at DESC;

-- View: Content by Category
CREATE OR REPLACE VIEW v_youtube_by_category AS
SELECT
    category,
    COUNT(*) AS video_count,
    COUNT(*) FILTER (WHERE transcript_status = 'completed') AS indexed_count,
    AVG(ltp_relevance) AS avg_ltp_relevance,
    SUM(segments_count) AS total_segments,
    SUM(chunks_count) AS total_chunks
FROM youtube_videos
GROUP BY category
ORDER BY video_count DESC;

-- Function: Search YouTube Videos
CREATE OR REPLACE FUNCTION search_youtube_videos(
    p_search_query TEXT,
    p_category TEXT DEFAULT NULL,
    p_min_ltp_relevance FLOAT DEFAULT NULL,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    video_id VARCHAR(20),
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    category VARCHAR(100),
    ltp_relevance FLOAT,
    youtube_url TEXT,
    rank FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        yv.video_id,
        yv.title,
        yv.description,
        yv.thumbnail_url,
        yv.category,
        yv.ltp_relevance,
        CONCAT('https://www.youtube.com/watch?v=', yv.video_id) AS youtube_url,
        ts_rank(
            to_tsvector('english', yv.title || ' ' || COALESCE(yv.description, '')),
            plainto_tsquery('english', p_search_query)
        ) AS rank
    FROM youtube_videos yv
    WHERE yv.transcript_status = 'completed'
        AND to_tsvector('english', yv.title || ' ' || COALESCE(yv.description, ''))
            @@ plainto_tsquery('english', p_search_query)
        AND (p_category IS NULL OR yv.category = p_category)
        AND (p_min_ltp_relevance IS NULL OR yv.ltp_relevance >= p_min_ltp_relevance)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$;

-- Function: Get Related Videos
CREATE OR REPLACE FUNCTION get_related_youtube_videos(
    p_video_id VARCHAR(20),
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    video_id VARCHAR(20),
    title TEXT,
    thumbnail_url TEXT,
    category VARCHAR(100),
    youtube_url TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_category VARCHAR(100);
    v_topics TEXT[];
BEGIN
    SELECT category, topics INTO v_category, v_topics
    FROM youtube_videos
    WHERE youtube_videos.video_id = p_video_id;

    RETURN QUERY
    SELECT
        yv.video_id,
        yv.title,
        yv.thumbnail_url,
        yv.category,
        CONCAT('https://www.youtube.com/watch?v=', yv.video_id) AS youtube_url,
        CASE
            WHEN yv.category = v_category THEN 0.5
            ELSE 0.0
        END +
        CASE
            WHEN yv.topics && v_topics THEN 0.5
            ELSE 0.0
        END AS similarity
    FROM youtube_videos yv
    WHERE yv.video_id != p_video_id
        AND yv.transcript_status = 'completed'
        AND (yv.category = v_category OR yv.topics && v_topics)
    ORDER BY similarity DESC, yv.published_at DESC
    LIMIT p_limit;
END;
$$;

-- Row Level Security for YouTube tables
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_channel_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "YouTube videos viewable by authenticated users" ON youtube_videos;
CREATE POLICY "YouTube videos viewable by authenticated users"
ON youtube_videos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Channel sync viewable by authenticated users" ON youtube_channel_sync;
CREATE POLICY "Channel sync viewable by authenticated users"
ON youtube_channel_sync FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Playlists viewable by authenticated users" ON youtube_playlists;
CREATE POLICY "Playlists viewable by authenticated users"
ON youtube_playlists FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manages youtube_videos" ON youtube_videos;
CREATE POLICY "Service role manages youtube_videos"
ON youtube_videos FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role manages channel_sync" ON youtube_channel_sync;
CREATE POLICY "Service role manages channel_sync"
ON youtube_channel_sync FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role manages playlists" ON youtube_playlists;
CREATE POLICY "Service role manages playlists"
ON youtube_playlists FOR ALL TO service_role USING (true);

-- Triggers for YouTube tables
DROP TRIGGER IF EXISTS youtube_videos_updated_at ON youtube_videos;
CREATE TRIGGER youtube_videos_updated_at
BEFORE UPDATE ON youtube_videos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS youtube_channel_sync_updated_at ON youtube_channel_sync;
CREATE TRIGGER youtube_channel_sync_updated_at
BEFORE UPDATE ON youtube_channel_sync
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS youtube_playlists_updated_at ON youtube_playlists;
CREATE TRIGGER youtube_playlists_updated_at
BEFORE UPDATE ON youtube_playlists
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION 018: Thinkific Integration
-- ============================================

-- Thinkific Users Table
CREATE TABLE IF NOT EXISTS thinkific_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thinkific_id INTEGER UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    external_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_thinkific_users_external ON thinkific_users(external_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_users_email ON thinkific_users(email);

-- Thinkific Enrollments Table
CREATE TABLE IF NOT EXISTS thinkific_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thinkific_enrollment_id INTEGER UNIQUE NOT NULL,
    thinkific_user_id INTEGER NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    course_id INTEGER NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    percentage_completed DECIMAL(5,2) DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    expired BOOLEAN DEFAULT FALSE,
    expiry_date TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thinkific_enrollments_user ON thinkific_enrollments(thinkific_user_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_enrollments_course ON thinkific_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_enrollments_email ON thinkific_enrollments(user_email);
CREATE INDEX IF NOT EXISTS idx_thinkific_enrollments_completed ON thinkific_enrollments(completed) WHERE completed = true;

-- Thinkific Lesson Completions Table
CREATE TABLE IF NOT EXISTS thinkific_lesson_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thinkific_user_id INTEGER NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    course_id INTEGER NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    chapter_id INTEGER NOT NULL,
    chapter_name VARCHAR(255),
    content_id INTEGER NOT NULL,
    content_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(thinkific_user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_thinkific_lessons_user ON thinkific_lesson_completions(thinkific_user_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_lessons_course ON thinkific_lesson_completions(course_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_lessons_content ON thinkific_lesson_completions(content_id);
CREATE INDEX IF NOT EXISTS idx_thinkific_lessons_type ON thinkific_lesson_completions(content_type);

-- Thinkific Webhook Logs
CREATE TABLE IF NOT EXISTS thinkific_webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_thinkific_webhooks_type ON thinkific_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_thinkific_webhooks_time ON thinkific_webhook_logs(received_at DESC);

-- Auto-cleanup old webhook logs
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM thinkific_webhook_logs
    WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Add Thinkific fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS thinkific_user_id INTEGER,
ADD COLUMN IF NOT EXISTS thinkific_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_profiles_thinkific ON user_profiles(thinkific_user_id);

-- Views for Analytics
CREATE OR REPLACE VIEW v_thinkific_user_progress AS
SELECT
    up.id AS kcu_user_id,
    up.discord_username,
    up.thinkific_user_id,
    te.course_name,
    te.percentage_completed,
    te.completed,
    te.completed_at,
    COUNT(tlc.id) AS lessons_completed,
    COUNT(CASE WHEN tlc.content_type = 'quiz' THEN 1 END) AS quizzes_completed,
    COUNT(CASE WHEN tlc.content_type = 'video' THEN 1 END) AS videos_watched
FROM user_profiles up
LEFT JOIN thinkific_enrollments te ON te.thinkific_user_id = up.thinkific_user_id
LEFT JOIN thinkific_lesson_completions tlc ON tlc.thinkific_user_id = up.thinkific_user_id
    AND tlc.course_id = te.course_id
WHERE up.thinkific_user_id IS NOT NULL
GROUP BY up.id, up.discord_username, up.thinkific_user_id, te.course_name,
         te.percentage_completed, te.completed, te.completed_at;

CREATE OR REPLACE VIEW v_thinkific_leaderboard AS
SELECT
    up.id AS kcu_user_id,
    up.discord_username,
    up.avatar_url,
    COUNT(DISTINCT CASE WHEN te.completed THEN te.course_id END) AS courses_completed,
    COUNT(DISTINCT tlc.content_id) AS total_lessons,
    AVG(te.percentage_completed) AS avg_progress,
    MAX(tlc.completed_at) AS last_activity
FROM user_profiles up
LEFT JOIN thinkific_enrollments te ON te.thinkific_user_id = up.thinkific_user_id
LEFT JOIN thinkific_lesson_completions tlc ON tlc.thinkific_user_id = up.thinkific_user_id
WHERE up.thinkific_user_id IS NOT NULL
GROUP BY up.id, up.discord_username, up.avatar_url
ORDER BY courses_completed DESC, total_lessons DESC;

CREATE OR REPLACE VIEW v_thinkific_activity AS
SELECT
    'lesson_completed' AS activity_type,
    up.id AS kcu_user_id,
    up.discord_username,
    up.avatar_url,
    tlc.content_name AS title,
    tlc.course_name AS course,
    tlc.content_type,
    tlc.completed_at AS activity_at
FROM thinkific_lesson_completions tlc
JOIN user_profiles up ON up.thinkific_user_id = tlc.thinkific_user_id
UNION ALL
SELECT
    'course_completed' AS activity_type,
    up.id AS kcu_user_id,
    up.discord_username,
    up.avatar_url,
    te.course_name AS title,
    te.course_name AS course,
    'course' AS content_type,
    te.completed_at AS activity_at
FROM thinkific_enrollments te
JOIN user_profiles up ON up.thinkific_user_id = te.thinkific_user_id
WHERE te.completed = true
ORDER BY activity_at DESC;

-- Row Level Security for Thinkific tables
ALTER TABLE thinkific_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own thinkific data" ON thinkific_users;
CREATE POLICY "Users can view their own thinkific data"
ON thinkific_users FOR SELECT
TO authenticated
USING (external_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own enrollments" ON thinkific_enrollments;
CREATE POLICY "Users can view their own enrollments"
ON thinkific_enrollments FOR SELECT
TO authenticated
USING (
    thinkific_user_id IN (
        SELECT thinkific_user_id FROM user_profiles WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can view their own lesson completions" ON thinkific_lesson_completions;
CREATE POLICY "Users can view their own lesson completions"
ON thinkific_lesson_completions FOR SELECT
TO authenticated
USING (
    thinkific_user_id IN (
        SELECT thinkific_user_id FROM user_profiles WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Service role manages thinkific_users" ON thinkific_users;
CREATE POLICY "Service role manages thinkific_users"
ON thinkific_users FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role manages enrollments" ON thinkific_enrollments;
CREATE POLICY "Service role manages enrollments"
ON thinkific_enrollments FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role manages lesson_completions" ON thinkific_lesson_completions;
CREATE POLICY "Service role manages lesson_completions"
ON thinkific_lesson_completions FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role manages webhook_logs" ON thinkific_webhook_logs;
CREATE POLICY "Service role manages webhook_logs"
ON thinkific_webhook_logs FOR ALL TO service_role USING (true);

-- Function to get user's combined progress
CREATE OR REPLACE FUNCTION get_user_learning_progress(p_user_id UUID)
RETURNS TABLE (
    source VARCHAR,
    course_name VARCHAR,
    progress DECIMAL,
    completed BOOLEAN,
    lessons_done INTEGER,
    last_activity TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'thinkific'::VARCHAR AS source,
        te.course_name::VARCHAR,
        te.percentage_completed AS progress,
        te.completed,
        COUNT(tlc.id)::INTEGER AS lessons_done,
        MAX(tlc.completed_at) AS last_activity
    FROM thinkific_enrollments te
    LEFT JOIN thinkific_lesson_completions tlc
        ON tlc.thinkific_user_id = te.thinkific_user_id
        AND tlc.course_id = te.course_id
    WHERE te.thinkific_user_id = (
        SELECT thinkific_user_id FROM user_profiles WHERE id = p_user_id
    )
    GROUP BY te.course_name, te.percentage_completed, te.completed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- XP Award Function
CREATE OR REPLACE FUNCTION add_user_xp(
    p_user_id UUID,
    p_xp INTEGER,
    p_source VARCHAR,
    p_source_id VARCHAR DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE user_profiles
    SET
        total_xp = COALESCE(total_xp, 0) + p_xp,
        updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO xp_transactions (user_id, amount, source, source_id, created_at)
    VALUES (p_user_id, p_xp, p_source, p_source_id, NOW())
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create XP transactions table if not exists
CREATE TABLE IF NOT EXISTS xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    source VARCHAR(100) NOT NULL,
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_source ON xp_transactions(source);

-- ============================================
-- DONE! All migrations applied.
-- ============================================
SELECT 'All migrations completed successfully!' as status;
