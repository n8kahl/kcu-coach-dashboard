// ============================================
// Video Content Extractor
// Analyzes transcripts to find high-value moments
// and generate social media content
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { SOMESH_VOICE_GUIDE } from './content-generator';

// Initialize Claude client
const anthropic = new Anthropic();

// ============================================
// Types
// ============================================

export interface HighValueMoment {
  id: string;
  timestamp: string; // Format: "MM:SS" or "HH:MM:SS"
  startSeconds: number;
  endSeconds: number;
  quote: string; // The exact transcript excerpt
  topic: string; // What the moment is about
  emotionalIntensity: 'low' | 'medium' | 'high';
  contentType: 'educational' | 'motivational' | 'story' | 'tip' | 'insight';
  keywords: string[];
}

export interface GeneratedClip {
  momentId: string;
  hookTitle: string; // Reel/TikTok title
  caption: string; // Full caption for the post
  hashtags: string[];
  platform: 'reels' | 'tiktok' | 'shorts' | 'all';
  suggestedDuration: number; // Suggested clip length in seconds
  textOverlay?: string; // Text to overlay on the video
  callToAction: string;
}

export interface VideoAnalysisResult {
  videoId: string;
  totalMoments: number;
  moments: HighValueMoment[];
  clips: GeneratedClip[];
  summary: string;
  mainTopics: string[];
  processedAt: string;
}

export interface TranscriptSegment {
  text: string;
  timestamp?: string;
  startSeconds?: number;
  endSeconds?: number;
}

// ============================================
// High-Value Moment Detection Keywords
// ============================================

export const HIGH_VALUE_KEYWORDS = {
  // Somesh signature phrases
  signatures: [
    'listen fam',
    'here is the secret',
    'here\'s the secret',
    'this is crucial',
    'write this down',
    'repeat after me',
    'let me tell you',
    'the truth is',
    'here\'s what most traders',
    'don\'t make this mistake',
    'the holy grail',
    'this is it',
    'game changer',
  ],

  // LTP framework references
  ltp: [
    'ltp',
    'level',
    'trend',
    'patience candle',
    'patience',
    'confirmation',
    'key level',
    'support',
    'resistance',
  ],

  // Educational emphasis
  educational: [
    'the reason',
    'because',
    'that\'s why',
    'important',
    'critical',
    'remember',
    'never forget',
    'always',
    'must',
  ],

  // Story/engagement hooks
  hooks: [
    'story time',
    'let me share',
    'back when i',
    'one of my students',
    'perfect example',
    'look at this',
    'check this out',
    'watch this',
  ],

  // Emotional intensity markers
  intensity: [
    'absolutely',
    'literally',
    'seriously',
    'honestly',
    'trust me',
    'i promise',
    'guaranteed',
    'no question',
  ],
};

// ============================================
// Helper Functions
// ============================================

/**
 * Parse timestamp string to seconds
 */
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Format seconds to timestamp string
 */
export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate keyword density score for a text segment
 */
export function calculateKeywordDensity(text: string): {
  score: number;
  matchedKeywords: string[];
  category: string;
} {
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let score = 0;
  let primaryCategory = 'general';

  // Check all keyword categories
  const categories = [
    { name: 'signatures', keywords: HIGH_VALUE_KEYWORDS.signatures, weight: 3 },
    { name: 'ltp', keywords: HIGH_VALUE_KEYWORDS.ltp, weight: 2 },
    { name: 'educational', keywords: HIGH_VALUE_KEYWORDS.educational, weight: 1.5 },
    { name: 'hooks', keywords: HIGH_VALUE_KEYWORDS.hooks, weight: 2.5 },
    { name: 'intensity', keywords: HIGH_VALUE_KEYWORDS.intensity, weight: 1.5 },
  ];

  let maxCategoryScore = 0;

  for (const category of categories) {
    let categoryScore = 0;
    for (const keyword of category.keywords) {
      if (lowerText.includes(keyword)) {
        matchedKeywords.push(keyword);
        const matchScore = category.weight;
        score += matchScore;
        categoryScore += matchScore;
      }
    }
    if (categoryScore > maxCategoryScore) {
      maxCategoryScore = categoryScore;
      primaryCategory = category.name;
    }
  }

  return { score, matchedKeywords, category: primaryCategory };
}

/**
 * Segment transcript into chunks with timestamps
 */
