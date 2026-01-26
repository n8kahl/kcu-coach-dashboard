// ============================================
// Win Card Caption Generator
// Generates Instagram-style captions for student wins
// using Somesh's voice profile (Instagram Layer)
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  getHybridVoiceProfile,
  HybridVoiceProfile,
  InstagramVoiceLayer,
} from './tone-analyzer';
import { UserLearningStats, ModuleProgress } from '@/lib/learning-progress';

// Initialize clients
const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Types
// ============================================

export type WinType =
  | 'course_completed'
  | 'module_completed'
  | 'quiz_passed'
  | 'streak_milestone'
  | 'xp_milestone'
  | 'first_trade'
  | 'profit_milestone'
  | 'consistency_award';

export interface StudentWinData {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  winType: WinType;
  // Learning-specific data
  courseName?: string;
  moduleName?: string;
  quizScore?: number;
  lessonsCompleted?: number;
  totalLessons?: number;
  // Stats
  streakDays?: number;
  xpEarned?: number;
  level?: number;
  totalWatchTimeHours?: number;
  // Trading-specific (future)
  profitAmount?: number;
  profitPercent?: number;
  tradeSymbol?: string;
  // Timestamp
  achievedAt: string;
}

export interface WinCardCaption {
  id: string;
  winType: WinType;
  studentName: string;
  // Main content
  headline: string; // Bold headline for the win
  instagramCaption: string; // Full Instagram-ready caption
  twitterCaption: string; // Shorter for Twitter
  // Components
  hook: string; // Attention-grabbing first line
  achievement: string; // The specific achievement
  encouragement: string; // Motivational message
  hashtags: string[];
  emojis: string[];
  cta: string; // Call to action
  // Metadata
  generatedAt: string;
  voiceProfileUsed: string;
}

// Import and re-export types from centralized location
import {
  type AspectRatioOption,
  type WinCardTheme as WinCardThemeType,
  type WinCardThemeName,
  ASPECT_RATIOS as ASPECT_RATIOS_BASE,
  WIN_CARD_THEMES as WIN_CARD_THEMES_BASE,
} from '@/types/win-card';

// Re-export with original names for backwards compatibility
export type WinCardAspectRatio = AspectRatioOption;
export type WinCardTheme = WinCardThemeType;
export { WinCardThemeName };
export const ASPECT_RATIOS = ASPECT_RATIOS_BASE;
export const WIN_CARD_THEMES = WIN_CARD_THEMES_BASE;

// ============================================
// Caption Generation Prompt
// ============================================

const CAPTION_GENERATION_PROMPT = `You are writing an Instagram caption for a "Client Win" post in the exact voice of Somesh from @kaycapitals.

SOMESH'S INSTAGRAM VOICE PROFILE:
{voice_profile}

STUDENT WIN DATA:
{win_data}

Write a caption that celebrates this student's achievement in Somesh's authentic Instagram style.

Key characteristics of Somesh's Instagram captions:
1. HOOK: Start with a punchy, attention-grabbing line (often ends with emoji)
2. CELEBRATION: Genuine excitement for the student's win
3. STORY: Brief context about the journey (if applicable)
4. LESSON: Pull out a key lesson others can learn
5. ENCOURAGEMENT: Motivate others to keep pushing
6. CTA: Invite engagement (comment, share, tag someone)

IMPORTANT VOICE GUIDELINES:
- Use "fam" naturally when addressing the community
- Include his signature phrases like "Trust the process", "LTP", "This is what it's about"
- Emoji usage: {emoji_style} - use emojis like: {emojis}
- Hashtags: Mix trading/education hashtags with motivational ones
- Caption length: Medium (150-250 words)
- Line breaks: Use double line breaks for readability
- Celebrate the PERSON, not just the achievement
- Make it feel like Somesh is personally proud of them

Return JSON with this exact structure:
{
  "headline": "Short bold headline (5-8 words)",
  "hook": "The opening line that grabs attention",
  "achievement": "One sentence describing what they achieved",
  "encouragement": "Motivational message to the community",
  "instagramCaption": "Full Instagram-ready caption with line breaks",
  "twitterCaption": "Condensed version under 280 characters",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "emojis": ["🎯", "🔥"],
  "cta": "The call to action at the end"
}

Return ONLY valid JSON, no markdown or explanation.`;

