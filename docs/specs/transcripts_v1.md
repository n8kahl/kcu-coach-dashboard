# Transcript Subsystem v1 Specification

**Author:** Staff Engineer
**Date:** 2026-01-25
**Status:** Draft

---

## 1. Current Implementation Map

### 1.1 Files & Responsibilities

| File | Purpose |
|------|---------|
| `src/app/api/webhooks/cloudflare-stream/route.ts` | Cloudflare Stream webhook handler; fire-and-forget transcription |
| `src/lib/transcription.ts` | Cloudflare caption fetching, Whisper API integration, VTT parsing |
| `src/lib/transcript-timestamps.ts` | Timestamp-aware chunking, segment storage, remediation linking |
| `src/lib/embeddings.ts` | Text chunking (500 tokens), OpenAI embedding generation, pgvector storage |
| `src/lib/ai/knowledge-retrieval.ts` | Full-text search on `course_lessons`, NOT embeddings-based |
| `src/lib/rag.ts` | Vector similarity search on `knowledge_chunks` |
| `src/app/api/admin/content/video/transcribe/route.ts` | Manual transcription endpoint |
| `scripts/migrate-videos.ts` | Bulk video upload from filesystem to Cloudflare Stream |
| `supabase/migrations/016_transcript_timestamps.sql` | Current transcript tables schema |

### 1.2 Current Data Flow

```
┌─────────────────┐     webhook      ┌──────────────────────────┐
│  Cloudflare     │ ───────────────► │  /api/webhooks/          │
│  Stream (video) │  POST (signed)   │  cloudflare-stream       │
└─────────────────┘                  └───────────┬──────────────┘
                                                 │
                                    fire-and-forget (.catch())
                                                 │
                                                 ▼
                            ┌─────────────────────────────────────┐
                            │  transcribeAndEmbed()               │
                            │  1. Set video_status='transcribing' │
                            │  2. Fetch Cloudflare captions       │
                            │     └─ fallback: Whisper API        │
                            │  3. Save transcript_segments        │
                            │  4. Upload VTT to Cloudflare        │
                            │  5. Update course_lessons.transcript│
                            │  6. processAndEmbedText() → chunks  │
                            └─────────────────────────────────────┘
                                                 │
                                                 ▼
                            ┌─────────────────────────────────────┐
                            │  Database writes:                   │
                            │  - transcript_segments (video_id)   │
                            │  - knowledge_chunks (embedding)     │
                            │  - transcript_processing_status     │
                            │  - course_lessons.transcript_text   │
                            └─────────────────────────────────────┘
```

### 1.3 Current Tables (Migration 016)

| Table | Key Columns | Issues |
|-------|-------------|--------|
| `transcript_segments` | `video_id`, `lesson_id` FK → `lessons(id)` | FK references dropped `lessons` table |
| `transcript_processing_status` | `video_id`, `lesson_id` FK → `lessons(id)` | Same FK issue |
| `knowledge_chunks` | `source_type`, `source_id`, `start_timestamp_ms`, `end_timestamp_ms` | Content-prefix matching hack |
| `quiz_remediation_links` | `quiz_id`, `video_id`, `start_ms`, `end_ms` | OK, but uses `video_id` not polymorphic |

---

## 2. Problems / Failure Modes

### 2.1 Durability Issues

| Problem | Impact | Location |
|---------|--------|----------|
| **Fire-and-forget transcription** | If server crashes mid-transcription, job is lost forever | `route.ts:192` |
| **No retry mechanism** | Failed transcriptions are not retried | Entire system |
| **No job visibility** | Cannot see pending/failed jobs in admin | No admin UI |
| **Returns 200 even on failure** | Cloudflare won't retry, but job may have failed | `route.ts:210-214` |

### 2.2 Schema Mismatches

| Problem | Impact | Location |
|---------|--------|----------|
| **FK to dropped `lessons` table** | `transcript_segments.lesson_id` references non-existent table | `016_transcript_timestamps.sql:31` |
| **Same FK in processing_status** | `transcript_processing_status.lesson_id` same issue | `016_transcript_timestamps.sql:94` |
| **Views reference dropped tables** | `v_transcript_coverage` joins `learning_modules` and `lessons` | `016_transcript_timestamps.sql:308-312` |

