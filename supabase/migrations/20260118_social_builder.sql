-- ============================================
-- KCU Social Builder - Database Schema
-- Migration: 20260118_social_builder
-- ============================================

-- ============================================
-- 1. SOCIAL ACCOUNTS
-- Connected social media accounts
-- ============================================

CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
    account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_handle VARCHAR(255),
    profile_image_url TEXT,

    -- OAuth credentials (encrypted at rest by Supabase)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Platform-specific metadata
    metadata JSONB DEFAULT '{}',

    -- Account statistics (cached from platform)
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,
    connected_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(platform, account_id)
);

CREATE INDEX idx_social_accounts_platform ON social_accounts(platform, is_active);
CREATE INDEX idx_social_accounts_active ON social_accounts(is_active) WHERE is_active = true;

-- ============================================
-- 2. INFLUENCER PROFILES
-- Day trading influencers being monitored
-- ============================================

CREATE TABLE IF NOT EXISTS influencer_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
    platform_user_id VARCHAR(255),
    handle VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    bio TEXT,
    profile_url TEXT,
    profile_image_url TEXT,

    -- Categorization
    niche VARCHAR(50) DEFAULT 'day_trading',
    tags TEXT[] DEFAULT '{}',

    -- Metrics (updated on each scrape)
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    avg_likes INTEGER DEFAULT 0,
    avg_comments INTEGER DEFAULT 0,
    avg_posts_per_week DECIMAL(5,2) DEFAULT 0,

    -- Content analysis (AI-generated)
    content_themes TEXT[] DEFAULT '{}',
    posting_schedule JSONB DEFAULT '{"best_days": [], "best_times": [], "timezone": "America/New_York"}',
    tone_analysis JSONB DEFAULT '{"style": "", "keywords": [], "emoji_usage": "moderate", "call_to_action_style": ""}',

    -- Tracking status
    relevance_score INTEGER DEFAULT 50 CHECK (relevance_score BETWEEN 0 AND 100),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    notes TEXT,

    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    scrape_frequency_hours INTEGER DEFAULT 24,

    added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(platform, handle)
);

CREATE INDEX idx_influencer_profiles_platform ON influencer_profiles(platform, is_active);
CREATE INDEX idx_influencer_profiles_priority ON influencer_profiles(priority, relevance_score DESC);
CREATE INDEX idx_influencer_profiles_scrape ON influencer_profiles(last_scraped_at) WHERE is_active = true;

-- ============================================
-- 3. INFLUENCER POSTS
-- Scraped content from influencers
-- ============================================

CREATE TABLE IF NOT EXISTS influencer_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    influencer_id UUID NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,

    -- Platform identifiers
    platform_post_id VARCHAR(255) NOT NULL,
    platform_url TEXT,

    -- Content
    content_type VARCHAR(30) NOT NULL,
    caption TEXT,
    hashtags TEXT[] DEFAULT '{}',
    mentions TEXT[] DEFAULT '{}',

    -- Media info
    media_type VARCHAR(20), -- image, video, carousel
    media_url TEXT,
    thumbnail_url TEXT,
    video_duration_seconds INTEGER,

    -- Engagement metrics
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,

    -- AI Analysis
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    topics TEXT[] DEFAULT '{}',
    tone_markers JSONB DEFAULT '{}',
    hook_text TEXT, -- First line or attention grabber
    call_to_action TEXT,

    -- Timing
    posted_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),

    -- For tracking what we've learned from this post
    content_inspiration_used BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(influencer_id, platform_post_id)
);

CREATE INDEX idx_influencer_posts_influencer ON influencer_posts(influencer_id, posted_at DESC);
CREATE INDEX idx_influencer_posts_engagement ON influencer_posts(engagement_rate DESC);
CREATE INDEX idx_influencer_posts_topics ON influencer_posts USING GIN(topics);
CREATE INDEX idx_influencer_posts_unused ON influencer_posts(content_inspiration_used) WHERE content_inspiration_used = false;

-- ============================================
-- 4. TRENDING TOPICS
-- Real-time trending day trading topics
-- ============================================