// ============================================
// Main Caption Generation Function
// ============================================

export async function generateWinCardCaption(
  winData: StudentWinData
): Promise<WinCardCaption> {
  try {
    // Get the voice profile
    const voiceProfile = await getHybridVoiceProfile();
    const instagramLayer = voiceProfile?.instagramLayer || getDefaultInstagramLayer();

    // Build the prompt
    const prompt = buildCaptionPrompt(winData, instagramLayer, voiceProfile);

    // Generate with Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse response
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);

    const parsed = JSON.parse(cleanedText.trim());

    return {
      id: `win-caption-${Date.now()}`,
      winType: winData.winType,
      studentName: winData.displayName,
      headline: parsed.headline,
      instagramCaption: parsed.instagramCaption,
      twitterCaption: parsed.twitterCaption,
      hook: parsed.hook,
      achievement: parsed.achievement,
      encouragement: parsed.encouragement,
      hashtags: parsed.hashtags || [],
      emojis: parsed.emojis || [],
      cta: parsed.cta,
      generatedAt: new Date().toISOString(),
      voiceProfileUsed: voiceProfile?.id || 'default',
    };
  } catch (error) {
    console.error('[WinCardCaption] Generation error:', error);
    return getDefaultCaption(winData);
  }
}

/**
 * Build the caption generation prompt
 */
function buildCaptionPrompt(
  winData: StudentWinData,
  instagramLayer: InstagramVoiceLayer,
  voiceProfile: HybridVoiceProfile | null
): string {
  // Build win data description
  const winDescription = buildWinDescription(winData);

  // Build voice profile summary
  const voiceSummary = {
    signaturePhrases: instagramLayer.signaturePhrases,
    hookPatterns: instagramLayer.captionStructures.hookPatterns,
    ctaPatterns: instagramLayer.captionStructures.ctaPatterns,
    lineBreakStyle: instagramLayer.captionStructures.lineBreakStyle,
    topEmojis: instagramLayer.highFrequencyEmojis.slice(0, 5).map(e => e.emoji),
    hashtagClusters: instagramLayer.hashtagClusters,
  };

  // Get emoji style
  const emojiDensity = instagramLayer.postingStyle.emojiDensity;
  const emojiStyle = emojiDensity > 3 ? 'heavy' : emojiDensity > 1.5 ? 'moderate' : 'minimal';
  const emojis = instagramLayer.highFrequencyEmojis.slice(0, 8).map(e => e.emoji).join(' ');

  return CAPTION_GENERATION_PROMPT
    .replace('{voice_profile}', JSON.stringify(voiceSummary, null, 2))
    .replace('{win_data}', JSON.stringify(winDescription, null, 2))
    .replace('{emoji_style}', emojiStyle)
    .replace('{emojis}', emojis);
}

/**
 * Build a description of the win for the prompt
 */
