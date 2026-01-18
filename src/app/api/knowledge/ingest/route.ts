/**
 * Knowledge Ingestion API
 *
 * POST /api/knowledge/ingest
 * Ingests text content into the knowledge base with embeddings.
 * Admin-only endpoint.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { processAndEmbedText, isEmbeddingConfigured, ChunkMetadata } from '@/lib/embeddings';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

interface IngestRequest {
  text: string;
  sourceType: 'transcript' | 'document' | 'lesson' | 'manual';
  sourceId: string;
  sourceTitle: string;
  url?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  ltpRelevance?: number;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin access
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Check if embeddings are configured
    if (!isEmbeddingConfigured()) {
      return NextResponse.json({
        error: 'Embeddings not configured',
        detail: 'OPENAI_API_KEY environment variable is not set',
      }, { status: 503 });
    }

    // Parse request body
    const body: IngestRequest = await request.json();

    // Validate required fields
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'text field is required and must be a string',
      }, { status: 400 });
    }

    if (!body.sourceType || !['transcript', 'document', 'lesson', 'manual'].includes(body.sourceType)) {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'sourceType must be one of: transcript, document, lesson, manual',
      }, { status: 400 });
    }

    if (!body.sourceId || typeof body.sourceId !== 'string') {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'sourceId is required',
      }, { status: 400 });
    }

    if (!body.sourceTitle || typeof body.sourceTitle !== 'string') {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'sourceTitle is required',
      }, { status: 400 });
    }

    // Validate text length
    if (body.text.length < 50) {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'text must be at least 50 characters',
      }, { status: 400 });
    }

    if (body.text.length > 500000) {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'text exceeds maximum length of 500,000 characters',
      }, { status: 400 });
    }

    logger.info('Starting knowledge ingestion', {
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      textLength: body.text.length,
      adminId: session.userId,
    });

    // Create or update knowledge source record
    await supabaseAdmin
      .from('knowledge_sources')
      .upsert({
        source_type: body.sourceType,
        source_id: body.sourceId,
        title: body.sourceTitle,
        url: body.url || null,
        status: 'processing',
        metadata: {
          topic: body.topic,
          subtopic: body.subtopic,
          difficulty: body.difficulty,
          ltpRelevance: body.ltpRelevance,
          ingestedBy: session.userId,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source_type,source_id',
      });

    // Prepare metadata
    const metadata: ChunkMetadata = {
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      sourceTitle: body.sourceTitle,
      topic: body.topic,
      subtopic: body.subtopic,
      difficulty: body.difficulty,
      ltpRelevance: body.ltpRelevance,
    };

    // Process and embed the text
    const result = await processAndEmbedText(body.text, metadata);

    if (!result.success) {
      logger.error('Knowledge ingestion failed', {
        sourceId: body.sourceId,
        error: result.error,
      });

      return NextResponse.json({
        error: 'Ingestion failed',
        detail: result.error,
      }, { status: 500 });
    }

    logger.info('Knowledge ingestion completed', {
      sourceId: body.sourceId,
      chunkCount: result.chunkCount,
    });

    return NextResponse.json({
      success: true,
      sourceId: body.sourceId,
      sourceType: body.sourceType,
      chunkCount: result.chunkCount,
      message: `Successfully processed ${result.chunkCount} chunks`,
    });

  } catch (error) {
    logger.error('Error in knowledge ingestion', error instanceof Error ? error : { message: String(error) });

    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET /api/knowledge/ingest
 * Check ingestion status for a source
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType');
    const sourceId = searchParams.get('sourceId');

    if (!sourceType || !sourceId) {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'sourceType and sourceId query parameters are required',
      }, { status: 400 });
    }

    const { data: source, error } = await supabaseAdmin
      .from('knowledge_sources')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching knowledge source', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch source' }, { status: 500 });
    }

    if (!source) {
      return NextResponse.json({
        exists: false,
        status: 'not_found',
      });
    }

    return NextResponse.json({
      exists: true,
      status: source.status,
      chunkCount: source.chunk_count,
      processedAt: source.processed_at,
      errorMessage: source.error_message,
    });

  } catch (error) {
    logger.error('Error checking ingestion status', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
