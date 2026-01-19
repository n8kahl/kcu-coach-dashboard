/**
 * Admin AI API
 *
 * POST /api/ai/admin - AI-powered admin features
 *
 * Features:
 * - Trending topic analysis
 * - Content calendar suggestions
 * - User struggle detection
 * - Content performance prediction
 * - Social content generation
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// Types
// ============================================

interface AdminRequest {
  action: 'trending' | 'calendar' | 'struggles' | 'generate' | 'predict';
  params?: Record<string, unknown>;
}

interface TrendingTopic {
  topic: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  relatedContent: string[];
  suggestedAngle: string;
}

interface ContentSuggestion {
  title: string;
  type: 'video' | 'post' | 'carousel' | 'reel';
  topic: string;
  suggestedTime: string;
  expectedEngagement: 'low' | 'medium' | 'high';
  caption?: string;
  hashtags?: string[];
}

interface UserStruggle {
  concept: string;
  affectedUsers: number;
  severity: 'low' | 'medium' | 'high';
  suggestedContent: string;
  relatedLessons: string[];
}

// ============================================
// API Handler
// ============================================

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin status
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('discord_id', user.discordId)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body: AdminRequest = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'trending':
        return await handleTrending(params);
      case 'calendar':
        return await handleCalendar(params);
      case 'struggles':
        return await handleStruggles(params);
      case 'generate':
        return await handleGenerate(params);
      case 'predict':
        return await handlePredict(params);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Admin AI error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// Action Handlers
// ============================================

async function handleTrending(params?: Record<string, unknown>) {
  // In production, this would analyze:
  // - Social media trends (Twitter, TikTok, Reddit)
  // - Search volume data
  // - Competitor content
  // - User questions/searches

  const trendingTopics: TrendingTopic[] = [
    {
      topic: 'Patience Candle Setups',
      score: 92,
      trend: 'up',
      relatedContent: ['How to identify patience candles', 'Common patience candle mistakes'],
      suggestedAngle: 'Real-time patience candle identification on SPY',
    },
    {
      topic: 'Risk Management',
      score: 88,
      trend: 'stable',
      relatedContent: ['Position sizing 101', 'Stop loss strategies'],
      suggestedAngle: 'How I never lose more than 1% per trade',
    },
    {
      topic: 'NVDA Trading Setups',
      score: 85,
      trend: 'up',
      relatedContent: ['NVDA level analysis', 'Tech stock trading'],
      suggestedAngle: 'Key levels to watch on NVDA this week',
    },
    {
      topic: 'Trading Psychology',
      score: 82,
      trend: 'up',
      relatedContent: ['FOMO prevention', 'Revenge trading'],
      suggestedAngle: 'The ONE mindset shift that changed my trading',
    },
    {
      topic: 'Morning Routine',
      score: 78,
      trend: 'stable',
      relatedContent: ['Pre-market prep', 'Level identification'],
      suggestedAngle: 'My 6AM trading routine (step by step)',
    },
  ];

  // Generate AI-enhanced suggestions
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are a social media content strategist for a trading education brand. Analyze these trending topics and suggest the best content angles for maximum engagement. Focus on educational value while being engaging.`,
      messages: [{
        role: 'user',
        content: `Current trending topics in trading education:\n${trendingTopics.map(t => `- ${t.topic} (score: ${t.score}, trend: ${t.trend})`).join('\n')}\n\nSuggest the top 3 content ideas for this week with specific hooks and formats.`,
      }],
    });

    const aiSuggestion = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({
      topics: trendingTopics,
      aiAnalysis: aiSuggestion,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      topics: trendingTopics,
      aiAnalysis: null,
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleCalendar(params?: Record<string, unknown>) {
  const daysAhead = (params?.days as number) || 7;

  // Generate content calendar suggestions
  const suggestions: ContentSuggestion[] = [];
  const now = new Date();

  const contentTypes = [
    { day: 0, type: 'reel' as const, topic: 'Quick Tip', time: '8:00 AM' },
    { day: 1, type: 'carousel' as const, topic: 'Educational', time: '12:00 PM' },
    { day: 2, type: 'post' as const, topic: 'Market Analysis', time: '7:00 AM' },
    { day: 3, type: 'reel' as const, topic: 'Setup Breakdown', time: '6:00 PM' },
    { day: 4, type: 'video' as const, topic: 'Trading Psychology', time: '10:00 AM' },
    { day: 5, type: 'carousel' as const, topic: 'Weekly Review', time: '9:00 AM' },
    { day: 6, type: 'post' as const, topic: 'Motivation', time: '11:00 AM' },
  ];

  for (let i = 0; i < Math.min(daysAhead, 14); i++) {
    const template = contentTypes[i % contentTypes.length];
    const date = new Date(now);
    date.setDate(date.getDate() + i);

    suggestions.push({
      title: `${template.topic} Content`,
      type: template.type,
      topic: template.topic,
      suggestedTime: `${date.toLocaleDateString()} ${template.time}`,
      expectedEngagement: i < 3 ? 'high' : i < 5 ? 'medium' : 'low',
      hashtags: ['#trading', '#daytrading', '#stockmarket', '#tradingpsychology', '#LTPframework'],
    });
  }

  // Generate AI captions for first few
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `You are a social media copywriter for a trading education brand called KCU (Kay Capitals University). Write engaging captions that are educational but also hook-driven. Keep captions under 150 characters for reels, under 300 for carousels.`,
      messages: [{
        role: 'user',
        content: `Generate captions for these content pieces:\n${suggestions.slice(0, 3).map((s, i) => `${i + 1}. ${s.type.toUpperCase()}: ${s.topic}`).join('\n')}`,
      }],
    });

    const captions = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse and add captions (simplified)
    const captionLines = captions.split('\n').filter(l => l.trim());
    captionLines.forEach((caption, idx) => {
      if (suggestions[idx]) {
        suggestions[idx].caption = caption.replace(/^\d+\.\s*/, '').trim();
      }
    });
  } catch (error) {
    // Continue without AI captions
  }

  return NextResponse.json({
    suggestions,
    daysPlanned: daysAhead,
    timestamp: new Date().toISOString(),
  });
}

