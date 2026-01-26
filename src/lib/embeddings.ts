/**
 * Embedding Service for RAG
 *
 * Handles text chunking and embedding generation using OpenAI's API.
 * Embeddings are stored in Supabase with pgvector for similarity search.
 */

import OpenAI from 'openai';
import { encodingForModel } from 'js-tiktoken';
import { supabaseAdmin } from './supabase';
import logger from './logger';

// Initialize OpenAI client (lazy)
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TOKENS_PER_CHUNK = 500;
const CHUNK_OVERLAP_TOKENS = 50;

// Tiktoken encoder for the embedding model
let encoder: ReturnType<typeof encodingForModel> | null = null;

function getEncoder() {
  if (!encoder) {
    // text-embedding-3-small uses cl100k_base encoding (same as gpt-4)
    encoder = encodingForModel('gpt-4');
  }
  return encoder;
}

export interface ChunkMetadata {
  sourceType: 'transcript' | 'document' | 'lesson' | 'manual' | 'course_lesson' | 'youtube_video';
  sourceId: string;
  sourceTitle: string;
  topic?: string;
  subtopic?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  ltpRelevance?: number;
}

/**
 * A chunk with timestamp information for video transcripts
 */
export interface TimestampedChunk {
  content: string;
  startMs: number;
  endMs: number;
  segmentIndices?: number[];
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  topic?: string;
  sourceTitle: string;
  sourceType: string;
  sourceId: string;
  similarity: number;
}

/**
 * Count tokens in a text string
 */
export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

/**
 * Chunk text into smaller pieces with overlap
 * Uses sentence boundaries when possible for cleaner chunks
 */
