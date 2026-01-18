/**
 * Transcript Timestamp Utilities
 *
 * Handles timestamp-aware transcript processing and linking for:
 * - AI Coach contextual video references
 * - Quiz remediation with specific video moments
 * - Searchable transcript content with RAG
 */

import { supabaseAdmin } from './supabase';

// ============================================
// Types
// ============================================

export interface TranscriptSegment {
  segmentIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  startFormatted: string;
}

export interface TimestampedChunk {
  content: string;
  startMs: number;
  endMs: number;
  segmentIndices: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  sourceType: 'transcript' | 'document' | 'lesson' | 'manual';
  sourceId: string;
  sourceTitle: string;
  topic?: string;
  subtopic?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  ltpRelevance?: number;
}

export interface VideoTimestampLink {
  videoId: string;
  lessonId?: string;
  moduleSlug?: string;
  lessonSlug?: string;
  startMs: number;
  endMs: number;
  title: string;
  description?: string;
  relevanceScore?: number;
}

export interface RemediationLink {
  quizId: string;
  questionId: string;
  videoId: string;
  startMs: number;
  endMs: number;
  conceptKeywords?: string[];
  relevanceScore: number;
}

// ============================================
// Timestamp Formatting Utilities
// ============================================

/**
 * Convert milliseconds to formatted timestamp string
 * @example formatTimestamp(125000) => "2:05"
 * @example formatTimestamp(3725000) => "1:02:05"
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse formatted timestamp string to milliseconds
 * @example parseTimestamp("2:05") => 125000
 * @example parseTimestamp("1:02:05") => 3725000
 */
export function parseTimestamp(formatted: string): number {
  const parts = formatted.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return (parts[0] * 60 + parts[1]) * 1000;
}

/**
 * Generate YouTube URL with timestamp parameter
 */
export function generateYouTubeTimestampUrl(videoId: string, startMs: number): string {
  const startSeconds = Math.floor(startMs / 1000);
  return `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`;
}

/**
 * Generate internal lesson URL with timestamp parameter
 */
export function generateLessonTimestampUrl(
  moduleSlug: string,
  lessonSlug: string,
  startMs: number
): string {
  return `/learning/${moduleSlug}/${lessonSlug}?t=${startMs}`;
}

/**
 * Format timestamp range for display
 * @example formatTimestampRange(120000, 180000) => "2:00 - 3:00"
 */
export function formatTimestampRange(startMs: number, endMs: number): string {
  return `${formatTimestamp(startMs)} - ${formatTimestamp(endMs)}`;
}

/**
 * Calculate clip duration in seconds
 */
export function getClipDuration(startMs: number, endMs: number): number {
  return Math.round((endMs - startMs) / 1000);
}

// ============================================
// Transcript Fetching & Storage
// ============================================

/**
 * Fetch transcript segments from YouTube and store in database
 */
export async function fetchAndStoreTranscriptSegments(
  videoId: string,
  lessonId?: string
): Promise<TranscriptSegment[]> {
  // Import YouTube library dynamically to avoid circular deps
  const { fetchTranscript } = await import('./youtube');

  // Fetch transcript from YouTube
  const transcriptResult = await fetchTranscript(videoId);

  if (!transcriptResult.success || transcriptResult.segments.length === 0) {
    throw new Error(transcriptResult.error || `No transcript found for video ${videoId}`);
  }

  const rawSegments = transcriptResult.segments;

  // Transform to our format with proper typing
  const segments: TranscriptSegment[] = rawSegments.map((seg, index) => ({
    segmentIndex: index,
    text: seg.text,
    startMs: seg.offset,
    endMs: seg.offset + seg.duration,
    startFormatted: formatTimestamp(seg.offset),
  }));

  // Prepare rows for database insertion
  const segmentRows = segments.map((seg) => ({
    video_id: videoId,
    lesson_id: lessonId || null,
    segment_index: seg.segmentIndex,
    text: seg.text,
    start_ms: seg.startMs,
    end_ms: seg.endMs,
    start_formatted: seg.startFormatted,
  }));

  // Upsert to database (update if exists, insert if not)
  const { error } = await supabaseAdmin
    .from('transcript_segments')
    .upsert(segmentRows, { onConflict: 'video_id,segment_index' });

  if (error) {
    console.error('Error storing transcript segments:', error);
    throw error;
  }

  console.log(`Stored ${segments.length} segments for video ${videoId}`);
  return segments;
}

