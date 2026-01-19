/**
 * User Transcript API
 *
 * GET: Retrieve structured UserTranscript object
 * POST: Log a new learning audit event
 *
 * Security: Users can only fetch their own, Admins can fetch by ?userId=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  unauthorized,
  forbidden,
  badRequest,
  internalError,
  fromZodError,
} from '@/lib/api-errors';
import type {
  UserTranscript,
  TranscriptSummary,
  LearningHistoryItem,
  ModuleTimeBreakdown,
  LearningAuditLogInput,
  AuditAction,
  AuditResourceType,
} from '@/types/learning';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format seconds to human-readable time (e.g., "42h 15m")
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Convert score to letter grade
 */
function scoreToGrade(score: number): TranscriptSummary['averageQuizGrade'] {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Format date for display
 */
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Map resource type to activity type
 */
function resourceTypeToActivityType(
  resourceType: AuditResourceType,
  action: AuditAction
): LearningHistoryItem['activityType'] {
  if (action === 'quiz_attempt' || action === 'quiz_passed' || action === 'quiz_failed') {
    return 'Quiz';
  }
  if (action.startsWith('video_')) {
    return 'Video';
  }
  switch (resourceType) {
    case 'lesson':
      return 'Lesson';
    case 'quiz':
      return 'Quiz';
    case 'module':
      return 'Module';
    case 'course':
      return 'Course';
    case 'practice':
      return 'Practice';
    case 'video':
      return 'Video';
    default:
      return 'Lesson';
  }
}

/**
 * Format result based on action type
 */
function formatResult(
  action: AuditAction,
  metadata: Record<string, unknown>
): { result: string | null; resultType?: LearningHistoryItem['resultType'] } {
  if (action === 'quiz_attempt' || action === 'quiz_passed' || action === 'quiz_failed') {
    const score = metadata.score as number;
    if (score !== undefined) {
      return { result: `${Math.round(score)}%`, resultType: 'score' };
    }
  }
  if (action === 'completed') {
    return { result: 'Completed', resultType: 'completion' };
  }
  if (action === 'video_segment_watched') {
    const duration = (metadata.end_time as number) - (metadata.start_time as number);
    if (duration > 0) {
      return { result: formatDuration(duration), resultType: 'time' };
    }
  }
  return { result: null };
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
  filter: z.enum(['all', 'quizzes', 'videos']).default('all'),
});

const auditLogSchema = z.object({
  resource_id: z.string().uuid().optional(),
  resource_type: z.enum(['lesson', 'quiz', 'module', 'course', 'video', 'practice']),
  action: z.enum([
    'started',
    'completed',
    'quiz_attempt',
    'quiz_passed',
    'quiz_failed',
    'video_segment_watched',
    'video_paused',
    'video_resumed',
    'video_seeked',
    'video_speed_changed',
    'module_unlocked',
    'certificate_earned',
    'bookmark_created',
    'note_added',
  ]),
  duration_seconds: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
  resource_title: z.string().optional(),
  module_id: z.string().uuid().optional(),
  module_title: z.string().optional(),
  course_id: z.string().uuid().optional(),
  course_title: z.string().optional(),
  session_id: z.string().uuid().optional(),
});

