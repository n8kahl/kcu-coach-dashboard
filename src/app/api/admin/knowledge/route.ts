/**
 * Admin Knowledge Management API
 *
 * Endpoints for managing the RAG knowledge base.
 * Admin-only access.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  processPendingVideos,
  addVideoForProcessing,
  reprocessVideo,
  getProcessingStats,
} from '@/lib/transcript-processor';
import { isRAGAvailable } from '@/lib/rag';
import { isEmbeddingConfigured } from '@/lib/embeddings';
import logger from '@/lib/logger';

/**
 * GET /api/admin/knowledge
 * List all knowledge sources and get statistics
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Return overview statistics
    if (action === 'stats') {
      const [ragStatus, videoStats] = await Promise.all([
        isRAGAvailable(),
        getProcessingStats(),
      ]);

      const { count: sourceCount } = await supabaseAdmin
        .from('knowledge_sources')
        .select('*', { count: 'exact', head: true });

      return NextResponse.json({
        embeddingsConfigured: isEmbeddingConfigured(),
        ragAvailable: ragStatus.available,
        totalChunks: ragStatus.chunkCount,
        totalSources: sourceCount || 0,
        videoStats,
      });
    }

    // List all knowledge sources
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from('knowledge_sources')
      .select('*')
      .order('updated_at', { ascending: false });

    if (sourcesError) {
      logger.error('Error fetching knowledge sources', { error: sourcesError.message });
      return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
    }

    // List all YouTube videos
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('youtube_videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (videosError) {
      logger.error('Error fetching videos', { error: videosError.message });
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    return NextResponse.json({
      sources: sources || [],
      videos: videos || [],
      embeddingsConfigured: isEmbeddingConfigured(),
    });

  } catch (error) {
    logger.error('Error in admin knowledge GET', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/knowledge
 * Trigger various knowledge management actions
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, videoUrl, videoId, limit = 5 } = body;

    switch (action) {
      case 'process_pending': {
        // Process pending video transcripts
        if (!isEmbeddingConfigured()) {
          return NextResponse.json({
            error: 'Embeddings not configured',
            detail: 'OPENAI_API_KEY is required',
          }, { status: 503 });
        }

        const result = await processPendingVideos(limit);
        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'add_video': {
        // Add a new video for processing
        if (!videoUrl) {
          return NextResponse.json({
            error: 'videoUrl is required',
          }, { status: 400 });
        }

        const result = await addVideoForProcessing(videoUrl, body.metadata);
        return NextResponse.json(result);
      }

      case 'reprocess_video': {
        // Reprocess a specific video
        if (!videoId) {
          return NextResponse.json({
            error: 'videoId is required',
          }, { status: 400 });
        }

        if (!isEmbeddingConfigured()) {
          return NextResponse.json({
            error: 'Embeddings not configured',
          }, { status: 503 });
        }

        const result = await reprocessVideo(videoId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['process_pending', 'add_video', 'reprocess_video'],
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('Error in admin knowledge POST', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/knowledge
 * Remove knowledge chunks for a specific source
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType');
    const sourceId = searchParams.get('sourceId');

    if (!sourceType || !sourceId) {
      return NextResponse.json({
        error: 'sourceType and sourceId are required',
      }, { status: 400 });
    }

    logger.info('Deleting knowledge source', { sourceType, sourceId, adminId: session.userId });

    // Delete chunks
    const { error: chunkError, count: chunkCount } = await supabaseAdmin
      .from('knowledge_chunks')
      .delete({ count: 'exact' })
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);

    if (chunkError) {
      logger.error('Error deleting chunks', { error: chunkError.message });
      return NextResponse.json({ error: 'Failed to delete chunks' }, { status: 500 });
    }

    // Delete source record
    const { error: sourceError } = await supabaseAdmin
      .from('knowledge_sources')
      .delete()
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);

    if (sourceError) {
      logger.error('Error deleting source', { error: sourceError.message });
    }

    // If it's a video, reset the video status
    if (sourceType === 'transcript') {
      await supabaseAdmin
        .from('youtube_videos')
        .update({ transcript_status: 'pending', chunk_count: 0 })
        .eq('video_id', sourceId);
    }

    return NextResponse.json({
      success: true,
      deletedChunks: chunkCount || 0,
    });

  } catch (error) {
    logger.error('Error in admin knowledge DELETE', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
