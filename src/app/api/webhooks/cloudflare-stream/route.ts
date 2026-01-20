/**
 * Cloudflare Stream Webhook Handler
 *
 * Receives notifications when video processing completes and
 * automatically triggers transcript generation using Whisper.
 *
 * Webhook Setup (in Cloudflare Dashboard):
 * 1. Go to Stream > Settings > Webhooks
 * 2. Add webhook URL: https://your-domain.com/api/webhooks/cloudflare-stream
 * 3. Copy the signing secret to CLOUDFLARE_WEBHOOK_SECRET env var
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  transcribeCloudflareVideo,
  isTranscriptionConfigured,
  type TranscriptSegment,
} from '@/lib/transcription';
import { processAndEmbedText, isEmbeddingConfigured, ChunkMetadata } from '@/lib/embeddings';
import logger from '@/lib/logger';
import crypto from 'crypto';

/**
 * Cloudflare Stream webhook payload structure
 */
interface CloudflareStreamWebhook {
  uid: string;
  readyToStream: boolean;
  status: {
    state: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta?: {
    lessonId?: string;
    filename?: string;
    [key: string]: unknown;
  };
  created?: string;
  modified?: string;
  duration?: number;
  size?: number;
  input?: {
    width?: number;
    height?: number;
  };
  playback?: {
    hls?: string;
    dash?: string;
  };
  thumbnail?: string;
}

/**
 * Verify Cloudflare webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  // Cloudflare uses HMAC-SHA256 for webhook signatures
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Compare signatures in constant time to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/cloudflare-stream
 *
 * Handles Cloudflare Stream webhook notifications:
 * - When video state becomes 'ready', triggers auto-transcription
 * - Updates lesson with video duration and playback URLs
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    // Get webhook secret for signature verification
    const webhookSecret = process.env.CLOUDFLARE_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret) {
      const signature = request.headers.get('webhook-signature');
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        logger.warn('Cloudflare webhook signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhook: CloudflareStreamWebhook = JSON.parse(rawBody);

    logger.info('Cloudflare Stream webhook received', {
      uid: webhook.uid,
      state: webhook.status?.state,
      readyToStream: webhook.readyToStream,
      meta: webhook.meta,
    });

    // Only process when video is ready
    if (webhook.status?.state !== 'ready' || !webhook.readyToStream) {
      logger.info('Video not ready yet, skipping', {
        uid: webhook.uid,
        state: webhook.status?.state,
      });
      return NextResponse.json({ received: true, action: 'skipped' });
    }

    // Find the lesson associated with this video
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('course_lessons')
      .select('id, title, module_id, transcript_text, video_status')
      .eq('video_uid', webhook.uid)
      .single();

    if (lessonError || !lesson) {
      // Video may not be associated with a lesson yet - that's OK
      logger.info('No lesson found for video UID', { uid: webhook.uid });
      return NextResponse.json({
        received: true,
        action: 'no_lesson_found',
        uid: webhook.uid,
      });
    }

    logger.info('Found lesson for video', {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
    });

    // Update lesson with video status and metadata
    const updateData: Record<string, unknown> = {
      video_status: 'ready',
      video_duration_seconds: webhook.duration ? Math.round(webhook.duration) : undefined,
      video_playback_hls: webhook.playback?.hls,
      video_playback_dash: webhook.playback?.dash,
      thumbnail_url: webhook.thumbnail,
    };

    await supabaseAdmin
      .from('course_lessons')
      .update(updateData)
      .eq('id', lesson.id);

    // Check if transcription is needed (no existing transcript)
    const needsTranscription = !lesson.transcript_text || lesson.transcript_text.length < 100;

    if (!needsTranscription) {
      logger.info('Lesson already has transcript, skipping transcription', {
        lessonId: lesson.id,
        transcriptLength: lesson.transcript_text?.length,
      });
      return NextResponse.json({
        received: true,
        action: 'video_updated',
        lessonId: lesson.id,
        transcription: 'skipped_existing',
      });
    }

    // Check if transcription is configured
    if (!isTranscriptionConfigured()) {
      logger.warn('Transcription not configured, skipping auto-transcription', {
        lessonId: lesson.id,
      });
      return NextResponse.json({
        received: true,
        action: 'video_updated',
        lessonId: lesson.id,
        transcription: 'skipped_not_configured',
      });
    }

    // Trigger transcription asynchronously (don't block webhook response)
    // We'll use a fire-and-forget pattern with error handling
    transcribeAndEmbed(lesson.id, webhook.uid, lesson.title, lesson.module_id).catch((error) => {
      logger.error('Async transcription failed', {
        lessonId: lesson.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return NextResponse.json({
      received: true,
      action: 'transcription_started',
      lessonId: lesson.id,
      videoUid: webhook.uid,
    });
  } catch (error) {
    logger.error('Error processing Cloudflare webhook', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Always return 200 to prevent Cloudflare from retrying
    return NextResponse.json({
      received: true,
      error: 'Processing error',
    });
  }
}

/**
 * Transcribe video and generate embeddings
 */
async function transcribeAndEmbed(
  lessonId: string,
  videoUid: string,
  lessonTitle: string,
  moduleId: string
): Promise<void> {
  logger.info('Starting auto-transcription', { lessonId, videoUid });

  // Update status to indicate transcription is in progress
  await supabaseAdmin
    .from('course_lessons')
    .update({ video_status: 'transcribing' })
    .eq('id', lessonId);

  try {
    // Generate transcript using Whisper
    const transcriptResult = await transcribeCloudflareVideo(videoUid);

    if (!transcriptResult.success || !transcriptResult.transcript) {
      logger.error('Auto-transcription failed', {
        lessonId,
        error: transcriptResult.error,
      });

      // Update status but don't fail the lesson
      await supabaseAdmin
        .from('course_lessons')
        .update({ video_status: 'ready' })
        .eq('id', lessonId);

      return;
    }

    logger.info('Auto-transcription completed', {
      lessonId,
      transcriptLength: transcriptResult.transcript.length,
      segmentCount: transcriptResult.segments?.length || 0,
    });

    // Save transcript to lesson
    await supabaseAdmin
      .from('course_lessons')
      .update({
        transcript_text: transcriptResult.transcript,
        video_status: 'ready',
      })
      .eq('id', lessonId);

    // Save timestamped segments for AI video linking
    if (transcriptResult.segments && transcriptResult.segments.length > 0) {
      await saveTranscriptSegments(videoUid, lessonId, transcriptResult.segments);

      // Upload captions to Cloudflare Stream for video player display
      await uploadCaptionsToCloudflare(videoUid, transcriptResult.segments);
    }

    // Generate embeddings if configured
    if (isEmbeddingConfigured()) {
      try {
        // Get module and course info for better metadata
        const { data: moduleData } = await supabaseAdmin
          .from('course_modules')
          .select('title, course_id')
          .eq('id', moduleId)
          .single();

        const { data: courseData } = moduleData?.course_id
          ? await supabaseAdmin
              .from('courses')
              .select('title')
              .eq('id', moduleData.course_id)
              .single()
          : { data: null };

        const metadata: ChunkMetadata = {
          sourceType: 'lesson',
          sourceId: lessonId,
          sourceTitle: `${courseData?.title || 'Course'} - ${moduleData?.title || 'Module'} - ${lessonTitle}`,
          topic: inferTopicFromTitle(lessonTitle),
          difficulty: 'intermediate',
          ltpRelevance: 0.9,
        };

        const embedResult = await processAndEmbedText(transcriptResult.transcript, metadata);

        if (embedResult.success) {
          logger.info('Auto-generated embeddings for lesson', {
            lessonId,
            chunkCount: embedResult.chunkCount,
          });
        }
      } catch (embedError) {
        logger.error('Failed to generate embeddings', {
          lessonId,
          error: embedError instanceof Error ? embedError.message : String(embedError),
        });
      }
    }
  } catch (error) {
    logger.error('Auto-transcription process failed', {
      lessonId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Reset status
    await supabaseAdmin
      .from('course_lessons')
      .update({ video_status: 'ready' })
      .eq('id', lessonId);
  }
}

/**
 * Infer topic from lesson title
 */
function inferTopicFromTitle(title: string): string {
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

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Save timestamped transcript segments to database
 * Enables AI to link to specific video timestamps
 */
async function saveTranscriptSegments(
  videoUid: string,
  lessonId: string,
  segments: TranscriptSegment[]
): Promise<void> {
  try {
    // Delete existing segments for this video (in case of re-transcription)
    await supabaseAdmin
      .from('transcript_segments')
      .delete()
      .eq('video_id', videoUid);

    // Prepare segment records
    const segmentRecords = segments.map((segment, index) => ({
      video_id: videoUid,
      lesson_id: lessonId,
      segment_index: index,
      text: segment.text,
      start_ms: Math.round(segment.start * 1000),
      end_ms: Math.round(segment.end * 1000),
      start_formatted: formatTimestamp(segment.start),
    }));

    // Insert in batches of 100 to avoid hitting limits
    const batchSize = 100;
    for (let i = 0; i < segmentRecords.length; i += batchSize) {
      const batch = segmentRecords.slice(i, i + batchSize);
      const { error } = await supabaseAdmin
        .from('transcript_segments')
        .insert(batch);

      if (error) {
        logger.error('Failed to insert transcript segments batch', {
          videoUid,
          batchStart: i,
          error: error.message,
        });
      }
    }

    // Update processing status
    await supabaseAdmin
      .from('transcript_processing_status')
      .upsert({
        video_id: videoUid,
        lesson_id: lessonId,
        status: 'completed',
        segments_count: segments.length,
        processed_at: new Date().toISOString(),
      }, {
        onConflict: 'video_id',
      });

    logger.info('Saved transcript segments', {
      videoUid,
      lessonId,
      segmentCount: segments.length,
    });
  } catch (error) {
    logger.error('Error saving transcript segments', {
      videoUid,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Format seconds to WebVTT timestamp format (HH:MM:SS.mmm)
 */
function formatVttTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Convert transcript segments to WebVTT format
 */
function segmentsToWebVTT(segments: TranscriptSegment[]): string {
  const lines: string[] = ['WEBVTT', ''];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const startTime = formatVttTimestamp(segment.start);
    const endTime = formatVttTimestamp(segment.end);

    lines.push(`${i + 1}`);
    lines.push(`${startTime} --> ${endTime}`);
    lines.push(segment.text);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Upload WebVTT captions to Cloudflare Stream
 * This enables captions in the video player
 */
async function uploadCaptionsToCloudflare(
  videoUid: string,
  segments: TranscriptSegment[],
  language: string = 'en'
): Promise<void> {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      logger.warn('Cloudflare credentials not configured, skipping caption upload');
      return;
    }

    // Convert segments to WebVTT format
    const webvttContent = segmentsToWebVTT(segments);

    // Upload captions to Cloudflare Stream
    // PUT https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{video_uid}/captions/{language}
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/captions/${language}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'text/vtt',
        },
        body: webvttContent,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.errors?.[0]?.message || 'Unknown error');
    }

    logger.info('Uploaded captions to Cloudflare Stream', {
      videoUid,
      language,
      segmentCount: segments.length,
    });
  } catch (error) {
    // Don't fail the whole process if caption upload fails
    logger.error('Failed to upload captions to Cloudflare', {
      videoUid,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
