-- ============================================
-- Thinkific Integration Tables
-- Syncs user data, enrollments, and progress from Thinkific LMS
-- ============================================

-- ============================================
-- Thinkific Users Table
-- Stores Thinkific user data for reference
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thinkific_id INTEGER UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    external_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email)
);

CREATE INDEX idx_thinkific_users_external ON thinkific_users(external_id);
CREATE INDEX idx_thinkific_users_email ON thinkific_users(email);

-- ============================================
-- Thinkific Enrollments Table
-- Tracks user enrollments and progress in courses
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thinkific_enrollment_id INTEGER UNIQUE NOT NULL,
    thinkific_user_id INTEGER NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    course_id INTEGER NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    percentage_completed DECIMAL(5,2) DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    expired BOOLEAN DEFAULT FALSE,
    expiry_date TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_thinkific_enrollments_user ON thinkific_enrollments(thinkific_user_id);
CREATE INDEX idx_thinkific_enrollments_course ON thinkific_enrollments(course_id);
CREATE INDEX idx_thinkific_enrollments_email ON thinkific_enrollments(user_email);
CREATE INDEX idx_thinkific_enrollments_completed ON thinkific_enrollments(completed) WHERE completed = true;

-- ============================================
-- Thinkific Lesson Completions Table
-- Tracks individual lesson completions
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_lesson_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thinkific_user_id INTEGER NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    course_id INTEGER NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    chapter_id INTEGER NOT NULL,
    chapter_name VARCHAR(255),
    content_id INTEGER NOT NULL,
    content_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'video', 'quiz', 'text', etc.
    completed_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(thinkific_user_id, content_id)
);

CREATE INDEX idx_thinkific_lessons_user ON thinkific_lesson_completions(thinkific_user_id);
CREATE INDEX idx_thinkific_lessons_course ON thinkific_lesson_completions(course_id);
CREATE INDEX idx_thinkific_lessons_content ON thinkific_lesson_completions(content_id);
CREATE INDEX idx_thinkific_lessons_type ON thinkific_lesson_completions(content_type);

-- ============================================
-- Thinkific Webhook Logs
-- For debugging and audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS thinkific_webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_thinkific_webhooks_type ON thinkific_webhook_logs(event_type);
CREATE INDEX idx_thinkific_webhooks_time ON thinkific_webhook_logs(received_at DESC);

-- Auto-cleanup old webhook logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM thinkific_webhook_logs
    WHERE received_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add Thinkific fields to user_profiles
-- ============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS thinkific_user_id INTEGER,
ADD COLUMN IF NOT EXISTS thinkific_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_profiles_thinkific ON user_profiles(thinkific_user_id);

-- ============================================
-- Views for Analytics
-- ============================================

-- User progress across all Thinkific courses
CREATE OR REPLACE VIEW v_thinkific_user_progress AS
SELECT
    up.id AS kcu_user_id,
    up.discord_username,
    up.thinkific_user_id,
    te.course_name,
    te.percentage_completed,
    te.completed,
    te.completed_at,
    COUNT(tlc.id) AS lessons_completed,
    COUNT(CASE WHEN tlc.content_type = 'quiz' THEN 1 END) AS quizzes_completed,
    COUNT(CASE WHEN tlc.content_type = 'video' THEN 1 END) AS videos_watched
FROM user_profiles up
LEFT JOIN thinkific_enrollments te ON te.thinkific_user_id = up.thinkific_user_id
LEFT JOIN thinkific_lesson_completions tlc ON tlc.thinkific_user_id = up.thinkific_user_id
    AND tlc.course_id = te.course_id
WHERE up.thinkific_user_id IS NOT NULL
GROUP BY up.id, up.discord_username, up.thinkific_user_id, te.course_name,
         te.percentage_completed, te.completed, te.completed_at;

-- Course completion leaderboard
CREATE OR REPLACE VIEW v_thinkific_leaderboard AS
SELECT
    up.id AS kcu_user_id,
    up.discord_username,
    up.avatar_url,
    COUNT(DISTINCT CASE WHEN te.completed THEN te.course_id END) AS courses_completed,
    COUNT(DISTINCT tlc.content_id) AS total_lessons,
    AVG(te.percentage_completed) AS avg_progress,
    MAX(tlc.completed_at) AS last_activity
