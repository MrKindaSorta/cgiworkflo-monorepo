-- ============================================================================
-- MIGRATION: 0002_aar_json_schema.sql
-- Description: Restructure AARs table for JSON-based dynamic forms
-- Date: 2026-01-12
-- ============================================================================
-- This migration enables the AAR system to work with dynamic custom forms
-- by storing all form data as JSON while keeping commonly-filtered fields
-- as indexed columns for performance.
-- ============================================================================

-- Step 1: Drop all existing views that reference the aars table
-- These will need to be recreated with JSON extraction after migration
DROP VIEW IF EXISTS v_aar_stats_by_category;
DROP VIEW IF EXISTS v_aar_stats_by_material;
DROP VIEW IF EXISTS v_top_contributors;

-- Step 2: Drop all existing triggers that reference the aars table
-- These will be recreated after the table is restructured
DROP TRIGGER IF EXISTS aars_fts_insert;
DROP TRIGGER IF EXISTS aars_fts_update;
DROP TRIGGER IF EXISTS aars_fts_delete;
DROP TRIGGER IF EXISTS aar_votes_insert;
DROP TRIGGER IF EXISTS aar_votes_update;
DROP TRIGGER IF EXISTS aar_votes_delete;
DROP TRIGGER IF EXISTS aar_views_insert;
DROP TRIGGER IF EXISTS comments_insert;
DROP TRIGGER IF EXISTS comments_delete;

-- Step 3: Create new AARs table structure with JSON support
CREATE TABLE IF NOT EXISTS aars_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Fixed columns for common filters/search (extracted from form data for performance)
    -- These are nullable because custom forms may not include these fields
    category TEXT,
    material TEXT,
    damage_type TEXT,

    -- Form schema metadata for backwards compatibility
    form_id TEXT NOT NULL,        -- References custom_forms.id
    form_version TEXT NOT NULL,   -- Snapshot of version at submission time (e.g., "1.0.0")

    -- Dynamic form data as JSON blob
    -- Contains all field values including photo URLs, measurements, descriptions, etc.
    form_data TEXT NOT NULL,      -- JSON string

    -- Engagement metrics (denormalized for performance)
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,

    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,          -- Soft delete

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (form_id) REFERENCES custom_forms(id) ON DELETE SET NULL
);

-- Step 4: Copy existing data (if any) - with transformation
-- Note: For fresh implementation, this step can be skipped
-- If there are existing AARs in the old structure, they would be migrated here

-- Step 5: Drop old table and rename new table
DROP TABLE IF EXISTS aars;
ALTER TABLE aars_new RENAME TO aars;