function buildWinDescription(winData: StudentWinData): Record<string, unknown> {
  const base = {
    studentName: winData.displayName,
    winType: winData.winType,
    achievedAt: winData.achievedAt,
  };

  switch (winData.winType) {
    case 'course_completed':
      return {
        ...base,
        description: `Completed the "${winData.courseName}" course`,
        lessonsCompleted: winData.lessonsCompleted,
        totalWatchTimeHours: winData.totalWatchTimeHours,
        significance: 'Major milestone - full course completion shows serious dedication',
      };

    case 'module_completed':
      return {
        ...base,
        description: `Completed the "${winData.moduleName}" module`,
        lessonsCompleted: winData.lessonsCompleted,
        totalLessons: winData.totalLessons,
        significance: 'Solid progress - another step towards mastery',
      };

    case 'quiz_passed':
      return {
        ...base,
        description: `Passed the "${winData.moduleName}" quiz with ${winData.quizScore}%`,
        quizScore: winData.quizScore,
        significance: winData.quizScore && winData.quizScore >= 90
          ? 'Outstanding score - they really understand the material'
          : 'Passed the test - knowledge is being retained',
      };

    case 'streak_milestone':
      return {
        ...base,
        description: `Hit a ${winData.streakDays}-day learning streak!`,
        streakDays: winData.streakDays,
        significance: 'Consistency is EVERYTHING in trading - this shows discipline',
      };

    case 'xp_milestone':
      return {
        ...base,
        description: `Reached ${winData.xpEarned?.toLocaleString()} XP (Level ${winData.level})`,
        xpEarned: winData.xpEarned,
        level: winData.level,
        significance: 'Gamified progress - putting in the work',
      };

    case 'first_trade':
      return {
        ...base,
        description: 'Logged their FIRST trade in the journal',
        significance: 'Huge milestone - from learning to doing',
      };

    case 'profit_milestone':
      return {
        ...base,
        description: `Hit a ${winData.profitPercent}% gain on ${winData.tradeSymbol}`,
        profitAmount: winData.profitAmount,
        profitPercent: winData.profitPercent,
        symbol: winData.tradeSymbol,
        significance: 'The process is working - trust it',
      };

    case 'consistency_award':
      return {
        ...base,
        description: `Maintained consistency: ${winData.streakDays} days of journaling`,
        streakDays: winData.streakDays,
        significance: 'This is what separates professionals from amateurs',
      };

    default:
      return base;
  }
}

/**
 * Get a default caption when generation fails
 */
function getDefaultCaption(winData: StudentWinData): WinCardCaption {
  const headlines: Record<WinType, string> = {
    course_completed: 'COURSE COMPLETE! 🎓',
    module_completed: 'Module Mastered! 💪',
    quiz_passed: 'Quiz Conquered! ✅',
    streak_milestone: 'Streak Goals! 🔥',
    xp_milestone: 'Level Up! 🚀',
    first_trade: 'First Trade Logged! 📊',
    profit_milestone: 'Green Day! 💰',
    consistency_award: 'Consistency King! 👑',
  };

  return {
    id: `win-caption-default-${Date.now()}`,
    winType: winData.winType,
    studentName: winData.displayName,
    headline: headlines[winData.winType] || 'Big Win! 🎯',
    hook: `Shoutout to ${winData.displayName}! 🎯`,
    achievement: `Just crushed another milestone.`,
    encouragement: `This is what happens when you trust the process, fam.`,
    instagramCaption: `SHOUTOUT to ${winData.displayName}! 🎯🔥

This is what it's all about, fam.

${winData.displayName} just crushed it and I couldn't be prouder.

Trust the process. Put in the work. The results WILL follow.

Who's next? Drop a 🔥 in the comments!

#KCUTrading #LTP #TradingEducation #TrustTheProcess #TradingWins`,
    twitterCaption: `Shoutout to ${winData.displayName}! 🎯 Just crushed another milestone. This is what trusting the process looks like, fam. Who's next? #KCUTrading #LTP`,
    hashtags: ['#KCUTrading', '#LTP', '#TradingEducation', '#TrustTheProcess', '#TradingWins'],
    emojis: ['🎯', '🔥', '💪', '📈'],
    cta: 'Drop a 🔥 in the comments if you\'re next!',
    generatedAt: new Date().toISOString(),
    voiceProfileUsed: 'default',
  };
}

/**
 * Get default Instagram layer when profile not available
 */
