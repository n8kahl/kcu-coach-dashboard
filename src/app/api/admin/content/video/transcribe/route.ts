/**
 * Admin Content - Video Transcription
 *
 * Generates transcripts for uploaded Cloudflare Stream videos
 * using OpenAI Whisper or Cloudflare's built-in captions.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  transcribeCloudflareVideo,
  isTranscriptionConfigured,
} from '@/lib/transcription';
import { processAndEmbedText, isEmbeddingConfigured, ChunkMetadata } from '@/lib/embeddings';
import logger from '@/lib/logger';

interface TranscribeRequest {
  lessonId?: string;
  videoUid?: string;
  generateEmbeddings?: boolean;
  forceWhisper?: boolean;
}

/**
 * POST /api/admin/content/video/transcribe
 *
 * Request body:
 * {
 *   lessonId?: string;    // If provided, fetches videoUid from the lesson
 *   videoUid?: string;    // Direct Cloudflare Stream video UID
 *   generateEmbeddings?: boolean;  // Also generate knowledge embeddings (default: true)
 *   forceWhisper?: boolean;  // Skip Cloudflare captions and use Whisper only
 * }
 *
 * Returns:
 * {
 *   success: boolean;
 *   transcript?: string;
 *   duration?: number;
 *   embeddingsGenerated?: boolean;
 *   chunkCount?: number;
 *   error?: string;
 * }
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

    // Check if transcription is configured
    if (!isTranscriptionConfigured()) {
      return NextResponse.json(
        {
          error: 'Transcription not configured',
          details: 'OPENAI_API_KEY environment variable is required',
        },
        { status: 503 }
      );
    }

    const body: TranscribeRequest = await request.json().catch(() => ({}));
    const { lessonId, generateEmbeddings = true, forceWhisper = false } = body;
    let { videoUid } = body;

    // If lessonId provided, fetch the videoUid from the lesson
    let lessonData: { id: string; title: string; module_id: string } | null = null;

    if (lessonId) {
      const { data: lesson, error: lessonError } = await supabaseAdmin
        .from('course_lessons')
        .select('id, title, module_id, video_uid')
        .eq('id', lessonId)
        .single();

      if (lessonError || !lesson) {
        return NextResponse.json(
          { error: 'Lesson not found' },
          { status: 404 }
        );
      }

      if (!lesson.video_uid) {
        return NextResponse.json(
          { error: 'Lesson has no video uploaded' },
          { status: 400 }
        );
      }

      videoUid = lesson.video_uid;
      lessonData = lesson;
    }

    if (!videoUid) {
      return NextResponse.json(
        { error: 'Either lessonId or videoUid is required' },
        { status: 400 }
      );
    }

    logger.info('Starting video transcription', {
      videoUid,
      lessonId,
      forceWhisper,
      adminId: session.userId,
    });

    // Generate transcript
    const transcriptResult = await transcribeCloudflareVideo(videoUid, {
      forceWhisper,
    });

    if (!transcriptResult.success || !transcriptResult.transcript) {
      logger.error('Transcription failed', {
        videoUid,
        error: transcriptResult.error,
      });

      return NextResponse.json(
        {
          error: 'Transcription failed',
          details: transcriptResult.error,
        },
        { status: 500 }
      );
    }

    logger.info('Transcription completed', {
      videoUid,
      transcriptLength: transcriptResult.transcript.length,
      duration: transcriptResult.duration,
    });

    // Update the lesson with the transcript if lessonId was provided
    if (lessonId) {
      const { error: updateError } = await supabaseAdmin
        .from('course_lessons')
        .update({
          transcript_text: transcriptResult.transcript,
        })
        .eq('id', lessonId);

      if (updateError) {
        logger.error('Failed to update lesson transcript', {
          lessonId,
          error: updateError.message,
        });
      }
    }

    // Generate embeddings if requested
    let embeddingsGenerated = false;
    let chunkCount = 0;

    if (generateEmbeddings && isEmbeddingConfigured() && lessonData) {
      try {
        // Get module info for better metadata
        const { data: moduleData } = await supabaseAdmin
          .from('course_modules')
          .select('title, course_id')
          .eq('id', lessonData.module_id)
          .single();

        const { data: courseData } = moduleData?.course_id
          ? await supabaseAdmin
              .from('courses')
              .select('title')
              .eq('id', moduleData.course_id)
              .single()
          : { data: null };

        // Prepare metadata for embeddings
        const metadata: ChunkMetadata = {
          sourceType: 'lesson',
          sourceId: lessonId!,
          sourceTitle: `${courseData?.title || 'Course'} - ${moduleData?.title || 'Module'} - ${lessonData.title}`,
          topic: inferTopic(lessonData.title),
          difficulty: 'intermediate',
          ltpRelevance: 0.9, // Course lessons are highly LTP-relevant
        };

        // Process and embed the transcript
        const embedResult = await processAndEmbedText(transcriptResult.transcript, metadata);

        if (embedResult.success) {
          embeddingsGenerated = true;
          chunkCount = embedResult.chunkCount || 0;

          logger.info('Embeddings generated for lesson transcript', {
            lessonId,
            chunkCount,
          });
        } else {
          logger.warn('Failed to generate embeddings', {
            lessonId,
            error: embedResult.error,
          });
        }
      } catch (error) {
        logger.error('Error generating embeddings', {
          lessonId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      transcript: transcriptResult.transcript,
      duration: transcriptResult.duration,
      embeddingsGenerated,
      chunkCount,
    });
  } catch (error) {
    logger.error(
      'Error in transcribe endpoint',
      error instanceof Error ? error : { message: String(error) }
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Infer topic from lesson title
 */
function inferTopic(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('level') || lowerTitle.includes('support') || lowerTitle.includes('resistance')) {
    return 'levels';
  }
  if (lowerTitle.includes('trend')) {
    return 'trends';
  }
  if (lowerTitle.includes('patience') || lowerTitle.includes('candle') || lowerTitle.includes('confirmation')) {
    return 'patience candles';
  }
  if (lowerTitle.includes('entry') || lowerTitle.includes('exit') || lowerTitle.includes('stop')) {
    return 'trade management';
  }
  if (lowerTitle.includes('risk') || lowerTitle.includes('position') || lowerTitle.includes('sizing')) {
    return 'risk management';
  }
  if (lowerTitle.includes('psychology') || lowerTitle.includes('emotion') || lowerTitle.includes('mindset')) {
    return 'psychology';
  }
  if (lowerTitle.includes('vwap') || lowerTitle.includes('ema') || lowerTitle.includes('indicator')) {
    return 'indicators';
  }
  if (lowerTitle.includes('ltp') || lowerTitle.includes('methodology')) {
    return 'ltp methodology';
  }

  return 'general';
}