// ============================================
// GET: Fetch User Transcript
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return unauthorized();
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse(Object.fromEntries(searchParams.entries()));

    if (!queryResult.success) {
      return fromZodError(queryResult.error);
    }

    const { userId: requestedUserId, limit, offset, filter } = queryResult.data;

    // Determine target user
    let targetUserId = session.userId;
    if (requestedUserId) {
      // Only admins can view other users' transcripts
      if (!session.isAdmin && requestedUserId !== session.userId) {
        return forbidden('You can only view your own transcript');
      }
      targetUserId = requestedUserId;
    }

    // Fetch user profile for name and member since date
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('username, discord_username, created_at')
      .eq('id', targetUserId)
      .single();

    if (userError || !userProfile) {
      return internalError('Failed to fetch user profile');
    }

    // Fetch transcript summary using RPC function
    const { data: summaryData, error: summaryError } = await supabaseAdmin.rpc(
      'get_user_transcript_summary',
      { p_user_id: targetUserId }
    );

    let summary: TranscriptSummary;
    if (summaryError || !summaryData || summaryData.length === 0) {
      // No data yet - return empty summary
      summary = {
        totalTime: 0,
        totalTimeFormatted: '0m',
        lessonsCompleted: 0,
        averageQuizScore: 0,
        averageQuizGrade: 'F',
        consistencyScore: 0,
        globalRank: 100,
        modulesCompleted: 0,
        quizzesPassed: 0,
        contentCoverage: 0,
        firstActivityAt: null,
        lastActivityAt: null,
        memberSince: userProfile.created_at,
      };
    } else {
      const s = summaryData[0];
      const totalTime = s.total_time || 0;

      // Calculate content coverage (lessons completed / total available lessons)
      const { count: totalLessonsCount } = await supabaseAdmin
        .from('course_lessons')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true);

      const totalLessons = totalLessonsCount || 1;
      const contentCoverage = Math.min(100, Math.round((s.lessons_completed / totalLessons) * 100));

      summary = {
        totalTime,
        totalTimeFormatted: formatDuration(totalTime),
        lessonsCompleted: s.lessons_completed || 0,
        averageQuizScore: Math.round(s.average_quiz_score || 0),
        averageQuizGrade: scoreToGrade(s.average_quiz_score || 0),
        consistencyScore: s.consistency_score || 0,
        globalRank: s.global_rank || 100,
        modulesCompleted: s.modules_completed || 0,
        quizzesPassed: s.quizzes_passed || 0,
        contentCoverage,
        firstActivityAt: s.first_activity_at,
        lastActivityAt: s.last_activity_at,
        memberSince: userProfile.created_at,
      };
    }

    // Fetch history with filter
    let historyQuery = supabaseAdmin
      .from('learning_audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter === 'quizzes') {
      historyQuery = historyQuery.in('action', ['quiz_attempt', 'quiz_passed', 'quiz_failed']);
    } else if (filter === 'videos') {
      historyQuery = historyQuery.like('action', 'video_%');
    }

    const { data: historyData, error: historyError, count: historyCount } = await historyQuery;

    const history: LearningHistoryItem[] = (historyData || []).map((log) => {
      const { result, resultType } = formatResult(log.action, log.metadata || {});
      return {
        id: log.id,
        date: log.created_at,
        dateFormatted: formatDate(log.created_at),
        module: log.module_title || 'General',
        activityType: resourceTypeToActivityType(log.resource_type, log.action),
        activityTitle: log.resource_title || log.action.replace(/_/g, ' '),
        timeSpent: log.duration_seconds || 0,
        timeSpentFormatted: formatDuration(log.duration_seconds || 0),
        result,
        resultType,
        action: log.action,
      };
    });

    // Fetch module breakdown using RPC function
    const { data: modulesData } = await supabaseAdmin.rpc('get_user_module_time_breakdown', {
      p_user_id: targetUserId,
    });

    const totalModuleTime = (modulesData || []).reduce(
      (acc: number, m: { total_seconds: number }) => acc + m.total_seconds,
      0
    );

    const modules: ModuleTimeBreakdown[] = (modulesData || []).map(
      (m: {
        module_id: string;
        module_title: string;
        total_seconds: number;
        lesson_count: number;
        quiz_count: number;
      }) => ({
        moduleId: m.module_id,
        moduleTitle: m.module_title,
        totalSeconds: m.total_seconds,
        totalFormatted: formatDuration(m.total_seconds),
        lessonCount: m.lesson_count,
        quizCount: m.quiz_count,
        percentageOfTotal: totalModuleTime > 0 ? Math.round((m.total_seconds / totalModuleTime) * 100) : 0,
      })
    );

    const transcript: UserTranscript = {
      userId: targetUserId,
      userName: userProfile.discord_username || userProfile.username,
      summary,
      history,
      modules,
    };

    return NextResponse.json({
      data: transcript,
      pagination: {
        limit,
        offset,
        total: historyCount || 0,
        hasMore: (historyCount || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return internalError('Failed to fetch transcript');
  }
}

// ============================================
// POST: Log a Learning Audit Event
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return unauthorized();
    }

    // Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const parseResult = auditLogSchema.safeParse(body);
    if (!parseResult.success) {
      return fromZodError(parseResult.error);
    }

    const input: LearningAuditLogInput = parseResult.data;

    // Extract client info from request
    const userAgent = request.headers.get('user-agent') || '';
    const clientInfo = {
      user_agent: userAgent,
      browser: extractBrowser(userAgent),
      device_type: extractDeviceType(userAgent),
    };

    // Insert audit log
    const { data, error } = await supabaseAdmin
      .from('learning_audit_logs')
      .insert({
        user_id: session.userId,
        resource_id: input.resource_id,
        resource_type: input.resource_type,
        action: input.action,
        duration_seconds: input.duration_seconds || 0,
        metadata: input.metadata || {},
        resource_title: input.resource_title,
        module_id: input.module_id,
        module_title: input.module_title,
        course_id: input.course_id,
        course_title: input.course_title,
        session_id: input.session_id,
        client_info: clientInfo,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Error inserting audit log:', error);
      return internalError('Failed to log learning event');
    }

    // Check for achievement triggers
    await checkAchievements(session.userId, input);

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        created_at: data.created_at,
      },
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
    return internalError('Failed to log learning event');
  }
}

