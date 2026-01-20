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

// ============================================
// Hybrid Voice Profile System
// Combines Instagram & YouTube data for Somesh's voice
// ============================================

import {
  scrapeInstagramPosts,
  scrapeYouTubePosts,
} from './influencer-scraper';
import { transcribeAudioFromUrl } from '@/lib/transcription';

export interface InstagramVoiceLayer {
  highFrequencyEmojis: Array<{ emoji: string; count: number; percentage: number }>;
  hashtagClusters: Array<{
    cluster: string;
    hashtags: string[];
    frequency: number;
  }>;
  captionStructures: {
    avgLength: number;
    hookPatterns: string[];
    ctaPatterns: string[];
    lineBreakStyle: 'none' | 'single' | 'double' | 'heavy';
  };
  topPerformingCaptions: Array<{
    caption: string;
    engagementRate: number;
    hashtags: string[];
  }>;
  signaturePhrases: string[];
  postingStyle: {
    avgHashtagsPerPost: number;
    emojiDensity: number; // per 100 chars
    questionFrequency: number; // percentage of posts with questions
    mentionFrequency: number;
  };
}

export interface YouTubeVoiceLayer {
  educationalTone: {
    teachingPhrases: string[];
    explanationPatterns: string[];
    conceptIntroductions: string[];
  };
  deepDivePhrases: string[];
  vocabularyProfile: {
    technicalTerms: string[];
    casualExpressions: string[];
    tradingJargon: string[];
    motivationalPhrases: string[];
  };
  narrativeStyle: {
    storyOpenings: string[];
    transitionPhrases: string[];
    conclusionPatterns: string[];
  };
  speakingCadence: {
    avgSentenceLength: number;
    repetitionPatterns: string[];
    emphasisPhrases: string[];
  };
}

export interface HybridVoiceProfile {
  id: string;
  handle: string;
  displayName: string;
  instagramLayer: InstagramVoiceLayer;
  youtubeLayer: YouTubeVoiceLayer;
  combinedInsights: {
    coreVocabulary: string[];
    signaturePhrases: string[];
    brandKeywords: string[];
    avoidedLanguage: string[];
    toneAttributes: Record<string, number>;
    platformSpecificAdjustments: {
      instagram: {
        emojiStyle: string[];
        hashtagStrategy: string[];
        captionLength: 'short' | 'medium' | 'long';
      };
      youtube: {
        openingStyle: string;
        closingCTA: string;
        segmentTransitions: string[];
      };
      twitter: {
        threadStyle: boolean;
        hashtagLimit: number;
        mentionStyle: string;
      };
    };
  };
  lastUpdated: string;
  dataSourcesUsed: {
    instagramPosts: number;
    youtubeTranscripts: number;
  };
}

// ============================================
// Voice Profile Analysis Prompts
// ============================================

const INSTAGRAM_ANALYSIS_PROMPT = `You are analyzing Instagram content from a day trading educator to extract their unique voice and style patterns.

CAPTIONS DATA:
{captions_json}

Analyze these captions and extract:

1. HIGH_FREQUENCY_EMOJIS: Top 10 emojis used, with count and percentage
2. HASHTAG_CLUSTERS: Group related hashtags (e.g., "Trading Education" cluster: #daytrading, #tradinglife, #learntorade)
3. CAPTION_STRUCTURES:
   - Average caption length
   - Common hook patterns (first line patterns)
   - CTA patterns (call to action styles)
   - Line break style preference
4. SIGNATURE_PHRASES: Unique phrases they repeat (e.g., "Listen fam", "Trust the process")
5. POSTING_STYLE: Stats on hashtags, emojis, questions, mentions

Return JSON with this exact structure:
{
  "highFrequencyEmojis": [{"emoji": "🔥", "count": 15, "percentage": 20.5}],
  "hashtagClusters": [{"cluster": "Trading Education", "hashtags": ["#daytrading"], "frequency": 80}],
  "captionStructures": {
    "avgLength": 250,
    "hookPatterns": ["Stop doing X. Start doing Y."],
    "ctaPatterns": ["Drop a 🔥 if you agree"],
    "lineBreakStyle": "double"
  },
  "topPerformingCaptions": [{"caption": "...", "engagementRate": 5.2, "hashtags": []}],
  "signaturePhrases": ["Listen fam", "Trust the process"],
  "postingStyle": {
    "avgHashtagsPerPost": 8,
    "emojiDensity": 2.5,
    "questionFrequency": 30,
    "mentionFrequency": 10
  }
}

Return ONLY valid JSON.`;

