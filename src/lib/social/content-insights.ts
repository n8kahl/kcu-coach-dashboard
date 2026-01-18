// ============================================
// KCU Social Builder - Content Insights Analyzer
// ============================================
// Analyzes KayCapitals' content performance and generates
// data-driven video content ideas based on competitor analysis

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import {
  scrapeInstagramPosts,
  scrapeTikTokPosts,
  scrapeInstagramProfile,
  scrapeTikTokProfile,
} from './influencer-scraper';
import type {
  SocialPlatform,
  InfluencerPost,
  ContentCategory,
  ContentType,
} from '@/types/social';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Types
// ============================================

export interface ContentInsight {
  id: string;
  type: 'performance' | 'content_idea' | 'trend' | 'competitor';
  title: string;
  description: string;
  metrics?: Record<string, number>;
  recommendations?: string[];
  content_ideas?: VideoContentIdea[];
  source: string;
  confidence: number;
  created_at: string;
}

export interface VideoContentIdea {
  hook: string;
  concept: string;
  format: ContentType;
  platform: SocialPlatform;
  estimated_engagement: 'high' | 'medium' | 'low';
  hashtags: string[];
  inspiration_source?: string;
  script_outline?: string[];
  why_it_works: string;
}

export interface EngagementAnalytics {
  platform: SocialPlatform;
  account_handle: string;
  total_posts_analyzed: number;
  avg_engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  avg_views: number;
  best_performing_posts: InfluencerPost[];
  worst_performing_posts: InfluencerPost[];
  best_posting_times: string[];
  best_content_types: { type: ContentType; avg_engagement: number }[];
  best_hashtags: { hashtag: string; avg_engagement: number }[];
  content_themes: { theme: string; count: number; avg_engagement: number }[];
  engagement_trend: 'rising' | 'stable' | 'declining';
}

export interface CompetitorComparison {
  our_account: string;
  competitor_handle: string;
  platform: SocialPlatform;
  our_metrics: {
    followers: number;
    engagement_rate: number;
    avg_likes: number;
    posting_frequency: number;
  };
  competitor_metrics: {
    followers: number;
    engagement_rate: number;
    avg_likes: number;
    posting_frequency: number;
  };
  gaps: string[];
  opportunities: string[];
  content_to_emulate: InfluencerPost[];
}

// ============================================
// Featured Influencers to Analyze
// ============================================

const FEATURED_INFLUENCERS = [
  // Trading influencers on Instagram
  { platform: 'instagram' as SocialPlatform, handle: 'tjr_trading', name: 'TJR' },
  { platform: 'instagram' as SocialPlatform, handle: 'warrior_trading', name: 'Warrior Trading' },
  { platform: 'instagram' as SocialPlatform, handle: 'humbledtrader', name: 'Humbled Trader' },
  { platform: 'instagram' as SocialPlatform, handle: 'stockmarketz', name: 'Stock Marketz' },

  // TikTok trading influencers
  { platform: 'tiktok' as SocialPlatform, handle: 'tjr_trading', name: 'TJR' },
  { platform: 'tiktok' as SocialPlatform, handle: 'humbledtrader', name: 'Humbled Trader' },
  { platform: 'tiktok' as SocialPlatform, handle: 'stockspert', name: 'Stockspert' },
];

// KayCapitals accounts
const KAYCAPITALS_ACCOUNTS = {
  instagram: process.env.KAYCAPITALS_INSTAGRAM_HANDLE || 'kaycapitals',
  tiktok: process.env.KAYCAPITALS_TIKTOK_HANDLE || 'kaycapitals',
  youtube: process.env.KAY_CAPITALS_CHANNEL_ID || '',
};

// ============================================
// Engagement Analytics
// ============================================

/**
 * Analyze engagement metrics for a specific account
 */
