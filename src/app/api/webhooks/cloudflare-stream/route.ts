/**
 * Cloudflare Stream Webhook Handler
 *
 * Receives notifications when video processing completes and
 * enqueues transcript jobs for durable processing.
 *
 * Webhook Setup (in Cloudflare Dashboard):
 * 1. Go to Stream > Settings > Webhooks
 * 2. Add webhook URL: https://your-domain.com/api/webhooks/cloudflare-stream
 * 3. Copy the signing secret to CLOUDFLARE_WEBHOOK_SECRET env var
 *
 * NOTE: This webhook only enqueues jobs. Actual transcription is handled
 * by the transcript-worker service (scripts/transcript-worker.ts).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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
 * Verify Cloudflare webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
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
 * - Updates lesson with video metadata when ready
 * - Enqueues transcript job for durable processing
 *
 * Returns 200 quickly to acknowledge receipt.
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  const rawBody = await request.text();

  try {
    // =========================================
    // 1. Signature Verification
    // =========================================
    const webhookSecret = process.env.CLOUDFLARE_WEBHOOK_SECRET;

    if (webhookSecret) {
      const signature = request.headers.get('webhook-signature');
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        logger.warn('cloudflare_webhook_signature_invalid', {
          hasSignature: !!signature,
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhook: CloudflareStreamWebhook = JSON.parse(rawBody);

    logger.info('cloudflare_webhook_received', {
      videoUid: webhook.uid,
      state: webhook.status?.state,
      readyToStream: webhook.readyToStream,
      duration: webhook.duration,
    });

    // =========================================
    // 2. Check if Video is Ready
    // =========================================
    if (webhook.status?.state !== 'ready' || !webhook.readyToStream) {
      logger.info('cloudflare_webhook_skipped_not_ready', {
        videoUid: webhook.uid,
        state: webhook.status?.state,
      });
      return NextResponse.json({
        received: true,
        action: 'skipped',
        reason: 'video_not_ready',
        durationMs: Date.now() - startTime,
      });
    }

    // =========================================
    // 3. Find Associated Lesson
    // =========================================
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('course_lessons')
      .select(`
        id,
        title,
        module_id,
        transcript_text,
        video_status,
        course_modules!inner (
          title,
          course_id,
          courses!inner (
            title,
            slug
          )
        )
      `)
      .eq('video_uid', webhook.uid)
      .single();

    if (lessonError || !lesson) {
      logger.info('cloudflare_webhook_no_lesson', {
        videoUid: webhook.uid,
        error: lessonError?.message,
      });
      return NextResponse.json({
        received: true,
        action: 'no_lesson_found',
        videoUid: webhook.uid,
        durationMs: Date.now() - startTime,
      });
    }

    logger.info('cloudflare_webhook_lesson_matched', {
      videoUid: webhook.uid,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
    });

    // =========================================
    // 4. Update Lesson Video Metadata
    // =========================================
    const updateData: Record<string, unknown> = {
      video_status: 'ready',
      video_duration_seconds: webhook.duration ? Math.round(webhook.duration) : null,
      video_playback_hls: webhook.playback?.hls ?? null,
      video_playback_dash: webhook.playback?.dash ?? null,
      thumbnail_url: webhook.thumbnail ?? null,
    };

    const { error: updateError } = await supabaseAdmin
      .from('course_lessons')
      .update(updateData)
      .eq('id', lesson.id);

    if (updateError) {
      logger.error('cloudflare_webhook_update_failed', {
        lessonId: lesson.id,
        error: updateError.message,
      });
    }

    // =========================================
    // 5. Check if Transcription Needed
    // =========================================
    const hasExistingTranscript = lesson.transcript_text && lesson.transcript_text.length >= 100;

    if (hasExistingTranscript) {
      logger.info('cloudflare_webhook_transcript_exists', {
        lessonId: lesson.id,
        transcriptLength: lesson.transcript_text?.length,
      });
      return NextResponse.json({
        received: true,
        action: 'video_updated',
        lessonId: lesson.id,
        transcription: 'skipped_existing',
        durationMs: Date.now() - startTime,
      });
    }

    // =========================================
    // 6. Enqueue Transcript Job (Idempotent)
    // =========================================
    // Extract course/module info for job metadata
    const moduleData = lesson.course_modules as { title: string; course_id: string; courses: { title: string; slug: string } };

    const jobMetadata = {
      video_uid: webhook.uid,
      lesson_title: lesson.title,
      module_id: lesson.module_id,
      module_title: moduleData?.title,
      course_title: moduleData?.courses?.title,
      course_slug: moduleData?.courses?.slug,
      video_duration_seconds: webhook.duration ? Math.round(webhook.duration) : null,
    };

    // Use upsert with ON CONFLICT to ensure idempotency
    // If a job already exists for this lesson, this is a no-op
    const { data: job, error: jobError } = await supabaseAdmin
      .from('transcript_jobs')
      .upsert(
        {
          content_type: 'course_lesson',
          content_id: lesson.id,
          status: 'pending',
          priority: 0,
          metadata: jobMetadata,
          next_retry_at: new Date().toISOString(),
        },
        {
          onConflict: 'content_type,content_id',
          ignoreDuplicates: true, // Don't update if exists
        }
      )
      .select('id, status')
      .single();

    if (jobError) {
      // Check if it's a duplicate (job already exists)
      if (jobError.code === '23505' || jobError.message?.includes('duplicate')) {
        logger.info('cloudflare_webhook_job_exists', {
          lessonId: lesson.id,
          videoUid: webhook.uid,
        });
        return NextResponse.json({
          received: true,
          action: 'job_already_exists',
          lessonId: lesson.id,
          durationMs: Date.now() - startTime,
        });
      }

      // Check if it failed because a completed/processing job exists
      const { data: existingJob } = await supabaseAdmin
        .from('transcript_jobs')
        .select('id, status')
        .eq('content_type', 'course_lesson')
        .eq('content_id', lesson.id)
        .single();

      if (existingJob) {
        logger.info('cloudflare_webhook_job_skipped', {
          lessonId: lesson.id,
          existingJobId: existingJob.id,
          existingStatus: existingJob.status,
        });
        return NextResponse.json({
          received: true,
          action: 'job_already_exists',
          lessonId: lesson.id,
          jobStatus: existingJob.status,
          durationMs: Date.now() - startTime,
        });
      }

      // Actual error
      logger.error('cloudflare_webhook_job_enqueue_failed', {
        lessonId: lesson.id,
        error: jobError.message,
      });
      return NextResponse.json({
        received: true,
        action: 'enqueue_failed',
        lessonId: lesson.id,
        error: jobError.message,
        durationMs: Date.now() - startTime,
      });
    }

    logger.info('cloudflare_webhook_job_enqueued', {
      lessonId: lesson.id,
      jobId: job?.id,
      videoUid: webhook.uid,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json({
      received: true,
      action: 'job_enqueued',
      lessonId: lesson.id,
      jobId: job?.id,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('cloudflare_webhook_error', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    // Always return 200 to prevent Cloudflare from excessive retries
    return NextResponse.json({
      received: true,
      error: 'Processing error',
      durationMs: Date.now() - startTime,
    });
  }
}