function getDefaultInstagramLayer(): InstagramVoiceLayer {
  return {
    highFrequencyEmojis: [
      { emoji: '🎯', count: 10, percentage: 15 },
      { emoji: '📈', count: 8, percentage: 12 },
      { emoji: '💰', count: 7, percentage: 10 },
      { emoji: '🔥', count: 6, percentage: 9 },
      { emoji: '💪', count: 5, percentage: 8 },
    ],
    hashtagClusters: [
      { cluster: 'Trading', hashtags: ['#daytrading', '#trading', '#stockmarket', '#options'], frequency: 80 },
      { cluster: 'Education', hashtags: ['#tradinglife', '#learntorade', '#tradingeducation'], frequency: 60 },
      { cluster: 'Brand', hashtags: ['#KCUTrading', '#LTP', '#TrustTheProcess'], frequency: 90 },
    ],
    captionStructures: {
      avgLength: 200,
      hookPatterns: ['SHOUTOUT to X! 🎯', 'This right here. 🔥', 'Y\'all see this?! 👀'],
      ctaPatterns: ['Drop a 🔥 in the comments', 'Tag someone who needs this', 'Save this for later'],
      lineBreakStyle: 'double',
    },
    topPerformingCaptions: [],
    signaturePhrases: ['Listen fam', 'Trust the process', 'LTP', 'This is what it\'s about'],
    postingStyle: {
      avgHashtagsPerPost: 8,
      emojiDensity: 2.5,
      questionFrequency: 30,
      mentionFrequency: 5,
    },
  };
}

// ============================================
// Batch Generation
// ============================================

/**
 * Generate captions for multiple wins
 */
export async function generateBatchWinCaptions(
  wins: StudentWinData[]
): Promise<WinCardCaption[]> {
  const captions: WinCardCaption[] = [];

  for (const win of wins) {
    const caption = await generateWinCardCaption(win);
    captions.push(caption);
    // Rate limit - 500ms between generations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return captions;
}

// ============================================
// Win Card Queue Management
// ============================================

export interface QueuedWinCard {
  id: string;
  studentWin: StudentWinData;
  caption: WinCardCaption;
  aspectRatio: WinCardAspectRatio;
  theme: WinCardTheme;
  status: 'draft' | 'approved' | 'posted' | 'rejected';
  imageUrl?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  postedAt?: string;
  postedTo?: string[];
}

/**
 * Add a win card to the review queue
 */
export async function queueWinCard(
  studentWin: StudentWinData,
  caption: WinCardCaption,
  aspectRatio: WinCardAspectRatio = ASPECT_RATIOS[1], // Default to post
  theme: WinCardTheme = WIN_CARD_THEMES.gold
): Promise<QueuedWinCard> {
  const queuedCard: QueuedWinCard = {
    id: `queued-win-${Date.now()}`,
    studentWin,
    caption,
    aspectRatio,
    theme,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  // Save to database
  const { error } = await supabase
    .from('social_win_card_queue')
    .insert({
      id: queuedCard.id,
      student_user_id: studentWin.userId,
      student_name: studentWin.displayName,
      win_type: studentWin.winType,
      win_data: studentWin,
      caption_data: caption,
      aspect_ratio: aspectRatio.name,
      theme_name: theme.name,
      status: 'draft',
      created_at: queuedCard.createdAt,
    });

  if (error) {
    console.error('[WinCardQueue] Error saving:', error);
    throw new Error(`Failed to queue win card: ${error.message}`);
  }

  return queuedCard;
}

/**
 * Get all win cards in the review queue
 */
export async function getWinCardQueue(
  status?: QueuedWinCard['status']
): Promise<QueuedWinCard[]> {
  let query = supabase
    .from('social_win_card_queue')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[WinCardQueue] Fetch error:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    studentWin: row.win_data as StudentWinData,
    caption: row.caption_data as WinCardCaption,
    aspectRatio: ASPECT_RATIOS.find(ar => ar.name === row.aspect_ratio) || ASPECT_RATIOS[1],
    theme: WIN_CARD_THEMES[row.theme_name.toLowerCase().replace(/\s+/g, '') as WinCardThemeName] || WIN_CARD_THEMES.gold,
    status: row.status as QueuedWinCard['status'],
    imageUrl: row.image_url,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    postedAt: row.posted_at,
    postedTo: row.posted_to,
  }));
}

