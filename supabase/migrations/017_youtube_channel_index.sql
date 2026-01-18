-- ============================================
-- KCU Coach - YouTube Channel Indexer
-- ============================================
-- Stores indexed YouTube videos for AI coach remediation
-- and supplementary learning content outside Thinkific

-- ============================================
-- Add missing columns to youtube_videos if table exists
-- ============================================
DO $$
BEGIN
    -- Add missing columns if table exists but columns don't
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'youtube_videos') THEN
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS category VARCHAR(100);
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS topics TEXT[];
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS ltp_relevance FLOAT DEFAULT 0.0;
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_status VARCHAR(20) DEFAULT 'pending';
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS segments_count INTEGER DEFAULT 0;
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0;
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS error_message TEXT;
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMPTZ;
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS tags TEXT[];
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS playlist_id VARCHAR(50);
        ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS playlist_title VARCHAR(200);
    END IF;
END $$;

-- ============================================
-- YouTube Videos Table
-- ============================================
CREATE TABLE IF NOT EXISTS youtube_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

    -- Categorization
    category VARCHAR(100),
    topics TEXT[],
    ltp_relevance FLOAT DEFAULT 0.0, -- 0.0 to 1.0

    -- Processing status
    transcript_status VARCHAR(20) DEFAULT 'pending',
    -- pending, processing, completed, failed, unavailable
    segments_count INTEGER DEFAULT 0,
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,
    last_indexed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_youtube_videos_status
ON youtube_videos(transcript_status);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_category
ON youtube_videos(category);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_ltp
ON youtube_videos(ltp_relevance DESC);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_published
ON youtube_videos(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_playlist
ON youtube_videos(playlist_id);

-- Full-text search on title and description
CREATE INDEX IF NOT EXISTS idx_youtube_videos_search
ON youtube_videos USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

COMMENT ON TABLE youtube_videos IS 'Indexed YouTube videos from KayCapitals channel for AI coach remediation';

-- ============================================
-- YouTube Channel Sync Status
-- ============================================
CREATE TABLE IF NOT EXISTS youtube_channel_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id VARCHAR(50) UNIQUE NOT NULL,
    channel_name VARCHAR(200),
    last_sync_at TIMESTAMPTZ,
    total_videos INTEGER DEFAULT 0,
    indexed_videos INTEGER DEFAULT 0,
    failed_videos INTEGER DEFAULT 0,
    sync_status VARCHAR(20) DEFAULT 'idle', -- idle, syncing, completed, failed
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE youtube_channel_sync IS 'Tracks YouTube channel synchronization status';

-- ============================================
-- YouTube Playlists Table
-- ============================================
CREATE TABLE IF NOT EXISTS youtube_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_count INTEGER DEFAULT 0,
    channel_id VARCHAR(50),
    -- Categorization for the playlist
    category VARCHAR(100),
    is_indexed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_playlists_channel
ON youtube_playlists(channel_id);

COMMENT ON TABLE youtube_playlists IS 'YouTube playlists for organized content categories';

-- ============================================
-- View: Video Search Results
-- Combines video metadata with transcript availability
-- ============================================
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

COMMENT ON VIEW v_youtube_searchable_videos IS 'Videos with completed transcripts available for search';

-- ============================================
-- View: Content by Category
-- ============================================
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

COMMENT ON VIEW v_youtube_by_category IS 'Video counts and stats by category';

-- ============================================
-- Function: Search YouTube Transcripts
-- Full-text search with ranking
-- ============================================
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

COMMENT ON FUNCTION search_youtube_videos IS 'Full-text search across YouTube video titles and descriptions';

-- ============================================
-- Function: Get Related Videos
-- Find videos related to a topic/keyword
-- ============================================
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
    -- Get the source video's category and topics
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

COMMENT ON FUNCTION get_related_youtube_videos IS 'Find videos related to a given video based on category and topics';

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_channel_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_playlists ENABLE ROW LEVEL SECURITY;

-- Public read for authenticated users
CREATE POLICY "YouTube videos viewable by authenticated users"
ON youtube_videos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Channel sync viewable by authenticated users"
ON youtube_channel_sync FOR SELECT TO authenticated USING (true);

CREATE POLICY "Playlists viewable by authenticated users"
ON youtube_playlists FOR SELECT TO authenticated USING (true);

-- Service role full access
CREATE POLICY "Service role manages youtube_videos"
ON youtube_videos FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages channel_sync"
ON youtube_channel_sync FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages playlists"
ON youtube_playlists FOR ALL TO service_role USING (true);

-- ============================================
-- Triggers
-- ============================================
CREATE TRIGGER youtube_videos_updated_at
BEFORE UPDATE ON youtube_videos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER youtube_channel_sync_updated_at
BEFORE UPDATE ON youtube_channel_sync
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER youtube_playlists_updated_at
BEFORE UPDATE ON youtube_playlists
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
