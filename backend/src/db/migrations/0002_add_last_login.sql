-- ============================================================================
-- MIGRATION: 0002_add_last_login.sql
-- Description: Add last_login column and fix all timestamps to ISO 8601 UTC
-- Date: 2026-01-08
-- ============================================================================

-- Add last_login column to users table
ALTER TABLE users ADD COLUMN last_login TEXT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

-- Convert all existing timestamps to ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
UPDATE users SET
  created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at),
  last_login = strftime('%Y-%m-%dT%H:%M:%SZ', COALESCE(last_login, created_at))
WHERE id IS NOT NULL;
