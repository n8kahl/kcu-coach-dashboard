-- ============================================
-- KCU Social Builder - Database Schema
-- ============================================
-- This schema extends the existing KCU Coach Dashboard database
-- to support social media management functionality.

-- ============================================
-- Social Accounts Table
-- ============================================
-- Stores connected social media accounts for each platform

CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
    account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_handle VARCHAR(255),
    profile_image_url TEXT,

    -- OAuth credentials (encrypted)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Platform-specific metadata
    metadata JSONB DEFAULT '{}',
    -- Instagram: { page_id, business_account_id }
    -- TikTok: { open_id, union_id }
    -- YouTube: { channel_id }

    -- Account statistics (cached)
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,
    connected_by UUID REFERENCES user_profiles(id),
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,

    UNIQUE(platform, account_id)
);

-- Index for quick platform lookups
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform, is_active);

-- ============================================
-- Social Posts Table
-- ============================================
-- Tracks all published and scheduled posts

CREATE TABLE IF NOT EXISTS social_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,

    -- Content
    content_type VARCHAR(30) NOT NULL CHECK (content_type IN (
        'feed_post', 'carousel', 'reel', 'story',  -- Instagram
        'video', 'photo',                           -- TikTok
        'video', 'short', 'community_post'          -- YouTube
    )),
    caption TEXT,
    hashtags TEXT[],
    mentions TEXT[],

    -- Media attachments
    media JSONB DEFAULT '[]',
    -- Array of: { type: 'image'|'video', url: string, thumbnail_url?: string, duration?: number }

    -- Platform-specific post ID (after publishing)
    platform_post_id VARCHAR(255),
    platform_url TEXT,

    -- Scheduling
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'publishing', 'published', 'failed', 'deleted'
    )),
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Failure tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    content_category VARCHAR(50),
    -- 'educational', 'community', 'market_commentary', 'promotional'
    ai_generated BOOLEAN DEFAULT false,
    suggestion_id UUID REFERENCES content_suggestions(id),

    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_social_posts_account ON social_posts(account_id, status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_published ON social_posts(published_at DESC) WHERE status = 'published';

-- ============================================
-- Social Analytics Table
-- ============================================
-- Aggregated engagement metrics from each platform

CREATE TABLE IF NOT EXISTS social_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
    account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,

    -- Timestamp for the metrics snapshot
    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Common metrics across platforms
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,

    -- Video-specific metrics
    video_views INTEGER,
    video_watch_time_seconds INTEGER,
    average_watch_percentage DECIMAL(5,2),

    -- Engagement rates (calculated)
    engagement_rate DECIMAL(5,2),

    -- Platform-specific metrics (JSONB for flexibility)
    platform_metrics JSONB DEFAULT '{}',
    -- Instagram: { profile_visits, website_clicks, follows, story_exits, story_taps_forward/back }
    -- TikTok: { profile_views, full_video_watched, video_completion_rate }
    -- YouTube: { subscribers_gained, likes_vs_dislikes, click_through_rate, average_view_duration }

    -- Audience demographics (when available)
    demographics JSONB DEFAULT '{}',
    -- { age_groups: {...}, gender: {...}, locations: [...], peak_times: [...] }

    UNIQUE(post_id, recorded_at)
);

-- Index for time-series queries
CREATE INDEX idx_social_analytics_time ON social_analytics(account_id, recorded_at DESC);

-- ============================================
-- Account Analytics (Daily Rollup)
-- ============================================
-- Daily aggregated account-level metrics

CREATE TABLE IF NOT EXISTS account_analytics_daily (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Follower changes
    followers_count INTEGER,
    followers_gained INTEGER DEFAULT 0,
    followers_lost INTEGER DEFAULT 0,

    -- Daily totals
    posts_published INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,

    -- Averages
    average_engagement_rate DECIMAL(5,2),

    -- Best performing post
    top_post_id UUID REFERENCES social_posts(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, date)
);

CREATE INDEX idx_account_analytics_date ON account_analytics_daily(account_id, date DESC);

-- ============================================
-- Content Suggestions Table
-- ============================================
-- AI-generated content recommendations

