# Video Content Integration Architecture

## Overview

This document outlines the **hybrid video content architecture** for the KCU Coach Dashboard, combining:

1. **Thinkific LMS** - Structured courses with SSO deep-linking
2. **KayCapitals YouTube Channel** - Supplementary content for AI coach remediation

This architecture enables:

- **Seamless Course Access**: SSO deep-linking to Thinkific courses/lessons with timestamps
- **Contextual AI Coaching**: Reference both Thinkific lessons and YouTube content
- **Quiz Remediation**: Link failed questions to the exact training video segment
- **Searchable Content**: Full-text and semantic search across all video transcripts
- **RAG Enhancement**: Time-aware retrieval for more precise AI responses
- **Supplementary Learning**: Index YouTube content outside structured courses

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KCU COACH VIDEO CONTENT ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────┐
                    │          KCU Coach User          │
                    └──────────────────┬───────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   AI Coach Chat │         │  Learning Page  │         │  Quiz Results   │
│   (RAG Search)  │         │  (Curriculum)   │         │  (Remediation)  │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │  Video References         │  Deep Links               │  Review Links
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                             │
              ▼                                             ▼
    ┌──────────────────┐                        ┌──────────────────┐
    │  THINKIFIC SSO   │                        │  YOUTUBE VIDEOS  │
    │  (Structured)    │                        │  (Supplementary) │
    ├──────────────────┤                        ├──────────────────┤
    │ • JWT Auth       │                        │ • Channel Index  │
    │ • Course/Lesson  │                        │ • Transcripts    │
    │ • Timestamp ?t=  │                        │ • Embeddings     │
    │ • Deep-linking   │                        │ • Timestamp URLs │
    └────────┬─────────┘                        └────────┬─────────┘
             │                                           │
             │  Opens in Thinkific                       │  Opens YouTube
             │  (new tab, SSO auth)                      │  or Inline Player
             ▼                                           ▼
    ┌──────────────────┐                        ┌──────────────────┐
    │   Thinkific.com  │                        │   youtube.com    │
    │  (with video)    │                        │   ?t=timestamp   │
    └──────────────────┘                        └──────────────────┘