/**
 * Get all segments for a video from database
 */
export async function getTranscriptSegments(videoId: string): Promise<TranscriptSegment[]> {
  const { data, error } = await supabaseAdmin
    .from('transcript_segments')
    .select('*')
    .eq('video_id', videoId)
    .order('segment_index', { ascending: true });

  if (error) {
    console.error('Error fetching transcript segments:', error);
    return [];
  }

  return (data || []).map((row) => ({
    segmentIndex: row.segment_index,
    text: row.text,
    startMs: row.start_ms,
    endMs: row.end_ms,
    startFormatted: row.start_formatted,
  }));
}

// ============================================
// Timestamp-Aware Chunking
// ============================================

const MAX_CHUNK_CHARS = 1500; // ~375 tokens
const OVERLAP_CHARS = 200; // Overlap for context preservation

/**
 * Process transcript segments into timestamped chunks for RAG
 */
export async function processTranscriptWithTimestamps(
  videoId: string,
  lessonId: string,
  segments: TranscriptSegment[],
  metadata: Partial<ChunkMetadata>
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  const { processAndEmbedText } = await import('./embeddings');

  const chunks: TimestampedChunk[] = [];
  let currentChunk = '';
  let currentStartMs = segments[0]?.startMs || 0;
  let currentSegmentIndices: number[] = [];

  for (const segment of segments) {
    const potentialChunk = currentChunk + ' ' + segment.text;

    if (potentialChunk.length > MAX_CHUNK_CHARS && currentChunk.length > 0) {
      // Finalize current chunk
      const lastSegmentIndex = currentSegmentIndices[currentSegmentIndices.length - 1];
      const endMs = segments[lastSegmentIndex]?.endMs || segment.startMs;

      chunks.push({
        content: currentChunk.trim(),
        startMs: currentStartMs,
        endMs,
        segmentIndices: [...currentSegmentIndices],
        metadata: {
          sourceType: 'transcript',
          sourceId: videoId,
          sourceTitle: metadata.sourceTitle || videoId,
          topic: metadata.topic,
          subtopic: metadata.subtopic,
          difficulty: metadata.difficulty,
          ltpRelevance: metadata.ltpRelevance,
        },
      });

      // Start new chunk with overlap for context continuity
      const overlapText = currentChunk.slice(-OVERLAP_CHARS);
      currentChunk = overlapText + ' ' + segment.text;
      currentStartMs = segment.startMs;
      currentSegmentIndices = [segment.segmentIndex];
    } else {
      currentChunk = potentialChunk;
      currentSegmentIndices.push(segment.segmentIndex);
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      startMs: currentStartMs,
      endMs: segments[segments.length - 1]?.endMs || currentStartMs,
      segmentIndices: currentSegmentIndices,
      metadata: {
        sourceType: 'transcript',
        sourceId: videoId,
        sourceTitle: metadata.sourceTitle || videoId,
        topic: metadata.topic,
        subtopic: metadata.subtopic,
        difficulty: metadata.difficulty,
        ltpRelevance: metadata.ltpRelevance,
      },
    });
  }

  // Process each chunk: generate embeddings and store
  let totalChunks = 0;
  let hasError = false;

  for (const chunk of chunks) {
    try {
      // Generate embedding and store using existing function
      const result = await processAndEmbedText(chunk.content, chunk.metadata);

      if (result.success) {
        totalChunks += result.chunkCount;

        // Update the chunk records with timestamp info (query by source_id since we don't have chunk IDs)
        await supabaseAdmin
          .from('knowledge_chunks')
          .update({
            start_timestamp_ms: chunk.startMs,
            end_timestamp_ms: chunk.endMs,
            segment_indices: chunk.segmentIndices,
          })
          .eq('source_type', 'transcript')
          .eq('source_id', videoId)
          .contains('content', chunk.content.slice(0, 100)); // Match by content prefix
      } else {
        hasError = true;
      }
    } catch (err) {
      console.error(`Error processing chunk for video ${videoId}:`, err);
      hasError = true;
    }
  }

  console.log(`Created ${totalChunks} timestamped chunks for video ${videoId}`);
  return { success: !hasError && totalChunks > 0, chunkCount: totalChunks };
}

