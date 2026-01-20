// ============================================
// Hall of Fame API Route
// Generate Win Cards with Instagram captions
// ============================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, internalError, badRequest } from '@/lib/api-errors';
import { z } from 'zod';
import {
  generateWinCardCaption,
  generateBatchWinCaptions,
  queueWinCard,
  getWinCardQueue,
  approveWinCard,
  rejectWinCard,
  markWinCardPosted,
  detectRecentWins,
  StudentWinData,
  WinType,
  ASPECT_RATIOS,
  WIN_CARD_THEMES,
} from '@/lib/social/win-card-caption-generator';

// ============================================
// Request Validation
// ============================================

const GenerateCaptionSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  winType: z.enum([
    'course_completed',
    'module_completed',
    'quiz_passed',
    'streak_milestone',
    'xp_milestone',
    'first_trade',
    'profit_milestone',
    'consistency_award',
  ]),
  // Optional win-specific data
  courseName: z.string().optional(),
  moduleName: z.string().optional(),
  quizScore: z.number().optional(),
  lessonsCompleted: z.number().optional(),
  totalLessons: z.number().optional(),
  streakDays: z.number().optional(),
  xpEarned: z.number().optional(),
  level: z.number().optional(),
  totalWatchTimeHours: z.number().optional(),
  profitAmount: z.number().optional(),
  profitPercent: z.number().optional(),
  tradeSymbol: z.string().optional(),
  achievedAt: z.string(),
});

const QueueWinCardSchema = z.object({
  studentWin: GenerateCaptionSchema,
  aspectRatio: z.enum(['story', 'post', 'square']).default('post'),
  themeName: z.enum(['gold', 'platinum', 'emerald', 'ruby']).default('gold'),
  customCaption: z.string().optional(),
});

const ApproveRejectSchema = z.object({
  cardId: z.string(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

const MarkPostedSchema = z.object({
  cardId: z.string(),
  platforms: z.array(z.string()),
});

// ============================================
// GET - Fetch queue or detect wins
// ============================================

export const GET = withErrorHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Get available themes and aspect ratios
  if (action === 'config') {
    return NextResponse.json({
      success: true,
      data: {
        aspectRatios: ASPECT_RATIOS,
        themes: Object.entries(WIN_CARD_THEMES).map(([key, value]) => ({
          key,
          ...value,
        })),
      },
    });
  }

  // Detect recent wins
  if (action === 'detect') {
    const hoursBack = parseInt(searchParams.get('hours') || '24');

    try {
      const wins = await detectRecentWins(hoursBack);

      return NextResponse.json({
        success: true,
        data: wins,
        count: wins.length,
        hoursBack,
      });
    } catch (error) {
      console.error('[HallOfFame] Detect error:', error);
      const message = error instanceof Error ? error.message : 'Failed to detect wins';
      return internalError(message);
    }
  }

  // Get win card queue
  const status = searchParams.get('status') as 'draft' | 'approved' | 'posted' | 'rejected' | undefined;

  try {
    const queue = await getWinCardQueue(status || undefined);

    return NextResponse.json({
      success: true,
      data: queue,
      count: queue.length,
      filter: status || 'all',
    });
  } catch (error) {
    console.error('[HallOfFame] Queue fetch error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch queue';
    return internalError(message);
  }
});

// ============================================
// POST - Generate caption or queue win card
// ============================================

export const POST = withErrorHandler(async (request: Request) => {
  const adminUser = await requireAdmin();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const body = await request.json();

  // Generate caption only (preview)
  if (action === 'generate') {
    try {
      const winData = GenerateCaptionSchema.parse(body) as StudentWinData;
      const caption = await generateWinCardCaption(winData);

      return NextResponse.json({
        success: true,
        data: caption,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequest(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }

      console.error('[HallOfFame] Generate error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate caption';
      return internalError(message);
    }
  }

  // Batch generate captions
  if (action === 'batch-generate') {
    const wins = body.wins as StudentWinData[];

    if (!wins || !Array.isArray(wins) || wins.length === 0) {
      return badRequest('wins array is required');
    }

    try {
      const captions = await generateBatchWinCaptions(wins);

      return NextResponse.json({
        success: true,
        data: captions,
        generated: captions.length,
        requested: wins.length,
      });
    } catch (error) {
      console.error('[HallOfFame] Batch generate error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate batch captions';
      return internalError(message);
    }
  }

  // Queue a win card for review
  if (action === 'queue') {
    try {
      const { studentWin, aspectRatio, themeName, customCaption } = QueueWinCardSchema.parse(body);

      // Generate caption
      const caption = customCaption
        ? {
            id: `custom-caption-${Date.now()}`,
            winType: studentWin.winType as WinType,
            studentName: studentWin.displayName,
            headline: 'Custom Win',
            instagramCaption: customCaption,
            twitterCaption: customCaption.substring(0, 280),
            hook: customCaption.split('\n')[0] || '',
            achievement: '',
            encouragement: '',
            hashtags: [],
            emojis: [],
            cta: '',
            generatedAt: new Date().toISOString(),
            voiceProfileUsed: 'custom',
          }
        : await generateWinCardCaption(studentWin as StudentWinData);

      // Get aspect ratio config
      const aspectRatioConfig = ASPECT_RATIOS.find(ar => ar.name === aspectRatio) || ASPECT_RATIOS[1];

      // Get theme config
      const themeConfig = WIN_CARD_THEMES[themeName] || WIN_CARD_THEMES.gold;

      // Queue the card
      const queuedCard = await queueWinCard(
        studentWin as StudentWinData,
        caption,
        aspectRatioConfig,
        themeConfig
      );

      return NextResponse.json({
        success: true,
        data: queuedCard,
        message: 'Win card queued for review',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequest(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }

      console.error('[HallOfFame] Queue error:', error);
      const message = error instanceof Error ? error.message : 'Failed to queue win card';
      return internalError(message);
    }
  }

  // Approve or reject a win card
  if (action === 'review') {
    try {
      const { cardId, action: reviewAction, reason } = ApproveRejectSchema.parse(body);

      let success: boolean;
      if (reviewAction === 'approve') {
        success = await approveWinCard(cardId, adminUser.userId);
      } else {
        success = await rejectWinCard(cardId, adminUser.userId, reason);
      }

      if (!success) {
        return internalError(`Failed to ${reviewAction} win card`);
      }

      return NextResponse.json({
        success: true,
        message: `Win card ${reviewAction}d successfully`,
        cardId,
        action: reviewAction,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequest(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }

      console.error('[HallOfFame] Review error:', error);
      const message = error instanceof Error ? error.message : 'Failed to review win card';
      return internalError(message);
    }
  }

  // Mark a win card as posted
  if (action === 'posted') {
    try {
      const { cardId, platforms } = MarkPostedSchema.parse(body);

      const success = await markWinCardPosted(cardId, platforms);

      if (!success) {
        return internalError('Failed to mark win card as posted');
      }

      return NextResponse.json({
        success: true,
        message: 'Win card marked as posted',
        cardId,
        platforms,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequest(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }

      console.error('[HallOfFame] Posted error:', error);
      const message = error instanceof Error ? error.message : 'Failed to mark as posted';
      return internalError(message);
    }
  }

  // Default: Generate caption (same as action=generate)
  try {
    const winData = GenerateCaptionSchema.parse(body) as StudentWinData;
    const caption = await generateWinCardCaption(winData);

    return NextResponse.json({
      success: true,
      data: caption,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }

    console.error('[HallOfFame] Generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate caption';
    return internalError(message);
  }
});