```

---

## System Components

### 1. Thinkific SSO Integration

**Purpose**: Seamless access to structured Thinkific courses from KCU Coach

**File**: `src/lib/thinkific-sso.ts`

**Features**:
- JWT-based Single Sign-On (HS256)
- Deep-linking to courses, lessons, and specific timestamps
- Module-to-course slug mapping
- Error handling with fallback URLs

**API Route**: `/api/thinkific/sso`

### 2. YouTube Channel Indexer

**Purpose**: Index KayCapitals YouTube videos for AI remediation and supplementary content

**File**: `src/lib/youtube-channel-indexer.ts`

**Features**:
- Fetch channel videos via YouTube Data API v3
- Auto-categorize by topic keywords (LTP, Indicators, Psychology, etc.)
- LTP relevance scoring
- Transcript extraction with timestamps
- Semantic embeddings for RAG search

**API Routes**:
- `/api/youtube/sync` - Trigger channel sync (admin)
- `/api/youtube/search` - Search indexed content
- `/api/youtube/videos` - List/filter videos

### 3. Transcript Timestamp System

**Files**:
- `src/lib/transcript-timestamps.ts` - Core timestamp utilities
- `supabase/migrations/016_transcript_timestamps.sql` - Schema
- `supabase/migrations/017_youtube_channel_index.sql` - YouTube tables

**Features**:
- Granular segment storage with timing data
- Timestamp-preserving chunking for embeddings
- Video timestamp rich content type for chat

---

## Current State Analysis

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| YouTube transcript fetcher | ✅ Working | `src/lib/youtube.ts` |
| RAG/Embeddings system | ✅ Working | `src/lib/rag.ts`, `src/lib/embeddings.ts` |
| Knowledge chunks table | ✅ Working | `supabase/migrations/` |
| Rich content parser | ✅ Working | `src/lib/rich-content-parser.ts` |
| AI Coach chat | ✅ Working | `src/app/api/chat/route.ts` |
| Curriculum with video_ids | ✅ Working | `src/data/curriculum.ts` |
| Thinkific SSO library | ✅ NEW | `src/lib/thinkific-sso.ts` |
| YouTube channel indexer | ✅ NEW | `src/lib/youtube-channel-indexer.ts` |
| SSO API route | ✅ NEW | `src/app/api/thinkific/sso/route.ts` |
| YouTube sync API | ✅ NEW | `src/app/api/youtube/sync/route.ts` |
| YouTube search API | ✅ NEW | `src/app/api/youtube/search/route.ts` |
| Transcript field in lessons | ❌ Empty | `curriculum.ts` - transcript: '' |

### What's Configured

1. **Thinkific SSO** - JWT generation with deep-linking
2. **YouTube indexing** - Channel video fetching and transcript processing
3. **Database schema** - Tables for YouTube videos, playlists, sync status
4. **API routes** - SSO URL generation, channel sync, content search

---

## File Structure

```
src/
├── lib/
│   ├── youtube.ts                    # EXISTING - transcript fetching
│   ├── youtube-channel-indexer.ts    # NEW - channel video indexing
│   ├── thinkific-sso.ts              # NEW - SSO deep-linking
│   ├── embeddings.ts                 # EXISTING - chunking + embeddings
│   ├── rag.ts                        # EXISTING - vector search
│   ├── rich-content-parser.ts        # MODIFY - add VIDEO marker
│   ├── transcript-processor.ts       # MODIFY - timestamp preservation
│   └── transcript-timestamps.ts      # NEW - timestamp utilities
│
├── types/
│   └── index.ts                      # MODIFY - add VideoTimestampContent
│
├── components/
│   └── chat/
│       ├── rich-content.tsx          # MODIFY - add VideoTimestampCard
│       ├── video-timestamp-card.tsx  # NEW - timestamp link cards
│       └── video-segment-player.tsx  # NEW - embedded video with timestamp
│
├── app/
│   ├── api/
│   │   ├── thinkific/
│   │   │   └── sso/route.ts          # NEW - SSO URL generation
│   │   ├── youtube/
│   │   │   ├── sync/route.ts         # NEW - channel sync (admin)
│   │   │   ├── search/route.ts       # NEW - content search
│   │   │   └── videos/route.ts       # NEW - list/filter videos
│   │   ├── transcripts/
│   │   │   ├── sync/route.ts         # NEW - batch transcript sync
│   │   │   ├── search/route.ts       # NEW - transcript search
│   │   │   └── [videoId]/route.ts    # NEW - get segments for video
│   │   ├── quiz/
│   │   │   └── remediation/route.ts  # NEW - get remediation links
│   │   └── chat/route.ts             # MODIFY - timestamp-aware RAG
│   │
│   └── (dashboard)/
│       └── learning/
│           └── [module]/[lesson]/
│               └── page.tsx          # MODIFY - timestamp URL params
│
└── data/
    └── curriculum.ts                 # MODIFY - populate transcripts

supabase/
└── migrations/
    ├── 016_transcript_timestamps.sql # NEW - timestamp schema
    └── 017_youtube_channel_index.sql # NEW - YouTube video tables
```

---

## Database Schema Extensions

### New Migration: `016_transcript_timestamps.sql`

```sql
-- ============================================
-- Transcript Timestamp Integration
-- ============================================

-- Add timestamp columns to knowledge_chunks
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS start_timestamp_ms INTEGER,
ADD COLUMN IF NOT EXISTS end_timestamp_ms INTEGER,
ADD COLUMN IF NOT EXISTS segment_indices INTEGER[]; -- Array of original segment indexes

-- Create index for timestamp range queries
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_timestamps
ON knowledge_chunks(source_id, start_timestamp_ms, end_timestamp_ms)
WHERE source_type = 'transcript';

-- ============================================
-- Transcript Segments Table (granular storage)
-- ============================================
CREATE TABLE IF NOT EXISTS transcript_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id VARCHAR(100) NOT NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    start_formatted VARCHAR(20), -- "MM:SS" or "HH:MM:SS"
    speaker VARCHAR(100), -- For future multi-speaker support
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, segment_index)
);

-- Indexes for efficient querying
CREATE INDEX idx_transcript_segments_video ON transcript_segments(video_id);
CREATE INDEX idx_transcript_segments_lesson ON transcript_segments(lesson_id);
CREATE INDEX idx_transcript_segments_time ON transcript_segments(video_id, start_ms);

-- Full-text search index on segment text
CREATE INDEX idx_transcript_segments_text_search
ON transcript_segments USING gin(to_tsvector('english', text));