// ============================================
// Timestamp Search & Retrieval
// ============================================

/**
 * Find relevant video timestamps using semantic search
 */
export async function findRelevantTimestamps(
  query: string,
  options: {
    videoId?: string;
    lessonId?: string;
    topic?: string;
    limit?: number;
    minRelevance?: number;
  } = {}
): Promise<VideoTimestampLink[]> {
  const { videoId, topic, limit = 5, minRelevance = 0.7 } = options;

  // Generate embedding for the query
  const { generateEmbedding } = await import('./embeddings');
  const queryEmbedding = await generateEmbedding(query);

  // Use the timestamp-aware search function
  const { data: chunks, error } = await supabaseAdmin.rpc(
    'match_knowledge_chunks_with_timestamps',
    {
      query_embedding: queryEmbedding,
      match_threshold: minRelevance,
      match_count: limit,
      filter_source_type: 'transcript',
    }
  );

  if (error) {
    console.error('Error searching timestamps:', error);
    return [];
  }

  // Filter and transform results
  const links: VideoTimestampLink[] = (chunks || [])
    .filter((chunk: any) => chunk.start_timestamp_ms !== null)
    .filter((chunk: any) => !videoId || chunk.source_id === videoId)
    .filter((chunk: any) => !topic || chunk.topic?.toLowerCase().includes(topic.toLowerCase()))
    .map((chunk: any) => ({
      videoId: chunk.source_id,
      startMs: chunk.start_timestamp_ms,
      endMs: chunk.end_timestamp_ms,
      title: chunk.source_title,
      description: chunk.content.slice(0, 150) + '...',
      relevanceScore: chunk.similarity,
    }));

  return links;
}

/**
 * Get chunks at a specific timestamp in a video
 */
export async function getChunksAtTimestamp(
  videoId: string,
  timestampMs: number
): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_chunks')
    .select('*')
    .eq('source_id', videoId)
    .eq('source_type', 'transcript')
    .lte('start_timestamp_ms', timestampMs)
    .gte('end_timestamp_ms', timestampMs);

  if (error) {
    console.error('Error fetching chunks at timestamp:', error);
    return [];
  }

  return data || [];
}

// ============================================
// Quiz Remediation Links
// ============================================

/**
 * Generate remediation links for all questions in a quiz
 * Links each question to the most relevant video timestamp
 */
export async function generateQuizRemediationLinks(
  quizId: string,
  questions: Array<{
    id: string;
    question: string;
    correctOptionId: string;
    explanation: string;
  }>
): Promise<RemediationLink[]> {
  const remediationLinks: RemediationLink[] = [];

  for (const question of questions) {
    // Search for relevant video timestamps based on question + explanation
    const searchQuery = `${question.question} ${question.explanation}`;
    const timestamps = await findRelevantTimestamps(searchQuery, {
      limit: 1,
      minRelevance: 0.6,
    });

    if (timestamps.length > 0) {
      const best = timestamps[0];

      // Store in database
      const { error } = await supabaseAdmin
        .from('quiz_remediation_links')
        .upsert(
          {
            quiz_id: quizId,
            question_id: question.id,
            video_id: best.videoId,
            start_ms: best.startMs,
            end_ms: best.endMs,
            relevance_score: best.relevanceScore,
          },
          { onConflict: 'quiz_id,question_id' }
        );

      if (!error) {
        remediationLinks.push({
          quizId,
          questionId: question.id,
          videoId: best.videoId,
          startMs: best.startMs,
          endMs: best.endMs,
          relevanceScore: best.relevanceScore || 0,
        });
      }
    }
  }

  return remediationLinks;
}

/**
 * Get remediation link for a specific quiz question
 */