FROM user_profiles up
LEFT JOIN thinkific_enrollments te ON te.thinkific_user_id = up.thinkific_user_id
LEFT JOIN thinkific_lesson_completions tlc ON tlc.thinkific_user_id = up.thinkific_user_id
WHERE up.thinkific_user_id IS NOT NULL
GROUP BY up.id, up.discord_username, up.avatar_url
ORDER BY courses_completed DESC, total_lessons DESC;

-- Recent Thinkific activity feed
CREATE OR REPLACE VIEW v_thinkific_activity AS
SELECT
    'lesson_completed' AS activity_type,
    up.id AS kcu_user_id,
    up.discord_username,
    up.avatar_url,
    tlc.content_name AS title,
    tlc.course_name AS course,
    tlc.content_type,
    tlc.completed_at AS activity_at
FROM thinkific_lesson_completions tlc
JOIN user_profiles up ON up.thinkific_user_id = tlc.thinkific_user_id
UNION ALL
SELECT
    'course_completed' AS activity_type,
    up.id AS kcu_user_id,
    up.discord_username,
    up.avatar_url,
    te.course_name AS title,
    te.course_name AS course,
    'course' AS content_type,
    te.completed_at AS activity_at
FROM thinkific_enrollments te
JOIN user_profiles up ON up.thinkific_user_id = te.thinkific_user_id
WHERE te.completed = true
ORDER BY activity_at DESC;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE thinkific_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinkific_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own Thinkific data
CREATE POLICY "Users can view their own thinkific data"
ON thinkific_users FOR SELECT
TO authenticated
USING (external_id = auth.uid());

CREATE POLICY "Users can view their own enrollments"
ON thinkific_enrollments FOR SELECT
TO authenticated
USING (
    thinkific_user_id IN (
        SELECT thinkific_user_id FROM user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can view their own lesson completions"
ON thinkific_lesson_completions FOR SELECT
TO authenticated
USING (
    thinkific_user_id IN (
        SELECT thinkific_user_id FROM user_profiles WHERE id = auth.uid()
    )
);

-- Service role full access for webhooks
CREATE POLICY "Service role manages thinkific_users"
ON thinkific_users FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages enrollments"
ON thinkific_enrollments FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages lesson_completions"
ON thinkific_lesson_completions FOR ALL TO service_role USING (true);

CREATE POLICY "Service role manages webhook_logs"
ON thinkific_webhook_logs FOR ALL TO service_role USING (true);

-- ============================================
-- Function to get user's combined progress
-- ============================================
CREATE OR REPLACE FUNCTION get_user_learning_progress(p_user_id UUID)
RETURNS TABLE (
    source VARCHAR,
    course_name VARCHAR,
    progress DECIMAL,
    completed BOOLEAN,
    lessons_done INTEGER,
    last_activity TIMESTAMPTZ
) AS $$
BEGIN
    -- Return Thinkific progress
    RETURN QUERY
    SELECT
        'thinkific'::VARCHAR AS source,
        te.course_name::VARCHAR,
        te.percentage_completed AS progress,
        te.completed,
        COUNT(tlc.id)::INTEGER AS lessons_done,
        MAX(tlc.completed_at) AS last_activity
    FROM thinkific_enrollments te
    LEFT JOIN thinkific_lesson_completions tlc
        ON tlc.thinkific_user_id = te.thinkific_user_id
        AND tlc.course_id = te.course_id
    WHERE te.thinkific_user_id = (
        SELECT thinkific_user_id FROM user_profiles WHERE id = p_user_id
    )
    GROUP BY te.course_name, te.percentage_completed, te.completed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- XP Award Function (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION add_user_xp(
    p_user_id UUID,
    p_xp INTEGER,
    p_source VARCHAR,
    p_source_id VARCHAR DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Update user XP
    UPDATE user_profiles
    SET
        total_xp = COALESCE(total_xp, 0) + p_xp,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log XP transaction
    INSERT INTO xp_transactions (user_id, amount, source, source_id, created_at)
    VALUES (p_user_id, p_xp, p_source, p_source_id, NOW())
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create XP transactions table if not exists
CREATE TABLE IF NOT EXISTS xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    source VARCHAR(100) NOT NULL,
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_source ON xp_transactions(source);
