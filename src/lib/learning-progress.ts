/**
 * Unified Learning Progress Service
 *
 * Combines progress data from:
 * - Thinkific LMS (enrollments, lesson completions)
 * - Local KCU Coach (quizzes, lesson progress)
 * - YouTube video watches
 *
 * Provides a single API for displaying progress across the platform.
 */

import { supabaseAdmin } from '@/lib/supabase';

// ============================================
// Types
// ============================================

export interface CourseProgress {
  source: 'thinkific' | 'local';
  courseId: string;
  courseName: string;
  slug: string;
  progress: number; // 0-100
  completed: boolean;
  completedAt?: string;
  lessonsCompleted: number;
  totalLessons: number;
  quizzesPassed: number;
  totalQuizzes: number;
  lastActivityAt?: string;
  thinkificUrl?: string;
}

export interface LessonProgress {
  lessonId: string;
  lessonName: string;
  courseId: string;
  courseName: string;
  completed: boolean;
  completedAt?: string;
  watchTime?: number; // seconds
  source: 'thinkific' | 'local' | 'youtube';
}

export interface UserLearningStats {
  totalCoursesEnrolled: number;
  totalCoursesCompleted: number;
  totalLessonsCompleted: number;
  totalQuizzesPassed: number;
  totalWatchTime: number; // seconds
  currentStreak: number; // days
  longestStreak: number;
  lastActivityAt?: string;
  overallProgress: number; // 0-100 average across all courses
  xpEarned: number;
  level: number;
}

export interface LearningActivity {
  type: 'lesson_completed' | 'quiz_passed' | 'course_completed' | 'video_watched';
  title: string;
  courseName?: string;
  source: 'thinkific' | 'local' | 'youtube';
  timestamp: string;
  xpEarned?: number;
}

export interface ModuleProgress {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
  quizScore?: number;
  thinkificLinked: boolean;
  thinkificCourseId?: number;
}

// ============================================
// Progress Fetching Functions
// ============================================

/**
 * Get all course progress for a user
 */
export async function getUserCourseProgress(userId: string): Promise<CourseProgress[]> {
  const supabase = supabaseAdmin;
  const progress: CourseProgress[] = [];

  // Get Thinkific enrollments
  const { data: thinkificProgress } = await supabase
    .from('thinkific_enrollments')
    .select(`
      *,
      lesson_count:thinkific_lesson_completions(count)
    `)
    .eq('thinkific_user_id', (
      await supabase
        .from('user_profiles')
        .select('thinkific_user_id')
        .eq('id', userId)
        .single()
    ).data?.thinkific_user_id);

  if (thinkificProgress) {
    for (const enrollment of thinkificProgress) {
      progress.push({
        source: 'thinkific',
        courseId: enrollment.course_id.toString(),
        courseName: enrollment.course_name,
        slug: enrollment.course_name.toLowerCase().replace(/\s+/g, '-'),
        progress: enrollment.percentage_completed || 0,
        completed: enrollment.completed || false,
        completedAt: enrollment.completed_at,
        lessonsCompleted: enrollment.lesson_count?.[0]?.count || 0,
        totalLessons: 0, // Would need Thinkific API to get this
        quizzesPassed: 0,
        totalQuizzes: 0,
        lastActivityAt: enrollment.synced_at,
        thinkificUrl: `https://kaycapitals.thinkific.com/courses/${enrollment.course_name.toLowerCase().replace(/\s+/g, '-')}`,
      });
    }
  }

  // Get local KCU module progress
  const { data: localProgress } = await supabase
    .from('user_module_progress')
    .select(`
      *,
      lessons_completed:user_lesson_progress(count)
    `)
    .eq('user_id', userId);

  if (localProgress) {
    for (const moduleProgress of localProgress) {
      progress.push({
        source: 'local',
        courseId: moduleProgress.module_id,
        courseName: moduleProgress.module_name || moduleProgress.module_id,
        slug: moduleProgress.module_slug || moduleProgress.module_id,
        progress: moduleProgress.progress_percent || 0,
        completed: moduleProgress.completed || false,
        completedAt: moduleProgress.completed_at,
        lessonsCompleted: moduleProgress.lessons_completed?.[0]?.count || 0,
        totalLessons: moduleProgress.total_lessons || 0,
        quizzesPassed: moduleProgress.quiz_passed ? 1 : 0,
        totalQuizzes: 1,
        lastActivityAt: moduleProgress.updated_at,
      });
    }
  }

  return progress;
}

