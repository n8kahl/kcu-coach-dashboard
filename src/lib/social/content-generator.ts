// ============================================
// KCU Social Builder - AI Content Generator
// Generates social media content in KCU's voice
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  ContentSuggestion,
  ContentSuggestionInput,
  TrendingTopic,
  InfluencerPost,
  SocialPlatform,
  ContentCategory,
  ContentGenerationContext,
  KCUDataContext,
  PlatformVariants,
  OptimalPostTime,
  GeneratedContent,
} from '@/types/social';
import { getKCUToneProfile } from './tone-analyzer';

// Initialize clients
const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Content Generation Prompts
// ============================================

const CONTENT_GENERATOR_SYSTEM_PROMPT = `You are a social media content strategist for KCU Trading, a day trading education platform focused on the LTP Framework (Level, Trend, Patience).

KCU BRAND VOICE:
{tone_profile}

PLATFORM-SPECIFIC GUIDELINES:

Instagram:
- Optimal caption length: 150-300 characters for feed, can be longer for carousels
- Use 5-15 relevant hashtags
- Lead with a strong hook
- Use line breaks for readability
- Emojis: moderate use, purposeful

TikTok:
- Very short, punchy captions (< 150 characters)
- 3-5 hashtags max
- Hook must grab attention in first 3 seconds
- Trendy, conversational tone
- More casual than Instagram

YouTube:
- Title is most important (< 60 characters)
- Description can be longer (first 2 lines show in search)
- Include relevant keywords naturally
- More professional/educational tone

CONTENT CATEGORIES:
1. Educational (40%): LTP concepts, trading tips, analysis techniques
2. Community (30%): Member wins, streaks, achievements, testimonials
3. Market Commentary (20%): Pre-market, economic events, earnings
4. Promotional (10%): New features, courses, CTAs

MANDATORY COMPLIANCE:
- Never promise guaranteed profits
- Always frame as educational, not financial advice
- Include disclaimers when discussing specific trades
- Avoid words like: "guaranteed", "easy money", "get rich quick", "never lose"

Your job is to generate engaging content suggestions that match KCU's voice while maximizing engagement.`;

const CONTENT_GENERATION_PROMPT = `Generate {count} social media content suggestions based on the following context.

TARGET PLATFORMS: {platforms}
TARGET CATEGORY: {category}

TRENDING TOPICS:
{trending_topics}

HIGH-PERFORMING INFLUENCER CONTENT (for inspiration, not copying):
{influencer_posts}

KCU PLATFORM DATA:
{kcu_data}

Generate unique content that:
1. Matches KCU's voice and values
2. Addresses current market trends when relevant
3. Showcases community success (with permission assumed)
4. Provides genuine educational value
5. Includes platform-specific optimizations

For each suggestion, provide:
1. suggested_caption: The main caption text
2. suggested_hashtags: Array of relevant hashtags (no # symbol)
3. suggested_hook: The opening attention-grabber
4. suggested_cta: Call to action
5. topic: Main topic of the post
6. category: One of "educational", "community", "market_commentary", "promotional", "motivation"
7. platform_variants: Platform-specific versions if needed
8. predicted_engagement_score: 0-100 estimate
9. reasoning: Why this content will perform well
10. suggested_media_type: "image", "video", "carousel", or "text"
11. media_suggestions: Ideas for visual content

Return a JSON array of suggestion objects. Return ONLY valid JSON, no markdown.`;

// ============================================
// Main Content Generation
// ============================================

