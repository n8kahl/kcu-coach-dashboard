/**
 * VTT (WebVTT) Parser
 *
 * Parses WebVTT caption files into transcript segments with timestamps.
 * Used by the transcript worker to process Cloudflare Stream captions.
 */

export interface VTTSegment {
  start: number;  // Start time in seconds
  end: number;    // End time in seconds
  text: string;   // Text content
}

export interface VTTParseResult {
  segments: VTTSegment[];
  text: string;  // Full concatenated text
}

/**
 * Parse VTT content into segments with timestamps
 *
 * @param vttContent - Raw VTT file content
 * @returns Parsed segments and full text
 */
export function parseVTT(vttContent: string): VTTParseResult {
  const segments: VTTSegment[] = [];
  const lines = vttContent.split('\n');
  let currentSegment: Partial<VTTSegment> | null = null;
  let textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header and metadata lines
    if (
      trimmed === 'WEBVTT' ||
      trimmed.startsWith('Kind:') ||
      trimmed.startsWith('Language:') ||
      trimmed.startsWith('NOTE')
    ) {
      continue;
    }

    // Parse timestamp line: 00:00:00.000 --> 00:00:05.000
    // Supports both comma and dot as millisecond separator
    const timestampMatch = trimmed.match(
      /^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
    );

    if (timestampMatch) {
      // Save previous segment if it has content
      if (currentSegment && currentSegment.text) {
        segments.push(currentSegment as VTTSegment);
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

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Collect text lines for current segment
    if (currentSegment) {
      // Remove HTML tags (like <c>, </c>, <v>, etc.)
      const cleanText = trimmed.replace(/<[^>]+>/g, '');
      if (cleanText) {
        textLines.push(cleanText);
        currentSegment.text = textLines.join(' ').trim();
      }
    }
  }

  // Don't forget the last segment
  if (currentSegment && currentSegment.text) {
    segments.push(currentSegment as VTTSegment);
  }

  // Build full text from all segments
  const fullText = segments.map((s) => s.text).join(' ');

  return { segments, text: fullText };
}

/**
 * Format seconds to VTT timestamp format (HH:MM:SS.mmm)
 */
export function formatVTTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Format seconds to display format (MM:SS or HH:MM:SS)
 */
export function formatDisplayTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}
