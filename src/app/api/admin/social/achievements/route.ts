/**
 * Admin API for Learning Achievements in Social Builder
 *
 * GET: List recent learning achievements across all users (for social content generation)
 * POST: Generate social content from a specific achievement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { unauthorized, forbidden, badRequest, internalError } from '@/lib/api-errors';
import { z } from 'zod';

// ============================================
// TYPES
// ============================================

interface LearningMilestone {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  milestone_type: 'course_complete' | 'module_complete' | 'quiz_passed' | 'hours_milestone' | 'streak_milestone' | 'achievement';
  title: string;
  description: string;
  stats: {
    total_hours?: number;
    quiz_score?: number;
    streak_days?: number;
    modules_completed?: number;
    lessons_completed?: number;
  };
  earned_at: string;
  shareable: boolean;
}

// ============================================
// GET: Fetch Recent Learning Milestones
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return unauthorized();
    }
    if (!session.isAdmin) {
      return forbidden('Admin access required');
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId'); // Optional filter by user

    // Fetch recent achievements
    let query = supabaseAdmin
      .from('user_learning_achievements')
      .select(`
        id,
        user_id,
        achievement_slug,
        achievement_title,
        achievement_description,
        achievement_icon,
        earned_at,
        metadata,
        user:user_profiles!user_id(username, discord_username, avatar_url)
      `, { count: 'exact' })
      .order('earned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: achievements, error: achievementsError, count } = await query;

    if (achievementsError) {
      console.error('Error fetching achievements:', achievementsError);
      return internalError('Failed to fetch achievements');
    }

    // Also fetch recent significant learning activities (for milestones)
    const { data: recentMilestones } = await supabaseAdmin
      .from('learning_audit_logs')
      .select(`
        id,
        user_id,
        action,
        resource_type,
        resource_title,
        module_title,
        course_title,
        metadata,
        duration_seconds,
        created_at,
        user:user_profiles!user_id(username, discord_username, avatar_url)
      `)
      .in('action', ['completed', 'quiz_passed', 'certificate_earned'])
      .order('created_at', { ascending: false })
      .limit(20);

    // Transform achievements into milestones
    const milestones: LearningMilestone[] = [
      // Map achievements
      ...(achievements || []).map((a: Record<string, unknown>) => {
        const user = a.user as Record<string, unknown> | null;
        return {
          id: a.id as string,
          user_id: a.user_id as string,
          user_name: (user?.discord_username as string) || (user?.username as string) || 'Unknown',
          user_avatar: user?.avatar_url as string | undefined,
          milestone_type: 'achievement' as const,
          title: a.achievement_title as string,
          description: a.achievement_description as string || '',
          stats: (a.metadata as Record<string, unknown>) || {},
          earned_at: a.earned_at as string,
          shareable: true,
        };
      }),

      // Map significant learning events
      ...(recentMilestones || [])
        .filter((m) => m.action === 'completed' && m.resource_type === 'module')
        .map((m: Record<string, unknown>) => {
          const user = m.user as Record<string, unknown> | null;
          return {
            id: m.id as string,
            user_id: m.user_id as string,
            user_name: (user?.discord_username as string) || (user?.username as string) || 'Unknown',
            user_avatar: user?.avatar_url as string | undefined,
            milestone_type: 'module_complete' as const,
            title: `Completed ${m.module_title || 'Module'}`,
            description: `Finished all lessons in ${m.course_title || 'the course'}`,
            stats: { modules_completed: 1 },
            earned_at: m.created_at as string,
            shareable: true,
          };
        }),

      ...(recentMilestones || [])
        .filter((m) => m.action === 'quiz_passed')
        .map((m: Record<string, unknown>) => {
          const user = m.user as Record<string, unknown> | null;
          const metadata = (m.metadata || {}) as Record<string, unknown>;
          return {
            id: m.id as string,
            user_id: m.user_id as string,
            user_name: (user?.discord_username as string) || (user?.username as string) || 'Unknown',
            user_avatar: user?.avatar_url as string | undefined,
            milestone_type: 'quiz_passed' as const,
            title: `Passed ${m.module_title || 'Quiz'}`,
            description: `Scored ${metadata.score || 0}% on the assessment`,
            stats: { quiz_score: metadata.score as number },
            earned_at: m.created_at as string,
            shareable: true,
          };
        }),
    ];

    // Sort by date and remove duplicates
    const uniqueMilestones = milestones
      .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
      .slice(0, limit);

    return NextResponse.json({
      data: uniqueMilestones,
      total: count || uniqueMilestones.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in achievements API:', error);
    return internalError('Failed to fetch achievements');
  }
}

// ============================================
// POST: Generate Social Content from Achievement
// ============================================

const generateSchema = z.object({
  milestone_id: z.string().optional(),
  milestone_type: z.enum(['course_complete', 'module_complete', 'quiz_passed', 'hours_milestone', 'streak_milestone', 'achievement']),
  user_id: z.string().uuid().optional(),
  platforms: z.array(z.enum(['instagram', 'tiktok', 'youtube'])).default(['instagram', 'tiktok']),
  custom_stats: z.object({
    total_hours: z.number().optional(),
    quiz_score: z.number().optional(),
    streak_days: z.number().optional(),
    modules_completed: z.number().optional(),
    lessons_completed: z.number().optional(),
    user_name: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return unauthorized();
    }
    if (!session.isAdmin) {
      return forbidden('Admin access required');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const parseResult = generateSchema.safeParse(body);
    if (!parseResult.success) {
      return badRequest('Invalid request', parseResult.error.errors);
    }

    const { milestone_type, custom_stats, platforms } = parseResult.data;

    // Generate caption based on milestone type
    let caption = '';
    let hook = '';
    const hashtags = ['#DayTrading', '#TradingEducation', '#KCU', '#StudyGrind'];

    switch (milestone_type) {
      case 'course_complete':
        hook = 'Course Complete';
        caption = `Another KCU student just completed their trading education! ${custom_stats?.user_name || 'This trader'} finished ${custom_stats?.modules_completed || 'all'} modules and is ready to dominate the markets.`;
        hashtags.push('#CourseComplete', '#TradingMastery');
        break;

      case 'module_complete':
        hook = 'Module Mastered';
        caption = `Module down, markets up. ${custom_stats?.user_name || 'One of our students'} just mastered another piece of the LTP Framework. The grind continues.`;
        hashtags.push('#LTPFramework', '#ModuleComplete');
        break;

      case 'quiz_passed':
        hook = `${custom_stats?.quiz_score || 90}% on the Quiz`;
        caption = `Knowledge check: PASSED. ${custom_stats?.user_name || 'This trader'} just scored ${custom_stats?.quiz_score || 90}% proving they understand the material. This is what separates the serious traders from the dreamers.`;
        hashtags.push('#QuizPassed', '#TradingKnowledge');
        break;

      case 'hours_milestone':
        hook = `${custom_stats?.total_hours || 0} HOURS of Study`;
        caption = `While others scroll, ${custom_stats?.user_name || 'this trader'} studies. ${custom_stats?.total_hours || 0} hours of dedicated market education. The markets reward preparation.`;
        hashtags.push('#StudyHours', '#Dedication');
        break;

      case 'streak_milestone':
        hook = `${custom_stats?.streak_days || 7} Day Streak`;
        caption = `${custom_stats?.streak_days || 7} days of consistent learning. ${custom_stats?.user_name || 'This student'} shows up every single day. Consistency builds champions.`;
        hashtags.push('#StudyStreak', '#Consistency');
        break;

      case 'achievement':
        hook = 'Achievement Unlocked';
        caption = `Achievement unlocked at KCU! ${custom_stats?.user_name || 'A dedicated student'} just earned a new badge. Every milestone matters on the path to trading mastery.`;
        hashtags.push('#Achievement', '#TradingJourney');
        break;

      default:
        hook = 'Learning Milestone';
        caption = `Another milestone reached at KCU Trading Academy. The journey to trading mastery is built one lesson at a time.`;
    }

    caption += `\n\n${hashtags.join(' ')}`;

    // Create suggestion in database
    const { data: suggestion, error: insertError } = await supabaseAdmin
      .from('content_suggestions')
      .insert({
        platforms,
        content_type: 'feed_post',
        suggested_caption: caption,
        suggested_hook: hook,
        category: 'educational',
        inspiration_source: 'kcu_achievement',
        inspiration_data: {
          milestone_type,
          stats: custom_stats,
        },
        predicted_engagement_score: 75,
        kcu_tone_match_score: 95,
        status: 'pending',
        hashtags,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating suggestion:', insertError);
      return internalError('Failed to create content suggestion');
    }

    return NextResponse.json({
      success: true,
      suggestion,
      caption,
      hook,
      hashtags,
    });
  } catch (error) {
    console.error('Error generating content:', error);
    return internalError('Failed to generate content');
  }
}