### 2.3 Embeddings Drift / Hacks

| Problem | Impact | Location |
|---------|--------|----------|
| **Content-prefix matching hack** | Updates timestamps by matching first 100 chars of content | `transcript-timestamps.ts:312` |
| **processAndEmbedText doesn't return IDs** | Cannot directly update newly-created chunks | `embeddings.ts` |
| **Inconsistent source_type** | Sometimes `'lesson'` (with UUID), sometimes `'transcript'` (with video_uid) | Multiple files |

### 2.4 Size / Performance Limits

| Problem | Impact | Location |
|---------|--------|----------|
| **Whisper 25MB limit** | Large videos fail silently | `transcription.ts` |
| **Batch insert 100-row chunks** | Large transcripts make many DB round-trips | `route.ts:409-422` |
| **No streaming for long transcripts** | Memory pressure on serverless functions | Entire flow |

---

## 3. Target Architecture

### 3.1 New Tables

#### `transcript_jobs` - Durable Job Queue

```sql
CREATE TABLE transcript_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Polymorphic reference (no FK constraints)
    content_type TEXT NOT NULL,       -- 'course_lesson', 'youtube_video', etc.
    content_id TEXT NOT NULL,         -- UUID or external ID as text

    -- Job state
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    -- Error tracking
    error TEXT,
    error_code TEXT,

    -- Locking for concurrent workers
    locked_at TIMESTAMPTZ,
    locked_by TEXT,                   -- Worker identifier

    -- Retry scheduling
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),

    -- Metadata
    priority INTEGER DEFAULT 0,       -- Higher = process first
    metadata JSONB DEFAULT '{}',      -- video_uid, lesson_title, etc.

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    UNIQUE(content_type, content_id)  -- One job per content
);
```

#### `transcript_segments` - Polymorphic (Replaces Current)

```sql
CREATE TABLE transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Polymorphic reference (no FK)
    content_type TEXT NOT NULL,       -- 'course_lesson', 'youtube_video'
    content_id TEXT NOT NULL,         -- Lesson UUID or YouTube video ID

    -- Segment data
    segment_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    start_formatted VARCHAR(20),

    -- Optional metadata
    speaker VARCHAR(100),
    confidence FLOAT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(content_type, content_id, segment_index)
);

-- Indexes
CREATE INDEX idx_transcript_segments_lookup
    ON transcript_segments(content_type, content_id, start_ms);

CREATE INDEX idx_transcript_segments_fts
    ON transcript_segments USING gin(to_tsvector('english', text));
```

### 3.2 Updated `knowledge_chunks` Conventions

**Canonical source_type/source_id:**

| Content | source_type | source_id | Notes |
|---------|-------------|-----------|-------|
| Course lesson transcript | `'course_lesson'` | Lesson UUID | Primary use case |
| YouTube video transcript | `'youtube_video'` | YouTube video ID | External videos |
| Manual document | `'document'` | Document slug/ID | PDFs, guides |
| Admin-curated | `'manual'` | Arbitrary ID | One-off content |

**Required columns for transcripts:**
- `start_timestamp_ms` - Start of chunk in video
- `end_timestamp_ms` - End of chunk in video
- `segment_indices` - Array of segment indexes in this chunk

### 3.3 Updated RPC Functions

```sql
-- New polymorphic search function
CREATE FUNCTION search_transcript_segments(
    p_content_type TEXT,
    p_content_id TEXT,
    p_query TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    segment_index INTEGER,
    text TEXT,
    start_ms INTEGER,
    end_ms INTEGER,
    start_formatted VARCHAR(20),
    rank FLOAT
);
```

---

## 4. Canonical Source Conventions

### 4.1 Unified Naming

| Current (Inconsistent) | Target (Canonical) |
|------------------------|-------------------|
| `sourceType: 'lesson'` + `sourceId: lessonUUID` | `source_type: 'course_lesson'` + `source_id: lessonUUID` |
| `sourceType: 'transcript'` + `sourceId: videoUid` | `source_type: 'course_lesson'` + `source_id: lessonUUID` |
| `video_id: cloudflareUid` | Store `video_uid` in job metadata, key by `content_id: lessonUUID` |

