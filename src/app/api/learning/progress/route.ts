import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Fetch user's learning progress
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch lesson progress
    const { data: lessonProgress, error: lessonError } = await supabaseAdmin
      .from('user_lesson_progress')
      .select('*')
      .eq('user_id', session.user.id);

    if (lessonError) {
      console.error('Error fetching lesson progress:', lessonError);
    }

    // Fetch module progress
    const { data: moduleProgress, error: moduleError } = await supabaseAdmin
      .from('user_module_progress')
      .select('*')
      .eq('user_id', session.user.id);

    if (moduleError) {
      console.error('Error fetching module progress:', moduleError);
    }

    // Fetch quiz attempts
    const { data: quizAttempts, error: quizError } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (quizError) {
      console.error('Error fetching quiz attempts:', quizError);
    }

    return NextResponse.json({
      lessonProgress: lessonProgress || [],
      moduleProgress: moduleProgress || [],
      recentQuizzes: quizAttempts || [],
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

// POST - Update lesson progress
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { lessonId, completed, watchTime, progressPercent } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Lesson ID is required' },
        { status: 400 }
      );
    }

    // Upsert lesson progress
    const { data, error } = await supabaseAdmin
      .from('user_lesson_progress')
      .upsert(
        {
          user_id: session.user.id,
          lesson_id: lessonId,
          completed: completed || false,
          watch_time: watchTime || 0,
          progress_percent: progressPercent || 0,
          completed_at: completed ? new Date().toISOString() : null,
          last_watched_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,lesson_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating lesson progress:', error);
      return NextResponse.json(
        { error: 'Failed to update progress' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      progress: data,
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}
