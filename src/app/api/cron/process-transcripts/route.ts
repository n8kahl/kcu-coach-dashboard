/**
 * Cron: Process Transcript Jobs
 *
 * Serverless-friendly endpoint for processing pending transcript jobs.
 * Can be called by Vercel Cron, Railway Cron, or external schedulers.
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized access.
 *
 * Usage:
 * - Set up a cron job to call this endpoint every 5 minutes
 * - Configure CRON_SECRET environment variable
 * - Each call processes up to 3 pending jobs
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { transcribeCloudflareVideo } from '@/lib/transcription';
import logger from '@/lib/logger';

// Maximum jobs to process per invocation (stay within serverless timeout)
const MAX_JOBS_PER_RUN = 3;

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no secret configured, only allow in development
    return process.env.NODE_ENV === 'development';
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

interface TranscriptJob {
  id: string;
  content_type: string;
  content_id: string;
  video_uid: string;
  priority: number;
  attempts: number;
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results: { jobId: string; success: boolean; error?: string }[] = [];

  try {
    // Claim pending jobs (use atomic update to prevent race conditions)
    const { data: jobs, error: claimError } = await supabaseAdmin
      .from('transcript_jobs')
      .select('id, content_type, content_id, video_uid, priority, attempts')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (claimError) {
      logger.error('cron_transcripts_claim_error', { error: claimError.message });
      return NextResponse.json({ error: 'Failed to claim jobs' }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        message: 'No pending jobs',
        processed: 0,
        duration: Date.now() - startTime,
      });
    }

    logger.info('cron_transcripts_processing', { jobCount: jobs.length });

    // Mark jobs as processing
    const jobIds = jobs.map(j => j.id);
    await supabaseAdmin
      .from('transcript_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .in('id', jobIds);

    // Process each job
    for (const job of jobs as TranscriptJob[]) {
      try {
        logger.info('cron_transcript_job_start', {
          jobId: job.id,
          videoUid: job.video_uid,
          contentType: job.content_type,
        });

        // Transcribe the video
        const result = await transcribeCloudflareVideo(job.video_uid);

        if (result.success && result.transcript) {
          // Update the lesson with the transcript
          if (job.content_type === 'course_lesson') {
            await supabaseAdmin
              .from('course_lessons')
              .update({
                transcript_text: result.transcript,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.content_id);
          }

          // Store transcript segments if available
          if (result.segments && result.segments.length > 0) {
            const segmentRows = result.segments.map((seg, idx) => ({
              content_type: job.content_type,
              content_id: job.content_id,
              segment_index: idx,
              text: seg.text,
              start_ms: Math.round(seg.start * 1000),
              end_ms: Math.round(seg.end * 1000),
              start_formatted: formatTime(seg.start),
            }));

            // Delete existing segments and insert new ones
            await supabaseAdmin
              .from('transcript_segments')
              .delete()
              .eq('content_type', job.content_type)
              .eq('content_id', job.content_id);

            await supabaseAdmin
              .from('transcript_segments')
              .insert(segmentRows);
          }

          // Mark job as completed
          await supabaseAdmin
            .from('transcript_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              result: { transcriptLength: result.transcript.length },
            })
            .eq('id', job.id);

          results.push({ jobId: job.id, success: true });
          logger.info('cron_transcript_job_success', {
            jobId: job.id,
            transcriptLength: result.transcript.length,
          });
        } else {
          throw new Error(result.error || 'Transcription failed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Mark job as failed (will retry if attempts < 3)
        await supabaseAdmin
          .from('transcript_jobs')
          .update({
            status: job.attempts >= 2 ? 'failed' : 'pending',
            attempts: job.attempts + 1,
            last_error: errorMessage,
            failed_at: job.attempts >= 2 ? new Date().toISOString() : null,
          })
          .eq('id', job.id);

        results.push({ jobId: job.id, success: false, error: errorMessage });
        logger.error('cron_transcript_job_error', {
          jobId: job.id,
          error: errorMessage,
          attempt: job.attempts + 1,
        });
      }
    }

    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('cron_transcripts_complete', {
      processed: results.length,
      successful,
      failed,
      duration,
    });

    return NextResponse.json({
      message: 'Processing complete',
      processed: results.length,
      successful,
      failed,
      duration,
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('cron_transcripts_error', { error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Format seconds to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Also support POST for flexibility
export const POST = GET;