CREATE TABLE IF NOT EXISTS trending_topics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    topic VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'economic_data', 'earnings', 'futures', 'political',
        'market_sentiment', 'technical', 'psychology', 'news', 'viral'
    )),

    -- Source information
    source VARCHAR(50) NOT NULL,
    source_id VARCHAR(255),
    source_url TEXT,
    source_data JSONB DEFAULT '{}',

    -- Trend metrics
    trend_score INTEGER DEFAULT 50 CHECK (trend_score BETWEEN 0 AND 100),
    mention_count INTEGER DEFAULT 0,
    sentiment DECIMAL(3,2), -- -1.0 to 1.0
    velocity VARCHAR(20) DEFAULT 'stable' CHECK (velocity IN ('rising', 'stable', 'falling')),

    -- Content opportunities
    content_angles JSONB DEFAULT '[]',
    suggested_hooks TEXT[] DEFAULT '{}',
    relevant_hashtags TEXT[] DEFAULT '{}',

    -- Timing
    event_date TIMESTAMPTZ, -- For scheduled events like earnings
    started_trending_at TIMESTAMPTZ DEFAULT NOW(),
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
CREATE INDEX idx_trending_topics_event ON trending_topics(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_trending_topics_unprocessed ON trending_topics(processed_for_suggestions) WHERE processed_for_suggestions = false;

-- ============================================
-- 5. CONTENT SUGGESTIONS
-- AI-generated content recommendations
-- ============================================

CREATE TABLE IF NOT EXISTS content_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Target platforms
    platforms VARCHAR(20)[] NOT NULL,
    content_type VARCHAR(30) NOT NULL,

    -- Generated content
    suggested_caption TEXT NOT NULL,
    suggested_hashtags TEXT[] DEFAULT '{}',
    suggested_hook TEXT,
    suggested_cta TEXT,

    -- Platform-specific variants
    platform_variants JSONB DEFAULT '{}',
    -- { instagram: { caption: "", hashtags: [] }, tiktok: { ... } }

    -- Content metadata
    topic VARCHAR(100),
    category VARCHAR(50) CHECK (category IN (
        'educational', 'community', 'market_commentary',
        'promotional', 'motivation', 'entertainment'
    )),

    -- Inspiration source
    inspiration_source VARCHAR(30) CHECK (inspiration_source IN (
        'influencer', 'trending_topic', 'kcu_win', 'kcu_streak',
        'kcu_achievement', 'curriculum', 'market_event', 'manual'
    )),
    inspiration_id UUID,
    inspiration_data JSONB DEFAULT '{}',

    -- AI analysis
    predicted_engagement_score DECIMAL(5,2),
    kcu_tone_match_score DECIMAL(5,2), -- How well it matches KCU voice
    reasoning TEXT,

    -- Media suggestions
    suggested_media_type VARCHAR(20),
    media_suggestions JSONB DEFAULT '{}',

    -- Scheduling
    optimal_post_times JSONB DEFAULT '[]',

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'edited', 'scheduled', 'published', 'expired'
    )),

    -- Review tracking
    reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- If published
    published_post_id UUID,
    published_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_suggestions_status ON content_suggestions(status, created_at DESC);
CREATE INDEX idx_content_suggestions_category ON content_suggestions(category, status);
CREATE INDEX idx_content_suggestions_pending ON content_suggestions(created_at DESC) WHERE status = 'pending';

-- ============================================
-- 6. SOCIAL POSTS
-- Published and scheduled posts
-- ============================================

CREATE TABLE IF NOT EXISTS social_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,

    -- Content
    content_type VARCHAR(30) NOT NULL,
    caption TEXT,
    hashtags TEXT[] DEFAULT '{}',
    mentions TEXT[] DEFAULT '{}',

    -- Media
    media JSONB DEFAULT '[]',

    -- Platform identifiers (after publishing)
    platform_post_id VARCHAR(255),
    platform_url TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'publishing', 'published', 'failed', 'deleted'
    )),

    -- Scheduling
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,

    -- Linking
    suggestion_id UUID REFERENCES content_suggestions(id) ON DELETE SET NULL,
    content_category VARCHAR(50),
    ai_generated BOOLEAN DEFAULT false,

    -- Metadata
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_posts_account ON social_posts(account_id, status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_published ON social_posts(published_at DESC) WHERE status = 'published';

-- ============================================
-- 7. SOCIAL ANALYTICS
-- Engagement metrics per post
-- ============================================

CREATE TABLE IF NOT EXISTS social_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,

    -- Snapshot timestamp
    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Common metrics
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,

    -- Video metrics
    video_views INTEGER,
    video_watch_time_seconds INTEGER,
    average_watch_percentage DECIMAL(5,2),

    -- Calculated
    engagement_rate DECIMAL(5,2),

    -- Platform-specific (flexible schema)
    platform_metrics JSONB DEFAULT '{}',

    -- Demographics snapshot
    demographics JSONB DEFAULT '{}'
);

CREATE INDEX idx_social_analytics_post ON social_analytics(post_id, recorded_at DESC);
CREATE UNIQUE INDEX idx_social_analytics_unique ON social_analytics(post_id, recorded_at);

-- ============================================
-- 8. ACCOUNT ANALYTICS DAILY
-- Daily rollup of account metrics
-- ============================================

CREATE TABLE IF NOT EXISTS account_analytics_daily (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Follower changes
    followers_count INTEGER,
    followers_gained INTEGER DEFAULT 0,
    followers_lost INTEGER DEFAULT 0,
    net_followers INTEGER DEFAULT 0,

    -- Daily totals
    posts_published INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_reach INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,

    -- Averages
    average_engagement_rate DECIMAL(5,2),

    -- Best performing
    top_post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(account_id, date)
);

