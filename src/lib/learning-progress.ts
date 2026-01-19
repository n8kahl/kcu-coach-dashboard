/**
 * Unified Learning Progress Service
 *
 * Provides progress tracking using the native course_* schema:
 * - course_modules
 * - course_lessons
 * - course_lesson_progress
 * - lesson_watch_sessions
 * - course_quiz_attempts
 *
 * NOTE: The legacy Thinkific integration has been removed as part of
 * migration 030_unify_content_system.sql. All content now uses the
 * native Supabase + Cloudflare schema.
 */

import { supabaseAdmin } from '@/lib/supabase';

// ============================================
// Types
// ============================================

export interface CourseProgress {
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
  totalWatchTimeSeconds: number;
}

export interface LessonProgress {
  lessonId: string;
  lessonName: string;
  moduleId: string;
  moduleName: string;
  completed: boolean;
  completedAt?: string;
  progressSeconds: number;
  progressPercent: number;
  totalWatchTimeSeconds: number;
}

export interface UserLearningStats {
  totalCoursesEnrolled: number;
  totalCoursesCompleted: number;
  totalLessonsCompleted: number;
  totalQuizzesPassed: number;
  totalWatchTimeSeconds: number;
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
  moduleName?: string;
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
  quizPassed: boolean;
}

// ============================================
// Progress Fetching Functions
// ============================================

/**
 * Get all course progress for a user
 */
