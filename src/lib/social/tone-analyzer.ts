// ============================================
// KCU Social Builder - Tone Analyzer
// Uses Claude AI to analyze influencer content
// and compare to KCU's brand voice
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  InfluencerPost,
  ToneAnalysis,
  KCUToneProfile,
  ToneComparisonResult,
} from '@/types/social';

// Initialize clients
const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Tone Analysis Types
// ============================================

interface PostToneAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics: string[];
  tone_markers: {
    educational_score: number;
    motivational_score: number;
    promotional_score: number;
    authentic_score: number;
    urgency_score: number;
  };
  hook_text: string;
  call_to_action: string;
  emoji_density: number;
  hashtag_strategy: string;
  key_phrases: string[];
}

interface ProfileToneAnalysis {
  overall_style: string;
  voice_attributes: Record<string, number>;
  content_themes: string[];
  posting_patterns: {
    avg_caption_length: number;
    avg_hashtags: number;
    emoji_usage: 'none' | 'minimal' | 'moderate' | 'heavy';
    cta_frequency: number;
  };
  top_performing_hooks: string[];
  engagement_drivers: string[];
  keyword_frequency: Record<string, number>;
  recommendations: string[];
}

interface EngagementPattern {
  content_type: string;
  avg_engagement_rate: number;
  best_posting_times: string[];
  top_hashtags: string[];
  successful_hooks: string[];
  topic_performance: Record<string, number>;
}

// ============================================
// Single Post Tone Analysis
// ============================================

const POST_ANALYSIS_PROMPT = `You are an expert social media content analyst specializing in day trading and financial education content.

Analyze the following social media post and extract tone, style, and engagement factors.

POST CONTENT:
Platform: {platform}
Caption: {caption}
Hashtags: {hashtags}
Likes: {likes}
Comments: {comments}
Engagement Rate: {engagement_rate}%

Analyze and return a JSON object with:
1. sentiment: "positive", "neutral", "negative", or "mixed"
2. topics: Array of main topics discussed (e.g., "trading psychology", "technical analysis", "market news")
3. tone_markers: Object with scores 0-100 for:
   - educational_score: How educational/informative is it?
   - motivational_score: How motivational/inspiring?
   - promotional_score: How sales-y or promotional?
   - authentic_score: How genuine and authentic?
   - urgency_score: How much urgency/FOMO is used?
4. hook_text: The opening hook or attention grabber (first line or two)
5. call_to_action: The CTA used, if any
6. emoji_density: Number of emojis per 100 characters
7. hashtag_strategy: Brief description of hashtag approach
8. key_phrases: Array of notable phrases or expressions used

Return ONLY valid JSON, no markdown or explanation.`;

export async function analyzePostTone(
  post: InfluencerPost,
  platform: string
): Promise<PostToneAnalysis> {
  try {
    const prompt = POST_ANALYSIS_PROMPT
      .replace('{platform}', platform)
      .replace('{caption}', post.caption || '')
      .replace('{hashtags}', post.hashtags.join(', '))
      .replace('{likes}', post.likes_count.toString())
      .replace('{comments}', post.comments_count.toString())
      .replace('{engagement_rate}', post.engagement_rate.toFixed(2));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    const analysis = JSON.parse(content.text);
    return analysis as PostToneAnalysis;
  } catch (error) {
    console.error('Error analyzing post tone:', error);
    // Return default analysis on error
    return {
      sentiment: 'neutral',
      topics: [],
      tone_markers: {
        educational_score: 50,
        motivational_score: 50,
        promotional_score: 50,
        authentic_score: 50,
        urgency_score: 50,
      },
      hook_text: '',
      call_to_action: '',
      emoji_density: 0,
      hashtag_strategy: 'unknown',
      key_phrases: [],
    };
  }
}

// ============================================
// Profile-Wide Tone Analysis
// ============================================

const PROFILE_ANALYSIS_PROMPT = `You are an expert social media strategist analyzing a day trading influencer's content strategy.

Analyze the following collection of posts from a single creator and identify their overall tone, style, and content patterns.

POSTS DATA:
{posts_json}

ENGAGEMENT SUMMARY:
- Total Posts: {total_posts}
- Average Engagement Rate: {avg_engagement}%
- Highest Engagement: {max_engagement}%
- Most Common Topics: {top_topics}

Analyze and return a JSON object with:
1. overall_style: Brief description of their content style (e.g., "Educational with motivational undertones")
2. voice_attributes: Object with scores 0.0-1.0 for:
   - confident, humble, educational, motivational, professional, casual, authoritative, supportive, disciplined, patient
3. content_themes: Array of their main content themes
4. posting_patterns: Object with:
   - avg_caption_length: Average characters per caption
   - avg_hashtags: Average hashtags per post
   - emoji_usage: "none", "minimal", "moderate", or "heavy"
   - cta_frequency: Percentage of posts with CTAs (0-100)
5. top_performing_hooks: Array of their most engaging opening lines
6. engagement_drivers: What makes their content perform well
7. keyword_frequency: Top 10 keywords they use frequently
8. recommendations: What can be learned from their approach

Return ONLY valid JSON, no markdown or explanation.`;