-- Step 6: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_aars_user_id ON aars(user_id);
CREATE INDEX IF NOT EXISTS idx_aars_category ON aars(category);
CREATE INDEX IF NOT EXISTS idx_aars_material ON aars(material);
CREATE INDEX IF NOT EXISTS idx_aars_damage_type ON aars(damage_type);
CREATE INDEX IF NOT EXISTS idx_aars_form_id ON aars(form_id);
CREATE INDEX IF NOT EXISTS idx_aars_created_at ON aars(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aars_upvotes ON aars(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_aars_views ON aars(views DESC);
CREATE INDEX IF NOT EXISTS idx_aars_deleted_at ON aars(deleted_at);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_aars_category_created ON aars(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aars_material_created ON aars(material, created_at DESC);

-- Step 7: Update photos table to support field-based organization
-- Add columns to link photos to specific form fields
ALTER TABLE photos ADD COLUMN field_id TEXT;           -- Links to form field that uploaded this
ALTER TABLE photos ADD COLUMN display_order INTEGER DEFAULT 0;  -- Order within field

-- Re-create index for photos with field_id
DROP INDEX IF EXISTS idx_photos_aar;
CREATE INDEX IF NOT EXISTS idx_photos_aar_field ON photos(aar_id, field_id);
CREATE INDEX IF NOT EXISTS idx_photos_display_order ON photos(aar_id, field_id, display_order);

-- Step 8: Recreate FTS (Full-Text Search) table with JSON data indexing
-- Drop existing triggers and table
DROP TRIGGER IF EXISTS aars_fts_insert;
DROP TRIGGER IF EXISTS aars_fts_update;
DROP TRIGGER IF EXISTS aars_fts_delete;
DROP TABLE IF EXISTS aars_fts;

-- Create FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS aars_fts USING fts5(
    aar_id UNINDEXED,           -- AAR reference (not searchable)
    category,                   -- Searchable category field
    material,                   -- Searchable material field
    form_data_text,             -- All form data as searchable text
    content=aars,               -- Link to source table
    content_rowid=rowid         -- Use rowid for sync
);

-- Trigger: Sync FTS on AAR insert
CREATE TRIGGER IF NOT EXISTS aars_fts_insert AFTER INSERT ON aars BEGIN
    INSERT INTO aars_fts(aar_id, category, material, form_data_text)
    VALUES (new.id, new.category, new.material, new.form_data);
END;

-- Trigger: Sync FTS on AAR update
CREATE TRIGGER IF NOT EXISTS aars_fts_update AFTER UPDATE ON aars BEGIN
    DELETE FROM aars_fts WHERE aar_id = old.id;
    INSERT INTO aars_fts(aar_id, category, material, form_data_text)
    VALUES (new.id, new.category, new.material, new.form_data);
END;

-- Trigger: Sync FTS on AAR delete
CREATE TRIGGER IF NOT EXISTS aars_fts_delete AFTER DELETE ON aars BEGIN
    DELETE FROM aars_fts WHERE aar_id = old.id;
END;

-- Step 9: Create trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS aars_update_timestamp;
CREATE TRIGGER IF NOT EXISTS aars_update_timestamp
AFTER UPDATE ON aars
WHEN old.updated_at = new.updated_at  -- Only if not manually set
BEGIN
    UPDATE aars SET updated_at = datetime('now')
    WHERE id = new.id;
END;

-- Step 10: Recreate engagement metric triggers
-- These triggers maintain denormalized counts in the aars table

-- Voting triggers: Update upvote/downvote counts
CREATE TRIGGER IF NOT EXISTS aar_votes_insert
AFTER INSERT ON aar_votes
BEGIN
    UPDATE aars
    SET upvotes = upvotes + CASE WHEN new.vote_type = 'upvote' THEN 1 ELSE 0 END,
        downvotes = downvotes + CASE WHEN new.vote_type = 'downvote' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = new.aar_id;
END;

CREATE TRIGGER IF NOT EXISTS aar_votes_update
AFTER UPDATE ON aar_votes
BEGIN
    UPDATE aars
    SET upvotes = upvotes
        - CASE WHEN old.vote_type = 'upvote' THEN 1 ELSE 0 END
        + CASE WHEN new.vote_type = 'upvote' THEN 1 ELSE 0 END,
        downvotes = downvotes
        - CASE WHEN old.vote_type = 'downvote' THEN 1 ELSE 0 END
        + CASE WHEN new.vote_type = 'downvote' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = new.aar_id;
END;

CREATE TRIGGER IF NOT EXISTS aar_votes_delete
AFTER DELETE ON aar_votes
BEGIN
    UPDATE aars
    SET upvotes = upvotes - CASE WHEN old.vote_type = 'upvote' THEN 1 ELSE 0 END,
        downvotes = downvotes - CASE WHEN old.vote_type = 'downvote' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = old.aar_id;
END;

-- View tracking trigger: Increment view count
CREATE TRIGGER IF NOT EXISTS aar_views_insert
AFTER INSERT ON aar_views
BEGIN
    UPDATE aars
    SET views = views + 1,
        updated_at = datetime('now')
    WHERE id = new.aar_id;
END;

-- Comment triggers: Update comment count
CREATE TRIGGER IF NOT EXISTS comments_insert
AFTER INSERT ON comments
BEGIN
    UPDATE aars
    SET comment_count = comment_count + 1,
        updated_at = datetime('now')
    WHERE id = new.aar_id AND deleted_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS comments_delete
AFTER DELETE ON comments
BEGIN
    UPDATE aars
    SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = old.aar_id;
END;

-- ============================================================================
-- Migration complete!
--
-- Next steps:
-- 1. Apply this migration to production:
--    wrangler d1 execute cgiworkflo-db-production --file=backend/src/db/migrations/0002_aar_json_schema.sql --remote
--
-- 2. Verify table structure:
--    wrangler d1 execute cgiworkflo-db-production --command "PRAGMA table_info(aars)" --remote
--
-- 3. Check indexes:
--    wrangler d1 execute cgiworkflo-db-production --command "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='aars'" --remote
-- ============================================================================
