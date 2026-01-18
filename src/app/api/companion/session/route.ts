/**
 * Companion Session API
 *
 * POST /api/companion/session - Start a new companion session
 * PUT /api/companion/session - Update/end a companion session
 * GET /api/companion/session - Get session info
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

interface StartSessionRequest {
  symbolsWatched?: string[];
}

interface UpdateSessionRequest {
  sessionId: string;
  action: 'update' | 'end';
  data?: {
    setupsDetected?: number;
    setupsTraded?: number;
    alertsSet?: number;
    alertsTriggered?: number;
    practiceAttempts?: number;
    symbolsWatched?: string[];
    bestSetupSymbol?: string;
    bestSetupConfluence?: number;
  };
}

/**
 * POST - Start a new companion session
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: StartSessionRequest = await request.json();
    const { symbolsWatched } = body;

    // End any existing active session
    await supabaseAdmin
      .from('companion_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('user_id', session.userId)
      .is('ended_at', null);

    // Create new session
    const { data: newSession, error } = await supabaseAdmin
      .from('companion_sessions')
      .insert({
        user_id: session.userId,
        started_at: new Date().toISOString(),
        symbols_watched: symbolsWatched || [],
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating companion session', { error: error.message });
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    logger.info('Companion session started', {
      userId: session.userId,
      sessionId: newSession.id,
    });

    return NextResponse.json({
      session: newSession,
    });
  } catch (error) {
    logger.error('Error in companion session POST', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Update or end a companion session
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateSessionRequest = await request.json();
    const { sessionId, action, data } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (action === 'end') {
      updateData.ended_at = new Date().toISOString();
    }

    if (data) {
      if (data.setupsDetected !== undefined) updateData.setups_detected = data.setupsDetected;
      if (data.setupsTraded !== undefined) updateData.setups_traded = data.setupsTraded;
      if (data.alertsSet !== undefined) updateData.alerts_set = data.alertsSet;
      if (data.alertsTriggered !== undefined) updateData.alerts_triggered = data.alertsTriggered;
      if (data.practiceAttempts !== undefined) updateData.practice_attempts = data.practiceAttempts;
      if (data.symbolsWatched !== undefined) updateData.symbols_watched = data.symbolsWatched;
      if (data.bestSetupSymbol !== undefined) updateData.best_setup_symbol = data.bestSetupSymbol;
      if (data.bestSetupConfluence !== undefined) updateData.best_setup_confluence = data.bestSetupConfluence;
    }

    const { data: updatedSession, error } = await supabaseAdmin
      .from('companion_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', session.userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating companion session', { error: error.message });
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    logger.info('Companion session updated', {
      userId: session.userId,
      sessionId,
      action,
    });

    return NextResponse.json({
      session: updatedSession,
    });
  } catch (error) {
    logger.error('Error in companion session PUT', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - Get session info
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
      const { data: companionSession, error } = await supabaseAdmin
        .from('companion_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', session.userId)
        .single();

      if (error || !companionSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({ session: companionSession });
    }

    // Get active session
    const { data: activeSession } = await supabaseAdmin
      .from('companion_sessions')
      .select('*')
      .eq('user_id', session.userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Get recent sessions
    const { data: recentSessions } = await supabaseAdmin
      .from('companion_sessions')
      .select('*')
      .eq('user_id', session.userId)
      .order('started_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      session: activeSession,
      recentSessions: recentSessions || [],
    });
  } catch (error) {
    logger.error('Error in companion session GET', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
