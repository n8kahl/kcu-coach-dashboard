/**
 * Rich Content Parser for AI Chat
 *
 * Parses special markers in AI responses and converts them to
 * structured rich content objects for rendering.
 *
 * Supported markers:
 * - [[LESSON:module-slug/lesson-slug|Title|Duration]]
 * - [[CHART:SYMBOL|interval|indicators]]
 * - [[SETUP:SYMBOL|direction|entry|stop|target|level%|trend%|patience%]]
 * - [[QUIZ:module-slug|title]]
 * - [[VIDEO:videoId|startMs|endMs|Title]] - YouTube video with timestamp
 * - [[THINKIFIC:courseSlug|lessonSlug|timestampSeconds|Title]] - Thinkific lesson link
 */

import type {
  RichContent,
  LessonLinkContent,
  ChartWidgetContent,
  SetupVisualizationContent,
  QuizPromptContent,
  VideoTimestampContent,
  ThinkificLinkContent,
} from '@/types';
import { getLessonBySlug } from './curriculum-context';

// Regex patterns for each marker type
const LESSON_PATTERN = /\[\[LESSON:([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;
const CHART_PATTERN = /\[\[CHART:([^|]+)\|([^|]+)(?:\|([^\]]+))?\]\]/g;
const SETUP_PATTERN = /\[\[SETUP:([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;
const QUIZ_PATTERN = /\[\[QUIZ:([^|]+)\|([^\]]+)\]\]/g;
// Video timestamp: [[VIDEO:videoId|startMs|endMs|Title]]
const VIDEO_PATTERN = /\[\[VIDEO:([^|]+)\|(\d+)\|(\d+)\|([^\]]+)\]\]/g;
// Thinkific link: [[THINKIFIC:courseSlug|lessonSlug|timestampSeconds|Title]]
const THINKIFIC_PATTERN = /\[\[THINKIFIC:([^|]+)\|([^|]+)\|(\d+)\|([^\]]+)\]\]/g;

/**
 * Calculate LTP grade from total score
 */
function calculateGrade(total: number): string {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

/**
 * Parse lesson markers from text
 */
function parseLessonMarkers(text: string): LessonLinkContent[] {
  const lessons: LessonLinkContent[] = [];
  let match;

  // Reset lastIndex for global regex
  LESSON_PATTERN.lastIndex = 0;

  while ((match = LESSON_PATTERN.exec(text)) !== null) {
    const [, path, title, duration] = match;
    const [moduleSlug, lessonSlug] = path.split('/');

    // Try to get additional details from curriculum
    const lessonData = getLessonBySlug(moduleSlug, lessonSlug);

    lessons.push({
      type: 'lesson_link',
      moduleId: moduleSlug,
      lessonId: lessonSlug,
      title: title.trim(),
      duration: duration.trim(),
      description: lessonData?.lesson.description,
      moduleTitle: lessonData?.module.title,
    });
  }

  return lessons;
}

/**
 * Parse chart markers from text
 */
function parseChartMarkers(text: string): ChartWidgetContent[] {
  const charts: ChartWidgetContent[] = [];
  let match;

  CHART_PATTERN.lastIndex = 0;

  while ((match = CHART_PATTERN.exec(text)) !== null) {
    const [, symbol, interval, indicators] = match;

    charts.push({
      type: 'chart',
      symbol: symbol.trim().toUpperCase(),
      interval: (interval.trim() as ChartWidgetContent['interval']) || '15',
      indicators: indicators
        ? indicators.split(',').map(i => i.trim())
        : ['MA', 'VWAP'],
    });
  }

  return charts;
}

/**
 * Parse setup visualization markers from text
 */
function parseSetupMarkers(text: string): SetupVisualizationContent[] {
  const setups: SetupVisualizationContent[] = [];
  let match;

  SETUP_PATTERN.lastIndex = 0;

  while ((match = SETUP_PATTERN.exec(text)) !== null) {
    const [, symbol, direction, entry, stop, target, level, trend, patience] = match;

    const levelScore = parseInt(level, 10) || 0;
    const trendScore = parseInt(trend, 10) || 0;
    const patienceScore = parseInt(patience, 10) || 0;
    const total = Math.round((levelScore + trendScore + patienceScore) / 3);

    setups.push({
      type: 'setup',
      symbol: symbol.trim().toUpperCase(),
      direction: direction.trim().toLowerCase() as 'long' | 'short',
      entry: parseFloat(entry) || 0,
      stop: parseFloat(stop) || 0,
      target: parseFloat(target) || 0,
      ltpScore: {
        level: levelScore,
        trend: trendScore,
        patience: patienceScore,
        total,
        grade: calculateGrade(total),
      },
    });
  }

  return setups;
}

/**
 * Parse quiz markers from text
 */
function parseQuizMarkers(text: string): QuizPromptContent[] {
  const quizzes: QuizPromptContent[] = [];
  let match;

  QUIZ_PATTERN.lastIndex = 0;

  while ((match = QUIZ_PATTERN.exec(text)) !== null) {
    const [, moduleSlug, title] = match;

    quizzes.push({
      type: 'quiz',
      quizId: `quiz_${moduleSlug}`,
      moduleId: moduleSlug.trim(),
      title: title.trim(),
      description: `Test your knowledge on ${title.trim()}`,
    });
  }

  return quizzes;
}

/**
 * Parse video timestamp markers from text (YouTube)
 * Format: [[VIDEO:videoId|startMs|endMs|Title]]
 */
function parseVideoMarkers(text: string): VideoTimestampContent[] {
  const videos: VideoTimestampContent[] = [];
  let match;

  VIDEO_PATTERN.lastIndex = 0;

  while ((match = VIDEO_PATTERN.exec(text)) !== null) {
    const [, videoId, startMs, endMs, title] = match;

    videos.push({
      type: 'video_timestamp',
      videoId: videoId.trim(),
      startMs: parseInt(startMs, 10),
      endMs: parseInt(endMs, 10),
      title: title.trim(),
      source: 'youtube',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId.trim()}/mqdefault.jpg`,
    });
  }

  return videos;
}

/**
 * Parse Thinkific link markers from text
 * Format: [[THINKIFIC:courseSlug|lessonSlug|timestampSeconds|Title]]
 */
function parseThinkificMarkers(text: string): ThinkificLinkContent[] {
  const links: ThinkificLinkContent[] = [];
  let match;

  THINKIFIC_PATTERN.lastIndex = 0;

  while ((match = THINKIFIC_PATTERN.exec(text)) !== null) {
    const [, courseSlug, lessonSlug, timestampSeconds, title] = match;

    links.push({
      type: 'thinkific_link',
      courseSlug: courseSlug.trim(),
      lessonSlug: lessonSlug.trim(),
      timestampSeconds: parseInt(timestampSeconds, 10),
      title: title.trim(),
      source: 'thinkific',
    });
  }

  return links;
}

/**
 * Remove all rich content markers from text
 */
export function stripRichContentMarkers(text: string): string {
  return text
    .replace(LESSON_PATTERN, '')
    .replace(CHART_PATTERN, '')
    .replace(SETUP_PATTERN, '')
    .replace(QUIZ_PATTERN, '')
    .replace(VIDEO_PATTERN, '')
    .replace(THINKIFIC_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n') // Clean up extra newlines
    .trim();
}

/**
 * Parse all rich content markers from AI response text
 */
export function parseRichContent(text: string): RichContent[] {
  const richContent: RichContent[] = [];

  // Parse each type of marker
  richContent.push(...parseLessonMarkers(text));
  richContent.push(...parseChartMarkers(text));
  richContent.push(...parseSetupMarkers(text));
  richContent.push(...parseQuizMarkers(text));
  richContent.push(...parseVideoMarkers(text));
  richContent.push(...parseThinkificMarkers(text));

  return richContent;
}

/**
 * Parse AI response and return both clean text and rich content
 */
export function parseAIResponse(text: string): {
  cleanText: string;
  richContent: RichContent[];
} {
  return {
    cleanText: stripRichContentMarkers(text),
    richContent: parseRichContent(text),
  };
}

/**
 * Check if text contains any rich content markers
 */
export function hasRichContent(text: string): boolean {
  // Reset all regex patterns
  LESSON_PATTERN.lastIndex = 0;
  CHART_PATTERN.lastIndex = 0;
  SETUP_PATTERN.lastIndex = 0;
  QUIZ_PATTERN.lastIndex = 0;
  VIDEO_PATTERN.lastIndex = 0;
  THINKIFIC_PATTERN.lastIndex = 0;

  return (
    LESSON_PATTERN.test(text) ||
    CHART_PATTERN.test(text) ||
    SETUP_PATTERN.test(text) ||
    QUIZ_PATTERN.test(text) ||
    VIDEO_PATTERN.test(text) ||
    THINKIFIC_PATTERN.test(text)
  );
}

/**
 * Format milliseconds to display time string (MM:SS or HH:MM:SS)
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
 * Generate YouTube URL with timestamp
 */
export function generateYouTubeUrl(videoId: string, startMs: number): string {
  const startSeconds = Math.floor(startMs / 1000);
  return `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`;
}
