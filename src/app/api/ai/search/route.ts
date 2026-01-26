/**
 * Semantic Search API
 *
 * POST /api/ai/search - AI-powered semantic search across the platform
 *
 * Features:
 * - Natural language query interpretation
 * - Multi-scope search (trades, lessons, videos, setups)
 * - Intent detection (search vs question vs action)
 * - Smart suggestions
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getEnhancedRAGContext } from '@/lib/rag';
import { getLessonUrl, getLessonResolverUrl } from '@/lib/learning/urls';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// Types
// ============================================

interface SearchRequest {
  query: string;
  scope?: 'all' | 'trades' | 'lessons' | 'videos' | 'setups';
  filters?: {
    dateRange?: { start: string; end: string };
    symbols?: string[];
    tags?: string[];
  };
  limit?: number;
}

interface SearchResult {
  id: string;
  type: 'trade' | 'lesson' | 'video' | 'setup' | 'concept';
  title: string;
  description: string;
  url?: string;
  relevance: number;
  metadata?: Record<string, unknown>;
}

interface SearchInterpretation {
  originalQuery: string;
  interpretation: string;
  intent: 'search' | 'question' | 'action';
  scope: string[];
  suggestions: string[];
  filters?: Record<string, unknown>;
}

// ============================================
// API Handler
// ============================================

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SearchRequest = await request.json();
    const { query, scope = 'all', filters, limit = 10 } = body;

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 });
    }

    // Step 1: Interpret the query using AI
    const interpretation = await interpretQuery(query, scope);

    // Step 2: Search based on interpretation
    const results: SearchResult[] = [];

    // Search trades if in scope
    if (scope === 'all' || scope === 'trades') {
      const tradeResults = await searchTrades(user.discordId!, query, interpretation, filters, limit);
      results.push(...tradeResults);
    }

    // Search lessons if in scope
    if (scope === 'all' || scope === 'lessons') {
      const lessonResults = await searchLessons(query, interpretation, limit);
      results.push(...lessonResults);
    }

    // Search videos if in scope
    if (scope === 'all' || scope === 'videos') {
      const videoResults = await searchVideos(query, interpretation, limit);
      results.push(...videoResults);
    }

    // Search setups if in scope
    if (scope === 'all' || scope === 'setups') {
      const setupResults = await searchSetups(user.discordId!, query, interpretation, limit);
      results.push(...setupResults);
    }

    // Use RAG for concept search
    if (scope === 'all') {
      const ragResults = await searchConcepts(query, limit);
      results.push(...ragResults);
    }

    // Sort by relevance and dedupe
    const sortedResults = results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return NextResponse.json({
      results: sortedResults,
      interpretation,
      totalResults: sortedResults.length,
    });
  } catch (error) {
    logger.error('Semantic search error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

// ============================================
// Query Interpretation
// ============================================

async function interpretQuery(query: string, scope: string): Promise<SearchInterpretation> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: `You are a search query interpreter for a trading education platform. Analyze the user's query and return a JSON object with:
- interpretation: A clearer version of what they're looking for
- intent: "search" (looking for items), "question" (asking something), or "action" (wants to do something)
- scope: Array of relevant data types ["trades", "lessons", "videos", "setups", "concepts"]
- suggestions: 2-3 alternative search queries they might try
- filters: Any implicit filters (e.g., "losing trades" implies pnl < 0)

Only respond with valid JSON, no markdown.`,
      messages: [{
        role: 'user',
        content: `Query: "${query}"\nScope hint: ${scope}`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const parsed = JSON.parse(content.text);
    return {
      originalQuery: query,
      interpretation: parsed.interpretation || query,
      intent: parsed.intent || 'search',
      scope: parsed.scope || [scope],
      suggestions: parsed.suggestions || [],
      filters: parsed.filters,
    };
  } catch (error) {
    // Fallback interpretation
    return {
      originalQuery: query,
      interpretation: `Searching for "${query}"`,
      intent: query.includes('?') ? 'question' : 'search',
      scope: [scope],
      suggestions: [],
    };
  }
}

// ============================================
// Search Functions
// ============================================

async function searchTrades(
  discordId: string,
  query: string,
  interpretation: SearchInterpretation,
  filters?: SearchRequest['filters'],
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!profile) return [];

    // Build query based on interpretation
    let dbQuery = supabaseAdmin
      .from('trade_journal')
      .select('*')
      .eq('user_id', profile.id)
      .order('entry_time', { ascending: false })
      .limit(limit * 2); // Get more to filter

    // Apply implicit filters from interpretation
    if (interpretation.filters) {
      const f = interpretation.filters;
      if (f.pnlNegative) {
        dbQuery = dbQuery.lt('pnl', 0);
      }
      if (f.pnlPositive) {
        dbQuery = dbQuery.gt('pnl', 0);
      }
      if (f.symbols && Array.isArray(f.symbols)) {
        dbQuery = dbQuery.in('symbol', f.symbols);
      }
    }

    // Apply explicit filters
    if (filters?.dateRange) {
      dbQuery = dbQuery.gte('entry_time', filters.dateRange.start);
      dbQuery = dbQuery.lte('entry_time', filters.dateRange.end);
    }
    if (filters?.symbols && filters.symbols.length > 0) {
      dbQuery = dbQuery.in('symbol', filters.symbols);
    }

    const { data: trades, error } = await dbQuery;

    if (error || !trades) return [];

    // Score and convert to results
    const lowerQuery = query.toLowerCase();
    return trades
      .map((trade): SearchResult => {
        let relevance = 50;

        // Boost for symbol match
        if (trade.symbol?.toLowerCase().includes(lowerQuery)) relevance += 30;

        // Boost for notes match
        if (trade.notes?.toLowerCase().includes(lowerQuery)) relevance += 20;

        // Boost for direction match
        if (lowerQuery.includes(trade.direction?.toLowerCase())) relevance += 10;

        return {
          id: trade.id,
          type: 'trade',
          title: `${trade.symbol} ${trade.direction} ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl?.toFixed(2) || '0'}`,
          description: `${new Date(trade.entry_time).toLocaleDateString()} - ${trade.notes?.slice(0, 50) || 'No notes'}`,
          url: `/journal?trade=${trade.id}`,
          relevance: Math.min(relevance, 100),
          metadata: { pnl: trade.pnl, symbol: trade.symbol },
        };
      })
      .filter((r) => r.relevance > 40)
      .slice(0, limit);
  } catch (error) {
    logger.error('Trade search error', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

// Type for the Supabase query result with nested relations
interface LessonQueryResult {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  key_takeaways: string[] | null;
  course_modules: {
    slug: string;
    title: string;
    courses: {
      slug: string;
      title: string;
    };
  };
}

async function searchLessons(
  query: string,
  interpretation: SearchInterpretation,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // Query course_lessons with joins to get course and module slugs
    const { data: lessons, error } = await supabaseAdmin
      .from('course_lessons')
      .select(`
        id,
        slug,
        title,
        description,
        duration_seconds,
        key_takeaways,
        course_modules!inner (
          slug,
          title,
          courses!inner (
            slug,
            title
          )
        )
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (error || !lessons) {
      // Fallback to legacy lessons table if course_lessons fails
      return searchLessonsLegacy(query, interpretation, limit);
    }

    // Also search transcript_segments for timestamp matches
    const timestampMatches = await searchTranscriptSegments(query, limit);

    const lowerQuery = query.toLowerCase();
    const results = (lessons as unknown as LessonQueryResult[])
      .map((lesson): SearchResult => {
        let relevance = 50;

        if (lesson.title?.toLowerCase().includes(lowerQuery)) relevance += 40;
        if (lesson.description?.toLowerCase().includes(lowerQuery)) relevance += 20;
        if (lesson.key_takeaways?.some((c: string) => c.toLowerCase().includes(lowerQuery))) relevance += 30;

        const courseSlug = lesson.course_modules.courses.slug;
        const moduleSlug = lesson.course_modules.slug;
        const durationMinutes = lesson.duration_seconds ? Math.round(lesson.duration_seconds / 60) : 10;

        // Check if there's a timestamp match for this lesson
        const timestampMatch = timestampMatches.find(t => t.contentId === lesson.id);
        let url = getLessonUrl(courseSlug, moduleSlug, lesson.slug);

        // Add timestamp to URL if we have a match
        if (timestampMatch) {
          const timestampSeconds = Math.floor(timestampMatch.startMs / 1000);
          url = `${url}?t=${timestampSeconds}`;
          relevance += 15; // Boost for timestamp match
        }

        return {
          id: lesson.id,
          type: 'lesson',
          title: lesson.title,
          description: timestampMatch
            ? `${lesson.course_modules.title} - Found at ${formatTimestamp(timestampMatch.startMs)}`
            : `${lesson.course_modules.title} - ${durationMinutes} min`,
          url,
          relevance: Math.min(relevance, 100),
          metadata: {
            courseSlug,
            moduleSlug,
            lessonSlug: lesson.slug,
            duration: durationMinutes,
            timestampMatch: timestampMatch?.text,
            timestampSeconds: timestampMatch ? Math.floor(timestampMatch.startMs / 1000) : undefined,
          },
        };
      })
      .filter((r) => r.relevance > 40)
      .slice(0, limit);

    // Also include transcript-only matches (lessons not in top results)
    const resultIds = new Set(results.map(r => r.id));
    const additionalMatches = await Promise.all(
      timestampMatches
        .filter(t => !resultIds.has(t.contentId))
        .slice(0, 3)
        .map(async (match): Promise<SearchResult | null> => {
          const { data: lesson } = await supabaseAdmin
            .from('course_lessons')
            .select(`
              id, slug, title,
              course_modules!inner (slug, courses!inner (slug))
            `)
            .eq('id', match.contentId)
            .single();

          if (!lesson) return null;

          const lessonData = lesson as unknown as {
            id: string;
            slug: string;
            title: string;
            course_modules: { slug: string; courses: { slug: string } };
          };

          const courseSlug = lessonData.course_modules.courses.slug;
          const moduleSlug = lessonData.course_modules.slug;
          const timestampSeconds = Math.floor(match.startMs / 1000);

          return {
            id: lessonData.id,
            type: 'lesson',
            title: lessonData.title,
            description: `Transcript match at ${formatTimestamp(match.startMs)}`,
            url: `${getLessonUrl(courseSlug, moduleSlug, lessonData.slug)}?t=${timestampSeconds}`,
            relevance: 70,
            metadata: {
              courseSlug,
              moduleSlug,
              lessonSlug: lessonData.slug,
              timestampMatch: match.text,
              timestampSeconds,
            },
          };
        })
    );

    // Merge and sort results
    const allResults = [...results, ...additionalMatches.filter((r): r is SearchResult => r !== null)];
    return allResults.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  } catch (error) {
    logger.error('Lesson search error', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

interface TranscriptSegmentMatch {
  contentId: string;
  text: string;
  startMs: number;
  endMs: number;
  rank: number;
}

async function searchTranscriptSegments(query: string, limit: number = 10): Promise<TranscriptSegmentMatch[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('search_transcript_segments', {
      p_content_type: 'course_lesson',
      p_content_id: null, // Search all lessons
      p_query: query,
      p_limit: limit,
    });

    if (error || !data) return [];

    return data.map((row: { content_id: string; text: string; start_ms: number; end_ms: number; rank: number }) => ({
      contentId: row.content_id,
      text: row.text,
      startMs: row.start_ms,
      endMs: row.end_ms,
      rank: row.rank,
    }));
  } catch (error) {
    logger.error('Transcript segment search error', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Fallback for legacy lessons table
async function searchLessonsLegacy(
  query: string,
  interpretation: SearchInterpretation,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const { data: lessons, error } = await supabaseAdmin
      .from('lessons')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (error || !lessons) return [];

    const lowerQuery = query.toLowerCase();
    return lessons
      .map((lesson): SearchResult => {
        let relevance = 50;

        if (lesson.title?.toLowerCase().includes(lowerQuery)) relevance += 40;
        if (lesson.description?.toLowerCase().includes(lowerQuery)) relevance += 20;
        if (lesson.key_concepts?.some((c: string) => c.toLowerCase().includes(lowerQuery))) relevance += 30;

        // Use resolver URL since we don't have course context in legacy table
        return {
          id: lesson.id,
          type: 'lesson',
          title: lesson.title,
          description: `${lesson.module_id} - ${lesson.duration || '10'} min`,
          url: getLessonResolverUrl(lesson.module_id, lesson.slug),
          relevance: Math.min(relevance, 100),
          metadata: { moduleSlug: lesson.module_id, lessonSlug: lesson.slug, duration: lesson.duration },
        };
      })
      .filter((r) => r.relevance > 40)
      .slice(0, limit);
  } catch (error) {
    logger.error('Legacy lesson search error', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function searchVideos(
  query: string,
  interpretation: SearchInterpretation,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const { data: videos, error } = await supabaseAdmin
      .from('video_resources')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (error || !videos) return [];

    const lowerQuery = query.toLowerCase();
    return videos
      .map((video): SearchResult => {
        let relevance = 50;

        if (video.title?.toLowerCase().includes(lowerQuery)) relevance += 40;
        if (video.description?.toLowerCase().includes(lowerQuery)) relevance += 20;
        if (video.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery))) relevance += 25;

        return {
          id: video.id,
          type: 'video',
          title: video.title,
          description: `${video.platform || 'Video'} - ${video.duration || 'Unknown duration'}`,
          url: `/resources?video=${video.id}`,
          relevance: Math.min(relevance, 100),
          metadata: { platform: video.platform, url: video.url },
        };
      })
      .filter((r) => r.relevance > 40)
      .slice(0, limit);
  } catch (error) {
    logger.error('Video search error', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function searchSetups(
  discordId: string,
  query: string,
  interpretation: SearchInterpretation,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!profile) return [];

    const { data: setups, error } = await supabaseAdmin
      .from('detected_setups')
      .select('*')
      .eq('user_id', profile.id)
      .order('detected_at', { ascending: false })
      .limit(limit * 2);

    if (error || !setups) return [];

    const lowerQuery = query.toLowerCase();
    return setups
      .map((setup): SearchResult => {
        let relevance = 50;

        if (setup.symbol?.toLowerCase().includes(lowerQuery)) relevance += 40;
        if (setup.direction?.toLowerCase().includes(lowerQuery)) relevance += 20;
        if (setup.status === 'active') relevance += 15;

        return {
          id: setup.id,
          type: 'setup',
          title: `${setup.symbol} ${setup.direction} Setup`,
          description: `${setup.confluence_score || 0}% confluence - ${setup.status}`,
          url: `/companion?setup=${setup.id}`,
          relevance: Math.min(relevance, 100),
          metadata: { confluenceScore: setup.confluence_score, status: setup.status },
        };
      })
      .filter((r) => r.relevance > 40)
      .slice(0, limit);
  } catch (error) {
    logger.error('Setup search error', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function searchConcepts(query: string, limit: number = 5): Promise<SearchResult[]> {
  try {
    const ragContext = await getEnhancedRAGContext(query);

    if (!ragContext.hasContext) return [];

    return ragContext.sources.slice(0, limit).map((source, idx): SearchResult => ({
      id: `concept-${idx}`,
      type: 'concept',
      title: source.title,
      description: source.type,
      url: undefined,
      relevance: Math.round(source.relevance * 100),
      metadata: { type: source.type },
    }));
  } catch (error) {
    logger.error('Concept search error', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}