/**
 * Approve a win card for posting
 */
export async function approveWinCard(
  cardId: string,
  approvedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('social_win_card_queue')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', cardId);

  return !error;
}

/**
 * Mark a win card as posted
 */
export async function markWinCardPosted(
  cardId: string,
  platforms: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from('social_win_card_queue')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      posted_to: platforms,
    })
    .eq('id', cardId);

  return !error;
}

/**
 * Reject a win card
 */
export async function rejectWinCard(
  cardId: string,
  rejectedBy: string,
  reason?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('social_win_card_queue')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: rejectedBy,
      rejection_reason: reason,
    })
    .eq('id', cardId);

  return !error;
}

// ============================================
// Auto-Detection of Wins
// ============================================

/**
 * Check for recent wins that could be featured
 */
export async function detectRecentWins(
  hoursBack: number = 24
): Promise<StudentWinData[]> {
  const wins: StudentWinData[] = [];
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  // 1. Check for course completions
  const { data: courseCompletions } = await supabase
    .from('course_lesson_progress')
    .select(`
      user_id,
      completed_at,
      user_profiles!inner (
        display_name,
        avatar_url
      )
    `)
    .eq('completed', true)
    .gte('completed_at', cutoffTime);

  // Process completions (group by user to find full course completions)
  // This is simplified - in production, compare against total lessons per course

  // 2. Check for quiz passes
  const { data: quizPasses } = await supabase
    .from('course_quiz_attempts')
    .select(`
      user_id,
      module_id,
      score_percent,
      completed_at,
      course_modules!inner (
        title
      ),
      user_profiles!inner (
        display_name,
        avatar_url
      )
    `)
    .eq('passed', true)
    .gte('completed_at', cutoffTime)
    .gte('score_percent', 80); // Only feature high scores

  if (quizPasses) {
    for (const quiz of quizPasses) {
      const profile = quiz.user_profiles as unknown as { display_name: string; avatar_url?: string };
      const module = quiz.course_modules as unknown as { title: string };

      wins.push({
        userId: quiz.user_id,
        displayName: profile.display_name || 'KCU Student',
        avatarUrl: profile.avatar_url,
        winType: 'quiz_passed',
        moduleName: module.title,
        quizScore: quiz.score_percent,
        achievedAt: quiz.completed_at,
      });
    }
  }

  // 3. Check for streak milestones (7, 14, 30, 60, 90, 100+ days)
  const streakMilestones = [7, 14, 30, 60, 90, 100];
  const { data: streakUsers } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url, streak_days, updated_at')
    .in('streak_days', streakMilestones)
    .gte('updated_at', cutoffTime);

  if (streakUsers) {
    for (const user of streakUsers) {
      wins.push({
        userId: user.id,
        displayName: user.display_name || 'KCU Student',
        avatarUrl: user.avatar_url,
        winType: 'streak_milestone',
        streakDays: user.streak_days,
        achievedAt: user.updated_at,
      });
    }
  }

  // 4. Check for XP/Level milestones (every 1000 XP or every 5 levels)
  const { data: xpUsers } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url, total_xp, updated_at')
    .gte('total_xp', 1000)
    .gte('updated_at', cutoffTime);

  if (xpUsers) {
    for (const user of xpUsers) {
      // Check if they just crossed a milestone
      const xp = user.total_xp;
      const milestones = [1000, 2500, 5000, 10000, 25000, 50000, 100000];
      const recentMilestone = milestones.find(m => xp >= m && xp < m + 500); // Within 500 XP of milestone

      if (recentMilestone) {
        const level = Math.floor(Math.sqrt(xp / 100)) + 1;
        wins.push({
          userId: user.id,
          displayName: user.display_name || 'KCU Student',
          avatarUrl: user.avatar_url,
          winType: 'xp_milestone',
          xpEarned: xp,
          level,
          achievedAt: user.updated_at,
        });
      }
    }
  }

  return wins;
}
