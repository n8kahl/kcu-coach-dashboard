-- Fix missing youtube_videos columns
-- These were in the original migration but the DO block didn't execute properly
-- for tables that already existed

-- Core columns
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS channel_id VARCHAR(50);
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS channel_title VARCHAR(200);
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS playlist_id VARCHAR(50);
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS playlist_title VARCHAR(200);
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Categorization
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS topics TEXT[];
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS ltp_relevance FLOAT DEFAULT 0.0;

-- Processing status
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS segments_count INTEGER DEFAULT 0;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMPTZ;

-- Timestamps
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
