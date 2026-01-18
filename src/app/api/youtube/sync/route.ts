/**
 * YouTube Channel Sync API Route
 *
 * Triggers synchronization of KayCapitals YouTube channel videos.
 * Admin-only endpoint for indexing videos into the system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  syncAndIndexChannel,
  getChannelSyncStatus,
  isYouTubeConfigured,
  type ChannelIndexStats,
} from '@/lib/youtube-channel-indexer';
import { env } from '@/lib/env';

// ============================================
// Types
// ============================================

interface SyncRequest {
  channelId?: string;
  maxVideos?: number;
  forceReindex?: boolean;
  processTranscripts?: boolean;
}

// ============================================
// POST /api/youtube/sync
// Trigger channel sync (admin only)
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check configuration
    if (!isYouTubeConfigured()) {
      return NextResponse.json(
        { error: 'YouTube API is not configured. Set YOUTUBE_API_KEY and KAY_CAPITALS_CHANNEL_ID.' },
        { status: 503 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: SyncRequest = await request.json().catch(() => ({}));
    const channelId = body.channelId || env.KAY_CAPITALS_CHANNEL_ID;

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    // Check if sync is already running
    const currentStatus = await getChannelSyncStatus(channelId);
    if (currentStatus?.sync_status === 'syncing') {
      return NextResponse.json(
        {
          error: 'Sync already in progress',
          status: currentStatus,
        },
        { status: 409 }
      );
    }

    // Start sync process
    const stats: ChannelIndexStats = await syncAndIndexChannel({
      channelId,
      maxVideos: body.maxVideos || 100,
      processTranscripts: body.processTranscripts !== false,
    });

    return NextResponse.json({
      success: true,
      stats,
      message: `Synced ${stats.videosIndexed} videos from channel`,
    });

  } catch (error) {
    console.error('YouTube sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync YouTube channel' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/youtube/sync
// Get sync status
// ============================================

export async function GET(request: NextRequest) {
  try {
    if (!isYouTubeConfigured()) {
      return NextResponse.json(
        { error: 'YouTube API is not configured' },
        { status: 503 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const channelId = request.nextUrl.searchParams.get('channelId') || env.KAY_CAPITALS_CHANNEL_ID;

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    const status = await getChannelSyncStatus(channelId);

    if (!status) {
      return NextResponse.json({
        success: true,
        status: null,
        message: 'Channel has not been synced yet',
      });
    }

    return NextResponse.json({
      success: true,
      status,
    });

  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