export function chunkText(text: string, maxTokens = MAX_TOKENS_PER_CHUNK): string[] {
  const enc = getEncoder();
  const chunks: string[] = [];

  // Clean up text - normalize whitespace
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Split into sentences (rough approximation)
  const sentences = cleanText.split(/(?<=[.!?])\s+/);

  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = enc.encode(sentence).length;

    // If single sentence is too long, split it further
    if (sentenceTokens > maxTokens) {
      // Save current chunk if not empty
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
        currentTokens = 0;
      }

      // Split long sentence by words
      const words = sentence.split(/\s+/);
      let wordChunk: string[] = [];
      let wordTokens = 0;

      for (const word of words) {
        const wordLen = enc.encode(word + ' ').length;
        if (wordTokens + wordLen > maxTokens) {
          if (wordChunk.length > 0) {
            chunks.push(wordChunk.join(' '));
          }
          wordChunk = [word];
          wordTokens = wordLen;
        } else {
          wordChunk.push(word);
          wordTokens += wordLen;
        }
      }

      if (wordChunk.length > 0) {
        currentChunk = wordChunk;
        currentTokens = wordTokens;
      }
      continue;
    }

    // Check if adding this sentence exceeds the limit
    if (currentTokens + sentenceTokens > maxTokens) {
      // Save current chunk
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
      }

      // Start new chunk with overlap
      // Take last few sentences that fit in overlap
      const overlapSentences: string[] = [];
      let overlapTokens = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const sTokens = enc.encode(currentChunk[i]).length;
        if (overlapTokens + sTokens <= CHUNK_OVERLAP_TOKENS) {
          overlapSentences.unshift(currentChunk[i]);
          overlapTokens += sTokens;
        } else {
          break;
        }
      }

      currentChunk = [...overlapSentences, sentence];
      currentTokens = overlapTokens + sentenceTokens;
    } else {
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAI();

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // Limit input length
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error generating embedding', error instanceof Error ? error : { message: String(error) });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAI();

  // OpenAI allows up to 2048 inputs per batch
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(t => t.slice(0, 8000)),
        dimensions: EMBEDDING_DIMENSIONS,
      });

      // Sort by index to maintain order
      const sortedData = response.data.sort((a, b) => a.index - b.index);
      allEmbeddings.push(...sortedData.map(d => d.embedding));
    } catch (error) {
      logger.error('Error generating batch embeddings', { batch: i, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  return allEmbeddings;
}

/**
 * Embed and store chunks in the database
 */
export async function embedAndStoreChunks(
  chunks: string[],
  metadata: ChunkMetadata
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  try {
    logger.info('Starting chunk embedding', {
      chunkCount: chunks.length,
      sourceType: metadata.sourceType,
      sourceId: metadata.sourceId,
    });

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks);

    // Prepare records for insertion
    const records = chunks.map((content, index) => ({
      content,
      embedding: JSON.stringify(embeddings[index]),
      source_type: metadata.sourceType,
      source_id: metadata.sourceId,
      source_title: metadata.sourceTitle,
      topic: metadata.topic || null,
      subtopic: metadata.subtopic || null,
      difficulty: metadata.difficulty || 'beginner',
      ltp_relevance: metadata.ltpRelevance || 0.5,
      chunk_index: index,
    }));

    // Delete existing chunks for this source (if re-processing)
    await supabaseAdmin
      .from('knowledge_chunks')
      .delete()
      .eq('source_type', metadata.sourceType)
      .eq('source_id', metadata.sourceId);

    // Insert new chunks
    const { error } = await supabaseAdmin
      .from('knowledge_chunks')
      .insert(records);

    if (error) {
      logger.error('Error inserting chunks', { error: error.message });
      return { success: false, chunkCount: 0, error: error.message };
    }

    // Update knowledge source status
    await supabaseAdmin
      .from('knowledge_sources')
      .upsert({
        source_type: metadata.sourceType,
        source_id: metadata.sourceId,
        title: metadata.sourceTitle,
        status: 'complete',
        chunk_count: chunks.length,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source_type,source_id',
      });

    logger.info('Successfully stored chunks', {
      chunkCount: chunks.length,
      sourceId: metadata.sourceId,
    });

    return { success: true, chunkCount: chunks.length };
  } catch (error) {
    logger.error('Error in embedAndStoreChunks', error instanceof Error ? error : { message: String(error) });

    // Update source status to failed
    await supabaseAdmin
      .from('knowledge_sources')
      .upsert({
        source_type: metadata.sourceType,
        source_id: metadata.sourceId,
        title: metadata.sourceTitle,
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source_type,source_id',
      });

    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Embed and store timestamped chunks in a single operation
 *
 * This function inserts chunks WITH timestamp metadata directly,
 * avoiding the need to update timestamps after the fact (no content-prefix hack).
 *
 * Use this for video transcripts where timestamps are known upfront.
 */
export async function embedAndStoreTimestampedChunks(
  chunks: TimestampedChunk[],
  metadata: ChunkMetadata
): Promise<{ success: boolean; chunkCount: number; chunkIds?: string[]; error?: string }> {
  try {
    if (chunks.length === 0) {
      return { success: true, chunkCount: 0, chunkIds: [] };
    }

    logger.info('Starting timestamped chunk embedding', {
      chunkCount: chunks.length,
      sourceType: metadata.sourceType,
      sourceId: metadata.sourceId,
    });

    // Generate embeddings for all chunks
    const texts = chunks.map(c => c.content.slice(0, 8000));
    const embeddings = await generateEmbeddings(texts);

    // Prepare records with timestamps included
    const records = chunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: JSON.stringify(embeddings[index]),
      source_type: metadata.sourceType,
      source_id: metadata.sourceId,
      source_title: metadata.sourceTitle,
      topic: metadata.topic || null,
      subtopic: metadata.subtopic || null,
      difficulty: metadata.difficulty || 'intermediate',
      ltp_relevance: metadata.ltpRelevance || 0.5,
      chunk_index: index,
      // Timestamp columns - inserted directly, no update hack needed
      start_timestamp_ms: chunk.startMs,
      end_timestamp_ms: chunk.endMs,
      segment_indices: chunk.segmentIndices || null,
    }));

    // Delete existing chunks for this source (if re-processing)
    await supabaseAdmin
      .from('knowledge_chunks')
      .delete()
      .eq('source_type', metadata.sourceType)
      .eq('source_id', metadata.sourceId);

    // Insert new chunks with timestamps in single operation
    const { data, error } = await supabaseAdmin
      .from('knowledge_chunks')
      .insert(records)
      .select('id');

    if (error) {
      logger.error('Error inserting timestamped chunks', { error: error.message });
      return { success: false, chunkCount: 0, error: error.message };
    }

    const chunkIds = data?.map(r => r.id) || [];

    // Update knowledge source status
    await supabaseAdmin
      .from('knowledge_sources')
      .upsert({
        source_type: metadata.sourceType,
        source_id: metadata.sourceId,
        title: metadata.sourceTitle,
        status: 'complete',
        chunk_count: chunks.length,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source_type,source_id',
      });

    logger.info('Successfully stored timestamped chunks', {
      chunkCount: chunks.length,
      sourceId: metadata.sourceId,
      hasTimestamps: true,
    });

    return { success: true, chunkCount: chunks.length, chunkIds };
  } catch (error) {
    logger.error('Error in embedAndStoreTimestampedChunks', error instanceof Error ? error : { message: String(error) });

    // Update source status to failed
    await supabaseAdmin
      .from('knowledge_sources')
      .upsert({
        source_type: metadata.sourceType,
        source_id: metadata.sourceId,
        title: metadata.sourceTitle,
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'source_type,source_id',
      });

    return {
      success: false,
      chunkCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process and embed a full document/text
 */
export async function processAndEmbedText(
  text: string,
  metadata: ChunkMetadata
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  // Mark source as processing
  await supabaseAdmin
    .from('knowledge_sources')
    .upsert({
      source_type: metadata.sourceType,
      source_id: metadata.sourceId,
      title: metadata.sourceTitle,
      status: 'processing',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'source_type,source_id',
    });

  // Chunk the text
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return { success: false, chunkCount: 0, error: 'No valid chunks generated from text' };
  }

  // Embed and store
  return embedAndStoreChunks(chunks, metadata);
}

/**
 * Check if embeddings are configured and available
 */
export function isEmbeddingConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export { EMBEDDING_DIMENSIONS };
