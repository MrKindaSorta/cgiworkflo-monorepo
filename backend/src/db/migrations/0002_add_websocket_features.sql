-- Migration: Add WebSocket features (read receipts, typing indicators)
-- Created: 2026-01-09
-- Description: Adds support for real-time read receipts and typing status

-- ============================================================================
-- 1. Add read_by column to messages for tracking who read each message
-- ============================================================================
-- Stores JSON array of objects: [{"userId": "123", "readAt": "2026-01-09T12:00:00Z"}]
ALTER TABLE messages ADD COLUMN read_by TEXT DEFAULT '[]';

-- ============================================================================
-- 2. Create typing_status table for ephemeral typing indicators
-- ============================================================================
-- This table tracks who is currently typing in which conversation
-- Rows are automatically cleaned up after 10 seconds of inactivity
CREATE TABLE IF NOT EXISTS typing_status (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups by conversation
CREATE INDEX idx_typing_status_conversation ON typing_status(conversation_id, expires_at);

-- Index for cleanup queries
CREATE INDEX idx_typing_status_expires ON typing_status(expires_at);

-- ============================================================================
-- 3. Add last_activity column to conversation_participants for presence
-- ============================================================================
-- Tracks when user last interacted with conversation (for smarter sync)
ALTER TABLE conversation_participants ADD COLUMN last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 4. Create websocket_connections table for connection tracking
-- ============================================================================
-- Tracks active WebSocket connections for each user
-- Used for broadcasting and connection management
CREATE TABLE IF NOT EXISTS websocket_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  connection_metadata TEXT, -- JSON: {deviceType, browser, etc}
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Index for finding user's connections
CREATE INDEX idx_ws_connections_user ON websocket_connections(user_id);

-- Index for finding conversation connections
CREATE INDEX idx_ws_connections_conv ON websocket_connections(conversation_id);

-- Index for cleanup (remove stale connections)
CREATE INDEX idx_ws_connections_ping ON websocket_connections(last_ping);

-- ============================================================================
-- 5. Update existing messages to have empty read_by arrays
-- ============================================================================
-- Not needed since we set DEFAULT '[]' above, but included for clarity
-- UPDATE messages SET read_by = '[]' WHERE read_by IS NULL;
