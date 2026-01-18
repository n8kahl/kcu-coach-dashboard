/**
 * Curriculum Context Helper for AI Chat
 *
 * Provides curriculum context and lesson lookup for the AI Coach
 * to enable linking to training content in chat responses.
 */

import { CURRICULUM_MODULES } from '@/data/curriculum';
import type { CurriculumModule, CurriculumLesson } from '@/types';

export interface LessonReference {
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  lessonId: string;
  lessonSlug: string;
  title: string;
  duration: string;
  description: string;
  keyTakeaways: string[];
  relevance: number;
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }
  return `${minutes} min`;
}

/**
 * Get a summary of the curriculum structure for the AI system prompt
 */
export function getCurriculumSummary(): string {
  return CURRICULUM_MODULES.map(mod => {
    const lessonList = mod.lessons.map(l =>
      `    - "${l.title}" (${formatDuration(l.duration)}) [${mod.slug}/${l.slug}]`
    ).join('\n');

    return `Module ${mod.order}: ${mod.title}
  Description: ${mod.description}
  Lessons:
${lessonList}`;
  }).join('\n\n');
}

/**
 * Get a compact curriculum reference for the AI
 */
export function getCurriculumReference(): string {
  const lines: string[] = ['AVAILABLE LESSONS (use [[LESSON:module-slug/lesson-slug|Title|Duration]] format):'];

  for (const mod of CURRICULUM_MODULES) {
    lines.push(`\n${mod.title}:`);
    for (const lesson of mod.lessons) {
      lines.push(`  - [[LESSON:${mod.slug}/${lesson.slug}|${lesson.title}|${formatDuration(lesson.duration)}]]`);
    }
  }

  return lines.join('\n');
}

/**
 * Find lessons relevant to a user query based on keyword matching
 */
export function findRelevantLessons(query: string, limit: number = 3): LessonReference[] {
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(k => k.length > 2);

  const matches: LessonReference[] = [];

  for (const module of CURRICULUM_MODULES) {
    for (const lesson of module.lessons) {
      // Build searchable text from lesson content
      const searchText = [
        lesson.title,
        lesson.description,
        ...(lesson.key_takeaways || [])
      ].join(' ').toLowerCase();

      // Calculate relevance score based on keyword matches
      let relevance = 0;
      for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
          relevance += 1;
          // Boost if keyword is in title
          if (lesson.title.toLowerCase().includes(keyword)) {
            relevance += 2;
          }
        }
      }

      // Also check module-level keywords
      if (module.title.toLowerCase().includes(keywords.join(' '))) {
        relevance += 1;
      }

      if (relevance > 0) {
        matches.push({
          moduleId: module.id,
          moduleSlug: module.slug,
          moduleTitle: module.title,
          lessonId: lesson.id,
          lessonSlug: lesson.slug,
          title: lesson.title,
          duration: formatDuration(lesson.duration),
          description: lesson.description,
          keyTakeaways: lesson.key_takeaways || [],
          relevance,
        });
      }
    }
  }

  return matches
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

/**
 * Get lesson details by module slug and lesson slug
 */
export function getLessonBySlug(
  moduleSlug: string,
  lessonSlug: string
): { module: CurriculumModule; lesson: CurriculumLesson } | null {
  const module = CURRICULUM_MODULES.find(m => m.slug === moduleSlug);
  if (!module) return null;

  const lesson = module.lessons.find(l => l.slug === lessonSlug);
  if (!lesson) return null;

  return { module, lesson };
}

/**
 * Get all lessons as a flat array with module context
 */
export function getAllLessons(): LessonReference[] {
  const lessons: LessonReference[] = [];

  for (const module of CURRICULUM_MODULES) {
    for (const lesson of module.lessons) {
      lessons.push({
        moduleId: module.id,
        moduleSlug: module.slug,
        moduleTitle: module.title,
        lessonId: lesson.id,
        lessonSlug: lesson.slug,
        title: lesson.title,
        duration: formatDuration(lesson.duration),
        description: lesson.description,
        keyTakeaways: lesson.key_takeaways || [],
        relevance: 0,
      });
    }
  }

  return lessons;
}

/**
 * Get lessons for a specific topic/concept
 */
export function getLessonsForTopic(topic: string): LessonReference[] {
  const topicKeywords: Record<string, string[]> = {
    'ltp': ['ltp', 'levels', 'trends', 'patience', 'framework'],
    'patience_candles': ['patience', 'candle', 'confirmation', 'entry'],
    'levels': ['level', 'support', 'resistance', 'hourly', 'key'],
    'trend': ['trend', 'ema', 'direction', 'momentum'],
    'vwap': ['vwap', 'volume', 'weighted', 'average'],
    'orb': ['orb', 'opening', 'range', 'breakout'],
    'psychology': ['psychology', 'mindset', 'fear', 'fomo', 'discipline'],
    'entries': ['entry', 'confirmation', 'stop', 'target'],
    'exits': ['exit', 'profit', 'target', 'scaling'],
    'indicators': ['indicator', 'ema', 'vwap', 'cloud'],
    'price_action': ['price', 'action', 'candlestick', 'candle'],
  };

  const keywords = topicKeywords[topic.toLowerCase()] || [topic.toLowerCase()];
  return findRelevantLessons(keywords.join(' '), 5);
}
