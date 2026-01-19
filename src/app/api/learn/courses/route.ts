import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - List all published courses with user progress
export async function GET() {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch all published courses with module/lesson counts
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('courses')
      .select(`
        *,
        modules:course_modules(
          id,
          lessons:course_lessons(
            id,
            video_duration_seconds
          )
        )
      `)
      .eq('is_published', true)
      .order('sort_order');

    if (coursesError) {
      console.error('Error fetching courses:', coursesError);
      throw new Error('Failed to fetch courses');
    }

    // Get user's course progress for all courses
    const courseIds = courses.map(c => c.id);
    const progressPromises = courseIds.map(async (courseId) => {
      const { data } = await supabaseAdmin.rpc('get_course_progress', {
        p_user_id: user.id,
        p_course_id: courseId,
      });
      return { courseId, progress: data?.[0] || null };
    });

    const progressResults = await Promise.all(progressPromises);
    const progressMap = new Map(progressResults.map(p => [p.courseId, p.progress]));

    // Transform courses with progress
    const coursesWithProgress = courses.map(course => {
      const modules = course.modules || [];
      const lessons = modules.flatMap((m: { lessons: Array<{ video_duration_seconds: number | null }> }) => m.lessons || []);
      const totalDurationMinutes = Math.round(
        lessons.reduce((sum: number, l: { video_duration_seconds: number | null }) => sum + (l.video_duration_seconds || 0), 0) / 60
      );

      const progress = progressMap.get(course.id);

      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnailUrl: course.thumbnail_url,
        isPublished: course.is_published,
        isGated: course.is_gated,
        sortOrder: course.sort_order,
        complianceRequired: course.compliance_required,
        createdAt: course.created_at,
        updatedAt: course.updated_at,
        modulesCount: modules.length,
        lessonsCount: lessons.length,
        totalDurationMinutes,
        progress: progress ? {
          totalLessons: progress.total_lessons,
          completedLessons: progress.completed_lessons,
          totalModules: progress.total_modules,
          completedModules: progress.completed_modules,
          totalWatchTimeSeconds: progress.total_watch_time_seconds,
          totalQuizAttempts: progress.total_quiz_attempts,
          bestQuizScores: progress.best_quiz_scores || [],
          completionPercent: progress.completion_percent || 0,
        } : null,
      };
    });

    return NextResponse.json({ courses: coursesWithProgress });
  } catch (error) {
    console.error('Error in courses API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