-- ============================================
-- Quiz Question to Transcript Mapping
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_remediation_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id VARCHAR(100) NOT NULL, -- ID within quiz JSON
    video_id VARCHAR(100) NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    concept_keywords TEXT[], -- For relevance matching
    relevance_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, question_id)
);

CREATE INDEX idx_quiz_remediation_quiz ON quiz_remediation_links(quiz_id);

-- ============================================
-- Enhanced Vector Search Function
-- ============================================
CREATE OR REPLACE FUNCTION match_knowledge_chunks_with_timestamps(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_source_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source_type TEXT,
    source_id TEXT,
    source_title TEXT,
    topic TEXT,
    subtopic TEXT,
    start_timestamp_ms INTEGER,
    end_timestamp_ms INTEGER,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        kc.source_type,
        kc.source_id,
        kc.source_title,
        kc.topic,
        kc.subtopic,
        kc.start_timestamp_ms,
        kc.end_timestamp_ms,
        1 - (kc.embedding <=> query_embedding) AS similarity
    FROM knowledge_chunks kc
    WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
        AND (filter_source_type IS NULL OR kc.source_type = filter_source_type)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_remediation_links ENABLE ROW LEVEL SECURITY;

-- Public read for authenticated users
CREATE POLICY "Segments viewable by authenticated users"
ON transcript_segments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Remediation links viewable by authenticated users"
ON quiz_remediation_links FOR SELECT TO authenticated USING (true);

-- Service role full access
CREATE POLICY "Service role manages segments"
ON transcript_segments FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages remediation"
ON quiz_remediation_links FOR ALL TO service_role USING (true);
```

---

## Core Library: Transcript Timestamps

### New File: `src/lib/transcript-timestamps.ts`

```typescript
/**
 * Transcript Timestamp Utilities
 *
 * Handles timestamp-aware transcript processing and linking
 */

import { supabaseAdmin } from './supabase';
import { fetchTranscript } from './youtube';
import { processAndEmbedText, ChunkMetadata } from './embeddings';

// ============================================
// Types
// ============================================

export interface TranscriptSegment {
  segmentIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  startFormatted: string;
}

export interface TimestampedChunk {
  content: string;
  startMs: number;
  endMs: number;
  segmentIndices: number[];
  metadata: ChunkMetadata;
}

export interface VideoTimestampLink {
  videoId: string;
  lessonId?: string;
  moduleSlug?: string;
  lessonSlug?: string;
  startMs: number;
  endMs: number;
  title: string;
  description?: string;
  relevanceScore?: number;
}

// ============================================
// Timestamp Formatting
// ============================================

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

export function parseTimestamp(formatted: string): number {
  const parts = formatted.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return (parts[0] * 60 + parts[1]) * 1000;
}

export function generateYouTubeTimestampUrl(videoId: string, startMs: number): string {
  const startSeconds = Math.floor(startMs / 1000);
  return `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}s`;
}

// ============================================
// Transcript Fetching & Storage
// ============================================

export async function fetchAndStoreTranscriptSegments(
  videoId: string,
  lessonId?: string
): Promise<TranscriptSegment[]> {
  // Fetch transcript from YouTube
  const rawSegments = await fetchTranscript(videoId);

  if (!rawSegments || rawSegments.length === 0) {
    throw new Error(`No transcript found for video ${videoId}`);
  }

  // Transform to our format
  const segments: TranscriptSegment[] = rawSegments.map((seg, index) => ({
    segmentIndex: index,
    text: seg.text,
    startMs: seg.offset,
    endMs: seg.offset + seg.duration,
    startFormatted: formatTimestamp(seg.offset),
  }));

  // Store in database
  const segmentRows = segments.map(seg => ({
    video_id: videoId,
    lesson_id: lessonId || null,
    segment_index: seg.segmentIndex,
    text: seg.text,
    start_ms: seg.startMs,
    end_ms: seg.endMs,
    start_formatted: seg.startFormatted,
  }));

  const { error } = await supabaseAdmin
    .from('transcript_segments')
    .upsert(segmentRows, { onConflict: 'video_id,segment_index' });

  if (error) {
    console.error('Error storing transcript segments:', error);
    throw error;
  }

  return segments;
}

// ============================================
// Timestamp-Aware Chunking
// ============================================

export async function processTranscriptWithTimestamps(
  videoId: string,
  lessonId: string,
  segments: TranscriptSegment[],
  metadata: Partial<ChunkMetadata>
): Promise<void> {
  const MAX_CHUNK_CHARS = 1500; // ~375 tokens
  const OVERLAP_CHARS = 200;

  const chunks: TimestampedChunk[] = [];
  let currentChunk = '';
  let currentStartMs = segments[0]?.startMs || 0;
  let currentSegmentIndices: number[] = [];

  for (const segment of segments) {
    const potentialChunk = currentChunk + ' ' + segment.text;

    if (potentialChunk.length > MAX_CHUNK_CHARS && currentChunk.length > 0) {
      // Finalize current chunk
      chunks.push({
        content: currentChunk.trim(),
        startMs: currentStartMs,
        endMs: segments[currentSegmentIndices[currentSegmentIndices.length - 1]]?.endMs || segment.startMs,
        segmentIndices: [...currentSegmentIndices],
        metadata: {
          sourceType: 'transcript',
          sourceId: videoId,
          sourceTitle: metadata.sourceTitle || videoId,
          topic: metadata.topic,
          subtopic: metadata.subtopic,
          difficulty: metadata.difficulty,
          ltpRelevance: metadata.ltpRelevance,
        },
      });

      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-OVERLAP_CHARS);
      currentChunk = overlapText + ' ' + segment.text;
      currentStartMs = segment.startMs;
      currentSegmentIndices = [segment.segmentIndex];
    } else {
      currentChunk = potentialChunk;
      currentSegmentIndices.push(segment.segmentIndex);
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      startMs: currentStartMs,
      endMs: segments[segments.length - 1]?.endMs || currentStartMs,
      segmentIndices: currentSegmentIndices,
      metadata: {
        sourceType: 'transcript',
        sourceId: videoId,
        sourceTitle: metadata.sourceTitle || videoId,
        topic: metadata.topic,
        subtopic: metadata.subtopic,
        difficulty: metadata.difficulty,
        ltpRelevance: metadata.ltpRelevance,
      },
    });
  }

  // Process each chunk: embed and store
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Generate embedding using existing function
    const chunkIds = await processAndEmbedText(chunk.content, chunk.metadata);

    // Update the chunk record with timestamp info
    if (chunkIds.length > 0) {
      await supabaseAdmin
        .from('knowledge_chunks')
        .update({
          start_timestamp_ms: chunk.startMs,
          end_timestamp_ms: chunk.endMs,
          segment_indices: chunk.segmentIndices,
        })
        .in('id', chunkIds);
    }
  }
}

