/**
 * RAG (Retrieval Augmented Generation) Library
 *
 * Provides semantic search over the knowledge base and formats
 * relevant context for inclusion in AI prompts.
 */

import { generateEmbedding, isEmbeddingConfigured, KnowledgeChunk } from './embeddings';
import { supabaseAdmin } from './supabase';
import logger from './logger';

// Search configuration
const DEFAULT_MATCH_COUNT = 5;
const DEFAULT_MATCH_THRESHOLD = 0.7;

export interface SearchResult {
  chunks: KnowledgeChunk[];
  searchQuery: string;
  processingTimeMs: number;
}

export interface RAGContext {
  contextText: string;
  sources: Array<{
    title: string;
    type: string;
    relevance: number;
  }>;
  hasContext: boolean;
}

/**
 * Search the knowledge base for relevant chunks
 */
export async function searchKnowledge(
  query: string,
  options: {
    limit?: number;
    threshold?: number;
    topic?: string;
    sourceType?: string;
  } = {}
): Promise<SearchResult> {
  const startTime = Date.now();
  const {
    limit = DEFAULT_MATCH_COUNT,
    threshold = DEFAULT_MATCH_THRESHOLD,
    topic,
    sourceType,
  } = options;

  // Check if embeddings are configured
  if (!isEmbeddingConfigured()) {
    logger.warn('RAG search skipped - OPENAI_API_KEY not configured');
    return {
      chunks: [],
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Use the match_knowledge_chunks function for vector search
    const { data, error } = await supabaseAdmin.rpc('match_knowledge_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: limit * 2, // Get more results for filtering
    });

    if (error) {
      logger.error('Error in vector search', { error: error.message });
      return {
        chunks: [],
        searchQuery: query,
        processingTimeMs: Date.now() - startTime,
      };
    }

    let chunks: KnowledgeChunk[] = (data || []).map((row: {
      id: string;
      content: string;
      topic: string | null;
      source_title: string;
      source_type: string;
      source_id: string;
      similarity: number;
    }) => ({
      id: row.id,
      content: row.content,
      topic: row.topic || undefined,
      sourceTitle: row.source_title,
      sourceType: row.source_type,
      sourceId: row.source_id,
      similarity: row.similarity,
    }));

    // Apply additional filters if specified
    if (topic) {
      chunks = chunks.filter(c => c.topic?.toLowerCase().includes(topic.toLowerCase()));
    }
    if (sourceType) {
      chunks = chunks.filter(c => c.sourceType === sourceType);
    }

    // Limit to requested count
    chunks = chunks.slice(0, limit);

    logger.info('RAG search completed', {
      query: query.slice(0, 50),
      resultCount: chunks.length,
      processingTimeMs: Date.now() - startTime,
    });

    return {
      chunks,
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Error in searchKnowledge', error instanceof Error ? error : { message: String(error) });
    return {
      chunks: [],
      searchQuery: query,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Format search results as context for Claude
 */
export function formatContextForPrompt(chunks: KnowledgeChunk[]): RAGContext {
  if (chunks.length === 0) {
    return {
      contextText: '',
      sources: [],
      hasContext: false,
    };
  }

  // Deduplicate sources
  const sourceMap = new Map<string, { title: string; type: string; relevance: number }>();

  const contextParts = chunks.map((chunk, index) => {
    const sourceKey = `${chunk.sourceType}-${chunk.sourceId}`;
    if (!sourceMap.has(sourceKey)) {
      sourceMap.set(sourceKey, {
        title: chunk.sourceTitle,
        type: chunk.sourceType,
        relevance: chunk.similarity,
      });
    }

    return `[${index + 1}] ${chunk.content}`;
  });

  const contextText = `
=== RELEVANT KNOWLEDGE FROM KCU TRAINING ===
The following excerpts from KCU training materials may help answer the user's question:

${contextParts.join('\n\n')}

=== END KNOWLEDGE CONTEXT ===

INSTRUCTIONS: Use the above knowledge to inform your response when relevant.
If citing specific information, mention the source (e.g., "According to KCU training...").
Do not make up information not supported by the context or your training.
`;

  return {
    contextText,
    sources: Array.from(sourceMap.values()),
    hasContext: true,
  };
}

/**
 * Get RAG context for a user query
 * This is the main function to call before making a Claude API request
 */
export async function getRAGContext(
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    topic?: string;
  }
): Promise<RAGContext> {
  const searchResult = await searchKnowledge(query, options);
  return formatContextForPrompt(searchResult.chunks);
}

/**
 * Check if RAG is available and has content
 */
export async function isRAGAvailable(): Promise<{ available: boolean; chunkCount: number }> {
  if (!isEmbeddingConfigured()) {
    return { available: false, chunkCount: 0 };
  }

  try {
    const { count, error } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (error) {
      logger.error('Error checking RAG availability', { error: error.message });
      return { available: false, chunkCount: 0 };
    }

    return {
      available: (count || 0) > 0,
      chunkCount: count || 0,
    };
  } catch (error) {
    logger.error('Error in isRAGAvailable', error instanceof Error ? error : { message: String(error) });
    return { available: false, chunkCount: 0 };
  }
}

/**
 * Extract potential LTP-related topics from a query for better search
 */
export function extractLTPTopics(query: string): string[] {
  const ltpKeywords = [
    { pattern: /level/i, topic: 'levels' },
    { pattern: /support|resistance/i, topic: 'levels' },
    { pattern: /trend/i, topic: 'trends' },
    { pattern: /higher high|lower low|hh|ll/i, topic: 'trends' },
    { pattern: /patience|candle|confirmation/i, topic: 'patience candles' },
    { pattern: /entry|exit|stop|target/i, topic: 'trade management' },
    { pattern: /risk|position size|sizing/i, topic: 'risk management' },
    { pattern: /psychology|emotion|discipline/i, topic: 'psychology' },
    { pattern: /setup|pattern/i, topic: 'setups' },
    { pattern: /reversal|breakout|breakdown/i, topic: 'setups' },
    { pattern: /order flow|volume|tape/i, topic: 'order flow' },
    { pattern: /market structure/i, topic: 'market structure' },
  ];

  const topics: string[] = [];
  for (const { pattern, topic } of ltpKeywords) {
    if (pattern.test(query)) {
      if (!topics.includes(topic)) {
        topics.push(topic);
      }
    }
  }

  return topics;
}

/**
 * Enhanced RAG search that considers LTP topics
 */
export async function getEnhancedRAGContext(query: string): Promise<RAGContext> {
  // First, try direct semantic search
  const directSearch = await searchKnowledge(query, { limit: 3, threshold: 0.75 });

  // Extract LTP topics and search for them too
  const topics = extractLTPTopics(query);

  // Combine results
  const allChunks = [...directSearch.chunks];

  // If we found relevant topics but not enough direct matches, search by topic
  if (directSearch.chunks.length < 3 && topics.length > 0) {
    for (const topic of topics.slice(0, 2)) {
      const topicSearch = await searchKnowledge(topic, {
        limit: 2,
        threshold: 0.65,
        topic,
      });

      for (const chunk of topicSearch.chunks) {
        // Avoid duplicates
        if (!allChunks.find(c => c.id === chunk.id)) {
          allChunks.push(chunk);
        }
      }
    }
  }

  // Sort by relevance and limit
  allChunks.sort((a, b) => b.similarity - a.similarity);
  const finalChunks = allChunks.slice(0, 5);

  return formatContextForPrompt(finalChunks);
}
