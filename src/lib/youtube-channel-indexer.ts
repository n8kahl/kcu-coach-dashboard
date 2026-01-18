/**
 * YouTube Channel Indexer
 *
 * Indexes all videos from the KayCapitals YouTube channel for:
 * - AI Coach remediation and contextual learning
 * - Supplementary content outside Thinkific courses
 * - Searchable video library with timestamps
 *
 * Uses YouTube Data API v3 to fetch channel videos and playlists,
 * then fetches transcripts for RAG indexing.
 */

import { supabaseAdmin } from './supabase';
import { fetchTranscript, extractVideoId, type TranscriptSegment } from './youtube';
import { processAndEmbedText, type ChunkMetadata } from './embeddings';
import { formatTimestamp } from './transcript-timestamps';
import logger from './logger';

// ============================================
// Types
// ============================================

export interface YouTubeVideo {
  id: string;
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  channelId: string;
  channelTitle: string;
  duration?: string;
  viewCount?: number;
  tags?: string[];
  playlistId?: string;
  playlistTitle?: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoCount: number;
  channelId: string;
}

export interface IndexedVideo extends YouTubeVideo {
  transcriptStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
  segmentsCount: number;
  chunksCount: number;
  lastIndexedAt?: string;
  errorMessage?: string;
  // Categorization
  category?: string;
  topics?: string[];
  ltpRelevance?: number;
}

export interface ChannelIndexStats {
  totalVideos: number;
  indexedVideos: number;
  failedVideos: number;
  pendingVideos: number;
  totalSegments: number;
  totalChunks: number;
  lastSyncAt?: string;
}

export interface VideoSearchResult {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  startMs: number;
  endMs: number;
  matchedText: string;
  relevanceScore: number;
  youtubeUrl: string;
}

// ============================================
// Configuration
// ============================================

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const KAY_CAPITALS_CHANNEL_ID = process.env.KAY_CAPITALS_CHANNEL_ID || 'UC_YOUR_CHANNEL_ID'; // Update with actual channel ID

/**
 * Check if YouTube API is configured
 */
export function isYouTubeConfigured(): boolean {
  return !!(YOUTUBE_API_KEY && KAY_CAPITALS_CHANNEL_ID && KAY_CAPITALS_CHANNEL_ID !== 'UC_YOUR_CHANNEL_ID');
}

/**
 * Get channel sync status from database
 */