// ============================================
// Timestamp Search & Retrieval
// ============================================

export async function findRelevantTimestamps(
  query: string,
  options: {
    videoId?: string;
    lessonId?: string;
    topic?: string;
    limit?: number;
    minRelevance?: number;
  } = {}
): Promise<VideoTimestampLink[]> {
  const { videoId, lessonId, topic, limit = 5, minRelevance = 0.7 } = options;

  // Use RAG search with timestamp-aware function
  const { generateEmbedding } = await import('./embeddings');
  const queryEmbedding = await generateEmbedding(query);

  let sqlQuery = supabaseAdmin.rpc('match_knowledge_chunks_with_timestamps', {
    query_embedding: queryEmbedding,
    match_threshold: minRelevance,
    match_count: limit,
    filter_source_type: 'transcript',
  });

  const { data: chunks, error } = await sqlQuery;

  if (error) {
    console.error('Error searching timestamps:', error);
    return [];
  }

  // Transform to VideoTimestampLink format
  const links: VideoTimestampLink[] = chunks
    .filter((chunk: any) => chunk.start_timestamp_ms !== null)
    .map((chunk: any) => ({
      videoId: chunk.source_id,
      startMs: chunk.start_timestamp_ms,
      endMs: chunk.end_timestamp_ms,
      title: chunk.source_title,
      description: chunk.content.slice(0, 150) + '...',
      relevanceScore: chunk.similarity,
    }));

  return links;
}

// ============================================
// Quiz Remediation Links
// ============================================