const YOUTUBE_ANALYSIS_PROMPT = `You are analyzing YouTube transcript content from a day trading educator (Somesh from KCU Trading) to extract their teaching voice and educational patterns.

TRANSCRIPT:
{transcript}

Analyze this transcript and extract:

1. EDUCATIONAL_TONE:
   - Teaching phrases ("Let me show you", "Here's the key")
   - Explanation patterns (how they break down concepts)
   - Concept introductions (how they introduce new ideas)

2. DEEP_DIVE_PHRASES: Phrases used when going deep into a topic

3. VOCABULARY_PROFILE:
   - Technical terms they use frequently
   - Casual expressions and slang
   - Trading-specific jargon
   - Motivational phrases

4. NARRATIVE_STYLE:
   - Story openings
   - Transition phrases between topics
   - Conclusion patterns

5. SPEAKING_CADENCE:
   - Average sentence length (words)
   - Repetition patterns (phrases they repeat for emphasis)
   - Emphasis phrases ("This is CRUCIAL", "Write this down")

Return JSON with this exact structure:
{
  "educationalTone": {
    "teachingPhrases": ["Let me break this down"],
    "explanationPatterns": ["The reason for this is..."],
    "conceptIntroductions": ["So what is X? X is..."]
  },
  "deepDivePhrases": ["Let's really dig into this"],
  "vocabularyProfile": {
    "technicalTerms": ["VWAP", "support", "resistance"],
    "casualExpressions": ["Fam", "Y'all", "Sweet"],
    "tradingJargon": ["LTP", "patience candle", "key level"],
    "motivationalPhrases": ["Trust the process", "Patience pays"]
  },
  "narrativeStyle": {
    "storyOpenings": ["Back when I first started..."],
    "transitionPhrases": ["Now here's where it gets interesting"],
    "conclusionPatterns": ["And that's the beauty of LTP"]
  },
  "speakingCadence": {
    "avgSentenceLength": 12,
    "repetitionPatterns": ["X. Let me say that again. X."],
    "emphasisPhrases": ["This is crucial", "Write this down"]
  }
}

Return ONLY valid JSON.`;

const COMBINE_INSIGHTS_PROMPT = `You are creating a unified voice profile by combining Instagram and YouTube analysis data from Somesh (KCU Trading).

INSTAGRAM ANALYSIS:
{instagram_json}

YOUTUBE ANALYSIS:
{youtube_json}

Create a combined insights profile that merges both platforms:

1. CORE_VOCABULARY: Words/phrases consistent across both platforms
2. SIGNATURE_PHRASES: Their most distinctive expressions
3. BRAND_KEYWORDS: Key terms that define their brand
4. AVOIDED_LANGUAGE: Terms they never use (infer from patterns)
5. TONE_ATTRIBUTES: Scores 0-100 for:
   - confident, humble, educational, motivational, professional, casual, authoritative, supportive, disciplined, patient
6. PLATFORM_SPECIFIC_ADJUSTMENTS: How their voice adapts per platform

Return JSON:
{
  "coreVocabulary": ["LTP", "patience", "level", "trend"],
  "signaturePhrases": ["Listen fam", "Trust the process"],
  "brandKeywords": ["LTP Framework", "price action", "patience candle"],
  "avoidedLanguage": ["get rich quick", "guaranteed profits"],
  "toneAttributes": {
    "confident": 85,
    "humble": 60,
    "educational": 90,
    "motivational": 80,
    "professional": 70,
    "casual": 75,
    "authoritative": 80,
    "supportive": 85,
    "disciplined": 90,
    "patient": 95
  },
  "platformSpecificAdjustments": {
    "instagram": {
      "emojiStyle": ["🎯", "📈", "💰"],
      "hashtagStrategy": ["Mix popular + niche"],
      "captionLength": "medium"
    },
    "youtube": {
      "openingStyle": "Hook with problem/question",
      "closingCTA": "Like, subscribe, join the fam",
      "segmentTransitions": ["Now let's look at..."]
    },
    "twitter": {
      "threadStyle": true,
      "hashtagLimit": 3,
      "mentionStyle": "Minimal, strategic"
    }
  }
}

Return ONLY valid JSON.`;