export async function generateContentSuggestions(
  context: ContentGenerationContext
): Promise<GeneratedContent> {
  try {
    // Get KCU tone profile
    const toneProfile = await getKCUToneProfile();
    if (!toneProfile) {
      throw new Error('KCU tone profile not configured');
    }

    // Format tone profile for prompt
    const toneProfileString = formatToneProfile(toneProfile);

    // Format context data
    const trendingTopicsString = formatTrendingTopics(context.trending_topics || []);
    const influencerPostsString = formatInfluencerPosts(context.influencer_posts || []);
    const kcuDataString = formatKCUData(context.kcu_data);

    // Build the prompt
    const systemPrompt = CONTENT_GENERATOR_SYSTEM_PROMPT.replace(
      '{tone_profile}',
      toneProfileString
    );

    const userPrompt = CONTENT_GENERATION_PROMPT
      .replace('{count}', (context.count || 5).toString())
      .replace('{platforms}', context.target_platforms.join(', '))
      .replace('{category}', context.target_category || 'any')
      .replace('{trending_topics}', trendingTopicsString)
      .replace('{influencer_posts}', influencerPostsString)
      .replace('{kcu_data}', kcuDataString);

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse suggestions
    const suggestions = JSON.parse(content.text);

    // Process and enhance suggestions
    const processedSuggestions = await Promise.all(
      suggestions.map(async (s: any) => ({
        platforms: context.target_platforms,
        content_type: mapMediaTypeToContentType(s.suggested_media_type, context.target_platforms[0]),
        suggested_caption: s.suggested_caption,
        suggested_hashtags: s.suggested_hashtags || [],
        suggested_hook: s.suggested_hook,
        suggested_cta: s.suggested_cta,
        platform_variants: s.platform_variants || {},
        topic: s.topic,
        category: s.category,
        inspiration_source: determineInspirationSource(context),
        inspiration_data: {
          trending_topics: context.trending_topics?.map((t) => t.topic),
          influencer_handles: context.influencer_posts?.map((p) => p.influencer_id),
        },
        predicted_engagement_score: s.predicted_engagement_score,
        kcu_tone_match_score: await calculateToneMatchScore(s.suggested_caption, toneProfile),
        reasoning: s.reasoning,
        suggested_media_type: s.suggested_media_type,
        media_suggestions: s.media_suggestions || {},
        optimal_post_times: await getOptimalPostTimes(context.target_platforms),
        status: 'pending',
      }))
    );

    return {
      suggestions: processedSuggestions,
      reasoning: `Generated ${processedSuggestions.length} suggestions based on ${context.trending_topics?.length || 0} trending topics and ${context.influencer_posts?.length || 0} influencer posts`,
      inspiration_sources: [
        ...(context.trending_topics?.map((t) => `Trending: ${t.topic}`) || []),
        ...(context.kcu_data?.recent_wins?.length ? ['KCU member wins'] : []),
        ...(context.kcu_data?.top_streaks?.length ? ['KCU streaks'] : []),
      ],
    };
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
}

// ============================================
// Caption Adaptation
// ============================================

const ADAPT_TONE_PROMPT = `Rewrite the following social media caption to match KCU Trading's brand voice.

ORIGINAL CAPTION:
{original}

KCU BRAND VOICE:
{tone_profile}

TARGET PLATFORM: {platform}

Rewrite the caption to:
1. Match KCU's confident but humble tone
2. Emphasize education over promotion
3. Reference the LTP Framework if relevant
4. Use appropriate emoji density
5. Maintain the core message

Return ONLY the rewritten caption, no explanation.`;

export async function adaptToKCUTone(
  content: string,
  platform: SocialPlatform
): Promise<string> {
  try {
    const toneProfile = await getKCUToneProfile();
    if (!toneProfile) {
      return content;
    }

    const prompt = ADAPT_TONE_PROMPT
      .replace('{original}', content)
      .replace('{tone_profile}', formatToneProfile(toneProfile))
      .replace('{platform}', platform);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== 'text') {
      return content;
    }

    return responseContent.text.trim();
  } catch (error) {
    console.error('Error adapting tone:', error);
    return content;
  }
}

// ============================================
// Platform-Specific Variants
// ============================================

const VARIANT_PROMPT = `Create platform-specific versions of this social media content.

ORIGINAL CONTENT:
Caption: {caption}
Hashtags: {hashtags}

Create optimized versions for: {platforms}

For each platform, provide:
- caption: Optimized caption for that platform
- hashtags: Platform-appropriate hashtags
- cta: Platform-specific call to action

Platform guidelines:
- Instagram: Moderate length, 5-15 hashtags, professional but engaging
- TikTok: Short and punchy, 3-5 hashtags, trendy language
- YouTube: Title-focused, SEO-friendly description, fewer hashtags

Return a JSON object with platform names as keys.`;

export async function generatePlatformVariants(
  caption: string,
  hashtags: string[],
  platforms: SocialPlatform[]
): Promise<PlatformVariants> {
  try {
    const prompt = VARIANT_PROMPT
      .replace('{caption}', caption)
      .replace('{hashtags}', hashtags.join(', '))
      .replace('{platforms}', platforms.join(', '));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return {};
    }

    return JSON.parse(content.text);
  } catch (error) {
    console.error('Error generating variants:', error);
    return {};
  }
}