export async function generateQuizRemediationLinks(
  quizId: string,
  questions: Array<{ id: string; question: string; correctOptionId: string; explanation: string }>
): Promise<void> {
  for (const question of questions) {
    // Search for relevant video timestamps based on question + explanation
    const searchQuery = `${question.question} ${question.explanation}`;
    const timestamps = await findRelevantTimestamps(searchQuery, { limit: 1, minRelevance: 0.6 });

    if (timestamps.length > 0) {
      const best = timestamps[0];

      await supabaseAdmin
        .from('quiz_remediation_links')
        .upsert({
          quiz_id: quizId,
          question_id: question.id,
          video_id: best.videoId,
          start_ms: best.startMs,
          end_ms: best.endMs,
          relevance_score: best.relevanceScore,
        }, { onConflict: 'quiz_id,question_id' });
    }
  }
}

export async function getRemediationForQuestion(
  quizId: string,
  questionId: string
): Promise<VideoTimestampLink | null> {
  const { data, error } = await supabaseAdmin
    .from('quiz_remediation_links')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('question_id', questionId)
    .single();

  if (error || !data) return null;

  return {
    videoId: data.video_id,
    startMs: data.start_ms,
    endMs: data.end_ms,
    title: 'Review this concept',
    relevanceScore: data.relevance_score,
  };
}
```

---

## Rich Content Parser Enhancement

### Modify: `src/lib/rich-content-parser.ts`

Add the VIDEO marker pattern:

```typescript
// Add to existing marker patterns
const VIDEO_PATTERN = /\[\[VIDEO:([^|]+)\|(\d+)\|(\d+)\|([^\]]+)\]\]/g;

// Add to parseRichContent function
export function parseRichContent(text: string): { text: string; richContent: RichContent[] } {
  const richContent: RichContent[] = [];
  let processedText = text;

  // ... existing patterns ...

  // Parse VIDEO markers
  // Format: [[VIDEO:videoId|startMs|endMs|Title]]
  processedText = processedText.replace(VIDEO_PATTERN, (match, videoId, startMs, endMs, title) => {
    richContent.push({
      type: 'video_timestamp',
      videoId,
      startMs: parseInt(startMs, 10),
      endMs: parseInt(endMs, 10),
      title,
    });
    return ''; // Remove marker from text
  });

  return { text: processedText.trim(), richContent };
}
```

---

## Type Definitions

### Modify: `src/types/index.ts`

```typescript
// Add to RichContent union type
export type RichContent =
  | LessonLinkContent
  | ChartWidgetContent
  | SetupVisualizationContent
  | QuizPromptContent
  | VideoTimestampContent; // NEW