### 4.2 Lookup Patterns

```typescript
// Old (fragmented)
await supabase.from('transcript_segments').select('*').eq('video_id', videoUid);
await supabase.from('knowledge_chunks').select('*').eq('source_id', videoUid);

// New (unified)
await supabase.from('transcript_segments').select('*')
  .eq('content_type', 'course_lesson')
  .eq('content_id', lessonId);

await supabase.from('knowledge_chunks').select('*')
  .eq('source_type', 'course_lesson')
  .eq('source_id', lessonId);
```

---

## 5. Acceptance Criteria

### 5.1 Job Queue (Prompt 2-3)

- [ ] `transcript_jobs` table exists with polymorphic `content_type`/`content_id`
- [ ] Cloudflare webhook enqueues job, does NOT execute transcription inline
- [ ] Idempotency: duplicate webhooks for same lesson don't create duplicate jobs
- [ ] Webhook returns 200 quickly (<500ms)
- [ ] Structured logging: webhook received, lesson matched, job enqueued/skipped

### 5.2 Worker (Prompt 4)

- [ ] `scripts/transcript-worker.ts` polls for pending jobs
- [ ] Uses `FOR UPDATE SKIP LOCKED` pattern (or RPC equivalent)
- [ ] Marks job `processing` + sets `locked_at`
- [ ] On success: sets `completed`, stores segments + embeddings
- [ ] On failure: increments `attempts`, sets `error`, calculates `next_retry_at`
- [ ] After max_attempts: sets status to `failed`
- [ ] DRY_RUN mode logs what would happen without DB writes
- [ ] Timestamps preserved in embeddings (no content-prefix hack)

### 5.3 Embeddings Fix (Prompt 5)

- [ ] New `embedAndStoreChunks()` function accepts timestamp metadata
- [ ] Inserts chunks with timestamps in single operation (no update hack)
- [ ] Worker uses new function directly
- [ ] Content-prefix matching code removed

### 5.4 UI Integration (Prompt 6)

- [ ] `GET /api/learn/.../lessons/[lessonSlug]/transcript-segments` returns ordered segments
- [ ] TranscriptPanel highlights current segment based on video time
- [ ] Click segment → seek video to `start_ms / 1000`
- [ ] Graceful fallback when segments unavailable (use `transcript_text`)

### 5.5 AI Search (Prompt 7-8)

- [ ] `/api/ai/search` queries `course_lessons` via `search_course_content` RPC
- [ ] Adds optional timestamp matches from `transcript_segments` FTS
- [ ] URLs include `?t=<seconds>` when timestamp match exists
- [ ] New `[[COURSE:slug/slug/slug|timestamp|Title]]` marker supported
- [ ] Backward compatible: `[[LESSON:...]]` still renders

### 5.6 Tests (Prompt 9)

- [ ] VTT parsing → segments with correct `start_ms`/`end_ms`
- [ ] Worker lifecycle: pending → processing → completed
- [ ] Worker lifecycle: pending → processing → failed (after retries)
- [ ] API returns segments in order
- [ ] AI search uses `course_lessons` not legacy `lessons`

---

## 6. Test Plan

### 6.1 Unit Tests

```typescript
// VTT parsing
describe('parseVTT', () => {
  it('extracts segments with correct timestamps');
  it('handles multi-line cues');
  it('handles missing timestamps gracefully');
});

// Worker job lifecycle
describe('TranscriptWorker', () => {
  it('claims pending job with SKIP LOCKED');
  it('transitions pending → processing → completed');
  it('retries with exponential backoff on failure');
  it('marks failed after max attempts');
});
```

### 6.2 Integration Tests

```typescript
// API tests
describe('GET /api/learn/.../transcript-segments', () => {
  it('returns segments ordered by start_ms');
  it('returns 200 with empty array when no segments');
  it('requires authentication');
});

// AI search
describe('POST /api/ai/search', () => {
  it('searches course_lessons table');
  it('includes timestamp when segment matches');
});
```

### 6.3 Manual Testing