export async function getChannelSyncStatus(channelId: string = KAY_CAPITALS_CHANNEL_ID): Promise<{
  channel_id: string;
  channel_name: string | null;
  last_sync_at: string | null;
  total_videos: number;
  indexed_videos: number;
  failed_videos: number;
  sync_status: 'idle' | 'syncing' | 'completed' | 'failed';
  error_message: string | null;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('youtube_channel_sync')
    .select('*')
    .eq('channel_id', channelId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get related videos based on category and topics
 */
export async function getRelatedVideos(
  videoId: string,
  limit: number = 5
): Promise<VideoSearchResult[]> {
  // First get the source video's category
  const { data: sourceVideo } = await supabaseAdmin
    .from('youtube_videos')
    .select('category, topics')
    .eq('video_id', videoId)
    .single();

  if (!sourceVideo) return [];

  // Find videos with same category or overlapping topics
  let query = supabaseAdmin
    .from('youtube_videos')
    .select('*')
    .neq('video_id', videoId)
    .eq('transcript_status', 'completed');

  if (sourceVideo.category) {
    query = query.eq('category', sourceVideo.category);
  }

  const { data: videos, error } = await query.limit(limit);

  if (error || !videos) return [];

  return videos.map(v => ({
    videoId: v.video_id,
    title: v.title,
    description: v.description || '',
    thumbnailUrl: v.thumbnail_url,
    startMs: 0,
    endMs: 0,
    matchedText: '',
    relevanceScore: v.ltp_relevance || 0,
    youtubeUrl: `https://www.youtube.com/watch?v=${v.video_id}`,
  }));
}

/**
 * Get videos by category
 */
export async function getVideosByCategory(
  category: string,
  limit: number = 10
): Promise<VideoSearchResult[]> {
  const { data: videos, error } = await supabaseAdmin
    .from('youtube_videos')
    .select('*')
    .eq('category', category)
    .eq('transcript_status', 'completed')
    .order('ltp_relevance', { ascending: false })
    .limit(limit);

  if (error || !videos) return [];

  return videos.map(v => ({
    videoId: v.video_id,
    title: v.title,
    description: v.description || '',
    thumbnailUrl: v.thumbnail_url,
    startMs: 0,
    endMs: 0,
    matchedText: '',
    relevanceScore: v.ltp_relevance || 0,
    youtubeUrl: `https://www.youtube.com/watch?v=${v.video_id}`,
  }));
}

// Video categorization keywords for automatic tagging
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'LTP Framework': ['ltp', 'levels', 'trends', 'patience', 'patience candle', 'hourly level'],
  'Price Action': ['price action', 'candlestick', 'candle', 'bar by bar', 'momentum'],
  'Indicators': ['ema', 'vwap', 'moving average', 'indicator', 'cloud', 'ripster'],
  'Psychology': ['psychology', 'mindset', 'discipline', 'emotions', 'fear', 'fomo', 'revenge'],
  'Risk Management': ['risk', 'stop loss', 'position size', 'r:r', 'risk reward'],
  'Strategies': ['orb', 'opening range', 'gap', 'breakout', 'strategy', 'setup'],
  'Live Trading': ['live', 'trading live', 'real time', 'market open'],
  'Education': ['how to', 'tutorial', 'guide', 'learn', 'basics', 'beginner'],
  'Trade Review': ['review', 'recap', 'analysis', 'breakdown'],
};

// ============================================
// YouTube API Functions
// ============================================

/**
 * Fetch all videos from a YouTube channel
 */
export async function fetchChannelVideos(
  channelId: string = KAY_CAPITALS_CHANNEL_ID,
  maxResults: number = 500
): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const videos: YouTubeVideo[] = [];
  let nextPageToken: string | undefined;

  logger.info('Fetching channel videos', { channelId, maxResults });

  // First, get the uploads playlist ID
  const channelResponse = await fetch(
    `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`
  );

  if (!channelResponse.ok) {
    throw new Error(`Failed to fetch channel info: ${channelResponse.statusText}`);
  }

  const channelData = await channelResponse.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error('Could not find uploads playlist for channel');
  }

  // Fetch all videos from uploads playlist
  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
      key: YOUTUBE_API_KEY,
    });

    if (nextPageToken) {
      params.append('pageToken', nextPageToken);
    }

    const response = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch playlist items: ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      const snippet = item.snippet;
      const videoId = snippet.resourceId?.videoId;

      if (videoId) {
        videos.push({
          id: item.id,
          videoId,
          title: snippet.title,
          description: snippet.description || '',
          publishedAt: snippet.publishedAt,
          thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle,
        });
      }
    }

    nextPageToken = data.nextPageToken;

    // Respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (nextPageToken && videos.length < maxResults);

  logger.info('Fetched channel videos', { count: videos.length });

  return videos;
}

/**
 * Fetch playlists from a YouTube channel
 */
