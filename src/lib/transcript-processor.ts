/**
 * Transcript Processing Job
 *
 * Processes YouTube videos from the database, fetches their transcripts,
 * chunks the content, generates embeddings, and stores in knowledge_chunks.
 */

import { fetchTranscript, fetchTranscriptWithTimestamps, extractVideoId } from './youtube';
import { processAndEmbedText, isEmbeddingConfigured, ChunkMetadata } from './embeddings';
import { supabaseAdmin } from './supabase';
import logger from './logger';

export interface ProcessingResult {
  videoId: string;
  title: string;
  success: boolean;
  chunkCount?: number;
  error?: string;
}

export interface BatchProcessingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: ProcessingResult[];
}

/**
 * Get pending videos that need transcript processing
 */
export async function getPendingVideos(limit = 10): Promise<Array<{
  id: string;
  video_id: string;
  title: string;
  topics: string[] | null;
}>> {
  const { data, error } = await supabaseAdmin
    .from('youtube_videos')
    .select('id, video_id, title, topics')
    .eq('transcript_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error('Error fetching pending videos', { error: error.message });
    return [];
  }

  return data || [];
}

/**
 * Process a single video's transcript
 */
export async function processVideoTranscript(
  video: {
    id: string;
    video_id: string;
    title: string;
    topics?: string[] | null;
  }
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    videoId: video.video_id,
    title: video.title,
    success: false,
  };

  try {
    // Mark as processing
    await supabaseAdmin
      .from('youtube_videos')
      .update({ transcript_status: 'processing' })
      .eq('id', video.id);

    logger.info('Processing video transcript', {
      videoId: video.video_id,
      title: video.title,
    });

    // Fetch the transcript
    const transcriptResult = await fetchTranscriptWithTimestamps(video.video_id);

    if (!transcriptResult.success) {
      throw new Error(transcriptResult.error || 'Failed to fetch transcript');
    }

    // Determine topic from video topics array or title
    let topic = 'general';
    if (video.topics && video.topics.length > 0) {
      topic = video.topics[0].toLowerCase();
    } else {
      // Try to infer from title
      const title = video.title.toLowerCase();
      if (title.includes('level') || title.includes('support') || title.includes('resistance')) {
        topic = 'levels';
      } else if (title.includes('trend')) {
        topic = 'trends';
      } else if (title.includes('patience') || title.includes('candle') || title.includes('confirmation')) {
        topic = 'patience candles';
      } else if (title.includes('entry') || title.includes('exit') || title.includes('stop')) {
        topic = 'trade management';
      } else if (title.includes('risk') || title.includes('position')) {
        topic = 'risk management';
      } else if (title.includes('psychology') || title.includes('emotion')) {
        topic = 'psychology';
      }
    }

    // Prepare metadata for embedding
    const metadata: ChunkMetadata = {
      sourceType: 'transcript',
      sourceId: video.video_id,
      sourceTitle: video.title,
      topic,
      difficulty: 'intermediate',
      ltpRelevance: 0.8, // YouTube content is generally LTP-relevant
    };

    // Process and embed
    const embedResult = await processAndEmbedText(transcriptResult.formattedText, metadata);

    if (!embedResult.success) {
      throw new Error(embedResult.error || 'Failed to embed transcript');
    }

    // Update video status
    await supabaseAdmin
      .from('youtube_videos')
      .update({
        transcript_status: 'complete',
        chunk_count: embedResult.chunkCount,
      })
      .eq('id', video.id);

    result.success = true;
    result.chunkCount = embedResult.chunkCount;

    logger.info('Video transcript processed successfully', {
      videoId: video.video_id,
      chunkCount: embedResult.chunkCount,
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update video status to failed
    await supabaseAdmin
      .from('youtube_videos')
      .update({
        transcript_status: 'failed',
      })
      .eq('id', video.id);

    result.error = errorMessage;

    logger.error('Error processing video transcript', {
      videoId: video.video_id,
      error: errorMessage,
    });

    return result;
  }
}

/**
 * Process all pending videos in batch
 */
export async function processPendingVideos(limit = 10): Promise<BatchProcessingResult> {
  const batchResult: BatchProcessingResult = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    results: [],
  };

  // Check if embeddings are configured
  if (!isEmbeddingConfigured()) {
    logger.warn('Transcript processing skipped - OPENAI_API_KEY not configured');
    return batchResult;
  }

  // Get pending videos
  const pendingVideos = await getPendingVideos(limit);

  if (pendingVideos.length === 0) {
    logger.info('No pending videos to process');
    return batchResult;
  }

  logger.info('Starting batch transcript processing', {
    videoCount: pendingVideos.length,
  });

  // Process each video sequentially to avoid rate limits
  for (const video of pendingVideos) {
    const result = await processVideoTranscript(video);
    batchResult.results.push(result);
    batchResult.totalProcessed++;

    if (result.success) {
      batchResult.successful++;
    } else {
      batchResult.failed++;
    }

    // Small delay between videos to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info('Batch transcript processing complete', {
    totalProcessed: batchResult.totalProcessed,
    successful: batchResult.successful,
    failed: batchResult.failed,
  });

  return batchResult;
}

