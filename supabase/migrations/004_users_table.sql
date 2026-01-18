-- ============================================
-- KCU Coach - Users Table Migration
-- ============================================
-- This migration creates the 'users' table that is referenced
-- by the user_profiles foreign key constraint.
--
-- NOTE: This table may already exist if the database was manually
-- configured. The IF NOT EXISTS clause ensures safe execution.

-- ============================================
-- USERS TABLE (Parent of user_profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for Discord ID lookups
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role full access" ON users;
CREATE POLICY "Service role full access" ON users FOR ALL TO service_role USING (true);

-- Users can view their own record
DROP POLICY IF EXISTS "Users can view own record" ON users;
CREATE POLICY "Users can view own record" ON users FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ============================================
-- Add foreign key constraint to user_profiles if not exists
-- ============================================
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_profiles_id_fkey'
    AND table_name = 'user_profiles'
  ) THEN
    -- Only add if it doesn't exist
    ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_id_fkey
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Done!
SELECT 'Users table migration completed!' AS status;