// ============================================
// Hashtag Suggestions
// ============================================

const HASHTAG_PROMPT = `Suggest optimal hashtags for this social media post.

CONTENT: {content}
PLATFORM: {platform}
TOPIC: {topic}

Consider:
1. Mix of popular and niche hashtags
2. Platform-specific best practices
3. Day trading and finance relevance
4. Avoid banned or spammy hashtags

Return a JSON object with:
- primary: Array of 3-5 core hashtags (always use)
- secondary: Array of 5-10 supporting hashtags
- trending: Array of currently trending relevant hashtags
- avoid: Array of hashtags to avoid and why

Return ONLY valid JSON.`;

export async function suggestHashtags(
  content: string,
  platform: SocialPlatform,
  topic?: string
): Promise<{
  primary: string[];
  secondary: string[];
  trending: string[];
  avoid: Array<{ tag: string; reason: string }>;
}> {
  try {
    const prompt = HASHTAG_PROMPT
      .replace('{content}', content)
      .replace('{platform}', platform)
      .replace('{topic}', topic || 'day trading');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== 'text') {
      return { primary: [], secondary: [], trending: [], avoid: [] };
    }

    return JSON.parse(responseContent.text);
  } catch (error) {
    console.error('Error suggesting hashtags:', error);
    return {
      primary: ['daytrading', 'trading', 'stockmarket'],
      secondary: ['tradinglife', 'trader', 'stocks'],
      trending: [],
      avoid: [],
    };
  }
}

// ============================================
// KCU Data Aggregation
// ============================================