export async function analyzeEngagement(
  platform: SocialPlatform,
  handle: string,
  postLimit: number = 50
): Promise<EngagementAnalytics | null> {
  try {
    // Fetch posts
    let posts: any[];
    let profile: any;

    if (platform === 'instagram') {
      posts = await scrapeInstagramPosts(handle, postLimit);
      profile = await scrapeInstagramProfile(handle);
    } else if (platform === 'tiktok') {
      posts = await scrapeTikTokPosts(handle, postLimit);
      profile = await scrapeTikTokProfile(handle);
    } else {
      return null;
    }

    if (!posts || posts.length === 0) {
      return null;
    }

    // Calculate metrics
    const followerCount = profile?.followers_count || 1;

    const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0);

    const avgLikes = totalLikes / posts.length;
    const avgComments = totalComments / posts.length;
    const avgViews = totalViews / posts.length;
    const avgEngagementRate = ((avgLikes + avgComments * 2) / followerCount) * 100;

    // Sort posts by engagement
    const sortedPosts = [...posts].sort((a, b) => {
      const engA = (a.likes_count || 0) + (a.comments_count || 0) * 2;
      const engB = (b.likes_count || 0) + (b.comments_count || 0) * 2;
      return engB - engA;
    });

    // Analyze hashtags
    const hashtagEngagement = new Map<string, { total: number; count: number }>();
    for (const post of posts) {
      const engagement = (post.likes_count || 0) + (post.comments_count || 0) * 2;
      for (const tag of post.hashtags || []) {
        const current = hashtagEngagement.get(tag) || { total: 0, count: 0 };
        hashtagEngagement.set(tag, {
          total: current.total + engagement,
          count: current.count + 1,
        });
      }
    }

    const bestHashtags = Array.from(hashtagEngagement.entries())
      .map(([hashtag, data]) => ({
        hashtag,
        avg_engagement: data.total / data.count,
      }))
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, 10);

    // Analyze content types
    const contentTypeEngagement = new Map<string, { total: number; count: number }>();
    for (const post of posts) {
      const type = post.content_type || 'unknown';
      const engagement = (post.likes_count || 0) + (post.comments_count || 0) * 2;
      const current = contentTypeEngagement.get(type) || { total: 0, count: 0 };
      contentTypeEngagement.set(type, {
        total: current.total + engagement,
        count: current.count + 1,
      });
    }

    const bestContentTypes = Array.from(contentTypeEngagement.entries())
      .map(([type, data]) => ({
        type: type as ContentType,
        avg_engagement: data.total / data.count,
      }))
      .sort((a, b) => b.avg_engagement - a.avg_engagement);

    // Analyze posting times
    const timeEngagement = new Map<string, { total: number; count: number }>();
    for (const post of posts) {
      if (post.posted_at) {
        const hour = new Date(post.posted_at).getHours();
        const timeSlot = `${hour}:00`;
        const engagement = (post.likes_count || 0) + (post.comments_count || 0) * 2;
        const current = timeEngagement.get(timeSlot) || { total: 0, count: 0 };
        timeEngagement.set(timeSlot, {
          total: current.total + engagement,
          count: current.count + 1,
        });
      }
    }

    const bestTimes = Array.from(timeEngagement.entries())
      .map(([time, data]) => ({
        time,
        avg_engagement: data.total / data.count,
      }))
      .sort((a, b) => b.avg_engagement - a.avg_engagement)
      .slice(0, 5)
      .map((t) => t.time);

    // Determine engagement trend
    const recentPosts = posts.slice(0, Math.min(10, posts.length));
    const olderPosts = posts.slice(Math.max(0, posts.length - 10));

    const recentAvg =
      recentPosts.reduce((sum, p) => sum + (p.likes_count || 0), 0) / recentPosts.length;
    const olderAvg =
      olderPosts.reduce((sum, p) => sum + (p.likes_count || 0), 0) / olderPosts.length;

    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    if (recentAvg > olderAvg * 1.15) trend = 'rising';
    else if (recentAvg < olderAvg * 0.85) trend = 'declining';

    return {
      platform,
      account_handle: handle,
      total_posts_analyzed: posts.length,
      avg_engagement_rate: Math.round(avgEngagementRate * 100) / 100,
      avg_likes: Math.round(avgLikes),
      avg_comments: Math.round(avgComments),
      avg_views: Math.round(avgViews),
      best_performing_posts: sortedPosts.slice(0, 5) as InfluencerPost[],
      worst_performing_posts: sortedPosts.slice(-5).reverse() as InfluencerPost[],
      best_posting_times: bestTimes,
      best_content_types: bestContentTypes,
      best_hashtags: bestHashtags,
      content_themes: [], // Would require NLP analysis
      engagement_trend: trend,
    };
  } catch (error) {
    console.error(`Error analyzing engagement for ${handle}:`, error);
    return null;
  }
}

/**
 * Analyze KayCapitals' own content
 */