CREATE TABLE IF NOT EXISTS content_suggestions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Target platform(s)
    platforms VARCHAR(20)[] NOT NULL,
    content_type VARCHAR(30) NOT NULL,

    -- Generated content
    suggested_caption TEXT NOT NULL,
    suggested_hashtags TEXT[],
    suggested_hook TEXT,

    -- Content metadata
    topic VARCHAR(100),
    category VARCHAR(50),
    -- 'educational', 'community', 'market_commentary', 'promotional'

    -- Data source that inspired this suggestion
    source_type VARCHAR(30),
    -- 'trending_topic', 'influencer_content', 'kcu_win', 'kcu_streak', 'economic_event', 'earnings'
    source_id VARCHAR(255),
    source_data JSONB DEFAULT '{}',

    -- AI analysis
    predicted_engagement_score DECIMAL(5,2),
    reasoning TEXT,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'published', 'expired'
    )),

    -- Timing recommendation
    optimal_post_time TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_suggestions_status ON content_suggestions(status, created_at DESC);
CREATE INDEX idx_content_suggestions_topic ON content_suggestions(topic, category);

-- ============================================
-- Influencer Tracking Table
-- ============================================
-- Profiles of day trading influencers being monitored

CREATE TABLE IF NOT EXISTS influencer_tracking (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    platform VARCHAR(20) NOT NULL,
    platform_user_id VARCHAR(255),
    handle VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    profile_url TEXT,
    profile_image_url TEXT,

    -- Categorization
    niche VARCHAR(50) DEFAULT 'day_trading',
    -- 'day_trading', 'swing_trading', 'options', 'crypto', 'forex', 'education'

    -- Metrics (last updated)
    followers_count INTEGER,
    engagement_rate DECIMAL(5,2),
    avg_posts_per_week DECIMAL(5,2),

    -- Content analysis
    content_themes TEXT[],
    posting_schedule JSONB DEFAULT '{}',
    -- { best_days: [...], best_times: [...], avg_frequency: number }

    -- Our analysis notes
    analysis_notes TEXT,
    relevance_score INTEGER DEFAULT 50 CHECK (relevance_score BETWEEN 0 AND 100),

    is_active BOOLEAN DEFAULT true,
    last_analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(platform, handle)
);

CREATE INDEX idx_influencer_tracking_active ON influencer_tracking(is_active, platform);

-- ============================================
-- Trending Topics Table
-- ============================================
-- Real-time cache of trending day trading topics

CREATE TABLE IF NOT EXISTS trending_topics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    topic VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    -- 'economic_data', 'earnings', 'futures', 'political', 'market_sentiment', 'technical', 'psychology'

    -- Source information
    source VARCHAR(50) NOT NULL,
    -- 'economic_calendar', 'earnings_api', 'news_feed', 'social_hashtag', 'market_data'
    source_id VARCHAR(255),
    source_url TEXT,

    -- Trend metrics
    trend_score INTEGER DEFAULT 50 CHECK (trend_score BETWEEN 0 AND 100),
    mention_count INTEGER DEFAULT 0,
    sentiment DECIMAL(3,2), -- -1.0 to 1.0

    -- Related content opportunities
    content_angles JSONB DEFAULT '[]',
    -- Array of suggested angles/hooks for content

    -- Timing
    started_trending_at TIMESTAMPTZ,
    peak_time TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Status
    is_active BOOLEAN DEFAULT true,
    processed_for_suggestions BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trending_topics_active ON trending_topics(is_active, trend_score DESC);
CREATE INDEX idx_trending_topics_category ON trending_topics(category, is_active);

-- ============================================
-- Hashtag Performance Table
-- ============================================
-- Track hashtag effectiveness over time

CREATE TABLE IF NOT EXISTS hashtag_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    hashtag VARCHAR(100) NOT NULL,
    platform VARCHAR(20) NOT NULL,

    -- Performance metrics
    times_used INTEGER DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    average_engagement_rate DECIMAL(5,2),

    -- Trending status
    is_trending BOOLEAN DEFAULT false,
    trend_volume INTEGER,

    last_used_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(hashtag, platform)
);

CREATE INDEX idx_hashtag_performance_platform ON hashtag_performance(platform, average_engagement_rate DESC);

-- ============================================
-- Social Builder Config Table
-- ============================================
-- System configuration for the social builder

CREATE TABLE IF NOT EXISTS social_builder_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,

    updated_by UUID REFERENCES user_profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configurations
INSERT INTO social_builder_config (config_key, config_value, description) VALUES
('posting_schedule', '{
    "instagram": {"optimal_times": ["09:00", "12:00", "18:00"], "timezone": "America/New_York"},
    "tiktok": {"optimal_times": ["07:00", "12:00", "19:00"], "timezone": "America/New_York"},
    "youtube": {"optimal_times": ["14:00", "17:00"], "timezone": "America/New_York"}
}', 'Default optimal posting times by platform'),