export async function getRemediationForQuestion(
  quizId: string,
  questionId: string
): Promise<VideoTimestampLink | null> {
  const { data, error } = await supabaseAdmin
    .from('quiz_remediation_links')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('question_id', questionId)
    .single();

  if (error || !data) return null;

  return {
    videoId: data.video_id,
    startMs: data.start_ms,
    endMs: data.end_ms,
    title: 'Review this concept',
    relevanceScore: data.relevance_score,
  };
}

/**
 * Get all remediation links for a quiz
 */
export async function getQuizRemediationLinks(
  quizId: string
): Promise<Map<string, VideoTimestampLink>> {
  const { data, error } = await supabaseAdmin
    .from('quiz_remediation_links')
    .select('*')
    .eq('quiz_id', quizId);

  if (error || !data) {
    return new Map();
  }

  const linkMap = new Map<string, VideoTimestampLink>();

  for (const row of data) {
    linkMap.set(row.question_id, {
      videoId: row.video_id,
      startMs: row.start_ms,
      endMs: row.end_ms,
      title: 'Review this concept',
      relevanceScore: row.relevance_score,
    });
  }

  return linkMap;
}

// ============================================
// RAG Context Formatting with Timestamps
// ============================================

/**
 * Format RAG results with timestamp information for AI context
 */
export function formatRAGContextWithTimestamps(
  chunks: Array<{
    content: string;
    sourceTitle: string;
    sourceId: string;
    startTimestampMs?: number;
    endTimestampMs?: number;
    similarity: number;
  }>
): string {
  return chunks
    .map((chunk, index) => {
      const timestampInfo =
        chunk.startTimestampMs && chunk.endTimestampMs
          ? ` [Video: ${chunk.sourceId}, Timestamp: ${formatTimestamp(chunk.startTimestampMs)} - ${formatTimestamp(chunk.endTimestampMs)}]`
          : '';

      return `[Source ${index + 1}: ${chunk.sourceTitle}${timestampInfo}]
${chunk.content}
[Relevance: ${(chunk.similarity * 100).toFixed(1)}%]`;
    })
    .join('\n\n---\n\n');
}

/**
 * Create video marker string for AI to use in responses
 */
export function createVideoMarker(
  videoId: string,
  startMs: number,
  endMs: number,
  title: string
): string {
  return `[[VIDEO:${videoId}|${startMs}|${endMs}|${title}]]`;
}

// ============================================
// Batch Processing Utilities
// ============================================

/**
 * Process all curriculum videos and store transcripts
 */
export async function batchProcessCurriculumTranscripts(
  onProgress?: (current: number, total: number, videoId: string) => void
): Promise<{ success: string[]; failed: string[] }> {
  const { CURRICULUM_MODULES } = await import('@/data/curriculum');

  const success: string[] = [];
  const failed: string[] = [];

  // Collect all video IDs with metadata
  const videos: Array<{
    videoId: string;
    lessonId: string;
    lessonTitle: string;
    moduleTitle: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }> = [];

  for (const mod of CURRICULUM_MODULES) {
    const difficulty =
      mod.order <= 2 ? 'beginner' : mod.order <= 5 ? 'intermediate' : 'advanced';

    for (const lesson of mod.lessons) {
      if (lesson.video_id) {
        videos.push({
          videoId: lesson.video_id,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleTitle: mod.title,
          difficulty,
        });
      }
    }
  }

  // Process each video
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    if (onProgress) {
      onProgress(i + 1, videos.length, video.videoId);
    }

    try {
      // Fetch and store segments
      const segments = await fetchAndStoreTranscriptSegments(
        video.videoId,
        video.lessonId
      );

      // Process into timestamped chunks
      await processTranscriptWithTimestamps(video.videoId, video.lessonId, segments, {
        sourceTitle: video.lessonTitle,
        topic: video.moduleTitle,
        subtopic: video.lessonTitle,
        difficulty: video.difficulty,
        ltpRelevance: video.moduleTitle.toLowerCase().includes('ltp') ? 1.0 : 0.5,
      });

      success.push(video.videoId);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`Failed to process video ${video.videoId}:`, err);
      failed.push(video.videoId);
    }
  }

  return { success, failed };
}
