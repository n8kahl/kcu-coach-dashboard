import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Generate compliance report for a user or all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check if admin
    const { data: currentUser } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id,
        user_role_assignments(
          user_roles(name)
        )
      `)
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userRoles = (currentUser.user_role_assignments as unknown as Array<{ user_roles: { name: string }[] }>)
      ?.flatMap(ura => ura.user_roles?.map(r => r.name) || []) || [];
    const isAdmin = userRoles.some(role => ['admin', 'super_admin', 'coach'].includes(role));

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const courseId = searchParams.get('courseId');
    const format = searchParams.get('format') || 'json';

    // Non-admins can only view their own data
    if (!isAdmin && targetUserId && targetUserId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = targetUserId || currentUser.id;

    // Build the compliance report
    const report = await generateComplianceReport(userId, courseId);

    if (format === 'csv') {
      // Generate CSV for download
      const csv = generateCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="compliance-report-${userId}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateComplianceReport(userId: string, courseId: string | null) {
  // Get user profile
  const { data: user } = await supabaseAdmin
    .from('user_profiles')
    .select('id, discord_username, display_name')
    .eq('id', userId)
    .single();

  if (!user) {
    throw new Error('User not found');
  }

  // Get course info if specified
  let course = null;
  if (courseId) {
    const { data } = await supabaseAdmin
      .from('courses')
      .select('id, title, slug')
      .eq('id', courseId)
      .single();
    course = data;
  }

  // Get all lesson progress with detailed watch data
  let lessonsQuery = supabaseAdmin
    .from('course_lesson_progress')
    .select(`
      *,
      lesson:course_lessons(
        id,
        title,
        lesson_number,
        video_duration_seconds,
        module:course_modules(
          id,
          title,
          module_number,
          course_id
        )
      )
    `)
    .eq('user_id', userId);

  if (courseId) {
    // Filter by course - need to join through module
    const { data: courseLessons } = await supabaseAdmin
      .from('course_lessons')
      .select('id')
      .eq('module_id', supabaseAdmin
        .from('course_modules')
        .select('id')
        .eq('course_id', courseId)
      );

    if (courseLessons && courseLessons.length > 0) {
      lessonsQuery = lessonsQuery.in('lesson_id', courseLessons.map(l => l.id));
    }
  }

  const { data: lessonProgress } = await lessonsQuery;

  // Get all quiz attempts
  let quizzesQuery = supabaseAdmin
    .from('course_quiz_attempts')
    .select(`
      *,
      module:course_modules(
        id,
        title,
        module_number,
        course_id
      )
    `)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (courseId) {
    quizzesQuery = quizzesQuery.eq('module.course_id', courseId);
  }

  const { data: quizAttempts } = await quizzesQuery;

  // Get watch sessions for detailed audit
  const { data: watchSessions } = await supabaseAdmin
    .from('lesson_watch_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(500);

  // Calculate summary stats
  const lessonsDetail = (lessonProgress || []).map(lp => {
    const lesson = lp.lesson as Record<string, unknown>;
    return {
      lessonId: lesson?.id,
      lessonNumber: lesson?.lesson_number,
      lessonTitle: lesson?.title,
      moduleTitle: (lesson?.module as Record<string, unknown>)?.title,
      videoDurationSeconds: lesson?.video_duration_seconds || 0,
      totalWatchTimeSeconds: lp.total_watch_time_seconds || 0,
      uniqueWatchTimeSeconds: lp.unique_watch_time_seconds || 0,
      watchCount: lp.watch_count || 0,
      progressPercent: lp.progress_percent || 0,
      completed: lp.completed,
      completedAt: lp.completed_at,
      firstWatchedAt: lp.first_watched_at,
      lastWatchedAt: lp.last_watched_at,
      pauseCount: lp.pause_count || 0,
      seekCount: lp.seek_count || 0,
      playbackSpeedChanges: lp.playback_speed_changes || 0,
    };
  });

  const totalWatchTimeSeconds = lessonsDetail.reduce((s, l) => s + l.totalWatchTimeSeconds, 0);
  const completedLessons = lessonsDetail.filter(l => l.completed).length;
  const totalLessons = lessonsDetail.length;

  const quizSummary = (quizAttempts || []).map(qa => {
    const module = qa.module as Record<string, unknown>;
    return {
      moduleId: module?.id,
      moduleName: module?.title,
      attemptNumber: qa.attempt_number,
      questionsTotal: qa.questions_total,
      questionsCorrect: qa.questions_correct,
      scorePercent: qa.score_percent,
      passed: qa.passed,
      timeSpentSeconds: qa.time_spent_seconds,
      startedAt: qa.started_at,
      completedAt: qa.completed_at,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    user: {
      id: user.id,
      displayName: user.display_name || user.discord_username,
    },
    course: course ? {
      id: course.id,
      title: course.title,
    } : null,
    summary: {
      totalLessons,
      completedLessons,
      completionPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      totalWatchTimeSeconds,
      totalWatchTimeFormatted: formatDuration(totalWatchTimeSeconds),
      totalQuizAttempts: quizAttempts?.length || 0,
      bestQuizScores: calculateBestQuizScores(quizAttempts || []),
    },
    lessonsDetail,
    quizAttempts: quizSummary,
    watchSessions: (watchSessions || []).map(ws => ({
      sessionId: ws.id,
      lessonId: ws.lesson_id,
      startedAt: ws.started_at,
      endedAt: ws.ended_at,
      startPositionSeconds: ws.start_position_seconds,
      endPositionSeconds: ws.end_position_seconds,
      watchDurationSeconds: ws.watch_duration_seconds,
      playbackSpeed: ws.playback_speed,
      deviceType: ws.device_type,
      browser: ws.browser,
      ipAddress: ws.ip_address,
    })),
  };
}

function calculateBestQuizScores(quizAttempts: Array<Record<string, unknown>>) {
  const bestByModule = new Map<string, number>();
  for (const attempt of quizAttempts) {
    const moduleId = (attempt.module as Record<string, unknown>)?.id as string;
    const score = attempt.score_percent as number;
    if (!bestByModule.has(moduleId) || bestByModule.get(moduleId)! < score) {
      bestByModule.set(moduleId, score);
    }
  }
  return Array.from(bestByModule.entries()).map(([moduleId, score]) => ({
    moduleId,
    bestScore: score,
  }));
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

function generateCSV(report: Awaited<ReturnType<typeof generateComplianceReport>>) {
  const rows: string[] = [];

  // Header section
  rows.push(`Compliance Report - ${report.user.displayName}`);
  rows.push(`Generated: ${report.generatedAt}`);
  rows.push('');

  // Summary section
  rows.push('SUMMARY');
  rows.push(`Total Lessons,${report.summary.totalLessons}`);
  rows.push(`Completed Lessons,${report.summary.completedLessons}`);
  rows.push(`Completion %,${report.summary.completionPercent}%`);
  rows.push(`Total Watch Time,${report.summary.totalWatchTimeFormatted}`);
  rows.push(`Total Quiz Attempts,${report.summary.totalQuizAttempts}`);
  rows.push('');

  // Lessons detail section
  rows.push('LESSON DETAILS');
  rows.push('Lesson Number,Lesson Title,Module,Video Duration (sec),Total Watch Time (sec),Unique Watch Time (sec),Watch Count,Progress %,Completed,Completed At');
  for (const lesson of report.lessonsDetail) {
    rows.push([
      lesson.lessonNumber,
      `"${lesson.lessonTitle}"`,
      `"${lesson.moduleTitle}"`,
      lesson.videoDurationSeconds,
      lesson.totalWatchTimeSeconds,
      lesson.uniqueWatchTimeSeconds,
      lesson.watchCount,
      lesson.progressPercent,
      lesson.completed ? 'Yes' : 'No',
      lesson.completedAt || '',
    ].join(','));
  }
  rows.push('');

  // Quiz attempts section
  rows.push('QUIZ ATTEMPTS');
  rows.push('Module,Attempt #,Questions Total,Questions Correct,Score %,Passed,Time Spent (sec),Completed At');
  for (const quiz of report.quizAttempts) {
    rows.push([
      `"${quiz.moduleName}"`,
      quiz.attemptNumber,
      quiz.questionsTotal,
      quiz.questionsCorrect,
      quiz.scorePercent,
      quiz.passed ? 'Yes' : 'No',
      quiz.timeSpentSeconds || '',
      quiz.completedAt || '',
    ].join(','));
  }

  return rows.join('\n');
}
