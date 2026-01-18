-- ============================================
-- KCU Coach - Learning System Database Schema
-- ============================================
-- Run this after the base schema is created
-- This migration creates tables for the learning management system

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Learning Modules Table
-- ============================================
CREATE TABLE IF NOT EXISTS learning_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    order_index INTEGER NOT NULL DEFAULT 0,
    difficulty VARCHAR(20) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    estimated_duration INTEGER DEFAULT 0, -- in seconds
    lessons_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Lessons Table
-- ============================================
CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    video_url VARCHAR(500),
    video_id VARCHAR(100), -- YouTube/Vimeo ID
    duration INTEGER DEFAULT 0, -- in seconds
    transcript TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    key_takeaways JSONB DEFAULT '[]'::jsonb,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_id, slug)
);

-- ============================================
-- User Lesson Progress Table
-- Uses auth.users for user reference (Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS user_lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References auth.users(id)
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    watch_time INTEGER DEFAULT 0, -- seconds watched
    progress_percent INTEGER DEFAULT 0, -- 0-100
    completed_at TIMESTAMPTZ,
    last_watched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- ============================================
-- Quizzes Table
-- ============================================
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 70, -- percentage
    time_limit INTEGER, -- in seconds, NULL for no limit
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Quiz Attempts Table
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References auth.users(id)
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL, -- number correct
    total_questions INTEGER NOT NULL,
    percentage INTEGER NOT NULL, -- calculated percentage
    passed BOOLEAN DEFAULT false,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    time_taken INTEGER, -- in seconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Knowledge Chunks Table (for RAG)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    -- Note: For vector embeddings, you may need to enable pgvector extension
    -- embedding vector(1536), -- OpenAI embeddings dimension
    metadata JSONB DEFAULT '{}'::jsonb,
    chunk_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- User Module Progress (aggregate view)
-- ============================================
CREATE TABLE IF NOT EXISTS user_module_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References auth.users(id)
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    lessons_completed INTEGER DEFAULT 0,
    total_lessons INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0,
    quiz_best_score INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(module_id, order_index);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson ON user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_lesson ON knowledge_chunks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_module_progress_user ON user_module_progress(user_id);

-- ============================================
-- Enable Row Level Security
-- ============================================
ALTER TABLE learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_module_progress ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies - Modules & Lessons (Public Read for Authenticated)
-- ============================================
DROP POLICY IF EXISTS "Modules are viewable by authenticated users" ON learning_modules;
CREATE POLICY "Modules are viewable by authenticated users"
ON learning_modules FOR SELECT
TO authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "Lessons are viewable by authenticated users" ON lessons;
CREATE POLICY "Lessons are viewable by authenticated users"
ON lessons FOR SELECT
TO authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "Quizzes are viewable by authenticated users" ON quizzes;
CREATE POLICY "Quizzes are viewable by authenticated users"
ON quizzes FOR SELECT
TO authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "Knowledge chunks are viewable by authenticated users" ON knowledge_chunks;
CREATE POLICY "Knowledge chunks are viewable by authenticated users"
ON knowledge_chunks FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- RLS Policies - User Progress (Own Data Only)
-- ============================================
DROP POLICY IF EXISTS "Users can view own lesson progress" ON user_lesson_progress;
CREATE POLICY "Users can view own lesson progress"
ON user_lesson_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lesson progress" ON user_lesson_progress;
CREATE POLICY "Users can insert own lesson progress"
ON user_lesson_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lesson progress" ON user_lesson_progress;
CREATE POLICY "Users can update own lesson progress"
ON user_lesson_progress FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can view own quiz attempts"
ON quiz_attempts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON quiz_attempts;
CREATE POLICY "Users can insert own quiz attempts"
ON quiz_attempts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own module progress" ON user_module_progress;
CREATE POLICY "Users can view own module progress"
ON user_module_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own module progress" ON user_module_progress;
CREATE POLICY "Users can manage own module progress"
ON user_module_progress FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- Service Role Policies (for API routes)
-- ============================================
DROP POLICY IF EXISTS "Service role can manage all learning modules" ON learning_modules;
CREATE POLICY "Service role can manage all learning modules"
ON learning_modules FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Service role can manage all lessons" ON lessons;
CREATE POLICY "Service role can manage all lessons"
ON lessons FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Service role can manage all quizzes" ON quizzes;
CREATE POLICY "Service role can manage all quizzes"
ON quizzes FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Service role can manage all progress" ON user_lesson_progress;
CREATE POLICY "Service role can manage all progress"
ON user_lesson_progress FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Service role can manage all quiz attempts" ON quiz_attempts;
CREATE POLICY "Service role can manage all quiz attempts"
ON quiz_attempts FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Service role can manage all module progress" ON user_module_progress;
CREATE POLICY "Service role can manage all module progress"
ON user_module_progress FOR ALL
TO service_role
USING (true);

-- ============================================
-- Functions for Progress Updates
-- ============================================

-- Function to update module progress when lesson is completed
CREATE OR REPLACE FUNCTION update_module_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_module_id UUID;
    v_total_lessons INTEGER;
    v_completed_lessons INTEGER;
    v_progress INTEGER;
BEGIN
    -- Get the module ID for this lesson
    SELECT module_id INTO v_module_id
    FROM lessons
    WHERE id = NEW.lesson_id;

    IF v_module_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count total and completed lessons
    SELECT COUNT(*) INTO v_total_lessons
    FROM lessons
    WHERE module_id = v_module_id AND is_published = true;

    SELECT COUNT(*) INTO v_completed_lessons
    FROM user_lesson_progress ulp
    JOIN lessons l ON l.id = ulp.lesson_id
    WHERE l.module_id = v_module_id
    AND ulp.user_id = NEW.user_id
    AND ulp.completed = true;

    -- Calculate progress percentage
    IF v_total_lessons > 0 THEN
        v_progress := (v_completed_lessons * 100) / v_total_lessons;
    ELSE
        v_progress := 0;
    END IF;

    -- Upsert module progress
    INSERT INTO user_module_progress (user_id, module_id, lessons_completed, total_lessons, progress_percent, updated_at)
    VALUES (NEW.user_id, v_module_id, v_completed_lessons, v_total_lessons, v_progress, NOW())
    ON CONFLICT (user_id, module_id)
    DO UPDATE SET
        lessons_completed = v_completed_lessons,
        total_lessons = v_total_lessons,
        progress_percent = v_progress,
        completed_at = CASE WHEN v_progress = 100 THEN NOW() ELSE NULL END,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update module progress
DROP TRIGGER IF EXISTS update_module_progress_trigger ON user_lesson_progress;
CREATE TRIGGER update_module_progress_trigger
AFTER INSERT OR UPDATE ON user_lesson_progress
FOR EACH ROW
EXECUTE FUNCTION update_module_progress();

-- ============================================
-- Function to update lessons count on module
-- ============================================
CREATE OR REPLACE FUNCTION update_module_lessons_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE learning_modules
    SET lessons_count = (
        SELECT COUNT(*)
        FROM lessons
        WHERE module_id = COALESCE(NEW.module_id, OLD.module_id)
        AND is_published = true
    ),
    estimated_duration = (
        SELECT COALESCE(SUM(duration), 0)
        FROM lessons
        WHERE module_id = COALESCE(NEW.module_id, OLD.module_id)
        AND is_published = true
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.module_id, OLD.module_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for lessons count
DROP TRIGGER IF EXISTS update_lessons_count_trigger ON lessons;
CREATE TRIGGER update_lessons_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON lessons
FOR EACH ROW
EXECUTE FUNCTION update_module_lessons_count();

-- ============================================
-- Updated At Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS learning_modules_updated_at ON learning_modules;
CREATE TRIGGER learning_modules_updated_at
BEFORE UPDATE ON learning_modules
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS lessons_updated_at ON lessons;
CREATE TRIGGER lessons_updated_at
BEFORE UPDATE ON lessons
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS user_lesson_progress_updated_at ON user_lesson_progress;
CREATE TRIGGER user_lesson_progress_updated_at
BEFORE UPDATE ON user_lesson_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Seed initial learning modules (optional)
-- ============================================
INSERT INTO learning_modules (slug, title, description, icon, color, order_index, difficulty, is_published)
VALUES
    ('fundamentals', 'Trading Fundamentals', 'Account setup, broker configuration, and chart basics. Start here if you''re new to trading.', 'BookOpen', '#3B82F6', 1, 'beginner', true),
    ('price-action', 'Price Action Mastery', 'Understanding candlesticks, market structure, and reading price movement.', 'TrendingUp', '#10B981', 2, 'beginner', true),
    ('indicators', 'Technical Indicators', 'Master EMAs, VWAP, and other essential trading indicators.', 'Activity', '#8B5CF6', 3, 'intermediate', true),
    ('ltp-framework', 'LTP Framework', 'Levels, Trends, and Patience - the core trading methodology that brings it all together.', 'Target', '#F59E0B', 4, 'intermediate', true),
    ('strategies', 'Trading Strategies', 'Specific trading strategies including ORB, gap trading, and more.', 'Crosshair', '#EF4444', 5, 'intermediate', true),
    ('entries-exits', 'Entries & Exits', 'Master the art of entering at the right time and taking profits properly.', 'ArrowRightLeft', '#06B6D4', 6, 'intermediate', true),
    ('psychology', 'Trading Psychology', 'Master your mind - the most important edge in trading.', 'Brain', '#EC4899', 7, 'advanced', true),
    ('trading-rules', 'Trading Rules & Principles', 'The rules and principles that separate consistent traders from gamblers.', 'ClipboardList', '#F97316', 8, 'advanced', true),
    ('watchlist-setup', 'Watchlist & Pre-Market', 'Building your watchlist and preparing for each trading day.', 'ListChecks', '#84CC16', 9, 'beginner', true)
ON CONFLICT (slug) DO NOTHING;