// NEW: Video timestamp content type
export interface VideoTimestampContent {
  type: 'video_timestamp';
  videoId: string;
  startMs: number;
  endMs: number;
  title: string;
  description?: string;
  relatedLesson?: {
    moduleId: string;
    moduleSlug: string;
    lessonId: string;
    lessonSlug: string;
  };
}
```

---

## Frontend Component

### New File: `src/components/chat/video-timestamp-card.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';
import { Play, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { VideoTimestampContent } from '@/types';

interface VideoTimestampCardProps {
  content: VideoTimestampContent;
  onPlay?: (videoId: string, startMs: number) => void;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VideoTimestampCard({ content, onPlay }: VideoTimestampCardProps) {
  const { videoId, startMs, endMs, title, description, relatedLesson } = content;

  const duration = Math.round((endMs - startMs) / 1000);
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startMs / 1000)}s`;

  const handlePlay = () => {
    if (onPlay) {
      onPlay(videoId, startMs);
    } else {
      window.open(youtubeUrl, '_blank');
    }
  };

  const handleNavigateToLesson = () => {
    if (relatedLesson) {
      const url = `/learning/${relatedLesson.moduleSlug}/${relatedLesson.lessonSlug}?t=${startMs}`;
      window.location.href = url;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        variant="elevated"
        hoverable
        className="overflow-hidden border-l-4 border-l-[var(--accent-primary)]"
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Play Button */}
            <button
              onClick={handlePlay}
              className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--accent-primary)]
                         flex items-center justify-center hover:bg-[var(--accent-primary-hover)]
                         transition-colors shadow-lg"
            >
              <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-[var(--text-primary)] truncate">
                  {title}
                </h4>
                <Badge variant="gold" size="sm">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTimestamp(startMs)} - {formatTimestamp(endMs)}
                </Badge>
              </div>

              {description && (
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">
                  {description}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Badge variant="default" size="sm">
                  {duration}s clip
                </Badge>

                {relatedLesson && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNavigateToLesson}
                    className="text-xs"
                  >
                    Open in Lesson
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

---

## AI Coach System Prompt Enhancement

### Modify: `src/app/api/chat/route.ts`

Add to the system prompt:

```typescript
const TIMESTAMP_GUIDANCE = `
## Video Timestamp References

When you reference concepts from the KCU training videos, include video timestamp markers so the user can jump directly to that moment:

Format: [[VIDEO:videoId|startMs|endMs|Concept Title]]

Example:
"The key to patience candles is waiting for confirmation. [[VIDEO:ckqvq7ijknrlbftps8a0|120000|180000|Patience Candles Explained]]"

When RAG results include timestamp information, use it to create these links. This helps users review the exact video moment that explains a concept.

Guidelines:
- Use timestamps when explaining trading concepts
- Reference the specific lesson when available
- Keep clip durations reasonable (30-120 seconds typically)
- Combine multiple concepts into the text, but link to the most relevant timestamp
`;

// Add to the system prompt construction
const systemPrompt = `
${EXISTING_SYSTEM_PROMPT}

${TIMESTAMP_GUIDANCE}

Current RAG Context (with timestamps):
${ragContextWithTimestamps}
`;
```

---

## Quiz Remediation UI Enhancement

### Modify: `src/app/(dashboard)/quiz/[id]/page.tsx`

Add remediation display after quiz completion:

```typescript
// In the results display section
{!passed && (
  <div className="mt-6 space-y-4">
    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
      Review These Concepts
    </h3>

    {incorrectAnswers.map((answer) => (
      <RemediationCard
        key={answer.questionId}
        quizId={quizId}
        questionId={answer.questionId}
        question={answer.question}
      />
    ))}
  </div>
)}

// RemediationCard component
function RemediationCard({ quizId, questionId, question }) {
  const [remediation, setRemediation] = useState(null);

  useEffect(() => {
    fetch(`/api/quiz/remediation?quizId=${quizId}&questionId=${questionId}`)
      .then(res => res.json())
      .then(data => setRemediation(data));
  }, [quizId, questionId]);

  if (!remediation) return null;

  return (
    <VideoTimestampCard
      content={{
        type: 'video_timestamp',
        videoId: remediation.videoId,
        startMs: remediation.startMs,
        endMs: remediation.endMs,
        title: `Review: ${question.slice(0, 50)}...`,
        description: 'Watch this section to understand the concept better',
      }}
    />
  );
}
```

---

## API Routes

### New File: `src/app/api/transcripts/sync/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  fetchAndStoreTranscriptSegments,
  processTranscriptWithTimestamps
} from '@/lib/transcript-timestamps';
import { CURRICULUM_MODULES } from '@/data/curriculum';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { videoId, lessonId, moduleSlug } = await request.json();

    // If specific video, process just that one
    if (videoId) {
      const segments = await fetchAndStoreTranscriptSegments(videoId, lessonId);

      // Find lesson metadata
      let metadata = { sourceTitle: videoId };
      for (const mod of CURRICULUM_MODULES) {
        const lesson = mod.lessons.find(l => l.video_id === videoId);
        if (lesson) {
          metadata = {
            sourceTitle: lesson.title,
            topic: mod.title,
            subtopic: lesson.title,
          };
          break;
        }
      }

      await processTranscriptWithTimestamps(videoId, lessonId, segments, metadata);

      return NextResponse.json({
        success: true,
        segmentsProcessed: segments.length
      });
    }

    // Batch process all videos
    const results = [];
    for (const mod of CURRICULUM_MODULES) {
      for (const lesson of mod.lessons) {
        if (lesson.video_id) {
          try {
            const segments = await fetchAndStoreTranscriptSegments(
              lesson.video_id,
              lesson.id
            );

            await processTranscriptWithTimestamps(
              lesson.video_id,
              lesson.id,
              segments,
              {
                sourceTitle: lesson.title,
                topic: mod.title,
                subtopic: lesson.title,
                difficulty: mod.order <= 2 ? 'beginner' : mod.order <= 5 ? 'intermediate' : 'advanced',
              }
            );

            results.push({ videoId: lesson.video_id, status: 'success', segments: segments.length });
          } catch (err) {
            results.push({ videoId: lesson.video_id, status: 'error', error: err.message });
          }
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Transcript sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

### New File: `src/app/api/quiz/remediation/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getRemediationForQuestion } from '@/lib/transcript-timestamps';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId');
  const questionId = searchParams.get('questionId');

  if (!quizId || !questionId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const remediation = await getRemediationForQuestion(quizId, questionId);

  if (!remediation) {
    return NextResponse.json({ error: 'No remediation found' }, { status: 404 });
  }

  return NextResponse.json(remediation);
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRANSCRIPT TIMESTAMP FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   YouTube    │
    │    Video     │
    └──────┬───────┘
           │ fetchTranscript()
           ▼
    ┌──────────────┐
    │  Raw Segments│ [{text, offset, duration}, ...]
    │  with Timing │
    └──────┬───────┘
           │ fetchAndStoreTranscriptSegments()
           ▼
    ┌──────────────┐
    │  transcript  │ Granular segment storage
    │   _segments  │ (video_id, segment_index, start_ms, end_ms, text)
    └──────┬───────┘
           │ processTranscriptWithTimestamps()
           ▼
    ┌──────────────┐
    │  knowledge   │ Chunks with timestamp ranges
    │   _chunks    │ (content, embedding, start_timestamp_ms, end_timestamp_ms)
    └──────┬───────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌──────────────┐                          ┌──────────────┐
│   AI Coach   │                          │    Quiz      │
│     Chat     │                          │  Remediation │
└──────┬───────┘                          └──────┬───────┘
       │ RAG search with timestamps              │ findRelevantTimestamps()
       ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│  [[VIDEO:    │                          │  Remediation │
│  markers]]   │                          │    Links     │
└──────┬───────┘                          └──────┬───────┘
       │ parseRichContent()                      │
       ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│ VideoStamp   │                          │ VideoStamp   │
│    Card      │                          │    Card      │
└──────┬───────┘                          └──────┬───────┘
       │                                         │
       └─────────────────┬───────────────────────┘
                         ▼
              ┌──────────────────┐
              │  Video Player    │
              │  (timestamp URL) │
              │  ?t=120s         │
              └──────────────────┘
```

---

## Implementation Timeline

| Week | Phase | Tasks |
|------|-------|-------|
| 1 | Database & Core | Migration, `transcript-timestamps.ts`, segment storage |
| 2 | Processing | Batch transcript sync, chunk timestamp preservation |
| 3 | RAG Enhancement | Timestamp-aware search function, context formatting |
| 4 | Rich Content | VIDEO marker parser, `VideoTimestampCard` component |
| 5 | Quiz Integration | Remediation links, quiz results UI |
| 6 | AI Coach | System prompt updates, timestamp link generation |
| 7 | Testing | End-to-end testing, performance optimization |

---

## Usage Examples

### In AI Coach Chat

**User**: "How do I identify patience candles?"

**AI Response**:
> Patience candles are small consolidation candles that form at key levels, showing buyer/seller equilibrium. The key is to wait for the break of the patience candle before entering.
>
> [[VIDEO:ckqvq7ijknrlbftps8a0|120000|240000|Patience Candles Explained]]
>
> Look for candles with small bodies forming after a move into your level. Entry is on the break, with your stop on the other side.

### In Quiz Remediation

**After failing a question about VWAP**:
> ❌ Incorrect
>
> **Review this concept:**
> [Play Button] VWAP as Support/Resistance (2:30 - 4:15)
> Watch this 105-second clip explaining how VWAP acts as dynamic support and resistance.
> [Open in Lesson →]

### In Lesson Page

URL: `/learning/indicators/what-is-vwap?t=150000`

Video automatically starts at 2:30, with transcript highlighting the current segment.

---

## Security Considerations

1. **Admin-only sync endpoints** - Only admins can trigger transcript processing
2. **Rate limiting** - YouTube API has quotas; implement backoff
3. **Caching** - Cache processed transcripts to avoid re-fetching
4. **Validation** - Validate video IDs before processing

---

## Monitoring & Analytics

Track these metrics:
- Timestamp link click-through rate
- Most-referenced video segments
- Quiz remediation effectiveness (retry pass rate)
- RAG retrieval accuracy for timestamped chunks

---

## Environment Variables

### Required for Thinkific SSO

```env
# Thinkific Configuration
THINKIFIC_SUBDOMAIN=kaycapitals
THINKIFIC_API_KEY=your-api-key-from-thinkific-admin

# App URL for error redirects
NEXT_PUBLIC_APP_URL=https://your-kcu-coach-domain.com
```

> **Note**: Your Thinkific API key is used both for REST API calls AND as the secret to sign JWT tokens for SSO. Per [Thinkific's documentation](https://support.thinkific.dev/hc/en-us/articles/4423909018135-Custom-SSO-Using-JWT): "Do not base 64 encode your API key when signing your JWT token."

### Required for YouTube Indexing

```env
# YouTube Data API
YOUTUBE_API_KEY=your-youtube-data-api-v3-key

# KayCapitals Channel
KAY_CAPITALS_CHANNEL_ID=UCxxxxxxxxxx  # Get from YouTube channel page
```

### Getting the Values

1. **Thinkific API Key**:
   - Login to Thinkific Admin → Settings → Code & Analytics → API
   - Copy your API key (this same key is used for SSO JWT signing)

2. **YouTube API Key**:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Create an API Key
   - Enable YouTube Data API v3

3. **YouTube Channel ID**:
   - Go to https://www.youtube.com/@KayCapitals
   - Click "About" → Share Channel → Copy Channel ID
   - Or use: `https://www.youtube.com/channel/CHANNEL_ID_HERE`

---

## Setup & Deployment

### 1. Database Migration

```bash
# Run migrations in order
supabase db push
# Or manually:
psql -f supabase/migrations/016_transcript_timestamps.sql
psql -f supabase/migrations/017_youtube_channel_index.sql
```

### 2. Initial YouTube Sync

```bash
# Via API (requires admin auth)
curl -X POST https://your-domain.com/api/youtube/sync \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxVideos": 100, "processTranscripts": true}'
```

### 3. Verify SSO Configuration

```typescript
import { isSSoConfigured } from '@/lib/thinkific-sso';

if (!isSSoConfigured()) {
  console.warn('Thinkific SSO is not configured');
}
```

---

## Usage Examples

### Generate SSO URL for Thinkific Lesson

```typescript
import { generateLessonSSOUrl } from '@/lib/thinkific-sso';

const user = {
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  externalId: 'user-uuid-here',
};

// Deep-link to specific lesson at timestamp
const ssoUrl = await generateLessonSSOUrl(
  user,
  { courseSlug: 'ltp-framework', lessonSlug: 'patience-candles' },
  120 // Start at 2:00
);

// Opens: https://kaycapitals.thinkific.com/api/sso/v2/sso/jwt?jwt=...&return_to=/courses/ltp-framework/lessons/patience-candles?t=120
```

### Search YouTube Content

```typescript
import { searchYouTubeContent } from '@/lib/youtube-channel-indexer';

const results = await searchYouTubeContent('patience candles', {
  category: 'LTP Framework',
  minLtpRelevance: 0.5,
  limit: 5,
});

// Returns videos with transcripts matching the query
```

### AI Coach Video References

The AI coach can now reference both content sources:

**For Thinkific (structured courses)**:
```
[[THINKIFIC:ltp-framework|patience-candles|120|Patience Candles Explained]]
```

**For YouTube (supplementary)**:
```
[[VIDEO:dQw4w9WgXcQ|120000|180000|Additional Patience Candle Examples]]
```

---

## Content Strategy

### When to Use Thinkific SSO

- Primary curriculum content
- Graded lessons and quizzes
- Progress-tracked modules
- Certificate-eligible content

### When to Use YouTube

- AI coach remediation
- Alternative explanations
- Supplementary examples
- Q&A and informal content
- Content outside structured courses

### Hybrid Responses

The AI coach can combine both:

> "Let me explain patience candles. In the LTP Framework course:
> [[THINKIFIC:ltp-framework|patience-candles|120|Watch the official lesson]]
>
> For additional examples, check out this video:
> [[VIDEO:abc123|60000|120000|More patience candle setups]]"

---

## Roadmap

### Phase 1 (Current) ✅
- [x] Thinkific SSO library
- [x] YouTube channel indexer
- [x] Database schema
- [x] API routes

### Phase 2 (Next)
- [ ] Rich content parser VIDEO/THINKIFIC markers
- [ ] VideoTimestampCard component integration
- [ ] AI coach system prompt updates
- [ ] Admin dashboard for YouTube sync

### Phase 3 (Future)
- [ ] Thinkific webhook integration
- [ ] Progress sync from Thinkific
- [ ] Quiz result import
- [ ] Course completion tracking
- [ ] Transcript download from Thinkific (when available)
