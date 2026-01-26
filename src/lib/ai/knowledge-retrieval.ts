/**
 * Knowledge Retrieval Service for AI Coach
 *
 * Searches course_lessons (description, transcript_text) to provide
 * relevant course content for AI context injection.
 *
 * Uses PostgreSQL full-text search (to_tsvector) as the primary method,
 * with optional vector similarity search via pgvector if embeddings exist.
 */

import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

// ============================================
// Types
// ============================================

export interface ContentSearchResult {
  id: string;
  title: string;
  courseSlug: string;
  moduleTitle: string;
  moduleSlug: string;
  lessonSlug: string;
  snippet: string;
  relevance: number;
  matchType: 'transcript' | 'description' | 'title';
  videoDurationSeconds?: number;
}

export interface RelevantContentContext {
  contextText: string;
  lessons: ContentSearchResult[];
  hasContent: boolean;
  searchQuery: string;
  processingTimeMs: number;
}

// ============================================
// Full-Text Search Configuration
// ============================================

const MAX_RESULTS = 5;
const SNIPPET_LENGTH = 300;

/**
 * Build a PostgreSQL tsquery from a user's natural language query
 * Converts words to OR-joined search terms for broader matching
 */
function buildSearchQuery(query: string): string {
  // Remove special characters and split into words
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2); // Skip short words

  if (words.length === 0) {
    return '';
  }

  // Join with OR for broader matching, use prefix matching (:*)
  return words.map(word => `${word}:*`).join(' | ');
}

/**
 * Extract a snippet of text around the matching content
 */
function extractSnippet(text: string, query: string, maxLength: number = SNIPPET_LENGTH): string {
  if (!text) return '';

  const lowerText = text.toLowerCase();
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  // Find the first keyword match
  let bestPosition = 0;
  for (const keyword of keywords) {
    const pos = lowerText.indexOf(keyword);
    if (pos !== -1) {
      bestPosition = pos;
      break;
    }
  }

  // Extract surrounding context
  const start = Math.max(0, bestPosition - maxLength / 3);
  const end = Math.min(text.length, bestPosition + maxLength);

  let snippet = text.slice(start, end);

  // Clean up the snippet
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  // Trim to word boundaries
  snippet = snippet.replace(/^\S*\s/, '').replace(/\s\S*$/, '');

  return snippet;
}

/**
 * Main function: Find relevant course content for a user query
 *
 * Uses PostgreSQL full-text search on course_lessons table.
 * Searches across: title, description, transcript_text
 */
