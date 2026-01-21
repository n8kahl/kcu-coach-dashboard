/**
 * Admin Course Analytics API
 *
 * Provides comprehensive analytics for course engagement and completion.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface CourseAnalytics {
  courseId: string;
  courseTitle: string;
  totalEnrollments: number;
  activeUsers: number; // Users with activity in last 30 days
  completionRate: number;
  averageProgress: number;
  totalWatchTimeHours: number;
  lessonsCount: number;
  modulesCount: number;
  quizPassRate: number;
  averageQuizScore: number;
}

interface LessonAnalytics {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  viewCount: number;
  completionRate: number;
  averageWatchPercent: number;
  dropOffRate: number; // Percent who start but don't finish
  averageWatchTimeSeconds: number;
}

interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalLessons: number;
  totalWatchTimeHours: number;
  totalCompletions: number;
  averageCompletionRate: number;
}

/**
 * GET /api/admin/analytics/courses
 * Get course analytics overview or specific course details
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, all

    // Calculate date range
    let startDate: Date | null = null;
    const now = new Date();
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      // 'all' - no start date filter
    }

    if (courseId) {
      // Get specific course analytics
      const analytics = await getCourseAnalytics(courseId, startDate);
      const lessonAnalytics = await getLessonAnalytics(courseId, startDate);
      return NextResponse.json({ course: analytics, lessons: lessonAnalytics });
    } else {
      // Get overview analytics
      const overview = await getOverviewStats(startDate);
      const coursesList = await getAllCoursesAnalytics(startDate);
      return NextResponse.json({ overview, courses: coursesList });
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

async function getOverviewStats(startDate: Date | null): Promise<OverviewStats> {
  // Total users
  const { count: totalUsers } = await supabaseAdmin
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });

  // Active users (with progress records in period)
  let activeUsersQuery = supabaseAdmin
    .from('course_lesson_progress')
    .select('user_id', { count: 'exact', head: true });

  if (startDate) {
    activeUsersQuery = activeUsersQuery.gte('last_watched_at', startDate.toISOString());
  }

  const { count: activeUsersRaw } = await activeUsersQuery;

  // Get distinct active users count
  let activeUsersDistinctQuery = supabaseAdmin
    .from('course_lesson_progress')
    .select('user_id');

  if (startDate) {
    activeUsersDistinctQuery = activeUsersDistinctQuery.gte('last_watched_at', startDate.toISOString());
  }

  const { data: activeUsersData } = await activeUsersDistinctQuery;
  const activeUsers = new Set(activeUsersData?.map(u => u.user_id) || []).size;

  // Total courses
  const { count: totalCourses } = await supabaseAdmin
    .from('courses')
    .select('*', { count: 'exact', head: true });

  // Published courses
  const { count: publishedCourses } = await supabaseAdmin
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);

  // Total lessons
  const { count: totalLessons } = await supabaseAdmin
    .from('course_lessons')
    .select('*', { count: 'exact', head: true });

  // Total watch time
  let watchTimeQuery = supabaseAdmin
    .from('course_lesson_progress')
    .select('total_watch_time_seconds');

  if (startDate) {
    watchTimeQuery = watchTimeQuery.gte('last_watched_at', startDate.toISOString());
  }

  const { data: watchTimeData } = await watchTimeQuery;
  const totalWatchTimeSeconds = watchTimeData?.reduce((sum, p) => sum + (p.total_watch_time_seconds || 0), 0) || 0;
  const totalWatchTimeHours = Math.round(totalWatchTimeSeconds / 3600 * 10) / 10;

  // Total completions
  let completionsQuery = supabaseAdmin
    .from('course_lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('completed', true);

  if (startDate) {
    completionsQuery = completionsQuery.gte('completed_at', startDate.toISOString());
  }

  const { count: totalCompletions } = await completionsQuery;

  // Average completion rate
  const { count: totalProgressRecords } = await supabaseAdmin
    .from('course_lesson_progress')
    .select('*', { count: 'exact', head: true });

  const { count: completedProgressRecords } = await supabaseAdmin
    .from('course_lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('completed', true);

  const averageCompletionRate = totalProgressRecords
    ? Math.round((completedProgressRecords || 0) / totalProgressRecords * 100)
    : 0;

  return {
    totalUsers: totalUsers || 0,
    activeUsers,
    totalCourses: totalCourses || 0,
    publishedCourses: publishedCourses || 0,
    totalLessons: totalLessons || 0,
    totalWatchTimeHours,
    totalCompletions: totalCompletions || 0,
    averageCompletionRate,
  };
}

async function getAllCoursesAnalytics(startDate: Date | null): Promise<CourseAnalytics[]> {
  // Get all courses with module and lesson counts
  const { data: courses } = await supabaseAdmin
    .from('courses')
    .select(`
      id,
      title,
      modules:course_modules(
        id,
        lessons:course_lessons(id)
      )
    `)
    .order('sort_order');

  if (!courses) return [];

  const analytics: CourseAnalytics[] = [];

  for (const course of courses) {
    const modules = course.modules || [];
    const lessons = modules.flatMap((m: { lessons: { id: string }[] }) => m.lessons || []);
    const lessonIds = lessons.map((l: { id: string }) => l.id);

    if (lessonIds.length === 0) {
      analytics.push({
        courseId: course.id,
        courseTitle: course.title,
        totalEnrollments: 0,
        activeUsers: 0,
        completionRate: 0,
        averageProgress: 0,
        totalWatchTimeHours: 0,
        lessonsCount: 0,
        modulesCount: modules.length,
        quizPassRate: 0,
        averageQuizScore: 0,
      });
      continue;
    }

    // Get progress data for this course's lessons
    let progressQuery = supabaseAdmin
      .from('course_lesson_progress')
      .select('*')
      .in('lesson_id', lessonIds);

    if (startDate) {
      progressQuery = progressQuery.gte('last_watched_at', startDate.toISOString());
    }

    const { data: progress } = await progressQuery;

    // Calculate metrics
    const userIds = new Set((progress || []).map(p => p.user_id));
    const totalEnrollments = userIds.size;

    // Active users (activity in period)
    const activeUsers = userIds.size;

    // Completion rate
    const completedLessons = (progress || []).filter(p => p.completed).length;
    const totalProgressRecords = (progress || []).length;
    const completionRate = totalProgressRecords > 0
      ? Math.round(completedLessons / totalProgressRecords * 100)
      : 0;

    // Average progress
    const avgProgress = (progress || []).reduce((sum, p) => sum + (p.progress_percent || 0), 0) / (totalProgressRecords || 1);

    // Watch time
    const totalWatchTimeSeconds = (progress || []).reduce((sum, p) => sum + (p.total_watch_time_seconds || 0), 0);
    const totalWatchTimeHours = Math.round(totalWatchTimeSeconds / 3600 * 10) / 10;

    // Quiz data
    const moduleIds = modules.map((m: { id: string }) => m.id);
    const { data: quizAttempts } = await supabaseAdmin
      .from('course_quiz_attempts')
      .select('*')
      .in('module_id', moduleIds);

    const quizPassRate = (quizAttempts || []).length > 0
      ? Math.round((quizAttempts || []).filter(a => a.passed).length / (quizAttempts || []).length * 100)
      : 0;

    const averageQuizScore = (quizAttempts || []).length > 0
      ? Math.round((quizAttempts || []).reduce((sum, a) => sum + (a.score_percent || 0), 0) / (quizAttempts || []).length)
      : 0;

    analytics.push({
      courseId: course.id,
      courseTitle: course.title,
      totalEnrollments,
      activeUsers,
      completionRate,
      averageProgress: Math.round(avgProgress),
      totalWatchTimeHours,
      lessonsCount: lessonIds.length,
      modulesCount: modules.length,
      quizPassRate,
      averageQuizScore,
    });
  }

  return analytics;
}

async function getCourseAnalytics(courseId: string, startDate: Date | null): Promise<CourseAnalytics | null> {
  const courses = await getAllCoursesAnalytics(startDate);
  return courses.find(c => c.courseId === courseId) || null;
}

async function getLessonAnalytics(courseId: string, startDate: Date | null): Promise<LessonAnalytics[]> {
  // Get course with modules and lessons
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select(`
      modules:course_modules(
        id,
        title,
        lessons:course_lessons(id, title)
      )
    `)
    .eq('id', courseId)
    .single();

  if (!course) return [];

  const analytics: LessonAnalytics[] = [];

  for (const module of course.modules || []) {
    for (const lesson of module.lessons || []) {
      // Get progress for this lesson
      let progressQuery = supabaseAdmin
        .from('course_lesson_progress')
        .select('*')
        .eq('lesson_id', lesson.id);

      if (startDate) {
        progressQuery = progressQuery.gte('last_watched_at', startDate.toISOString());
      }

      const { data: progress } = await progressQuery;

      const viewCount = (progress || []).length;
      const completed = (progress || []).filter(p => p.completed).length;
      const completionRate = viewCount > 0 ? Math.round(completed / viewCount * 100) : 0;

      const avgWatchPercent = viewCount > 0
        ? Math.round((progress || []).reduce((sum, p) => sum + (p.progress_percent || 0), 0) / viewCount)
        : 0;

      // Drop-off: started but didn't complete
      const started = (progress || []).filter(p => p.progress_percent > 0).length;
      const dropOffRate = started > 0 ? Math.round((started - completed) / started * 100) : 0;

      const avgWatchTimeSeconds = viewCount > 0
        ? Math.round((progress || []).reduce((sum, p) => sum + (p.total_watch_time_seconds || 0), 0) / viewCount)
        : 0;

      analytics.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        moduleTitle: module.title,
        viewCount,
        completionRate,
        averageWatchPercent: avgWatchPercent,
        dropOffRate,
        averageWatchTimeSeconds: avgWatchTimeSeconds,
      });
    }
  }

  return analytics;
}
