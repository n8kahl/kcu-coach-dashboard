// ============================================
// KCU Social Builder - Type Definitions
// ============================================

// ============================================
// Platform Types
// ============================================

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube';

export type ContentType =
  | 'feed_post'
  | 'carousel'
  | 'reel'
  | 'story'
  | 'video'
  | 'short'
  | 'photo'
  | 'community_post';

export type ContentCategory =
  | 'educational'
  | 'community'
  | 'market_commentary'
  | 'promotional'
  | 'motivation'
  | 'entertainment';

// ============================================
// Social Accounts
// ============================================

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  account_id: string;
  account_name: string;
  account_handle?: string;
  profile_image_url?: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  metadata: Record<string, unknown>;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_active: boolean;
  connected_by?: string;
  connected_at: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialAccountInput {
  platform: SocialPlatform;
  account_id: string;
  account_name: string;
  account_handle?: string;
  profile_image_url?: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Influencer Profiles
// ============================================

export interface InfluencerProfile {
  id: string;
  platform: SocialPlatform;
  platform_user_id?: string;
  handle: string;
  display_name?: string;
  bio?: string;
  profile_url?: string;
  profile_image_url?: string;
  niche: string;
  tags: string[];
  followers_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  avg_posts_per_week: number;
  content_themes: string[];
  posting_schedule: PostingSchedule;
  tone_analysis: ToneAnalysis;
  relevance_score: number;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  is_active: boolean;
  last_scraped_at?: string;
  scrape_frequency_hours: number;
  added_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InfluencerProfileInput {
  platform: SocialPlatform;
  handle: string;
  display_name?: string;
  niche?: string;
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  scrape_frequency_hours?: number;
}

export interface PostingSchedule {
  best_days: string[];
  best_times: string[];
  timezone: string;
}

export interface ToneAnalysis {
  style: string;
  keywords: string[];
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'heavy';
  call_to_action_style: string;
  voice_attributes?: Record<string, number>;
  sample_hooks?: string[];
}

// ============================================
// Influencer Posts
// ============================================

export interface InfluencerPost {
  id: string;
  influencer_id: string;
  platform_post_id: string;
  platform_url?: string;
  content_type: ContentType;
  caption?: string;
  hashtags: string[];
  mentions: string[];
  media_type?: 'image' | 'video' | 'carousel';
  media_url?: string;
  thumbnail_url?: string;
  video_duration_seconds?: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_count: number;
  engagement_rate: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics: string[];
  tone_markers: Record<string, unknown>;
  hook_text?: string;
  call_to_action?: string;
  posted_at?: string;
  scraped_at: string;
  content_inspiration_used: boolean;
  created_at: string;
}

export interface ScrapedPostData {
  platform_post_id: string;
  platform_url?: string;
  content_type: ContentType;
  caption?: string;
  hashtags: string[];
  mentions: string[];
  media_type?: 'image' | 'video' | 'carousel';
  media_url?: string;
  thumbnail_url?: string;
  video_duration_seconds?: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_count: number;
  posted_at?: string;
}

// ============================================
// Trending Topics
// ============================================

export type TrendingCategory =
  | 'economic_data'
  | 'earnings'
  | 'futures'
  | 'political'
  | 'market_sentiment'
  | 'technical'
  | 'psychology'
  | 'news'
  | 'viral';

export interface TrendingTopic {
  id: string;
  topic: string;
  category: TrendingCategory;
  source: string;
  source_id?: string;
  source_url?: string;
  source_data: Record<string, unknown>;
  trend_score: number;
  mention_count: number;
  sentiment?: number;
  velocity: 'rising' | 'stable' | 'falling';
  content_angles: ContentAngle[];
  suggested_hooks: string[];
  relevant_hashtags: string[];
  event_date?: string;
  started_trending_at: string;
  peak_time?: string;
  expires_at?: string;
  is_active: boolean;
  processed_for_suggestions: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentAngle {
  hook: string;
  format: ContentType;
  platform?: SocialPlatform;
  estimated_engagement?: number;
}

// ============================================
// Content Suggestions
// ============================================

export type InspirationSource =
  | 'influencer'
  | 'trending_topic'
  | 'kcu_win'
  | 'kcu_streak'
  | 'kcu_achievement'
  | 'curriculum'
  | 'market_event'
  | 'manual';

export type SuggestionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'scheduled'
  | 'published'
  | 'expired';

export interface ContentSuggestion {
  id: string;
  platforms: SocialPlatform[];
  content_type: ContentType;
  suggested_caption: string;
  suggested_hashtags: string[];
  suggested_hook?: string;
  suggested_cta?: string;
  platform_variants: PlatformVariants;
  topic?: string;
  category?: ContentCategory;
  inspiration_source?: InspirationSource;
  inspiration_id?: string;
  inspiration_data: Record<string, unknown>;
  predicted_engagement_score?: number;
  kcu_tone_match_score?: number;
  reasoning?: string;
  suggested_media_type?: string;
  media_suggestions: Record<string, unknown>;
  optimal_post_times: OptimalPostTime[];
  status: SuggestionStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  published_post_id?: string;
  published_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformVariants {
  instagram?: PlatformContent;
  tiktok?: PlatformContent;
  youtube?: PlatformContent;
}

export interface PlatformContent {
  caption: string;
  hashtags: string[];
  cta?: string;
}

export interface OptimalPostTime {
  platform: SocialPlatform;
  datetime: string;
  score: number;
}

export interface ContentSuggestionInput {
  platforms: SocialPlatform[];
  content_type: ContentType;
  suggested_caption: string;
  suggested_hashtags?: string[];
  suggested_hook?: string;
  topic?: string;
  category?: ContentCategory;
  inspiration_source?: InspirationSource;
  inspiration_id?: string;
  inspiration_data?: Record<string, unknown>;
}

// ============================================
// Social Posts
// ============================================

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'deleted';

export interface SocialPost {
  id: string;
  account_id: string;
  content_type: ContentType;
  caption?: string;
  hashtags: string[];
  mentions: string[];
  media: PostMedia[];
  platform_post_id?: string;
  platform_url?: string;
  status: PostStatus;
  scheduled_for?: string;
  published_at?: string;
  error_message?: string;
  retry_count: number;
  last_retry_at?: string;
  suggestion_id?: string;
  content_category?: string;
  ai_generated: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PostMedia {
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface SocialPostInput {
  account_id: string;
  content_type: ContentType;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  media?: PostMedia[];
  scheduled_for?: string;
  suggestion_id?: string;
  content_category?: ContentCategory;
}

// ============================================
// Analytics
// ============================================

export interface SocialAnalytics {
  id: string;
  post_id: string;
  recorded_at: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  video_views?: number;
  video_watch_time_seconds?: number;
  average_watch_percentage?: number;
  engagement_rate: number;
  platform_metrics: Record<string, unknown>;
  demographics: Demographics;
}

export interface Demographics {
  age_groups?: Record<string, number>;
  gender?: Record<string, number>;
  locations?: LocationData[];
  peak_times?: string[];
}

export interface LocationData {
  country: string;
  city?: string;
  percentage: number;
}

export interface AccountAnalyticsDaily {
  id: string;
  account_id: string;
  date: string;
  followers_count: number;
  followers_gained: number;
  followers_lost: number;
  net_followers: number;
  posts_published: number;
  total_impressions: number;
  total_reach: number;
  total_engagement: number;
  average_engagement_rate: number;
  top_post_id?: string;
  created_at: string;
}

export interface HashtagPerformance {
  id: string;
  hashtag: string;
  platform: SocialPlatform;
  times_used: number;
  total_reach: number;
  total_engagement: number;
  average_engagement_rate: number;
  is_trending: boolean;
  trend_volume?: number;
  best_content_types: string[];
  best_categories: string[];
  last_used_at?: string;
  updated_at: string;
}

// ============================================
// KCU Tone Profile
// ============================================

export interface KCUToneProfile {
  id: string;
  voice_attributes: Record<string, number>;
  preferred_phrases: string[];
  avoided_phrases: string[];
  emoji_style: 'none' | 'minimal' | 'moderate' | 'heavy';
  preferred_emojis: string[];
  cta_patterns: string[];
  hook_patterns: string[];
  always_use_hashtags: string[];
  never_use_hashtags: string[];
  platform_adjustments: Record<SocialPlatform, Partial<KCUToneProfile>>;
  sample_posts: SamplePost[];
  is_active: boolean;
  updated_by?: string;
  updated_at: string;
  created_at: string;
}

export interface SamplePost {
  platform: SocialPlatform;
  caption: string;
  engagement_rate: number;
}

// ============================================
// Configuration
// ============================================

export interface SocialBuilderConfig {
  posting_schedule: Record<SocialPlatform, PlatformSchedule>;
  content_mix: Record<ContentCategory, number>;
  ai_settings: AISettings;
  scraping_settings: ScrapingSettings;
  hashtag_limits: Record<SocialPlatform, HashtagLimits>;
  compliance: ComplianceSettings;
}

export interface PlatformSchedule {
  optimal_times: string[];
  timezone: string;
  max_posts_per_day: number;
}

export interface AISettings {
  model: string;
  temperature: number;
  max_suggestions_per_day: number;
  auto_generate: boolean;
  require_approval: boolean;
}

export interface ScrapingSettings {
  default_posts_per_scrape: number;
  scrape_interval_hours: number;
  max_influencers_per_platform: number;
  analyze_tone_on_scrape: boolean;
}

export interface HashtagLimits {
  min: number;
  max: number;
  optimal: number;
}

export interface ComplianceSettings {
  include_disclaimer: boolean;
  disclaimer_text: string;
  require_review: boolean;
  blocked_words: string[];
}

// ============================================
// Audit Log
// ============================================

export type SocialAuditAction =
  | 'account_connected'
  | 'account_disconnected'
  | 'influencer_added'
  | 'influencer_removed'
  | 'influencer_scraped'
  | 'suggestion_created'
  | 'suggestion_approved'
  | 'suggestion_rejected'
  | 'post_created'
  | 'post_scheduled'
  | 'post_published'
  | 'post_deleted'
  | 'config_updated';

export interface SocialAuditLog {
  id: string;
  action: SocialAuditAction;
  entity_type: string;
  entity_id?: string;
  actor_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// ============================================
// API Response Types
// ============================================

export interface ScrapeResult {
  success: boolean;
  influencer_id: string;
  posts_scraped: number;
  new_posts: number;
  updated_posts: number;
  errors?: string[];
}

export interface ToneComparisonResult {
  similarity_score: number;
  matching_attributes: string[];
  divergent_attributes: string[];
  recommendations: string[];
}

export interface ContentGenerationContext {
  trending_topics?: TrendingTopic[];
  influencer_posts?: InfluencerPost[];
  kcu_data?: KCUDataContext;
  target_platforms: SocialPlatform[];
  target_category?: ContentCategory;
  count?: number;
}

export interface KCUDataContext {
  recent_wins?: Array<{
    username: string;
    pnl: number;
    symbol: string;
    setup_type?: string;
  }>;
  top_streaks?: Array<{
    username: string;
    streak_days: number;
  }>;
  community_stats?: {
    total_members: number;
    active_members: number;
    total_trades: number;
    average_win_rate: number;
  };
  popular_lessons?: Array<{
    title: string;
    completions: number;
  }>;
  recent_setups?: Array<{
    symbol: string;
    direction: 'long' | 'short';
    outcome: 'win' | 'loss';
    ltp_score: number;
  }>;
}

export interface GeneratedContent {
  suggestions: ContentSuggestion[];
  reasoning: string;
  inspiration_sources: string[];
}

// ============================================
// Dashboard Types
// ============================================

export interface SocialDashboardStats {
  total_followers: number;
  followers_change_7d: number;
  total_posts_30d: number;
  average_engagement_rate: number;
  pending_suggestions: number;
  scheduled_posts: number;
  platforms: PlatformStats[];
}

export interface PlatformStats {
  platform: SocialPlatform;
  account_handle: string;
  followers: number;
  followers_change_7d: number;
  posts_30d: number;
  engagement_rate: number;
  top_post?: {
    id: string;
    thumbnail_url?: string;
    engagement_rate: number;
  };
}

export interface InfluencerDashboardData {
  total_tracked: number;
  by_platform: Record<SocialPlatform, number>;
  last_scraped: string;
  top_performers: InfluencerProfile[];
  recent_posts: InfluencerPost[];
}

export interface ContentCalendarItem {
  id: string;
  type: 'suggestion' | 'scheduled' | 'published';
  date: string;
  platform: SocialPlatform;
  content_preview: string;
  status: SuggestionStatus | PostStatus;
  engagement_rate?: number;
}