export async function aggregateKCUData(): Promise<KCUDataContext> {
  const context: KCUDataContext = {};

  try {
    // Get recent wins (trades with significant profit)
    const { data: wins } = await supabase
      .from('trade_journal')
      .select('symbol, pnl, pnl_percent, setup_type, user_id')
      .eq('status', 'closed')
      .gt('pnl', 100)
      .order('created_at', { ascending: false })
      .limit(10);

    if (wins) {
      context.recent_wins = wins.map((w) => ({
        username: 'KCU Trader', // Anonymized
        pnl: w.pnl,
        symbol: w.symbol,
        setup_type: w.setup_type,
      }));
    }

    // Get top streaks
    const { data: streaks } = await supabase
      .from('user_profiles')
      .select('username, streak_days')
      .gt('streak_days', 3)
      .order('streak_days', { ascending: false })
      .limit(5);

    if (streaks) {
      context.top_streaks = streaks.map((s) => ({
        username: s.username,
        streak_days: s.streak_days,
      }));
    }

    // Get community stats
    const { count: totalMembers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: activeMembers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { data: tradeStats } = await supabase
      .from('trade_journal')
      .select('pnl')
      .eq('status', 'closed');

    if (tradeStats) {
      const totalTrades = tradeStats.length;
      const winningTrades = tradeStats.filter((t) => t.pnl > 0).length;

      context.community_stats = {
        total_members: totalMembers || 0,
        active_members: activeMembers || 0,
        total_trades: totalTrades,
        average_win_rate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      };
    }

    // Get popular lessons
    const { data: lessons } = await supabase
      .from('lesson_progress')
      .select('lesson_id, lessons(title)')
      .eq('completed', true)
      .limit(100);

    if (lessons) {
      const lessonCounts = lessons.reduce(
        (acc, l) => {
          const title = (l.lessons as any)?.title || 'Unknown';
          acc[title] = (acc[title] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      context.popular_lessons = Object.entries(lessonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([title, completions]) => ({ title, completions }));
    }

    // Get recent setups
    const { data: setups } = await supabase
      .from('detected_setups')
      .select('symbol, direction, confluence_score, status')
      .in('status', ['triggered', 'expired'])
      .order('detected_at', { ascending: false })
      .limit(10);

    if (setups) {
      context.recent_setups = setups.map((s) => ({
        symbol: s.symbol,
        direction: s.direction,
        outcome: s.status === 'triggered' ? 'win' : 'loss',
        ltp_score: s.confluence_score,
      }));
    }

    return context;
  } catch (error) {
    console.error('Error aggregating KCU data:', error);
    return {};
  }
}

// ============================================
// Save Suggestions to Database
// ============================================

export async function saveSuggestions(
  suggestions: ContentSuggestion[]
): Promise<string[]> {
  const savedIds: string[] = [];

  for (const suggestion of suggestions) {
    const { data, error } = await supabase
      .from('content_suggestions')
      .insert({
        platforms: suggestion.platforms,
        content_type: suggestion.content_type,
        suggested_caption: suggestion.suggested_caption,
        suggested_hashtags: suggestion.suggested_hashtags,
        suggested_hook: suggestion.suggested_hook,
        suggested_cta: suggestion.suggested_cta,
        platform_variants: suggestion.platform_variants,
        topic: suggestion.topic,
        category: suggestion.category,
        inspiration_source: suggestion.inspiration_source,
        inspiration_data: suggestion.inspiration_data,
        predicted_engagement_score: suggestion.predicted_engagement_score,
        kcu_tone_match_score: suggestion.kcu_tone_match_score,
        reasoning: suggestion.reasoning,
        suggested_media_type: suggestion.suggested_media_type,
        media_suggestions: suggestion.media_suggestions,
        optimal_post_times: suggestion.optimal_post_times,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select('id')
      .single();

    if (data) {
      savedIds.push(data.id);
    } else if (error) {
      console.error('Error saving suggestion:', error);
    }
  }

  return savedIds;
}

// ============================================
// Helper Functions
// ============================================

function formatToneProfile(profile: any): string {
  return `
Voice Attributes: ${JSON.stringify(profile.voice_attributes)}
Preferred Phrases: ${profile.preferred_phrases?.join(', ')}
Avoid Phrases: ${profile.avoided_phrases?.join(', ')}
Emoji Style: ${profile.emoji_style}
Preferred Emojis: ${profile.preferred_emojis?.join(' ')}
CTA Patterns: ${profile.cta_patterns?.join('; ')}
Hook Patterns: ${profile.hook_patterns?.join('; ')}
Always Use Hashtags: ${profile.always_use_hashtags?.join(', ')}
Never Use Hashtags: ${profile.never_use_hashtags?.join(', ')}
Sample Posts: ${JSON.stringify(profile.sample_posts?.slice(0, 3))}
  `.trim();
}

function formatTrendingTopics(topics: TrendingTopic[]): string {
  if (topics.length === 0) return 'No trending topics available.';

  return topics
    .slice(0, 10)
    .map(
      (t) =>
        `- ${t.topic} (${t.category}, score: ${t.trend_score}, sentiment: ${t.sentiment || 'neutral'})`
    )
    .join('\n');
}

function formatInfluencerPosts(posts: InfluencerPost[]): string {
  if (posts.length === 0) return 'No influencer posts for reference.';

  return posts
    .slice(0, 10)
    .map(
      (p) =>
        `- "${p.caption?.substring(0, 200)}..." (${p.content_type}, engagement: ${p.engagement_rate}%)`
    )
    .join('\n');
}

function formatKCUData(data?: KCUDataContext): string {
  if (!data) return 'No KCU platform data available.';

  const parts = [];

  if (data.recent_wins?.length) {
    parts.push(
      `Recent Wins: ${data.recent_wins.map((w) => `${w.symbol} +$${w.pnl}`).join(', ')}`
    );
  }

  if (data.top_streaks?.length) {
    parts.push(
      `Top Streaks: ${data.top_streaks.map((s) => `${s.username} (${s.streak_days} days)`).join(', ')}`
    );
  }

  if (data.community_stats) {
    parts.push(
      `Community: ${data.community_stats.total_members} members, ${data.community_stats.active_members} active, ${data.community_stats.average_win_rate.toFixed(1)}% avg win rate`
    );
  }

  if (data.popular_lessons?.length) {
    parts.push(
      `Popular Lessons: ${data.popular_lessons.map((l) => l.title).join(', ')}`
    );
  }

  return parts.join('\n') || 'No KCU platform data available.';
}

function mapMediaTypeToContentType(
  mediaType: string,
  platform: SocialPlatform
): string {
  if (platform === 'instagram') {
    if (mediaType === 'video') return 'reel';
    if (mediaType === 'carousel') return 'carousel';
    return 'feed_post';
  }
  if (platform === 'tiktok') return 'video';
  if (platform === 'youtube') {
    if (mediaType === 'video') return 'video';
    return 'short';
  }
  return 'feed_post';
}

function determineInspirationSource(
  context: ContentGenerationContext
): string {
  if (context.kcu_data?.recent_wins?.length) return 'kcu_win';
  if (context.kcu_data?.top_streaks?.length) return 'kcu_streak';
  if (context.trending_topics?.length) return 'trending_topic';
  if (context.influencer_posts?.length) return 'influencer';
  return 'manual';
}

async function calculateToneMatchScore(
  caption: string,
  toneProfile: any
): Promise<number> {
  // Simple heuristic scoring
  let score = 70; // Base score

  // Check for preferred phrases
  const preferredPhrases = toneProfile.preferred_phrases || [];
  for (const phrase of preferredPhrases) {
    if (caption.toLowerCase().includes(phrase.toLowerCase())) {
      score += 5;
    }
  }

  // Check for avoided phrases (penalty)
  const avoidedPhrases = toneProfile.avoided_phrases || [];
  for (const phrase of avoidedPhrases) {
    if (caption.toLowerCase().includes(phrase.toLowerCase())) {
      score -= 15;
    }
  }

  // Check emoji usage - using a simpler regex pattern for compatibility
  const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]+/g;
  const emojiCount = (caption.match(emojiRegex) || []).length;
  const emojiStyle = toneProfile.emoji_style;
  if (emojiStyle === 'moderate' && emojiCount >= 2 && emojiCount <= 5) score += 5;
  if (emojiStyle === 'minimal' && emojiCount <= 2) score += 5;
  if (emojiStyle === 'heavy' && emojiCount >= 5) score += 5;

  return Math.min(100, Math.max(0, score));
}

async function getOptimalPostTimes(
  platforms: SocialPlatform[]
): Promise<OptimalPostTime[]> {
  const times: OptimalPostTime[] = [];

  const { data: config } = await supabase
    .from('social_builder_config')
    .select('config_value')
    .eq('config_key', 'posting_schedule')
    .single();

  if (!config) return times;

  const schedule = config.config_value as any;

  for (const platform of platforms) {
    const platformSchedule = schedule[platform];
    if (platformSchedule?.optimal_times) {
      const timezone = platformSchedule.timezone || 'America/New_York';
      for (const time of platformSchedule.optimal_times) {
        const now = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        now.setHours(hours, minutes, 0, 0);
        if (now < new Date()) {
          now.setDate(now.getDate() + 1);
        }
        times.push({
          platform,
          datetime: now.toISOString(),
          score: 85 + Math.random() * 10, // Add some variance
        });
      }
    }
  }

  return times.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

// ============================================
// Quick Content Generation Helpers
// ============================================

export async function generateWinPost(
  win: { username: string; pnl: number; symbol: string; setup_type?: string }
): Promise<ContentSuggestion> {
  const context: ContentGenerationContext = {
    target_platforms: ['instagram', 'tiktok'],
    target_category: 'community',
    count: 1,
    kcu_data: {
      recent_wins: [win],
    },
  };

  const result = await generateContentSuggestions(context);
  return result.suggestions[0];
}

export async function generateMarketCommentary(
  topic: TrendingTopic
): Promise<ContentSuggestion> {
  const context: ContentGenerationContext = {
    target_platforms: ['instagram', 'youtube'],
    target_category: 'market_commentary',
    count: 1,
    trending_topics: [topic],
  };

  const result = await generateContentSuggestions(context);
  return result.suggestions[0];
}

export async function generateEducationalPost(
  topic: string
): Promise<ContentSuggestion> {
  const context: ContentGenerationContext = {
    target_platforms: ['instagram', 'tiktok', 'youtube'],
    target_category: 'educational',
    count: 1,
    trending_topics: [
      {
        id: 'manual',
        topic,
        category: 'technical',
        source: 'manual',
        source_data: {},
        trend_score: 80,
        mention_count: 0,
        velocity: 'stable',
        content_angles: [],
        suggested_hooks: [],
        relevant_hashtags: [],
        is_active: true,
        processed_for_suggestions: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_trending_at: new Date().toISOString(),
      },
    ],
  };

  const result = await generateContentSuggestions(context);
  return result.suggestions[0];
}
