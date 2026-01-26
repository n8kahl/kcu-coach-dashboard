#!/usr/bin/env tsx
/**
 * Transcript Worker
 *
 * Polls the transcript_jobs queue and processes pending jobs.
 * Designed to run as a Railway service (dedicated process).
 *
 * Usage:
 *   npm run transcript-worker          # Production mode
 *   npm run transcript-worker:dry      # Dry run (no writes)
 *   DRY_RUN=1 npm run transcript-worker
 *
 * Environment Variables:
 *   - OPENAI_API_KEY: Required for Whisper transcription and embeddings
 *   - CLOUDFLARE_ACCOUNT_ID: Required for fetching videos
 *   - CLOUDFLARE_API_TOKEN: Required for fetching videos
 *   - SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL: Supabase URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 *   - DRY_RUN: Set to "1" to skip writes
 *   - POLL_INTERVAL_MS: Polling interval (default: 5000)
 *   - WORKER_ID: Unique worker identifier (default: hostname)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import os from 'os';

// ============================================
// Configuration
// ============================================

const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const WORKER_ID = process.env.WORKER_ID || `worker-${os.hostname()}-${process.pid}`;
const LOCK_TIMEOUT_MINUTES = 30;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAI client (lazy init)
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for transcription');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// ============================================
// Types
// ============================================

interface TranscriptJob {
  id: string;
  content_type: string;
  content_id: string;
  attempts: number;
  metadata: {
    video_uid?: string;
    lesson_title?: string;
    module_id?: string;
    module_title?: string;
    course_title?: string;
    course_slug?: string;
    video_duration_seconds?: number;
  };
}

interface TranscriptSegment {
  start: number;  // seconds
  end: number;    // seconds
  text: string;
}

// ============================================
// Logging
// ============================================

function log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.log(JSON.stringify({
    timestamp,
    level,
    event,
    worker_id: WORKER_ID,
    dry_run: DRY_RUN,
    ...data,
  }));
  if (level === 'info') {
    console.log(`${prefix} [${timestamp}] ${event}`, data ? JSON.stringify(data) : '');
  } else if (level === 'warn') {
    console.warn(`${prefix} [${timestamp}] ${event}`, data ? JSON.stringify(data) : '');
  } else {
    console.error(`${prefix} [${timestamp}] ${event}`, data ? JSON.stringify(data) : '');
  }
}

// ============================================
// Job Claiming
// ============================================

async function claimJob(): Promise<TranscriptJob | null> {
  const { data, error } = await supabase.rpc('claim_transcript_job', {
    p_worker_id: WORKER_ID,
    p_lock_timeout_minutes: LOCK_TIMEOUT_MINUTES,
  });

  if (error) {
    log('error', 'claim_job_failed', { error: error.message });
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const job = data[0] as TranscriptJob;
  log('info', 'job_claimed', {
    job_id: job.id,
    content_type: job.content_type,
    content_id: job.content_id,
    attempt: job.attempts,
  });

  return job;
}

async function completeJob(jobId: string): Promise<void> {
  if (DRY_RUN) {
    log('info', 'dry_run_complete_job', { job_id: jobId });
    return;
  }

  const { error } = await supabase.rpc('complete_transcript_job', {
    p_job_id: jobId,
  });

  if (error) {
    log('error', 'complete_job_failed', { job_id: jobId, error: error.message });
  } else {
    log('info', 'job_completed', { job_id: jobId });
  }
}

async function failJob(jobId: string, errorMessage: string, errorCode?: string): Promise<void> {
  if (DRY_RUN) {
    log('info', 'dry_run_fail_job', { job_id: jobId, error: errorMessage });
    return;
  }

  const { error } = await supabase.rpc('fail_transcript_job', {
    p_job_id: jobId,
    p_error: errorMessage,
    p_error_code: errorCode || null,
  });

  if (error) {
    log('error', 'fail_job_rpc_error', { job_id: jobId, error: error.message });
  } else {
    log('warn', 'job_failed', { job_id: jobId, error: errorMessage });
  }
}

// ============================================
// Cloudflare API
// ============================================

async function getCloudflareVideoCaptions(videoUid: string): Promise<{
  success: boolean;
  segments?: TranscriptSegment[];
  text?: string;
  error?: string;
}> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return { success: false, error: 'Cloudflare credentials not configured' };
  }

  try {
    // List available captions
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/captions`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );

    if (!listResponse.ok) {
      return { success: false, error: `Cloudflare API error: ${listResponse.status}` };
    }

    const listData = await listResponse.json();

    if (!listData.success || !listData.result?.length) {
      return { success: false, error: 'No captions available' };
    }

    // Get the first available caption (usually English)
    const caption = listData.result[0];

    // Fetch the caption content (VTT format)
    const captionResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/captions/${caption.language}/vtt`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );

    if (!captionResponse.ok) {
      // Try without /vtt suffix
      const altResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/captions/${caption.language}`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );

      if (!altResponse.ok) {
        return { success: false, error: `Failed to fetch caption content: ${captionResponse.status}` };
      }

      const altData = await altResponse.json();
      if (altData.success && altData.result?.content) {
        const parsed = parseVTT(altData.result.content);
        return { success: true, segments: parsed.segments, text: parsed.text };
      }

      return { success: false, error: 'Failed to parse caption content' };
    }

    const vttContent = await captionResponse.text();
    const parsed = parseVTT(vttContent);

    return { success: true, segments: parsed.segments, text: parsed.text };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function getCloudflareVideoDownloadUrl(videoUid: string): Promise<{
  success: boolean;
  downloadUrl?: string;
  error?: string;
}> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return { success: false, error: 'Cloudflare credentials not configured' };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );

    if (!response.ok) {
      return { success: false, error: `Cloudflare API error: ${response.status}` };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: data.errors?.[0]?.message || 'Failed to get video info' };
    }

    const video = data.result;

    // Try to construct MP4 download URL from HLS URL
    if (video.playback?.hls) {
      const hlsUrl = video.playback.hls;
      const match = hlsUrl.match(/https:\/\/(customer-[^/]+\.cloudflarestream\.com)\/([^/]+)/);

      if (match) {
        const downloadUrl = `https://${match[1]}/${match[2]}/downloads/default.mp4`;
        const checkResponse = await fetch(downloadUrl, { method: 'HEAD' });
        if (checkResponse.ok) {
          return { success: true, downloadUrl };
        }
      }
    }

    return { success: false, error: 'Video downloads not enabled' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================
// VTT Parsing
// ============================================

function parseVTT(vttContent: string): { segments: TranscriptSegment[]; text: string } {
  const segments: TranscriptSegment[] = [];
  const lines = vttContent.split('\n');
  let currentSegment: Partial<TranscriptSegment> | null = null;
  let textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header and empty lines
    if (trimmed === 'WEBVTT' || trimmed.startsWith('Kind:') || trimmed.startsWith('Language:')) {
      continue;
    }

    // Parse timestamp line: 00:00:00.000 --> 00:00:05.000
    const timestampMatch = trimmed.match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);

    if (timestampMatch) {
      // Save previous segment
      if (currentSegment && currentSegment.text) {
        segments.push(currentSegment as TranscriptSegment);
      }

      const startSeconds =
        parseInt(timestampMatch[1]) * 3600 +
        parseInt(timestampMatch[2]) * 60 +
        parseInt(timestampMatch[3]) +
        parseInt(timestampMatch[4]) / 1000;

      const endSeconds =
        parseInt(timestampMatch[5]) * 3600 +
        parseInt(timestampMatch[6]) * 60 +
        parseInt(timestampMatch[7]) +
        parseInt(timestampMatch[8]) / 1000;

      currentSegment = {
        start: startSeconds,
        end: endSeconds,
        text: '',
      };
      textLines = [];
      continue;
    }

    // Skip cue identifiers (numeric lines)
    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    // Collect text lines
    if (currentSegment && trimmed) {
      // Remove HTML tags
      const cleanText = trimmed.replace(/<[^>]+>/g, '');
      textLines.push(cleanText);
      currentSegment.text = textLines.join(' ').trim();
    }
  }

  // Don't forget the last segment
  if (currentSegment && currentSegment.text) {
    segments.push(currentSegment as TranscriptSegment);
  }

  // Build full text
  const fullText = segments.map(s => s.text).join(' ');

  return { segments, text: fullText };
}

// ============================================
// Whisper Transcription
// ============================================

async function transcribeWithWhisper(downloadUrl: string): Promise<{
  success: boolean;
  segments?: TranscriptSegment[];
  text?: string;
  error?: string;
}> {
  try {
    // Fetch the audio file
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      return { success: false, error: `Failed to fetch audio: ${response.status}` };
    }

    // Check file size (Whisper limit is 25MB)
    const contentLength = response.headers.get('content-length');
    const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const maxSizeBytes = 25 * 1024 * 1024;

    if (fileSizeBytes > maxSizeBytes) {
      return {
        success: false,
        error: `File size (${Math.round(fileSizeBytes / 1024 / 1024)}MB) exceeds 25MB limit`,
      };
    }

    // Convert to blob
    const audioBlob = await response.blob();
    const audioFile = new File([audioBlob], 'audio.mp3', {
      type: audioBlob.type || 'audio/mpeg',
    });

    log('info', 'whisper_transcribing', { sizeBytes: audioBlob.size });

    // Call OpenAI Whisper API
    const client = getOpenAI();
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      prompt: 'This is a trading education video about LTP methodology, including topics like levels, trends, patience candles, support, resistance, VWAP, and price action.',
      response_format: 'verbose_json',
    });

    // Extract segments
    const segments: TranscriptSegment[] = [];
    const rawSegments = (transcription as unknown as { segments?: Array<{ start: number; end: number; text: string }> }).segments;

    if (rawSegments && Array.isArray(rawSegments)) {
      for (const seg of rawSegments) {
        segments.push({
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        });
      }
    }

    return {
      success: true,
      segments,
      text: transcription.text,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================
// WebVTT Generation & Upload
// ============================================

function segmentsToWebVTT(segments: TranscriptSegment[]): string {
  const lines: string[] = ['WEBVTT', ''];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const startTime = formatVTTTimestamp(segment.start);
    const endTime = formatVTTTimestamp(segment.end);

    lines.push(`${i + 1}`);
    lines.push(`${startTime} --> ${endTime}`);
    lines.push(segment.text);
    lines.push('');
  }

  return lines.join('\n');
}

function formatVTTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

async function uploadCaptionsToCloudflare(videoUid: string, segments: TranscriptSegment[]): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    log('warn', 'caption_upload_skipped', { reason: 'credentials not configured' });
    return;
  }

  try {
    const vttContent = segmentsToWebVTT(segments);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/captions/en`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'text/vtt',
        },
        body: vttContent,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log('warn', 'caption_upload_failed', { status: response.status, error: errorText });
      return;
    }

    log('info', 'captions_uploaded', { video_uid: videoUid, segment_count: segments.length });
  } catch (error) {
    log('warn', 'caption_upload_error', { error: error instanceof Error ? error.message : String(error) });
  }
}

// ============================================
// Segment Storage
// ============================================

async function saveTranscriptSegments(
  contentType: string,
  contentId: string,
  segments: TranscriptSegment[]
): Promise<void> {
  if (DRY_RUN) {
    log('info', 'dry_run_save_segments', { content_type: contentType, content_id: contentId, count: segments.length });
    return;
  }

  // Delete existing segments
  await supabase
    .from('transcript_segments')
    .delete()
    .eq('content_type', contentType)
    .eq('content_id', contentId);

  // Prepare segment records
  const segmentRecords = segments.map((segment, index) => ({
    content_type: contentType,
    content_id: contentId,
    segment_index: index,
    text: segment.text,
    start_ms: Math.round(segment.start * 1000),
    end_ms: Math.round(segment.end * 1000),
    start_formatted: formatTimestamp(segment.start),
  }));

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < segmentRecords.length; i += batchSize) {
    const batch = segmentRecords.slice(i, i + batchSize);
    const { error } = await supabase.from('transcript_segments').insert(batch);

    if (error) {
      log('error', 'segment_insert_failed', { batch_start: i, error: error.message });
    }
  }

  log('info', 'segments_saved', { content_type: contentType, content_id: contentId, count: segments.length });
}

// ============================================
// Embeddings
// ============================================

interface TimestampedChunk {
  content: string;
  startMs: number;
  endMs: number;
  segmentIndices: number[];
}

function createTimestampedChunks(segments: TranscriptSegment[], maxChars: number = 1500): TimestampedChunk[] {
  const chunks: TimestampedChunk[] = [];
  let currentChunk = '';
  let currentStartMs = segments[0]?.start ? Math.round(segments[0].start * 1000) : 0;
  let currentSegmentIndices: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const potentialChunk = currentChunk + ' ' + segment.text;

    if (potentialChunk.length > maxChars && currentChunk.length > 0) {
      // Finalize current chunk
      const lastIdx = currentSegmentIndices[currentSegmentIndices.length - 1];
      const endMs = segments[lastIdx] ? Math.round(segments[lastIdx].end * 1000) : Math.round(segment.start * 1000);

      chunks.push({
        content: currentChunk.trim(),
        startMs: currentStartMs,
        endMs,
        segmentIndices: [...currentSegmentIndices],
      });

      // Start new chunk
      currentChunk = segment.text;
      currentStartMs = Math.round(segment.start * 1000);
      currentSegmentIndices = [i];
    } else {
      currentChunk = potentialChunk;
      currentSegmentIndices.push(i);
    }
  }

  // Last chunk
  if (currentChunk.trim().length > 0) {
    const lastIdx = currentSegmentIndices[currentSegmentIndices.length - 1];
    chunks.push({
      content: currentChunk.trim(),
      startMs: currentStartMs,
      endMs: segments[lastIdx] ? Math.round(segments[lastIdx].end * 1000) : currentStartMs,
      segmentIndices: currentSegmentIndices,
    });
  }

  return chunks;
}

async function generateAndStoreEmbeddings(
  contentType: string,
  contentId: string,
  segments: TranscriptSegment[],
  metadata: { title: string; topic: string }
): Promise<number> {
  if (DRY_RUN) {
    const chunks = createTimestampedChunks(segments);
    log('info', 'dry_run_embeddings', { content_id: contentId, chunk_count: chunks.length });
    return chunks.length;
  }

  const chunks = createTimestampedChunks(segments);

  if (chunks.length === 0) {
    return 0;
  }

  // Generate embeddings in batch
  const client = getOpenAI();
  const texts = chunks.map(c => c.content.slice(0, 8000));

  let embeddings: number[][] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
      dimensions: 1536,
    });
    embeddings = embeddings.concat(response.data.map(d => d.embedding));
  }

  // Delete existing chunks for this content
  await supabase
    .from('knowledge_chunks')
    .delete()
    .eq('source_type', contentType)
    .eq('source_id', contentId);

  // Prepare chunk records with timestamps
  const chunkRecords = chunks.map((chunk, index) => ({
    content: chunk.content,
    embedding: JSON.stringify(embeddings[index]),
    source_type: contentType,
    source_id: contentId,
    source_title: metadata.title,
    topic: metadata.topic,
    difficulty: 'intermediate',
    ltp_relevance: 0.9,
    chunk_index: index,
    start_timestamp_ms: chunk.startMs,
    end_timestamp_ms: chunk.endMs,
    segment_indices: chunk.segmentIndices,
  }));

  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < chunkRecords.length; i += batchSize) {
    const batch = chunkRecords.slice(i, i + batchSize);
    const { error } = await supabase.from('knowledge_chunks').insert(batch);

    if (error) {
      log('error', 'embedding_insert_failed', { batch_start: i, error: error.message });
    }
  }

  log('info', 'embeddings_stored', { content_id: contentId, chunk_count: chunks.length });

  return chunks.length;
}

// ============================================
// Job Processing
// ============================================

async function processCourseLessonJob(job: TranscriptJob): Promise<void> {
  const lessonId = job.content_id;
  const videoUid = job.metadata.video_uid;

  if (!videoUid) {
    throw new Error('No video_uid in job metadata');
  }

  log('info', 'processing_lesson', {
    lesson_id: lessonId,
    video_uid: videoUid,
    title: job.metadata.lesson_title,
  });

  // Step 1: Try Cloudflare captions first
  let segments: TranscriptSegment[] = [];
  let transcriptText = '';

  const captionsResult = await getCloudflareVideoCaptions(videoUid);

  if (captionsResult.success && captionsResult.segments && captionsResult.segments.length > 0) {
    log('info', 'using_cloudflare_captions', { segment_count: captionsResult.segments.length });
    segments = captionsResult.segments;
    transcriptText = captionsResult.text || segments.map(s => s.text).join(' ');
  } else {
    // Step 2: Fall back to Whisper
    log('info', 'cloudflare_captions_unavailable', { error: captionsResult.error });

    const downloadResult = await getCloudflareVideoDownloadUrl(videoUid);

    if (!downloadResult.success || !downloadResult.downloadUrl) {
      throw new Error(`Cannot download video: ${downloadResult.error}`);
    }

    const whisperResult = await transcribeWithWhisper(downloadResult.downloadUrl);

    if (!whisperResult.success) {
      throw new Error(`Whisper transcription failed: ${whisperResult.error}`);
    }

    segments = whisperResult.segments || [];
    transcriptText = whisperResult.text || segments.map(s => s.text).join(' ');
  }

  if (!transcriptText || transcriptText.length < 50) {
    throw new Error('Transcript too short or empty');
  }

  log('info', 'transcript_obtained', {
    text_length: transcriptText.length,
    segment_count: segments.length,
  });

  // Step 3: Save transcript segments
  if (segments.length > 0) {
    await saveTranscriptSegments('course_lesson', lessonId, segments);
  }

  // Step 4: Update course_lessons with transcript text
  if (!DRY_RUN) {
    const { error: updateError } = await supabase
      .from('course_lessons')
      .update({ transcript_text: transcriptText })
      .eq('id', lessonId);

    if (updateError) {
      log('error', 'lesson_update_failed', { error: updateError.message });
    } else {
      log('info', 'lesson_transcript_updated', { lesson_id: lessonId });
    }
  }

  // Step 5: Upload captions to Cloudflare
  if (segments.length > 0 && !DRY_RUN) {
    await uploadCaptionsToCloudflare(videoUid, segments);
  }

  // Step 6: Generate embeddings with timestamps
  if (segments.length > 0) {
    const title = `${job.metadata.course_title || 'Course'} - ${job.metadata.module_title || 'Module'} - ${job.metadata.lesson_title || 'Lesson'}`;
    const topic = inferTopic(job.metadata.lesson_title || '');

    const chunkCount = await generateAndStoreEmbeddings('course_lesson', lessonId, segments, {
      title,
      topic,
    });

    log('info', 'embeddings_generated', { lesson_id: lessonId, chunk_count: chunkCount });
  }
}

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

async function processJob(job: TranscriptJob): Promise<void> {
  try {
    if (job.content_type === 'course_lesson') {
      await processCourseLessonJob(job);
    } else if (job.content_type === 'youtube_video') {
      // Future: YouTube video processing
      throw new Error(`Unsupported content type: ${job.content_type}`);
    } else {
      throw new Error(`Unknown content type: ${job.content_type}`);
    }

    await completeJob(job.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failJob(job.id, errorMessage);
  }
}

// ============================================
// Main Loop
// ============================================

let isShuttingDown = false;

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  KCU Transcript Worker');
  console.log('========================================');
  console.log(`  Worker ID:     ${WORKER_ID}`);
  console.log(`  Poll Interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`  Dry Run:       ${DRY_RUN}`);
  console.log(`  Supabase:      ${supabaseUrl?.substring(0, 30)}...`);
  console.log('========================================');
  console.log('');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
    isShuttingDown = true;
  });

  process.on('SIGTERM', () => {
    console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
    isShuttingDown = true;
  });

  log('info', 'worker_started', {});

  while (!isShuttingDown) {
    try {
      const job = await claimJob();

      if (job) {
        await processJob(job);
      } else {
        // No job available, wait before polling again
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      log('error', 'main_loop_error', { error: error instanceof Error ? error.message : String(error) });
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  log('info', 'worker_stopped', {});
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