// ============================================
// Main updateVoiceProfile Function
// ============================================

export interface UpdateVoiceProfileOptions {
  instagramHandle?: string;
  youtubeChannelId?: string;
  forceRefresh?: boolean;
}

export interface UpdateVoiceProfileResult {
  success: boolean;
  profile?: HybridVoiceProfile;
  error?: string;
  dataCollected: {
    instagramPosts: number;
    youtubeTranscript: boolean;
  };
}

/**
 * Update the voice profile by scraping Somesh's latest content
 * from Instagram and YouTube, then analyzing to create a hybrid profile
 */
export async function updateVoiceProfile(
  options: UpdateVoiceProfileOptions = {}
): Promise<UpdateVoiceProfileResult> {
  const {
    instagramHandle = 'kaycapitals',
    youtubeChannelId = 'UC_KCU_CHANNEL_ID', // Replace with actual channel ID
    forceRefresh = false,
  } = options;

  const result: UpdateVoiceProfileResult = {
    success: false,
    dataCollected: {
      instagramPosts: 0,
      youtubeTranscript: false,
    },
  };

  try {
    console.log(`[VoiceProfile] Starting voice profile update for @${instagramHandle}`);

    // Step 1: Scrape Instagram posts
    console.log('[VoiceProfile] Scraping Instagram posts...');
    const instagramPosts = await scrapeInstagramPosts(instagramHandle, 20);
    result.dataCollected.instagramPosts = instagramPosts.length;

    if (instagramPosts.length === 0) {
      console.warn('[VoiceProfile] No Instagram posts found, using cached data if available');
    }

    // Step 2: Get YouTube transcript
    console.log('[VoiceProfile] Fetching YouTube content...');
    let youtubeTranscript = '';

    try {
      // Get latest YouTube videos
      const youtubePosts = await scrapeYouTubePosts(youtubeChannelId, 5);

      if (youtubePosts.length > 0) {
        // Try to get transcript from the most recent long-form video
        const longFormVideo = youtubePosts.find(
          (p) => p.content_type === 'video' && (p.video_duration_seconds || 0) > 300
        );

        if (longFormVideo && longFormVideo.platform_url) {
          // Extract video ID
          const videoIdMatch = longFormVideo.platform_url.match(/[?&]v=([^&]+)/);
          if (videoIdMatch) {
            // Try to get transcript using YouTube's auto-generated captions
            const transcriptResult = await fetchYouTubeTranscript(videoIdMatch[1]);
            if (transcriptResult) {
              youtubeTranscript = transcriptResult;
              result.dataCollected.youtubeTranscript = true;
            }
          }
        }
      }
    } catch (ytError) {
      console.warn('[VoiceProfile] YouTube transcript fetch failed:', ytError);
    }

    // Step 3: Analyze Instagram content
    console.log('[VoiceProfile] Analyzing Instagram voice layer...');
    const instagramLayer = await analyzeInstagramVoice(instagramPosts);

    // Step 4: Analyze YouTube content (if available)
    console.log('[VoiceProfile] Analyzing YouTube voice layer...');
    const youtubeLayer = await analyzeYouTubeVoice(youtubeTranscript);

    // Step 5: Combine insights
    console.log('[VoiceProfile] Creating combined voice profile...');
    const combinedInsights = await combineVoiceInsights(instagramLayer, youtubeLayer);

    // Step 6: Create the hybrid profile
    const hybridProfile: HybridVoiceProfile = {
      id: `voice-profile-${Date.now()}`,
      handle: instagramHandle,
      displayName: 'Somesh (KCU Trading)',
      instagramLayer,
      youtubeLayer,
      combinedInsights,
      lastUpdated: new Date().toISOString(),
      dataSourcesUsed: {
        instagramPosts: instagramPosts.length,
        youtubeTranscripts: youtubeTranscript ? 1 : 0,
      },
    };

    // Step 7: Save to social_builder_config
    console.log('[VoiceProfile] Saving to database...');
    const { error: saveError } = await supabase
      .from('social_builder_config')
      .upsert({
        config_key: 'hybrid_voice_profile',
        config_value: hybridProfile,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'config_key',
      });

    if (saveError) {
      console.error('[VoiceProfile] Error saving profile:', saveError);
      result.error = `Failed to save profile: ${saveError.message}`;
      return result;
    }

    // Also update the KCU tone profile with key insights
    await updateKCUToneProfileFromHybrid(hybridProfile);

    result.success = true;
    result.profile = hybridProfile;

    console.log('[VoiceProfile] Voice profile updated successfully');
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[VoiceProfile] Update failed:', errorMessage);
    result.error = errorMessage;
    return result;
  }
}