export async function findRelevantContent(
  query: string,
  options: {
    limit?: number;
    includeTranscripts?: boolean;
  } = {}
): Promise<RelevantContentContext> {
  const startTime = Date.now();
  const { limit = MAX_RESULTS, includeTranscripts = true } = options;

  const searchQuery = buildSearchQuery(query);

  if (!searchQuery) {
    return {
      contextText: '',
      lessons: [],
      hasContent: false,
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Execute full-text search on course_lessons
    // The index idx_course_lessons_transcript_search covers transcript_text
    // We also search title and description
    const { data, error } = await supabaseAdmin.rpc('search_course_content', {
      search_query: searchQuery,
      result_limit: limit * 2, // Get extra for filtering
    });

    // Fallback if RPC doesn't exist: use direct query
    if (error && error.message.includes('function')) {
      logger.info('Using fallback content search (RPC not available)');
      return fallbackContentSearch(query, limit, startTime);
    }

    if (error) {
      logger.error('Content search error', { error: error.message });
      return {
        contextText: '',
        lessons: [],
        hasContent: false,
        searchQuery: query,
        processingTimeMs: Date.now() - startTime,
      };
    }

    const results = processSearchResults(data || [], query, limit);
    const contextText = formatContentContext(results, includeTranscripts);

    logger.info('Content search completed', {
      query: query.slice(0, 50),
      resultCount: results.length,
      processingTimeMs: Date.now() - startTime,
    });

    return {
      contextText,
      lessons: results,
      hasContent: results.length > 0,
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Error in findRelevantContent', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      contextText: '',
      lessons: [],
      hasContent: false,
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Fallback search using direct SQL queries if RPC is not available
 */
async function fallbackContentSearch(
  query: string,
  limit: number,
  startTime: number
): Promise<RelevantContentContext> {
  const searchTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (searchTerms.length === 0) {
    return {
      contextText: '',
      lessons: [],
      hasContent: false,
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Use ILIKE for simple keyword matching
  const searchPattern = `%${searchTerms.join('%')}%`;

  const { data: lessons, error } = await supabaseAdmin
    .from('course_lessons')
    .select(`
      id,
      title,
      slug,
      description,
      transcript_text,
      video_duration_seconds,
      course_modules!inner (
        title,
        slug,
        courses!inner (
          slug
        )
      )
    `)
    .eq('is_published', true)
    .or(`title.ilike.${searchPattern},description.ilike.${searchPattern},transcript_text.ilike.${searchPattern}`)
    .limit(limit * 2);

  if (error) {
    logger.error('Fallback search error', { error: error.message });
    return {
      contextText: '',
      lessons: [],
      hasContent: false,
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  }

  const results: ContentSearchResult[] = (lessons || []).map((lesson) => {
    const moduleData = lesson.course_modules as unknown as { title: string; slug: string; courses: { slug: string } };

    // Determine best match type and extract snippet
    let matchType: 'title' | 'description' | 'transcript' = 'description';
    let snippet = '';

    const lowerQuery = query.toLowerCase();
    if (lesson.title?.toLowerCase().includes(searchTerms[0])) {
      matchType = 'title';
      snippet = lesson.description || '';
    } else if (lesson.transcript_text?.toLowerCase().includes(searchTerms[0])) {
      matchType = 'transcript';
      snippet = extractSnippet(lesson.transcript_text, query);
    } else {
      snippet = extractSnippet(lesson.description || '', query);
    }

    return {
      id: lesson.id,
      title: lesson.title,
      courseSlug: moduleData?.courses?.slug || 'kcu-trading-mastery',
      moduleTitle: moduleData?.title || 'Unknown Module',
      moduleSlug: moduleData?.slug || '',
      lessonSlug: lesson.slug,
      snippet,
      relevance: matchType === 'title' ? 1.0 : matchType === 'description' ? 0.8 : 0.6,
      matchType,
      videoDurationSeconds: lesson.video_duration_seconds,
    };
  });

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);
  const topResults = results.slice(0, limit);

  return {
    contextText: formatContentContext(topResults, true),
    lessons: topResults,
    hasContent: topResults.length > 0,
    searchQuery: query,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Process raw search results into ContentSearchResult objects
 */
function processSearchResults(
  data: Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    transcript_text: string | null;
    video_duration_seconds: number | null;
    course_slug?: string;
    module_title: string;
    module_slug: string;
    rank: number;
    match_type: string;
  }>,
  query: string,
  limit: number
): ContentSearchResult[] {
  const results: ContentSearchResult[] = data.map((row) => ({
    id: row.id,
    title: row.title,
    courseSlug: row.course_slug || 'kcu-trading-mastery',
    moduleTitle: row.module_title,
    moduleSlug: row.module_slug,
    lessonSlug: row.slug,
    snippet: extractSnippet(
      row.match_type === 'transcript'
        ? row.transcript_text || ''
        : row.description || '',
      query
    ),
    relevance: row.rank,
    matchType: row.match_type as 'transcript' | 'description' | 'title',
    videoDurationSeconds: row.video_duration_seconds || undefined,
  }));

  // Deduplicate by lesson ID
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return unique.slice(0, limit);
}

/**
 * Format search results as context for the AI system prompt
 */
function formatContentContext(
  results: ContentSearchResult[],
  includeTranscripts: boolean
): string {
  if (results.length === 0) {
    return '';
  }

  const lessonContexts = results.map((result, index) => {
    const duration = result.videoDurationSeconds
      ? ` (${Math.round(result.videoDurationSeconds / 60)} min)`
      : '';

    // Use 3-part path (course/module/lesson) for direct linking without resolver
    const lessonPath = `${result.courseSlug}/${result.moduleSlug}/${result.lessonSlug}`;

    let context = `[${index + 1}] "${result.title}"${duration}
   Module: ${result.moduleTitle}
   Link: [[LESSON:${lessonPath}|${result.title}|${Math.round((result.videoDurationSeconds || 0) / 60)} min]]`;

    if (includeTranscripts && result.snippet) {
      context += `\n   Excerpt: ${result.snippet}`;
    }

    return context;
  });

  return `
=== RELEVANT KCU COURSE CONTENT ===
The following lessons from the KCU course library are relevant to this question:

${lessonContexts.join('\n\n')}

=== END COURSE CONTENT ===

INSTRUCTIONS:
- Reference these lessons when answering questions about trading concepts
- Use the [[LESSON:...]] format to link users to relevant lessons
- If a user's question is directly covered by a lesson, recommend they watch it
- Cite specific content from the excerpts when applicable
`;
}

/**
 * Search specifically for lessons related to LTP framework concepts
 */
export async function findLTPContent(topic: string): Promise<ContentSearchResult[]> {
  const ltpKeywords: Record<string, string[]> = {
    levels: ['level', 'support', 'resistance', 'key level', 'price level', 'hourly'],
    trends: ['trend', 'ema', 'higher high', 'lower low', 'trend direction', 'momentum'],
    patience: ['patience candle', 'confirmation', 'entry signal', 'wait', 'candle pattern'],
    vwap: ['vwap', 'volume weighted', 'anchored vwap'],
    orb: ['opening range', 'orb', 'breakout', 'opening range breakout'],
    risk: ['risk management', 'position size', 'stop loss', 'risk reward'],
    psychology: ['trading psychology', 'mindset', 'discipline', 'fear', 'fomo'],
  };

  const keywords = ltpKeywords[topic.toLowerCase()] || [topic];
  const searchQuery = keywords.join(' ');

  const result = await findRelevantContent(searchQuery, { limit: 3 });
  return result.lessons;
}

/**
 * Get lesson details by slug for rich content rendering
 */
export async function getLessonBySlug(
  moduleSlug: string,
  lessonSlug: string
): Promise<ContentSearchResult | null> {
  const { data, error } = await supabaseAdmin
    .from('course_lessons')
    .select(`
      id,
      title,
      slug,
      description,
      video_duration_seconds,
      course_modules!inner (
        title,
        slug,
        courses!inner (
          slug
        )
      )
    `)
    .eq('slug', lessonSlug)
    .eq('course_modules.slug', moduleSlug)
    .single();

  if (error || !data) {
    return null;
  }

  const moduleData = data.course_modules as unknown as { title: string; slug: string; courses: { slug: string } };

  return {
    id: data.id,
    title: data.title,
    courseSlug: moduleData.courses?.slug || 'kcu-trading-mastery',
    moduleTitle: moduleData.title,
    moduleSlug: moduleData.slug,
    lessonSlug: data.slug,
    snippet: data.description || '',
    relevance: 1.0,
    matchType: 'title',
    videoDurationSeconds: data.video_duration_seconds || undefined,
  };
}

/**
 * Check if there is course content available for AI context
 */
export async function hasCourseContent(): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('course_lessons')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true)
    .not('transcript_text', 'is', null);

  if (error) {
    logger.error('Error checking course content', { error: error.message });
    return false;
  }

  return (count || 0) > 0;
}