// ============================================
// HELPER FUNCTIONS FOR POST
// ============================================

function extractBrowser(userAgent: string): string {
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

function extractDeviceType(userAgent: string): 'desktop' | 'tablet' | 'mobile' {
  if (/Mobi|Android/i.test(userAgent)) return 'mobile';
  if (/Tablet|iPad/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

/**
 * Check and award achievements based on the logged action
 */
async function checkAchievements(userId: string, input: LearningAuditLogInput) {
  try {
    const achievements: Array<{
      slug: string;
      title: string;
      description: string;
      icon: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // Check for first quiz ace (100% on first attempt)
    if (
      input.action === 'quiz_passed' &&
      input.metadata?.score === 100 &&
      input.metadata?.attempt_number === 1
    ) {
      achievements.push({
        slug: 'first-quiz-ace',
        title: 'First Quiz Ace',
        description: 'Scored 100% on your first attempt',
        icon: '🎯',
      });
    }

    // Check for video marathon (watched 4+ hours in a day)
    if (input.action === 'video_segment_watched') {
      const { data: todayWatchTime } = await supabaseAdmin.rpc('get_user_total_study_time', {
        p_user_id: userId,
      });
      if (todayWatchTime && todayWatchTime >= 4 * 3600) {
        achievements.push({
          slug: 'video-marathon',
          title: 'Video Marathon',
          description: 'Watched 4+ hours of content in a single day',
          icon: '🎬',
        });
      }
    }

    // Check for consistency score
    const { data: consistencyScore } = await supabaseAdmin.rpc('get_user_consistency_score', {
      p_user_id: userId,
    });
    if (consistencyScore && consistencyScore >= 90) {
      achievements.push({
        slug: 'consistency-king',
        title: 'Consistency King',
        description: 'Maintained 90%+ consistency score',
        icon: '👑',
      });
    }

    // Award achievements (using ON CONFLICT to avoid duplicates)
    for (const achievement of achievements) {
      await supabaseAdmin
        .from('user_learning_achievements')
        .upsert(
          {
            user_id: userId,
            achievement_slug: achievement.slug,
            achievement_title: achievement.title,
            achievement_description: achievement.description,
            achievement_icon: achievement.icon,
            metadata: achievement.metadata || {},
          },
          { onConflict: 'user_id,achievement_slug', ignoreDuplicates: true }
        );
    }
  } catch (error) {
    // Don't fail the main request if achievement check fails
    console.error('Error checking achievements:', error);
  }
}