export function segmentTranscript(
  transcript: string,
  estimatedDuration?: number
): TranscriptSegment[] {
  // Try to extract timestamps from the transcript [MM:SS] format
  const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  const hasTimestamps = timestampRegex.test(transcript);

  if (hasTimestamps) {
    // Parse timestamped transcript
    const segments: TranscriptSegment[] = [];
    const parts = transcript.split(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);

    for (let i = 1; i < parts.length; i += 2) {
      const timestamp = parts[i];
      const text = parts[i + 1]?.trim();
      if (text) {
        segments.push({
          text,
          timestamp,
          startSeconds: parseTimestamp(timestamp),
        });
      }
    }

    // Calculate end times
    for (let i = 0; i < segments.length; i++) {
      if (i < segments.length - 1) {
        segments[i].endSeconds = segments[i + 1].startSeconds;
      } else {
        segments[i].endSeconds = (segments[i].startSeconds || 0) + 30;
      }
    }

    return segments;
  }

  // No timestamps - split by sentences/paragraphs and estimate
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 20);

  const avgWordsPerMinute = 150;
  const segments: TranscriptSegment[] = [];
  let currentSeconds = 0;

  // Group sentences into ~30 second chunks
  let currentChunk = '';
  let chunkStartSeconds = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length;
    const sentenceDuration = (wordCount / avgWordsPerMinute) * 60;

    if (currentChunk && currentChunk.split(/\s+/).length > 50) {
      // Save current chunk
      segments.push({
        text: currentChunk.trim(),
        timestamp: formatTimestamp(chunkStartSeconds),
        startSeconds: chunkStartSeconds,
        endSeconds: currentSeconds,
      });
      currentChunk = sentence;
      chunkStartSeconds = currentSeconds;
    } else {
      currentChunk += ' ' + sentence;
    }

    currentSeconds += sentenceDuration;
  }

  // Add final chunk
  if (currentChunk.trim()) {
    segments.push({
      text: currentChunk.trim(),
      timestamp: formatTimestamp(chunkStartSeconds),
      startSeconds: chunkStartSeconds,
      endSeconds: currentSeconds,
    });
  }

  return segments;
}

// ============================================
// AI-Powered Clip Generation
// ============================================

const CLIP_GENERATION_PROMPT = `You are Somesh from KCU Trading, creating viral short-form video content from transcript excerpts.

=== YOUR VOICE ===
${JSON.stringify(SOMESH_VOICE_GUIDE.vocabulary, null, 2)}

=== TASK ===
Given this high-value transcript moment, generate social media clip content.

MOMENT DETAILS:
- Quote: "{quote}"
- Topic: {topic}
- Content Type: {content_type}
- Keywords: {keywords}

=== GENERATE ===
Create content for a short-form video (Reel/TikTok/Short). Return JSON:

{
  "hookTitle": "Attention-grabbing title (max 50 chars, uses power words)",
  "caption": "Full caption with hook, value prop, and CTA (150-300 chars)",
  "hashtags": ["5-8 relevant hashtags without # prefix"],
  "textOverlay": "Bold text to overlay on video (max 10 words)",
  "callToAction": "Clear CTA (e.g., 'Follow for daily trading tips')",
  "suggestedDuration": 30
}

Rules:
- Hook title should stop the scroll
- Use Somesh's vocabulary naturally
- Caption should tease the value without giving it all away
- Hashtags mix popular (#daytrading) with niche (#ltpframework)
- Text overlay is the viral text that appears on screen
- Duration: 15-60 seconds based on content depth

Return ONLY valid JSON.`;

/**
 * Generate clip content using AI
 */
async function generateClipContent(moment: HighValueMoment): Promise<Omit<GeneratedClip, 'momentId'>> {
  const prompt = CLIP_GENERATION_PROMPT
    .replace('{quote}', moment.quote.substring(0, 500))
    .replace('{topic}', moment.topic)
    .replace('{content_type}', moment.contentType)
    .replace('{keywords}', moment.keywords.join(', '));

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Clean and parse JSON
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }

    const parsed = JSON.parse(cleanedText.trim());

    return {
      hookTitle: parsed.hookTitle || 'Trading Insight',
      caption: parsed.caption || moment.quote.substring(0, 150),
      hashtags: parsed.hashtags || ['daytrading', 'tradinglife'],
      textOverlay: parsed.textOverlay,
      callToAction: parsed.callToAction || 'Follow for more!',
      suggestedDuration: parsed.suggestedDuration || 30,
      platform: 'all',
    };
  } catch (error) {
    console.error('Error generating clip content:', error);

    // Fallback to rule-based generation
    return {
      hookTitle: moment.topic.substring(0, 50),
      caption: moment.quote.substring(0, 200),
      hashtags: ['daytrading', 'tradinglife', 'priceaction', 'tradingmindset'],
      callToAction: 'Follow for more trading tips!',
      suggestedDuration: 30,
      platform: 'all',
    };
  }
}

// ============================================
// Main Extraction Functions
// ============================================

/**
 * Extract high-value moments from transcript
 */
