-- ============================================================================
-- MIGRATION: 0003_fix_timestamp_format.sql
-- Description: Convert all existing timestamps to ISO 8601 UTC format
-- Date: 2026-01-08
-- ============================================================================

-- Convert all user timestamps to ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
UPDATE users SET
  created_at = strftime('%Y-%m-%dT%H:%M:%SZ', created_at),
  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', updated_at),
  last_login = CASE
    WHEN last_login IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%SZ', last_login)
    ELSE NULL
  END
WHERE id IS NOT NULL;
