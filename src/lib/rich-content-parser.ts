/**
 * Rich Content Parser for AI Chat
 *
 * Parses special markers in AI responses and converts them to
 * structured rich content objects for rendering.
 *
 * Supported markers:
 * - [[LESSON:module-slug/lesson-slug|Title|Duration]] - 2-part path (uses resolver)
 * - [[LESSON:course-slug/module-slug/lesson-slug|Title|Duration]] - 3-part path (direct link)
 * - [[CHART:SYMBOL|interval|indicators]]
 * - [[SETUP:SYMBOL|direction|entry|stop|target|level%|trend%|patience%]]
 * - [[QUIZ:module-slug|title]]
 * - [[VIDEO:videoId|startMs|endMs|Title]] - YouTube video with timestamp
 * - [[LTP_ANALYSIS:SYMBOL|DATE|TIMEFRAME|{JSON}]] - Interactive LTP analysis chart
 * - [[COURSE:courseSlug/moduleSlug/lessonSlug|timestampSeconds|Title]] - Internal course video with timestamp
 */

import type {
  RichContent,
  LessonLinkContent,
  ChartWidgetContent,
  SetupVisualizationContent,
  QuizPromptContent,
  VideoTimestampContent,
  LTPAnalysisChartContent,
  CourseVideoContent,
} from '@/types';

// Lazy-loaded curriculum context for optional metadata enrichment
// The /learn/lesson resolver route is the authoritative source for path resolution
let curriculumModule: { getLessonBySlug?: (moduleSlug: string, lessonSlug: string) => { lesson: { description?: string }; module: { title?: string } } | undefined } | null = null;
let curriculumLoadAttempted = false;

function tryGetLessonMetadata(moduleSlug: string, lessonSlug: string): { description?: string; moduleTitle?: string } | undefined {
  // Only attempt to load curriculum module once
  if (!curriculumLoadAttempted) {
    curriculumLoadAttempted = true;
    try {
      // Dynamic import to avoid hard dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      curriculumModule = require('./curriculum-context');
    } catch {
      // Curriculum context not available - that's fine, we'll use the resolver
      curriculumModule = null;
    }
  }

  if (!curriculumModule?.getLessonBySlug) return undefined;

  try {
    const lessonData = curriculumModule.getLessonBySlug(moduleSlug, lessonSlug);
    if (lessonData) {
      return {
        description: lessonData.lesson.description,
        moduleTitle: lessonData.module.title,
      };
    }
  } catch {
    // Ignore errors from curriculum lookup
  }

  return undefined;
}