/**
 * Analyze Instagram posts to extract voice layer
 */
async function analyzeInstagramVoice(
  posts: Array<{
    caption?: string;
    hashtags: string[];
    likes_count: number;
    comments_count: number;
    views_count?: number;
  }>
): Promise<InstagramVoiceLayer> {
  if (posts.length === 0) {
    return getDefaultInstagramLayer();
  }

  try {
    // Prepare captions data
    const captionsData = posts.map((p, idx) => ({
      caption: p.caption || '',
      hashtags: p.hashtags,
      engagement: calculatePostEngagement(p),
    }));

    const prompt = INSTAGRAM_ANALYSIS_PROMPT.replace(
      '{captions_json}',
      JSON.stringify(captionsData, null, 2)
    );

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Clean and parse JSON
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);

    return JSON.parse(cleanedText.trim()) as InstagramVoiceLayer;
  } catch (error) {
    console.error('[VoiceProfile] Instagram analysis error:', error);
    return getDefaultInstagramLayer();
  }
}

/**
 * Analyze YouTube transcript to extract voice layer
 */
async function analyzeYouTubeVoice(transcript: string): Promise<YouTubeVoiceLayer> {
  if (!transcript || transcript.length < 100) {
    return getDefaultYouTubeLayer();
  }

  try {
    // Limit transcript to avoid token limits
    const truncatedTranscript = transcript.substring(0, 15000);

    const prompt = YOUTUBE_ANALYSIS_PROMPT.replace('{transcript}', truncatedTranscript);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Clean and parse JSON
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);

    return JSON.parse(cleanedText.trim()) as YouTubeVoiceLayer;
  } catch (error) {
    console.error('[VoiceProfile] YouTube analysis error:', error);
    return getDefaultYouTubeLayer();
  }
}

/**
 * Combine Instagram and YouTube insights into unified profile
 */
