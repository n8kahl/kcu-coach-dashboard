/**
 * YouTube Videos API Route
 *
 * Lists indexed YouTube videos with filtering and pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// ============================================
// GET /api/youtube/videos
// List indexed videos
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession();

    if (!session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || 'published_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    let query = supabaseAdmin
      .from('youtube_videos')
      .select('*', { count: 'exact' });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (status) {
      query = query.eq('transcript_status', status);
    }

    // Apply sorting
    const validSortColumns = ['published_at', 'ltp_relevance', 'view_count', 'created_at', 'title'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'published_at';
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: videos, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    // Get category counts for filtering UI
    const { data: categoryCounts } = await supabaseAdmin
      .from('v_youtube_by_category')
      .select('*');

    return NextResponse.json({
      success: true,
      videos: videos || [],
      total: count || 0,
      limit,
      offset,
      categories: categoryCounts || [],
    });

  } catch (error) {
    console.error('Get videos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/youtube/videos
// Get single video details
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession();

    if (!session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    // Get video details
    const { data: video, error: videoError } = await supabaseAdmin
      .from('youtube_videos')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Get transcript segments if available
    let segments: unknown[] = [];
    if (video.transcript_status === 'completed') {
      const { data: segmentData } = await supabaseAdmin
        .from('transcript_segments')
        .select('*')
        .eq('video_id', videoId)
        .order('start_ms', { ascending: true });

      segments = segmentData || [];
    }

    // Get related videos
    const { data: relatedData } = await supabaseAdmin
      .rpc('get_related_youtube_videos', {
        p_video_id: videoId,
        p_limit: 5,
      });

    return NextResponse.json({
      success: true,
      video,
      segments,
      relatedVideos: relatedData || [],
    });

  } catch (error) {
    console.error('Get video details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video details' },
      { status: 500 }
    );
  }
}
