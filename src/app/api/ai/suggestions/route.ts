/**
 * AI Suggestions API
 *
 * POST /api/ai/suggestions - Get proactive AI coaching suggestions
 *
 * Features:
 * - Context-aware suggestions based on current page
 * - Trade pattern analysis
 * - Learning milestone detection
 * - Streak tracking
 * - Market opportunity alerts
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getLearnUrl } from '@/lib/learning/urls';
import logger from '@/lib/logger';

// ============================================
// Types
// ============================================

type SuggestionType =
  | 'trade_analysis'
  | 'pattern_detected'
  | 'learning_milestone'
  | 'streak_reminder'
  | 'market_opportunity'
  | 'improvement_tip'
  | 'quiz_prompt'
  | 'risk_warning';

interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  action?: {
    label: string;
    prompt?: string;
    url?: string;
  };
  dismissable: boolean;
  timestamp: Date;
  expiresAt?: Date;
}

interface SuggestionRequest {
  page: string;
  userId?: string;
  selectedTrade?: Record<string, unknown>;
  selectedLesson?: Record<string, unknown>;
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

    const body: SuggestionRequest = await request.json();
    const { page, selectedTrade, selectedLesson } = body;

    // Get user profile and data
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('discord_id', user.discordId)
      .single();

    const suggestions: Suggestion[] = [];

    // Get page-specific suggestions
    const pageSuggestions = await getPageSuggestions(page, profile, selectedTrade, selectedLesson);
    suggestions.push(...pageSuggestions);

    // Get pattern-based suggestions (from trade history)
    if (profile) {
      const patternSuggestions = await getPatternSuggestions(profile.id);
      suggestions.push(...patternSuggestions);
    }

    // Get streak/milestone suggestions
    if (profile) {
      const milestoneSuggestions = await getMilestoneSuggestions(profile);
      suggestions.push(...milestoneSuggestions);
    }

    // Sort by priority and limit
    const sortedSuggestions = suggestions
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 5);

    return NextResponse.json({
      suggestions: sortedSuggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Suggestions API error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get suggestions' }, { status: 500 });
  }
}

// ============================================
// Suggestion Generators
// ============================================

async function getPageSuggestions(
  page: string,
  profile: Record<string, unknown> | null,
  selectedTrade?: Record<string, unknown>,
  selectedLesson?: Record<string, unknown>
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const now = new Date();

  switch (page) {
    case 'journal':
      if (selectedTrade) {
        suggestions.push({
          id: `trade-analysis-${Date.now()}`,
          type: 'trade_analysis',
          title: 'Analyze this trade',
          message: `Want me to break down your ${selectedTrade.symbol || 'selected'} trade?`,
          priority: 'medium',
          action: {
            label: 'Analyze',
            prompt: 'Analyze this trade and tell me what I did well and what I could improve.',
          },
          dismissable: true,
          timestamp: now,
        });
      } else {
        suggestions.push({
          id: `review-trades-${Date.now()}`,
          type: 'improvement_tip',
          title: 'Review recent trades',
          message: 'Select a trade to get AI-powered analysis and improvement tips.',
          priority: 'low',
          action: {
            label: 'Find patterns',
            prompt: 'Look at my recent trades and identify any patterns in my trading behavior.',
          },
          dismissable: true,
          timestamp: now,
        });
      }
      break;

    case 'learning':
      if (selectedLesson) {
        suggestions.push({
          id: `quiz-prompt-${Date.now()}`,
          type: 'quiz_prompt',
          title: 'Ready for a quiz?',
          message: 'Test your knowledge on what you just learned.',
          priority: 'medium',
          action: {
            label: 'Start quiz',
            prompt: 'Quiz me on the key concepts from this lesson.',
          },
          dismissable: true,
          timestamp: now,
        });
      } else {
        suggestions.push({
          id: `continue-learning-${Date.now()}`,
          type: 'improvement_tip',
          title: 'Continue learning',
          message: 'Pick up where you left off in your trading education.',
          priority: 'low',
          action: {
            label: 'What\'s next',
            prompt: 'What should I learn next based on my progress?',
          },
          dismissable: true,
          timestamp: now,
        });
      }
      break;

    case 'companion':
      suggestions.push({
        id: `market-check-${Date.now()}`,
        type: 'market_opportunity',
        title: 'Market check',
        message: 'Get a quick overview of key levels and setups.',
        priority: 'medium',
        action: {
          label: 'Check setups',
          prompt: 'What setups are forming on my watchlist right now?',
        },
        dismissable: true,
        timestamp: now,
      });
      break;

    case 'overview':
      suggestions.push({
        id: `daily-briefing-${Date.now()}`,
        type: 'improvement_tip',
        title: 'Daily briefing ready',
        message: 'Get your personalized trading plan for today.',
        priority: 'medium',
        action: {
          label: 'Get briefing',
          prompt: 'Give me my personalized daily briefing with what to focus on today.',
        },
        dismissable: true,
        timestamp: now,
      });
      break;

    case 'practice':
      suggestions.push({
        id: `practice-tip-${Date.now()}`,
        type: 'improvement_tip',
        title: 'Practice tip',
        message: 'Remember to check all three LTP components before deciding.',
        priority: 'low',
        dismissable: true,
        timestamp: now,
      });
      break;

    case 'admin':
      suggestions.push({
        id: `content-ideas-${Date.now()}`,
        type: 'improvement_tip',
        title: 'Content ideas',
        message: 'Generate social content based on trending topics.',
        priority: 'medium',
        action: {
          label: 'Generate',
          prompt: 'Generate 3 social media post ideas about today\'s market moves.',
        },
        dismissable: true,
        timestamp: now,
      });
      break;
  }

  return suggestions;
}

async function getPatternSuggestions(userId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const now = new Date();

  try {
    // Get recent trades
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: trades } = await supabaseAdmin
      .from('trade_journal')
      .select('*')
      .eq('user_id', userId)
      .gte('entry_time', thirtyDaysAgo)
      .order('entry_time', { ascending: false })
      .limit(20);

    if (!trades || trades.length < 5) return suggestions;

    // Analyze patterns
    const losingTrades = trades.filter((t) => t.pnl && t.pnl < 0);
    const winningTrades = trades.filter((t) => t.pnl && t.pnl > 0);
    const winRate = winningTrades.length / trades.length;

    // Early entry pattern (checking patience_followed field if it exists)
    const earlyEntries = trades.filter((t) => t.patience_followed === false);
    if (earlyEntries.length > trades.length * 0.3) {
      suggestions.push({
        id: `pattern-early-${Date.now()}`,
        type: 'pattern_detected',
        title: 'Entry timing pattern',
        message: `${Math.round((earlyEntries.length / trades.length) * 100)}% of your trades show early entries. Want to work on patience?`,
        priority: 'high',
        action: {
          label: 'Review',
          prompt: 'Show me my entry timing patterns and how to improve my patience.',
        },
        dismissable: true,
        timestamp: now,
      });
    }

    // Win rate warning
    if (winRate < 0.4 && trades.length >= 10) {
      suggestions.push({
        id: `pattern-winrate-${Date.now()}`,
        type: 'risk_warning',
        title: 'Win rate alert',
        message: `Your recent win rate is ${Math.round(winRate * 100)}%. Let's identify what's going wrong.`,
        priority: 'high',
        action: {
          label: 'Analyze',
          prompt: 'Analyze my losing trades and tell me the common mistakes.',
        },
        dismissable: true,
        timestamp: now,
      });
    }

    // Streak pattern
    let currentStreak = 0;
    let streakDirection: 'winning' | 'losing' | null = null;
    for (const trade of trades) {
      if (trade.pnl === undefined) continue;
      const isWin = trade.pnl > 0;
      if (streakDirection === null) {
        streakDirection = isWin ? 'winning' : 'losing';
        currentStreak = 1;
      } else if ((streakDirection === 'winning' && isWin) || (streakDirection === 'losing' && !isWin)) {
        currentStreak++;
      } else {
        break;
      }
    }

    if (currentStreak >= 3 && streakDirection === 'losing') {
      suggestions.push({
        id: `pattern-streak-${Date.now()}`,
        type: 'risk_warning',
        title: 'Losing streak detected',
        message: `You're on a ${currentStreak}-trade losing streak. Consider taking a break.`,
        priority: 'high',
        action: {
          label: 'Review',
          prompt: 'Review my recent losing streak and help me reset mentally.',
        },
        dismissable: true,
        timestamp: now,
      });
    } else if (currentStreak >= 3 && streakDirection === 'winning') {
      suggestions.push({
        id: `pattern-hotstreak-${Date.now()}`,
        type: 'learning_milestone',
        title: 'Hot streak! 🔥',
        message: `You're on a ${currentStreak}-trade winning streak. Keep following your rules!`,
        priority: 'medium',
        dismissable: true,
        timestamp: now,
      });
    }
  } catch (error) {
    logger.error('Pattern analysis error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return suggestions;
}

async function getMilestoneSuggestions(profile: Record<string, unknown>): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const now = new Date();

  // Streak reminder
  const streakDays = profile.streak_days as number || 0;
  if (streakDays >= 5) {
    suggestions.push({
      id: `streak-${Date.now()}`,
      type: 'streak_reminder',
      title: `${streakDays} day streak! 🔥`,
      message: 'Keep it up! Log in tomorrow to maintain your streak.',
      priority: 'low',
      dismissable: true,
      timestamp: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24h
    });
  }

  // Quiz completion milestone
  const totalQuizzes = profile.total_quizzes as number || 0;
  if (totalQuizzes > 0 && totalQuizzes % 10 === 0) {
    suggestions.push({
      id: `quiz-milestone-${Date.now()}`,
      type: 'learning_milestone',
      title: 'Quiz milestone! 🎉',
      message: `You've completed ${totalQuizzes} quizzes. Keep testing your knowledge!`,
      priority: 'low',
      dismissable: true,
      timestamp: now,
    });
  }

  // Module completion check
  const currentModule = profile.current_module as string;
  const moduleProgress = profile.module_progress as Record<string, number> || {};
  if (currentModule && moduleProgress[currentModule] >= 90) {
    suggestions.push({
      id: `module-complete-${Date.now()}`,
      type: 'learning_milestone',
      title: 'Almost done!',
      message: `You're ${moduleProgress[currentModule]}% through the ${currentModule} module. Finish strong!`,
      priority: 'medium',
      action: {
        label: 'Continue',
        url: getLearnUrl(), // Link to learn hub - user can navigate to their module
      },
      dismissable: true,
      timestamp: now,
    });
  }

  return suggestions;
}