CREATE INDEX idx_account_analytics_date ON account_analytics_daily(account_id, date DESC);

-- ============================================
-- 9. HASHTAG PERFORMANCE
-- Track hashtag effectiveness
-- ============================================

CREATE TABLE IF NOT EXISTS hashtag_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

    -- Best use cases
    best_content_types TEXT[] DEFAULT '{}',
    best_categories TEXT[] DEFAULT '{}',

    last_used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(hashtag, platform)
);

CREATE INDEX idx_hashtag_performance_platform ON hashtag_performance(platform, average_engagement_rate DESC);
CREATE INDEX idx_hashtag_performance_trending ON hashtag_performance(is_trending, trend_volume DESC);

-- ============================================
-- 10. KCU TONE PROFILE
-- Defines KCU's brand voice for AI matching
-- ============================================

CREATE TABLE IF NOT EXISTS kcu_tone_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Core voice characteristics
    voice_attributes JSONB DEFAULT '{
        "confident": 0.8,
        "humble": 0.7,
        "educational": 0.9,
        "motivational": 0.6,
        "professional": 0.7,
        "casual": 0.5,
        "authoritative": 0.7,
        "supportive": 0.8
    }',

    -- Language patterns
    preferred_phrases TEXT[] DEFAULT '{}',
    avoided_phrases TEXT[] DEFAULT '{}',

    -- Emoji usage
    emoji_style VARCHAR(20) DEFAULT 'moderate' CHECK (emoji_style IN ('none', 'minimal', 'moderate', 'heavy')),
    preferred_emojis TEXT[] DEFAULT '{}',

    -- Call to action patterns
    cta_patterns TEXT[] DEFAULT '{}',

    -- Hook patterns
    hook_patterns TEXT[] DEFAULT '{}',

    -- Hashtag strategy
    always_use_hashtags TEXT[] DEFAULT '{}',
    never_use_hashtags TEXT[] DEFAULT '{}',

    -- Platform-specific adjustments
    platform_adjustments JSONB DEFAULT '{}',

    -- Sample content for AI reference
    sample_posts JSONB DEFAULT '[]',

    is_active BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. SOCIAL BUILDER CONFIG
-- System configuration
-- ============================================

CREATE TABLE IF NOT EXISTS social_builder_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configurations
INSERT INTO social_builder_config (config_key, config_value, description) VALUES
('posting_schedule', '{
    "instagram": {"optimal_times": ["09:00", "12:00", "18:00"], "timezone": "America/New_York", "max_posts_per_day": 3},
    "tiktok": {"optimal_times": ["07:00", "12:00", "19:00"], "timezone": "America/New_York", "max_posts_per_day": 3},
    "youtube": {"optimal_times": ["14:00", "17:00"], "timezone": "America/New_York", "max_posts_per_day": 1}
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
    "auto_generate": false,
    "require_approval": true
}', 'AI content generation settings'),

('scraping_settings', '{
    "default_posts_per_scrape": 20,
    "scrape_interval_hours": 24,
    "max_influencers_per_platform": 50,
    "analyze_tone_on_scrape": true
}', 'Influencer scraping configuration'),

('hashtag_limits', '{
    "instagram": {"min": 5, "max": 30, "optimal": 11},
    "tiktok": {"min": 3, "max": 8, "optimal": 5},
    "youtube": {"min": 0, "max": 15, "optimal": 8}
}', 'Hashtag count limits by platform'),

('compliance', '{
    "include_disclaimer": true,
    "disclaimer_text": "Educational content only. Not financial advice. Past performance does not guarantee future results.",
    "require_review": true,
    "blocked_words": ["guaranteed", "sure thing", "easy money", "get rich"]
}', 'Content compliance settings')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- 12. SOCIAL AUDIT LOG
-- Audit trail for social actions
-- ============================================

CREATE TABLE IF NOT EXISTS social_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID,

    actor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

    details JSONB DEFAULT '{}',
    ip_address INET,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_audit_log_time ON social_audit_log(created_at DESC);
