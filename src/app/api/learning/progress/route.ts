/**
 * Learning Progress API - Legacy endpoint
 *
 * GET /api/learning/progress - Redirects to v2 API shape for backward compatibility
 * POST /api/learning/progress - Forwards to v2 API
 *
 * This is a compatibility layer. UI should migrate to /api/learning/v2/progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { CURRICULUM_MODULES } from '@/data/curriculum';

/**
 * GET /api/learning/progress
 * Returns progress in v2-compatible format
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    // Fetch lesson progress from database
    const { data: lessonProgress } = await supabaseAdmin
      .from('user_lesson_progress')
      .select('lesson_id, completed')
      .eq('user_id', userId);

    // Fetch module progress from database
    const { data: moduleProgress } = await supabaseAdmin
      .from('user_module_progress')
      .select('module_id, lessons_completed, total_lessons')
      .eq('user_id', userId);

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

    // Build modules map from local curriculum
    const modulesMap: Record<string, { completed: number; total: number }> = {};

    CURRICULUM_MODULES.forEach((module) => {
      const lessonsCount = module.lessons.length;

      // Count completed lessons for this module
      let completedCount = 0;
      module.lessons.forEach((lesson) => {
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
      } else {
        modulesMap[module.id] = {
          completed: completedCount,
          total: lessonsCount,
        };
      }
    });

    // Return v2-compatible shape with 'modules' key
    return NextResponse.json({
      modules: modulesMap,
      // Keep legacy fields for any old consumers
      lessonProgress: lessonProgress || [],
      moduleProgress: moduleProgress || [],
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
  }
}

/**
 * POST /api/learning/progress
 * Update lesson progress (forwards to same logic as v2)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lessonId, moduleSlug, completed, watchTime, progressPercent } = body;

    if (!lessonId) {
      return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 });
    }

    // Resolve lesson ID if using module/lesson slug format
    let resolvedLessonId = lessonId;
    let resolvedModuleId: string | null = null;

    if (moduleSlug) {
      const module = CURRICULUM_MODULES.find((m) => m.slug === moduleSlug);
      if (module) {
        resolvedModuleId = module.id;
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

    // Update module progress if module ID is known
    if (resolvedModuleId && completed) {
      const module = CURRICULUM_MODULES.find((m) => m.id === resolvedModuleId);
      if (module) {
        const { data: moduleProgress } = await supabaseAdmin
          .from('user_lesson_progress')
          .select('lesson_id, completed')
          .eq('user_id', session.userId)
          .eq('completed', true);

        const completedInModule = (moduleProgress || []).filter((lp) =>
          module.lessons.some((l) => l.id === lp.lesson_id)
        ).length;

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

    return NextResponse.json({
      success: true,
      progress: data,
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}