/**
 * Add a YouTube video to the database for processing
 */
export async function addVideoForProcessing(
  videoUrl: string,
  metadata?: {
    title?: string;
    topics?: string[];
    description?: string;
  }
): Promise<{ success: boolean; videoId?: string; error?: string }> {
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return { success: false, error: 'Invalid YouTube URL or video ID' };
  }

  try {
    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from('youtube_videos')
      .select('id, transcript_status')
      .eq('video_id', videoId)
      .single();

    if (existing) {
      return {
        success: true,
        videoId,
        error: `Video already exists with status: ${existing.transcript_status}`,
      };
    }

    // Insert new video
    const { error } = await supabaseAdmin
      .from('youtube_videos')
      .insert({
        video_id: videoId,
        title: metadata?.title || `YouTube Video ${videoId}`,
        description: metadata?.description,
        topics: metadata?.topics,
        transcript_status: 'pending',
      });

    if (error) {
      logger.error('Error adding video for processing', { error: error.message });
      return { success: false, error: error.message };
    }

    logger.info('Video added for processing', { videoId });
    return { success: true, videoId };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error in addVideoForProcessing', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Reprocess a video (reset status and process again)
 */
export async function reprocessVideo(videoId: string): Promise<ProcessingResult> {
  // Get video record
  const { data: video, error } = await supabaseAdmin
    .from('youtube_videos')
    .select('id, video_id, title, topics')
    .eq('video_id', videoId)
    .single();

  if (error || !video) {
    return {
      videoId,
      title: '',
      success: false,
      error: 'Video not found',
    };
  }

  // Reset status to pending
  await supabaseAdmin
    .from('youtube_videos')
    .update({ transcript_status: 'pending' })
    .eq('id', video.id);

  // Process the video
  return processVideoTranscript(video);
}

/**
 * Get processing statistics
 */
export async function getProcessingStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  complete: number;
  failed: number;
}> {
  const { data, error } = await supabaseAdmin
    .from('youtube_videos')
    .select('transcript_status');

  if (error) {
    logger.error('Error fetching processing stats', { error: error.message });
    return { total: 0, pending: 0, processing: 0, complete: 0, failed: 0 };
  }

  const stats = {
    total: data?.length || 0,
    pending: 0,
    processing: 0,
    complete: 0,
    failed: 0,
  };

  for (const row of data || []) {
    switch (row.transcript_status) {
      case 'pending':
        stats.pending++;
        break;
      case 'processing':
        stats.processing++;
        break;
      case 'complete':
        stats.complete++;
        break;
      case 'failed':
        stats.failed++;
        break;
    }
  }

  return stats;
}
