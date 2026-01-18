-- ============================================
-- KCU Coach - RAG Infrastructure Migration
-- ============================================
-- Adds vector similarity search capabilities and
-- knowledge source tracking for RAG functionality.

-- ============================================
-- 1. ENSURE KNOWLEDGE_CHUNKS HAS EMBEDDING COLUMN
-- ============================================
-- Add embedding column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- ============================================
-- 2. VECTOR SIMILARITY INDEX
-- ============================================
-- Create IVFFlat index for fast cosine similarity search
-- Only creates if not already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'knowledge_chunks_embedding_idx'
  ) THEN
    CREATE INDEX knowledge_chunks_embedding_idx
    ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;

-- ============================================
-- 2. KNOWLEDGE SOURCES TABLE
-- ============================================
-- Tracks ingested content sources and their processing status
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'transcript', 'document', 'lesson', 'manual'
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'complete', 'failed'
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

-- Indexes for knowledge_sources
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON knowledge_sources(source_type);

-- ============================================
-- 3. VECTOR SEARCH FUNCTION
-- ============================================
-- Function to find semantically similar knowledge chunks
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  topic TEXT,
  source_title TEXT,
  source_type TEXT,
  source_id TEXT,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.topic,
    kc.source_title,
    kc.source_type,
    kc.source_id,
    1 - (kc.embedding <=> query_embedding) as similarity
  FROM knowledge_chunks kc
  WHERE kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read knowledge sources
DROP POLICY IF EXISTS "Authenticated users can read knowledge sources" ON knowledge_sources;
CREATE POLICY "Authenticated users can read knowledge sources"
ON knowledge_sources FOR SELECT
TO authenticated
USING (true);

-- Policy for admin users to manage knowledge sources
DROP POLICY IF EXISTS "Admins can manage knowledge sources" ON knowledge_sources;
CREATE POLICY "Admins can manage knowledge sources"
ON knowledge_sources FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.is_admin = true
  )
);

-- ============================================
-- 5. HELPER FUNCTION FOR CHUNKING METADATA
-- ============================================
-- Function to update source chunk count after processing
CREATE OR REPLACE FUNCTION update_source_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE knowledge_sources
  SET
    chunk_count = (
      SELECT COUNT(*) FROM knowledge_chunks
      WHERE source_id = NEW.source_id AND source_type = NEW.source_type
    ),
    updated_at = NOW()
  WHERE source_id = NEW.source_id AND source_type = NEW.source_type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update chunk count
DROP TRIGGER IF EXISTS update_chunk_count_trigger ON knowledge_chunks;
CREATE TRIGGER update_chunk_count_trigger
AFTER INSERT OR DELETE ON knowledge_chunks
FOR EACH ROW
EXECUTE FUNCTION update_source_chunk_count();
