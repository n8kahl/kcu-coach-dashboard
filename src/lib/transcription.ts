/**
 * Audio Transcription Service
 *
 * Provides audio transcription using OpenAI's Whisper API.
 * Used for automatically generating transcripts from uploaded videos.
 */

import OpenAI from 'openai';
import logger from './logger';

// Initialize OpenAI client (lazy)
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

/**
 * Check if transcription is available
 */
export function isTranscriptionConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * A timestamped segment from the transcript
 */
export interface TranscriptSegment {
  start: number;    // Start time in seconds
  end: number;      // End time in seconds
  text: string;     // Text content of this segment
}

export interface TranscriptionResult {
  success: boolean;
  transcript?: string;
  segments?: TranscriptSegment[];  // Timestamped segments for video linking
  duration?: number;
  error?: string;
}

/**
 * Transcribe audio from a URL using OpenAI Whisper
 *
 * Note: Whisper API has a 25MB file size limit.
 * For larger files, we need to use chunked processing or
 * rely on Cloudflare's built-in caption generation.
 */
export async function transcribeAudioFromUrl(
  audioUrl: string,
  options?: {
    language?: string;
    prompt?: string;
  }
): Promise<TranscriptionResult> {
  try {
    if (!isTranscriptionConfigured()) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    logger.info('Starting audio transcription', { audioUrl: audioUrl.substring(0, 100) + '...' });

    // Fetch the audio file
    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    // Check file size (Whisper limit is 25MB)
    const contentLength = response.headers.get('content-length');
    const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const maxSizeBytes = 25 * 1024 * 1024; // 25MB

    if (fileSizeBytes > maxSizeBytes) {
      logger.warn('Audio file exceeds Whisper size limit', {
        fileSizeBytes,
        maxSizeBytes,
      });
      return {
        success: false,
        error: `File size (${Math.round(fileSizeBytes / 1024 / 1024)}MB) exceeds the 25MB limit. Consider using a shorter clip or Cloudflare's built-in captions.`,
      };
    }

    // Convert to blob and create a File object
    const audioBlob = await response.blob();
    const audioFile = new File([audioBlob], 'audio.mp3', {
      type: audioBlob.type || 'audio/mpeg',
    });

    logger.info('Audio file prepared for transcription', {
      sizeBytes: audioBlob.size,
      type: audioBlob.type,
    });

    // Call OpenAI Whisper API
    const client = getOpenAI();
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: options?.language,
      prompt: options?.prompt || 'This is a trading education video about LTP methodology, including topics like levels, trends, patience candles, support, resistance, VWAP, and price action.',
      response_format: 'verbose_json',
    });

    // Extract timestamped segments from verbose_json response
    // Whisper returns segments with start, end, and text properties
    const segments: TranscriptSegment[] = [];

    // The verbose_json response includes a segments array
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

    logger.info('Transcription completed successfully', {
      textLength: transcription.text.length,
      duration: transcription.duration,
      segmentCount: segments.length,
    });

    return {
      success: true,
      transcript: transcription.text,
      segments: segments.length > 0 ? segments : undefined,
      duration: transcription.duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Transcription failed', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get video download URL from Cloudflare Stream
 *
 * Note: Downloads must be enabled in Cloudflare Stream settings.
 * If downloads are not enabled, this will return null.
 */
export async function getCloudflareVideoDownloadUrl(
  videoUid: string
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return {
        success: false,
        error: 'Cloudflare credentials not configured',
      };
    }

    // Get video details from Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to get video info');
    }

    const video = data.result;

    // Check if video has a download URL
    // Cloudflare provides downloadable URL in the video info when downloads are enabled
    if (video.meta?.download_url) {
      return {
        success: true,
        downloadUrl: video.meta.download_url,
      };
    }

    // Try to get the MP4 download URL (requires downloads to be enabled)
    if (video.playback?.hls) {
      // Extract the base URL and construct an MP4 download URL
      // Format: https://customer-{code}.cloudflarestream.com/{videoId}/downloads/default.mp4
      const hlsUrl = video.playback.hls;
      const match = hlsUrl.match(/https:\/\/(customer-[^/]+\.cloudflarestream\.com)\/([^/]+)/);

      if (match) {
        const downloadUrl = `https://${match[1]}/${match[2]}/downloads/default.mp4`;

        // Verify the download URL is accessible
        const checkResponse = await fetch(downloadUrl, { method: 'HEAD' });
        if (checkResponse.ok) {
          return {
            success: true,
            downloadUrl,
          };
        }
      }
    }

    // If no download URL available, try to use the audio track from HLS
    // This is a fallback that extracts audio from the HLS stream
    if (video.playback?.hls) {
      logger.info('Attempting to use HLS audio track for transcription');
      return {
        success: false,
        error: 'Video downloads not enabled. Please enable downloads in Cloudflare Stream settings, or use Cloudflare\'s built-in caption generation.',
      };
    }

    return {
      success: false,
      error: 'No downloadable URL available for this video',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error getting Cloudflare download URL', { error: errorMessage, videoUid });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get Cloudflare Stream captions (if available)
 *
 * Cloudflare can auto-generate captions. This fetches them if available.
 */
export async function getCloudflareVideoCaptions(
  videoUid: string
): Promise<{ success: boolean; captions?: string; error?: string }> {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return {
        success: false,
        error: 'Cloudflare credentials not configured',
      };
    }

    // List available captions
    const listResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/captions`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Cloudflare API error: ${listResponse.status}`);
    }

    const listData = await listResponse.json();

    if (!listData.success || !listData.result?.length) {
      return {
        success: false,
        error: 'No captions available for this video',
      };
    }

    // Get the first available caption (usually English)
    const caption = listData.result[0];

    // Fetch the caption content
    const captionResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}/captions/${caption.language}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    if (!captionResponse.ok) {
      throw new Error(`Failed to fetch caption content: ${captionResponse.status}`);
    }

    const captionData = await captionResponse.json();

    if (!captionData.success) {
      throw new Error('Failed to get caption content');
    }

    // Parse VTT/SRT content to plain text
    const captionText = captionData.result?.content || '';
    const plainText = parseCaptionToText(captionText);

    return {
      success: true,
      captions: plainText,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error getting Cloudflare captions', { error: errorMessage, videoUid });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Parse VTT/SRT caption format to plain text
 */
function parseCaptionToText(captionContent: string): string {
  // Remove VTT header
  let text = captionContent
    .replace(/^WEBVTT\s*\n/i, '')
    .replace(/^Kind:.*\n/gm, '')
    .replace(/^Language:.*\n/gm, '');

  // Remove timestamp lines (00:00:00.000 --> 00:00:05.000)
  text = text.replace(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, '');

  // Remove cue identifiers (numeric lines)
  text = text.replace(/^\d+\s*$/gm, '');

  // Remove position/alignment markers
  text = text.replace(/<[^>]+>/g, '');

  // Clean up whitespace
  text = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ');

  // Remove duplicate consecutive words/phrases (common in captions)
  text = text.replace(/\b(\w+)\s+\1\b/gi, '$1');

  return text.trim();
}

/**
 * Main transcription function for Cloudflare Stream videos
 *
 * Attempts multiple methods:
 * 1. Use Cloudflare's built-in captions if available
 * 2. Download video and transcribe with Whisper
 */
export async function transcribeCloudflareVideo(
  videoUid: string,
  options?: {
    forceWhisper?: boolean;
    language?: string;
  }
): Promise<TranscriptionResult> {
  // First, try Cloudflare captions (unless forceWhisper is set)
  if (!options?.forceWhisper) {
    const captionsResult = await getCloudflareVideoCaptions(videoUid);

    if (captionsResult.success && captionsResult.captions) {
      logger.info('Using Cloudflare-generated captions', {
        videoUid,
        captionLength: captionsResult.captions.length,
      });

      return {
        success: true,
        transcript: captionsResult.captions,
      };
    }

    logger.info('Cloudflare captions not available, trying Whisper', {
      videoUid,
      captionsError: captionsResult.error,
    });
  }

  // Try to get video download URL
  const downloadResult = await getCloudflareVideoDownloadUrl(videoUid);

  if (!downloadResult.success || !downloadResult.downloadUrl) {
    return {
      success: false,
      error: downloadResult.error || 'Could not get video download URL',
    };
  }

  // Transcribe with Whisper
  return transcribeAudioFromUrl(downloadResult.downloadUrl, {
    language: options?.language,
  });
}
