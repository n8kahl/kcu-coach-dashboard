/**
 * Consolidated Learning Progress API
 *
 * GET /api/learning/v2/progress - Get user's progress overview
 * POST /api/learning/v2/progress - Update lesson progress
 *
 * Returns progress in the format expected by the UI:
 * { modules: { [moduleId]: { completed, total } }, ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { CURRICULUM_MODULES } from '@/data/curriculum';
import {
  ProgressOverviewSchema,
  UpdateLessonProgressSchema,
  type ProgressOverview,
} from '@/lib/validations/learning';

/**
 * GET /api/learning/v2/progress
 * Returns consolidated progress overview for the authenticated user
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    // Fetch lesson progress from database
    const { data: lessonProgress, error: lessonError } = await supabaseAdmin
      .from('user_lesson_progress')
      .select('lesson_id, completed, completed_at, last_watched_at')
      .eq('user_id', userId);

    if (lessonError) {
      console.error('Error fetching lesson progress:', lessonError);
    }

    // Fetch module progress from database
    const { data: moduleProgress, error: moduleError } = await supabaseAdmin
      .from('user_module_progress')
      .select('module_id, lessons_completed, total_lessons, progress_percent, quiz_best_score, completed_at')
      .eq('user_id', userId);

    if (moduleError) {
      console.error('Error fetching module progress:', moduleError);
    }

    // Fetch streak data
    const { data: streakData } = await supabaseAdmin
      .from('user_learning_streaks')
      .select('current_streak, longest_streak, streak_start_date')
      .eq('user_id', userId)
      .single();

    // Build progress map from database data
    const dbModuleProgressMap: Record<string, { completed: number; total: number }> = {};
    (moduleProgress || []).forEach((mp) => {
      dbModuleProgressMap[mp.module_id] = {
        completed: mp.lessons_completed || 0,
        total: mp.total_lessons || 0,
      };
    });

    // Build set of completed lesson IDs
    const completedLessonIds = new Set(
      (lessonProgress || [])
        .filter((lp) => lp.completed)
        .map((lp) => lp.lesson_id)
    );

    // Merge with local curriculum to ensure all modules are represented
    const modulesMap: Record<string, { completed: number; total: number }> = {};
    let totalCompleted = 0;
    let totalLessons = 0;

    CURRICULUM_MODULES.forEach((module) => {
      const lessonsCount = module.lessons.length;

      // Count completed lessons for this module (by lesson ID or slug)
      let completedCount = 0;
      module.lessons.forEach((lesson) => {
        // Check if lesson is completed by ID or by constructing ID from slug
        if (
          completedLessonIds.has(lesson.id) ||
          completedLessonIds.has(`${module.slug}/${lesson.slug}`)
        ) {
          completedCount++;
        }
      });

      // Use database progress if available, otherwise use calculated
      const dbProgress = dbModuleProgressMap[module.id];
      if (dbProgress && dbProgress.total > 0) {
        modulesMap[module.id] = dbProgress;
        totalCompleted += dbProgress.completed;
        totalLessons += dbProgress.total;
      } else {
        modulesMap[module.id] = {
          completed: completedCount,
          total: lessonsCount,
        };
        totalCompleted += completedCount;
        totalLessons += lessonsCount;
      }
    });

    // Find resume lesson (first incomplete lesson in first incomplete module)
    let resumeLesson: ProgressOverview['resumeLesson'] = null;
    for (const module of CURRICULUM_MODULES) {
      const progress = modulesMap[module.id];
      if (progress && progress.completed < progress.total) {
        // Find first incomplete lesson in this module
        for (const lesson of module.lessons) {
          const isCompleted =
            completedLessonIds.has(lesson.id) ||
            completedLessonIds.has(`${module.slug}/${lesson.slug}`);
          if (!isCompleted) {
            resumeLesson = {
              moduleSlug: module.slug,
              lessonSlug: lesson.slug,
              lessonTitle: lesson.title,
              moduleTitle: module.title,
            };
            break;
          }
        }
        if (resumeLesson) break;
      }
    }

    // Find last watched lesson for resume
    const lastWatched = (lessonProgress || [])
      .filter((lp) => lp.last_watched_at)
      .sort((a, b) =>
        new Date(b.last_watched_at!).getTime() - new Date(a.last_watched_at!).getTime()
      )[0];

    if (lastWatched && !resumeLesson) {
      // Try to find the lesson in curriculum
      for (const module of CURRICULUM_MODULES) {
        const lesson = module.lessons.find(
          (l) => l.id === lastWatched.lesson_id ||
                 `${module.slug}/${l.slug}` === lastWatched.lesson_id
        );
        if (lesson) {
          resumeLesson = {
            moduleSlug: module.slug,
            lessonSlug: lesson.slug,
            lessonTitle: lesson.title,
            moduleTitle: module.title,
          };
          break;
        }
      }
    }

    const progressPercent = totalLessons > 0
      ? Math.round((totalCompleted / totalLessons) * 100)
      : 0;

    const response: ProgressOverview = {
      overall: {
        completedLessons: totalCompleted,
        totalLessons,
        progressPercent,
      },
      streak: {
        current: streakData?.current_streak || 0,
        longest: streakData?.longest_streak || 0,
        lastActiveDate: streakData?.streak_start_date || null,
      },
      modules: modulesMap,
      resumeLesson,
    };

    // Validate response shape
    const validated = ProgressOverviewSchema.safeParse(response);
    if (!validated.success) {
      console.error('Progress response validation failed:', validated.error);
      // Return response anyway, validation is for development
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
  }
}

/**
 * POST /api/learning/v2/progress
 * Update lesson progress (mark complete, update watch time)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const parsed = UpdateLessonProgressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { lessonId, moduleSlug, completed, watchTime, progressPercent } = parsed.data;

    // Resolve lesson ID if using module/lesson slug format
    let resolvedLessonId = lessonId;
    let resolvedModuleId: string | null = null;

    if (moduleSlug) {
      const module = CURRICULUM_MODULES.find((m) => m.slug === moduleSlug);
      if (module) {
        resolvedModuleId = module.id;
        // Check if lessonId is actually a slug
        const lesson = module.lessons.find((l) => l.slug === lessonId || l.id === lessonId);
        if (lesson) {
          resolvedLessonId = lesson.id;
        }
      }
    }

    // Upsert lesson progress
    const updateData: Record<string, unknown> = {
      user_id: session.userId,
      lesson_id: resolvedLessonId,
      last_watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (completed !== undefined) {
      updateData.completed = completed;
      if (completed) {
        updateData.completed_at = new Date().toISOString();
      }
    }

    if (watchTime !== undefined) {
      updateData.watch_time = watchTime;
    }

    if (progressPercent !== undefined) {
      updateData.progress_percent = progressPercent;
    }

    const { data, error } = await supabaseAdmin
      .from('user_lesson_progress')
      .upsert(updateData, { onConflict: 'user_id,lesson_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating lesson progress:', error);
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }

    // If module ID is known and lesson was completed, update module progress
    if (resolvedModuleId && completed) {
      const module = CURRICULUM_MODULES.find((m) => m.id === resolvedModuleId);
      if (module) {
        // Count completed lessons for this module
        const { data: moduleProgress } = await supabaseAdmin
          .from('user_lesson_progress')
          .select('lesson_id, completed')
          .eq('user_id', session.userId)
          .eq('completed', true);

        const completedInModule = (moduleProgress || []).filter((lp) =>
          module.lessons.some((l) => l.id === lp.lesson_id)
        ).length;

        // Update module progress
        await supabaseAdmin
          .from('user_module_progress')
          .upsert(
            {
              user_id: session.userId,
              module_id: resolvedModuleId,
              lessons_completed: completedInModule,
              total_lessons: module.lessons.length,
              progress_percent: Math.round((completedInModule / module.lessons.length) * 100),
              completed_at: completedInModule === module.lessons.length ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,module_id' }
          );
      }
    }

    // Update learning streak
    await updateLearningStreak(session.userId);

    return NextResponse.json({
      success: true,
      progress: {
        lessonId: resolvedLessonId,
        completed: data.completed,
        watchTime: data.watch_time,
        progressPercent: data.progress_percent,
      },
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}

/**
 * Update user's learning streak based on activity
 */
async function updateLearningStreak(userId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get existing streak data
    const { data: existing } = await supabaseAdmin
      .from('user_learning_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!existing) {
      // Create new streak record
      await supabaseAdmin.from('user_learning_streaks').insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        streak_start_date: today,
        last_activity_date: today,
      });
      return;
    }

    const lastActivity = existing.last_activity_date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = existing.current_streak;

    if (lastActivity === today) {
      // Already logged activity today, no change
      return;
    } else if (lastActivity === yesterdayStr) {
      // Continue streak
      newStreak = existing.current_streak + 1;
    } else {
      // Streak broken, start new
      newStreak = 1;
    }

    await supabaseAdmin
      .from('user_learning_streaks')
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, existing.longest_streak),
        streak_start_date: newStreak === 1 ? today : existing.streak_start_date,
        last_activity_date: today,
      })
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error updating learning streak:', error);
    // Don't throw - streak update is non-critical
  }
}
