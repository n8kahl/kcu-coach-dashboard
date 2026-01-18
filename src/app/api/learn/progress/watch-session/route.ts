import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// POST - Create/update watch session (for compliance audit trail)
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      lessonId,
      sessionId,
      action, // 'start', 'update', 'end'
      startPositionSeconds,
      endPositionSeconds,
      playbackSpeed,
      wasCompleted,
      deviceType,
      browser,
      userAgent,
    } = body;

    if (!lessonId || !action) {
      return NextResponse.json(
        { error: 'lessonId and action are required' },
        { status: 400 }
      );
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     '0.0.0.0';

    if (action === 'start') {
      // Create new watch session
      const { data: session, error } = await supabaseAdmin
        .from('lesson_watch_sessions')
        .insert({
          user_id: user.id,
          lesson_id: lessonId,
          started_at: new Date().toISOString(),
          start_position_seconds: startPositionSeconds || 0,
          end_position_seconds: startPositionSeconds || 0,
          watch_duration_seconds: 0,
          playback_speed: playbackSpeed || 1.0,
          was_completed: false,
          device_type: deviceType,
          browser: browser,
          ip_address: clientIp,
          user_agent: userAgent,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ sessionId: session.id });
    }

    if (action === 'update' || action === 'end') {
      if (!sessionId) {
        return NextResponse.json(
          { error: 'sessionId is required for update/end' },
          { status: 400 }
        );
      }

      const updateData: Record<string, unknown> = {
        end_position_seconds: endPositionSeconds,
        playback_speed: playbackSpeed,
      };

      if (action === 'end') {
        updateData.ended_at = new Date().toISOString();
        updateData.was_completed = wasCompleted || false;

        // Calculate watch duration
        const { data: existingSession } = await supabaseAdmin
          .from('lesson_watch_sessions')
          .select('started_at, start_position_seconds')
          .eq('id', sessionId)
          .single();

        if (existingSession) {
          const startTime = new Date(existingSession.started_at as string).getTime();
          const endTime = Date.now();
          const realTimeDuration = Math.floor((endTime - startTime) / 1000);

          // Use the smaller of real time or video time difference
          // to avoid counting paused time
          const videoTimeDifference = Math.abs(
            (endPositionSeconds || 0) - (existingSession.start_position_seconds as number || 0)
          );
          updateData.watch_duration_seconds = Math.min(realTimeDuration, videoTimeDifference);
        }
      }

      const { error } = await supabaseAdmin
        .from('lesson_watch_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing watch session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get watch sessions for compliance reporting
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabaseAdmin
      .from('lesson_watch_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (lessonId) {
      query = query.eq('lesson_id', lessonId);
    }

    if (startDate) {
      query = query.gte('started_at', startDate);
    }

    if (endDate) {
      query = query.lte('started_at', endDate);
    }

    const { data: sessions, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      sessions: (sessions || []).map(session => ({
        id: session.id,
        lessonId: session.lesson_id,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        startPositionSeconds: session.start_position_seconds,
        endPositionSeconds: session.end_position_seconds,
        watchDurationSeconds: session.watch_duration_seconds,
        playbackSpeed: session.playback_speed,
        wasCompleted: session.was_completed,
        deviceType: session.device_type,
        browser: session.browser,
      })),
    });
  } catch (error) {
    console.error('Error fetching watch sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