export function extractHighValueMoments(
  transcript: string,
  options?: {
    minScore?: number;
    maxMoments?: number;
    estimatedDuration?: number;
  }
): HighValueMoment[] {
  const minScore = options?.minScore ?? 3;
  const maxMoments = options?.maxMoments ?? 10;

  // Segment the transcript
  const segments = segmentTranscript(transcript, options?.estimatedDuration);

  // Score each segment
  const scoredSegments = segments.map((segment) => {
    const { score, matchedKeywords, category } = calculateKeywordDensity(segment.text);
    return { segment, score, matchedKeywords, category };
  });

  // Filter and sort by score
  const highValueSegments = scoredSegments
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMoments);

  // Convert to HighValueMoment objects
  const moments: HighValueMoment[] = highValueSegments.map((item, index) => {
    const { segment, matchedKeywords, category } = item;

    // Determine content type based on category
    let contentType: HighValueMoment['contentType'] = 'educational';
    if (category === 'hooks' || category === 'signatures') {
      contentType = 'insight';
    } else if (category === 'intensity') {
      contentType = 'motivational';
    } else if (matchedKeywords.some((k) => k.includes('story') || k.includes('example'))) {
      contentType = 'story';
    }

    // Determine emotional intensity
    let emotionalIntensity: HighValueMoment['emotionalIntensity'] = 'medium';
    if (item.score >= 8) {
      emotionalIntensity = 'high';
    } else if (item.score < 4) {
      emotionalIntensity = 'low';
    }

    // Extract topic from first sentence or keywords
    const firstSentence = segment.text.split(/[.!?]/)[0];
    const topic = firstSentence.length < 100 ? firstSentence : matchedKeywords[0] || 'Trading Insight';

    return {
      id: `moment-${index + 1}`,
      timestamp: segment.timestamp || formatTimestamp(segment.startSeconds || 0),
      startSeconds: segment.startSeconds || 0,
      endSeconds: segment.endSeconds || (segment.startSeconds || 0) + 30,
      quote: segment.text,
      topic,
      emotionalIntensity,
      contentType,
      keywords: matchedKeywords,
    };
  });

  return moments;
}

/**
 * Full video content extraction pipeline
 */
export async function extractVideoContent(
  transcript: string,
  options?: {
    videoId?: string;
    estimatedDuration?: number;
    generateClips?: boolean;
    maxMoments?: number;
  }
): Promise<VideoAnalysisResult> {
  const videoId = options?.videoId || `video-${Date.now()}`;
  const generateClips = options?.generateClips ?? true;

  // Step 1: Extract high-value moments
  const moments = extractHighValueMoments(transcript, {
    estimatedDuration: options?.estimatedDuration,
    maxMoments: options?.maxMoments,
  });

  // Step 2: Generate clips for each moment (if enabled)
  const clips: GeneratedClip[] = [];

  if (generateClips && moments.length > 0) {
    // Generate clips for top 5 moments to avoid rate limits
    const topMoments = moments.slice(0, 5);

    for (const moment of topMoments) {
      try {
        const clipContent = await generateClipContent(moment);
        clips.push({
          momentId: moment.id,
          ...clipContent,
        });
      } catch (error) {
        console.error(`Error generating clip for moment ${moment.id}:`, error);
      }
    }
  }

  // Step 3: Extract main topics
  const allKeywords = moments.flatMap((m) => m.keywords);
  const keywordCounts = allKeywords.reduce(
    (acc, kw) => {
      acc[kw] = (acc[kw] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const mainTopics = Object.entries(keywordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([topic]) => topic);

  // Step 4: Generate summary
  const contentTypes = moments.map((m) => m.contentType);
  const uniqueContentTypes = Array.from(new Set(contentTypes));
  const summary = `Found ${moments.length} high-value moments. Primary content: ${uniqueContentTypes.join(', ')}. Key topics: ${mainTopics.join(', ')}.`;

  return {
    videoId,
    totalMoments: moments.length,
    moments,
    clips,
    summary,
    mainTopics,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Quick analysis without clip generation (faster)
 */
export function quickAnalyzeTranscript(transcript: string): {
  momentCount: number;
  topMoments: Array<{ quote: string; score: number; keywords: string[] }>;
  estimatedClipPotential: 'low' | 'medium' | 'high';
} {
  const segments = segmentTranscript(transcript);

  const scoredSegments = segments
    .map((segment) => {
      const { score, matchedKeywords } = calculateKeywordDensity(segment.text);
      return { quote: segment.text, score, keywords: matchedKeywords };
    })
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score);

  const momentCount = scoredSegments.length;
  const avgScore = momentCount > 0 ? scoredSegments.reduce((sum, s) => sum + s.score, 0) / momentCount : 0;

  let estimatedClipPotential: 'low' | 'medium' | 'high' = 'low';
  if (momentCount >= 5 && avgScore >= 5) {
    estimatedClipPotential = 'high';
  } else if (momentCount >= 3 && avgScore >= 3) {
    estimatedClipPotential = 'medium';
  }

  return {
    momentCount,
    topMoments: scoredSegments.slice(0, 3),
    estimatedClipPotential,
  };
}