1. **Webhook flow:**
   - Upload video to Cloudflare Stream with `lessonId` in metadata
   - Verify job appears in `transcript_jobs` with status `pending`
   - Run worker, verify status → `processing` → `completed`
   - Check `transcript_segments` populated
   - Check `knowledge_chunks` have timestamps

2. **UI flow:**
   - Navigate to lesson with transcript
   - Verify transcript panel shows clickable segments
   - Click segment, verify video seeks
   - Play video, verify highlight follows

---

## 7. Rollout Plan

### 7.1 Phase 1: Database Migration (Non-Breaking)

1. Deploy migration creating new tables alongside old
2. New tables: `transcript_jobs`, new `transcript_segments` (with `_v2` suffix during migration)
3. Add new columns to `knowledge_chunks` if needed
4. **No code changes yet** - old flow continues working

### 7.2 Phase 2: Dual-Write

1. Modify webhook to:
   - Still fire-and-forget (existing behavior)
   - ALSO enqueue job to `transcript_jobs`
2. Worker runs in DRY_RUN mode, logs what it would do
3. Compare old vs new results

### 7.3 Phase 3: Worker Takes Over

1. Webhook stops fire-and-forget, only enqueues
2. Worker runs in production mode
3. Monitor error rates in `transcript_jobs`

### 7.4 Phase 4: Cleanup

1. Drop old `transcript_segments` table (after data migration)
2. Drop old views referencing `lessons` table
3. Remove legacy code paths
4. Update AI prompts to use new markers

### 7.5 Migration Script

```bash
# Migrate existing segments to new schema
scripts/migrate-transcript-segments.ts --dry-run
scripts/migrate-transcript-segments.ts --execute

# Backfill jobs for lessons missing transcripts
scripts/backfill-transcript-jobs.ts --dry-run
scripts/backfill-transcript-jobs.ts --execute
```

### 7.6 Rollback Plan

Each phase is independently reversible:

- **Phase 1:** Drop new tables (no impact)
- **Phase 2:** Disable dual-write (old flow unchanged)
- **Phase 3:** Re-enable fire-and-forget in webhook, disable worker
- **Phase 4:** Restore dropped tables from backup if needed

---

## 8. Implementation Sequence (Prompt Order)

| Prompt | Deliverable | Dependencies |
|--------|-------------|--------------|
| 1 | This spec | None |
| 2 | Migration SQL for `transcript_jobs`, `transcript_segments` | Spec approved |
| 3 | Refactor webhook to enqueue only | Migration deployed |
| 4 | `scripts/transcript-worker.ts` | Migration + webhook |
| 5 | Fix embeddings timestamp insertion | Worker exists |
| 6 | UI: segments API + TranscriptPanel | Segments in DB |
| 7 | AI search uses `course_lessons` + timestamps | Segments + embeddings |
| 8 | New `[[COURSE:...]]` marker | AI search working |
| 9 | Jest tests | All code complete |

---

## 9. Decisions

| Question | Decision |
|----------|----------|
| Worker deployment | **Railway service** - dedicated process polling continuously |
| YouTube videos | **Same job queue** - use `content_type='youtube_video'` |
| Caption upload | **Continue uploading VTT** - enables native Cloudflare player captions |
| Retry backoff | Exponential with jitter, max 1 hour delay, 3 attempts default |

---

## Appendix A: File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/0XX_transcript_jobs_and_segments.sql` | New | Job queue + polymorphic segments |
| `src/app/api/webhooks/cloudflare-stream/route.ts` | Modify | Enqueue job instead of fire-and-forget |
| `scripts/transcript-worker.ts` | New | Polls and processes jobs |
| `src/lib/embeddings.ts` | Modify | Add `embedAndStoreChunks()` with timestamps |
| `src/lib/transcript-timestamps.ts` | Modify | Remove content-prefix hack |
| `src/app/api/learn/.../transcript-segments/route.ts` | New | API for segments |
| `src/components/learn/TranscriptPanel.tsx` | Modify | Highlight + seek |
| `src/app/api/ai/search/route.ts` | Modify | Use course_lessons + timestamps |
| `src/lib/rich-content-parser.ts` | Modify | Add [[COURSE:...]] marker |
| `src/__tests__/lib/*.test.ts` | New | Tests per prompt 9 |