/**
 * Get user's learning statistics
 */
export async function getUserLearningStats(userId: string): Promise<UserLearningStats> {
  const supabase = supabaseAdmin;

  // Get user profile for XP and streaks
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('total_xp, streak_days, longest_streak, thinkific_user_id')
    .eq('id', userId)
    .single();

  // Get Thinkific stats
  let thinkificLessons = 0;
  let thinkificCourses = 0;
  let thinkificCompleted = 0;

  if (profile?.thinkific_user_id) {
    const { count: lessonCount } = await supabase
      .from('thinkific_lesson_completions')
      .select('*', { count: 'exact', head: true })
      .eq('thinkific_user_id', profile.thinkific_user_id);

    const { data: enrollments } = await supabase
      .from('thinkific_enrollments')
      .select('completed')
      .eq('thinkific_user_id', profile.thinkific_user_id);

    thinkificLessons = lessonCount || 0;
    thinkificCourses = enrollments?.length || 0;
    thinkificCompleted = enrollments?.filter(e => e.completed).length || 0;
  }

  // Get local progress stats
  const { count: localLessons } = await supabase
    .from('user_lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true);

  const { count: quizzesPassed } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('score', 70); // Passing score

  // Calculate level from XP
  const xp = profile?.total_xp || 0;
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;

  // Get course progress for overall calculation
  const courseProgress = await getUserCourseProgress(userId);
  const overallProgress = courseProgress.length > 0
    ? courseProgress.reduce((sum, c) => sum + c.progress, 0) / courseProgress.length
    : 0;

  return {
    totalCoursesEnrolled: thinkificCourses + courseProgress.filter(c => c.source === 'local').length,
    totalCoursesCompleted: thinkificCompleted + courseProgress.filter(c => c.source === 'local' && c.completed).length,
    totalLessonsCompleted: thinkificLessons + (localLessons || 0),
    totalQuizzesPassed: quizzesPassed || 0,
    totalWatchTime: 0, // Would need to track this
    currentStreak: profile?.streak_days || 0,
    longestStreak: profile?.longest_streak || 0,
    lastActivityAt: undefined, // Would need to query latest activity
    overallProgress: Math.round(overallProgress),
    xpEarned: xp,
    level,
  };
}

/**
 * Get recent learning activity
 */
export async function getRecentLearningActivity(
  userId: string,
  limit: number = 10
): Promise<LearningActivity[]> {
  const supabase = supabaseAdmin;
  const activities: LearningActivity[] = [];

  // Get user's Thinkific ID
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('thinkific_user_id')
    .eq('id', userId)
    .single();

  // Get Thinkific lesson completions
  if (profile?.thinkific_user_id) {
    const { data: thinkificActivity } = await supabase
      .from('thinkific_lesson_completions')
      .select('content_name, course_name, content_type, completed_at')
      .eq('thinkific_user_id', profile.thinkific_user_id)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (thinkificActivity) {
      for (const activity of thinkificActivity) {
        activities.push({
          type: activity.content_type === 'quiz' ? 'quiz_passed' : 'lesson_completed',
          title: activity.content_name,
          courseName: activity.course_name,
          source: 'thinkific',
          timestamp: activity.completed_at,
          xpEarned: activity.content_type === 'quiz' ? 100 : 25,
        });
      }
    }
  }

  // Get local lesson completions
  const { data: localActivity } = await supabase
    .from('user_lesson_progress')
    .select(`
      completed_at,
      lessons:lesson_id (
        title,
        modules:module_id (title)
      )
    `)
    .eq('user_id', userId)
    .eq('completed', true)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (localActivity) {
    for (const activity of localActivity) {
      const lesson = activity.lessons as { title?: string; modules?: { title?: string } } | null;
      activities.push({
        type: 'lesson_completed',
        title: lesson?.title || 'Lesson',
        courseName: lesson?.modules?.title,
        source: 'local',
        timestamp: activity.completed_at,
        xpEarned: 25,
      });
    }
  }

  // Sort by timestamp and limit
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get module progress with Thinkific linking
 */
export async function getModuleProgressWithThinkific(
  userId: string
): Promise<ModuleProgress[]> {
  const supabase = supabaseAdmin;

  // Get local module progress
  const { data: modules } = await supabase
    .from('learning_modules')
    .select(`
      id,
      slug,
      title,
      lessons_count,
      thinkific_course_id,
      user_progress:user_module_progress!inner(
        progress_percent,
        completed,
        quiz_score
      )
    `)
    .eq('user_module_progress.user_id', userId);

  if (!modules) return [];

  // Get Thinkific progress if linked
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('thinkific_user_id')
    .eq('id', userId)
    .single();

  const thinkificProgressMap = new Map<number, number>();
  if (profile?.thinkific_user_id) {
    const { data: thinkificEnrollments } = await supabase
      .from('thinkific_enrollments')
      .select('course_id, percentage_completed')
      .eq('thinkific_user_id', profile.thinkific_user_id);

    if (thinkificEnrollments) {
      for (const enrollment of thinkificEnrollments) {
        thinkificProgressMap.set(enrollment.course_id, enrollment.percentage_completed);
      }
    }
  }

  return modules.map(mod => {
    const userProgress = Array.isArray(mod.user_progress)
      ? mod.user_progress[0]
      : mod.user_progress;

    // Use Thinkific progress if available and higher
    const localProgress = userProgress?.progress_percent || 0;
    const thinkificProgress = mod.thinkific_course_id
      ? thinkificProgressMap.get(mod.thinkific_course_id) || 0
      : 0;

    return {
      moduleId: mod.id,
      moduleSlug: mod.slug,
      moduleName: mod.title,
      progress: Math.max(localProgress, thinkificProgress),
      lessonsCompleted: Math.round((Math.max(localProgress, thinkificProgress) / 100) * mod.lessons_count),
      totalLessons: mod.lessons_count,
      quizScore: userProgress?.quiz_score,
      thinkificLinked: !!mod.thinkific_course_id,
      thinkificCourseId: mod.thinkific_course_id,
    };
  });
}

/**
 * Sync local progress to match Thinkific
 * Called after Thinkific webhook updates
 */
export async function syncThinkificToLocal(
  userId: string,
  thinkificUserId: number
): Promise<void> {
  const supabase = supabaseAdmin;

  // Get Thinkific enrollments
  const { data: enrollments } = await supabase
    .from('thinkific_enrollments')
    .select('*')
    .eq('thinkific_user_id', thinkificUserId);

  if (!enrollments) return;

  // Get module-to-Thinkific mapping
  const { data: modules } = await supabase
    .from('learning_modules')
    .select('id, thinkific_course_id');

  if (!modules) return;

  const courseToModule = new Map<number, string>();
  for (const mod of modules) {
    if (mod.thinkific_course_id) {
      courseToModule.set(mod.thinkific_course_id, mod.id);
    }
  }

  // Update local progress to match Thinkific
  for (const enrollment of enrollments) {
    const moduleId = courseToModule.get(enrollment.course_id);
    if (!moduleId) continue;

    await supabase.from('user_module_progress').upsert({
      user_id: userId,
      module_id: moduleId,
      progress_percent: enrollment.percentage_completed,
      completed: enrollment.completed,
      completed_at: enrollment.completed_at,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,module_id',
    });
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number } {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const currentLevelXp = Math.pow(level - 1, 2) * 100;
  const nextLevelXp = Math.pow(level, 2) * 100;

  return {
    level,
    currentXp: xp - currentLevelXp,
    nextLevelXp: nextLevelXp - currentLevelXp,
  };
}

/**
 * Get XP reward for activity type
 */
export function getXpReward(activityType: LearningActivity['type']): number {
  const rewards: Record<LearningActivity['type'], number> = {
    lesson_completed: 25,
    quiz_passed: 100,
    course_completed: 500,
    video_watched: 10,
  };
  return rewards[activityType] || 0;
}
