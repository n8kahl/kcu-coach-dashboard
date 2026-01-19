-- ============================================
-- Trade Journal Enhancements Migration
-- ============================================
-- This migration adds new fields for:
-- - Screenshot paste-to-analyze feature
-- - Quick entry mode
-- - AI analysis storage
-- - Enhanced psychology tracking
-- - Post-trade feedback
-- - Tilt detection and intervention system
-- ============================================

-- ============================================
-- PHASE 1: Core Trade Journal Fields
-- ============================================

-- Add new columns to trade_journal table
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS chart_screenshot TEXT;
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS entry_mode VARCHAR(20) DEFAULT 'full';
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS r_multiple DECIMAL(10,2);

-- ============================================
-- PHASE 2: Psychology & Emotion Tracking
-- ============================================

-- Pre-trade mindset
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS pre_trade_confidence INTEGER;
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS pre_trade_sleep INTEGER;
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS pre_trade_stress VARCHAR(20);

-- During-trade emotions (array of emotion tags)
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS during_emotions TEXT[];

-- Post-trade reflection
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS post_satisfaction INTEGER;
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS would_take_again BOOLEAN;
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS lesson_learned TEXT;

-- ============================================
-- PHASE 2: Post-Trade AI Feedback
-- ============================================

ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS ai_feedback JSONB;
ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS feedback_reviewed BOOLEAN DEFAULT false;

-- ============================================
-- PHASE 2: Tilt Detection System
-- ============================================

CREATE TABLE IF NOT EXISTS tilt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL, -- 'yellow_warning', 'red_warning', 'dismissed', 'cooldown_started', 'cooldown_completed'
  severity VARCHAR(20), -- 'yellow', 'red'
  signals JSONB NOT NULL, -- { consecutiveLosses, tradingFrequency, positionSizeDeviation, ... }
  dismissed_at TIMESTAMP WITH TIME ZONE,
  cooldown_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tilt_events_user ON tilt_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tilt_events_created ON tilt_events(created_at DESC);

-- ============================================
-- PHASE 3: Intervention Alerts System
-- ============================================

CREATE TABLE IF NOT EXISTS intervention_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'inactive_7d', 'losing_streak_5', 'ltp_compliance_low', 'significant_drawdown', 'tilt_event', 'negative_trend'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES user_profiles(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intervention_alerts_user ON intervention_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_intervention_alerts_type ON intervention_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_intervention_alerts_severity ON intervention_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_intervention_alerts_acknowledged ON intervention_alerts(acknowledged);

-- ============================================
-- PHASE 3: Mentor Relationships
-- ============================================

CREATE TABLE IF NOT EXISTS mentor_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'ended'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mentor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_mentor_relationships_mentor ON mentor_relationships(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_relationships_student ON mentor_relationships(student_id);

-- ============================================
-- PHASE 3: Trade Comments
-- ============================================

CREATE TABLE IF NOT EXISTS trade_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trade_journal(id) ON DELETE CASCADE,
  author_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_private BOOLEAN DEFAULT true, -- only visible to student and mentors
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_comments_trade ON trade_comments(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_comments_author ON trade_comments(author_id);

-- ============================================
-- PHASE 3: Daily Coaching Summaries
-- ============================================

CREATE TABLE IF NOT EXISTS daily_coaching_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  trades_count INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  total_pnl DECIMAL(10,2),
  ltp_compliance DECIMAL(5,2),
  ai_summary TEXT,
  ai_insights JSONB,
  focus_areas TEXT[],
  streak_info JSONB, -- { winStreak, lossStreak, isHot, isCold }
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_user ON daily_coaching_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_coaching_summaries(summary_date DESC);

-- ============================================
-- Additional Indexes for Performance
-- ============================================

-- Index for quick entry mode filtering
CREATE INDEX IF NOT EXISTS idx_journal_entry_mode ON trade_journal(entry_mode);

-- Index for fetching recent symbols (for autocomplete)
CREATE INDEX IF NOT EXISTS idx_journal_user_symbol_time ON trade_journal(user_id, symbol, entry_time DESC);

-- Index for AI analysis queries
CREATE INDEX IF NOT EXISTS idx_journal_ai_analysis ON trade_journal(ai_analysis) WHERE ai_analysis IS NOT NULL;

-- ============================================
-- RLS Policies for New Tables
-- ============================================

ALTER TABLE tilt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_coaching_summaries ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
CREATE POLICY "Service role full access" ON tilt_events FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON intervention_alerts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON mentor_relationships FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON trade_comments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON daily_coaching_summaries FOR ALL TO service_role USING (true);

-- Users can view/manage their own tilt events
DROP POLICY IF EXISTS "Users own tilt events" ON tilt_events;
CREATE POLICY "Users own tilt events" ON tilt_events FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Users can view their own intervention alerts (read only - admins manage)
DROP POLICY IF EXISTS "Users view own alerts" ON intervention_alerts;
CREATE POLICY "Users view own alerts" ON intervention_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can view relationships where they are mentor or student
DROP POLICY IF EXISTS "Users view own mentor relationships" ON mentor_relationships;
CREATE POLICY "Users view own mentor relationships" ON mentor_relationships FOR SELECT TO authenticated
  USING (mentor_id = auth.uid() OR student_id = auth.uid());

-- Users can view comments on their trades or comments they authored
DROP POLICY IF EXISTS "Users view trade comments" ON trade_comments;
CREATE POLICY "Users view trade comments" ON trade_comments FOR SELECT TO authenticated
  USING (
    author_id = auth.uid() OR
    trade_id IN (SELECT id FROM trade_journal WHERE user_id = auth.uid())
  );

-- Users can create comments (authors only)
DROP POLICY IF EXISTS "Users create trade comments" ON trade_comments;
CREATE POLICY "Users create trade comments" ON trade_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Users can view their own daily summaries
DROP POLICY IF EXISTS "Users own daily summaries" ON daily_coaching_summaries;
CREATE POLICY "Users own daily summaries" ON daily_coaching_summaries FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- Done!
-- ============================================
SELECT 'Trade journal enhancements migration completed!' AS status;
