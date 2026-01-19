-- ============================================
-- KCU Coach - Admin Audit Log Migration
-- ============================================
-- Creates audit log table for tracking admin actions
-- and adds soft-delete support for users

-- ============================================
-- ADMIN AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'role', 'config', etc.
  target_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);

-- Enable RLS
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_log;
CREATE POLICY "Admins can view audit logs"
ON admin_audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Service role can insert/manage audit logs
DROP POLICY IF EXISTS "Service role can manage audit logs" ON admin_audit_log;
CREATE POLICY "Service role can manage audit logs"
ON admin_audit_log FOR ALL
TO service_role
USING (true);

-- ============================================
-- ADD SOFT DELETE TO USER_PROFILES
-- ============================================
DO $$
BEGIN
  -- Add disabled_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'disabled_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN disabled_at TIMESTAMPTZ;
  END IF;

  -- Add disabled_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'disabled_by'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN disabled_by UUID REFERENCES users(id);
  END IF;
END $$;

-- Index for filtering active/disabled users
CREATE INDEX IF NOT EXISTS idx_user_profiles_disabled ON user_profiles(disabled_at);

-- ============================================
-- Done
-- ============================================
SELECT 'Admin audit log migration completed!' AS status;