CREATE INDEX idx_social_audit_log_entity ON social_audit_log(entity_type, entity_id);
CREATE INDEX idx_social_audit_log_actor ON social_audit_log(actor_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE kcu_tone_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_builder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admin full access" ON social_accounts FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON influencer_profiles FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON influencer_posts FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON trending_topics FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON content_suggestions FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON social_posts FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON social_analytics FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON account_analytics_daily FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON hashtag_performance FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON kcu_tone_profile FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON social_builder_config FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin full access" ON social_audit_log FOR ALL
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
    p_likes INTEGER,
    p_comments INTEGER,
    p_shares INTEGER,
    p_followers INTEGER
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF p_followers = 0 OR p_followers IS NULL THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((COALESCE(p_likes, 0) + COALESCE(p_comments, 0) * 2 + COALESCE(p_shares, 0) * 3)::DECIMAL / p_followers) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get next optimal post time
CREATE OR REPLACE FUNCTION get_next_optimal_post_time(p_platform VARCHAR)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_config JSONB;
    v_times TEXT[];
    v_timezone TEXT;
    v_now TIMESTAMPTZ;
    v_next_time TIMESTAMPTZ;
    v_time TEXT;
BEGIN
    SELECT config_value->p_platform INTO v_config
    FROM social_builder_config
    WHERE config_key = 'posting_schedule';

    IF v_config IS NULL THEN
        RETURN NOW() + INTERVAL '1 hour';
    END IF;

    v_times := ARRAY(SELECT jsonb_array_elements_text(v_config->'optimal_times'));
    v_timezone := COALESCE(v_config->>'timezone', 'America/New_York');
    v_now := NOW() AT TIME ZONE v_timezone;

    -- Find next available time
    FOREACH v_time IN ARRAY v_times LOOP
        v_next_time := (v_now::DATE + v_time::TIME) AT TIME ZONE v_timezone;
        IF v_next_time > NOW() THEN
            RETURN v_next_time;
        END IF;
    END LOOP;

    -- If no times today, return first time tomorrow
    RETURN ((v_now::DATE + INTERVAL '1 day') + v_times[1]::TIME) AT TIME ZONE v_timezone;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps trigger
CREATE OR REPLACE FUNCTION update_social_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
CREATE TRIGGER update_social_accounts_timestamp
    BEFORE UPDATE ON social_accounts
    FOR EACH ROW EXECUTE FUNCTION update_social_timestamp();

CREATE TRIGGER update_influencer_profiles_timestamp
    BEFORE UPDATE ON influencer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_social_timestamp();

CREATE TRIGGER update_trending_topics_timestamp
    BEFORE UPDATE ON trending_topics
    FOR EACH ROW EXECUTE FUNCTION update_social_timestamp();

CREATE TRIGGER update_content_suggestions_timestamp
    BEFORE UPDATE ON content_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_social_timestamp();

CREATE TRIGGER update_social_posts_timestamp
    BEFORE UPDATE ON social_posts
    FOR EACH ROW EXECUTE FUNCTION update_social_timestamp();

-- ============================================
-- INSERT DEFAULT KCU TONE PROFILE
-- ============================================

INSERT INTO kcu_tone_profile (
    voice_attributes,
    preferred_phrases,
    avoided_phrases,
    emoji_style,
    preferred_emojis,
    cta_patterns,
    hook_patterns,
    always_use_hashtags,
    never_use_hashtags,
    sample_posts
) VALUES (
    '{
        "confident": 0.8,
        "humble": 0.7,
        "educational": 0.9,
        "motivational": 0.6,
        "professional": 0.7,
        "casual": 0.5,
        "authoritative": 0.7,
        "supportive": 0.8,
        "disciplined": 0.9,
        "patient": 0.8
    }',
    ARRAY[
        'Level, Trend, Patience',
        'The process over the outcome',
        'Discipline is the edge',
        'Wait for your setup',
        'Trust the framework',
        'Green days are earned',
        'Control what you can control'
    ],
    ARRAY[
        'guaranteed profits',
        'easy money',
        'get rich quick',
        'never lose',
        'sure thing',
        'cant miss',
        'free money'
    ],
    'moderate',
    ARRAY['📈', '💪', '🎯', '✅', '🔥', '💡', '📊', '⚡'],
    ARRAY[
        'Drop a 🔥 if this resonates',
        'Save this for later',
        'Tag a trader who needs this',
        'Link in bio to learn more',
        'Comment your biggest struggle below'
    ],
    ARRAY[
        'The difference between profitable and struggling traders?',
        'Stop making this mistake...',
        'Why 90% of traders fail:',
        'The setup nobody talks about:',
        'I lost $X before I learned this:',
        'One concept that changed my trading:'
    ],
    ARRAY['#daytrading', '#trading', '#stockmarket', '#LTPframework'],
    ARRAY['#getrichquick', '#freemoney', '#guaranteedprofits', '#neverlose'],
    '[
        {
            "platform": "instagram",
            "caption": "The LTP Framework in action 📈\n\nLevel ✅ Trading at previous day high\nTrend ✅ Higher highs, higher lows on 5min\nPatience ✅ 3 candle consolidation at level\n\nThis is what we wait for. This is the edge.\n\nSave this post and study it.\n\n#daytrading #LTPframework #tradingsetup",
            "engagement_rate": 4.2
        }
    ]'::JSONB
);

-- ============================================
-- GRANT PERMISSIONS (for service role)
-- ============================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