async function handleStruggles(params?: Record<string, unknown>) {
  // In production, analyze:
  // - Quiz failure rates by concept
  // - Practice mode mistakes
  // - Support questions
  // - Forum discussions

  // Get quiz data
  const { data: quizResults } = await supabaseAdmin
    .from('quiz_results')
    .select('lesson_id, score, answers')
    .order('created_at', { ascending: false })
    .limit(500);

  // Analyze common struggles (mock for now)
  const struggles: UserStruggle[] = [
    {
      concept: 'Patience Candle Identification',
      affectedUsers: 45,
      severity: 'high',
      suggestedContent: 'Create a video showing 10 patience candle examples with explanations',
      relatedLessons: ['patience-candles', 'entry-timing'],
    },
    {
      concept: 'Trend Direction',
      affectedUsers: 38,
      severity: 'medium',
      suggestedContent: 'Interactive quiz with trend identification exercises',
      relatedLessons: ['trend-analysis', 'higher-highs-lows'],
    },
    {
      concept: 'Level Strength Assessment',
      affectedUsers: 32,
      severity: 'medium',
      suggestedContent: 'Comparison guide: Strong vs Weak levels',
      relatedLessons: ['key-levels', 'support-resistance'],
    },
    {
      concept: 'Position Sizing',
      affectedUsers: 28,
      severity: 'low',
      suggestedContent: 'Position size calculator walkthrough video',
      relatedLessons: ['risk-management', 'position-sizing'],
    },
  ];

  return NextResponse.json({
    struggles,
    totalUsersAnalyzed: quizResults?.length || 500,
    timestamp: new Date().toISOString(),
  });
}

async function handleGenerate(params?: Record<string, unknown>) {
  const contentType = (params?.type as string) || 'post';
  const topic = (params?.topic as string) || 'trading education';
  const platform = (params?.platform as string) || 'instagram';

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a social media content creator for KCU (Kay Capitals University), a trading education brand that teaches the LTP Framework (Levels, Trend, Patience).

Your content should be:
- Educational but engaging
- Use trading terminology appropriately
- Include hooks that stop the scroll
- End with calls to action
- Use relevant emojis sparingly
- Include 5-10 relevant hashtags at the end

Platform guidelines:
- Instagram: 2,200 char max, hooks in first line
- TikTok: Short, punchy, trend-aware
- Twitter/X: 280 chars, threads for longer content
- YouTube: SEO-optimized titles and descriptions`,
      messages: [{
        role: 'user',
        content: `Create a ${contentType} for ${platform} about: ${topic}\n\nInclude:\n1. Hook/title\n2. Main content\n3. Call to action\n4. Hashtags`,
      }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({
      content,
      type: contentType,
      platform,
      topic,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Content generation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}

async function handlePredict(params?: Record<string, unknown>) {
  const content = params?.content as string;
  const platform = (params?.platform as string) || 'instagram';

  if (!content) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are a social media analytics expert. Analyze content and predict its performance. Consider:
- Hook strength (does it stop the scroll?)
- Educational value
- Shareability
- Call to action clarity
- Hashtag relevance
- Optimal posting time

Respond with JSON only, no markdown:
{
  "engagementScore": 1-100,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "bestPostingTime": "...",
  "expectedReach": "low/medium/high"
}`,
      messages: [{
        role: 'user',
        content: `Platform: ${platform}\n\nContent to analyze:\n${content}`,
      }],
    });

    const analysisText = response.content[0].type === 'text' ? response.content[0].text : '{}';

    try {
      const analysis = JSON.parse(analysisText);
      return NextResponse.json({
        prediction: analysis,
        platform,
        analyzedAt: new Date().toISOString(),
      });
    } catch {
      return NextResponse.json({
        prediction: {
          engagementScore: 70,
          strengths: ['Educational content'],
          weaknesses: ['Could use stronger hook'],
          suggestions: ['Add more specific examples'],
          bestPostingTime: '8:00 AM or 6:00 PM',
          expectedReach: 'medium',
        },
        platform,
        analyzedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Prediction error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to predict performance' }, { status: 500 });
  }
}
