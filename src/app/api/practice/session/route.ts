/**
 * Practice Session API
 *
 * POST /api/practice/session - Start a new practice session
 * PUT /api/practice/session - End a practice session
 * GET /api/practice/session - Get current session info
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

interface StartSessionRequest {
  mode: string;
  focusArea?: string;
}

interface EndSessionRequest {
  sessionId: string;
}

/**
 * POST - Start a new practice session
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: StartSessionRequest = await request.json();
    const { mode, focusArea } = body;

    // Create the session
    const { data: practiceSession, error } = await supabaseAdmin
      .from('practice_sessions')
      .insert({
        user_id: session.userId,
        mode: mode || 'standard',
        focus_area: focusArea,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating practice session', { error: error.message });
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    logger.info('Practice session started', {
      userId: session.userId,
      sessionId: practiceSession.id,
      mode,
    });

    return NextResponse.json({
      sessionId: practiceSession.id,
      mode: practiceSession.mode,
      startedAt: practiceSession.started_at,
    });
  } catch (error) {
    logger.error('Error in practice session POST', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - End a practice session
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: EndSessionRequest = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Get session stats
    const { data: attempts } = await supabaseAdmin
      .from('practice_attempts')
      .select('is_correct, time_taken_seconds')
      .eq('session_id', sessionId)
      .eq('user_id', session.userId);

    const scenariosAttempted = attempts?.length || 0;
    const scenariosCorrect = attempts?.filter(a => a.is_correct).length || 0;
    const avgTime = attempts?.length
      ? Math.round(
          attempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) / attempts.length
        )
      : 0;

    // Get current streak
    const { data: streakData } = await supabaseAdmin
      .from('practice_streaks')
      .select('current_count')
      .eq('user_id', session.userId)
      .eq('streak_type', 'correct_in_row')
      .single();

    // Update the session
    const { data: updatedSession, error } = await supabaseAdmin
      .from('practice_sessions')
      .update({
        ended_at: new Date().toISOString(),
        scenarios_attempted: scenariosAttempted,
        scenarios_correct: scenariosCorrect,
        avg_decision_time_seconds: avgTime,
        streak_at_end: streakData?.current_count || 0,
      })
      .eq('id', sessionId)
      .eq('user_id', session.userId)
      .select()
      .single();

    if (error) {
      logger.error('Error ending practice session', { error: error.message });
      return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
    }

    // Calculate XP earned (10 per attempt, 25 bonus per correct)
    const xpEarned = scenariosAttempted * 10 + scenariosCorrect * 25;

    // Award XP to user
    await supabaseAdmin.rpc('award_xp', {
      p_user_id: session.userId,
      p_amount: xpEarned,
      p_reason: `Practice session completed: ${scenariosCorrect}/${scenariosAttempted} correct`,
    }).catch(() => {
      // XP function may not exist
    });

    logger.info('Practice session ended', {
      userId: session.userId,
      sessionId,
      scenariosAttempted,
      scenariosCorrect,
      xpEarned,
    });

    return NextResponse.json({
      session: updatedSession,
      stats: {
        attempted: scenariosAttempted,
        correct: scenariosCorrect,
        accuracy: scenariosAttempted > 0 ? Math.round((scenariosCorrect / scenariosAttempted) * 100) : 0,
        avgTimeSeconds: avgTime,
        xpEarned,
      },
    });
  } catch (error) {
    logger.error('Error in practice session PUT', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - Get current/recent session info
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Get specific session
      const { data: practiceSession } = await supabaseAdmin
        .from('practice_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', session.userId)
        .single();

      if (!practiceSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({ session: practiceSession });
    }

    // Get recent sessions
    const { data: recentSessions } = await supabaseAdmin
      .from('practice_sessions')
      .select('*')
      .eq('user_id', session.userId)
      .order('started_at', { ascending: false })
      .limit(10);

    // Get active session (started but not ended)
    const activeSession = recentSessions?.find(s => !s.ended_at);

    return NextResponse.json({
      activeSession,
      recentSessions: recentSessions || [],
    });
  } catch (error) {
    logger.error('Error in practice session GET', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