export async function analyzeProfileTone(
  posts: InfluencerPost[],
  influencerHandle: string
): Promise<ProfileToneAnalysis> {
  try {
    // Prepare posts data (limit to avoid token limits)
    const postsForAnalysis = posts.slice(0, 30).map((p) => ({
      caption: p.caption?.substring(0, 500),
      hashtags: p.hashtags,
      likes: p.likes_count,
      comments: p.comments_count,
      engagement_rate: p.engagement_rate,
      content_type: p.content_type,
    }));

    // Calculate stats
    const avgEngagement =
      posts.reduce((sum, p) => sum + p.engagement_rate, 0) / posts.length;
    const maxEngagement = Math.max(...posts.map((p) => p.engagement_rate));

    // Get top topics
    const allTopics = posts.flatMap((p) => p.topics || []);
    const topicCounts = allTopics.reduce(
      (acc, topic) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    const prompt = PROFILE_ANALYSIS_PROMPT
      .replace('{posts_json}', JSON.stringify(postsForAnalysis, null, 2))
      .replace('{total_posts}', posts.length.toString())
      .replace('{avg_engagement}', avgEngagement.toFixed(2))
      .replace('{max_engagement}', maxEngagement.toFixed(2))
      .replace('{top_topics}', topTopics.join(', ') || 'Various');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const analysis = JSON.parse(content.text);
    return analysis as ProfileToneAnalysis;
  } catch (error) {
    console.error('Error analyzing profile tone:', error);
    return getDefaultProfileAnalysis();
  }
}

// ============================================
// KCU Tone Comparison
// ============================================

const COMPARISON_PROMPT = `You are comparing an influencer's content style against KCU Trading's brand voice.

KCU BRAND VOICE PROFILE:
{kcu_profile}

INFLUENCER STYLE:
{influencer_profile}

Compare these two content styles and provide:
1. similarity_score: 0-100 score of how similar the styles are
2. matching_attributes: Array of voice attributes that align well
3. divergent_attributes: Array of attributes that differ significantly
4. recommendations: Array of specific things to learn or avoid from this influencer's style

Focus on what KCU can learn to improve engagement while staying authentic to their brand.

Return ONLY valid JSON, no markdown or explanation.`;

export async function compareToKCUTone(
  influencerAnalysis: ProfileToneAnalysis
): Promise<ToneComparisonResult> {
  try {
    // Get KCU tone profile from database
    const { data: kcuProfile } = await supabase
      .from('kcu_tone_profile')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!kcuProfile) {
      throw new Error('KCU tone profile not found');
    }

    const prompt = COMPARISON_PROMPT
      .replace('{kcu_profile}', JSON.stringify(kcuProfile, null, 2))
      .replace('{influencer_profile}', JSON.stringify(influencerAnalysis, null, 2));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const comparison = JSON.parse(content.text);
    return comparison as ToneComparisonResult;
  } catch (error) {
    console.error('Error comparing tone to KCU:', error);
    return {
      similarity_score: 50,
      matching_attributes: [],
      divergent_attributes: [],
      recommendations: ['Unable to complete comparison'],
    };
  }
}

// ============================================
// Engagement Pattern Analysis
// ============================================

export async function extractEngagementPatterns(
  posts: InfluencerPost[]
): Promise<EngagementPattern[]> {
  // Group posts by content type
  const byContentType = posts.reduce(
    (acc, post) => {
      const type = post.content_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(post);
      return acc;
    },
    {} as Record<string, InfluencerPost[]>
  );

  const patterns: EngagementPattern[] = [];

  for (const [contentType, typePosts] of Object.entries(byContentType)) {
    // Calculate average engagement
    const avgEngagement =
      typePosts.reduce((sum, p) => sum + p.engagement_rate, 0) / typePosts.length;

    // Find best posting times
    const hourCounts: Record<number, { count: number; engagement: number }> = {};
    typePosts.forEach((post) => {
      if (post.posted_at) {
        const hour = new Date(post.posted_at).getHours();
        if (!hourCounts[hour]) hourCounts[hour] = { count: 0, engagement: 0 };
        hourCounts[hour].count++;
        hourCounts[hour].engagement += post.engagement_rate;
      }
    });

    const bestHours = Object.entries(hourCounts)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgEngagement: data.engagement / data.count,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3)
      .map((h) => `${h.hour}:00`);

    // Find top hashtags
    const hashtagPerformance: Record<string, { count: number; engagement: number }> = {};
    typePosts.forEach((post) => {
      post.hashtags.forEach((tag) => {
        if (!hashtagPerformance[tag]) hashtagPerformance[tag] = { count: 0, engagement: 0 };
        hashtagPerformance[tag].count++;
        hashtagPerformance[tag].engagement += post.engagement_rate;
      });
    });

    const topHashtags = Object.entries(hashtagPerformance)
      .map(([tag, data]) => ({
        tag,
        avgEngagement: data.engagement / data.count,
        count: data.count,
      }))
      .filter((h) => h.count >= 2) // Must be used at least twice
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10)
      .map((h) => h.tag);

    // Extract successful hooks from top performing posts
    const topPosts = [...typePosts]
      .sort((a, b) => b.engagement_rate - a.engagement_rate)
      .slice(0, 5);
    const successfulHooks = topPosts
      .map((p) => p.hook_text || p.caption?.split('\n')[0] || '')
      .filter(Boolean);

    // Topic performance
    const topicPerformance: Record<string, { count: number; engagement: number }> = {};
    typePosts.forEach((post) => {
      (post.topics || []).forEach((topic) => {
        if (!topicPerformance[topic]) topicPerformance[topic] = { count: 0, engagement: 0 };
        topicPerformance[topic].count++;
        topicPerformance[topic].engagement += post.engagement_rate;
      });
    });

    const topicScores = Object.fromEntries(
      Object.entries(topicPerformance).map(([topic, data]) => [
        topic,
        Math.round((data.engagement / data.count) * 100) / 100,
      ])
    );

    patterns.push({
      content_type: contentType,
      avg_engagement_rate: Math.round(avgEngagement * 100) / 100,
      best_posting_times: bestHours,
      top_hashtags: topHashtags,
      successful_hooks: successfulHooks,
      topic_performance: topicScores,
    });
  }

  return patterns;
}