export async function analyzeKayCapitalsContent(): Promise<{
  instagram?: EngagementAnalytics;
  tiktok?: EngagementAnalytics;
}> {
  const results: { instagram?: EngagementAnalytics; tiktok?: EngagementAnalytics } = {};

  if (KAYCAPITALS_ACCOUNTS.instagram) {
    results.instagram = await analyzeEngagement('instagram', KAYCAPITALS_ACCOUNTS.instagram, 50) || undefined;
  }

  if (KAYCAPITALS_ACCOUNTS.tiktok) {
    results.tiktok = await analyzeEngagement('tiktok', KAYCAPITALS_ACCOUNTS.tiktok, 50) || undefined;
  }

  return results;
}

// ============================================
// Competitor Analysis
// ============================================

/**
 * Compare KayCapitals with a competitor
 */
export async function compareWithCompetitor(
  platform: SocialPlatform,
  competitorHandle: string
): Promise<CompetitorComparison | null> {
  try {
    const ourHandle = KAYCAPITALS_ACCOUNTS[platform];
    if (!ourHandle) return null;

    const [ourAnalytics, competitorAnalytics] = await Promise.all([
      analyzeEngagement(platform, ourHandle, 30),
      analyzeEngagement(platform, competitorHandle, 30),
    ]);

    if (!ourAnalytics || !competitorAnalytics) return null;

    const gaps: string[] = [];
    const opportunities: string[] = [];

    // Identify gaps
    if (competitorAnalytics.avg_engagement_rate > ourAnalytics.avg_engagement_rate * 1.2) {
      gaps.push(
        `Competitor has ${Math.round((competitorAnalytics.avg_engagement_rate / ourAnalytics.avg_engagement_rate - 1) * 100)}% higher engagement rate`
      );
    }

    if (competitorAnalytics.avg_comments > ourAnalytics.avg_comments * 1.5) {
      gaps.push('Competitor generates more comments/discussions');
    }

    // Identify opportunities
    const competitorBestHashtags = new Set(competitorAnalytics.best_hashtags.map((h) => h.hashtag));
    const ourHashtags = new Set(ourAnalytics.best_hashtags.map((h) => h.hashtag));

    const missingHashtags = [...competitorBestHashtags].filter((h) => !ourHashtags.has(h));
    if (missingHashtags.length > 0) {
      opportunities.push(`Try competitor's top hashtags: ${missingHashtags.slice(0, 5).join(', ')}`);
    }

    const competitorBestTypes = competitorAnalytics.best_content_types.slice(0, 2);
    const ourBestTypes = new Set(ourAnalytics.best_content_types.slice(0, 2).map((t) => t.type));

    for (const contentType of competitorBestTypes) {
      if (!ourBestTypes.has(contentType.type)) {
        opportunities.push(`Competitor succeeds with ${contentType.type} content - consider trying more`);
      }
    }

    return {
      our_account: ourHandle,
      competitor_handle: competitorHandle,
      platform,
      our_metrics: {
        followers: 0, // Would need to fetch
        engagement_rate: ourAnalytics.avg_engagement_rate,
        avg_likes: ourAnalytics.avg_likes,
        posting_frequency: ourAnalytics.total_posts_analyzed / 30, // Posts per day estimate
      },
      competitor_metrics: {
        followers: 0,
        engagement_rate: competitorAnalytics.avg_engagement_rate,
        avg_likes: competitorAnalytics.avg_likes,
        posting_frequency: competitorAnalytics.total_posts_analyzed / 30,
      },
      gaps,
      opportunities,
      content_to_emulate: competitorAnalytics.best_performing_posts,
    };
  } catch (error) {
    console.error('Error comparing with competitor:', error);
    return null;
  }
}

// ============================================
// AI-Powered Video Content Ideas
// ============================================

/**
 * Generate video content ideas based on analytics and competitor analysis
 */