('content_mix', '{
    "educational": 40,
    "community": 30,
    "market_commentary": 20,
    "promotional": 10
}', 'Target content category distribution (percentages)'),

('ai_settings', '{
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.7,
    "max_suggestions_per_day": 10,
    "auto_generate": false
}', 'AI content generation settings'),

('hashtag_limits', '{
    "instagram": {"min": 5, "max": 30},
    "tiktok": {"min": 3, "max": 8},
    "youtube": {"min": 0, "max": 15}
}', 'Hashtag count limits by platform'),

('compliance', '{
    "include_disclaimer": true,
    "disclaimer_text": "Educational content only. Not financial advice. Past performance does not guarantee future results.",
    "require_review": true
}', 'Content compliance settings');

-- ============================================
-- Audit Log for Social Actions
-- ============================================

CREATE TABLE IF NOT EXISTS social_audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    action VARCHAR(50) NOT NULL,
    -- 'post_created', 'post_published', 'post_deleted', 'account_connected', 'account_disconnected'

    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID,

    actor_id UUID REFERENCES user_profiles(id),

    details JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_audit_log_time ON social_audit_log(created_at DESC);
CREATE INDEX idx_social_audit_log_entity ON social_audit_log(entity_type, entity_id);

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_builder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admin access only" ON social_accounts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admin access only" ON social_posts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admin access only" ON social_analytics
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admin access only" ON content_suggestions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admin access only" ON social_builder_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Public read access for trending topics (could be used on public pages)
CREATE POLICY "Public read access" ON trending_topics
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admin full access" ON trending_topics
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- ============================================
-- Helper Functions
-- ============================================

-- Function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
    p_likes INTEGER,
    p_comments INTEGER,
    p_shares INTEGER,
    p_reach INTEGER
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF p_reach = 0 OR p_reach IS NULL THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((COALESCE(p_likes, 0) + COALESCE(p_comments, 0) + COALESCE(p_shares, 0))::DECIMAL / p_reach) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get best posting time for a platform
CREATE OR REPLACE FUNCTION get_optimal_post_time(p_platform VARCHAR)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_config JSONB;
    v_times TEXT[];
    v_timezone TEXT;
    v_next_time TIMESTAMPTZ;
BEGIN
    SELECT config_value->>p_platform INTO v_config
    FROM social_builder_config
    WHERE config_key = 'posting_schedule';

    IF v_config IS NULL THEN
        RETURN NOW() + INTERVAL '1 hour';
    END IF;

    v_times := ARRAY(SELECT jsonb_array_elements_text(v_config->'optimal_times'));
    v_timezone := v_config->>'timezone';

    -- Return the next optimal time (simplified logic)
    RETURN (NOW() AT TIME ZONE COALESCE(v_timezone, 'America/New_York') + INTERVAL '1 day')::DATE + v_times[1]::TIME;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_social_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_posts_timestamp
    BEFORE UPDATE ON social_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_social_updated_at();

CREATE TRIGGER update_influencer_tracking_timestamp
    BEFORE UPDATE ON influencer_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_social_updated_at();

CREATE TRIGGER update_trending_topics_timestamp
    BEFORE UPDATE ON trending_topics
    FOR EACH ROW
    EXECUTE FUNCTION update_social_updated_at();

-- ============================================
-- Sample Data for Testing (Optional)
-- ============================================

-- Uncomment to insert sample trending topics for testing
/*
INSERT INTO trending_topics (topic, category, source, trend_score, content_angles) VALUES
('CPI Report Release', 'economic_data', 'economic_calendar', 85,
 '[{"hook": "CPI just dropped! Here''s what it means for your trades...", "format": "reel"}]'),
('NVDA Earnings Beat', 'earnings', 'earnings_api', 90,
 '[{"hook": "NVIDIA crushed earnings again. Here''s the LTP setup I''m watching...", "format": "carousel"}]'),
('Revenge Trading Mistakes', 'psychology', 'social_hashtag', 75,
 '[{"hook": "Lost money revenge trading? You''re not alone. Here''s how to break the cycle...", "format": "reel"}]'),
('Fed Rate Decision', 'political', 'news_feed', 95,
 '[{"hook": "Fed announcement incoming! How I''m positioning...", "format": "story"}]');
*/