async function combineVoiceInsights(
  instagramLayer: InstagramVoiceLayer,
  youtubeLayer: YouTubeVoiceLayer
): Promise<HybridVoiceProfile['combinedInsights']> {
  try {
    const prompt = COMBINE_INSIGHTS_PROMPT
      .replace('{instagram_json}', JSON.stringify(instagramLayer, null, 2))
      .replace('{youtube_json}', JSON.stringify(youtubeLayer, null, 2));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Clean and parse JSON
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);

    return JSON.parse(cleanedText.trim());
  } catch (error) {
    console.error('[VoiceProfile] Combine insights error:', error);
    return getDefaultCombinedInsights();
  }
}

/**
 * Fetch YouTube transcript using available methods
 */
async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    // Method 1: Try YouTube's official caption API
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (apiKey) {
      // Get captions list
      const captionsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`
      );

      if (captionsResponse.ok) {
        const captionsData = await captionsResponse.json();
        const englishCaption = captionsData.items?.find(
          (item: any) => item.snippet?.language === 'en'
        );

        if (englishCaption) {
          // Download caption (requires OAuth for official API, so fallback to alternatives)
          console.log('[VoiceProfile] Caption found, but download requires OAuth');
        }
      }
    }

    // Method 2: Try third-party transcript service (if configured)
    const transcriptApiKey = process.env.YOUTUBE_TRANSCRIPT_API_KEY;

    if (transcriptApiKey) {
      const response = await fetch(
        `https://api.youtubetranscript.com/?id=${videoId}`,
        {
          headers: {
            'Authorization': `Bearer ${transcriptApiKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.transcript) {
          return data.transcript;
        }
      }
    }

    // Method 3: If we have the video in our library with a transcript, use that
    const { data: videoWithTranscript } = await supabase
      .from('course_lessons')
      .select('transcript_text')
      .or(`video_url.ilike.%${videoId}%,external_id.eq.${videoId}`)
      .limit(1)
      .single();

    if (videoWithTranscript?.transcript_text) {
      return videoWithTranscript.transcript_text;
    }

    console.log('[VoiceProfile] No transcript available for video:', videoId);
    return null;
  } catch (error) {
    console.error('[VoiceProfile] Transcript fetch error:', error);
    return null;
  }
}

/**
 * Update KCU tone profile from hybrid profile
 */
async function updateKCUToneProfileFromHybrid(
  hybrid: HybridVoiceProfile
): Promise<void> {
  try {
    const toneProfileUpdate: Partial<KCUToneProfile> = {
      voice_attributes: hybrid.combinedInsights.toneAttributes,
      preferred_phrases: hybrid.combinedInsights.signaturePhrases,
      preferred_emojis: hybrid.combinedInsights.platformSpecificAdjustments.instagram.emojiStyle,
      hook_patterns: hybrid.instagramLayer.captionStructures.hookPatterns,
      cta_patterns: hybrid.instagramLayer.captionStructures.ctaPatterns,
      always_use_hashtags: hybrid.instagramLayer.hashtagClusters
        .flatMap((c) => c.hashtags)
        .slice(0, 10),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('kcu_tone_profile')
      .update(toneProfileUpdate)
      .eq('is_active', true);

    console.log('[VoiceProfile] KCU tone profile updated from hybrid data');
  } catch (error) {
    console.error('[VoiceProfile] Failed to update KCU tone profile:', error);
  }
}

/**
 * Get the current hybrid voice profile from storage
 */
export async function getHybridVoiceProfile(): Promise<HybridVoiceProfile | null> {
  try {
    const { data, error } = await supabase
      .from('social_builder_config')
      .select('config_value')
      .eq('config_key', 'hybrid_voice_profile')
      .single();

    if (error || !data) {
      return null;
    }

    return data.config_value as HybridVoiceProfile;
  } catch {
    return null;
  }
}

// ============================================
// Helper Functions
// ============================================

function calculatePostEngagement(post: {
  likes_count: number;
  comments_count: number;
  views_count?: number;
}): number {
  const total = post.likes_count + post.comments_count * 2;
  const baseline = post.views_count || 10000;
  return Math.round((total / baseline) * 10000) / 100;
}

function getDefaultInstagramLayer(): InstagramVoiceLayer {
  return {
    highFrequencyEmojis: [
      { emoji: '🎯', count: 10, percentage: 15 },
      { emoji: '📈', count: 8, percentage: 12 },
      { emoji: '💰', count: 7, percentage: 10 },
    ],
    hashtagClusters: [
      { cluster: 'Trading', hashtags: ['#daytrading', '#trading', '#stockmarket'], frequency: 80 },
      { cluster: 'Education', hashtags: ['#tradinglife', '#learntorade'], frequency: 60 },
    ],
    captionStructures: {
      avgLength: 200,
      hookPatterns: ['Stop doing X. Start doing Y.', 'The secret to X is...'],
      ctaPatterns: ['Save this for later', 'Drop a comment below'],
      lineBreakStyle: 'double',
    },
    topPerformingCaptions: [],
    signaturePhrases: ['Listen fam', 'Trust the process', 'LTP'],
    postingStyle: {
      avgHashtagsPerPost: 8,
      emojiDensity: 2.0,
      questionFrequency: 25,
      mentionFrequency: 5,
    },
  };
}

function getDefaultYouTubeLayer(): YouTubeVoiceLayer {
  return {
    educationalTone: {
      teachingPhrases: ['Let me show you', 'Here\'s the key', 'Pay attention to this'],
      explanationPatterns: ['The reason for this is', 'What this means is'],
      conceptIntroductions: ['So what is LTP?', 'Level, Trend, Patience'],
    },
    deepDivePhrases: ['Let\'s really break this down', 'Here\'s where it gets interesting'],
    vocabularyProfile: {
      technicalTerms: ['support', 'resistance', 'VWAP', 'price action'],
      casualExpressions: ['Fam', 'Y\'all', 'Sweet', 'Beautiful'],
      tradingJargon: ['LTP', 'patience candle', 'key level', 'confirmation'],
      motivationalPhrases: ['Trust the process', 'Patience pays', 'You got this'],
    },
    narrativeStyle: {
      storyOpenings: ['Back when I started', 'Let me tell you a story'],
      transitionPhrases: ['Now here\'s the thing', 'And this is crucial'],
      conclusionPatterns: ['And that\'s the beauty of LTP', 'Remember fam'],
    },
    speakingCadence: {
      avgSentenceLength: 12,
      repetitionPatterns: ['X. Let me say that again. X.'],
      emphasisPhrases: ['This is CRUCIAL', 'Write this down', 'Don\'t miss this'],
    },
  };
}

function getDefaultCombinedInsights(): HybridVoiceProfile['combinedInsights'] {
  return {
    coreVocabulary: ['LTP', 'level', 'trend', 'patience', 'fam'],
    signaturePhrases: ['Listen fam', 'Trust the process', 'The holy grail'],
    brandKeywords: ['LTP Framework', 'price action', 'patience candle', 'KCU'],
    avoidedLanguage: ['get rich quick', 'guaranteed profits', 'easy money'],
    toneAttributes: {
      confident: 85,
      humble: 60,
      educational: 90,
      motivational: 80,
      professional: 70,
      casual: 75,
      authoritative: 80,
      supportive: 85,
      disciplined: 90,
      patient: 95,
    },
    platformSpecificAdjustments: {
      instagram: {
        emojiStyle: ['🎯', '📈', '💰', '🔥', '✅'],
        hashtagStrategy: ['Mix 3-4 popular with 3-4 niche'],
        captionLength: 'medium',
      },
      youtube: {
        openingStyle: 'Hook with relatable problem',
        closingCTA: 'Like, subscribe, join the fam',
        segmentTransitions: ['Now let\'s look at', 'Here\'s where it gets good'],
      },
      twitter: {
        threadStyle: true,
        hashtagLimit: 2,
        mentionStyle: 'Minimal',
      },
    },
  };
}