// Regex patterns for each marker type
const LESSON_PATTERN = /\[\[LESSON:([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;
const CHART_PATTERN = /\[\[CHART:([^|]+)\|([^|]+)(?:\|([^\]]+))?\]\]/g;
const SETUP_PATTERN = /\[\[SETUP:([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;
const QUIZ_PATTERN = /\[\[QUIZ:([^|]+)\|([^\]]+)\]\]/g;
// Video timestamp: [[VIDEO:videoId|startMs|endMs|Title]]
const VIDEO_PATTERN = /\[\[VIDEO:([^|]+)\|(\d+)\|(\d+)\|([^\]]+)\]\]/g;
// LTP Analysis chart: [[LTP_ANALYSIS:SYMBOL|DATE|TIMEFRAME|{JSON}]]
const LTP_ANALYSIS_PATTERN = /\[\[LTP_ANALYSIS:([^|]+)\|([^|]+)\|([^|]+)\|(\{.*?\})\]\]/g;
// Course video with timestamp: [[COURSE:courseSlug/moduleSlug/lessonSlug|timestampSeconds|Title]]
const COURSE_PATTERN = /\[\[COURSE:([^/]+)\/([^/]+)\/([^|]+)\|(\d+)\|([^\]]+)\]\]/g;

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
 *
 * Supports two formats:
 * - 2-part: [[LESSON:module-slug/lesson-slug|Title|Duration]] - uses resolver
 * - 3-part: [[LESSON:course-slug/module-slug/lesson-slug|Title|Duration]] - direct link
 */
function parseLessonMarkers(text: string): LessonLinkContent[] {
  const lessons: LessonLinkContent[] = [];
  let match;

  // Reset lastIndex for global regex
  LESSON_PATTERN.lastIndex = 0;

  while ((match = LESSON_PATTERN.exec(text)) !== null) {
    const [, path, title, duration] = match;
    const parts = path.split('/');

    let courseSlug: string | undefined;
    let moduleSlug: string;
    let lessonSlug: string;

    if (parts.length === 3) {
      // 3-part path: course/module/lesson - link directly to canonical route
      [courseSlug, moduleSlug, lessonSlug] = parts;
    } else if (parts.length === 2) {
      // 2-part path: module/lesson - uses resolver route
      [moduleSlug, lessonSlug] = parts;
    } else {
      // Invalid format, skip
      continue;
    }

    // Try to get additional metadata from curriculum (optional enrichment)
    const metadata = tryGetLessonMetadata(moduleSlug, lessonSlug);

    lessons.push({
      type: 'lesson_link',
      moduleId: moduleSlug,
      lessonId: lessonSlug,
      title: title.trim(),
      duration: duration.trim(),
      description: metadata?.description,
      moduleTitle: metadata?.moduleTitle,
      courseSlug, // If provided, enables direct canonical link
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
 * Parse LTP Analysis chart markers from text
 * Format: [[LTP_ANALYSIS:SYMBOL|DATE|TIMEFRAME|{JSON}]]
 * JSON contains: title, summary, ltpAnalysis, keyLevels
 */
function parseLTPAnalysisMarkers(text: string): LTPAnalysisChartContent[] {
  const charts: LTPAnalysisChartContent[] = [];
  let match;

  LTP_ANALYSIS_PATTERN.lastIndex = 0;

  while ((match = LTP_ANALYSIS_PATTERN.exec(text)) !== null) {
    const [, symbol, date, timeframe, jsonStr] = match;

    try {
      const data = JSON.parse(jsonStr);

      charts.push({
        type: 'ltp_analysis_chart',
        symbol: symbol.trim().toUpperCase(),
        date: date.trim(),
        timeframe: timeframe.trim() as '1m' | '5m' | '15m' | '1h' | 'day',
        title: data.title || `${symbol} Analysis`,
        summary: data.summary || '',
        ltpAnalysis: {
          grade: data.ltpAnalysis?.grade || 'N/A',
          levelScore: data.ltpAnalysis?.levelScore || 0,
          trendScore: data.ltpAnalysis?.trendScore || 0,
          patienceScore: data.ltpAnalysis?.patienceScore || 0,
          recommendation: data.ltpAnalysis?.recommendation || '',
        },
        keyLevels: (data.keyLevels || []).map((level: { type?: string; price?: number; label?: string; strength?: number }) => ({
          type: level.type || 'unknown',
          price: level.price || 0,
          label: level.label || '',
          strength: level.strength || 0,
        })),
      });
    } catch {
      // Skip malformed JSON markers
      console.warn('Failed to parse LTP_ANALYSIS marker:', jsonStr);
    }
  }

  return charts;
}

/**
 * Parse course video markers from text (internal course videos with timestamp)
 * Format: [[COURSE:courseSlug/moduleSlug/lessonSlug|timestampSeconds|Title]]
 */
function parseCourseMarkers(text: string): CourseVideoContent[] {
  const courseVideos: CourseVideoContent[] = [];
  let match;

  COURSE_PATTERN.lastIndex = 0;

  while ((match = COURSE_PATTERN.exec(text)) !== null) {
    const [, courseSlug, moduleSlug, lessonSlug, timestampStr, title] = match;
    const timestampSeconds = parseInt(timestampStr, 10) || 0;

    courseVideos.push({
      type: 'course_video',
      courseSlug: courseSlug.trim(),
      moduleSlug: moduleSlug.trim(),
      lessonSlug: lessonSlug.trim(),
      timestampSeconds,
      title: title.trim(),
      timestampFormatted: formatTimestampSeconds(timestampSeconds),
    });
  }

  return courseVideos;
}

/**
 * Format seconds to display time string (MM:SS or HH:MM:SS)
 */
function formatTimestampSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
    .replace(LTP_ANALYSIS_PATTERN, '')
    .replace(COURSE_PATTERN, '')
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
  richContent.push(...parseLTPAnalysisMarkers(text));
  richContent.push(...parseCourseMarkers(text));

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
  LTP_ANALYSIS_PATTERN.lastIndex = 0;
  COURSE_PATTERN.lastIndex = 0;

  return (
    LESSON_PATTERN.test(text) ||
    CHART_PATTERN.test(text) ||
    SETUP_PATTERN.test(text) ||
    QUIZ_PATTERN.test(text) ||
    VIDEO_PATTERN.test(text) ||
    LTP_ANALYSIS_PATTERN.test(text) ||
    COURSE_PATTERN.test(text)
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
