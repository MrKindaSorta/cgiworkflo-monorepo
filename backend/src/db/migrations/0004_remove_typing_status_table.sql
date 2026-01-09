-- Migration: Remove unused typing_status table
-- Date: 2026-01-09
-- Description: ChatRoomDO tracks typing status in-memory only.
--              The typing_status database table is never used and creates inconsistency.
--              Removing it for better performance and clarity.

-- Drop indexes first
DROP INDEX IF EXISTS idx_typing_status_conversation;
DROP INDEX IF EXISTS idx_typing_status_expires;

-- Drop the unused table
DROP TABLE IF EXISTS typing_status;

-- Migration complete
-- Typing indicators are now purely ephemeral, managed in-memory by ChatRoomDO
-- This is faster, simpler, and more appropriate for real-time indicators
