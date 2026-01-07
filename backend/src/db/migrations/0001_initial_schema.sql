-- ============================================================================
-- MIGRATION: 0001_initial_schema.sql
-- Description: Initial database schema for CGIWorkFlo.com
-- Date: 2026-01-07
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'franchisee', 'employee')),
    franchise_id TEXT NULL,
    address TEXT,
    phone TEXT,
    preferences_unit_area TEXT DEFAULT 'sqft' CHECK(preferences_unit_area IN ('sqft', 'sqm')),
    preferences_unit_liquid TEXT DEFAULT 'ml' CHECK(preferences_unit_liquid IN ('ml', 'oz', 'l', 'gal')),
    preferences_language TEXT DEFAULT 'en' CHECK(preferences_language IN ('en', 'fr', 'de', 'es', 'ja')),
    preferences_theme TEXT DEFAULT 'light' CHECK(preferences_theme IN ('light', 'dark')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,
    FOREIGN KEY (franchise_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_franchise_id ON users(franchise_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- ----------------------------------------------------------------------------
-- AARS (After Action Reports) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aars (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Category hierarchy
    category TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    model TEXT,
    year TEXT,
    color TEXT,
    material TEXT NOT NULL,
    damage_type TEXT NOT NULL,

    -- Descriptions
    damage_description TEXT NOT NULL,
    process_description TEXT,
    notes TEXT,
    paint_dye_mix TEXT,

    -- Job details
    job_type TEXT NOT NULL,
    repair_time_hours REAL,
    tools_used TEXT, -- JSON array

    -- Measurements (stored with original units)
    area_value REAL,
    area_unit TEXT CHECK(area_unit IN ('sqft', 'sqm', 'sqcm')),
    liquid_value REAL,
    liquid_unit TEXT CHECK(liquid_unit IN ('ml', 'oz', 'l', 'gal')),

    -- Cost (private, shown as ranges)
    cost_amount REAL,
    cost_currency TEXT DEFAULT 'USD',

    -- Engagement metrics (denormalized for performance)
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,

    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for filtering and search
CREATE INDEX IF NOT EXISTS idx_aars_user_id ON aars(user_id);
CREATE INDEX IF NOT EXISTS idx_aars_category ON aars(category);
CREATE INDEX IF NOT EXISTS idx_aars_sub_category ON aars(sub_category);
CREATE INDEX IF NOT EXISTS idx_aars_material ON aars(material);
CREATE INDEX IF NOT EXISTS idx_aars_damage_type ON aars(damage_type);
CREATE INDEX IF NOT EXISTS idx_aars_job_type ON aars(job_type);
CREATE INDEX IF NOT EXISTS idx_aars_created_at ON aars(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aars_upvotes ON aars(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_aars_views ON aars(views DESC);
CREATE INDEX IF NOT EXISTS idx_aars_deleted_at ON aars(deleted_at);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_aars_category_created ON aars(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aars_material_created ON aars(material, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aars_category_material ON aars(category, material);

-- ----------------------------------------------------------------------------
-- PHOTOS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    aar_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('before', 'after')),
    r2_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (aar_id) REFERENCES aars(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_photos_aar ON photos(aar_id);
CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(type);

-- ----------------------------------------------------------------------------
-- FULL-TEXT SEARCH FOR AARS
-- ----------------------------------------------------------------------------
CREATE VIRTUAL TABLE IF NOT EXISTS aars_fts USING fts5(
    aar_id UNINDEXED,
    category,
    sub_category,
    model,
    material,
    damage_description,
    process_description,
    notes,
    paint_dye_mix,
    content=aars,
    content_rowid=rowid
);

-- Triggers to keep FTS table in sync
CREATE TRIGGER IF NOT EXISTS aars_fts_insert AFTER INSERT ON aars BEGIN
    INSERT INTO aars_fts(aar_id, category, sub_category, model, material,
                         damage_description, process_description, notes, paint_dye_mix)
    VALUES (new.id, new.category, new.sub_category, new.model, new.material,
            new.damage_description, new.process_description, new.notes, new.paint_dye_mix);
END;

CREATE TRIGGER IF NOT EXISTS aars_fts_update AFTER UPDATE ON aars BEGIN
    DELETE FROM aars_fts WHERE aar_id = old.id;
    INSERT INTO aars_fts(aar_id, category, sub_category, model, material,
                         damage_description, process_description, notes, paint_dye_mix)
    VALUES (new.id, new.category, new.sub_category, new.model, new.material,
            new.damage_description, new.process_description, new.notes, new.paint_dye_mix);
END;

CREATE TRIGGER IF NOT EXISTS aars_fts_delete AFTER DELETE ON aars BEGIN
    DELETE FROM aars_fts WHERE aar_id = old.id;
END;

-- ----------------------------------------------------------------------------
-- AAR VOTES TABLE (for audit trail and preventing duplicate votes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aar_votes (
    id TEXT PRIMARY KEY,
    aar_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK(vote_type IN ('upvote', 'downvote')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (aar_id) REFERENCES aars(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(aar_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_aar_votes_aar_id ON aar_votes(aar_id);
CREATE INDEX IF NOT EXISTS idx_aar_votes_user_id ON aar_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_aar_votes_created_at ON aar_votes(created_at);

-- Trigger to update denormalized vote counts on AARs
CREATE TRIGGER IF NOT EXISTS aar_votes_insert AFTER INSERT ON aar_votes BEGIN
    UPDATE aars
    SET upvotes = upvotes + CASE WHEN new.vote_type = 'upvote' THEN 1 ELSE 0 END,
        downvotes = downvotes + CASE WHEN new.vote_type = 'downvote' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = new.aar_id;
END;

CREATE TRIGGER IF NOT EXISTS aar_votes_delete AFTER DELETE ON aar_votes BEGIN
    UPDATE aars
    SET upvotes = upvotes - CASE WHEN old.vote_type = 'upvote' THEN 1 ELSE 0 END,
        downvotes = downvotes - CASE WHEN old.vote_type = 'downvote' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = old.aar_id;
END;

CREATE TRIGGER IF NOT EXISTS aar_votes_update AFTER UPDATE ON aar_votes BEGIN
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

-- ----------------------------------------------------------------------------
-- AAR VIEWS TABLE (for analytics and tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aar_views (
    id TEXT PRIMARY KEY,
    aar_id TEXT NOT NULL,
    user_id TEXT NULL,
    viewed_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (aar_id) REFERENCES aars(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_aar_views_aar_id ON aar_views(aar_id);
CREATE INDEX IF NOT EXISTS idx_aar_views_user_id ON aar_views(user_id);
CREATE INDEX IF NOT EXISTS idx_aar_views_viewed_at ON aar_views(viewed_at);

-- Trigger to update denormalized view count
CREATE TRIGGER IF NOT EXISTS aar_views_insert AFTER INSERT ON aar_views BEGIN
    UPDATE aars
    SET views = views + 1,
        updated_at = datetime('now')
    WHERE id = new.aar_id;
END;

-- ----------------------------------------------------------------------------
-- COMMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    aar_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_comment_id TEXT NULL,
    content TEXT NOT NULL,
    thumbs_up INTEGER DEFAULT 0,
    thumbs_down INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,

    FOREIGN KEY (aar_id) REFERENCES aars(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_aar_id ON comments(aar_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments(deleted_at);

-- Trigger to update denormalized comment count
CREATE TRIGGER IF NOT EXISTS comments_insert AFTER INSERT ON comments BEGIN
    UPDATE aars
    SET comment_count = comment_count + 1,
        updated_at = datetime('now')
    WHERE id = new.aar_id AND deleted_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS comments_delete AFTER DELETE ON comments BEGIN
    UPDATE aars
    SET comment_count = CASE WHEN comment_count > 0 THEN comment_count - 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = old.aar_id;
END;

-- ----------------------------------------------------------------------------
-- COMMENT REACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comment_reactions (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK(reaction_type IN ('thumbs_up', 'thumbs_down')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON comment_reactions(user_id);

-- Triggers to update denormalized reaction counts
CREATE TRIGGER IF NOT EXISTS comment_reactions_insert AFTER INSERT ON comment_reactions BEGIN
    UPDATE comments
    SET thumbs_up = thumbs_up + CASE WHEN new.reaction_type = 'thumbs_up' THEN 1 ELSE 0 END,
        thumbs_down = thumbs_down + CASE WHEN new.reaction_type = 'thumbs_down' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = new.comment_id;
END;

CREATE TRIGGER IF NOT EXISTS comment_reactions_delete AFTER DELETE ON comment_reactions BEGIN
    UPDATE comments
    SET thumbs_up = thumbs_up - CASE WHEN old.reaction_type = 'thumbs_up' THEN 1 ELSE 0 END,
        thumbs_down = thumbs_down - CASE WHEN old.reaction_type = 'thumbs_down' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = old.comment_id;
END;

CREATE TRIGGER IF NOT EXISTS comment_reactions_update AFTER UPDATE ON comment_reactions BEGIN
    UPDATE comments
    SET thumbs_up = thumbs_up
        - CASE WHEN old.reaction_type = 'thumbs_up' THEN 1 ELSE 0 END
        + CASE WHEN new.reaction_type = 'thumbs_up' THEN 1 ELSE 0 END,
        thumbs_down = thumbs_down
        - CASE WHEN old.reaction_type = 'thumbs_down' THEN 1 ELSE 0 END
        + CASE WHEN new.reaction_type = 'thumbs_down' THEN 1 ELSE 0 END,
        updated_at = datetime('now')
    WHERE id = new.comment_id;
END;

-- ----------------------------------------------------------------------------
-- CONVERSATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('direct', 'group', 'open')),
    name TEXT NULL,
    created_by TEXT NULL,
    last_message_id TEXT NULL,
    last_message_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);

-- ----------------------------------------------------------------------------
-- CONVERSATION PARTICIPANTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_participants (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    unread_count INTEGER DEFAULT 0,
    last_read_at TEXT,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    left_at TEXT NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_unread ON conversation_participants(unread_count);

-- ----------------------------------------------------------------------------
-- MESSAGES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'file', 'system')),
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at);

-- Trigger to update conversation last_message info
CREATE TRIGGER IF NOT EXISTS messages_insert AFTER INSERT ON messages BEGIN
    UPDATE conversations
    SET last_message_id = new.id,
        last_message_at = new.created_at,
        updated_at = datetime('now')
    WHERE id = new.conversation_id;

    -- Increment unread count for all participants except sender
    UPDATE conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = new.conversation_id
    AND user_id != new.sender_id
    AND left_at IS NULL;
END;

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('upvote', 'downvote', 'comment', 'message', 'mention', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_type TEXT CHECK(link_type IN ('aar', 'comment', 'conversation', 'user')),
    link_id TEXT,
    read_at TEXT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at);

-- ----------------------------------------------------------------------------
-- BRANDING TABLE (for admin customization)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branding (
    id TEXT PRIMARY KEY DEFAULT '1',
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3b82f6',
    secondary_color TEXT DEFAULT '#8b5cf6',
    accent_color TEXT DEFAULT '#ec4899',
    company_name TEXT,
    tagline TEXT,
    custom_css TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    CHECK(id = '1')
);

-- Insert default branding
INSERT OR IGNORE INTO branding (id) VALUES ('1');

-- ----------------------------------------------------------------------------
-- CUSTOM FORMS TABLE (for form builder)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_forms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    form_schema TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    applies_to_category TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT NULL,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_custom_forms_active ON custom_forms(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_forms_category ON custom_forms(applies_to_category);
CREATE INDEX IF NOT EXISTS idx_custom_forms_created_by ON custom_forms(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_forms_deleted_at ON custom_forms(deleted_at);

-- ----------------------------------------------------------------------------
-- CATEGORIES TABLE (for reference data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed categories
INSERT OR IGNORE INTO categories (id, name, display_order) VALUES
    ('vehicle', 'Vehicle', 1),
    ('boat', 'Boat', 2),
    ('motorcycle', 'Motorcycle', 3),
    ('apparel', 'Apparel', 4),
    ('accessory', 'Accessory', 5),
    ('furniture', 'Furniture', 6),
    ('aircraft', 'Aircraft', 7),
    ('marine', 'Marine', 8),
    ('medical', 'Medical', 9),
    ('commercial', 'Commercial', 10);

-- ----------------------------------------------------------------------------
-- MATERIALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed materials
INSERT OR IGNORE INTO materials (id, name, display_order) VALUES
    ('leather', 'Leather', 1),
    ('vinyl', 'Vinyl', 2),
    ('fabric', 'Fabric', 3),
    ('plastic', 'Plastic', 4),
    ('wood', 'Wood', 5),
    ('metal', 'Metal', 6),
    ('carbon-fiber', 'Carbon Fiber', 7),
    ('suede', 'Suede', 8),
    ('alcantara', 'Alcantara', 9),
    ('nylon', 'Nylon', 10);

-- ============================================================================
-- ANALYTICS VIEWS (for reporting)
-- ============================================================================

-- AAR statistics by category
CREATE VIEW IF NOT EXISTS v_aar_stats_by_category AS
SELECT
    category,
    COUNT(*) as total_aars,
    SUM(upvotes) as total_upvotes,
    SUM(downvotes) as total_downvotes,
    SUM(views) as total_views,
    SUM(comment_count) as total_comments,
    AVG(repair_time_hours) as avg_repair_time,
    AVG(cost_amount) as avg_cost
FROM aars
WHERE deleted_at IS NULL
GROUP BY category;

-- AAR statistics by material
CREATE VIEW IF NOT EXISTS v_aar_stats_by_material AS
SELECT
    material,
    COUNT(*) as total_aars,
    SUM(upvotes) as total_upvotes,
    SUM(views) as total_views,
    AVG(repair_time_hours) as avg_repair_time,
    AVG(cost_amount) as avg_cost
FROM aars
WHERE deleted_at IS NULL
GROUP BY material;

-- Top contributors
CREATE VIEW IF NOT EXISTS v_top_contributors AS
SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    COUNT(a.id) as total_aars,
    SUM(a.upvotes) as total_upvotes,
    SUM(a.views) as total_views
FROM users u
LEFT JOIN aars a ON u.id = a.user_id AND a.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.name, u.email, u.role
ORDER BY total_aars DESC;

-- ============================================================================
-- END OF INITIAL SCHEMA
-- ============================================================================
