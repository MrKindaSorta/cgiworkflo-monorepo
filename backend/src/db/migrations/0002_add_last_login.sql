-- ============================================================================
-- MIGRATION: 0002_add_last_login.sql
-- Description: Add last_login column to users table for tracking user activity
-- Date: 2026-01-08
-- ============================================================================

-- Add last_login column to users table
ALTER TABLE users ADD COLUMN last_login TEXT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

-- Update existing users to have a last_login (set to created_at as fallback)
UPDATE users SET last_login = created_at WHERE last_login IS NULL;