export async function generateVideoContentIdeas(
  platform: SocialPlatform = 'instagram',
  count: number = 10
): Promise<VideoContentIdea[]> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.warn('ANTHROPIC_API_KEY not configured');
    return getDefaultContentIdeas(platform);
  }

  try {
    // Gather context data
    const [kcuAnalytics, competitorData] = await Promise.all([
      analyzeEngagement(platform, KAYCAPITALS_ACCOUNTS[platform] || 'kaycapitals', 20),
      analyzeTopCompetitors(platform),
    ]);

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const prompt = `You are a social media content strategist for KayCapitals, a day trading education community focused on the LTP (Level, Trend, Patience) framework.

CONTEXT:
- Platform: ${platform}
- KayCapitals' current engagement rate: ${kcuAnalytics?.avg_engagement_rate || 'Unknown'}%
- Best performing content types: ${kcuAnalytics?.best_content_types.slice(0, 3).map(t => t.type).join(', ') || 'Reels/Short videos'}
- Top competitor insights: ${JSON.stringify(competitorData?.slice(0, 2) || [])}

BRAND VOICE:
- Educational but not condescending
- Confident but humble
- Focus on discipline and process over quick wins
- Use the LTP framework as a core teaching tool
- Celebrate community wins

Generate ${count} video content ideas that would perform well on ${platform}. Focus on:
1. Options trading strategies and setups
2. Trading psychology and discipline
3. Market commentary and analysis
4. Community wins and celebrations
5. Educational content about the LTP framework

For each idea, provide:
- hook: An attention-grabbing first line (3-8 words)
- concept: A brief description of the video content
- format: reel, video, short, or story
- estimated_engagement: high, medium, or low
- hashtags: 5-8 relevant hashtags
- script_outline: 3-5 bullet points for the video structure
- why_it_works: Why this content will resonate

Return as a JSON array.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') return getDefaultContentIdeas(platform);

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return getDefaultContentIdeas(platform);

    const ideas = JSON.parse(jsonMatch[0]);

    return ideas.map((idea: any) => ({
      hook: idea.hook,
      concept: idea.concept,
      format: idea.format || 'reel',
      platform,
      estimated_engagement: idea.estimated_engagement || 'medium',
      hashtags: idea.hashtags || [],
      script_outline: idea.script_outline || [],
      why_it_works: idea.why_it_works || '',
    }));
  } catch (error) {
    console.error('Error generating content ideas:', error);
    return getDefaultContentIdeas(platform);
  }
}

async function analyzeTopCompetitors(platform: SocialPlatform): Promise<any[]> {
  const competitors = FEATURED_INFLUENCERS.filter((i) => i.platform === platform).slice(0, 3);

  const analyses = await Promise.all(
    competitors.map(async (competitor) => {
      const analytics = await analyzeEngagement(platform, competitor.handle, 20);
      if (!analytics) return null;

      return {
        handle: competitor.handle,
        name: competitor.name,
        engagement_rate: analytics.avg_engagement_rate,
        best_content_types: analytics.best_content_types.slice(0, 2),
        top_hashtags: analytics.best_hashtags.slice(0, 5).map((h) => h.hashtag),
        top_posts: analytics.best_performing_posts.slice(0, 2).map((p) => ({
          caption: p.caption?.slice(0, 100),
          likes: p.likes_count,
          type: p.content_type,
        })),
      };
    })
  );

  return analyses.filter(Boolean);
}

function getDefaultContentIdeas(platform: SocialPlatform): VideoContentIdea[] {
  const ideas: VideoContentIdea[] = [
    {
      hook: 'Stop making this mistake',
      concept: 'Common trading mistake that costs beginners money - entering without a stop loss',
      format: 'reel',
      platform,
      estimated_engagement: 'high',
      hashtags: ['#daytrading', '#tradingmistakes', '#stockmarket', '#tradertips', '#tradingpsychology'],
      script_outline: [
        'Hook: The one mistake that blows up accounts',
        'Problem: Trading without a stop loss',
        'Why it happens: Fear of missing out',
        'Solution: Always set your stop before entering',
        'CTA: Save this for your next trade',
      ],
      why_it_works: 'Addresses a common pain point with a clear solution',
    },
    {
      hook: 'LTP setup made simple',
      concept: 'Quick explanation of the Level, Trend, Patience framework with a real example',
      format: 'reel',
      platform,
      estimated_engagement: 'high',
      hashtags: ['#LTPframework', '#daytrading', '#tradingstrategy', '#stockmarket', '#tradingtips'],
      script_outline: [
        'Hook: This simple framework changed everything',
        'Level: Identify key support/resistance',
        'Trend: Confirm the direction',
        'Patience: Wait for the perfect entry',
        'Real example: Show a recent winning trade',
      ],
      why_it_works: 'Educational content that showcases the core methodology',
    },
    {
      hook: 'Pre-market routine in 60 seconds',
      concept: 'Speed through the morning routine that prepares for the trading day',
      format: 'reel',
      platform,
      estimated_engagement: 'medium',
      hashtags: ['#premarket', '#morningroutine', '#daytrader', '#tradinglife', '#stockmarket'],
      script_outline: [
        'Hook: What I do every morning before 9:30',
        'Check overnight futures and news',
        'Review the watchlist',
        'Mark key levels',
        'Mental preparation',
      ],
      why_it_works: 'Behind-the-scenes content humanizes the brand',
    },
    {
      hook: 'Red day? Here\'s what I do',
      concept: 'How to handle a losing day without spiraling into revenge trading',
      format: 'reel',
      platform,
      estimated_engagement: 'high',
      hashtags: ['#tradingpsychology', '#losingday', '#daytrading', '#tradermindset', '#discipline'],
      script_outline: [
        'Acknowledge it happens to everyone',
        'Step 1: Step away from the screen',
        'Step 2: Journal what went wrong',
        'Step 3: Review but don\'t dwell',
        'Tomorrow is a new day',
      ],
      why_it_works: 'Emotional content that builds trust and relatability',
    },
    {
      hook: 'Options flow just lit up',
      concept: 'Quick breakdown of unusual options activity and what it might mean',
      format: 'reel',
      platform,
      estimated_engagement: 'medium',
      hashtags: ['#optionsflow', '#unusualoptions', '#optionstrading', '#stockalerts', '#daytrading'],
      script_outline: [
        'Hook: Massive call buying on $TICKER',
        'What the flow shows',
        'What smart money might be thinking',
        'How I would play it',
        'Reminder: Not financial advice',
      ],
      why_it_works: 'Timely, educational content about real market activity',
    },
  ];

  return ideas;
}

// ============================================
// Content Insights Dashboard Data
// ============================================

/**
 * Get comprehensive content insights for the dashboard
 */
export async function getContentInsights(): Promise<ContentInsight[]> {
  const insights: ContentInsight[] = [];

  try {
    // Analyze KayCapitals
    const kcuData = await analyzeKayCapitalsContent();

    if (kcuData.instagram) {
      insights.push({
        id: crypto.randomUUID(),
        type: 'performance',
        title: 'Instagram Performance Overview',
        description: `Analyzed ${kcuData.instagram.total_posts_analyzed} posts with ${kcuData.instagram.avg_engagement_rate}% average engagement`,
        metrics: {
          avg_likes: kcuData.instagram.avg_likes,
          avg_comments: kcuData.instagram.avg_comments,
          engagement_rate: kcuData.instagram.avg_engagement_rate,
        },
        recommendations: [
          `Best posting times: ${kcuData.instagram.best_posting_times.slice(0, 3).join(', ')}`,
          `Top content type: ${kcuData.instagram.best_content_types[0]?.type || 'Reels'}`,
          `Engagement trend: ${kcuData.instagram.engagement_trend}`,
        ],
        source: 'analytics',
        confidence: 0.85,
        created_at: new Date().toISOString(),
      });
    }

    // Add video content ideas
    const videoIdeas = await generateVideoContentIdeas('instagram', 5);
    insights.push({
      id: crypto.randomUUID(),
      type: 'content_idea',
      title: 'AI-Generated Video Ideas',
      description: 'Content ideas based on competitor analysis and trending topics',
      content_ideas: videoIdeas,
      source: 'ai_analysis',
      confidence: 0.75,
      created_at: new Date().toISOString(),
    });

    return insights;
  } catch (error) {
    console.error('Error getting content insights:', error);
    return insights;
  }
}

/**
 * Analyze a specific influencer (like TJR) for content inspiration
 */
export async function analyzeInfluencerForInspiration(
  platform: SocialPlatform,
  handle: string
): Promise<{
  analytics: EngagementAnalytics | null;
  content_ideas: VideoContentIdea[];
  top_performing_content: any[];
}> {
  const analytics = await analyzeEngagement(platform, handle, 30);

  const topContent = analytics?.best_performing_posts.slice(0, 5).map((post) => ({
    caption: post.caption?.slice(0, 200),
    likes: post.likes_count,
    comments: post.comments_count,
    type: post.content_type,
    hashtags: post.hashtags?.slice(0, 5),
    hook: post.hook_text || post.caption?.split('\n')[0]?.slice(0, 50),
  })) || [];

  // Generate ideas inspired by this influencer
  const contentIdeas = await generateVideoContentIdeas(platform, 5);

  return {
    analytics,
    content_ideas: contentIdeas,
    top_performing_content: topContent,
  };
}
