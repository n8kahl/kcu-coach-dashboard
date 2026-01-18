/**
 * YouTube Transcript Fetcher
 *
 * Fetches video transcripts from YouTube using the youtube-transcript library.
 * Handles parsing timestamps and combining transcript segments.
 */

import { YoutubeTranscript, TranscriptResponse } from 'youtube-transcript';
import logger from './logger';

export interface TranscriptSegment {
  text: string;
  offset: number;      // Start time in milliseconds
  duration: number;    // Duration in milliseconds
  startTime: string;   // Formatted start time (MM:SS)
}

export interface TranscriptResult {
  success: boolean;
  videoId: string;
  segments: TranscriptSegment[];
  fullText: string;
  error?: string;
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(urlOrId: string): string | null {
  // If it's already a video ID (11 characters, alphanumeric with - and _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }

  // Try to extract from various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Format milliseconds to MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Fetch transcript for a YouTube video
 */
export async function fetchTranscript(urlOrId: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(urlOrId);

  if (!videoId) {
    return {
      success: false,
      videoId: urlOrId,
      segments: [],
      fullText: '',
      error: 'Invalid YouTube URL or video ID',
    };
  }

  try {
    logger.info('Fetching YouTube transcript', { videoId });

    const rawTranscript: TranscriptResponse[] = await YoutubeTranscript.fetchTranscript(videoId);

    if (!rawTranscript || rawTranscript.length === 0) {
      return {
        success: false,
        videoId,
        segments: [],
        fullText: '',
        error: 'No transcript available for this video',
      };
    }

    // Convert to our format
    const segments: TranscriptSegment[] = rawTranscript.map(item => ({
      text: item.text,
      offset: Math.round(item.offset * 1000), // Convert to ms
      duration: Math.round(item.duration * 1000),
      startTime: formatTime(item.offset * 1000),
    }));

    // Combine all text with proper spacing
    const fullText = segments
      .map(s => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    logger.info('YouTube transcript fetched successfully', {
      videoId,
      segmentCount: segments.length,
      textLength: fullText.length,
    });

    return {
      success: true,
      videoId,
      segments,
      fullText,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Error fetching YouTube transcript', {
      videoId,
      error: errorMessage,
    });

    // Check for common errors
    let userFriendlyError = 'Failed to fetch transcript';
    if (errorMessage.includes('disabled')) {
      userFriendlyError = 'Subtitles/transcripts are disabled for this video';
    } else if (errorMessage.includes('available')) {
      userFriendlyError = 'No transcript available for this video';
    } else if (errorMessage.includes('private')) {
      userFriendlyError = 'This video is private or unavailable';
    }

    return {
      success: false,
      videoId,
      segments: [],
      fullText: '',
      error: userFriendlyError,
    };
  }
}

/**
 * Fetch transcript with timestamps formatted for search/reference
 */
export async function fetchTranscriptWithTimestamps(urlOrId: string): Promise<TranscriptResult & { formattedText: string }> {
  const result = await fetchTranscript(urlOrId);

  if (!result.success) {
    return { ...result, formattedText: '' };
  }

  // Create formatted text with timestamps every few segments
  const formattedParts: string[] = [];
  let currentPart: string[] = [];
  let lastTimestamp = '';

  for (let i = 0; i < result.segments.length; i++) {
    const segment = result.segments[i];

    // Add timestamp every ~30 seconds or at start of significant breaks
    if (i === 0 || segment.offset - result.segments[i - 1].offset > 5000) {
      if (currentPart.length > 0) {
        formattedParts.push(`[${lastTimestamp}] ${currentPart.join(' ')}`);
        currentPart = [];
      }
      lastTimestamp = segment.startTime;
    }

    currentPart.push(segment.text);
  }

  // Don't forget the last part
  if (currentPart.length > 0) {
    formattedParts.push(`[${lastTimestamp}] ${currentPart.join(' ')}`);
  }

  const formattedText = formattedParts.join('\n\n');

  return {
    ...result,
    formattedText,
  };
}

/**
 * Check if a video has a transcript available
 */
export async function hasTranscript(urlOrId: string): Promise<boolean> {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) return false;

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript && transcript.length > 0;
  } catch {
    return false;
  }
}