export async function fetchChannelPlaylists(
  channelId: string = KAY_CAPITALS_CHANNEL_ID
): Promise<YouTubePlaylist[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const playlists: YouTubePlaylist[] = [];
  let nextPageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      channelId,
      maxResults: '50',
      key: YOUTUBE_API_KEY,
    });

    if (nextPageToken) {
      params.append('pageToken', nextPageToken);
    }

    const response = await fetch(`${YOUTUBE_API_BASE}/playlists?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      playlists.push({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description || '',
        thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        videoCount: item.contentDetails?.itemCount || 0,
        channelId: item.snippet.channelId,
      });
    }

    nextPageToken = data.nextPageToken;

  } while (nextPageToken);

  return playlists;
}

/**
 * Fetch videos from a specific playlist
 */
export async function fetchPlaylistVideos(playlistId: string): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const videos: YouTubeVideo[] = [];
  let nextPageToken: string | undefined;

  // Get playlist title first
  const playlistResponse = await fetch(
    `${YOUTUBE_API_BASE}/playlists?part=snippet&id=${playlistId}&key=${YOUTUBE_API_KEY}`
  );
  const playlistData = await playlistResponse.json();
  const playlistTitle = playlistData.items?.[0]?.snippet?.title || 'Unknown Playlist';

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
      key: YOUTUBE_API_KEY,
    });

    if (nextPageToken) {
      params.append('pageToken', nextPageToken);
    }

    const response = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch playlist items: ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      const snippet = item.snippet;
      const videoId = snippet.resourceId?.videoId;

      if (videoId) {
        videos.push({
          id: item.id,
          videoId,
          title: snippet.title,
          description: snippet.description || '',
          publishedAt: snippet.publishedAt,
          thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle,
          playlistId,
          playlistTitle,
        });
      }
    }

    nextPageToken = data.nextPageToken;
    await new Promise(resolve => setTimeout(resolve, 100));

  } while (nextPageToken);

  return videos;
}

// ============================================
// Video Categorization
// ============================================

/**
 * Automatically categorize a video based on title and description
 */
export function categorizeVideo(title: string, description: string): {
  category: string;
  topics: string[];
  ltpRelevance: number;
} {
  const text = `${title} ${description}`.toLowerCase();
  const matchedCategories: string[] = [];
  const topics: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        if (!matchedCategories.includes(category)) {
          matchedCategories.push(category);
        }
        if (!topics.includes(keyword)) {
          topics.push(keyword);
        }
      }
    }
  }

  // Calculate LTP relevance (0-1)
  const ltpKeywords = ['ltp', 'levels', 'trends', 'patience', 'hourly', 'candle'];
  const ltpMatches = ltpKeywords.filter(k => text.includes(k)).length;
  const ltpRelevance = Math.min(ltpMatches / 3, 1);

  return {
    category: matchedCategories[0] || 'General',
    topics: topics.slice(0, 10), // Limit to 10 topics
    ltpRelevance,
  };
}

// ============================================
// Database Operations
// ============================================

/**
 * Store or update a video in the database
 */
export async function upsertVideo(video: YouTubeVideo): Promise<void> {
  const categorization = categorizeVideo(video.title, video.description);

  const { error } = await supabaseAdmin
    .from('youtube_videos')
    .upsert({
      video_id: video.videoId,
      title: video.title,
      description: video.description,
      published_at: video.publishedAt,
      thumbnail_url: video.thumbnailUrl,
      channel_id: video.channelId,
      channel_title: video.channelTitle,
      playlist_id: video.playlistId,
      playlist_title: video.playlistTitle,
      category: categorization.category,
      topics: categorization.topics,
      ltp_relevance: categorization.ltpRelevance,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'video_id',
    });

  if (error) {
    logger.error('Error upserting video', { videoId: video.videoId, error });
    throw error;
  }
}

/**
 * Get videos that need transcript processing
 */
export async function getPendingVideos(limit: number = 10): Promise<IndexedVideo[]> {
  const { data, error } = await supabaseAdmin
    .from('youtube_videos')
    .select('*')
    .in('transcript_status', ['pending', null])
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Error fetching pending videos', { error });
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    videoId: row.video_id,
    title: row.title,
    description: row.description,
    publishedAt: row.published_at,
    thumbnailUrl: row.thumbnail_url,
    channelId: row.channel_id,
    channelTitle: row.channel_title,
    playlistId: row.playlist_id,
    playlistTitle: row.playlist_title,
    transcriptStatus: row.transcript_status || 'pending',
    segmentsCount: row.segments_count || 0,
    chunksCount: row.chunks_count || 0,
    category: row.category,
    topics: row.topics,
    ltpRelevance: row.ltp_relevance,
  }));
}

/**
 * Update video transcript status
 */
export async function updateVideoStatus(
  videoId: string,
  status: IndexedVideo['transcriptStatus'],
  stats?: { segmentsCount?: number; chunksCount?: number; errorMessage?: string }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('youtube_videos')
    .update({
      transcript_status: status,
      segments_count: stats?.segmentsCount,
      chunks_count: stats?.chunksCount,
      error_message: stats?.errorMessage,
      last_indexed_at: status === 'completed' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('video_id', videoId);

  if (error) {
    logger.error('Error updating video status', { videoId, error });
  }
}

// ============================================
// Transcript Processing
// ============================================

/**
 * Process a single video: fetch transcript and create embeddings
 */
export async function processVideoTranscript(
  video: YouTubeVideo | IndexedVideo
): Promise<{ success: boolean; segmentsCount: number; chunksCount: number; error?: string }> {
  logger.info('Processing video transcript', { videoId: video.videoId, title: video.title });

  await updateVideoStatus(video.videoId, 'processing');

  try {
    // Fetch transcript from YouTube
    const transcriptResult = await fetchTranscript(video.videoId);

    if (!transcriptResult.success || transcriptResult.segments.length === 0) {
      await updateVideoStatus(video.videoId, 'unavailable', {
        errorMessage: transcriptResult.error || 'No transcript available',
      });
      return {
        success: false,
        segmentsCount: 0,
        chunksCount: 0,
        error: transcriptResult.error || 'No transcript available',
      };
    }

    const segments = transcriptResult.segments;

    // Store individual segments
    const segmentRows = segments.map((seg, index) => ({
      video_id: video.videoId,
      segment_index: index,
      text: seg.text,
      start_ms: seg.offset,
      end_ms: seg.offset + seg.duration,
      start_formatted: formatTimestamp(seg.offset),
    }));

    const { error: segmentError } = await supabaseAdmin
      .from('transcript_segments')
      .upsert(segmentRows, { onConflict: 'video_id,segment_index' });

    if (segmentError) {
      throw new Error(`Failed to store segments: ${segmentError.message}`);
    }

    // Categorize the video
    const categorization = categorizeVideo(video.title, video.description);

    // Create timestamped chunks for RAG
    const chunksCreated = await createTimestampedChunks(
      video.videoId,
      video.title,
      segments,
      {
        sourceType: 'transcript',
        sourceId: video.videoId,
        sourceTitle: video.title,
        topic: categorization.category,
        subtopic: video.playlistTitle,
        ltpRelevance: categorization.ltpRelevance,
      }
    );

    // Update status
    await updateVideoStatus(video.videoId, 'completed', {
      segmentsCount: segments.length,
      chunksCount: chunksCreated,
    });

    logger.info('Video transcript processed successfully', {
      videoId: video.videoId,
      segments: segments.length,
      chunks: chunksCreated,
    });

    return {
      success: true,
      segmentsCount: segments.length,
      chunksCount: chunksCreated,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error processing video transcript', { videoId: video.videoId, error: errorMessage });

    await updateVideoStatus(video.videoId, 'failed', { errorMessage });

    return {
      success: false,
      segmentsCount: 0,
      chunksCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Create timestamped chunks from transcript segments
 */
async function createTimestampedChunks(
  videoId: string,
  videoTitle: string,
  segments: TranscriptSegment[],
  metadata: ChunkMetadata
): Promise<number> {
  const MAX_CHUNK_CHARS = 1500;
  const OVERLAP_CHARS = 200;

  const chunks: Array<{
    content: string;
    startMs: number;
    endMs: number;
    segmentIndices: number[];
  }> = [];

  let currentChunk = '';
  let currentStartMs = segments[0]?.offset || 0;
  let currentSegmentIndices: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const potentialChunk = currentChunk + ' ' + segment.text;

    if (potentialChunk.length > MAX_CHUNK_CHARS && currentChunk.length > 0) {
      const lastIdx = currentSegmentIndices[currentSegmentIndices.length - 1];
      const endMs = segments[lastIdx]?.offset + segments[lastIdx]?.duration || segment.offset;

      chunks.push({
        content: currentChunk.trim(),
        startMs: currentStartMs,
        endMs,
        segmentIndices: [...currentSegmentIndices],
      });

      const overlapText = currentChunk.slice(-OVERLAP_CHARS);
      currentChunk = overlapText + ' ' + segment.text;
      currentStartMs = segment.offset;
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
      endMs: segments[lastIdx]?.offset + segments[lastIdx]?.duration || currentStartMs,
      segmentIndices: currentSegmentIndices,
    });
  }

  // Process each chunk
  let totalChunks = 0;
  for (const chunk of chunks) {
    try {
      const result = await processAndEmbedText(chunk.content, metadata);

      if (result.success && result.chunkCount > 0) {
        // Update chunks with timestamp info by matching content prefix
        await supabaseAdmin
          .from('knowledge_chunks')
          .update({
            start_timestamp_ms: chunk.startMs,
            end_timestamp_ms: chunk.endMs,
            segment_indices: chunk.segmentIndices,
          })
          .eq('source_type', 'transcript')
          .eq('source_id', metadata.sourceId)
          .ilike('content', chunk.content.slice(0, 50) + '%');

        totalChunks += result.chunkCount;
      }
    } catch (err) {
      logger.error('Error processing chunk', { videoId, error: err });
    }
  }

  return totalChunks;
}

// ============================================
// Batch Processing
// ============================================

/**
 * Sync all videos from the channel and process transcripts
 */
export async function syncAndIndexChannel(
  options: {
    channelId?: string;
    maxVideos?: number;
    processTranscripts?: boolean;
    onProgress?: (current: number, total: number, videoTitle: string) => void;
  } = {}
): Promise<ChannelIndexStats> {
  const {
    channelId = KAY_CAPITALS_CHANNEL_ID,
    maxVideos = 500,
    processTranscripts = true,
    onProgress,
  } = options;

  logger.info('Starting channel sync', { channelId, maxVideos, processTranscripts });

  // Step 1: Fetch all videos from channel
  const videos = await fetchChannelVideos(channelId, maxVideos);

  // Step 2: Store/update video metadata
  for (const video of videos) {
    await upsertVideo(video);
  }

  logger.info('Video metadata synced', { count: videos.length });

  // Step 3: Process transcripts if requested
  let indexed = 0;
  let failed = 0;
  let totalSegments = 0;
  let totalChunks = 0;

  if (processTranscripts) {
    const pendingVideos = await getPendingVideos(maxVideos);

    for (let i = 0; i < pendingVideos.length; i++) {
      const video = pendingVideos[i];

      if (onProgress) {
        onProgress(i + 1, pendingVideos.length, video.title);
      }

      const result = await processVideoTranscript(video);

      if (result.success) {
        indexed++;
        totalSegments += result.segmentsCount;
        totalChunks += result.chunksCount;
      } else {
        failed++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Update sync timestamp
  await supabaseAdmin
    .from('youtube_channel_sync')
    .upsert({
      channel_id: channelId,
      last_sync_at: new Date().toISOString(),
      total_videos: videos.length,
      indexed_videos: indexed,
      failed_videos: failed,
    }, {
      onConflict: 'channel_id',
    });

  const stats: ChannelIndexStats = {
    totalVideos: videos.length,
    indexedVideos: indexed,
    failedVideos: failed,
    pendingVideos: videos.length - indexed - failed,
    totalSegments,
    totalChunks,
    lastSyncAt: new Date().toISOString(),
  };

  logger.info('Channel sync completed', { ...stats } as Record<string, unknown>);

  return stats;
}

/**
 * Process pending videos in batches
 */
export async function processPendingTranscripts(
  batchSize: number = 10,
  onProgress?: (current: number, total: number, videoTitle: string) => void
): Promise<{ processed: number; failed: number }> {
  const pending = await getPendingVideos(batchSize);
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const video = pending[i];

    if (onProgress) {
      onProgress(i + 1, pending.length, video.title);
    }

    const result = await processVideoTranscript(video);

    if (result.success) {
      processed++;
    } else {
      failed++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { processed, failed };
}

// ============================================
// Search Functions
// ============================================

/**
 * Search indexed YouTube videos with timestamp results
 */
export async function searchYouTubeContent(
  query: string,
  options: {
    limit?: number;
    minRelevance?: number;
    category?: string;
    minLtpRelevance?: number;
  } = {}
): Promise<VideoSearchResult[]> {
  const { limit = 5, minRelevance = 0.7, category, minLtpRelevance } = options;

  // Generate embedding for query
  const { generateEmbedding } = await import('./embeddings');
  const queryEmbedding = await generateEmbedding(query);

  // Search knowledge chunks from YouTube videos
  const { data: chunks, error } = await supabaseAdmin.rpc(
    'match_knowledge_chunks_with_timestamps',
    {
      query_embedding: queryEmbedding,
      match_threshold: minRelevance,
      match_count: limit * 2, // Get extra to filter
      filter_source_type: 'transcript',
    }
  );

  if (error || !chunks) {
    logger.error('Error searching YouTube content', { error });
    return [];
  }

  // Filter and enrich results with video metadata
  const results: VideoSearchResult[] = [];

  for (const chunk of chunks) {
    if (chunk.start_timestamp_ms === null) continue;

    // Get video metadata
    const { data: video } = await supabaseAdmin
      .from('youtube_videos')
      .select('*')
      .eq('video_id', chunk.source_id)
      .single();

    if (!video) continue;

    // Apply category filter
    if (category && video.category !== category) continue;

    // Apply LTP relevance filter
    if (minLtpRelevance && (video.ltp_relevance || 0) < minLtpRelevance) continue;

    results.push({
      videoId: chunk.source_id,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnail_url,
      startMs: chunk.start_timestamp_ms,
      endMs: chunk.end_timestamp_ms,
      matchedText: chunk.content.slice(0, 200) + '...',
      relevanceScore: chunk.similarity,
      youtubeUrl: `https://www.youtube.com/watch?v=${chunk.source_id}&t=${Math.floor(chunk.start_timestamp_ms / 1000)}s`,
    });

    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Get stats about indexed YouTube content
 */
export async function getIndexStats(): Promise<ChannelIndexStats> {
  const { data: videos } = await supabaseAdmin
    .from('youtube_videos')
    .select('transcript_status, segments_count, chunks_count');

  if (!videos) {
    return {
      totalVideos: 0,
      indexedVideos: 0,
      failedVideos: 0,
      pendingVideos: 0,
      totalSegments: 0,
      totalChunks: 0,
    };
  }

  const stats: ChannelIndexStats = {
    totalVideos: videos.length,
    indexedVideos: videos.filter(v => v.transcript_status === 'completed').length,
    failedVideos: videos.filter(v => v.transcript_status === 'failed').length,
    pendingVideos: videos.filter(v => !v.transcript_status || v.transcript_status === 'pending').length,
    totalSegments: videos.reduce((sum, v) => sum + (v.segments_count || 0), 0),
    totalChunks: videos.reduce((sum, v) => sum + (v.chunks_count || 0), 0),
  };

  // Get last sync time
  const { data: syncData } = await supabaseAdmin
    .from('youtube_channel_sync')
    .select('last_sync_at')
    .single();

  if (syncData) {
    stats.lastSyncAt = syncData.last_sync_at;
  }

  return stats;
}
