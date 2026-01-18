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

// ============================================
// Thinkific Content Functions (from synced data)
// ============================================

export interface ThinkificCourseDisplay {
  id: string;
  thinkific_id: number;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  lesson_count: number;
  chapter_count: number;
  duration: string | null;
}

export interface ThinkificChapterDisplay {
  id: string;
  thinkific_id: number;
  name: string;
  description: string | null;
  position: number;
  contents: ThinkificContentDisplay[];
}

export interface ThinkificContentDisplay {
  id: string;
  thinkific_id: number;
  name: string;
  content_type: string;
  position: number;
  video_duration: number | null;
  video_provider: string | null;
  free_preview: boolean;
  description: string | null;
}

/**
 * Get all Thinkific courses for the Learning page
 * Uses the synced thinkific_courses table
 */
export async function getThinkificCourses(): Promise<ThinkificCourseDisplay[]> {
  const { data: courses, error } = await supabaseAdmin
    .from('thinkific_courses')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching Thinkific courses:', error);
    return [];
  }

  return courses.map((course) => ({
    id: course.id,
    thinkific_id: course.thinkific_id,
    slug: course.slug || `course-${course.thinkific_id}`,
    title: course.name,
    description: course.description || '',
    image_url: course.course_card_image_url || course.banner_image_url,
    lesson_count: course.content_count || 0,
    chapter_count: course.chapter_count || 0,
    duration: course.duration,
  }));
}

/**
 * Get a single course with its chapters and contents
 */
export async function getThinkificCourseWithContents(
  courseIdOrSlug: string | number
): Promise<{
  course: ThinkificCourseDisplay;
  chapters: ThinkificChapterDisplay[];
} | null> {
  // Try to find course by slug first, then by thinkific_id
  let course;
  if (typeof courseIdOrSlug === 'string' && isNaN(Number(courseIdOrSlug))) {
    const { data } = await supabaseAdmin
      .from('thinkific_courses')
      .select('*')
      .eq('slug', courseIdOrSlug)
      .single();
    course = data;
  } else {
    const { data } = await supabaseAdmin
      .from('thinkific_courses')
      .select('*')
      .eq('thinkific_id', Number(courseIdOrSlug))
      .single();
    course = data;
  }

  if (!course) return null;

  // Get chapters
  const { data: chapters } = await supabaseAdmin
    .from('thinkific_chapters')
    .select('*')
    .eq('course_id', course.thinkific_id)
    .order('position', { ascending: true });

  // Get contents
  const { data: contents } = await supabaseAdmin
    .from('thinkific_contents')
    .select('*')
    .eq('course_id', course.thinkific_id)
    .order('position', { ascending: true });

  // Group contents by chapter
  const contentsByChapter = (contents || []).reduce(
    (acc, content) => {
      const chapterId = content.chapter_id;
      if (!acc[chapterId]) acc[chapterId] = [];
      acc[chapterId].push({
        id: content.id,
        thinkific_id: content.thinkific_id,
        name: content.name,
        content_type: content.content_type,
        position: content.position,
        video_duration: content.video_duration,
        video_provider: content.video_provider,
        free_preview: content.free_preview,
        description: content.description,
      });
      return acc;
    },
    {} as Record<number, ThinkificContentDisplay[]>
  );

  return {
    course: {
      id: course.id,
      thinkific_id: course.thinkific_id,
      slug: course.slug || `course-${course.thinkific_id}`,
      title: course.name,
      description: course.description || '',
      image_url: course.course_card_image_url || course.banner_image_url,
      lesson_count: course.content_count || 0,
      chapter_count: course.chapter_count || 0,
      duration: course.duration,
    },
    chapters: (chapters || []).map((chapter) => ({
      id: chapter.id,
      thinkific_id: chapter.thinkific_id,
      name: chapter.name,
      description: chapter.description,
      position: chapter.position,
      contents: contentsByChapter[chapter.thinkific_id] || [],
    })),
  };
}

/**
 * Get user's progress for a Thinkific course
 */
export async function getUserThinkificCourseProgress(
  userId: string,
  courseId: number
): Promise<{
  total_contents: number;
  completed_contents: number;
  percentage: number;
  completed_content_ids: number[];
}> {
  // Count total contents in course
  const { count: totalContents } = await supabaseAdmin
    .from('thinkific_contents')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);

  // Count completed contents for user
  const { data: completed } = await supabaseAdmin
    .from('thinkific_user_progress')
    .select('content_id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('completed', true);

  const completedCount = completed?.length || 0;
  const total = totalContents || 0;

  return {
    total_contents: total,
    completed_contents: completedCount,
    percentage: total > 0 ? Math.round((completedCount / total) * 100) : 0,
    completed_content_ids: completed?.map((c) => c.content_id) || [],
  };
}

/**
 * Mark a Thinkific content as completed
 */
export async function markThinkificContentCompleted(
  userId: string,
  contentId: number,
  courseId: number
): Promise<boolean> {
  const { error } = await supabaseAdmin.from('thinkific_user_progress').upsert(
    {
      user_id: userId,
      content_id: contentId,
      course_id: courseId,
      completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,content_id' }
  );

  return !error;
}

/**
 * Check if Thinkific content has been synced
 */
export async function hasThinkificContent(): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('thinkific_courses')
    .select('*', { count: 'exact', head: true });

  return (count || 0) > 0;
}

/**
 * Get Thinkific content count summary
 */
export async function getThinkificContentSummary(): Promise<{
  courses: number;
  chapters: number;
  contents: number;
  last_sync: string | null;
}> {
  const [coursesResult, chaptersResult, contentsResult] = await Promise.all([
    supabaseAdmin.from('thinkific_courses').select('synced_at', { count: 'exact', head: false }).order('synced_at', { ascending: false }).limit(1),
    supabaseAdmin.from('thinkific_chapters').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('thinkific_contents').select('*', { count: 'exact', head: true }),
  ]);

  return {
    courses: coursesResult.count || 0,
    chapters: chaptersResult.count || 0,
    contents: contentsResult.count || 0,
    last_sync: coursesResult.data?.[0]?.synced_at || null,
  };
}