// ============================================
// Batch Analysis for Influencer
// ============================================

export async function analyzeInfluencerFully(
  influencerId: string
): Promise<{
  profile_analysis: ProfileToneAnalysis;
  kcu_comparison: ToneComparisonResult;
  engagement_patterns: EngagementPattern[];
}> {
  // Get influencer posts
  const { data: posts } = await supabase
    .from('influencer_posts')
    .select('*')
    .eq('influencer_id', influencerId)
    .order('posted_at', { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) {
    throw new Error('No posts found for influencer');
  }

  // Get influencer profile
  const { data: influencer } = await supabase
    .from('influencer_profiles')
    .select('handle')
    .eq('id', influencerId)
    .single();

  // Run analyses
  const [profileAnalysis, engagementPatterns] = await Promise.all([
    analyzeProfileTone(posts, influencer?.handle || ''),
    extractEngagementPatterns(posts),
  ]);

  // Compare to KCU tone
  const kcuComparison = await compareToKCUTone(profileAnalysis);

  // Update influencer profile with tone analysis
  await supabase
    .from('influencer_profiles')
    .update({
      content_themes: profileAnalysis.content_themes,
      tone_analysis: {
        style: profileAnalysis.overall_style,
        keywords: Object.keys(profileAnalysis.keyword_frequency || {}),
        emoji_usage: profileAnalysis.posting_patterns.emoji_usage,
        call_to_action_style:
          profileAnalysis.engagement_drivers.find((d) => d.includes('CTA')) || '',
        voice_attributes: profileAnalysis.voice_attributes,
        sample_hooks: profileAnalysis.top_performing_hooks,
      },
    })
    .eq('id', influencerId);

  // Update individual post analyses
  for (const post of posts.slice(0, 20)) {
    if (!post.sentiment) {
      const postAnalysis = await analyzePostTone(post, 'instagram');
      await supabase
        .from('influencer_posts')
        .update({
          sentiment: postAnalysis.sentiment,
          topics: postAnalysis.topics,
          tone_markers: postAnalysis.tone_markers,
          hook_text: postAnalysis.hook_text,
          call_to_action: postAnalysis.call_to_action,
        })
        .eq('id', post.id);

      // Rate limit
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return {
    profile_analysis: profileAnalysis,
    kcu_comparison: kcuComparison,
    engagement_patterns: engagementPatterns,
  };
}

// ============================================
// Helper Functions
// ============================================

function getDefaultProfileAnalysis(): ProfileToneAnalysis {
  return {
    overall_style: 'Unknown',
    voice_attributes: {
      confident: 0.5,
      humble: 0.5,
      educational: 0.5,
      motivational: 0.5,
      professional: 0.5,
      casual: 0.5,
      authoritative: 0.5,
      supportive: 0.5,
      disciplined: 0.5,
      patient: 0.5,
    },
    content_themes: [],
    posting_patterns: {
      avg_caption_length: 0,
      avg_hashtags: 0,
      emoji_usage: 'moderate',
      cta_frequency: 0,
    },
    top_performing_hooks: [],
    engagement_drivers: [],
    keyword_frequency: {},
    recommendations: [],
  };
}

// ============================================
// Export Tone Profile for Content Generation
// ============================================

export async function getKCUToneProfile(): Promise<KCUToneProfile | null> {
  const { data } = await supabase
    .from('kcu_tone_profile')
    .select('*')
    .eq('is_active', true)
    .single();

  return data;
}

export async function updateKCUToneProfile(
  updates: Partial<KCUToneProfile>,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('kcu_tone_profile')
    .update({
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('is_active', true);

  return !error;
}
