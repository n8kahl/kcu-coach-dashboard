/**
 * YouTube Content Search API Route
 *
 * Searches indexed YouTube videos and transcripts for AI coach remediation.
 * Returns videos with relevance scoring and timestamp links.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  searchYouTubeContent,
  getRelatedVideos,
  getVideosByCategory,
} from '@/lib/youtube-channel-indexer';

// ============================================
// GET /api/youtube/search
// Search indexed YouTube content
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
    const query = searchParams.get('q');
    const category = searchParams.get('category') || undefined;
    const minRelevance = searchParams.get('minRelevance');
    const limit = searchParams.get('limit');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const results = await searchYouTubeContent(query, {
      category,
      minLtpRelevance: minRelevance ? parseFloat(minRelevance) : undefined,
      limit: limit ? parseInt(limit, 10) : 10,
    });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });

  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json(
      { error: 'Failed to search YouTube content' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/youtube/search
// Advanced search with embeddings (for AI coach)
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
    const { query, videoId, category, limit = 10, includeTranscriptMatches = false } = body;

    // If videoId is provided, get related videos
    if (videoId) {
      const related = await getRelatedVideos(videoId, limit);
      return NextResponse.json({
        success: true,
        type: 'related',
        sourceVideoId: videoId,
        results: related,
        count: related.length,
      });
    }

    // If category is provided without query, get videos by category
    if (category && !query) {
      const categoryVideos = await getVideosByCategory(category, limit);
      return NextResponse.json({
        success: true,
        type: 'category',
        category,
        results: categoryVideos,
        count: categoryVideos.length,
      });
    }

    // Regular search with optional transcript matching
    if (!query) {
      return NextResponse.json(
        { error: 'Either query, videoId, or category is required' },
        { status: 400 }
      );
    }

    const results = await searchYouTubeContent(query, {
      category,
      limit,
    });

    // Optionally include transcript chunk matches
    let transcriptMatches: unknown[] = [];
    if (includeTranscriptMatches && results.length > 0) {
      const videoIds = results.map(r => r.videoId);

      // Search transcript chunks for these videos
      const { data: chunks } = await supabaseAdmin
        .from('knowledge_chunks')
        .select('*')
        .in('video_id', videoIds)
        .textSearch('content', query.split(' ').join(' & '))
        .limit(20);

      if (chunks) {
        transcriptMatches = chunks.map((chunk: Record<string, unknown>) => ({
          videoId: chunk.video_id,
          content: chunk.content,
          startTimestamp: chunk.start_timestamp_ms,
          endTimestamp: chunk.end_timestamp_ms,
          similarity: chunk.similarity || 0,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      type: 'search',
      query,
      results,
      count: results.length,
      ...(includeTranscriptMatches && { transcriptMatches }),
    });

  } catch (error) {
    console.error('YouTube advanced search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform advanced search' },
      { status: 500 }
    );
  }
}