export async function getUserCourseProgress(userId: string): Promise<CourseProgress[]> {
  const supabase = supabaseAdmin;

  // Get all courses
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      slug,
      course_modules (
        id,
        course_lessons (id)
      )
    `)
    .eq('is_published', true);

  if (!courses) return [];

  // Get user's lesson progress
  const { data: lessonProgress } = await supabase
    .from('course_lesson_progress')
    .select(`
      lesson_id,
      completed,
      completed_at,
      total_watch_time_seconds,
      last_watched_at
    `)
    .eq('user_id', userId);

  const progressMap = new Map<string, {
    completed: boolean;
    completedAt?: string;
    watchTime: number;
    lastWatched?: string;
  }>();
  lessonProgress?.forEach(p => {
    progressMap.set(p.lesson_id, {
      completed: p.completed,
      completedAt: p.completed_at,
      watchTime: p.total_watch_time_seconds || 0,
      lastWatched: p.last_watched_at,
    });
  });

  // Get quiz attempts
  const { data: quizAttempts } = await supabase
    .from('course_quiz_attempts')
    .select('module_id, passed')
    .eq('user_id', userId);

  const quizPassedMap = new Map<string, boolean>();
  quizAttempts?.forEach(q => {
    if (q.passed) quizPassedMap.set(q.module_id, true);
  });

  return courses.map(course => {
    const modules = course.course_modules || [];
    let totalLessons = 0;
    let completedLessons = 0;
    let totalWatchTime = 0;
    let lastActivity: string | undefined;
    let quizzesPassed = 0;

    modules.forEach(mod => {
      const lessons = mod.course_lessons || [];
      totalLessons += lessons.length;

      lessons.forEach(lesson => {
        const progress = progressMap.get(lesson.id);
        if (progress) {
          if (progress.completed) completedLessons++;
          totalWatchTime += progress.watchTime;
          if (progress.lastWatched && (!lastActivity || progress.lastWatched > lastActivity)) {
            lastActivity = progress.lastWatched;
          }
        }
      });

      if (quizPassedMap.get(mod.id)) quizzesPassed++;
    });

    const progressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    return {
      courseId: course.id,
      courseName: course.title,
      slug: course.slug,
      progress: progressPercent,
      completed: totalLessons > 0 && completedLessons === totalLessons,
      lessonsCompleted: completedLessons,
      totalLessons,
      quizzesPassed,
      totalQuizzes: modules.length, // Assuming one quiz per module
      lastActivityAt: lastActivity,
      totalWatchTimeSeconds: totalWatchTime,
    };
  });
}

/**
 * Get user's learning statistics
 */
export async function getUserLearningStats(userId: string): Promise<UserLearningStats> {
  const supabase = supabaseAdmin;

  // Get user profile for XP and streaks
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('total_xp, streak_days, longest_streak')
    .eq('id', userId)
    .single();

  // Get lesson completion stats
  const { count: lessonsCompleted } = await supabase
    .from('course_lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true);

  // Get total watch time
  const { data: watchTimeData } = await supabase
    .from('course_lesson_progress')
    .select('total_watch_time_seconds')
    .eq('user_id', userId);

  const totalWatchTime = watchTimeData?.reduce(
    (sum, p) => sum + (p.total_watch_time_seconds || 0),
    0
  ) || 0;

  // Get quiz stats
  const { count: quizzesPassed } = await supabase
    .from('course_quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('passed', true);

  // Get last activity
  const { data: lastProgress } = await supabase
    .from('course_lesson_progress')
    .select('last_watched_at')
    .eq('user_id', userId)
    .order('last_watched_at', { ascending: false })
    .limit(1)
    .single();

  // Calculate level from XP
  const xp = profile?.total_xp || 0;
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;

  // Get course progress for overall calculation
  const courseProgress = await getUserCourseProgress(userId);
  const overallProgress = courseProgress.length > 0
    ? Math.round(courseProgress.reduce((sum, c) => sum + c.progress, 0) / courseProgress.length)
    : 0;

  const completedCourses = courseProgress.filter(c => c.completed).length;

  return {
    totalCoursesEnrolled: courseProgress.length,
    totalCoursesCompleted: completedCourses,
    totalLessonsCompleted: lessonsCompleted || 0,
    totalQuizzesPassed: quizzesPassed || 0,
    totalWatchTimeSeconds: totalWatchTime,
    currentStreak: profile?.streak_days || 0,
    longestStreak: profile?.longest_streak || 0,
    lastActivityAt: lastProgress?.last_watched_at,
    overallProgress,
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

  // Get lesson completions with lesson and module info
  const { data: lessonActivity } = await supabase
    .from('course_lesson_progress')
    .select(`
      completed_at,
      course_lessons!inner (
        title,
        course_modules!inner (
          title
        )
      )
    `)
    .eq('user_id', userId)
    .eq('completed', true)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (lessonActivity) {
    for (const activity of lessonActivity) {
      // Supabase joins return complex nested types
      const lessonData = activity.course_lessons as unknown as {
        title: string;
        course_modules: { title: string };
      };
      if (lessonData) {
        activities.push({
          type: 'lesson_completed',
          title: lessonData.title,
          moduleName: lessonData.course_modules?.title,
          timestamp: activity.completed_at,
          xpEarned: 25,
        });
      }
    }
  }

  // Get quiz completions
  const { data: quizActivity } = await supabase
    .from('course_quiz_attempts')
    .select(`
      completed_at,
      passed,
      course_modules!inner (
        title
      )
    `)
    .eq('user_id', userId)
    .eq('passed', true)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (quizActivity) {
    for (const activity of quizActivity) {
      const modData = activity.course_modules as unknown as { title: string };
      if (modData) {
        activities.push({
          type: 'quiz_passed',
          title: `${modData.title} Quiz`,
          moduleName: modData.title,
          timestamp: activity.completed_at,
          xpEarned: 100,
        });
      }
    }
  }

  // Sort by timestamp and limit
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get module progress for a user
 */
export async function getModuleProgress(userId: string): Promise<ModuleProgress[]> {
  const supabase = supabaseAdmin;

  // Get all modules with their lessons
  const { data: modules } = await supabase
    .from('course_modules')
    .select(`
      id,
      slug,
      title,
      course_lessons (id)
    `)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (!modules) return [];

  // Get user's lesson progress
  const { data: lessonProgress } = await supabase
    .from('course_lesson_progress')
    .select('lesson_id, completed')
    .eq('user_id', userId);

  const completedLessons = new Set(
    lessonProgress?.filter(p => p.completed).map(p => p.lesson_id) || []
  );

  // Get quiz scores
  const { data: quizAttempts } = await supabase
    .from('course_quiz_attempts')
    .select('module_id, score_percent, passed')
    .eq('user_id', userId)
    .order('score_percent', { ascending: false });

  const bestQuizScores = new Map<string, { score: number; passed: boolean }>();
  quizAttempts?.forEach(q => {
    if (!bestQuizScores.has(q.module_id)) {
      bestQuizScores.set(q.module_id, { score: q.score_percent, passed: q.passed });
    }
  });

  return modules.map(mod => {
    const lessons = mod.course_lessons || [];
    const completed = lessons.filter(l => completedLessons.has(l.id)).length;
    const quizInfo = bestQuizScores.get(mod.id);

    return {
      moduleId: mod.id,
      moduleSlug: mod.slug,
      moduleName: mod.title,
      progress: lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0,
      lessonsCompleted: completed,
      totalLessons: lessons.length,
      quizScore: quizInfo?.score,
      quizPassed: quizInfo?.passed || false,
    };
  });
}

/**
 * Get a single lesson's progress for a user
 */
export async function getLessonProgress(
  userId: string,
  lessonId: string
): Promise<LessonProgress | null> {
  const supabase = supabaseAdmin;

  const { data } = await supabase
    .from('course_lesson_progress')
    .select(`
      lesson_id,
      progress_seconds,
      progress_percent,
      completed,
      completed_at,
      total_watch_time_seconds,
      course_lessons!inner (
        title,
        course_modules!inner (
          id,
          title
        )
      )
    `)
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .single();

  if (!data) return null;

  const lessonData = data.course_lessons as unknown as {
    title: string;
    course_modules: { id: string; title: string };
  };

  return {
    lessonId: data.lesson_id,
    lessonName: lessonData.title,
    moduleId: lessonData.course_modules.id,
    moduleName: lessonData.course_modules.title,
    completed: data.completed,
    completedAt: data.completed_at,
    progressSeconds: data.progress_seconds,
    progressPercent: data.progress_percent,
    totalWatchTimeSeconds: data.total_watch_time_seconds || 0,
  };
}

/**
 * Update lesson progress
 */
export async function updateLessonProgress(
  userId: string,
  lessonId: string,
  progressSeconds: number,
  totalDurationSeconds: number,
  watchedSeconds: number
): Promise<boolean> {
  const supabase = supabaseAdmin;

  const progressPercent = totalDurationSeconds > 0
    ? Math.round((progressSeconds / totalDurationSeconds) * 100)
    : 0;

  const completed = progressPercent >= 80; // 80% threshold for completion

  const { error } = await supabase
    .from('course_lesson_progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      progress_seconds: progressSeconds,
      progress_percent: progressPercent,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      total_watch_time_seconds: watchedSeconds,
      last_watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,lesson_id',
    });

  return !error;
}

/**
 * Mark a lesson as completed
 */
export async function markLessonCompleted(
  userId: string,
  lessonId: string
): Promise<boolean> {
  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from('course_lesson_progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
      progress_percent: 100,
      last_watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,lesson_id',
    });

  return !error;
}

/**
 * Check if there is native course content
 */
export async function hasNativeContent(): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('course_modules')
    .select('*', { count: 'exact', head: true });

  return (count || 0) > 0;
}

/**
 * Get content summary (for admin dashboard)
 */
export async function getContentSummary(): Promise<{
  courses: number;
  modules: number;
  lessons: number;
}> {
  const [coursesResult, modulesResult, lessonsResult] = await Promise.all([
    supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('course_modules').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('course_lessons').select('*', { count: 'exact', head: true }),
  ]);

  return {
    courses: coursesResult.count || 0,
    modules: modulesResult.count || 0,
    lessons: lessonsResult.count || 0,
  };
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
